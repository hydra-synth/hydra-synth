import Generator from './generator-factory.js'
import Sandbox from './eval-sandbox.js'

const baseUniforms = ['s0', 's1', 's2', 's3', 'o0', 'o1', 'o2'] // names of uniforms usually used in hydra. These can be customized

class ShaderGenerator {
  constructor({ defaultUniforms = {time: 0, resolution: [1280, 720]}, customUniforms = baseUniforms, extendTransforms = []} = {}) {
    var self = this
    self.renderer = {}

    var generatorOpts = { defaultUniforms, extendTransforms }
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

    this.initialCode = `
      ${customUniforms.map((name) => `const ${name} = () => {}`).join(';')}
    `
    console.log(this.initialCode)
  }

  eval(code) {
    this.sandbox.eval(`${this.initialCode}
          ${code}`)
    return this.generatedCode
  }
}

module.exports = ShaderGenerator
