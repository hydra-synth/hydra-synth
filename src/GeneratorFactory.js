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

var ParametrizedGenerator = function (param) {
  return Object.create(ParametrizedGenerator.prototype)
}

ParametrizedGenerator.prototype.compileInvocations = function (st, il, adj, rmul, adjMod) {
  return this.chain.reduce((code, {function_type, instance, input, factor, type}) => {
    let new_code = `${code}`

    if (function_type === 'indexMod') {
      return `${new_code}
  ${il} = ${instance.invocation()(il)};`
    }
    if (function_type === 'stMod') {
      return `${new_code}
  ${st} = ${instance.invocation()(`${st}, ${il}`)};`
    }
    if (function_type === 'adjMod') {
      return `${new_code}
  ${adjMod} = ${instance.invocation()(`${st}, ${il}, ${adj}`)};`
    }

    if (factor && input && type) {
      new_code = `${new_code}
  ${adj} = ix_adjust_${type}(${factor}*${adjMod}, ${input.name}, ${rmul}, ${il});`
    }

    if (input) {
      new_code = `${new_code}
  ${st} = ${instance.invocation()(st).replace(new RegExp(`(\\W)${input.name}(\\W)`), `$1${adj}$2`)};`
    } else {
      new_code = `${new_code}
  ${st} = ${instance.invocation()(st)};`
    }
    return new_code
  }, '')
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
   let speed = arr.speed ? arr.speed : 1
   return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
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
    } else if (input.type === 'parametrized') {
        typedArg.isUniform = false
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

const setup_method = (that, transform, inputs, instance) => {

  let new_transform
  let new_uniforms = []

  if (transform.type === 'combine' || transform.type === 'combineCoord') {
  // composition function to be executed when all transforms have been added
  // c0 and c1 are two inputs.. (explain more)
    var f = (c0) => (c1) => instance.invocation(inputs.slice(1))(`${c0}, ${c1}`)
    
    new_transform = compositionFunctions[transform.type](that.transform)(inputs[0].value.transform)(f)

  } else {
    var f1 = (x) => instance.invocation(inputs)(x)

    if (typeof compositionFunctions[transform.type] === 'function') {
      new_transform = compositionFunctions[transform.type](that.transform)(f1)
    }
  }
  
  let new_instances = []
  new_instances.push(instance)

  inputs.forEach((input) => {
    if (input.isUniform) {
      new_uniforms.push(input)
    } else if (input.value && input.value.uniforms) {
      new_uniforms = new_uniforms.concat(input.value.uniforms)
    }

    if (input.value && input.value.instances) {
      new_instances = new_instances.concat(Object.entries(input.value.instances).map(([_, inst]) => inst))
    }
  })

  // make sure we don't have any duplicate uniforms
  new_uniforms = Object.entries(new_uniforms.reduce((p, c) => {
    p[c.name] = c
    return p
  }, {})).map(([_, value]) => value)

  that.append_pass(new_transform, new_uniforms, new_instances)
  
  return that
}

var GeneratorFactory = function (defaultOutput) {

  let self = this
  self.functions = {}
  self.instance_counter = counter.new()
  self.instances = {}

  window.frag = shaderManager(defaultOutput)

  // extend Array prototype
  Array.prototype.fast = function(speed) {
    this.speed = speed
    return this
  }

  const make_instance = (method, transform, inputs) => {
    let method_call_name = `${method}`

    const Instance = function () {
      return Object.create(Instance.prototype)
    }
    const instance = new Instance()

    Object.defineProperties(instance, {
      def_rex: {
        get: function () {
          return new RegExp(`^([^]*?)(\\S+\\s+)(?:${this.name}|${method})(\\s*\\([^)]+\\))([^]*)$`, 'ugmi')
        }
      }
    })

    // return the function body
    instance.implementation = (inputs, input_gen) => 
      transform.glsl ? transform.glsl.replace(instance.def_rex, `$1$2${method_call_name}$3$4`) : ""

    // return the function forward decalaration
    instance.definition = (inputs, input_gen) => {
      const impl = instance.implementation(inputs, input_gen)
      return impl ? impl.replace(instance.def_rex, `$2${method_call_name}$3;`) : ""
    } 
    
    // return the function invocation with the supplied parameter
    instance.invocation = (inputs, input_gen) => 
      (x) => `${method_call_name}(${x}${input_gen(inputs)})`

    // override the defaults, if the function defines specifics instance level implementations
    if (transform.glsl_instance) {
      method_call_name = `${method_call_name}_${self.instance_counter.increment()}`
      const instance_def = transform.glsl_instance(method_call_name)
      Object.keys(instance_def).forEach((name) => {
        instance[name] = instance_def[name]
      })
    }

    Object.getOwnPropertyNames(instance).forEach((instance_property) => {
      const old_property = instance[instance_property]
      instance[instance_property] = function (new_inputs) {
        return old_property(new_inputs ? new_inputs : inputs, generateGlsl)
      }
    })

    instance.name = method_call_name

    instance.register = (obj) => {
      obj.instances[method_call_name] = instance
    }

    return instance
  }

  Object.keys(glslTransforms).forEach((method) => {
    const transform = glslTransforms[method]

    const Pass = function () {
      const that = Object.create(Pass.prototype)

      that.transform = () => 'invalid'
      that.uniforms = []
      that.instances = {}
      that.factory = self

      return that
    }

    Pass.prototype.definition = function () {
      return `// definitions
// factory
${Object.entries(this.factory.instances).reduce((s, [_, inst]) => `${s}${inst.definition()}\n`, '')}
// pass
${Object.entries(this.instances).reduce((s, [_, inst]) => `${s}${inst.definition()}\n`, '')}
      `
    }
    Pass.prototype.implementation = function () {
      return `// implementations
// factory
${Object.entries(this.factory.instances).reduce((s, [_, inst]) => `${s}${inst.implementation()}\n`, '')}
// pass
${Object.entries(this.instances).reduce((s, [_, inst]) => `${s}${inst.implementation()}\n`, '')}
      `
    }

    // if type is a source, create a new global generator function that inherits from Generator object
    if (transform.type === 'src' || transform.type === 'parametrized') {
      self.functions[method] = (...args) => {
        
        var obj = Object.create(Generator.prototype)
        if (transform.type === 'parametrized') {
          obj = Object.create(ParametrizedGenerator.prototype)
          obj.chain = []
        }
        
        obj.name = method
        obj.factory = self
        
        obj.update_transform = (update_fn) => update_fn(obj.transform)

        obj.defaultOutput = defaultOutput
        obj.uniforms = []
        obj.passes = []
        
        Object.defineProperties(obj, {
          transform: {
            get: function () {
              if (obj.passes.length < 1) {
                return () => 'invalid'
              }
              return obj.passes[0].transform
            }
          },
          instances: {
            get: function () {
              if (obj.passes.length < 1) {
                return {}
              }
              return obj.passes[0].instances
            }
          }
        })

        obj.append_pass = (transform, uniforms, instances) => {
          obj.uniforms = obj.uniforms.concat(uniforms)

          if(!Array.isArray(instances)) instances = [instances]

          let pass
          if (obj.passes.length === 0) {
            pass = new Pass()
            pass.instances = obj.instances
            obj.passes.push(pass)
          } else {
            pass = obj.passes[0]
          }

          if (typeof transform !== 'undefined') {
            pass.transform = transform
          }
          pass.uniforms = pass.uniforms.concat(uniforms)
          instances.forEach((instance) => instance.register(obj))
        }

        if (transform.type === 'parametrized') {
          obj.append_pass = (transform, uniforms, instances) => {
            obj.uniforms = obj.uniforms.concat(uniforms)

            if(!Array.isArray(instances)) instances = [instances]

            let pass = new Pass()
            obj.passes.push(pass)

            pass.transform = transform
            pass.uniforms = pass.uniforms.concat(uniforms)
          
            if (obj.passes.length === 1) {
              pass.instances = obj.instances // the first pass and this obj share the same instance list
            }
            instances.forEach((instance) => instance.register(obj))

            return pass
          }
        }

        const inputs = formatArguments(args, transform.inputs)
        const instance = make_instance(method, transform, inputs)

        const new_transform = obj.update_transform(() =>
          (x) => instance.invocation(inputs)(x)
        )

        const new_uniforms = []
        inputs.forEach((input) => {
          if (input.isUniform) {
            new_uniforms.push(input)
          }
        })

        obj.append_pass(new_transform, new_uniforms, instance)

        return obj
      }
    } else if (transform.type === 'util' ) {
      const instance = make_instance(method, transform, [])
      instance.register(self)
    } else if (transform.type === 'indexMod' || transform.type === 'stMod'|| transform.type === 'adjMod'  ) {
      ParametrizedGenerator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)
        const instance = make_instance(method, transform, inputs)

        this.chain.push({
          instance,
          function_type: transform.type
        })

        return setup_method(this, transform, inputs, instance)
      }
    } else {

      Generator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)
        const instance = make_instance(method, transform, inputs)

        return setup_method(this, transform, inputs, instance)
      }
      
      if (transform.type === 'coord') {
        ParametrizedGenerator.prototype[method] = function (...args) {
          const mod_inputs = [
            {name:'tgt',type:'float',default:0},
            {name:'factor',type:'float',default:0},
          ].concat(transform.inputs)

          const inputs = formatArguments(args, mod_inputs)
          const instance = make_instance(method, transform, inputs.slice(2))

          const tgt = Math.floor(inputs[0].value)+2
          const factor = inputs[1].name
          
          this.chain.push({
            instance,
            tgt,
            factor,
            input: inputs[tgt],
            type: "lin"
          })

          return setup_method(this, transform, inputs.slice(1), instance)
        }
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

${pass.definition()}

${pass.implementation()}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    //vec2 st = uv;
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${pass.transform('st')};
  }
  `
  console.log(frag)

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
