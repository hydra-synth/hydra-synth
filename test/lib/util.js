const {JSDOM} = require('jsdom')
const gl = require('gl')
const mock = require('mock-require')

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

function mockRegl (dimensions = {width: 100, height: 100}) {
  // make sure wr'e not mocking regl
  mock.stop('regl')

  const orig_regl = require('regl')

  mock('regl', function (...args) {
    const [config] = args
    const ctx = gl(dimensions.width, dimensions.height, {preserveDrawingBuffer: true})
    config.extensions = config.extensions.filter(x => ['oes_texture_half_float', 'oes_texture_half_float_linear'].indexOf(x) === -1)
    config.gl = ctx
    return orig_regl(...args)
  })

  return {reset: () => mock.stop('regl')}
}

module.exports = {
  DummyOutput,
  prepareForHydra,
  mockRegl
}
