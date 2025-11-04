// Framebuffer management
import { Texture } from './texture.js'

export class Framebuffer {
  constructor(gl, options = {}) {
    this.gl = gl
    this.framebuffer = gl.createFramebuffer()
    this.width = options.width || 1
    this.height = options.height || 1

    // Create color attachment texture
    const textureOptions = {
      width: this.width,
      height: this.height,
      format: options.format || 'rgba',
      type: options.type || 'uint8',
      min: options.min || 'nearest',
      mag: options.mag || 'nearest',
      wrapS: options.wrapS || 'clamp',
      wrapT: options.wrapT || 'clamp'
    }

    this.color = new Texture(gl, textureOptions)

    // Attach texture to framebuffer
    this.bind()
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.color.texture,
      0
    )

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete:', this.getStatusString(status))
    }

    this.unbind()
  }

  getStatusString(status) {
    const gl = this.gl
    const statusMap = {
      [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
      [gl.FRAMEBUFFER_UNSUPPORTED]: 'FRAMEBUFFER_UNSUPPORTED'
    }
    return statusMap[status] || 'UNKNOWN_ERROR'
  }

  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer)
  }

  unbind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  resize(width, height) {
    if (this.width === width && this.height === height) {
      return
    }

    this.width = width
    this.height = height
    this.color.resize(width, height)

    // Re-attach texture to framebuffer
    this.bind()
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.color.texture,
      0
    )
    this.unbind()
  }

  destroy() {
    if (this.color) {
      this.color.destroy()
      this.color = null
    }
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer)
      this.framebuffer = null
    }
  }
}
