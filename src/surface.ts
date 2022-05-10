import { getElementOffset } from 'get-element-offset'
import { attrs, dispatch, events, mixter, on, ondblclick, onSlotChange, props, queue, shadow, state } from 'mixter'
import { getRelativeMouseFromEvent } from 'relative-mouse'

let globalZIndex = 10

const style = /*css*/ `
:host {
  user-select: none;
  touch-action: none;
  display: inline-flex;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  border: 1px solid #ccc;
}

:host(.moving) {
  cursor: grabbing;
}
:host(.resizing) {
  cursor: nwse-resize;
}
:host(.inner-through) > *,
:host(.moving) > *,
:host(.resizing) > * {
  pointer-events: none;
}

[part=grid] {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

[part=inner] {
  transform-origin: 0 0;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

[part=minimap] {
  position: absolute;
  opacity: 0.6;
  width: 150px;
  height: 112.5px;
  right: 10px;
  top: 10px;
  z-index: 2;
  border-radius: 3px;
  transition: opacity 0.08s ease-out;
}

[part=minimap].hide {
  opacity: 0;
  pointer-events: none;
}

[part=minimap]:hover {
  opacity: 0.9;
}`

interface Point {
  x: number
  y: number
}

const round = ({ x, y }: Point, p = 1) => ({
  x: Math.round(x * p) / p,
  y: Math.round(y * p) / p,
})

const modwrap = (x: number, N: number) => (x % N + N) % N

const distance = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

