const glslTransforms = require('./glsl/composable-glsl-functions.js')
const GlslSource = require('./glsl-source.js')

const renderpassFunctions = require('./glsl/renderpass-functions.js')

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
    addTransforms(renderpassFunctions)

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
}

module.exports = GeneratorFactory
