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

  surface?: SurfaceElement

  items = new $.RefSet<ItemElement>([
    { rect: new Rect(0, 0, 500, 500) },
    { rect: new Rect(600, 0, 500, 500) },
  ])

  mounted($: this['$']) {
    $.render(({ Surface, Item, items }) => (
      <Surface ref={$.ref.surface}>
        {items.map(item => <Item {...item} />)}
      </Surface>
    ))

    // $.effect(({ surface }) => {
    setTimeout(() => {
      const ev = new WheelEvent('wheel', {
        deltaY: -800,
      })
      Object.defineProperty(ev, 'pageX', { value: 250 })
      Object.defineProperty(ev, 'pageY', { value: 150 })
      window.dispatchEvent(ev)
    }, 500)
    // })
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
