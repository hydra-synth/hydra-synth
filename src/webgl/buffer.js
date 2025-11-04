// Vertex buffer management
export class Buffer {
  constructor(gl, data, usage = null) {
    this.gl = gl
    this.buffer = gl.createBuffer()
    this.usage = usage || gl.STATIC_DRAW

    if (data) {
      this.setData(data)
    }
  }

  setData(data) {
    const gl = this.gl

    // Convert data to Float32Array if needed
    let bufferData = data
    if (Array.isArray(data)) {
      // Flatten nested arrays if needed
      const flattened = this.flattenArray(data)
      bufferData = new Float32Array(flattened)
    } else if (!(data instanceof Float32Array)) {
      bufferData = new Float32Array(data)
    }

    this.bind()
    gl.bufferData(gl.ARRAY_BUFFER, bufferData, this.usage)
    this.length = bufferData.length
  }

  flattenArray(arr) {
    const result = []
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        result.push(...arr[i])
      } else {
        result.push(arr[i])
      }
    }
    return result
  }

  bind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer)
  }

  unbind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
  }

  destroy() {
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer)
      this.buffer = null
    }
  }
}
