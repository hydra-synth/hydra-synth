/* globals tex */
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
// timing function that accepts a sequence of values as an array
const seq = (arr = []) => ({time, bpm}) =>
{
  let speed;
  if(arr.speed){
    try {
      speed = arr.speed({time, bpm, arr})
      speed = speed * 1 // force numeric conversion
    }
    catch(e){
      console.log('ERROR',e)
    }
  }
  speed = speed ? speed : 1
  if (arr.easingFunction) {
    let t = (time * speed * (bpm / 60))
    let start = arr[Math.floor(t) % arr.length]
    let stop = arr[Math.ceil(t) % arr.length]
    return arr.easingFunction(t%1.0) * (stop - start) + start;
  }
  else {
	return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
  }
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
        typedArg.value = (context, props, batchId) => {
          try {
            return userArgs[index](props)
          } catch (e) {
            console.log('ERROR', e)
            return input.default
          }
        }
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

  window.frag = shaderManager(defaultOutput)

  const easingFunctions = {
	linear: t => t,
	quad:  t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
	cubic: t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
	quart: t => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t,
	quint: t => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t,
	sin: t => (1 + Math.sin(Math.PI*t-Math.PI/2))/2
  }

  // extend Array prototype
  Array.prototype.fast = function(speed) {
    // always make speed a function to not have to check later
    if(typeof speed !== 'function'){
      const aspeed = speed
      speed = () => aspeed
    }
    this.speed = speed
    return this
  }

  Array.prototype.easingFunction = false
  
  Array.prototype.ease = function(value = 'linear') {
    if (typeof value == 'function') {
      this.easingFunction = value
    }
    else {
      this.easingFunction = easingFunctions[value]
    }
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
  precision highp float;
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
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${pass.transform('st')};
  }
  `
  return frag
}


// creates a fragment shader from an object containing uniforms and a snippet of
// fragment shader code
Generator.prototype.compileRenderPass = function (pass) {
  var frag = `
      precision highp float;
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


Generator.prototype.glsl = function (_output) {
  var output = _output || this.defaultOutput

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
  return passes
}



Generator.prototype.out = function (_output) {
//  console.log('UNIFORMS', this.uniforms, output)
  var output = _output || this.defaultOutput

  output.renderPasses(this.glsl(output))

}

module.exports = GeneratorFactory
