const Hydra = require('./../index.js')


function init () {
  canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200
  document.body.appendChild(canvas)
  var hydra = new Hydra({
    canvas: canvas,
    autoLoop: false
  })
  
  window.hydra = hydra
  osc().out()
  // hydra.osc().out(hydra.o[0])
  // hydra.osc().rotate(0.4).out(hydra.o[1])
  // hydra.render()

}

window.onload = init
