const Hydra = require('./../index.js')
const loop = require('raf-loop')

function init () {

  const canvas = document.createElement('canvas')
  canvas.style.backgroundColor = "#000"
  canvas.width = 800
  canvas.height = 200

  var ctx = canvas.getContext('2d')
  ctx.moveTo(0, 0);
  ctx.lineTo(200, 100);
  ctx.stroke();
//  document.body.appendChild(canvas)
  var hydra = new Hydra({
  //  autoLoad: false
    enableStreamCapture: true,
    detectAudio: false
  })

  window.hydra = hydra


//  hydra.s[0].init({ src: canvas})
  //hydra.src(hydra.s[0]).out()

  s0.initCam()

  shape()
//  .scrollY(0, -0.10)
  .diff(o0)
  .add(o0, 0.1)
  //.color(0.8, 0.8, 0.8)
  //.shift(-0.1, -0.10, 0, 0.2)
 /// .scrollY(0.2, 0.1)
//  .scrollX(0, -0.2)
  .scale(1.01, 1.0, 1.0, 0.5,  -0.2)
//  .scrollX(0.0, 0.2)
 // .scrollY(-0.2, -0.1)
  .out()
//   voronoi(4, 0.2).out()
// /*osc(40, 0).rotate(1.57, 0.0).thresh(0.6).out()
//
//   osc(50, 0).mult(osc(10).rotate(1.58)).out(o1)
//
//   src(o2).scale(1.2).modulateRotate(osc(200, -0.02).rotate(0.5), -0.3).out(o3)
//   src(o0).modulateRotate(o1, 2).out(o2)
//   render()*/


  a.show()

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

}

window.onload = init
