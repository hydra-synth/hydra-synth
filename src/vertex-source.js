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

  // 3D rotations
  rotateX(angle = 0) {
    return this._addTransform('rotateX', { angle })
  }

  rotateY(angle = 0) {
    return this._addTransform('rotateY', { angle })
  }

  rotateZ(angle = 0) {
    return this._addTransform('rotateZ', { angle })
  }

  scale(x = 1, y, z) {
    // If only one arg, use for all axes
    if (y === undefined) y = x
    if (z === undefined) z = 1
    return this._addTransform('scale', { x, y, z })
  }

  offset(x = 0, y = 0, z = 0) {
    return this._addTransform('offset', { x, y, z })
  }

  // Alias for offset
  translate(x = 0, y = 0, z = 0) {
    return this.offset(x, y, z)
  }

  // Set perspective projection
  perspective(fov = 45, near = 0.1, far = 100) {
    return this._addTransform('perspective', { fov, near, far })
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
// Options: { useExplicitUVs: boolean, useFaceIds: boolean, useNormals: boolean, useTangents: boolean }
export function generateVertexGlsl(vertexSource, precision, options = {}) {
  const { useExplicitUVs = false, useFaceIds = false, useNormals = false, useTangents = false } = options

  // UV source code - either from attribute or computed from bounds
  const uvAttributeDecl = useExplicitUVs ? 'attribute vec2 texcoord;' : ''
  const uvComputation = useExplicitUVs
    ? 'uv = texcoord;'
    : 'uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);'

  // FaceId for per-face materials (used with sprite sheets)
  // Always declare varying, but only declare attribute if faceIds are provided
  const faceIdAttributeDecl = useFaceIds ? 'attribute float faceId;' : ''
  const faceIdVaryingDecl = 'varying float v_faceId;'  // Always declare for fragment shader compatibility
  const faceIdPassthrough = useFaceIds ? 'v_faceId = faceId;' : 'v_faceId = 0.0;'

  // Normal attribute - only if model has normals
  const normalAttributeDecl = useNormals ? 'attribute vec3 normal;' : ''

  // Tangent attribute - vec4: xyz = tangent direction, w = handedness for bitangent
  const tangentAttributeDecl = useTangents ? 'attribute vec4 tangent;' : ''

  if (!vertexSource.hasTransforms) {
    // No transforms - use simple passthrough with bounds
    return {
      glsl: `
        precision ${precision} float;
        attribute vec3 position;
        ${uvAttributeDecl}
        ${faceIdAttributeDecl}
        varying vec2 uv;
        ${faceIdVaryingDecl}

        // Vertex data for fragment shader (default values for 2D)
        varying vec3 v_position;
        varying vec3 v_normal;
        varying vec3 v_worldNormal;
        varying vec3 v_tangent;
        varying vec3 v_bitangent;
        varying vec3 v_viewDir;
        varying float v_depth;

        uniform vec2 u_boundsMin;
        uniform vec2 u_boundsMax;

        void main () {
          // UV ${useExplicitUVs ? 'from explicit attribute' : 'normalized to shape bounds'}
          ${uvComputation}
          ${faceIdPassthrough}

          // Set default vertex data for 2D geometry
          v_position = vec3(position.xy, 0.0);
          v_normal = vec3(0.0, 0.0, 1.0);
          v_worldNormal = vec3(0.0, 0.0, 1.0);
          v_tangent = vec3(1.0, 0.0, 0.0);
          v_bitangent = vec3(0.0, 1.0, 0.0);
          v_viewDir = vec3(0.0, 0.0, 1.0);
          v_depth = 1.0;

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
  const normalTransformCode = []  // Rotation transforms for normals (no scale/offset)
  const tangentTransformCode = []  // Rotation transforms for tangents (same as normals)

  // Check if any 3D transforms are used
  const has3D = vertexSource.transforms.some(t =>
    ['rotateX', 'rotateY', 'rotateZ', 'perspective'].includes(t.type) ||
    (t.type === 'offset' && t.args.z !== 0)
  )

  let hasPerspective = false
  let perspectiveUniform = null

  vertexSource.transforms.forEach((transform, i) => {
    const suffix = i // Unique suffix for each transform's uniforms

    switch (transform.type) {
      case 'rotate': {
        const uniformName = `u_rotate_${suffix}`
        uniformDecls.push(`uniform float ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle)
        if (has3D) {
          // 2D rotate = rotate around Z axis
          const rotateCode = `
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
          }`
          transformCode.push(rotateCode)
          // Apply same rotation to normal (using nrm variable)
          normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
          }`)
          // Apply same rotation to tangent
          tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
          }`)
        } else {
          transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          }`)
        }
        break
      }

      case 'rotateX': {
        const uniformName = `u_rotateX_${suffix}`
        uniformDecls.push(`uniform float ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle)
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);
          }`)
        // Apply same rotation to normal
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x, nrm.y * c - nrm.z * s, nrm.y * s + nrm.z * c);
          }`)
        // Apply same rotation to tangent
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x, tang.y * c - tang.z * s, tang.y * s + tang.z * c);
          }`)
        break
      }

      case 'rotateY': {
        const uniformName = `u_rotateY_${suffix}`
        uniformDecls.push(`uniform float ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle)
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c + pos.z * s, pos.y, -pos.x * s + pos.z * c);
          }`)
        // Apply same rotation to normal
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c + nrm.z * s, nrm.y, -nrm.x * s + nrm.z * c);
          }`)
        // Apply same rotation to tangent
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c + tang.z * s, tang.y, -tang.x * s + tang.z * c);
          }`)
        break
      }

      case 'rotateZ': {
        const uniformName = `u_rotateZ_${suffix}`
        uniformDecls.push(`uniform float ${uniformName};`)
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle)
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
          }`)
        // Apply same rotation to normal
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
          }`)
        // Apply same rotation to tangent
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
          }`)
        break
      }

      case 'scale': {
        const uniformName = `u_scale_${suffix}`
        if (has3D) {
          uniformDecls.push(`uniform vec3 ${uniformName};`)
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y, transform.args.z || 1])
          transformCode.push(`
          pos *= ${uniformName};`)
        } else {
          uniformDecls.push(`uniform vec2 ${uniformName};`)
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y])
          transformCode.push(`
          pos *= ${uniformName};`)
        }
        break
      }

      case 'offset': {
        const uniformName = `u_offset_${suffix}`
        if (has3D) {
          uniformDecls.push(`uniform vec3 ${uniformName};`)
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y, transform.args.z || 0])
          transformCode.push(`
          pos += ${uniformName};`)
        } else {
          uniformDecls.push(`uniform vec2 ${uniformName};`)
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y])
          transformCode.push(`
          pos += ${uniformName};`)
        }
        break
      }

      case 'perspective': {
        hasPerspective = true
        perspectiveUniform = `u_perspective_${suffix}`
        uniformDecls.push(`uniform vec3 ${perspectiveUniform};`) // fov, near, far
        uniforms[perspectiveUniform] = makeUniformAccessor([
          transform.args.fov, transform.args.near, transform.args.far
        ])
        break
      }
    }
  })

  let glsl
  if (has3D) {
    const projectionCode = hasPerspective ? `
      // Perspective projection with aspect ratio correction
      float fov = ${perspectiveUniform}.x;
      float near = ${perspectiveUniform}.y;
      float far = ${perspectiveUniform}.z;
      float f = 1.0 / tan(radians(fov) / 2.0);
      float aspect = resolution.x / resolution.y;
      float rangeInv = 1.0 / (near - far);

      // Move camera back
      pos.z -= 2.0;

      // Apply perspective
      float w = -pos.z;
      gl_Position = vec4(
        pos.x * f / aspect,
        pos.y * f,
        (pos.z * (near + far) + 2.0 * near * far) * rangeInv,
        w
      );` : `
      // Simple projection - just use z for depth, no perspective divide
      float aspect = resolution.x / resolution.y;
      gl_Position = vec4(pos.x / aspect, pos.y, pos.z * 0.1, 1.0);`

    // Model space normal (raw from vertex buffer)
    const normalInit = useNormals ? `vec3 nrm = normalize(normal);` : `vec3 nrm = vec3(0.0, 0.0, 1.0);`

    // Tangent initialization (vec4: xyz = tangent, w = handedness)
    // Note: use 'tang' not 'tan' to avoid collision with GLSL built-in tan() function
    const tangentInit = useTangents
      ? `vec3 tang = normalize(tangent.xyz);
      float tanW = tangent.w;`
      : `vec3 tang = vec3(1.0, 0.0, 0.0);
      float tanW = 1.0;`

    // World space normal computation (apply rotation transforms)
    const worldNormalCode = normalTransformCode.length > 0
      ? `// Apply rotation transforms to normal for world space
      ${normalTransformCode.join('\n      ')}
      v_worldNormal = normalize(nrm);`
      : `v_worldNormal = nrm;`

    // World space tangent computation (apply rotation transforms)
    const worldTangentCode = tangentTransformCode.length > 0
      ? `// Apply rotation transforms to tangent for world space
      ${tangentTransformCode.join('\n      ')}
      v_tangent = normalize(tang);`
      : `v_tangent = tang;`

    glsl = `
    precision ${precision} float;
    attribute vec3 position;
    ${uvAttributeDecl}
    ${faceIdAttributeDecl}
    ${normalAttributeDecl}
    ${tangentAttributeDecl}
    varying vec2 uv;
    ${faceIdVaryingDecl}

    // Vertex data for fragment shader
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec3 v_worldNormal;
    varying vec3 v_tangent;
    varying vec3 v_bitangent;
    varying vec3 v_viewDir;
    varying float v_depth;

    uniform vec2 resolution;
    uniform vec2 u_boundsMin;
    uniform vec2 u_boundsMax;
    ${uniformDecls.join('\n    ')}

    void main () {
      // UV ${useExplicitUVs ? 'from explicit attribute' : 'normalized to shape bounds'}
      ${uvComputation}
      ${faceIdPassthrough}

      // Apply transforms (3D)
      vec3 pos = position;
      ${transformCode.join('\n      ')}

      // Compute vertex data for fragment shader
      v_position = pos;

      // Model space normal (raw from vertex buffer)
      ${normalInit}
      v_normal = nrm;

      // World space normal (after rotation transforms)
      ${worldNormalCode}

      // Tangent and bitangent for normal mapping
      ${tangentInit}
      ${worldTangentCode}
      // Bitangent = cross(normal, tangent) * handedness
      v_bitangent = cross(v_worldNormal, v_tangent) * tanW;

      // Camera is at z = 2.0 (matching perspective projection)
      vec3 cameraPos = vec3(0.0, 0.0, 2.0);
      v_viewDir = normalize(cameraPos - pos);

      // Normalized depth: 0 = at camera, 1 = at far plane (approx 4 units away)
      float dist = length(cameraPos - pos);
      v_depth = clamp(dist / 4.0, 0.0, 1.0);

      ${projectionCode}
    }
  `
  } else {
    glsl = `
    precision ${precision} float;
    attribute vec3 position;
    ${uvAttributeDecl}
    ${faceIdAttributeDecl}
    varying vec2 uv;
    ${faceIdVaryingDecl}

    // Vertex data for fragment shader (default values for 2D)
    varying vec3 v_position;
    varying vec3 v_normal;
    varying vec3 v_worldNormal;
    varying vec3 v_tangent;
    varying vec3 v_bitangent;
    varying vec3 v_viewDir;
    varying float v_depth;

    uniform vec2 u_boundsMin;
    uniform vec2 u_boundsMax;
    ${uniformDecls.join('\n    ')}

    void main () {
      // UV ${useExplicitUVs ? 'from explicit attribute' : 'normalized to shape bounds'}
      ${uvComputation}
      ${faceIdPassthrough}

      // Apply transforms (2D)
      vec2 pos = position.xy;
      ${transformCode.join('\n      ')}

      // Set default vertex data for 2D geometry
      v_position = vec3(pos, 0.0);
      v_normal = vec3(0.0, 0.0, 1.0);  // Facing camera
      v_worldNormal = vec3(0.0, 0.0, 1.0);  // Same as normal for 2D
      v_tangent = vec3(1.0, 0.0, 0.0);
      v_bitangent = vec3(0.0, 1.0, 0.0);
      v_viewDir = vec3(0.0, 0.0, 1.0);  // Looking at camera
      v_depth = 1.0;

      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `
  }

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
// Options: { useExplicitUVs: boolean, useFaceIds: boolean, useNormals: boolean, useTangents: boolean }
export function generateVertexWgsl(vertexSource, options = {}) {
  const { useExplicitUVs = false, useFaceIds = false, useNormals = false, useTangents = false } = options

  // Collect uniforms and build transform code
  const uniforms = []
  const transformCode = []
  const normalTransformCode = []  // Rotation transforms for normals (no scale/offset)
  const tangentTransformCode = []  // Rotation transforms for tangents (same as normals)

  // Check if any 3D transforms are used
  const has3D = vertexSource.hasTransforms && vertexSource.transforms.some(t =>
    ['rotateX', 'rotateY', 'rotateZ', 'perspective'].includes(t.type) ||
    (t.type === 'offset' && t.args.z !== 0)
  )

  let hasPerspective = false
  let perspectiveUniform = null

  if (vertexSource.hasTransforms) {
    vertexSource.transforms.forEach((transform, i) => {
      const suffix = i

      switch (transform.type) {
        case 'rotate': {
          const uniformName = `u_rotate_${suffix}`
          uniforms.push({ name: uniformName, type: 'f32', value: transform.args.angle })
          if (has3D) {
            transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
      }`)
            // Apply same rotation to normal
            normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
      }`)
            // Apply same rotation to tangent
            tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
      }`)
          } else {
            transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec2f(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      }`)
          }
          break
        }

        case 'rotateX': {
          const uniformName = `u_rotateX_${suffix}`
          uniforms.push({ name: uniformName, type: 'f32', value: transform.args.angle })
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);
      }`)
          // Apply same rotation to normal
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x, nrm.y * c - nrm.z * s, nrm.y * s + nrm.z * c);
      }`)
          // Apply same rotation to tangent
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x, tang.y * c - tang.z * s, tang.y * s + tang.z * c);
      }`)
          break
        }

        case 'rotateY': {
          const uniformName = `u_rotateY_${suffix}`
          uniforms.push({ name: uniformName, type: 'f32', value: transform.args.angle })
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c + pos.z * s, pos.y, -pos.x * s + pos.z * c);
      }`)
          // Apply same rotation to normal
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c + nrm.z * s, nrm.y, -nrm.x * s + nrm.z * c);
      }`)
          // Apply same rotation to tangent
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c + tang.z * s, tang.y, -tang.x * s + tang.z * c);
      }`)
          break
        }

        case 'rotateZ': {
          const uniformName = `u_rotateZ_${suffix}`
          uniforms.push({ name: uniformName, type: 'f32', value: transform.args.angle })
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
      }`)
          // Apply same rotation to normal
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
      }`)
          // Apply same rotation to tangent
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
      }`)
          break
        }

        case 'scale': {
          const uniformName = `u_scale_${suffix}`
          if (has3D) {
            uniforms.push({ name: uniformName, type: 'vec3f', value: [transform.args.x, transform.args.y, transform.args.z || 1] })
          } else {
            uniforms.push({ name: uniformName, type: 'vec2f', value: [transform.args.x, transform.args.y] })
          }
          transformCode.push(`
      pos *= vtx.${uniformName};`)
          break
        }

        case 'offset': {
          const uniformName = `u_offset_${suffix}`
          if (has3D) {
            uniforms.push({ name: uniformName, type: 'vec3f', value: [transform.args.x, transform.args.y, transform.args.z || 0] })
          } else {
            uniforms.push({ name: uniformName, type: 'vec2f', value: [transform.args.x, transform.args.y] })
          }
          transformCode.push(`
      pos += vtx.${uniformName};`)
          break
        }

        case 'perspective': {
          hasPerspective = true
          perspectiveUniform = `u_perspective_${suffix}`
          uniforms.push({ name: perspectiveUniform, type: 'vec3f', value: [transform.args.fov, transform.args.near, transform.args.far] })
          break
        }
      }
    })
  }

  // Build the uniform struct - always include bounds, plus any transform uniforms
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

  // Build vertex input struct - only include attributes that have buffers
  const inputFields = ['  @location(0) position: vec3f,']
  if (useExplicitUVs) {
    inputFields.push('  @location(1) texcoord: vec2f,')
  }
  if (useFaceIds) {
    inputFields.push('  @location(2) faceId: f32,')
  }
  if (useNormals) {
    inputFields.push('  @location(3) normal: vec3f,')
  }
  if (useTangents) {
    inputFields.push('  @location(4) tangent: vec4f,')  // xyz = tangent direction, w = handedness
  }

  // Build vertex output struct
  const outputFields = [
    '  @builtin(position) position: vec4f,',
    '  @location(0) texcoord: vec2f,',
    '  @location(1) faceId: f32,',  // Always include for fragment shader compatibility
    '  // Vertex data for fragment shader',
    '  @location(2) v_position: vec3f,',
    '  @location(3) v_normal: vec3f,',
    '  @location(4) v_worldNormal: vec3f,',
    '  @location(5) v_tangent: vec3f,',
    '  @location(6) v_bitangent: vec3f,',
    '  @location(7) v_viewDir: vec3f,',
    '  @location(8) v_depth: f32,'
  ]

  // UV computation
  const uvCode = useExplicitUVs
    ? 'output.texcoord = input.texcoord;'
    : 'output.texcoord = (input.position.xy - vtx.u_boundsMin) / (vtx.u_boundsMax - vtx.u_boundsMin);'

  // FaceId passthrough
  const faceIdCode = useFaceIds
    ? 'output.faceId = input.faceId;'
    : 'output.faceId = 0.0;'

  // Build the vertex shader
  let wgsl
  if (has3D) {
    const projectionCode = hasPerspective ? `
      // Perspective projection with aspect ratio correction
      let fov = vtx.${perspectiveUniform}.x;
      let near = vtx.${perspectiveUniform}.y;
      let far = vtx.${perspectiveUniform}.z;
      let f = 1.0 / tan(radians(fov) / 2.0);
      let aspect = resolution.x / resolution.y;
      let rangeInv = 1.0 / (near - far);

      // Move camera back
      pos.z -= 2.0;

      // Apply perspective
      let w = -pos.z;
      output.position = vec4f(
        pos.x * f / aspect,
        pos.y * f,
        (pos.z * (near + far) + 2.0 * near * far) * rangeInv,
        w
      );` : `
      // Simple projection - just use z for depth, no perspective divide
      let aspect = resolution.x / resolution.y;
      output.position = vec4f(pos.x / aspect, pos.y, pos.z * 0.1, 1.0);`

    // Model space normal initialization
    const normalInit = useNormals ? 'var nrm = normalize(input.normal);' : 'var nrm = vec3f(0.0, 0.0, 1.0);'

    // Tangent initialization (vec4: xyz = tangent, w = handedness)
    // Note: use 'tang' not 'tan' to avoid collision with WGSL built-in tan() function
    const tangentInit = useTangents
      ? `var tang = normalize(input.tangent.xyz);
  let tanW = input.tangent.w;`
      : `var tang = vec3f(1.0, 0.0, 0.0);
  let tanW = 1.0;`

    // World space normal computation (apply rotation transforms)
    const worldNormalCode = normalTransformCode.length > 0
      ? `// Apply rotation transforms to normal for world space
