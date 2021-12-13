const Hydra = require('./../index.js')
const loop = require('raf-loop')

const HydraShaders = require('./../shader-generator.js')

function init () {
 
  const canvas = document.createElement('canvas')
  canvas.style.backgroundColor = "#000"
  canvas.width = 800
  canvas.height = 200
  document.body.appendChild(canvas)

  // canvas.style.width = '100%'
  // canvas.style.height = '100%'
//  exampleCustomCanvas()
 var hydra = new Hydra({detectAudio:false, canvas: canvas})
 //exampleLoadScript()

//  window.hydra = hydra

  shape().scroll(() => mouse.x/width, () => mouse.y/height).out()

  // gradient(0.4).out()
//  voronoi().out()
  exampleCamera()

  const debugLog = document.createElement('pre')
   const frag = noise().glsl()[0].frag
   debugLog.innerText = frag
  document.body.appendChild(debugLog)
  //exampleSmoothstep()

  // shape().modulateScrollX(osc()).out()

//  exampleGetGLSL()
  // window.update = (dt) => draw.draw(time)

  // shape(3, f0(), 0.5).out()
//
//   exampleAddFunction(hydra)
// //  exampleScreen()
//
// exampleCustomCanvas()
// exampleSmoothing()
  ///var generator = new shader()


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

function exampleLoadScript() {
(async() => {
  await loadScript("https://unpkg.com/tone")
  console.log('loaded script!!')
})()
}

function exampleCamera() {
  s0.initCam()
  src(s0).out()
}

function exampleVideo() {
  s0.initVideo("https://media.giphy.com/media/26ufplp8yheSKUE00/giphy.mp4")
  src(s0).out()
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

// fixing smoothstep issue so that 0 is not passed as a parameter
function exampleSmoothstep() {
  shape(4, 0.3, 0.01).out()
  shape(4, 0.5, 0).out()
  osc(89, 0.01, 1.8).luma(0.5, 0).out()
  osc(89, 0.01, 1.8).thresh(0.5, 0).out()
}

function exampleVideo() {
  s0.initVideo("https://media.giphy.com/media/AS9LIFttYzkc0/giphy.mp4")
  src(s0).out()
}

function exampleNonGlobal() {
    const hydra = new Hydra({ makeGlobal: false, detectAudio: false })
    console.log('instance', hydra)
    const h = hydra.synth
    h.osc().diff(h.shape()).out()
    h.gradient().out(h.o1)
    h.render()

    const h2 = new Hydra({ makeGlobal: false, detectAudio: false }).synth
    h2.shape(4).diff(h2.osc(2, 0.1, 1.2)).out()
  }

function exampleExtendTransforms() {
  var hydra = new Hydra({
    extendTransforms: {
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
       `}
    })
    myOsc(10, 0.2, 0.8).out()

}

function exampleImage() {
  s0.initImage("https://upload.wikimedia.org/wikipedia/commons/2/25/Hydra-Foto.jpg")
 src(s0).out()
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

function exampleScreen() {
  s0.initScreen()
  //src(s0).out()
}

function exampleGetGLSL() {
  src(s0).blend(o0).glsl()
}

function exampleCustomCanvas() {
   const canvas = document.createElement('canvas')
   canvas.style.backgroundColor = "#000"
   canvas.width = 800
   canvas.height = 200

   canvas.style.width = '100%'
   canvas.style.height = '100%'

//canvas.style.imageRe

   var ctx = canvas.getContext('2d')
   ctx.moveTo(0, 0);
   ctx.lineTo(200, 100);
   ctx.stroke();

   s0.init({src: canvas})
}


function exampleSmoothing() {
  var shapes = [
   shape(4)
     .scale(1,0.5,[0.5, 1,2])
     .scrollX(0.3),
   shape(4)
     .scale(1,0.5,[0.5, 1,2].smooth(0.5))
     .scrollX(0.0),
   shape(4)
     .scale(1,0.5,[0.5, 1,2].smooth())
     .scrollX(-0.3),
 ]

 solid()
   .add(shapes[0])
   .add(shapes[1])
   .add(shapes[2])
   .out(o0)
}

function exampleSetResolution() {
  setResolution(20, 20)
}

window.onload = init
