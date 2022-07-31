/** @jsxImportSource sigl */
import $ from 'sigl'

import { AnimSettings, Easing } from 'animatrix'
import { ValuesOf } from 'everyday-types'
import { filterMap } from 'everyday-utils'
import { Point, Rect } from 'sigl'

import { SurfaceGridElement } from './surface-grid'
import { SurfaceItemElement } from './surface-item'
import { SurfaceMinimapElement } from './surface-minimap'
import { SurfaceMoveEvents } from './surface-move'
import { SurfaceResizeEvents } from './surface-resize'

import { modwrap } from './util'

export type SurfaceEvents =
  & {
    statechange: CustomEvent
    connectstart: CustomEvent
    connectend: CustomEvent
    surfaceselecting: CustomEvent<
      { event: PointerEvent; items: $.ChildOf<SurfaceItemElement>[]; rect: $.Rect }
    >
  }
  & SurfaceMoveEvents
  & SurfaceResizeEvents

export const SurfaceState = {
  Idle: 'surfaceidle',

  Overlay: 'surfaceoverlay',

  CenteringItem: 'surfacecenteringitem',
  CenteringView: 'surfacecenteringview',
  Connecting: 'surfaceconnecting',
  FullSize: 'surfacefullsize',
  MinimapPanning: 'surfaceminimappanning',
  Panning: 'surfacepanning',
  Pinching: 'surfacepinching',
  Selecting: 'surfaceselecting',
  Wheeling: 'surfacewheeling',
} as const

export const SurfaceCursorState = {
  Idle: 'default',

  Copy: 'copy',
  Grabbing: 'grabbing',

  EWResize: 'ew-resize',
  NSResize: 'ns-resize',
  NWSEResize: 'nwse-resize',
} as const

const Idle = ($.isMobile
  ? {
    duration: 0,
    easing: Easing.Flat,
  }
  : {
    duration: 0,
    easing: Easing.Flat,
  }) as AnimSettings

const Panning = ($.isMobile
  ? {
    duration: 120,
    easing: [0, 0, 1, 1],
  }
  : {
    duration: 150,
    easing: [0, 0, 1, 1],
  }) as AnimSettings

export const SurfaceAnimSettings = {
  [SurfaceState.Idle]: Idle,

  [SurfaceState.Overlay]: Panning,

  [SurfaceState.Selecting]: Idle,
  [SurfaceState.FullSize]: Idle,

  [SurfaceState.Panning]: Panning,
  [SurfaceState.MinimapPanning]: Panning,

  [SurfaceState.Pinching]: ($.isMobile
    ? {
      duration: 200,
      easing: [0, 0.15, 0.45, 1],
    }
    : {
      duration: 200,
      easing: [0, 0.55, 0.25, 1],
    }) as AnimSettings,

  [SurfaceState.Wheeling]: ($.isMobile
    ? {
      duration: 500,
      easing: [0, 0.55, 0.25, 1],
    }
    : {
      duration: 185,
      easing: [0.1, 0.15, 0.75, 1],
    }) as AnimSettings,
  // : {
  //   duration: 100,
  //   easing: [0, 0.25, 0.75, 1],
  // }) as AnimSettings,

  // [SurfaceState.ItemMove]: ($.isMobile
  //   ? {
  //     duration: 200,
  //     easing: [0, 0.15, 0.45, 1],
  //   }
  //   : {
  //     duration: 150,
  //     easing: [0, 0, 0.2, 1],
  //   }) as AnimSettings,

  //////

  [SurfaceState.CenteringItem]: ($.isMobile
    ? {
      duration: 600,
      easing: [0, 0.67, 0.045, 1], // [0, 0.55, 0.25, 1],
      // duration: 500,
      // easing: [0, 0.9, 0.05, 1], // [0, 0.55, 0.25, 1],
    }
    : {
      duration: 415, // 280
      easing: [0, 0.12, 0.29, 1], // [0, 0.55, 0.25, 1],
    }) as AnimSettings,
  // : {
  //   duration: 280, // 280
  //   easing: [0, 0.55, 0.25, 1], // [0, 0.55, 0.25, 1],
  // }) as AnimSettings,

  [SurfaceState.CenteringView]: ($.isMobile
    ? {
      duration: 400,
      easing: [0, 0.2, 0.001, 1], // [0, 0.55, 0.25, 1],
      // duration: 500,
      // easing: [0, 0.9, 0.05, 1], // [0, 0.55, 0.25, 1],
    }
    : {
      duration: 415, // 280
      easing: [0, 0.1, 0.05, 1], // [0, 0.55, 0.25, 1],
    }) as AnimSettings,
  // : {
  //   duration: 280, // 280
  //   easing: [0, 0.55, 0.25, 1], // [0, 0.55, 0.25, 1],
  // }) as AnimSettings,
} as const

