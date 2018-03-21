const Hydra = require('./../index.js')


function init () {
  canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 200
  document.body.appendChild(canvas)
  var hydra = new Hydra({ canvas: canvas})
  osc().out(o0)


}

window.onload = init
