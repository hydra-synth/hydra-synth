
const Hydra = require('./../')
// import Hydra from './../src/index.js'
const loop = require('raf-loop')
const { fugitiveGeometry, exampleVideo, exampleResize, nonGlobalCanvas } = require('./examples.js')

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



var hydra = new Hydra({detectAudio:false, makeGlobal: true})

osc().out()
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
