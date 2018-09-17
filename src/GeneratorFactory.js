/* globals tex */
const { seq, sin, ramp, createFades } = require('./timingUtils.js')
const glslTransforms = require('./composable-glsl-functions.js')

// in progress: implementing multiple renderpasses within a single
// function string
const renderPassFunctions = require('./renderpass-functions.js')

const counter = require('./counter.js')
const shaderManager = require('./shaderManager.js')

var Generator = function (param) {
  return Object.create(Generator.prototype)
}

// Functions that return a new transformation function based on the existing function chain as well
// as the new function passed in.
const compositionFunctions = {
  coord: existingF => newF => x => existingF(newF(x)), // coord transforms added onto beginning of existing function chain
  color: existingF => newF => x => newF(existingF(x)), // color transforms added onto end of existing function chain
  combine: existingF1 => existingF2 => newF => x => newF(existingF1(x))(existingF2(x)), //
  combineCoord: existingF1 => existingF2 => newF => x => existingF1(newF(x)(existingF2(x)))
}
// gl_FragColor = osc(modulate(osc(rotate(st, 10., 0.), 32., 0.1, 0.), st, 0.5), 199., 0.1, 0.);

// hydra code: osc().rotate().color().repeat().out()
// pseudo shader code: gl_FragColor = color(osc(rotate(repeat())))

// hydra code: osc().rotate().add(s0).repeat().out()
// gl_FragColor = osc(rotate(repeat())) + tex(repeat())

// Parses javascript args to use in glsl
function generateGlsl (inputs) {
  var str = ''
  inputs.forEach((input) => {
    str += ', ' + input.name
  })
  return str
}

// when possible, reformats arguments to be the correct type
// creates unique names for variables requiring a uniform to be passed in (i.e. a texture)
// returns an object that contains the type and value of each argument
// to do: add much more type checking, validation, and transformation to this part
function formatArguments (userArgs, defaultArgs) {
  return defaultArgs.map((input, index) => {
    var typedArg = {}

    // if there is a user input at a certain index, create a uniform for this variable so that the value is passed in on each render pass
    // to do (possibly): check whether this is a function in order to only use uniforms when needed

    counter.increment()
    typedArg.name = input.name + counter.get()
    typedArg.isUniform = true

    if (userArgs.length > index) {
    //  console.log("arg", userArgs[index])
      typedArg.value = userArgs[index]
      // if argument passed in contains transform property, i.e. is of type generator, do not add uniform
      if (userArgs[index].transform) typedArg.isUniform = false

      if (typeof userArgs[index] === 'function') {
        typedArg.value = (context, props, batchId) => (userArgs[index](props))
      } else if (userArgs[index].constructor === Array) {
      //  console.log("is Array")
        typedArg.value = (context, props, batchId) => seq(userArgs[index])(props)
      }
    } else {
      // use default value for argument
      typedArg.value = input.default
    }
    // if input is a texture, set unique name for uniform
    if (input.type === 'texture') {
      // typedArg.tex = typedArg.value
      var x = typedArg.value
      typedArg.value = () => (x.getTexture())
    } else {
      // if passing in a texture reference, when function asks for vec4, convert to vec4
      if (typedArg.value.getTexture && input.type === 'vec4') {
        var x1 = typedArg.value
        typedArg.value = src(x1)
        typedArg.isUniform = false
      }
    }
    typedArg.type = input.type
    return typedArg
  })
}


var GeneratorFactory = function (defaultOutput) {

  let self = this
  self.functions = {}

  // set global utility functions. to do: make global optional
  window.sin = sin
  window.ramp = ramp
  window.frag = shaderManager(defaultOutput)

  createFades(6)
  // extend Array prototype
  Array.prototype.fast = function(speed) {
  //  console.log("array fast", speed, this)
    this.speed = speed
    return this
  }

  Object.keys(glslTransforms).forEach((method) => {
    const transform = glslTransforms[method]

    // if type is a source, create a new global generator function that inherits from Generator object
    if (transform.type === 'src') {
      self.functions[method] = (...args) => {
        var obj = Object.create(Generator.prototype)
        obj.name = method
        const inputs = formatArguments(args, transform.inputs)
        obj.transform = (x) => {
          var glslString = `${method}(${x}`
          glslString += generateGlsl(inputs)
          glslString += ')'
          return glslString
        }
        obj.defaultOutput = defaultOutput
        obj.uniforms = []
        inputs.forEach((input, index) => {
          if (input.isUniform) {
            obj.uniforms.push(input)
          }
        })

        obj.passes = []
        let pass = {
          transform: (x) => {
            var glslString = `${method}(${x}`
            glslString += generateGlsl(inputs)
            glslString += ')'
            return glslString
          },
          uniforms: []
        }
        inputs.forEach((input, index) => {
          if (input.isUniform) {
            pass.uniforms.push(input)
          }
        })
        obj.passes.push(pass)
        return obj
      }
    } else {
      Generator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)

        if (transform.type === 'combine' || transform.type === 'combineCoord') {
        // composition function to be executed when all transforms have been added
        // c0 and c1 are two inputs.. (explain more)
          var f = (c0) => (c1) => {
            var glslString = `${method}(${c0}, ${c1}`
            glslString += generateGlsl(inputs.slice(1))
            glslString += ')'
            return glslString
          }
          this.transform = compositionFunctions[glslTransforms[method].type](this.transform)(inputs[0].value.transform)(f)

          this.uniforms = this.uniforms.concat(inputs[0].value.uniforms)

          var pass = this.passes[this.passes.length - 1]
          pass.transform = this.transform
          pass.uniform + this.uniform
        } else {
          var f1 = (x) => {
            var glslString = `${method}(${x}`
            glslString += generateGlsl(inputs)
            glslString += ')'
            return glslString
          }
          this.transform = compositionFunctions[glslTransforms[method].type](this.transform)(f1)
          this.passes[this.passes.length - 1].transform = this.transform
        }

        inputs.forEach((input, index) => {
          if (input.isUniform) {
            this.uniforms.push(input)
          }
        })
        this.passes[this.passes.length - 1].uniforms = this.uniforms
        return this
      }
    }
  })
}

