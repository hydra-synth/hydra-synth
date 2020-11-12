const Hydra = require('./../index.js')
const loop = require('raf-loop')

const HydraShaders = require('./../shader-generator.js')

function init () {
///  exampleNonGlobal()

//  exampleExtendTransforms()
  // const shader = new HydraShaders()

  // let x = shader.eval('osc().out()')
  // console.log(x.frag, x.uniforms)
  //
  // let y = shader.eval(`
  //     let myFunc = () => 4
  //     osc(myFunc).out()
  // `)
  // console.log(y.frag, y.uniforms)
  //
  // let z = shader.eval(`
  //     src(s0).out()
  // `)
  // console.log(z.frag, z.uniforms)
 var hydra = new Hydra({detectAudio:false})
//  window.hydra = hydra

  shape().scrollY(0, 0.2, 0.1, 0.1).out()

  exampleVideo()

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

function exampleVideo() {
  s0.initVideo("https://media.giphy.com/media/AS9LIFttYzkc0/giphy.mp4")
  src(s0).out()
}

function exampleNonGlobal() {
    var hydra = new Hydra({ makeGlobal: false })
    hydra.synth.fps = 10
    hydra.synth.osc().out()
    window.hydra = hydra
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
