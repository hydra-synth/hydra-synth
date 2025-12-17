import Hydra from "./../src/hydra-synth.js";

//const { fugitiveGeometry, exampleVideo, exampleResize, nonGlobalCanvas } = import('./examples.js')

// console.log('HYDRA', Hydra)

async function init () {

  const canvas = document.createElement('canvas')
  canvas.style.backgroundColor = "#000"
  document.body.appendChild(canvas);
//  canvas.width = 720
//  canvas.height = 480
  document.body.appendChild(canvas)

	canvas.style.width = '100%'
	canvas.style.height = '100%'
// //  exampleCustomCanvas()



//var hydra = new Hydra({canvas: canvas, detectAudio:true, makeGlobal: true, genWGSL: true}) // true false
//if (hydra.wgslPromise) await hydra.wgslPromise;

let hydra;
let hydra2;

let wgsl = false;

// Run in foreground 
	 hydra = new Hydra({canvas: canvas, detectAudio:true, makeGlobal: true, useWGSL: wgsl}) // true false
	 if (wgsl) await hydra.wgslPromise;

function fitCanvas() {
	 canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;
   hydra.setResolution(canvas.width, canvas.height);
}

window.addEventListener('resize', fitCanvas, false);
fitCanvas();  // Initial sizing

// *******************************************
// test code follows:
/*
// 3D OBJ Model Test - Spinning head
loadObj('dev/headsSortedRandom.obj', { swapYZ: true }).then(head => {
  osc(10, 0.1, 1.5)
    .color(0.9, 0.5, 0.3)
    .out(o0, head.scale(0.8).rotateY(() => time).rotateX(() => time * 0.3).perspective(45))
})

*/
// 3D GLB Model Test - With embedded texture extraction
//const modelPath = 'dev/assets/AnimalKit/Cat.glb'
//const modelPath = 'dev/assets/AnimatedWomenPack/Woman.glb'
const modelPath = 'dev/assets/NormalTangentMirrorTest.glb'  // Has TANGENT data!

// Drag-to-rotate state (3 axes) + zoom
let rotX = 0, rotY = 0, rotZ = 0
let zoom = 0.8
let dragging = false
let lastX = 0, lastY = 0

canvas.addEventListener('mousedown', (e) => {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
})
canvas.addEventListener('mouseup', () => dragging = false)
canvas.addEventListener('mouseleave', () => dragging = false)
canvas.addEventListener('mousemove', (e) => {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  if (e.shiftKey) {
    rotZ += dx * 0.01
  } else {
    rotY += dx * 0.01
    rotX += dy * 0.01
  }
  lastX = e.clientX
  lastY = e.clientY
})
canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  zoom *= e.deltaY > 0 ? 0.9 : 1.1  // scroll down = smaller, up = bigger
  zoom = Math.max(0.1, Math.min(3, zoom))  // clamp
}, { passive: false })

// Test v proxy - vertex data in fragment shader
console.log('Testing v proxy:', v)
console.log('v.depth:', v.depth)
console.log('v.normal:', v.normal)
console.log('v.normal.z:', v.normal.z)

// Simple test: use v.depth to modulate the oscillator frequency
// v.depth is 1.0 for fullscreen, so osc(10 * 1.0) = osc(10)
//osc(10).mult(solid(v.depth, 0, 0)).out()


  // Test animation with Woman.glb - cycle through all animations
  loadGlb('dev/assets/AnimatedWomenPack/WomanInDress.glb').then(model => {
    console.log('Woman model loaded:', model)
    console.log('Has joints:', model.joints ? model.joints.length / 4 + ' vertices with skin weights' : 'none')

    const animations = model.getAnimations()
    console.log('Available animations:', animations)

    let currentAnimIndex = 0
    let animStartTime = 0

    // Create overlay to show animation name
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;top:20px;left:20px;color:white;font:24px monospace;text-shadow:2px 2px 4px black;z-index:1000'
    document.body.appendChild(overlay)

    // Time function that cycles through animations
    const cyclingTime = () => {
      const currentAnim = animations[currentAnimIndex]
      const elapsed = time - animStartTime

      // Show current animation name
      overlay.textContent = `${currentAnimIndex + 1}/${animations.length}: ${currentAnim.name} (${currentAnim.duration.toFixed(1)}s)`

      // When animation completes, move to next
      if (elapsed >= currentAnim.duration) {
        currentAnimIndex = (currentAnimIndex + 1) % animations.length
        animStartTime = time
        console.log('Switching to:', animations[currentAnimIndex].name)
        return 0
      }

      return elapsed
    }

    // Get current animation name for animate()
    const currentAnimName = () => animations[currentAnimIndex].name

    // Play animation
    solid(0.9, 0.7, 0.5)
      .diffuse(0, 1, 0, 0.2)
      .out(o0, model.animate(currentAnimName, cyclingTime)
        .scale(() => zoom)
        .rotateX(() => rotX + Math.PI)
        .rotateY(() => rotY)
        .rotateZ(() => rotZ)
        .perspective(45))
  })

