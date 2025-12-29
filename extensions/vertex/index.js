/**
 * Hydra Vertex Shader Extension
 *
 * Adds 3D vertex shader capabilities to hydra-synth.
 *
 * Usage:
 *   import Hydra from 'hydra-synth'
 *   import { install } from 'hydra-synth/extensions/vertex'
 *
 *   const hydra = new Hydra({ ... })
 *   install(hydra)
 *
 *   // Now you can use vertex functions:
 *   // osc(10).out(o0, sphere())   // osc shader on sphere geometry
 *   // solid(1,0,0).out(o0, cube())  // red cube
 */

// Import geometry primitives
import {
  tri, quad, poly, circle, line, ring,
  cube, sphere, plane, torus, cylinder, cone,
  parseObj, loadObj, parseGlb, loadGlb
} from './geometry.js'

// Import VertexSource class
import VertexSource from './vertex-source.js'

// Import varying proxy
import { v } from './varying-proxy.js'

// Import the modified GlslSource and Output from vertex-shaders branch
import GlslSource from './glsl-source.js'
import Output from './output.js'

// Import lighting functions
import lightingFunctions from './lighting-functions.js'

// Import WebGPU utilities
import { getSharedDevice, hasSharedDevice, releaseSharedDevice } from './wgsl/gpu-device-factory.js'

// Extension version
export const VERSION = '0.1.0'

// Store reference to hydra instance
let _hydra = null

/**
 * Fixed RAF loop implementation
 * Replaces vanilla hydra's loop which has timing issues
 */
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

/**
 * Install the vertex shader extension into a Hydra instance
 */
export function install(hydra, options = {}) {
  console.log(`[hydra-vertex] Installing vertex shader extension v${VERSION}`)

  _hydra = hydra
  const synth = hydra.synth

  if (!synth) {
    console.error('[hydra-vertex] Could not find hydra.synth')
    return false
  }

  // Fix vanilla hydra's raf loop timing issues
  if (hydra.looper) {
    hydra.looper.stop()
    hydra.looper = createLoop(hydra.tick.bind(hydra)).start()
    console.log('[hydra-vertex] Replaced animation loop with fixed version')
  }

  // Register geometry functions as globals
  registerGeometryFunctions(synth)

  // Register lighting functions
  registerLightingFunctions(synth)

  // Register varying proxy
  synth.v = v
  if (typeof window !== 'undefined') {
    window.v = v
  }

  // Replace GlslSource prototype methods with vertex-shader branch versions
  patchGlslSource(hydra)

  // Replace Output prototype methods with vertex-shader branch versions
  patchOutput(hydra)

  // Patch hush() to clear sprites
  patchHush(hydra)

  // Add ResizeObserver to handle canvas resize automatically
  setupResizeObserver(hydra)

  console.log('[hydra-vertex] Extension installed successfully')
  return true
}

/**
 * Setup ResizeObserver to automatically update resolution when canvas resizes
 */
function setupResizeObserver(hydra) {
  const canvas = hydra.canvas
  if (!canvas || typeof ResizeObserver === 'undefined') return

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Get the new display size
      const width = Math.round(entry.contentRect.width * (window.devicePixelRatio || 1))
      const height = Math.round(entry.contentRect.height * (window.devicePixelRatio || 1))

      // Only update if size actually changed
      if (canvas.width !== width || canvas.height !== height) {
        console.log(`[hydra-vertex] Canvas resized: ${width}x${height}`)
        hydra.setResolution(width, height)
      }
    }
  })

  observer.observe(canvas)

  // Store observer for potential cleanup
  hydra._vertexResizeObserver = observer
}

/**
 * Register geometry creation functions as globals
 */
function registerGeometryFunctions(synth) {
  const geometryFunctions = {
    tri, quad, poly, circle, line, ring,
    cube, sphere, plane, torus, cylinder, cone,
    parseObj, loadObj, parseGlb, loadGlb
  }

  for (const [name, fn] of Object.entries(geometryFunctions)) {
    synth[name] = fn
    if (typeof window !== 'undefined') {
      window[name] = fn
    }
  }
  console.log('[hydra-vertex] Registered geometry functions')
}

/**
 * Register lighting functions (diffuse, specular, fresnel, etc.)
 */
function registerLightingFunctions(synth) {
  for (const fn of lightingFunctions) {
    synth.setFunction(fn)
  }
  console.log('[hydra-vertex] Registered lighting functions')
}

/**
 * Patch GlslSource prototype with methods from vertex-shaders branch
 */
