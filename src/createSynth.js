const glslTransforms = require('./composable-glsl-functions.js')
const glslSource = require('./glslSource.js')

window.glslSource = glslSource

const renderPassFunctions = require('./renderpass-functions.js')

var synth = {
  init: (defaultOutput) => {
      synth.defaultOutput = defaultOutput
      Array.prototype.fast = function(speed) {
      //  console.log("array fast", speed, this)
        this.speed = speed
        return this
      }
      var functions = []
      Object.keys(glslTransforms).forEach((method) => {
        const transform = glslTransforms[method]
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
       var obj = new glslSource({
         name: method, transform: transform, userArgs: args, defaultOutput: synth.defaultOutput, synth: synth
       })
        return obj
      }
      // to do: make not global
      window[method] = func
      return func
    } else  {
      glslSource.prototype[method] = function (...args) {
        console.log('this', method)
      //  this.addTransform(this, {name: method, transform: transform, args: args})
        this.transforms.push({name: method, transform: transform, userArgs: args})
        return this
      }
    }


  }
}

module.exports = synth
