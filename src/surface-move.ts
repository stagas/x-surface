import $ from 'sigl'

import { Point, Rect } from 'sigl'
import { SurfaceCursorState, SurfaceElement, SurfaceState } from './surface'
import { SurfaceItemElement } from './surface-item'
import { modwrap } from './util'

export type SurfaceMoveDetail = {
  dest: $.ChildOf<SurfaceItemElement>
  rect: Rect
}

export type SurfaceMoveEvents = {
  surfacemoveitemmove: CustomEvent<SurfaceMoveDetail>
  surfacemoveitemmovestart: CustomEvent<SurfaceMoveDetail>
  surfacemoveitemmoveend: CustomEvent<SurfaceMoveDetail>
}

export const SurfaceMoveState = {
  Idle: 'surfacemoveidle',
  ItemMove: 'surfacemoveitemmove',
} as const

export interface SurfaceMoveElement extends $.Element<SurfaceMoveElement, SurfaceMoveEvents> {}

@$.element()
export class SurfaceMoveElement extends HTMLElement {
  root = $(this).shadow(/*html*/ `<style>${/*css*/ `:host {
    display: inline-flex;
    width: 100%;
    height: 100%;
  }`}</style><slot></slot>`)

  @$.attr() state = $(this).state(SurfaceMoveState)

  surface?: SurfaceElement
  dest?: $.ChildOf<SurfaceItemElement>

  pointerId?: number
  grabPos?: Point | null

  mounted($: SurfaceMoveElement['$']) {
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
        surface.cursorState.push(SurfaceCursorState.Grabbing)
      }
    })

    $.effect(({ host, surface, dest }) =>
      $.ondblclick(host, () => {
        surface.centerItem!(dest)
      })
    )

    $.effect(({ host, surface, dest }) =>
      $.on(host).pointerdown.stop(
        $.when(
          $.state.isIdle,
          $.atomic(e => {
            if (!(e.buttons & $.MouseButton.Left)) return

            const pos = new Point(e.pageX, e.pageY)
              .translateSelf(surface.rect.negate())
              .normalizeSelf(surface.viewMatrix)

            const rect = dest.rect //Rect.fromElement(dest)
            $.pointerId = e.pointerId
            $.grabPos = rect.pos
              .translateSelf(pos.negateSelf())
              // this creates the effect of lifting up
              .translateSelf(-(surface.gridCellSize * surface.snapThreshold))

            // move the window over everything, also 1 bit above its cables
            dest.style.zIndex = (++SurfaceElement.zIndex << 1).toString()

            $.state.push(SurfaceMoveState.ItemMove, { dest, rect })
          })
        )
      )
    )

    $.effect(({ surface, dest, grabPos, pointerId }) => {
      if (!$.state.is(SurfaceMoveState.ItemMove)) return

      const rect = dest.rect //Rect.fromElement(dest)

      const snapPoint = (a: Point, snapThreshold = surface.snapThreshold) => {
        const snap = 1 / surface.gridCellSize

        const b = a.translate(rect.size)

        const sa = a.precisionRound(snap)
        const sb = b.precisionRound(snap)

        const { xPattern: xp, yPattern: yp } = surface
        const ga = sa.pos.normalizeSelf(surface.gridCellSize)
        const gb = sb.pos.normalizeSelf(surface.gridCellSize)
        const iax = +xp[modwrap(ga.x, xp.length)]
        const iay = +yp[modwrap(ga.y, yp.length)]
        const ibx = +xp[modwrap(gb.x, xp.length)]
        const iby = +yp[modwrap(gb.y, yp.length)]

        const snapSize = surface.gridCellSize * snapThreshold

        rect.x = iax && Math.abs(sa.x - a.x) < snapSize
          ? sa.x
          : ibx && Math.abs(sb.x - b.x) < snapSize
          ? sb.x - rect.width
          : a.x

        rect.y = iay && Math.abs(sa.y - a.y) < snapSize
          ? sa.y
          : iby && Math.abs(sb.y - b.y) < snapSize
          ? sb.y - rect.height
          : a.y

        dest.rect = rect.clone()
      }

      const offMove = $.on(window).pointermove(e => {
        if (e.pointerId !== pointerId) return

        const pos = new Point(e.pageX, e.pageY)
          .translateSelf(surface.rect.negate())
          .normalizeSelf(surface.viewMatrix)
          .translateSelf(grabPos)

        snapPoint(pos)

        $.state.emit(SurfaceMoveState.ItemMove, { dest, rect })
      })

      const offUp = $.on(window).pointerup.once(() => {
        snapPoint(rect.pos, 1)

        offMove()

        $.state.pop(SurfaceMoveState.ItemMove, { dest, rect })
      })

      // this creates the initial effect of lifting up
      snapPoint(
        new Point(rect.pos).translate(
          -(surface.gridCellSize * surface.snapThreshold)
        )
      )

      return $.chain(offMove, offUp)
    })
  }
}
