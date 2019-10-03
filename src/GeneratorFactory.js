/* globals tex */
const glslTransforms = require('./composable-glsl-functions.js')

// in progress: implementing multiple renderpasses within a single
// function string
const renderPassFunctions = require('./renderpass-functions.js')

const counter = require('./counter.js')
const shaderManager = require('./shaderManager.js')

const INPUT_TYPE_PARAMETRIZED = 'parametrized'

const SEQ_MOD_VAR_NAME_ST = 'st'
const SEQ_MOD_VAR_NAME_IL = 'il'
const SEQ_MOD_VAR_NAME_ADJ = 'adj'
const SEQ_MOD_VAR_NAME_ADJ_MOD = 'adj_mod'

const clone_l1 = (o) => Object.entries(o).reduce((h, [k, v]) => {
  h[k] = v
  return h
  }, {}
)

var Generator = function (param) {
  return Object.create(Generator.prototype)
}

var SequentialGenerator = function (param) {
  return Object.create(SequentialGenerator.prototype)
}

// Functions that return a new transformation function based on the existing function chain as well
// as the new function passed in.
const compositionFunctions = {
  coord: existingF => newF => x => existingF(newF(x)), // coord transforms added onto beginning of existing function chain
  color: existingF => newF => x => newF(existingF(x)), // color transforms added onto end of existing function chain
  combine: existingF1 => existingF2 => newF => x => newF(existingF1(x))(existingF2(x)), //
  combineCoord: existingF1 => existingF2 => newF => x => existingF1(newF(x)(existingF2(x))),
  coordSeq: existingF => newF => x => existingF(newF(x)),
  seqModIndex: existingF => newF => () => `${existingF()}\n  ${newF()};`,
  seqModSt: existingF => newF => () => `${existingF()}\n  ${newF()};`,
  seqModAdj: existingF => newF => () => `${existingF()}\n  ${newF()};`,
  seqModCoord: existingF => newF => () => `${existingF()}\n  ${newF()};`
}
// gl_FragColor = osc(modulate(osc(rotate(st, 10., 0.), 32., 0.1, 0.), st, 0.5), 199., 0.1, 0.);

// hydra code: osc().rotate().color().repeat().out()
// pseudo shader code: gl_FragColor = color(osc(rotate(repeat())))

// hydra code: osc().rotate().add(s0).repeat().out()
// gl_FragColor = osc(rotate(repeat())) + tex(repeat())

// Parses javascript args to use in glsl
function generateGlsl (inputs, forDefinition=false) {
  return inputs.reduce((s, input) => `${s}, ${forDefinition ? `${input.type} ` : ''}${forDefinition ? input.param_name : input.name}`, '')
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
    typedArg.param_name = input.name
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
    } else if (input.type === INPUT_TYPE_PARAMETRIZED) {
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

  let transform_fn
  let new_uniforms = []

  if (transform.type === 'combine' || transform.type === 'combineCoord') {
  // composition function to be executed when all transforms have been added
  // c0 and c1 are two inputs.. (explain more)
    let f = (c0) => (c1) => instance.invocation(inputs.slice(1))(`${c0}, ${c1}`)
    
    transform_fn = compositionFunctions[transform.type](that.transform)(inputs[0].value.transform)(f)
  } else {
    let f1 = (x) => instance.invocation(inputs)(x)

    if (transform.type === 'seqModCoord') {
      const plain_inputs = inputs.map((input, i) => [input, i]).filter(([input]) => input.type !== INPUT_TYPE_PARAMETRIZED)
      if (plain_inputs.length > 0) {
        const tgt = inputs[0].value + 2
        // console.log(`${transform.name} tgt: ${tgt}`)
        const tgt_name = inputs[tgt].name

        const fo = f1
        // TODO: Don't do this with a regexp
        const f2 = (x) => fo(x).replace(new RegExp(`(\\W)${tgt_name}(\\W)`), `$1adj$2`)
        f1 = f2
      }
    }

    if (typeof compositionFunctions[transform.type] === 'function') {
      transform_fn = compositionFunctions[transform.type](that.transform)(f1)
    } else {
      console.log(`ERROR: could not compose ${transform.type} transform ${transform.name}`)
    }
  }
  
  let new_glsl_function_instances = []
  new_glsl_function_instances.push(instance)

  inputs.forEach((input) => {
    if (input.isUniform) {
      new_uniforms.push(input)
    } else if (input.value && input.value.uniforms) {
      new_uniforms = new_uniforms.concat(input.value.uniforms)
    }

    if (input.value && input.value.glsl_function_instances) {
      new_glsl_function_instances = new_glsl_function_instances.concat(
        Object.entries(input.value.glsl_function_instances).map(([_, inst]) => inst)
      )
    }
  })

  // make sure we don't have any duplicate uniforms
  new_uniforms = Object.entries(new_uniforms.reduce((p, c) => {
    p[c.name] = c
    return p
  }, {})).map(([_, value]) => value)

  that.append_pass(transform, transform_fn, new_uniforms, new_glsl_function_instances, inputs)
  
  return that
}