${normalTransformCode.join('\n')}
  output.v_worldNormal = normalize(nrm);`
      : `output.v_worldNormal = nrm;`

    // World space tangent computation (apply rotation transforms)
    const worldTangentCode = tangentTransformCode.length > 0
      ? `// Apply rotation transforms to tangent for world space
${tangentTransformCode.join('\n')}
  output.v_tangent = normalize(tang);`
      : `output.v_tangent = tang;`

    wgsl = `struct VertexInput {
${inputFields.join('\n')}
};

struct VertexOutput {
${outputFields.join('\n')}
};

@group(0) @binding(1) var<uniform> resolution: vec2f;
${uniformStruct}
@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // UV
  ${uvCode}
  // FaceId
  ${faceIdCode}

  // Apply transforms (3D)
  var pos = input.position;
${transformCode.join('\n')}

  // Compute vertex data for fragment shader
  output.v_position = pos;

  // Model space normal (raw from vertex buffer)
  ${normalInit}
  output.v_normal = nrm;

  // World space normal (after rotation transforms)
  ${worldNormalCode}

  // Tangent and bitangent for normal mapping
  ${tangentInit}
  ${worldTangentCode}
  // Bitangent = cross(normal, tangent) * handedness
  output.v_bitangent = cross(output.v_worldNormal, output.v_tangent) * tanW;

  let cameraPos = vec3f(0.0, 0.0, 2.0);
  output.v_viewDir = normalize(cameraPos - pos);

  // Normalized depth: 0 = at camera, 1 = at far plane (approx 4 units away)
  let dist = length(cameraPos - pos);
  output.v_depth = clamp(dist / 4.0, 0.0, 1.0);

  ${projectionCode}
  return output;
}
`
  } else {
    wgsl = `struct VertexInput {
${inputFields.join('\n')}
};

