const transforms = require('./glsl-transforms.js')

var Output = function (opts) {
  this.regl = opts.regl
  this.positionBuffer = this.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ])

  this.clear()
  this.pingPongIndex = 0

  // for each output, create two fbos to use for ping ponging
  this.fbos = (Array(2)).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      width: opts.width,
      height: opts.height,
      format: 'rgba'
    }),
    depthStencil: false
  }))

  // array containing render passes
  this.passes = []
  // console.log("position", this.positionBuffer)
}

// Object.keys(transforms).forEach((method) => {
//   Output.prototype[method] = function (...args) {
//   //  console.log("applying", method, transforms[method])
//     this.applyTransform(transforms[method], args)
//
//     return this
//   }
// })

Output.prototype.getCurrent = function () {
  // console.log("get current",this.pingPongIndex )
  return this.fbos[this.pingPongIndex]
}

Output.prototype.getTexture = function () {
//  return this.fbos[!this.pingPongIndex]
  var index = this.pingPongIndex ? 0 : 1
  //  console.log("get texture",index)
  return this.fbos[index]
}

Output.prototype.clear = function () {
  this.transformIndex = 0
  this.fragHeader = `
  precision mediump float;

  uniform float time;
  varying vec2 uv;
  `
  this.fragBody = ``
  //
  // uniform vec4 color;
  // void main () {
  //   gl_FragColor = color;
  // }`
  this.vert = `
  precision mediump float;
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
//  this.compileFragShader()

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


// Output.prototype.compileFragShader = function () {
//   var frag = `
//     ${this.fragHeader}
//
//     void main () {
//       vec4 c = vec4(0, 0, 0, 0);
//       vec2 st = uv;
//       ${this.fragBody}
//       gl_FragColor = c;
//     }
//   `
// // console.log("FRAG", frag)
//   this.frag = frag
// }

Output.prototype.render = function () {
  this.draw = this.regl({
    frag: this.frag,
    vert: this.vert,
    attributes: this.attributes,
    uniforms: this.uniforms,
    count: 3,
    framebuffer: () => {
      this.pingPongIndex = this.pingPongIndex ? 0 : 1
      return this.fbos[this.pingPongIndex]
    }
  })
}

Output.prototype.renderPasses = function(passes) {
  var self = this
//  console.log("passes", passes)
  this.passes = passes.map( (pass, passIndex) => {

    //  console.log("get texture",index)
    var uniforms = Object.assign(pass.uniforms, { prevBuffer:  () =>  {
           var index = this.pingPongIndex ? 0 : 1
        //  console.log('pass index', passIndex, 'fbo index', index)
         return this.fbos[this.pingPongIndex ? 0 : 1]
        }
      })

      return {
        draw: self.regl({
          frag: pass.frag,
          vert: self.vert,
          attributes: self.attributes,
          uniforms: uniforms,
          count: 3,
          framebuffer: () => {

            self.pingPongIndex = self.pingPongIndex ? 0 : 1
          //  console.log('pass index', passIndex, 'render index',  self.pingPongIndex)
            return self.fbos[self.pingPongIndex]
          }
        })
      }
  })
}

Output.prototype.tick = function (props) {
//  this.draw(props)
  this.passes.forEach((pass) => pass.draw(props))
}

module.exports = Output
