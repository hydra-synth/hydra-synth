const glslTransforms = require('./glsl/composable-glsl-functions.js')
const GlslSource = require('./glsl-source.js')

const renderpassFunctions = require('./glsl/renderpass-functions.js')

Array.prototype.fast = function (speed) {
  this.speed = speed
  return this
}

class Synth {
  constructor (defaultOutput, changeListener = (() => {})) {
    this.defaultOutput = defaultOutput
    this.changeListener = changeListener
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

    var functions = []
    Object.keys(glslTransforms).forEach((method) => {
      const transform = glslTransforms[method]
      functions[method] = this.setFunction(method, transform)
    })
    Object.keys(renderpassFunctions).forEach((method) => {
      const transform = renderpassFunctions[method]
      functions[method] = this.setFunction(method, transform)
    })
    return functions
 }

 setFunction (method, transform) {
    this.glslTransforms[method] = transform
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
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
}

module.exports = Synth
