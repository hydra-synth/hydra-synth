const Hydra = require('./../index.js')
const Analyzer = require('web-audio-analyser')
const getUserMedia = require('getusermedia')
function init () {

  canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200
//  document.body.appendChild(canvas)
  var hydra = new Hydra({

  })

  window.hydra = hydra
  osc().out()

  s0.initCam(1)

  getUserMedia({audio: true, video: false}, function (err, stream) {
    console.log('audio', stream)
    if(err) {
      console.log(err)
    } else {
      window.audio = Analyzer(stream, {audible: false})
      console.log(window.audio)
    }
  })
  // hydra.osc().out(hydra.o[0])
  // hydra.osc().rotate(0.4).out(hydra.o[1])
  // hydra.render()

}

window.onload = init
