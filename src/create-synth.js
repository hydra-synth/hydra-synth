const glslTransforms = require('./glsl/composable-glsl-functions.js')
const glslSource = require('./glsl-source.js')

window.glslSource = glslSource

const renderpassFunctions = require('./glsl/renderpass-functions.js')

var synth = {
  init: (defaultOutput, extendTransforms = (x => x)) => {
      synth.defaultOutput = defaultOutput
      Array.prototype.fast = function(speed) {
        this.speed = speed
        return this
      }
      var functions = {}

      const addTransforms = (transforms) => 
        Object.entries(transforms).forEach(([method, transform]) => {
          functions[method] = transform
        })
      
      addTransforms(glslTransforms)
      addTransforms(renderpassFunctions)

      if (typeof extendTransforms === 'function') {
        functions = extendTransforms(functions)
      } else if (Array.isArray(extendTransforms)) {
        extendTransforms.forEach(transform => functions[transform.name] = transform)
      } else if (typeof extendTransforms === 'object') {
        addTransforms(extendTransforms)
      }

      Object.entries(functions).forEach(([method, transform]) => {
        functions[method] = synth.setFunction(method, transform)
      })

      return functions
 },

  glslTransforms: {},

  setFunction: (method, transform) => {
    synth.glslTransforms[method] = transform
    if(transform.type === 'src'){
      var func = (...args) => {
    //    var obj = Object.create(glslSource.prototype)
       var obj = new glslSource({ name: method, transform: transform, userArgs: args, defaultOutput: synth.defaultOutput, synth: synth })
        return obj
      }
      // to do: make not global
      window[method] = func
      return func
    } else  {
      glslSource.prototype[method] = function (...args) {
      //  this.addTransform(this, {name: method, transform: transform, args: args})
        this.transforms.push({name: method, transform: transform, userArgs: args})
        return this
      }
    }


  }
}

module.exports = synth
