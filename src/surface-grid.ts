import $ from 'sigl'

import { createStepAnimation, StepAnimation } from 'animatrix'
import { Point, Rect } from 'sigl'
// import { SurfaceAnimSettings } from './surface'
import { modwrap } from './util'

const style = /*css*/ `
[part=canvas] {
  contain: size layout style paint;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: inline;
  overflow: hidden;
}`

export interface SurfaceGridElement extends $.Element<SurfaceGridElement> {}

@$.element()
export class SurfaceGridElement extends HTMLElement {
  root = $.shadow(this, /*html*/ `<style>${style}</style><canvas part="canvas"></canvas>`)

  @$.attr() pixelRatio = window.devicePixelRatio
  @$.attr() cellSize = 80
  @$.attr() xPattern = '1' // 01010'
  @$.attr() yPattern = '1' // 01010'

  // from surface
  matrix?: DOMMatrix
  rect?: Rect
  pointers = new Map<number, Point>()
  slotted?: HTMLElement[]
  transition?: InstanceType<typeof $.Transition>
  // animSettings?: SurfaceAnimSettings

  canvas?: HTMLCanvasElement
  ctx?: CanvasRenderingContext2D

  anim?: StepAnimation<{ zoom: number; offset: Point }>
  animValues?: { zoom: number; offset: Point }

  zoom?: number
  offsetX?: number
  offsetY?: number

  mounted($: this['$']) {
    $.canvas = $.query<HTMLCanvasElement>('[part=canvas]')

    $.ctx = $.reduce(({ canvas: grid }) =>
      grid.getContext('2d', {
        alpha: false,
        desynchronized: true,
      })!
    )

    $.effect(({ rect, canvas, pixelRatio }) => {
      const size = rect.size.scaleSelf(pixelRatio).roundSelf()
      if (!size.equals(Point.fromObject(canvas)))
        Object.assign(canvas, size.toSizeObject())
    })

    $.anim = $.reduce.throttle(25).first.last.next(({ transition }) =>
      createStepAnimation(transition.animSettings, $.anim)
    )

    $.animValues = $.reduce(({ anim: { set }, matrix, pixelRatio }) =>
      set({
        zoom: matrix.a,
        offset: Point.fromMatrix(matrix).scaleSelf(pixelRatio),
      })
    )

    $.animValues = $.reduce.raf(({ anim: { t, from, to, update }, animValues: _ }) =>
      update({
        zoom: from.zoom + (to.zoom - from.zoom) * t,
        offset: from.offset.translate(to.offset.screen(from.offset).scale(t)),
      })
    )

    // convert to scalar so they can be compared during
    // the canvas render effect so there are no wasteful redraws
    $.effect(({ animValues }) => {
      $.zoom = animValues.zoom
      $.offsetX = animValues.offset.x
      $.offsetY = animValues.offset.y
    })

    $.effect.raf((
      {
        canvas: {
          width: w,
          height: h,
        },
        rect: _, // triggers on resize
        ctx,
        cellSize,
        xPattern: xp,
        yPattern: yp,
        pixelRatio,
        zoom,
        offsetX,
        offsetY,
      },
    ) => {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = Math.min(1, zoom ** 1.25 * 0.28)
      if (ctx.lineWidth < 0.01) return

      const z = zoom * cellSize * pixelRatio

      ctx.beginPath()

      let i = 0
      let sx = offsetX
      while (sx > 0) sx -= z, i--
      while (sx < -z) sx += z, i++
      for (let x = sx; x < w; x += z) {
        if (!+xp[modwrap(i++, xp.length)]) continue
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      }

      i = 0
      let sy = offsetY
      while (sy > 0) sy -= z, i--
      while (sy < -z) sy += z, i++
      for (let y = sy; y < h; y += z) {
        if (!+yp[modwrap(i++, yp.length)]) continue
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      }

      ctx.stroke()
    })
  }
}
