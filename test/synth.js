
const {DummyOutput} = require('./lib/util')

const {should, expect, assert} = require('chai')
const rewire = require('rewire')
const sinon = require('sinon')
const {JSDOM} = require('jsdom')

const Synth = require('../src/create-synth')

describe('Synth', () => {
  it('Sets the seq prototype on Array', () => {
    expect(Array.prototype).to.include.keys('fast')

    expect(Array.prototype.fast).to.be.a('function')
  })

  it('Contains all transforms', () => {
    const transforms = require('../src/glsl/composable-glsl-functions')
    const srcNames = Object.entries(transforms).filter(([, transform]) => transform.type === 'src').map(([name]) => name)

    const events = []
    const dummyOutput = new DummyOutput()
    const synth = new Synth(dummyOutput, {}, (e) => events.push(e))

    expect(synth.generators)
      .to.be.an('object')
      .and.to.have.all.keys(srcNames)

    expect(events.filter(({type}) => type === 'add').map(({method}) => method))
      .to.have.members(srcNames)
  })

  it('Can be extended', () => {
    const transforms = require('../src/glsl/composable-glsl-functions')
    const srcNames = Object.entries(transforms).filter(([, transform]) => transform.type === 'src').map(([name]) => name)

    const events = []
    const dummyOutput = new DummyOutput()
    const synth = new Synth(dummyOutput, 'invalid', (e) => events.push(e))

    expect(synth.generators)
      .to.be.an('object')
      .and.to.have.all.keys(srcNames)

    expect(events.filter(({type}) => type === 'add').map(({method}) => method))
      .to.include.members(srcNames);

    [{
      foo: {
        type: 'src',
        inputs: [],
        glsl: '<foo>'
      }
    },
    [
      {
        name: 'foo',
        type: 'src',
        inputs: [],
        glsl: '<foo>'
      }
    ]].forEach((ext, i) => {
      synth.extendTransforms = ext

      events.length = 0
      synth.init()

      expect(events.filter(({type}) => type === 'remove').map(({method}) => method))
        .to.include.all.members(srcNames)

      expect(events.filter(({type}) => type === 'add').map(({method}) => method))
        .to.have.all.members([
          ...srcNames,
          'foo'
        ])
    })

    synth.setFunction('bar', {
      type: 'src',
      inputs: [],
      glsl: '<bar>'
    })

    expect(synth.generators).to.include.keys('bar')



  })

  it('Can create function chains', () => {
    const dummyOutput = new DummyOutput()
    const synth = new Synth(dummyOutput)

    assert.doesNotThrow(() => {
      synth.generators.solid().repeatX().out(dummyOutput)
    })
  })

  it('Sets up uniforms properly', () => {
    const dummyOutput = new DummyOutput()
    const synth = new Synth(dummyOutput)

    assert.doesNotThrow(() => {
      synth.generators.solid(0, () => 1, 2).repeatX(() => 3).out(dummyOutput)
    })

    expect(dummyOutput.passes).to.have.a.lengthOf(1)
    expect(dummyOutput.passes[0]).to.have.a.lengthOf(1)

    const pass0 = dummyOutput.passes[0][0]
    expect(pass0).to.include.keys(['uniforms', 'frag'])
    expect(pass0.uniforms).to.be.an('object')

    expect(Object.keys(pass0.uniforms)).to.have.a.lengthOf(2)

  })

})

