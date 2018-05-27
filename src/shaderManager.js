// to do:
// 1. how to handle multi-pass renders
// 2. how to handle vertex shaders

module.exports = function (defaultOutput) {

  var Frag = function (shaderString) {
    var obj =  Object.create(Frag.prototype)
    obj.shaderString =   `
    void main () {
      vec2 st = gl_FragCoord.xy/resolution;
      gl_FragColor = vec4(st, 1.0, 1.0);
    }
    `
    if(shaderString) obj.shaderString = shaderString
    return obj
  }

  Frag.prototype.compile = function () {
    var frag = `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 uv;

    ${this.shaderString}
    `
    return frag
  }

  Frag.prototype.out = function (_output) {
    var output = _output || defaultOutput
    var frag = this.compile()
    output.frag = frag
    // var uniformObj = {}
    // this.uniforms.forEach((uniform) => { uniformObj[uniform.name] = uniform.value })
    // output.uniforms = Object.assign(output.uniforms, uniformObj)
    output.render()
  }

  return Frag
}
