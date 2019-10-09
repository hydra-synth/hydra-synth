//const Hydra = require('./../src/index.js')

const Hydra = require('./../')
const Analyzer = require('web-audio-analyser')
const getUserMedia = require('getusermedia')
const loop = require('raf-loop')

function init () {

  // const canvas = document.createElement('canvas')
  // canvas.style.backgroundColor = "#000"
  // canvas.width = 800
  // canvas.height = 200
  //
  // var ctx = canvas.getContext('2d')
  // ctx.moveTo(0, 0);
  // ctx.lineTo(200, 100);
  // ctx.stroke();
//  document.body.appendChild(canvas)
  var hydra = new Hydra({
  //  autoLoad: false
    enableStreamCapture: true,
    detectAudio: true
  })

  window.hydra = hydra


//  hydra.s[0].init({ src: canvas})
  //hydra.src(hydra.s[0]).out()

// voronoi(4, 0.2).out()
 //s0.initCam()
//src(s0).sharpen(10, 1).out()
//src(s0).dither().repeat().sharpen().out()
// shape(3, 0.1)
// //  .scrollY(0, -0.10)
//   .diff(o0)
// //  .add(o0, 1)
//   //.color(0.8, 0.8, 0.8)
//   //.shift(-0.1, -0.10, 0, 0.2)
//   .scrollY(0.2, 0.1)
//   .scale(1.001)
//   .blur(2, 2)
//   .sharpen(10.0, 1.0, 0.4)
//   .scrollY(-0.2, -0.1)
//   .out()
//
//   src(o0).scrollY(0.1).scrollX(0.1).scale(20).out(o1)

var sinN = v => (Math.sin(v)+1)/2
var cosN = v => (Math.cos(v)+1)/2


// osc(() => sinN(time*0.1)*4+10, 0.01, 1.1)
// 	.modulate(noise(1, .1))
// 	.kaleid(() => (sinN(time/1.5)**0.5)*10+3)
// 	.color(() => sinN(time)*0.4 + 2.4,0.91,0.39)
// 	.modulate(o0, () => (Math.sin(time * .3)+1)/20+0.05)
// 	.rotate(0, 0.1)
// 	.scale(1.1)
// 	.modulate(noise(3, .21))
//   	.out(o0)

  synth.setFunction('ooo', {
        type: 'src',
        inputs: [
          {
            name: 'frequency',
            type: 'float',
            default: 60.0
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
        ],
        glsl: `vec4 ooo(vec2 _st, float freq, float sync, float offset){
                vec2 st = _st;
                float r = sin((st.x-offset/freq+time*sync)*freq)*0.5  + 0.5;
                float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
                float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
                return vec4(r, g, b, 1.0);
              }`
      })

ooo(10, 0.01, 1.2).blur().out()

  //render(o0)
//s0.initCam()
//src(s0).scrollX().out()
// osc(10, 0.01, 0.8)
// //  .saturate(0)
// //  .scale(1.001)
//   .blend(o0, 0.8)
//   .sharpen(1.0)
//   .scale(1.001)
//  .modulateHue(o0, 1)
// // .saturate(4)
// //.colorama(0.0001)
//   .out()

//osc().sharpen().out()
//  src(s0).sharpen().repeat().out()
//osc().thresh().blend(osc().thresh().rotate(0, 0.1)).sharpen().out()
//  test()

/*osc(40, 0).rotate(1.57, 0.0).thresh(0.6).out()

  osc(50, 0).mult(osc(10).rotate(1.58)).out(o1)

  src(o2).scale(1.2).modulateRotate(osc(200, -0.02).rotate(0.5), -0.3).out(o3)
  src(o0).modulateRotate(o1, 2).out(o2)
  render()*/


  //a.show()

  var x = 0
  loop((dt) => {
    //console.log('looping')
    // x++
    // ctx.moveTo(x, 0);
    // ctx.lineTo(200, 100);
    // ctx.stroke();
    // ctx.fillStyle = 'green';
    // ctx.fillRect(10, 10, 100, 100);
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
