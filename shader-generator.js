const Generator = require('./src/generator-factory.js')
const Sandbox = require('./src/eval-sandbox.js')

class ShaderGenerator {
  constructor(opts) {
    var self = this
    self.renderer = {}
    var defaultOpts = {
      defaultUniforms: {
        time: 0,
        resolution: [1280, 720]
      }
    }
    var generatorOpts = Object.assign({}, defaultOpts, opts)
    generatorOpts.changeListener = ({type, method, synth}) => {
        if (type === 'add') {
          self.renderer[method] = synth.generators[method]
        } else if (type === 'remove') {
        }
    }
    generatorOpts.defaultOutput = {
      render: (pass) => self.generatedCode = pass[0]
    }
    this.generator = new Generator(generatorOpts)
    this.sandbox = new Sandbox(this.renderer, false)
  }

  eval(code) {
    this.sandbox.eval(code)
    return this.generatedCode
  }
}

module.exports = ShaderGenerator