const style = /*css*/ `

:host {
  contain: size layout style paint;
  position: relative;
  user-select: none;
  touch-action: none;
  display: flex;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

[part=overlay] {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  z-index: -1;
}

${
  [
    SurfaceState.FullSize,
    SurfaceState.Connecting,
    SurfaceState.MinimapPanning,
    SurfaceState.Overlay,
    SurfaceState.Panning,
    SurfaceState.Pinching,
    SurfaceState.Selecting,
  ].map(x => /*css*/ `:host([state=${x}]) [part=overlay]`)
} {
  z-index: 100000;
}

${
  Object.entries(SurfaceAnimSettings).map(([name, { duration, easing }]) => /*css*/ `
    :host([transition=${name}]) [part=view] {
      transition: transform ${duration}ms cubic-bezier(${easing});
    }
  `).join('')
}

slot {
  contain: size layout style paint;
}

::slotted(*) {
  contain: size layout style;
  position: absolute;
}

[part=frame] {
  contain: size layout style paint;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}
[part=view] {
  contain: size layout style;
  transform-origin: 0 0 0;
  position: absolute;
  display: inline;
  z-index: 1;
}
[part=minimap] {
  display: none;
  contain: size style;
  z-index: 100001;
}

[part=full-size] {
  position: absolute;
  display: none;
  z-index: 100001; /* 1 over overlay */
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: #000;
  > * {
    position: absolute;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    resize: none !important;
  }
}
:host([state=${SurfaceState.FullSize}]) [part=full-size] {
  display: block;
}

[part=selection] {
  position: absolute;
  background: #44b5;
  border: 1.5px solid #77a;
  pointer-events: none;
  box-sizing: border-box;
  border-radius: 1.3px;
  z-index: 1000;
  opacity: 0;
}
:host([state=${SurfaceState.Selecting}]) [part=selection] {
  opacity: 1;
  transition: ${['left', 'top', 'width', 'height'].map(x => `${x} 9ms cubic-bezier(0.5,0,0.95,1)`)};
}
`

export interface SurfaceElement extends $.Element<SurfaceElement, SurfaceEvents> {}

@$.element()
export class SurfaceElement extends $.mix(HTMLElement, $.mixins.observed()) {
  static zIndex = 0

  // dependencies
  Minimap = $.element(SurfaceMinimapElement)
  Grid = $.element(SurfaceGridElement)

  // root
  root = $(this).shadow()

  // attributes
  @$.attr() state = $(this).state(SurfaceState)
  @$.attr() cursorState = $(this).state(SurfaceCursorState)
  @$.attr() transition = $.transition(this.state, SurfaceAnimSettings)
  @$.attr() pixelRatio = window.devicePixelRatio
  @$.attr() gridCellSize = 80
  @$.attr() snapThreshold = 0.15
  @$.attr() minZoom = 0.05 // 112
  @$.attr() maxZoom = 1.25

  // sent to minimap
  @$.attr() minimapScale = 0.2
  @$.attr() minimapRatio = 4 / 3

  // sent to grid
  @$.attr() xPattern = '1' // 01010'
  @$.attr() yPattern = '1' // 01010'

  // minimap
  minimap?: SurfaceMinimapElement

  // view
  view?: HTMLSlotElement
  viewFrame?: HTMLDivElement
  viewFrameRect?: Rect
  viewFrameNormalRect?: Rect
  viewRect?: Rect
  viewMatrix = new DOMMatrix().scale(0.001)
  viewMatrixString?: string

