// VertexSource: Chainable vertex transforms
// Usage: tri(0.3).rotate(() => time).scale(0.5)
// Then pass to out(): osc(10).out(o0, tri(0.3).rotate(0.5), 1)

class VertexSource {
  constructor(vertices) {
    // Raw vertex array (flat [x,y, x,y, ...] or [x,y,z, ...])
    this.vertices = vertices
    // Accumulated transforms
    this.transforms = []
  }

  // Get raw vertices (for backward compat or direct access)
  get verts() {
    return this.vertices
  }

  // Check if this has any transforms
  get hasTransforms() {
    return this.transforms.length > 0
  }

  // Add a transform to the chain
  _addTransform(type, args) {
    this.transforms.push({ type, args })
    return this
  }

  // Chainable transforms

  rotate(angle = 0) {
    return this._addTransform('rotate', { angle })
  }

  scale(x = 1, y) {
    // If only one arg, use for both x and y
    if (y === undefined) y = x
    return this._addTransform('scale', { x, y })
  }

  offset(x = 0, y = 0) {
    return this._addTransform('offset', { x, y })
  }

  // Alias for offset
  translate(x = 0, y = 0) {
    return this.offset(x, y)
  }

  // ========== Immediate transforms (CPU, modify vertex array) ==========

  // Mirror geometry across an axis
  // axis: 'x', 'y', or 'xy' (both)
  mirror(axis = 'x') {
    const orig = this.vertices
    const mirrored = []
    const stride = 2  // 2D vertices

    for (let i = 0; i < orig.length; i += stride) {
      const x = orig[i]
      const y = orig[i + 1]
      if (axis === 'x' || axis === 'xy') {
        mirrored.push(-x, y)
      }
      if (axis === 'y') {
        mirrored.push(x, -y)
      }
      if (axis === 'xy' && axis !== 'x') {
        // xy already pushed x-mirror, now push y-mirror of original
      }
    }

    // For 'xy', also add y-mirrored and xy-mirrored
    if (axis === 'xy') {
      for (let i = 0; i < orig.length; i += stride) {
        mirrored.push(orig[i], -orig[i + 1])  // y-mirror
      }
      for (let i = 0; i < orig.length; i += stride) {
        mirrored.push(-orig[i], -orig[i + 1])  // xy-mirror
      }
    }

    this.vertices = [...orig, ...mirrored]
    return this
  }

  // Repeat geometry in a grid pattern
  // nx, ny: number of copies in x and y directions
  // spacing: distance between copies (in NDC)
  repeat(nx = 2, ny = 1, spacing = 0.5) {
    const orig = this.vertices
    const repeated = []
    const stride = 2

    // Calculate offset to center the grid
    const offsetX = -((nx - 1) * spacing) / 2
    const offsetY = -((ny - 1) * spacing) / 2

    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const dx = offsetX + ix * spacing
        const dy = offsetY + iy * spacing

        for (let i = 0; i < orig.length; i += stride) {
          repeated.push(orig[i] + dx, orig[i + 1] + dy)
        }
      }
    }

    this.vertices = repeated
    return this
  }
}

