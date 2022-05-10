import { SurfaceElement, SurfaceMoveElement, SurfaceResizeElement } from '../src'

customElements.define('x-surface', SurfaceElement)
customElements.define('x-surface-move', SurfaceMoveElement)
customElements.define('x-surface-resize', SurfaceResizeElement)
document.body.innerHTML = /*html*/ `
<style>
  html, body {
    width: 100%;
    height: 100%;
  }

  body {
    box-sizing: border-box;
    padding: 50px;
  }

  x-surface {
    display: inline-flex;
    resize: both;
    box-sizing: border-box;
  }
  x-surface div {
    position: relative;
    box-sizing: border-box;
    display: inline-flex;
    border: 2px solid #aaa;
    width: 70px;
    height: 30px;
    z-index: 1;
    overflow: hidden;
  }
  x-surface-move {
    display: inline-flex;
    box-sizing: border-box;
    place-items: center;
    justify-content: center;
    background: #04a;
    width: 30px;
    cursor: grab;
  }
  x-surface-resize {
    position: absolute;
    display: inline-flex;
    box-sizing: border-box;
    place-items: center;
    z-index: 1;
    background: #04a;
    width: 40px;
    height: 40px;
    transform: rotate(45deg);
    right: -20px;
    bottom: -20px;
    cursor: nwse-resize;
  }
</style>
<x-surface>
  <div data-left="10" data-top="-10" data-width="200" data-height="200"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>hello</div>
  <div data-left="100" data-top="-100" data-width="200" data-height="200"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
  <div data-left="320" data-top="-440" data-width="200" data-height="200"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
  <div data-left="530" data-top="-200" data-width="200" data-height="200"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
</x-surface>
`
