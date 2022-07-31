import $ from 'sigl'

import { Point, Rect } from 'sigl'
import { SurfaceCursorState, SurfaceElement, SurfaceState } from './surface'
import { SurfaceItemElement } from './surface-item'
import { modwrap, round } from './util'

export type SurfaceResizeDetail = {
  dest: $.ChildOf<SurfaceItemElement>
  rect: Rect
}

export type SurfaceResizeEvents = {
  surfaceresizeitemresize: CustomEvent<SurfaceResizeDetail>
  surfaceresizeitemresizestart: CustomEvent<SurfaceResizeDetail>
  surfaceresizeitemresizeend: CustomEvent<SurfaceResizeDetail>
}

export const SurfaceResizeState = {
  Idle: 'surfaceresizeidle',
  ItemResize: 'surfaceresizeitemresize',
} as const

export interface SurfaceResizeElement extends $.Element<SurfaceResizeElement, SurfaceResizeEvents> {}

@$.element()
export class SurfaceResizeElement extends HTMLElement {
  root = $(this).shadow(/*html*/ `<style>${/*css*/ `:host {
    display: inline-flex;
    width: 100%;
    height: 100%;
  }`}</style><slot></slot>`)

  @$.attr() state = $(this).state(SurfaceResizeState)

  surface?: SurfaceElement
  dest?: $.ChildOf<SurfaceItemElement>

  pointerId?: number
  grabPos?: Point | null
  orig?: Rect | null

  mounted($: SurfaceResizeElement['$']) {
    $.effect(({ host }) => {
      if (!~host.tabIndex) host.tabIndex = 0
    })

    $.effect(({ state, surface }) => {
      if (state.isIdle) {
        if (surface.state.is(SurfaceState.Overlay)) {
          surface.state.pop(SurfaceState.Overlay)
        }
      } else {
        surface.state.push(SurfaceState.Overlay)
        surface.cursorState.push(SurfaceCursorState.NWSEResize)
      }
    })

    $.effect(({ host, surface, dest }) =>
      $.on(host).pointerdown.stop(
        $.when(
          $.state.isIdle,
          $.atomic(e => {
            if (!(e.buttons & $.MouseButton.Left)) return

            const pos = new Point(e.pageX, e.pageY)
              .translateSelf(surface.rect.negate())
              .normalizeSelf(surface.viewMatrix)

            $.pointerId = e.pointerId
            $.grabPos = pos.negateSelf()
            $.orig = dest.rect.clone()

            // move the window over everything, also 1 bit above its cables
            dest.style.zIndex = (++SurfaceElement.zIndex << 1).toString()

            $.state.push(SurfaceResizeState.ItemResize, { dest, rect: $.orig })
          })
        )
      )
    )

    $.effect(({ surface, dest, grabPos, pointerId, orig }) => {
      if (!$.state.is(SurfaceResizeState.ItemResize)) return

      const rect = dest.rect

      let hasMoved = false
      const snapPoint = (p: Point, snapThreshold = surface.snapThreshold) => {
        hasMoved = true

        const snap = 1 / surface.gridCellSize

        const sp = round(p, snap)

        const snapSize = surface.gridCellSize * snapThreshold

        const { xPattern, yPattern } = surface
        const ipx = +xPattern[modwrap(sp.x / surface.gridCellSize, xPattern.length)]
        const ipy = +yPattern[modwrap(sp.y / surface.gridCellSize, yPattern.length)]

        const x = ipx && Math.abs(sp.x - p.x) < snapSize
          ? sp.x
          : p.x

        const y = ipy && Math.abs(sp.y - p.y) < snapSize
          ? sp.y
          : p.y

        rect.width = Math.max(10, x - rect.left)
        rect.height = Math.max(10, y - rect.top)

        dest.rect = rect.clone()
      }

      const offMove = $.on(window).pointermove(e => {
        if (e.pointerId !== pointerId) return

        const pos = new Point(e.pageX, e.pageY)
          .translateSelf(surface.rect.negate())
          .normalizeSelf(surface.viewMatrix)
          .translateSelf(grabPos)
          .translateSelf(orig.size)
          .translateSelf(rect)

        snapPoint(pos)

        $.state.emit(SurfaceResizeState.ItemResize, { dest, rect })
      })

      const offUp = $.on(window).pointerup.once(() => {
        if (hasMoved) snapPoint(rect.size.translate(rect.pos), 1)

        offMove()

        $.state.pop(SurfaceResizeState.ItemResize, { dest, rect })
      })

      return $.chain(offMove, offUp)
    })
  }
}
