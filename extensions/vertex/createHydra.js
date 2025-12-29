/**
 * Hydra Factory with WebGL + WebGPU support
 *
 * This factory creates Hydra instances that work with both rendering backends.
 * For WebGL, it uses vanilla hydra-synth. For WebGPU, it initializes the WGSL pipeline.
 */

// WebGPU imports (from extension's wgsl folder)
import { wgslHydra } from './wgsl/wgsl-hydra.js'
import { OutputWgsl } from './wgsl/outputWgsl.js'

// We need these from hydra-synth for initialization
import Output from '../../src/output.js'
import Source from '../../src/hydra-source.js'
import MouseTools from '../../src/lib/mouse.js'
import Audio from '../../src/lib/audio.js'
import VidRecorder from '../../src/lib/video-recorder.js'
import ArrayUtils from '../../src/lib/array-utils.js'
import Sandbox from '../../src/eval-sandbox.js'
import Generator from '../../src/generator-factory.js'
import regl from 'regl'

// RAF loop - use a simple implementation
function createLoop(fn) {
  let running = false
  let lastTime = performance.now()
  let rafId = null

  function tick() {
    if (!running) return
    const now = performance.now()
    const dt = now - lastTime
    lastTime = now
    fn(dt)
    rafId = requestAnimationFrame(tick)
  }

  return {
    start() {
      if (running) return this
      running = true
      lastTime = performance.now()
      rafId = requestAnimationFrame(tick)
      return this
    },
    stop() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      return this
    }
  }
}

// Mouse singleton
let Mouse
if (typeof window !== 'undefined') {
  Mouse = MouseTools()
} else {
  Mouse = { x: 0, y: 0 }
}

/**
 * Create a Hydra instance with optional WebGPU support
 */