export class SurfaceElement extends mixter(
  HTMLElement,
  shadow(
    /*html*/ `<style>${style}</style><canvas part="grid"></canvas><div part="inner"><slot></slot></div><canvas part="minimap" class="hide"></canvas>`
  ),
  events<SurfaceElement, SurfaceMoveEvents & SurfaceResizeEvents>(),
  attrs(
    class {
      pixelRatio = window.devicePixelRatio
      gridSize = 80
      snapThreshold = 0.15
      minZoom = 0.1
      maxZoom = 10
      minimapScale = 0.2
      minimapRatio = 4 / 3
      xPattern = '1' // 01010'
      yPattern = '1' // 01010'
    }
  ),
  props(
    class {
      zoom = 1
      offset: Point = { x: 0, y: 0 }
      matrix?: DOMMatrix
      target?: DOMMatrix | null
      scalePoint?: (p: Point) => Point
      normalizePoint?: (p: Point) => Point

      pointers = new Map<number, Point>()
      pointerCount = 0

      pinchStartMatrix?: DOMMatrix | null
      pinchStartDistance = 1

      rect?: DOMRect
      prev?: DOMRect

      slotted?: HTMLElement[]
      inner?: HTMLDivElement

      grid?: HTMLCanvasElement
      gridCtx?: CanvasRenderingContext2D

      allVisible = true
      minimap?: HTMLCanvasElement
      minimapCtx?: CanvasRenderingContext2D
      frame?: DOMRect
      screen?: DOMRect
      isOverMinimap = false
      isMinimapPanning = 0

      getItemCenterMatrix?: (item: Element) => DOMMatrix
      getScreenCenterMatrix?: () => DOMMatrix
      getCenterMatrix?: (rect: DOMRect) => DOMMatrix

      onResize?: () => void
    }
  ),
  state<SurfaceElement>(({ $, effect, mutate, reduce }) => {
    $.grid = reduce(({ root }) => root.querySelector<HTMLCanvasElement>('[part=grid]')!)
    $.inner = reduce(({ root }) => root.querySelector<HTMLDivElement>('[part=inner]')!)
    $.minimap = reduce(({ root }) => root.querySelector<HTMLCanvasElement>('[part=minimap]')!)

    $.onResize = reduce(({ host }) => (() => {
      $.rect = host.getBoundingClientRect()
    }))

    effect(({ inner, matrix, zoom: _, offset: __ }) => {
      $.zoom = matrix.a
      $.offset = { x: matrix.e, y: matrix.f }
      inner.style.transform = matrix.toString()
    })

    effect(({ host }) => on(host).movestart(() => host.classList.add('moving')))
    effect(({ host }) => on(host).moveend(() => host.classList.remove('moving')))
    effect(({ host }) => on(host).resizestart(() => host.classList.add('resizing')))
    effect(({ host }) => on(host).resizeend(() => host.classList.remove('resizing')))

    effect(({ host }) =>
      on(window).keydown(e => {
        if (e.altKey)
          host.classList.add('inner-through')
      })
    )

    effect(({ host }) =>
      on(window).keyup(e => {
        if (!e.altKey)
          host.classList.remove('inner-through')
      })
    )

    effect(({ host, getItemCenterMatrix }) =>
      on(host).center(({ detail: target }) => {
        $.target = getItemCenterMatrix(target)
      })
    )

    effect(({ host, onResize }) => {
      onResize()

      const observer = new ResizeObserver(onResize)
      observer.observe(host)

      const offMove = on(host).move(onResize)

      return () => offMove().then(() => observer.disconnect())
    })

    $.getScreenCenterMatrix = reduce(({ slotted, inner, getCenterMatrix }) => (() => {
      inner.style.transform = ''

      const items = slotted.map(el => el.getBoundingClientRect())

      const screen = {
        left: Math.min(...items.map(b => b.left)),
        top: Math.min(...items.map(b => b.top)),
        right: Math.max(...items.map(b => b.right)),
        bottom: Math.max(...items.map(b => b.bottom)),
        width: 0,
        height: 0,
      } as DOMRect

      screen.width = screen.right - screen.left
      screen.height = screen.bottom - screen.top

      return getCenterMatrix(screen)
    }))

    $.getItemCenterMatrix = reduce(({ inner, getCenterMatrix }) =>
      item => {
        inner.style.transform = ''
        return getCenterMatrix(item.getBoundingClientRect())
      }
    )

    $.getCenterMatrix = reduce(({ host, inner }) => ((rect: DOMRect) => {
      const offset = getElementOffset(host)
      const paddingPct = 0.03

      const padding = Math.max(rect.width * paddingPct, rect.height * paddingPct)

      rect.width += padding
      rect.height += padding

      const center = {
        x: rect.left + rect.width * 0.5,
        y: rect.top + rect.height * 0.5,
      }

      const scale = Math.min(
        inner.offsetWidth / rect.width,
        inner.offsetHeight / rect.height
      )

      const target = new DOMMatrix()

      target.a = scale
      target.b = 0
      target.c = 0
      target.d = scale
      target.e = (-center.x + offset.x + padding * 0.5) * scale + inner.offsetWidth * 0.5
      target.f = (-center.y + offset.y + padding * 0.5) * scale + inner.offsetHeight * 0.5

      return target
    }))

    effect(({ host, getScreenCenterMatrix }) =>
      ondblclick(host, () => {
        $.target = getScreenCenterMatrix()
      })
    )

    const draw = queue.raf(() =>
      mutate(({ target, matrix }) => {
        if (!target || !matrix) return

        let t, v, d
        let settled = 0

        for (const e of 'abcdef' as unknown as (keyof DOMMatrix)[]) {
          t = target[e] as number
          v = matrix[e] as number
          d = t - v

          // @ts-ignore
          matrix[e] = v + d * 0.342

          if (Math.abs(d) < 3) settled++
        }

        if (settled < 6) draw() // requestAnimationFrame(draw)
        else {
          for (const e of 'abcdef' as unknown as (keyof DOMMatrix)[]) {
            // @ts-ignore
            matrix[e] = target[e]
          }
        }

        $.zoom = matrix.a
        $.offset = { x: matrix.e, y: matrix.f }
      })
    )

    effect(({ target }) => {
      if (target) draw()
    })

    effect(({ minimap }) => {
      const offEnter = on(minimap).pointermove(() => {
        $.isOverMinimap = true
      })
      const offLeave = on(minimap).pointerleave(() => {
        $.isOverMinimap = false
      })
      return () => {
        offEnter()
        offLeave()
      }
    })

    effect(({ rect: { width, height }, grid, minimap, minimapScale, minimapRatio, pixelRatio }) => {
      const w = width * pixelRatio
      const h = height * pixelRatio

      if (w !== grid.width || h !== grid.height) {
        grid.width = w
        grid.height = h

        const g = Math.max(850, Math.min(1150 + (w * 0.1), w * 0.15 + h * 0.85))
        const G = g / pixelRatio
        minimap.width = g * minimapScale * minimapRatio
        minimap.height = g * minimapScale
        minimap.style.width = G * minimapScale * minimapRatio + 'px'
        minimap.style.height = G * minimapScale + 'px'
      }

      setTimeout(() => {
        mutate(() => {
          $.gridCtx ??= grid.getContext('2d', { alpha: false, desynchronized: false })!
          $.minimapCtx ??= minimap.getContext('2d', { alpha: false, desynchronized: false })!
        })
      })
    })

    effect(({ gridCtx: ctx, rect: _, grid, zoom, offset, gridSize, xPattern, yPattern, pixelRatio }) => {
      const { width: w, height: h } = grid
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = Math.min(1, .02 + zoom ** 1.25 * 0.28)

      gridSize *= pixelRatio
      const z = zoom * gridSize
      const o = {
        x: offset.x * pixelRatio,
        y: offset.y * pixelRatio,
      }

      ctx.beginPath()

      let i = 0
      let sx = o.x
      while (sx > 0) sx -= z, i--
      while (sx < -z) sx += z, i++
      for (let x = sx; x < w; x += z) {
        if (!+xPattern[modwrap(i++, xPattern.length)]) continue
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }

      i = 0
      let sy = o.y
      while (sy > 0) sy -= z, i--
      while (sy < -z) sy += z, i++
      for (let y = sy; y < h; y += z) {
        if (!+yPattern[modwrap(i++, yPattern.length)]) continue
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }

      ctx.stroke()
    })

    effect(({ slotted, onResize }) => {
      const observer = new ResizeObserver(onResize)

      for (const el of slotted) {
        if (el.dataset.left == null)
          throw new Error('Slotted Surface child does not contain any dataset coords')
        Object.assign(el.style, {
          position: 'absolute',
          left: el.dataset.left + 'px',
          top: el.dataset.top + 'px',
          width: el.dataset.width + 'px',
          height: el.dataset.height + 'px',
        })

        observer.observe(el)
      }

      return () => observer.disconnect()
    })

    effect(({ host, minimapCtx: ctx, minimap, isOverMinimap, slotted, rect, zoom: _, offset: __ }) => {
      const { width: w, height: h } = minimap
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#282828'
      ctx.fillRect(0, 0, w, h)

      const offset = getElementOffset(host)
      const frame = new DOMRect(offset.x, offset.y, rect.width, rect.height)
      const items = slotted.map(el => el.getBoundingClientRect())
      const all = [frame, ...items]

      const screen = {
        left: Math.min(...all.map(b => b.left)),
        top: Math.min(...all.map(b => b.top)),
        right: Math.max(...all.map(b => b.right)),
        bottom: Math.max(...all.map(b => b.bottom)),
        width: 0,
        height: 0,
      } as DOMRect

      screen.width = screen.right - screen.left
      screen.height = screen.bottom - screen.top

      // normalize
      all.forEach(b => {
        b.x -= screen.left
        b.y -= screen.top
        b.x /= screen.width
        b.y /= screen.height
        b.width /= screen.width
        b.height /= screen.height
      })

      // scale
      all.forEach(b => {
        b.x *= w
        b.y *= h
        b.width *= w
        b.height *= h
      })

      if (!isOverMinimap) {
        $.allVisible = items.every(b =>
          b.x >= frame.x
          && b.right <= frame.right
          && b.y >= frame.y
          && b.bottom <= frame.bottom
        )
      }

      const lw = ctx.lineWidth
      const lw2 = lw * 2

      // draw frame
      ctx.fillStyle = 'rgba(255,255,255,.045)'
      ctx.strokeStyle = 'rgba(255,255,255,.5)'
      ctx.beginPath()
      // @ts-ignore
      ctx.roundRect(frame.x + lw, frame.y + lw, frame.width - lw2, frame.height - lw2, [3])
      ctx.fill()
      ctx.stroke()

      // draw items
      ctx.fillStyle = 'rgba(255,255,255,.16)'
      ctx.strokeStyle = '#aaa'
      for (const item of items) {
        const { x, y, width, height } = item
        ctx.beginPath()
        // @ts-ignore
        ctx.roundRect(x + lw, y + lw, width - lw2, height - lw2, [0.75])
        ctx.fill()
        ctx.stroke()
      }

      $.frame = frame
      $.screen = screen
    })

    effect(({ root }) =>
      onSlotChange(root, ({ elements }) => {
        $.slotted = elements as HTMLElement[]
      })
    )

    effect(({ allVisible, minimap }) => {
      if (allVisible && !minimap.classList.contains('hide')) minimap.classList.add('hide')
      if (!allVisible && minimap.classList.contains('hide')) minimap.classList.remove('hide')
    })

    effect(({ host, inner, pointers, scalePoint, normalizePoint, matrix, minimap, pixelRatio, frame, screen }) =>
      on(window).pointermove(e => {
        mutate(({ isMinimapPanning, pointerCount, pinchStartDistance, pinchStartMatrix }) => {
          const p = getRelativeMouseFromEvent(host, e)
          if (isMinimapPanning) {
            if (isMinimapPanning !== e.pointerId) return

            e.preventDefault()
            e.stopPropagation()

            const mfw = minimap.width / frame.width
            const sfw = screen.width / frame.width

            const mfh = minimap.height / frame.height
            const sfh = screen.height / frame.height

            const scale = {
              x: Math.max(
                0.01,
                sfw / mfw * pixelRatio
              ),
              y: Math.max(
                0.01,
                sfh / mfh * pixelRatio
              ),
            }

            const o = pointers.get(e.pointerId)!

            const diff = scalePoint({
              x: (o.x - p.x) * scale.x,
              y: (o.y - p.y) * scale.y,
            })

            matrix.translateSelf(diff.x, diff.y)
            $.offset = { x: matrix.e, y: matrix.f }

            pointers.set(e.pointerId, p)
          } else if (pointerCount && pointers.has(e.pointerId)) {
            const o = pointers.get(e.pointerId)!

            const diff = scalePoint({
              x: (p.x - o.x),
              y: (p.y - o.y),
            })

            matrix.translateSelf(diff.x, diff.y)
            $.offset = { x: matrix.e, y: matrix.f }

            pointers.set(e.pointerId, p)

            if (pointerCount > 1) {
              const [a, b] = [...pointers.values()]
              const d = distance(a, b)
              if (!pinchStartMatrix) {
                $.pinchStartDistance = d
                $.pinchStartMatrix = matrix.scale(1)
              } else {
                const scaleDiff = d / pinchStartDistance
                const newScale = pinchStartMatrix.a * scaleDiff

                const c = normalizePoint({
                  x: inner.offsetWidth * 0.5,
                  y: inner.offsetHeight * 0.5,
                })

                matrix.translateSelf(c.x, c.y)
                matrix.a = matrix.d = newScale
                matrix.translateSelf(-c.x, -c.y)
                $.zoom = matrix.a
                $.offset = { x: matrix.e, y: matrix.f }
              }
            }
          }
        })
      })
    )

    effect(({ minimap }) =>
      on(minimap).pointerdown(e => {
        if (!$.pointerCount) $.isMinimapPanning = e.pointerId
      })
    )

    effect(({ host, pointerCount }) => {
      if (pointerCount) {
        if (!host.classList.contains('moving'))
          host.classList.add('moving')
      } else {
        if (host.classList.contains('moving'))
          host.classList.remove('moving')
      }
    })

    effect(({ host, pointers }) =>
      on(host).pointerdown(e => {
        const p = getRelativeMouseFromEvent(host, e)
        pointers.set(e.pointerId, p)
        $.pointerCount++
      })
    )

    effect(({ pointers }) =>
      on(window).pointerup(e => {
        if (pointers.has(e.pointerId)) {
          pointers.delete(e.pointerId)
          $.pointerCount--
          $.pinchStartMatrix = null
        }
        if ($.isMinimapPanning === e.pointerId) $.isMinimapPanning = 0
      })
    )

    effect(({ host, inner, normalizePoint, minZoom, maxZoom, matrix }) =>
      on(host).wheel.stop.prevent(e => {
        const mul = e.deltaMode === 1 ? 15 : 1.12
        const sign = Math.sign(e.deltaY)
        const abs = Math.abs(e.deltaY) * mul

        const p = normalizePoint(
          $.isOverMinimap
            ? {
              x: inner.offsetWidth * 0.5,
              y: inner.offsetHeight * 0.5,
            }
            : getRelativeMouseFromEvent(host, e)
        )
        let z = (1 - abs * sign * 0.0005 * matrix.a ** 0.001) ** 2.28

        const { a } = matrix

        if ((a > minZoom || z > 1) && (a < maxZoom || z < 1)) {
          if (a * z < minZoom) z = minZoom / a
          if (a * z > maxZoom) z = maxZoom / a

          matrix
            .translateSelf(p.x, p.y)
            .scaleSelf(z)
            .translateSelf(-p.x, -p.y)
        }

        mutate(() => {
          $.target = null
          $.zoom = matrix.a
          $.offset = { x: matrix.e, y: matrix.f }
        })
      })
    )

    effect(({ getScreenCenterMatrix }) => {
      if (!$.matrix) {
        queueMicrotask(() => {
          if (!$.matrix)
            $.matrix = getScreenCenterMatrix()
        })
      }
    })

    $.normalizePoint = reduce(({ scalePoint, matrix }) =>
      ({ x, y }) =>
        scalePoint({
          x: (x - matrix.e),
          y: (y - matrix.f),
        })
    )

    $.scalePoint = reduce(({ matrix }) =>
      ({ x, y }) => ({
        x: x / matrix.a,
        y: y / matrix.d,
      })
    )
  })
) {}

