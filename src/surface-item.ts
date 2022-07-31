import $ from 'sigl'

import { Point, Rect } from 'sigl'
import { SurfaceElement } from './surface'

export interface SurfaceItemElement extends $.Element<SurfaceItemElement> {}

@$.element()
export class SurfaceItemElement extends HTMLElement {
  @$.out() rect = new Rect()
  pos: Point = $(this).reduce(({ $, rect }) => $.pos?.equals(rect.pos) ? $.pos : rect.pos)
  size: Point = $(this).reduce(({ $, rect }) => $.size?.equals(rect.size) ? $.size : rect.size)

  surface?: SurfaceElement
  points?: Point[]

  mounted($: SurfaceItemElement['$']) {
    $.effect(({ host, pos }) => {
      Object.assign(host.style, pos.toStylePosition())
    })

    $.effect(({ host, size }) => {
      Object.assign(host.style, size.toStyleSize())
    })
  }
}