  /** Holds the last centered item. */
  centeredItem?: HTMLElement
  /** Centers a specific rectangle in view. */
  centerRect?: (rect: $.Rect) => void
  /** Centers a single item in view. */
  centerItem?: (item: $.ChildOf<SurfaceItemElement>) => void
  /** Centers item n+-diff sorted horizontally. */
  centerOtherItem?: (diff: number) => void
  /** Centers all items in view. */
  centerView?: (state?: ValuesOf<typeof SurfaceState>, paddingPct?: number) => void
  /** Get the center matrix for any given rectangle. */
  getCenterMatrix?: (rect: Rect, paddingPct?: number) => DOMMatrix
  /** Remember what we centered last, so Escape does the opposite */
  didCenterLast?: 'view' | 'item' = 'view'

  // items
  items = $(this).slotted.deep(
    el => (el.surface = this, el)
  ) as $.ChildOf<SurfaceItemElement>[]

  // pointers
  pointer?: { id: number; pos: Point }
  pointers = new Map<number, Point>()
  pinchStartMatrix?: DOMMatrix | null
  pinchStartDistance = 1
  getPointerPos?: (event: PointerEvent | WheelEvent) => Point

  // selecting
  selection?: HTMLDivElement
  selectingRect?: Rect | null
  selectingStartPos?: Point | null

