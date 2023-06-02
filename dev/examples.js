const Hydra = require('../src/index.js')


module.exports = {
  fugitiveGeometry: fugitiveGeometry,
  exampleVideo: exampleVideo,
  exampleResize: exampleResize,
  nonGlobalCanvas: nonGlobalCanvas
}

function exampleResize() {
  window.addEventListener('resize', () => {
    setResolution(window.innerWidth, window.innerHeight)
    console.log('width', width, window.innerWidth)
  })
}

// from :
// not working on updated hydra-synth
function fugitiveGeometry2() {
  s = () =>
    shape(4)
      .scrollX([-0.5, -0.2, 0.3, -0.1, -0.1].smooth(0.1).fast(0.3))
      .scrollY([0.25, -0.2, 0.3, -0.1, 0.2].smooth(0.9).fast(0.15))

  //s().out()
  // //
  solid()
    .add(gradient(3, 0.05).rotate(0.05, -0.2).posterize(2).contrast(0.6), [1, 0, 1, 0.5, 0, 0.6].smooth(0.9))
    .add(s())
    .mult(s().scale(0.8).scrollX(0.01).scrollY(-0.01).rotate(0.2, 0.06).add(gradient(3).contrast(0.6), [1, 0, 1, 0.5].smooth(0.9), 0.5).mult(src(o0).scale(0.98), () => a.fft[0] * 9)
    )
    // .diff(s().modulate(shape(500)).scale([1.7,1.2].smooth(0.9).fast(0.05)))
    // .add(gradient(2).invert(),()=>a.fft[2])
    // .mult(gradient(()=>a.fft[3]*8))
    // .blend(src((o0),()=>a.fft[1]*40))
    // .add(voronoi(()=>a.fft[1],()=>a.fft[3],()=>a.fft[0]).thresh(0.7).posterize(2,4).luma(0.9).scrollY(1,()=>a.fft[0]/30).colorama(3).thresh(()=>a.fft[1]).scale(()=>a.fft[3]*2),()=>a.fft[0]/2)
    .out()
  // //
  // speed= 1
}

function fugitiveGeometry() {
  s = () =>
    shape(4)
      .scrollX([-0.5, -0.2, 0.3, -0.1, -0.1].smooth(0.1).fast(0.3))
      .scrollY([0.25, -0.2, 0.3, -0.1, 0.2].smooth(0.9).fast(0.15))
  //
  solid()
    .add(gradient(3, 0.05).rotate(0.05, -0.2).posterize(2).contrast(0.6), [1, 0, 1, 0.5, 0, 0.6].smooth(0.9))
    .add(s())
    .mult(s().scale(0.8).scrollX(0.01).scrollY(-0.01).rotate(0.2, 0.06).add(gradient(3).contrast(0.6), [1, 0, 1, 0.5].smooth(0.9), 0.5).mult(src(o0).scale(0.98), () => a.fft[0] * 9)
    )
    .diff(s().modulate(shape(500)).scale([1.7, 1.2].smooth(0.9).fast(0.05)))
    .add(gradient(2).invert(), () => a.fft[2])
    .mult(gradient(() => a.fft[3] * 8))
    .blend(src((o0), () => a.fft[1] * 40))
    .add(voronoi(() => a.fft[1], () => a.fft[3], () => a.fft[0]).thresh(0.7).posterize(2, 4).luma(0.9).scrollY(1, () => a.fft[0] / 30).colorama(3).thresh(() => a.fft[1]).scale(() => a.fft[3] * 2), () => a.fft[0] / 2)
    .out()
  //
  speed = 1
  a.setSmooth(0.96)
}
function exampleMultipleMasks() {
  setFunction({
    name: 'mask2',
    type: 'combine',
    inputs: [
    ],
    glsl:
      `   float a = _luminance(_c1.rgb);
     return vec4(_c0.rgb*a, a*_c0.a);`
  })

  gradient().layer(osc().luma().mask(noise(3))).out()
  gradient().layer(osc().luma().mask2(noise(3))).out(o1)
  render()
}
function exampleMultipleCanvases(num = 2) {
  for (var i = 0; i < num; i++) {
    nonGlobalCanvas()
  }
}

function nonGlobalCanvas() {
  const div = document.createElement('div')
  const canvas = document.createElement('canvas')
  canvas.style.backgroundColor = "#000"
  canvas.width = 800
  canvas.height = 200
  div.appendChild(canvas)
  document.body.appendChild(div)

  // canvas.style.width = '100%'
  // canvas.style.height = '100%'
  //  exampleCustomCanvas()
  const hydra = new Hydra({
    //detectAudio:false, 
    autoLoop: false,
    canvas: canvas,
    makeGlobal: false
  }).synth
  const { osc, o0, s0, src, noise } = hydra
  osc().rotate().blend(noise().repeat(), 0.99).out()
  window.c1 = hydra
  setInterval(() => {
    hydra.tick(1000)
  }, 1000)
}

function exampleLoadScript() {
  (async () => {
    await loadScript("https://unpkg.com/tone")
    console.log('loaded script!!')
  })()
}

function exampleCamera() {
  s0.initCam()
  src(s0).out()
}

function exampleVideo() {
  s0.initVideo("https://media.giphy.com/media/26ufplp8yheSKUE00/giphy.mp4", { flipY: false })
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
      ], glsl: `
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
    ], glsl: `
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

  s0.init({ src: canvas })
}


function exampleSmoothing() {
  var shapes = [
    shape(4)
      .scale(1, 0.5, [0.5, 1, 2])
      .scrollX(0.3),
    shape(4)
      .scale(1, 0.5, [0.5, 1, 2].smooth(0.5))
      .scrollX(0.0),
    shape(4)
      .scale(1, 0.5, [0.5, 1, 2].smooth())
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