var GeneratorFactory = function (defaultOutput) {

  let self = this
  self.functions = {}
  self.glsl_function_instance_counter = counter.new()
  self.glsl_function_instances = {}

  window.frag = shaderManager(defaultOutput)

  // extend Array prototype
  Array.prototype.fast = function(speed) {
    this.speed = speed
    return this
  }

  const make_glsl_function_instance = (method, transform, inputs) => {
    let method_call_name = `${method}`

    const Instance = function () {
      return Object.create(Instance.prototype)
    }
    const instance = new Instance()

    instance.glsl_name = transform.glsl_name ? transform.glsl_name : method

    Object.defineProperties(instance, {
      def_rex: {
        get: function () {
          return new RegExp(`^([^]*?)(\\S+\\s+)(?:${this.glsl_name}|${this.name})(\\s*\\([^)]+\\))([^]*)$`, 'ugmi')
        }
      }
    })

    const function_parts = {
      // the function body
      implementation: (inputs, input_gen) => 
        transform.glsl ? transform.glsl.replace(instance.def_rex, `$1$2${instance.glsl_name}$3$4`) : '',
      // the function forward decalaration
      definition: (inputs, input_gen) => {
        const impl = instance.implementation(inputs, input_gen)
        return impl ? impl.replace(instance.def_rex, `$2${instance.glsl_name}$3;`) : ''
      },
      // the function invocation with the supplied parameters
      invocation: (inputs, input_gen) => 
        (x) => `${instance.glsl_name}(${x}${input_gen(inputs)})`
    }
    
    instance.name = method

    // override the defaults, if the function defines specific instance level implementations
    if (transform.glsl_instance) {
      method_call_name = `${method_call_name}_${self.glsl_function_instance_counter.increment()}`
      instance.name = method_call_name
      instance.glsl_name = method_call_name
      const instance_def = transform.glsl_instance(method, method_call_name)
      if (instance_def) {
        Object.getOwnPropertyNames(instance_def).forEach((name) => {
          const idef = instance_def[name]
          if (name in function_parts) {
            function_parts[name] = idef
          } else {
            instance[name] = idef
          }
        })
      }
    }

    Object.getOwnPropertyNames(function_parts).forEach((instance_property) => {
      const old_property = function_parts[instance_property]
      instance[instance_property] = function (new_inputs) {
        return old_property(new_inputs ? new_inputs : inputs, generateGlsl)
      }
    })

    instance.register = (obj) => {
      obj.glsl_function_instances[method_call_name] = instance
    }

    return instance
  }

  // Convert object to array, since we can have two transforms with the same
  // name but of differing types
  const all_transforms = Object.entries(glslTransforms).map(([method, transform]) => {
    transform.name = method
    return transform
  })

  // Duplicate coord transforms for use in sequential processing chains
  all_transforms.filter((t) => t.type === 'coord').forEach((transform) => {
    // If thre are any targetable inputs in the original method, set up
    // additional inputs to define the modfication parameters
    // TODO: Make this an options object to allow targeting multiple parameters
    //       like so: {0: 1.25, 1: {x: 1.5, y: 0}, 2: {x: {mode: lin}}, mode: 'exp'}
    const plain_inputs = transform.inputs.filter(i => i.type !== INPUT_TYPE_PARAMETRIZED)
    const mod_inputs = [].concat(plain_inputs.length === 0 ? [] : [
        {name:'tgt',type:'float',default:0},
        {name:'factor',type:'float',default:0},
      ].concat(transform.inputs))

    const mod_transform = clone_l1(transform)

    mod_transform.type = 'seqModCoord'
    mod_transform.inputs = mod_inputs
    all_transforms.push(mod_transform)
  })

  // Duplicate chained methods for sequential processing
  all_transforms.filter((t) => t.type === 'chain').forEach((transform) => {
    const mod_transform = clone_l1(transform)

    mod_transform.type = 'seqModIndex'
    all_transforms.push(mod_transform)
  })

  // Set up code for sequential processing
  all_transforms.filter((t) => t.type === 'coordSeq').forEach((transform) => {
    transform.glsl_instance = (method, method_call_name) => ({
      name: method_call_name,
      glsl_name: method_call_name,
      implementation: (inputs, input_gen) => {
        const param_gen = inputs.filter(x => x.type === INPUT_TYPE_PARAMETRIZED).reduce((p, c) => p ? p : c.value, undefined)
        const plain_inputs = inputs.filter(x => x.type !== INPUT_TYPE_PARAMETRIZED)

        return `vec2 ${method_call_name}(vec2 _st${input_gen(plain_inputs, true)}) {
  vec2 ${SEQ_MOD_VAR_NAME_ST} = _st;
  vec2 ${SEQ_MOD_VAR_NAME_IL} = _st;
  float ${SEQ_MOD_VAR_NAME_ADJ} = 0.0;
  float ${SEQ_MOD_VAR_NAME_ADJ_MOD} = 1.0;

  ${param_gen.transform()}

  return st;
}`},
      invocation: (inputs, input_gen) => (x) => {
        const plain_inputs = inputs.filter(x => x.type !== INPUT_TYPE_PARAMETRIZED)
        return `${method_call_name}(${x}${input_gen(plain_inputs)})`
      }
    })
  })

  // Fix the invocation code for sequentially processed transforms
  all_transforms.filter((t) => t.type.startsWith('seqMod') || t.type === 'chain').forEach((transform) => {
    let invocation

    if (transform.type === 'seqModIndex' || transform.type === 'chain') {
      invocation = newF => () => `${SEQ_MOD_VAR_NAME_IL} = ${newF(`${SEQ_MOD_VAR_NAME_IL}`)};`
    } else if (transform.type === 'seqModSt') {
      invocation = newF => () => `${SEQ_MOD_VAR_NAME_ST} = ${newF(`${SEQ_MOD_VAR_NAME_ST}, ${SEQ_MOD_VAR_NAME_IL}`)};`
    } else if (transform.type === 'seqModAdj') {
      invocation = newF => () => `${SEQ_MOD_VAR_NAME_ADJ_MOD} = ${newF(`${SEQ_MOD_VAR_NAME_ST}, ${SEQ_MOD_VAR_NAME_IL}`)};`
    } else if (transform.type === 'seqModCoord') {
      invocation = newF => () => `${SEQ_MOD_VAR_NAME_ST} = mix(${SEQ_MOD_VAR_NAME_ST}, ${newF(`${SEQ_MOD_VAR_NAME_ST}`)}, ${SEQ_MOD_VAR_NAME_ADJ_MOD});`
    } else {
      // unknown type??
      invocation = newF => () => `ERROR: Unkown transform type ${transform.type} for transform ${transform.name}`
    }

    const old_glsl_instance = transform.glsl_instance
    const transform_glsl_instance = (name, method_call_name) => {
      let instance = {
        name: name,
        glsl_name: name
      }
      
      let old_invocation = (inputs, input_gen) => (x) => `${name}(${x}${input_gen(inputs)})`

      /*
      if (typeof old_glsl_instance === 'function') {
        const old_instance = old_glsl_instance()
        if (old_instance) {
          console.log('old instance:', name, method_call_name, old_instance, old_instance.name)
          instance = old_instance
          if (instance.invocation) {
            old_invocation = instance.invocation
          }
        }
      }
      */

      instance.invocation = (inputs, input_gen) => invocation(old_invocation(inputs, input_gen))
      return instance
    }

    transform.glsl_instance = transform_glsl_instance
  })

  all_transforms.forEach((transform) => {
    const method = transform.name

    const Pass = function () {
      const that = Object.create(Pass.prototype)

      that.transform = () => 'invalid'
      that.uniforms = []
      that.glsl_function_instances = {}
      that.factory = self

      return that
    }

    Pass.prototype.definition = function () {
      return `// definitions
// factory
${Object.entries(this.factory.glsl_function_instances).reduce((s, [_, inst]) => `${s}${inst.definition()}\n`, '')}
// pass
${Object.entries(this.glsl_function_instances).reduce((s, [_, inst]) => `${s}${inst.definition()}\n`, '')}
      `
    }
    Pass.prototype.implementation = function () {
      return `// implementations
// factory
${Object.entries(this.factory.glsl_function_instances).reduce((s, [_, inst]) => `${s}${inst.implementation()}\n`, '')}
// pass
${Object.entries(this.glsl_function_instances).reduce((s, [_, inst]) => `${s}${inst.implementation()}\n`, '')}
      `
    }

    // if type is a source, create a new global generator function that inherits from Generator object
    if (transform.type === 'src' || transform.type === 'chain') {
      self.functions[method] = (...args) => {
        
        var obj = Object.create(Generator.prototype)
        if (transform.type === 'chain') {
          obj = Object.create(SequentialGenerator.prototype)
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
          glsl_function_instances: {
            get: function () {
              if (obj.passes.length < 1) {
                return {}
              }
              return obj.passes[0].glsl_function_instances
            }
          }
        })

        obj.append_pass = (transform, transform_fn, uniforms, instances, inputs) => {
          obj.uniforms = obj.uniforms.concat(uniforms)

          if(!Array.isArray(instances)) instances = [instances]

          let pass
          if (obj.passes.length === 0) {
            pass = new Pass()
            pass.glsl_function_instances = obj.glsl_function_instances
            obj.passes.push(pass)
          } else {
            pass = obj.passes[0]
          }

          if (typeof transform_fn !== 'undefined') {
            pass.transform = transform_fn
          }
          pass.uniforms = pass.uniforms.concat(uniforms)
          instances.forEach((instance) => instance.register(obj))
        }

        const inputs = formatArguments(args, transform.inputs)
        const instance = make_glsl_function_instance(method, transform, inputs)

        const transform_fn = obj.update_transform(() =>
          (x) => instance.invocation(inputs)(x)
        )

        const new_uniforms = []
        inputs.forEach((input) => {
          if (input.isUniform) {
            new_uniforms.push(input)
          }
        })

        obj.append_pass(transform, transform_fn, new_uniforms, instance, inputs)

        return obj
      }
    } else if (transform.type === 'util' ) {
      const instance = make_glsl_function_instance(method, transform, [])
      instance.register(self)
    } else if (transform.type.startsWith('seqMod')) {
      console.log(`${transform.type}:`, method)
      SequentialGenerator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)

        let instance
        if (transform.type === 'seqModCoord') {
          instance = make_glsl_function_instance(method, transform, inputs.slice(2))
        } else {
          instance = make_glsl_function_instance(method, transform, inputs)
        }
        return setup_method(this, transform, inputs, instance)
      }
    } else {
      Generator.prototype[method] = function (...args) {
        const inputs = formatArguments(args, transform.inputs)
        const instance = make_glsl_function_instance(method, transform, inputs)

        return setup_method(this, transform, inputs, instance)
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
