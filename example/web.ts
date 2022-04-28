import { Surface, SurfaceMove, SurfaceResize } from '../src'

customElements.define('x-surface', Surface)
customElements.define('x-surface-move', SurfaceMove)
customElements.define('x-surface-resize', SurfaceResize)
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
    background: #04a;
    width: 30px;
    height: 30px;
    transform: rotate(45deg);
    right: -15px;
    bottom: -15px;
    cursor: nwse-resize;
  }
</style>
<x-surface>
  <div data-x="10" data-y="-10"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>hello</div>
  <div data-x="100" data-y="-100"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
  <div data-x="320" data-y="-440"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
  <div data-x="530" data-y="-200"><x-surface-move>=</x-surface-move><x-surface-resize>:</x-surface-resize>world</div>
</x-surface>
`