export type SurfaceMoveEvents = {
  center: CustomEvent<Element>
  move: CustomEvent<DOMPoint>
  movestart: CustomEvent
  moveend: CustomEvent<DOMPoint>
}

export class SurfaceMoveElement extends mixter(
  HTMLElement,
  shadow(/*html*/ `<slot></slot>`),
  events<SurfaceMoveElement, SurfaceMoveEvents>(),
  attrs(
    class {
      selector = 'div'
    }
  ),
  props(
    class {
      parent?: SurfaceElement
      target?: HTMLElement | null
      pointerId?: number
      grabPos?: { x: number; y: number } | null
    }
  ),
  state<SurfaceMoveElement>(({ $, effect, mutate, reduce }) => {
    $.target = reduce(({ host, selector }) => host.closest<HTMLElement>(selector))

    $.parent = reduce(({ target }) => {
      let el = target
      while ((el = el.parentElement as HTMLElement))
        if (el instanceof SurfaceElement) break
      if (!el) {
        console.warn('No parent found for move handle', target)
        return
      }
      return el
    })

    effect(({ host, target }) =>
      ondblclick(host, () => {
        dispatch.bubbles(host, 'center', target)
      })
    )

    effect(({ host, parent, target }) =>
      on(host).pointerdown.prevent.stop(e => {
        const pos = parent.normalizePoint!(getRelativeMouseFromEvent(parent, e))
        const { x, y } = {
          x: pos.x - target.offsetLeft,
          y: pos.y - target.offsetTop,
        }
        mutate(() => {
          $.pointerId = e.pointerId
          $.grabPos = { x, y }
        })
        target.style.zIndex = '' + (++globalZIndex)
        dispatch.bubbles(host, 'movestart')
      })
    )

    effect(({ host, parent, target, grabPos, pointerId }) => {
      const t = new DOMPoint(target.offsetLeft, target.offsetTop)

      const snapPoint = (a: Point, snapThreshold = parent.snapThreshold) => {
        const snap = 1 / parent.gridSize
        // const rect = target.getBoundingClientRect()

        const w = target.offsetWidth // rect.width / zoom
        const h = target.offsetHeight // rect.height / zoom

        const b = {
          x: a.x + w,
          y: a.y + h,
        }

        const sa = round(a, snap)
        const sb = round(b, snap)

        const { xPattern, yPattern } = parent
        const iax = +xPattern[modwrap(sa.x / parent.gridSize, xPattern.length)]
        const iay = +yPattern[modwrap(sa.y / parent.gridSize, yPattern.length)]
        const ibx = +xPattern[modwrap(sb.x / parent.gridSize, xPattern.length)]
        const iby = +yPattern[modwrap(sb.y / parent.gridSize, yPattern.length)]

        const snapSize = parent.gridSize * snapThreshold

        // t = {
        t.x = iax && Math.abs(sa.x - a.x) < snapSize
          ? sa.x
          : ibx && Math.abs(sb.x - b.x) < snapSize
          ? sb.x - w
          : a.x

        t.y = iay && Math.abs(sa.y - a.y) < snapSize
          ? sa.y
          : iby && Math.abs(sb.y - b.y) < snapSize
          ? sb.y - h
          : a.y
        // }

        Object.assign(target.style, {
          left: t.x + 'px',
          top: t.y + 'px',
        })

        return t
      }

      const offMove = on(window).pointermove(e => {
        if (e.pointerId !== pointerId) return

        // const zoom = parent.zoom
        const pos = parent.normalizePoint!(getRelativeMouseFromEvent(parent, e))

        const p = {
          x: pos.x - grabPos.x,
          y: pos.y - grabPos.y,
        }

        snapPoint(p)

        dispatch.bubbles(host, 'move', t)
      })

      const offUp = on(window).pointerup.once(() => {
        snapPoint(t, 1)

        Object.assign(target.dataset, {
          left: '' + t.x,
          top: '' + t.y,
        })

        dispatch.bubbles(host, 'moveend', t)

        offMove()
      })

      return () => offMove().then(offUp)
    })
  })
) {}