struct VertexOutput {
${outputFields.join('\n')}
};

${uniformStruct}
@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  // UV
  ${uvCode}
  // FaceId
  ${faceIdCode}

  // Apply transforms (2D)
  var pos = input.position.xy;
${transformCode.join('\n')}

  // Set default vertex data for 2D geometry
  output.v_position = vec3f(pos, 0.0);
  output.v_normal = vec3f(0.0, 0.0, 1.0);  // Facing camera
  output.v_worldNormal = vec3f(0.0, 0.0, 1.0);  // Same as normal for 2D
  output.v_tangent = vec3f(1.0, 0.0, 0.0);
  output.v_bitangent = vec3f(0.0, 1.0, 0.0);
  output.v_viewDir = vec3f(0.0, 0.0, 1.0);  // Looking at camera
  output.v_depth = 1.0;

  output.position = vec4f(pos, 0.0, 1.0);
  return output;
}
`
  }

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
  @location(1) faceId: f32,
  // Vertex data for fragment shader
  @location(2) v_position: vec3f,
  @location(3) v_normal: vec3f,
  @location(4) v_worldNormal: vec3f,
  @location(5) v_tangent: vec3f,
  @location(6) v_bitangent: vec3f,
  @location(7) v_viewDir: vec3f,
  @location(8) v_depth: f32,
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
  output.faceId = 0.0;

  // Set default vertex data for 2D geometry
  output.v_position = vec3f(input.position.xy, 0.0);
  output.v_normal = vec3f(0.0, 0.0, 1.0);
  output.v_worldNormal = vec3f(0.0, 0.0, 1.0);
  output.v_tangent = vec3f(1.0, 0.0, 0.0);
  output.v_bitangent = vec3f(0.0, 1.0, 0.0);
  output.v_viewDir = vec3f(0.0, 0.0, 1.0);
  output.v_depth = 1.0;

  output.position = vec4f(input.position.xy, 0.0, 1.0);
  return output;
}
`
}

export default VertexSource
