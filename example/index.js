const Hydra = require('./../index.js')
const Analyzer = require('web-audio-analyser')
const getUserMedia = require('getusermedia')
const loop = require('raf-loop')

function init () {

  canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200

  var ctx = canvas.getContext('2d')
  ctx.moveTo(0, 0);
  ctx.lineTo(200, 100);
  ctx.stroke();
//  document.body.appendChild(canvas)
  var hydra = new Hydra({

  })

  window.hydra = hydra


  s0.init({ src: canvas})
  src(s0).out()
  var x = 0
  loop(() => {
    x++
    ctx.moveTo(x, 0);
    ctx.lineTo(200, 100);
    ctx.stroke();
  }).start()
  // s0.initCam(1)
  //
  // getUserMedia({audio: true, video: false}, function (err, stream) {
  //   console.log('audio', stream)
  //   if(err) {
  //     console.log(err)
  //   } else {
  //     window.audio = Analyzer(stream, {audible: false})
  //     console.log(window.audio)
  //   }
  // })
  // hydra.osc().out(hydra.o[0])
  // hydra.osc().rotate(0.4).out(hydra.o[1])
  // hydra.render()

}

window.onload = init