// Generate vertex shader GLSL from transforms
// Returns { glsl: string, uniforms: object }
export function generateVertexGlsl(vertexSource, precision) {
  if (!vertexSource.hasTransforms) {
    // No transforms - use simple passthrough with bounds
    return {
      glsl: `
        precision ${precision} float;
        attribute vec3 position;
        varying vec2 uv;

        uniform vec2 u_boundsMin;
        uniform vec2 u_boundsMax;

        void main () {
          // UV normalized to shape bounds (texture fills the shape)
          uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      uniforms: {}
    }
  }

  // Collect uniforms and build transform code
  const uniforms = {}
  const uniformDecls = []
  const transformCode = []

  vertexSource.transforms.forEach((transform, i) => {
    const suffix = i // Unique suffix for each transform's uniforms

    switch (transform.type) {
      case 'rotate': {
        const uniformName = `u_rotate_${suffix}`
        uniformDecls.push(`uniform float ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle)
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          }
        `)
        break
      }

      case 'scale': {
        const uniformName = `u_scale_${suffix}`
        uniformDecls.push(`uniform vec2 ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y])
        transformCode.push(`
          pos *= ${uniformName};
        `)
        break
      }

      case 'offset': {
        const uniformName = `u_offset_${suffix}`
        uniformDecls.push(`uniform vec2 ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y])
        transformCode.push(`
          pos += ${uniformName};
        `)
        break
      }
    }
  })

  const glsl = `
    precision ${precision} float;
    attribute vec3 position;
    varying vec2 uv;

    uniform vec2 u_boundsMin;
    uniform vec2 u_boundsMax;
    ${uniformDecls.join('\n    ')}

    void main () {
      // UV normalized to shape bounds (texture fills the shape)
      uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);

      // Apply transforms
      vec2 pos = position.xy;
      ${transformCode.join('\n      ')}

      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `

  return { glsl, uniforms }
}

// Create a uniform accessor function that handles static values and lambdas
function makeUniformAccessor(value) {
  return (context, props) => {
    // Handle array of values (may contain lambdas)
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'function' ? v() : v)
    }
    // Handle single lambda
    if (typeof value === 'function') {
      return value()
    }
    // Static value
    return value
  }
}

// Generate WGSL vertex shader from transforms
// Returns { wgsl: string, uniforms: array of {name, type, value} }
export function generateVertexWgsl(vertexSource) {
  // Collect uniforms and build transform code
  const uniforms = []
  const transformCode = []

  if (vertexSource.hasTransforms) {
    vertexSource.transforms.forEach((transform, i) => {
      const suffix = i

      switch (transform.type) {
        case 'rotate': {
          const uniformName = `u_rotate_${suffix}`
          uniforms.push({ name: uniformName, type: 'f32', value: transform.args.angle })
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec2f(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      }`)
          break
        }

        case 'scale': {
          const uniformName = `u_scale_${suffix}`
          uniforms.push({ name: uniformName, type: 'vec2f', value: [transform.args.x, transform.args.y] })
          transformCode.push(`
      pos *= vtx.${uniformName};`)
          break
        }

        case 'offset': {
          const uniformName = `u_offset_${suffix}`
          uniforms.push({ name: uniformName, type: 'vec2f', value: [transform.args.x, transform.args.y] })
          transformCode.push(`
      pos += vtx.${uniformName};`)
          break
        }
      }
    })
  }

  // Build the uniform struct - always include bounds, plus any transform uniforms
  // Note: bounds uniforms (u_boundsMin, u_boundsMax) are prepended by outputWgsl.js
  const allUniformFields = [
    '  u_boundsMin: vec2f,',
    '  u_boundsMax: vec2f,',
    ...uniforms.map(u => `  ${u.name}: ${u.type},`)
  ]
  const uniformStruct = `struct VertexUniforms {
${allUniformFields.join('\n')}
};
@group(2) @binding(0) var<uniform> vtx: VertexUniforms;
`

  // Build the vertex shader
  const wgsl = `struct VertexInput {
  @location(0) position: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

${uniformStruct}
@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // UV normalized to shape bounds (texture fills the shape)
  output.texcoord = (input.position.xy - vtx.u_boundsMin) / (vtx.u_boundsMax - vtx.u_boundsMin);

  // Apply transforms
  var pos = input.position.xy;
${transformCode.join('\n')}

  output.position = vec4f(pos, 0.0, 1.0);
  return output;
}
`

  return { wgsl, uniforms }
}

// Generate passthrough WGSL vertex shader (no transforms)
// Note: bounds uniforms are added by outputWgsl.js
export function getPassthroughVertexWgsl() {
  return `struct VertexInput {
  @location(0) position: vec3f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

struct VertexUniforms {
  u_boundsMin: vec2f,
  u_boundsMax: vec2f,
};
@group(2) @binding(0) var<uniform> vtx: VertexUniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  // UV normalized to shape bounds (texture fills the shape)
  output.texcoord = (input.position.xy - vtx.u_boundsMin) / (vtx.u_boundsMax - vtx.u_boundsMin);
  output.position = vec4f(input.position.xy, 0.0, 1.0);
  return output;
}
`
}

export default VertexSource
