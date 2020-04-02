const Hydra = require('./../index.js')
const loop = require('raf-loop')

//const shader = require('./../index.js').shaderGenerator

function init () {
  var hydra = new Hydra()
  window.hydra = hydra

  exampleAddFunction(hydra)
  ///var generator = new shader()

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

//osc(5).out()
}

function exampleEasingFunctions() {
  //  //
  //  // // Example array sequences
  //  // shape([4, 5, 3]).out()
  //  //
  //  // // array easing
  //  // shape([4, 3, 2].ease('easeInQuad')).out()
  //  //
  //  // // array smoothing
  //  // shape([4, 3, 2].smooth()).out()
}


function exampleAddFunction(hydra) {
 // example custom function
 setFunction({
 name: 'myOsc', // name that will be used to access function as well as within glsl
 type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
 inputs: [
   {
     name: 'freq',
     type: 'float', // 'float'   //, 'texture', 'vec4'
     default: 0.2
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
 ],    glsl: `
    vec2 st = _st;
   float r = sin((st.x-offset*20./freq-time*sync)*freq)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
   float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);
  `})

  myOsc(10, 0.2, 0.8).out()
  //
  //  // ooo(10, 0.01, 1.2).blur().out()
}


window.onload = init
