const Hydra = require('./../index.js')
const loop = require('raf-loop')

function init () {
  var hydra = new Hydra()
 //  const canvas = document.createElement('canvas')
 //  canvas.style.backgroundColor = "#000"
 //  canvas.width = 800
 //  canvas.height = 200
 //
 //  canvas.style.width = '100%'
 //  canvas.style.height = '100%'
 //
 //  // var ctx = canvas.getContext('2d')
 //  // ctx.moveTo(0, 0);
 //  // ctx.lineTo(200, 100);
 //  // ctx.stroke();
 // document.body.appendChild(canvas)
 //  var hydra = new Hydra({
 //  //  autoLoad: false
 //    canvas: canvas,
 //    enableStreamCapture: true,
 //    detectAudio: true,
 //    makeGlobal: false
 //  })
 //
 //  window.hydra = hydra
 //
 //  var sinN = v => (Math.sin(v)+1)/2
 //  var cosN = v => (Math.cos(v)+1)/2
 //
 //  // example custom function
 //  hydra.synth.setFunction('ooo', {
 //    type: 'src',
 //    inputs: [
 //      {
 //        name: 'frequency',
 //        type: 'float',
 //        default: 60.0
 //      },
 //      {
 //        name: 'sync',
 //        type: 'float',
 //        default: 0.1
 //      },
 //      {
 //        name: 'offset',
 //        type: 'float',
 //        default: 0.0
 //      }
 //    ],
 //    glsl: `vec4 ooo(vec2 _st, float freq, float sync, float offset){
 //      vec2 st = _st;
 //      float r = sin((st.x-offset/freq+time*sync)*freq)*0.5  + 0.5;
 //      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
 //      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
 //      return vec4(r, g, b, 1.0);
 //    }`
 //  })
 //
 //  // ooo(10, 0.01, 1.2).blur().out()
 //  //
 //  // // Example array sequences
 //  // shape([4, 5, 3]).out()
 //  //
 //  // // array easing
 //  // shape([4, 3, 2].ease('easeInQuad')).out()
 //  //
 //  // // array smoothing
 //  // shape([4, 3, 2].smooth()).out()
 //
 //  osc().out()
 //
 //  // set bpm
 //  //hydra.bpm(30)
 //
 //  var x = 0
 //  loop((dt) => {
 //    hydra.tick(dt)
 //  }).start()

  osc(5).out()
}

window.onload = init