  // full-size
  fullSize?: HTMLElement
  exitFullSize?: (() => void) | null
  makeFullSize = $(this).reduce(({ $, fullSize }) =>
    (item: $.ChildOf<SurfaceItemElement> & { fullSize: boolean }) => {
      const prevParent = item.parentElement!
      const prevNext = item.nextSibling

      item.fullSize = true
      fullSize.appendChild(item)
      $.transition.to.immediate.locked(SurfaceState.FullSize)
      item.blur()
      requestAnimationFrame(() => {
        item.focus()
      })

      $.exitFullSize = () => {
        offKeyDownFull()
        prevParent.insertBefore(item, prevNext)
        item.fullSize = false
        $.transition.unlock()
        item.blur()
        requestAnimationFrame(() => {
          item.focus()
        })
        $.exitFullSize = null
      }

      const offKeyDownFull = $.on(window).keydown.capture(e => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopImmediatePropagation()
          $.exitFullSize!()
        }
      })
    }
  )

  setViewStyleTransform?: (matrixString: string) => void

  get matrix() {
    return this.viewMatrix
  }

  mounted($: SurfaceElement['$']) {
    //!time 'state'
    //!time 'animating'

    $.effect(({ state: _ }) => {
      // console.log(_.current)
      //!timeLog 'state'
      //!? 'state', _.current
      return
    })

    //
    // host
    //

    // $.effect(({ state }) => {
    //   document.querySelector('#debug')!.textContent = state
    // })

    $.effect(({ state }) => {
      if ($.cursorState.isIdle) {
        if (state.is(SurfaceState.Panning)) {
          $.cursorState.push(SurfaceCursorState.Grabbing)
        }
      } else if (state.is(SurfaceState.Idle)) {
        $.cursorState.pop($.cursorState.current)
      }
    })

    $.effect(({ host, cursorState }) => {
      host.style.cursor = cursorState.current
    })

    $.effect.raf(({ host, viewMatrix: _ }) => {
      $.dispatch(host, 'scroll')
    })

    $.effect.raf(({ host, rect: _ }) => {
      $.dispatch(host, 'resize')
    })

    $.effect(() =>
      $.chain(
        $.on(window).keydown(e => {
          if (e.altKey && $.state.isIdle) {
            $.state.push(SurfaceState.Overlay)
          }
        }),
        $.on(window).keyup(e => {
          if (!e.altKey && $.state.is(SurfaceState.Overlay)) {
            $.state.pop(SurfaceState.Overlay)
          }
        })
      )
    )
    // const refreshItems = $.queue.debounce(1000)(() => {
    //   $.items = [...$.items]
    // })

    // $.effect(({ host }) =>
    //   $.on(host).change(e => {
    //     const [origin] = e.composedPath()
    //     if (origin instanceof SurfaceMoveElement || origin instanceof SurfaceResizeElement) {
    //       refreshItems()
    //     }
    //   })
    // )

    //
    // view
    //

    $.viewRect = $.fulfill(({ items }) =>
      fulfill => {
        const refresh = $.queue.debounce(50)(() => {
          fulfill(Rect.combine(items.map(x => x.rect)))
        })

        return $.chain(items.map(item =>
          $.chain(
            (item as SurfaceItemElement).$.effect(({ rect: _ }) => {
              refresh()
            }),
            $.on(item).focus($.atomic(() => {
              // $.didCenterLast = 'view'
              $.centeredItem = item
            }))
          )
        ))
      }
    )

    $.viewFrameRect = $.reduce(({ rect: _, viewFrame }) => Rect.fromElement(viewFrame))
    $.viewFrameNormalRect = $.reduce(({ viewFrameRect, viewMatrix }) => viewFrameRect.normalize(viewMatrix))

    // centering view and items

    $.getCenterMatrix = $.reduce(({ viewFrameRect }) =>
      (targetRect: Rect, paddingPct = 0) => {
        const padding = Math.max(...targetRect.size.scale(paddingPct))
        const scaled = targetRect.scaleLinear(padding)
        const scale = Math.min(...viewFrameRect.size.normalize(scaled.size), 1)

        const target = new DOMMatrix()
          .translateSelf(
            ...scaled
              .center
              .negateSelf()
              .translateSelf(padding * 0.5) //, padding * (paddingPct < 0.2 ? 0.7 : 0.6)) // breathe more at top because of the labels
              .scaleSelf(scale)
              .translateSelf(viewFrameRect.size.scaleSelf(0.5))
              .pos
          )
          .scaleSelf(scale)

        return target
      }
    )

    $.centerRect = $.reduce(({ getCenterMatrix }) =>
      $.atomic(rect => {
        $.didCenterLast = 'view'

        $.transition.to.pop.expire(SurfaceState.CenteringView, () => {
          $.viewMatrix = getCenterMatrix(rect, 0.12)
        })
      })
    )

    $.centerItem = $.reduce(({ getCenterMatrix }) =>
      $.atomic(item => {
        $.centeredItem = item
        $.didCenterLast = 'item'

        if (!$.isMobile) {
          item.blur()
          item.focus({ preventScroll: true })
        }

        $.transition.to.pop.expire(SurfaceState.CenteringItem, () => {
          $.viewMatrix = getCenterMatrix(item.rect, 0.075)
        })
      })
    )

    $.centerOtherItem = $.reduce(({ getCenterMatrix, items }) =>
      $.callback(({ centeredItem }) =>
        (diff: number) => {
          // dprint-ignore
          const sorted = filterMap(items, el => !el.points && [el, el.rect] as const).sort((
            [, a],
            [, b],
          ) =>
            a.x === b.x
              ? a.y < b.y ? -1 : 1
              : a.x < b.x ? -1 : 1
          )

          let index = sorted.findIndex(([el]) => centeredItem === el)
          if (!~index && diff < 0) index = 0
          const [item, itemRect] = sorted[
            modwrap(
              index + diff,
              sorted.length
            )
          ]

          $.centeredItem = item
          $.didCenterLast = 'item'

          if (!$.isMobile) {
            item.blur()
            item.focus({ preventScroll: true })
          }

          $.transition.to.pop.expire(SurfaceState.CenteringItem, () => {
            $.viewMatrix = getCenterMatrix(itemRect, 0.35)
          })
        }
      )
    )

    // $.effect.raf(({ centeredItem }) => centeredItem.focus({ preventScroll: true }))

    $.centerView = $.reduce(({ getCenterMatrix }) =>
      $.atomic((mode = SurfaceState.CenteringView, paddingPct = 0.11) => {
        $.didCenterLast = 'view'
        requestAnimationFrame(() => {
          $.cursorState.returnToIdle()
        })
        $.transition.to.immediate.pop.expire.drop(mode, () => {
          if (!$.viewRect) return
          $.viewMatrix = getCenterMatrix($.viewRect, paddingPct)
        })
      })
    )

    // center a wider view on init
    $.effect.once(({ centerView }) => {
      centerView(SurfaceState.Idle, 0.25)
    })

    $.effect(({ host, centerView }) => (
      $.ondblclick(host, centerView)
    ))

    $.effect(({ centerView, centerItem }) =>
      $.on(window).keydown($.kbd(
        [['Escape'], () => {
          if ($.centeredItem && $.didCenterLast === 'view') {
            centerItem($.centeredItem! as any)
          } else {
            centerView()
          }
        }]
      ))
    )

    $.effect(({ centerOtherItem }) =>
      $.on(window).keydown.throttle(50)($.kbd(
        [['Alt', 'Right'], () => centerOtherItem(+1)],
        [['Alt', 'Left'], () => centerOtherItem(-1)]
      ))
    )

    //
    // pointers
    //

    $.getPointerPos = $.function(({ rect }) => e => new Point(e.pageX, e.pageY).translateSelf(rect.negate()))

    $.effect(({ host, minimap, pointers, getPointerPos, selection }) => {
      const clear = $.atomic((e: PointerEvent) => {
        pointers.delete(e.pointerId)
        //!? 'pointers:', pointers.size

        if (
          $.state.is(SurfaceState.CenteringItem)
          || $.state.is(SurfaceState.CenteringView)
        )
          return

        if (pointers.size === 0) {
          requestAnimationFrame(() => {
            $.cursorState.returnToIdle()
          })
          if ($.state.is(SurfaceState.Selecting)) {
            const rect = $.selectingRect!.normalize($.viewMatrix)
            const items = $.items.filter(x => x.rect.intersectsRect(rect))
            $.state.emit(SurfaceState.Selecting, {
              event: e,
              items,
              rect: $.selectingRect,
            })
          } else {
            $.transition.to(SurfaceState.Idle)
          }
        } else if (pointers.size === 1) {
          $.transition.to(SurfaceState.Panning)
          $.pinchStartMatrix = null
        }
      })
      return $.chain(
        $.on(window).pointermove.throttle(16.66666)(e => {
          $.pointer = {
            id: e.pointerId,
            pos: getPointerPos(e),
          }
        }),
        $.on(host).pointerdown(e => {
          if (!(e.buttons & $.MouseButton.Left)) return

          const pos = getPointerPos(e)
          pointers.set(e.pointerId, pos)
          //!? 'pointers:', pointers.size

          // if (!$.isMobile && ($.mode === SurfaceMode.CenteringItem || $.mode === SurfaceMode.CenteringView)) return

          if (pointers.size === 1) {
            if (e.ctrlKey) {
              $.selectingStartPos = pos.clone()
              Object.assign(
                selection.style,
                new Rect(...$.selectingStartPos, 1, 1).toStyle()
              )
              $.transition.to(SurfaceState.Selecting)
            } else if (e.composedPath().includes(minimap)) {
              $.transition.to(SurfaceState.MinimapPanning)
            } else {
              $.transition.to(SurfaceState.Panning)
            }
          } else if (pointers.size === 2) {
            $.transition.to.expireAfter(200)(SurfaceState.Pinching)
          }
        }),
        $.on(window).pointercancel(clear),
        $.on(window).pointerup(clear)
      )
    })

    // panning

    $.effect(({ pointers }) =>
      $.on(window).pointermove($.with(({ viewMatrix, pointer }) =>
        $.when(
          $.state.is(SurfaceState.Panning),
          e => {
            const id = e.pointerId
            if (pointer?.id !== id) return

            const p = pointers.get(id)
            if (!p) return

            const n = pointer.pos
            pointers.set(id, n)

            const d = n.screen(p).normalize(viewMatrix.a)
            if (d.absoluteSum() === 0) return

            // $.transition.to(SurfaceState.Panning, () => {
            $.viewMatrix = viewMatrix.translate(d.x, d.y)
            // })
          }
        )
      ))
    )

    // minimap panning

    $.effect(({ minimap, rect, viewRect, pointers, pixelRatio }) =>
      $.on(window).pointermove(
        $.with(({ viewMatrix, pointer }) =>
          $.when(
            $.state.is(SurfaceState.MinimapPanning),
            e => {
              const id = e.pointerId
              if (pointer?.id !== id) return

              const p = pointers.get(id)
              if (!p) return

              const n = pointer.pos
              pointers.set(id, n)

              const m = Point.fromObject(minimap.canvas).normalizeSelf(rect.size)
              const s = viewRect.normalize(rect)

              const scale = new Point(
                Math.max(0.01, s.width / m.width * pixelRatio),
                Math.max(0.01, s.height / m.height * pixelRatio)
              )

              const d = n.screen(p).scale(scale.negate())
              if (d.absoluteSum() === 0) return

              // note
              // $.transition.to(SurfaceState.MinimapPanning, () => {
              $.viewMatrix = viewMatrix.translate(d.x, d.y)
              // })
            }
          )
        )
      )
    )

    // pinching

    $.effect(({ pointers, getPointerPos }) =>
      $.on(window).pointermove(
        $.callback((
          {
            viewMatrix,
            pointer,
            minZoom,
            maxZoom,
            pinchStartDistance,
            pinchStartMatrix,
          },
        ) =>
          $.when(
            $.state.is(SurfaceState.Pinching) && pointer,
            e => {
              const id = e.pointerId
              const p = pointers.get(id)!
              const n = getPointerPos(e)
              const d = n.screen(p).normalize(viewMatrix.a)

              pointers.set(id, n)

              const [a, b] = [...pointers.values()]
              if (!a || !b) return

              const dist = a.distance(b)
              if (!dist) return

              if (!pinchStartMatrix) {
                $.pinchStartDistance = dist
                $.pinchStartMatrix = viewMatrix.translate()
              } else {
                const scaleDiff = dist / pinchStartDistance
                const newScale = pinchStartMatrix.a * scaleDiff

                if (newScale < minZoom || newScale > maxZoom) return

                const c = a.translate(b).scaleSelf(0.5).normalizeSelf(viewMatrix)

                // $.transition.to.expireAfter(200)(
                //   SurfaceState.Pinching,
                //   $.atomic(() => {
                $.viewMatrix = viewMatrix.translate()
                  .translateSelf(d.x, d.y)
                  .translateSelf(c.x, c.y)

                $.viewMatrix.a = $.viewMatrix.d = newScale
                $.viewMatrix.translateSelf(-c.x, -c.y)
                //   })
                // )
              }
            }
          )
        )
      )
    )

    // wheel zoom

    $.effect(({ minimap, minZoom, maxZoom, getPointerPos, viewFrameRect }) =>
      $.chain(
        $.on(window).wheel.stop.prevent.not.passive(),
        $.on(window).wheel.passive.task(
          $.with(({ viewMatrix }) =>
            $.when(
              !$.state.is(SurfaceState.CenteringItem)
                && !$.state.is(SurfaceState.CenteringView),
              e => {
                const mul = e.deltaMode === 1 ? 15 : 1.12
                const sign = Math.sign(e.deltaY)
                const abs = Math.abs(e.deltaY) * mul

                const { a } = viewMatrix
                let z = (1 - abs * sign * 0.0005 * a ** 0.001) ** 2.08
                if ((a > minZoom || z > 1) && (a < maxZoom || z < 1)) {
                  if (a * z < minZoom) z = minZoom / a
                  if (a * z > maxZoom) z = maxZoom / a

                  if (!isFinite(z)) return

                  const pos = (e.composedPath().includes(minimap)
                    ? viewFrameRect.size.scale(0.5)
                    : getPointerPos(e)).normalize(
                      viewMatrix
                    )

                  $.transition.to(SurfaceState.Wheeling, () => {
                    $.viewMatrix = viewMatrix
                      .translate(pos.x, pos.y)
                      .scaleSelf(z)
                      .translateSelf(-pos.x, -pos.y)
                  })
                }
              }
            )
          )
        )
      )
    )

    // selecting

    $.effect(({ pointers, selection }) =>
      $.on(window).pointermove(
        $.with(({ pointer, selectingStartPos: startPos }) =>
          $.when(
            $.state.is(SurfaceState.Selecting),
            $.queue.raf(e => {
              if (!startPos) return

              const id = e.pointerId
              if (pointer?.id !== id) return

              const p = pointers.get(id)
              if (!p) return

              const n = pointer.pos
              pointers.set(id, n)

              const endPos = n
              const left = Math.min(startPos.x, endPos.x)
              const top = Math.min(startPos.y, endPos.y)

              $.selectingRect = new Rect(
                left,
                top,
                Math.abs(endPos.x - startPos.x),
                Math.abs(endPos.y - startPos.y)
              )

              Object.assign(selection.style, $.selectingRect.toStyle())
            })
          )
        )
      )
    )

    //
    // animation
    //

    // we convert to string to prevent effect triggering unnecessary new animations
    // as the dependencies below will match to the same string and ignore it
    $.viewMatrixString = $.reduce(({ viewMatrix }) => viewMatrix.toString())

    if ($.isMobile) {
      $.effect.throttle(SurfaceAnimSettings[SurfaceState.Pinching].duration * 0.5)
        .first.last.next(
          ({ setViewStyleTransform, viewMatrixString }) => {
            if (!$.state.is(SurfaceState.Pinching)) return
            setViewStyleTransform(viewMatrixString)
          }
        )

      $.effect.throttle(SurfaceAnimSettings[SurfaceState.Panning].duration).first
        .last.next(
          ({ setViewStyleTransform, viewMatrixString }) => {
            if (!$.state.is(SurfaceState.Panning)) return
            setViewStyleTransform(viewMatrixString)
          }
        )

      $.effect.raf(({ view, viewMatrixString }) => {
        if ($.state.is(SurfaceState.Pinching) || $.state.is(SurfaceState.Panning))
          return
        view.style.transform = viewMatrixString
      })
    } else {
      // panning
      $.effect.throttle(75).first.last.next(
        ({ setViewStyleTransform, viewMatrixString }) => {
          if (
            !$.state.is(SurfaceState.MinimapPanning)
            && !$.state.is(SurfaceState.Panning)
          )
            return
          setViewStyleTransform(viewMatrixString)
        }
      )

      // wheeling
      $.effect.throttle(75).last.next(
        ({ setViewStyleTransform, viewMatrixString }) => {
          if (!$.state.is(SurfaceState.Wheeling)) return
          setViewStyleTransform(viewMatrixString)
        }
      )

      // rest
      $.effect.throttle(32).first.last.next(
        ({ setViewStyleTransform, viewMatrixString }) => {
          if (
            $.state.is(SurfaceState.MinimapPanning)
            || $.state.is(SurfaceState.Panning)
            || $.state.is(SurfaceState.Wheeling)
          )
            return
          setViewStyleTransform(viewMatrixString)
        }
      )
    }

    $.setViewStyleTransform = $.reduce(({ view }) =>
      $.queue.raf(matrixString => {
        //!timeLog 'animating'
        //!? 'animating'
        view.style.transform = matrixString
      })
    )

    //
    // parts
    //

    const MinimapPart = $.part((
      {
        Minimap,
        rect,
        viewMatrix: matrix,
        items,
        pointers,
        pixelRatio,
        minimapScale,
        minimapRatio,
      },
    ) => (
      <Minimap
        ref={$.ref.minimap}
        part="minimap"
        {...{
          rect,
          matrix,
          items,
          pointers,
          pixelRatio,
          scale: minimapScale,
          ratio: minimapRatio,
        }}
      />
    ))

    // const GridPart = part((
    //   { Grid, rect, viewMatrix: matrix, animSettings, pixelRatio, gridCellSize: cellSize, xPattern, yPattern },
    // ) => <Grid {...{ rect, matrix, animSettings, pixelRatio, cellSize, xPattern, yPattern }} />)

    $.render(() => (
      <>
        <style>{style}</style>

        {/* <GridPart /> */}

        <div ref={$.ref.viewFrame} part="frame">
          <slot ref={$.ref.view} part="view"></slot>
        </div>

        <MinimapPart />

        <div ref={$.ref.selection} part="selection"></div>

        <div part="overlay"></div>

        <div part="full-size" ref={$.ref.fullSize}></div>
      </>
    ))
  }
}