//
//   iterate through transform types and create a function for each
//
Generator.prototype.compile = function (pass) {
//  console.log("compiling", pass)
  var frag = `
  precision mediump float;
  ${pass.uniforms.map((uniform) => {
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

  ${Object.values(glslTransforms).map((transform) => {
  //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `
  }).join('')}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    //vec2 st = uv;
    vec2 st = gl_FragCoord.xy/resolution;
    gl_FragColor = ${pass.transform('st')};
  }
  `
  return frag
}

// creates a fragment shader from an object containing uniforms and a snippet of
// fragment shader code
Generator.prototype.compileRenderPass = function (pass) {
  var frag = `
      precision mediump float;
      ${pass.uniforms.map((uniform) => {
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
      uniform sampler2D prevBuffer;
      varying vec2 uv;

      ${Object.values(renderPassFunctions).filter(transform => transform.type === 'renderpass_util')
      .map((transform) => {
      //  console.log(transform.glsl)
        return `
                ${transform.glsl}
              `
      }).join('')}

      ${pass.glsl}
  `
  return frag
}

Generator.prototype.glsl = function () {
//  console.log(this.compile())
}

// functions for testing multiple render passes
// Generator.prototype.fragPass = function () {
// return `
//   precision mediump float;
//   uniform float time;
//   uniform vec2 resolution;
//   uniform sampler2D prevBuffer;
//   varying vec2 uv;
//
//   void main () {
//     vec4 c = vec4(1, 0, 0, 1);
//     //vec2 st = uv;
//     vec2 st = gl_FragCoord.xy/resolution;
//     vec4 col = texture2D(prevBuffer, fract(st));
//     gl_FragColor = vec4(col.r, 1.0, col.b, col.a);
//   }
//   `
// }
//
// Generator.prototype.fragPass2 = function () {
// return `
//   precision mediump float;
//   uniform float time;
//   uniform vec2 resolution;
//   uniform sampler2D prevBuffer;
//   varying vec2 uv;
//
//   void main () {
//     vec4 c = vec4(1, 0, 0, 1);
//     //vec2 st = uv;
//     vec2 st = gl_FragCoord.xy/resolution;
//     vec4 col = texture2D(prevBuffer, fract(st));
//     gl_FragColor = vec4(col.r - 1.0, col.g, col.b, col.a);
//   }
//   `
// }

Generator.prototype.out = function (_output) {
//  console.log('UNIFORMS', this.uniforms, output)
  var output = _output || this.defaultOutput
  // var pass = {
  //   glsl: renderPassFunctions['edges'].glsl,
  //   uniforms: []
  // }
  // var frag = this.compileRenderPass(pass)
  // console.log('shader', frag)
  //
  // this.passes.push({
  //   frag: frag,
  //   uniforms: pass.uniforms
  // })
  // this.passes.push({
  //   frag: this.fragPass2(),
  //   uniforms: []
  // })
  var passes = this.passes.map((pass) => {
    var uniforms = {}
    pass.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
    if(pass.hasOwnProperty('transform')){
    //  console.log(" rendering pass", pass)

      return {
        frag: this.compile(pass),
        uniforms: Object.assign(output.uniforms, uniforms)
      }
    } else {
    //  console.log(" not rendering pass", pass)
      return {
        frag: pass.frag,
        uniforms:  Object.assign(output.uniforms, uniforms)
      }
    }
  })

  // console.log("FRAG", frag)
  output.renderPasses(passes)
  //var frag = this.compile(this.passes[this.passes.length-1])
  //output.frag = frag
/*  var uniformObj = {}
  this.uniforms.forEach((uniform) => { uniformObj[uniform.name] = uniform.value })
  output.uniforms = Object.assign(output.uniforms, uniformObj)*/
//  output.render()
}

module.exports = GeneratorFactory
