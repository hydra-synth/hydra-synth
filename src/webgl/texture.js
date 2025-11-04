// Texture management
export class Texture {
  constructor(gl, options = {}) {
    this.gl = gl
    this.texture = gl.createTexture()
    this.width = options.width || 1
    this.height = options.height || 1
    this.format = options.format || 'rgba'
    this.type = options.type || 'uint8'

    // Texture parameters
    this.minFilter = this.parseFilter(options.min || 'nearest')
    this.magFilter = this.parseFilter(options.mag || 'nearest')
    this.wrapS = this.parseWrap(options.wrapS || 'clamp')
    this.wrapT = this.parseWrap(options.wrapT || 'clamp')

    this.bind()
    this.setupTexture(options.data)
    this.setParameters()
  }

  parseFilter(filter) {
    const gl = this.gl
    const filterMap = {
      'nearest': gl.NEAREST,
      'linear': gl.LINEAR,
      'mipmap': gl.LINEAR_MIPMAP_LINEAR
    }
    return filterMap[filter] || gl.NEAREST
  }

  parseWrap(wrap) {
    const gl = this.gl
    const wrapMap = {
      'clamp': gl.CLAMP_TO_EDGE,
      'repeat': gl.REPEAT,
      'mirror': gl.MIRRORED_REPEAT
    }
    return wrapMap[wrap] || gl.CLAMP_TO_EDGE
  }

  getGLFormat() {
    const gl = this.gl
    const formatMap = {
      'alpha': gl.ALPHA,
      'luminance': gl.LUMINANCE,
      'luminance alpha': gl.LUMINANCE_ALPHA,
      'rgb': gl.RGB,
      'rgba': gl.RGBA
    }
    return formatMap[this.format] || gl.RGBA
  }

  getGLType() {
    const gl = this.gl
    const typeMap = {
      'uint8': gl.UNSIGNED_BYTE,
      'uint16': gl.UNSIGNED_SHORT,
      'float': gl.FLOAT
    }
    return typeMap[this.type] || gl.UNSIGNED_BYTE
  }

  setupTexture(data = null) {
    const gl = this.gl
    const glFormat = this.getGLFormat()
    const glType = this.getGLType()

    if (data) {
      // If data is provided (image, video, canvas, etc.)
      if (data instanceof HTMLImageElement ||
          data instanceof HTMLVideoElement ||
          data instanceof HTMLCanvasElement ||
          data instanceof ImageData) {
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, glFormat, glType, data)
        this.width = data.width || data.videoWidth || 1
        this.height = data.height || data.videoHeight || 1
      } else if (ArrayBuffer.isView(data)) {
        // Typed array data
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, data)
      }
    } else {
      // Create empty texture
      gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, null)
    }
  }

  setParameters() {
    const gl = this.gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT)
  }

  bind(unit = 0) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
  }

  unbind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }

  resize(width, height) {
    if (this.width === width && this.height === height) {
      return
    }

    this.width = width
    this.height = height

    this.bind()
    const gl = this.gl
    const glFormat = this.getGLFormat()
    const glType = this.getGLType()
    gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, glType, null)
  }

  subimage(data, x = 0, y = 0) {
    this.bind()
    const gl = this.gl
    const glFormat = this.getGLFormat()
    const glType = this.getGLType()

    if (data instanceof HTMLImageElement ||
        data instanceof HTMLVideoElement ||
        data instanceof HTMLCanvasElement ||
        data instanceof ImageData) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, glFormat, glType, data)
    } else if (ArrayBuffer.isView(data)) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.width, this.height, glFormat, glType, data)
    }
  }

  destroy() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture)
      this.texture = null
    }
  }
}
