import $ from 'sigl'

import { filterMap } from 'everyday-utils'
import { Point, Rect } from 'sigl'
import { SurfaceElement } from './surface'

const style = /*css*/ `
[part=canvas] {
  contain: size layout style paint;
  position: fixed;
  opacity: 0.6;
  width: 150px;
  height: 112.5px;
  right: 30px;
  bottom: 30px;
  z-index: 2;
  border-radius: 3px;

  /* this is cool but glitches on mobile */
  /* ${$.isMobile ? '' : 'transition: opacity 0.08s ease-out;'} */
}

[part=canvas].hide {
  opacity: 0;
  pointer-events: none;
}

[part=canvas]:hover {
  opacity: 0.9;
}`

export interface SurfaceMinimapElement extends $.Element<SurfaceMinimapElement> {}

@$.element()
export class SurfaceMinimapElement extends HTMLElement {
  root = $(this).shadow(/*html*/ `<style>${style}</style><canvas part="canvas" class="hide"></canvas>`)

  @$.attr() pixelRatio = window.devicePixelRatio
  @$.attr() scale = 0.2
  @$.attr() ratio = 4 / 3

  // from surface
  matrix?: DOMMatrix
  rect?: Rect
  items?: SurfaceElement['items']

  canvas = $(this).query<HTMLCanvasElement>(/*css*/ `[part=canvas]`)
  ctx = $(this).reduce(({ canvas }) => canvas.getContext('2d', { alpha: false, desynchronized: true })!) //?: CanvasRenderingContext2D
  isOverMinimap = $(this).fulfill(({ canvas }) => (fulfill =>
    $.chain(
      $.on(canvas).pointermove(() => fulfill(true)),
      $.on(canvas).pointerleave(() => fulfill(false))
    )), false)

  allVisible = true

  mounted($: SurfaceMinimapElement['$']) {
    $.effect(({ rect, canvas, scale, ratio, pixelRatio }) => {
      const [w, h] = rect.size.scaleSelf(pixelRatio)

      const g = Math.max(850, Math.min(1150 + (w * 0.1), w * 0.15 + h * 0.85))

      const size = new Point(
        g * scale * ratio,
        g * scale
      )

      if (!size.round().equals(Point.fromObject(canvas))) {
        Object.assign(canvas, size.round().toSizeObject())
        Object.assign(canvas.style, size.normalize(pixelRatio).toStyleSize())
      }
    })

    $.effect.raf(({ ctx: ctx, canvas: { width: w, height: h }, matrix, items: surfaceItems }) =>
      $.use(({ isOverMinimap, rect }) => {
        if (!rect) return

        const frame = rect.clone()
        const items = filterMap(surfaceItems, el => !el.points && el.rect.transform(matrix).translateSelf(frame))

        const all = [frame, ...items]
        const screen = Rect.combine(all)

        all.forEach(b => b.normalizeSelf(screen).multiplySelf(w, h))

        if (!isOverMinimap) {
          $.allVisible = items.every(b => b.withinRect(frame))
          if ($.allVisible) return
        }

        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#282828'
        ctx.fillRect(0, 0, w, h)

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

        // draw points/paths
        const paths = surfaceItems
          .filter(x => x.points)
          .map(p =>
            p.points!.map(
              x =>
                x
                  .transform(matrix)
                  .normalizeSelf(screen.size)
                  .multiplySelf(w, h)
                  .translateSelf(frame)
            )
          ) as Point[][]

        ctx.strokeStyle = '#666'
        ctx.lineWidth = 1.75
        for (const points of paths) {
          ctx.beginPath()
          for (const p of points) ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }
      })
    )

    $.effect.raf(({ allVisible, canvas }) => {
      if (allVisible && !canvas.classList.contains('hide')) canvas.classList.add('hide')
      if (!allVisible && canvas.classList.contains('hide')) canvas.classList.remove('hide')
    })
  }
}