// This should show red oscillations since v.depth = 1.0

// Uncomment to test with 3D model where v values vary:
/*
loadGlb(modelPath).then(model => {
  console.log('GLB loaded:', model)

  // Use v.normal.z for lighting-like effect
  solid(1, 0.5, 0.2)
    .brightness(v.normal.z)
    .out(o0, model.scale(() => zoom)
      .rotateX(() => rotX + Math.PI)
      .rotateY(() => rotY)
      .rotateZ(() => rotZ)
      .perspective(45))
})
*/

	//hydra2.s[1].init({src: hydra.s[0].tex, dynamic: true});
// *******************************************
// Inactive code parked below.
//

/*
`
 osc(10, 0.9, 300)
.color(0.9, 0.7, 0.8)
.diff(
  osc(45, 0.3, 100)
  .color(0.9, 0.9, 0.9)
  .rotate(0.18)
  .pixelate(12)
  .kaleid()
)
.scrollX(10)
.colorama()
//.luma()
.repeatX(4)
.repeatY(4)
.modulate(
  osc(1, -0.9, 300)
)
.scale(2)
.out()

//Glitch River
//Flor de Fuego
//https://flordefuego.github.io/
voronoi(8,1)
.mult(osc(10,0.1,()=>Math.sin(time)*3).saturate(3).kaleid(200))
.modulate(o2,0.5)
.add(o2,0.8)
.scrollY(-0.01)
.scale(0.99)
.modulate(voronoi(8,1),0.008)
.luma(0.3)
.out(o2)

noise(()=>time, ()=>time / 10.).out(o1);
render()


//s3.initVideo("https://media.giphy.com/media/26ufplp8yheSKUE00/giphy.mp4", {})
s3.initCam();
//src(s3).scale(1.1).blend(src(o3).scale(1.1), 0.8).out(o3);
src(s3).out(o3)
render();

*/


/*
osc(10, 0.9, 300)
.color(0.9, 0.7, 0.8)
.diff(
  osc(45, 0.3, 100)
  .color(0.9, 0.9, 0.9)
  .rotate(0.18)
  .pixelate(12)
  .kaleid()
)
.scrollX(10)
.colorama()
//.luma()
.repeatX(4)
.repeatY(4)
.modulate(
  osc(1, -0.9, 300)
)
.scale(2)
.out(o1)


//Glitch River
//Flor de Fuego
//https://flordefuego.github.io/
voronoi(8,1)
.mult(osc(10,0.1,()=>Math.sin(time)*3).saturate(3).kaleid(200))
.modulate(o2,0.5)
.add(o2,0.8)
.scrollY(-0.01)
.scale(0.99)
.modulate(voronoi(8,1),0.008)
.luma(0.3)
.out(o2)

s3.initVideo("https://media.giphy.com/media/26ufplp8yheSKUE00/giphy.mp4", {})
src(s3).out(o3);
render();


//ee_5 . FUGITIVE GEOMETRY VHS . audioreactive shapes and gradients
// e_e // @eerie_ear
//
let s= ()=>
  shape(4)
.scrollX([-0.5,-0.2,0.3,-0.1,-0.1].smooth(0.1).fast(0.3))
.scrollY([0.25,-0.2,0.3,-0.1,0.2].smooth(0.9).fast(0.15))
//
solid()
.add(gradient(3,0.05).rotate(0.05,-0.2).posterize(2).contrast(0.6),[1,0,1,0.5,0,0.6].smooth(0.9))
.add(s())
.mult(s().scale(0.8).scrollX(0.01).scrollY(-0.01).rotate(0.2,0.06).add(gradient(3).contrast(0.6),[1,0,1,0.5].smooth(0.9),0.5).mult(src(o0).scale(0.98),()=>a.fft[0]*9)
     )
.diff(s().modulate(shape(500)).scale([1.7,1.2].smooth(0.9).fast(0.05)))
.add(gradient(2).invert(),()=>a.fft[2])
.mult(gradient(()=>a.fft[3]*8))
.blend(src((o0),()=>a.fft[1]*40))
.add(voronoi(()=>a.fft[1],()=>a.fft[3],()=>a.fft[0]).thresh(0.7).posterize(2,4).luma(0.9).scrollY(1,()=>a.fft[0]/30).colorama(3).thresh(()=>a.fft[1]).scale(()=>a.fft[3]*2),()=>a.fft[0]/2)
  .out()
//
speed= 1

a.setSmooth(0.96)

//noise(()=>time, ()=>time / 10.).out();




voronoi(5,-0.1,5)
.add(osc(1,0,1)).kaleid(21)
.scale(1,1,2).colorama().out(o1)
src(o1).mult(src(s1).modulateRotate(o1,100), -0.5)
  .out(o0)





*/


// *******************************************
// don't step on the following:
}


// Hello humans
window.onload = init
