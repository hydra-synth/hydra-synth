const Hydra = require('./../index.js')
const loop = require('raf-loop')
const { fugitiveGeometry } = require('./examples.js')

const HydraShaders = require('./../shader-generator.js')

function init () {
 
//   const canvas = document.createElement('canvas')
//   canvas.style.backgroundColor = "#000"
//   canvas.width = 800
//   canvas.height = 200
//   document.body.appendChild(canvas)
//   // canvas.style.width = '100%'
//   // canvas.style.height = '100%'
// //  exampleCustomCanvas()

var hydra = new Hydra({detectAudio:true})
osc().out()
fugitiveGeometry()
}

window.onload = init