export type SurfaceResizeEvents = {
  resizes: CustomEvent<DOMRect>
  resizestart: CustomEvent
  resizeend: CustomEvent<DOMRect>
}

export class SurfaceResizeElement extends mixter(
  HTMLElement,
  shadow(/*html*/ `<slot></slot>`),
  events<SurfaceResizeElement, SurfaceResizeEvents>(),
  attrs(
    class {
      selector = 'div'
    }
  ),
  props(
    class {
      parent?: SurfaceElement
      target?: HTMLElement | null
      pointerId?: number
      grabPos?: { x: number; y: number } | null
      origSize?: { width: number; height: number } | null
    }
  ),
  state<SurfaceResizeElement>(({ $, effect, mutate, reduce }) => {
    $.target = reduce(({ host, selector }) => host.closest<HTMLElement>(selector))

    $.parent = reduce(({ target }) => {
      let el = target
      while ((el = (el.parentElement || el.offsetParent) as HTMLElement))
        if (el instanceof SurfaceElement) break
      if (!el) {
        console.warn('No parent found for resize handle', target)
        return
      }
      return el
    })

    effect(({ target }) => on(target).pointerdown.stop())

    effect(({ host, parent, target }) =>
      on(host).pointerdown.stop.prevent(e => {
        const pos = parent.normalizePoint!(getRelativeMouseFromEvent(parent, e))
        mutate(() => {
          $.pointerId = e.pointerId
          $.grabPos = pos
          $.origSize = { width: target.offsetWidth, height: target.offsetHeight }
        })
        target.style.zIndex = '' + (++globalZIndex)
        dispatch.bubbles(host, 'resizestart')
      })
    )

    effect(({ host, parent, target, grabPos, pointerId, origSize }) => {
      const rect = new DOMRect(0, 0, target.offsetWidth, target.offsetHeight)
      const t = new DOMPoint(rect.width, rect.height)

      const snapPoint = (p: Point, snapThreshold = parent.snapThreshold) => {
        const snap = 1 / parent.gridSize

        const sp = round(p, snap)

        const snapSize = parent.gridSize * snapThreshold

        const { xPattern, yPattern } = parent
        const ipx = +xPattern[modwrap(sp.x / parent.gridSize, xPattern.length)]
        const ipy = +yPattern[modwrap(sp.y / parent.gridSize, yPattern.length)]

        t.x = ipx && Math.abs(sp.x - p.x) < snapSize
          ? sp.x
          : p.x

        t.y = ipy && Math.abs(sp.y - p.y) < snapSize
          ? sp.y
          : p.y

        rect.width = Math.max(10, t.x - target.offsetLeft)
        rect.height = Math.max(10, t.y - target.offsetTop)

        Object.assign(target.style, {
          width: rect.width + 'px',
          height: rect.height + 'px',
        })
      }

      const offMove = on(window).pointermove(e => {
        if (e.pointerId !== pointerId) return

        const pos = parent.normalizePoint!(getRelativeMouseFromEvent(parent, e))

        const p = {
          x: pos.x - grabPos.x + origSize.width + target.offsetLeft,
          y: pos.y - grabPos.y + origSize.height + target.offsetTop,
        }

        snapPoint(p)

        dispatch.bubbles(host, 'resizes', rect)
      })

      const offUp = on(window).pointerup.once(() => {
        snapPoint(t, 1)

        Object.assign(target.dataset, {
          width: '' + rect.width,
          height: '' + rect.height,
        })

        dispatch.bubbles(host, 'resizeend', rect)

        offMove()
      })

      return () => offMove().then(offUp)
    })
  })
) {}
