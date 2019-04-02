const processTransforms = require('./processTransforms.js')
//const glslTransforms = require('./composable-glsl-functions.js')
const utilityGlsl = require('./utility_functions.js')

var GlslSource = function (obj) {
  console.log('creating', obj)
  this.transforms = []
  this.transforms.push(obj)
  this.defaultOutput = obj.defaultOutput
  this.synth = obj.synth
  
  return this
  //this.addTransform = this.addTransform.bind(this)
  //return Object.create(GlslSource.prototype)
}


GlslSource.prototype.addTransform = function (obj)  {
    this.transforms.push(obj)
  //  console.log(self.transforms)
}

GlslSource.prototype.out = function (_output) {

  //var shaderInfo = processTransforms(this.transforms)
//  console.log('transforms', shaderInfo)

  var output = _output || this.defaultOutput
  var glsl = this.glsl(output)
  this.synth.currentFunctions = []
 output.renderPasses(glsl)

}

GlslSource.prototype.glsl = function (_output) {
  var output = _output || this.defaultOutput

  // var passes = this.passes.filter((pass) => !pass.empty).map((pass) => {
  //   var uniforms = {}
  //   pass.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
  //   if(pass.hasOwnProperty('transform')){
  //     return {
  //       frag: this.compile(pass),
  //       uniforms: Object.assign({}, output.uniforms, uniforms)
  //     }
  //   } else {
  //     return {
  //       frag: pass.frag,
  //       uniforms:  Object.assign({}, output.uniforms, uniforms)
  //     }
  //   }
  // })

  var shaderInfo = processTransforms(this.transforms)
  var uniforms = {}
  shaderInfo.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })

  return [
    {
      frag: this.compile(shaderInfo),
      uniforms: Object.assign({}, output.uniforms, uniforms)
    }
  ]
}

GlslSource.prototype.compile = function (shaderInfo) {


//  console.log('transforms', shaderInfo)
  var frag = `
  precision mediump float;
  ${Object.values(shaderInfo.uniforms).map((uniform) => {
    let type = ''
    switch (uniform.type) {
      case 'float':
        type = 'float'
        break
      case 'texture':
        type = 'sampler2D'
        break
    }
    return `
      uniform ${type} ${uniform.name};`
  }).join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(utilityGlsl).map((transform) => {
  //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `
  }).join('')}

  ${shaderInfo.glslFunctions.map((name) => {
    return `
            ${this.synth.glslTransforms[name].glsl}
          `
  }).join('')}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    //vec2 st = uv;
    vec2 st = gl_FragCoord.xy/resolution;
    gl_FragColor = ${shaderInfo.fragColor};
  }
  `
  return frag

}

module.exports = GlslSource
