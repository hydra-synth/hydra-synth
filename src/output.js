//const transforms = require('./glsl-transforms.js')

var Output = function ({ regl, precision, label = "", width, height}) {
  this.regl = regl
  this.precision = precision
  this.label = label
  this.positionBuffer = this.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ])

  this.draw = () => {}
  this.init()
  this.pingPongIndex = 0

  // for each output, create two fbos for pingponging
  this.fbos = (Array(2)).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: 'nearest',
      width: width,
      height: height,
      format: 'rgba'
    }),
    depthStencil: false
  }))

  // array containing render passes
//  this.passes = []
}

Output.prototype.resize = function(width, height) {
  this.fbos.forEach((fbo) => {
    fbo.resize(width, height)
  })
//  console.log(this)
}


Output.prototype.getCurrent = function () {
  return this.fbos[this.pingPongIndex]
}

Output.prototype.getTexture = function () {
   var index = this.pingPongIndex ? 0 : 1
  return this.fbos[index]
}

Output.prototype.init = function () {
//  console.log('clearing')
  this.transformIndex = 0
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `

  this.fragBody = ``

  this.vert = `
  precision ${this.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`

  this.attributes = {
    position: this.positionBuffer
  }
  this.uniforms = {
    time: this.regl.prop('time'),
    resolution: this.regl.prop('resolution')
  }

  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `
  return this
}


Output.prototype.render = function (passes) {
  let pass = passes[0]
  //console.log('pass', pass, this.pingPongIndex)
  var self = this
      var uniforms = Object.assign(pass.uniforms, { prevBuffer:  () =>  {
             //var index = this.pingPongIndex ? 0 : 1
          //   var index = self.pingPong[(passIndex+1)%2]
          //  console.log('ping pong', self.pingPongIndex)
            return self.fbos[self.pingPongIndex]
          }
        })

  self.draw = self.regl({
    frag: pass.frag,
    vert: self.vert,
    attributes: self.attributes,
    uniforms: uniforms,
    count: 3,
    framebuffer: () => {
      self.pingPongIndex = self.pingPongIndex ? 0 : 1
      return self.fbos[self.pingPongIndex]
    }
  })
}


Output.prototype.tick = function (props) {
//  console.log(props)
  this.draw(props)
}

export default Output
