import Hydra from './../src/hydra-synth.js'
// import { fugitiveGeometry, exampleVideo, exampleResize, nonGlobalCanvas } from './examples.js'

// console.log('HYDRA', Hydra)
// const HydraShaders = require('./../shader-generator.js')

function init () {

//   const canvas = document.createElement('canvas')
//   canvas.style.backgroundColor = "#000"
//   canvas.width = 800
//   canvas.height = 200
//   document.body.appendChild(canvas)
//   // canvas.style.width = '100%'
//   // canvas.style.height = '100%'
// //  exampleCustomCanvas()



window.hydra = new Hydra({detectAudio:false, makeGlobal: true, useWGSL: true})

// Wait for WGSL to be ready before running code
hydra.wgslPromise.then(async () => {
  // Test vertex shaders with multiple sprite levels

  // Level 0: background (clears)
  osc(10, 0.1, 1.5).out(o0)

  // Level 1: triangle with noise texture
  noise(10, 0.3).out(o0, tri(0.4).rotate(() => time * 0.3), { level: 1, blend: 'add' })

  // Level 2: hexagon with gradient
  gradient(1).colorama(0.5).out(o0, poly(6, 0.25).offset(0.4, 0.2), { level: 2, blend: 'screen' })

  // Level 3: ring with osc pattern and animated scale
  osc(40, 0.05).kaleid(6).out(o0, ring(0.3, 0.2, -0.3, -0.2).scale(() => 0.8 + Math.sin(time) * 0.2), { level: 3, blend: 'add' })

  console.log('Sprites:', [...o0.sprites.keys()])
})
// console.log(hydra)
// window.hydra = hydra
// // //osc().out()
// exampleVideo()
// exampleResize()
//nonGlobalCanvas()

//s0.initVideo("https://media.giphy.com/media/26ufplp8yheSKUE00/giphy.mp4", {})
//src(s0).repeat().out()
}

window.onload = init
