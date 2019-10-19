//const Hydra = require('./../src/index.js')

const Hydra = require('./../')
const Analyzer = require('web-audio-analyser')
const getUserMedia = require('getusermedia')
const loop = require('raf-loop')

function init () {
  var hydra = new Hydra({
    //  autoLoad: false
    enableStreamCapture: true,
    detectAudio: true
  })

  window.hydra = hydra

  var sinN = v => (Math.sin(v)+1)/2
  var cosN = v => (Math.cos(v)+1)/2

  // example custom function
  synth.setFunction('ooo', {
    type: 'src',
    inputs: [
      {
        name: 'frequency',
        type: 'float',
        default: 60.0
      },
      {
        name: 'sync',
        type: 'float',
        default: 0.1
      },
      {
        name: 'offset',
        type: 'float',
        default: 0.0
      }
    ],
    glsl: `vec4 ooo(vec2 _st, float freq, float sync, float offset){
      vec2 st = _st;
      float r = sin((st.x-offset/freq+time*sync)*freq)*0.5  + 0.5;
      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
      return vec4(r, g, b, 1.0);
    }`
  })

  ooo(10, 0.01, 1.2).blur().out()

  // Example array sequences
  shape([4, 5, 3]).out()

  // array easing
  shape([4, 3, 2].ease('easeInQuad')).out()

  // array smoothing
  shape([4, 3, 2].smooth()).out()

  // set bpm
  bpm(30)

  var x = 0
  loop((dt) => {
    hydra.tick(dt)
  }).start()

  // mouse control
  shape(3, () => mouse.y/height).out()
}

window.onload = init
