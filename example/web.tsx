/** @jsxImportSource sigl */
import { Rect } from 'sigl'
import $ from 'sigl'
import { SurfaceElement, SurfaceItemElement, SurfaceMoveElement, SurfaceResizeElement } from '../src'

interface ItemElement extends $.Element<ItemElement> {}

@$.element()
class ItemElement extends $(SurfaceItemElement) {
  SurfaceMove = $.element(SurfaceMoveElement)
  SurfaceResize = $.element(SurfaceResizeElement)
  mounted($: ItemElement['$']) {
    $.render(({ host, surface, SurfaceMove, SurfaceResize }) => (
      <>
        <style>
          {/*css*/ `
          :host {
            box-sizing: border-box;
            border: 2px solid pink;
            display: block;
            position: absolute;
          }

          ${SurfaceMove} {
            background: #067;
            width: 100%;
            height: 20px;
            position: absolute;
          }

          ${SurfaceResize} {
            background: #ba2;
            position: absolute;
            right: 0;
            bottom: 0;
            width: 20px;
            height: 20px;
          }
          `}
        </style>
        <SurfaceMove surface={surface} dest={host} />
        <SurfaceResize surface={surface} dest={host} />
      </>
    ))
  }
}

interface SceneElement extends $.Element<SceneElement> {}

@$.element()
class SceneElement extends HTMLElement {
  Surface = $.element(SurfaceElement)
  Item = $.element(ItemElement)

  items = new $.RefSet<ItemElement>([
    { rect: new Rect(0, 0, 100, 100) },
    { rect: new Rect(200, 0, 100, 100) },
  ])

  mounted($: this['$']) {
    $.render(({ Surface, Item, items }) => (
      <Surface>
        {items.map(item => <Item {...item} />)}
      </Surface>
    ))
  }
}

const Scene = $.element(SceneElement)

$.render(
  <>
    <style>
      {/*css*/ `
      ${Scene} {
        display: block;
        width: 100%;
        height: 100%;
        position: fixed;
      }
    `}
    </style>
    <Scene />
  </>,
  document.body
)
