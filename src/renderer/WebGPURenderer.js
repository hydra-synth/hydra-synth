/**
 * WebGPU Renderer Implementation
 *
 * Wraps the existing wgslHydra and OutputWgsl from the vertex extension
 * to implement the RendererInterface. This validates the interface design
 * for WebGPU support.
 *
 * NOTE: This renderer requires the vertex extension's WebGPU infrastructure.
 * It's a proof-of-concept to validate the interface, not a standalone WebGPU renderer.
 */

import { RendererInterface } from './RendererInterface.js'

// Dynamic imports for WebGPU components (from vertex extension)
let wgslHydra = null
let OutputWgsl = null
let Source = null

export class WebGPURenderer extends RendererInterface {

  constructor() {
    super()
    this._canvas = null
    this._wgslHydra = null
    this._width = 0
    this._height = 0
    this._precision = 'highp' // WebGPU uses high precision by default
    this._outputs = []
    this._sources = []
    this._hydra = null // Reference to parent hydra instance
    this._initialized = false
  }

  /**
   * Initialize the WebGPU renderer
   * Note: WebGPU initialization is async, so this returns a Promise
   */
  async init(canvas, options = {}) {
    const {
      precision = 'highp',
      width = canvas.width || 1280,
      height = canvas.height || 720,
      numOutputs = 4,
      hydra = null,
      gpuDevice = null
    } = options

    this._canvas = canvas
    this._width = width
    this._height = height
    this._precision = precision
    this._hydra = hydra

    // Check for WebGPU support
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser')
    }

    // Dynamically import WebGPU components from vertex extension
    try {
      const wgslModule = await import('../../extensions/vertex/wgsl/wgsl-hydra.js')
      const outputModule = await import('../../extensions/vertex/wgsl/outputWgsl.js')
      const sourceModule = await import('../../extensions/vertex/hydra-source.js')

      wgslHydra = wgslModule.wgslHydra
      OutputWgsl = outputModule.OutputWgsl
      Source = sourceModule.default
    } catch (e) {
      throw new Error('WebGPU renderer requires vertex extension: ' + e.message)
    }

    // Create hydra shim - wgslHydra keeps a reference to this
    // so when we add outputs to .o, wgslHydra can access them
    const hydraShim = {
      o: [],
      synth: hydra?.synth || {
        time: 0,
        mouse: { x: 0, y: 0 },
        width: width,
        height: height
      }
    }
    this._hydraShim = hydraShim

    // Create the wgslHydra instance (holds reference to hydraShim)
    this._wgslHydra = new wgslHydra(hydraShim, this._canvas, numOutputs, gpuDevice)

    // Create output objects BEFORE setupHydra (it needs them for createOutputTextures)
    for (let i = 0; i < numOutputs; i++) {
      const output = new OutputWgsl({
        wgslHydra: this._wgslHydra,
        hydraSynth: hydra || hydraShim,
        width: this._width,
        height: this._height,
        chanNum: i,
        label: `o${i}`
      })
      output.id = i
      output.precision = this._precision
      hydraShim.o.push(output)
      this._outputs[i] = output
    }

    // Now setup WebGPU context and pipelines (uses hydraShim.o for output textures)
    await this._wgslHydra.setupHydra()

