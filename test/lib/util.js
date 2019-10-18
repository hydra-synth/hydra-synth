const {JSDOM} = require('jsdom')

class DummyOutput {
  constructor () {
    this.passes = []
  }

  renderPasses (passes) {
    this.passes.push(passes)
  }
}

function prepareForHydra () {
  const dom = new JSDOM(`<!DOCTYPE html>
<html>
    <head>
        <title></title>
    </head>
    <body>
        <canvas id="hydra-canvas" width="800" height="600"></canvas>
    </body>
</html>`)

  global.window = dom.window
  global.document = dom.window.document
  global.navigator = dom.window.navigator

  const canvas = dom.window.document.querySelector('#hydra-canvas')
  canvas.captureStream = () => undefined
  canvas.getContext = () => ({})

  global.navigator.mediaDevices = {
    getUserMedia: () => Promise.reject({name: 'not implemented / ignore'})
  }
  global.navigator.getUserMedia = () => {}

  global.AudioContext = class {
    constructor () {
    }
    createMediaStreamSource () {
      return undefined
    }
  }

  global.MediaSource = class {
    constructor () {
    }
    addEventListener () {
      return undefined
    }
  }

  const original_function = dom.window.document.createElement

  dom.window.document.createElement = function (...args) {
    const [elementName] = args
    const newElement = original_function.apply(this, args)
    if (elementName === 'canvas') {
      newElement.getContext = () => ({})
    }
    return newElement
  }

  return {dom, canvas}
}

module.exports = {
  DummyOutput,
  prepareForHydra
}
