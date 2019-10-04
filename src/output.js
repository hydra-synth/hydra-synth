//const transforms = require('./glsl-transforms.js')

var Output = function (opts) {
  this.regl = opts.regl
  this.positionBuffer = this.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ])

  this.clear()
  this.pingPongIndex = 0

  this.renderIndex = 0
  this.prevFrameIndex = 2
  var alternate = 3 - (this.renderIndex + this.prevFrameIndex)
  this.pingPong = [this.renderIndex, alternate]

  // for each output, create three fbos to use for ping ponging and for
  // storing the previous frame
  this.fbos = (Array(3)).fill().map(() => this.regl.framebuffer({
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
//  return this.fbos[this.pingPongIndex]
  //console.log("getting", this.prevFrameIndex)
  //return this.fbos[this.renderIndex]
//  console.log("get current",this.prevFrameIndex)
  return this.fbos[this.prevFrameIndex]
}

Output.prototype.getTexture = function () {
//  return this.fbos[!this.pingPongIndex]
  // var index = this.pingPongIndex ? 0 : 1
  //  console.log("get texture",index)
  var index = this.prevFrameIndex
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

// Output.prototype.render = function () {
//   this.draw = this.regl({
//     frag: this.frag,
//     vert: this.vert,
//     attributes: this.attributes,
//     uniforms: this.uniforms,
//     count: 3,
//     framebuffer: () => {
//       this.pingPongIndex = this.pingPongIndex ? 0 : 1
//       this.prevFrameIndex = this.renderIndex
//       this.renderIndex++
//       if(this.renderIndex > this.fbos.length - 1) this.renderIndex = 0
//       return this.fbos[this.renderIndex]
//     }
//   })
// }

Output.prototype.renderPasses = function(passes) {
  console.log('rendering', passes)
  var self = this
//  console.log("passes", passes)

  // values > diff > sum > desired result
  // 0 1 > 1 > 1 > 2
  // 1 2 > 1 > 3 > 0
  // 2 0 > 2 > 2 > 1

  // get buffer that is neither storing


  this.passes = passes.map( (pass, passIndex) => {

    //  console.log("get texture",index)
    var uniforms = Object.assign(pass.uniforms, { prevBuffer:  () =>  {
           //var index = this.pingPongIndex ? 0 : 1
           var index = self.pingPong[(passIndex+1)%2]
      //    console.log('pass index', self.pingPong, 'fbo index', index)
         //return this.fbos[this.pingPongIndex ? 0 : 1]
          return this.fbos[index]
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
          //  var prev =   self.prevFrameIndex
          //  self.prevFrameIndex = this.renderIndex
          //  self.renderIndex = alternate
          //    console.log(self.prevFrameIndex, self.renderIndex)
          //  self.pingPongIndex = self.pingPongIndex ? 0 : 1
            var index = self.pingPong[(passIndex)%2]
            //console.log('pass index', self.pingPong, 'render index',  pass, index)
            return self.fbos[index]
          }
        })
      }
  })

}

Output.prototype.tick = function (props) {
//  this.draw(props)
//  console.log('render', this.renderIndex, 'previous', this.prevFrameIndex)
//console.log('indices', this.renderIndex, this.prevFrameIndex, alternate)
  this.passes.forEach((pass) => pass.draw(props))
//  console.log('passesp', this.prevFrameIndex, this.renderIndex
  var prev = this.prevFrameIndex
  this.prevFrameIndex = this.pingPong[(this.passes.length+1)%2]
  this.renderIndex = prev
  var alternate = 3 - (this.renderIndex + this.prevFrameIndex)
  this.pingPong = [this.renderIndex, alternate]
  // var prev = this.prevFrameIndex
  // this.prevFrameIndex = this.renderIndex
  // console.log(this.renderIndex, prev, alternate)
  // this.prevFrameIndex = this.pingPong[this.passes.length%2]
  // this.renderIndex = this.pingPong[(this.passes.length+1)%2]
  //  self.renderIndex = alternate
}

module.exports = Output
