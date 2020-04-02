const glslTransforms = require('./glsl/composable-glsl-functions.js')
const GlslSource = require('./glsl-source.js')

//const renderpassFunctions = require('./glsl/renderpass-functions.js')

Array.prototype.fast = function (speed) {
  this.speed = speed
  return this
}

class GeneratorFactory {
  constructor ({
      defaultUniforms,
      defaultOutput,
      extendTransforms = (x => x),
      changeListener = (() => {})
    } = {}
    ) {
    this.defaultOutput = defaultOutput
    this.defaultUniforms = defaultUniforms
    this.changeListener = changeListener
    this.extendTransforms = extendTransforms
    this.generators = {}
    this.init()
  }
  init () {
    this.glslTransforms = {}
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({type: 'remove', synth: this, method})
      return prev
    }, {})

    this.sourceClass = (() => {
      return class extends GlslSource {
      }
    })()

    let functions = {}
    const addTransforms = (transforms) =>
      Object.entries(transforms).forEach(([method, transform]) => {
        functions[method] = transform
      })

    addTransforms(glslTransforms)
    //addTransforms(renderpassFunctions)

    if (typeof this.extendTransforms === 'function') {
      functions = this.extendTransforms(functions)
    } else if (Array.isArray(this.extendTransforms)) {
      addTransforms(this.extendTransforms.reduce((h, transform) => {
        h[transform.name] = transform
        return h
      }, {}))
    } else if (typeof this.extendTransforms === 'object') {
      addTransforms(this.extendTransforms)
    }

    Object.entries(functions).forEach(([method, transform]) => {
      if (typeof transform.glsl_return_type === 'undefined' && transform.glsl) {
        transform.glsl_return_type = transform.glsl.replace(new RegExp(`^(?:[\\s\\S]*\\W)?(\\S+)\\s+${method}\\s*[(][\\s\\S]*`, 'ugm'), '$1')
      }

      functions[method] = this._addMethod(method, transform)
    })

    return functions
 }

 _addMethod (method, transform) {
   console.log('adding', method, transform)
    this.glslTransforms[method] = transform
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: this
      })
      this.generators[method] = func
      this.changeListener({type: 'add', synth: this, method})
      return func
    } else  {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({name: method, transform: transform, userArgs: args})
        return this
      }
    }
    return undefined
  }

  setFunction(obj) {
    var processedGlsl = processGlsl(obj)
    console.log(processedGlsl)
    this._addMethod(obj.name, processedGlsl)
  }
}



const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoords': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 c0']
  }
}
// expects glsl of format
// {
//   name: 'osc', // name that will be used to access function as well as within glsl
//   type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
//   inputs: [
//     {
//       name: 'freq',
//       type: 'float', // 'float'   //, 'texture', 'vec4'
//       default: 0.2
//     },
//     {
//           name: 'sync',
//           type: 'float',
//           default: 0.1
//         },
//         {
//           name: 'offset',
//           type: 'float',
//           default: 0.0
//         }
//   ],
   //  glsl: `
   //    vec2 st = _st;
   //    float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
   //    float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
   //    float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
   //    return vec4(r, g, b, 1.0);
   // `
// }

// // generates glsl function:
// `vec4 osc(vec2 _st, float freq, float sync, float offset){
//  vec2 st = _st;
//  float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//  float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//  float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//  return vec4(r, g, b, 1.0);
// }`

function processGlsl(obj) {
  let t = typeLookup[obj.type]
  let baseArgs = t.args.map((arg) => arg).join(", ")
  // @todo: make sure this works for all input types, add validation
  let customArgs = obj.inputs.map((input) => `${input.type} ${input.name}`).join(', ')
  let args = `${baseArgs}${customArgs.length > 0 ? ', '+ customArgs: ''}`
  console.log('args are ', args)
  if(t) {
    let glslFunction =
`
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`
    console.log('function', glslFunction)
    return Object.assign({}, obj, { glsl: glslFunction})
  } else {
    console.error(`type ${obj.type} not recognized`)
  }

}

module.exports = GeneratorFactory