export async function createHydra({
  pb = null,
  width = 1280,
  height = 720,
  numSources = 4,
  numOutputs = 4,
  makeGlobal = true,
  autoLoop = true,
  detectAudio = true,
  enableStreamCapture = true,
  useWGSL = false,
  canvas,
  precision,
  extendTransforms = {},
  gpuDevice = null,
  preserveDrawingBuffer = false
} = {}) {

  // Create the hydra instance object
  const hydra = {
    pb,
    width,
    height,
    renderAll: false,
    detectAudio,
    useWGSL,
    preserveDrawingBuffer,
    gpuDevice,
    numOutputs,
    o: [],
    s: [],
    synth: {
      time: 0,
      bpm: 30,
      width,
      height,
      fps: undefined,
      stats: { fps: 0 },
      speed: 1,
      mouse: Mouse,
      isWGSL: useWGSL
    },
    timeSinceLastUpdate: 0,
    _time: 0
  }

  ArrayUtils.init()

  // Determine precision
  const precisionOptions = ['lowp', 'mediump', 'highp']
  if (precision && precisionOptions.includes(precision.toLowerCase())) {
    hydra.precision = precision.toLowerCase()
  } else {
    const isIOS = typeof navigator !== 'undefined' &&
      ((/iPad|iPhone|iPod/.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !window.MSStream)
    hydra.precision = isIOS ? 'highp' : 'mediump'
  }

  hydra.extendTransforms = extendTransforms

  // Initialize canvas
  if (canvas) {
    hydra.canvas = canvas
  } else if (typeof document !== 'undefined') {
    // Ensure body fills viewport
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.width = '100vw'
    document.body.style.height = '100vh'
    document.body.style.background = '#000'
    document.documentElement.style.margin = '0'
    document.documentElement.style.padding = '0'
    document.documentElement.style.width = '100%'
    document.documentElement.style.height = '100%'

    // Hide any existing app div
    const appDiv = document.getElementById('app')
    if (appDiv) appDiv.style.display = 'none'

    hydra.canvas = document.createElement('canvas')
    hydra.canvas.style.position = 'fixed'
    hydra.canvas.style.top = '0'
    hydra.canvas.style.left = '0'
    hydra.canvas.style.width = '100%'
    hydra.canvas.style.height = '100%'
    hydra.canvas.style.display = 'block'
    hydra.canvas.style.imageRendering = 'pixelated'
    document.body.appendChild(hydra.canvas)

    // Use actual display size for canvas dimensions
    const rect = hydra.canvas.getBoundingClientRect()
    const displayWidth = Math.round(rect.width * (window.devicePixelRatio || 1))
    const displayHeight = Math.round(rect.height * (window.devicePixelRatio || 1))
    hydra.canvas.width = displayWidth || width
    hydra.canvas.height = displayHeight || height
    hydra.width = hydra.canvas.width
    hydra.height = hydra.canvas.height
    hydra.synth.width = hydra.canvas.width
    hydra.synth.height = hydra.canvas.height
  }

  // Bind methods to synth
  hydra.synth.render = hydra._render = function(output) {
    if (output) {
      hydra.output = output
      hydra.isRenderingAll = false
    } else {
      hydra.isRenderingAll = true
    }
  }.bind(hydra)

  hydra.synth.setResolution = hydra.setResolution = function(w, h) {
    // Guard against invalid dimensions
    if (!w || !h || w <= 0 || h <= 0) {
      console.warn(`[hydra] setResolution called with invalid dimensions: ${w}x${h}`)
      return
    }
    hydra.canvas.width = w
    hydra.canvas.height = h
    hydra.width = w
    hydra.height = h
    hydra.synth.width = w
    hydra.synth.height = h
    if (hydra.wgslHydra) {
      hydra.wgslHydra.resizeOutputsTo(w, h)
    }
    hydra.o.forEach(o => o.resize && o.resize(w, h))
  }.bind(hydra)

  hydra.synth.hush = hydra.hush = function() {
    hydra.s.forEach(source => source.clear && source.clear())
    hydra.o.forEach(output => {
      if (output.clearSprites) output.clearSprites()
    })
    hydra.synth.render(hydra.o[0])
  }.bind(hydra)

  hydra.synth.update = (dt) => {}
  hydra.synth.tick = hydra.tick = createTick(hydra)

  // Initialize based on mode
  if (useWGSL) {
    // WebGPU mode
    hydra.wgslHydra = new wgslHydra(hydra, hydra.canvas, numOutputs, gpuDevice)

    // Initialize outputs
    hydra.o = Array(numOutputs).fill().map((_, index) => {
      const o = new OutputWgsl({
        wgslHydra: hydra.wgslHydra,
        hydraSynth: hydra,
        width: hydra.width,
        height: hydra.height,
        chanNum: index,
        label: `o${index}`
      })
      o.id = index
      o.precision = hydra.precision
      hydra.synth['o' + index] = o
      return o
    })
    hydra.output = hydra.o[0]

    // Setup WebGPU
    await hydra.wgslHydra.setupHydra()

    // Initialize sources
    initSources(hydra, numSources)

    // Generate transforms
    hydra.generator = new Generator({
      defaultOutput: hydra.o[0],
      defaultUniforms: hydra.o[0].uniforms || {},
      extendTransforms: hydra.extendTransforms,
      changeListener: ({ type, method, synth }) => {
        if (type === 'add') {
          hydra.synth[method] = synth.generators[method]
          if (hydra.sandbox) hydra.sandbox.add(method)
        }
      }
    })
    // Set isWGSL so GlslSource knows to generate WGSL shaders
    hydra.generator.isWGSL = true

    // Expose setFunction for extensions
    hydra.synth.setFunction = hydra.generator.setFunction.bind(hydra.generator)

  } else {
    // WebGL mode
    hydra.regl = regl({
      canvas: hydra.canvas,
      pixelRatio: 1,
      attributes: { preserveDrawingBuffer }
    })

    hydra.regl.clear({ color: [0, 0, 0, 1] })

    // Initialize outputs
    hydra.o = Array(numOutputs).fill().map((_, index) => {
      const o = new Output({
        regl: hydra.regl,
        width: hydra.width,
        height: hydra.height,
        precision: hydra.precision,
        label: `o${index}`
      })
      o.id = index
      hydra.synth['o' + index] = o
      return o
    })
    hydra.output = hydra.o[0]

    // Initialize sources
    initSources(hydra, numSources)

    // Generate transforms
    hydra.generator = new Generator({
      genWGSL: false,
      defaultOutput: hydra.o[0],
      defaultUniforms: hydra.o[0].uniforms,
      extendTransforms: hydra.extendTransforms,
      changeListener: ({ type, method, synth }) => {
        if (type === 'add') {
          hydra.synth[method] = synth.generators[method]
          if (hydra.sandbox) hydra.sandbox.add(method)
        }
      }
    })

    // Expose setFunction for extensions
    hydra.synth.setFunction = hydra.generator.setFunction.bind(hydra.generator)

    // Create renderAll for WebGL
    hydra.renderAll = hydra.regl({
      frag: `
        precision ${hydra.precision} float;
        varying vec2 uv;
        uniform sampler2D tex0;
        uniform sampler2D tex1;
        uniform sampler2D tex2;
        uniform sampler2D tex3;
        void main () {
          vec2 st = vec2(1.0 - uv.x, uv.y);
          st *= vec2(2);
          vec2 q = floor(st).xy * vec2(2.0, 1.0);
          int quad = int(q.x) + int(q.y);
          st.x += step(1., mod(st.y, 2.0));
          st.y += step(1., mod(st.x, 2.0));
          st = fract(st);
          if (quad == 0) {
            gl_FragColor = texture2D(tex0, st);
          } else if (quad == 1) {
            gl_FragColor = texture2D(tex1, st);
          } else if (quad == 2) {
            gl_FragColor = texture2D(tex2, st);
          } else {
            gl_FragColor = texture2D(tex3, st);
          }
        }
      `,
      vert: `
        precision ${hydra.precision} float;
        attribute vec2 position;
        varying vec2 uv;
        void main () {
          uv = position;
          gl_Position = vec4(2.0 * position - 1.0, 0, 1);
        }
      `,
      attributes: {
        position: [[-2, 0], [0, -2], [2, 2]]
      },
      uniforms: {
        tex0: () => hydra.o[0].getCurrent(),
        tex1: () => hydra.o[1].getCurrent(),
        tex2: () => hydra.o[2].getCurrent(),
        tex3: () => hydra.o[3].getCurrent()
      },
      count: 3,
      depth: { enable: false }
    })

    // Create renderFbo for single output to canvas
    hydra.renderFbo = hydra.regl({
      frag: `
        precision ${hydra.precision} float;
        varying vec2 uv;
        uniform sampler2D tex0;
        void main () {
          gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
        }
      `,
      vert: `
        precision ${hydra.precision} float;
        attribute vec2 position;
        varying vec2 uv;
        void main () {
          uv = position;
          gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
        }
      `,
      attributes: {
        position: [[-2, 0], [0, -2], [2, 2]]
      },
      uniforms: {
        tex0: hydra.regl.prop('tex0'),
        resolution: hydra.regl.prop('resolution')
      },
      count: 3,
      depth: { enable: false }
    })
  }

  // Create sandbox
  hydra.sandbox = new Sandbox(hydra.synth, makeGlobal, ['speed', 'update', 'bpm', 'fps'])

  // Add all generator methods to sandbox (Generator was created before sandbox)
  if (hydra.generator && hydra.generator.synth && hydra.generator.synth.generators) {
    for (const method of Object.keys(hydra.generator.synth.generators)) {
      hydra.sandbox.add(method)
    }
  }

  // Add eval method (delegates to sandbox)
  hydra.eval = function(code) {
    return hydra.sandbox.eval(code)
  }

  // Audio detection
  if (detectAudio) {
    try {
      hydra.audio = new Audio({ numBins: 4 })
      hydra.synth.a = hydra.audio
      // Register audio 'a' with sandbox
      hydra.sandbox.add('a')
    } catch (e) {
      console.warn('[hydra] Audio detection not available')
    }
  }

  // Start animation loop
  if (autoLoop) {
    hydra.looper = createLoop(hydra.tick).start()
  }

  // Set default render
  hydra.synth.render(hydra.o[0])

  return hydra
}

function initSources(hydra, numSources) {
  // Sources require regl - skip in WebGPU mode for now
  // TODO: Create WebGPU-compatible source class
  if (!hydra.regl) {
    console.warn('[hydra] Sources (s0, s1, etc.) not available in WebGPU mode')
    return
  }

  for (let i = 0; i < numSources; i++) {
    const s = new Source({
      regl: hydra.regl,
      hydraSynth: hydra,
      pb: hydra.pb,
      width: hydra.width,
      height: hydra.height,
      chanNum: i,
      label: `s${i}`
    })
    hydra.synth['s' + i] = s
    hydra.s.push(s)
  }
}

function createTick(hydra) {
  return function tick(dt) {
    hydra.synth.time += dt * 0.001 * hydra.synth.speed
    hydra.synth.stats.fps = Math.round(1000 / dt)

    if (hydra.synth.update) hydra.synth.update(dt)

    // Update sources
    hydra.s.forEach(source => source.tick && source.tick(hydra.synth.time))

    // Render
    if (hydra.useWGSL) {
      // WebGPU render
      hydra.wgslHydra.animate(hydra.synth.time, hydra.synth.mouse, hydra.synth.resolution, hydra.isRenderingAll)
    } else {
      // WebGL render
      hydra.o.forEach(o => o.tick && o.tick({
        time: hydra.synth.time,
        mouse: hydra.synth.mouse,
        bpm: hydra.synth.bpm,
        resolution: [hydra.canvas.width, hydra.canvas.height]
      }))

      if (hydra.isRenderingAll) {
        hydra.renderAll({
          tex0: hydra.o[0].getCurrent(),
          tex1: hydra.o[1].getCurrent(),
          tex2: hydra.o[2].getCurrent(),
          tex3: hydra.o[3].getCurrent(),
          resolution: [hydra.canvas.width, hydra.canvas.height]
        })
      } else {
        hydra.renderFbo({
          tex0: hydra.output.getCurrent(),
          resolution: [hydra.canvas.width, hydra.canvas.height]
        })
      }
    }

    if (hydra.synth.afterUpdate) hydra.synth.afterUpdate(dt)
  }
}

export default createHydra
