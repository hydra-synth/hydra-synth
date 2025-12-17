// Animation Viewer - Diagnostic tool to preview all animations in a GLB model
// Usage: Import and call viewAnimations(modelPath) or run directly with a model path

import Hydra from "./../src/hydra-synth.js";

export async function viewAnimations(modelPath, options = {}) {
  const {
    canvas = null,
    autoRotate = false,
    showOverlay = true
  } = options

  // Create or use provided canvas
  const cvs = canvas || document.createElement('canvas')
  if (!canvas) {
    cvs.style.backgroundColor = "#000"
    cvs.style.width = '100%'
    cvs.style.height = '100%'
    document.body.appendChild(cvs)
  }

  // Initialize Hydra
  const hydra = new Hydra({ canvas: cvs, detectAudio: false, makeGlobal: true })

  function fitCanvas() {
    cvs.width = window.innerWidth
    cvs.height = window.innerHeight
    hydra.setResolution(cvs.width, cvs.height)
  }
  window.addEventListener('resize', fitCanvas, false)
  fitCanvas()

  // Mouse/touch controls for rotation and zoom
  let rotX = 0, rotY = 0, rotZ = 0
  let zoom = 0.8
  let dragging = false
  let lastX = 0, lastY = 0

  cvs.addEventListener('mousedown', (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
  })
  cvs.addEventListener('mouseup', () => dragging = false)
  cvs.addEventListener('mouseleave', () => dragging = false)
  cvs.addEventListener('mousemove', (e) => {
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
  cvs.addEventListener('wheel', (e) => {
    e.preventDefault()
    zoom *= e.deltaY > 0 ? 0.9 : 1.1
    zoom = Math.max(0.1, Math.min(3, zoom))
  }, { passive: false })

  // Load model
  console.log('Fetching model:', modelPath)
  const model = await loadGlb(modelPath)
  console.log('Model loaded:', modelPath)
  console.log('Vertices with skin weights:', model.joints ? model.joints.length / 4 : 0)

  const animations = model.getAnimations()
  console.log('Available animations:', animations)

  if (animations.length === 0) {
    console.warn('No animations found in model')
    return { model, animations: [], hydra }
  }

  let currentAnimIndex = 0
  let animStartTime = 0
  let paused = false

  // Create overlay
  let overlay = null
  if (showOverlay) {
    overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      color: white;
      font: 20px monospace;
      text-shadow: 2px 2px 4px black;
      z-index: 1000;
      user-select: none;
    `
    document.body.appendChild(overlay)

    // Controls help
    const help = document.createElement('div')
    help.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      color: #aaa;
      font: 14px monospace;
      text-shadow: 1px 1px 2px black;
      z-index: 1000;
    `
    help.innerHTML = `
      Drag: rotate X/Y | Shift+Drag: rotate Z | Scroll: zoom<br>
      Space: pause | Left/Right: prev/next | R: reset view
    `
    document.body.appendChild(help)
  }

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      paused = !paused
      e.preventDefault()
    } else if (e.code === 'ArrowRight') {
      currentAnimIndex = (currentAnimIndex + 1) % animations.length
      animStartTime = time
    } else if (e.code === 'ArrowLeft') {
      currentAnimIndex = (currentAnimIndex - 1 + animations.length) % animations.length
      animStartTime = time
    } else if (e.code === 'KeyR') {
      rotX = 0; rotY = 0; rotZ = 0; zoom = 0.8
    }
  })

  // Time function that cycles through animations
  let pausedTime = 0
  const cyclingTime = () => {
    const currentAnim = animations[currentAnimIndex]

    if (paused) {
      if (overlay) {
        overlay.textContent = `${currentAnimIndex + 1}/${animations.length}: ${currentAnim.name} (${currentAnim.duration.toFixed(1)}s) [PAUSED]`
      }
      return pausedTime
    }

    const elapsed = time - animStartTime
    pausedTime = elapsed

    if (overlay) {
      const progress = Math.min(elapsed / currentAnim.duration * 100, 100).toFixed(0)
      overlay.textContent = `${currentAnimIndex + 1}/${animations.length}: ${currentAnim.name} (${currentAnim.duration.toFixed(1)}s) ${progress}%`
    }

    // When animation completes, move to next
    if (elapsed >= currentAnim.duration) {
      currentAnimIndex = (currentAnimIndex + 1) % animations.length
      animStartTime = time
      console.log('Playing:', animations[currentAnimIndex].name)
      return 0
    }

    return elapsed
  }

  const currentAnimName = () => animations[currentAnimIndex].name

  // Render - light from front-top-right for better visibility
  solid(0.9, 0.7, 0.5)
    .diffuse(0.3, 0.6, 0.8, 0.4)
    .out(o0, model.animate(currentAnimName, cyclingTime)
      .scale(() => zoom)
      .rotateX(() => rotX + Math.PI + (autoRotate ? time * 0.1 : 0))
      .rotateY(() => rotY + (autoRotate ? time * 0.3 : 0))
      .rotateZ(() => rotZ)
      .perspective(45))

  return { model, animations, hydra,
    setAnimation: (idx) => { currentAnimIndex = idx; animStartTime = time },
    togglePause: () => { paused = !paused }
  }
}

// Run directly if this is the main module
if (typeof window !== 'undefined') {
  window.viewAnimations = viewAnimations
}
