// WebGL context management
export class WebGLContext {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.pixelRatio = options.pixelRatio || 1

    // Create WebGL context
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false,
      ...options.contextAttributes
    }

    this.gl = canvas.getContext('webgl', contextOptions) ||
              canvas.getContext('experimental-webgl', contextOptions)

    if (!this.gl) {
      throw new Error('WebGL not supported')
    }

    // Handle context loss
    this.handleContextLost = this.handleContextLost.bind(this)
    this.handleContextRestored = this.handleContextRestored.bind(this)

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false)

    // Set initial state
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.disable(this.gl.CULL_FACE)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
  }

  handleContextLost(event) {
    event.preventDefault()
    console.warn('WebGL context lost')
  }

  handleContextRestored() {
    console.log('WebGL context restored')
  }

  clear(color = [0, 0, 0, 1]) {
    const gl = this.gl
    gl.clearColor(color[0], color[1], color[2], color[3])
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  viewport(x, y, width, height) {
    this.gl.viewport(x, y, width, height)
  }

  refresh() {
    // Force WebGL to refresh state
    this.gl.flush()
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
  }
}
