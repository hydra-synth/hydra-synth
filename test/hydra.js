const {should, expect, assert} = require('chai')
const rewire = require('rewire')
const {prepareForHydra} = require('./lib/util')

describe ('HydraSynth', () => {
  let HydraSynth
  let dom
  let canvas

  beforeEach(() => {
    const {dom: new_dom, canvas: new_canvas} = prepareForHydra()
    
    dom = new_dom
    canvas = new_canvas

    HydraSynth = require('../index')

    HydraSynth.prototype._initRegl = function () {
      this.regl = {
        buffer: () => {},
        prop: () => {},
        texture: () => {},
        framebuffer: () => {}
      },
      this.renderFbo = () => {},
      this.renderAll = () => {}
    }

  })

  it ('Sets up basic infrastructure', () => {
    const hydra = new HydraSynth({autoLoop: false, makeGlobal: false, canvas})

    expect(hydra)
      .to.be.an('object')
      .and.to.include.keys(['s', 'a', 'audio', 'bpm'])

    expect(hydra.bpm)
      .to.be.a('number')
      .and.to.be.equal(60)
  })

  describe ('makeGlobal', () => {
    it('Does not create global variables if set to false', () => {
      const prev_keys = Object.keys(global.window)

      const hydra = new HydraSynth({autoLoop: false, makeGlobal: false, canvas})

      const new_keys = Object.keys(global.window).filter(x => prev_keys.indexOf(x) < 0)

      expect(new_keys).to.have.lengthOf(0)
    })

    it('Creates expected global variables if set to true', () => {
      const transforms = require('../src/glsl/composable-glsl-functions')

      const prev_keys = Object.keys(global.window)

      const hydra = new HydraSynth({autoLoop: false, makeGlobal: true, canvas})

      const new_keys = Object.keys(global.window).filter(x => prev_keys.indexOf(x) < 0)

      expect(new_keys).to.be.an('array').and.to.include.members([
        ...Object.entries(transforms).filter(([, transform]) => transform.type === 'src').map(([name]) => name),
        ...Array(hydra.s.length).fill(1).map((_, i) => `s${i}`),
        ...Array(hydra.audio.bins.length).fill(1).map((_, i) => `a${i}`),
        'bpm', 'mouse', 'time', 'a', 'synth', 'render', 'screencap', 'vidRecorder'
      ])
    })
  })
})