    this._initialized = true
  }

  destroy() {
    // WebGPU cleanup
    if (this._wgslHydra) {
      // Clear sprite chains
      for (let i = 0; i < this._wgslHydra.numChannels; i++) {
        if (this._wgslHydra.clearSpriteChains) {
          this._wgslHydra.clearSpriteChains(i)
        }
      }
      // Destroy output textures
      this._outputs.forEach(output => {
        if (output.textures) {
          output.textures.forEach(tex => tex?.destroy?.())
        }
      })
      // Destroy depth texture
      if (this._wgslHydra.depthTexture) {
        this._wgslHydra.depthTexture.destroy()
      }
      this._wgslHydra = null
    }
    this._outputs = []
    this._sources = []
    this._initialized = false
  }

  async resize(width, height) {
    this._width = width
    this._height = height
    this._canvas.width = width
    this._canvas.height = height

    if (this._wgslHydra) {
      await this._wgslHydra.resizeOutputsTo(width, height)
    }

    // Resize sources
    this._sources.forEach(source => {
      if (source.resize) source.resize(width, height)
    })
  }

  // ============================================================
  // Output Management
  // ============================================================

  createOutput(index, options = {}) {
    // In WebGPU mode, outputs are created during init
    // This method just returns the already-created output
    if (this._outputs[index]) {
      return this._outputs[index]
    }

    // Create a new output if needed
    const output = new OutputWgsl({
      wgslHydra: this._wgslHydra,
      hydraSynth: this._hydra,
      width: options.width || this._width,
      height: options.height || this._height,
      chanNum: index,
      label: options.label || `o${index}`
    })
    output.id = index
    output.precision = this._precision
    this._outputs[index] = output
    return output
  }

  getOutput(index) {
    return this._outputs[index]
  }

  // ============================================================
  // Source Management
  // ============================================================

  createSource(index, options = {}) {
    const source = new Source({
      regl: null,  // Not used in WebGPU mode
      wgsl: this._wgslHydra,
      hydraSynth: this._hydra,
      pb: options.pb || null,
      width: options.width || this._width,
      height: options.height || this._height,
      chanNum: index,
      label: options.label || `s${index}`
    })
    this._sources[index] = source
    return source
  }

  // ============================================================
  // Rendering
  // ============================================================

  renderPass(output, pass) {
    // In WebGPU, passes are registered via output.render()
    // The actual rendering happens in tickOutput/animate
    if (output.render) {
      output.render([pass])
    }
  }

  tickOutput(output, props) {
    // WebGPU outputs don't have a separate tick - rendering happens in animate()
    // But we can update any per-output state here
    if (output.tick) {
      output.tick(props)
    }
  }

  renderToScreen(output) {
    // In WebGPU, screen rendering is handled by animate()
    // This sets which output to display
    this._wgslHydra.showQuad = false
    this._wgslHydra.outChannel = output.id
  }

  renderAllToScreen(outputs) {
    // In WebGPU, 4-up rendering is handled by animate()
    this._wgslHydra.showQuad = true
  }

  /**
   * Main render call - executes all pending renders
   * Called each frame after tickOutput calls
   */
  async render(time, mouse, resolution, isRenderingAll) {
    if (!this._wgslHydra || !this._initialized) return

    // Update mouse position
    if (mouse) {
      this._wgslHydra.relayUniformInfo(mouse)
    }

    // Execute the render
    await this._wgslHydra.animate(time, mouse, resolution, isRenderingAll)
  }

  // ============================================================
  // Capabilities & Info
  // ============================================================

  get capabilities() {
    const limits = this._wgslHydra?.device?.limits || {}
    return {
      name: 'webgpu',
      glslVersion: 'wgsl',
      instancing: true,
      floatTextures: true,
      halfFloatTextures: true,
      maxTextureSize: limits.maxTextureDimension2D || 8192,
      maxTextureUnits: limits.maxSampledTexturesPerShaderStage || 16,
      computeShaders: true,
      storageTextures: true
    }
  }

  get canvas() {
    return this._canvas
  }

  get width() {
    return this._width
  }

  get height() {
    return this._height
  }

  // ============================================================
  // Additional accessors for compatibility
  // ============================================================

  /**
   * Get the underlying wgslHydra instance
   */
  get wgslHydra() {
    return this._wgslHydra
  }

  /**
   * Get the GPU device
   */
  get device() {
    return this._wgslHydra?.device
  }

  /**
   * Get precision setting
   */
  get precision() {
    return this._precision
  }

  /**
   * Get all outputs
   */
  get outputs() {
    return this._outputs
  }

  /**
   * Get all sources
   */
  get sources() {
    return this._sources
  }

  /**
   * Check if initialized
   */
  get initialized() {
    return this._initialized
  }
}

export default WebGPURenderer
