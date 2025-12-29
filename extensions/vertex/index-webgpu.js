/**
 * Hydra Vertex Shader Extension - WebGPU Build
 *
 * Adds 3D vertex shader capabilities to hydra-synth with WebGL + WebGPU support.
 * This extension is self-contained and does not require modifications to vanilla hydra-synth.
 *
 * Usage (recommended - uses built-in WebGPU support):
 *   import { createHydra } from 'hydra-vertex-extension'
 *
 *   // WebGPU mode
 *   const hydra = await createHydra({ useWGSL: true, ... })
 *
 *   // WebGL mode
 *   const hydra = await createHydra({ useWGSL: false, ... })
 *
 *   // Now you can use vertex functions:
 *   // osc(10).out(o0, sphere())
 *   // loadGlb('model.glb').then(m => osc(10).out(o0, m.rotateY(() => time)))
 *
 * Usage (alternative - patch existing hydra instance):
 *   import Hydra from 'hydra-synth'
 *   import { install } from 'hydra-vertex-extension'
 *
 *   const hydra = new Hydra({ ... })
 *   install(hydra)  // Adds vertex features to WebGL hydra
 */

// Import createHydra factory
import { createHydra as _createHydra } from './createHydra.js'

// Import geometry primitives
import {
  tri, quad, poly, circle, line, ring,
  cube, sphere, plane, torus, cylinder, cone,
  parseObj, loadObj, parseGlb, loadGlb
} from './geometry.js'

// Import VertexSource class and generators
import VertexSource, { generateVertexGlsl, generateVertexWgsl, getPassthroughVertexWgsl } from './vertex-source.js'

// Import varying proxy
import { v } from './varying-proxy.js'

// Import the modified GlslSource and Output
import GlslSource from './glsl-source.js'
import Output from './output.js'

// Import lighting functions
import lightingFunctions from './lighting-functions.js'

// Import WebGPU utilities
import { getSharedDevice, hasSharedDevice, releaseSharedDevice } from './wgsl/gpu-device-factory.js'

// Extension version
export const VERSION = '0.2.0-webgpu'

// Store reference to hydra instance
let _hydra = null

/**
 * Install the vertex shader extension with WebGL + WebGPU support
 */
export function install(hydra, options = {}) {
  console.log(`[hydra-vertex-webgpu] Installing vertex shader extension v${VERSION}`)

  _hydra = hydra
  const synth = hydra.synth

  if (!synth) {
    console.error('[hydra-vertex-webgpu] Could not find hydra.synth')
    return false
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

  // Replace GlslSource prototype methods with vertex-shader versions
  patchGlslSource(hydra)

  // Replace Output prototype methods (WebGL)
  patchOutput(hydra)

  // Patch hush() to clear sprites
  patchHush(hydra)

  // Add ResizeObserver to handle canvas resize automatically
  setupResizeObserver(hydra)

  // WebGPU mode: outputWgsl.js already has registerSprite built-in
  if (hydra.useWGSL && hydra.wgslHydra) {
    console.log('[hydra-vertex-webgpu] WebGPU mode detected')
  }

  console.log('[hydra-vertex-webgpu] Extension installed successfully')
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
      const width = Math.round(entry.contentRect.width * (window.devicePixelRatio || 1))
      const height = Math.round(entry.contentRect.height * (window.devicePixelRatio || 1))

      // Skip invalid dimensions (can happen before layout is ready)
      if (width <= 0 || height <= 0) continue

      if (canvas.width !== width || canvas.height !== height) {
        console.log(`[hydra-vertex-webgpu] Canvas resized: ${width}x${height}`)
        hydra.setResolution(width, height)
      }
    }
  })

  observer.observe(canvas)
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
  console.log('[hydra-vertex-webgpu] Registered geometry functions')
}

/**
 * Register lighting functions (diffuse, specular, fresnel, etc.)
 */
function registerLightingFunctions(synth) {
  for (const fn of lightingFunctions) {
    synth.setFunction(fn)
  }
  console.log('[hydra-vertex-webgpu] Registered lighting functions')
}

/**
 * Patch GlslSource prototype with vertex-shader methods
 */
function patchGlslSource(hydra) {
  const testSource = hydra.synth.osc ? hydra.synth.osc() : null
  if (!testSource) return

  const GlslSourceProto = Object.getPrototypeOf(testSource)

  // Copy all methods from our GlslSource to the existing prototype
  GlslSourceProto.out = GlslSource.prototype.out
  GlslSourceProto.glsl = GlslSource.prototype.glsl
  GlslSourceProto.compile = GlslSource.prototype.compile

  console.log('[hydra-vertex-webgpu] GlslSource patched')
}

/**
 * Patch Output prototype with vertex-shader methods (WebGL)
 */
function patchOutput(hydra) {
  const output = hydra.o[0]
  if (!output || !output.regl) return  // Skip if WebGPU only

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

  // Initialize each output with vertex-shader properties
  for (const o of hydra.o) {
    if (!o.regl) continue  // Skip WGSL outputs

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

  console.log('[hydra-vertex-webgpu] Output patched (WebGL)')
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
      // Clear the framebuffers directly
      if (output.fbos && output.regl) {
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

  if (hydra.sandbox) {
    hydra.sandbox.set('hush', hydra.hush)
  }

  console.log('[hydra-vertex-webgpu] hush() patched')
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

/**
 * Create a Hydra instance with vertex extension auto-installed
 * Supports both WebGL and WebGPU modes
 */
export async function createHydra(options = {}) {
  const hydra = await _createHydra(options)
  install(hydra)
  return hydra
}

// Re-export everything for direct import
export {
  tri, quad, poly, circle, line, ring,
  cube, sphere, plane, torus, cylinder, cone,
  parseObj, loadObj, parseGlb, loadGlb,
  VertexSource, v,
  generateVertexGlsl, generateVertexWgsl, getPassthroughVertexWgsl,
  // WebGPU utilities
  getSharedDevice, hasSharedDevice, releaseSharedDevice
}
