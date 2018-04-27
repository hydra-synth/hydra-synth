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
  //  autoLoad: false
  })

  window.hydra = hydra


  hydra.s[0].init({ src: canvas})
  //hydra.src(hydra.s[0]).out()

  osc().posterize().out()
  var x = 0
  loop((dt) => {
    x++
    ctx.moveTo(x, 0);
    ctx.lineTo(200, 100);
    ctx.stroke();
    ctx.fillStyle = 'green';
    ctx.fillRect(10, 10, 100, 100);
    hydra.tick(dt)
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
