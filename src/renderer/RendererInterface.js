/**
 * Abstract Renderer Interface
 *
 * All rendering backends (WebGL1, WebGL2, WebGPU) must implement this interface.
 * This allows Hydra core to remain renderer-agnostic.
 *
 * The renderer provides hooks for:
 * - Shader generation (which language, how to build shader strings)
 * - Output/Source management
 * - Rendering execution
 */

export class RendererInterface {

  /**
   * Initialize the renderer with a canvas
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {Object} options - Renderer options
   * @param {string} options.precision - Float precision ('lowp', 'mediump', 'highp')
   * @param {number} options.width - Initial width
   * @param {number} options.height - Initial height
   * @returns {void|Promise<void>} - May be sync (WebGL) or async (WebGPU)
   */
  init(canvas, options = {}) {
    throw new Error('RendererInterface.init() must be implemented')
  }

  /**
   * Clean up all resources
   */
  destroy() {
    throw new Error('RendererInterface.destroy() must be implemented')
  }

  /**
   * Resize all outputs and refresh context
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    throw new Error('RendererInterface.resize() must be implemented')
  }

  // ============================================================
  // Output Management
  // ============================================================

  /**
   * Create an output buffer (o0, o1, o2, o3)
   * @param {number} index - Output index
   * @param {Object} options - { width, height, label }
   * @returns {OutputBuffer} - Renderer-specific output buffer
   */
  createOutput(index, options = {}) {
    throw new Error('RendererInterface.createOutput() must be implemented')
  }

  /**
   * Get an output by index
   * @param {number} index
   * @returns {OutputBuffer}
   */
  getOutput(index) {
    throw new Error('RendererInterface.getOutput() must be implemented')
  }

  // ============================================================
  // Source Management
  // ============================================================

  /**
   * Create a source for external input (video, image, canvas)
   * @param {number} index - Source index
   * @param {Object} options - { width, height, label }
   * @returns {Source} - Renderer-specific source
   */
  createSource(index, options = {}) {
    throw new Error('RendererInterface.createSource() must be implemented')
  }

  // ============================================================
  // Rendering
  // ============================================================

  /**
   * Render a compiled pass to an output
   * Called by Output.render() internally
   * @param {OutputBuffer} output - Target output
   * @param {Object} pass - { frag, uniforms }
   */
  renderPass(output, pass) {
    throw new Error('RendererInterface.renderPass() must be implemented')
  }

  /**
   * Execute a tick on an output (runs the compiled draw command)
   * @param {OutputBuffer} output
   * @param {Object} props - { time, mouse, bpm, resolution }
   */
  tickOutput(output, props) {
    throw new Error('RendererInterface.tickOutput() must be implemented')
  }

  /**
   * Render a single output to the canvas
   * @param {OutputBuffer} output - Source output to display
   */
  renderToScreen(output) {
    throw new Error('RendererInterface.renderToScreen() must be implemented')
  }

  /**
   * Render all 4 outputs in a 2x2 grid to the canvas
   * @param {Array<OutputBuffer>} outputs - Array of 4 outputs
   */
  renderAllToScreen(outputs) {
    throw new Error('RendererInterface.renderAllToScreen() must be implemented')
  }

  // ============================================================
  // Capabilities & Info
  // ============================================================

  /**
   * Get renderer capabilities
   * @returns {Object} - { name, glslVersion, ... }
   */
  get capabilities() {
    throw new Error('RendererInterface.capabilities must be implemented')
  }

  /**
   * Get the underlying canvas
   * @returns {HTMLCanvasElement}
   */
  get canvas() {
    throw new Error('RendererInterface.canvas must be implemented')
  }

  /**
   * Get current width
   * @returns {number}
   */
  get width() {
    throw new Error('RendererInterface.width must be implemented')
  }

  /**
   * Get current height
   * @returns {number}
   */
  get height() {
    throw new Error('RendererInterface.height must be implemented')
  }

  // ============================================================
  // Shader Generation Hooks
  // ============================================================

  /**
   * Get the shader language this renderer uses.
   * Used to select 'glsl' or 'wgsl' property from function dictionary.
   * @returns {string} - 'glsl' or 'wgsl'
   */
  get shaderLanguage() {
    return 'glsl'
  }

  /**
   * Get utility functions in the renderer's shader language.
   * @returns {Object} - Map of function name to shader code
   */
  getUtilityFunctions() {
    throw new Error('RendererInterface.getUtilityFunctions() must be implemented')
  }

  /**
   * Build a complete shader from transform info.
   * @param {Object} shaderInfo - { fragColor, uniforms, glslFunctions }
   * @param {Object} options - { precision }
   * @returns {string} - Complete shader source code
   */
  buildShader(shaderInfo, options = {}) {
    throw new Error('RendererInterface.buildShader() must be implemented')
  }

  // ============================================================
  // Extension Points (optional overrides)
  // ============================================================

  /**
   * Called before each frame
   */
  beginFrame() {}

  /**
   * Called after each frame
   */
  endFrame() {}

  /**
   * Hook called when a new transform function is registered.
   * Allows renderer to add shader templates in its native language.
   * @param {Object} transform - Transform definition
   */
  onTransformRegistered(transform) {
    // Optional: renderer can add missing shader templates
  }
}

export default RendererInterface
