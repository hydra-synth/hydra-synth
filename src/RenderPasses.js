const renderPassFunctions = require('./renderpass-functions.js')

var RenderPass = function (param) {
  console.log('creating render pass', param)
  return Object.create(RenderPass.prototype)
}

var RenderFactory = function (opts) {
  let self = this
  self.functions = {}


  Object.keys(renderPassFunctions).forEach((method) => {
    const renderPass = renderPassFunctions[method]
    // create an instance of renderPass for each render pass of type 'src'
    if (renderPass.type === 'src') {
      self.functions[method] = (...args) => {
        var obj = Object.create(RenderPass.prototype)
        obj.name = method
        obj.regl = opts.regl
        obj.frag = renderPass.frag
        obj.width = opts.width
        obj.vert = `
        precision mediump float;
        attribute vec2 position;
        varying vec2 uv;

        void main () {
          uv = position;
          gl_Position = vec4(2.0 * position - 1.0, 0, 1);
        }`
        obj.height = opts.height
        console.log('this obj', obj)
        initFbos(obj)

      }
    } else {
      // RenderPass.prototype[method] = function (..args) {
      //   // code for what happens in a render pass goes here
      // }
    }
  })
}

function initFbos(obj) {
  console.log('this', obj)
  // create fbos
  obj.positionBuffer = obj.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ])

//  obj.clear()
  obj.pingPongIndex = 0

  // for each output, create two fbos to use for ping ponging
  obj.fbos = (Array(2)).fill().map(() => obj.regl.framebuffer({
    color: obj.regl.texture({
      width: obj.width,
      height: obj.height,
      format: 'rgba'
    }),
    depthStencil: false
  }))
}

module.exports = RenderFactory
