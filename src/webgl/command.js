// Draw command abstraction (regl-like interface)
import { Shader } from './shader.js'

export class Command {
  constructor(gl, config) {
    this.gl = gl
    this.config = config
    this.warnedErrors = new Set() // Track errors we've already logged

    // Create shader if vertex and fragment sources provided
    if (config.vert && config.frag) {
      this.shader = new Shader(gl, config.vert, config.frag)
    }

    // Store configuration
    this.attributes = config.attributes || {}
    this.uniforms = config.uniforms || {}
    this.count = config.count || 3
    this.primitive = this.parsePrimitive(config.primitive || 'triangles')
    this.framebuffer = config.framebuffer || null
    this.viewport = config.viewport || null
  }

  parsePrimitive(primitive) {
    const gl = this.gl
    const primitiveMap = {
      'points': gl.POINTS,
      'lines': gl.LINES,
      'line strip': gl.LINE_STRIP,
      'line loop': gl.LINE_LOOP,
      'triangles': gl.TRIANGLES,
      'triangle strip': gl.TRIANGLE_STRIP,
      'triangle fan': gl.TRIANGLE_FAN
    }
    return primitiveMap[primitive] || gl.TRIANGLES
  }

  execute(props = {}) {
    const gl = this.gl

    // Use shader
    if (this.shader) {
      this.shader.use()
    }

    // Bind framebuffer
    const fbo = this.resolveValue(this.framebuffer, props)
    if (fbo) {
      fbo.bind()
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    // Set viewport
    const viewport = this.resolveValue(this.viewport, props)
    if (viewport) {
      gl.viewport(viewport.x || 0, viewport.y || 0, viewport.width, viewport.height)
    }

    // Set attributes
    let textureUnit = 0
    for (const name in this.attributes) {
      const attrConfig = this.attributes[name]
      const value = this.resolveValue(attrConfig, props)

      // Check if value is a Buffer object
      if (value && typeof value.bind === 'function' && !value.texture) {
        const size = attrConfig.size || 2
        this.shader.setAttribute(name, value, size)
      }
    }

    // Set uniforms
    for (const name in this.uniforms) {
      const uniformConfig = this.uniforms[name]
      let value = this.resolveValue(uniformConfig, props)

      // Handle texture binding
      if (value && value.bind && value.texture) {
        // It's a Texture object
        value.bind(textureUnit)
        value = textureUnit
        textureUnit++
      } else if (value && value.color && value.color.bind) {
        // It's a Framebuffer object (use its color texture)
        value.color.bind(textureUnit)
        value = textureUnit
        textureUnit++
      }

      if (this.shader) {
        this.shader.setUniform(name, value)
      }
    }

    // Draw
    const count = this.resolveValue(this.count, props)
    gl.drawArrays(this.primitive, 0, count)

    // Unbind framebuffer
    if (fbo) {
      fbo.unbind()
    }
  }

  resolveValue(value, props) {
    if (typeof value === 'function') {
      try {
        // Uniform functions have signature (context, props, batchId)
        const context = {} // Minimal context object
        const batchId = 0  // Batch ID for draw calls

        const result = value(context, props, batchId)

        // If the result is also a function, call it again with props
        // This handles getValue() which returns a function expecting {time, bpm}
        if (typeof result === 'function') {
          return result(props)
        }
        return result
      } catch (e) {
        // Only warn once per error to avoid console spam
        const errorKey = e.message + value.toString().substring(0, 50)
        if (!this.warnedErrors.has(errorKey)) {
          console.warn('Error resolving uniform:', e.message)
          this.warnedErrors.add(errorKey)
        }
        // Return a safe default instead of throwing
        return 0
      }
    } else if (value && value._isProp) {
      // Handle regl.prop() pattern
      return props[value.name]
    }
    return value
  }

  destroy() {
    if (this.shader) {
      this.shader.destroy()
      this.shader = null
    }
  }
}

// Helper to create regl.prop() equivalent
export function prop(name) {
  return {
    _isProp: true,
    name: name
  }
}
