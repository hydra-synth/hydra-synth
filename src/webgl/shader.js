// Shader compilation and program management
export class Shader {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl
    this.program = null
    this.uniforms = {}
    this.attributes = {}
    this.warnedAttributes = new Set() // Track which attributes we've already warned about

    this.compile(vertexSource, fragmentSource)
  }

  compile(vertexSource, fragmentSource) {
    const gl = this.gl

    // Compile vertex shader
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource)
    if (!vertexShader) {
      throw new Error('Failed to compile vertex shader')
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource)
    if (!fragmentShader) {
      gl.deleteShader(vertexShader)
      throw new Error('Failed to compile fragment shader')
    }

    // Link program
    this.program = gl.createProgram()
    gl.attachShader(this.program, vertexShader)
    gl.attachShader(this.program, fragmentShader)
    gl.linkProgram(this.program)

    // Check for link errors
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program)
      gl.deleteProgram(this.program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      throw new Error('Failed to link shader program: ' + info)
    }

    // Clean up shaders (no longer needed after linking)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    // Cache uniform and attribute locations
    this.cacheLocations()
  }

  compileShader(type, source) {
    const gl = this.gl
    const shader = gl.createShader(type)

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
      console.error(`Failed to compile ${typeName} shader:`, info)
      console.error('Shader source:', source)
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  cacheLocations() {
    const gl = this.gl
    const program = this.program

    // Cache uniform locations
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i)
      if (info) {
        const location = gl.getUniformLocation(program, info.name)
        this.uniforms[info.name] = {
          location,
          type: info.type,
          size: info.size
        }
      }
    }

    // Cache attribute locations
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i)
      if (info) {
        const location = gl.getAttribLocation(program, info.name)
        this.attributes[info.name] = {
          location,
          type: info.type,
          size: info.size
        }
      }
    }
  }

  use() {
    this.gl.useProgram(this.program)
  }

  setUniform(name, value) {
    const gl = this.gl
    const uniform = this.uniforms[name]

    if (!uniform) {
      // Silently ignore missing uniforms (they may be optimized out)
      return
    }

    const loc = uniform.location

    // Handle different uniform types
    switch (uniform.type) {
      case gl.FLOAT:
        gl.uniform1f(loc, value)
        break
      case gl.FLOAT_VEC2:
        gl.uniform2fv(loc, value)
        break
      case gl.FLOAT_VEC3:
        gl.uniform3fv(loc, value)
        break
      case gl.FLOAT_VEC4:
        gl.uniform4fv(loc, value)
        break
      case gl.INT:
      case gl.BOOL:
        gl.uniform1i(loc, value)
        break
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        gl.uniform2iv(loc, value)
        break
      case gl.INT_VEC3:
      case gl.BOOL_VEC3:
        gl.uniform3iv(loc, value)
        break
      case gl.INT_VEC4:
      case gl.BOOL_VEC4:
        gl.uniform4iv(loc, value)
        break
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        gl.uniform1i(loc, value)
        break
      case gl.FLOAT_MAT2:
        gl.uniformMatrix2fv(loc, false, value)
        break
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(loc, false, value)
        break
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(loc, false, value)
        break
      default:
        console.warn(`Unsupported uniform type: ${uniform.type}`)
    }
  }

  setAttribute(name, buffer, size = 3, type = null, normalized = false, stride = 0, offset = 0) {
    const gl = this.gl
    const attribute = this.attributes[name]

    if (!attribute) {
      // Only warn once per attribute name to avoid console spam
      if (!this.warnedAttributes.has(name)) {
        console.warn(`Attribute '${name}' not found in shader`)
        this.warnedAttributes.add(name)
      }
      return
    }

    buffer.bind()
    gl.enableVertexAttribArray(attribute.location)
    gl.vertexAttribPointer(
      attribute.location,
      size,
      type || gl.FLOAT,
      normalized,
      stride,
      offset
    )
  }

  destroy() {
    if (this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null
    }
  }
}