function patchGlslSource(hydra) {
  const testSource = hydra.synth.osc ? hydra.synth.osc() : null
  if (!testSource) return

  const GlslSourceProto = Object.getPrototypeOf(testSource)

  // Copy all methods from our GlslSource to the existing prototype
  GlslSourceProto.out = GlslSource.prototype.out
  GlslSourceProto.glsl = GlslSource.prototype.glsl
  GlslSourceProto.compile = GlslSource.prototype.compile

  console.log('[hydra-vertex] GlslSource patched')
}

/**
 * Patch Output prototype with methods from vertex-shaders branch
 */
function patchOutput(hydra) {
  const output = hydra.o[0]
  if (!output) return

  const OutputProto = Object.getPrototypeOf(output)

  // Copy all methods from our Output to the existing prototype
  OutputProto.registerSprite = Output.prototype.registerSprite
  OutputProto.enableDepthBuffer = Output.prototype.enableDepthBuffer
  OutputProto._renderSprites = Output.prototype._renderSprites
  OutputProto.clearSprites = Output.prototype.clearSprites
  OutputProto.removeSprite = Output.prototype.removeSprite
  OutputProto.enableSprite = Output.prototype.enableSprite
  OutputProto.disableSprite = Output.prototype.disableSprite
  OutputProto.tick = Output.prototype.tick
  OutputProto.render = Output.prototype.render

  // Initialize each output with vertex-shader branch properties
  for (const o of hydra.o) {
    // Default fullscreen triangle using vec3
    o.defaultPositionBuffer = o.regl.buffer([
      [-2, 0, 0],
      [0, -2, 0],
      [2, 2, 0]
    ])
    o.positionBuffer = o.defaultPositionBuffer

    // Sprite registry
    o.sprites = new Map()
    o.hasDepthBuffer = false

    // Update the vertex shader to use vec3 positions
    o.vert = `
    precision ${o.precision} float;
    attribute vec3 position;
    varying vec2 uv;
    varying float v_faceId;

    // Vertex data for fragment shader (default values for fullscreen quad)
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec3 v_worldNormal;
    varying vec3 v_tangent;
    varying vec3 v_bitangent;
    varying vec3 v_viewDir;
    varying float v_depth;

    void main () {
      uv = position.xy;
      v_faceId = 0.0;

      // Default vertex data for fullscreen quad
      v_position = vec3(position.xy * 2.0 - 1.0, 0.0);
      v_normal = vec3(0.0, 0.0, 1.0);
      v_worldNormal = vec3(0.0, 0.0, 1.0);
      v_tangent = vec3(1.0, 0.0, 0.0);
      v_bitangent = vec3(0.0, 1.0, 0.0);
      v_viewDir = vec3(0.0, 0.0, 1.0);
      v_depth = 1.0;

      gl_Position = vec4(2.0 * position.xy - 1.0, 0, 1);
    }`

    // Create copy command for persistence/trails
    o.copyCommand = o.regl({
      frag: `
        precision ${o.precision} float;
        uniform sampler2D source;
        varying vec2 uv;
        void main () {
          gl_FragColor = texture2D(source, uv);
        }
      `,
      vert: o.vert,
      attributes: {
        position: o.defaultPositionBuffer
      },
      uniforms: {
        source: o.regl.prop('source')
      },
      count: 3,
      depth: { enable: false }
    })
  }

  console.log('[hydra-vertex] Output patched')
}

/**
 * Patch hush() to clear all sprites before resetting
 */
function patchHush(hydra) {
  hydra.hush = function() {
    // Clear sources
    hydra.s.forEach((source) => {
      source.clear()
    })
    // Clear all sprite levels and reset to blank
    hydra.o.forEach((output) => {
      if (output.clearSprites) {
        output.clearSprites()
      }
      // Clear the framebuffers directly instead of registering a sprite
      if (output.fbos) {
        output.fbos.forEach(fbo => {
          output.regl.clear({
            color: [0, 0, 0, 1],
            depth: 1,
            framebuffer: fbo
          })
        })
      }
    })
    hydra.synth.render(hydra.o[0])
    if (hydra.sandbox) {
      hydra.sandbox.set('update', (dt) => {})
      hydra.sandbox.set('afterUpdate', (dt) => {})
    }
  }

  // Also update the sandbox reference
  if (hydra.sandbox) {
    hydra.sandbox.set('hush', hydra.hush)
  }

  console.log('[hydra-vertex] hush() patched')
}

/**
 * Cleanup extension resources
 */
export function cleanup(hydra) {
  hydra = hydra || _hydra
  if (!hydra) return

  for (const output of hydra.o) {
    if (output && output.sprites) {
      output.clearSprites()
    }
  }
}

// Re-export for direct import
export {
  tri, quad, poly, circle, line, ring,
  cube, sphere, plane, torus, cylinder, cone,
  parseObj, loadObj, parseGlb, loadGlb,
  VertexSource, v,
  // WebGPU utilities
  getSharedDevice, hasSharedDevice, releaseSharedDevice
}
