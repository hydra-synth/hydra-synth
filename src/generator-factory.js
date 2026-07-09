import GlslSource from './glsl-source.js'
import glslFunctions from './glsl/glsl-functions.js'

class GeneratorFactory {
  constructor ({
      defaultUniforms,
      defaultOutput,
      extendTransforms = [],
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
    const functions = glslFunctions()
    this.glslTransforms = {}
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({type: 'remove', synth: this, method})
      return prev
    }, {})

    this.sourceClass = (() => {
      return class extends GlslSource {
      }
    })()

    

    // add user definied transforms
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms)
    } else if (typeof this.extendTransforms === 'object' && this.extendTransforms.type) {
      functions.push(this.extendTransforms)
    }

    return functions.map((transform) => this.setFunction(transform))
 }

 _addMethod (method, transform) {
    const self = this
    this.glslTransforms[method] = transform
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: self
      })
      markAsHydraFunction(func, method)
      this.generators[method] = func
      this.changeListener({type: 'add', synth: this, method})
      return func
    } else  {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({name: method, transform: transform, userArgs: args, synth: self})
        return this
      }
      markAsHydraFunction(this.sourceClass.prototype[method], method)
    }
    return undefined
  }

  setFunction(obj) {
    var processedGlsl = processGlsl(obj)
    if(processedGlsl) this._addMethod(obj.name, processedGlsl)
  }
}

// tags generators and transform methods so that format-arguments.js can
// detect when one is passed as an argument without being called (issue #150)
function markAsHydraFunction (func, name) {
  func.isHydraFunction = true
  func.hydraFunctionName = name
}

const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: [{ type: 'vec2', name: '_st' }]
  },
  'coord': {
    returnType: 'vec2',
    args: [{ type: 'vec2', name: '_st'}]
  },
  'color': {
    returnType: 'vec4',
    args: [{ type: 'vec4', name: '_c0'}]
  },
  'combine': {
    returnType: 'vec4',
    args: [
      { type: 'vec4', name: '_c0'},
      { type: 'vec4', name: '_c1'}
    ]
  },
  'combineCoord': {
    returnType: 'vec2',
    args: [
      { type: 'vec2', name: '_st'},
      { type: 'vec4', name: '_c0'},
    ]
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
  if(t) {
    let inputs = t.args.concat(obj.inputs);
    let args = inputs.map((input) => `${input.type} ${input.name}`).join(', ')
    // console.log('args are ', args)

    let glslFunction =
`
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`
    // First input gets handled specially by generator
    obj.inputs = inputs.slice(1);

    return Object.assign({}, obj, { glsl: glslFunction})
  } else {
    console.warn(`type ${obj.type} not recognized`, obj, typeLookup)
  }

}

export default GeneratorFactory
