var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class VertexSource {
  constructor(vertices) {
    this.vertices = vertices;
    this.transforms = [];
  }
  // Get raw vertices (for backward compat or direct access)
  get verts() {
    return this.vertices;
  }
  // Check if this has any transforms
  get hasTransforms() {
    return this.transforms.length > 0;
  }
  // Add a transform to the chain
  _addTransform(type, args) {
    this.transforms.push({ type, args });
    return this;
  }
  // Chainable transforms
  rotate(angle = 0) {
    return this._addTransform("rotate", { angle });
  }
  // 3D rotations
  rotateX(angle = 0) {
    return this._addTransform("rotateX", { angle });
  }
  rotateY(angle = 0) {
    return this._addTransform("rotateY", { angle });
  }
  rotateZ(angle = 0) {
    return this._addTransform("rotateZ", { angle });
  }
  scale(x2 = 1, y, z) {
    if (y === void 0) y = x2;
    if (z === void 0) z = 1;
    return this._addTransform("scale", { x: x2, y, z });
  }
  offset(x2 = 0, y = 0, z = 0) {
    return this._addTransform("offset", { x: x2, y, z });
  }
  // Alias for offset
  translate(x2 = 0, y = 0, z = 0) {
    return this.offset(x2, y, z);
  }
  // Set perspective projection
  perspective(fov = 45, near = 0.1, far = 100) {
    return this._addTransform("perspective", { fov, near, far });
  }
  // ========== Immediate transforms (CPU, modify vertex array) ==========
  // Mirror geometry across an axis
  // axis: 'x', 'y', or 'xy' (both)
  mirror(axis = "x") {
    const orig = this.vertices;
    const mirrored = [];
    const stride = 2;
    for (let i = 0; i < orig.length; i += stride) {
      const x2 = orig[i];
      const y = orig[i + 1];
      if (axis === "x" || axis === "xy") {
        mirrored.push(-x2, y);
      }
      if (axis === "y") {
        mirrored.push(x2, -y);
      }
    }
    if (axis === "xy") {
      for (let i = 0; i < orig.length; i += stride) {
        mirrored.push(orig[i], -orig[i + 1]);
      }
      for (let i = 0; i < orig.length; i += stride) {
        mirrored.push(-orig[i], -orig[i + 1]);
      }
    }
    this.vertices = [...orig, ...mirrored];
    return this;
  }
  // Repeat geometry in a grid pattern
  // nx, ny: number of copies in x and y directions
  // spacing: distance between copies (in NDC)
  repeat(nx = 2, ny = 1, spacing = 0.5) {
    const orig = this.vertices;
    const repeated = [];
    const stride = 2;
    const offsetX = -((nx - 1) * spacing) / 2;
    const offsetY = -((ny - 1) * spacing) / 2;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const dx = offsetX + ix * spacing;
        const dy = offsetY + iy * spacing;
        for (let i = 0; i < orig.length; i += stride) {
          repeated.push(orig[i] + dx, orig[i + 1] + dy);
        }
      }
    }
    this.vertices = repeated;
    return this;
  }
}
function generateVertexGlsl(vertexSource, precision, options = {}) {
  const { useExplicitUVs = false, useFaceIds = false, useNormals = false, useTangents = false } = options;
  const uvAttributeDecl = useExplicitUVs ? "attribute vec2 texcoord;" : "";
  const uvComputation = useExplicitUVs ? "uv = texcoord;" : "uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);";
  const faceIdAttributeDecl = useFaceIds ? "attribute float faceId;" : "";
  const faceIdVaryingDecl = "varying float v_faceId;";
  const faceIdPassthrough = useFaceIds ? "v_faceId = faceId;" : "v_faceId = 0.0;";
  const normalAttributeDecl = useNormals ? "attribute vec3 normal;" : "";
  const tangentAttributeDecl = useTangents ? "attribute vec4 tangent;" : "";
  if (!vertexSource.hasTransforms) {
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
          // UV ${useExplicitUVs ? "from explicit attribute" : "normalized to shape bounds"}
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
    };
  }
  const uniforms = {};
  const uniformDecls = [];
  const transformCode = [];
  const normalTransformCode = [];
  const tangentTransformCode = [];
  const has3D = vertexSource.transforms.some(
    (t) => ["rotateX", "rotateY", "rotateZ", "perspective"].includes(t.type) || t.type === "offset" && t.args.z !== 0
  );
  let hasPerspective = false;
  let perspectiveUniform = null;
  vertexSource.transforms.forEach((transform, i) => {
    const suffix = i;
    switch (transform.type) {
      case "rotate": {
        const uniformName = `u_rotate_${suffix}`;
        uniformDecls.push(`uniform float ${uniformName};`);
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle);
        if (has3D) {
          const rotateCode = `
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
          }`;
          transformCode.push(rotateCode);
          normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
          }`);
          tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
          }`);
        } else {
          transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
          }`);
        }
        break;
      }
      case "rotateX": {
        const uniformName = `u_rotateX_${suffix}`;
        uniformDecls.push(`uniform float ${uniformName};`);
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle);
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);
          }`);
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x, nrm.y * c - nrm.z * s, nrm.y * s + nrm.z * c);
          }`);
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x, tang.y * c - tang.z * s, tang.y * s + tang.z * c);
          }`);
        break;
      }
      case "rotateY": {
        const uniformName = `u_rotateY_${suffix}`;
        uniformDecls.push(`uniform float ${uniformName};`);
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle);
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c + pos.z * s, pos.y, -pos.x * s + pos.z * c);
          }`);
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c + nrm.z * s, nrm.y, -nrm.x * s + nrm.z * c);
          }`);
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c + tang.z * s, tang.y, -tang.x * s + tang.z * c);
          }`);
        break;
      }
      case "rotateZ": {
        const uniformName = `u_rotateZ_${suffix}`;
        uniformDecls.push(`uniform float ${uniformName};`);
        uniforms[uniformName] = makeUniformAccessor(transform.args.angle);
        transformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            pos = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
          }`);
        normalTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            nrm = vec3(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
          }`);
        tangentTransformCode.push(`
          {
            float c = cos(${uniformName});
            float s = sin(${uniformName});
            tang = vec3(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
          }`);
        break;
      }
      case "scale": {
        const uniformName = `u_scale_${suffix}`;
        if (has3D) {
          uniformDecls.push(`uniform vec3 ${uniformName};`);
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y, transform.args.z || 1]);
          transformCode.push(`
          pos *= ${uniformName};`);
        } else {
          uniformDecls.push(`uniform vec2 ${uniformName};`);
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y]);
          transformCode.push(`
          pos *= ${uniformName};`);
        }
        break;
      }
      case "offset": {
        const uniformName = `u_offset_${suffix}`;
        if (has3D) {
          uniformDecls.push(`uniform vec3 ${uniformName};`);
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y, transform.args.z || 0]);
          transformCode.push(`
          pos += ${uniformName};`);
        } else {
          uniformDecls.push(`uniform vec2 ${uniformName};`);
          uniforms[uniformName] = makeUniformAccessor([transform.args.x, transform.args.y]);
          transformCode.push(`
          pos += ${uniformName};`);
        }
        break;
      }
      case "perspective": {
        hasPerspective = true;
        perspectiveUniform = `u_perspective_${suffix}`;
        uniformDecls.push(`uniform vec3 ${perspectiveUniform};`);
        uniforms[perspectiveUniform] = makeUniformAccessor([
          transform.args.fov,
          transform.args.near,
          transform.args.far
        ]);
        break;
      }
    }
  });
  let glsl;
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
      gl_Position = vec4(pos.x / aspect, pos.y, pos.z * 0.1, 1.0);`;
    const normalInit = useNormals ? `vec3 nrm = normalize(normal);` : `vec3 nrm = vec3(0.0, 0.0, 1.0);`;
    const tangentInit = useTangents ? `vec3 tang = normalize(tangent.xyz);
      float tanW = tangent.w;` : `vec3 tang = vec3(1.0, 0.0, 0.0);
      float tanW = 1.0;`;
    const worldNormalCode = normalTransformCode.length > 0 ? `// Apply rotation transforms to normal for world space
      ${normalTransformCode.join("\n      ")}
      v_worldNormal = normalize(nrm);` : `v_worldNormal = nrm;`;
    const worldTangentCode = tangentTransformCode.length > 0 ? `// Apply rotation transforms to tangent for world space
      ${tangentTransformCode.join("\n      ")}
      v_tangent = normalize(tang);` : `v_tangent = tang;`;
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
    ${uniformDecls.join("\n    ")}

    void main () {
      // UV ${useExplicitUVs ? "from explicit attribute" : "normalized to shape bounds"}
      ${uvComputation}
      ${faceIdPassthrough}

      // Apply transforms (3D)
      vec3 pos = position;
      ${transformCode.join("\n      ")}

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
  `;
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
    ${uniformDecls.join("\n    ")}

    void main () {
      // UV ${useExplicitUVs ? "from explicit attribute" : "normalized to shape bounds"}
      ${uvComputation}
      ${faceIdPassthrough}

      // Apply transforms (2D)
      vec2 pos = position.xy;
      ${transformCode.join("\n      ")}

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
  `;
  }
  return { glsl, uniforms };
}
function makeUniformAccessor(value) {
  return (context, props) => {
    if (Array.isArray(value)) {
      return value.map((v2) => typeof v2 === "function" ? v2() : v2);
    }
    if (typeof value === "function") {
      return value();
    }
    return value;
  };
}
function generateVertexWgsl(vertexSource, options = {}) {
  const { useExplicitUVs = false, useFaceIds = false, useNormals = false, useTangents = false } = options;
  const uniforms = [];
  const transformCode = [];
  const normalTransformCode = [];
  const tangentTransformCode = [];
  const has3D = vertexSource.hasTransforms && vertexSource.transforms.some(
    (t) => ["rotateX", "rotateY", "rotateZ", "perspective"].includes(t.type) || t.type === "offset" && t.args.z !== 0
  );
  let hasPerspective = false;
  let perspectiveUniform = null;
  if (vertexSource.hasTransforms) {
    vertexSource.transforms.forEach((transform, i) => {
      const suffix = i;
      switch (transform.type) {
        case "rotate": {
          const uniformName = `u_rotate_${suffix}`;
          uniforms.push({ name: uniformName, type: "f32", value: transform.args.angle });
          if (has3D) {
            transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
      }`);
            normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
      }`);
            tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
      }`);
          } else {
            transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec2f(pos.x * c - pos.y * s, pos.x * s + pos.y * c);
      }`);
          }
          break;
        }
        case "rotateX": {
          const uniformName = `u_rotateX_${suffix}`;
          uniforms.push({ name: uniformName, type: "f32", value: transform.args.angle });
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);
      }`);
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x, nrm.y * c - nrm.z * s, nrm.y * s + nrm.z * c);
      }`);
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x, tang.y * c - tang.z * s, tang.y * s + tang.z * c);
      }`);
          break;
        }
        case "rotateY": {
          const uniformName = `u_rotateY_${suffix}`;
          uniforms.push({ name: uniformName, type: "f32", value: transform.args.angle });
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c + pos.z * s, pos.y, -pos.x * s + pos.z * c);
      }`);
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c + nrm.z * s, nrm.y, -nrm.x * s + nrm.z * c);
      }`);
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c + tang.z * s, tang.y, -tang.x * s + tang.z * c);
      }`);
          break;
        }
        case "rotateZ": {
          const uniformName = `u_rotateZ_${suffix}`;
          uniforms.push({ name: uniformName, type: "f32", value: transform.args.angle });
          transformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        pos = vec3f(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);
      }`);
          normalTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        nrm = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
      }`);
          tangentTransformCode.push(`
      {
        let c = cos(vtx.${uniformName});
        let s = sin(vtx.${uniformName});
        tang = vec3f(tang.x * c - tang.y * s, tang.x * s + tang.y * c, tang.z);
      }`);
          break;
        }
        case "scale": {
          const uniformName = `u_scale_${suffix}`;
          if (has3D) {
            uniforms.push({ name: uniformName, type: "vec3f", value: [transform.args.x, transform.args.y, transform.args.z || 1] });
          } else {
            uniforms.push({ name: uniformName, type: "vec2f", value: [transform.args.x, transform.args.y] });
          }
          transformCode.push(`
      pos *= vtx.${uniformName};`);
          break;
        }
        case "offset": {
          const uniformName = `u_offset_${suffix}`;
          if (has3D) {
            uniforms.push({ name: uniformName, type: "vec3f", value: [transform.args.x, transform.args.y, transform.args.z || 0] });
          } else {
            uniforms.push({ name: uniformName, type: "vec2f", value: [transform.args.x, transform.args.y] });
          }
          transformCode.push(`
      pos += vtx.${uniformName};`);
          break;
        }
        case "perspective": {
          hasPerspective = true;
          perspectiveUniform = `u_perspective_${suffix}`;
          uniforms.push({ name: perspectiveUniform, type: "vec3f", value: [transform.args.fov, transform.args.near, transform.args.far] });
          break;
        }
      }
    });
  }
  const allUniformFields = [
    "  u_boundsMin: vec2f,",
    "  u_boundsMax: vec2f,",
    ...uniforms.map((u) => `  ${u.name}: ${u.type},`)
  ];
  const uniformStruct = `struct VertexUniforms {
${allUniformFields.join("\n")}
};
@group(2) @binding(0) var<uniform> vtx: VertexUniforms;
`;
  const inputFields = ["  @location(0) position: vec3f,"];
  if (useExplicitUVs) {
    inputFields.push("  @location(1) texcoord: vec2f,");
  }
  if (useFaceIds) {
    inputFields.push("  @location(2) faceId: f32,");
  }
  if (useNormals) {
    inputFields.push("  @location(3) normal: vec3f,");
  }
  if (useTangents) {
    inputFields.push("  @location(4) tangent: vec4f,");
  }
  const outputFields = [
    "  @builtin(position) position: vec4f,",
    "  @location(0) texcoord: vec2f,",
    "  @location(1) faceId: f32,",
    // Always include for fragment shader compatibility
    "  // Vertex data for fragment shader",
    "  @location(2) v_position: vec3f,",
    "  @location(3) v_normal: vec3f,",
    "  @location(4) v_worldNormal: vec3f,",
    "  @location(5) v_tangent: vec3f,",
    "  @location(6) v_bitangent: vec3f,",
    "  @location(7) v_viewDir: vec3f,",
    "  @location(8) v_depth: f32,"
  ];
  const uvCode = useExplicitUVs ? "output.texcoord = input.texcoord;" : "output.texcoord = (input.position.xy - vtx.u_boundsMin) / (vtx.u_boundsMax - vtx.u_boundsMin);";
  const faceIdCode = useFaceIds ? "output.faceId = input.faceId;" : "output.faceId = 0.0;";
  let wgsl;
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
      output.position = vec4f(pos.x / aspect, pos.y, pos.z * 0.1, 1.0);`;
    const normalInit = useNormals ? "var nrm = normalize(input.normal);" : "var nrm = vec3f(0.0, 0.0, 1.0);";
    const tangentInit = useTangents ? `var tang = normalize(input.tangent.xyz);
  let tanW = input.tangent.w;` : `var tang = vec3f(1.0, 0.0, 0.0);
  let tanW = 1.0;`;
    const worldNormalCode = normalTransformCode.length > 0 ? `// Apply rotation transforms to normal for world space
${normalTransformCode.join("\n")}
  output.v_worldNormal = normalize(nrm);` : `output.v_worldNormal = nrm;`;
    const worldTangentCode = tangentTransformCode.length > 0 ? `// Apply rotation transforms to tangent for world space
${tangentTransformCode.join("\n")}
  output.v_tangent = normalize(tang);` : `output.v_tangent = tang;`;
    wgsl = `struct VertexInput {
${inputFields.join("\n")}
};

struct VertexOutput {
${outputFields.join("\n")}
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
${transformCode.join("\n")}

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
`;
  } else {
    wgsl = `struct VertexInput {
${inputFields.join("\n")}
};

struct VertexOutput {
${outputFields.join("\n")}
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
${transformCode.join("\n")}

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
`;
  }
  return { wgsl, uniforms };
}
function getPassthroughVertexWgsl() {
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
`;
}
const BLEND_MODES$1 = {
  normal: {
    enable: true,
    func: {
      srcRGB: "src alpha",
      srcAlpha: 1,
      dstRGB: "one minus src alpha",
      dstAlpha: "one minus src alpha"
    }
  },
  add: {
    enable: true,
    func: {
      srcRGB: "src alpha",
      srcAlpha: 1,
      dstRGB: "one",
      dstAlpha: "one"
    }
  },
  multiply: {
    enable: true,
    func: {
      srcRGB: "dst color",
      srcAlpha: 1,
      dstRGB: "zero",
      dstAlpha: "one"
    }
  },
  screen: {
    enable: true,
    func: {
      srcRGB: "one",
      srcAlpha: 1,
      dstRGB: "one minus src color",
      dstAlpha: "one"
    }
  }
};
var Output = function({ regl: regl2, precision, label = "", chanNum, hydraSynth, width, height }) {
  this.regl = regl2;
  this.precision = precision;
  this.label = label;
  this.chanNum = chanNum;
  this.hydraSynth = hydraSynth;
  this.defaultPositionBuffer = this.regl.buffer([
    [-2, 0, 0],
    [0, -2, 0],
    [2, 2, 0]
  ]);
  this.positionBuffer = this.defaultPositionBuffer;
  this.sprites = /* @__PURE__ */ new Map();
  this.draw = () => {
  };
  this.init();
  this.pingPongIndex = 0;
  this.hasDepthBuffer = false;
  this.fbos = Array(2).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: "nearest",
      width,
      height,
      format: "rgba"
    }),
    depthStencil: false
  }));
};
Output.prototype.resize = function(width, height) {
  this.fbos.forEach((fbo) => {
    fbo.resize(width, height);
  });
};
Output.prototype.enableDepthBuffer = function() {
  if (this.hasDepthBuffer) return;
  const width = this.fbos[0].width;
  const height = this.fbos[0].height;
  this.fbos.forEach((fbo) => fbo.destroy());
  this.fbos = Array(2).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: "nearest",
      width,
      height,
      format: "rgba"
    }),
    depth: true
  }));
  this.hasDepthBuffer = true;
};
Output.prototype.getCurrent = function() {
  return this.fbos[this.pingPongIndex];
};
Output.prototype.getTexture = function() {
  var index = this.pingPongIndex ? 0 : 1;
  return this.fbos[index];
};
Output.prototype.init = function() {
  this.transformIndex = 0;
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `;
  this.fragBody = ``;
  this.vert = `
  precision ${this.precision} float;
  attribute vec3 position;
  varying vec2 uv;
  varying float v_faceId;

  // Vertex data for fragment shader (default values for fullscreen quad)
  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec3 v_worldNormal;
  varying vec3 v_tangent;
  varying vec3 v_bitangent;
  varying vec3 v_viewDir;
  varying float v_depth;

  void main () {
    uv = position.xy;
    v_faceId = 0.0;

    // Default vertex data for fullscreen quad
    v_position = vec3(position.xy * 2.0 - 1.0, 0.0);
    v_normal = vec3(0.0, 0.0, 1.0);
    v_worldNormal = vec3(0.0, 0.0, 1.0);
    v_tangent = vec3(1.0, 0.0, 0.0);
    v_bitangent = vec3(0.0, 1.0, 0.0);
    v_viewDir = vec3(0.0, 0.0, 1.0);
    v_depth = 1.0;

    gl_Position = vec4(2.0 * position.xy - 1.0, 0, 1);
  }`;
  this.attributes = {
    position: this.positionBuffer
  };
  this.uniforms = {
    time: this.regl.prop("time"),
    resolution: this.regl.prop("resolution")
  };
  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `;
  this.copyCommand = this.regl({
    frag: `
      precision ${this.precision} float;
      uniform sampler2D source;
      varying vec2 uv;
      void main () {
        gl_FragColor = texture2D(source, uv);
      }
    `,
    vert: this.vert,
    attributes: {
      position: this.defaultPositionBuffer
    },
    uniforms: {
      source: this.regl.prop("source")
    },
    count: 3,
    depth: { enable: false }
  });
  return this;
};
function reshapeToVec3(flatArray, is3D = false) {
  const len = flatArray.length;
  const stride = is3D ? 3 : 2;
  const verts = [];
  for (let i = 0; i < len; i += stride) {
    if (is3D) {
      verts.push([flatArray[i], flatArray[i + 1], flatArray[i + 2]]);
    } else {
      verts.push([flatArray[i], flatArray[i + 1], 0]);
    }
  }
  return verts;
}
function normalizeVertexOption(value, defaultValue) {
  if (value === void 0 || value === null) return defaultValue;
  return value;
}
Output.prototype.registerSprite = function(spriteLevel, config) {
  const { passes, vertexData, blendMode = "normal", vertexOptions = null, primitive = "triangles", sprite = null } = config;
  const pass = passes[0];
  const self2 = this;
  let rawVerts = null;
  let vertexSource = null;
  let has3D = false;
  if (vertexData instanceof VertexSource) {
    vertexSource = vertexData;
    rawVerts = vertexData.vertices;
    has3D = vertexData.is3D || false;
  } else if (vertexData && Array.isArray(vertexData)) {
    rawVerts = vertexData;
  }
  if (has3D) {
    this.enableDepthBuffer();
  }
  let positionBuffer, uvBuffer, faceIdBuffer, normalBuffer, tangentBuffer, vertexCount;
  let bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let hasExplicitUVs = false;
  let hasFaceIds = false;
  let hasNormals = false;
  let hasTangents = false;
  if (rawVerts && rawVerts.length >= 6) {
    const verts = reshapeToVec3(rawVerts, has3D);
    positionBuffer = this.regl.buffer(verts);
    vertexCount = verts.length;
    if (vertexSource && vertexSource.uvs && vertexSource.uvs.length > 0) {
      hasExplicitUVs = true;
      const uvData = [];
      for (let i = 0; i < vertexSource.uvs.length; i += 2) {
        uvData.push([vertexSource.uvs[i], vertexSource.uvs[i + 1]]);
      }
      uvBuffer = this.regl.buffer(uvData);
    } else {
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      for (const v2 of verts) {
        bounds.minX = Math.min(bounds.minX, v2[0]);
        bounds.maxX = Math.max(bounds.maxX, v2[0]);
        bounds.minY = Math.min(bounds.minY, v2[1]);
        bounds.maxY = Math.max(bounds.maxY, v2[1]);
      }
    }
    if (vertexSource && vertexSource.faceIds && vertexSource.faceIds.length > 0) {
      hasFaceIds = true;
      faceIdBuffer = this.regl.buffer(vertexSource.faceIds.map((id2) => [id2]));
    }
    if (vertexSource && vertexSource.normals && vertexSource.normals.length > 0) {
      hasNormals = true;
      const normalData = [];
      for (let i = 0; i < vertexSource.normals.length; i += 3) {
        normalData.push([vertexSource.normals[i], vertexSource.normals[i + 1], vertexSource.normals[i + 2]]);
      }
      normalBuffer = this.regl.buffer(normalData);
    }
    if (vertexSource && vertexSource.tangents && vertexSource.tangents.length > 0) {
      hasTangents = true;
      const tangentData = [];
      for (let i = 0; i < vertexSource.tangents.length; i += 4) {
        tangentData.push([vertexSource.tangents[i], vertexSource.tangents[i + 1], vertexSource.tangents[i + 2], vertexSource.tangents[i + 3]]);
      }
      tangentBuffer = this.regl.buffer(tangentData);
    }
  } else {
    positionBuffer = this.defaultPositionBuffer;
    vertexCount = 3;
  }
  const hasChainedTransforms = vertexSource && vertexSource.hasTransforms;
  const hasVertexOptions = rawVerts && vertexOptions && (vertexOptions.scale !== void 0 || vertexOptions.offset !== void 0 || vertexOptions.rotation !== void 0);
  const uniforms = Object.assign({}, pass.uniforms, {
    prevBuffer: () => self2.fbos[self2.pingPongIndex]
  });
  if (sprite && sprite.getUVBounds) {
    uniforms.u_spriteUV = () => {
      const bounds2 = sprite.getUVBounds();
      return [bounds2.uMin, bounds2.vMin, bounds2.uMax, bounds2.vMax];
    };
  } else {
    uniforms.u_spriteUV = [0, 0, 1, 1];
  }
  if (sprite && sprite.cols && sprite.rows) {
    uniforms.u_spriteGrid = [sprite.cols, sprite.rows];
  } else {
    uniforms.u_spriteGrid = [1, 1];
  }
  if (rawVerts) {
    uniforms.u_boundsMin = [bounds.minX, bounds.minY];
    uniforms.u_boundsMax = [bounds.maxX, bounds.maxY];
  }
  if (hasVertexOptions) {
    const scaleOpt = normalizeVertexOption(vertexOptions.scale, [1, 1]);
    uniforms.u_scale = (context, props) => {
      const val = typeof scaleOpt === "function" ? scaleOpt() : scaleOpt;
      if (typeof val === "number") return [val, val];
      return val;
    };
    const offsetOpt = normalizeVertexOption(vertexOptions.offset, [0, 0]);
    uniforms.u_offset = (context, props) => {
      const val = typeof offsetOpt === "function" ? offsetOpt() : offsetOpt;
      return val;
    };
    const rotationOpt = normalizeVertexOption(vertexOptions.rotation, 0);
    uniforms.u_rotation = (context, props) => {
      const val = typeof rotationOpt === "function" ? rotationOpt() : rotationOpt;
      return val;
    };
  }
  let vert;
  let vertexUniforms = {};
  if (rawVerts) {
    if (hasChainedTransforms) {
      const generated = generateVertexGlsl(vertexSource, this.precision, { useExplicitUVs: hasExplicitUVs, useFaceIds: hasFaceIds, useNormals: hasNormals, useTangents: hasTangents });
      vert = generated.glsl;
      vertexUniforms = generated.uniforms;
    } else if (hasVertexOptions) {
      const uvAttrDecl = hasExplicitUVs ? "attribute vec2 texcoord;" : "";
      const faceIdAttrDecl = hasFaceIds ? "attribute float faceId;" : "";
      const uvCode = hasExplicitUVs ? "uv = texcoord;" : "uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);";
      const faceIdCode = hasFaceIds ? "v_faceId = faceId;" : "v_faceId = 0.0;";
      vert = `
      precision ${this.precision} float;
      attribute vec3 position;
      ${uvAttrDecl}
      ${faceIdAttrDecl}
      varying vec2 uv;
      varying float v_faceId;

      // Vertex data for fragment shader
      varying vec3 v_position;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      varying float v_depth;

      uniform vec2 u_scale;
      uniform vec2 u_offset;
      uniform float u_rotation;
      uniform vec2 u_boundsMin;
      uniform vec2 u_boundsMax;

      void main () {
        // UV ${hasExplicitUVs ? "from explicit attribute" : "normalized to shape bounds"}
        ${uvCode}
        ${faceIdCode}

        // Apply transforms
        vec2 pos = position.xy * u_scale;

        // Rotation around origin
        float c = cos(u_rotation);
        float s = sin(u_rotation);
        pos = vec2(pos.x * c - pos.y * s, pos.x * s + pos.y * c);

        // Offset
        pos += u_offset;

        // Default vertex data for 2D geometry
        v_position = vec3(pos, 0.0);
        v_normal = vec3(0.0, 0.0, 1.0);
        v_viewDir = vec3(0.0, 0.0, 1.0);
        v_depth = 1.0;

        gl_Position = vec4(pos, 0.0, 1.0);
      }`;
    } else {
      const uvAttrDecl = hasExplicitUVs ? "attribute vec2 texcoord;" : "";
      const faceIdAttrDecl = hasFaceIds ? "attribute float faceId;" : "";
      const uvCode = hasExplicitUVs ? "uv = texcoord;" : "uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);";
      const faceIdCode = hasFaceIds ? "v_faceId = faceId;" : "v_faceId = 0.0;";
      vert = `
      precision ${this.precision} float;
      attribute vec3 position;
      ${uvAttrDecl}
      ${faceIdAttrDecl}
      varying vec2 uv;
      varying float v_faceId;

      // Vertex data for fragment shader
      varying vec3 v_position;
      varying vec3 v_normal;
      varying vec3 v_viewDir;
      varying float v_depth;

      uniform vec2 u_boundsMin;
      uniform vec2 u_boundsMax;

      void main () {
        // UV ${hasExplicitUVs ? "from explicit attribute" : "normalized to shape bounds"}
        ${uvCode}
        ${faceIdCode}

        // Default vertex data for 2D geometry
        v_position = vec3(position.xy, 0.0);
        v_normal = vec3(0.0, 0.0, 1.0);
        v_viewDir = vec3(0.0, 0.0, 1.0);
        v_depth = 1.0;

        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`;
    }
  } else {
    vert = this.vert;
  }
  Object.assign(uniforms, vertexUniforms);
  const attributes = {
    position: positionBuffer
  };
  if (hasExplicitUVs && uvBuffer) {
    attributes.texcoord = uvBuffer;
  }
  if (hasFaceIds && faceIdBuffer) {
    attributes.faceId = faceIdBuffer;
  }
  if (hasNormals && normalBuffer) {
    attributes.normal = normalBuffer;
  }
  if (hasTangents && tangentBuffer) {
    attributes.tangent = tangentBuffer;
  }
  const drawCommand = this.regl({
    frag: pass.frag,
    vert,
    attributes,
    uniforms,
    count: vertexCount,
    primitive,
    blend: BLEND_MODES$1[blendMode] || BLEND_MODES$1.normal,
    depth: { enable: has3D, func: "less" }
  });
  this.sprites.set(spriteLevel, {
    drawCommand,
    positionBuffer,
    blendMode,
    has3D
  });
};
Output.prototype.clearSprites = function() {
  for (const [level, sprite] of this.sprites) {
    if (sprite.positionBuffer !== this.defaultPositionBuffer) {
      sprite.positionBuffer.destroy();
    }
  }
  this.sprites.clear();
};
Output.prototype.render = function(passes) {
  if (this.sprites.has(0)) {
    const oldSprite = this.sprites.get(0);
    if (oldSprite.positionBuffer !== this.defaultPositionBuffer) {
      oldSprite.positionBuffer.destroy();
    }
  }
  this.registerSprite(0, { passes, vertexData: null, blendMode: "normal" });
  const self2 = this;
  this.draw = function(props) {
    self2._renderSprites(props);
  };
};
Output.prototype._renderSprites = function(props) {
  if (this.sprites.size === 0) return;
  const levels = Array.from(this.sprites.keys()).sort((a2, b) => a2 - b);
  this.pingPongIndex = this.pingPongIndex ? 0 : 1;
  const targetFbo = this.fbos[this.pingPongIndex];
  const prevFbo = this.fbos[this.pingPongIndex ? 0 : 1];
  const hasLevel0 = levels.length > 0 && levels[0] === 0;
  const needs3D = Array.from(this.sprites.values()).some((s) => s.has3D);
  if (!hasLevel0) {
    this.regl.clear({
      color: [0, 0, 0, 0],
      depth: needs3D ? 1 : void 0,
      framebuffer: targetFbo
    });
    if (this.copyCommand) {
      targetFbo.use(() => {
        this.copyCommand({ source: prevFbo });
      });
    }
  }
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const sprite = this.sprites.get(level);
    if (level === 0) {
      this.regl.clear({
        color: [0, 0, 0, 1],
        depth: needs3D ? 1 : void 0,
        framebuffer: targetFbo
      });
    }
    targetFbo.use(() => {
      sprite.drawCommand(props);
    });
  }
};
Output.prototype.tick = function(props) {
  this._renderSprites(props);
};
const BLEND_MODES = {
  normal: {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one-minus-src-alpha",
      operation: "add"
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add"
    }
  },
  add: {
    color: {
      srcFactor: "src-alpha",
      dstFactor: "one",
      operation: "add"
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one",
      operation: "add"
    }
  },
  multiply: {
    color: {
      srcFactor: "dst",
      dstFactor: "zero",
      operation: "add"
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one",
      operation: "add"
    }
  },
  screen: {
    color: {
      srcFactor: "one",
      dstFactor: "one-minus-src",
      operation: "add"
    },
    alpha: {
      srcFactor: "one",
      dstFactor: "one",
      operation: "add"
    }
  }
};
class OutputWgsl {
  constructor({ wgslHydra: wgslHydra2, hydraSynth, chanNum, label = "", width, height }) {
    this.wgslHydra = wgslHydra2;
    this.hydraSynth = hydraSynth;
    this.chanNum = chanNum;
    this.label = label;
    this.precision = "mediump";
    this.draw = () => {
    };
    this.sprites = /* @__PURE__ */ new Map();
    this.init();
  }
  resize(width, height) {
  }
  getCurrent() {
    let tex = this.getCurrentTextureView();
    return tex;
  }
  getTexture() {
    let tex = this.getOppositeTextureView();
    return tex;
  }
  init() {
    this.pingPongs = 0;
    return this;
  }
  // Register a sprite at a given level (parallel to WebGL Output.registerSprite)
  async registerSprite(spriteLevel, config) {
    const { passes, vertexData, blendMode = "normal", primitive = "triangles", sprite = null } = config;
    const pass = passes[0];
    let rawVerts = null;
    let vertexSource = null;
    let has3D = false;
    if (vertexData instanceof VertexSource) {
      vertexSource = vertexData;
      rawVerts = vertexData.vertices;
      has3D = vertexData.is3D || false;
    } else if (vertexData && Array.isArray(vertexData)) {
      rawVerts = vertexData;
    }
    let hasExplicitUVs = false;
    let hasFaceIds = false;
    let hasNormals = false;
    let hasTangents = false;
    if (vertexSource) {
      hasExplicitUVs = vertexSource.uvs && vertexSource.uvs.length > 0;
      hasFaceIds = vertexSource.faceIds && vertexSource.faceIds.length > 0;
      hasNormals = vertexSource.normals && vertexSource.normals.length > 0;
      hasTangents = vertexSource.tangents && vertexSource.tangents.length > 0;
    }
    let bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    if (rawVerts && rawVerts.length >= 6 && !hasExplicitUVs) {
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      const stride = has3D ? 3 : 2;
      for (let i = 0; i < rawVerts.length; i += stride) {
        bounds.minX = Math.min(bounds.minX, rawVerts[i]);
        bounds.maxX = Math.max(bounds.maxX, rawVerts[i]);
        bounds.minY = Math.min(bounds.minY, rawVerts[i + 1]);
        bounds.maxY = Math.max(bounds.maxY, rawVerts[i + 1]);
      }
    }
    let vertexWgsl = null;
    let vertexUniforms = [];
    const hasChainedTransforms = vertexSource && vertexSource.hasTransforms;
    if (rawVerts) {
      const boundsUniforms = [
        { name: "u_boundsMin", type: "vec2f", value: [bounds.minX, bounds.minY] },
        { name: "u_boundsMax", type: "vec2f", value: [bounds.maxX, bounds.maxY] }
      ];
      if (hasChainedTransforms) {
        const generated = generateVertexWgsl(vertexSource, { useExplicitUVs: hasExplicitUVs, useFaceIds: hasFaceIds, useNormals: hasNormals, useTangents: hasTangents });
        vertexWgsl = generated.wgsl;
        vertexUniforms = [...boundsUniforms, ...generated.uniforms];
      } else {
        vertexWgsl = getPassthroughVertexWgsl();
        vertexUniforms = boundsUniforms;
      }
    }
    this.sprites.set(spriteLevel, {
      passes,
      vertexData,
      rawVerts,
      vertexSource,
      blendMode,
      primitive,
      vertexWgsl,
      vertexUniforms,
      hasCustomGeometry: rawVerts !== null,
      has3D,
      hasExplicitUVs,
      hasFaceIds,
      hasNormals,
      hasTangents,
      sprite
    });
    await this.wgslHydra.setupSpriteChain(this.chanNum, spriteLevel, {
      uniforms: pass.uniforms,
      fragShader: pass.frag,
      vertexWgsl,
      vertexUniforms,
      rawVerts,
      blendMode,
      primitive,
      has3D,
      hasExplicitUVs,
      hasFaceIds,
      hasNormals,
      hasTangents,
      uvs: vertexSource == null ? void 0 : vertexSource.uvs,
      faceIds: vertexSource == null ? void 0 : vertexSource.faceIds,
      normals: vertexSource == null ? void 0 : vertexSource.normals,
      tangents: vertexSource == null ? void 0 : vertexSource.tangents,
      sprite
    });
  }
  // Legacy render method - registers at sprite level 0
  async render(passes) {
    this.clearSprites();
    await this.registerSprite(0, { passes, vertexData: null, blendMode: "normal" });
  }
  // Clear all sprites
  clearSprites() {
    this.sprites.clear();
    if (this.wgslHydra.clearSpriteChains) {
      this.wgslHydra.clearSpriteChains(this.chanNum);
    }
  }
  tick(props) {
  }
  flipPingPong() {
    let x2 = this.pingPongs === 0 ? 1 : 0;
    this.pingPongs = x2;
  }
  // This is called during setup and whenever canvas size changes
  createTexturesAndViews(device, destTextureDescriptor) {
    this.textures = new Array(2);
    this.views = new Array(2);
    for (let i = 0; i < 2; ++i) {
      this.textures[i] = device.createTexture(destTextureDescriptor);
      this.views[i] = this.textures[i].createView();
    }
  }
  getCurrentTextureView() {
    let p = this.pingPongs;
    return this.views[p];
  }
  getCurrentTexture() {
    let p = this.pingPongs;
    return this.textures[p];
  }
  getOppositeTextureView() {
    let p = this.pingPongs;
    let x2 = p === 0 ? 1 : 0;
    return this.views[x2];
  }
}
function now$1() {
  return performance.now();
}
var last = 0, id = 0, queue = [], frameDuration = 1e3 / 60;
function raf(callback) {
  if (queue.length === 0) {
    var _now = now$1(), next = Math.max(0, frameDuration - (_now - last));
    last = next + _now;
    setTimeout(function() {
      var cp = queue.slice(0);
      queue.length = 0;
      for (var i = 0; i < cp.length; i++) {
        if (!cp[i].cancelled) {
          try {
            cp[i].callback(last);
          } catch (e) {
            setTimeout(function() {
              throw e;
            }, 0);
          }
        }
      }
    }, Math.round(next));
  }
  queue.push({
    handle: ++id,
    callback,
    cancelled: false
  });
  return id;
}
function cancel(handle) {
  for (var i = 0; i < queue.length; i++) {
    if (queue[i].handle === handle) {
      queue[i].cancelled = true;
    }
  }
}
function now() {
  return performance.now();
}
function Engine(fn) {
  if (!(this instanceof Engine))
    return new Engine(fn);
  this.running = false;
  this.last = now();
  this._frame = 0;
  this._tick = this.tick.bind(this);
  this._fn = fn;
}
Engine.prototype.start = function() {
  if (this.running)
    return;
  this.running = true;
  this.last = now();
  this._frame = raf(this._tick);
  return this;
};
Engine.prototype.stop = function() {
  this.running = false;
  if (this._frame !== 0)
    cancel(this._frame);
  this._frame = 0;
  return this;
};
Engine.prototype.tick = function() {
  this._frame = raf(this._tick);
  var time = now();
  var dt = time - this.last;
  if (this._fn) this._fn(dt);
  this.last = time;
};
var loop = Engine;
function Webcam(deviceId) {
  return navigator.mediaDevices.enumerateDevices().then((devices) => devices.filter((devices2) => devices2.kind === "videoinput")).then((cameras) => {
    let constraints = { audio: false, video: true };
    if (cameras[deviceId]) {
      constraints["video"] = {
        deviceId: { exact: cameras[deviceId].deviceId }
      };
    }
    return window.navigator.mediaDevices.getUserMedia(constraints);
  }).then((stream) => {
    const video = document.createElement("video");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.srcObject = stream;
    return new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => resolve({ video }));
      });
    });
  }).catch(console.log.bind(console));
}
function Screen(options) {
  return new Promise(function(resolve, reject) {
    navigator.mediaDevices.getDisplayMedia(options).then((stream) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.addEventListener("loadedmetadata", () => {
        video.play();
        resolve({ video });
      });
    }).catch((err) => reject(err));
  });
}
class HydraSource {
  constructor({ regl: regl2, wgsl, hydraSynth, width, height, chanNum, pb, label = "" }) {
    // cache for the canvases, so we don't create them every time
    __publicField(this, "canvases", {});
    this.label = label;
    this.regl = regl2;
    this.wgsl = wgsl;
    this.hydraSynth = hydraSynth;
    this.src = null;
    this.dynamic = true;
    this.width = width;
    this.height = height;
    this.chanNum = chanNum;
    this.indirect = false;
    this.active = false;
    this.pb = pb;
    this.tex = this.makeTexture({ width, height });
  }
  noteTime() {
    this.modTime = performance.now();
  }
  makeTexture(params) {
    let width = params.width;
    let height = params.height;
    if (!this.wgsl) {
      return this.regl.texture({
        shape: [width, height],
        ...params
      });
    } else {
      let tex = this.wgsl.device.createTexture({
        size: [width, height, 1],
        format: this.wgsl.format,
        // was "rgba8unorm"
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.lastTexture = void 0;
      return tex;
    }
  }
  activate(width, height) {
    this.offscreencanvas = new OffscreenCanvas(width, height);
    this.bmr = this.offscreencanvas.getContext("bitmaprenderer");
    if (!this.wgsl) {
      this.src = this.offscreencanvas;
      this.tex = this.makeTexture({ data: this.src, dynamic: true, width, height });
    } else {
      this.tex = this.makeTexture({ width, height });
    }
    console.log("activate complete");
  }
  init(opts, params) {
    this.what = "init";
    this.noteTime();
    if ("src" in opts) {
      this.src = opts.src;
      if (!this.wgsl) {
        this.tex = this.regl.texture({ data: this.src, ...params });
      } else {
        if (opts.src.tex) {
          this.indirect = true;
          this.tex = opts.src.tex;
        } else {
          const w = opts.src.width || opts.src.videoWidth || this.width;
          const h = opts.src.height || opts.src.videoHeight || this.height;
          this.width = w;
          this.height = h;
          this.tex = this.wgsl.device.createTexture({
            size: [w, h, 1],
            format: this.wgsl.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
          });
          this.wgsl.device.queue.copyExternalImageToTexture(
            { source: opts.src, flipY: true },
            { texture: this.tex },
            [w, h]
          );
          this.indirect = false;
          this.lastTextureView = void 0;
        }
      }
    }
    if ("dynamic" in opts) this.dynamic = opts.dynamic;
    this.active = true;
  }
  // Initialize from another Hydra's output (for shared GPUDevice zero-copy)
  // outputWgsl: an OutputWgsl from another Hydra instance on the same GPUDevice
  initFromOutput(outputWgsl) {
    this.what = "initFromOutput";
    this.noteTime();
    this.externalOutput = outputWgsl;
    this.indirect = true;
    this.dynamic = true;
    this.active = true;
  }
  // Initialize directly from a GPUTexture (for shared GPUDevice zero-copy)
  initFromTexture(gpuTexture) {
    this.what = "initFromTexture";
    this.noteTime();
    this.tex = gpuTexture;
    this.indirect = true;
    this.dynamic = false;
    this.active = true;
  }
  setupString() {
    let outs = [];
    let w = this.what;
    outs.push(this.label);
    outs.push(".");
    outs.push(w);
    outs.push("(");
    if (w === "initVideo" || w === "initImage") {
      outs.push('"');
      outs.push(this.url);
      outs.push('"');
    } else if (w === "initStream") {
      outs.push('"');
      outs.push(this.streamName);
      outs.push('"');
    } else if (w === "initCam" || w === "initScreen") {
      if (this.index !== void 0) outs.push(String.valueOf(this.index));
    }
    outs.push(")");
    return outs.join("");
  }
  initCam(index, params) {
    this.what = "initCam";
    this.noteTime();
    const self2 = this;
    self2.index = index;
    Webcam(index).then((response) => {
      self2.src = response.video;
      self2.dynamic = true;
      self2.width = self2.src.videoWidth;
      self2.height = self2.src.videoHeight;
      self2.tex = this.makeTexture({ width: self2.width, height: self2.height, data: self2.src, ...params });
      self2.active = true;
    }).catch((err) => console.log("could not get camera", err));
  }
  initVideo(url = "", params) {
    this.what = "initVideo";
    this.url = url;
    this.noteTime();
    const vid = document.createElement("video");
    vid.crossOrigin = "anonymous";
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true;
    vid.addEventListener("loadeddata", () => {
      this.src = vid;
      this.width = vid.videoWidth;
      this.height = vid.videoHeight;
      vid.play();
      self.tex = this.makeTexture({ width: this.width, height: this.height, data: this.src, ...params });
      this.dynamic = true;
      this.active = true;
    });
    vid.src = url;
  }
  initImage(url = "", params) {
    this.what = "initImage";
    this.url = url;
    this.noteTime();
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = url;
    this.oneShotDone = false;
    let self2 = this;
    img.onload = () => {
      self2.src = img;
      self2.dynamic = false;
      self2.active = true;
      self2.tex = this.makeTexture({ width: self2.width, height: self2.height, data: self2.src, ...params });
    };
  }
  initStream(streamName, params) {
    let self2 = this;
    self2.what = "initStream";
    this.noteTime();
    self2.steamName = streamName;
    if (streamName && this.pb) {
      this.pb.initSource(streamName);
      this.pb.on("got video", function(nick, video) {
        if (nick === streamName) {
          self2.src = video;
          self2.dynamic = true;
          self2.active = true;
          self2.tex = this.makeTexture({ width: self2.width, height: self2.height, data: self2.src, ...params });
        }
      });
    }
  }
  // index only relevant in atom-hydra + desktop apps
  initScreen(index = 0, params) {
    const self2 = this;
    self2.what = "initScreen";
    self2.index = index;
    self2.noteTime();
    Screen().then(function(response) {
      self2.src = response.video;
      self2.tex = self2.regl.texture({ data: self2.src, ...params });
      this.active = true;
      self2.dynamic = true;
    }).catch((err) => console.log("could not get screen", err));
  }
  // Creates a canvas and returns the 2d context
  initCanvas(width = 1e3, height = 1e3) {
    if (this.canvases[this.label] == void 0) {
      const canvas2 = document.createElement("canvas");
      const ctx2 = canvas2.getContext("2d");
      if (ctx2 != null)
        this.canvases[this.label] = ctx2;
    }
    const ctx = this.canvases[this.label];
    const canvas = ctx.canvas;
    if (canvas.width !== width && canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    this.init({ src: canvas });
    this.dynamic = true;
    return ctx;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  clear() {
    if (this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach((track) => track.stop());
      }
    }
    this.offscreencanvas = void 0;
    this.bmr = void 0;
    this.src = null;
    this.active = false;
    this.what = "";
    if (!this.wgsl) {
      this.tex = this.regl.texture({ shape: [1, 1] });
    } else {
      this.tex = this.makeTexture({ width: 1, height: 1 });
    }
  }
  resizeTex(width, height) {
    if (!this.wgsl) {
      this.tex.resize(width, height);
    } else {
      this.tex = this.makeTexture({ width, height });
    }
    this.width = width;
    this.height = height;
  }
  tick(time) {
    if (this.src && this.dynamic === true) {
      if (this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
        console.log(
          this.src.videoWidth,
          this.src.videoHeight,
          this.tex.width,
          this.tex.height
        );
        this.resizeTex(this.src.videoWidth, this.src.videoHeight);
      }
      if (this.src.width && this.src.width !== this.width) {
        this.resizeTex(this.src.width, this.src.height);
      }
      if (!this.wgsl) {
        this.tex.subimage(this.src);
      } else {
        this.updateTextureWGSL();
      }
    }
  }
  updateTextureWGSL() {
    if (!this.src) return;
    let w = this.width;
    let h = this.height;
    if (this.src.videoWidth) {
      w = this.src.videoWidth;
      h = this.src.videoHeight;
    }
    if (!this.dynamic) {
      if (!this.oneShotDone) {
        this.wgsl.device.queue.copyExternalImageToTexture(
          { source: this.src, flipY: true },
          { texture: this.tex },
          [w, h]
        );
        this.oneShotDone = true;
      }
      return;
    }
    this.wgsl.device.queue.copyExternalImageToTexture(
      { source: this.src, flipY: true },
      { texture: this.tex },
      [w, h]
    );
  }
  getTexture() {
    if (this.wgsl) return this.getTextureWGSL();
    return this.tex;
  }
  // WGSL wants a "texture view", rather than a texture
  // To avoid creating a new view each frame, we do a simple cache.
  getTextureWGSL() {
    if (this.externalOutput) {
      return this.externalOutput.getTexture();
    }
    if (!this.tex) return void 0;
    if (this.lastTexture !== this.tex || !this.lastTextureView) {
      this.lastTextureView = this.tex.createView();
    }
    if (this.lastTextureView) return this.lastTextureView;
    return void 0;
  }
  injectImage(img) {
    if (!this.offscreencanvas) {
      this.activate(img.width, img.height);
    }
    let sizeWrong = this.tex.width !== img.width || this.tex.height !== img.height;
    if (sizeWrong) {
      this.activate(img.width, img.height);
    }
    this.bmr.transferFromImageBitmap(img);
    if (this.wgsl && this.wgsl.device && this.tex) {
      try {
        this.wgsl.device.queue.copyExternalImageToTexture(
          { source: this.offscreencanvas, flipY: true },
          { texture: this.tex },
          [img.width, img.height]
        );
      } catch (err) {
        console.error("injectImage WebGPU copy failed:", err);
      }
    }
  }
}
const mouse = {};
function mouseButtons(ev) {
  if (typeof ev === "object") {
    if ("buttons" in ev) {
      return ev.buttons;
    } else if ("which" in ev) {
      var b = ev.which;
      if (b === 2) {
        return 4;
      } else if (b === 3) {
        return 2;
      } else if (b > 0) {
        return 1 << b - 1;
      }
    } else if ("button" in ev) {
      var b = ev.button;
      if (b === 1) {
        return 4;
      } else if (b === 2) {
        return 2;
      } else if (b >= 0) {
        return 1 << b;
      }
    }
  }
  return 0;
}
mouse.buttons = mouseButtons;
function mouseElement(ev) {
  return ev.target || ev.srcElement || window;
}
mouse.element = mouseElement;
function mouseRelativeX(ev) {
  if (typeof ev === "object") {
    if ("pageX" in ev) {
      return ev.pageX;
    }
  }
  return 0;
}
mouse.x = mouseRelativeX;
function mouseRelativeY(ev) {
  if (typeof ev === "object") {
    if ("pageY" in ev) {
      return ev.pageY;
    }
  }
  return 0;
}
mouse.y = mouseRelativeY;
function mouseListen(element, callback) {
  if (!callback) {
    callback = element;
    element = window;
  }
  var buttonState = 0;
  var x2 = 0;
  var y = 0;
  var mods = {
    shift: false,
    alt: false,
    control: false,
    meta: false
  };
  var attached = false;
  function updateMods(ev) {
    var changed = false;
    if ("altKey" in ev) {
      changed = changed || ev.altKey !== mods.alt;
      mods.alt = !!ev.altKey;
    }
    if ("shiftKey" in ev) {
      changed = changed || ev.shiftKey !== mods.shift;
      mods.shift = !!ev.shiftKey;
    }
    if ("ctrlKey" in ev) {
      changed = changed || ev.ctrlKey !== mods.control;
      mods.control = !!ev.ctrlKey;
    }
    if ("metaKey" in ev) {
      changed = changed || ev.metaKey !== mods.meta;
      mods.meta = !!ev.metaKey;
    }
    return changed;
  }
  function handleEvent(nextButtons, ev) {
    var nextX = mouse.x(ev);
    var nextY = mouse.y(ev);
    if ("buttons" in ev) {
      nextButtons = ev.buttons | 0;
    }
    if (nextButtons !== buttonState || nextX !== x2 || nextY !== y || updateMods(ev)) {
      buttonState = nextButtons | 0;
      x2 = nextX || 0;
      y = nextY || 0;
      callback && callback(buttonState, x2, y, mods);
    }
  }
  function clearState(ev) {
    handleEvent(0, ev);
  }
  function handleBlur() {
    if (buttonState || x2 || y || mods.shift || mods.alt || mods.meta || mods.control) {
      x2 = y = 0;
      buttonState = 0;
      mods.shift = mods.alt = mods.control = mods.meta = false;
      callback && callback(0, 0, 0, mods);
    }
  }
  function handleMods(ev) {
    if (updateMods(ev)) {
      callback && callback(buttonState, x2, y, mods);
    }
  }
  function handleMouseMove(ev) {
    if (mouse.buttons(ev) === 0) {
      handleEvent(0, ev);
    } else {
      handleEvent(buttonState, ev);
    }
  }
  function handleMouseDown(ev) {
    handleEvent(buttonState | mouse.buttons(ev), ev);
  }
  function handleMouseUp(ev) {
    handleEvent(buttonState & ~mouse.buttons(ev), ev);
  }
  function attachListeners() {
    if (attached) {
      return;
    }
    attached = true;
    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mousedown", handleMouseDown);
    element.addEventListener("mouseup", handleMouseUp);
    element.addEventListener("mouseleave", clearState);
    element.addEventListener("mouseenter", clearState);
    element.addEventListener("mouseout", clearState);
    element.addEventListener("mouseover", clearState);
    element.addEventListener("blur", handleBlur);
    element.addEventListener("keyup", handleMods);
    element.addEventListener("keydown", handleMods);
    element.addEventListener("keypress", handleMods);
    if (element !== window) {
      window.addEventListener("blur", handleBlur);
      window.addEventListener("keyup", handleMods);
      window.addEventListener("keydown", handleMods);
      window.addEventListener("keypress", handleMods);
    }
  }
  function detachListeners() {
    if (!attached) {
      return;
    }
    attached = false;
    element.removeEventListener("mousemove", handleMouseMove);
    element.removeEventListener("mousedown", handleMouseDown);
    element.removeEventListener("mouseup", handleMouseUp);
    element.removeEventListener("mouseleave", clearState);
    element.removeEventListener("mouseenter", clearState);
    element.removeEventListener("mouseout", clearState);
    element.removeEventListener("mouseover", clearState);
    element.removeEventListener("blur", handleBlur);
    element.removeEventListener("keyup", handleMods);
    element.removeEventListener("keydown", handleMods);
    element.removeEventListener("keypress", handleMods);
    if (element !== window) {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keyup", handleMods);
      window.removeEventListener("keydown", handleMods);
      window.removeEventListener("keypress", handleMods);
    }
  }
  attachListeners();
  var result = {
    element
  };
  Object.defineProperties(result, {
    enabled: {
      get: function() {
        return attached;
      },
      set: function(f) {
        if (f) {
          attachListeners();
        } else {
          detachListeners();
        }
      },
      enumerable: true
    },
    buttons: {
      get: function() {
        return buttonState;
      },
      enumerable: true
    },
    x: {
      get: function() {
        return x2;
      },
      enumerable: true
    },
    y: {
      get: function() {
        return y;
      },
      enumerable: true
    },
    mods: {
      get: function() {
        return mods;
      },
      enumerable: true
    }
  });
  return result;
}
function getDefaultExportFromCjs(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
var meyda_min$1 = { exports: {} };
var meyda_min = meyda_min$1.exports;
var hasRequiredMeyda_min;
function requireMeyda_min() {
  if (hasRequiredMeyda_min) return meyda_min$1.exports;
  hasRequiredMeyda_min = 1;
  (function(module, exports) {
    !function(r, t) {
      module.exports = t();
    }(meyda_min, function() {
      function r(r2, t2, e2) {
        for (var a22, n2 = 0, o2 = t2.length; n2 < o2; n2++) !a22 && n2 in t2 || (a22 || (a22 = Array.prototype.slice.call(t2, 0, n2)), a22[n2] = t2[n2]);
        return r2.concat(a22 || Array.prototype.slice.call(t2));
      }
      var t = Object.freeze({ __proto__: null, blackman: function(r2) {
        for (var t2 = new Float32Array(r2), e2 = 2 * Math.PI / (r2 - 1), a22 = 2 * e2, n2 = 0; n2 < r2 / 2; n2++) t2[n2] = 0.42 - 0.5 * Math.cos(n2 * e2) + 0.08 * Math.cos(n2 * a22);
        for (n2 = Math.ceil(r2 / 2); n2 > 0; n2--) t2[r2 - n2] = t2[n2 - 1];
        return t2;
      }, hamming: function(r2) {
        for (var t2 = new Float32Array(r2), e2 = 0; e2 < r2; e2++) t2[e2] = 0.54 - 0.46 * Math.cos(2 * Math.PI * (e2 / r2 - 1));
        return t2;
      }, hanning: function(r2) {
        for (var t2 = new Float32Array(r2), e2 = 0; e2 < r2; e2++) t2[e2] = 0.5 - 0.5 * Math.cos(2 * Math.PI * e2 / (r2 - 1));
        return t2;
      }, sine: function(r2) {
        for (var t2 = Math.PI / (r2 - 1), e2 = new Float32Array(r2), a22 = 0; a22 < r2; a22++) e2[a22] = Math.sin(t2 * a22);
        return e2;
      } }), e = {};
      function a2(r2) {
        for (; r2 % 2 == 0 && r2 > 1; ) r2 /= 2;
        return 1 === r2;
      }
      function n(r2, a22) {
        if ("rect" !== a22) {
          if ("" !== a22 && a22 || (a22 = "hanning"), e[a22] || (e[a22] = {}), !e[a22][r2.length]) try {
            e[a22][r2.length] = t[a22](r2.length);
          } catch (r3) {
            throw new Error("Invalid windowing function");
          }
          r2 = function(r3, t2) {
            for (var e2 = [], a3 = 0; a3 < Math.min(r3.length, t2.length); a3++) e2[a3] = r3[a3] * t2[a3];
            return e2;
          }(r2, e[a22][r2.length]);
        }
        return r2;
      }
      function o(r2, t2, e2) {
        for (var a22 = new Float32Array(r2), n2 = 0; n2 < a22.length; n2++) a22[n2] = n2 * t2 / e2, a22[n2] = 13 * Math.atan(a22[n2] / 1315.8) + 3.5 * Math.atan(Math.pow(a22[n2] / 7518, 2));
        return a22;
      }
      function i(r2) {
        return Float32Array.from(r2);
      }
      function u(r2) {
        return 1125 * Math.log(1 + r2 / 700);
      }
      function f(r2, t2, e2) {
        for (var a22, n2 = new Float32Array(r2 + 2), o2 = new Float32Array(r2 + 2), i2 = t2 / 2, f2 = u(0), c2 = (u(i2) - f2) / (r2 + 1), l2 = new Array(r2 + 2), s2 = 0; s2 < n2.length; s2++) n2[s2] = s2 * c2, o2[s2] = (a22 = n2[s2], 700 * (Math.exp(a22 / 1125) - 1)), l2[s2] = Math.floor((e2 + 1) * o2[s2] / t2);
        for (var m2 = new Array(r2), p2 = 0; p2 < m2.length; p2++) {
          m2[p2] = new Array(e2 / 2 + 1).fill(0);
          for (s2 = l2[p2]; s2 < l2[p2 + 1]; s2++) m2[p2][s2] = (s2 - l2[p2]) / (l2[p2 + 1] - l2[p2]);
          for (s2 = l2[p2 + 1]; s2 < l2[p2 + 2]; s2++) m2[p2][s2] = (l2[p2 + 2] - s2) / (l2[p2 + 2] - l2[p2 + 1]);
        }
        return m2;
      }
      function c(t2, e2, a22, n2, o2, i2, u2) {
        void 0 === n2 && (n2 = 5), void 0 === o2 && (o2 = 2), void 0 === i2 && (i2 = true), void 0 === u2 && (u2 = 440);
        var f2 = Math.floor(a22 / 2) + 1, c2 = new Array(a22).fill(0).map(function(r2, n3) {
          return t2 * function(r3, t3) {
            return Math.log2(16 * r3 / t3);
          }(e2 * n3 / a22, u2);
        });
        c2[0] = c2[1] - 1.5 * t2;
        var l2, s2, m2, p2 = c2.slice(1).map(function(r2, t3) {
          return Math.max(r2 - c2[t3]);
        }, 1).concat([1]), h2 = Math.round(t2 / 2), g2 = new Array(t2).fill(0).map(function(r2, e3) {
          return c2.map(function(r3) {
            return (10 * t2 + h2 + r3 - e3) % t2 - h2;
          });
        }), w2 = g2.map(function(r2, t3) {
          return r2.map(function(r3, e3) {
            return Math.exp(-0.5 * Math.pow(2 * g2[t3][e3] / p2[e3], 2));
          });
        });
        if (s2 = (l2 = w2)[0].map(function() {
          return 0;
        }), m2 = l2.reduce(function(r2, t3) {
          return t3.forEach(function(t4, e3) {
            r2[e3] += Math.pow(t4, 2);
          }), r2;
        }, s2).map(Math.sqrt), w2 = l2.map(function(r2, t3) {
          return r2.map(function(r3, t4) {
            return r3 / (m2[t4] || 1);
          });
        }), o2) {
          var v22 = c2.map(function(r2) {
            return Math.exp(-0.5 * Math.pow((r2 / t2 - n2) / o2, 2));
          });
          w2 = w2.map(function(r2) {
            return r2.map(function(r3, t3) {
              return r3 * v22[t3];
            });
          });
        }
        return i2 && (w2 = r(r([], w2.slice(3), true), w2.slice(0, 3))), w2.map(function(r2) {
          return r2.slice(0, f2);
        });
      }
      function l(r2, t2) {
        for (var e2 = 0, a22 = 0, n2 = 0; n2 < t2.length; n2++) e2 += Math.pow(n2, r2) * Math.abs(t2[n2]), a22 += t2[n2];
        return e2 / a22;
      }
      function s(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.barkScale, a22 = r2.numberOfBarkBands, n2 = void 0 === a22 ? 24 : a22;
        if ("object" != typeof t2 || "object" != typeof e2) throw new TypeError();
        var o2 = n2, i2 = new Float32Array(o2), u2 = 0, f2 = t2, c2 = new Int32Array(o2 + 1);
        c2[0] = 0;
        for (var l2 = e2[f2.length - 1] / o2, s2 = 1, m2 = 0; m2 < f2.length; m2++) for (; e2[m2] > l2; ) c2[s2++] = m2, l2 = s2 * e2[f2.length - 1] / o2;
        c2[o2] = f2.length - 1;
        for (m2 = 0; m2 < o2; m2++) {
          for (var p2 = 0, h2 = c2[m2]; h2 < c2[m2 + 1]; h2++) p2 += f2[h2];
          i2[m2] = Math.pow(p2, 0.23);
        }
        for (m2 = 0; m2 < i2.length; m2++) u2 += i2[m2];
        return { specific: i2, total: u2 };
      }
      function m(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        for (var e2 = new Float32Array(t2.length), a22 = 0; a22 < e2.length; a22++) e2[a22] = Math.pow(t2[a22], 2);
        return e2;
      }
      function p(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.melFilterBank, a22 = r2.bufferSize;
        if ("object" != typeof t2) throw new TypeError("Valid ampSpectrum is required to generate melBands");
        if ("object" != typeof e2) throw new TypeError("Valid melFilterBank is required to generate melBands");
        for (var n2 = m({ ampSpectrum: t2 }), o2 = e2.length, i2 = Array(o2), u2 = new Float32Array(o2), f2 = 0; f2 < u2.length; f2++) {
          i2[f2] = new Float32Array(a22 / 2), u2[f2] = 0;
          for (var c2 = 0; c2 < a22 / 2; c2++) i2[f2][c2] = e2[f2][c2] * n2[c2], u2[f2] += i2[f2][c2];
          u2[f2] = Math.log(u2[f2] + 1);
        }
        return Array.prototype.slice.call(u2);
      }
      function h(r2) {
        return r2 && r2.__esModule && Object.prototype.hasOwnProperty.call(r2, "default") ? r2.default : r2;
      }
      var g = null;
      var w = h(function(r2, t2) {
        var e2 = r2.length;
        return t2 = t2 || 2, g && g[e2] || function(r3) {
          (g = g || {})[r3] = new Array(r3 * r3);
          for (var t3 = Math.PI / r3, e3 = 0; e3 < r3; e3++) for (var a22 = 0; a22 < r3; a22++) g[r3][a22 + e3 * r3] = Math.cos(t3 * (a22 + 0.5) * e3);
        }(e2), r2.map(function() {
          return 0;
        }).map(function(a22, n2) {
          return t2 * r2.reduce(function(r3, t3, a3, o2) {
            return r3 + t3 * g[e2][a3 + n2 * e2];
          }, 0);
        });
      });
      var v2 = Object.freeze({ __proto__: null, amplitudeSpectrum: function(r2) {
        return r2.ampSpectrum;
      }, buffer: function(r2) {
        return r2.signal;
      }, chroma: function(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.chromaFilterBank;
        if ("object" != typeof t2) throw new TypeError("Valid ampSpectrum is required to generate chroma");
        if ("object" != typeof e2) throw new TypeError("Valid chromaFilterBank is required to generate chroma");
        var a22 = e2.map(function(r3, e3) {
          return t2.reduce(function(t3, e4, a3) {
            return t3 + e4 * r3[a3];
          }, 0);
        }), n2 = Math.max.apply(Math, a22);
        return n2 ? a22.map(function(r3) {
          return r3 / n2;
        }) : a22;
      }, complexSpectrum: function(r2) {
        return r2.complexSpectrum;
      }, energy: function(r2) {
        var t2 = r2.signal;
        if ("object" != typeof t2) throw new TypeError();
        for (var e2 = 0, a22 = 0; a22 < t2.length; a22++) e2 += Math.pow(Math.abs(t2[a22]), 2);
        return e2;
      }, loudness: s, melBands: p, mfcc: function(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.melFilterBank, a22 = r2.numberOfMFCCCoefficients, n2 = r2.bufferSize, o2 = Math.min(40, Math.max(1, a22 || 13));
        if (e2.length < o2) throw new Error("Insufficient filter bank for requested number of coefficients");
        var i2 = p({ ampSpectrum: t2, melFilterBank: e2, bufferSize: n2 });
        return w(i2).slice(0, o2);
      }, perceptualSharpness: function(r2) {
        for (var t2 = s({ ampSpectrum: r2.ampSpectrum, barkScale: r2.barkScale }), e2 = t2.specific, a22 = 0, n2 = 0; n2 < e2.length; n2++) a22 += n2 < 15 ? (n2 + 1) * e2[n2 + 1] : 0.066 * Math.exp(0.171 * (n2 + 1));
        return a22 *= 0.11 / t2.total;
      }, perceptualSpread: function(r2) {
        for (var t2 = s({ ampSpectrum: r2.ampSpectrum, barkScale: r2.barkScale }), e2 = 0, a22 = 0; a22 < t2.specific.length; a22++) t2.specific[a22] > e2 && (e2 = t2.specific[a22]);
        return Math.pow((t2.total - e2) / t2.total, 2);
      }, powerSpectrum: m, rms: function(r2) {
        var t2 = r2.signal;
        if ("object" != typeof t2) throw new TypeError();
        for (var e2 = 0, a22 = 0; a22 < t2.length; a22++) e2 += Math.pow(t2[a22], 2);
        return e2 /= t2.length, e2 = Math.sqrt(e2);
      }, spectralCentroid: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        return l(1, t2);
      }, spectralCrest: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        var e2 = 0, a22 = -1 / 0;
        return t2.forEach(function(r3) {
          e2 += Math.pow(r3, 2), a22 = r3 > a22 ? r3 : a22;
        }), e2 /= t2.length, e2 = Math.sqrt(e2), a22 / e2;
      }, spectralFlatness: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        for (var e2 = 0, a22 = 0, n2 = 0; n2 < t2.length; n2++) e2 += Math.log(t2[n2]), a22 += t2[n2];
        return Math.exp(e2 / t2.length) * t2.length / a22;
      }, spectralFlux: function(r2) {
        var t2 = r2.signal, e2 = r2.previousSignal, a22 = r2.bufferSize;
        if ("object" != typeof t2 || "object" != typeof e2) throw new TypeError();
        for (var n2 = 0, o2 = -a22 / 2; o2 < t2.length / 2 - 1; o2++) x = Math.abs(t2[o2]) - Math.abs(e2[o2]), n2 += (x + Math.abs(x)) / 2;
        return n2;
      }, spectralKurtosis: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        var e2 = t2, a22 = l(1, e2), n2 = l(2, e2), o2 = l(3, e2), i2 = l(4, e2);
        return (-3 * Math.pow(a22, 4) + 6 * a22 * n2 - 4 * a22 * o2 + i2) / Math.pow(Math.sqrt(n2 - Math.pow(a22, 2)), 4);
      }, spectralRolloff: function(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.sampleRate;
        if ("object" != typeof t2) throw new TypeError();
        for (var a22 = t2, n2 = e2 / (2 * (a22.length - 1)), o2 = 0, i2 = 0; i2 < a22.length; i2++) o2 += a22[i2];
        for (var u2 = 0.99 * o2, f2 = a22.length - 1; o2 > u2 && f2 >= 0; ) o2 -= a22[f2], --f2;
        return (f2 + 1) * n2;
      }, spectralSkewness: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        var e2 = l(1, t2), a22 = l(2, t2), n2 = l(3, t2);
        return (2 * Math.pow(e2, 3) - 3 * e2 * a22 + n2) / Math.pow(Math.sqrt(a22 - Math.pow(e2, 2)), 3);
      }, spectralSlope: function(r2) {
        var t2 = r2.ampSpectrum, e2 = r2.sampleRate, a22 = r2.bufferSize;
        if ("object" != typeof t2) throw new TypeError();
        for (var n2 = 0, o2 = 0, i2 = new Float32Array(t2.length), u2 = 0, f2 = 0, c2 = 0; c2 < t2.length; c2++) {
          n2 += t2[c2];
          var l2 = c2 * e2 / a22;
          i2[c2] = l2, u2 += l2 * l2, o2 += l2, f2 += l2 * t2[c2];
        }
        return (t2.length * f2 - o2 * n2) / (n2 * (u2 - Math.pow(o2, 2)));
      }, spectralSpread: function(r2) {
        var t2 = r2.ampSpectrum;
        if ("object" != typeof t2) throw new TypeError();
        return Math.sqrt(l(2, t2) - Math.pow(l(1, t2), 2));
      }, zcr: function(r2) {
        var t2 = r2.signal;
        if ("object" != typeof t2) throw new TypeError();
        for (var e2 = 0, a22 = 1; a22 < t2.length; a22++) (t2[a22 - 1] >= 0 && t2[a22] < 0 || t2[a22 - 1] < 0 && t2[a22] >= 0) && e2++;
        return e2;
      } });
      function d(r2) {
        if (Array.isArray(r2)) {
          for (var t2 = 0, e2 = Array(r2.length); t2 < r2.length; t2++) e2[t2] = r2[t2];
          return e2;
        }
        return Array.from(r2);
      }
      var y = {}, S = {}, _ = { bitReverseArray: function(r2) {
        if (void 0 === y[r2]) {
          for (var t2 = (r2 - 1).toString(2).length, e2 = "0".repeat(t2), a22 = {}, n2 = 0; n2 < r2; n2++) {
            var o2 = n2.toString(2);
            o2 = e2.substr(o2.length) + o2, o2 = [].concat(d(o2)).reverse().join(""), a22[n2] = parseInt(o2, 2);
          }
          y[r2] = a22;
        }
        return y[r2];
      }, multiply: function(r2, t2) {
        return { real: r2.real * t2.real - r2.imag * t2.imag, imag: r2.real * t2.imag + r2.imag * t2.real };
      }, add: function(r2, t2) {
        return { real: r2.real + t2.real, imag: r2.imag + t2.imag };
      }, subtract: function(r2, t2) {
        return { real: r2.real - t2.real, imag: r2.imag - t2.imag };
      }, euler: function(r2, t2) {
        var e2 = -2 * Math.PI * r2 / t2;
        return { real: Math.cos(e2), imag: Math.sin(e2) };
      }, conj: function(r2) {
        return r2.imag *= -1, r2;
      }, constructComplexArray: function(r2) {
        var t2 = {};
        t2.real = void 0 === r2.real ? r2.slice() : r2.real.slice();
        var e2 = t2.real.length;
        return void 0 === S[e2] && (S[e2] = Array.apply(null, Array(e2)).map(Number.prototype.valueOf, 0)), t2.imag = S[e2].slice(), t2;
      } }, b = function(r2) {
        var t2 = {};
        void 0 === r2.real || void 0 === r2.imag ? t2 = _.constructComplexArray(r2) : (t2.real = r2.real.slice(), t2.imag = r2.imag.slice());
        var e2 = t2.real.length, a22 = Math.log2(e2);
        if (Math.round(a22) != a22) throw new Error("Input size must be a power of 2.");
        if (t2.real.length != t2.imag.length) throw new Error("Real and imaginary components must have the same length.");
        for (var n2 = _.bitReverseArray(e2), o2 = { real: [], imag: [] }, i2 = 0; i2 < e2; i2++) o2.real[n2[i2]] = t2.real[i2], o2.imag[n2[i2]] = t2.imag[i2];
        for (var u2 = 0; u2 < e2; u2++) t2.real[u2] = o2.real[u2], t2.imag[u2] = o2.imag[u2];
        for (var f2 = 1; f2 <= a22; f2++) for (var c2 = Math.pow(2, f2), l2 = 0; l2 < c2 / 2; l2++) for (var s2 = _.euler(l2, c2), m2 = 0; m2 < e2 / c2; m2++) {
          var p2 = c2 * m2 + l2, h2 = c2 * m2 + l2 + c2 / 2, g2 = { real: t2.real[p2], imag: t2.imag[p2] }, w2 = { real: t2.real[h2], imag: t2.imag[h2] }, v22 = _.multiply(s2, w2), d2 = _.subtract(g2, v22);
          t2.real[h2] = d2.real, t2.imag[h2] = d2.imag;
          var y2 = _.add(v22, g2);
          t2.real[p2] = y2.real, t2.imag[p2] = y2.imag;
        }
        return t2;
      }, M = b, F = function() {
        function r2(r3, t2) {
          var e2 = this;
          if (this._m = t2, !r3.audioContext) throw this._m.errors.noAC;
          if (r3.bufferSize && !a2(r3.bufferSize)) throw this._m._errors.notPow2;
          if (!r3.source) throw this._m._errors.noSource;
          this._m.audioContext = r3.audioContext, this._m.bufferSize = r3.bufferSize || this._m.bufferSize || 256, this._m.hopSize = r3.hopSize || this._m.hopSize || this._m.bufferSize, this._m.sampleRate = r3.sampleRate || this._m.audioContext.sampleRate || 44100, this._m.callback = r3.callback, this._m.windowingFunction = r3.windowingFunction || "hanning", this._m.featureExtractors = v2, this._m.EXTRACTION_STARTED = r3.startImmediately || false, this._m.channel = "number" == typeof r3.channel ? r3.channel : 0, this._m.inputs = r3.inputs || 1, this._m.outputs = r3.outputs || 1, this._m.numberOfMFCCCoefficients = r3.numberOfMFCCCoefficients || this._m.numberOfMFCCCoefficients || 13, this._m.numberOfBarkBands = r3.numberOfBarkBands || this._m.numberOfBarkBands || 24, this._m.spn = this._m.audioContext.createScriptProcessor(this._m.bufferSize, this._m.inputs, this._m.outputs), this._m.spn.connect(this._m.audioContext.destination), this._m._featuresToExtract = r3.featureExtractors || [], this._m.barkScale = o(this._m.bufferSize, this._m.sampleRate, this._m.bufferSize), this._m.melFilterBank = f(Math.max(this._m.melBands, this._m.numberOfMFCCCoefficients), this._m.sampleRate, this._m.bufferSize), this._m.inputData = null, this._m.previousInputData = null, this._m.frame = null, this._m.previousFrame = null, this.setSource(r3.source), this._m.spn.onaudioprocess = function(r4) {
            var t3;
            null !== e2._m.inputData && (e2._m.previousInputData = e2._m.inputData), e2._m.inputData = r4.inputBuffer.getChannelData(e2._m.channel), e2._m.previousInputData ? ((t3 = new Float32Array(e2._m.previousInputData.length + e2._m.inputData.length - e2._m.hopSize)).set(e2._m.previousInputData.slice(e2._m.hopSize)), t3.set(e2._m.inputData, e2._m.previousInputData.length - e2._m.hopSize)) : t3 = e2._m.inputData;
            var a22 = function(r5, t4, e3) {
              if (r5.length < t4) throw new Error("Buffer is too short for frame length");
              if (e3 < 1) throw new Error("Hop length cannot be less that 1");
              if (t4 < 1) throw new Error("Frame length cannot be less that 1");
              var a3 = 1 + Math.floor((r5.length - t4) / e3);
              return new Array(a3).fill(0).map(function(a4, n2) {
                return r5.slice(n2 * e3, n2 * e3 + t4);
              });
            }(t3, e2._m.bufferSize, e2._m.hopSize);
            a22.forEach(function(r5) {
              e2._m.frame = r5;
              var t4 = e2._m.extract(e2._m._featuresToExtract, e2._m.frame, e2._m.previousFrame);
              "function" == typeof e2._m.callback && e2._m.EXTRACTION_STARTED && e2._m.callback(t4), e2._m.previousFrame = e2._m.frame;
            });
          };
        }
        return r2.prototype.start = function(r3) {
          this._m._featuresToExtract = r3 || this._m._featuresToExtract, this._m.EXTRACTION_STARTED = true;
        }, r2.prototype.stop = function() {
          this._m.EXTRACTION_STARTED = false;
        }, r2.prototype.setSource = function(r3) {
          this._m.source && this._m.source.disconnect(this._m.spn), this._m.source = r3, this._m.source.connect(this._m.spn);
        }, r2.prototype.setChannel = function(r3) {
          r3 <= this._m.inputs ? this._m.channel = r3 : console.error("Channel ".concat(r3, " does not exist. Make sure you've provided a value for 'inputs' that is greater than ").concat(r3, " when instantiating the MeydaAnalyzer"));
        }, r2.prototype.get = function(r3) {
          return this._m.inputData ? this._m.extract(r3 || this._m._featuresToExtract, this._m.inputData, this._m.previousInputData) : null;
        }, r2;
      }(), A = { audioContext: null, spn: null, bufferSize: 512, sampleRate: 44100, melBands: 26, chromaBands: 12, callback: null, windowingFunction: "hanning", featureExtractors: v2, EXTRACTION_STARTED: false, numberOfMFCCCoefficients: 13, numberOfBarkBands: 24, _featuresToExtract: [], windowing: n, _errors: { notPow2: new Error("Meyda: Buffer size must be a power of 2, e.g. 64 or 512"), featureUndef: new Error("Meyda: No features defined."), invalidFeatureFmt: new Error("Meyda: Invalid feature format"), invalidInput: new Error("Meyda: Invalid input."), noAC: new Error("Meyda: No AudioContext specified."), noSource: new Error("Meyda: No source node specified.") }, createMeydaAnalyzer: function(r2) {
        return new F(r2, Object.assign({}, A));
      }, listAvailableFeatureExtractors: function() {
        return Object.keys(this.featureExtractors);
      }, extract: function(r2, t2, e2) {
        var n2 = this;
        if (!t2) throw this._errors.invalidInput;
        if ("object" != typeof t2) throw this._errors.invalidInput;
        if (!r2) throw this._errors.featureUndef;
        if (!a2(t2.length)) throw this._errors.notPow2;
        void 0 !== this.barkScale && this.barkScale.length == this.bufferSize || (this.barkScale = o(this.bufferSize, this.sampleRate, this.bufferSize)), void 0 !== this.melFilterBank && this.barkScale.length == this.bufferSize && this.melFilterBank.length == this.melBands || (this.melFilterBank = f(Math.max(this.melBands, this.numberOfMFCCCoefficients), this.sampleRate, this.bufferSize)), void 0 !== this.chromaFilterBank && this.chromaFilterBank.length == this.chromaBands || (this.chromaFilterBank = c(this.chromaBands, this.sampleRate, this.bufferSize)), "buffer" in t2 && void 0 === t2.buffer ? this.signal = i(t2) : this.signal = t2;
        var u2 = E(t2, this.windowingFunction, this.bufferSize);
        if (this.signal = u2.windowedSignal, this.complexSpectrum = u2.complexSpectrum, this.ampSpectrum = u2.ampSpectrum, e2) {
          var l2 = E(e2, this.windowingFunction, this.bufferSize);
          this.previousSignal = l2.windowedSignal, this.previousComplexSpectrum = l2.complexSpectrum, this.previousAmpSpectrum = l2.ampSpectrum;
        }
        var s2 = function(r3) {
          return n2.featureExtractors[r3]({ ampSpectrum: n2.ampSpectrum, chromaFilterBank: n2.chromaFilterBank, complexSpectrum: n2.complexSpectrum, signal: n2.signal, bufferSize: n2.bufferSize, sampleRate: n2.sampleRate, barkScale: n2.barkScale, melFilterBank: n2.melFilterBank, previousSignal: n2.previousSignal, previousAmpSpectrum: n2.previousAmpSpectrum, previousComplexSpectrum: n2.previousComplexSpectrum, numberOfMFCCCoefficients: n2.numberOfMFCCCoefficients, numberOfBarkBands: n2.numberOfBarkBands });
        };
        if ("object" == typeof r2) return r2.reduce(function(r3, t3) {
          var e3;
          return Object.assign({}, r3, ((e3 = {})[t3] = s2(t3), e3));
        }, {});
        if ("string" == typeof r2) return s2(r2);
        throw this._errors.invalidFeatureFmt;
      } }, E = function(r2, t2, e2) {
        var a22 = {};
        void 0 === r2.buffer ? a22.signal = i(r2) : a22.signal = r2, a22.windowedSignal = n(a22.signal, t2), a22.complexSpectrum = M(a22.windowedSignal), a22.ampSpectrum = new Float32Array(e2 / 2);
        for (var o2 = 0; o2 < e2 / 2; o2++) a22.ampSpectrum[o2] = Math.sqrt(Math.pow(a22.complexSpectrum.real[o2], 2) + Math.pow(a22.complexSpectrum.imag[o2], 2));
        return a22;
      };
      return "undefined" != typeof window && (window.Meyda = A), A;
    });
  })(meyda_min$1);
  return meyda_min$1.exports;
}
var meyda_minExports = requireMeyda_min();
const Meyda = /* @__PURE__ */ getDefaultExportFromCjs(meyda_minExports);
class Audio {
  constructor({
    numBins = 4,
    cutoff = 2,
    smooth = 0.4,
    max = 15,
    scale = 10,
    isDrawing = false,
    parentEl = document.body
  }) {
    this.vol = 0;
    this.scale = scale;
    this.max = max;
    this.cutoff = cutoff;
    this.smooth = smooth;
    this.setBins(numBins);
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0,
      // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0
      // keeps track of frames
    };
    this.onBeat = () => {
    };
    this.canvas = document.createElement("canvas");
    this.canvas.width = 100;
    this.canvas.height = 80;
    this.canvas.style.width = "100px";
    this.canvas.style.height = "80px";
    this.canvas.style.position = "absolute";
    this.canvas.style.right = "0px";
    this.canvas.style.bottom = "0px";
    parentEl.appendChild(this.canvas);
    this.isDrawing = isDrawing;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "#DFFFFF";
    this.ctx.strokeStyle = "#0ff";
    this.ctx.lineWidth = 0.5;
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((stream) => {
        this.stream = stream;
        this.context = new AudioContext();
        let audio_stream = this.context.createMediaStreamSource(stream);
        this.meyda = Meyda.createMeydaAnalyzer({
          audioContext: this.context,
          source: audio_stream,
          featureExtractors: [
            "loudness"
            //  'perceptualSpread',
            //  'perceptualSharpness',
            //  'spectralCentroid'
          ]
        });
      }).catch((err) => console.log("ERROR", err));
    }
  }
  destroy() {
    if (this.context) {
      this.context.close();
      this.context = void 0;
      if (this.meyda) {
        this.meyda = void 0;
      }
    }
  }
  detectBeat(level) {
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.onBeat();
      this.beat._cutoff = level * 1.2;
      this.beat._framesSinceBeat = 0;
    } else {
      if (this.beat._framesSinceBeat <= this.beat.holdFrames) {
        this.beat._framesSinceBeat++;
      } else {
        this.beat._cutoff *= this.beat.decay;
        this.beat._cutoff = Math.max(this.beat._cutoff, this.beat.threshold);
      }
    }
  }
  tick() {
    if (this.meyda) {
      var features = this.meyda.get();
      if (features && features !== null) {
        this.vol = features.loudness.total;
        this.detectBeat(this.vol);
        const reducer = (accumulator, currentValue) => accumulator + currentValue;
        let spacing = Math.floor(features.loudness.specific.length / this.bins.length);
        this.prevBins = this.bins.slice(0);
        this.bins = this.bins.map((bin, index) => {
          return features.loudness.specific.slice(index * spacing, (index + 1) * spacing).reduce(reducer);
        }).map((bin, index) => {
          return bin * (1 - this.settings[index].smooth) + this.prevBins[index] * this.settings[index].smooth;
        });
        this.fft = this.bins.map((bin, index) => (
          // Math.max(0, (bin - this.cutoff) / (this.max - this.cutoff))
          Math.max(0, (bin - this.settings[index].cutoff) / this.settings[index].scale)
        ));
        if (this.isDrawing) this.draw();
      }
    }
  }
  setCutoff(cutoff) {
    this.cutoff = cutoff;
    this.settings = this.settings.map((el) => {
      el.cutoff = cutoff;
      return el;
    });
  }
  setSmooth(smooth) {
    this.smooth = smooth;
    this.settings = this.settings.map((el) => {
      el.smooth = smooth;
      return el;
    });
  }
  setBins(numBins) {
    this.bins = Array(numBins).fill(0);
    this.prevBins = Array(numBins).fill(0);
    this.fft = Array(numBins).fill(0);
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }));
    this.bins.forEach((bin, index) => {
      window["a" + index] = (scale = 1, offset2 = 0) => () => a.fft[index] * scale + offset2;
    });
  }
  setScale(scale) {
    this.scale = scale;
    this.settings = this.settings.map((el) => {
      el.scale = scale;
      return el;
    });
  }
  setMax(max) {
    this.max = max;
    console.log("set max is deprecated");
  }
  hide() {
    this.isDrawing = false;
    this.canvas.style.display = "none";
  }
  show() {
    this.isDrawing = true;
    this.canvas.style.display = "block";
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var spacing = this.canvas.width / this.bins.length;
    var scale = this.canvas.height / (this.max * 2);
    this.bins.forEach((bin, index) => {
      var height = bin * scale;
      this.ctx.fillRect(index * spacing, this.canvas.height - height, spacing, height);
      var y = this.canvas.height - scale * this.settings[index].cutoff;
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, y);
      this.ctx.lineTo((index + 1) * spacing, y);
      this.ctx.stroke();
      var yMax = this.canvas.height - scale * (this.settings[index].scale + this.settings[index].cutoff);
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, yMax);
      this.ctx.lineTo((index + 1) * spacing, yMax);
      this.ctx.stroke();
    });
  }
}
class VideoRecorder {
  constructor(stream) {
    this.mediaSource = new MediaSource();
    this.stream = stream;
    this.output = document.createElement("video");
    this.output.autoplay = true;
    this.output.loop = true;
    let self2 = this;
    this.mediaSource.addEventListener("sourceopen", () => {
      console.log("MediaSource opened");
      self2.sourceBuffer = self2.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
      console.log("Source buffer: ", self2.sourceBuffer);
    });
  }
  start() {
    let options = { mimeType: "video/webm;codecs=vp9" };
    this.recordedBlobs = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e0) {
      console.log("Unable to create MediaRecorder with options Object: ", e0);
      try {
        options = { mimeType: "video/webm,codecs=vp9" };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (e1) {
        console.log("Unable to create MediaRecorder with options Object: ", e1);
        try {
          options = "video/vp8";
          this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e2) {
          alert("MediaRecorder is not supported by this browser.\n\nTry Firefox 29 or later, or Chrome 47 or later, with Enable experimental Web Platform features enabled from chrome://flags.");
          console.error("Exception while creating MediaRecorder:", e2);
          return;
        }
      }
    }
    console.log("Created MediaRecorder", this.mediaRecorder, "with options", options);
    this.mediaRecorder.onstop = this._handleStop.bind(this);
    this.mediaRecorder.ondataavailable = this._handleDataAvailable.bind(this);
    this.mediaRecorder.start(100);
    console.log("MediaRecorder started", this.mediaRecorder);
  }
  stop() {
    this.mediaRecorder.stop();
  }
  _handleStop() {
    const blob = new Blob(this.recordedBlobs, { type: this.mediaRecorder.mimeType });
    const url = window.URL.createObjectURL(blob);
    this.output.src = url;
    const a2 = document.createElement("a");
    a2.style.display = "none";
    a2.href = url;
    let d = /* @__PURE__ */ new Date();
    a2.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.webm`;
    document.body.appendChild(a2);
    a2.click();
    setTimeout(() => {
      document.body.removeChild(a2);
      window.URL.revokeObjectURL(url);
    }, 300);
  }
  _handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }
}
const easing = {
  // no easing, no acceleration
  linear: function(t) {
    return t;
  },
  // accelerating from zero velocity
  easeInQuad: function(t) {
    return t * t;
  },
  // decelerating to zero velocity
  easeOutQuad: function(t) {
    return t * (2 - t);
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  // accelerating from zero velocity
  easeInCubic: function(t) {
    return t * t * t;
  },
  // decelerating to zero velocity
  easeOutCubic: function(t) {
    return --t * t * t + 1;
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  // accelerating from zero velocity
  easeInQuart: function(t) {
    return t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuart: function(t) {
    return 1 - --t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  },
  // accelerating from zero velocity
  easeInQuint: function(t) {
    return t * t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuint: function(t) {
    return 1 + --t * t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
  },
  // sin shape
  sin: function(t) {
    return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2;
  }
};
var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};
var modulo = (n, d) => {
  return (n % d + d) % d;
};
const ArrayUtils = {
  init: () => {
    Array.prototype.fast = function(speed = 1) {
      this._speed = speed;
      return this;
    };
    Array.prototype.smooth = function(smooth = 1) {
      this._smooth = smooth;
      return this;
    };
    Array.prototype.ease = function(ease = "linear") {
      if (typeof ease == "function") {
        this._smooth = 1;
        this._ease = ease;
      } else if (easing[ease]) {
        this._smooth = 1;
        this._ease = easing[ease];
      }
      return this;
    };
    Array.prototype.offset = function(offset2 = 0.5) {
      this._offset = offset2 % 1;
      return this;
    };
    Array.prototype.fit = function(low = 0, high = 1) {
      let lowest = Math.min(...this);
      let highest = Math.max(...this);
      var newArr = this.map((num) => map(num, lowest, highest, low, high));
      newArr._speed = this._speed;
      newArr._smooth = this._smooth;
      newArr._ease = this._ease;
      return newArr;
    };
  },
  getValue: (arr = []) => ({ time, bpm }) => {
    let speed = arr._speed ? arr._speed : 1;
    let smooth = arr._smooth ? arr._smooth : 0;
    let index = time * speed * (bpm / 60) + (arr._offset || 0);
    if (smooth !== 0) {
      let ease = arr._ease ? arr._ease : easing["linear"];
      let _index = index - smooth / 2;
      let currValue = arr[Math.floor(modulo(_index, arr.length))];
      let nextValue = arr[Math.floor(modulo(_index + 1, arr.length))];
      let t = Math.min(modulo(_index, 1) / smooth, 1);
      return ease(t) * (nextValue - currValue) + currValue;
    } else {
      arr[Math.floor(index % arr.length)];
      return arr[Math.floor(index % arr.length)];
    }
  }
};
const Sandbox = (parent) => {
  var initialCode = ``;
  var sandbox = createSandbox(initialCode);
  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `;
    sandbox = createSandbox(initialCode);
  };
  return {
    addToContext,
    eval: (code) => sandbox.eval(code)
  };
  function createSandbox(initial) {
    globalThis.eval(initial);
    var localEval = function(code) {
      globalThis.eval(code);
    };
    return {
      eval: localEval
    };
  }
};
class EvalSandbox {
  constructor(parent, makeGlobal, userProps = []) {
    this.makeGlobal = makeGlobal;
    this.sandbox = Sandbox();
    this.parent = parent;
    var properties = Object.keys(parent);
    properties.forEach((property) => this.add(property));
    this.userProps = userProps;
  }
  add(name) {
    if (this.makeGlobal) window[name] = this.parent[name];
  }
  // sets on window as well as synth object if global (not needed for objects, which can be set directly)
  set(property, value) {
    if (this.makeGlobal) {
      window[property] = value;
    }
    this.parent[property] = value;
  }
  tick() {
    if (this.makeGlobal) {
      this.userProps.forEach((property) => {
        this.parent[property] = window[property];
      });
    }
  }
  eval(code) {
    this.sandbox.eval(code);
  }
}
class VaryingRef {
  constructor(glslName, wgslName) {
    this.glslName = glslName;
    this.wgslName = wgslName;
    this._isVaryingRef = true;
  }
  // Default toString returns GLSL name
  toString() {
    return this.glslName;
  }
}
function createComponentProxy(baseName) {
  return new Proxy({}, {
    get(target, prop) {
      if (typeof prop === "string") {
        const glslPath = `${baseName}.${prop}`;
        const wgslPath = `ourIn.${baseName}.${prop}`;
        return new VaryingRef(glslPath, wgslPath);
      }
      return void 0;
    }
  });
}
const v = new Proxy({}, {
  get(target, prop) {
    switch (prop) {
      case "position":
        return createComponentProxy("v_position");
      case "normal":
        return createComponentProxy("v_normal");
      case "worldNormal":
        return createComponentProxy("v_worldNormal");
      case "tangent":
        return createComponentProxy("v_tangent");
      case "bitangent":
        return createComponentProxy("v_bitangent");
      case "viewDir":
        return createComponentProxy("v_viewDir");
      case "depth":
        return new VaryingRef("v_depth", "ourIn.v_depth");
      case "uv":
        return createComponentProxy("uv");
      case "faceId":
        return new VaryingRef("v_faceId", "ourIn.faceId");
      default:
        console.warn(`Unknown varying property: v.${prop}`);
        return void 0;
    }
  }
});
function isVaryingRef(value) {
  return value && value._isVaryingRef === true;
}
function getVaryingString(varyingRef, isWGSL) {
  if (!isVaryingRef(varyingRef)) return varyingRef;
  return isWGSL ? varyingRef.wgslName : varyingRef.glslName;
}
const ensure_decimal_dot = (val) => {
  val = val.toString();
  if (val.indexOf(".") < 0) {
    val += ".";
  }
  return val;
};
function formatArguments(transform, startIndex, synthContext) {
  const defaultArgs = transform.transform.inputs;
  const userArgs = transform.userArgs;
  const { generators } = transform.synth;
  const { src } = generators;
  return defaultArgs.map((input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type,
      //
      isUniform: false,
      name: input.name,
      vecLen: 0
      //  generateGlsl: null // function for creating glsl
    };
    if (typedArg.type === "float") typedArg.value = ensure_decimal_dot(input.default);
    if (input.type.startsWith("vec")) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3));
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`);
      }
    }
    if (userArgs.length > index) {
      typedArg.value = userArgs[index];
      if (isVaryingRef(userArgs[index])) {
        typedArg.value = userArgs[index];
        typedArg.isVaryingRef = true;
        typedArg.isUniform = false;
      } else if (typedArg.type === "vec4") {
        if (!(typedArg.value.type === "GlslSource" || typedArg.value.getTexture)) {
          throw new Error("Arguments must be a texture or GlslSource");
        }
      }
      if (!typedArg.isVaryingRef && typeof userArgs[index] === "function") {
        typedArg.value = (context, props, batchId) => {
          try {
            const val = userArgs[index](props);
            if (typeof val === "number") {
              return val;
            } else {
              console.warn("function does not return a number", userArgs[index]);
            }
            return input.default;
          } catch (e) {
            console.warn("ERROR", e);
            return input.default;
          }
        };
        typedArg.isUniform = true;
      } else if (!typedArg.isVaryingRef && userArgs[index].constructor === Array) {
        typedArg.value = (context, props, batchId) => ArrayUtils.getValue(userArgs[index])(props);
        typedArg.isUniform = true;
      }
    }
    if (startIndex < 0) ;
    else {
      if (typedArg.value && typedArg.value.transforms) {
        typedArg.isUniform = false;
      } else if (typedArg.type === "float" && typeof typedArg.value === "number") {
        typedArg.value = ensure_decimal_dot(typedArg.value);
      } else if (typedArg.type.startsWith("vec") && typeof typedArg.value === "object" && Array.isArray(typedArg.value)) {
        typedArg.isUniform = false;
        typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(", ")})`;
      } else if (input.type === "sampler2D") {
        var x2 = typedArg.value;
        typedArg.value = () => x2.getTexture();
        typedArg.isUniform = true;
      } else {
        if (typedArg.value.getTexture && input.type === "vec4") {
          var x1 = typedArg.value;
          typedArg.value = src(x1);
          typedArg.isUniform = false;
        }
      }
      if (typedArg.isUniform) {
        typedArg.name += startIndex;
      }
    }
    return typedArg;
  });
}
function generateGlsl(transforms, synth) {
  var shaderParams = {
    uniforms: [],
    // list of uniforms used in shader
    glslFunctions: [],
    // list of functions used in shader
    fragColor: "",
    wgsl: synth && synth.isWGSL
  };
  var gen = generateGlsl$1(transforms, shaderParams)("st");
  shaderParams.fragColor = gen;
  let uniforms = {};
  shaderParams.uniforms.forEach((uniform) => uniforms[uniform.name] = uniform);
  shaderParams.uniforms = Object.values(uniforms);
  return shaderParams;
}
function generateGlsl$1(transforms, shaderParams) {
  var fragColor = () => "";
  transforms.forEach((transform) => {
    var inputs = formatArguments(transform, shaderParams.uniforms.length);
    inputs.forEach((input) => {
      if (input.isUniform) {
        shaderParams.uniforms.push(input);
      }
    });
    if (!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform);
    var f0 = fragColor;
    if (transform.transform.type === "src") {
      if (shaderParams.wgsl && inputs[0].type === "sampler2D") {
        let texName = inputs[0].name;
        let sampName = "samp" + texName;
        fragColor = (uv) => {
          return `textureSample( ${texName}, ${sampName}, fract(${uv}))`;
        };
      } else {
        fragColor = (uv) => {
          return `${shaderString(uv, transform.name, inputs, shaderParams)}`;
        };
      }
    } else if (transform.transform.type === "coord") {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs, shaderParams)}`)}`;
    } else if (transform.transform.type === "color") {
      fragColor = (uv) => `${shaderString(`${f0(uv)}`, transform.name, inputs, shaderParams)}`;
    } else if (transform.transform.type === "combine") {
      var f1 = inputs[0].value && inputs[0].value.transforms ? (uv) => `${generateGlsl$1(inputs[0].value.transforms, shaderParams)(uv)}` : inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value;
      fragColor = (uv) => `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`;
    } else if (transform.transform.type === "combineCoord") {
      var f1 = inputs[0].value && inputs[0].value.transforms ? (uv) => `${generateGlsl$1(inputs[0].value.transforms, shaderParams)(uv)}` : inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value;
      fragColor = (uv) => `${f0(`${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`)}`;
    }
  });
  return fragColor;
}
function shaderString(uv, method, inputs, shaderParams) {
  const str = inputs.map((input) => {
    if (input.isUniform) {
      return shaderParams.wgsl ? "uf." + input.name : input.name;
    } else if (input.isVaryingRef && isVaryingRef(input.value)) {
      return getVaryingString(input.value, shaderParams.wgsl);
    } else if (input.value && input.value.transforms) {
      const srcCode = `${generateGlsl$1(input.value.transforms, shaderParams)("st")}`;
      if (input.type === "float") {
        const hasColorOutput = input.value.transforms.some((t) => {
          const type = t.transform.type;
          return type === "src" || type === "color" || type === "combine";
        });
        if (hasColorOutput) {
          return `(${srcCode}).r`;
        }
      }
      return srcCode;
    }
    return input.value;
  }).reduce((p, c) => `${p}, ${c}`, "");
  return `${method}(${uv}${str})`;
}
function contains(object, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (object.name == arr[i].name) return true;
  }
  return false;
}
function isObject(item) {
  return typeof item === "object" && !Array.isArray(item) && item !== null;
}
function isArray$1(a2) {
  return !!a2 && a2.constructor === Array;
}
function isFunction(f) {
  return typeof f === "function";
}
class RegenHydra {
  constructor(glslSource, output, hydra) {
    this.glslSource = glslSource;
    this.output = output;
    this.hydra = hydra;
    this.outs = [];
    this.depth = 0;
  }
  gen(transforms) {
    for (let i = 0; i < transforms.length; ++i) {
      let xf = transforms[i];
      if (i > 0) this.outs.push(".");
      this.outs.push(xf.name);
      this.outs.push("(");
      let args = xf.userArgs;
      if (args && args.length > 0) {
        for (let j = 0; j < args.length; ++j) {
          let a2 = args[j];
          if (j > 0) this.outs.push(",");
          if (isFunction(a2)) {
            this.outs.push(a2.toString());
          } else if (typeof a2 === "string" || a2 instanceof String) {
            this.outs.push(a2);
          } else if (isObject(a2)) {
            if (a2 instanceof HydraSource) {
              this.outs.push(a2.label);
            } else if (a2 instanceof GlslSource || a2 instanceof Output || a2 instanceof OutputWgsl) {
              this.depth++;
              if (isArray$1(a2.transforms)) this.gen(a2.transforms);
              else this.outs.push(a2.label);
              this.depth--;
            }
          } else if (typeof a2 === "number" && !isNaN(a2)) {
            this.outs.push(a2);
          } else if (isArray$1(a2)) {
            this.outs.push("[");
            for (let k = 0; k < a2.length; ++k) {
              if (k > 0) this.outs.push(", ");
              this.outs.push(a2[k]);
            }
            this.outs.push("]");
          } else {
            console.log("Unknown item type used in arglist " + a2);
            this.outs.push(a2);
          }
        }
      }
      this.outs.push(")");
    }
  }
  generate() {
    let xforms = this.glslSource.transforms;
    this.gen(xforms);
    this.outs.push(".out(");
    if (this.output.label !== "o0") this.outs.push(this.output.label);
    this.outs.push(");");
    let os = this.outs.join("");
    return os;
  }
}
function regenerate(glslSource, output) {
  let hydra = output.hydraSynth;
  if (!hydra.regen) return;
  try {
    let regen = new RegenHydra(glslSource, output, hydra);
    let genStr = regen.generate();
    hydra.noteRegenString(regen.output.chanNum, genStr);
  } catch (err) {
    console.log(err);
  }
}
const utilityGlsl = {
  _luminance: {
    type: "util",
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: "util",
    glsl: `
    //	Simplex 3D Noise
    //	by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float _noise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
    `
  },
  _rgbToHsv: {
    type: "util",
    glsl: `vec3 _rgbToHsv(vec3 c){
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: "util",
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  },
  _hash: {
    type: "util",
    glsl: `float _hash(vec3 p){
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }`
  },
  _pinkNoise: {
    type: "util",
    glsl: `float _pinkNoise(vec3 p){
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        // 5 octaves with 1/f amplitude falloff
        for (int i = 0; i < 5; i++) {
            value += amplitude * _noise(p * frequency);
            amplitude *= 0.707; // 1/sqrt(2) for pink spectrum
            frequency *= 2.0;
        }
        return value;
    }`
  },
  _brownNoise: {
    type: "util",
    glsl: `float _brownNoise(vec3 p){
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        // 5 octaves with 1/f^2 amplitude falloff
        for (int i = 0; i < 5; i++) {
            value += amplitude * _noise(p * frequency);
            amplitude *= 0.5; // 1/f^2 for brown spectrum
            frequency *= 2.0;
        }
        return value;
    }`
  }
};
const utilityWgsl = {
  _mod: {
    type: "util",
    wgsl: `fn _mod(x : f32, y: f32) -> f32 {
				return x - y * floor(x / y);
    }`
  },
  _luminance: {
    type: "util",
    wgsl: `fn _luminance(rgb : vec3<f32>) -> f32 {
      const  W = vec3<f32>(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: "util",
    wgsl: `
  fn mod4v(x : vec4<f32>, y : f32) -> vec4<f32> {
  		return x - y * floor (x / y); // exact match for glsl
  		// return x % y; // wgsl uses trunc instead of floor.
  }

// vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  fn permute(xp :vec4<f32>)->vec4<f32> {
  		return  mod4v(((xp*34.0)+1.0)*xp, 289.0);
  	}

  fn taylorInvSqrt(r: vec4<f32>)->vec4<f32>{return 1.79284291400159 - 0.85373472095314 * r;}

  fn _noise(v: vec3<f32>)-> f32 {
    const  C = vec2<f32>(1.0/6.0, 1.0/3.0) ;
    const  D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

  // First corner
    var i : vec3<f32> = floor(v + dot(v, C.yyy) );
    let x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min( g.xyz, l.zxy );
    let i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    let x1 = x0 - i1 + 1.0 * C.xxx;
    let x2 = x0 - i2 + 2.0 * C.xxx;
    let x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i.x = i.x % 289.0;
    i.y = i.y % 289.0;
    i.z = i.z % 289.0;
    let p = permute( permute( permute(
               i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    let n_ = 1.0/7.0; // N=7
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    let x = x_ *ns.x + ns.yyyy;
    let y = y_ *ns.x + ns.yyyy;
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4<f32>( x.xy, y.xy );
    let b1 = vec4<f32>( x.zw, y.zw );

    let s0 = floor(b0)*2.0 + 1.0;
    let s1 = floor(b1)*2.0 + 1.0;
    let sh = -step(h, vec4<f32>(0.0));

    let a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    let a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    var p0 = vec3<f32>(a0.xy,h.x);
    var p1 = vec3<f32>(a0.zw,h.y);
    var p2 = vec3<f32>(a1.xy,h.z);
    var p3 = vec3<f32>(a1.zw,h.w);

  //Normalise gradients
    let norm = taylorInvSqrt(vec4<f32>(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    var m = max(0.6 - vec4<f32>(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), vec4<f32>(0.0));
    m = m * m;

    return 42.0 * dot( m*m, vec4<f32>( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }`
  },
  _rgbToHsv: {
    type: "util",
    wgsl: `fn _rgbToHsv(c: vec3<f32>) -> vec3<f32> {
            let K = vec4<f32>(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            let p = mix(vec4<f32>(c.bg, K.wz), vec4<f32>(c.gb, K.xy), step(c.b, c.g));
            let q = mix(vec4<f32>(p.xyw, c.r), vec4<f32>(c.r, p.yzx), step(p.x, c.r));

            let d = q.x - min(q.w, q.y);
            let e = 1.0e-10;
            return vec3<f32>(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: "util",
    wgsl: `fn _hsvToRgb(c: vec3<f32>) -> vec3<f32> {
        let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        let p : vec3<f32> = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        let cv : vec3<f32> = p - K.xxx;
        let cvmin =  vec3<f32>(0.0, 0.0, 0.0);
        let cvmax =  vec3<f32>(1.0, 1.0, 1.0);
        return  vec3<f32> (c.z * mix(K.xxx, clamp(cv, cvmin, cvmax), c.y));
    }`
  },
  _hash: {
    type: "util",
    wgsl: `fn _hash(p: vec3<f32>) -> f32 {
        return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7))) * 43758.5453);
    }`
  },
  _pinkNoise: {
    type: "util",
    wgsl: `fn _pinkNoise(p: vec3<f32>) -> f32 {
        var value: f32 = 0.0;
        var amplitude: f32 = 0.5;
        var frequency: f32 = 1.0;
        // 5 octaves with 1/f amplitude falloff
        for (var i: i32 = 0; i < 5; i++) {
            value += amplitude * _noise(p * frequency);
            amplitude *= 0.707; // 1/sqrt(2) for pink spectrum
            frequency *= 2.0;
        }
        return value;
    }`
  },
  _brownNoise: {
    type: "util",
    wgsl: `fn _brownNoise(p: vec3<f32>) -> f32 {
        var value: f32 = 0.0;
        var amplitude: f32 = 0.5;
        var frequency: f32 = 1.0;
        // 5 octaves with 1/f^2 amplitude falloff
        for (var i: i32 = 0; i < 5; i++) {
            value += amplitude * _noise(p * frequency);
            amplitude *= 0.5; // 1/f^2 for brown spectrum
            frequency *= 2.0;
        }
        return value;
    }`
  }
};
var GlslSource = function(obj) {
  this.transforms = [];
  this.transforms.push(obj);
  this.defaultOutput = obj.defaultOutput;
  this.synth = obj.synth;
  this.type = "GlslSource";
  this.defaultUniforms = obj.defaultUniforms;
  this.isWGSL = obj.synth.isWGSL;
  return this;
};
GlslSource.prototype.addTransform = function(obj) {
  this.transforms.push(obj);
};
function isGeometry(arg) {
  if (!arg) return false;
  if (Array.isArray(arg)) return true;
  if (arg.vertices) return true;
  return false;
}
function isConfig(arg) {
  if (!arg) return false;
  if (typeof arg !== "object") return false;
  if (Array.isArray(arg)) return false;
  if (arg.vertices) return false;
  return "level" in arg || "blend" in arg || "primitive" in arg || "sprite" in arg;
}
function isOutput(arg) {
  return arg && typeof arg === "object" && "registerSprite" in arg;
}
GlslSource.prototype.out = function(arg1, arg2, arg3, arg4) {
  let output, geometry, config;
  if (isGeometry(arg1)) {
    output = this.defaultOutput;
    geometry = arg1;
    config = isConfig(arg2) ? arg2 : {};
    if (typeof arg2 === "number") {
      config = { level: arg2, blend: arg3 || "normal" };
    }
  } else if (isOutput(arg1) || arg1 === void 0 || arg1 === null) {
    output = arg1 || this.defaultOutput;
    if (isGeometry(arg2)) {
      geometry = arg2;
      config = isConfig(arg3) ? arg3 : {};
      if (typeof arg3 === "number") {
        config = { level: arg3, blend: arg4 || "normal" };
      }
    } else if (isConfig(arg2)) {
      geometry = null;
      config = arg2;
    } else if (arg2 === null && isConfig(arg3)) {
      geometry = null;
      config = arg3;
    } else {
      geometry = null;
      config = {};
    }
  } else {
    output = arg1 || this.defaultOutput;
    geometry = null;
    config = {};
  }
  const level = config.level !== void 0 ? config.level : 0;
  const blend = config.blend || "normal";
  const primitive = config.primitive || "triangles";
  const sprite = config.sprite || null;
  if (output) try {
    var glsl = this.glsl(output);
    this.synth.currentFunctions = [];
    if (output.sprites && output.sprites.has(level) && output.defaultPositionBuffer) {
      const oldSprite = output.sprites.get(level);
      if (oldSprite.positionBuffer && oldSprite.positionBuffer !== output.defaultPositionBuffer) {
        oldSprite.positionBuffer.destroy();
      }
    }
    output.registerSprite(level, {
      passes: glsl,
      vertexData: geometry,
      blendMode: blend,
      primitive,
      sprite
    });
  } catch (error) {
    console.warn("shader could not compile", error);
  }
  regenerate(this, output);
};
GlslSource.prototype.glsl = function() {
  var passes = [];
  var transforms = [];
  this.transforms.forEach((transform) => {
    if (transform.transform.type === "renderpass") {
      console.warn("no support for renderpass");
    } else {
      transforms.push(transform);
    }
  });
  if (transforms.length > 0) passes.push(this.compile(transforms));
  return passes;
};
GlslSource.prototype.compile = function(transforms) {
  var shaderInfo = generateGlsl(transforms, this.synth);
  var uniforms = {};
  shaderInfo.uniforms.forEach((uniform) => {
    uniforms[uniform.name] = uniform.value;
  });
  let frag;
  if (this.isWGSL) {
    frag = `${Object.values(utilityWgsl).map((transform) => {
      return `
            ${transform.wgsl}
          `;
    }).join("")}

 ${shaderInfo.glslFunctions.map((transform) => {
      if (this.isWGSL && transform.transform.strange) return "";
      return `
            ${transform.transform.wgsl}
          `;
    }).join("")}

  @fragment
  fn main(ourIn: VertexOutput) -> @location(0) vec4<f32> {
    let c : vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1);
    var st : vec2<f32>;

    // If using sprite grid (cols > 1 or rows > 1), use faceId to pick cell
    if (u_spriteGrid.x > 1.0 || u_spriteGrid.y > 1.0) {
      // faceId maps to cell in row-major order (left-to-right, top-to-bottom)
      let cellX = ourIn.faceId % u_spriteGrid.x;
      let cellY = floor(ourIn.faceId / u_spriteGrid.x);
      let cellSize = vec2<f32>(1.0 / u_spriteGrid.x, 1.0 / u_spriteGrid.y);
      st = ourIn.texcoord * cellSize + vec2<f32>(cellX, cellY) * cellSize;
    } else {
      // Fallback to u_spriteUV for single sprite picking
      st = u_spriteUV.xy + ourIn.texcoord * (u_spriteUV.zw - u_spriteUV.xy);
    }

    return ${shaderInfo.fragColor};
  }
		`;
  } else {
    frag = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(shaderInfo.uniforms).map((uniform) => {
      let type = uniform.type;
      switch (uniform.type) {
        case "texture":
          type = "sampler2D";
          break;
      }
      return `
      uniform ${type} ${uniform.name};`;
    }).join("")}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  varying float v_faceId;

  // Vertex data from vertex shader (for 3D geometry)
  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec3 v_worldNormal;
  varying vec3 v_tangent;
  varying vec3 v_bitangent;
  varying vec3 v_viewDir;
  varying float v_depth;

  uniform sampler2D prevBuffer;
  uniform vec4 u_spriteUV;  // x=uMin, y=vMin, z=uMax, w=vMax (fallback when no faceId)
  uniform vec2 u_spriteGrid;  // cols, rows for faceId-based sprite picking

  ${Object.values(utilityGlsl).map((transform) => {
      return `
            ${transform.glsl}
          `;
    }).join("")}

  ${shaderInfo.glslFunctions.map((transform) => {
      return `
            ${transform.transform.glsl}
          `;
    }).join("")}

  void main () {
    vec2 st;
    // If using sprite grid (cols > 1 or rows > 1), use faceId to pick cell
    if (u_spriteGrid.x > 1.0 || u_spriteGrid.y > 1.0) {
      // faceId maps to cell in row-major order (left-to-right, top-to-bottom)
      float cellX = mod(v_faceId, u_spriteGrid.x);
      float cellY = floor(v_faceId / u_spriteGrid.x);
      vec2 cellSize = vec2(1.0 / u_spriteGrid.x, 1.0 / u_spriteGrid.y);
      st = uv * cellSize + vec2(cellX, cellY) * cellSize;
    } else {
      // Fallback to u_spriteUV for single sprite picking
      st = u_spriteUV.xy + uv * (u_spriteUV.zw - u_spriteUV.xy);
    }

    gl_FragColor = ${shaderInfo.fragColor};
  }
  `;
  }
  return {
    frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  };
};
const glslFunctions = () => [
  {
    name: "noise",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 0.1
      }
    ],
    glsl: `   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);`,
    wgsl: `   return vec4<f32>(vec3<f32>(_noise(vec3(_st*scale, offset*time))), 1.0);`,
    needs: ["_noise"]
  },
  {
    name: "whiteNoise",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 10
      },
      {
        type: "float",
        name: "speed",
        default: 1
      }
    ],
    glsl: `   return vec4(vec3(_hash(vec3(floor(_st*scale), time*speed))), 1.0);`,
    wgsl: `   return vec4<f32>(vec3<f32>(_hash(vec3<f32>(floor(_st*scale), time*speed))), 1.0);`,
    needs: ["_hash"]
  },
  {
    name: "pinkNoise",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 0.1
      }
    ],
    glsl: `   return vec4(vec3(_pinkNoise(vec3(_st*scale, offset*time))), 1.0);`,
    wgsl: `   return vec4<f32>(vec3<f32>(_pinkNoise(vec3<f32>(_st*scale, offset*time))), 1.0);`,
    needs: ["_pinkNoise", "_noise"]
  },
  {
    name: "brownNoise",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 0.1
      }
    ],
    glsl: `   return vec4(vec3(_brownNoise(vec3(_st*scale, offset*time))), 1.0);`,
    wgsl: `   return vec4<f32>(vec3<f32>(_brownNoise(vec3<f32>(_st*scale, offset*time))), 1.0);`,
    needs: ["_brownNoise", "_noise"]
  },
  {
    name: "voronoi",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 5
      },
      {
        type: "float",
        name: "speed",
        default: 0.3
      },
      {
        type: "float",
        name: "blending",
        default: 0.3
      }
    ],
    glsl: `   vec3 color = vec3(.0);
   // Scale
   _st *= scale;
   // Tile the space
   vec2 i_st = floor(_st);
   vec2 f_st = fract(_st);
   float m_dist = 10.;  // minimun distance
   vec2 m_point;        // minimum point
   for (int j=-1; j<=1; j++ ) {
   for (int i=-1; i<=1; i++ ) {
   vec2 neighbor = vec2(float(i),float(j));
   vec2 p = i_st + neighbor;
   vec2 point = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   vec2 diff = neighbor + point - f_st;
   float dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color += dot(m_point,vec2(.3,.6));
   color *= 1.0 - blending*m_dist;
   return vec4(color, 1.0);`,
    wgsl: `
	 var color = vec3<f32>(.0);
   // Scale
   var st = _st * scale;
   // Tile the space
   let i_st = floor(st);
   let f_st = fract(st);
   var m_dist : f32 = 10.;  // minimun distance
   var m_point : vec2<f32>; // minimum point
   for (var j=-1; j<=1; j++ ) {
   for (var i=-1; i<=1; i++ ) {
   var neighbor = vec2<f32>(f32(i),f32(j));
   var p = i_st + neighbor;
   var point = fract(sin(vec2<f32>(dot(p,vec2<f32>(127.1,311.7)),dot(p,vec2<f32>(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   let diff = neighbor + point - f_st;
   let dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color = color + dot(m_point,vec2<f32>(.3,.6));
   color = color * (1.0 - blending*m_dist);
 return vec4<f32>(color, 1.0);
`
  },
  {
    name: "osc",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "frequency",
        default: 60
      },
      {
        type: "float",
        name: "sync",
        default: 0.1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`,
    wgsl: `  var st = vec2<f32>(_st);
   let r = f32(sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5);
   let g = f32(sin((st.x+time*sync)*frequency)*0.5 + 0.5);
   let b = f32(sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5);
   return vec4<f32>(r, g, b, 1.0);`
  },
  {
    name: "shape",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "sides",
        default: 3
      },
      {
        type: "float",
        name: "radius",
        default: 0.3
      },
      {
        type: "float",
        name: "smoothing",
        default: 0.01
      }
    ],
    glsl: `   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing + 0.0000001,d)), 1.0);`,
    wgsl: `  var st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   let a = f32(atan2(st.x,st.y)+3.1416);
   let r = f32((2.*3.1416)/sides);
   let d = f32(cos(floor(.5+a/r)*r-a)*length(st));
   return vec4<f32>(vec3<f32>(1.0-smoothstep(radius,radius + smoothing + 0.0000001,d)), 1.0);`
  },
  {
    name: "gradient",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   return vec4(_st, sin(time*speed), 1.0);`,
    wgsl: `   return vec4<f32>(_st, sin(time*speed), 1.0);`
  },
  {
    name: "src",
    type: "src",
    inputs: [
      {
        type: "sampler2D",
        name: "tex",
        default: NaN
      }
    ],
    strange: true,
    glsl: `   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`,
    // This variant should not be actually used as the texture sampler stuff
    // is handled explicitly in generateGlsl.
    wgsl: `
//		return texture2D(tex, fract(_st));`
  },
  {
    name: "solid",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 0
      },
      {
        type: "float",
        name: "g",
        default: 0
      },
      {
        type: "float",
        name: "b",
        default: 0
      },
      {
        type: "float",
        name: "a",
        default: 1
      }
    ],
    glsl: `   return vec4(r, g, b, a);`,
    wgsl: `   return vec4<f32>(r, g, b, a);`
  },
  {
    name: "rotate",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "angle",
        default: 10
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`,
    wgsl: `  var xy = _st - vec2<f32>(0.5);
   let ang = f32(angle + speed *time);
   xy = mat2x2<f32>(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy = xy + 0.5;
   return xy;`
  },
  {
    name: "scale",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1.5
      },
      {
        type: "float",
        name: "xMult",
        default: 1
      },
      {
        type: "float",
        name: "yMult",
        default: 1
      },
      {
        type: "float",
        name: "offsetX",
        default: 0.5
      },
      {
        type: "float",
        name: "offsetY",
        default: 0.5
      }
    ],
    glsl: `   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `,
    wgsl: `  var xy = _st - vec2<f32>(offsetX, offsetY);
   xy = xy * (1.0/vec2<f32>(amount*xMult, amount*yMult));
   xy = xy + vec2<f32>(offsetX, offsetY);
   return xy;
   `
  },
  {
    name: "pixelate",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "pixelX",
        default: 20
      },
      {
        type: "float",
        name: "pixelY",
        default: 20
      }
    ],
    glsl: `   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`,
    wgsl: `  let xy = vec2<f32>(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: "posterize",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "bins",
        default: 3
      },
      {
        type: "float",
        name: "gamma",
        default: 0.6
      }
    ],
    glsl: `   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`,
    wgsl: `  var c2 : vec4<f32> = pow(_c0, vec4<f32>(gamma));
   c2 = c2 * vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4<f32>(1.0/gamma));
   return vec4<f32>(c2.xyz, _c0.a);`
  },
  {
    name: "shift",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 0.5
      },
      {
        type: "float",
        name: "g",
        default: 0
      },
      {
        type: "float",
        name: "b",
        default: 0
      },
      {
        type: "float",
        name: "a",
        default: 0
      }
    ],
    glsl: `   vec4 c2 = vec4(_c0);
   c2.r = fract(c2.r + r);
   c2.g = fract(c2.g + g);
   c2.b = fract(c2.b + b);
   c2.a = fract(c2.a + a);
   return vec4(c2.rgba);`,
    wgsl: `  var c2 = vec4<f32>(_c0);
   c2.r = fract(c2.r + r);
   c2.g = fract(c2.g + g);
   c2.b = fract(c2.b + b);
   c2.a = fract(c2.a + a);
   return vec4<f32>(c2.rgba);`
  },
  {
    name: "repeat",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "repeatX",
        default: 3
      },
      {
        type: "float",
        name: "repeatY",
        default: 3
      },
      {
        type: "float",
        name: "offsetX",
        default: 0
      },
      {
        type: "float",
        name: "offsetY",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`,
    wgsl: `  var st = _st * vec2<f32>(repeatX, repeatY);
   st.x = st.x + (step(1., _mod(st.y, 2.0)) * offsetX);
   st.y = st.y + (step(1., _mod(st.x, 2.0)) * offsetY);
   return fract(st);`
  },
  {
    name: "modulateRepeat",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "repeatX",
        default: 3
      },
      {
        type: "float",
        name: "repeatY",
        default: 3
      },
      {
        type: "float",
        name: "offsetX",
        default: 0.5
      },
      {
        type: "float",
        name: "offsetY",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`,
    wgsl: `  var st = _st * vec2<f32>(repeatX, repeatY);
   st.x = st.x + (step(1., _mod(st.y, 2.0)) + _c0.r * offsetX);
   st.y = st.y + (step(1., _mod(st.x, 2.0)) + _c0.g * offsetY);
   return fract(st);`
  },
  {
    name: "repeatX",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`,
    wgsl: `   var st = _st * vec2<f32>(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y = st.y + (step(1., _mod(st.x, 2.0))* offset);
   return fract(st);`
  },
  {
    name: "modulateRepeatX",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`,
    wgsl: `  var st = _st * vec2<f32>(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y = st.y + (step(1., _mod(st.x, 2.0)) + _c0.r * offset);
   return fract(st);`
  },
  {
    name: "repeatY",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`,
    wgsl: `   var st = _st * vec2<f32>(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x = st.x + (step(1., _mod(st.y, 2.0))* offset);
   return fract(st);`
  },
  {
    name: "modulateRepeatY",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`,
    wgsl: `   var st = _st * vec2<f32>(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x = st.x + (step(1., _mod(st.y,2.0)) + _c0.r * offset);
   return fract(st);`
  },
  {
    name: "kaleid",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "nSides",
        default: 4
      }
    ],
    glsl: `   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`,
    wgsl: `  var st = _st;
   st = st - 0.5;
   let r : f32 = length(st);
   var a : f32 = atan2(st.y, st.x);
   let pi : f32 = 2.*3.1416;
   a = _mod(a, pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2<f32>(cos(a), sin(a));`
  },
  {
    name: "modulateKaleid",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "nSides",
        default: 4
      }
    ],
    glsl: `   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`,
    wgsl: `  var st = _st - 0.5;
   let r : f32= length(st);
   var a : f32 = atan2(st.y, st.x);
   let pi : f32= 2.*3.1416;
   a = _mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2<f32>(cos(a), sin(a));`
  },
  {
    name: "scroll",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speedX",
        default: 0
      },
      {
        type: "float",
        name: "speedY",
        default: 0
      }
    ],
    glsl: `
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return fract(_st);`,
    wgsl: `
	 var st : vec2<f32> = _st;
   st.x = st.x + (scrollX + time*speedX);
   st.y =  st.y + (scrollY + time*speedY);
   return fract(st);`
  },
  {
    name: "scrollX",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.x += scrollX + time*speed;
   return fract(_st);`,
    wgsl: `  var st : vec2<f32>  = _st;
	 st.x = st.x + (scrollX + time*speed);
   return fract(st);`
  },
  {
    name: "modulateScrollX",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.x += _c0.r*scrollX + time*speed;
   return fract(_st);`,
    wgsl: `   var st : vec2<f32>  = _st; 
	  st.x = st.x + (_c0.r*scrollX + time*speed);
   return fract(st);`
  },
  {
    name: "scrollY",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.y += scrollY + time*speed;
   return fract(_st);`,
    wgsl: `  var st : vec2<f32>  = _st;
   st.y = st.y + (scrollY + time*speed);
   return fract(st);`
  },
  {
    name: "modulateScrollY",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.y += _c0.r*scrollY + time*speed;
   return fract(_st);`,
    wgsl: `  var st : vec2<f32>  = _st;
   st.y = st.y + (_c0.r*scrollY + time*speed);
   return fract(st);`
  },
  {
    name: "add",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: `   return (_c0+_c1)*amount + _c0*(1.0-amount);`,
    wgsl: `   return (_c0+_c1)*amount + _c0*(1.0-amount);`
  },
  {
    name: "sub",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: `   return (_c0-_c1)*amount + _c0*(1.0-amount);`,
    wgsl: `   return (_c0-_c1)*amount + _c0*(1.0-amount);`
  },
  {
    name: "layer",
    type: "combine",
    inputs: [],
    glsl: `   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), clamp(_c0.a + _c1.a, 0.0, 1.0));`,
    wgsl: `   return vec4<f32>(mix(_c0.rgb, _c1.rgb, _c1.a), clamp(_c0.a + _c1.a, 0.0, 1.0));`
  },
  {
    name: "blend",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.5
      }
    ],
    glsl: `   return _c0*(1.0-amount)+_c1*amount;`,
    wgsl: `   return _c0*(1.0-amount)+_c1*amount;`
  },
  {
    name: "mult",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: `   return _c0*(1.0-amount)+(_c0*_c1)*amount;`,
    wgsl: `   return _c0*(1.0-amount)+(_c0*_c1)*amount;`
  },
  {
    name: "diff",
    type: "combine",
    inputs: [],
    glsl: `   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`,
    wgsl: `   return vec4<f32>(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`
  },
  {
    name: "modulate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.1
      }
    ],
    glsl: `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`,
    wgsl: `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
  },
  {
    name: "modulateScale",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 1
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`,
    wgsl: `  var xy : vec2<f32> = _st - vec2<f32>(0.5);
   xy =xy *(1.0/vec2<f32>(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy= xy + vec2<f32>(0.5);
   return xy;`
  },
  {
    name: "modulatePixelate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 3
      }
    ],
    glsl: `   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`,
    wgsl: `   let xy : vec2<f32> = vec2<f32>(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: "modulateRotate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`,
    wgsl: `  var xy : vec2<f32> = _st - vec2<f32>(0.5);
   let angle = offset + _c0.x * multiple;
   xy = mat2x2<f32>(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy = xy +  0.5;
   return xy;`
  },
  {
    name: "modulateHue",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: `   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`,
    wgsl: `   return _st + (vec2<f32>(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`
  },
  {
    name: "invert",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: `   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`,
    wgsl: `   return vec4<f32>((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`
  },
  {
    name: "contrast",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1.6
      }
    ],
    glsl: `   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`,
    wgsl: `   let c = vec4<f32> ((_c0-vec4(0.5))*vec4(amount) + vec4(0.5));
   return vec4<f32>(c.rgb, _c0.a);`
  },
  {
    name: "brightness",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.4
      }
    ],
    glsl: `   return vec4(_c0.rgb + vec3(amount), _c0.a);`,
    wgsl: `   return vec4<f32>(_c0.rgb + vec3<f32>(amount), _c0.a);`
  },
  {
    name: "mask",
    type: "combine",
    inputs: [],
    glsl: `   float a = _luminance(_c1.rgb);
  return vec4(_c0.rgb*a, a*_c0.a);`,
    wgsl: `   let a = _luminance(_c1.rgb);
  return vec4<f32>(_c0.rgb*a, a*_c0.a);`
  },
  {
    name: "luma",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "threshold",
        default: 0.5
      },
      {
        type: "float",
        name: "tolerance",
        default: 0.1
      }
    ],
    glsl: `   float a = smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`,
    wgsl: `   let a : f32 = smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb));
   return vec4<f32>(_c0.rgb*a, a);`
  },
  {
    name: "thresh",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "threshold",
        default: 0.5
      },
      {
        type: "float",
        name: "tolerance",
        default: 0.04
      }
    ],
    glsl: `   return vec4(vec3(smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb))), _c0.a);`,
    wgsl: `   return vec4<f32>(vec3<f32>(smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb))), _c0.a);`
  },
  {
    name: "color",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 1
      },
      {
        type: "float",
        name: "g",
        default: 1
      },
      {
        type: "float",
        name: "b",
        default: 1
      },
      {
        type: "float",
        name: "a",
        default: 1
      }
    ],
    glsl: `   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`,
    wgsl: `  let c = vec4<f32>(r, g, b, a);
   let pos : vec4<f32> = step(vec4<f32>(0.0), c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4<f32>(mix((1.0-_c0)*abs(c), c*_c0, pos));`
  },
  {
    name: "saturate",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 2
      }
    ],
    glsl: `   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`,
    wgsl: `   const W = vec3<f32>(0.2125, 0.7154, 0.0721);
    let intensity = vec3<f32>(dot(_c0.rgb, W));
   return vec4<f32>(mix(intensity, _c0.rgb, amount), _c0.a);`
  },
  {
    name: "hue",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "hue",
        default: 0.4
      }
    ],
    glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`,
    wgsl: `   var c  = _rgbToHsv(_c0.rgb);
   c.r = c.r + hue;
   //  c.r = fract(c.r);
   return vec4<f32>(_hsvToRgb(c), _c0.a);`,
    needs: ["_rgbToHsv", "_hsvToRgb"]
  },
  {
    name: "colorama",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 5e-3
      }
    ],
    glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`,
    wgsl: `  var c : vec3<f32> = _rgbToHsv(_c0.rgb);
   c = c + vec3<f32>(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4<f32>(c, _c0.a);`,
    needs: ["_rgbToHsv", "_hsvToRgb"]
  },
  {
    name: "prev",
    type: "src",
    inputs: [],
    glsl: `   return texture2D(prevBuffer, fract(_st));`,
    // There is only one preview sampler per render chain
    // so we can get away with using an unmodified name.
    wgsl: `   return samplerprev(prevBuffer, fract(_st));`
  },
  {
    name: "sum",
    type: "color",
    inputs: [
      {
        type: "vec4",
        name: "scale",
        default: 1
      }
    ],
    glsl: `   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`,
    wgsl: `  let v = vec4<f32> = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   fn sum( _st : vec2<f32>, s : vec4<f32>) -> f32 { // vec4 is not a typo, because argument type is not overloaded
   v : vec2<f32> = _st.xy * s.xy;
   return v.x + v.y;`
  },
  {
    name: "r",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   return vec4(_c0.r * scale + offset);`,
    wgsl: `   return vec4<f32>(_c0.r * scale + offset);`
  },
  {
    name: "g",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   return vec4(_c0.g * scale + offset);`,
    wgsl: `   return vec4<f32>(_c0.g * scale + offset);`
  },
  {
    name: "b",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   return vec4(_c0.b * scale + offset);`,
    wgsl: `   return vec4<f32>(_c0.b * scale + offset);`
  },
  {
    name: "a",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   return vec4(_c0.a * scale + offset);`,
    wgsl: `   return vec4<f32>(_c0.a * scale + offset);`
  },
  {
    name: "luminance",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   float l = dot(_c0.rgb, vec3(0.2126, 0.7152, 0.0722)) * scale + offset;
   return vec4(l, l, l, _c0.a);`,
    wgsl: `   let l = dot(_c0.rgb, vec3<f32>(0.2126, 0.7152, 0.0722)) * scale + offset;
   return vec4<f32>(l, l, l, _c0.a);`
  },
  {
    name: "avg",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   float a = ((_c0.r + _c0.g + _c0.b) / 3.0) * scale + offset;
   return vec4(a, a, a, _c0.a);`,
    wgsl: `   let a = ((_c0.r + _c0.g + _c0.b) / 3.0) * scale + offset;
   return vec4<f32>(a, a, a, _c0.a);`
  },
  {
    name: "cmax",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   float m = max(_c0.r, max(_c0.g, _c0.b)) * scale + offset;
   return vec4(m, m, m, _c0.a);`,
    wgsl: `   let m = max(_c0.r, max(_c0.g, _c0.b)) * scale + offset;
   return vec4<f32>(m, m, m, _c0.a);`
  },
  {
    name: "cmin",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   float m = min(_c0.r, min(_c0.g, _c0.b)) * scale + offset;
   return vec4(m, m, m, _c0.a);`,
    wgsl: `   let m = min(_c0.r, min(_c0.g, _c0.b)) * scale + offset;
   return vec4<f32>(m, m, m, _c0.a);`
  },
  {
    name: "clength",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   float l = length(_c0.rgb) * scale + offset;
   return vec4(l, l, l, _c0.a);`,
    wgsl: `   let l = length(_c0.rgb) * scale + offset;
   return vec4<f32>(l, l, l, _c0.a);`
  }
];
class GeneratorFactory {
  constructor({
    genWGSL,
    defaultUniforms,
    defaultOutput,
    extendTransforms = [],
    changeListener = () => {
    }
  } = {}) {
    this.defaultOutput = defaultOutput;
    this.defaultUniforms = defaultUniforms;
    this.changeListener = changeListener;
    this.extendTransforms = extendTransforms;
    this.generators = {};
    this.isWGSL = genWGSL;
    this.init();
  }
  init() {
    const functions = glslFunctions();
    this.glslTransforms = {};
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({ type: "remove", synth: this, method });
      return prev;
    }, {});
    this.sourceClass = /* @__PURE__ */ (() => {
      return class extends GlslSource {
      };
    })();
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms);
    } else if (typeof this.extendTransforms === "object" && this.extendTransforms.type) {
      functions.push(this.extendTransforms);
    }
    return functions.map((transform) => this.setFunction(transform));
  }
  _addMethod(method, transform) {
    const self2 = this;
    this.glslTransforms[method] = transform;
    if (transform.type === "src") {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: self2
      });
      this.generators[method] = func;
      this.changeListener({ type: "add", synth: this, method });
      return func;
    } else {
      this.sourceClass.prototype[method] = function(...args) {
        this.transforms.push({ name: method, transform, userArgs: args, synth: self2 });
        return this;
      };
    }
    return void 0;
  }
  setFunction(obj) {
    var processedGL = this.isWGSL ? processWgsl(obj) : processGlsl(obj);
    if (processedGL) this._addMethod(obj.name, processedGL);
  }
}
const typeLookup = {
  "src": {
    returnType: "vec4",
    args: ["vec2 _st"]
  },
  "coord": {
    returnType: "vec2",
    args: ["vec2 _st"]
  },
  "color": {
    returnType: "vec4",
    args: ["vec4 _c0"]
  },
  "combine": {
    returnType: "vec4",
    args: ["vec4 _c0", "vec4 _c1"]
  },
  "combineCoord": {
    returnType: "vec2",
    args: ["vec2 _st", "vec4 _c0"]
  }
};
const WGSLtypeLookup = {
  "src": {
    returnType: "vec4<f32>",
    args: ["_st : vec2<f32>"]
  },
  "coord": {
    returnType: "vec2<f32>",
    args: ["_st : vec2<f32>"]
  },
  "color": {
    returnType: "vec4<f32>",
    args: ["_c0 : vec4<f32>"]
  },
  "combine": {
    returnType: "vec4<f32>",
    args: [" _c0 : vec4<f32>", "_c1 : vec4<f32>"]
  },
  "combineCoord": {
    returnType: "vec2<f32>",
    args: ["_st : vec2<f32>", "_c0 : vec4<f32>"]
  }
};
function mapGlslToWgsl(type) {
  if (type === "float") return "f32";
  return type;
}
function processGlsl(obj) {
  let t = typeLookup[obj.type];
  if (t) {
    let baseArgs = t.args.map((arg) => arg).join(", ");
    let customArgs = obj.inputs.map((input) => `${input.type} ${input.name}`).join(", ");
    let args = `${baseArgs}${customArgs.length > 0 ? ", " + customArgs : ""}`;
    let glslFunction = `
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`;
    if (obj.type === "combine" || obj.type === "combineCoord") obj.inputs.unshift({
      name: "color",
      type: "vec4"
    });
    return Object.assign({}, obj, { glsl: glslFunction });
  } else {
    console.warn(`type ${obj.type} not recognized`, obj);
  }
}
function processWgsl(obj) {
  let t = WGSLtypeLookup[obj.type];
  if (t) {
    let baseArgs = t.args.map((arg) => arg).join(", ");
    let customArgs = obj.inputs.map((input) => ` ${input.name} : ${mapGlslToWgsl(input.type)}`).join(", ");
    let args = `${baseArgs}${customArgs.length > 0 ? ", " + customArgs : ""}`;
    let wgslFunction = `
   fn ${obj.name}(${args})->${t.returnType}{
      ${obj.wgsl}
  }
`;
    if (obj.type === "combine" || obj.type === "combineCoord") obj.inputs.unshift({
      name: "color",
      type: "vec4"
    });
    return Object.assign({}, obj, { wgsl: wgslFunction });
  } else {
    console.warn(`type ${obj.type} not recognized`, obj);
  }
}
var regl$2 = { exports: {} };
var regl$1 = regl$2.exports;
var hasRequiredRegl;
function requireRegl() {
  if (hasRequiredRegl) return regl$2.exports;
  hasRequiredRegl = 1;
  (function(module, exports) {
    (function(global, factory) {
      module.exports = factory();
    })(regl$1, function() {
      var isTypedArray = function(x2) {
        return x2 instanceof Uint8Array || x2 instanceof Uint16Array || x2 instanceof Uint32Array || x2 instanceof Int8Array || x2 instanceof Int16Array || x2 instanceof Int32Array || x2 instanceof Float32Array || x2 instanceof Float64Array || x2 instanceof Uint8ClampedArray;
      };
      var extend2 = function(base, opts) {
        var keys = Object.keys(opts);
        for (var i = 0; i < keys.length; ++i) {
          base[keys[i]] = opts[keys[i]];
        }
        return base;
      };
      var endl = "\n";
      function decodeB64(str) {
        if (typeof atob !== "undefined") {
          return atob(str);
        }
        return "base64:" + str;
      }
      function raise2(message) {
        var error = new Error("(regl) " + message);
        console.error(error);
        throw error;
      }
      function check(pred, message) {
        if (!pred) {
          raise2(message);
        }
      }
      function encolon(message) {
        if (message) {
          return ": " + message;
        }
        return "";
      }
      function checkParameter(param, possibilities, message) {
        if (!(param in possibilities)) {
          raise2("unknown parameter (" + param + ")" + encolon(message) + ". possible values: " + Object.keys(possibilities).join());
        }
      }
      function checkIsTypedArray(data2, message) {
        if (!isTypedArray(data2)) {
          raise2(
            "invalid parameter type" + encolon(message) + ". must be a typed array"
          );
        }
      }
      function standardTypeEh(value, type) {
        switch (type) {
          case "number":
            return typeof value === "number";
          case "object":
            return typeof value === "object";
          case "string":
            return typeof value === "string";
          case "boolean":
            return typeof value === "boolean";
          case "function":
            return typeof value === "function";
          case "undefined":
            return typeof value === "undefined";
          case "symbol":
            return typeof value === "symbol";
        }
      }
      function checkTypeOf(value, type, message) {
        if (!standardTypeEh(value, type)) {
          raise2(
            "invalid parameter type" + encolon(message) + ". expected " + type + ", got " + typeof value
          );
        }
      }
      function checkNonNegativeInt(value, message) {
        if (!(value >= 0 && (value | 0) === value)) {
          raise2("invalid parameter type, (" + value + ")" + encolon(message) + ". must be a nonnegative integer");
        }
      }
      function checkOneOf(value, list, message) {
        if (list.indexOf(value) < 0) {
          raise2("invalid value" + encolon(message) + ". must be one of: " + list);
        }
      }
      var constructorKeys = [
        "gl",
        "canvas",
        "container",
        "attributes",
        "pixelRatio",
        "extensions",
        "optionalExtensions",
        "profile",
        "onDone"
      ];
      function checkConstructor(obj) {
        Object.keys(obj).forEach(function(key) {
          if (constructorKeys.indexOf(key) < 0) {
            raise2('invalid regl constructor argument "' + key + '". must be one of ' + constructorKeys);
          }
        });
      }
      function leftPad(str, n) {
        str = str + "";
        while (str.length < n) {
          str = " " + str;
        }
        return str;
      }
      function ShaderFile() {
        this.name = "unknown";
        this.lines = [];
        this.index = {};
        this.hasErrors = false;
      }
      function ShaderLine(number, line22) {
        this.number = number;
        this.line = line22;
        this.errors = [];
      }
      function ShaderError(fileNumber, lineNumber, message) {
        this.file = fileNumber;
        this.line = lineNumber;
        this.message = message;
      }
      function guessCommand() {
        var error = new Error();
        var stack = (error.stack || error).toString();
        var pat = /compileProcedure.*\n\s*at.*\((.*)\)/.exec(stack);
        if (pat) {
          return pat[1];
        }
        var pat2 = /compileProcedure.*\n\s*at\s+(.*)(\n|$)/.exec(stack);
        if (pat2) {
          return pat2[1];
        }
        return "unknown";
      }
      function guessCallSite() {
        var error = new Error();
        var stack = (error.stack || error).toString();
        var pat = /at REGLCommand.*\n\s+at.*\((.*)\)/.exec(stack);
        if (pat) {
          return pat[1];
        }
        var pat2 = /at REGLCommand.*\n\s+at\s+(.*)\n/.exec(stack);
        if (pat2) {
          return pat2[1];
        }
        return "unknown";
      }
      function parseSource(source, command) {
        var lines2 = source.split("\n");
        var lineNumber = 1;
        var fileNumber = 0;
        var files = {
          unknown: new ShaderFile(),
          0: new ShaderFile()
        };
        files.unknown.name = files[0].name = command || guessCommand();
        files.unknown.lines.push(new ShaderLine(0, ""));
        for (var i = 0; i < lines2.length; ++i) {
          var line22 = lines2[i];
          var parts = /^\s*#\s*(\w+)\s+(.+)\s*$/.exec(line22);
          if (parts) {
            switch (parts[1]) {
              case "line":
                var lineNumberInfo = /(\d+)(\s+\d+)?/.exec(parts[2]);
                if (lineNumberInfo) {
                  lineNumber = lineNumberInfo[1] | 0;
                  if (lineNumberInfo[2]) {
                    fileNumber = lineNumberInfo[2] | 0;
                    if (!(fileNumber in files)) {
                      files[fileNumber] = new ShaderFile();
                    }
                  }
                }
                break;
              case "define":
                var nameInfo = /SHADER_NAME(_B64)?\s+(.*)$/.exec(parts[2]);
                if (nameInfo) {
                  files[fileNumber].name = nameInfo[1] ? decodeB64(nameInfo[2]) : nameInfo[2];
                }
                break;
            }
          }
          files[fileNumber].lines.push(new ShaderLine(lineNumber++, line22));
        }
        Object.keys(files).forEach(function(fileNumber2) {
          var file = files[fileNumber2];
          file.lines.forEach(function(line3) {
            file.index[line3.number] = line3;
          });
        });
        return files;
      }
      function parseErrorLog(errLog) {
        var result = [];
        errLog.split("\n").forEach(function(errMsg) {
          if (errMsg.length < 5) {
            return;
          }
          var parts = /^ERROR:\s+(\d+):(\d+):\s*(.*)$/.exec(errMsg);
          if (parts) {
            result.push(new ShaderError(
              parts[1] | 0,
              parts[2] | 0,
              parts[3].trim()
            ));
          } else if (errMsg.length > 0) {
            result.push(new ShaderError("unknown", 0, errMsg));
          }
        });
        return result;
      }
      function annotateFiles(files, errors) {
        errors.forEach(function(error) {
          var file = files[error.file];
          if (file) {
            var line22 = file.index[error.line];
            if (line22) {
              line22.errors.push(error);
              file.hasErrors = true;
              return;
            }
          }
          files.unknown.hasErrors = true;
          files.unknown.lines[0].errors.push(error);
        });
      }
      function checkShaderError(gl, shader, source, type, command) {
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          var errLog = gl.getShaderInfoLog(shader);
          var typeName = type === gl.FRAGMENT_SHADER ? "fragment" : "vertex";
          checkCommandType(source, "string", typeName + " shader source must be a string", command);
          var files = parseSource(source, command);
          var errors = parseErrorLog(errLog);
          annotateFiles(files, errors);
          Object.keys(files).forEach(function(fileNumber) {
            var file = files[fileNumber];
            if (!file.hasErrors) {
              return;
            }
            var strings = [""];
            var styles = [""];
            function push(str, style) {
              strings.push(str);
              styles.push(style || "");
            }
            push("file number " + fileNumber + ": " + file.name + "\n", "color:red;text-decoration:underline;font-weight:bold");
            file.lines.forEach(function(line22) {
              if (line22.errors.length > 0) {
                push(leftPad(line22.number, 4) + "|  ", "background-color:yellow; font-weight:bold");
                push(line22.line + endl, "color:red; background-color:yellow; font-weight:bold");
                var offset2 = 0;
                line22.errors.forEach(function(error) {
                  var message = error.message;
                  var token = /^\s*'(.*)'\s*:\s*(.*)$/.exec(message);
                  if (token) {
                    var tokenPat = token[1];
                    message = token[2];
                    switch (tokenPat) {
                      case "assign":
                        tokenPat = "=";
                        break;
                    }
                    offset2 = Math.max(line22.line.indexOf(tokenPat, offset2), 0);
                  } else {
                    offset2 = 0;
                  }
                  push(leftPad("| ", 6));
                  push(leftPad("^^^", offset2 + 3) + endl, "font-weight:bold");
                  push(leftPad("| ", 6));
                  push(message + endl, "font-weight:bold");
                });
                push(leftPad("| ", 6) + endl);
              } else {
                push(leftPad(line22.number, 4) + "|  ");
                push(line22.line + endl, "color:red");
              }
            });
            if (typeof document !== "undefined" && !window.chrome) {
              styles[0] = strings.join("%c");
              console.log.apply(console, styles);
            } else {
              console.log(strings.join(""));
            }
          });
          check.raise("Error compiling " + typeName + " shader, " + files[0].name);
        }
      }
      function checkLinkError(gl, program, fragShader, vertShader, command) {
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          var errLog = gl.getProgramInfoLog(program);
          var fragParse = parseSource(fragShader, command);
          var vertParse = parseSource(vertShader, command);
          var header = 'Error linking program with vertex shader, "' + vertParse[0].name + '", and fragment shader "' + fragParse[0].name + '"';
          if (typeof document !== "undefined") {
            console.log(
              "%c" + header + endl + "%c" + errLog,
              "color:red;text-decoration:underline;font-weight:bold",
              "color:red"
            );
          } else {
            console.log(header + endl + errLog);
          }
          check.raise(header);
        }
      }
      function saveCommandRef(object) {
        object._commandRef = guessCommand();
      }
      function saveDrawCommandInfo(opts, uniforms, attributes, stringStore) {
        saveCommandRef(opts);
        function id2(str) {
          if (str) {
            return stringStore.id(str);
          }
          return 0;
        }
        opts._fragId = id2(opts.static.frag);
        opts._vertId = id2(opts.static.vert);
        function addProps(dict, set) {
          Object.keys(set).forEach(function(u) {
            dict[stringStore.id(u)] = true;
          });
        }
        var uniformSet = opts._uniformSet = {};
        addProps(uniformSet, uniforms.static);
        addProps(uniformSet, uniforms.dynamic);
        var attributeSet = opts._attributeSet = {};
        addProps(attributeSet, attributes.static);
        addProps(attributeSet, attributes.dynamic);
        opts._hasCount = "count" in opts.static || "count" in opts.dynamic || "elements" in opts.static || "elements" in opts.dynamic;
      }
      function commandRaise(message, command) {
        var callSite = guessCallSite();
        raise2(message + " in command " + (command || guessCommand()) + (callSite === "unknown" ? "" : " called from " + callSite));
      }
      function checkCommand(pred, message, command) {
        if (!pred) {
          commandRaise(message, command || guessCommand());
        }
      }
      function checkParameterCommand(param, possibilities, message, command) {
        if (!(param in possibilities)) {
          commandRaise(
            "unknown parameter (" + param + ")" + encolon(message) + ". possible values: " + Object.keys(possibilities).join(),
            command || guessCommand()
          );
        }
      }
      function checkCommandType(value, type, message, command) {
        if (!standardTypeEh(value, type)) {
          commandRaise(
            "invalid parameter type" + encolon(message) + ". expected " + type + ", got " + typeof value,
            command || guessCommand()
          );
        }
      }
      function checkOptional(block) {
        block();
      }
      function checkFramebufferFormat(attachment, texFormats, rbFormats) {
        if (attachment.texture) {
          checkOneOf(
            attachment.texture._texture.internalformat,
            texFormats,
            "unsupported texture format for attachment"
          );
        } else {
          checkOneOf(
            attachment.renderbuffer._renderbuffer.format,
            rbFormats,
            "unsupported renderbuffer format for attachment"
          );
        }
      }
      var GL_CLAMP_TO_EDGE = 33071;
      var GL_NEAREST = 9728;
      var GL_NEAREST_MIPMAP_NEAREST = 9984;
      var GL_LINEAR_MIPMAP_NEAREST = 9985;
      var GL_NEAREST_MIPMAP_LINEAR = 9986;
      var GL_LINEAR_MIPMAP_LINEAR = 9987;
      var GL_BYTE = 5120;
      var GL_UNSIGNED_BYTE = 5121;
      var GL_SHORT = 5122;
      var GL_UNSIGNED_SHORT = 5123;
      var GL_INT = 5124;
      var GL_UNSIGNED_INT = 5125;
      var GL_FLOAT = 5126;
      var GL_UNSIGNED_SHORT_4_4_4_4 = 32819;
      var GL_UNSIGNED_SHORT_5_5_5_1 = 32820;
      var GL_UNSIGNED_SHORT_5_6_5 = 33635;
      var GL_UNSIGNED_INT_24_8_WEBGL = 34042;
      var GL_HALF_FLOAT_OES = 36193;
      var TYPE_SIZE = {};
      TYPE_SIZE[GL_BYTE] = TYPE_SIZE[GL_UNSIGNED_BYTE] = 1;
      TYPE_SIZE[GL_SHORT] = TYPE_SIZE[GL_UNSIGNED_SHORT] = TYPE_SIZE[GL_HALF_FLOAT_OES] = TYPE_SIZE[GL_UNSIGNED_SHORT_5_6_5] = TYPE_SIZE[GL_UNSIGNED_SHORT_4_4_4_4] = TYPE_SIZE[GL_UNSIGNED_SHORT_5_5_5_1] = 2;
      TYPE_SIZE[GL_INT] = TYPE_SIZE[GL_UNSIGNED_INT] = TYPE_SIZE[GL_FLOAT] = TYPE_SIZE[GL_UNSIGNED_INT_24_8_WEBGL] = 4;
      function pixelSize(type, channels) {
        if (type === GL_UNSIGNED_SHORT_5_5_5_1 || type === GL_UNSIGNED_SHORT_4_4_4_4 || type === GL_UNSIGNED_SHORT_5_6_5) {
          return 2;
        } else if (type === GL_UNSIGNED_INT_24_8_WEBGL) {
          return 4;
        } else {
          return TYPE_SIZE[type] * channels;
        }
      }
      function isPow2(v2) {
        return !(v2 & v2 - 1) && !!v2;
      }
      function checkTexture2D(info, mipData, limits) {
        var i;
        var w = mipData.width;
        var h = mipData.height;
        var c = mipData.channels;
        check(
          w > 0 && w <= limits.maxTextureSize && h > 0 && h <= limits.maxTextureSize,
          "invalid texture shape"
        );
        if (info.wrapS !== GL_CLAMP_TO_EDGE || info.wrapT !== GL_CLAMP_TO_EDGE) {
          check(
            isPow2(w) && isPow2(h),
            "incompatible wrap mode for texture, both width and height must be power of 2"
          );
        }
        if (mipData.mipmask === 1) {
          if (w !== 1 && h !== 1) {
            check(
              info.minFilter !== GL_NEAREST_MIPMAP_NEAREST && info.minFilter !== GL_NEAREST_MIPMAP_LINEAR && info.minFilter !== GL_LINEAR_MIPMAP_NEAREST && info.minFilter !== GL_LINEAR_MIPMAP_LINEAR,
              "min filter requires mipmap"
            );
          }
        } else {
          check(
            isPow2(w) && isPow2(h),
            "texture must be a square power of 2 to support mipmapping"
          );
          check(
            mipData.mipmask === (w << 1) - 1,
            "missing or incomplete mipmap data"
          );
        }
        if (mipData.type === GL_FLOAT) {
          if (limits.extensions.indexOf("oes_texture_float_linear") < 0) {
            check(
              info.minFilter === GL_NEAREST && info.magFilter === GL_NEAREST,
              "filter not supported, must enable oes_texture_float_linear"
            );
          }
          check(
            !info.genMipmaps,
            "mipmap generation not supported with float textures"
          );
        }
        var mipimages = mipData.images;
        for (i = 0; i < 16; ++i) {
          if (mipimages[i]) {
            var mw = w >> i;
            var mh = h >> i;
            check(mipData.mipmask & 1 << i, "missing mipmap data");
            var img = mipimages[i];
            check(
              img.width === mw && img.height === mh,
              "invalid shape for mip images"
            );
            check(
              img.format === mipData.format && img.internalformat === mipData.internalformat && img.type === mipData.type,
              "incompatible type for mip image"
            );
            if (img.compressed) ;
            else if (img.data) {
              var rowSize = Math.ceil(pixelSize(img.type, c) * mw / img.unpackAlignment) * img.unpackAlignment;
              check(
                img.data.byteLength === rowSize * mh,
                "invalid data for image, buffer size is inconsistent with image format"
              );
            } else if (img.element) ;
            else if (img.copy) ;
          } else if (!info.genMipmaps) {
            check((mipData.mipmask & 1 << i) === 0, "extra mipmap data");
          }
        }
        if (mipData.compressed) {
          check(
            !info.genMipmaps,
            "mipmap generation for compressed images not supported"
          );
        }
      }
      function checkTextureCube(texture, info, faces, limits) {
        var w = texture.width;
        var h = texture.height;
        var c = texture.channels;
        check(
          w > 0 && w <= limits.maxTextureSize && h > 0 && h <= limits.maxTextureSize,
          "invalid texture shape"
        );
        check(
          w === h,
          "cube map must be square"
        );
        check(
          info.wrapS === GL_CLAMP_TO_EDGE && info.wrapT === GL_CLAMP_TO_EDGE,
          "wrap mode not supported by cube map"
        );
        for (var i = 0; i < faces.length; ++i) {
          var face = faces[i];
          check(
            face.width === w && face.height === h,
            "inconsistent cube map face shape"
          );
          if (info.genMipmaps) {
            check(
              !face.compressed,
              "can not generate mipmap for compressed textures"
            );
            check(
              face.mipmask === 1,
              "can not specify mipmaps and generate mipmaps"
            );
          }
          var mipmaps = face.images;
          for (var j = 0; j < 16; ++j) {
            var img = mipmaps[j];
            if (img) {
              var mw = w >> j;
              var mh = h >> j;
              check(face.mipmask & 1 << j, "missing mipmap data");
              check(
                img.width === mw && img.height === mh,
                "invalid shape for mip images"
              );
              check(
                img.format === texture.format && img.internalformat === texture.internalformat && img.type === texture.type,
                "incompatible type for mip image"
              );
              if (img.compressed) ;
              else if (img.data) {
                check(
                  img.data.byteLength === mw * mh * Math.max(pixelSize(img.type, c), img.unpackAlignment),
                  "invalid data for image, buffer size is inconsistent with image format"
                );
              } else if (img.element) ;
              else if (img.copy) ;
            }
          }
        }
      }
      var check$1 = extend2(check, {
        optional: checkOptional,
        raise: raise2,
        commandRaise,
        command: checkCommand,
        parameter: checkParameter,
        commandParameter: checkParameterCommand,
        constructor: checkConstructor,
        type: checkTypeOf,
        commandType: checkCommandType,
        isTypedArray: checkIsTypedArray,
        nni: checkNonNegativeInt,
        oneOf: checkOneOf,
        shaderError: checkShaderError,
        linkError: checkLinkError,
        callSite: guessCallSite,
        saveCommandRef,
        saveDrawInfo: saveDrawCommandInfo,
        framebufferFormat: checkFramebufferFormat,
        guessCommand,
        texture2D: checkTexture2D,
        textureCube: checkTextureCube
      });
      var VARIABLE_COUNTER = 0;
      var DYN_FUNC = 0;
      var DYN_CONSTANT = 5;
      var DYN_ARRAY = 6;
      function DynamicVariable(type, data2) {
        this.id = VARIABLE_COUNTER++;
        this.type = type;
        this.data = data2;
      }
      function escapeStr(str) {
        return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      }
      function splitParts(str) {
        if (str.length === 0) {
          return [];
        }
        var firstChar = str.charAt(0);
        var lastChar = str.charAt(str.length - 1);
        if (str.length > 1 && firstChar === lastChar && (firstChar === '"' || firstChar === "'")) {
          return ['"' + escapeStr(str.substr(1, str.length - 2)) + '"'];
        }
        var parts = /\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(str);
        if (parts) {
          return splitParts(str.substr(0, parts.index)).concat(splitParts(parts[1])).concat(splitParts(str.substr(parts.index + parts[0].length)));
        }
        var subparts = str.split(".");
        if (subparts.length === 1) {
          return ['"' + escapeStr(str) + '"'];
        }
        var result = [];
        for (var i = 0; i < subparts.length; ++i) {
          result = result.concat(splitParts(subparts[i]));
        }
        return result;
      }
      function toAccessorString(str) {
        return "[" + splitParts(str).join("][") + "]";
      }
      function defineDynamic(type, data2) {
        return new DynamicVariable(type, toAccessorString(data2 + ""));
      }
      function isDynamic(x2) {
        return typeof x2 === "function" && !x2._reglType || x2 instanceof DynamicVariable;
      }
      function unbox(x2, path) {
        if (typeof x2 === "function") {
          return new DynamicVariable(DYN_FUNC, x2);
        } else if (typeof x2 === "number" || typeof x2 === "boolean") {
          return new DynamicVariable(DYN_CONSTANT, x2);
        } else if (Array.isArray(x2)) {
          return new DynamicVariable(DYN_ARRAY, x2.map(function(y, i) {
            return unbox(y, path + "[" + i + "]");
          }));
        } else if (x2 instanceof DynamicVariable) {
          return x2;
        }
        check$1(false, "invalid option type in uniform " + path);
      }
      var dynamic = {
        DynamicVariable,
        define: defineDynamic,
        isDynamic,
        unbox,
        accessor: toAccessorString
      };
      var raf2 = {
        next: typeof requestAnimationFrame === "function" ? function(cb) {
          return requestAnimationFrame(cb);
        } : function(cb) {
          return setTimeout(cb, 16);
        },
        cancel: typeof cancelAnimationFrame === "function" ? function(raf22) {
          return cancelAnimationFrame(raf22);
        } : clearTimeout
      };
      var clock = typeof performance !== "undefined" && performance.now ? function() {
        return performance.now();
      } : function() {
        return +/* @__PURE__ */ new Date();
      };
      function createStringStore() {
        var stringIds = { "": 0 };
        var stringValues = [""];
        return {
          id: function(str) {
            var result = stringIds[str];
            if (result) {
              return result;
            }
            result = stringIds[str] = stringValues.length;
            stringValues.push(str);
            return result;
          },
          str: function(id2) {
            return stringValues[id2];
          }
        };
      }
      function createCanvas(element, onDone, pixelRatio) {
        var canvas = document.createElement("canvas");
        extend2(canvas.style, {
          border: 0,
          margin: 0,
          padding: 0,
          top: 0,
          left: 0,
          width: "100%",
          height: "100%"
        });
        element.appendChild(canvas);
        if (element === document.body) {
          canvas.style.position = "absolute";
          extend2(element.style, {
            margin: 0,
            padding: 0
          });
        }
        function resize() {
          var w = window.innerWidth;
          var h = window.innerHeight;
          if (element !== document.body) {
            var bounds = canvas.getBoundingClientRect();
            w = bounds.right - bounds.left;
            h = bounds.bottom - bounds.top;
          }
          canvas.width = pixelRatio * w;
          canvas.height = pixelRatio * h;
        }
        var resizeObserver;
        if (element !== document.body && typeof ResizeObserver === "function") {
          resizeObserver = new ResizeObserver(function() {
            setTimeout(resize);
          });
          resizeObserver.observe(element);
        } else {
          window.addEventListener("resize", resize, false);
        }
        function onDestroy() {
          if (resizeObserver) {
            resizeObserver.disconnect();
          } else {
            window.removeEventListener("resize", resize);
          }
          element.removeChild(canvas);
        }
        resize();
        return {
          canvas,
          onDestroy
        };
      }
      function createContext(canvas, contextAttributes) {
        function get(name) {
          try {
            return canvas.getContext(name, contextAttributes);
          } catch (e) {
            return null;
          }
        }
        return get("webgl") || get("experimental-webgl") || get("webgl-experimental");
      }
      function isHTMLElement(obj) {
        return typeof obj.nodeName === "string" && typeof obj.appendChild === "function" && typeof obj.getBoundingClientRect === "function";
      }
      function isWebGLContext(obj) {
        return typeof obj.drawArrays === "function" || typeof obj.drawElements === "function";
      }
      function parseExtensions(input) {
        if (typeof input === "string") {
          return input.split();
        }
        check$1(Array.isArray(input), "invalid extension array");
        return input;
      }
      function getElement(desc) {
        if (typeof desc === "string") {
          check$1(typeof document !== "undefined", "not supported outside of DOM");
          return document.querySelector(desc);
        }
        return desc;
      }
      function parseArgs(args_) {
        var args = args_ || {};
        var element, container, canvas, gl;
        var contextAttributes = {};
        var extensions = [];
        var optionalExtensions = [];
        var pixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
        var profile = false;
        var onDone = function(err) {
          if (err) {
            check$1.raise(err);
          }
        };
        var onDestroy = function() {
        };
        if (typeof args === "string") {
          check$1(
            typeof document !== "undefined",
            "selector queries only supported in DOM environments"
          );
          element = document.querySelector(args);
          check$1(element, "invalid query string for element");
        } else if (typeof args === "object") {
          if (isHTMLElement(args)) {
            element = args;
          } else if (isWebGLContext(args)) {
            gl = args;
            canvas = gl.canvas;
          } else {
            check$1.constructor(args);
            if ("gl" in args) {
              gl = args.gl;
            } else if ("canvas" in args) {
              canvas = getElement(args.canvas);
            } else if ("container" in args) {
              container = getElement(args.container);
            }
            if ("attributes" in args) {
              contextAttributes = args.attributes;
              check$1.type(contextAttributes, "object", "invalid context attributes");
            }
            if ("extensions" in args) {
              extensions = parseExtensions(args.extensions);
            }
            if ("optionalExtensions" in args) {
              optionalExtensions = parseExtensions(args.optionalExtensions);
            }
            if ("onDone" in args) {
              check$1.type(
                args.onDone,
                "function",
                "invalid or missing onDone callback"
              );
              onDone = args.onDone;
            }
            if ("profile" in args) {
              profile = !!args.profile;
            }
            if ("pixelRatio" in args) {
              pixelRatio = +args.pixelRatio;
              check$1(pixelRatio > 0, "invalid pixel ratio");
            }
          }
        } else {
          check$1.raise("invalid arguments to regl");
        }
        if (element) {
          if (element.nodeName.toLowerCase() === "canvas") {
            canvas = element;
          } else {
            container = element;
          }
        }
        if (!gl) {
          if (!canvas) {
            check$1(
              typeof document !== "undefined",
              "must manually specify webgl context outside of DOM environments"
            );
            var result = createCanvas(container || document.body, onDone, pixelRatio);
            if (!result) {
              return null;
            }
            canvas = result.canvas;
            onDestroy = result.onDestroy;
          }
          if (contextAttributes.premultipliedAlpha === void 0) contextAttributes.premultipliedAlpha = true;
          gl = createContext(canvas, contextAttributes);
        }
        if (!gl) {
          onDestroy();
          onDone("webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org");
          return null;
        }
        return {
          gl,
          canvas,
          container,
          extensions,
          optionalExtensions,
          pixelRatio,
          profile,
          onDone,
          onDestroy
        };
      }
      function createExtensionCache(gl, config) {
        var extensions = {};
        function tryLoadExtension(name_) {
          check$1.type(name_, "string", "extension name must be string");
          var name2 = name_.toLowerCase();
          var ext;
          try {
            ext = extensions[name2] = gl.getExtension(name2);
          } catch (e) {
          }
          return !!ext;
        }
        for (var i = 0; i < config.extensions.length; ++i) {
          var name = config.extensions[i];
          if (!tryLoadExtension(name)) {
            config.onDestroy();
            config.onDone('"' + name + '" extension is not supported by the current WebGL context, try upgrading your system or a different browser');
            return null;
          }
        }
        config.optionalExtensions.forEach(tryLoadExtension);
        return {
          extensions,
          restore: function() {
            Object.keys(extensions).forEach(function(name2) {
              if (extensions[name2] && !tryLoadExtension(name2)) {
                throw new Error("(regl): error restoring extension " + name2);
              }
            });
          }
        };
      }
      function loop2(n, f) {
        var result = Array(n);
        for (var i = 0; i < n; ++i) {
          result[i] = f(i);
        }
        return result;
      }
      var GL_BYTE$1 = 5120;
      var GL_UNSIGNED_BYTE$2 = 5121;
      var GL_SHORT$1 = 5122;
      var GL_UNSIGNED_SHORT$1 = 5123;
      var GL_INT$1 = 5124;
      var GL_UNSIGNED_INT$1 = 5125;
      var GL_FLOAT$2 = 5126;
      function nextPow16(v2) {
        for (var i = 16; i <= 1 << 28; i *= 16) {
          if (v2 <= i) {
            return i;
          }
        }
        return 0;
      }
      function log2(v2) {
        var r, shift;
        r = (v2 > 65535) << 4;
        v2 >>>= r;
        shift = (v2 > 255) << 3;
        v2 >>>= shift;
        r |= shift;
        shift = (v2 > 15) << 2;
        v2 >>>= shift;
        r |= shift;
        shift = (v2 > 3) << 1;
        v2 >>>= shift;
        r |= shift;
        return r | v2 >> 1;
      }
      function createPool() {
        var bufferPool = loop2(8, function() {
          return [];
        });
        function alloc(n) {
          var sz = nextPow16(n);
          var bin = bufferPool[log2(sz) >> 2];
          if (bin.length > 0) {
            return bin.pop();
          }
          return new ArrayBuffer(sz);
        }
        function free(buf) {
          bufferPool[log2(buf.byteLength) >> 2].push(buf);
        }
        function allocType(type, n) {
          var result = null;
          switch (type) {
            case GL_BYTE$1:
              result = new Int8Array(alloc(n), 0, n);
              break;
            case GL_UNSIGNED_BYTE$2:
              result = new Uint8Array(alloc(n), 0, n);
              break;
            case GL_SHORT$1:
              result = new Int16Array(alloc(2 * n), 0, n);
              break;
            case GL_UNSIGNED_SHORT$1:
              result = new Uint16Array(alloc(2 * n), 0, n);
              break;
            case GL_INT$1:
              result = new Int32Array(alloc(4 * n), 0, n);
              break;
            case GL_UNSIGNED_INT$1:
              result = new Uint32Array(alloc(4 * n), 0, n);
              break;
            case GL_FLOAT$2:
              result = new Float32Array(alloc(4 * n), 0, n);
              break;
            default:
              return null;
          }
          if (result.length !== n) {
            return result.subarray(0, n);
          }
          return result;
        }
        function freeType(array) {
          free(array.buffer);
        }
        return {
          alloc,
          free,
          allocType,
          freeType
        };
      }
      var pool = createPool();
      pool.zero = createPool();
      var GL_SUBPIXEL_BITS = 3408;
      var GL_RED_BITS = 3410;
      var GL_GREEN_BITS = 3411;
      var GL_BLUE_BITS = 3412;
      var GL_ALPHA_BITS = 3413;
      var GL_DEPTH_BITS = 3414;
      var GL_STENCIL_BITS = 3415;
      var GL_ALIASED_POINT_SIZE_RANGE = 33901;
      var GL_ALIASED_LINE_WIDTH_RANGE = 33902;
      var GL_MAX_TEXTURE_SIZE = 3379;
      var GL_MAX_VIEWPORT_DIMS = 3386;
      var GL_MAX_VERTEX_ATTRIBS = 34921;
      var GL_MAX_VERTEX_UNIFORM_VECTORS = 36347;
      var GL_MAX_VARYING_VECTORS = 36348;
      var GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS = 35661;
      var GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS = 35660;
      var GL_MAX_TEXTURE_IMAGE_UNITS = 34930;
      var GL_MAX_FRAGMENT_UNIFORM_VECTORS = 36349;
      var GL_MAX_CUBE_MAP_TEXTURE_SIZE = 34076;
      var GL_MAX_RENDERBUFFER_SIZE = 34024;
      var GL_VENDOR = 7936;
      var GL_RENDERER = 7937;
      var GL_VERSION = 7938;
      var GL_SHADING_LANGUAGE_VERSION = 35724;
      var GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT = 34047;
      var GL_MAX_COLOR_ATTACHMENTS_WEBGL = 36063;
      var GL_MAX_DRAW_BUFFERS_WEBGL = 34852;
      var GL_TEXTURE_2D = 3553;
      var GL_TEXTURE_CUBE_MAP = 34067;
      var GL_TEXTURE_CUBE_MAP_POSITIVE_X = 34069;
      var GL_TEXTURE0 = 33984;
      var GL_RGBA = 6408;
      var GL_FLOAT$1 = 5126;
      var GL_UNSIGNED_BYTE$1 = 5121;
      var GL_FRAMEBUFFER = 36160;
      var GL_FRAMEBUFFER_COMPLETE = 36053;
      var GL_COLOR_ATTACHMENT0 = 36064;
      var GL_COLOR_BUFFER_BIT$1 = 16384;
      var wrapLimits = function(gl, extensions) {
        var maxAnisotropic = 1;
        if (extensions.ext_texture_filter_anisotropic) {
          maxAnisotropic = gl.getParameter(GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        }
        var maxDrawbuffers = 1;
        var maxColorAttachments = 1;
        if (extensions.webgl_draw_buffers) {
          maxDrawbuffers = gl.getParameter(GL_MAX_DRAW_BUFFERS_WEBGL);
          maxColorAttachments = gl.getParameter(GL_MAX_COLOR_ATTACHMENTS_WEBGL);
        }
        var readFloat = !!extensions.oes_texture_float;
        if (readFloat) {
          var readFloatTexture = gl.createTexture();
          gl.bindTexture(GL_TEXTURE_2D, readFloatTexture);
          gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_FLOAT$1, null);
          var fbo = gl.createFramebuffer();
          gl.bindFramebuffer(GL_FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, readFloatTexture, 0);
          gl.bindTexture(GL_TEXTURE_2D, null);
          if (gl.checkFramebufferStatus(GL_FRAMEBUFFER) !== GL_FRAMEBUFFER_COMPLETE) readFloat = false;
          else {
            gl.viewport(0, 0, 1, 1);
            gl.clearColor(1, 0, 0, 1);
            gl.clear(GL_COLOR_BUFFER_BIT$1);
            var pixels = pool.allocType(GL_FLOAT$1, 4);
            gl.readPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT$1, pixels);
            if (gl.getError()) readFloat = false;
            else {
              gl.deleteFramebuffer(fbo);
              gl.deleteTexture(readFloatTexture);
              readFloat = pixels[0] === 1;
            }
            pool.freeType(pixels);
          }
        }
        var isIE = typeof navigator !== "undefined" && (/MSIE/.test(navigator.userAgent) || /Trident\//.test(navigator.appVersion) || /Edge/.test(navigator.userAgent));
        var npotTextureCube = true;
        if (!isIE) {
          var cubeTexture = gl.createTexture();
          var data2 = pool.allocType(GL_UNSIGNED_BYTE$1, 36);
          gl.activeTexture(GL_TEXTURE0);
          gl.bindTexture(GL_TEXTURE_CUBE_MAP, cubeTexture);
          gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X, 0, GL_RGBA, 3, 3, 0, GL_RGBA, GL_UNSIGNED_BYTE$1, data2);
          pool.freeType(data2);
          gl.bindTexture(GL_TEXTURE_CUBE_MAP, null);
          gl.deleteTexture(cubeTexture);
          npotTextureCube = !gl.getError();
        }
        return {
          // drawing buffer bit depth
          colorBits: [
            gl.getParameter(GL_RED_BITS),
            gl.getParameter(GL_GREEN_BITS),
            gl.getParameter(GL_BLUE_BITS),
            gl.getParameter(GL_ALPHA_BITS)
          ],
          depthBits: gl.getParameter(GL_DEPTH_BITS),
          stencilBits: gl.getParameter(GL_STENCIL_BITS),
          subpixelBits: gl.getParameter(GL_SUBPIXEL_BITS),
          // supported extensions
          extensions: Object.keys(extensions).filter(function(ext) {
            return !!extensions[ext];
          }),
          // max aniso samples
          maxAnisotropic,
          // max draw buffers
          maxDrawbuffers,
          maxColorAttachments,
          // point and line size ranges
          pointSizeDims: gl.getParameter(GL_ALIASED_POINT_SIZE_RANGE),
          lineWidthDims: gl.getParameter(GL_ALIASED_LINE_WIDTH_RANGE),
          maxViewportDims: gl.getParameter(GL_MAX_VIEWPORT_DIMS),
          maxCombinedTextureUnits: gl.getParameter(GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS),
          maxCubeMapSize: gl.getParameter(GL_MAX_CUBE_MAP_TEXTURE_SIZE),
          maxRenderbufferSize: gl.getParameter(GL_MAX_RENDERBUFFER_SIZE),
          maxTextureUnits: gl.getParameter(GL_MAX_TEXTURE_IMAGE_UNITS),
          maxTextureSize: gl.getParameter(GL_MAX_TEXTURE_SIZE),
          maxAttributes: gl.getParameter(GL_MAX_VERTEX_ATTRIBS),
          maxVertexUniforms: gl.getParameter(GL_MAX_VERTEX_UNIFORM_VECTORS),
          maxVertexTextureUnits: gl.getParameter(GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS),
          maxVaryingVectors: gl.getParameter(GL_MAX_VARYING_VECTORS),
          maxFragmentUniforms: gl.getParameter(GL_MAX_FRAGMENT_UNIFORM_VECTORS),
          // vendor info
          glsl: gl.getParameter(GL_SHADING_LANGUAGE_VERSION),
          renderer: gl.getParameter(GL_RENDERER),
          vendor: gl.getParameter(GL_VENDOR),
          version: gl.getParameter(GL_VERSION),
          // quirks
          readFloat,
          npotTextureCube
        };
      };
      function isNDArrayLike(obj) {
        return !!obj && typeof obj === "object" && Array.isArray(obj.shape) && Array.isArray(obj.stride) && typeof obj.offset === "number" && obj.shape.length === obj.stride.length && (Array.isArray(obj.data) || isTypedArray(obj.data));
      }
      var values = function(obj) {
        return Object.keys(obj).map(function(key) {
          return obj[key];
        });
      };
      var flattenUtils = {
        shape: arrayShape$1,
        flatten: flattenArray
      };
      function flatten1D(array, nx, out) {
        for (var i = 0; i < nx; ++i) {
          out[i] = array[i];
        }
      }
      function flatten2D(array, nx, ny, out) {
        var ptr = 0;
        for (var i = 0; i < nx; ++i) {
          var row = array[i];
          for (var j = 0; j < ny; ++j) {
            out[ptr++] = row[j];
          }
        }
      }
      function flatten3D(array, nx, ny, nz, out, ptr_) {
        var ptr = ptr_;
        for (var i = 0; i < nx; ++i) {
          var row = array[i];
          for (var j = 0; j < ny; ++j) {
            var col = row[j];
            for (var k = 0; k < nz; ++k) {
              out[ptr++] = col[k];
            }
          }
        }
      }
      function flattenRec(array, shape, level, out, ptr) {
        var stride = 1;
        for (var i = level + 1; i < shape.length; ++i) {
          stride *= shape[i];
        }
        var n = shape[level];
        if (shape.length - level === 4) {
          var nx = shape[level + 1];
          var ny = shape[level + 2];
          var nz = shape[level + 3];
          for (i = 0; i < n; ++i) {
            flatten3D(array[i], nx, ny, nz, out, ptr);
            ptr += stride;
          }
        } else {
          for (i = 0; i < n; ++i) {
            flattenRec(array[i], shape, level + 1, out, ptr);
            ptr += stride;
          }
        }
      }
      function flattenArray(array, shape, type, out_) {
        var sz = 1;
        if (shape.length) {
          for (var i = 0; i < shape.length; ++i) {
            sz *= shape[i];
          }
        } else {
          sz = 0;
        }
        var out = out_ || pool.allocType(type, sz);
        switch (shape.length) {
          case 0:
            break;
          case 1:
            flatten1D(array, shape[0], out);
            break;
          case 2:
            flatten2D(array, shape[0], shape[1], out);
            break;
          case 3:
            flatten3D(array, shape[0], shape[1], shape[2], out, 0);
            break;
          default:
            flattenRec(array, shape, 0, out, 0);
        }
        return out;
      }
      function arrayShape$1(array_) {
        var shape = [];
        for (var array = array_; array.length; array = array[0]) {
          shape.push(array.length);
        }
        return shape;
      }
      var arrayTypes = {
        "[object Int8Array]": 5120,
        "[object Int16Array]": 5122,
        "[object Int32Array]": 5124,
        "[object Uint8Array]": 5121,
        "[object Uint8ClampedArray]": 5121,
        "[object Uint16Array]": 5123,
        "[object Uint32Array]": 5125,
        "[object Float32Array]": 5126,
        "[object Float64Array]": 5121,
        "[object ArrayBuffer]": 5121
      };
      var int8 = 5120;
      var int16 = 5122;
      var int32 = 5124;
      var uint8 = 5121;
      var uint16 = 5123;
      var uint32 = 5125;
      var float = 5126;
      var float32 = 5126;
      var glTypes = {
        int8,
        int16,
        int32,
        uint8,
        uint16,
        uint32,
        float,
        float32
      };
      var dynamic$1 = 35048;
      var stream = 35040;
      var usageTypes = {
        dynamic: dynamic$1,
        stream,
        "static": 35044
      };
      var arrayFlatten = flattenUtils.flatten;
      var arrayShape = flattenUtils.shape;
      var GL_STATIC_DRAW = 35044;
      var GL_STREAM_DRAW = 35040;
      var GL_UNSIGNED_BYTE$3 = 5121;
      var GL_FLOAT$3 = 5126;
      var DTYPES_SIZES = [];
      DTYPES_SIZES[5120] = 1;
      DTYPES_SIZES[5122] = 2;
      DTYPES_SIZES[5124] = 4;
      DTYPES_SIZES[5121] = 1;
      DTYPES_SIZES[5123] = 2;
      DTYPES_SIZES[5125] = 4;
      DTYPES_SIZES[5126] = 4;
      function typedArrayCode(data2) {
        return arrayTypes[Object.prototype.toString.call(data2)] | 0;
      }
      function copyArray(out, inp) {
        for (var i = 0; i < inp.length; ++i) {
          out[i] = inp[i];
        }
      }
      function transpose(result, data2, shapeX, shapeY, strideX, strideY, offset2) {
        var ptr = 0;
        for (var i = 0; i < shapeX; ++i) {
          for (var j = 0; j < shapeY; ++j) {
            result[ptr++] = data2[strideX * i + strideY * j + offset2];
          }
        }
      }
      function wrapBufferState(gl, stats2, config, destroyBuffer) {
        var bufferCount = 0;
        var bufferSet = {};
        function REGLBuffer(type) {
          this.id = bufferCount++;
          this.buffer = gl.createBuffer();
          this.type = type;
          this.usage = GL_STATIC_DRAW;
          this.byteLength = 0;
          this.dimension = 1;
          this.dtype = GL_UNSIGNED_BYTE$3;
          this.persistentData = null;
          if (config.profile) {
            this.stats = { size: 0 };
          }
        }
        REGLBuffer.prototype.bind = function() {
          gl.bindBuffer(this.type, this.buffer);
        };
        REGLBuffer.prototype.destroy = function() {
          destroy(this);
        };
        var streamPool = [];
        function createStream(type, data2) {
          var buffer = streamPool.pop();
          if (!buffer) {
            buffer = new REGLBuffer(type);
          }
          buffer.bind();
          initBufferFromData(buffer, data2, GL_STREAM_DRAW, 0, 1, false);
          return buffer;
        }
        function destroyStream(stream$$1) {
          streamPool.push(stream$$1);
        }
        function initBufferFromTypedArray(buffer, data2, usage) {
          buffer.byteLength = data2.byteLength;
          gl.bufferData(buffer.type, data2, usage);
        }
        function initBufferFromData(buffer, data2, usage, dtype, dimension, persist) {
          var shape;
          buffer.usage = usage;
          if (Array.isArray(data2)) {
            buffer.dtype = dtype || GL_FLOAT$3;
            if (data2.length > 0) {
              var flatData;
              if (Array.isArray(data2[0])) {
                shape = arrayShape(data2);
                var dim = 1;
                for (var i = 1; i < shape.length; ++i) {
                  dim *= shape[i];
                }
                buffer.dimension = dim;
                flatData = arrayFlatten(data2, shape, buffer.dtype);
                initBufferFromTypedArray(buffer, flatData, usage);
                if (persist) {
                  buffer.persistentData = flatData;
                } else {
                  pool.freeType(flatData);
                }
              } else if (typeof data2[0] === "number") {
                buffer.dimension = dimension;
                var typedData = pool.allocType(buffer.dtype, data2.length);
                copyArray(typedData, data2);
                initBufferFromTypedArray(buffer, typedData, usage);
                if (persist) {
                  buffer.persistentData = typedData;
                } else {
                  pool.freeType(typedData);
                }
              } else if (isTypedArray(data2[0])) {
                buffer.dimension = data2[0].length;
                buffer.dtype = dtype || typedArrayCode(data2[0]) || GL_FLOAT$3;
                flatData = arrayFlatten(
                  data2,
                  [data2.length, data2[0].length],
                  buffer.dtype
                );
                initBufferFromTypedArray(buffer, flatData, usage);
                if (persist) {
                  buffer.persistentData = flatData;
                } else {
                  pool.freeType(flatData);
                }
              } else {
                check$1.raise("invalid buffer data");
              }
            }
          } else if (isTypedArray(data2)) {
            buffer.dtype = dtype || typedArrayCode(data2);
            buffer.dimension = dimension;
            initBufferFromTypedArray(buffer, data2, usage);
            if (persist) {
              buffer.persistentData = new Uint8Array(new Uint8Array(data2.buffer));
            }
          } else if (isNDArrayLike(data2)) {
            shape = data2.shape;
            var stride = data2.stride;
            var offset2 = data2.offset;
            var shapeX = 0;
            var shapeY = 0;
            var strideX = 0;
            var strideY = 0;
            if (shape.length === 1) {
              shapeX = shape[0];
              shapeY = 1;
              strideX = stride[0];
              strideY = 0;
            } else if (shape.length === 2) {
              shapeX = shape[0];
              shapeY = shape[1];
              strideX = stride[0];
              strideY = stride[1];
            } else {
              check$1.raise("invalid shape");
            }
            buffer.dtype = dtype || typedArrayCode(data2.data) || GL_FLOAT$3;
            buffer.dimension = shapeY;
            var transposeData2 = pool.allocType(buffer.dtype, shapeX * shapeY);
            transpose(
              transposeData2,
              data2.data,
              shapeX,
              shapeY,
              strideX,
              strideY,
              offset2
            );
            initBufferFromTypedArray(buffer, transposeData2, usage);
            if (persist) {
              buffer.persistentData = transposeData2;
            } else {
              pool.freeType(transposeData2);
            }
          } else if (data2 instanceof ArrayBuffer) {
            buffer.dtype = GL_UNSIGNED_BYTE$3;
            buffer.dimension = dimension;
            initBufferFromTypedArray(buffer, data2, usage);
            if (persist) {
              buffer.persistentData = new Uint8Array(new Uint8Array(data2));
            }
          } else {
            check$1.raise("invalid buffer data");
          }
        }
        function destroy(buffer) {
          stats2.bufferCount--;
          destroyBuffer(buffer);
          var handle = buffer.buffer;
          check$1(handle, "buffer must not be deleted already");
          gl.deleteBuffer(handle);
          buffer.buffer = null;
          delete bufferSet[buffer.id];
        }
        function createBuffer(options, type, deferInit, persistent) {
          stats2.bufferCount++;
          var buffer = new REGLBuffer(type);
          bufferSet[buffer.id] = buffer;
          function reglBuffer(options2) {
            var usage = GL_STATIC_DRAW;
            var data2 = null;
            var byteLength = 0;
            var dtype = 0;
            var dimension = 1;
            if (Array.isArray(options2) || isTypedArray(options2) || isNDArrayLike(options2) || options2 instanceof ArrayBuffer) {
              data2 = options2;
            } else if (typeof options2 === "number") {
              byteLength = options2 | 0;
            } else if (options2) {
              check$1.type(
                options2,
                "object",
                "buffer arguments must be an object, a number or an array"
              );
              if ("data" in options2) {
                check$1(
                  data2 === null || Array.isArray(data2) || isTypedArray(data2) || isNDArrayLike(data2),
                  "invalid data for buffer"
                );
                data2 = options2.data;
              }
              if ("usage" in options2) {
                check$1.parameter(options2.usage, usageTypes, "invalid buffer usage");
                usage = usageTypes[options2.usage];
              }
              if ("type" in options2) {
                check$1.parameter(options2.type, glTypes, "invalid buffer type");
                dtype = glTypes[options2.type];
              }
              if ("dimension" in options2) {
                check$1.type(options2.dimension, "number", "invalid dimension");
                dimension = options2.dimension | 0;
              }
              if ("length" in options2) {
                check$1.nni(byteLength, "buffer length must be a nonnegative integer");
                byteLength = options2.length | 0;
              }
            }
            buffer.bind();
            if (!data2) {
              if (byteLength) gl.bufferData(buffer.type, byteLength, usage);
              buffer.dtype = dtype || GL_UNSIGNED_BYTE$3;
              buffer.usage = usage;
              buffer.dimension = dimension;
              buffer.byteLength = byteLength;
            } else {
              initBufferFromData(buffer, data2, usage, dtype, dimension, persistent);
            }
            if (config.profile) {
              buffer.stats.size = buffer.byteLength * DTYPES_SIZES[buffer.dtype];
            }
            return reglBuffer;
          }
          function setSubData(data2, offset2) {
            check$1(
              offset2 + data2.byteLength <= buffer.byteLength,
              "invalid buffer subdata call, buffer is too small.  Can't write data of size " + data2.byteLength + " starting from offset " + offset2 + " to a buffer of size " + buffer.byteLength
            );
            gl.bufferSubData(buffer.type, offset2, data2);
          }
          function subdata(data2, offset_) {
            var offset2 = (offset_ || 0) | 0;
            var shape;
            buffer.bind();
            if (isTypedArray(data2) || data2 instanceof ArrayBuffer) {
              setSubData(data2, offset2);
            } else if (Array.isArray(data2)) {
              if (data2.length > 0) {
                if (typeof data2[0] === "number") {
                  var converted = pool.allocType(buffer.dtype, data2.length);
                  copyArray(converted, data2);
                  setSubData(converted, offset2);
                  pool.freeType(converted);
                } else if (Array.isArray(data2[0]) || isTypedArray(data2[0])) {
                  shape = arrayShape(data2);
                  var flatData = arrayFlatten(data2, shape, buffer.dtype);
                  setSubData(flatData, offset2);
                  pool.freeType(flatData);
                } else {
                  check$1.raise("invalid buffer data");
                }
              }
            } else if (isNDArrayLike(data2)) {
              shape = data2.shape;
              var stride = data2.stride;
              var shapeX = 0;
              var shapeY = 0;
              var strideX = 0;
              var strideY = 0;
              if (shape.length === 1) {
                shapeX = shape[0];
                shapeY = 1;
                strideX = stride[0];
                strideY = 0;
              } else if (shape.length === 2) {
                shapeX = shape[0];
                shapeY = shape[1];
                strideX = stride[0];
                strideY = stride[1];
              } else {
                check$1.raise("invalid shape");
              }
              var dtype = Array.isArray(data2.data) ? buffer.dtype : typedArrayCode(data2.data);
              var transposeData2 = pool.allocType(dtype, shapeX * shapeY);
              transpose(
                transposeData2,
                data2.data,
                shapeX,
                shapeY,
                strideX,
                strideY,
                data2.offset
              );
              setSubData(transposeData2, offset2);
              pool.freeType(transposeData2);
            } else {
              check$1.raise("invalid data for buffer subdata");
            }
            return reglBuffer;
          }
          if (!deferInit) {
            reglBuffer(options);
          }
          reglBuffer._reglType = "buffer";
          reglBuffer._buffer = buffer;
          reglBuffer.subdata = subdata;
          if (config.profile) {
            reglBuffer.stats = buffer.stats;
          }
          reglBuffer.destroy = function() {
            destroy(buffer);
          };
          return reglBuffer;
        }
        function restoreBuffers() {
          values(bufferSet).forEach(function(buffer) {
            buffer.buffer = gl.createBuffer();
            gl.bindBuffer(buffer.type, buffer.buffer);
            gl.bufferData(
              buffer.type,
              buffer.persistentData || buffer.byteLength,
              buffer.usage
            );
          });
        }
        if (config.profile) {
          stats2.getTotalBufferSize = function() {
            var total = 0;
            Object.keys(bufferSet).forEach(function(key) {
              total += bufferSet[key].stats.size;
            });
            return total;
          };
        }
        return {
          create: createBuffer,
          createStream,
          destroyStream,
          clear: function() {
            values(bufferSet).forEach(destroy);
            streamPool.forEach(destroy);
          },
          getBuffer: function(wrapper) {
            if (wrapper && wrapper._buffer instanceof REGLBuffer) {
              return wrapper._buffer;
            }
            return null;
          },
          restore: restoreBuffers,
          _initBuffer: initBufferFromData
        };
      }
      var points = 0;
      var point = 0;
      var lines = 1;
      var line2 = 1;
      var triangles = 4;
      var triangle = 4;
      var primTypes = {
        points,
        point,
        lines,
        line: line2,
        triangles,
        triangle,
        "line loop": 2,
        "line strip": 3,
        "triangle strip": 5,
        "triangle fan": 6
      };
      var GL_POINTS = 0;
      var GL_LINES = 1;
      var GL_TRIANGLES = 4;
      var GL_BYTE$2 = 5120;
      var GL_UNSIGNED_BYTE$4 = 5121;
      var GL_SHORT$2 = 5122;
      var GL_UNSIGNED_SHORT$2 = 5123;
      var GL_INT$2 = 5124;
      var GL_UNSIGNED_INT$2 = 5125;
      var GL_ELEMENT_ARRAY_BUFFER = 34963;
      var GL_STREAM_DRAW$1 = 35040;
      var GL_STATIC_DRAW$1 = 35044;
      function wrapElementsState(gl, extensions, bufferState, stats2) {
        var elementSet = {};
        var elementCount = 0;
        var elementTypes = {
          "uint8": GL_UNSIGNED_BYTE$4,
          "uint16": GL_UNSIGNED_SHORT$2
        };
        if (extensions.oes_element_index_uint) {
          elementTypes.uint32 = GL_UNSIGNED_INT$2;
        }
        function REGLElementBuffer(buffer) {
          this.id = elementCount++;
          elementSet[this.id] = this;
          this.buffer = buffer;
          this.primType = GL_TRIANGLES;
          this.vertCount = 0;
          this.type = 0;
        }
        REGLElementBuffer.prototype.bind = function() {
          this.buffer.bind();
        };
        var bufferPool = [];
        function createElementStream(data2) {
          var result = bufferPool.pop();
          if (!result) {
            result = new REGLElementBuffer(bufferState.create(
              null,
              GL_ELEMENT_ARRAY_BUFFER,
              true,
              false
            )._buffer);
          }
          initElements(result, data2, GL_STREAM_DRAW$1, -1, -1, 0, 0);
          return result;
        }
        function destroyElementStream(elements) {
          bufferPool.push(elements);
        }
        function initElements(elements, data2, usage, prim, count, byteLength, type) {
          elements.buffer.bind();
          var dtype;
          if (data2) {
            var predictedType = type;
            if (!type && (!isTypedArray(data2) || isNDArrayLike(data2) && !isTypedArray(data2.data))) {
              predictedType = extensions.oes_element_index_uint ? GL_UNSIGNED_INT$2 : GL_UNSIGNED_SHORT$2;
            }
            bufferState._initBuffer(
              elements.buffer,
              data2,
              usage,
              predictedType,
              3
            );
          } else {
            gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, byteLength, usage);
            elements.buffer.dtype = dtype || GL_UNSIGNED_BYTE$4;
            elements.buffer.usage = usage;
            elements.buffer.dimension = 3;
            elements.buffer.byteLength = byteLength;
          }
          dtype = type;
          if (!type) {
            switch (elements.buffer.dtype) {
              case GL_UNSIGNED_BYTE$4:
              case GL_BYTE$2:
                dtype = GL_UNSIGNED_BYTE$4;
                break;
              case GL_UNSIGNED_SHORT$2:
              case GL_SHORT$2:
                dtype = GL_UNSIGNED_SHORT$2;
                break;
              case GL_UNSIGNED_INT$2:
              case GL_INT$2:
                dtype = GL_UNSIGNED_INT$2;
                break;
              default:
                check$1.raise("unsupported type for element array");
            }
            elements.buffer.dtype = dtype;
          }
          elements.type = dtype;
          check$1(
            dtype !== GL_UNSIGNED_INT$2 || !!extensions.oes_element_index_uint,
            "32 bit element buffers not supported, enable oes_element_index_uint first"
          );
          var vertCount = count;
          if (vertCount < 0) {
            vertCount = elements.buffer.byteLength;
            if (dtype === GL_UNSIGNED_SHORT$2) {
              vertCount >>= 1;
            } else if (dtype === GL_UNSIGNED_INT$2) {
              vertCount >>= 2;
            }
          }
          elements.vertCount = vertCount;
          var primType = prim;
          if (prim < 0) {
            primType = GL_TRIANGLES;
            var dimension = elements.buffer.dimension;
            if (dimension === 1) primType = GL_POINTS;
            if (dimension === 2) primType = GL_LINES;
            if (dimension === 3) primType = GL_TRIANGLES;
          }
          elements.primType = primType;
        }
        function destroyElements(elements) {
          stats2.elementsCount--;
          check$1(elements.buffer !== null, "must not double destroy elements");
          delete elementSet[elements.id];
          elements.buffer.destroy();
          elements.buffer = null;
        }
        function createElements(options, persistent) {
          var buffer = bufferState.create(null, GL_ELEMENT_ARRAY_BUFFER, true);
          var elements = new REGLElementBuffer(buffer._buffer);
          stats2.elementsCount++;
          function reglElements(options2) {
            if (!options2) {
              buffer();
              elements.primType = GL_TRIANGLES;
              elements.vertCount = 0;
              elements.type = GL_UNSIGNED_BYTE$4;
            } else if (typeof options2 === "number") {
              buffer(options2);
              elements.primType = GL_TRIANGLES;
              elements.vertCount = options2 | 0;
              elements.type = GL_UNSIGNED_BYTE$4;
            } else {
              var data2 = null;
              var usage = GL_STATIC_DRAW$1;
              var primType = -1;
              var vertCount = -1;
              var byteLength = 0;
              var dtype = 0;
              if (Array.isArray(options2) || isTypedArray(options2) || isNDArrayLike(options2)) {
                data2 = options2;
              } else {
                check$1.type(options2, "object", "invalid arguments for elements");
                if ("data" in options2) {
                  data2 = options2.data;
                  check$1(
                    Array.isArray(data2) || isTypedArray(data2) || isNDArrayLike(data2),
                    "invalid data for element buffer"
                  );
                }
                if ("usage" in options2) {
                  check$1.parameter(
                    options2.usage,
                    usageTypes,
                    "invalid element buffer usage"
                  );
                  usage = usageTypes[options2.usage];
                }
                if ("primitive" in options2) {
                  check$1.parameter(
                    options2.primitive,
                    primTypes,
                    "invalid element buffer primitive"
                  );
                  primType = primTypes[options2.primitive];
                }
                if ("count" in options2) {
                  check$1(
                    typeof options2.count === "number" && options2.count >= 0,
                    "invalid vertex count for elements"
                  );
                  vertCount = options2.count | 0;
                }
                if ("type" in options2) {
                  check$1.parameter(
                    options2.type,
                    elementTypes,
                    "invalid buffer type"
                  );
                  dtype = elementTypes[options2.type];
                }
                if ("length" in options2) {
                  byteLength = options2.length | 0;
                } else {
                  byteLength = vertCount;
                  if (dtype === GL_UNSIGNED_SHORT$2 || dtype === GL_SHORT$2) {
                    byteLength *= 2;
                  } else if (dtype === GL_UNSIGNED_INT$2 || dtype === GL_INT$2) {
                    byteLength *= 4;
                  }
                }
              }
              initElements(
                elements,
                data2,
                usage,
                primType,
                vertCount,
                byteLength,
                dtype
              );
            }
            return reglElements;
          }
          reglElements(options);
          reglElements._reglType = "elements";
          reglElements._elements = elements;
          reglElements.subdata = function(data2, offset2) {
            buffer.subdata(data2, offset2);
            return reglElements;
          };
          reglElements.destroy = function() {
            destroyElements(elements);
          };
          return reglElements;
        }
        return {
          create: createElements,
          createStream: createElementStream,
          destroyStream: destroyElementStream,
          getElements: function(elements) {
            if (typeof elements === "function" && elements._elements instanceof REGLElementBuffer) {
              return elements._elements;
            }
            return null;
          },
          clear: function() {
            values(elementSet).forEach(destroyElements);
          }
        };
      }
      var FLOAT = new Float32Array(1);
      var INT = new Uint32Array(FLOAT.buffer);
      var GL_UNSIGNED_SHORT$4 = 5123;
      function convertToHalfFloat(array) {
        var ushorts = pool.allocType(GL_UNSIGNED_SHORT$4, array.length);
        for (var i = 0; i < array.length; ++i) {
          if (isNaN(array[i])) {
            ushorts[i] = 65535;
          } else if (array[i] === Infinity) {
            ushorts[i] = 31744;
          } else if (array[i] === -Infinity) {
            ushorts[i] = 64512;
          } else {
            FLOAT[0] = array[i];
            var x2 = INT[0];
            var sgn = x2 >>> 31 << 15;
            var exp = (x2 << 1 >>> 24) - 127;
            var frac = x2 >> 13 & (1 << 10) - 1;
            if (exp < -24) {
              ushorts[i] = sgn;
            } else if (exp < -14) {
              var s = -14 - exp;
              ushorts[i] = sgn + (frac + (1 << 10) >> s);
            } else if (exp > 15) {
              ushorts[i] = sgn + 31744;
            } else {
              ushorts[i] = sgn + (exp + 15 << 10) + frac;
            }
          }
        }
        return ushorts;
      }
      function isArrayLike(s) {
        return Array.isArray(s) || isTypedArray(s);
      }
      var isPow2$1 = function(v2) {
        return !(v2 & v2 - 1) && !!v2;
      };
      var GL_COMPRESSED_TEXTURE_FORMATS = 34467;
      var GL_TEXTURE_2D$1 = 3553;
      var GL_TEXTURE_CUBE_MAP$1 = 34067;
      var GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 = 34069;
      var GL_RGBA$1 = 6408;
      var GL_ALPHA = 6406;
      var GL_RGB = 6407;
      var GL_LUMINANCE = 6409;
      var GL_LUMINANCE_ALPHA = 6410;
      var GL_RGBA4 = 32854;
      var GL_RGB5_A1 = 32855;
      var GL_RGB565 = 36194;
      var GL_UNSIGNED_SHORT_4_4_4_4$1 = 32819;
      var GL_UNSIGNED_SHORT_5_5_5_1$1 = 32820;
      var GL_UNSIGNED_SHORT_5_6_5$1 = 33635;
      var GL_UNSIGNED_INT_24_8_WEBGL$1 = 34042;
      var GL_DEPTH_COMPONENT = 6402;
      var GL_DEPTH_STENCIL = 34041;
      var GL_SRGB_EXT = 35904;
      var GL_SRGB_ALPHA_EXT = 35906;
      var GL_HALF_FLOAT_OES$1 = 36193;
      var GL_COMPRESSED_RGB_S3TC_DXT1_EXT = 33776;
      var GL_COMPRESSED_RGBA_S3TC_DXT1_EXT = 33777;
      var GL_COMPRESSED_RGBA_S3TC_DXT3_EXT = 33778;
      var GL_COMPRESSED_RGBA_S3TC_DXT5_EXT = 33779;
      var GL_COMPRESSED_RGB_ATC_WEBGL = 35986;
      var GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL = 35987;
      var GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL = 34798;
      var GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 35840;
      var GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 35841;
      var GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 35842;
      var GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 35843;
      var GL_COMPRESSED_RGB_ETC1_WEBGL = 36196;
      var GL_UNSIGNED_BYTE$5 = 5121;
      var GL_UNSIGNED_SHORT$3 = 5123;
      var GL_UNSIGNED_INT$3 = 5125;
      var GL_FLOAT$4 = 5126;
      var GL_TEXTURE_WRAP_S = 10242;
      var GL_TEXTURE_WRAP_T = 10243;
      var GL_REPEAT = 10497;
      var GL_CLAMP_TO_EDGE$1 = 33071;
      var GL_MIRRORED_REPEAT = 33648;
      var GL_TEXTURE_MAG_FILTER = 10240;
      var GL_TEXTURE_MIN_FILTER = 10241;
      var GL_NEAREST$1 = 9728;
      var GL_LINEAR = 9729;
      var GL_NEAREST_MIPMAP_NEAREST$1 = 9984;
      var GL_LINEAR_MIPMAP_NEAREST$1 = 9985;
      var GL_NEAREST_MIPMAP_LINEAR$1 = 9986;
      var GL_LINEAR_MIPMAP_LINEAR$1 = 9987;
      var GL_GENERATE_MIPMAP_HINT = 33170;
      var GL_DONT_CARE = 4352;
      var GL_FASTEST = 4353;
      var GL_NICEST = 4354;
      var GL_TEXTURE_MAX_ANISOTROPY_EXT = 34046;
      var GL_UNPACK_ALIGNMENT = 3317;
      var GL_UNPACK_FLIP_Y_WEBGL = 37440;
      var GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL = 37441;
      var GL_UNPACK_COLORSPACE_CONVERSION_WEBGL = 37443;
      var GL_BROWSER_DEFAULT_WEBGL = 37444;
      var GL_TEXTURE0$1 = 33984;
      var MIPMAP_FILTERS = [
        GL_NEAREST_MIPMAP_NEAREST$1,
        GL_NEAREST_MIPMAP_LINEAR$1,
        GL_LINEAR_MIPMAP_NEAREST$1,
        GL_LINEAR_MIPMAP_LINEAR$1
      ];
      var CHANNELS_FORMAT = [
        0,
        GL_LUMINANCE,
        GL_LUMINANCE_ALPHA,
        GL_RGB,
        GL_RGBA$1
      ];
      var FORMAT_CHANNELS = {};
      FORMAT_CHANNELS[GL_LUMINANCE] = FORMAT_CHANNELS[GL_ALPHA] = FORMAT_CHANNELS[GL_DEPTH_COMPONENT] = 1;
      FORMAT_CHANNELS[GL_DEPTH_STENCIL] = FORMAT_CHANNELS[GL_LUMINANCE_ALPHA] = 2;
      FORMAT_CHANNELS[GL_RGB] = FORMAT_CHANNELS[GL_SRGB_EXT] = 3;
      FORMAT_CHANNELS[GL_RGBA$1] = FORMAT_CHANNELS[GL_SRGB_ALPHA_EXT] = 4;
      function objectName(str) {
        return "[object " + str + "]";
      }
      var CANVAS_CLASS = objectName("HTMLCanvasElement");
      var OFFSCREENCANVAS_CLASS = objectName("OffscreenCanvas");
      var CONTEXT2D_CLASS = objectName("CanvasRenderingContext2D");
      var BITMAP_CLASS = objectName("ImageBitmap");
      var IMAGE_CLASS = objectName("HTMLImageElement");
      var VIDEO_CLASS = objectName("HTMLVideoElement");
      var PIXEL_CLASSES = Object.keys(arrayTypes).concat([
        CANVAS_CLASS,
        OFFSCREENCANVAS_CLASS,
        CONTEXT2D_CLASS,
        BITMAP_CLASS,
        IMAGE_CLASS,
        VIDEO_CLASS
      ]);
      var TYPE_SIZES = [];
      TYPE_SIZES[GL_UNSIGNED_BYTE$5] = 1;
      TYPE_SIZES[GL_FLOAT$4] = 4;
      TYPE_SIZES[GL_HALF_FLOAT_OES$1] = 2;
      TYPE_SIZES[GL_UNSIGNED_SHORT$3] = 2;
      TYPE_SIZES[GL_UNSIGNED_INT$3] = 4;
      var FORMAT_SIZES_SPECIAL = [];
      FORMAT_SIZES_SPECIAL[GL_RGBA4] = 2;
      FORMAT_SIZES_SPECIAL[GL_RGB5_A1] = 2;
      FORMAT_SIZES_SPECIAL[GL_RGB565] = 2;
      FORMAT_SIZES_SPECIAL[GL_DEPTH_STENCIL] = 4;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_S3TC_DXT1_EXT] = 0.5;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT1_EXT] = 0.5;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT3_EXT] = 1;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT5_EXT] = 1;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ATC_WEBGL] = 0.5;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL] = 1;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL] = 1;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG] = 0.5;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG] = 0.25;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG] = 0.5;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG] = 0.25;
      FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ETC1_WEBGL] = 0.5;
      function isNumericArray(arr) {
        return Array.isArray(arr) && (arr.length === 0 || typeof arr[0] === "number");
      }
      function isRectArray(arr) {
        if (!Array.isArray(arr)) {
          return false;
        }
        var width = arr.length;
        if (width === 0 || !isArrayLike(arr[0])) {
          return false;
        }
        return true;
      }
      function classString(x2) {
        return Object.prototype.toString.call(x2);
      }
      function isCanvasElement(object) {
        return classString(object) === CANVAS_CLASS;
      }
      function isOffscreenCanvas(object) {
        return classString(object) === OFFSCREENCANVAS_CLASS;
      }
      function isContext2D(object) {
        return classString(object) === CONTEXT2D_CLASS;
      }
      function isBitmap(object) {
        return classString(object) === BITMAP_CLASS;
      }
      function isImageElement(object) {
        return classString(object) === IMAGE_CLASS;
      }
      function isVideoElement(object) {
        return classString(object) === VIDEO_CLASS;
      }
      function isPixelData(object) {
        if (!object) {
          return false;
        }
        var className = classString(object);
        if (PIXEL_CLASSES.indexOf(className) >= 0) {
          return true;
        }
        return isNumericArray(object) || isRectArray(object) || isNDArrayLike(object);
      }
      function typedArrayCode$1(data2) {
        return arrayTypes[Object.prototype.toString.call(data2)] | 0;
      }
      function convertData(result, data2) {
        var n = data2.length;
        switch (result.type) {
          case GL_UNSIGNED_BYTE$5:
          case GL_UNSIGNED_SHORT$3:
          case GL_UNSIGNED_INT$3:
          case GL_FLOAT$4:
            var converted = pool.allocType(result.type, n);
            converted.set(data2);
            result.data = converted;
            break;
          case GL_HALF_FLOAT_OES$1:
            result.data = convertToHalfFloat(data2);
            break;
          default:
            check$1.raise("unsupported texture type, must specify a typed array");
        }
      }
      function preConvert(image, n) {
        return pool.allocType(
          image.type === GL_HALF_FLOAT_OES$1 ? GL_FLOAT$4 : image.type,
          n
        );
      }
      function postConvert(image, data2) {
        if (image.type === GL_HALF_FLOAT_OES$1) {
          image.data = convertToHalfFloat(data2);
          pool.freeType(data2);
        } else {
          image.data = data2;
        }
      }
      function transposeData(image, array, strideX, strideY, strideC, offset2) {
        var w = image.width;
        var h = image.height;
        var c = image.channels;
        var n = w * h * c;
        var data2 = preConvert(image, n);
        var p = 0;
        for (var i = 0; i < h; ++i) {
          for (var j = 0; j < w; ++j) {
            for (var k = 0; k < c; ++k) {
              data2[p++] = array[strideX * j + strideY * i + strideC * k + offset2];
            }
          }
        }
        postConvert(image, data2);
      }
      function getTextureSize(format, type, width, height, isMipmap, isCube) {
        var s;
        if (typeof FORMAT_SIZES_SPECIAL[format] !== "undefined") {
          s = FORMAT_SIZES_SPECIAL[format];
        } else {
          s = FORMAT_CHANNELS[format] * TYPE_SIZES[type];
        }
        if (isCube) {
          s *= 6;
        }
        if (isMipmap) {
          var total = 0;
          var w = width;
          while (w >= 1) {
            total += s * w * w;
            w /= 2;
          }
          return total;
        } else {
          return s * width * height;
        }
      }
      function createTextureSet(gl, extensions, limits, reglPoll, contextState, stats2, config) {
        var mipmapHint = {
          "don't care": GL_DONT_CARE,
          "dont care": GL_DONT_CARE,
          "nice": GL_NICEST,
          "fast": GL_FASTEST
        };
        var wrapModes = {
          "repeat": GL_REPEAT,
          "clamp": GL_CLAMP_TO_EDGE$1,
          "mirror": GL_MIRRORED_REPEAT
        };
        var magFilters = {
          "nearest": GL_NEAREST$1,
          "linear": GL_LINEAR
        };
        var minFilters = extend2({
          "mipmap": GL_LINEAR_MIPMAP_LINEAR$1,
          "nearest mipmap nearest": GL_NEAREST_MIPMAP_NEAREST$1,
          "linear mipmap nearest": GL_LINEAR_MIPMAP_NEAREST$1,
          "nearest mipmap linear": GL_NEAREST_MIPMAP_LINEAR$1,
          "linear mipmap linear": GL_LINEAR_MIPMAP_LINEAR$1
        }, magFilters);
        var colorSpace = {
          "none": 0,
          "browser": GL_BROWSER_DEFAULT_WEBGL
        };
        var textureTypes = {
          "uint8": GL_UNSIGNED_BYTE$5,
          "rgba4": GL_UNSIGNED_SHORT_4_4_4_4$1,
          "rgb565": GL_UNSIGNED_SHORT_5_6_5$1,
          "rgb5 a1": GL_UNSIGNED_SHORT_5_5_5_1$1
        };
        var textureFormats = {
          "alpha": GL_ALPHA,
          "luminance": GL_LUMINANCE,
          "luminance alpha": GL_LUMINANCE_ALPHA,
          "rgb": GL_RGB,
          "rgba": GL_RGBA$1,
          "rgba4": GL_RGBA4,
          "rgb5 a1": GL_RGB5_A1,
          "rgb565": GL_RGB565
        };
        var compressedTextureFormats = {};
        if (extensions.ext_srgb) {
          textureFormats.srgb = GL_SRGB_EXT;
          textureFormats.srgba = GL_SRGB_ALPHA_EXT;
        }
        if (extensions.oes_texture_float) {
          textureTypes.float32 = textureTypes.float = GL_FLOAT$4;
        }
        if (extensions.oes_texture_half_float) {
          textureTypes["float16"] = textureTypes["half float"] = GL_HALF_FLOAT_OES$1;
        }
        if (extensions.webgl_depth_texture) {
          extend2(textureFormats, {
            "depth": GL_DEPTH_COMPONENT,
            "depth stencil": GL_DEPTH_STENCIL
          });
          extend2(textureTypes, {
            "uint16": GL_UNSIGNED_SHORT$3,
            "uint32": GL_UNSIGNED_INT$3,
            "depth stencil": GL_UNSIGNED_INT_24_8_WEBGL$1
          });
        }
        if (extensions.webgl_compressed_texture_s3tc) {
          extend2(compressedTextureFormats, {
            "rgb s3tc dxt1": GL_COMPRESSED_RGB_S3TC_DXT1_EXT,
            "rgba s3tc dxt1": GL_COMPRESSED_RGBA_S3TC_DXT1_EXT,
            "rgba s3tc dxt3": GL_COMPRESSED_RGBA_S3TC_DXT3_EXT,
            "rgba s3tc dxt5": GL_COMPRESSED_RGBA_S3TC_DXT5_EXT
          });
        }
        if (extensions.webgl_compressed_texture_atc) {
          extend2(compressedTextureFormats, {
            "rgb atc": GL_COMPRESSED_RGB_ATC_WEBGL,
            "rgba atc explicit alpha": GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL,
            "rgba atc interpolated alpha": GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL
          });
        }
        if (extensions.webgl_compressed_texture_pvrtc) {
          extend2(compressedTextureFormats, {
            "rgb pvrtc 4bppv1": GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
            "rgb pvrtc 2bppv1": GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG,
            "rgba pvrtc 4bppv1": GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
            "rgba pvrtc 2bppv1": GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG
          });
        }
        if (extensions.webgl_compressed_texture_etc1) {
          compressedTextureFormats["rgb etc1"] = GL_COMPRESSED_RGB_ETC1_WEBGL;
        }
        var supportedCompressedFormats = Array.prototype.slice.call(
          gl.getParameter(GL_COMPRESSED_TEXTURE_FORMATS)
        );
        Object.keys(compressedTextureFormats).forEach(function(name) {
          var format = compressedTextureFormats[name];
          if (supportedCompressedFormats.indexOf(format) >= 0) {
            textureFormats[name] = format;
          }
        });
        var supportedFormats = Object.keys(textureFormats);
        limits.textureFormats = supportedFormats;
        var textureFormatsInvert = [];
        Object.keys(textureFormats).forEach(function(key) {
          var val = textureFormats[key];
          textureFormatsInvert[val] = key;
        });
        var textureTypesInvert = [];
        Object.keys(textureTypes).forEach(function(key) {
          var val = textureTypes[key];
          textureTypesInvert[val] = key;
        });
        var magFiltersInvert = [];
        Object.keys(magFilters).forEach(function(key) {
          var val = magFilters[key];
          magFiltersInvert[val] = key;
        });
        var minFiltersInvert = [];
        Object.keys(minFilters).forEach(function(key) {
          var val = minFilters[key];
          minFiltersInvert[val] = key;
        });
        var wrapModesInvert = [];
        Object.keys(wrapModes).forEach(function(key) {
          var val = wrapModes[key];
          wrapModesInvert[val] = key;
        });
        var colorFormats = supportedFormats.reduce(function(color, key) {
          var glenum = textureFormats[key];
          if (glenum === GL_LUMINANCE || glenum === GL_ALPHA || glenum === GL_LUMINANCE || glenum === GL_LUMINANCE_ALPHA || glenum === GL_DEPTH_COMPONENT || glenum === GL_DEPTH_STENCIL || extensions.ext_srgb && (glenum === GL_SRGB_EXT || glenum === GL_SRGB_ALPHA_EXT)) {
            color[glenum] = glenum;
          } else if (glenum === GL_RGB5_A1 || key.indexOf("rgba") >= 0) {
            color[glenum] = GL_RGBA$1;
          } else {
            color[glenum] = GL_RGB;
          }
          return color;
        }, {});
        function TexFlags() {
          this.internalformat = GL_RGBA$1;
          this.format = GL_RGBA$1;
          this.type = GL_UNSIGNED_BYTE$5;
          this.compressed = false;
          this.premultiplyAlpha = false;
          this.flipY = false;
          this.unpackAlignment = 1;
          this.colorSpace = GL_BROWSER_DEFAULT_WEBGL;
          this.width = 0;
          this.height = 0;
          this.channels = 0;
        }
        function copyFlags(result, other) {
          result.internalformat = other.internalformat;
          result.format = other.format;
          result.type = other.type;
          result.compressed = other.compressed;
          result.premultiplyAlpha = other.premultiplyAlpha;
          result.flipY = other.flipY;
          result.unpackAlignment = other.unpackAlignment;
          result.colorSpace = other.colorSpace;
          result.width = other.width;
          result.height = other.height;
          result.channels = other.channels;
        }
        function parseFlags(flags, options) {
          if (typeof options !== "object" || !options) {
            return;
          }
          if ("premultiplyAlpha" in options) {
            check$1.type(
              options.premultiplyAlpha,
              "boolean",
              "invalid premultiplyAlpha"
            );
            flags.premultiplyAlpha = options.premultiplyAlpha;
          }
          if ("flipY" in options) {
            check$1.type(
              options.flipY,
              "boolean",
              "invalid texture flip"
            );
            flags.flipY = options.flipY;
          }
          if ("alignment" in options) {
            check$1.oneOf(
              options.alignment,
              [1, 2, 4, 8],
              "invalid texture unpack alignment"
            );
            flags.unpackAlignment = options.alignment;
          }
          if ("colorSpace" in options) {
            check$1.parameter(
              options.colorSpace,
              colorSpace,
              "invalid colorSpace"
            );
            flags.colorSpace = colorSpace[options.colorSpace];
          }
          if ("type" in options) {
            var type = options.type;
            check$1(
              extensions.oes_texture_float || !(type === "float" || type === "float32"),
              "you must enable the OES_texture_float extension in order to use floating point textures."
            );
            check$1(
              extensions.oes_texture_half_float || !(type === "half float" || type === "float16"),
              "you must enable the OES_texture_half_float extension in order to use 16-bit floating point textures."
            );
            check$1(
              extensions.webgl_depth_texture || !(type === "uint16" || type === "uint32" || type === "depth stencil"),
              "you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures."
            );
            check$1.parameter(
              type,
              textureTypes,
              "invalid texture type"
            );
            flags.type = textureTypes[type];
          }
          var w = flags.width;
          var h = flags.height;
          var c = flags.channels;
          var hasChannels = false;
          if ("shape" in options) {
            check$1(
              Array.isArray(options.shape) && options.shape.length >= 2,
              "shape must be an array"
            );
            w = options.shape[0];
            h = options.shape[1];
            if (options.shape.length === 3) {
              c = options.shape[2];
              check$1(c > 0 && c <= 4, "invalid number of channels");
              hasChannels = true;
            }
            check$1(w >= 0 && w <= limits.maxTextureSize, "invalid width");
            check$1(h >= 0 && h <= limits.maxTextureSize, "invalid height");
          } else {
            if ("radius" in options) {
              w = h = options.radius;
              check$1(w >= 0 && w <= limits.maxTextureSize, "invalid radius");
            }
            if ("width" in options) {
              w = options.width;
              check$1(w >= 0 && w <= limits.maxTextureSize, "invalid width");
            }
            if ("height" in options) {
              h = options.height;
              check$1(h >= 0 && h <= limits.maxTextureSize, "invalid height");
            }
            if ("channels" in options) {
              c = options.channels;
              check$1(c > 0 && c <= 4, "invalid number of channels");
              hasChannels = true;
            }
          }
          flags.width = w | 0;
          flags.height = h | 0;
          flags.channels = c | 0;
          var hasFormat = false;
          if ("format" in options) {
            var formatStr = options.format;
            check$1(
              extensions.webgl_depth_texture || !(formatStr === "depth" || formatStr === "depth stencil"),
              "you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures."
            );
            check$1.parameter(
              formatStr,
              textureFormats,
              "invalid texture format"
            );
            var internalformat = flags.internalformat = textureFormats[formatStr];
            flags.format = colorFormats[internalformat];
            if (formatStr in textureTypes) {
              if (!("type" in options)) {
                flags.type = textureTypes[formatStr];
              }
            }
            if (formatStr in compressedTextureFormats) {
              flags.compressed = true;
            }
            hasFormat = true;
          }
          if (!hasChannels && hasFormat) {
            flags.channels = FORMAT_CHANNELS[flags.format];
          } else if (hasChannels && !hasFormat) {
            if (flags.channels !== CHANNELS_FORMAT[flags.format]) {
              flags.format = flags.internalformat = CHANNELS_FORMAT[flags.channels];
            }
          } else if (hasFormat && hasChannels) {
            check$1(
              flags.channels === FORMAT_CHANNELS[flags.format],
              "number of channels inconsistent with specified format"
            );
          }
        }
        function setFlags(flags) {
          gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, flags.flipY);
          gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, flags.premultiplyAlpha);
          gl.pixelStorei(GL_UNPACK_COLORSPACE_CONVERSION_WEBGL, flags.colorSpace);
          gl.pixelStorei(GL_UNPACK_ALIGNMENT, flags.unpackAlignment);
        }
        function TexImage() {
          TexFlags.call(this);
          this.xOffset = 0;
          this.yOffset = 0;
          this.data = null;
          this.needsFree = false;
          this.element = null;
          this.needsCopy = false;
        }
        function parseImage(image, options) {
          var data2 = null;
          if (isPixelData(options)) {
            data2 = options;
          } else if (options) {
            check$1.type(options, "object", "invalid pixel data type");
            parseFlags(image, options);
            if ("x" in options) {
              image.xOffset = options.x | 0;
            }
            if ("y" in options) {
              image.yOffset = options.y | 0;
            }
            if (isPixelData(options.data)) {
              data2 = options.data;
            }
          }
          check$1(
            !image.compressed || data2 instanceof Uint8Array,
            "compressed texture data must be stored in a uint8array"
          );
          if (options.copy) {
            check$1(!data2, "can not specify copy and data field for the same texture");
            var viewW = contextState.viewportWidth;
            var viewH = contextState.viewportHeight;
            image.width = image.width || viewW - image.xOffset;
            image.height = image.height || viewH - image.yOffset;
            image.needsCopy = true;
            check$1(
              image.xOffset >= 0 && image.xOffset < viewW && image.yOffset >= 0 && image.yOffset < viewH && image.width > 0 && image.width <= viewW && image.height > 0 && image.height <= viewH,
              "copy texture read out of bounds"
            );
          } else if (!data2) {
            image.width = image.width || 1;
            image.height = image.height || 1;
            image.channels = image.channels || 4;
          } else if (isTypedArray(data2)) {
            image.channels = image.channels || 4;
            image.data = data2;
            if (!("type" in options) && image.type === GL_UNSIGNED_BYTE$5) {
              image.type = typedArrayCode$1(data2);
            }
          } else if (isNumericArray(data2)) {
            image.channels = image.channels || 4;
            convertData(image, data2);
            image.alignment = 1;
            image.needsFree = true;
          } else if (isNDArrayLike(data2)) {
            var array = data2.data;
            if (!Array.isArray(array) && image.type === GL_UNSIGNED_BYTE$5) {
              image.type = typedArrayCode$1(array);
            }
            var shape = data2.shape;
            var stride = data2.stride;
            var shapeX, shapeY, shapeC, strideX, strideY, strideC;
            if (shape.length === 3) {
              shapeC = shape[2];
              strideC = stride[2];
            } else {
              check$1(shape.length === 2, "invalid ndarray pixel data, must be 2 or 3D");
              shapeC = 1;
              strideC = 1;
            }
            shapeX = shape[0];
            shapeY = shape[1];
            strideX = stride[0];
            strideY = stride[1];
            image.alignment = 1;
            image.width = shapeX;
            image.height = shapeY;
            image.channels = shapeC;
            image.format = image.internalformat = CHANNELS_FORMAT[shapeC];
            image.needsFree = true;
            transposeData(image, array, strideX, strideY, strideC, data2.offset);
          } else if (isCanvasElement(data2) || isOffscreenCanvas(data2) || isContext2D(data2)) {
            if (isCanvasElement(data2) || isOffscreenCanvas(data2)) {
              image.element = data2;
            } else {
              image.element = data2.canvas;
            }
            image.width = image.element.width;
            image.height = image.element.height;
            image.channels = 4;
          } else if (isBitmap(data2)) {
            image.element = data2;
            image.width = data2.width;
            image.height = data2.height;
            image.channels = 4;
          } else if (isImageElement(data2)) {
            image.element = data2;
            image.width = data2.naturalWidth;
            image.height = data2.naturalHeight;
            image.channels = 4;
          } else if (isVideoElement(data2)) {
            image.element = data2;
            image.width = data2.videoWidth;
            image.height = data2.videoHeight;
            image.channels = 4;
          } else if (isRectArray(data2)) {
            var w = image.width || data2[0].length;
            var h = image.height || data2.length;
            var c = image.channels;
            if (isArrayLike(data2[0][0])) {
              c = c || data2[0][0].length;
            } else {
              c = c || 1;
            }
            var arrayShape2 = flattenUtils.shape(data2);
            var n = 1;
            for (var dd = 0; dd < arrayShape2.length; ++dd) {
              n *= arrayShape2[dd];
            }
            var allocData = preConvert(image, n);
            flattenUtils.flatten(data2, arrayShape2, "", allocData);
            postConvert(image, allocData);
            image.alignment = 1;
            image.width = w;
            image.height = h;
            image.channels = c;
            image.format = image.internalformat = CHANNELS_FORMAT[c];
            image.needsFree = true;
          }
          if (image.type === GL_FLOAT$4) {
            check$1(
              limits.extensions.indexOf("oes_texture_float") >= 0,
              "oes_texture_float extension not enabled"
            );
          } else if (image.type === GL_HALF_FLOAT_OES$1) {
            check$1(
              limits.extensions.indexOf("oes_texture_half_float") >= 0,
              "oes_texture_half_float extension not enabled"
            );
          }
        }
        function setImage(info, target, miplevel) {
          var element = info.element;
          var data2 = info.data;
          var internalformat = info.internalformat;
          var format = info.format;
          var type = info.type;
          var width = info.width;
          var height = info.height;
          setFlags(info);
          if (element) {
            gl.texImage2D(target, miplevel, format, format, type, element);
          } else if (info.compressed) {
            gl.compressedTexImage2D(target, miplevel, internalformat, width, height, 0, data2);
          } else if (info.needsCopy) {
            reglPoll();
            gl.copyTexImage2D(
              target,
              miplevel,
              format,
              info.xOffset,
              info.yOffset,
              width,
              height,
              0
            );
          } else {
            gl.texImage2D(target, miplevel, format, width, height, 0, format, type, data2 || null);
          }
        }
        function setSubImage(info, target, x2, y, miplevel) {
          var element = info.element;
          var data2 = info.data;
          var internalformat = info.internalformat;
          var format = info.format;
          var type = info.type;
          var width = info.width;
          var height = info.height;
          setFlags(info);
          if (element) {
            gl.texSubImage2D(
              target,
              miplevel,
              x2,
              y,
              format,
              type,
              element
            );
          } else if (info.compressed) {
            gl.compressedTexSubImage2D(
              target,
              miplevel,
              x2,
              y,
              internalformat,
              width,
              height,
              data2
            );
          } else if (info.needsCopy) {
            reglPoll();
            gl.copyTexSubImage2D(
              target,
              miplevel,
              x2,
              y,
              info.xOffset,
              info.yOffset,
              width,
              height
            );
          } else {
            gl.texSubImage2D(
              target,
              miplevel,
              x2,
              y,
              width,
              height,
              format,
              type,
              data2
            );
          }
        }
        var imagePool = [];
        function allocImage() {
          return imagePool.pop() || new TexImage();
        }
        function freeImage(image) {
          if (image.needsFree) {
            pool.freeType(image.data);
          }
          TexImage.call(image);
          imagePool.push(image);
        }
        function MipMap() {
          TexFlags.call(this);
          this.genMipmaps = false;
          this.mipmapHint = GL_DONT_CARE;
          this.mipmask = 0;
          this.images = Array(16);
        }
        function parseMipMapFromShape(mipmap, width, height) {
          var img = mipmap.images[0] = allocImage();
          mipmap.mipmask = 1;
          img.width = mipmap.width = width;
          img.height = mipmap.height = height;
          img.channels = mipmap.channels = 4;
        }
        function parseMipMapFromObject(mipmap, options) {
          var imgData = null;
          if (isPixelData(options)) {
            imgData = mipmap.images[0] = allocImage();
            copyFlags(imgData, mipmap);
            parseImage(imgData, options);
            mipmap.mipmask = 1;
          } else {
            parseFlags(mipmap, options);
            if (Array.isArray(options.mipmap)) {
              var mipData = options.mipmap;
              for (var i = 0; i < mipData.length; ++i) {
                imgData = mipmap.images[i] = allocImage();
                copyFlags(imgData, mipmap);
                imgData.width >>= i;
                imgData.height >>= i;
                parseImage(imgData, mipData[i]);
                mipmap.mipmask |= 1 << i;
              }
            } else {
              imgData = mipmap.images[0] = allocImage();
              copyFlags(imgData, mipmap);
              parseImage(imgData, options);
              mipmap.mipmask = 1;
            }
          }
          copyFlags(mipmap, mipmap.images[0]);
          if (mipmap.compressed && (mipmap.internalformat === GL_COMPRESSED_RGB_S3TC_DXT1_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT1_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT3_EXT || mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT5_EXT)) {
            check$1(
              mipmap.width % 4 === 0 && mipmap.height % 4 === 0,
              "for compressed texture formats, mipmap level 0 must have width and height that are a multiple of 4"
            );
          }
        }
        function setMipMap(mipmap, target) {
          var images = mipmap.images;
          for (var i = 0; i < images.length; ++i) {
            if (!images[i]) {
              return;
            }
            setImage(images[i], target, i);
          }
        }
        var mipPool = [];
        function allocMipMap() {
          var result = mipPool.pop() || new MipMap();
          TexFlags.call(result);
          result.mipmask = 0;
          for (var i = 0; i < 16; ++i) {
            result.images[i] = null;
          }
          return result;
        }
        function freeMipMap(mipmap) {
          var images = mipmap.images;
          for (var i = 0; i < images.length; ++i) {
            if (images[i]) {
              freeImage(images[i]);
            }
            images[i] = null;
          }
          mipPool.push(mipmap);
        }
        function TexInfo() {
          this.minFilter = GL_NEAREST$1;
          this.magFilter = GL_NEAREST$1;
          this.wrapS = GL_CLAMP_TO_EDGE$1;
          this.wrapT = GL_CLAMP_TO_EDGE$1;
          this.anisotropic = 1;
          this.genMipmaps = false;
          this.mipmapHint = GL_DONT_CARE;
        }
        function parseTexInfo(info, options) {
          if ("min" in options) {
            var minFilter = options.min;
            check$1.parameter(minFilter, minFilters);
            info.minFilter = minFilters[minFilter];
            if (MIPMAP_FILTERS.indexOf(info.minFilter) >= 0 && !("faces" in options)) {
              info.genMipmaps = true;
            }
          }
          if ("mag" in options) {
            var magFilter = options.mag;
            check$1.parameter(magFilter, magFilters);
            info.magFilter = magFilters[magFilter];
          }
          var wrapS = info.wrapS;
          var wrapT = info.wrapT;
          if ("wrap" in options) {
            var wrap = options.wrap;
            if (typeof wrap === "string") {
              check$1.parameter(wrap, wrapModes);
              wrapS = wrapT = wrapModes[wrap];
            } else if (Array.isArray(wrap)) {
              check$1.parameter(wrap[0], wrapModes);
              check$1.parameter(wrap[1], wrapModes);
              wrapS = wrapModes[wrap[0]];
              wrapT = wrapModes[wrap[1]];
            }
          } else {
            if ("wrapS" in options) {
              var optWrapS = options.wrapS;
              check$1.parameter(optWrapS, wrapModes);
              wrapS = wrapModes[optWrapS];
            }
            if ("wrapT" in options) {
              var optWrapT = options.wrapT;
              check$1.parameter(optWrapT, wrapModes);
              wrapT = wrapModes[optWrapT];
            }
          }
          info.wrapS = wrapS;
          info.wrapT = wrapT;
          if ("anisotropic" in options) {
            var anisotropic = options.anisotropic;
            check$1(
              typeof anisotropic === "number" && anisotropic >= 1 && anisotropic <= limits.maxAnisotropic,
              "aniso samples must be between 1 and "
            );
            info.anisotropic = options.anisotropic;
          }
          if ("mipmap" in options) {
            var hasMipMap = false;
            switch (typeof options.mipmap) {
              case "string":
                check$1.parameter(
                  options.mipmap,
                  mipmapHint,
                  "invalid mipmap hint"
                );
                info.mipmapHint = mipmapHint[options.mipmap];
                info.genMipmaps = true;
                hasMipMap = true;
                break;
              case "boolean":
                hasMipMap = info.genMipmaps = options.mipmap;
                break;
              case "object":
                check$1(Array.isArray(options.mipmap), "invalid mipmap type");
                info.genMipmaps = false;
                hasMipMap = true;
                break;
              default:
                check$1.raise("invalid mipmap type");
            }
            if (hasMipMap && !("min" in options)) {
              info.minFilter = GL_NEAREST_MIPMAP_NEAREST$1;
            }
          }
        }
        function setTexInfo(info, target) {
          gl.texParameteri(target, GL_TEXTURE_MIN_FILTER, info.minFilter);
          gl.texParameteri(target, GL_TEXTURE_MAG_FILTER, info.magFilter);
          gl.texParameteri(target, GL_TEXTURE_WRAP_S, info.wrapS);
          gl.texParameteri(target, GL_TEXTURE_WRAP_T, info.wrapT);
          if (extensions.ext_texture_filter_anisotropic) {
            gl.texParameteri(target, GL_TEXTURE_MAX_ANISOTROPY_EXT, info.anisotropic);
          }
          if (info.genMipmaps) {
            gl.hint(GL_GENERATE_MIPMAP_HINT, info.mipmapHint);
            gl.generateMipmap(target);
          }
        }
        var textureCount = 0;
        var textureSet = {};
        var numTexUnits = limits.maxTextureUnits;
        var textureUnits = Array(numTexUnits).map(function() {
          return null;
        });
        function REGLTexture(target) {
          TexFlags.call(this);
          this.mipmask = 0;
          this.internalformat = GL_RGBA$1;
          this.id = textureCount++;
          this.refCount = 1;
          this.target = target;
          this.texture = gl.createTexture();
          this.unit = -1;
          this.bindCount = 0;
          this.texInfo = new TexInfo();
          if (config.profile) {
            this.stats = { size: 0 };
          }
        }
        function tempBind(texture) {
          gl.activeTexture(GL_TEXTURE0$1);
          gl.bindTexture(texture.target, texture.texture);
        }
        function tempRestore() {
          var prev = textureUnits[0];
          if (prev) {
            gl.bindTexture(prev.target, prev.texture);
          } else {
            gl.bindTexture(GL_TEXTURE_2D$1, null);
          }
        }
        function destroy(texture) {
          var handle = texture.texture;
          check$1(handle, "must not double destroy texture");
          var unit = texture.unit;
          var target = texture.target;
          if (unit >= 0) {
            gl.activeTexture(GL_TEXTURE0$1 + unit);
            gl.bindTexture(target, null);
            textureUnits[unit] = null;
          }
          gl.deleteTexture(handle);
          texture.texture = null;
          texture.params = null;
          texture.pixels = null;
          texture.refCount = 0;
          delete textureSet[texture.id];
          stats2.textureCount--;
        }
        extend2(REGLTexture.prototype, {
          bind: function() {
            var texture = this;
            texture.bindCount += 1;
            var unit = texture.unit;
            if (unit < 0) {
              for (var i = 0; i < numTexUnits; ++i) {
                var other = textureUnits[i];
                if (other) {
                  if (other.bindCount > 0) {
                    continue;
                  }
                  other.unit = -1;
                }
                textureUnits[i] = texture;
                unit = i;
                break;
              }
              if (unit >= numTexUnits) {
                check$1.raise("insufficient number of texture units");
              }
              if (config.profile && stats2.maxTextureUnits < unit + 1) {
                stats2.maxTextureUnits = unit + 1;
              }
              texture.unit = unit;
              gl.activeTexture(GL_TEXTURE0$1 + unit);
              gl.bindTexture(texture.target, texture.texture);
            }
            return unit;
          },
          unbind: function() {
            this.bindCount -= 1;
          },
          decRef: function() {
            if (--this.refCount <= 0) {
              destroy(this);
            }
          }
        });
        function createTexture2D(a2, b) {
          var texture = new REGLTexture(GL_TEXTURE_2D$1);
          textureSet[texture.id] = texture;
          stats2.textureCount++;
          function reglTexture2D(a22, b2) {
            var texInfo = texture.texInfo;
            TexInfo.call(texInfo);
            var mipData = allocMipMap();
            if (typeof a22 === "number") {
              if (typeof b2 === "number") {
                parseMipMapFromShape(mipData, a22 | 0, b2 | 0);
              } else {
                parseMipMapFromShape(mipData, a22 | 0, a22 | 0);
              }
            } else if (a22) {
              check$1.type(a22, "object", "invalid arguments to regl.texture");
              parseTexInfo(texInfo, a22);
              parseMipMapFromObject(mipData, a22);
            } else {
              parseMipMapFromShape(mipData, 1, 1);
            }
            if (texInfo.genMipmaps) {
              mipData.mipmask = (mipData.width << 1) - 1;
            }
            texture.mipmask = mipData.mipmask;
            copyFlags(texture, mipData);
            check$1.texture2D(texInfo, mipData, limits);
            texture.internalformat = mipData.internalformat;
            reglTexture2D.width = mipData.width;
            reglTexture2D.height = mipData.height;
            tempBind(texture);
            setMipMap(mipData, GL_TEXTURE_2D$1);
            setTexInfo(texInfo, GL_TEXTURE_2D$1);
            tempRestore();
            freeMipMap(mipData);
            if (config.profile) {
              texture.stats.size = getTextureSize(
                texture.internalformat,
                texture.type,
                mipData.width,
                mipData.height,
                texInfo.genMipmaps,
                false
              );
            }
            reglTexture2D.format = textureFormatsInvert[texture.internalformat];
            reglTexture2D.type = textureTypesInvert[texture.type];
            reglTexture2D.mag = magFiltersInvert[texInfo.magFilter];
            reglTexture2D.min = minFiltersInvert[texInfo.minFilter];
            reglTexture2D.wrapS = wrapModesInvert[texInfo.wrapS];
            reglTexture2D.wrapT = wrapModesInvert[texInfo.wrapT];
            return reglTexture2D;
          }
          function subimage(image, x_, y_, level_) {
            check$1(!!image, "must specify image data");
            var x2 = x_ | 0;
            var y = y_ | 0;
            var level = level_ | 0;
            var imageData = allocImage();
            copyFlags(imageData, texture);
            imageData.width = 0;
            imageData.height = 0;
            parseImage(imageData, image);
            imageData.width = imageData.width || (texture.width >> level) - x2;
            imageData.height = imageData.height || (texture.height >> level) - y;
            check$1(
              texture.type === imageData.type && texture.format === imageData.format && texture.internalformat === imageData.internalformat,
              "incompatible format for texture.subimage"
            );
            check$1(
              x2 >= 0 && y >= 0 && x2 + imageData.width <= texture.width && y + imageData.height <= texture.height,
              "texture.subimage write out of bounds"
            );
            check$1(
              texture.mipmask & 1 << level,
              "missing mipmap data"
            );
            check$1(
              imageData.data || imageData.element || imageData.needsCopy,
              "missing image data"
            );
            tempBind(texture);
            setSubImage(imageData, GL_TEXTURE_2D$1, x2, y, level);
            tempRestore();
            freeImage(imageData);
            return reglTexture2D;
          }
          function resize(w_, h_) {
            var w = w_ | 0;
            var h = h_ | 0 || w;
            if (w === texture.width && h === texture.height) {
              return reglTexture2D;
            }
            reglTexture2D.width = texture.width = w;
            reglTexture2D.height = texture.height = h;
            tempBind(texture);
            for (var i = 0; texture.mipmask >> i; ++i) {
              var _w = w >> i;
              var _h = h >> i;
              if (!_w || !_h) break;
              gl.texImage2D(
                GL_TEXTURE_2D$1,
                i,
                texture.format,
                _w,
                _h,
                0,
                texture.format,
                texture.type,
                null
              );
            }
            tempRestore();
            if (config.profile) {
              texture.stats.size = getTextureSize(
                texture.internalformat,
                texture.type,
                w,
                h,
                false,
                false
              );
            }
            return reglTexture2D;
          }
          reglTexture2D(a2, b);
          reglTexture2D.subimage = subimage;
          reglTexture2D.resize = resize;
          reglTexture2D._reglType = "texture2d";
          reglTexture2D._texture = texture;
          if (config.profile) {
            reglTexture2D.stats = texture.stats;
          }
          reglTexture2D.destroy = function() {
            texture.decRef();
          };
          return reglTexture2D;
        }
        function createTextureCube(a0, a1, a2, a3, a4, a5) {
          var texture = new REGLTexture(GL_TEXTURE_CUBE_MAP$1);
          textureSet[texture.id] = texture;
          stats2.cubeCount++;
          var faces = new Array(6);
          function reglTextureCube(a02, a12, a22, a32, a42, a52) {
            var i;
            var texInfo = texture.texInfo;
            TexInfo.call(texInfo);
            for (i = 0; i < 6; ++i) {
              faces[i] = allocMipMap();
            }
            if (typeof a02 === "number" || !a02) {
              var s = a02 | 0 || 1;
              for (i = 0; i < 6; ++i) {
                parseMipMapFromShape(faces[i], s, s);
              }
            } else if (typeof a02 === "object") {
              if (a12) {
                parseMipMapFromObject(faces[0], a02);
                parseMipMapFromObject(faces[1], a12);
                parseMipMapFromObject(faces[2], a22);
                parseMipMapFromObject(faces[3], a32);
                parseMipMapFromObject(faces[4], a42);
                parseMipMapFromObject(faces[5], a52);
              } else {
                parseTexInfo(texInfo, a02);
                parseFlags(texture, a02);
                if ("faces" in a02) {
                  var faceInput = a02.faces;
                  check$1(
                    Array.isArray(faceInput) && faceInput.length === 6,
                    "cube faces must be a length 6 array"
                  );
                  for (i = 0; i < 6; ++i) {
                    check$1(
                      typeof faceInput[i] === "object" && !!faceInput[i],
                      "invalid input for cube map face"
                    );
                    copyFlags(faces[i], texture);
                    parseMipMapFromObject(faces[i], faceInput[i]);
                  }
                } else {
                  for (i = 0; i < 6; ++i) {
                    parseMipMapFromObject(faces[i], a02);
                  }
                }
              }
            } else {
              check$1.raise("invalid arguments to cube map");
            }
            copyFlags(texture, faces[0]);
            check$1.optional(function() {
              if (!limits.npotTextureCube) {
                check$1(isPow2$1(texture.width) && isPow2$1(texture.height), "your browser does not support non power or two texture dimensions");
              }
            });
            if (texInfo.genMipmaps) {
              texture.mipmask = (faces[0].width << 1) - 1;
            } else {
              texture.mipmask = faces[0].mipmask;
            }
            check$1.textureCube(texture, texInfo, faces, limits);
            texture.internalformat = faces[0].internalformat;
            reglTextureCube.width = faces[0].width;
            reglTextureCube.height = faces[0].height;
            tempBind(texture);
            for (i = 0; i < 6; ++i) {
              setMipMap(faces[i], GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i);
            }
            setTexInfo(texInfo, GL_TEXTURE_CUBE_MAP$1);
            tempRestore();
            if (config.profile) {
              texture.stats.size = getTextureSize(
                texture.internalformat,
                texture.type,
                reglTextureCube.width,
                reglTextureCube.height,
                texInfo.genMipmaps,
                true
              );
            }
            reglTextureCube.format = textureFormatsInvert[texture.internalformat];
            reglTextureCube.type = textureTypesInvert[texture.type];
            reglTextureCube.mag = magFiltersInvert[texInfo.magFilter];
            reglTextureCube.min = minFiltersInvert[texInfo.minFilter];
            reglTextureCube.wrapS = wrapModesInvert[texInfo.wrapS];
            reglTextureCube.wrapT = wrapModesInvert[texInfo.wrapT];
            for (i = 0; i < 6; ++i) {
              freeMipMap(faces[i]);
            }
            return reglTextureCube;
          }
          function subimage(face, image, x_, y_, level_) {
            check$1(!!image, "must specify image data");
            check$1(typeof face === "number" && face === (face | 0) && face >= 0 && face < 6, "invalid face");
            var x2 = x_ | 0;
            var y = y_ | 0;
            var level = level_ | 0;
            var imageData = allocImage();
            copyFlags(imageData, texture);
            imageData.width = 0;
            imageData.height = 0;
            parseImage(imageData, image);
            imageData.width = imageData.width || (texture.width >> level) - x2;
            imageData.height = imageData.height || (texture.height >> level) - y;
            check$1(
              texture.type === imageData.type && texture.format === imageData.format && texture.internalformat === imageData.internalformat,
              "incompatible format for texture.subimage"
            );
            check$1(
              x2 >= 0 && y >= 0 && x2 + imageData.width <= texture.width && y + imageData.height <= texture.height,
              "texture.subimage write out of bounds"
            );
            check$1(
              texture.mipmask & 1 << level,
              "missing mipmap data"
            );
            check$1(
              imageData.data || imageData.element || imageData.needsCopy,
              "missing image data"
            );
            tempBind(texture);
            setSubImage(imageData, GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + face, x2, y, level);
            tempRestore();
            freeImage(imageData);
            return reglTextureCube;
          }
          function resize(radius_) {
            var radius = radius_ | 0;
            if (radius === texture.width) {
              return;
            }
            reglTextureCube.width = texture.width = radius;
            reglTextureCube.height = texture.height = radius;
            tempBind(texture);
            for (var i = 0; i < 6; ++i) {
              for (var j = 0; texture.mipmask >> j; ++j) {
                gl.texImage2D(
                  GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i,
                  j,
                  texture.format,
                  radius >> j,
                  radius >> j,
                  0,
                  texture.format,
                  texture.type,
                  null
                );
              }
            }
            tempRestore();
            if (config.profile) {
              texture.stats.size = getTextureSize(
                texture.internalformat,
                texture.type,
                reglTextureCube.width,
                reglTextureCube.height,
                false,
                true
              );
            }
            return reglTextureCube;
          }
          reglTextureCube(a0, a1, a2, a3, a4, a5);
          reglTextureCube.subimage = subimage;
          reglTextureCube.resize = resize;
          reglTextureCube._reglType = "textureCube";
          reglTextureCube._texture = texture;
          if (config.profile) {
            reglTextureCube.stats = texture.stats;
          }
          reglTextureCube.destroy = function() {
            texture.decRef();
          };
          return reglTextureCube;
        }
        function destroyTextures() {
          for (var i = 0; i < numTexUnits; ++i) {
            gl.activeTexture(GL_TEXTURE0$1 + i);
            gl.bindTexture(GL_TEXTURE_2D$1, null);
            textureUnits[i] = null;
          }
          values(textureSet).forEach(destroy);
          stats2.cubeCount = 0;
          stats2.textureCount = 0;
        }
        if (config.profile) {
          stats2.getTotalTextureSize = function() {
            var total = 0;
            Object.keys(textureSet).forEach(function(key) {
              total += textureSet[key].stats.size;
            });
            return total;
          };
        }
        function restoreTextures() {
          for (var i = 0; i < numTexUnits; ++i) {
            var tex = textureUnits[i];
            if (tex) {
              tex.bindCount = 0;
              tex.unit = -1;
              textureUnits[i] = null;
            }
          }
          values(textureSet).forEach(function(texture) {
            texture.texture = gl.createTexture();
            gl.bindTexture(texture.target, texture.texture);
            for (var i2 = 0; i2 < 32; ++i2) {
              if ((texture.mipmask & 1 << i2) === 0) {
                continue;
              }
              if (texture.target === GL_TEXTURE_2D$1) {
                gl.texImage2D(
                  GL_TEXTURE_2D$1,
                  i2,
                  texture.internalformat,
                  texture.width >> i2,
                  texture.height >> i2,
                  0,
                  texture.internalformat,
                  texture.type,
                  null
                );
              } else {
                for (var j = 0; j < 6; ++j) {
                  gl.texImage2D(
                    GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + j,
                    i2,
                    texture.internalformat,
                    texture.width >> i2,
                    texture.height >> i2,
                    0,
                    texture.internalformat,
                    texture.type,
                    null
                  );
                }
              }
            }
            setTexInfo(texture.texInfo, texture.target);
          });
        }
        function refreshTextures() {
          for (var i = 0; i < numTexUnits; ++i) {
            var tex = textureUnits[i];
            if (tex) {
              tex.bindCount = 0;
              tex.unit = -1;
              textureUnits[i] = null;
            }
            gl.activeTexture(GL_TEXTURE0$1 + i);
            gl.bindTexture(GL_TEXTURE_2D$1, null);
            gl.bindTexture(GL_TEXTURE_CUBE_MAP$1, null);
          }
        }
        return {
          create2D: createTexture2D,
          createCube: createTextureCube,
          clear: destroyTextures,
          getTexture: function(wrapper) {
            return null;
          },
          restore: restoreTextures,
          refresh: refreshTextures
        };
      }
      var GL_RENDERBUFFER = 36161;
      var GL_RGBA4$1 = 32854;
      var GL_RGB5_A1$1 = 32855;
      var GL_RGB565$1 = 36194;
      var GL_DEPTH_COMPONENT16 = 33189;
      var GL_STENCIL_INDEX8 = 36168;
      var GL_DEPTH_STENCIL$1 = 34041;
      var GL_SRGB8_ALPHA8_EXT = 35907;
      var GL_RGBA32F_EXT = 34836;
      var GL_RGBA16F_EXT = 34842;
      var GL_RGB16F_EXT = 34843;
      var FORMAT_SIZES = [];
      FORMAT_SIZES[GL_RGBA4$1] = 2;
      FORMAT_SIZES[GL_RGB5_A1$1] = 2;
      FORMAT_SIZES[GL_RGB565$1] = 2;
      FORMAT_SIZES[GL_DEPTH_COMPONENT16] = 2;
      FORMAT_SIZES[GL_STENCIL_INDEX8] = 1;
      FORMAT_SIZES[GL_DEPTH_STENCIL$1] = 4;
      FORMAT_SIZES[GL_SRGB8_ALPHA8_EXT] = 4;
      FORMAT_SIZES[GL_RGBA32F_EXT] = 16;
      FORMAT_SIZES[GL_RGBA16F_EXT] = 8;
      FORMAT_SIZES[GL_RGB16F_EXT] = 6;
      function getRenderbufferSize(format, width, height) {
        return FORMAT_SIZES[format] * width * height;
      }
      var wrapRenderbuffers = function(gl, extensions, limits, stats2, config) {
        var formatTypes = {
          "rgba4": GL_RGBA4$1,
          "rgb565": GL_RGB565$1,
          "rgb5 a1": GL_RGB5_A1$1,
          "depth": GL_DEPTH_COMPONENT16,
          "stencil": GL_STENCIL_INDEX8,
          "depth stencil": GL_DEPTH_STENCIL$1
        };
        if (extensions.ext_srgb) {
          formatTypes["srgba"] = GL_SRGB8_ALPHA8_EXT;
        }
        if (extensions.ext_color_buffer_half_float) {
          formatTypes["rgba16f"] = GL_RGBA16F_EXT;
          formatTypes["rgb16f"] = GL_RGB16F_EXT;
        }
        if (extensions.webgl_color_buffer_float) {
          formatTypes["rgba32f"] = GL_RGBA32F_EXT;
        }
        var formatTypesInvert = [];
        Object.keys(formatTypes).forEach(function(key) {
          var val = formatTypes[key];
          formatTypesInvert[val] = key;
        });
        var renderbufferCount = 0;
        var renderbufferSet = {};
        function REGLRenderbuffer(renderbuffer) {
          this.id = renderbufferCount++;
          this.refCount = 1;
          this.renderbuffer = renderbuffer;
          this.format = GL_RGBA4$1;
          this.width = 0;
          this.height = 0;
          if (config.profile) {
            this.stats = { size: 0 };
          }
        }
        REGLRenderbuffer.prototype.decRef = function() {
          if (--this.refCount <= 0) {
            destroy(this);
          }
        };
        function destroy(rb) {
          var handle = rb.renderbuffer;
          check$1(handle, "must not double destroy renderbuffer");
          gl.bindRenderbuffer(GL_RENDERBUFFER, null);
          gl.deleteRenderbuffer(handle);
          rb.renderbuffer = null;
          rb.refCount = 0;
          delete renderbufferSet[rb.id];
          stats2.renderbufferCount--;
        }
        function createRenderbuffer(a2, b) {
          var renderbuffer = new REGLRenderbuffer(gl.createRenderbuffer());
          renderbufferSet[renderbuffer.id] = renderbuffer;
          stats2.renderbufferCount++;
          function reglRenderbuffer(a22, b2) {
            var w = 0;
            var h = 0;
            var format = GL_RGBA4$1;
            if (typeof a22 === "object" && a22) {
              var options = a22;
              if ("shape" in options) {
                var shape = options.shape;
                check$1(
                  Array.isArray(shape) && shape.length >= 2,
                  "invalid renderbuffer shape"
                );
                w = shape[0] | 0;
                h = shape[1] | 0;
              } else {
                if ("radius" in options) {
                  w = h = options.radius | 0;
                }
                if ("width" in options) {
                  w = options.width | 0;
                }
                if ("height" in options) {
                  h = options.height | 0;
                }
              }
              if ("format" in options) {
                check$1.parameter(
                  options.format,
                  formatTypes,
                  "invalid renderbuffer format"
                );
                format = formatTypes[options.format];
              }
            } else if (typeof a22 === "number") {
              w = a22 | 0;
              if (typeof b2 === "number") {
                h = b2 | 0;
              } else {
                h = w;
              }
            } else if (!a22) {
              w = h = 1;
            } else {
              check$1.raise("invalid arguments to renderbuffer constructor");
            }
            check$1(
              w > 0 && h > 0 && w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize,
              "invalid renderbuffer size"
            );
            if (w === renderbuffer.width && h === renderbuffer.height && format === renderbuffer.format) {
              return;
            }
            reglRenderbuffer.width = renderbuffer.width = w;
            reglRenderbuffer.height = renderbuffer.height = h;
            renderbuffer.format = format;
            gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
            gl.renderbufferStorage(GL_RENDERBUFFER, format, w, h);
            check$1(
              gl.getError() === 0,
              "invalid render buffer format"
            );
            if (config.profile) {
              renderbuffer.stats.size = getRenderbufferSize(renderbuffer.format, renderbuffer.width, renderbuffer.height);
            }
            reglRenderbuffer.format = formatTypesInvert[renderbuffer.format];
            return reglRenderbuffer;
          }
          function resize(w_, h_) {
            var w = w_ | 0;
            var h = h_ | 0 || w;
            if (w === renderbuffer.width && h === renderbuffer.height) {
              return reglRenderbuffer;
            }
            check$1(
              w > 0 && h > 0 && w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize,
              "invalid renderbuffer size"
            );
            reglRenderbuffer.width = renderbuffer.width = w;
            reglRenderbuffer.height = renderbuffer.height = h;
            gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
            gl.renderbufferStorage(GL_RENDERBUFFER, renderbuffer.format, w, h);
            check$1(
              gl.getError() === 0,
              "invalid render buffer format"
            );
            if (config.profile) {
              renderbuffer.stats.size = getRenderbufferSize(
                renderbuffer.format,
                renderbuffer.width,
                renderbuffer.height
              );
            }
            return reglRenderbuffer;
          }
          reglRenderbuffer(a2, b);
          reglRenderbuffer.resize = resize;
          reglRenderbuffer._reglType = "renderbuffer";
          reglRenderbuffer._renderbuffer = renderbuffer;
          if (config.profile) {
            reglRenderbuffer.stats = renderbuffer.stats;
          }
          reglRenderbuffer.destroy = function() {
            renderbuffer.decRef();
          };
          return reglRenderbuffer;
        }
        if (config.profile) {
          stats2.getTotalRenderbufferSize = function() {
            var total = 0;
            Object.keys(renderbufferSet).forEach(function(key) {
              total += renderbufferSet[key].stats.size;
            });
            return total;
          };
        }
        function restoreRenderbuffers() {
          values(renderbufferSet).forEach(function(rb) {
            rb.renderbuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(GL_RENDERBUFFER, rb.renderbuffer);
            gl.renderbufferStorage(GL_RENDERBUFFER, rb.format, rb.width, rb.height);
          });
          gl.bindRenderbuffer(GL_RENDERBUFFER, null);
        }
        return {
          create: createRenderbuffer,
          clear: function() {
            values(renderbufferSet).forEach(destroy);
          },
          restore: restoreRenderbuffers
        };
      };
      var GL_FRAMEBUFFER$1 = 36160;
      var GL_RENDERBUFFER$1 = 36161;
      var GL_TEXTURE_2D$2 = 3553;
      var GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 = 34069;
      var GL_COLOR_ATTACHMENT0$1 = 36064;
      var GL_DEPTH_ATTACHMENT = 36096;
      var GL_STENCIL_ATTACHMENT = 36128;
      var GL_DEPTH_STENCIL_ATTACHMENT = 33306;
      var GL_FRAMEBUFFER_COMPLETE$1 = 36053;
      var GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 36054;
      var GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 36055;
      var GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 36057;
      var GL_FRAMEBUFFER_UNSUPPORTED = 36061;
      var GL_HALF_FLOAT_OES$2 = 36193;
      var GL_UNSIGNED_BYTE$6 = 5121;
      var GL_FLOAT$5 = 5126;
      var GL_RGB$1 = 6407;
      var GL_RGBA$2 = 6408;
      var GL_DEPTH_COMPONENT$1 = 6402;
      var colorTextureFormatEnums = [
        GL_RGB$1,
        GL_RGBA$2
      ];
      var textureFormatChannels = [];
      textureFormatChannels[GL_RGBA$2] = 4;
      textureFormatChannels[GL_RGB$1] = 3;
      var textureTypeSizes = [];
      textureTypeSizes[GL_UNSIGNED_BYTE$6] = 1;
      textureTypeSizes[GL_FLOAT$5] = 4;
      textureTypeSizes[GL_HALF_FLOAT_OES$2] = 2;
      var GL_RGBA4$2 = 32854;
      var GL_RGB5_A1$2 = 32855;
      var GL_RGB565$2 = 36194;
      var GL_DEPTH_COMPONENT16$1 = 33189;
      var GL_STENCIL_INDEX8$1 = 36168;
      var GL_DEPTH_STENCIL$2 = 34041;
      var GL_SRGB8_ALPHA8_EXT$1 = 35907;
      var GL_RGBA32F_EXT$1 = 34836;
      var GL_RGBA16F_EXT$1 = 34842;
      var GL_RGB16F_EXT$1 = 34843;
      var colorRenderbufferFormatEnums = [
        GL_RGBA4$2,
        GL_RGB5_A1$2,
        GL_RGB565$2,
        GL_SRGB8_ALPHA8_EXT$1,
        GL_RGBA16F_EXT$1,
        GL_RGB16F_EXT$1,
        GL_RGBA32F_EXT$1
      ];
      var statusCode = {};
      statusCode[GL_FRAMEBUFFER_COMPLETE$1] = "complete";
      statusCode[GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT] = "incomplete attachment";
      statusCode[GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS] = "incomplete dimensions";
      statusCode[GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = "incomplete, missing attachment";
      statusCode[GL_FRAMEBUFFER_UNSUPPORTED] = "unsupported";
      function wrapFBOState(gl, extensions, limits, textureState, renderbufferState, stats2) {
        var framebufferState = {
          cur: null,
          next: null,
          dirty: false,
          setFBO: null
        };
        var colorTextureFormats = ["rgba"];
        var colorRenderbufferFormats = ["rgba4", "rgb565", "rgb5 a1"];
        if (extensions.ext_srgb) {
          colorRenderbufferFormats.push("srgba");
        }
        if (extensions.ext_color_buffer_half_float) {
          colorRenderbufferFormats.push("rgba16f", "rgb16f");
        }
        if (extensions.webgl_color_buffer_float) {
          colorRenderbufferFormats.push("rgba32f");
        }
        var colorTypes = ["uint8"];
        if (extensions.oes_texture_half_float) {
          colorTypes.push("half float", "float16");
        }
        if (extensions.oes_texture_float) {
          colorTypes.push("float", "float32");
        }
        function FramebufferAttachment(target, texture, renderbuffer) {
          this.target = target;
          this.texture = texture;
          this.renderbuffer = renderbuffer;
          var w = 0;
          var h = 0;
          if (texture) {
            w = texture.width;
            h = texture.height;
          } else if (renderbuffer) {
            w = renderbuffer.width;
            h = renderbuffer.height;
          }
          this.width = w;
          this.height = h;
        }
        function decRef(attachment) {
          if (attachment) {
            if (attachment.texture) {
              attachment.texture._texture.decRef();
            }
            if (attachment.renderbuffer) {
              attachment.renderbuffer._renderbuffer.decRef();
            }
          }
        }
        function incRefAndCheckShape(attachment, width, height) {
          if (!attachment) {
            return;
          }
          if (attachment.texture) {
            var texture = attachment.texture._texture;
            var tw = Math.max(1, texture.width);
            var th = Math.max(1, texture.height);
            check$1(
              tw === width && th === height,
              "inconsistent width/height for supplied texture"
            );
            texture.refCount += 1;
          } else {
            var renderbuffer = attachment.renderbuffer._renderbuffer;
            check$1(
              renderbuffer.width === width && renderbuffer.height === height,
              "inconsistent width/height for renderbuffer"
            );
            renderbuffer.refCount += 1;
          }
        }
        function attach(location, attachment) {
          if (attachment) {
            if (attachment.texture) {
              gl.framebufferTexture2D(
                GL_FRAMEBUFFER$1,
                location,
                attachment.target,
                attachment.texture._texture.texture,
                0
              );
            } else {
              gl.framebufferRenderbuffer(
                GL_FRAMEBUFFER$1,
                location,
                GL_RENDERBUFFER$1,
                attachment.renderbuffer._renderbuffer.renderbuffer
              );
            }
          }
        }
        function parseAttachment(attachment) {
          var target = GL_TEXTURE_2D$2;
          var texture = null;
          var renderbuffer = null;
          var data2 = attachment;
          if (typeof attachment === "object") {
            data2 = attachment.data;
            if ("target" in attachment) {
              target = attachment.target | 0;
            }
          }
          check$1.type(data2, "function", "invalid attachment data");
          var type = data2._reglType;
          if (type === "texture2d") {
            texture = data2;
            check$1(target === GL_TEXTURE_2D$2);
          } else if (type === "textureCube") {
            texture = data2;
            check$1(
              target >= GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 && target < GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + 6,
              "invalid cube map target"
            );
          } else if (type === "renderbuffer") {
            renderbuffer = data2;
            target = GL_RENDERBUFFER$1;
          } else {
            check$1.raise("invalid regl object for attachment");
          }
          return new FramebufferAttachment(target, texture, renderbuffer);
        }
        function allocAttachment(width, height, isTexture, format, type) {
          if (isTexture) {
            var texture = textureState.create2D({
              width,
              height,
              format,
              type
            });
            texture._texture.refCount = 0;
            return new FramebufferAttachment(GL_TEXTURE_2D$2, texture, null);
          } else {
            var rb = renderbufferState.create({
              width,
              height,
              format
            });
            rb._renderbuffer.refCount = 0;
            return new FramebufferAttachment(GL_RENDERBUFFER$1, null, rb);
          }
        }
        function unwrapAttachment(attachment) {
          return attachment && (attachment.texture || attachment.renderbuffer);
        }
        function resizeAttachment(attachment, w, h) {
          if (attachment) {
            if (attachment.texture) {
              attachment.texture.resize(w, h);
            } else if (attachment.renderbuffer) {
              attachment.renderbuffer.resize(w, h);
            }
            attachment.width = w;
            attachment.height = h;
          }
        }
        var framebufferCount = 0;
        var framebufferSet = {};
        function REGLFramebuffer() {
          this.id = framebufferCount++;
          framebufferSet[this.id] = this;
          this.framebuffer = gl.createFramebuffer();
          this.width = 0;
          this.height = 0;
          this.colorAttachments = [];
          this.depthAttachment = null;
          this.stencilAttachment = null;
          this.depthStencilAttachment = null;
        }
        function decFBORefs(framebuffer) {
          framebuffer.colorAttachments.forEach(decRef);
          decRef(framebuffer.depthAttachment);
          decRef(framebuffer.stencilAttachment);
          decRef(framebuffer.depthStencilAttachment);
        }
        function destroy(framebuffer) {
          var handle = framebuffer.framebuffer;
          check$1(handle, "must not double destroy framebuffer");
          gl.deleteFramebuffer(handle);
          framebuffer.framebuffer = null;
          stats2.framebufferCount--;
          delete framebufferSet[framebuffer.id];
        }
        function updateFramebuffer(framebuffer) {
          var i;
          gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebuffer.framebuffer);
          var colorAttachments = framebuffer.colorAttachments;
          for (i = 0; i < colorAttachments.length; ++i) {
            attach(GL_COLOR_ATTACHMENT0$1 + i, colorAttachments[i]);
          }
          for (i = colorAttachments.length; i < limits.maxColorAttachments; ++i) {
            gl.framebufferTexture2D(
              GL_FRAMEBUFFER$1,
              GL_COLOR_ATTACHMENT0$1 + i,
              GL_TEXTURE_2D$2,
              null,
              0
            );
          }
          gl.framebufferTexture2D(
            GL_FRAMEBUFFER$1,
            GL_DEPTH_STENCIL_ATTACHMENT,
            GL_TEXTURE_2D$2,
            null,
            0
          );
          gl.framebufferTexture2D(
            GL_FRAMEBUFFER$1,
            GL_DEPTH_ATTACHMENT,
            GL_TEXTURE_2D$2,
            null,
            0
          );
          gl.framebufferTexture2D(
            GL_FRAMEBUFFER$1,
            GL_STENCIL_ATTACHMENT,
            GL_TEXTURE_2D$2,
            null,
            0
          );
          attach(GL_DEPTH_ATTACHMENT, framebuffer.depthAttachment);
          attach(GL_STENCIL_ATTACHMENT, framebuffer.stencilAttachment);
          attach(GL_DEPTH_STENCIL_ATTACHMENT, framebuffer.depthStencilAttachment);
          var status = gl.checkFramebufferStatus(GL_FRAMEBUFFER$1);
          if (!gl.isContextLost() && status !== GL_FRAMEBUFFER_COMPLETE$1) {
            check$1.raise("framebuffer configuration not supported, status = " + statusCode[status]);
          }
          gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebufferState.next ? framebufferState.next.framebuffer : null);
          framebufferState.cur = framebufferState.next;
          gl.getError();
        }
        function createFBO(a0, a1) {
          var framebuffer = new REGLFramebuffer();
          stats2.framebufferCount++;
          function reglFramebuffer(a2, b) {
            var i;
            check$1(
              framebufferState.next !== framebuffer,
              "can not update framebuffer which is currently in use"
            );
            var width = 0;
            var height = 0;
            var needsDepth = true;
            var needsStencil = true;
            var colorBuffer = null;
            var colorTexture = true;
            var colorFormat = "rgba";
            var colorType = "uint8";
            var colorCount = 1;
            var depthBuffer = null;
            var stencilBuffer = null;
            var depthStencilBuffer = null;
            var depthStencilTexture = false;
            if (typeof a2 === "number") {
              width = a2 | 0;
              height = b | 0 || width;
            } else if (!a2) {
              width = height = 1;
            } else {
              check$1.type(a2, "object", "invalid arguments for framebuffer");
              var options = a2;
              if ("shape" in options) {
                var shape = options.shape;
                check$1(
                  Array.isArray(shape) && shape.length >= 2,
                  "invalid shape for framebuffer"
                );
                width = shape[0];
                height = shape[1];
              } else {
                if ("radius" in options) {
                  width = height = options.radius;
                }
                if ("width" in options) {
                  width = options.width;
                }
                if ("height" in options) {
                  height = options.height;
                }
              }
              if ("color" in options || "colors" in options) {
                colorBuffer = options.color || options.colors;
                if (Array.isArray(colorBuffer)) {
                  check$1(
                    colorBuffer.length === 1 || extensions.webgl_draw_buffers,
                    "multiple render targets not supported"
                  );
                }
              }
              if (!colorBuffer) {
                if ("colorCount" in options) {
                  colorCount = options.colorCount | 0;
                  check$1(colorCount > 0, "invalid color buffer count");
                }
                if ("colorTexture" in options) {
                  colorTexture = !!options.colorTexture;
                  colorFormat = "rgba4";
                }
                if ("colorType" in options) {
                  colorType = options.colorType;
                  if (!colorTexture) {
                    if (colorType === "half float" || colorType === "float16") {
                      check$1(
                        extensions.ext_color_buffer_half_float,
                        "you must enable EXT_color_buffer_half_float to use 16-bit render buffers"
                      );
                      colorFormat = "rgba16f";
                    } else if (colorType === "float" || colorType === "float32") {
                      check$1(
                        extensions.webgl_color_buffer_float,
                        "you must enable WEBGL_color_buffer_float in order to use 32-bit floating point renderbuffers"
                      );
                      colorFormat = "rgba32f";
                    }
                  } else {
                    check$1(
                      extensions.oes_texture_float || !(colorType === "float" || colorType === "float32"),
                      "you must enable OES_texture_float in order to use floating point framebuffer objects"
                    );
                    check$1(
                      extensions.oes_texture_half_float || !(colorType === "half float" || colorType === "float16"),
                      "you must enable OES_texture_half_float in order to use 16-bit floating point framebuffer objects"
                    );
                  }
                  check$1.oneOf(colorType, colorTypes, "invalid color type");
                }
                if ("colorFormat" in options) {
                  colorFormat = options.colorFormat;
                  if (colorTextureFormats.indexOf(colorFormat) >= 0) {
                    colorTexture = true;
                  } else if (colorRenderbufferFormats.indexOf(colorFormat) >= 0) {
                    colorTexture = false;
                  } else {
                    check$1.optional(function() {
                      if (colorTexture) {
                        check$1.oneOf(
                          options.colorFormat,
                          colorTextureFormats,
                          "invalid color format for texture"
                        );
                      } else {
                        check$1.oneOf(
                          options.colorFormat,
                          colorRenderbufferFormats,
                          "invalid color format for renderbuffer"
                        );
                      }
                    });
                  }
                }
              }
              if ("depthTexture" in options || "depthStencilTexture" in options) {
                depthStencilTexture = !!(options.depthTexture || options.depthStencilTexture);
                check$1(
                  !depthStencilTexture || extensions.webgl_depth_texture,
                  "webgl_depth_texture extension not supported"
                );
              }
              if ("depth" in options) {
                if (typeof options.depth === "boolean") {
                  needsDepth = options.depth;
                } else {
                  depthBuffer = options.depth;
                  needsStencil = false;
                }
              }
              if ("stencil" in options) {
                if (typeof options.stencil === "boolean") {
                  needsStencil = options.stencil;
                } else {
                  stencilBuffer = options.stencil;
                  needsDepth = false;
                }
              }
              if ("depthStencil" in options) {
                if (typeof options.depthStencil === "boolean") {
                  needsDepth = needsStencil = options.depthStencil;
                } else {
                  depthStencilBuffer = options.depthStencil;
                  needsDepth = false;
                  needsStencil = false;
                }
              }
            }
            var colorAttachments = null;
            var depthAttachment = null;
            var stencilAttachment = null;
            var depthStencilAttachment = null;
            if (Array.isArray(colorBuffer)) {
              colorAttachments = colorBuffer.map(parseAttachment);
            } else if (colorBuffer) {
              colorAttachments = [parseAttachment(colorBuffer)];
            } else {
              colorAttachments = new Array(colorCount);
              for (i = 0; i < colorCount; ++i) {
                colorAttachments[i] = allocAttachment(
                  width,
                  height,
                  colorTexture,
                  colorFormat,
                  colorType
                );
              }
            }
            check$1(
              extensions.webgl_draw_buffers || colorAttachments.length <= 1,
              "you must enable the WEBGL_draw_buffers extension in order to use multiple color buffers."
            );
            check$1(
              colorAttachments.length <= limits.maxColorAttachments,
              "too many color attachments, not supported"
            );
            width = width || colorAttachments[0].width;
            height = height || colorAttachments[0].height;
            if (depthBuffer) {
              depthAttachment = parseAttachment(depthBuffer);
            } else if (needsDepth && !needsStencil) {
              depthAttachment = allocAttachment(
                width,
                height,
                depthStencilTexture,
                "depth",
                "uint32"
              );
            }
            if (stencilBuffer) {
              stencilAttachment = parseAttachment(stencilBuffer);
            } else if (needsStencil && !needsDepth) {
              stencilAttachment = allocAttachment(
                width,
                height,
                false,
                "stencil",
                "uint8"
              );
            }
            if (depthStencilBuffer) {
              depthStencilAttachment = parseAttachment(depthStencilBuffer);
            } else if (!depthBuffer && !stencilBuffer && needsStencil && needsDepth) {
              depthStencilAttachment = allocAttachment(
                width,
                height,
                depthStencilTexture,
                "depth stencil",
                "depth stencil"
              );
            }
            check$1(
              !!depthBuffer + !!stencilBuffer + !!depthStencilBuffer <= 1,
              "invalid framebuffer configuration, can specify exactly one depth/stencil attachment"
            );
            var commonColorAttachmentSize = null;
            for (i = 0; i < colorAttachments.length; ++i) {
              incRefAndCheckShape(colorAttachments[i], width, height);
              check$1(
                !colorAttachments[i] || colorAttachments[i].texture && colorTextureFormatEnums.indexOf(colorAttachments[i].texture._texture.format) >= 0 || colorAttachments[i].renderbuffer && colorRenderbufferFormatEnums.indexOf(colorAttachments[i].renderbuffer._renderbuffer.format) >= 0,
                "framebuffer color attachment " + i + " is invalid"
              );
              if (colorAttachments[i] && colorAttachments[i].texture) {
                var colorAttachmentSize = textureFormatChannels[colorAttachments[i].texture._texture.format] * textureTypeSizes[colorAttachments[i].texture._texture.type];
                if (commonColorAttachmentSize === null) {
                  commonColorAttachmentSize = colorAttachmentSize;
                } else {
                  check$1(
                    commonColorAttachmentSize === colorAttachmentSize,
                    "all color attachments much have the same number of bits per pixel."
                  );
                }
              }
            }
            incRefAndCheckShape(depthAttachment, width, height);
            check$1(
              !depthAttachment || depthAttachment.texture && depthAttachment.texture._texture.format === GL_DEPTH_COMPONENT$1 || depthAttachment.renderbuffer && depthAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_COMPONENT16$1,
              "invalid depth attachment for framebuffer object"
            );
            incRefAndCheckShape(stencilAttachment, width, height);
            check$1(
              !stencilAttachment || stencilAttachment.renderbuffer && stencilAttachment.renderbuffer._renderbuffer.format === GL_STENCIL_INDEX8$1,
              "invalid stencil attachment for framebuffer object"
            );
            incRefAndCheckShape(depthStencilAttachment, width, height);
            check$1(
              !depthStencilAttachment || depthStencilAttachment.texture && depthStencilAttachment.texture._texture.format === GL_DEPTH_STENCIL$2 || depthStencilAttachment.renderbuffer && depthStencilAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_STENCIL$2,
              "invalid depth-stencil attachment for framebuffer object"
            );
            decFBORefs(framebuffer);
            framebuffer.width = width;
            framebuffer.height = height;
            framebuffer.colorAttachments = colorAttachments;
            framebuffer.depthAttachment = depthAttachment;
            framebuffer.stencilAttachment = stencilAttachment;
            framebuffer.depthStencilAttachment = depthStencilAttachment;
            reglFramebuffer.color = colorAttachments.map(unwrapAttachment);
            reglFramebuffer.depth = unwrapAttachment(depthAttachment);
            reglFramebuffer.stencil = unwrapAttachment(stencilAttachment);
            reglFramebuffer.depthStencil = unwrapAttachment(depthStencilAttachment);
            reglFramebuffer.width = framebuffer.width;
            reglFramebuffer.height = framebuffer.height;
            updateFramebuffer(framebuffer);
            return reglFramebuffer;
          }
          function resize(w_, h_) {
            check$1(
              framebufferState.next !== framebuffer,
              "can not resize a framebuffer which is currently in use"
            );
            var w = Math.max(w_ | 0, 1);
            var h = Math.max(h_ | 0 || w, 1);
            if (w === framebuffer.width && h === framebuffer.height) {
              return reglFramebuffer;
            }
            var colorAttachments = framebuffer.colorAttachments;
            for (var i = 0; i < colorAttachments.length; ++i) {
              resizeAttachment(colorAttachments[i], w, h);
            }
            resizeAttachment(framebuffer.depthAttachment, w, h);
            resizeAttachment(framebuffer.stencilAttachment, w, h);
            resizeAttachment(framebuffer.depthStencilAttachment, w, h);
            framebuffer.width = reglFramebuffer.width = w;
            framebuffer.height = reglFramebuffer.height = h;
            updateFramebuffer(framebuffer);
            return reglFramebuffer;
          }
          reglFramebuffer(a0, a1);
          return extend2(reglFramebuffer, {
            resize,
            _reglType: "framebuffer",
            _framebuffer: framebuffer,
            destroy: function() {
              destroy(framebuffer);
              decFBORefs(framebuffer);
            },
            use: function(block) {
              framebufferState.setFBO({
                framebuffer: reglFramebuffer
              }, block);
            }
          });
        }
        function createCubeFBO(options) {
          var faces = Array(6);
          function reglFramebufferCube(a2) {
            var i;
            check$1(
              faces.indexOf(framebufferState.next) < 0,
              "can not update framebuffer which is currently in use"
            );
            var params = {
              color: null
            };
            var radius = 0;
            var colorBuffer = null;
            var colorFormat = "rgba";
            var colorType = "uint8";
            var colorCount = 1;
            if (typeof a2 === "number") {
              radius = a2 | 0;
            } else if (!a2) {
              radius = 1;
            } else {
              check$1.type(a2, "object", "invalid arguments for framebuffer");
              var options2 = a2;
              if ("shape" in options2) {
                var shape = options2.shape;
                check$1(
                  Array.isArray(shape) && shape.length >= 2,
                  "invalid shape for framebuffer"
                );
                check$1(
                  shape[0] === shape[1],
                  "cube framebuffer must be square"
                );
                radius = shape[0];
              } else {
                if ("radius" in options2) {
                  radius = options2.radius | 0;
                }
                if ("width" in options2) {
                  radius = options2.width | 0;
                  if ("height" in options2) {
                    check$1(options2.height === radius, "must be square");
                  }
                } else if ("height" in options2) {
                  radius = options2.height | 0;
                }
              }
              if ("color" in options2 || "colors" in options2) {
                colorBuffer = options2.color || options2.colors;
                if (Array.isArray(colorBuffer)) {
                  check$1(
                    colorBuffer.length === 1 || extensions.webgl_draw_buffers,
                    "multiple render targets not supported"
                  );
                }
              }
              if (!colorBuffer) {
                if ("colorCount" in options2) {
                  colorCount = options2.colorCount | 0;
                  check$1(colorCount > 0, "invalid color buffer count");
                }
                if ("colorType" in options2) {
                  check$1.oneOf(
                    options2.colorType,
                    colorTypes,
                    "invalid color type"
                  );
                  colorType = options2.colorType;
                }
                if ("colorFormat" in options2) {
                  colorFormat = options2.colorFormat;
                  check$1.oneOf(
                    options2.colorFormat,
                    colorTextureFormats,
                    "invalid color format for texture"
                  );
                }
              }
              if ("depth" in options2) {
                params.depth = options2.depth;
              }
              if ("stencil" in options2) {
                params.stencil = options2.stencil;
              }
              if ("depthStencil" in options2) {
                params.depthStencil = options2.depthStencil;
              }
            }
            var colorCubes;
            if (colorBuffer) {
              if (Array.isArray(colorBuffer)) {
                colorCubes = [];
                for (i = 0; i < colorBuffer.length; ++i) {
                  colorCubes[i] = colorBuffer[i];
                }
              } else {
                colorCubes = [colorBuffer];
              }
            } else {
              colorCubes = Array(colorCount);
              var cubeMapParams = {
                radius,
                format: colorFormat,
                type: colorType
              };
              for (i = 0; i < colorCount; ++i) {
                colorCubes[i] = textureState.createCube(cubeMapParams);
              }
            }
            params.color = Array(colorCubes.length);
            for (i = 0; i < colorCubes.length; ++i) {
              var cube2 = colorCubes[i];
              check$1(
                typeof cube2 === "function" && cube2._reglType === "textureCube",
                "invalid cube map"
              );
              radius = radius || cube2.width;
              check$1(
                cube2.width === radius && cube2.height === radius,
                "invalid cube map shape"
              );
              params.color[i] = {
                target: GL_TEXTURE_CUBE_MAP_POSITIVE_X$2,
                data: colorCubes[i]
              };
            }
            for (i = 0; i < 6; ++i) {
              for (var j = 0; j < colorCubes.length; ++j) {
                params.color[j].target = GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + i;
              }
              if (i > 0) {
                params.depth = faces[0].depth;
                params.stencil = faces[0].stencil;
                params.depthStencil = faces[0].depthStencil;
              }
              if (faces[i]) {
                faces[i](params);
              } else {
                faces[i] = createFBO(params);
              }
            }
            return extend2(reglFramebufferCube, {
              width: radius,
              height: radius,
              color: colorCubes
            });
          }
          function resize(radius_) {
            var i;
            var radius = radius_ | 0;
            check$1(
              radius > 0 && radius <= limits.maxCubeMapSize,
              "invalid radius for cube fbo"
            );
            if (radius === reglFramebufferCube.width) {
              return reglFramebufferCube;
            }
            var colors = reglFramebufferCube.color;
            for (i = 0; i < colors.length; ++i) {
              colors[i].resize(radius);
            }
            for (i = 0; i < 6; ++i) {
              faces[i].resize(radius);
            }
            reglFramebufferCube.width = reglFramebufferCube.height = radius;
            return reglFramebufferCube;
          }
          reglFramebufferCube(options);
          return extend2(reglFramebufferCube, {
            faces,
            resize,
            _reglType: "framebufferCube",
            destroy: function() {
              faces.forEach(function(f) {
                f.destroy();
              });
            }
          });
        }
        function restoreFramebuffers() {
          framebufferState.cur = null;
          framebufferState.next = null;
          framebufferState.dirty = true;
          values(framebufferSet).forEach(function(fb) {
            fb.framebuffer = gl.createFramebuffer();
            updateFramebuffer(fb);
          });
        }
        return extend2(framebufferState, {
          getFramebuffer: function(object) {
            if (typeof object === "function" && object._reglType === "framebuffer") {
              var fbo = object._framebuffer;
              if (fbo instanceof REGLFramebuffer) {
                return fbo;
              }
            }
            return null;
          },
          create: createFBO,
          createCube: createCubeFBO,
          clear: function() {
            values(framebufferSet).forEach(destroy);
          },
          restore: restoreFramebuffers
        });
      }
      var GL_FLOAT$6 = 5126;
      var GL_ARRAY_BUFFER$1 = 34962;
      var GL_ELEMENT_ARRAY_BUFFER$1 = 34963;
      var VAO_OPTIONS = [
        "attributes",
        "elements",
        "offset",
        "count",
        "primitive",
        "instances"
      ];
      function AttributeRecord() {
        this.state = 0;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.w = 0;
        this.buffer = null;
        this.size = 0;
        this.normalized = false;
        this.type = GL_FLOAT$6;
        this.offset = 0;
        this.stride = 0;
        this.divisor = 0;
      }
      function wrapAttributeState(gl, extensions, limits, stats2, bufferState, elementState, drawState) {
        var NUM_ATTRIBUTES = limits.maxAttributes;
        var attributeBindings = new Array(NUM_ATTRIBUTES);
        for (var i = 0; i < NUM_ATTRIBUTES; ++i) {
          attributeBindings[i] = new AttributeRecord();
        }
        var vaoCount = 0;
        var vaoSet = {};
        var state = {
          Record: AttributeRecord,
          scope: {},
          state: attributeBindings,
          currentVAO: null,
          targetVAO: null,
          restore: extVAO() ? restoreVAO : function() {
          },
          createVAO,
          getVAO,
          destroyBuffer,
          setVAO: extVAO() ? setVAOEXT : setVAOEmulated,
          clear: extVAO() ? destroyVAOEXT : function() {
          }
        };
        function destroyBuffer(buffer) {
          for (var i2 = 0; i2 < attributeBindings.length; ++i2) {
            var record = attributeBindings[i2];
            if (record.buffer === buffer) {
              gl.disableVertexAttribArray(i2);
              record.buffer = null;
            }
          }
        }
        function extVAO() {
          return extensions.oes_vertex_array_object;
        }
        function extInstanced() {
          return extensions.angle_instanced_arrays;
        }
        function getVAO(vao) {
          if (typeof vao === "function" && vao._vao) {
            return vao._vao;
          }
          return null;
        }
        function setVAOEXT(vao) {
          if (vao === state.currentVAO) {
            return;
          }
          var ext = extVAO();
          if (vao) {
            ext.bindVertexArrayOES(vao.vao);
          } else {
            ext.bindVertexArrayOES(null);
          }
          state.currentVAO = vao;
        }
        function setVAOEmulated(vao) {
          if (vao === state.currentVAO) {
            return;
          }
          if (vao) {
            vao.bindAttrs();
          } else {
            var exti = extInstanced();
            for (var i2 = 0; i2 < attributeBindings.length; ++i2) {
              var binding = attributeBindings[i2];
              if (binding.buffer) {
                gl.enableVertexAttribArray(i2);
                binding.buffer.bind();
                gl.vertexAttribPointer(i2, binding.size, binding.type, binding.normalized, binding.stride, binding.offfset);
                if (exti && binding.divisor) {
                  exti.vertexAttribDivisorANGLE(i2, binding.divisor);
                }
              } else {
                gl.disableVertexAttribArray(i2);
                gl.vertexAttrib4f(i2, binding.x, binding.y, binding.z, binding.w);
              }
            }
            if (drawState.elements) {
              gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER$1, drawState.elements.buffer.buffer);
            } else {
              gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER$1, null);
            }
          }
          state.currentVAO = vao;
        }
        function destroyVAOEXT() {
          values(vaoSet).forEach(function(vao) {
            vao.destroy();
          });
        }
        function REGLVAO() {
          this.id = ++vaoCount;
          this.attributes = [];
          this.elements = null;
          this.ownsElements = false;
          this.count = 0;
          this.offset = 0;
          this.instances = -1;
          this.primitive = 4;
          var extension = extVAO();
          if (extension) {
            this.vao = extension.createVertexArrayOES();
          } else {
            this.vao = null;
          }
          vaoSet[this.id] = this;
          this.buffers = [];
        }
        REGLVAO.prototype.bindAttrs = function() {
          var exti = extInstanced();
          var attributes = this.attributes;
          for (var i2 = 0; i2 < attributes.length; ++i2) {
            var attr = attributes[i2];
            if (attr.buffer) {
              gl.enableVertexAttribArray(i2);
              gl.bindBuffer(GL_ARRAY_BUFFER$1, attr.buffer.buffer);
              gl.vertexAttribPointer(i2, attr.size, attr.type, attr.normalized, attr.stride, attr.offset);
              if (exti && attr.divisor) {
                exti.vertexAttribDivisorANGLE(i2, attr.divisor);
              }
            } else {
              gl.disableVertexAttribArray(i2);
              gl.vertexAttrib4f(i2, attr.x, attr.y, attr.z, attr.w);
            }
          }
          for (var j = attributes.length; j < NUM_ATTRIBUTES; ++j) {
            gl.disableVertexAttribArray(j);
          }
          var elements = elementState.getElements(this.elements);
          if (elements) {
            gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER$1, elements.buffer.buffer);
          } else {
            gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER$1, null);
          }
        };
        REGLVAO.prototype.refresh = function() {
          var ext = extVAO();
          if (ext) {
            ext.bindVertexArrayOES(this.vao);
            this.bindAttrs();
            state.currentVAO = null;
            ext.bindVertexArrayOES(null);
          }
        };
        REGLVAO.prototype.destroy = function() {
          if (this.vao) {
            var extension = extVAO();
            if (this === state.currentVAO) {
              state.currentVAO = null;
              extension.bindVertexArrayOES(null);
            }
            extension.deleteVertexArrayOES(this.vao);
            this.vao = null;
          }
          if (this.ownsElements) {
            this.elements.destroy();
            this.elements = null;
            this.ownsElements = false;
          }
          if (vaoSet[this.id]) {
            delete vaoSet[this.id];
            stats2.vaoCount -= 1;
          }
        };
        function restoreVAO() {
          var ext = extVAO();
          if (ext) {
            values(vaoSet).forEach(function(vao) {
              vao.refresh();
            });
          }
        }
        function createVAO(_attr) {
          var vao = new REGLVAO();
          stats2.vaoCount += 1;
          function updateVAO(options) {
            var attributes;
            if (Array.isArray(options)) {
              attributes = options;
              if (vao.elements && vao.ownsElements) {
                vao.elements.destroy();
              }
              vao.elements = null;
              vao.ownsElements = false;
              vao.offset = 0;
              vao.count = 0;
              vao.instances = -1;
              vao.primitive = 4;
            } else {
              check$1(typeof options === "object", "invalid arguments for create vao");
              check$1("attributes" in options, "must specify attributes for vao");
              if (options.elements) {
                var elements = options.elements;
                if (vao.ownsElements) {
                  if (typeof elements === "function" && elements._reglType === "elements") {
                    vao.elements.destroy();
                    vao.ownsElements = false;
                  } else {
                    vao.elements(elements);
                    vao.ownsElements = false;
                  }
                } else if (elementState.getElements(options.elements)) {
                  vao.elements = options.elements;
                  vao.ownsElements = false;
                } else {
                  vao.elements = elementState.create(options.elements);
                  vao.ownsElements = true;
                }
              } else {
                vao.elements = null;
                vao.ownsElements = false;
              }
              attributes = options.attributes;
              vao.offset = 0;
              vao.count = -1;
              vao.instances = -1;
              vao.primitive = 4;
              if (vao.elements) {
                vao.count = vao.elements._elements.vertCount;
                vao.primitive = vao.elements._elements.primType;
              }
              if ("offset" in options) {
                vao.offset = options.offset | 0;
              }
              if ("count" in options) {
                vao.count = options.count | 0;
              }
              if ("instances" in options) {
                vao.instances = options.instances | 0;
              }
              if ("primitive" in options) {
                check$1(options.primitive in primTypes, "bad primitive type: " + options.primitive);
                vao.primitive = primTypes[options.primitive];
              }
              check$1.optional(() => {
                var keys = Object.keys(options);
                for (var i3 = 0; i3 < keys.length; ++i3) {
                  check$1(VAO_OPTIONS.indexOf(keys[i3]) >= 0, 'invalid option for vao: "' + keys[i3] + '" valid options are ' + VAO_OPTIONS);
                }
              });
              check$1(Array.isArray(attributes), "attributes must be an array");
            }
            check$1(attributes.length < NUM_ATTRIBUTES, "too many attributes");
            check$1(attributes.length > 0, "must specify at least one attribute");
            var bufUpdated = {};
            var nattributes = vao.attributes;
            nattributes.length = attributes.length;
            for (var i2 = 0; i2 < attributes.length; ++i2) {
              var spec = attributes[i2];
              var rec = nattributes[i2] = new AttributeRecord();
              var data2 = spec.data || spec;
              if (Array.isArray(data2) || isTypedArray(data2) || isNDArrayLike(data2)) {
                var buf;
                if (vao.buffers[i2]) {
                  buf = vao.buffers[i2];
                  if (isTypedArray(data2) && buf._buffer.byteLength >= data2.byteLength) {
                    buf.subdata(data2);
                  } else {
                    buf.destroy();
                    vao.buffers[i2] = null;
                  }
                }
                if (!vao.buffers[i2]) {
                  buf = vao.buffers[i2] = bufferState.create(spec, GL_ARRAY_BUFFER$1, false, true);
                }
                rec.buffer = bufferState.getBuffer(buf);
                rec.size = rec.buffer.dimension | 0;
                rec.normalized = false;
                rec.type = rec.buffer.dtype;
                rec.offset = 0;
                rec.stride = 0;
                rec.divisor = 0;
                rec.state = 1;
                bufUpdated[i2] = 1;
              } else if (bufferState.getBuffer(spec)) {
                rec.buffer = bufferState.getBuffer(spec);
                rec.size = rec.buffer.dimension | 0;
                rec.normalized = false;
                rec.type = rec.buffer.dtype;
                rec.offset = 0;
                rec.stride = 0;
                rec.divisor = 0;
                rec.state = 1;
              } else if (bufferState.getBuffer(spec.buffer)) {
                rec.buffer = bufferState.getBuffer(spec.buffer);
                rec.size = (+spec.size || rec.buffer.dimension) | 0;
                rec.normalized = !!spec.normalized || false;
                if ("type" in spec) {
                  check$1.parameter(spec.type, glTypes, "invalid buffer type");
                  rec.type = glTypes[spec.type];
                } else {
                  rec.type = rec.buffer.dtype;
                }
                rec.offset = (spec.offset || 0) | 0;
                rec.stride = (spec.stride || 0) | 0;
                rec.divisor = (spec.divisor || 0) | 0;
                rec.state = 1;
                check$1(rec.size >= 1 && rec.size <= 4, "size must be between 1 and 4");
                check$1(rec.offset >= 0, "invalid offset");
                check$1(rec.stride >= 0 && rec.stride <= 255, "stride must be between 0 and 255");
                check$1(rec.divisor >= 0, "divisor must be positive");
                check$1(!rec.divisor || !!extensions.angle_instanced_arrays, "ANGLE_instanced_arrays must be enabled to use divisor");
              } else if ("x" in spec) {
                check$1(i2 > 0, "first attribute must not be a constant");
                rec.x = +spec.x || 0;
                rec.y = +spec.y || 0;
                rec.z = +spec.z || 0;
                rec.w = +spec.w || 0;
                rec.state = 2;
              } else {
                check$1(false, "invalid attribute spec for location " + i2);
              }
            }
            for (var j = 0; j < vao.buffers.length; ++j) {
              if (!bufUpdated[j] && vao.buffers[j]) {
                vao.buffers[j].destroy();
                vao.buffers[j] = null;
              }
            }
            vao.refresh();
            return updateVAO;
          }
          updateVAO.destroy = function() {
            for (var j = 0; j < vao.buffers.length; ++j) {
              if (vao.buffers[j]) {
                vao.buffers[j].destroy();
              }
            }
            vao.buffers.length = 0;
            if (vao.ownsElements) {
              vao.elements.destroy();
              vao.elements = null;
              vao.ownsElements = false;
            }
            vao.destroy();
          };
          updateVAO._vao = vao;
          updateVAO._reglType = "vao";
          return updateVAO(_attr);
        }
        return state;
      }
      var GL_FRAGMENT_SHADER = 35632;
      var GL_VERTEX_SHADER = 35633;
      var GL_ACTIVE_UNIFORMS = 35718;
      var GL_ACTIVE_ATTRIBUTES = 35721;
      function wrapShaderState(gl, stringStore, stats2, config) {
        var fragShaders = {};
        var vertShaders = {};
        function ActiveInfo(name, id2, location, info) {
          this.name = name;
          this.id = id2;
          this.location = location;
          this.info = info;
        }
        function insertActiveInfo(list, info) {
          for (var i = 0; i < list.length; ++i) {
            if (list[i].id === info.id) {
              list[i].location = info.location;
              return;
            }
          }
          list.push(info);
        }
        function getShader(type, id2, command) {
          var cache = type === GL_FRAGMENT_SHADER ? fragShaders : vertShaders;
          var shader = cache[id2];
          if (!shader) {
            var source = stringStore.str(id2);
            shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            check$1.shaderError(gl, shader, source, type, command);
            cache[id2] = shader;
          }
          return shader;
        }
        var programCache = {};
        var programList = [];
        var PROGRAM_COUNTER = 0;
        function REGLProgram(fragId, vertId) {
          this.id = PROGRAM_COUNTER++;
          this.fragId = fragId;
          this.vertId = vertId;
          this.program = null;
          this.uniforms = [];
          this.attributes = [];
          this.refCount = 1;
          if (config.profile) {
            this.stats = {
              uniformsCount: 0,
              attributesCount: 0
            };
          }
        }
        function linkProgram(desc, command, attributeLocations) {
          var i, info;
          var fragShader = getShader(GL_FRAGMENT_SHADER, desc.fragId);
          var vertShader = getShader(GL_VERTEX_SHADER, desc.vertId);
          var program = desc.program = gl.createProgram();
          gl.attachShader(program, fragShader);
          gl.attachShader(program, vertShader);
          if (attributeLocations) {
            for (i = 0; i < attributeLocations.length; ++i) {
              var binding = attributeLocations[i];
              gl.bindAttribLocation(program, binding[0], binding[1]);
            }
          }
          gl.linkProgram(program);
          check$1.linkError(
            gl,
            program,
            stringStore.str(desc.fragId),
            stringStore.str(desc.vertId),
            command
          );
          var numUniforms = gl.getProgramParameter(program, GL_ACTIVE_UNIFORMS);
          if (config.profile) {
            desc.stats.uniformsCount = numUniforms;
          }
          var uniforms = desc.uniforms;
          for (i = 0; i < numUniforms; ++i) {
            info = gl.getActiveUniform(program, i);
            if (info) {
              if (info.size > 1) {
                for (var j = 0; j < info.size; ++j) {
                  var name = info.name.replace("[0]", "[" + j + "]");
                  insertActiveInfo(uniforms, new ActiveInfo(
                    name,
                    stringStore.id(name),
                    gl.getUniformLocation(program, name),
                    info
                  ));
                }
              } else {
                insertActiveInfo(uniforms, new ActiveInfo(
                  info.name,
                  stringStore.id(info.name),
                  gl.getUniformLocation(program, info.name),
                  info
                ));
              }
            }
          }
          var numAttributes = gl.getProgramParameter(program, GL_ACTIVE_ATTRIBUTES);
          if (config.profile) {
            desc.stats.attributesCount = numAttributes;
          }
          var attributes = desc.attributes;
          for (i = 0; i < numAttributes; ++i) {
            info = gl.getActiveAttrib(program, i);
            if (info) {
              insertActiveInfo(attributes, new ActiveInfo(
                info.name,
                stringStore.id(info.name),
                gl.getAttribLocation(program, info.name),
                info
              ));
            }
          }
        }
        if (config.profile) {
          stats2.getMaxUniformsCount = function() {
            var m = 0;
            programList.forEach(function(desc) {
              if (desc.stats.uniformsCount > m) {
                m = desc.stats.uniformsCount;
              }
            });
            return m;
          };
          stats2.getMaxAttributesCount = function() {
            var m = 0;
            programList.forEach(function(desc) {
              if (desc.stats.attributesCount > m) {
                m = desc.stats.attributesCount;
              }
            });
            return m;
          };
        }
        function restoreShaders() {
          fragShaders = {};
          vertShaders = {};
          for (var i = 0; i < programList.length; ++i) {
            linkProgram(programList[i], null, programList[i].attributes.map(function(info) {
              return [info.location, info.name];
            }));
          }
        }
        return {
          clear: function() {
            var deleteShader = gl.deleteShader.bind(gl);
            values(fragShaders).forEach(deleteShader);
            fragShaders = {};
            values(vertShaders).forEach(deleteShader);
            vertShaders = {};
            programList.forEach(function(desc) {
              gl.deleteProgram(desc.program);
            });
            programList.length = 0;
            programCache = {};
            stats2.shaderCount = 0;
          },
          program: function(vertId, fragId, command, attribLocations) {
            check$1.command(vertId >= 0, "missing vertex shader", command);
            check$1.command(fragId >= 0, "missing fragment shader", command);
            var cache = programCache[fragId];
            if (!cache) {
              cache = programCache[fragId] = {};
            }
            var prevProgram = cache[vertId];
            if (prevProgram) {
              prevProgram.refCount++;
              if (!attribLocations) {
                return prevProgram;
              }
            }
            var program = new REGLProgram(fragId, vertId);
            stats2.shaderCount++;
            linkProgram(program, command, attribLocations);
            if (!prevProgram) {
              cache[vertId] = program;
            }
            programList.push(program);
            return extend2(program, {
              destroy: function() {
                program.refCount--;
                if (program.refCount <= 0) {
                  gl.deleteProgram(program.program);
                  var idx = programList.indexOf(program);
                  programList.splice(idx, 1);
                  stats2.shaderCount--;
                }
                if (cache[program.vertId].refCount <= 0) {
                  gl.deleteShader(vertShaders[program.vertId]);
                  delete vertShaders[program.vertId];
                  delete programCache[program.fragId][program.vertId];
                }
                if (!Object.keys(programCache[program.fragId]).length) {
                  gl.deleteShader(fragShaders[program.fragId]);
                  delete fragShaders[program.fragId];
                  delete programCache[program.fragId];
                }
              }
            });
          },
          restore: restoreShaders,
          shader: getShader,
          frag: -1,
          vert: -1
        };
      }
      var GL_RGBA$3 = 6408;
      var GL_UNSIGNED_BYTE$7 = 5121;
      var GL_PACK_ALIGNMENT = 3333;
      var GL_FLOAT$7 = 5126;
      function wrapReadPixels(gl, framebufferState, reglPoll, context, glAttributes, extensions, limits) {
        function readPixelsImpl(input) {
          var type;
          if (framebufferState.next === null) {
            check$1(
              glAttributes.preserveDrawingBuffer,
              'you must create a webgl context with "preserveDrawingBuffer":true in order to read pixels from the drawing buffer'
            );
            type = GL_UNSIGNED_BYTE$7;
          } else {
            check$1(
              framebufferState.next.colorAttachments[0].texture !== null,
              "You cannot read from a renderbuffer"
            );
            type = framebufferState.next.colorAttachments[0].texture._texture.type;
            check$1.optional(function() {
              if (extensions.oes_texture_float) {
                check$1(
                  type === GL_UNSIGNED_BYTE$7 || type === GL_FLOAT$7,
                  "Reading from a framebuffer is only allowed for the types 'uint8' and 'float'"
                );
                if (type === GL_FLOAT$7) {
                  check$1(limits.readFloat, "Reading 'float' values is not permitted in your browser. For a fallback, please see: https://www.npmjs.com/package/glsl-read-float");
                }
              } else {
                check$1(
                  type === GL_UNSIGNED_BYTE$7,
                  "Reading from a framebuffer is only allowed for the type 'uint8'"
                );
              }
            });
          }
          var x2 = 0;
          var y = 0;
          var width = context.framebufferWidth;
          var height = context.framebufferHeight;
          var data2 = null;
          if (isTypedArray(input)) {
            data2 = input;
          } else if (input) {
            check$1.type(input, "object", "invalid arguments to regl.read()");
            x2 = input.x | 0;
            y = input.y | 0;
            check$1(
              x2 >= 0 && x2 < context.framebufferWidth,
              "invalid x offset for regl.read"
            );
            check$1(
              y >= 0 && y < context.framebufferHeight,
              "invalid y offset for regl.read"
            );
            width = (input.width || context.framebufferWidth - x2) | 0;
            height = (input.height || context.framebufferHeight - y) | 0;
            data2 = input.data || null;
          }
          if (data2) {
            if (type === GL_UNSIGNED_BYTE$7) {
              check$1(
                data2 instanceof Uint8Array,
                "buffer must be 'Uint8Array' when reading from a framebuffer of type 'uint8'"
              );
            } else if (type === GL_FLOAT$7) {
              check$1(
                data2 instanceof Float32Array,
                "buffer must be 'Float32Array' when reading from a framebuffer of type 'float'"
              );
            }
          }
          check$1(
            width > 0 && width + x2 <= context.framebufferWidth,
            "invalid width for read pixels"
          );
          check$1(
            height > 0 && height + y <= context.framebufferHeight,
            "invalid height for read pixels"
          );
          reglPoll();
          var size = width * height * 4;
          if (!data2) {
            if (type === GL_UNSIGNED_BYTE$7) {
              data2 = new Uint8Array(size);
            } else if (type === GL_FLOAT$7) {
              data2 = data2 || new Float32Array(size);
            }
          }
          check$1.isTypedArray(data2, "data buffer for regl.read() must be a typedarray");
          check$1(data2.byteLength >= size, "data buffer for regl.read() too small");
          gl.pixelStorei(GL_PACK_ALIGNMENT, 4);
          gl.readPixels(
            x2,
            y,
            width,
            height,
            GL_RGBA$3,
            type,
            data2
          );
          return data2;
        }
        function readPixelsFBO(options) {
          var result;
          framebufferState.setFBO({
            framebuffer: options.framebuffer
          }, function() {
            result = readPixelsImpl(options);
          });
          return result;
        }
        function readPixels(options) {
          if (!options || !("framebuffer" in options)) {
            return readPixelsImpl(options);
          } else {
            return readPixelsFBO(options);
          }
        }
        return readPixels;
      }
      function slice(x2) {
        return Array.prototype.slice.call(x2);
      }
      function join(x2) {
        return slice(x2).join("");
      }
      function createEnvironment() {
        var varCounter = 0;
        var linkedNames = [];
        var linkedValues = [];
        function link(value) {
          for (var i = 0; i < linkedValues.length; ++i) {
            if (linkedValues[i] === value) {
              return linkedNames[i];
            }
          }
          var name = "g" + varCounter++;
          linkedNames.push(name);
          linkedValues.push(value);
          return name;
        }
        function block() {
          var code = [];
          function push() {
            code.push.apply(code, slice(arguments));
          }
          var vars = [];
          function def() {
            var name = "v" + varCounter++;
            vars.push(name);
            if (arguments.length > 0) {
              code.push(name, "=");
              code.push.apply(code, slice(arguments));
              code.push(";");
            }
            return name;
          }
          return extend2(push, {
            def,
            toString: function() {
              return join([
                vars.length > 0 ? "var " + vars.join(",") + ";" : "",
                join(code)
              ]);
            }
          });
        }
        function scope() {
          var entry = block();
          var exit = block();
          var entryToString = entry.toString;
          var exitToString = exit.toString;
          function save(object, prop) {
            exit(object, prop, "=", entry.def(object, prop), ";");
          }
          return extend2(function() {
            entry.apply(entry, slice(arguments));
          }, {
            def: entry.def,
            entry,
            exit,
            save,
            set: function(object, prop, value) {
              save(object, prop);
              entry(object, prop, "=", value, ";");
            },
            toString: function() {
              return entryToString() + exitToString();
            }
          });
        }
        function conditional() {
          var pred = join(arguments);
          var thenBlock = scope();
          var elseBlock = scope();
          var thenToString = thenBlock.toString;
          var elseToString = elseBlock.toString;
          return extend2(thenBlock, {
            then: function() {
              thenBlock.apply(thenBlock, slice(arguments));
              return this;
            },
            else: function() {
              elseBlock.apply(elseBlock, slice(arguments));
              return this;
            },
            toString: function() {
              var elseClause = elseToString();
              if (elseClause) {
                elseClause = "else{" + elseClause + "}";
              }
              return join([
                "if(",
                pred,
                "){",
                thenToString(),
                "}",
                elseClause
              ]);
            }
          });
        }
        var globalBlock = block();
        var procedures = {};
        function proc(name, count) {
          var args = [];
          function arg() {
            var name2 = "a" + args.length;
            args.push(name2);
            return name2;
          }
          count = count || 0;
          for (var i = 0; i < count; ++i) {
            arg();
          }
          var body = scope();
          var bodyToString = body.toString;
          var result = procedures[name] = extend2(body, {
            arg,
            toString: function() {
              return join([
                "function(",
                args.join(),
                "){",
                bodyToString(),
                "}"
              ]);
            }
          });
          return result;
        }
        function compile() {
          var code = [
            '"use strict";',
            globalBlock,
            "return {"
          ];
          Object.keys(procedures).forEach(function(name) {
            code.push('"', name, '":', procedures[name].toString(), ",");
          });
          code.push("}");
          var src = join(code).replace(/;/g, ";\n").replace(/}/g, "}\n").replace(/{/g, "{\n");
          var proc2 = Function.apply(null, linkedNames.concat(src));
          return proc2.apply(null, linkedValues);
        }
        return {
          global: globalBlock,
          link,
          block,
          proc,
          scope,
          cond: conditional,
          compile
        };
      }
      var CUTE_COMPONENTS = "xyzw".split("");
      var GL_UNSIGNED_BYTE$8 = 5121;
      var ATTRIB_STATE_POINTER = 1;
      var ATTRIB_STATE_CONSTANT = 2;
      var DYN_FUNC$1 = 0;
      var DYN_PROP$1 = 1;
      var DYN_CONTEXT$1 = 2;
      var DYN_STATE$1 = 3;
      var DYN_THUNK = 4;
      var DYN_CONSTANT$1 = 5;
      var DYN_ARRAY$1 = 6;
      var S_DITHER = "dither";
      var S_BLEND_ENABLE = "blend.enable";
      var S_BLEND_COLOR = "blend.color";
      var S_BLEND_EQUATION = "blend.equation";
      var S_BLEND_FUNC = "blend.func";
      var S_DEPTH_ENABLE = "depth.enable";
      var S_DEPTH_FUNC = "depth.func";
      var S_DEPTH_RANGE = "depth.range";
      var S_DEPTH_MASK = "depth.mask";
      var S_COLOR_MASK = "colorMask";
      var S_CULL_ENABLE = "cull.enable";
      var S_CULL_FACE = "cull.face";
      var S_FRONT_FACE = "frontFace";
      var S_LINE_WIDTH = "lineWidth";
      var S_POLYGON_OFFSET_ENABLE = "polygonOffset.enable";
      var S_POLYGON_OFFSET_OFFSET = "polygonOffset.offset";
      var S_SAMPLE_ALPHA = "sample.alpha";
      var S_SAMPLE_ENABLE = "sample.enable";
      var S_SAMPLE_COVERAGE = "sample.coverage";
      var S_STENCIL_ENABLE = "stencil.enable";
      var S_STENCIL_MASK = "stencil.mask";
      var S_STENCIL_FUNC = "stencil.func";
      var S_STENCIL_OPFRONT = "stencil.opFront";
      var S_STENCIL_OPBACK = "stencil.opBack";
      var S_SCISSOR_ENABLE = "scissor.enable";
      var S_SCISSOR_BOX = "scissor.box";
      var S_VIEWPORT = "viewport";
      var S_PROFILE = "profile";
      var S_FRAMEBUFFER = "framebuffer";
      var S_VERT = "vert";
      var S_FRAG = "frag";
      var S_ELEMENTS = "elements";
      var S_PRIMITIVE = "primitive";
      var S_COUNT = "count";
      var S_OFFSET = "offset";
      var S_INSTANCES = "instances";
      var S_VAO = "vao";
      var SUFFIX_WIDTH = "Width";
      var SUFFIX_HEIGHT = "Height";
      var S_FRAMEBUFFER_WIDTH = S_FRAMEBUFFER + SUFFIX_WIDTH;
      var S_FRAMEBUFFER_HEIGHT = S_FRAMEBUFFER + SUFFIX_HEIGHT;
      var S_VIEWPORT_WIDTH = S_VIEWPORT + SUFFIX_WIDTH;
      var S_VIEWPORT_HEIGHT = S_VIEWPORT + SUFFIX_HEIGHT;
      var S_DRAWINGBUFFER = "drawingBuffer";
      var S_DRAWINGBUFFER_WIDTH = S_DRAWINGBUFFER + SUFFIX_WIDTH;
      var S_DRAWINGBUFFER_HEIGHT = S_DRAWINGBUFFER + SUFFIX_HEIGHT;
      var NESTED_OPTIONS = [
        S_BLEND_FUNC,
        S_BLEND_EQUATION,
        S_STENCIL_FUNC,
        S_STENCIL_OPFRONT,
        S_STENCIL_OPBACK,
        S_SAMPLE_COVERAGE,
        S_VIEWPORT,
        S_SCISSOR_BOX,
        S_POLYGON_OFFSET_OFFSET
      ];
      var GL_ARRAY_BUFFER$2 = 34962;
      var GL_ELEMENT_ARRAY_BUFFER$2 = 34963;
      var GL_FRAGMENT_SHADER$1 = 35632;
      var GL_VERTEX_SHADER$1 = 35633;
      var GL_TEXTURE_2D$3 = 3553;
      var GL_TEXTURE_CUBE_MAP$2 = 34067;
      var GL_CULL_FACE = 2884;
      var GL_BLEND = 3042;
      var GL_DITHER = 3024;
      var GL_STENCIL_TEST = 2960;
      var GL_DEPTH_TEST = 2929;
      var GL_SCISSOR_TEST = 3089;
      var GL_POLYGON_OFFSET_FILL = 32823;
      var GL_SAMPLE_ALPHA_TO_COVERAGE = 32926;
      var GL_SAMPLE_COVERAGE = 32928;
      var GL_FLOAT$8 = 5126;
      var GL_FLOAT_VEC2 = 35664;
      var GL_FLOAT_VEC3 = 35665;
      var GL_FLOAT_VEC4 = 35666;
      var GL_INT$3 = 5124;
      var GL_INT_VEC2 = 35667;
      var GL_INT_VEC3 = 35668;
      var GL_INT_VEC4 = 35669;
      var GL_BOOL = 35670;
      var GL_BOOL_VEC2 = 35671;
      var GL_BOOL_VEC3 = 35672;
      var GL_BOOL_VEC4 = 35673;
      var GL_FLOAT_MAT2 = 35674;
      var GL_FLOAT_MAT3 = 35675;
      var GL_FLOAT_MAT4 = 35676;
      var GL_SAMPLER_2D = 35678;
      var GL_SAMPLER_CUBE = 35680;
      var GL_TRIANGLES$1 = 4;
      var GL_FRONT = 1028;
      var GL_BACK = 1029;
      var GL_CW = 2304;
      var GL_CCW = 2305;
      var GL_MIN_EXT = 32775;
      var GL_MAX_EXT = 32776;
      var GL_ALWAYS = 519;
      var GL_KEEP = 7680;
      var GL_ZERO = 0;
      var GL_ONE = 1;
      var GL_FUNC_ADD = 32774;
      var GL_LESS = 513;
      var GL_FRAMEBUFFER$2 = 36160;
      var GL_COLOR_ATTACHMENT0$2 = 36064;
      var blendFuncs = {
        "0": 0,
        "1": 1,
        "zero": 0,
        "one": 1,
        "src color": 768,
        "one minus src color": 769,
        "src alpha": 770,
        "one minus src alpha": 771,
        "dst color": 774,
        "one minus dst color": 775,
        "dst alpha": 772,
        "one minus dst alpha": 773,
        "constant color": 32769,
        "one minus constant color": 32770,
        "constant alpha": 32771,
        "one minus constant alpha": 32772,
        "src alpha saturate": 776
      };
      var invalidBlendCombinations = [
        "constant color, constant alpha",
        "one minus constant color, constant alpha",
        "constant color, one minus constant alpha",
        "one minus constant color, one minus constant alpha",
        "constant alpha, constant color",
        "constant alpha, one minus constant color",
        "one minus constant alpha, constant color",
        "one minus constant alpha, one minus constant color"
      ];
      var compareFuncs = {
        "never": 512,
        "less": 513,
        "<": 513,
        "equal": 514,
        "=": 514,
        "==": 514,
        "===": 514,
        "lequal": 515,
        "<=": 515,
        "greater": 516,
        ">": 516,
        "notequal": 517,
        "!=": 517,
        "!==": 517,
        "gequal": 518,
        ">=": 518,
        "always": 519
      };
      var stencilOps = {
        "0": 0,
        "zero": 0,
        "keep": 7680,
        "replace": 7681,
        "increment": 7682,
        "decrement": 7683,
        "increment wrap": 34055,
        "decrement wrap": 34056,
        "invert": 5386
      };
      var shaderType = {
        "frag": GL_FRAGMENT_SHADER$1,
        "vert": GL_VERTEX_SHADER$1
      };
      var orientationType = {
        "cw": GL_CW,
        "ccw": GL_CCW
      };
      function isBufferArgs(x2) {
        return Array.isArray(x2) || isTypedArray(x2) || isNDArrayLike(x2);
      }
      function sortState(state) {
        return state.sort(function(a2, b) {
          if (a2 === S_VIEWPORT) {
            return -1;
          } else if (b === S_VIEWPORT) {
            return 1;
          }
          return a2 < b ? -1 : 1;
        });
      }
      function Declaration(thisDep, contextDep, propDep, append) {
        this.thisDep = thisDep;
        this.contextDep = contextDep;
        this.propDep = propDep;
        this.append = append;
      }
      function isStatic(decl) {
        return decl && !(decl.thisDep || decl.contextDep || decl.propDep);
      }
      function createStaticDecl(append) {
        return new Declaration(false, false, false, append);
      }
      function createDynamicDecl(dyn, append) {
        var type = dyn.type;
        if (type === DYN_FUNC$1) {
          var numArgs = dyn.data.length;
          return new Declaration(
            true,
            numArgs >= 1,
            numArgs >= 2,
            append
          );
        } else if (type === DYN_THUNK) {
          var data2 = dyn.data;
          return new Declaration(
            data2.thisDep,
            data2.contextDep,
            data2.propDep,
            append
          );
        } else if (type === DYN_CONSTANT$1) {
          return new Declaration(
            false,
            false,
            false,
            append
          );
        } else if (type === DYN_ARRAY$1) {
          var thisDep = false;
          var contextDep = false;
          var propDep = false;
          for (var i = 0; i < dyn.data.length; ++i) {
            var subDyn = dyn.data[i];
            if (subDyn.type === DYN_PROP$1) {
              propDep = true;
            } else if (subDyn.type === DYN_CONTEXT$1) {
              contextDep = true;
            } else if (subDyn.type === DYN_STATE$1) {
              thisDep = true;
            } else if (subDyn.type === DYN_FUNC$1) {
              thisDep = true;
              var subArgs = subDyn.data;
              if (subArgs >= 1) {
                contextDep = true;
              }
              if (subArgs >= 2) {
                propDep = true;
              }
            } else if (subDyn.type === DYN_THUNK) {
              thisDep = thisDep || subDyn.data.thisDep;
              contextDep = contextDep || subDyn.data.contextDep;
              propDep = propDep || subDyn.data.propDep;
            }
          }
          return new Declaration(
            thisDep,
            contextDep,
            propDep,
            append
          );
        } else {
          return new Declaration(
            type === DYN_STATE$1,
            type === DYN_CONTEXT$1,
            type === DYN_PROP$1,
            append
          );
        }
      }
      var SCOPE_DECL = new Declaration(false, false, false, function() {
      });
      function reglCore(gl, stringStore, extensions, limits, bufferState, elementState, textureState, framebufferState, uniformState, attributeState, shaderState, drawState, contextState, timer, config) {
        var AttributeRecord2 = attributeState.Record;
        var blendEquations = {
          "add": 32774,
          "subtract": 32778,
          "reverse subtract": 32779
        };
        if (extensions.ext_blend_minmax) {
          blendEquations.min = GL_MIN_EXT;
          blendEquations.max = GL_MAX_EXT;
        }
        var extInstancing = extensions.angle_instanced_arrays;
        var extDrawBuffers = extensions.webgl_draw_buffers;
        var extVertexArrays = extensions.oes_vertex_array_object;
        var currentState = {
          dirty: true,
          profile: config.profile
        };
        var nextState = {};
        var GL_STATE_NAMES = [];
        var GL_FLAGS = {};
        var GL_VARIABLES = {};
        function propName(name) {
          return name.replace(".", "_");
        }
        function stateFlag(sname, cap, init) {
          var name = propName(sname);
          GL_STATE_NAMES.push(sname);
          nextState[name] = currentState[name] = !!init;
          GL_FLAGS[name] = cap;
        }
        function stateVariable(sname, func, init) {
          var name = propName(sname);
          GL_STATE_NAMES.push(sname);
          if (Array.isArray(init)) {
            currentState[name] = init.slice();
            nextState[name] = init.slice();
          } else {
            currentState[name] = nextState[name] = init;
          }
          GL_VARIABLES[name] = func;
        }
        stateFlag(S_DITHER, GL_DITHER);
        stateFlag(S_BLEND_ENABLE, GL_BLEND);
        stateVariable(S_BLEND_COLOR, "blendColor", [0, 0, 0, 0]);
        stateVariable(
          S_BLEND_EQUATION,
          "blendEquationSeparate",
          [GL_FUNC_ADD, GL_FUNC_ADD]
        );
        stateVariable(
          S_BLEND_FUNC,
          "blendFuncSeparate",
          [GL_ONE, GL_ZERO, GL_ONE, GL_ZERO]
        );
        stateFlag(S_DEPTH_ENABLE, GL_DEPTH_TEST, true);
        stateVariable(S_DEPTH_FUNC, "depthFunc", GL_LESS);
        stateVariable(S_DEPTH_RANGE, "depthRange", [0, 1]);
        stateVariable(S_DEPTH_MASK, "depthMask", true);
        stateVariable(S_COLOR_MASK, S_COLOR_MASK, [true, true, true, true]);
        stateFlag(S_CULL_ENABLE, GL_CULL_FACE);
        stateVariable(S_CULL_FACE, "cullFace", GL_BACK);
        stateVariable(S_FRONT_FACE, S_FRONT_FACE, GL_CCW);
        stateVariable(S_LINE_WIDTH, S_LINE_WIDTH, 1);
        stateFlag(S_POLYGON_OFFSET_ENABLE, GL_POLYGON_OFFSET_FILL);
        stateVariable(S_POLYGON_OFFSET_OFFSET, "polygonOffset", [0, 0]);
        stateFlag(S_SAMPLE_ALPHA, GL_SAMPLE_ALPHA_TO_COVERAGE);
        stateFlag(S_SAMPLE_ENABLE, GL_SAMPLE_COVERAGE);
        stateVariable(S_SAMPLE_COVERAGE, "sampleCoverage", [1, false]);
        stateFlag(S_STENCIL_ENABLE, GL_STENCIL_TEST);
        stateVariable(S_STENCIL_MASK, "stencilMask", -1);
        stateVariable(S_STENCIL_FUNC, "stencilFunc", [GL_ALWAYS, 0, -1]);
        stateVariable(
          S_STENCIL_OPFRONT,
          "stencilOpSeparate",
          [GL_FRONT, GL_KEEP, GL_KEEP, GL_KEEP]
        );
        stateVariable(
          S_STENCIL_OPBACK,
          "stencilOpSeparate",
          [GL_BACK, GL_KEEP, GL_KEEP, GL_KEEP]
        );
        stateFlag(S_SCISSOR_ENABLE, GL_SCISSOR_TEST);
        stateVariable(
          S_SCISSOR_BOX,
          "scissor",
          [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]
        );
        stateVariable(
          S_VIEWPORT,
          S_VIEWPORT,
          [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]
        );
        var sharedState = {
          gl,
          context: contextState,
          strings: stringStore,
          next: nextState,
          current: currentState,
          draw: drawState,
          elements: elementState,
          buffer: bufferState,
          shader: shaderState,
          attributes: attributeState.state,
          vao: attributeState,
          uniforms: uniformState,
          framebuffer: framebufferState,
          extensions,
          timer,
          isBufferArgs
        };
        var sharedConstants = {
          primTypes,
          compareFuncs,
          blendFuncs,
          blendEquations,
          stencilOps,
          glTypes,
          orientationType
        };
        check$1.optional(function() {
          sharedState.isArrayLike = isArrayLike;
        });
        if (extDrawBuffers) {
          sharedConstants.backBuffer = [GL_BACK];
          sharedConstants.drawBuffer = loop2(limits.maxDrawbuffers, function(i) {
            if (i === 0) {
              return [0];
            }
            return loop2(i, function(j) {
              return GL_COLOR_ATTACHMENT0$2 + j;
            });
          });
        }
        var drawCallCounter = 0;
        function createREGLEnvironment() {
          var env = createEnvironment();
          var link = env.link;
          var global = env.global;
          env.id = drawCallCounter++;
          env.batchId = "0";
          var SHARED = link(sharedState);
          var shared = env.shared = {
            props: "a0"
          };
          Object.keys(sharedState).forEach(function(prop) {
            shared[prop] = global.def(SHARED, ".", prop);
          });
          check$1.optional(function() {
            env.CHECK = link(check$1);
            env.commandStr = check$1.guessCommand();
            env.command = link(env.commandStr);
            env.assert = function(block, pred, message) {
              block(
                "if(!(",
                pred,
                "))",
                this.CHECK,
                ".commandRaise(",
                link(message),
                ",",
                this.command,
                ");"
              );
            };
            sharedConstants.invalidBlendCombinations = invalidBlendCombinations;
          });
          var nextVars = env.next = {};
          var currentVars = env.current = {};
          Object.keys(GL_VARIABLES).forEach(function(variable) {
            if (Array.isArray(currentState[variable])) {
              nextVars[variable] = global.def(shared.next, ".", variable);
              currentVars[variable] = global.def(shared.current, ".", variable);
            }
          });
          var constants = env.constants = {};
          Object.keys(sharedConstants).forEach(function(name) {
            constants[name] = global.def(JSON.stringify(sharedConstants[name]));
          });
          env.invoke = function(block, x2) {
            switch (x2.type) {
              case DYN_FUNC$1:
                var argList = [
                  "this",
                  shared.context,
                  shared.props,
                  env.batchId
                ];
                return block.def(
                  link(x2.data),
                  ".call(",
                  argList.slice(0, Math.max(x2.data.length + 1, 4)),
                  ")"
                );
              case DYN_PROP$1:
                return block.def(shared.props, x2.data);
              case DYN_CONTEXT$1:
                return block.def(shared.context, x2.data);
              case DYN_STATE$1:
                return block.def("this", x2.data);
              case DYN_THUNK:
                x2.data.append(env, block);
                return x2.data.ref;
              case DYN_CONSTANT$1:
                return x2.data.toString();
              case DYN_ARRAY$1:
                return x2.data.map(function(y) {
                  return env.invoke(block, y);
                });
            }
          };
          env.attribCache = {};
          var scopeAttribs = {};
          env.scopeAttrib = function(name) {
            var id2 = stringStore.id(name);
            if (id2 in scopeAttribs) {
              return scopeAttribs[id2];
            }
            var binding = attributeState.scope[id2];
            if (!binding) {
              binding = attributeState.scope[id2] = new AttributeRecord2();
            }
            var result = scopeAttribs[id2] = link(binding);
            return result;
          };
          return env;
        }
        function parseProfile(options) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          var profileEnable;
          if (S_PROFILE in staticOptions) {
            var value = !!staticOptions[S_PROFILE];
            profileEnable = createStaticDecl(function(env, scope) {
              return value;
            });
            profileEnable.enable = value;
          } else if (S_PROFILE in dynamicOptions) {
            var dyn = dynamicOptions[S_PROFILE];
            profileEnable = createDynamicDecl(dyn, function(env, scope) {
              return env.invoke(scope, dyn);
            });
          }
          return profileEnable;
        }
        function parseFramebuffer(options, env) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          if (S_FRAMEBUFFER in staticOptions) {
            var framebuffer = staticOptions[S_FRAMEBUFFER];
            if (framebuffer) {
              framebuffer = framebufferState.getFramebuffer(framebuffer);
              check$1.command(framebuffer, "invalid framebuffer object");
              return createStaticDecl(function(env2, block) {
                var FRAMEBUFFER = env2.link(framebuffer);
                var shared = env2.shared;
                block.set(
                  shared.framebuffer,
                  ".next",
                  FRAMEBUFFER
                );
                var CONTEXT = shared.context;
                block.set(
                  CONTEXT,
                  "." + S_FRAMEBUFFER_WIDTH,
                  FRAMEBUFFER + ".width"
                );
                block.set(
                  CONTEXT,
                  "." + S_FRAMEBUFFER_HEIGHT,
                  FRAMEBUFFER + ".height"
                );
                return FRAMEBUFFER;
              });
            } else {
              return createStaticDecl(function(env2, scope) {
                var shared = env2.shared;
                scope.set(
                  shared.framebuffer,
                  ".next",
                  "null"
                );
                var CONTEXT = shared.context;
                scope.set(
                  CONTEXT,
                  "." + S_FRAMEBUFFER_WIDTH,
                  CONTEXT + "." + S_DRAWINGBUFFER_WIDTH
                );
                scope.set(
                  CONTEXT,
                  "." + S_FRAMEBUFFER_HEIGHT,
                  CONTEXT + "." + S_DRAWINGBUFFER_HEIGHT
                );
                return "null";
              });
            }
          } else if (S_FRAMEBUFFER in dynamicOptions) {
            var dyn = dynamicOptions[S_FRAMEBUFFER];
            return createDynamicDecl(dyn, function(env2, scope) {
              var FRAMEBUFFER_FUNC = env2.invoke(scope, dyn);
              var shared = env2.shared;
              var FRAMEBUFFER_STATE = shared.framebuffer;
              var FRAMEBUFFER = scope.def(
                FRAMEBUFFER_STATE,
                ".getFramebuffer(",
                FRAMEBUFFER_FUNC,
                ")"
              );
              check$1.optional(function() {
                env2.assert(
                  scope,
                  "!" + FRAMEBUFFER_FUNC + "||" + FRAMEBUFFER,
                  "invalid framebuffer object"
                );
              });
              scope.set(
                FRAMEBUFFER_STATE,
                ".next",
                FRAMEBUFFER
              );
              var CONTEXT = shared.context;
              scope.set(
                CONTEXT,
                "." + S_FRAMEBUFFER_WIDTH,
                FRAMEBUFFER + "?" + FRAMEBUFFER + ".width:" + CONTEXT + "." + S_DRAWINGBUFFER_WIDTH
              );
              scope.set(
                CONTEXT,
                "." + S_FRAMEBUFFER_HEIGHT,
                FRAMEBUFFER + "?" + FRAMEBUFFER + ".height:" + CONTEXT + "." + S_DRAWINGBUFFER_HEIGHT
              );
              return FRAMEBUFFER;
            });
          } else {
            return null;
          }
        }
        function parseViewportScissor(options, framebuffer, env) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          function parseBox(param) {
            if (param in staticOptions) {
              var box = staticOptions[param];
              check$1.commandType(box, "object", "invalid " + param, env.commandStr);
              var isStatic2 = true;
              var x2 = box.x | 0;
              var y = box.y | 0;
              var w, h;
              if ("width" in box) {
                w = box.width | 0;
                check$1.command(w >= 0, "invalid " + param, env.commandStr);
              } else {
                isStatic2 = false;
              }
              if ("height" in box) {
                h = box.height | 0;
                check$1.command(h >= 0, "invalid " + param, env.commandStr);
              } else {
                isStatic2 = false;
              }
              return new Declaration(
                !isStatic2 && framebuffer && framebuffer.thisDep,
                !isStatic2 && framebuffer && framebuffer.contextDep,
                !isStatic2 && framebuffer && framebuffer.propDep,
                function(env2, scope) {
                  var CONTEXT = env2.shared.context;
                  var BOX_W = w;
                  if (!("width" in box)) {
                    BOX_W = scope.def(CONTEXT, ".", S_FRAMEBUFFER_WIDTH, "-", x2);
                  }
                  var BOX_H = h;
                  if (!("height" in box)) {
                    BOX_H = scope.def(CONTEXT, ".", S_FRAMEBUFFER_HEIGHT, "-", y);
                  }
                  return [x2, y, BOX_W, BOX_H];
                }
              );
            } else if (param in dynamicOptions) {
              var dynBox = dynamicOptions[param];
              var result = createDynamicDecl(dynBox, function(env2, scope) {
                var BOX = env2.invoke(scope, dynBox);
                check$1.optional(function() {
                  env2.assert(
                    scope,
                    BOX + "&&typeof " + BOX + '==="object"',
                    "invalid " + param
                  );
                });
                var CONTEXT = env2.shared.context;
                var BOX_X = scope.def(BOX, ".x|0");
                var BOX_Y = scope.def(BOX, ".y|0");
                var BOX_W = scope.def(
                  '"width" in ',
                  BOX,
                  "?",
                  BOX,
                  ".width|0:",
                  "(",
                  CONTEXT,
                  ".",
                  S_FRAMEBUFFER_WIDTH,
                  "-",
                  BOX_X,
                  ")"
                );
                var BOX_H = scope.def(
                  '"height" in ',
                  BOX,
                  "?",
                  BOX,
                  ".height|0:",
                  "(",
                  CONTEXT,
                  ".",
                  S_FRAMEBUFFER_HEIGHT,
                  "-",
                  BOX_Y,
                  ")"
                );
                check$1.optional(function() {
                  env2.assert(
                    scope,
                    BOX_W + ">=0&&" + BOX_H + ">=0",
                    "invalid " + param
                  );
                });
                return [BOX_X, BOX_Y, BOX_W, BOX_H];
              });
              if (framebuffer) {
                result.thisDep = result.thisDep || framebuffer.thisDep;
                result.contextDep = result.contextDep || framebuffer.contextDep;
                result.propDep = result.propDep || framebuffer.propDep;
              }
              return result;
            } else if (framebuffer) {
              return new Declaration(
                framebuffer.thisDep,
                framebuffer.contextDep,
                framebuffer.propDep,
                function(env2, scope) {
                  var CONTEXT = env2.shared.context;
                  return [
                    0,
                    0,
                    scope.def(CONTEXT, ".", S_FRAMEBUFFER_WIDTH),
                    scope.def(CONTEXT, ".", S_FRAMEBUFFER_HEIGHT)
                  ];
                }
              );
            } else {
              return null;
            }
          }
          var viewport = parseBox(S_VIEWPORT);
          if (viewport) {
            var prevViewport = viewport;
            viewport = new Declaration(
              viewport.thisDep,
              viewport.contextDep,
              viewport.propDep,
              function(env2, scope) {
                var VIEWPORT = prevViewport.append(env2, scope);
                var CONTEXT = env2.shared.context;
                scope.set(
                  CONTEXT,
                  "." + S_VIEWPORT_WIDTH,
                  VIEWPORT[2]
                );
                scope.set(
                  CONTEXT,
                  "." + S_VIEWPORT_HEIGHT,
                  VIEWPORT[3]
                );
                return VIEWPORT;
              }
            );
          }
          return {
            viewport,
            scissor_box: parseBox(S_SCISSOR_BOX)
          };
        }
        function parseAttribLocations(options, attributes) {
          var staticOptions = options.static;
          var staticProgram = typeof staticOptions[S_FRAG] === "string" && typeof staticOptions[S_VERT] === "string";
          if (staticProgram) {
            if (Object.keys(attributes.dynamic).length > 0) {
              return null;
            }
            var staticAttributes = attributes.static;
            var sAttributes = Object.keys(staticAttributes);
            if (sAttributes.length > 0 && typeof staticAttributes[sAttributes[0]] === "number") {
              var bindings = [];
              for (var i = 0; i < sAttributes.length; ++i) {
                check$1(typeof staticAttributes[sAttributes[i]] === "number", "must specify all vertex attribute locations when using vaos");
                bindings.push([staticAttributes[sAttributes[i]] | 0, sAttributes[i]]);
              }
              return bindings;
            }
          }
          return null;
        }
        function parseProgram(options, env, attribLocations) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          function parseShader(name) {
            if (name in staticOptions) {
              var id2 = stringStore.id(staticOptions[name]);
              check$1.optional(function() {
                shaderState.shader(shaderType[name], id2, check$1.guessCommand());
              });
              var result = createStaticDecl(function() {
                return id2;
              });
              result.id = id2;
              return result;
            } else if (name in dynamicOptions) {
              var dyn = dynamicOptions[name];
              return createDynamicDecl(dyn, function(env2, scope) {
                var str = env2.invoke(scope, dyn);
                var id22 = scope.def(env2.shared.strings, ".id(", str, ")");
                check$1.optional(function() {
                  scope(
                    env2.shared.shader,
                    ".shader(",
                    shaderType[name],
                    ",",
                    id22,
                    ",",
                    env2.command,
                    ");"
                  );
                });
                return id22;
              });
            }
            return null;
          }
          var frag = parseShader(S_FRAG);
          var vert = parseShader(S_VERT);
          var program = null;
          var progVar;
          if (isStatic(frag) && isStatic(vert)) {
            program = shaderState.program(vert.id, frag.id, null, attribLocations);
            progVar = createStaticDecl(function(env2, scope) {
              return env2.link(program);
            });
          } else {
            progVar = new Declaration(
              frag && frag.thisDep || vert && vert.thisDep,
              frag && frag.contextDep || vert && vert.contextDep,
              frag && frag.propDep || vert && vert.propDep,
              function(env2, scope) {
                var SHADER_STATE = env2.shared.shader;
                var fragId;
                if (frag) {
                  fragId = frag.append(env2, scope);
                } else {
                  fragId = scope.def(SHADER_STATE, ".", S_FRAG);
                }
                var vertId;
                if (vert) {
                  vertId = vert.append(env2, scope);
                } else {
                  vertId = scope.def(SHADER_STATE, ".", S_VERT);
                }
                var progDef = SHADER_STATE + ".program(" + vertId + "," + fragId;
                check$1.optional(function() {
                  progDef += "," + env2.command;
                });
                return scope.def(progDef + ")");
              }
            );
          }
          return {
            frag,
            vert,
            progVar,
            program
          };
        }
        function parseDraw(options, env) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          var staticDraw = {};
          var vaoActive = false;
          function parseVAO() {
            if (S_VAO in staticOptions) {
              var vao2 = staticOptions[S_VAO];
              if (vao2 !== null && attributeState.getVAO(vao2) === null) {
                vao2 = attributeState.createVAO(vao2);
              }
              vaoActive = true;
              staticDraw.vao = vao2;
              return createStaticDecl(function(env2) {
                var vaoRef = attributeState.getVAO(vao2);
                if (vaoRef) {
                  return env2.link(vaoRef);
                } else {
                  return "null";
                }
              });
            } else if (S_VAO in dynamicOptions) {
              vaoActive = true;
              var dyn = dynamicOptions[S_VAO];
              return createDynamicDecl(dyn, function(env2, scope) {
                var vaoRef = env2.invoke(scope, dyn);
                return scope.def(env2.shared.vao + ".getVAO(" + vaoRef + ")");
              });
            }
            return null;
          }
          var vao = parseVAO();
          var elementsActive = false;
          function parseElements() {
            if (S_ELEMENTS in staticOptions) {
              var elements2 = staticOptions[S_ELEMENTS];
              staticDraw.elements = elements2;
              if (isBufferArgs(elements2)) {
                var e = staticDraw.elements = elementState.create(elements2, true);
                elements2 = elementState.getElements(e);
                elementsActive = true;
              } else if (elements2) {
                elements2 = elementState.getElements(elements2);
                elementsActive = true;
                check$1.command(elements2, "invalid elements", env.commandStr);
              }
              var result = createStaticDecl(function(env2, scope) {
                if (elements2) {
                  var result2 = env2.link(elements2);
                  env2.ELEMENTS = result2;
                  return result2;
                }
                env2.ELEMENTS = null;
                return null;
              });
              result.value = elements2;
              return result;
            } else if (S_ELEMENTS in dynamicOptions) {
              elementsActive = true;
              var dyn = dynamicOptions[S_ELEMENTS];
              return createDynamicDecl(dyn, function(env2, scope) {
                var shared = env2.shared;
                var IS_BUFFER_ARGS = shared.isBufferArgs;
                var ELEMENT_STATE = shared.elements;
                var elementDefn = env2.invoke(scope, dyn);
                var elements3 = scope.def("null");
                var elementStream = scope.def(IS_BUFFER_ARGS, "(", elementDefn, ")");
                var ifte = env2.cond(elementStream).then(elements3, "=", ELEMENT_STATE, ".createStream(", elementDefn, ");").else(elements3, "=", ELEMENT_STATE, ".getElements(", elementDefn, ");");
                check$1.optional(function() {
                  env2.assert(
                    ifte.else,
                    "!" + elementDefn + "||" + elements3,
                    "invalid elements"
                  );
                });
                scope.entry(ifte);
                scope.exit(
                  env2.cond(elementStream).then(ELEMENT_STATE, ".destroyStream(", elements3, ");")
                );
                env2.ELEMENTS = elements3;
                return elements3;
              });
            } else if (vaoActive) {
              return new Declaration(
                vao.thisDep,
                vao.contextDep,
                vao.propDep,
                function(env2, scope) {
                  return scope.def(env2.shared.vao + ".currentVAO?" + env2.shared.elements + ".getElements(" + env2.shared.vao + ".currentVAO.elements):null");
                }
              );
            }
            return null;
          }
          var elements = parseElements();
          function parsePrimitive() {
            if (S_PRIMITIVE in staticOptions) {
              var primitive2 = staticOptions[S_PRIMITIVE];
              staticDraw.primitive = primitive2;
              check$1.commandParameter(primitive2, primTypes, "invalid primitve", env.commandStr);
              return createStaticDecl(function(env2, scope) {
                return primTypes[primitive2];
              });
            } else if (S_PRIMITIVE in dynamicOptions) {
              var dynPrimitive = dynamicOptions[S_PRIMITIVE];
              return createDynamicDecl(dynPrimitive, function(env2, scope) {
                var PRIM_TYPES = env2.constants.primTypes;
                var prim = env2.invoke(scope, dynPrimitive);
                check$1.optional(function() {
                  env2.assert(
                    scope,
                    prim + " in " + PRIM_TYPES,
                    "invalid primitive, must be one of " + Object.keys(primTypes)
                  );
                });
                return scope.def(PRIM_TYPES, "[", prim, "]");
              });
            } else if (elementsActive) {
              if (isStatic(elements)) {
                if (elements.value) {
                  return createStaticDecl(function(env2, scope) {
                    return scope.def(env2.ELEMENTS, ".primType");
                  });
                } else {
                  return createStaticDecl(function() {
                    return GL_TRIANGLES$1;
                  });
                }
              } else {
                return new Declaration(
                  elements.thisDep,
                  elements.contextDep,
                  elements.propDep,
                  function(env2, scope) {
                    var elements2 = env2.ELEMENTS;
                    return scope.def(elements2, "?", elements2, ".primType:", GL_TRIANGLES$1);
                  }
                );
              }
            } else if (vaoActive) {
              return new Declaration(
                vao.thisDep,
                vao.contextDep,
                vao.propDep,
                function(env2, scope) {
                  return scope.def(env2.shared.vao + ".currentVAO?" + env2.shared.vao + ".currentVAO.primitive:" + GL_TRIANGLES$1);
                }
              );
            }
            return null;
          }
          function parseParam(param, isOffset) {
            if (param in staticOptions) {
              var value = staticOptions[param] | 0;
              if (isOffset) {
                staticDraw.offset = value;
              } else {
                staticDraw.instances = value;
              }
              check$1.command(!isOffset || value >= 0, "invalid " + param, env.commandStr);
              return createStaticDecl(function(env2, scope) {
                if (isOffset) {
                  env2.OFFSET = value;
                }
                return value;
              });
            } else if (param in dynamicOptions) {
              var dynValue = dynamicOptions[param];
              return createDynamicDecl(dynValue, function(env2, scope) {
                var result = env2.invoke(scope, dynValue);
                if (isOffset) {
                  env2.OFFSET = result;
                  check$1.optional(function() {
                    env2.assert(
                      scope,
                      result + ">=0",
                      "invalid " + param
                    );
                  });
                }
                return result;
              });
            } else if (isOffset) {
              if (elementsActive) {
                return createStaticDecl(function(env2, scope) {
                  env2.OFFSET = 0;
                  return 0;
                });
              } else if (vaoActive) {
                return new Declaration(
                  vao.thisDep,
                  vao.contextDep,
                  vao.propDep,
                  function(env2, scope) {
                    return scope.def(env2.shared.vao + ".currentVAO?" + env2.shared.vao + ".currentVAO.offset:0");
                  }
                );
              }
            } else if (vaoActive) {
              return new Declaration(
                vao.thisDep,
                vao.contextDep,
                vao.propDep,
                function(env2, scope) {
                  return scope.def(env2.shared.vao + ".currentVAO?" + env2.shared.vao + ".currentVAO.instances:-1");
                }
              );
            }
            return null;
          }
          var OFFSET = parseParam(S_OFFSET, true);
          function parseVertCount() {
            if (S_COUNT in staticOptions) {
              var count2 = staticOptions[S_COUNT] | 0;
              staticDraw.count = count2;
              check$1.command(
                typeof count2 === "number" && count2 >= 0,
                "invalid vertex count",
                env.commandStr
              );
              return createStaticDecl(function() {
                return count2;
              });
            } else if (S_COUNT in dynamicOptions) {
              var dynCount = dynamicOptions[S_COUNT];
              return createDynamicDecl(dynCount, function(env2, scope) {
                var result2 = env2.invoke(scope, dynCount);
                check$1.optional(function() {
                  env2.assert(
                    scope,
                    "typeof " + result2 + '==="number"&&' + result2 + ">=0&&" + result2 + "===(" + result2 + "|0)",
                    "invalid vertex count"
                  );
                });
                return result2;
              });
            } else if (elementsActive) {
              if (isStatic(elements)) {
                if (elements) {
                  if (OFFSET) {
                    return new Declaration(
                      OFFSET.thisDep,
                      OFFSET.contextDep,
                      OFFSET.propDep,
                      function(env2, scope) {
                        var result2 = scope.def(
                          env2.ELEMENTS,
                          ".vertCount-",
                          env2.OFFSET
                        );
                        check$1.optional(function() {
                          env2.assert(
                            scope,
                            result2 + ">=0",
                            "invalid vertex offset/element buffer too small"
                          );
                        });
                        return result2;
                      }
                    );
                  } else {
                    return createStaticDecl(function(env2, scope) {
                      return scope.def(env2.ELEMENTS, ".vertCount");
                    });
                  }
                } else {
                  var result = createStaticDecl(function() {
                    return -1;
                  });
                  check$1.optional(function() {
                    result.MISSING = true;
                  });
                  return result;
                }
              } else {
                var variable = new Declaration(
                  elements.thisDep || OFFSET.thisDep,
                  elements.contextDep || OFFSET.contextDep,
                  elements.propDep || OFFSET.propDep,
                  function(env2, scope) {
                    var elements2 = env2.ELEMENTS;
                    if (env2.OFFSET) {
                      return scope.def(
                        elements2,
                        "?",
                        elements2,
                        ".vertCount-",
                        env2.OFFSET,
                        ":-1"
                      );
                    }
                    return scope.def(elements2, "?", elements2, ".vertCount:-1");
                  }
                );
                check$1.optional(function() {
                  variable.DYNAMIC = true;
                });
                return variable;
              }
            } else if (vaoActive) {
              var countVariable = new Declaration(
                vao.thisDep,
                vao.contextDep,
                vao.propDep,
                function(env2, scope) {
                  return scope.def(env2.shared.vao, ".currentVAO?", env2.shared.vao, ".currentVAO.count:-1");
                }
              );
              return countVariable;
            }
            return null;
          }
          var primitive = parsePrimitive();
          var count = parseVertCount();
          var instances = parseParam(S_INSTANCES, false);
          return {
            elements,
            primitive,
            count,
            instances,
            offset: OFFSET,
            vao,
            vaoActive,
            elementsActive,
            // static draw props
            static: staticDraw
          };
        }
        function parseGLState(options, env) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          var STATE = {};
          GL_STATE_NAMES.forEach(function(prop) {
            var param = propName(prop);
            function parseParam(parseStatic, parseDynamic) {
              if (prop in staticOptions) {
                var value = parseStatic(staticOptions[prop]);
                STATE[param] = createStaticDecl(function() {
                  return value;
                });
              } else if (prop in dynamicOptions) {
                var dyn = dynamicOptions[prop];
                STATE[param] = createDynamicDecl(dyn, function(env2, scope) {
                  return parseDynamic(env2, scope, env2.invoke(scope, dyn));
                });
              }
            }
            switch (prop) {
              case S_CULL_ENABLE:
              case S_BLEND_ENABLE:
              case S_DITHER:
              case S_STENCIL_ENABLE:
              case S_DEPTH_ENABLE:
              case S_SCISSOR_ENABLE:
              case S_POLYGON_OFFSET_ENABLE:
              case S_SAMPLE_ALPHA:
              case S_SAMPLE_ENABLE:
              case S_DEPTH_MASK:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "boolean", prop, env.commandStr);
                    return value;
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        "typeof " + value + '==="boolean"',
                        "invalid flag " + prop,
                        env2.commandStr
                      );
                    });
                    return value;
                  }
                );
              case S_DEPTH_FUNC:
                return parseParam(
                  function(value) {
                    check$1.commandParameter(value, compareFuncs, "invalid " + prop, env.commandStr);
                    return compareFuncs[value];
                  },
                  function(env2, scope, value) {
                    var COMPARE_FUNCS = env2.constants.compareFuncs;
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + " in " + COMPARE_FUNCS,
                        "invalid " + prop + ", must be one of " + Object.keys(compareFuncs)
                      );
                    });
                    return scope.def(COMPARE_FUNCS, "[", value, "]");
                  }
                );
              case S_DEPTH_RANGE:
                return parseParam(
                  function(value) {
                    check$1.command(
                      isArrayLike(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number" && value[0] <= value[1],
                      "depth range is 2d array",
                      env.commandStr
                    );
                    return value;
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        env2.shared.isArrayLike + "(" + value + ")&&" + value + ".length===2&&typeof " + value + '[0]==="number"&&typeof ' + value + '[1]==="number"&&' + value + "[0]<=" + value + "[1]",
                        "depth range must be a 2d array"
                      );
                    });
                    var Z_NEAR = scope.def("+", value, "[0]");
                    var Z_FAR = scope.def("+", value, "[1]");
                    return [Z_NEAR, Z_FAR];
                  }
                );
              case S_BLEND_FUNC:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "object", "blend.func", env.commandStr);
                    var srcRGB = "srcRGB" in value ? value.srcRGB : value.src;
                    var srcAlpha = "srcAlpha" in value ? value.srcAlpha : value.src;
                    var dstRGB = "dstRGB" in value ? value.dstRGB : value.dst;
                    var dstAlpha = "dstAlpha" in value ? value.dstAlpha : value.dst;
                    check$1.commandParameter(srcRGB, blendFuncs, param + ".srcRGB", env.commandStr);
                    check$1.commandParameter(srcAlpha, blendFuncs, param + ".srcAlpha", env.commandStr);
                    check$1.commandParameter(dstRGB, blendFuncs, param + ".dstRGB", env.commandStr);
                    check$1.commandParameter(dstAlpha, blendFuncs, param + ".dstAlpha", env.commandStr);
                    check$1.command(
                      invalidBlendCombinations.indexOf(srcRGB + ", " + dstRGB) === -1,
                      "unallowed blending combination (srcRGB, dstRGB) = (" + srcRGB + ", " + dstRGB + ")",
                      env.commandStr
                    );
                    return [
                      blendFuncs[srcRGB],
                      blendFuncs[dstRGB],
                      blendFuncs[srcAlpha],
                      blendFuncs[dstAlpha]
                    ];
                  },
                  function(env2, scope, value) {
                    var BLEND_FUNCS = env2.constants.blendFuncs;
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + "&&typeof " + value + '==="object"',
                        "invalid blend func, must be an object"
                      );
                    });
                    function read(prefix, suffix) {
                      var func = scope.def(
                        '"',
                        prefix,
                        suffix,
                        '" in ',
                        value,
                        "?",
                        value,
                        ".",
                        prefix,
                        suffix,
                        ":",
                        value,
                        ".",
                        prefix
                      );
                      check$1.optional(function() {
                        env2.assert(
                          scope,
                          func + " in " + BLEND_FUNCS,
                          "invalid " + prop + "." + prefix + suffix + ", must be one of " + Object.keys(blendFuncs)
                        );
                      });
                      return func;
                    }
                    var srcRGB = read("src", "RGB");
                    var dstRGB = read("dst", "RGB");
                    check$1.optional(function() {
                      var INVALID_BLEND_COMBINATIONS = env2.constants.invalidBlendCombinations;
                      env2.assert(
                        scope,
                        INVALID_BLEND_COMBINATIONS + ".indexOf(" + srcRGB + '+", "+' + dstRGB + ") === -1 ",
                        "unallowed blending combination for (srcRGB, dstRGB)"
                      );
                    });
                    var SRC_RGB = scope.def(BLEND_FUNCS, "[", srcRGB, "]");
                    var SRC_ALPHA = scope.def(BLEND_FUNCS, "[", read("src", "Alpha"), "]");
                    var DST_RGB = scope.def(BLEND_FUNCS, "[", dstRGB, "]");
                    var DST_ALPHA = scope.def(BLEND_FUNCS, "[", read("dst", "Alpha"), "]");
                    return [SRC_RGB, DST_RGB, SRC_ALPHA, DST_ALPHA];
                  }
                );
              case S_BLEND_EQUATION:
                return parseParam(
                  function(value) {
                    if (typeof value === "string") {
                      check$1.commandParameter(value, blendEquations, "invalid " + prop, env.commandStr);
                      return [
                        blendEquations[value],
                        blendEquations[value]
                      ];
                    } else if (typeof value === "object") {
                      check$1.commandParameter(
                        value.rgb,
                        blendEquations,
                        prop + ".rgb",
                        env.commandStr
                      );
                      check$1.commandParameter(
                        value.alpha,
                        blendEquations,
                        prop + ".alpha",
                        env.commandStr
                      );
                      return [
                        blendEquations[value.rgb],
                        blendEquations[value.alpha]
                      ];
                    } else {
                      check$1.commandRaise("invalid blend.equation", env.commandStr);
                    }
                  },
                  function(env2, scope, value) {
                    var BLEND_EQUATIONS = env2.constants.blendEquations;
                    var RGB = scope.def();
                    var ALPHA = scope.def();
                    var ifte = env2.cond("typeof ", value, '==="string"');
                    check$1.optional(function() {
                      function checkProp(block, name, value2) {
                        env2.assert(
                          block,
                          value2 + " in " + BLEND_EQUATIONS,
                          "invalid " + name + ", must be one of " + Object.keys(blendEquations)
                        );
                      }
                      checkProp(ifte.then, prop, value);
                      env2.assert(
                        ifte.else,
                        value + "&&typeof " + value + '==="object"',
                        "invalid " + prop
                      );
                      checkProp(ifte.else, prop + ".rgb", value + ".rgb");
                      checkProp(ifte.else, prop + ".alpha", value + ".alpha");
                    });
                    ifte.then(
                      RGB,
                      "=",
                      ALPHA,
                      "=",
                      BLEND_EQUATIONS,
                      "[",
                      value,
                      "];"
                    );
                    ifte.else(
                      RGB,
                      "=",
                      BLEND_EQUATIONS,
                      "[",
                      value,
                      ".rgb];",
                      ALPHA,
                      "=",
                      BLEND_EQUATIONS,
                      "[",
                      value,
                      ".alpha];"
                    );
                    scope(ifte);
                    return [RGB, ALPHA];
                  }
                );
              case S_BLEND_COLOR:
                return parseParam(
                  function(value) {
                    check$1.command(
                      isArrayLike(value) && value.length === 4,
                      "blend.color must be a 4d array",
                      env.commandStr
                    );
                    return loop2(4, function(i) {
                      return +value[i];
                    });
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        env2.shared.isArrayLike + "(" + value + ")&&" + value + ".length===4",
                        "blend.color must be a 4d array"
                      );
                    });
                    return loop2(4, function(i) {
                      return scope.def("+", value, "[", i, "]");
                    });
                  }
                );
              case S_STENCIL_MASK:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "number", param, env.commandStr);
                    return value | 0;
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        "typeof " + value + '==="number"',
                        "invalid stencil.mask"
                      );
                    });
                    return scope.def(value, "|0");
                  }
                );
              case S_STENCIL_FUNC:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "object", param, env.commandStr);
                    var cmp = value.cmp || "keep";
                    var ref2 = value.ref || 0;
                    var mask = "mask" in value ? value.mask : -1;
                    check$1.commandParameter(cmp, compareFuncs, prop + ".cmp", env.commandStr);
                    check$1.commandType(ref2, "number", prop + ".ref", env.commandStr);
                    check$1.commandType(mask, "number", prop + ".mask", env.commandStr);
                    return [
                      compareFuncs[cmp],
                      ref2,
                      mask
                    ];
                  },
                  function(env2, scope, value) {
                    var COMPARE_FUNCS = env2.constants.compareFuncs;
                    check$1.optional(function() {
                      function assert() {
                        env2.assert(
                          scope,
                          Array.prototype.join.call(arguments, ""),
                          "invalid stencil.func"
                        );
                      }
                      assert(value + "&&typeof ", value, '==="object"');
                      assert(
                        '!("cmp" in ',
                        value,
                        ")||(",
                        value,
                        ".cmp in ",
                        COMPARE_FUNCS,
                        ")"
                      );
                    });
                    var cmp = scope.def(
                      '"cmp" in ',
                      value,
                      "?",
                      COMPARE_FUNCS,
                      "[",
                      value,
                      ".cmp]",
                      ":",
                      GL_KEEP
                    );
                    var ref2 = scope.def(value, ".ref|0");
                    var mask = scope.def(
                      '"mask" in ',
                      value,
                      "?",
                      value,
                      ".mask|0:-1"
                    );
                    return [cmp, ref2, mask];
                  }
                );
              case S_STENCIL_OPFRONT:
              case S_STENCIL_OPBACK:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "object", param, env.commandStr);
                    var fail = value.fail || "keep";
                    var zfail = value.zfail || "keep";
                    var zpass = value.zpass || "keep";
                    check$1.commandParameter(fail, stencilOps, prop + ".fail", env.commandStr);
                    check$1.commandParameter(zfail, stencilOps, prop + ".zfail", env.commandStr);
                    check$1.commandParameter(zpass, stencilOps, prop + ".zpass", env.commandStr);
                    return [
                      prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT,
                      stencilOps[fail],
                      stencilOps[zfail],
                      stencilOps[zpass]
                    ];
                  },
                  function(env2, scope, value) {
                    var STENCIL_OPS = env2.constants.stencilOps;
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + "&&typeof " + value + '==="object"',
                        "invalid " + prop
                      );
                    });
                    function read(name) {
                      check$1.optional(function() {
                        env2.assert(
                          scope,
                          '!("' + name + '" in ' + value + ")||(" + value + "." + name + " in " + STENCIL_OPS + ")",
                          "invalid " + prop + "." + name + ", must be one of " + Object.keys(stencilOps)
                        );
                      });
                      return scope.def(
                        '"',
                        name,
                        '" in ',
                        value,
                        "?",
                        STENCIL_OPS,
                        "[",
                        value,
                        ".",
                        name,
                        "]:",
                        GL_KEEP
                      );
                    }
                    return [
                      prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT,
                      read("fail"),
                      read("zfail"),
                      read("zpass")
                    ];
                  }
                );
              case S_POLYGON_OFFSET_OFFSET:
                return parseParam(
                  function(value) {
                    check$1.commandType(value, "object", param, env.commandStr);
                    var factor = value.factor | 0;
                    var units = value.units | 0;
                    check$1.commandType(factor, "number", param + ".factor", env.commandStr);
                    check$1.commandType(units, "number", param + ".units", env.commandStr);
                    return [factor, units];
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + "&&typeof " + value + '==="object"',
                        "invalid " + prop
                      );
                    });
                    var FACTOR = scope.def(value, ".factor|0");
                    var UNITS = scope.def(value, ".units|0");
                    return [FACTOR, UNITS];
                  }
                );
              case S_CULL_FACE:
                return parseParam(
                  function(value) {
                    var face = 0;
                    if (value === "front") {
                      face = GL_FRONT;
                    } else if (value === "back") {
                      face = GL_BACK;
                    }
                    check$1.command(!!face, param, env.commandStr);
                    return face;
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + '==="front"||' + value + '==="back"',
                        "invalid cull.face"
                      );
                    });
                    return scope.def(value, '==="front"?', GL_FRONT, ":", GL_BACK);
                  }
                );
              case S_LINE_WIDTH:
                return parseParam(
                  function(value) {
                    check$1.command(
                      typeof value === "number" && value >= limits.lineWidthDims[0] && value <= limits.lineWidthDims[1],
                      "invalid line width, must be a positive number between " + limits.lineWidthDims[0] + " and " + limits.lineWidthDims[1],
                      env.commandStr
                    );
                    return value;
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        "typeof " + value + '==="number"&&' + value + ">=" + limits.lineWidthDims[0] + "&&" + value + "<=" + limits.lineWidthDims[1],
                        "invalid line width"
                      );
                    });
                    return value;
                  }
                );
              case S_FRONT_FACE:
                return parseParam(
                  function(value) {
                    check$1.commandParameter(value, orientationType, param, env.commandStr);
                    return orientationType[value];
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + '==="cw"||' + value + '==="ccw"',
                        "invalid frontFace, must be one of cw,ccw"
                      );
                    });
                    return scope.def(value + '==="cw"?' + GL_CW + ":" + GL_CCW);
                  }
                );
              case S_COLOR_MASK:
                return parseParam(
                  function(value) {
                    check$1.command(
                      isArrayLike(value) && value.length === 4,
                      "color.mask must be length 4 array",
                      env.commandStr
                    );
                    return value.map(function(v2) {
                      return !!v2;
                    });
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        env2.shared.isArrayLike + "(" + value + ")&&" + value + ".length===4",
                        "invalid color.mask"
                      );
                    });
                    return loop2(4, function(i) {
                      return "!!" + value + "[" + i + "]";
                    });
                  }
                );
              case S_SAMPLE_COVERAGE:
                return parseParam(
                  function(value) {
                    check$1.command(typeof value === "object" && value, param, env.commandStr);
                    var sampleValue = "value" in value ? value.value : 1;
                    var sampleInvert = !!value.invert;
                    check$1.command(
                      typeof sampleValue === "number" && sampleValue >= 0 && sampleValue <= 1,
                      "sample.coverage.value must be a number between 0 and 1",
                      env.commandStr
                    );
                    return [sampleValue, sampleInvert];
                  },
                  function(env2, scope, value) {
                    check$1.optional(function() {
                      env2.assert(
                        scope,
                        value + "&&typeof " + value + '==="object"',
                        "invalid sample.coverage"
                      );
                    });
                    var VALUE = scope.def(
                      '"value" in ',
                      value,
                      "?+",
                      value,
                      ".value:1"
                    );
                    var INVERT = scope.def("!!", value, ".invert");
                    return [VALUE, INVERT];
                  }
                );
            }
          });
          return STATE;
        }
        function parseUniforms(uniforms, env) {
          var staticUniforms = uniforms.static;
          var dynamicUniforms = uniforms.dynamic;
          var UNIFORMS = {};
          Object.keys(staticUniforms).forEach(function(name) {
            var value = staticUniforms[name];
            var result;
            if (typeof value === "number" || typeof value === "boolean") {
              result = createStaticDecl(function() {
                return value;
              });
            } else if (typeof value === "function") {
              var reglType = value._reglType;
              if (reglType === "texture2d" || reglType === "textureCube") {
                result = createStaticDecl(function(env2) {
                  return env2.link(value);
                });
              } else if (reglType === "framebuffer" || reglType === "framebufferCube") {
                check$1.command(
                  value.color.length > 0,
                  'missing color attachment for framebuffer sent to uniform "' + name + '"',
                  env.commandStr
                );
                result = createStaticDecl(function(env2) {
                  return env2.link(value.color[0]);
                });
              } else {
                check$1.commandRaise('invalid data for uniform "' + name + '"', env.commandStr);
              }
            } else if (isArrayLike(value)) {
              result = createStaticDecl(function(env2) {
                var ITEM = env2.global.def(
                  "[",
                  loop2(value.length, function(i) {
                    check$1.command(
                      typeof value[i] === "number" || typeof value[i] === "boolean",
                      "invalid uniform " + name,
                      env2.commandStr
                    );
                    return value[i];
                  }),
                  "]"
                );
                return ITEM;
              });
            } else {
              check$1.commandRaise('invalid or missing data for uniform "' + name + '"', env.commandStr);
            }
            result.value = value;
            UNIFORMS[name] = result;
          });
          Object.keys(dynamicUniforms).forEach(function(key) {
            var dyn = dynamicUniforms[key];
            UNIFORMS[key] = createDynamicDecl(dyn, function(env2, scope) {
              return env2.invoke(scope, dyn);
            });
          });
          return UNIFORMS;
        }
        function parseAttributes(attributes, env) {
          var staticAttributes = attributes.static;
          var dynamicAttributes = attributes.dynamic;
          var attributeDefs = {};
          Object.keys(staticAttributes).forEach(function(attribute) {
            var value = staticAttributes[attribute];
            var id2 = stringStore.id(attribute);
            var record = new AttributeRecord2();
            if (isBufferArgs(value)) {
              record.state = ATTRIB_STATE_POINTER;
              record.buffer = bufferState.getBuffer(
                bufferState.create(value, GL_ARRAY_BUFFER$2, false, true)
              );
              record.type = 0;
            } else {
              var buffer = bufferState.getBuffer(value);
              if (buffer) {
                record.state = ATTRIB_STATE_POINTER;
                record.buffer = buffer;
                record.type = 0;
              } else {
                check$1.command(
                  typeof value === "object" && value,
                  "invalid data for attribute " + attribute,
                  env.commandStr
                );
                if ("constant" in value) {
                  var constant = value.constant;
                  record.buffer = "null";
                  record.state = ATTRIB_STATE_CONSTANT;
                  if (typeof constant === "number") {
                    record.x = constant;
                  } else {
                    check$1.command(
                      isArrayLike(constant) && constant.length > 0 && constant.length <= 4,
                      "invalid constant for attribute " + attribute,
                      env.commandStr
                    );
                    CUTE_COMPONENTS.forEach(function(c, i) {
                      if (i < constant.length) {
                        record[c] = constant[i];
                      }
                    });
                  }
                } else {
                  if (isBufferArgs(value.buffer)) {
                    buffer = bufferState.getBuffer(
                      bufferState.create(value.buffer, GL_ARRAY_BUFFER$2, false, true)
                    );
                  } else {
                    buffer = bufferState.getBuffer(value.buffer);
                  }
                  check$1.command(!!buffer, 'missing buffer for attribute "' + attribute + '"', env.commandStr);
                  var offset2 = value.offset | 0;
                  check$1.command(
                    offset2 >= 0,
                    'invalid offset for attribute "' + attribute + '"',
                    env.commandStr
                  );
                  var stride = value.stride | 0;
                  check$1.command(
                    stride >= 0 && stride < 256,
                    'invalid stride for attribute "' + attribute + '", must be integer betweeen [0, 255]',
                    env.commandStr
                  );
                  var size = value.size | 0;
                  check$1.command(
                    !("size" in value) || size > 0 && size <= 4,
                    'invalid size for attribute "' + attribute + '", must be 1,2,3,4',
                    env.commandStr
                  );
                  var normalized = !!value.normalized;
                  var type = 0;
                  if ("type" in value) {
                    check$1.commandParameter(
                      value.type,
                      glTypes,
                      "invalid type for attribute " + attribute,
                      env.commandStr
                    );
                    type = glTypes[value.type];
                  }
                  var divisor = value.divisor | 0;
                  check$1.optional(function() {
                    if ("divisor" in value) {
                      check$1.command(
                        divisor === 0 || extInstancing,
                        'cannot specify divisor for attribute "' + attribute + '", instancing not supported',
                        env.commandStr
                      );
                      check$1.command(
                        divisor >= 0,
                        'invalid divisor for attribute "' + attribute + '"',
                        env.commandStr
                      );
                    }
                    var command = env.commandStr;
                    var VALID_KEYS = [
                      "buffer",
                      "offset",
                      "divisor",
                      "normalized",
                      "type",
                      "size",
                      "stride"
                    ];
                    Object.keys(value).forEach(function(prop) {
                      check$1.command(
                        VALID_KEYS.indexOf(prop) >= 0,
                        'unknown parameter "' + prop + '" for attribute pointer "' + attribute + '" (valid parameters are ' + VALID_KEYS + ")",
                        command
                      );
                    });
                  });
                  record.buffer = buffer;
                  record.state = ATTRIB_STATE_POINTER;
                  record.size = size;
                  record.normalized = normalized;
                  record.type = type || buffer.dtype;
                  record.offset = offset2;
                  record.stride = stride;
                  record.divisor = divisor;
                }
              }
            }
            attributeDefs[attribute] = createStaticDecl(function(env2, scope) {
              var cache = env2.attribCache;
              if (id2 in cache) {
                return cache[id2];
              }
              var result = {
                isStream: false
              };
              Object.keys(record).forEach(function(key) {
                result[key] = record[key];
              });
              if (record.buffer) {
                result.buffer = env2.link(record.buffer);
                result.type = result.type || result.buffer + ".dtype";
              }
              cache[id2] = result;
              return result;
            });
          });
          Object.keys(dynamicAttributes).forEach(function(attribute) {
            var dyn = dynamicAttributes[attribute];
            function appendAttributeCode(env2, block) {
              var VALUE = env2.invoke(block, dyn);
              var shared = env2.shared;
              var constants = env2.constants;
              var IS_BUFFER_ARGS = shared.isBufferArgs;
              var BUFFER_STATE = shared.buffer;
              check$1.optional(function() {
                env2.assert(
                  block,
                  VALUE + "&&(typeof " + VALUE + '==="object"||typeof ' + VALUE + '==="function")&&(' + IS_BUFFER_ARGS + "(" + VALUE + ")||" + BUFFER_STATE + ".getBuffer(" + VALUE + ")||" + BUFFER_STATE + ".getBuffer(" + VALUE + ".buffer)||" + IS_BUFFER_ARGS + "(" + VALUE + '.buffer)||("constant" in ' + VALUE + "&&(typeof " + VALUE + '.constant==="number"||' + shared.isArrayLike + "(" + VALUE + ".constant))))",
                  'invalid dynamic attribute "' + attribute + '"'
                );
              });
              var result = {
                isStream: block.def(false)
              };
              var defaultRecord = new AttributeRecord2();
              defaultRecord.state = ATTRIB_STATE_POINTER;
              Object.keys(defaultRecord).forEach(function(key) {
                result[key] = block.def("" + defaultRecord[key]);
              });
              var BUFFER = result.buffer;
              var TYPE = result.type;
              block(
                "if(",
                IS_BUFFER_ARGS,
                "(",
                VALUE,
                ")){",
                result.isStream,
                "=true;",
                BUFFER,
                "=",
                BUFFER_STATE,
                ".createStream(",
                GL_ARRAY_BUFFER$2,
                ",",
                VALUE,
                ");",
                TYPE,
                "=",
                BUFFER,
                ".dtype;",
                "}else{",
                BUFFER,
                "=",
                BUFFER_STATE,
                ".getBuffer(",
                VALUE,
                ");",
                "if(",
                BUFFER,
                "){",
                TYPE,
                "=",
                BUFFER,
                ".dtype;",
                '}else if("constant" in ',
                VALUE,
                "){",
                result.state,
                "=",
                ATTRIB_STATE_CONSTANT,
                ";",
                "if(typeof " + VALUE + '.constant === "number"){',
                result[CUTE_COMPONENTS[0]],
                "=",
                VALUE,
                ".constant;",
                CUTE_COMPONENTS.slice(1).map(function(n) {
                  return result[n];
                }).join("="),
                "=0;",
                "}else{",
                CUTE_COMPONENTS.map(function(name, i) {
                  return result[name] + "=" + VALUE + ".constant.length>" + i + "?" + VALUE + ".constant[" + i + "]:0;";
                }).join(""),
                "}}else{",
                "if(",
                IS_BUFFER_ARGS,
                "(",
                VALUE,
                ".buffer)){",
                BUFFER,
                "=",
                BUFFER_STATE,
                ".createStream(",
                GL_ARRAY_BUFFER$2,
                ",",
                VALUE,
                ".buffer);",
                "}else{",
                BUFFER,
                "=",
                BUFFER_STATE,
                ".getBuffer(",
                VALUE,
                ".buffer);",
                "}",
                TYPE,
                '="type" in ',
                VALUE,
                "?",
                constants.glTypes,
                "[",
                VALUE,
                ".type]:",
                BUFFER,
                ".dtype;",
                result.normalized,
                "=!!",
                VALUE,
                ".normalized;"
              );
              function emitReadRecord(name) {
                block(result[name], "=", VALUE, ".", name, "|0;");
              }
              emitReadRecord("size");
              emitReadRecord("offset");
              emitReadRecord("stride");
              emitReadRecord("divisor");
              block("}}");
              block.exit(
                "if(",
                result.isStream,
                "){",
                BUFFER_STATE,
                ".destroyStream(",
                BUFFER,
                ");",
                "}"
              );
              return result;
            }
            attributeDefs[attribute] = createDynamicDecl(dyn, appendAttributeCode);
          });
          return attributeDefs;
        }
        function parseContext(context) {
          var staticContext = context.static;
          var dynamicContext = context.dynamic;
          var result = {};
          Object.keys(staticContext).forEach(function(name) {
            var value = staticContext[name];
            result[name] = createStaticDecl(function(env, scope) {
              if (typeof value === "number" || typeof value === "boolean") {
                return "" + value;
              } else {
                return env.link(value);
              }
            });
          });
          Object.keys(dynamicContext).forEach(function(name) {
            var dyn = dynamicContext[name];
            result[name] = createDynamicDecl(dyn, function(env, scope) {
              return env.invoke(scope, dyn);
            });
          });
          return result;
        }
        function parseArguments(options, attributes, uniforms, context, env) {
          var staticOptions = options.static;
          var dynamicOptions = options.dynamic;
          check$1.optional(function() {
            var KEY_NAMES = [
              S_FRAMEBUFFER,
              S_VERT,
              S_FRAG,
              S_ELEMENTS,
              S_PRIMITIVE,
              S_OFFSET,
              S_COUNT,
              S_INSTANCES,
              S_PROFILE,
              S_VAO
            ].concat(GL_STATE_NAMES);
            function checkKeys(dict) {
              Object.keys(dict).forEach(function(key) {
                check$1.command(
                  KEY_NAMES.indexOf(key) >= 0,
                  'unknown parameter "' + key + '"',
                  env.commandStr
                );
              });
            }
            checkKeys(staticOptions);
            checkKeys(dynamicOptions);
          });
          var attribLocations = parseAttribLocations(options, attributes);
          var framebuffer = parseFramebuffer(options);
          var viewportAndScissor = parseViewportScissor(options, framebuffer, env);
          var draw = parseDraw(options, env);
          var state = parseGLState(options, env);
          var shader = parseProgram(options, env, attribLocations);
          function copyBox(name) {
            var defn = viewportAndScissor[name];
            if (defn) {
              state[name] = defn;
            }
          }
          copyBox(S_VIEWPORT);
          copyBox(propName(S_SCISSOR_BOX));
          var dirty = Object.keys(state).length > 0;
          var result = {
            framebuffer,
            draw,
            shader,
            state,
            dirty,
            scopeVAO: null,
            drawVAO: null,
            useVAO: false,
            attributes: {}
          };
          result.profile = parseProfile(options);
          result.uniforms = parseUniforms(uniforms, env);
          result.drawVAO = result.scopeVAO = draw.vao;
          if (!result.drawVAO && shader.program && !attribLocations && extensions.angle_instanced_arrays && draw.static.elements) {
            var useVAO = true;
            var staticBindings = shader.program.attributes.map(function(attr) {
              var binding = attributes.static[attr];
              useVAO = useVAO && !!binding;
              return binding;
            });
            if (useVAO && staticBindings.length > 0) {
              var vao = attributeState.getVAO(attributeState.createVAO({
                attributes: staticBindings,
                elements: draw.static.elements
              }));
              result.drawVAO = new Declaration(null, null, null, function(env2, scope) {
                return env2.link(vao);
              });
              result.useVAO = true;
            }
          }
          if (attribLocations) {
            result.useVAO = true;
          } else {
            result.attributes = parseAttributes(attributes, env);
          }
          result.context = parseContext(context);
          return result;
        }
        function emitContext(env, scope, context) {
          var shared = env.shared;
          var CONTEXT = shared.context;
          var contextEnter = env.scope();
          Object.keys(context).forEach(function(name) {
            scope.save(CONTEXT, "." + name);
            var defn = context[name];
            var value = defn.append(env, scope);
            if (Array.isArray(value)) {
              contextEnter(CONTEXT, ".", name, "=[", value.join(), "];");
            } else {
              contextEnter(CONTEXT, ".", name, "=", value, ";");
            }
          });
          scope(contextEnter);
        }
        function emitPollFramebuffer(env, scope, framebuffer, skipCheck) {
          var shared = env.shared;
          var GL = shared.gl;
          var FRAMEBUFFER_STATE = shared.framebuffer;
          var EXT_DRAW_BUFFERS;
          if (extDrawBuffers) {
            EXT_DRAW_BUFFERS = scope.def(shared.extensions, ".webgl_draw_buffers");
          }
          var constants = env.constants;
          var DRAW_BUFFERS = constants.drawBuffer;
          var BACK_BUFFER = constants.backBuffer;
          var NEXT;
          if (framebuffer) {
            NEXT = framebuffer.append(env, scope);
          } else {
            NEXT = scope.def(FRAMEBUFFER_STATE, ".next");
          }
          if (!skipCheck) {
            scope("if(", NEXT, "!==", FRAMEBUFFER_STATE, ".cur){");
          }
          scope(
            "if(",
            NEXT,
            "){",
            GL,
            ".bindFramebuffer(",
            GL_FRAMEBUFFER$2,
            ",",
            NEXT,
            ".framebuffer);"
          );
          if (extDrawBuffers) {
            scope(
              EXT_DRAW_BUFFERS,
              ".drawBuffersWEBGL(",
              DRAW_BUFFERS,
              "[",
              NEXT,
              ".colorAttachments.length]);"
            );
          }
          scope(
            "}else{",
            GL,
            ".bindFramebuffer(",
            GL_FRAMEBUFFER$2,
            ",null);"
          );
          if (extDrawBuffers) {
            scope(EXT_DRAW_BUFFERS, ".drawBuffersWEBGL(", BACK_BUFFER, ");");
          }
          scope(
            "}",
            FRAMEBUFFER_STATE,
            ".cur=",
            NEXT,
            ";"
          );
          if (!skipCheck) {
            scope("}");
          }
        }
        function emitPollState(env, scope, args) {
          var shared = env.shared;
          var GL = shared.gl;
          var CURRENT_VARS = env.current;
          var NEXT_VARS = env.next;
          var CURRENT_STATE = shared.current;
          var NEXT_STATE = shared.next;
          var block = env.cond(CURRENT_STATE, ".dirty");
          GL_STATE_NAMES.forEach(function(prop) {
            var param = propName(prop);
            if (param in args.state) {
              return;
            }
            var NEXT, CURRENT;
            if (param in NEXT_VARS) {
              NEXT = NEXT_VARS[param];
              CURRENT = CURRENT_VARS[param];
              var parts = loop2(currentState[param].length, function(i) {
                return block.def(NEXT, "[", i, "]");
              });
              block(env.cond(parts.map(function(p, i) {
                return p + "!==" + CURRENT + "[" + i + "]";
              }).join("||")).then(
                GL,
                ".",
                GL_VARIABLES[param],
                "(",
                parts,
                ");",
                parts.map(function(p, i) {
                  return CURRENT + "[" + i + "]=" + p;
                }).join(";"),
                ";"
              ));
            } else {
              NEXT = block.def(NEXT_STATE, ".", param);
              var ifte = env.cond(NEXT, "!==", CURRENT_STATE, ".", param);
              block(ifte);
              if (param in GL_FLAGS) {
                ifte(
                  env.cond(NEXT).then(GL, ".enable(", GL_FLAGS[param], ");").else(GL, ".disable(", GL_FLAGS[param], ");"),
                  CURRENT_STATE,
                  ".",
                  param,
                  "=",
                  NEXT,
                  ";"
                );
              } else {
                ifte(
                  GL,
                  ".",
                  GL_VARIABLES[param],
                  "(",
                  NEXT,
                  ");",
                  CURRENT_STATE,
                  ".",
                  param,
                  "=",
                  NEXT,
                  ";"
                );
              }
            }
          });
          if (Object.keys(args.state).length === 0) {
            block(CURRENT_STATE, ".dirty=false;");
          }
          scope(block);
        }
        function emitSetOptions(env, scope, options, filter) {
          var shared = env.shared;
          var CURRENT_VARS = env.current;
          var CURRENT_STATE = shared.current;
          var GL = shared.gl;
          sortState(Object.keys(options)).forEach(function(param) {
            var defn = options[param];
            if (filter && !filter(defn)) {
              return;
            }
            var variable = defn.append(env, scope);
            if (GL_FLAGS[param]) {
              var flag = GL_FLAGS[param];
              if (isStatic(defn)) {
                if (variable) {
                  scope(GL, ".enable(", flag, ");");
                } else {
                  scope(GL, ".disable(", flag, ");");
                }
              } else {
                scope(env.cond(variable).then(GL, ".enable(", flag, ");").else(GL, ".disable(", flag, ");"));
              }
              scope(CURRENT_STATE, ".", param, "=", variable, ";");
            } else if (isArrayLike(variable)) {
              var CURRENT = CURRENT_VARS[param];
              scope(
                GL,
                ".",
                GL_VARIABLES[param],
                "(",
                variable,
                ");",
                variable.map(function(v2, i) {
                  return CURRENT + "[" + i + "]=" + v2;
                }).join(";"),
                ";"
              );
            } else {
              scope(
                GL,
                ".",
                GL_VARIABLES[param],
                "(",
                variable,
                ");",
                CURRENT_STATE,
                ".",
                param,
                "=",
                variable,
                ";"
              );
            }
          });
        }
        function injectExtensions(env, scope) {
          if (extInstancing) {
            env.instancing = scope.def(
              env.shared.extensions,
              ".angle_instanced_arrays"
            );
          }
        }
        function emitProfile(env, scope, args, useScope, incrementCounter) {
          var shared = env.shared;
          var STATS = env.stats;
          var CURRENT_STATE = shared.current;
          var TIMER = shared.timer;
          var profileArg = args.profile;
          function perfCounter() {
            if (typeof performance === "undefined") {
              return "Date.now()";
            } else {
              return "performance.now()";
            }
          }
          var CPU_START, QUERY_COUNTER;
          function emitProfileStart(block) {
            CPU_START = scope.def();
            block(CPU_START, "=", perfCounter(), ";");
            if (typeof incrementCounter === "string") {
              block(STATS, ".count+=", incrementCounter, ";");
            } else {
              block(STATS, ".count++;");
            }
            if (timer) {
              if (useScope) {
                QUERY_COUNTER = scope.def();
                block(QUERY_COUNTER, "=", TIMER, ".getNumPendingQueries();");
              } else {
                block(TIMER, ".beginQuery(", STATS, ");");
              }
            }
          }
          function emitProfileEnd(block) {
            block(STATS, ".cpuTime+=", perfCounter(), "-", CPU_START, ";");
            if (timer) {
              if (useScope) {
                block(
                  TIMER,
                  ".pushScopeStats(",
                  QUERY_COUNTER,
                  ",",
                  TIMER,
                  ".getNumPendingQueries(),",
                  STATS,
                  ");"
                );
              } else {
                block(TIMER, ".endQuery();");
              }
            }
          }
          function scopeProfile(value) {
            var prev = scope.def(CURRENT_STATE, ".profile");
            scope(CURRENT_STATE, ".profile=", value, ";");
            scope.exit(CURRENT_STATE, ".profile=", prev, ";");
          }
          var USE_PROFILE;
          if (profileArg) {
            if (isStatic(profileArg)) {
              if (profileArg.enable) {
                emitProfileStart(scope);
                emitProfileEnd(scope.exit);
                scopeProfile("true");
              } else {
                scopeProfile("false");
              }
              return;
            }
            USE_PROFILE = profileArg.append(env, scope);
            scopeProfile(USE_PROFILE);
          } else {
            USE_PROFILE = scope.def(CURRENT_STATE, ".profile");
          }
          var start = env.block();
          emitProfileStart(start);
          scope("if(", USE_PROFILE, "){", start, "}");
          var end = env.block();
          emitProfileEnd(end);
          scope.exit("if(", USE_PROFILE, "){", end, "}");
        }
        function emitAttributes(env, scope, args, attributes, filter) {
          var shared = env.shared;
          function typeLength(x2) {
            switch (x2) {
              case GL_FLOAT_VEC2:
              case GL_INT_VEC2:
              case GL_BOOL_VEC2:
                return 2;
              case GL_FLOAT_VEC3:
              case GL_INT_VEC3:
              case GL_BOOL_VEC3:
                return 3;
              case GL_FLOAT_VEC4:
              case GL_INT_VEC4:
              case GL_BOOL_VEC4:
                return 4;
              default:
                return 1;
            }
          }
          function emitBindAttribute(ATTRIBUTE, size, record) {
            var GL = shared.gl;
            var LOCATION = scope.def(ATTRIBUTE, ".location");
            var BINDING = scope.def(shared.attributes, "[", LOCATION, "]");
            var STATE = record.state;
            var BUFFER = record.buffer;
            var CONST_COMPONENTS = [
              record.x,
              record.y,
              record.z,
              record.w
            ];
            var COMMON_KEYS = [
              "buffer",
              "normalized",
              "offset",
              "stride"
            ];
            function emitBuffer() {
              scope(
                "if(!",
                BINDING,
                ".buffer){",
                GL,
                ".enableVertexAttribArray(",
                LOCATION,
                ");}"
              );
              var TYPE = record.type;
              var SIZE;
              if (!record.size) {
                SIZE = size;
              } else {
                SIZE = scope.def(record.size, "||", size);
              }
              scope(
                "if(",
                BINDING,
                ".type!==",
                TYPE,
                "||",
                BINDING,
                ".size!==",
                SIZE,
                "||",
                COMMON_KEYS.map(function(key) {
                  return BINDING + "." + key + "!==" + record[key];
                }).join("||"),
                "){",
                GL,
                ".bindBuffer(",
                GL_ARRAY_BUFFER$2,
                ",",
                BUFFER,
                ".buffer);",
                GL,
                ".vertexAttribPointer(",
                [
                  LOCATION,
                  SIZE,
                  TYPE,
                  record.normalized,
                  record.stride,
                  record.offset
                ],
                ");",
                BINDING,
                ".type=",
                TYPE,
                ";",
                BINDING,
                ".size=",
                SIZE,
                ";",
                COMMON_KEYS.map(function(key) {
                  return BINDING + "." + key + "=" + record[key] + ";";
                }).join(""),
                "}"
              );
              if (extInstancing) {
                var DIVISOR = record.divisor;
                scope(
                  "if(",
                  BINDING,
                  ".divisor!==",
                  DIVISOR,
                  "){",
                  env.instancing,
                  ".vertexAttribDivisorANGLE(",
                  [LOCATION, DIVISOR],
                  ");",
                  BINDING,
                  ".divisor=",
                  DIVISOR,
                  ";}"
                );
              }
            }
            function emitConstant() {
              scope(
                "if(",
                BINDING,
                ".buffer){",
                GL,
                ".disableVertexAttribArray(",
                LOCATION,
                ");",
                BINDING,
                ".buffer=null;",
                "}if(",
                CUTE_COMPONENTS.map(function(c, i) {
                  return BINDING + "." + c + "!==" + CONST_COMPONENTS[i];
                }).join("||"),
                "){",
                GL,
                ".vertexAttrib4f(",
                LOCATION,
                ",",
                CONST_COMPONENTS,
                ");",
                CUTE_COMPONENTS.map(function(c, i) {
                  return BINDING + "." + c + "=" + CONST_COMPONENTS[i] + ";";
                }).join(""),
                "}"
              );
            }
            if (STATE === ATTRIB_STATE_POINTER) {
              emitBuffer();
            } else if (STATE === ATTRIB_STATE_CONSTANT) {
              emitConstant();
            } else {
              scope("if(", STATE, "===", ATTRIB_STATE_POINTER, "){");
              emitBuffer();
              scope("}else{");
              emitConstant();
              scope("}");
            }
          }
          attributes.forEach(function(attribute) {
            var name = attribute.name;
            var arg = args.attributes[name];
            var record;
            if (arg) {
              if (!filter(arg)) {
                return;
              }
              record = arg.append(env, scope);
            } else {
              if (!filter(SCOPE_DECL)) {
                return;
              }
              var scopeAttrib = env.scopeAttrib(name);
              check$1.optional(function() {
                env.assert(
                  scope,
                  scopeAttrib + ".state",
                  "missing attribute " + name
                );
              });
              record = {};
              Object.keys(new AttributeRecord2()).forEach(function(key) {
                record[key] = scope.def(scopeAttrib, ".", key);
              });
            }
            emitBindAttribute(
              env.link(attribute),
              typeLength(attribute.info.type),
              record
            );
          });
        }
        function emitUniforms(env, scope, args, uniforms, filter, isBatchInnerLoop) {
          var shared = env.shared;
          var GL = shared.gl;
          var infix;
          for (var i = 0; i < uniforms.length; ++i) {
            var uniform = uniforms[i];
            var name = uniform.name;
            var type = uniform.info.type;
            var arg = args.uniforms[name];
            var UNIFORM = env.link(uniform);
            var LOCATION = UNIFORM + ".location";
            var VALUE;
            if (arg) {
              if (!filter(arg)) {
                continue;
              }
              if (isStatic(arg)) {
                var value = arg.value;
                check$1.command(
                  value !== null && typeof value !== "undefined",
                  'missing uniform "' + name + '"',
                  env.commandStr
                );
                if (type === GL_SAMPLER_2D || type === GL_SAMPLER_CUBE) {
                  check$1.command(
                    typeof value === "function" && (type === GL_SAMPLER_2D && (value._reglType === "texture2d" || value._reglType === "framebuffer") || type === GL_SAMPLER_CUBE && (value._reglType === "textureCube" || value._reglType === "framebufferCube")),
                    "invalid texture for uniform " + name,
                    env.commandStr
                  );
                  var TEX_VALUE = env.link(value._texture || value.color[0]._texture);
                  scope(GL, ".uniform1i(", LOCATION, ",", TEX_VALUE + ".bind());");
                  scope.exit(TEX_VALUE, ".unbind();");
                } else if (type === GL_FLOAT_MAT2 || type === GL_FLOAT_MAT3 || type === GL_FLOAT_MAT4) {
                  check$1.optional(function() {
                    check$1.command(
                      isArrayLike(value),
                      "invalid matrix for uniform " + name,
                      env.commandStr
                    );
                    check$1.command(
                      type === GL_FLOAT_MAT2 && value.length === 4 || type === GL_FLOAT_MAT3 && value.length === 9 || type === GL_FLOAT_MAT4 && value.length === 16,
                      "invalid length for matrix uniform " + name,
                      env.commandStr
                    );
                  });
                  var MAT_VALUE = env.global.def("new Float32Array([" + Array.prototype.slice.call(value) + "])");
                  var dim = 2;
                  if (type === GL_FLOAT_MAT3) {
                    dim = 3;
                  } else if (type === GL_FLOAT_MAT4) {
                    dim = 4;
                  }
                  scope(
                    GL,
                    ".uniformMatrix",
                    dim,
                    "fv(",
                    LOCATION,
                    ",false,",
                    MAT_VALUE,
                    ");"
                  );
                } else {
                  switch (type) {
                    case GL_FLOAT$8:
                      check$1.commandType(value, "number", "uniform " + name, env.commandStr);
                      infix = "1f";
                      break;
                    case GL_FLOAT_VEC2:
                      check$1.command(
                        isArrayLike(value) && value.length === 2,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "2f";
                      break;
                    case GL_FLOAT_VEC3:
                      check$1.command(
                        isArrayLike(value) && value.length === 3,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "3f";
                      break;
                    case GL_FLOAT_VEC4:
                      check$1.command(
                        isArrayLike(value) && value.length === 4,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "4f";
                      break;
                    case GL_BOOL:
                      check$1.commandType(value, "boolean", "uniform " + name, env.commandStr);
                      infix = "1i";
                      break;
                    case GL_INT$3:
                      check$1.commandType(value, "number", "uniform " + name, env.commandStr);
                      infix = "1i";
                      break;
                    case GL_BOOL_VEC2:
                      check$1.command(
                        isArrayLike(value) && value.length === 2,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "2i";
                      break;
                    case GL_INT_VEC2:
                      check$1.command(
                        isArrayLike(value) && value.length === 2,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "2i";
                      break;
                    case GL_BOOL_VEC3:
                      check$1.command(
                        isArrayLike(value) && value.length === 3,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "3i";
                      break;
                    case GL_INT_VEC3:
                      check$1.command(
                        isArrayLike(value) && value.length === 3,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "3i";
                      break;
                    case GL_BOOL_VEC4:
                      check$1.command(
                        isArrayLike(value) && value.length === 4,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "4i";
                      break;
                    case GL_INT_VEC4:
                      check$1.command(
                        isArrayLike(value) && value.length === 4,
                        "uniform " + name,
                        env.commandStr
                      );
                      infix = "4i";
                      break;
                  }
                  scope(
                    GL,
                    ".uniform",
                    infix,
                    "(",
                    LOCATION,
                    ",",
                    isArrayLike(value) ? Array.prototype.slice.call(value) : value,
                    ");"
                  );
                }
                continue;
              } else {
                VALUE = arg.append(env, scope);
              }
            } else {
              if (!filter(SCOPE_DECL)) {
                continue;
              }
              VALUE = scope.def(shared.uniforms, "[", stringStore.id(name), "]");
            }
            if (type === GL_SAMPLER_2D) {
              check$1(!Array.isArray(VALUE), "must specify a scalar prop for textures");
              scope(
                "if(",
                VALUE,
                "&&",
                VALUE,
                '._reglType==="framebuffer"){',
                VALUE,
                "=",
                VALUE,
                ".color[0];",
                "}"
              );
            } else if (type === GL_SAMPLER_CUBE) {
              check$1(!Array.isArray(VALUE), "must specify a scalar prop for cube maps");
              scope(
                "if(",
                VALUE,
                "&&",
                VALUE,
                '._reglType==="framebufferCube"){',
                VALUE,
                "=",
                VALUE,
                ".color[0];",
                "}"
              );
            }
            check$1.optional(function() {
              function emitCheck(pred, message) {
                env.assert(
                  scope,
                  pred,
                  'bad data or missing for uniform "' + name + '".  ' + message
                );
              }
              function checkType(type2) {
                check$1(!Array.isArray(VALUE), "must not specify an array type for uniform");
                emitCheck(
                  "typeof " + VALUE + '==="' + type2 + '"',
                  "invalid type, expected " + type2
                );
              }
              function checkVector(n, type2) {
                if (Array.isArray(VALUE)) {
                  check$1(VALUE.length === n, "must have length " + n);
                } else {
                  emitCheck(
                    shared.isArrayLike + "(" + VALUE + ")&&" + VALUE + ".length===" + n,
                    "invalid vector, should have length " + n,
                    env.commandStr
                  );
                }
              }
              function checkTexture(target) {
                check$1(!Array.isArray(VALUE), "must not specify a value type");
                emitCheck(
                  "typeof " + VALUE + '==="function"&&' + VALUE + '._reglType==="texture' + (target === GL_TEXTURE_2D$3 ? "2d" : "Cube") + '"',
                  "invalid texture type",
                  env.commandStr
                );
              }
              switch (type) {
                case GL_INT$3:
                  checkType("number");
                  break;
                case GL_INT_VEC2:
                  checkVector(2);
                  break;
                case GL_INT_VEC3:
                  checkVector(3);
                  break;
                case GL_INT_VEC4:
                  checkVector(4);
                  break;
                case GL_FLOAT$8:
                  checkType("number");
                  break;
                case GL_FLOAT_VEC2:
                  checkVector(2);
                  break;
                case GL_FLOAT_VEC3:
                  checkVector(3);
                  break;
                case GL_FLOAT_VEC4:
                  checkVector(4);
                  break;
                case GL_BOOL:
                  checkType("boolean");
                  break;
                case GL_BOOL_VEC2:
                  checkVector(2);
                  break;
                case GL_BOOL_VEC3:
                  checkVector(3);
                  break;
                case GL_BOOL_VEC4:
                  checkVector(4);
                  break;
                case GL_FLOAT_MAT2:
                  checkVector(4);
                  break;
                case GL_FLOAT_MAT3:
                  checkVector(9);
                  break;
                case GL_FLOAT_MAT4:
                  checkVector(16);
                  break;
                case GL_SAMPLER_2D:
                  checkTexture(GL_TEXTURE_2D$3);
                  break;
                case GL_SAMPLER_CUBE:
                  checkTexture(GL_TEXTURE_CUBE_MAP$2);
                  break;
              }
            });
            var unroll = 1;
            switch (type) {
              case GL_SAMPLER_2D:
              case GL_SAMPLER_CUBE:
                var TEX = scope.def(VALUE, "._texture");
                scope(GL, ".uniform1i(", LOCATION, ",", TEX, ".bind());");
                scope.exit(TEX, ".unbind();");
                continue;
              case GL_INT$3:
              case GL_BOOL:
                infix = "1i";
                break;
              case GL_INT_VEC2:
              case GL_BOOL_VEC2:
                infix = "2i";
                unroll = 2;
                break;
              case GL_INT_VEC3:
              case GL_BOOL_VEC3:
                infix = "3i";
                unroll = 3;
                break;
              case GL_INT_VEC4:
              case GL_BOOL_VEC4:
                infix = "4i";
                unroll = 4;
                break;
              case GL_FLOAT$8:
                infix = "1f";
                break;
              case GL_FLOAT_VEC2:
                infix = "2f";
                unroll = 2;
                break;
              case GL_FLOAT_VEC3:
                infix = "3f";
                unroll = 3;
                break;
              case GL_FLOAT_VEC4:
                infix = "4f";
                unroll = 4;
                break;
              case GL_FLOAT_MAT2:
                infix = "Matrix2fv";
                break;
              case GL_FLOAT_MAT3:
                infix = "Matrix3fv";
                break;
              case GL_FLOAT_MAT4:
                infix = "Matrix4fv";
                break;
            }
            if (infix.charAt(0) === "M") {
              scope(GL, ".uniform", infix, "(", LOCATION, ",");
              var matSize = Math.pow(type - GL_FLOAT_MAT2 + 2, 2);
              var STORAGE = env.global.def("new Float32Array(", matSize, ")");
              if (Array.isArray(VALUE)) {
                scope(
                  "false,(",
                  loop2(matSize, function(i2) {
                    return STORAGE + "[" + i2 + "]=" + VALUE[i2];
                  }),
                  ",",
                  STORAGE,
                  ")"
                );
              } else {
                scope(
                  "false,(Array.isArray(",
                  VALUE,
                  ")||",
                  VALUE,
                  " instanceof Float32Array)?",
                  VALUE,
                  ":(",
                  loop2(matSize, function(i2) {
                    return STORAGE + "[" + i2 + "]=" + VALUE + "[" + i2 + "]";
                  }),
                  ",",
                  STORAGE,
                  ")"
                );
              }
              scope(");");
            } else if (unroll > 1) {
              var prev = [];
              var cur = [];
              for (var j = 0; j < unroll; ++j) {
                if (Array.isArray(VALUE)) {
                  cur.push(VALUE[j]);
                } else {
                  cur.push(scope.def(VALUE + "[" + j + "]"));
                }
                if (isBatchInnerLoop) {
                  prev.push(scope.def());
                }
              }
              if (isBatchInnerLoop) {
                scope("if(!", env.batchId, "||", prev.map(function(p, i2) {
                  return p + "!==" + cur[i2];
                }).join("||"), "){", prev.map(function(p, i2) {
                  return p + "=" + cur[i2] + ";";
                }).join(""));
              }
              scope(GL, ".uniform", infix, "(", LOCATION, ",", cur.join(","), ");");
              if (isBatchInnerLoop) {
                scope("}");
              }
            } else {
              check$1(!Array.isArray(VALUE), "uniform value must not be an array");
              if (isBatchInnerLoop) {
                var prevS = scope.def();
                scope(
                  "if(!",
                  env.batchId,
                  "||",
                  prevS,
                  "!==",
                  VALUE,
                  "){",
                  prevS,
                  "=",
                  VALUE,
                  ";"
                );
              }
              scope(GL, ".uniform", infix, "(", LOCATION, ",", VALUE, ");");
              if (isBatchInnerLoop) {
                scope("}");
              }
            }
          }
        }
        function emitDraw(env, outer, inner, args) {
          var shared = env.shared;
          var GL = shared.gl;
          var DRAW_STATE = shared.draw;
          var drawOptions = args.draw;
          function emitElements() {
            var defn = drawOptions.elements;
            var ELEMENTS2;
            var scope = outer;
            if (defn) {
              if (defn.contextDep && args.contextDynamic || defn.propDep) {
                scope = inner;
              }
              ELEMENTS2 = defn.append(env, scope);
              if (drawOptions.elementsActive) {
                scope(
                  "if(" + ELEMENTS2 + ")" + GL + ".bindBuffer(" + GL_ELEMENT_ARRAY_BUFFER$2 + "," + ELEMENTS2 + ".buffer.buffer);"
                );
              }
            } else {
              ELEMENTS2 = scope.def();
              scope(
                ELEMENTS2,
                "=",
                DRAW_STATE,
                ".",
                S_ELEMENTS,
                ";",
                "if(",
                ELEMENTS2,
                "){",
                GL,
                ".bindBuffer(",
                GL_ELEMENT_ARRAY_BUFFER$2,
                ",",
                ELEMENTS2,
                ".buffer.buffer);}",
                "else if(",
                shared.vao,
                ".currentVAO){",
                ELEMENTS2,
                "=",
                env.shared.elements + ".getElements(" + shared.vao,
                ".currentVAO.elements);",
                !extVertexArrays ? "if(" + ELEMENTS2 + ")" + GL + ".bindBuffer(" + GL_ELEMENT_ARRAY_BUFFER$2 + "," + ELEMENTS2 + ".buffer.buffer);" : "",
                "}"
              );
            }
            return ELEMENTS2;
          }
          function emitCount() {
            var defn = drawOptions.count;
            var COUNT2;
            var scope = outer;
            if (defn) {
              if (defn.contextDep && args.contextDynamic || defn.propDep) {
                scope = inner;
              }
              COUNT2 = defn.append(env, scope);
              check$1.optional(function() {
                if (defn.MISSING) {
                  env.assert(outer, "false", "missing vertex count");
                }
                if (defn.DYNAMIC) {
                  env.assert(scope, COUNT2 + ">=0", "missing vertex count");
                }
              });
            } else {
              COUNT2 = scope.def(DRAW_STATE, ".", S_COUNT);
              check$1.optional(function() {
                env.assert(scope, COUNT2 + ">=0", "missing vertex count");
              });
            }
            return COUNT2;
          }
          var ELEMENTS = emitElements();
          function emitValue(name) {
            var defn = drawOptions[name];
            if (defn) {
              if (defn.contextDep && args.contextDynamic || defn.propDep) {
                return defn.append(env, inner);
              } else {
                return defn.append(env, outer);
              }
            } else {
              return outer.def(DRAW_STATE, ".", name);
            }
          }
          var PRIMITIVE = emitValue(S_PRIMITIVE);
          var OFFSET = emitValue(S_OFFSET);
          var COUNT = emitCount();
          if (typeof COUNT === "number") {
            if (COUNT === 0) {
              return;
            }
          } else {
            inner("if(", COUNT, "){");
            inner.exit("}");
          }
          var INSTANCES, EXT_INSTANCING;
          if (extInstancing) {
            INSTANCES = emitValue(S_INSTANCES);
            EXT_INSTANCING = env.instancing;
          }
          var ELEMENT_TYPE = ELEMENTS + ".type";
          var elementsStatic = drawOptions.elements && isStatic(drawOptions.elements) && !drawOptions.vaoActive;
          function emitInstancing() {
            function drawElements() {
              inner(EXT_INSTANCING, ".drawElementsInstancedANGLE(", [
                PRIMITIVE,
                COUNT,
                ELEMENT_TYPE,
                OFFSET + "<<((" + ELEMENT_TYPE + "-" + GL_UNSIGNED_BYTE$8 + ")>>1)",
                INSTANCES
              ], ");");
            }
            function drawArrays() {
              inner(
                EXT_INSTANCING,
                ".drawArraysInstancedANGLE(",
                [PRIMITIVE, OFFSET, COUNT, INSTANCES],
                ");"
              );
            }
            if (ELEMENTS && ELEMENTS !== "null") {
              if (!elementsStatic) {
                inner("if(", ELEMENTS, "){");
                drawElements();
                inner("}else{");
                drawArrays();
                inner("}");
              } else {
                drawElements();
              }
            } else {
              drawArrays();
            }
          }
          function emitRegular() {
            function drawElements() {
              inner(GL + ".drawElements(" + [
                PRIMITIVE,
                COUNT,
                ELEMENT_TYPE,
                OFFSET + "<<((" + ELEMENT_TYPE + "-" + GL_UNSIGNED_BYTE$8 + ")>>1)"
              ] + ");");
            }
            function drawArrays() {
              inner(GL + ".drawArrays(" + [PRIMITIVE, OFFSET, COUNT] + ");");
            }
            if (ELEMENTS && ELEMENTS !== "null") {
              if (!elementsStatic) {
                inner("if(", ELEMENTS, "){");
                drawElements();
                inner("}else{");
                drawArrays();
                inner("}");
              } else {
                drawElements();
              }
            } else {
              drawArrays();
            }
          }
          if (extInstancing && (typeof INSTANCES !== "number" || INSTANCES >= 0)) {
            if (typeof INSTANCES === "string") {
              inner("if(", INSTANCES, ">0){");
              emitInstancing();
              inner("}else if(", INSTANCES, "<0){");
              emitRegular();
              inner("}");
            } else {
              emitInstancing();
            }
          } else {
            emitRegular();
          }
        }
        function createBody(emitBody, parentEnv, args, program, count) {
          var env = createREGLEnvironment();
          var scope = env.proc("body", count);
          check$1.optional(function() {
            env.commandStr = parentEnv.commandStr;
            env.command = env.link(parentEnv.commandStr);
          });
          if (extInstancing) {
            env.instancing = scope.def(
              env.shared.extensions,
              ".angle_instanced_arrays"
            );
          }
          emitBody(env, scope, args, program);
          return env.compile().body;
        }
        function emitDrawBody(env, draw, args, program) {
          injectExtensions(env, draw);
          if (args.useVAO) {
            if (args.drawVAO) {
              draw(env.shared.vao, ".setVAO(", args.drawVAO.append(env, draw), ");");
            } else {
              draw(env.shared.vao, ".setVAO(", env.shared.vao, ".targetVAO);");
            }
          } else {
            draw(env.shared.vao, ".setVAO(null);");
            emitAttributes(env, draw, args, program.attributes, function() {
              return true;
            });
          }
          emitUniforms(env, draw, args, program.uniforms, function() {
            return true;
          }, false);
          emitDraw(env, draw, draw, args);
        }
        function emitDrawProc(env, args) {
          var draw = env.proc("draw", 1);
          injectExtensions(env, draw);
          emitContext(env, draw, args.context);
          emitPollFramebuffer(env, draw, args.framebuffer);
          emitPollState(env, draw, args);
          emitSetOptions(env, draw, args.state);
          emitProfile(env, draw, args, false, true);
          var program = args.shader.progVar.append(env, draw);
          draw(env.shared.gl, ".useProgram(", program, ".program);");
          if (args.shader.program) {
            emitDrawBody(env, draw, args, args.shader.program);
          } else {
            draw(env.shared.vao, ".setVAO(null);");
            var drawCache = env.global.def("{}");
            var PROG_ID = draw.def(program, ".id");
            var CACHED_PROC = draw.def(drawCache, "[", PROG_ID, "]");
            draw(
              env.cond(CACHED_PROC).then(CACHED_PROC, ".call(this,a0);").else(
                CACHED_PROC,
                "=",
                drawCache,
                "[",
                PROG_ID,
                "]=",
                env.link(function(program2) {
                  return createBody(emitDrawBody, env, args, program2, 1);
                }),
                "(",
                program,
                ");",
                CACHED_PROC,
                ".call(this,a0);"
              )
            );
          }
          if (Object.keys(args.state).length > 0) {
            draw(env.shared.current, ".dirty=true;");
          }
          if (env.shared.vao) {
            draw(env.shared.vao, ".setVAO(null);");
          }
        }
        function emitBatchDynamicShaderBody(env, scope, args, program) {
          env.batchId = "a1";
          injectExtensions(env, scope);
          function all() {
            return true;
          }
          emitAttributes(env, scope, args, program.attributes, all);
          emitUniforms(env, scope, args, program.uniforms, all, false);
          emitDraw(env, scope, scope, args);
        }
        function emitBatchBody(env, scope, args, program) {
          injectExtensions(env, scope);
          var contextDynamic = args.contextDep;
          var BATCH_ID = scope.def();
          var PROP_LIST = "a0";
          var NUM_PROPS = "a1";
          var PROPS = scope.def();
          env.shared.props = PROPS;
          env.batchId = BATCH_ID;
          var outer = env.scope();
          var inner = env.scope();
          scope(
            outer.entry,
            "for(",
            BATCH_ID,
            "=0;",
            BATCH_ID,
            "<",
            NUM_PROPS,
            ";++",
            BATCH_ID,
            "){",
            PROPS,
            "=",
            PROP_LIST,
            "[",
            BATCH_ID,
            "];",
            inner,
            "}",
            outer.exit
          );
          function isInnerDefn(defn) {
            return defn.contextDep && contextDynamic || defn.propDep;
          }
          function isOuterDefn(defn) {
            return !isInnerDefn(defn);
          }
          if (args.needsContext) {
            emitContext(env, inner, args.context);
          }
          if (args.needsFramebuffer) {
            emitPollFramebuffer(env, inner, args.framebuffer);
          }
          emitSetOptions(env, inner, args.state, isInnerDefn);
          if (args.profile && isInnerDefn(args.profile)) {
            emitProfile(env, inner, args, false, true);
          }
          if (!program) {
            var progCache = env.global.def("{}");
            var PROGRAM = args.shader.progVar.append(env, inner);
            var PROG_ID = inner.def(PROGRAM, ".id");
            var CACHED_PROC = inner.def(progCache, "[", PROG_ID, "]");
            inner(
              env.shared.gl,
              ".useProgram(",
              PROGRAM,
              ".program);",
              "if(!",
              CACHED_PROC,
              "){",
              CACHED_PROC,
              "=",
              progCache,
              "[",
              PROG_ID,
              "]=",
              env.link(function(program2) {
                return createBody(
                  emitBatchDynamicShaderBody,
                  env,
                  args,
                  program2,
                  2
                );
              }),
              "(",
              PROGRAM,
              ");}",
              CACHED_PROC,
              ".call(this,a0[",
              BATCH_ID,
              "],",
              BATCH_ID,
              ");"
            );
          } else {
            if (args.useVAO) {
              if (args.drawVAO) {
                if (isInnerDefn(args.drawVAO)) {
                  inner(env.shared.vao, ".setVAO(", args.drawVAO.append(env, inner), ");");
                } else {
                  outer(env.shared.vao, ".setVAO(", args.drawVAO.append(env, outer), ");");
                }
              } else {
                outer(env.shared.vao, ".setVAO(", env.shared.vao, ".targetVAO);");
              }
            } else {
              outer(env.shared.vao, ".setVAO(null);");
              emitAttributes(env, outer, args, program.attributes, isOuterDefn);
              emitAttributes(env, inner, args, program.attributes, isInnerDefn);
            }
            emitUniforms(env, outer, args, program.uniforms, isOuterDefn, false);
            emitUniforms(env, inner, args, program.uniforms, isInnerDefn, true);
            emitDraw(env, outer, inner, args);
          }
        }
        function emitBatchProc(env, args) {
          var batch = env.proc("batch", 2);
          env.batchId = "0";
          injectExtensions(env, batch);
          var contextDynamic = false;
          var needsContext = true;
          Object.keys(args.context).forEach(function(name) {
            contextDynamic = contextDynamic || args.context[name].propDep;
          });
          if (!contextDynamic) {
            emitContext(env, batch, args.context);
            needsContext = false;
          }
          var framebuffer = args.framebuffer;
          var needsFramebuffer = false;
          if (framebuffer) {
            if (framebuffer.propDep) {
              contextDynamic = needsFramebuffer = true;
            } else if (framebuffer.contextDep && contextDynamic) {
              needsFramebuffer = true;
            }
            if (!needsFramebuffer) {
              emitPollFramebuffer(env, batch, framebuffer);
            }
          } else {
            emitPollFramebuffer(env, batch, null);
          }
          if (args.state.viewport && args.state.viewport.propDep) {
            contextDynamic = true;
          }
          function isInnerDefn(defn) {
            return defn.contextDep && contextDynamic || defn.propDep;
          }
          emitPollState(env, batch, args);
          emitSetOptions(env, batch, args.state, function(defn) {
            return !isInnerDefn(defn);
          });
          if (!args.profile || !isInnerDefn(args.profile)) {
            emitProfile(env, batch, args, false, "a1");
          }
          args.contextDep = contextDynamic;
          args.needsContext = needsContext;
          args.needsFramebuffer = needsFramebuffer;
          var progDefn = args.shader.progVar;
          if (progDefn.contextDep && contextDynamic || progDefn.propDep) {
            emitBatchBody(
              env,
              batch,
              args,
              null
            );
          } else {
            var PROGRAM = progDefn.append(env, batch);
            batch(env.shared.gl, ".useProgram(", PROGRAM, ".program);");
            if (args.shader.program) {
              emitBatchBody(
                env,
                batch,
                args,
                args.shader.program
              );
            } else {
              batch(env.shared.vao, ".setVAO(null);");
              var batchCache = env.global.def("{}");
              var PROG_ID = batch.def(PROGRAM, ".id");
              var CACHED_PROC = batch.def(batchCache, "[", PROG_ID, "]");
              batch(
                env.cond(CACHED_PROC).then(CACHED_PROC, ".call(this,a0,a1);").else(
                  CACHED_PROC,
                  "=",
                  batchCache,
                  "[",
                  PROG_ID,
                  "]=",
                  env.link(function(program) {
                    return createBody(emitBatchBody, env, args, program, 2);
                  }),
                  "(",
                  PROGRAM,
                  ");",
                  CACHED_PROC,
                  ".call(this,a0,a1);"
                )
              );
            }
          }
          if (Object.keys(args.state).length > 0) {
            batch(env.shared.current, ".dirty=true;");
          }
          if (env.shared.vao) {
            batch(env.shared.vao, ".setVAO(null);");
          }
        }
        function emitScopeProc(env, args) {
          var scope = env.proc("scope", 3);
          env.batchId = "a2";
          var shared = env.shared;
          var CURRENT_STATE = shared.current;
          emitContext(env, scope, args.context);
          if (args.framebuffer) {
            args.framebuffer.append(env, scope);
          }
          sortState(Object.keys(args.state)).forEach(function(name) {
            var defn = args.state[name];
            var value = defn.append(env, scope);
            if (isArrayLike(value)) {
              value.forEach(function(v2, i) {
                scope.set(env.next[name], "[" + i + "]", v2);
              });
            } else {
              scope.set(shared.next, "." + name, value);
            }
          });
          emitProfile(env, scope, args, true, true);
          [S_ELEMENTS, S_OFFSET, S_COUNT, S_INSTANCES, S_PRIMITIVE].forEach(
            function(opt) {
              var variable = args.draw[opt];
              if (!variable) {
                return;
              }
              scope.set(shared.draw, "." + opt, "" + variable.append(env, scope));
            }
          );
          Object.keys(args.uniforms).forEach(function(opt) {
            var value = args.uniforms[opt].append(env, scope);
            if (Array.isArray(value)) {
              value = "[" + value.join() + "]";
            }
            scope.set(
              shared.uniforms,
              "[" + stringStore.id(opt) + "]",
              value
            );
          });
          Object.keys(args.attributes).forEach(function(name) {
            var record = args.attributes[name].append(env, scope);
            var scopeAttrib = env.scopeAttrib(name);
            Object.keys(new AttributeRecord2()).forEach(function(prop) {
              scope.set(scopeAttrib, "." + prop, record[prop]);
            });
          });
          if (args.scopeVAO) {
            scope.set(shared.vao, ".targetVAO", args.scopeVAO.append(env, scope));
          }
          function saveShader(name) {
            var shader = args.shader[name];
            if (shader) {
              scope.set(shared.shader, "." + name, shader.append(env, scope));
            }
          }
          saveShader(S_VERT);
          saveShader(S_FRAG);
          if (Object.keys(args.state).length > 0) {
            scope(CURRENT_STATE, ".dirty=true;");
            scope.exit(CURRENT_STATE, ".dirty=true;");
          }
          scope("a1(", env.shared.context, ",a0,", env.batchId, ");");
        }
        function isDynamicObject(object) {
          if (typeof object !== "object" || isArrayLike(object)) {
            return;
          }
          var props = Object.keys(object);
          for (var i = 0; i < props.length; ++i) {
            if (dynamic.isDynamic(object[props[i]])) {
              return true;
            }
          }
          return false;
        }
        function splatObject(env, options, name) {
          var object = options.static[name];
          if (!object || !isDynamicObject(object)) {
            return;
          }
          var globals = env.global;
          var keys = Object.keys(object);
          var thisDep = false;
          var contextDep = false;
          var propDep = false;
          var objectRef = env.global.def("{}");
          keys.forEach(function(key) {
            var value = object[key];
            if (dynamic.isDynamic(value)) {
              if (typeof value === "function") {
                value = object[key] = dynamic.unbox(value);
              }
              var deps = createDynamicDecl(value, null);
              thisDep = thisDep || deps.thisDep;
              propDep = propDep || deps.propDep;
              contextDep = contextDep || deps.contextDep;
            } else {
              globals(objectRef, ".", key, "=");
              switch (typeof value) {
                case "number":
                  globals(value);
                  break;
                case "string":
                  globals('"', value, '"');
                  break;
                case "object":
                  if (Array.isArray(value)) {
                    globals("[", value.join(), "]");
                  }
                  break;
                default:
                  globals(env.link(value));
                  break;
              }
              globals(";");
            }
          });
          function appendBlock(env2, block) {
            keys.forEach(function(key) {
              var value = object[key];
              if (!dynamic.isDynamic(value)) {
                return;
              }
              var ref2 = env2.invoke(block, value);
              block(objectRef, ".", key, "=", ref2, ";");
            });
          }
          options.dynamic[name] = new dynamic.DynamicVariable(DYN_THUNK, {
            thisDep,
            contextDep,
            propDep,
            ref: objectRef,
            append: appendBlock
          });
          delete options.static[name];
        }
        function compileCommand(options, attributes, uniforms, context, stats2) {
          var env = createREGLEnvironment();
          env.stats = env.link(stats2);
          Object.keys(attributes.static).forEach(function(key) {
            splatObject(env, attributes, key);
          });
          NESTED_OPTIONS.forEach(function(name) {
            splatObject(env, options, name);
          });
          var args = parseArguments(options, attributes, uniforms, context, env);
          emitDrawProc(env, args);
          emitScopeProc(env, args);
          emitBatchProc(env, args);
          return extend2(env.compile(), {
            destroy: function() {
              args.shader.program.destroy();
            }
          });
        }
        return {
          next: nextState,
          current: currentState,
          procs: function() {
            var env = createREGLEnvironment();
            var poll = env.proc("poll");
            var refresh = env.proc("refresh");
            var common = env.block();
            poll(common);
            refresh(common);
            var shared = env.shared;
            var GL = shared.gl;
            var NEXT_STATE = shared.next;
            var CURRENT_STATE = shared.current;
            common(CURRENT_STATE, ".dirty=false;");
            emitPollFramebuffer(env, poll);
            emitPollFramebuffer(env, refresh, null, true);
            var INSTANCING;
            if (extInstancing) {
              INSTANCING = env.link(extInstancing);
            }
            if (extensions.oes_vertex_array_object) {
              refresh(env.link(extensions.oes_vertex_array_object), ".bindVertexArrayOES(null);");
            }
            for (var i = 0; i < limits.maxAttributes; ++i) {
              var BINDING = refresh.def(shared.attributes, "[", i, "]");
              var ifte = env.cond(BINDING, ".buffer");
              ifte.then(
                GL,
                ".enableVertexAttribArray(",
                i,
                ");",
                GL,
                ".bindBuffer(",
                GL_ARRAY_BUFFER$2,
                ",",
                BINDING,
                ".buffer.buffer);",
                GL,
                ".vertexAttribPointer(",
                i,
                ",",
                BINDING,
                ".size,",
                BINDING,
                ".type,",
                BINDING,
                ".normalized,",
                BINDING,
                ".stride,",
                BINDING,
                ".offset);"
              ).else(
                GL,
                ".disableVertexAttribArray(",
                i,
                ");",
                GL,
                ".vertexAttrib4f(",
                i,
                ",",
                BINDING,
                ".x,",
                BINDING,
                ".y,",
                BINDING,
                ".z,",
                BINDING,
                ".w);",
                BINDING,
                ".buffer=null;"
              );
              refresh(ifte);
              if (extInstancing) {
                refresh(
                  INSTANCING,
                  ".vertexAttribDivisorANGLE(",
                  i,
                  ",",
                  BINDING,
                  ".divisor);"
                );
              }
            }
            refresh(
              env.shared.vao,
              ".currentVAO=null;",
              env.shared.vao,
              ".setVAO(",
              env.shared.vao,
              ".targetVAO);"
            );
            Object.keys(GL_FLAGS).forEach(function(flag) {
              var cap = GL_FLAGS[flag];
              var NEXT = common.def(NEXT_STATE, ".", flag);
              var block = env.block();
              block(
                "if(",
                NEXT,
                "){",
                GL,
                ".enable(",
                cap,
                ")}else{",
                GL,
                ".disable(",
                cap,
                ")}",
                CURRENT_STATE,
                ".",
                flag,
                "=",
                NEXT,
                ";"
              );
              refresh(block);
              poll(
                "if(",
                NEXT,
                "!==",
                CURRENT_STATE,
                ".",
                flag,
                "){",
                block,
                "}"
              );
            });
            Object.keys(GL_VARIABLES).forEach(function(name) {
              var func = GL_VARIABLES[name];
              var init = currentState[name];
              var NEXT, CURRENT;
              var block = env.block();
              block(GL, ".", func, "(");
              if (isArrayLike(init)) {
                var n = init.length;
                NEXT = env.global.def(NEXT_STATE, ".", name);
                CURRENT = env.global.def(CURRENT_STATE, ".", name);
                block(
                  loop2(n, function(i2) {
                    return NEXT + "[" + i2 + "]";
                  }),
                  ");",
                  loop2(n, function(i2) {
                    return CURRENT + "[" + i2 + "]=" + NEXT + "[" + i2 + "];";
                  }).join("")
                );
                poll(
                  "if(",
                  loop2(n, function(i2) {
                    return NEXT + "[" + i2 + "]!==" + CURRENT + "[" + i2 + "]";
                  }).join("||"),
                  "){",
                  block,
                  "}"
                );
              } else {
                NEXT = common.def(NEXT_STATE, ".", name);
                CURRENT = common.def(CURRENT_STATE, ".", name);
                block(
                  NEXT,
                  ");",
                  CURRENT_STATE,
                  ".",
                  name,
                  "=",
                  NEXT,
                  ";"
                );
                poll(
                  "if(",
                  NEXT,
                  "!==",
                  CURRENT,
                  "){",
                  block,
                  "}"
                );
              }
              refresh(block);
            });
            return env.compile();
          }(),
          compile: compileCommand
        };
      }
      function stats() {
        return {
          vaoCount: 0,
          bufferCount: 0,
          elementsCount: 0,
          framebufferCount: 0,
          shaderCount: 0,
          textureCount: 0,
          cubeCount: 0,
          renderbufferCount: 0,
          maxTextureUnits: 0
        };
      }
      var GL_QUERY_RESULT_EXT = 34918;
      var GL_QUERY_RESULT_AVAILABLE_EXT = 34919;
      var GL_TIME_ELAPSED_EXT = 35007;
      var createTimer = function(gl, extensions) {
        if (!extensions.ext_disjoint_timer_query) {
          return null;
        }
        var queryPool = [];
        function allocQuery() {
          return queryPool.pop() || extensions.ext_disjoint_timer_query.createQueryEXT();
        }
        function freeQuery(query) {
          queryPool.push(query);
        }
        var pendingQueries = [];
        function beginQuery(stats2) {
          var query = allocQuery();
          extensions.ext_disjoint_timer_query.beginQueryEXT(GL_TIME_ELAPSED_EXT, query);
          pendingQueries.push(query);
          pushScopeStats(pendingQueries.length - 1, pendingQueries.length, stats2);
        }
        function endQuery() {
          extensions.ext_disjoint_timer_query.endQueryEXT(GL_TIME_ELAPSED_EXT);
        }
        function PendingStats() {
          this.startQueryIndex = -1;
          this.endQueryIndex = -1;
          this.sum = 0;
          this.stats = null;
        }
        var pendingStatsPool = [];
        function allocPendingStats() {
          return pendingStatsPool.pop() || new PendingStats();
        }
        function freePendingStats(pendingStats2) {
          pendingStatsPool.push(pendingStats2);
        }
        var pendingStats = [];
        function pushScopeStats(start, end, stats2) {
          var ps = allocPendingStats();
          ps.startQueryIndex = start;
          ps.endQueryIndex = end;
          ps.sum = 0;
          ps.stats = stats2;
          pendingStats.push(ps);
        }
        var timeSum = [];
        var queryPtr = [];
        function update() {
          var ptr, i;
          var n = pendingQueries.length;
          if (n === 0) {
            return;
          }
          queryPtr.length = Math.max(queryPtr.length, n + 1);
          timeSum.length = Math.max(timeSum.length, n + 1);
          timeSum[0] = 0;
          queryPtr[0] = 0;
          var queryTime = 0;
          ptr = 0;
          for (i = 0; i < pendingQueries.length; ++i) {
            var query = pendingQueries[i];
            if (extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_AVAILABLE_EXT)) {
              queryTime += extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_EXT);
              freeQuery(query);
            } else {
              pendingQueries[ptr++] = query;
            }
            timeSum[i + 1] = queryTime;
            queryPtr[i + 1] = ptr;
          }
          pendingQueries.length = ptr;
          ptr = 0;
          for (i = 0; i < pendingStats.length; ++i) {
            var stats2 = pendingStats[i];
            var start = stats2.startQueryIndex;
            var end = stats2.endQueryIndex;
            stats2.sum += timeSum[end] - timeSum[start];
            var startPtr = queryPtr[start];
            var endPtr = queryPtr[end];
            if (endPtr === startPtr) {
              stats2.stats.gpuTime += stats2.sum / 1e6;
              freePendingStats(stats2);
            } else {
              stats2.startQueryIndex = startPtr;
              stats2.endQueryIndex = endPtr;
              pendingStats[ptr++] = stats2;
            }
          }
          pendingStats.length = ptr;
        }
        return {
          beginQuery,
          endQuery,
          pushScopeStats,
          update,
          getNumPendingQueries: function() {
            return pendingQueries.length;
          },
          clear: function() {
            queryPool.push.apply(queryPool, pendingQueries);
            for (var i = 0; i < queryPool.length; i++) {
              extensions.ext_disjoint_timer_query.deleteQueryEXT(queryPool[i]);
            }
            pendingQueries.length = 0;
            queryPool.length = 0;
          },
          restore: function() {
            pendingQueries.length = 0;
            queryPool.length = 0;
          }
        };
      };
      var GL_COLOR_BUFFER_BIT = 16384;
      var GL_DEPTH_BUFFER_BIT = 256;
      var GL_STENCIL_BUFFER_BIT = 1024;
      var GL_ARRAY_BUFFER = 34962;
      var CONTEXT_LOST_EVENT = "webglcontextlost";
      var CONTEXT_RESTORED_EVENT = "webglcontextrestored";
      var DYN_PROP = 1;
      var DYN_CONTEXT = 2;
      var DYN_STATE = 3;
      function find(haystack, needle) {
        for (var i = 0; i < haystack.length; ++i) {
          if (haystack[i] === needle) {
            return i;
          }
        }
        return -1;
      }
      function wrapREGL(args) {
        var config = parseArgs(args);
        if (!config) {
          return null;
        }
        var gl = config.gl;
        var glAttributes = gl.getContextAttributes();
        var contextLost = gl.isContextLost();
        var extensionState = createExtensionCache(gl, config);
        if (!extensionState) {
          return null;
        }
        var stringStore = createStringStore();
        var stats$$1 = stats();
        var extensions = extensionState.extensions;
        var timer = createTimer(gl, extensions);
        var START_TIME = clock();
        var WIDTH = gl.drawingBufferWidth;
        var HEIGHT = gl.drawingBufferHeight;
        var contextState = {
          tick: 0,
          time: 0,
          viewportWidth: WIDTH,
          viewportHeight: HEIGHT,
          framebufferWidth: WIDTH,
          framebufferHeight: HEIGHT,
          drawingBufferWidth: WIDTH,
          drawingBufferHeight: HEIGHT,
          pixelRatio: config.pixelRatio
        };
        var uniformState = {};
        var drawState = {
          elements: null,
          primitive: 4,
          // GL_TRIANGLES
          count: -1,
          offset: 0,
          instances: -1
        };
        var limits = wrapLimits(gl, extensions);
        var bufferState = wrapBufferState(
          gl,
          stats$$1,
          config,
          destroyBuffer
        );
        var elementState = wrapElementsState(gl, extensions, bufferState, stats$$1);
        var attributeState = wrapAttributeState(
          gl,
          extensions,
          limits,
          stats$$1,
          bufferState,
          elementState,
          drawState
        );
        function destroyBuffer(buffer) {
          return attributeState.destroyBuffer(buffer);
        }
        var shaderState = wrapShaderState(gl, stringStore, stats$$1, config);
        var textureState = createTextureSet(
          gl,
          extensions,
          limits,
          function() {
            core.procs.poll();
          },
          contextState,
          stats$$1,
          config
        );
        var renderbufferState = wrapRenderbuffers(gl, extensions, limits, stats$$1, config);
        var framebufferState = wrapFBOState(
          gl,
          extensions,
          limits,
          textureState,
          renderbufferState,
          stats$$1
        );
        var core = reglCore(
          gl,
          stringStore,
          extensions,
          limits,
          bufferState,
          elementState,
          textureState,
          framebufferState,
          uniformState,
          attributeState,
          shaderState,
          drawState,
          contextState,
          timer,
          config
        );
        var readPixels = wrapReadPixels(
          gl,
          framebufferState,
          core.procs.poll,
          contextState,
          glAttributes,
          extensions,
          limits
        );
        var nextState = core.next;
        var canvas = gl.canvas;
        var rafCallbacks = [];
        var lossCallbacks = [];
        var restoreCallbacks = [];
        var destroyCallbacks = [config.onDestroy];
        var activeRAF = null;
        function handleRAF() {
          if (rafCallbacks.length === 0) {
            if (timer) {
              timer.update();
            }
            activeRAF = null;
            return;
          }
          activeRAF = raf2.next(handleRAF);
          poll();
          for (var i = rafCallbacks.length - 1; i >= 0; --i) {
            var cb = rafCallbacks[i];
            if (cb) {
              cb(contextState, null, 0);
            }
          }
          gl.flush();
          if (timer) {
            timer.update();
          }
        }
        function startRAF() {
          if (!activeRAF && rafCallbacks.length > 0) {
            activeRAF = raf2.next(handleRAF);
          }
        }
        function stopRAF() {
          if (activeRAF) {
            raf2.cancel(handleRAF);
            activeRAF = null;
          }
        }
        function handleContextLoss(event) {
          event.preventDefault();
          contextLost = true;
          stopRAF();
          lossCallbacks.forEach(function(cb) {
            cb();
          });
        }
        function handleContextRestored(event) {
          gl.getError();
          contextLost = false;
          extensionState.restore();
          shaderState.restore();
          bufferState.restore();
          textureState.restore();
          renderbufferState.restore();
          framebufferState.restore();
          attributeState.restore();
          if (timer) {
            timer.restore();
          }
          core.procs.refresh();
          startRAF();
          restoreCallbacks.forEach(function(cb) {
            cb();
          });
        }
        if (canvas) {
          canvas.addEventListener(CONTEXT_LOST_EVENT, handleContextLoss, false);
          canvas.addEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored, false);
        }
        function destroy() {
          rafCallbacks.length = 0;
          stopRAF();
          if (canvas) {
            canvas.removeEventListener(CONTEXT_LOST_EVENT, handleContextLoss);
            canvas.removeEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored);
          }
          shaderState.clear();
          framebufferState.clear();
          renderbufferState.clear();
          attributeState.clear();
          textureState.clear();
          elementState.clear();
          bufferState.clear();
          if (timer) {
            timer.clear();
          }
          destroyCallbacks.forEach(function(cb) {
            cb();
          });
        }
        function compileProcedure(options) {
          check$1(!!options, "invalid args to regl({...})");
          check$1.type(options, "object", "invalid args to regl({...})");
          function flattenNestedOptions(options2) {
            var result = extend2({}, options2);
            delete result.uniforms;
            delete result.attributes;
            delete result.context;
            delete result.vao;
            if ("stencil" in result && result.stencil.op) {
              result.stencil.opBack = result.stencil.opFront = result.stencil.op;
              delete result.stencil.op;
            }
            function merge(name) {
              if (name in result) {
                var child = result[name];
                delete result[name];
                Object.keys(child).forEach(function(prop) {
                  result[name + "." + prop] = child[prop];
                });
              }
            }
            merge("blend");
            merge("depth");
            merge("cull");
            merge("stencil");
            merge("polygonOffset");
            merge("scissor");
            merge("sample");
            if ("vao" in options2) {
              result.vao = options2.vao;
            }
            return result;
          }
          function separateDynamic(object, useArrays) {
            var staticItems = {};
            var dynamicItems = {};
            Object.keys(object).forEach(function(option) {
              var value = object[option];
              if (dynamic.isDynamic(value)) {
                dynamicItems[option] = dynamic.unbox(value, option);
                return;
              } else if (useArrays && Array.isArray(value)) {
                for (var i = 0; i < value.length; ++i) {
                  if (dynamic.isDynamic(value[i])) {
                    dynamicItems[option] = dynamic.unbox(value, option);
                    return;
                  }
                }
              }
              staticItems[option] = value;
            });
            return {
              dynamic: dynamicItems,
              static: staticItems
            };
          }
          var context = separateDynamic(options.context || {}, true);
          var uniforms = separateDynamic(options.uniforms || {}, true);
          var attributes = separateDynamic(options.attributes || {}, false);
          var opts = separateDynamic(flattenNestedOptions(options), false);
          var stats$$12 = {
            gpuTime: 0,
            cpuTime: 0,
            count: 0
          };
          var compiled = core.compile(opts, attributes, uniforms, context, stats$$12);
          var draw = compiled.draw;
          var batch = compiled.batch;
          var scope = compiled.scope;
          var EMPTY_ARRAY = [];
          function reserve(count) {
            while (EMPTY_ARRAY.length < count) {
              EMPTY_ARRAY.push(null);
            }
            return EMPTY_ARRAY;
          }
          function REGLCommand(args2, body) {
            var i;
            if (contextLost) {
              check$1.raise("context lost");
            }
            if (typeof args2 === "function") {
              return scope.call(this, null, args2, 0);
            } else if (typeof body === "function") {
              if (typeof args2 === "number") {
                for (i = 0; i < args2; ++i) {
                  scope.call(this, null, body, i);
                }
              } else if (Array.isArray(args2)) {
                for (i = 0; i < args2.length; ++i) {
                  scope.call(this, args2[i], body, i);
                }
              } else {
                return scope.call(this, args2, body, 0);
              }
            } else if (typeof args2 === "number") {
              if (args2 > 0) {
                return batch.call(this, reserve(args2 | 0), args2 | 0);
              }
            } else if (Array.isArray(args2)) {
              if (args2.length) {
                return batch.call(this, args2, args2.length);
              }
            } else {
              return draw.call(this, args2);
            }
          }
          return extend2(REGLCommand, {
            stats: stats$$12,
            destroy: function() {
              compiled.destroy();
            }
          });
        }
        var setFBO = framebufferState.setFBO = compileProcedure({
          framebuffer: dynamic.define.call(null, DYN_PROP, "framebuffer")
        });
        function clearImpl(_, options) {
          var clearFlags = 0;
          core.procs.poll();
          var c = options.color;
          if (c) {
            gl.clearColor(+c[0] || 0, +c[1] || 0, +c[2] || 0, +c[3] || 0);
            clearFlags |= GL_COLOR_BUFFER_BIT;
          }
          if ("depth" in options) {
            gl.clearDepth(+options.depth);
            clearFlags |= GL_DEPTH_BUFFER_BIT;
          }
          if ("stencil" in options) {
            gl.clearStencil(options.stencil | 0);
            clearFlags |= GL_STENCIL_BUFFER_BIT;
          }
          check$1(!!clearFlags, "called regl.clear with no buffer specified");
          gl.clear(clearFlags);
        }
        function clear(options) {
          check$1(
            typeof options === "object" && options,
            "regl.clear() takes an object as input"
          );
          if ("framebuffer" in options) {
            if (options.framebuffer && options.framebuffer_reglType === "framebufferCube") {
              for (var i = 0; i < 6; ++i) {
                setFBO(extend2({
                  framebuffer: options.framebuffer.faces[i]
                }, options), clearImpl);
              }
            } else {
              setFBO(options, clearImpl);
            }
          } else {
            clearImpl(null, options);
          }
        }
        function frame(cb) {
          check$1.type(cb, "function", "regl.frame() callback must be a function");
          rafCallbacks.push(cb);
          function cancel2() {
            var i = find(rafCallbacks, cb);
            check$1(i >= 0, "cannot cancel a frame twice");
            function pendingCancel() {
              var index = find(rafCallbacks, pendingCancel);
              rafCallbacks[index] = rafCallbacks[rafCallbacks.length - 1];
              rafCallbacks.length -= 1;
              if (rafCallbacks.length <= 0) {
                stopRAF();
              }
            }
            rafCallbacks[i] = pendingCancel;
          }
          startRAF();
          return {
            cancel: cancel2
          };
        }
        function pollViewport() {
          var viewport = nextState.viewport;
          var scissorBox = nextState.scissor_box;
          viewport[0] = viewport[1] = scissorBox[0] = scissorBox[1] = 0;
          contextState.viewportWidth = contextState.framebufferWidth = contextState.drawingBufferWidth = viewport[2] = scissorBox[2] = gl.drawingBufferWidth;
          contextState.viewportHeight = contextState.framebufferHeight = contextState.drawingBufferHeight = viewport[3] = scissorBox[3] = gl.drawingBufferHeight;
        }
        function poll() {
          contextState.tick += 1;
          contextState.time = now2();
          pollViewport();
          core.procs.poll();
        }
        function refresh() {
          textureState.refresh();
          pollViewport();
          core.procs.refresh();
          if (timer) {
            timer.update();
          }
        }
        function now2() {
          return (clock() - START_TIME) / 1e3;
        }
        refresh();
        function addListener(event, callback) {
          check$1.type(callback, "function", "listener callback must be a function");
          var callbacks;
          switch (event) {
            case "frame":
              return frame(callback);
            case "lost":
              callbacks = lossCallbacks;
              break;
            case "restore":
              callbacks = restoreCallbacks;
              break;
            case "destroy":
              callbacks = destroyCallbacks;
              break;
            default:
              check$1.raise("invalid event, must be one of frame,lost,restore,destroy");
          }
          callbacks.push(callback);
          return {
            cancel: function() {
              for (var i = 0; i < callbacks.length; ++i) {
                if (callbacks[i] === callback) {
                  callbacks[i] = callbacks[callbacks.length - 1];
                  callbacks.pop();
                  return;
                }
              }
            }
          };
        }
        var regl2 = extend2(compileProcedure, {
          // Clear current FBO
          clear,
          // Short cuts for dynamic variables
          prop: dynamic.define.bind(null, DYN_PROP),
          context: dynamic.define.bind(null, DYN_CONTEXT),
          this: dynamic.define.bind(null, DYN_STATE),
          // executes an empty draw command
          draw: compileProcedure({}),
          // Resources
          buffer: function(options) {
            return bufferState.create(options, GL_ARRAY_BUFFER, false, false);
          },
          elements: function(options) {
            return elementState.create(options, false);
          },
          texture: textureState.create2D,
          cube: textureState.createCube,
          renderbuffer: renderbufferState.create,
          framebuffer: framebufferState.create,
          framebufferCube: framebufferState.createCube,
          vao: attributeState.createVAO,
          // Expose context attributes
          attributes: glAttributes,
          // Frame rendering
          frame,
          on: addListener,
          // System limits
          limits,
          hasExtension: function(name) {
            return limits.extensions.indexOf(name.toLowerCase()) >= 0;
          },
          // Read pixels
          read: readPixels,
          // Destroy regl and all associated resources
          destroy,
          // Direct GL state manipulation
          _gl: gl,
          _refresh: refresh,
          poll: function() {
            poll();
            if (timer) {
              timer.update();
            }
          },
          // Current time
          now: now2,
          // regl Statistics Information
          stats: stats$$1
        });
        config.onDone(null, regl2);
        return regl2;
      }
      return wrapREGL;
    });
  })(regl$2);
  return regl$2.exports;
}
var reglExports = requireRegl();
const regl = /* @__PURE__ */ getDefaultExportFromCjs(reglExports);
class FBOToCanvas {
  constructor(canvas, device) {
    this.canvas = canvas;
    this.device = device;
    this.context = this.canvas.getContext("webgpu");
    this.aspect = this.canvas.width / this.canvas.height;
  }
  async setupFromScratch() {
    if (!navigator.gpu) {
      console.error("WebGPU is not supported on this browser.");
      return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("Failed to get GPU adapter.");
      return;
    }
    this.device = await adapter.requestDevice();
    let fru = "./fritzpix.jpg";
    let fritzPic = await createTextureFromImage(this.device, fru, {
      flipY: true
    });
    this.sourceTexture = fritzPic;
  }
  async initializeFBOdrawing() {
    if (!this.device) await this.setupFromScratch();
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format,
      alphaMode: "opaque"
    });
    const codePrefix = `
	 struct VertexOutput {
  	@builtin(position) position : vec4f,
  	@location(0) texcoord : vec2f,
	 };
   @group(0) @binding(0) var ourSamp: sampler;
	 @group(0) @binding(1) var ourTex:  texture_2d<f32>;
`;
    const vertexShaderCode2 = codePrefix + `
        @vertex
        fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var positions = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, -1.0 ),

            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, 1.0)
          );
         var output : VertexOutput;
         output.position = vec4<f32>( positions[vertexIndex], 0.0, 1);
         output.texcoord = positions[vertexIndex] / 2 + 0.5; // positions are -1.0 to 1.0, texcoords are 0.0 to 1.0.
         return output;
        }
      `;
    const fragmentShaderCode = codePrefix + `
        @fragment
        fn main(ourIn: VertexOutput) -> @location(0) vec4<f32> {
          var uv :vec2<f32>;
          uv = ourIn.texcoord; //* ourStruct.scale + ourStruct.offset;
          return textureSample(ourTex, ourSamp, uv);
        }
      `;
    const vertexShaderModule = this.device.createShaderModule({ label: "vertFBO", code: vertexShaderCode2 });
    const fragmentShaderModule = this.device.createShaderModule({ label: "fragFBO", code: fragmentShaderCode });
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      label: "FBOtextureBindGroupLayout",
      entries: [
        {
          binding: 0,
          // Binding index for sampler.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          sampler: {
            type: "filtering"
          }
        },
        {
          binding: 1,
          // Binding index for texture.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false
          }
        }
      ]
    });
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.textureBindGroupLayout]
    });
    this.pipeline = this.device.createRenderPipeline({
      label: "FBOrenderpipeline",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main"
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format }]
      },
      primitive: {
        topology: "triangle-list"
      },
      layout: this.pipelineLayout
    });
    this.sampler = this.device.createSampler();
  }
  refreshCanvas(tex) {
    if (tex) this.sourceTexture = tex;
    if (!this.sourceTexture) return;
    this.textureBindGroup = this.device.createBindGroup({
      label: "texture bind group",
      layout: this.textureBindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.sourceTexture.createView() }
      ]
    });
    const canvasTextureView = this.context.getCurrentTexture().createView();
    this.renderPassDescriptor = {
      label: "FBOrenderPassDescriptor",
      colorAttachments: [{
        label: "FBO canvas textureView attachment",
        view: canvasTextureView,
        clearValue: { r: 1, g: 1, b: 1, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }]
    };
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.textureBindGroup);
    passEncoder.draw(6);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
class FBO4ToCanvas {
  constructor(canvas, device) {
    this.canvas = canvas;
    this.device = device;
    this.context = this.canvas.getContext("webgpu");
    this.aspect = this.canvas.width / this.canvas.height;
  }
  async setupFromScratch() {
    if (!navigator.gpu) {
      console.error("WebGPU is not supported on this browser.");
      return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("Failed to get GPU adapter.");
      return;
    }
    this.device = await adapter.requestDevice();
  }
  async initializeFBOdrawing() {
    if (!this.device) await this.setupFromScratch();
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format,
      alphaMode: "opaque"
    });
    const codePrefix = `
	 struct VertexOutput {
  	@builtin(position) position : vec4f,
  	@location(0) texcoord : vec2f,
	 };
   @group(0) @binding(0) var ourSamp0: sampler;
	 @group(0) @binding(1) var ourTex0:  texture_2d<f32>;
   @group(0) @binding(2) var ourSamp1: sampler;
	 @group(0) @binding(3) var ourTex1:  texture_2d<f32>;
   @group(0) @binding(4) var ourSamp2: sampler;
	 @group(0) @binding(5) var ourTex2:  texture_2d<f32>;
	 @group(0) @binding(6) var ourSamp3: sampler;
	 @group(0) @binding(7) var ourTex3:  texture_2d<f32>;
`;
    const vertexShaderCode2 = codePrefix + `
        @vertex
        fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var positions = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, -1.0 ),

            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, 1.0)
          );
         var output : VertexOutput;
         output.position = vec4<f32>( positions[vertexIndex], 0.0, 1);
         output.texcoord = positions[vertexIndex] / 2 + 0.5; // positions are -1.0 to 1.0, texcoords are 0.0 to 1.0.
         return output;
        }
      `;
    const fragmentShaderCode = codePrefix + `
        @fragment
        fn main(ourIn: VertexOutput) -> @location(0) vec4<f32> {
         var uv :vec2<f32>;
         uv = ourIn.texcoord; //* ourStruct.scale + ourStruct.offset;

        var st = vec2<f32>(uv.x, uv.y);
        st = st * vec2<f32>(2.0);
        let q = floor(st).xy*(vec2<f32>(2.0, 1.0));
        let quad : i32 = i32(q.x) + i32(q.y);
        st.x =  st.x + step(1., st.y % 2.0);
        st.y = st.y + step(1., st.x %2.0);
        st = fract(st);

        let val0 = textureSample(ourTex0, ourSamp0, st);
        let val1 = textureSample(ourTex1, ourSamp1, st);
        let val2 = textureSample(ourTex2, ourSamp2, st);
        let val3 = textureSample(ourTex3, ourSamp3, st);
   
        if(quad == 0){ // LLHC
					return val1;
        } else if (quad == 1) { // ULHC
					return val0;
        } else if (quad == 2){ // LRHC
					return val3;
        } else {
  				return val2; // URHC
        }
      }
`;
    const vertexShaderModule = this.device.createShaderModule({ label: "vertFBO", code: vertexShaderCode2 });
    const fragmentShaderModule = this.device.createShaderModule({ label: "fragFBO", code: fragmentShaderCode });
    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      label: "FBOtextureBindGroupLayout",
      entries: [
        //  0
        {
          binding: 0,
          // Binding index for sampler.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          sampler: {
            type: "filtering"
          }
        },
        {
          binding: 1,
          // Binding index for texture 0 
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false
          }
        },
        // 1
        {
          binding: 2,
          // Binding index for sampler.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          sampler: {
            type: "filtering"
          }
        },
        {
          binding: 3,
          // Binding index for texture 1
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false
          }
        },
        // 2
        {
          binding: 4,
          // Binding index for sampler.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          sampler: {
            type: "filtering"
          }
        },
        {
          binding: 5,
          // Binding index for texture 2
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false
          }
        },
        // 3   	
        {
          binding: 6,
          // Binding index for sampler.
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          sampler: {
            type: "filtering"
          }
        },
        {
          binding: 7,
          // Binding index for texture 3
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          texture: {
            sampleType: "float",
            viewDimension: "2d",
            multisampled: false
          }
        }
      ]
    });
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.textureBindGroupLayout]
    });
    this.pipeline = this.device.createRenderPipeline({
      label: "FBOrenderpipeline",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main"
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format }]
      },
      primitive: {
        topology: "triangle-list"
      },
      layout: this.pipelineLayout
    });
    this.sampler0 = this.device.createSampler();
    this.sampler1 = this.device.createSampler();
    this.sampler2 = this.device.createSampler();
    this.sampler3 = this.device.createSampler();
  }
  refreshCanvases(tex0, tex1, tex2, tex3) {
    if (!tex0 || !tex1 || !tex2 || !tex3) return;
    this.textureBindGroup = this.device.createBindGroup({
      label: "texture bind group",
      layout: this.textureBindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler0 },
        { binding: 1, resource: tex0.createView() },
        { binding: 2, resource: this.sampler1 },
        { binding: 3, resource: tex1.createView() },
        { binding: 4, resource: this.sampler2 },
        { binding: 5, resource: tex2.createView() },
        { binding: 6, resource: this.sampler3 },
        { binding: 7, resource: tex3.createView() }
      ]
    });
    const canvasTextureView = this.context.getCurrentTexture().createView();
    this.renderPassDescriptor = {
      label: "FBOrenderPassDescriptor",
      colorAttachments: [{
        label: "FBO canvas textureView attachment",
        view: canvasTextureView,
        clearValue: { r: 1, g: 1, b: 1, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }]
    };
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.textureBindGroup);
    passEncoder.draw(6);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
const vertexPrefix = `
	 struct VertexOutput {
  	@builtin(position) position : vec4f,
  	@location(0) texcoord : vec2f,
  	@location(1) faceId : f32,
  	// Vertex data for fragment shader
  	@location(2) v_position : vec3f,
  	@location(3) v_normal : vec3f,
  	@location(4) v_worldNormal : vec3f,
  	@location(5) v_tangent : vec3f,
  	@location(6) v_bitangent : vec3f,
  	@location(7) v_viewDir : vec3f,
  	@location(8) v_depth : f32,
	 };
`;
const fragPrefix = `
   @group(0) @binding(0) var<uniform> time: f32;
   @group(0) @binding(1) var<uniform> resolution: vec2<f32>;
   @group(0) @binding(2) var<uniform> mouse: vec2<f32>;
   @group(0) @binding(3) var<uniform> u_spriteUV: vec4<f32>;
   @group(0) @binding(4) var<uniform> u_spriteGrid: vec2<f32>;
`;
const vertexShaderCode = vertexPrefix + `
    @vertex
    fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
      var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0),

        vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0)
      );

     var output : VertexOutput;
     output.position = vec4<f32>( positions[vertexIndex], 0.0, 1.0);
     output.texcoord = positions[vertexIndex] / 2.0 + 0.5; // positions are -1 to 1, texcoords are 0
     output.faceId = 0.0;

     // Default vertex data for fullscreen quad
     output.v_position = vec3f(positions[vertexIndex], 0.0);
     output.v_normal = vec3f(0.0, 0.0, 1.0);
     output.v_worldNormal = vec3f(0.0, 0.0, 1.0);
     output.v_tangent = vec3f(1.0, 0.0, 0.0);
     output.v_bitangent = vec3f(0.0, 1.0, 0.0);
     output.v_viewDir = vec3f(0.0, 0.0, 1.0);
     output.v_depth = 1.0;

     return output;
    }
`;
class SpritePassEntry {
  constructor(chan, level) {
    this.chan = chan;
    this.level = level;
    this.reset();
  }
  reset() {
    this.fragmentShaderSource = void 0;
    this.fragmentShaderModule = void 0;
    this.vertexShaderModule = void 0;
    this.pipelineLayout = void 0;
    this.pipeline = void 0;
    this.uniformList = void 0;
    this.channelUniforms = [];
    this.textureUniforms = [];
    this.valueUniforms = [];
    this.bindGroupHeader = void 0;
    this.bindGroupLayout = void 0;
    this.hasValueUniforms = false;
    this.structString = void 0;
    this.valueStructView = void 0;
    this.structUniformBuffer = void 0;
    this.hasCustomGeometry = false;
    this.vertexBuffer = void 0;
    this.uvBuffer = void 0;
    this.faceIdBuffer = void 0;
    this.normalBuffer = void 0;
    this.tangentBuffer = void 0;
    this.vertexCount = 0;
    this.vertexWgsl = void 0;
    this.vertexUniforms = [];
    this.vertexUniformBuffer = void 0;
    this.vertexUniformView = void 0;
    this.vertexBindGroupLayout = void 0;
    this.vertexBindGroup = void 0;
    this.hasExplicitUVs = false;
    this.hasFaceIds = false;
    this.hasNormals = false;
    this.hasTangents = false;
    this.blendMode = "normal";
  }
}
class RenderPassEntry {
  constructor(chan) {
    this.chan = chan;
    this.channelTexInfo = [];
    this.sprites = /* @__PURE__ */ new Map();
    this.reset();
  }
  reset() {
    this.pingPongs = 0;
    this.fragmentShaderSource = void 0;
    this.fragmentShaderModule = void 0;
    this.pipelineLayout = void 0;
    this.pipeline = void 0;
    this.uniformList = void 0;
    this.channelUniforms = [];
    this.textureUniforms = [];
    this.valueUniforms = [];
    this.bindGroupHeader = void 0;
    this.bindGroupLayout = void 0;
    this.hasValueUniforms = false;
    this.structString = void 0;
    this.valueStructView = void 0;
    this.structUniformBuffer = void 0;
    this.sprites.clear();
  }
}
class wgslHydra {
  // externalDevice: optional GPUDevice for sharing textures between Hydra instances
  constructor(hydra, canvas, numChannels = 4, externalDevice = null) {
    this.hydra = hydra;
    this.canvas = canvas;
    this.context = this.canvas.getContext("webgpu");
    this.externalDevice = externalDevice;
    this.aspect = this.canvas.width / this.canvas.height;
    this.numChannels = numChannels ? numChannels : 4;
    this.renderPassInfo = new Array(numChannels);
    for (let i = 0; i < numChannels; ++i) this.renderPassInfo[i] = new RenderPassEntry(i);
    this.time = 0;
    this.mousePos = { x: 0, y: 0 };
    this.showQuad = false;
    this.outChannel = 0;
  }
  relayUniformInfo(mouse2) {
    this.mousePos = mouse2;
  }
  // Changes the destination canvas size and the outputs too.
  async resizeOutputsTo(width, height) {
    this.canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
    this.canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));
    this.createOutputTextures();
    this.fboRenderer = new FBOToCanvas(this.canvas, this.device);
    this.fbo4Renderer = new FBO4ToCanvas(this.canvas, this.device);
    await this.fboRenderer.initializeFBOdrawing();
    await this.fbo4Renderer.initializeFBOdrawing();
  }
  createOutputTextures() {
    this.outputChannelObjects = this.hydra.o;
    this.destTextureDescriptor = {
      size: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      mipLevelCount: 1,
      format: this.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    };
    for (let chan = 0; chan < this.numChannels; ++chan) {
      let outp = this.outputChannelObjects[chan];
      outp.createTexturesAndViews(this.device, this.destTextureDescriptor);
    }
  }
  // Lazily create depth texture for 3D rendering
  ensureDepthTexture() {
    if (this.depthTexture) return;
    this.depthTexture = this.device.createTexture({
      label: "depthTexture",
      size: { width: this.canvas.width, height: this.canvas.height },
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.depthTextureView = this.depthTexture.createView();
  }
  async setupHydra() {
    if (!navigator.gpu) {
      console.error("WebGPU is not supported on this browser.");
      return;
    }
    if (this.externalDevice) {
      this.device = this.externalDevice;
      console.log("wgslHydra: Using shared external GPUDevice");
    } else {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error("Failed to get GPU adapter.");
        return;
      }
      const hasBGRA8unormStorage = adapter.features.has("bgra8unorm-storage");
      this.device = await adapter.requestDevice({
        requiredFeatures: hasBGRA8unormStorage ? ["bgra8unorm-storage"] : []
      });
    }
    this.fboRenderer = new FBOToCanvas(this.canvas, this.device);
    this.fbo4Renderer = new FBO4ToCanvas(this.canvas, this.device);
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque",
      //premultiplied / opaque
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.dummyTexture = await this.device.createTexture({
      size: [320, 240],
      format: this.format,
      // was "rgba8unorm"
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.sharedBindGroupLayout = this.device.createBindGroupLayout({
      label: "",
      entries: [
        {
          binding: 0,
          // Binding index for time.
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          buffer: { type: "uniform" }
          // Resource type
        },
        {
          binding: 1,
          // Binding index "resolution"
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          buffer: { type: "uniform" }
          // Resource type
        },
        {
          binding: 2,
          // Binding index "mouse"
          visibility: GPUShaderStage.FRAGMENT,
          // Shader stages where this binding is used
          buffer: { type: "uniform" }
          // Resource type
        },
        {
          binding: 3,
          // Binding index "u_spriteUV"
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" }
        },
        {
          binding: 4,
          // Binding index "u_spriteGrid"
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" }
        }
      ]
    });
    this.timeUniformBuffer = this.device.createBuffer({
      label: "time uniform buffer",
      size: 4,
      // 32-bit float is 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.timeUniformValues = new Float32Array(1);
    this.resolutionUniformBuffer = this.device.createBuffer({
      label: "resolution uniform buffer",
      size: 8,
      // 2 x 32-bit float
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.resolutionUniformValues = new Float32Array(2);
    this.mouseUniformBuffer = this.device.createBuffer({
      label: "mouse uniform buffer",
      size: 8,
      // 2 x 32-bit float
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.mouseUniformValues = new Float32Array(2);
    this.spriteUVUniformBuffer = this.device.createBuffer({
      label: "spriteUV uniform buffer",
      size: 16,
      // 4 x 32-bit float
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.spriteUVUniformValues = new Float32Array([0, 0, 1, 1]);
    this.spriteGridUniformBuffer = this.device.createBuffer({
      label: "spriteGrid uniform buffer",
      size: 8,
      // 2 x 32-bit float
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.spriteGridUniformValues = new Float32Array([1, 1]);
    this.sharedBindGroup = this.device.createBindGroup({
      label: "shared bind group",
      layout: this.sharedBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.timeUniformBuffer }
          // Resource for the binding
        },
        {
          binding: 1,
          resource: { buffer: this.resolutionUniformBuffer }
          // Resource for the binding
        },
        {
          binding: 2,
          resource: { buffer: this.mouseUniformBuffer }
          // Resource for the binding
        },
        {
          binding: 3,
          resource: { buffer: this.spriteUVUniformBuffer }
        },
        {
          binding: 4,
          resource: { buffer: this.spriteGridUniformBuffer }
        }
      ]
    });
    this.createOutputTextures();
    this.vertexShaderModule = this.device.createShaderModule({ label: "wgslvertex", code: vertexShaderCode });
    await this.fboRenderer.initializeFBOdrawing();
    await this.fbo4Renderer.initializeFBOdrawing();
  }
  // ------------------------------------------------------------------------------
  // set up a output render chain for a given channel number, uniforms list, and fragment shader string
  //
  async setupHydraChain(chan, uniforms, shader) {
    const rpe = this.renderPassInfo[chan];
    rpe.reset();
    rpe.outputObject = this.outputChannelObjects[chan];
    rpe.uniformList = uniforms;
    this.generateUniformDeclarations(chan);
    rpe.fragmentShaderSource = vertexPrefix + fragPrefix + rpe.bindGroupHeader + shader;
    rpe.fragmentShaderModule = this.device.createShaderModule({ label: "wgslsfrag", code: rpe.fragmentShaderSource });
    rpe.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.sharedBindGroupLayout, rpe.bindGroupLayout]
    });
    rpe.pipeline = this.device.createRenderPipeline({
      label: "pipeline " + chan,
      vertex: {
        module: this.vertexShaderModule,
        entryPoint: "main"
      },
      fragment: {
        module: rpe.fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: "triangle-list"
      },
      layout: rpe.pipelineLayout
    });
    this.createSamplerOrBuffersForChan(chan);
  }
  // ------------------------------------------------------------------------------
  // Setup a sprite render chain with optional custom geometry and vertex shader
  //
  async setupSpriteChain(chan, spriteLevel, config) {
    const {
      uniforms,
      fragShader,
      vertexWgsl,
      vertexUniforms,
      rawVerts,
      blendMode,
      primitive,
      has3D,
      hasExplicitUVs,
      hasFaceIds,
      hasNormals,
      hasTangents,
      uvs,
      faceIds,
      normals,
      tangents,
      sprite
    } = config;
    const rpe = this.renderPassInfo[chan];
    rpe.outputObject = this.outputChannelObjects[chan];
    let spe = rpe.sprites.get(spriteLevel);
    if (!spe) {
      spe = new SpritePassEntry(chan, spriteLevel);
      rpe.sprites.set(spriteLevel, spe);
    } else {
      spe.reset();
    }
    spe.uniformList = uniforms;
    spe.blendMode = blendMode || "normal";
    spe.hasCustomGeometry = rawVerts !== null && rawVerts !== void 0;
    spe.hasExplicitUVs = hasExplicitUVs || false;
    spe.hasFaceIds = hasFaceIds || false;
    spe.hasNormals = hasNormals || false;
    spe.hasTangents = hasTangents || false;
    spe.sprite = sprite || null;
    this.generateSpriteUniformDeclarations(spe);
    spe.fragmentShaderSource = vertexPrefix + fragPrefix + spe.bindGroupHeader + fragShader;
    spe.fragmentShaderModule = this.device.createShaderModule({
      label: `frag_c${chan}_s${spriteLevel}`,
      code: spe.fragmentShaderSource
    });
    if (spe.hasCustomGeometry && vertexWgsl) {
      spe.vertexWgsl = vertexWgsl;
      spe.vertexUniforms = vertexUniforms || [];
      spe.has3D = has3D || false;
      spe.vertexShaderModule = this.device.createShaderModule({
        label: `vert_c${chan}_s${spriteLevel}`,
        code: vertexWgsl
      });
      const verts = this.reshapeToVec3(rawVerts, spe.has3D);
      spe.vertexCount = verts.length;
      const vertexData = new Float32Array(verts.flat());
      spe.vertexBuffer = this.device.createBuffer({
        label: `vertbuf_c${chan}_s${spriteLevel}`,
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(spe.vertexBuffer, 0, vertexData);
      if (spe.hasExplicitUVs && uvs && uvs.length > 0) {
        const uvData = new Float32Array(uvs);
        spe.uvBuffer = this.device.createBuffer({
          label: `uvbuf_c${chan}_s${spriteLevel}`,
          size: uvData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(spe.uvBuffer, 0, uvData);
      }
      if (spe.hasFaceIds && faceIds && faceIds.length > 0) {
        const faceIdData = new Float32Array(faceIds);
        spe.faceIdBuffer = this.device.createBuffer({
          label: `faceidbuf_c${chan}_s${spriteLevel}`,
          size: faceIdData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(spe.faceIdBuffer, 0, faceIdData);
      }
      if (spe.hasNormals && normals && normals.length > 0) {
        const normalData = new Float32Array(normals);
        spe.normalBuffer = this.device.createBuffer({
          label: `normalbuf_c${chan}_s${spriteLevel}`,
          size: normalData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(spe.normalBuffer, 0, normalData);
      }
      if (spe.hasTangents && tangents && tangents.length > 0) {
        const tangentData = new Float32Array(tangents);
        spe.tangentBuffer = this.device.createBuffer({
          label: `tangentbuf_c${chan}_s${spriteLevel}`,
          size: tangentData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(spe.tangentBuffer, 0, tangentData);
      }
      if (spe.vertexUniforms.length > 0) {
        this.setupVertexUniforms(spe);
      }
    } else {
      spe.vertexShaderModule = this.vertexShaderModule;
      spe.vertexCount = 6;
    }
    const bindGroupLayouts = [this.sharedBindGroupLayout, spe.bindGroupLayout];
    if (spe.vertexBindGroupLayout) {
      bindGroupLayouts.push(spe.vertexBindGroupLayout);
    }
    spe.pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts });
    const blendState = BLEND_MODES[spe.blendMode] || BLEND_MODES.normal;
    const pipelineDescriptor = {
      label: `pipeline_c${chan}_s${spriteLevel}`,
      layout: spe.pipelineLayout,
      vertex: {
        module: spe.vertexShaderModule,
        entryPoint: "main"
      },
      fragment: {
        module: spe.fragmentShaderModule,
        entryPoint: "main",
        targets: [{
          format: this.format,
          blend: blendState
        }]
      },
      primitive: {
        topology: "triangle-list"
      }
    };
    if (spe.hasCustomGeometry) {
      const bufferLayouts = [{
        arrayStride: 12,
        // 3 floats * 4 bytes (position)
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: "float32x3"
        }]
      }];
      if (spe.hasExplicitUVs && spe.uvBuffer) {
        bufferLayouts.push({
          arrayStride: 8,
          // 2 floats * 4 bytes (texcoord)
          attributes: [{
            shaderLocation: 1,
            offset: 0,
            format: "float32x2"
          }]
        });
      }
      if (spe.hasFaceIds && spe.faceIdBuffer) {
        bufferLayouts.push({
          arrayStride: 4,
          // 1 float * 4 bytes (faceId)
          attributes: [{
            shaderLocation: 2,
            offset: 0,
            format: "float32"
          }]
        });
      }
      if (spe.hasNormals && spe.normalBuffer) {
        bufferLayouts.push({
          arrayStride: 12,
          // 3 floats * 4 bytes (normal)
          attributes: [{
            shaderLocation: 3,
            offset: 0,
            format: "float32x3"
          }]
        });
      }
      if (spe.hasTangents && spe.tangentBuffer) {
        bufferLayouts.push({
          arrayStride: 16,
          // 4 floats * 4 bytes (tangent vec4)
          attributes: [{
            shaderLocation: 4,
            offset: 0,
            format: "float32x4"
          }]
        });
      }
      pipelineDescriptor.vertex.buffers = bufferLayouts;
    }
    if (spe.has3D) {
      this.ensureDepthTexture();
      pipelineDescriptor.depthStencil = {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less"
      };
    }
    spe.pipeline = this.device.createRenderPipeline(pipelineDescriptor);
    this.createSamplerOrBuffersForSprite(spe);
  }
  // Clear all sprite chains for a channel
  clearSpriteChains(chan) {
    const rpe = this.renderPassInfo[chan];
    if (rpe.sprites) {
      for (const [level, spe] of rpe.sprites) {
        if (spe.vertexBuffer) {
          spe.vertexBuffer.destroy();
        }
        if (spe.uvBuffer) {
          spe.uvBuffer.destroy();
        }
        if (spe.faceIdBuffer) {
          spe.faceIdBuffer.destroy();
        }
        if (spe.normalBuffer) {
          spe.normalBuffer.destroy();
        }
        if (spe.tangentBuffer) {
          spe.tangentBuffer.destroy();
        }
        if (spe.vertexUniformBuffer) {
          spe.vertexUniformBuffer.destroy();
        }
      }
      rpe.sprites.clear();
    }
  }
  // Reshape vertex data to vec3 format
  // is3D: explicit flag indicating 3D data (required for ambiguous lengths divisible by both 2 and 3)
  reshapeToVec3(flatArray, is3D = false) {
    const len = flatArray.length;
    const stride = is3D ? 3 : 2;
    const verts = [];
    for (let i = 0; i < len; i += stride) {
      if (is3D) {
        verts.push([flatArray[i], flatArray[i + 1], flatArray[i + 2]]);
      } else {
        verts.push([flatArray[i], flatArray[i + 1], 0]);
      }
    }
    return verts;
  }
  // Setup vertex uniform buffer
  setupVertexUniforms(spe) {
    let size = 0;
    for (const u of spe.vertexUniforms) {
      if (u.type === "f32") {
        size = Math.ceil(size / 4) * 4;
        size += 4;
      } else if (u.type === "vec2f") {
        size = Math.ceil(size / 8) * 8;
        size += 8;
      } else if (u.type === "vec3f") {
        size = Math.ceil(size / 16) * 16;
        size += 12;
      }
    }
    size = Math.ceil(size / 16) * 16;
    spe.vertexUniformBuffer = this.device.createBuffer({
      label: `vtxunif_c${spe.chan}_s${spe.level}`,
      size: Math.max(size, 16),
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    spe.vertexBindGroupLayout = this.device.createBindGroupLayout({
      label: `vtxbgl_c${spe.chan}_s${spe.level}`,
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" }
      }]
    });
    spe.vertexBindGroup = this.device.createBindGroup({
      label: `vtxbg_c${spe.chan}_s${spe.level}`,
      layout: spe.vertexBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: spe.vertexUniformBuffer }
      }]
    });
  }
  // Generate uniform declarations for a sprite
  generateSpriteUniformDeclarations(spe) {
    let uniInfo = spe.uniformList;
    let i = 1;
    let ui = 0;
    spe.channelUniforms = [];
    Object.keys(uniInfo).forEach((key) => {
      if (key === "prevBuffer") return;
      let uniEntry;
      if (key.startsWith("tex")) {
        uniEntry = new uniformTextureListEntry(spe.chan, i, key, uniInfo[key]);
        spe.textureUniforms.push(uniEntry);
        i += uniEntry.indexesUsed;
      } else {
        uniEntry = new uniformValueListEntry(spe.chan, ui, key, uniInfo[key], uniInfo);
        spe.valueUniforms.push(uniEntry);
        ui++;
      }
      spe.channelUniforms.push(uniEntry);
    });
    let ourValues = spe.valueUniforms;
    spe.hasValueUniforms = ourValues.length > 0;
    let bindings = "";
    let bgLayoutentries = [];
    if (spe.hasValueUniforms) {
      let struct = `struct UF {
`;
      for (let j = 0; j < ourValues.length; ++j) {
        struct = struct + ourValues[j].getStructLineItem();
      }
      struct = struct + `};
@group(1) @binding(0) var<uniform> uf : UF;
`;
      spe.structString = struct;
      bindings = struct;
      bgLayoutentries = [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }];
    }
    let ourTextureUniforms = spe.textureUniforms;
    for (let j = 0; j < ourTextureUniforms.length; ++j) {
      let aUnif = ourTextureUniforms[j];
      let bgs = aUnif.bindGroupString();
      bindings = bindings + bgs;
      bgLayoutentries.push(...aUnif.getBindGroupLayoutEntries());
    }
    spe.bindGroupLayout = this.device.createBindGroupLayout({
      label: "sprite bg layout " + spe.chan + "_" + spe.level,
      entries: bgLayoutentries
    });
    spe.bindGroupHeader = bindings;
  }
  // Create samplers/buffers for sprite
  createSamplerOrBuffersForSprite(spe) {
    if (spe.hasValueUniforms) {
      spe.valueStructView = new Float32Array(spe.valueUniforms.length);
      spe.valueStructBuffer = this.device.createBuffer({
        size: spe.valueStructView.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
    }
    let ourUniforms = spe.textureUniforms;
    for (let i = 0; i < ourUniforms.length; ++i) {
      ourUniforms[i].createSamplerOrBuffers(this.device);
    }
  }
  // Fill bind group for sprite
  fillSpriteBindGroup(spe) {
    let allUniforms = spe.channelUniforms;
    if (!allUniforms || allUniforms.length === 0) {
      return {
        label: "spritebg" + spe.chan + "_" + spe.level,
        layout: spe.bindGroupLayout,
        entries: []
      };
    }
    let bga;
    if (spe.hasValueUniforms) {
      this.setSpriteValueUniformValues(spe, this.time);
      this.device.queue.writeBuffer(spe.valueStructBuffer, 0, spe.valueStructView);
      bga = [{ binding: 0, resource: { buffer: spe.valueStructBuffer } }];
    } else {
      bga = [];
    }
    let ourUniforms = spe.textureUniforms;
    for (let i = 0; i < ourUniforms.length; ++i) {
      let aUniform = ourUniforms[i];
      bga.push(...aUniform.getBindGroupEntries(this, this.time));
    }
    return {
      label: "spritebg" + spe.chan + "_" + spe.level,
      layout: spe.bindGroupLayout,
      entries: bga
    };
  }
  setSpriteValueUniformValues(spe, time) {
    let ourUniforms = spe.valueUniforms;
    for (let i = 0; i < ourUniforms.length; ++i) {
      ourUniforms[i].setUniformValues(spe, time);
    }
  }
  // Update vertex uniforms for a sprite
  updateVertexUniforms(spe) {
    if (!spe.vertexUniforms || spe.vertexUniforms.length === 0) return;
    let totalSize = 0;
    for (const u of spe.vertexUniforms) {
      if (u.type === "f32") {
        totalSize = Math.ceil(totalSize / 4) * 4;
        totalSize += 4;
      } else if (u.type === "vec2f") {
        totalSize = Math.ceil(totalSize / 8) * 8;
        totalSize += 8;
      } else if (u.type === "vec3f") {
        totalSize = Math.ceil(totalSize / 16) * 16;
        totalSize += 12;
      }
    }
    totalSize = Math.ceil(totalSize / 16) * 16;
    const floatData = new Float32Array(Math.max(totalSize / 4, 4));
    let offset2 = 0;
    for (const u of spe.vertexUniforms) {
      let val = typeof u.value === "function" ? u.value() : u.value;
      if (u.type === "f32") {
        offset2 = Math.ceil(offset2);
        const v2 = Array.isArray(val) ? val[0] : val;
        floatData[offset2] = typeof v2 === "function" ? v2() : v2;
        offset2 += 1;
      } else if (u.type === "vec2f") {
        offset2 = Math.ceil(offset2 / 2) * 2;
        const arr = Array.isArray(val) ? val : [val, val];
        floatData[offset2] = typeof arr[0] === "function" ? arr[0]() : arr[0];
        floatData[offset2 + 1] = typeof arr[1] === "function" ? arr[1]() : arr[1];
        offset2 += 2;
      } else if (u.type === "vec3f") {
        offset2 = Math.ceil(offset2 / 4) * 4;
        const arr = Array.isArray(val) ? val : [val, val, val];
        floatData[offset2] = typeof arr[0] === "function" ? arr[0]() : arr[0];
        floatData[offset2 + 1] = typeof arr[1] === "function" ? arr[1]() : arr[1];
        floatData[offset2 + 2] = typeof arr[2] === "function" ? arr[2]() : arr[2];
        offset2 += 3;
      }
    }
    this.device.queue.writeBuffer(spe.vertexUniformBuffer, 0, floatData);
  }
  // ------------------------------------------------------------------------------
  // animate function
  //
  async animate(dT) {
    const commandEncoder = this.device.createCommandEncoder();
    this.timeUniformValues[0] = this.time += dT / 1e3;
    this.device.queue.writeBuffer(this.timeUniformBuffer, 0, this.timeUniformValues);
    this.resolutionUniformValues[0] = this.canvas.width;
    this.resolutionUniformValues[1] = this.canvas.height;
    this.device.queue.writeBuffer(this.resolutionUniformBuffer, 0, this.resolutionUniformValues);
    this.mouseUniformValues[0] = this.mousePos.x;
    this.mouseUniformValues[1] = this.mousePos.y;
    this.device.queue.writeBuffer(this.mouseUniformBuffer, 0, this.mouseUniformValues);
    this.device.queue.writeBuffer(this.spriteUVUniformBuffer, 0, this.spriteUVUniformValues);
    this.device.queue.writeBuffer(this.spriteGridUniformBuffer, 0, this.spriteGridUniformValues);
    for (let chan = 0; chan < this.numChannels; ++chan) {
      const rpe = this.renderPassInfo[chan];
      const hasSprites = rpe.sprites && rpe.sprites.size > 0;
      const hasLegacyPipeline = rpe.pipeline;
      if (!hasSprites && !hasLegacyPipeline) continue;
      rpe.outputObject.flipPingPong();
      if (hasSprites) {
        const levels = Array.from(rpe.sprites.keys()).sort((a2, b) => a2 - b);
        let depthCleared = false;
        for (let i = 0; i < levels.length; i++) {
          const level = levels[i];
          const spe = rpe.sprites.get(level);
          const loadOp = level === 0 ? "clear" : "load";
          const renderPassDescriptor = {
            label: `renderPass_c${chan}_s${level}`,
            colorAttachments: [{
              label: `attachment_c${chan}_s${level}`,
              view: rpe.outputObject.getCurrentTextureView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp,
              storeOp: "store"
            }]
          };
          if (spe.has3D && this.depthTextureView) {
            const shouldClearDepth = !depthCleared;
            depthCleared = true;
            renderPassDescriptor.depthStencilAttachment = {
              view: this.depthTextureView,
              depthClearValue: 1,
              depthLoadOp: shouldClearDepth ? "clear" : "load",
              depthStoreOp: "store"
            };
          }
          let ubgData = this.fillSpriteBindGroup(spe);
          let ubg = this.device.createBindGroup(ubgData);
          if (spe.vertexUniforms && spe.vertexUniforms.length > 0) {
            this.updateVertexUniforms(spe);
          }
          if (spe.sprite && spe.sprite.cols && spe.sprite.rows) {
            this.spriteGridUniformValues[0] = spe.sprite.cols;
            this.spriteGridUniformValues[1] = spe.sprite.rows;
          } else {
            this.spriteGridUniformValues[0] = 1;
            this.spriteGridUniformValues[1] = 1;
          }
          this.device.queue.writeBuffer(this.spriteGridUniformBuffer, 0, this.spriteGridUniformValues);
          const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
          passEncoder.setPipeline(spe.pipeline);
          passEncoder.setBindGroup(0, this.sharedBindGroup);
          passEncoder.setBindGroup(1, ubg);
          if (spe.vertexBindGroup) {
            passEncoder.setBindGroup(2, spe.vertexBindGroup);
          }
          if (spe.hasCustomGeometry && spe.vertexBuffer) {
            let slot = 0;
            passEncoder.setVertexBuffer(slot++, spe.vertexBuffer);
            if (spe.hasExplicitUVs && spe.uvBuffer) {
              passEncoder.setVertexBuffer(slot++, spe.uvBuffer);
            }
            if (spe.hasFaceIds && spe.faceIdBuffer) {
              passEncoder.setVertexBuffer(slot++, spe.faceIdBuffer);
            }
            if (spe.hasNormals && spe.normalBuffer) {
              passEncoder.setVertexBuffer(slot++, spe.normalBuffer);
            }
            if (spe.hasTangents && spe.tangentBuffer) {
              passEncoder.setVertexBuffer(slot++, spe.tangentBuffer);
            }
            passEncoder.draw(spe.vertexCount);
          } else {
            passEncoder.draw(6);
          }
          passEncoder.end();
        }
      } else {
        const renderPassDescriptor = {
          label: "renderPassDescriptor",
          colorAttachments: [{
            label: "canvas textureView attachment " + chan,
            view: rpe.outputObject.getCurrentTextureView(),
            clearValue: { r: 1, g: 1, b: 1, a: 1 },
            loadOp: "clear",
            storeOp: "store"
          }]
        };
        let ubgData = await this.fillBindGroup(chan);
        let ubg = await this.device.createBindGroup(ubgData);
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(rpe.pipeline);
        passEncoder.setBindGroup(0, this.sharedBindGroup);
        passEncoder.setBindGroup(1, ubg);
        passEncoder.draw(6);
        passEncoder.end();
      }
    }
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    if (this.showQuad) {
      await this.fbo4Renderer.refreshCanvases(
        this.outputChannelObjects[0].getCurrentTexture(),
        this.outputChannelObjects[1].getCurrentTexture(),
        this.outputChannelObjects[2].getCurrentTexture(),
        this.outputChannelObjects[3].getCurrentTexture()
      );
    } else {
      await this.fboRenderer.refreshCanvas(this.outputChannelObjects[this.outChannel].getCurrentTexture());
    }
  }
  generateUniformDeclarations(chan) {
    const rpe = this.renderPassInfo[chan];
    let uniInfo = rpe.uniformList;
    let i = 1;
    let ui = 0;
    rpe.channelUniforms = [];
    Object.keys(uniInfo).forEach((key) => {
      if (key === "prevBuffer") return;
      let uniEntry;
      if (key.startsWith("tex")) {
        uniEntry = new uniformTextureListEntry(chan, i, key, uniInfo[key]);
        rpe.textureUniforms.push(uniEntry);
        i += uniEntry.indexesUsed;
      } else {
        uniEntry = new uniformValueListEntry(chan, ui, key, uniInfo[key], uniInfo);
        rpe.valueUniforms.push(uniEntry);
        ui++;
      }
      rpe.channelUniforms.push(uniEntry);
    });
    rpe.channelUniforms;
    let ourValues = rpe.valueUniforms;
    rpe.hasValueUniforms = ourValues.length > 0;
    let bindings = "";
    let bgLayoutentries = [];
    if (rpe.hasValueUniforms) {
      let struct = `struct UF {
`;
      for (let j = 0; j < ourValues.length; ++j) {
        struct = struct + ourValues[j].getStructLineItem();
      }
      struct = struct + `};
    @group(1) @binding(0) var<uniform> uf : UF;
`;
      rpe.structString = struct;
      bindings = struct;
      bgLayoutentries = [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        // Shader stages where this binding is used
        buffer: { type: "uniform" }
        // Resource type
      }];
    }
    let ourTextureUniforms = rpe.textureUniforms;
    for (let j = 0; j < ourTextureUniforms.length; ++j) {
      let aUnif = ourTextureUniforms[j];
      let bgs = aUnif.bindGroupString();
      bindings = bindings + bgs;
      bgLayoutentries.push(...aUnif.getBindGroupLayoutEntries());
    }
    rpe.bindGroupLayout = this.device.createBindGroupLayout({
      label: "bg layout " + chan,
      entries: bgLayoutentries
    });
    rpe.bindGroupHeader = bindings;
  }
  // called once since we can reuse samplers between frames.
  createSamplerOrBuffersForChan(chan) {
    const rpe = this.renderPassInfo[chan];
    if (rpe.hasValueUniforms) {
      rpe.valueStructView = new Float32Array(rpe.valueUniforms.length);
      rpe.valueStructBuffer = this.device.createBuffer({
        size: rpe.valueStructView.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
    }
    let ourUniforms = rpe.textureUniforms;
    for (let i = 0; i < ourUniforms.length; ++i)
      ourUniforms[i].createSamplerOrBuffers(this.device);
  }
  fillBindGroup(chan) {
    const rpe = this.renderPassInfo[chan];
    let allUniforms = rpe.channelUniforms;
    if (!allUniforms || allUniforms.length === 0) {
      return {
        label: "bg" + chan,
        layout: rpe.bindGroupLayout,
        entries: []
      };
    }
    let bga;
    if (rpe.hasValueUniforms) {
      this.setAllValueUniformValues(chan, this.time);
      this.device.queue.writeBuffer(rpe.valueStructBuffer, 0, rpe.valueStructView);
      bga = [{ binding: 0, resource: { buffer: rpe.valueStructBuffer } }];
    } else bga = [];
    let ourUniforms = rpe.textureUniforms;
    for (let i = 0; i < ourUniforms.length; ++i) {
      let aUniform = ourUniforms[i];
      bga.push(...aUniform.getBindGroupEntries(this, this.time));
    }
    let bgd = {
      label: "bg" + chan,
      layout: rpe.bindGroupLayout,
      entries: bga
    };
    return bgd;
  }
  setAllValueUniformValues(chan, time) {
    const rpe = this.renderPassInfo[chan];
    let ourUniforms = rpe.valueUniforms;
    for (let i = 0; i < ourUniforms.length; ++i) {
      ourUniforms[i].setUniformValues(rpe, time);
    }
  }
}
class uniformTextureListEntry {
  constructor(chan, index, name, valCallback) {
    this.chan = chan;
    this.index = index;
    this.name = name;
    this.valCallback = valCallback;
    this.indexesUsed = 2;
  }
  indexesUsed() {
    return 2;
  }
  bindGroupString() {
    return `@group(1) @binding(${this.index}) var samp${this.name}: sampler;
 @group(1) @binding(${this.index + 1}) var ${this.name}:  texture_2d<f32>;
`;
  }
  getBindGroupLayoutEntries() {
    let samp = {
      binding: this.index,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {
        type: "filtering"
      }
    };
    let text = {
      binding: this.index + 1,
      // Binding index for texture.
      visibility: GPUShaderStage.FRAGMENT,
      // Shader stages where this binding is used
      texture: {
        sampleType: "float",
        viewDimension: "2d",
        multisampled: false
      }
    };
    return [samp, text];
  }
  createSamplerOrBuffers(device) {
    this.sampler = device.createSampler();
    return this.sampler;
  }
  getBindGroupEntries(renderer) {
    this.cbValue = this.valCallback();
    if (!this.cbValue) {
      this.cbValue = renderer.dummyTexture.createView();
    }
    return [
      { binding: this.index, resource: this.sampler },
      { binding: this.index + 1, resource: this.cbValue }
    ];
  }
}
class uniformValueListEntry {
  constructor(chan, index, name, valCallback) {
    this.chan = chan;
    this.index = index;
    this.name = name;
    this.valCallback = valCallback;
    this.indexesUsed = 0;
  }
  getBindGroupLayoutEntries() {
    return [{
      binding: this.index,
      visibility: GPUShaderStage.FRAGMENT,
      // Shader stages where this binding is used
      buffer: { type: "uniform" }
      // Resource type
    }];
  }
  getStructLineItem() {
    return `${this.name} : f32,
`;
  }
  setUniformValues(rpe, time) {
    let argsToCB = { time, bpm: 120 };
    this.cbValue = this.valCallback(void 0, argsToCB);
    if (!this.cbValue || this.cbValue === NaN) {
      this.cbValue = 0;
    }
    rpe.valueStructView[this.index] = this.cbValue;
  }
}
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 80, 3, 71, 10, 50, 3, 123, 2, 54, 14, 32, 10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13, 2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2, 0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16, 16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3, 3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10, 47, 15, 343, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6, 2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14, 10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9, 470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0, 23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357, 0, 62, 13, 499, 13, 245, 1, 2, 9, 726, 6, 110, 6, 6, 9, 4759, 9, 787719, 239];
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5, 39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13, 310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 2, 60, 28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33, 24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2, 24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0, 45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0, 60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2, 23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12, 45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2, 37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0, 80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582, 6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18, 433, 44, 212, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 42, 9, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27, 229, 29, 3, 0, 496, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3, 5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191];
var nonASCIIidentifierChars = "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߽߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࢗ-࢟࣊-ࣣ࣡-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯৾ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ૺ-૿ଁ-ଃ଼ା-ୄେୈୋ-୍୕-ୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఄ఼ా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ೳഀ-ഃ഻഼ാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ඁ-ඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ຼ່-໎໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜕ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠏-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᪿ-ᫎᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭᳴᳷-᳹᷀-᷿‌‍‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯・꘠-꘩꙯ꙴ-꙽ꚞꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧ꠬ꢀꢁꢴ-ꣅ꣐-꣙꣠-꣱ꣿ-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︯︳︴﹍-﹏０-９＿･";
var nonASCIIidentifierStartChars = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-ࢎࢠ-ࣉऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱৼਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡૹଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘ-ౚౝౠౡಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೝೞೠೡೱೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖൟ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄຆ-ຊຌ-ຣລວ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡸᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭌᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎㆠ-ㆿㇰ-ㇿ㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꟍꟐꟑꟓꟕ-Ƛꟲ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꣽꣾꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ";
var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
};
var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";
var keywords$1 = {
  5: ecma5AndLessKeywords,
  "5module": ecma5AndLessKeywords + " export import",
  6: ecma5AndLessKeywords + " const class extends export import super"
};
var keywordRelationalOperator = /^in(stanceof)?$/;
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");
function isInAstralSet(code, set) {
  var pos = 65536;
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) {
      return false;
    }
    pos += set[i + 1];
    if (pos >= code) {
      return true;
    }
  }
  return false;
}
function isIdentifierStart(code, astral) {
  if (code < 65) {
    return code === 36;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes);
}
function isIdentifierChar(code, astral) {
  if (code < 48) {
    return code === 36;
  }
  if (code < 58) {
    return true;
  }
  if (code < 65) {
    return false;
  }
  if (code < 91) {
    return true;
  }
  if (code < 97) {
    return code === 95;
  }
  if (code < 123) {
    return true;
  }
  if (code <= 65535) {
    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
  }
  if (astral === false) {
    return false;
  }
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}
var TokenType = function TokenType2(label, conf) {
  if (conf === void 0) conf = {};
  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};
function binop(name, prec) {
  return new TokenType(name, { beforeExpr: true, binop: prec });
}
var beforeExpr = { beforeExpr: true }, startsExpr = { startsExpr: true };
var keywords = {};
function kw(name, options) {
  if (options === void 0) options = {};
  options.keyword = name;
  return keywords[name] = new TokenType(name, options);
}
var types$1 = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  privateId: new TokenType("privateId", startsExpr),
  eof: new TokenType("eof"),
  // Punctuation token types.
  bracketL: new TokenType("[", { beforeExpr: true, startsExpr: true }),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", { beforeExpr: true, startsExpr: true }),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", { beforeExpr: true, startsExpr: true }),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  invalidTemplate: new TokenType("invalidTemplate"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", { beforeExpr: true, startsExpr: true }),
  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.
  eq: new TokenType("=", { beforeExpr: true, isAssign: true }),
  assign: new TokenType("_=", { beforeExpr: true, isAssign: true }),
  incDec: new TokenType("++/--", { prefix: true, postfix: true, startsExpr: true }),
  prefix: new TokenType("!/~", { beforeExpr: true, prefix: true, startsExpr: true }),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=/===/!==", 6),
  relational: binop("</>/<=/>=", 7),
  bitShift: binop("<</>>/>>>", 8),
  plusMin: new TokenType("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType("**", { beforeExpr: true }),
  coalesce: binop("??", 1),
  // Keyword token types.
  _break: kw("break"),
  _case: kw("case", beforeExpr),
  _catch: kw("catch"),
  _continue: kw("continue"),
  _debugger: kw("debugger"),
  _default: kw("default", beforeExpr),
  _do: kw("do", { isLoop: true, beforeExpr: true }),
  _else: kw("else", beforeExpr),
  _finally: kw("finally"),
  _for: kw("for", { isLoop: true }),
  _function: kw("function", startsExpr),
  _if: kw("if"),
  _return: kw("return", beforeExpr),
  _switch: kw("switch"),
  _throw: kw("throw", beforeExpr),
  _try: kw("try"),
  _var: kw("var"),
  _const: kw("const"),
  _while: kw("while", { isLoop: true }),
  _with: kw("with"),
  _new: kw("new", { beforeExpr: true, startsExpr: true }),
  _this: kw("this", startsExpr),
  _super: kw("super", startsExpr),
  _class: kw("class", startsExpr),
  _extends: kw("extends", beforeExpr),
  _export: kw("export"),
  _import: kw("import", startsExpr),
  _null: kw("null", startsExpr),
  _true: kw("true", startsExpr),
  _false: kw("false", startsExpr),
  _in: kw("in", { beforeExpr: true, binop: 7 }),
  _instanceof: kw("instanceof", { beforeExpr: true, binop: 7 }),
  _typeof: kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true }),
  _void: kw("void", { beforeExpr: true, prefix: true, startsExpr: true }),
  _delete: kw("delete", { beforeExpr: true, prefix: true, startsExpr: true })
};
var lineBreak = /\r\n?|\n|\u2028|\u2029/;
var lineBreakG = new RegExp(lineBreak.source, "g");
function isNewLine(code) {
  return code === 10 || code === 13 || code === 8232 || code === 8233;
}
function nextLineBreak(code, from, end) {
  if (end === void 0) end = code.length;
  for (var i = from; i < end; i++) {
    var next = code.charCodeAt(i);
    if (isNewLine(next)) {
      return i < end - 1 && next === 13 && code.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
    }
  }
  return -1;
}
var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;
var ref = Object.prototype;
var hasOwnProperty = ref.hasOwnProperty;
var toString = ref.toString;
var hasOwn = Object.hasOwn || function(obj, propName) {
  return hasOwnProperty.call(obj, propName);
};
var isArray = Array.isArray || function(obj) {
  return toString.call(obj) === "[object Array]";
};
var regexpCache = /* @__PURE__ */ Object.create(null);
function wordsRegexp(words) {
  return regexpCache[words] || (regexpCache[words] = new RegExp("^(?:" + words.replace(/ /g, "|") + ")$"));
}
function codePointToString(code) {
  if (code <= 65535) {
    return String.fromCharCode(code);
  }
  code -= 65536;
  return String.fromCharCode((code >> 10) + 55296, (code & 1023) + 56320);
}
var loneSurrogate = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/;
var Position = function Position2(line2, col) {
  this.line = line2;
  this.column = col;
};
Position.prototype.offset = function offset(n) {
  return new Position(this.line, this.column + n);
};
var SourceLocation = function SourceLocation2(p, start, end) {
  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) {
    this.source = p.sourceFile;
  }
};
function getLineInfo(input, offset2) {
  for (var line2 = 1, cur = 0; ; ) {
    var nextBreak = nextLineBreak(input, cur, offset2);
    if (nextBreak < 0) {
      return new Position(line2, offset2 - cur);
    }
    ++line2;
    cur = nextBreak;
  }
}
var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
  // either 3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10
  // (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or `"latest"`
  // (the latest version the library supports). This influences
  // support for strict mode, the set of reserved words, and support
  // for new syntax features.
  ecmaVersion: null,
  // `sourceType` indicates the mode the code should be parsed in.
  // Can be either `"script"` or `"module"`. This influences global
  // strict mode and parsing of `import` and `export` declarations.
  sourceType: "script",
  // `onInsertedSemicolon` can be a callback that will be called when
  // a semicolon is automatically inserted. It will be passed the
  // position of the inserted semicolon as an offset, and if
  // `locations` is enabled, it is given the location as a `{line,
  // column}` object as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are only enforced if ecmaVersion >= 5.
  // Set `allowReserved` to a boolean value to explicitly turn this on
  // an off. When this option has the value "never", reserved words
  // and keywords can also not be used as property names.
  allowReserved: null,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program, and an import.meta expression
  // in a script isn't considered an error.
  allowImportExportEverywhere: false,
  // By default, await identifiers are allowed to appear at the top-level scope only if ecmaVersion >= 2022.
  // When enabled, await identifiers are allowed to appear at the top-level scope,
  // but they are still not allowed in non-async functions.
  allowAwaitOutsideFunction: null,
  // When enabled, super identifiers are not constrained to
  // appearing in methods and do not raise an error when they appear elsewhere.
  allowSuperOutsideMethod: null,
  // When enabled, hashbang directive in the beginning of file is
  // allowed and treated as a line comment. Enabled by default when
  // `ecmaVersion` >= 2023.
  allowHashBang: false,
  // By default, the parser will verify that private properties are
  // only used in places where they are valid and have been declared.
  // Set this to false to turn such checks off.
  checkPrivateFields: true,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokens returned from `tokenizer().getToken()`. Note
  // that you are not allowed to call the parser from the
  // callback—that will corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  // When this option has an array as value, objects representing the
  // comments are pushed to it.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false
};
var warnedAboutEcmaVersion = false;
function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && hasOwn(opts, opt) ? opts[opt] : defaultOptions[opt];
  }
  if (options.ecmaVersion === "latest") {
    options.ecmaVersion = 1e8;
  } else if (options.ecmaVersion == null) {
    if (!warnedAboutEcmaVersion && typeof console === "object" && console.warn) {
      warnedAboutEcmaVersion = true;
      console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.");
    }
    options.ecmaVersion = 11;
  } else if (options.ecmaVersion >= 2015) {
    options.ecmaVersion -= 2009;
  }
  if (options.allowReserved == null) {
    options.allowReserved = options.ecmaVersion < 5;
  }
  if (!opts || opts.allowHashBang == null) {
    options.allowHashBang = options.ecmaVersion >= 14;
  }
  if (isArray(options.onToken)) {
    var tokens = options.onToken;
    options.onToken = function(token) {
      return tokens.push(token);
    };
  }
  if (isArray(options.onComment)) {
    options.onComment = pushComment(options, options.onComment);
  }
  return options;
}
function pushComment(options, array) {
  return function(block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text,
      start,
      end
    };
    if (options.locations) {
      comment.loc = new SourceLocation(this, startLoc, endLoc);
    }
    if (options.ranges) {
      comment.range = [start, end];
    }
    array.push(comment);
  };
}
var SCOPE_TOP = 1, SCOPE_FUNCTION = 2, SCOPE_ASYNC = 4, SCOPE_GENERATOR = 8, SCOPE_ARROW = 16, SCOPE_SIMPLE_CATCH = 32, SCOPE_SUPER = 64, SCOPE_DIRECT_SUPER = 128, SCOPE_CLASS_STATIC_BLOCK = 256, SCOPE_CLASS_FIELD_INIT = 512, SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION | SCOPE_CLASS_STATIC_BLOCK;
function functionFlags(async, generator) {
  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0);
}
var BIND_NONE = 0, BIND_VAR = 1, BIND_LEXICAL = 2, BIND_FUNCTION = 3, BIND_SIMPLE_CATCH = 4, BIND_OUTSIDE = 5;
var Parser = function Parser2(options, input, startPos) {
  this.options = options = getOptions(options);
  this.sourceFile = options.sourceFile;
  this.keywords = wordsRegexp(keywords$1[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
  var reserved = "";
  if (options.allowReserved !== true) {
    reserved = reservedWords[options.ecmaVersion >= 6 ? 6 : options.ecmaVersion === 5 ? 5 : 3];
    if (options.sourceType === "module") {
      reserved += " await";
    }
  }
  this.reservedWords = wordsRegexp(reserved);
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
  this.reservedWordsStrict = wordsRegexp(reservedStrict);
  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
  this.input = String(input);
  this.containsEsc = false;
  if (startPos) {
    this.pos = startPos;
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
  } else {
    this.pos = this.lineStart = 0;
    this.curLine = 1;
  }
  this.type = types$1.eof;
  this.value = null;
  this.start = this.end = this.pos;
  this.startLoc = this.endLoc = this.curPosition();
  this.lastTokEndLoc = this.lastTokStartLoc = null;
  this.lastTokStart = this.lastTokEnd = this.pos;
  this.context = this.initialContext();
  this.exprAllowed = true;
  this.inModule = options.sourceType === "module";
  this.strict = this.inModule || this.strictDirective(this.pos);
  this.potentialArrowAt = -1;
  this.potentialArrowInForAwait = false;
  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
  this.labels = [];
  this.undefinedExports = /* @__PURE__ */ Object.create(null);
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!") {
    this.skipLineComment(2);
  }
  this.scopeStack = [];
  this.enterScope(SCOPE_TOP);
  this.regexpState = null;
  this.privateNameStack = [];
};
var prototypeAccessors = { inFunction: { configurable: true }, inGenerator: { configurable: true }, inAsync: { configurable: true }, canAwait: { configurable: true }, allowSuper: { configurable: true }, allowDirectSuper: { configurable: true }, treatFunctionsAsVar: { configurable: true }, allowNewDotTarget: { configurable: true }, inClassStaticBlock: { configurable: true } };
Parser.prototype.parse = function parse() {
  var node = this.options.program || this.startNode();
  this.nextToken();
  return this.parseTopLevel(node);
};
prototypeAccessors.inFunction.get = function() {
  return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0;
};
prototypeAccessors.inGenerator.get = function() {
  return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0;
};
prototypeAccessors.inAsync.get = function() {
  return (this.currentVarScope().flags & SCOPE_ASYNC) > 0;
};
prototypeAccessors.canAwait.get = function() {
  for (var i = this.scopeStack.length - 1; i >= 0; i--) {
    var ref2 = this.scopeStack[i];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT)) {
      return false;
    }
    if (flags & SCOPE_FUNCTION) {
      return (flags & SCOPE_ASYNC) > 0;
    }
  }
  return this.inModule && this.options.ecmaVersion >= 13 || this.options.allowAwaitOutsideFunction;
};
prototypeAccessors.allowSuper.get = function() {
  var ref2 = this.currentThisScope();
  var flags = ref2.flags;
  return (flags & SCOPE_SUPER) > 0 || this.options.allowSuperOutsideMethod;
};
prototypeAccessors.allowDirectSuper.get = function() {
  return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0;
};
prototypeAccessors.treatFunctionsAsVar.get = function() {
  return this.treatFunctionsAsVarInScope(this.currentScope());
};
prototypeAccessors.allowNewDotTarget.get = function() {
  for (var i = this.scopeStack.length - 1; i >= 0; i--) {
    var ref2 = this.scopeStack[i];
    var flags = ref2.flags;
    if (flags & (SCOPE_CLASS_STATIC_BLOCK | SCOPE_CLASS_FIELD_INIT) || flags & SCOPE_FUNCTION && !(flags & SCOPE_ARROW)) {
      return true;
    }
  }
  return false;
};
prototypeAccessors.inClassStaticBlock.get = function() {
  return (this.currentVarScope().flags & SCOPE_CLASS_STATIC_BLOCK) > 0;
};
Parser.extend = function extend() {
  var plugins = [], len = arguments.length;
  while (len--) plugins[len] = arguments[len];
  var cls = this;
  for (var i = 0; i < plugins.length; i++) {
    cls = plugins[i](cls);
  }
  return cls;
};
Parser.parse = function parse2(input, options) {
  return new this(options, input).parse();
};
Parser.parseExpressionAt = function parseExpressionAt(input, pos, options) {
  var parser = new this(options, input, pos);
  parser.nextToken();
  return parser.parseExpression();
};
Parser.tokenizer = function tokenizer(input, options) {
  return new this(options, input);
};
Object.defineProperties(Parser.prototype, prototypeAccessors);
var pp$9 = Parser.prototype;
var literal = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
pp$9.strictDirective = function(start) {
  if (this.options.ecmaVersion < 5) {
    return false;
  }
  for (; ; ) {
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    var match = literal.exec(this.input.slice(start));
    if (!match) {
      return false;
    }
    if ((match[1] || match[2]) === "use strict") {
      skipWhiteSpace.lastIndex = start + match[0].length;
      var spaceAfter = skipWhiteSpace.exec(this.input), end = spaceAfter.index + spaceAfter[0].length;
      var next = this.input.charAt(end);
      return next === ";" || next === "}" || lineBreak.test(spaceAfter[0]) && !(/[(`.[+\-/*%<>=,?^&]/.test(next) || next === "!" && this.input.charAt(end + 1) === "=");
    }
    start += match[0].length;
    skipWhiteSpace.lastIndex = start;
    start += skipWhiteSpace.exec(this.input)[0].length;
    if (this.input[start] === ";") {
      start++;
    }
  }
};
pp$9.eat = function(type) {
  if (this.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};
pp$9.isContextual = function(name) {
  return this.type === types$1.name && this.value === name && !this.containsEsc;
};
pp$9.eatContextual = function(name) {
  if (!this.isContextual(name)) {
    return false;
  }
  this.next();
  return true;
};
pp$9.expectContextual = function(name) {
  if (!this.eatContextual(name)) {
    this.unexpected();
  }
};
pp$9.canInsertSemicolon = function() {
  return this.type === types$1.eof || this.type === types$1.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$9.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon) {
      this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
    }
    return true;
  }
};
pp$9.semicolon = function() {
  if (!this.eat(types$1.semi) && !this.insertSemicolon()) {
    this.unexpected();
  }
};
pp$9.afterTrailingComma = function(tokType, notNext) {
  if (this.type === tokType) {
    if (this.options.onTrailingComma) {
      this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
    }
    if (!notNext) {
      this.next();
    }
    return true;
  }
};
pp$9.expect = function(type) {
  this.eat(type) || this.unexpected();
};
pp$9.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};
var DestructuringErrors = function DestructuringErrors2() {
  this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = this.doubleProto = -1;
};
pp$9.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) {
    return;
  }
  if (refDestructuringErrors.trailingComma > -1) {
    this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element");
  }
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
  if (parens > -1) {
    this.raiseRecoverable(parens, isAssign ? "Assigning to rvalue" : "Parenthesized pattern");
  }
};
pp$9.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) {
    return false;
  }
  var shorthandAssign = refDestructuringErrors.shorthandAssign;
  var doubleProto = refDestructuringErrors.doubleProto;
  if (!andThrow) {
    return shorthandAssign >= 0 || doubleProto >= 0;
  }
  if (shorthandAssign >= 0) {
    this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns");
  }
  if (doubleProto >= 0) {
    this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property");
  }
};
pp$9.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos)) {
    this.raise(this.yieldPos, "Yield expression cannot be a default value");
  }
  if (this.awaitPos) {
    this.raise(this.awaitPos, "Await expression cannot be a default value");
  }
};
pp$9.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression") {
    return this.isSimpleAssignTarget(expr.expression);
  }
  return expr.type === "Identifier" || expr.type === "MemberExpression";
};
var pp$8 = Parser.prototype;
pp$8.parseTopLevel = function(node) {
  var exports = /* @__PURE__ */ Object.create(null);
  if (!node.body) {
    node.body = [];
  }
  while (this.type !== types$1.eof) {
    var stmt = this.parseStatement(null, true, exports);
    node.body.push(stmt);
  }
  if (this.inModule) {
    for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1) {
      var name = list[i];
      this.raiseRecoverable(this.undefinedExports[name].start, "Export '" + name + "' is not defined");
    }
  }
  this.adaptDirectivePrologue(node.body);
  this.next();
  node.sourceType = this.options.sourceType;
  return this.finishNode(node, "Program");
};
var loopLabel = { kind: "loop" }, switchLabel = { kind: "switch" };
pp$8.isLet = function(context) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
  if (nextCh === 91 || nextCh === 92) {
    return true;
  }
  if (context) {
    return false;
  }
  if (nextCh === 123 || nextCh > 55295 && nextCh < 56320) {
    return true;
  }
  if (isIdentifierStart(nextCh, true)) {
    var pos = next + 1;
    while (isIdentifierChar(nextCh = this.input.charCodeAt(pos), true)) {
      ++pos;
    }
    if (nextCh === 92 || nextCh > 55295 && nextCh < 56320) {
      return true;
    }
    var ident = this.input.slice(next, pos);
    if (!keywordRelationalOperator.test(ident)) {
      return true;
    }
  }
  return false;
};
pp$8.isAsyncFunction = function() {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async")) {
    return false;
  }
  skipWhiteSpace.lastIndex = this.pos;
  var skip = skipWhiteSpace.exec(this.input);
  var next = this.pos + skip[0].length, after;
  return !lineBreak.test(this.input.slice(this.pos, next)) && this.input.slice(next, next + 8) === "function" && (next + 8 === this.input.length || !(isIdentifierChar(after = this.input.charCodeAt(next + 8)) || after > 55295 && after < 56320));
};
pp$8.parseStatement = function(context, topLevel, exports) {
  var starttype = this.type, node = this.startNode(), kind;
  if (this.isLet(context)) {
    starttype = types$1._var;
    kind = "let";
  }
  switch (starttype) {
    case types$1._break:
    case types$1._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case types$1._debugger:
      return this.parseDebuggerStatement(node);
    case types$1._do:
      return this.parseDoStatement(node);
    case types$1._for:
      return this.parseForStatement(node);
    case types$1._function:
      if (context && (this.strict || context !== "if" && context !== "label") && this.options.ecmaVersion >= 6) {
        this.unexpected();
      }
      return this.parseFunctionStatement(node, false, !context);
    case types$1._class:
      if (context) {
        this.unexpected();
      }
      return this.parseClass(node, true);
    case types$1._if:
      return this.parseIfStatement(node);
    case types$1._return:
      return this.parseReturnStatement(node);
    case types$1._switch:
      return this.parseSwitchStatement(node);
    case types$1._throw:
      return this.parseThrowStatement(node);
    case types$1._try:
      return this.parseTryStatement(node);
    case types$1._const:
    case types$1._var:
      kind = kind || this.value;
      if (context && kind !== "var") {
        this.unexpected();
      }
      return this.parseVarStatement(node, kind);
    case types$1._while:
      return this.parseWhileStatement(node);
    case types$1._with:
      return this.parseWithStatement(node);
    case types$1.braceL:
      return this.parseBlock(true, node);
    case types$1.semi:
      return this.parseEmptyStatement(node);
    case types$1._export:
    case types$1._import:
      if (this.options.ecmaVersion > 10 && starttype === types$1._import) {
        skipWhiteSpace.lastIndex = this.pos;
        var skip = skipWhiteSpace.exec(this.input);
        var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
        if (nextCh === 40 || nextCh === 46) {
          return this.parseExpressionStatement(node, this.parseExpression());
        }
      }
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) {
          this.raise(this.start, "'import' and 'export' may only appear at the top level");
        }
        if (!this.inModule) {
          this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
        }
      }
      return starttype === types$1._import ? this.parseImport(node) : this.parseExport(node, exports);
    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    default:
      if (this.isAsyncFunction()) {
        if (context) {
          this.unexpected();
        }
        this.next();
        return this.parseFunctionStatement(node, true, !context);
      }
      var maybeName = this.value, expr = this.parseExpression();
      if (starttype === types$1.name && expr.type === "Identifier" && this.eat(types$1.colon)) {
        return this.parseLabeledStatement(node, maybeName, expr, context);
      } else {
        return this.parseExpressionStatement(node, expr);
      }
  }
};
pp$8.parseBreakContinueStatement = function(node, keyword) {
  var isBreak = keyword === "break";
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.label = null;
  } else if (this.type !== types$1.name) {
    this.unexpected();
  } else {
    node.label = this.parseIdent();
    this.semicolon();
  }
  var i = 0;
  for (; i < this.labels.length; ++i) {
    var lab = this.labels[i];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) {
        break;
      }
      if (node.label && isBreak) {
        break;
      }
    }
  }
  if (i === this.labels.length) {
    this.raise(node.start, "Unsyntactic " + keyword);
  }
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
};
pp$8.parseDebuggerStatement = function(node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement");
};
pp$8.parseDoStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("do");
  this.labels.pop();
  this.expect(types$1._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) {
    this.eat(types$1.semi);
  } else {
    this.semicolon();
  }
  return this.finishNode(node, "DoWhileStatement");
};
pp$8.parseForStatement = function(node) {
  this.next();
  var awaitAt = this.options.ecmaVersion >= 9 && this.canAwait && this.eatContextual("await") ? this.lastTokStart : -1;
  this.labels.push(loopLabel);
  this.enterScope(0);
  this.expect(types$1.parenL);
  if (this.type === types$1.semi) {
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, null);
  }
  var isLet = this.isLet();
  if (this.type === types$1._var || this.type === types$1._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    this.next();
    this.parseVar(init$1, true, kind);
    this.finishNode(init$1, "VariableDeclaration");
    if ((this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && init$1.declarations.length === 1) {
      if (this.options.ecmaVersion >= 9) {
        if (this.type === types$1._in) {
          if (awaitAt > -1) {
            this.unexpected(awaitAt);
          }
        } else {
          node.await = awaitAt > -1;
        }
      }
      return this.parseForIn(node, init$1);
    }
    if (awaitAt > -1) {
      this.unexpected(awaitAt);
    }
    return this.parseFor(node, init$1);
  }
  var startsWithLet = this.isContextual("let"), isForOf = false;
  var containsEsc = this.containsEsc;
  var refDestructuringErrors = new DestructuringErrors();
  var initPos = this.start;
  var init = awaitAt > -1 ? this.parseExprSubscripts(refDestructuringErrors, "await") : this.parseExpression(true, refDestructuringErrors);
  if (this.type === types$1._in || (isForOf = this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    if (awaitAt > -1) {
      if (this.type === types$1._in) {
        this.unexpected(awaitAt);
      }
      node.await = true;
    } else if (isForOf && this.options.ecmaVersion >= 8) {
      if (init.start === initPos && !containsEsc && init.type === "Identifier" && init.name === "async") {
        this.unexpected();
      } else if (this.options.ecmaVersion >= 9) {
        node.await = false;
      }
    }
    if (startsWithLet && isForOf) {
      this.raise(init.start, "The left-hand side of a for-of loop may not start with 'let'.");
    }
    this.toAssignable(init, false, refDestructuringErrors);
    this.checkLValPattern(init);
    return this.parseForIn(node, init);
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (awaitAt > -1) {
    this.unexpected(awaitAt);
  }
  return this.parseFor(node, init);
};
pp$8.parseFunctionStatement = function(node, isAsync, declarationPosition) {
  this.next();
  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync);
};
pp$8.parseIfStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  node.consequent = this.parseStatement("if");
  node.alternate = this.eat(types$1._else) ? this.parseStatement("if") : null;
  return this.finishNode(node, "IfStatement");
};
pp$8.parseReturnStatement = function(node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction) {
    this.raise(this.start, "'return' outside of function");
  }
  this.next();
  if (this.eat(types$1.semi) || this.insertSemicolon()) {
    node.argument = null;
  } else {
    node.argument = this.parseExpression();
    this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};
pp$8.parseSwitchStatement = function(node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(types$1.braceL);
  this.labels.push(switchLabel);
  this.enterScope(0);
  var cur;
  for (var sawDefault = false; this.type !== types$1.braceR; ) {
    if (this.type === types$1._case || this.type === types$1._default) {
      var isCase = this.type === types$1._case;
      if (cur) {
        this.finishNode(cur, "SwitchCase");
      }
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) {
          this.raiseRecoverable(this.lastTokStart, "Multiple default clauses");
        }
        sawDefault = true;
        cur.test = null;
      }
      this.expect(types$1.colon);
    } else {
      if (!cur) {
        this.unexpected();
      }
      cur.consequent.push(this.parseStatement(null));
    }
  }
  this.exitScope();
  if (cur) {
    this.finishNode(cur, "SwitchCase");
  }
  this.next();
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement");
};
pp$8.parseThrowStatement = function(node) {
  this.next();
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) {
    this.raise(this.lastTokEnd, "Illegal newline after throw");
  }
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement");
};
var empty$1 = [];
pp$8.parseCatchClauseParam = function() {
  var param = this.parseBindingAtom();
  var simple = param.type === "Identifier";
  this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
  this.checkLValPattern(param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
  this.expect(types$1.parenR);
  return param;
};
pp$8.parseTryStatement = function(node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === types$1._catch) {
    var clause = this.startNode();
    this.next();
    if (this.eat(types$1.parenL)) {
      clause.param = this.parseCatchClauseParam();
    } else {
      if (this.options.ecmaVersion < 10) {
        this.unexpected();
      }
      clause.param = null;
      this.enterScope(0);
    }
    clause.body = this.parseBlock(false);
    this.exitScope();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.finalizer = this.eat(types$1._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer) {
    this.raise(node.start, "Missing catch or finally clause");
  }
  return this.finishNode(node, "TryStatement");
};
pp$8.parseVarStatement = function(node, kind, allowMissingInitializer) {
  this.next();
  this.parseVar(node, false, kind, allowMissingInitializer);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};
pp$8.parseWhileStatement = function(node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement("while");
  this.labels.pop();
  return this.finishNode(node, "WhileStatement");
};
pp$8.parseWithStatement = function(node) {
  if (this.strict) {
    this.raise(this.start, "'with' in strict mode");
  }
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement("with");
  return this.finishNode(node, "WithStatement");
};
pp$8.parseEmptyStatement = function(node) {
  this.next();
  return this.finishNode(node, "EmptyStatement");
};
pp$8.parseLabeledStatement = function(node, maybeName, expr, context) {
  for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1) {
    var label = list[i$1];
    if (label.name === maybeName) {
      this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    }
  }
  var kind = this.type.isLoop ? "loop" : this.type === types$1._switch ? "switch" : null;
  for (var i = this.labels.length - 1; i >= 0; i--) {
    var label$1 = this.labels[i];
    if (label$1.statementStart === node.start) {
      label$1.statementStart = this.start;
      label$1.kind = kind;
    } else {
      break;
    }
  }
  this.labels.push({ name: maybeName, kind, statementStart: this.start });
  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement");
};
pp$8.parseExpressionStatement = function(node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement");
};
pp$8.parseBlock = function(createNewLexicalScope, node, exitStrict) {
  if (createNewLexicalScope === void 0) createNewLexicalScope = true;
  if (node === void 0) node = this.startNode();
  node.body = [];
  this.expect(types$1.braceL);
  if (createNewLexicalScope) {
    this.enterScope(0);
  }
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  if (exitStrict) {
    this.strict = false;
  }
  this.next();
  if (createNewLexicalScope) {
    this.exitScope();
  }
  return this.finishNode(node, "BlockStatement");
};
pp$8.parseFor = function(node, init) {
  node.init = init;
  this.expect(types$1.semi);
  node.test = this.type === types$1.semi ? null : this.parseExpression();
  this.expect(types$1.semi);
  node.update = this.type === types$1.parenR ? null : this.parseExpression();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};
pp$8.parseForIn = function(node, init) {
  var isForIn = this.type === types$1._in;
  this.next();
  if (init.type === "VariableDeclaration" && init.declarations[0].init != null && (!isForIn || this.options.ecmaVersion < 8 || this.strict || init.kind !== "var" || init.declarations[0].id.type !== "Identifier")) {
    this.raise(
      init.start,
      (isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer"
    );
  }
  node.left = init;
  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
  this.expect(types$1.parenR);
  node.body = this.parseStatement("for");
  this.exitScope();
  this.labels.pop();
  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement");
};
pp$8.parseVar = function(node, isFor, kind, allowMissingInitializer) {
  node.declarations = [];
  node.kind = kind;
  for (; ; ) {
    var decl = this.startNode();
    this.parseVarId(decl, kind);
    if (this.eat(types$1.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (!allowMissingInitializer && kind === "const" && !(this.type === types$1._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (!allowMissingInitializer && decl.id.type !== "Identifier" && !(isFor && (this.type === types$1._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(types$1.comma)) {
      break;
    }
  }
  return node;
};
pp$8.parseVarId = function(decl, kind) {
  decl.id = this.parseBindingAtom();
  this.checkLValPattern(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
};
var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;
pp$8.parseFunction = function(node, statement, allowExpressionBody, isAsync, forInit) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    if (this.type === types$1.star && statement & FUNC_HANGING_STATEMENT) {
      this.unexpected();
    }
    node.generator = this.eat(types$1.star);
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  if (statement & FUNC_STATEMENT) {
    node.id = statement & FUNC_NULLABLE_ID && this.type !== types$1.name ? null : this.parseIdent();
    if (node.id && !(statement & FUNC_HANGING_STATEMENT)) {
      this.checkLValSimple(node.id, this.strict || node.generator || node.async ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION);
    }
  }
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(node.async, node.generator));
  if (!(statement & FUNC_STATEMENT)) {
    node.id = this.type === types$1.name ? this.parseIdent() : null;
  }
  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, statement & FUNC_STATEMENT ? "FunctionDeclaration" : "FunctionExpression");
};
pp$8.parseFunctionParams = function(node) {
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
};
pp$8.parseClass = function(node, isStatement) {
  this.next();
  var oldStrict = this.strict;
  this.strict = true;
  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var privateNameMap = this.enterClassBody();
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(types$1.braceL);
  while (this.type !== types$1.braceR) {
    var element = this.parseClassElement(node.superClass !== null);
    if (element) {
      classBody.body.push(element);
      if (element.type === "MethodDefinition" && element.kind === "constructor") {
        if (hadConstructor) {
          this.raiseRecoverable(element.start, "Duplicate constructor in the same class");
        }
        hadConstructor = true;
      } else if (element.key && element.key.type === "PrivateIdentifier" && isPrivateNameConflicted(privateNameMap, element)) {
        this.raiseRecoverable(element.key.start, "Identifier '#" + element.key.name + "' has already been declared");
      }
    }
  }
  this.strict = oldStrict;
  this.next();
  node.body = this.finishNode(classBody, "ClassBody");
  this.exitClassBody();
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};
pp$8.parseClassElement = function(constructorAllowsSuper) {
  if (this.eat(types$1.semi)) {
    return null;
  }
  var ecmaVersion = this.options.ecmaVersion;
  var node = this.startNode();
  var keyName = "";
  var isGenerator = false;
  var isAsync = false;
  var kind = "method";
  var isStatic = false;
  if (this.eatContextual("static")) {
    if (ecmaVersion >= 13 && this.eat(types$1.braceL)) {
      this.parseClassStaticBlock(node);
      return node;
    }
    if (this.isClassElementNameStart() || this.type === types$1.star) {
      isStatic = true;
    } else {
      keyName = "static";
    }
  }
  node.static = isStatic;
  if (!keyName && ecmaVersion >= 8 && this.eatContextual("async")) {
    if ((this.isClassElementNameStart() || this.type === types$1.star) && !this.canInsertSemicolon()) {
      isAsync = true;
    } else {
      keyName = "async";
    }
  }
  if (!keyName && (ecmaVersion >= 9 || !isAsync) && this.eat(types$1.star)) {
    isGenerator = true;
  }
  if (!keyName && !isAsync && !isGenerator) {
    var lastValue = this.value;
    if (this.eatContextual("get") || this.eatContextual("set")) {
      if (this.isClassElementNameStart()) {
        kind = lastValue;
      } else {
        keyName = lastValue;
      }
    }
  }
  if (keyName) {
    node.computed = false;
    node.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc);
    node.key.name = keyName;
    this.finishNode(node.key, "Identifier");
  } else {
    this.parseClassElementName(node);
  }
  if (ecmaVersion < 13 || this.type === types$1.parenL || kind !== "method" || isGenerator || isAsync) {
    var isConstructor = !node.static && checkKeyName(node, "constructor");
    var allowsDirectSuper = isConstructor && constructorAllowsSuper;
    if (isConstructor && kind !== "method") {
      this.raise(node.key.start, "Constructor can't have get/set modifier");
    }
    node.kind = isConstructor ? "constructor" : kind;
    this.parseClassMethod(node, isGenerator, isAsync, allowsDirectSuper);
  } else {
    this.parseClassField(node);
  }
  return node;
};
pp$8.isClassElementNameStart = function() {
  return this.type === types$1.name || this.type === types$1.privateId || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword;
};
pp$8.parseClassElementName = function(element) {
  if (this.type === types$1.privateId) {
    if (this.value === "constructor") {
      this.raise(this.start, "Classes can't have an element named '#constructor'");
    }
    element.computed = false;
    element.key = this.parsePrivateIdent();
  } else {
    this.parsePropertyName(element);
  }
};
pp$8.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
  var key = method.key;
  if (method.kind === "constructor") {
    if (isGenerator) {
      this.raise(key.start, "Constructor can't be a generator");
    }
    if (isAsync) {
      this.raise(key.start, "Constructor can't be an async method");
    }
  } else if (method.static && checkKeyName(method, "prototype")) {
    this.raise(key.start, "Classes may not have a static property named prototype");
  }
  var value = method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
  if (method.kind === "get" && value.params.length !== 0) {
    this.raiseRecoverable(value.start, "getter should have no params");
  }
  if (method.kind === "set" && value.params.length !== 1) {
    this.raiseRecoverable(value.start, "setter should have exactly one param");
  }
  if (method.kind === "set" && value.params[0].type === "RestElement") {
    this.raiseRecoverable(value.params[0].start, "Setter cannot use rest params");
  }
  return this.finishNode(method, "MethodDefinition");
};
pp$8.parseClassField = function(field) {
  if (checkKeyName(field, "constructor")) {
    this.raise(field.key.start, "Classes can't have a field named 'constructor'");
  } else if (field.static && checkKeyName(field, "prototype")) {
    this.raise(field.key.start, "Classes can't have a static field named 'prototype'");
  }
  if (this.eat(types$1.eq)) {
    this.enterScope(SCOPE_CLASS_FIELD_INIT | SCOPE_SUPER);
    field.value = this.parseMaybeAssign();
    this.exitScope();
  } else {
    field.value = null;
  }
  this.semicolon();
  return this.finishNode(field, "PropertyDefinition");
};
pp$8.parseClassStaticBlock = function(node) {
  node.body = [];
  var oldLabels = this.labels;
  this.labels = [];
  this.enterScope(SCOPE_CLASS_STATIC_BLOCK | SCOPE_SUPER);
  while (this.type !== types$1.braceR) {
    var stmt = this.parseStatement(null);
    node.body.push(stmt);
  }
  this.next();
  this.exitScope();
  this.labels = oldLabels;
  return this.finishNode(node, "StaticBlock");
};
pp$8.parseClassId = function(node, isStatement) {
  if (this.type === types$1.name) {
    node.id = this.parseIdent();
    if (isStatement) {
      this.checkLValSimple(node.id, BIND_LEXICAL, false);
    }
  } else {
    if (isStatement === true) {
      this.unexpected();
    }
    node.id = null;
  }
};
pp$8.parseClassSuper = function(node) {
  node.superClass = this.eat(types$1._extends) ? this.parseExprSubscripts(null, false) : null;
};
pp$8.enterClassBody = function() {
  var element = { declared: /* @__PURE__ */ Object.create(null), used: [] };
  this.privateNameStack.push(element);
  return element.declared;
};
pp$8.exitClassBody = function() {
  var ref2 = this.privateNameStack.pop();
  var declared = ref2.declared;
  var used = ref2.used;
  if (!this.options.checkPrivateFields) {
    return;
  }
  var len = this.privateNameStack.length;
  var parent = len === 0 ? null : this.privateNameStack[len - 1];
  for (var i = 0; i < used.length; ++i) {
    var id2 = used[i];
    if (!hasOwn(declared, id2.name)) {
      if (parent) {
        parent.used.push(id2);
      } else {
        this.raiseRecoverable(id2.start, "Private field '#" + id2.name + "' must be declared in an enclosing class");
      }
    }
  }
};
function isPrivateNameConflicted(privateNameMap, element) {
  var name = element.key.name;
  var curr = privateNameMap[name];
  var next = "true";
  if (element.type === "MethodDefinition" && (element.kind === "get" || element.kind === "set")) {
    next = (element.static ? "s" : "i") + element.kind;
  }
  if (curr === "iget" && next === "iset" || curr === "iset" && next === "iget" || curr === "sget" && next === "sset" || curr === "sset" && next === "sget") {
    privateNameMap[name] = "true";
    return false;
  } else if (!curr) {
    privateNameMap[name] = next;
    return false;
  } else {
    return true;
  }
}
function checkKeyName(node, name) {
  var computed = node.computed;
  var key = node.key;
  return !computed && (key.type === "Identifier" && key.name === name || key.type === "Literal" && key.value === name);
}
pp$8.parseExportAllDeclaration = function(node, exports) {
  if (this.options.ecmaVersion >= 11) {
    if (this.eatContextual("as")) {
      node.exported = this.parseModuleExportName();
      this.checkExport(exports, node.exported, this.lastTokStart);
    } else {
      node.exported = null;
    }
  }
  this.expectContextual("from");
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.source = this.parseExprAtom();
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ExportAllDeclaration");
};
pp$8.parseExport = function(node, exports) {
  this.next();
  if (this.eat(types$1.star)) {
    return this.parseExportAllDeclaration(node, exports);
  }
  if (this.eat(types$1._default)) {
    this.checkExport(exports, "default", this.lastTokStart);
    node.declaration = this.parseExportDefaultDeclaration();
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseExportDeclaration(node);
    if (node.declaration.type === "VariableDeclaration") {
      this.checkVariableExport(exports, node.declaration.declarations);
    } else {
      this.checkExport(exports, node.declaration.id, node.declaration.id.start);
    }
    node.specifiers = [];
    node.source = null;
    if (this.options.ecmaVersion >= 16) {
      node.attributes = [];
    }
  } else {
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers(exports);
    if (this.eatContextual("from")) {
      if (this.type !== types$1.string) {
        this.unexpected();
      }
      node.source = this.parseExprAtom();
      if (this.options.ecmaVersion >= 16) {
        node.attributes = this.parseWithClause();
      }
    } else {
      for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
        var spec = list[i];
        this.checkUnreserved(spec.local);
        this.checkLocalExport(spec.local);
        if (spec.local.type === "Literal") {
          this.raise(spec.local.start, "A string literal cannot be used as an exported binding without `from`.");
        }
      }
      node.source = null;
      if (this.options.ecmaVersion >= 16) {
        node.attributes = [];
      }
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};
pp$8.parseExportDeclaration = function(node) {
  return this.parseStatement(null);
};
pp$8.parseExportDefaultDeclaration = function() {
  var isAsync;
  if (this.type === types$1._function || (isAsync = this.isAsyncFunction())) {
    var fNode = this.startNode();
    this.next();
    if (isAsync) {
      this.next();
    }
    return this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
  } else if (this.type === types$1._class) {
    var cNode = this.startNode();
    return this.parseClass(cNode, "nullableID");
  } else {
    var declaration = this.parseMaybeAssign();
    this.semicolon();
    return declaration;
  }
};
pp$8.checkExport = function(exports, name, pos) {
  if (!exports) {
    return;
  }
  if (typeof name !== "string") {
    name = name.type === "Identifier" ? name.name : name.value;
  }
  if (hasOwn(exports, name)) {
    this.raiseRecoverable(pos, "Duplicate export '" + name + "'");
  }
  exports[name] = true;
};
pp$8.checkPatternExport = function(exports, pat) {
  var type = pat.type;
  if (type === "Identifier") {
    this.checkExport(exports, pat, pat.start);
  } else if (type === "ObjectPattern") {
    for (var i = 0, list = pat.properties; i < list.length; i += 1) {
      var prop = list[i];
      this.checkPatternExport(exports, prop);
    }
  } else if (type === "ArrayPattern") {
    for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
      var elt = list$1[i$1];
      if (elt) {
        this.checkPatternExport(exports, elt);
      }
    }
  } else if (type === "Property") {
    this.checkPatternExport(exports, pat.value);
  } else if (type === "AssignmentPattern") {
    this.checkPatternExport(exports, pat.left);
  } else if (type === "RestElement") {
    this.checkPatternExport(exports, pat.argument);
  }
};
pp$8.checkVariableExport = function(exports, decls) {
  if (!exports) {
    return;
  }
  for (var i = 0, list = decls; i < list.length; i += 1) {
    var decl = list[i];
    this.checkPatternExport(exports, decl.id);
  }
};
pp$8.shouldParseExportStatement = function() {
  return this.type.keyword === "var" || this.type.keyword === "const" || this.type.keyword === "class" || this.type.keyword === "function" || this.isLet() || this.isAsyncFunction();
};
pp$8.parseExportSpecifier = function(exports) {
  var node = this.startNode();
  node.local = this.parseModuleExportName();
  node.exported = this.eatContextual("as") ? this.parseModuleExportName() : node.local;
  this.checkExport(
    exports,
    node.exported,
    node.exported.start
  );
  return this.finishNode(node, "ExportSpecifier");
};
pp$8.parseExportSpecifiers = function(exports) {
  var nodes = [], first = true;
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseExportSpecifier(exports));
  }
  return nodes;
};
pp$8.parseImport = function(node) {
  this.next();
  if (this.type === types$1.string) {
    node.specifiers = empty$1;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === types$1.string ? this.parseExprAtom() : this.unexpected();
  }
  if (this.options.ecmaVersion >= 16) {
    node.attributes = this.parseWithClause();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};
pp$8.parseImportSpecifier = function() {
  var node = this.startNode();
  node.imported = this.parseModuleExportName();
  if (this.eatContextual("as")) {
    node.local = this.parseIdent();
  } else {
    this.checkUnreserved(node.imported);
    node.local = node.imported;
  }
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportSpecifier");
};
pp$8.parseImportDefaultSpecifier = function() {
  var node = this.startNode();
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportDefaultSpecifier");
};
pp$8.parseImportNamespaceSpecifier = function() {
  var node = this.startNode();
  this.next();
  this.expectContextual("as");
  node.local = this.parseIdent();
  this.checkLValSimple(node.local, BIND_LEXICAL);
  return this.finishNode(node, "ImportNamespaceSpecifier");
};
pp$8.parseImportSpecifiers = function() {
  var nodes = [], first = true;
  if (this.type === types$1.name) {
    nodes.push(this.parseImportDefaultSpecifier());
    if (!this.eat(types$1.comma)) {
      return nodes;
    }
  }
  if (this.type === types$1.star) {
    nodes.push(this.parseImportNamespaceSpecifier());
    return nodes;
  }
  this.expect(types$1.braceL);
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    nodes.push(this.parseImportSpecifier());
  }
  return nodes;
};
pp$8.parseWithClause = function() {
  var nodes = [];
  if (!this.eat(types$1._with)) {
    return nodes;
  }
  this.expect(types$1.braceL);
  var attributeKeys = {};
  var first = true;
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var attr = this.parseImportAttribute();
    var keyName = attr.key.type === "Identifier" ? attr.key.name : attr.key.value;
    if (hasOwn(attributeKeys, keyName)) {
      this.raiseRecoverable(attr.key.start, "Duplicate attribute key '" + keyName + "'");
    }
    attributeKeys[keyName] = true;
    nodes.push(attr);
  }
  return nodes;
};
pp$8.parseImportAttribute = function() {
  var node = this.startNode();
  node.key = this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
  this.expect(types$1.colon);
  if (this.type !== types$1.string) {
    this.unexpected();
  }
  node.value = this.parseExprAtom();
  return this.finishNode(node, "ImportAttribute");
};
pp$8.parseModuleExportName = function() {
  if (this.options.ecmaVersion >= 13 && this.type === types$1.string) {
    var stringLiteral = this.parseLiteral(this.value);
    if (loneSurrogate.test(stringLiteral.value)) {
      this.raise(stringLiteral.start, "An export name cannot include a lone surrogate.");
    }
    return stringLiteral;
  }
  return this.parseIdent(true);
};
pp$8.adaptDirectivePrologue = function(statements) {
  for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
    statements[i].directive = statements[i].expression.raw.slice(1, -1);
  }
};
pp$8.isDirectiveCandidate = function(statement) {
  return this.options.ecmaVersion >= 5 && statement.type === "ExpressionStatement" && statement.expression.type === "Literal" && typeof statement.expression.value === "string" && // Reject parenthesized strings.
  (this.input[statement.start] === '"' || this.input[statement.start] === "'");
};
var pp$7 = Parser.prototype;
pp$7.toAssignable = function(node, isBinding, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
        if (this.inAsync && node.name === "await") {
          this.raise(node.start, "Cannot use 'await' as identifier inside an async function");
        }
        break;
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break;
      case "ObjectExpression":
        node.type = "ObjectPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        for (var i = 0, list = node.properties; i < list.length; i += 1) {
          var prop = list[i];
          this.toAssignable(prop, isBinding);
          if (prop.type === "RestElement" && (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")) {
            this.raise(prop.argument.start, "Unexpected token");
          }
        }
        break;
      case "Property":
        if (node.kind !== "init") {
          this.raise(node.key.start, "Object pattern can't contain getter or setter");
        }
        this.toAssignable(node.value, isBinding);
        break;
      case "ArrayExpression":
        node.type = "ArrayPattern";
        if (refDestructuringErrors) {
          this.checkPatternErrors(refDestructuringErrors, true);
        }
        this.toAssignableList(node.elements, isBinding);
        break;
      case "SpreadElement":
        node.type = "RestElement";
        this.toAssignable(node.argument, isBinding);
        if (node.argument.type === "AssignmentPattern") {
          this.raise(node.argument.start, "Rest elements cannot have a default value");
        }
        break;
      case "AssignmentExpression":
        if (node.operator !== "=") {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        node.type = "AssignmentPattern";
        delete node.operator;
        this.toAssignable(node.left, isBinding);
        break;
      case "ParenthesizedExpression":
        this.toAssignable(node.expression, isBinding, refDestructuringErrors);
        break;
      case "ChainExpression":
        this.raiseRecoverable(node.start, "Optional chaining cannot appear in left-hand side");
        break;
      case "MemberExpression":
        if (!isBinding) {
          break;
        }
      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  } else if (refDestructuringErrors) {
    this.checkPatternErrors(refDestructuringErrors, true);
  }
  return node;
};
pp$7.toAssignableList = function(exprList, isBinding) {
  var end = exprList.length;
  for (var i = 0; i < end; i++) {
    var elt = exprList[i];
    if (elt) {
      this.toAssignable(elt, isBinding);
    }
  }
  if (end) {
    var last2 = exprList[end - 1];
    if (this.options.ecmaVersion === 6 && isBinding && last2 && last2.type === "RestElement" && last2.argument.type !== "Identifier") {
      this.unexpected(last2.argument.start);
    }
  }
  return exprList;
};
pp$7.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
  return this.finishNode(node, "SpreadElement");
};
pp$7.parseRestBinding = function() {
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion === 6 && this.type !== types$1.name) {
    this.unexpected();
  }
  node.argument = this.parseBindingAtom();
  return this.finishNode(node, "RestElement");
};
pp$7.parseBindingAtom = function() {
  if (this.options.ecmaVersion >= 6) {
    switch (this.type) {
      case types$1.bracketL:
        var node = this.startNode();
        this.next();
        node.elements = this.parseBindingList(types$1.bracketR, true, true);
        return this.finishNode(node, "ArrayPattern");
      case types$1.braceL:
        return this.parseObj(true);
    }
  }
  return this.parseIdent();
};
pp$7.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowModifiers) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (first) {
      first = false;
    } else {
      this.expect(types$1.comma);
    }
    if (allowEmpty && this.type === types$1.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === types$1.ellipsis) {
      var rest = this.parseRestBinding();
      this.parseBindingListItem(rest);
      elts.push(rest);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      this.expect(close);
      break;
    } else {
      elts.push(this.parseAssignableListItem(allowModifiers));
    }
  }
  return elts;
};
pp$7.parseAssignableListItem = function(allowModifiers) {
  var elem = this.parseMaybeDefault(this.start, this.startLoc);
  this.parseBindingListItem(elem);
  return elem;
};
pp$7.parseBindingListItem = function(param) {
  return param;
};
pp$7.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(types$1.eq)) {
    return left;
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};
pp$7.checkLValSimple = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  var isBind = bindingType !== BIND_NONE;
  switch (expr.type) {
    case "Identifier":
      if (this.strict && this.reservedWordsStrictBind.test(expr.name)) {
        this.raiseRecoverable(expr.start, (isBind ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      }
      if (isBind) {
        if (bindingType === BIND_LEXICAL && expr.name === "let") {
          this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name");
        }
        if (checkClashes) {
          if (hasOwn(checkClashes, expr.name)) {
            this.raiseRecoverable(expr.start, "Argument name clash");
          }
          checkClashes[expr.name] = true;
        }
        if (bindingType !== BIND_OUTSIDE) {
          this.declareName(expr.name, bindingType, expr.start);
        }
      }
      break;
    case "ChainExpression":
      this.raiseRecoverable(expr.start, "Optional chaining cannot appear in left-hand side");
      break;
    case "MemberExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding member expression");
      }
      break;
    case "ParenthesizedExpression":
      if (isBind) {
        this.raiseRecoverable(expr.start, "Binding parenthesized expression");
      }
      return this.checkLValSimple(expr.expression, bindingType, checkClashes);
    default:
      this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
  }
};
pp$7.checkLValPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "ObjectPattern":
      for (var i = 0, list = expr.properties; i < list.length; i += 1) {
        var prop = list[i];
        this.checkLValInnerPattern(prop, bindingType, checkClashes);
      }
      break;
    case "ArrayPattern":
      for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
        var elem = list$1[i$1];
        if (elem) {
          this.checkLValInnerPattern(elem, bindingType, checkClashes);
        }
      }
      break;
    default:
      this.checkLValSimple(expr, bindingType, checkClashes);
  }
};
pp$7.checkLValInnerPattern = function(expr, bindingType, checkClashes) {
  if (bindingType === void 0) bindingType = BIND_NONE;
  switch (expr.type) {
    case "Property":
      this.checkLValInnerPattern(expr.value, bindingType, checkClashes);
      break;
    case "AssignmentPattern":
      this.checkLValPattern(expr.left, bindingType, checkClashes);
      break;
    case "RestElement":
      this.checkLValPattern(expr.argument, bindingType, checkClashes);
      break;
    default:
      this.checkLValPattern(expr, bindingType, checkClashes);
  }
};
var TokContext = function TokContext2(token, isExpr, preserveSpace, override, generator) {
  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
  this.generator = !!generator;
};
var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", false),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function(p) {
    return p.tryReadTemplateToken();
  }),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
  f_expr_gen: new TokContext("function", true, false, null, true),
  f_gen: new TokContext("function", false, false, null, true)
};
var pp$6 = Parser.prototype;
pp$6.initialContext = function() {
  return [types.b_stat];
};
pp$6.curContext = function() {
  return this.context[this.context.length - 1];
};
pp$6.braceIsBlock = function(prevType) {
  var parent = this.curContext();
  if (parent === types.f_expr || parent === types.f_stat) {
    return true;
  }
  if (prevType === types$1.colon && (parent === types.b_stat || parent === types.b_expr)) {
    return !parent.isExpr;
  }
  if (prevType === types$1._return || prevType === types$1.name && this.exprAllowed) {
    return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  }
  if (prevType === types$1._else || prevType === types$1.semi || prevType === types$1.eof || prevType === types$1.parenR || prevType === types$1.arrow) {
    return true;
  }
  if (prevType === types$1.braceL) {
    return parent === types.b_stat;
  }
  if (prevType === types$1._var || prevType === types$1._const || prevType === types$1.name) {
    return false;
  }
  return !this.exprAllowed;
};
pp$6.inGeneratorContext = function() {
  for (var i = this.context.length - 1; i >= 1; i--) {
    var context = this.context[i];
    if (context.token === "function") {
      return context.generator;
    }
  }
  return false;
};
pp$6.updateContext = function(prevType) {
  var update, type = this.type;
  if (type.keyword && prevType === types$1.dot) {
    this.exprAllowed = false;
  } else if (update = type.updateContext) {
    update.call(this, prevType);
  } else {
    this.exprAllowed = type.beforeExpr;
  }
};
pp$6.overrideContext = function(tokenCtx) {
  if (this.curContext() !== tokenCtx) {
    this.context[this.context.length - 1] = tokenCtx;
  }
};
types$1.parenR.updateContext = types$1.braceR.updateContext = function() {
  if (this.context.length === 1) {
    this.exprAllowed = true;
    return;
  }
  var out = this.context.pop();
  if (out === types.b_stat && this.curContext().token === "function") {
    out = this.context.pop();
  }
  this.exprAllowed = !out.isExpr;
};
types$1.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};
types$1.dollarBraceL.updateContext = function() {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};
types$1.parenL.updateContext = function(prevType) {
  var statementParens = prevType === types$1._if || prevType === types$1._for || prevType === types$1._with || prevType === types$1._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};
types$1.incDec.updateContext = function() {
};
types$1._function.updateContext = types$1._class.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== types$1._else && !(prevType === types$1.semi && this.curContext() !== types.p_stat) && !(prevType === types$1._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) && !((prevType === types$1.colon || prevType === types$1.braceL) && this.curContext() === types.b_stat)) {
    this.context.push(types.f_expr);
  } else {
    this.context.push(types.f_stat);
  }
  this.exprAllowed = false;
};
types$1.colon.updateContext = function() {
  if (this.curContext().token === "function") {
    this.context.pop();
  }
  this.exprAllowed = true;
};
types$1.backQuote.updateContext = function() {
  if (this.curContext() === types.q_tmpl) {
    this.context.pop();
  } else {
    this.context.push(types.q_tmpl);
  }
  this.exprAllowed = false;
};
types$1.star.updateContext = function(prevType) {
  if (prevType === types$1._function) {
    var index = this.context.length - 1;
    if (this.context[index] === types.f_expr) {
      this.context[index] = types.f_expr_gen;
    } else {
      this.context[index] = types.f_gen;
    }
  }
  this.exprAllowed = true;
};
types$1.name.updateContext = function(prevType) {
  var allowed = false;
  if (this.options.ecmaVersion >= 6 && prevType !== types$1.dot) {
    if (this.value === "of" && !this.exprAllowed || this.value === "yield" && this.inGeneratorContext()) {
      allowed = true;
    }
  }
  this.exprAllowed = allowed;
};
var pp$5 = Parser.prototype;
pp$5.checkPropClash = function(prop, propHash, refDestructuringErrors) {
  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement") {
    return;
  }
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) {
    return;
  }
  var key = prop.key;
  var name;
  switch (key.type) {
    case "Identifier":
      name = key.name;
      break;
    case "Literal":
      name = String(key.value);
      break;
    default:
      return;
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) {
        if (refDestructuringErrors) {
          if (refDestructuringErrors.doubleProto < 0) {
            refDestructuringErrors.doubleProto = key.start;
          }
        } else {
          this.raiseRecoverable(key.start, "Redefinition of __proto__ property");
        }
      }
      propHash.proto = true;
    }
    return;
  }
  name = "$" + name;
  var other = propHash[name];
  if (other) {
    var redefinition;
    if (kind === "init") {
      redefinition = this.strict && other.init || other.get || other.set;
    } else {
      redefinition = other.init || other[kind];
    }
    if (redefinition) {
      this.raiseRecoverable(key.start, "Redefinition of property");
    }
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};
pp$5.parseExpression = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeAssign(forInit, refDestructuringErrors);
  if (this.type === types$1.comma) {
    var node = this.startNodeAt(startPos, startLoc);
    node.expressions = [expr];
    while (this.eat(types$1.comma)) {
      node.expressions.push(this.parseMaybeAssign(forInit, refDestructuringErrors));
    }
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};
pp$5.parseMaybeAssign = function(forInit, refDestructuringErrors, afterLeftParse) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) {
      return this.parseYield(forInit);
    } else {
      this.exprAllowed = false;
    }
  }
  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldDoubleProto = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    oldDoubleProto = refDestructuringErrors.doubleProto;
    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors();
    ownDestructuringErrors = true;
  }
  var startPos = this.start, startLoc = this.startLoc;
  if (this.type === types$1.parenL || this.type === types$1.name) {
    this.potentialArrowAt = this.start;
    this.potentialArrowInForAwait = forInit === "await";
  }
  var left = this.parseMaybeConditional(forInit, refDestructuringErrors);
  if (afterLeftParse) {
    left = afterLeftParse.call(this, left, startPos, startLoc);
  }
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    if (this.type === types$1.eq) {
      left = this.toAssignable(left, false, refDestructuringErrors);
    }
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.doubleProto = -1;
    }
    if (refDestructuringErrors.shorthandAssign >= left.start) {
      refDestructuringErrors.shorthandAssign = -1;
    }
    if (this.type === types$1.eq) {
      this.checkLValPattern(left);
    } else {
      this.checkLValSimple(left);
    }
    node.left = left;
    this.next();
    node.right = this.parseMaybeAssign(forInit);
    if (oldDoubleProto > -1) {
      refDestructuringErrors.doubleProto = oldDoubleProto;
    }
    return this.finishNode(node, "AssignmentExpression");
  } else {
    if (ownDestructuringErrors) {
      this.checkExpressionErrors(refDestructuringErrors, true);
    }
  }
  if (oldParenAssign > -1) {
    refDestructuringErrors.parenthesizedAssign = oldParenAssign;
  }
  if (oldTrailingComma > -1) {
    refDestructuringErrors.trailingComma = oldTrailingComma;
  }
  return left;
};
pp$5.parseMaybeConditional = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprOps(forInit, refDestructuringErrors);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  if (this.eat(types$1.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(types$1.colon);
    node.alternate = this.parseMaybeAssign(forInit);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};
pp$5.parseExprOps = function(forInit, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit);
  if (this.checkExpressionErrors(refDestructuringErrors)) {
    return expr;
  }
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit);
};
pp$5.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, forInit) {
  var prec = this.type.binop;
  if (prec != null && (!forInit || this.type !== types$1._in)) {
    if (prec > minPrec) {
      var logical = this.type === types$1.logicalOR || this.type === types$1.logicalAND;
      var coalesce = this.type === types$1.coalesce;
      if (coalesce) {
        prec = types$1.logicalAND.binop;
      }
      var op = this.value;
      this.next();
      var startPos = this.start, startLoc = this.startLoc;
      var right = this.parseExprOp(this.parseMaybeUnary(null, false, false, forInit), startPos, startLoc, prec, forInit);
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical || coalesce);
      if (logical && this.type === types$1.coalesce || coalesce && (this.type === types$1.logicalOR || this.type === types$1.logicalAND)) {
        this.raiseRecoverable(this.start, "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses");
      }
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, forInit);
    }
  }
  return left;
};
pp$5.buildBinary = function(startPos, startLoc, left, right, op, logical) {
  if (right.type === "PrivateIdentifier") {
    this.raise(right.start, "Private identifier can only be left side of binary expression");
  }
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.operator = op;
  node.right = right;
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression");
};
pp$5.parseMaybeUnary = function(refDestructuringErrors, sawUnary, incDec, forInit) {
  var startPos = this.start, startLoc = this.startLoc, expr;
  if (this.isContextual("await") && this.canAwait) {
    expr = this.parseAwait(forInit);
    sawUnary = true;
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === types$1.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true, update, forInit);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) {
      this.checkLValSimple(node.argument);
    } else if (this.strict && node.operator === "delete" && isLocalVariableAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Deleting local variable in strict mode");
    } else if (node.operator === "delete" && isPrivateFieldAccess(node.argument)) {
      this.raiseRecoverable(node.start, "Private fields can not be deleted");
    } else {
      sawUnary = true;
    }
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (!sawUnary && this.type === types$1.privateId) {
    if ((forInit || this.privateNameStack.length === 0) && this.options.checkPrivateFields) {
      this.unexpected();
    }
    expr = this.parsePrivateIdent();
    if (this.type !== types$1._in) {
      this.unexpected();
    }
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) {
      return expr;
    }
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this.startNodeAt(startPos, startLoc);
      node$1.operator = this.value;
      node$1.prefix = false;
      node$1.argument = expr;
      this.checkLValSimple(expr);
      this.next();
      expr = this.finishNode(node$1, "UpdateExpression");
    }
  }
  if (!incDec && this.eat(types$1.starstar)) {
    if (sawUnary) {
      this.unexpected(this.lastTokStart);
    } else {
      return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false, false, forInit), "**", false);
    }
  } else {
    return expr;
  }
};
function isLocalVariableAccess(node) {
  return node.type === "Identifier" || node.type === "ParenthesizedExpression" && isLocalVariableAccess(node.expression);
}
function isPrivateFieldAccess(node) {
  return node.type === "MemberExpression" && node.property.type === "PrivateIdentifier" || node.type === "ChainExpression" && isPrivateFieldAccess(node.expression) || node.type === "ParenthesizedExpression" && isPrivateFieldAccess(node.expression);
}
pp$5.parseExprSubscripts = function(refDestructuringErrors, forInit) {
  var startPos = this.start, startLoc = this.startLoc;
  var expr = this.parseExprAtom(refDestructuringErrors, forInit);
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")") {
    return expr;
  }
  var result = this.parseSubscripts(expr, startPos, startLoc, false, forInit);
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) {
      refDestructuringErrors.parenthesizedAssign = -1;
    }
    if (refDestructuringErrors.parenthesizedBind >= result.start) {
      refDestructuringErrors.parenthesizedBind = -1;
    }
    if (refDestructuringErrors.trailingComma >= result.start) {
      refDestructuringErrors.trailingComma = -1;
    }
  }
  return result;
};
pp$5.parseSubscripts = function(base, startPos, startLoc, noCalls, forInit) {
  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" && this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 && this.potentialArrowAt === base.start;
  var optionalChained = false;
  while (true) {
    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit);
    if (element.optional) {
      optionalChained = true;
    }
    if (element === base || element.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        var chainNode = this.startNodeAt(startPos, startLoc);
        chainNode.expression = element;
        element = this.finishNode(chainNode, "ChainExpression");
      }
      return element;
    }
    base = element;
  }
};
pp$5.shouldParseAsyncArrow = function() {
  return !this.canInsertSemicolon() && this.eat(types$1.arrow);
};
pp$5.parseSubscriptAsyncArrow = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true, forInit);
};
pp$5.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
  var optionalSupported = this.options.ecmaVersion >= 11;
  var optional = optionalSupported && this.eat(types$1.questionDot);
  if (noCalls && optional) {
    this.raise(this.lastTokStart, "Optional chaining cannot appear in the callee of new expressions");
  }
  var computed = this.eat(types$1.bracketL);
  if (computed || optional && this.type !== types$1.parenL && this.type !== types$1.backQuote || this.eat(types$1.dot)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.object = base;
    if (computed) {
      node.property = this.parseExpression();
      this.expect(types$1.bracketR);
    } else if (this.type === types$1.privateId && base.type !== "Super") {
      node.property = this.parsePrivateIdent();
    } else {
      node.property = this.parseIdent(this.options.allowReserved !== "never");
    }
    node.computed = !!computed;
    if (optionalSupported) {
      node.optional = optional;
    }
    base = this.finishNode(node, "MemberExpression");
  } else if (!noCalls && this.eat(types$1.parenL)) {
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    this.yieldPos = 0;
    this.awaitPos = 0;
    this.awaitIdentPos = 0;
    var exprList = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      if (this.awaitIdentPos > 0) {
        this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function");
      }
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      this.awaitIdentPos = oldAwaitIdentPos;
      return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    var node$1 = this.startNodeAt(startPos, startLoc);
    node$1.callee = base;
    node$1.arguments = exprList;
    if (optionalSupported) {
      node$1.optional = optional;
    }
    base = this.finishNode(node$1, "CallExpression");
  } else if (this.type === types$1.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions");
    }
    var node$2 = this.startNodeAt(startPos, startLoc);
    node$2.tag = base;
    node$2.quasi = this.parseTemplate({ isTagged: true });
    base = this.finishNode(node$2, "TaggedTemplateExpression");
  }
  return base;
};
pp$5.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {
  if (this.type === types$1.slash) {
    this.readRegexp();
  }
  var node, canBeArrow = this.potentialArrowAt === this.start;
  switch (this.type) {
    case types$1._super:
      if (!this.allowSuper) {
        this.raise(this.start, "'super' keyword outside a method");
      }
      node = this.startNode();
      this.next();
      if (this.type === types$1.parenL && !this.allowDirectSuper) {
        this.raise(node.start, "super() call outside constructor of a subclass");
      }
      if (this.type !== types$1.dot && this.type !== types$1.bracketL && this.type !== types$1.parenL) {
        this.unexpected();
      }
      return this.finishNode(node, "Super");
    case types$1._this:
      node = this.startNode();
      this.next();
      return this.finishNode(node, "ThisExpression");
    case types$1.name:
      var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
      var id2 = this.parseIdent(false);
      if (this.options.ecmaVersion >= 8 && !containsEsc && id2.name === "async" && !this.canInsertSemicolon() && this.eat(types$1._function)) {
        this.overrideContext(types.f_expr);
        return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit);
      }
      if (canBeArrow && !this.canInsertSemicolon()) {
        if (this.eat(types$1.arrow)) {
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id2], false, forInit);
        }
        if (this.options.ecmaVersion >= 8 && id2.name === "async" && this.type === types$1.name && !containsEsc && (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
          id2 = this.parseIdent(false);
          if (this.canInsertSemicolon() || !this.eat(types$1.arrow)) {
            this.unexpected();
          }
          return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id2], true, forInit);
        }
      }
      return id2;
    case types$1.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;
    case types$1.num:
    case types$1.string:
      return this.parseLiteral(this.value);
    case types$1._null:
    case types$1._true:
    case types$1._false:
      node = this.startNode();
      node.value = this.type === types$1._null ? null : this.type === types$1._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");
    case types$1.parenL:
      var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit);
      if (refDestructuringErrors) {
        if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr)) {
          refDestructuringErrors.parenthesizedAssign = start;
        }
        if (refDestructuringErrors.parenthesizedBind < 0) {
          refDestructuringErrors.parenthesizedBind = start;
        }
      }
      return expr;
    case types$1.bracketL:
      node = this.startNode();
      this.next();
      node.elements = this.parseExprList(types$1.bracketR, true, true, refDestructuringErrors);
      return this.finishNode(node, "ArrayExpression");
    case types$1.braceL:
      this.overrideContext(types.b_expr);
      return this.parseObj(false, refDestructuringErrors);
    case types$1._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, 0);
    case types$1._class:
      return this.parseClass(this.startNode(), false);
    case types$1._new:
      return this.parseNew();
    case types$1.backQuote:
      return this.parseTemplate();
    case types$1._import:
      if (this.options.ecmaVersion >= 11) {
        return this.parseExprImport(forNew);
      } else {
        return this.unexpected();
      }
    default:
      return this.parseExprAtomDefault();
  }
};
pp$5.parseExprAtomDefault = function() {
  this.unexpected();
};
pp$5.parseExprImport = function(forNew) {
  var node = this.startNode();
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword import");
  }
  this.next();
  if (this.type === types$1.parenL && !forNew) {
    return this.parseDynamicImport(node);
  } else if (this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "import";
    node.meta = this.finishNode(meta, "Identifier");
    return this.parseImportMeta(node);
  } else {
    this.unexpected();
  }
};
pp$5.parseDynamicImport = function(node) {
  this.next();
  node.source = this.parseMaybeAssign();
  if (this.options.ecmaVersion >= 16) {
    if (!this.eat(types$1.parenR)) {
      this.expect(types$1.comma);
      if (!this.afterTrailingComma(types$1.parenR)) {
        node.options = this.parseMaybeAssign();
        if (!this.eat(types$1.parenR)) {
          this.expect(types$1.comma);
          if (!this.afterTrailingComma(types$1.parenR)) {
            this.unexpected();
          }
        }
      } else {
        node.options = null;
      }
    } else {
      node.options = null;
    }
  } else {
    if (!this.eat(types$1.parenR)) {
      var errorPos = this.start;
      if (this.eat(types$1.comma) && this.eat(types$1.parenR)) {
        this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
      } else {
        this.unexpected(errorPos);
      }
    }
  }
  return this.finishNode(node, "ImportExpression");
};
pp$5.parseImportMeta = function(node) {
  this.next();
  var containsEsc = this.containsEsc;
  node.property = this.parseIdent(true);
  if (node.property.name !== "meta") {
    this.raiseRecoverable(node.property.start, "The only valid meta property for import is 'import.meta'");
  }
  if (containsEsc) {
    this.raiseRecoverable(node.start, "'import.meta' must not contain escaped characters");
  }
  if (this.options.sourceType !== "module" && !this.options.allowImportExportEverywhere) {
    this.raiseRecoverable(node.start, "Cannot use 'import.meta' outside a module");
  }
  return this.finishNode(node, "MetaProperty");
};
pp$5.parseLiteral = function(value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) {
    node.bigint = node.raw.slice(0, -1).replace(/_/g, "");
  }
  this.next();
  return this.finishNode(node, "Literal");
};
pp$5.parseParenExpression = function() {
  this.expect(types$1.parenL);
  var val = this.parseExpression();
  this.expect(types$1.parenR);
  return val;
};
pp$5.shouldParseArrow = function(exprList) {
  return !this.canInsertSemicolon();
};
pp$5.parseParenAndDistinguishExpression = function(canBeArrow, forInit) {
  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();
    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    var exprList = [], first = true, lastIsComma = false;
    var refDestructuringErrors = new DestructuringErrors(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    this.yieldPos = 0;
    this.awaitPos = 0;
    while (this.type !== types$1.parenR) {
      first ? first = false : this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(types$1.parenR, true)) {
        lastIsComma = true;
        break;
      } else if (this.type === types$1.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRestBinding()));
        if (this.type === types$1.comma) {
          this.raiseRecoverable(
            this.start,
            "Comma is not permitted after the rest element"
          );
        }
        break;
      } else {
        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
      }
    }
    var innerEndPos = this.lastTokEnd, innerEndLoc = this.lastTokEndLoc;
    this.expect(types$1.parenR);
    if (canBeArrow && this.shouldParseArrow(exprList) && this.eat(types$1.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false);
      this.checkYieldAwaitInDefaultParams();
      this.yieldPos = oldYieldPos;
      this.awaitPos = oldAwaitPos;
      return this.parseParenArrowList(startPos, startLoc, exprList, forInit);
    }
    if (!exprList.length || lastIsComma) {
      this.unexpected(this.lastTokStart);
    }
    if (spreadStart) {
      this.unexpected(spreadStart);
    }
    this.checkExpressionErrors(refDestructuringErrors, true);
    this.yieldPos = oldYieldPos || this.yieldPos;
    this.awaitPos = oldAwaitPos || this.awaitPos;
    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }
  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};
pp$5.parseParenItem = function(item) {
  return item;
};
pp$5.parseParenArrowList = function(startPos, startLoc, exprList, forInit) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, false, forInit);
};
var empty = [];
pp$5.parseNew = function() {
  if (this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword new");
  }
  var node = this.startNode();
  this.next();
  if (this.options.ecmaVersion >= 6 && this.type === types$1.dot) {
    var meta = this.startNodeAt(node.start, node.loc && node.loc.start);
    meta.name = "new";
    node.meta = this.finishNode(meta, "Identifier");
    this.next();
    var containsEsc = this.containsEsc;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") {
      this.raiseRecoverable(node.property.start, "The only valid meta property for new is 'new.target'");
    }
    if (containsEsc) {
      this.raiseRecoverable(node.start, "'new.target' must not contain escaped characters");
    }
    if (!this.allowNewDotTarget) {
      this.raiseRecoverable(node.start, "'new.target' can only be used in functions and class static block");
    }
    return this.finishNode(node, "MetaProperty");
  }
  var startPos = this.start, startLoc = this.startLoc;
  node.callee = this.parseSubscripts(this.parseExprAtom(null, false, true), startPos, startLoc, true, false);
  if (this.eat(types$1.parenL)) {
    node.arguments = this.parseExprList(types$1.parenR, this.options.ecmaVersion >= 8, false);
  } else {
    node.arguments = empty;
  }
  return this.finishNode(node, "NewExpression");
};
pp$5.parseTemplateElement = function(ref2) {
  var isTagged = ref2.isTagged;
  var elem = this.startNode();
  if (this.type === types$1.invalidTemplate) {
    if (!isTagged) {
      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    }
    elem.value = {
      raw: this.value.replace(/\r\n?/g, "\n"),
      cooked: null
    };
  } else {
    elem.value = {
      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
      cooked: this.value
    };
  }
  this.next();
  elem.tail = this.type === types$1.backQuote;
  return this.finishNode(elem, "TemplateElement");
};
pp$5.parseTemplate = function(ref2) {
  if (ref2 === void 0) ref2 = {};
  var isTagged = ref2.isTagged;
  if (isTagged === void 0) isTagged = false;
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement({ isTagged });
  node.quasis = [curElt];
  while (!curElt.tail) {
    if (this.type === types$1.eof) {
      this.raise(this.pos, "Unterminated template literal");
    }
    this.expect(types$1.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(types$1.braceR);
    node.quasis.push(curElt = this.parseTemplateElement({ isTagged }));
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral");
};
pp$5.isAsyncProp = function(prop) {
  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" && (this.type === types$1.name || this.type === types$1.num || this.type === types$1.string || this.type === types$1.bracketL || this.type.keyword || this.options.ecmaVersion >= 9 && this.type === types$1.star) && !lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};
pp$5.parseObj = function(isPattern, refDestructuringErrors) {
  var node = this.startNode(), first = true, propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(types$1.braceR)) {
    if (!first) {
      this.expect(types$1.comma);
      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types$1.braceR)) {
        break;
      }
    } else {
      first = false;
    }
    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    if (!isPattern) {
      this.checkPropClash(prop, propHash, refDestructuringErrors);
    }
    node.properties.push(prop);
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};
pp$5.parseProperty = function(isPattern, refDestructuringErrors) {
  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
  if (this.options.ecmaVersion >= 9 && this.eat(types$1.ellipsis)) {
    if (isPattern) {
      prop.argument = this.parseIdent(false);
      if (this.type === types$1.comma) {
        this.raiseRecoverable(this.start, "Comma is not permitted after the rest element");
      }
      return this.finishNode(prop, "RestElement");
    }
    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    if (this.type === types$1.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
      refDestructuringErrors.trailingComma = this.start;
    }
    return this.finishNode(prop, "SpreadElement");
  }
  if (this.options.ecmaVersion >= 6) {
    prop.method = false;
    prop.shorthand = false;
    if (isPattern || refDestructuringErrors) {
      startPos = this.start;
      startLoc = this.startLoc;
    }
    if (!isPattern) {
      isGenerator = this.eat(types$1.star);
    }
  }
  var containsEsc = this.containsEsc;
  this.parsePropertyName(prop);
  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    isAsync = true;
    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types$1.star);
    this.parsePropertyName(prop);
  } else {
    isAsync = false;
  }
  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
  return this.finishNode(prop, "Property");
};
pp$5.parseGetterSetter = function(prop) {
  var kind = prop.key.name;
  this.parsePropertyName(prop);
  prop.value = this.parseMethod(false);
  prop.kind = kind;
  var paramCount = prop.kind === "get" ? 0 : 1;
  if (prop.value.params.length !== paramCount) {
    var start = prop.value.start;
    if (prop.kind === "get") {
      this.raiseRecoverable(start, "getter should have no params");
    } else {
      this.raiseRecoverable(start, "setter should have exactly one param");
    }
  } else {
    if (prop.kind === "set" && prop.value.params[0].type === "RestElement") {
      this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params");
    }
  }
};
pp$5.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
  if ((isGenerator || isAsync) && this.type === types$1.colon) {
    this.unexpected();
  }
  if (this.eat(types$1.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === types$1.parenL) {
    if (isPattern) {
      this.unexpected();
    }
    prop.method = true;
    prop.value = this.parseMethod(isGenerator, isAsync);
    prop.kind = "init";
  } else if (!isPattern && !containsEsc && this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type !== types$1.comma && this.type !== types$1.braceR && this.type !== types$1.eq)) {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.parseGetterSetter(prop);
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (isGenerator || isAsync) {
      this.unexpected();
    }
    this.checkUnreserved(prop.key);
    if (prop.key.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = startPos;
    }
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else if (this.type === types$1.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0) {
        refDestructuringErrors.shorthandAssign = this.start;
      }
      prop.value = this.parseMaybeDefault(startPos, startLoc, this.copyNode(prop.key));
    } else {
      prop.value = this.copyNode(prop.key);
    }
    prop.kind = "init";
    prop.shorthand = true;
  } else {
    this.unexpected();
  }
};
pp$5.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(types$1.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(types$1.bracketR);
      return prop.key;
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === types$1.num || this.type === types$1.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never");
};
pp$5.initFunction = function(node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) {
    node.generator = node.expression = false;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = false;
  }
};
pp$5.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
  }
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));
  this.expect(types$1.parenL);
  node.params = this.parseBindingList(types$1.parenR, false, this.options.ecmaVersion >= 8);
  this.checkYieldAwaitInDefaultParams();
  this.parseFunctionBody(node, false, true, false);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "FunctionExpression");
};
pp$5.parseArrowExpression = function(node, params, isAsync, forInit) {
  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
  this.initFunction(node);
  if (this.options.ecmaVersion >= 8) {
    node.async = !!isAsync;
  }
  this.yieldPos = 0;
  this.awaitPos = 0;
  this.awaitIdentPos = 0;
  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true, false, forInit);
  this.yieldPos = oldYieldPos;
  this.awaitPos = oldAwaitPos;
  this.awaitIdentPos = oldAwaitIdentPos;
  return this.finishNode(node, "ArrowFunctionExpression");
};
pp$5.parseFunctionBody = function(node, isArrowFunction, isMethod, forInit) {
  var isExpression = isArrowFunction && this.type !== types$1.braceL;
  var oldStrict = this.strict, useStrict = false;
  if (isExpression) {
    node.body = this.parseMaybeAssign(forInit);
    node.expression = true;
    this.checkParams(node, false);
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end);
      if (useStrict && nonSimple) {
        this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list");
      }
    }
    var oldLabels = this.labels;
    this.labels = [];
    if (useStrict) {
      this.strict = true;
    }
    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    if (this.strict && node.id) {
      this.checkLValSimple(node.id, BIND_OUTSIDE);
    }
    node.body = this.parseBlock(false, void 0, useStrict && !oldStrict);
    node.expression = false;
    this.adaptDirectivePrologue(node.body.body);
    this.labels = oldLabels;
  }
  this.exitScope();
};
pp$5.isSimpleParamList = function(params) {
  for (var i = 0, list = params; i < list.length; i += 1) {
    var param = list[i];
    if (param.type !== "Identifier") {
      return false;
    }
  }
  return true;
};
pp$5.checkParams = function(node, allowDuplicates) {
  var nameHash = /* @__PURE__ */ Object.create(null);
  for (var i = 0, list = node.params; i < list.length; i += 1) {
    var param = list[i];
    this.checkLValInnerPattern(param, BIND_VAR, allowDuplicates ? null : nameHash);
  }
};
pp$5.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var elts = [], first = true;
  while (!this.eat(close)) {
    if (!first) {
      this.expect(types$1.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) {
        break;
      }
    } else {
      first = false;
    }
    var elt = void 0;
    if (allowEmpty && this.type === types$1.comma) {
      elt = null;
    } else if (this.type === types$1.ellipsis) {
      elt = this.parseSpread(refDestructuringErrors);
      if (refDestructuringErrors && this.type === types$1.comma && refDestructuringErrors.trailingComma < 0) {
        refDestructuringErrors.trailingComma = this.start;
      }
    } else {
      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    }
    elts.push(elt);
  }
  return elts;
};
pp$5.checkUnreserved = function(ref2) {
  var start = ref2.start;
  var end = ref2.end;
  var name = ref2.name;
  if (this.inGenerator && name === "yield") {
    this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator");
  }
  if (this.inAsync && name === "await") {
    this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function");
  }
  if (!(this.currentThisScope().flags & SCOPE_VAR) && name === "arguments") {
    this.raiseRecoverable(start, "Cannot use 'arguments' in class field initializer");
  }
  if (this.inClassStaticBlock && (name === "arguments" || name === "await")) {
    this.raise(start, "Cannot use " + name + " in class static initialization block");
  }
  if (this.keywords.test(name)) {
    this.raise(start, "Unexpected keyword '" + name + "'");
  }
  if (this.options.ecmaVersion < 6 && this.input.slice(start, end).indexOf("\\") !== -1) {
    return;
  }
  var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
  if (re.test(name)) {
    if (!this.inAsync && name === "await") {
      this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function");
    }
    this.raiseRecoverable(start, "The keyword '" + name + "' is reserved");
  }
};
pp$5.parseIdent = function(liberal) {
  var node = this.parseIdentNode();
  this.next(!!liberal);
  this.finishNode(node, "Identifier");
  if (!liberal) {
    this.checkUnreserved(node);
    if (node.name === "await" && !this.awaitIdentPos) {
      this.awaitIdentPos = node.start;
    }
  }
  return node;
};
pp$5.parseIdentNode = function() {
  var node = this.startNode();
  if (this.type === types$1.name) {
    node.name = this.value;
  } else if (this.type.keyword) {
    node.name = this.type.keyword;
    if ((node.name === "class" || node.name === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop();
    }
    this.type = types$1.name;
  } else {
    this.unexpected();
  }
  return node;
};
pp$5.parsePrivateIdent = function() {
  var node = this.startNode();
  if (this.type === types$1.privateId) {
    node.name = this.value;
  } else {
    this.unexpected();
  }
  this.next();
  this.finishNode(node, "PrivateIdentifier");
  if (this.options.checkPrivateFields) {
    if (this.privateNameStack.length === 0) {
      this.raise(node.start, "Private field '#" + node.name + "' must be declared in an enclosing class");
    } else {
      this.privateNameStack[this.privateNameStack.length - 1].used.push(node);
    }
  }
  return node;
};
pp$5.parseYield = function(forInit) {
  if (!this.yieldPos) {
    this.yieldPos = this.start;
  }
  var node = this.startNode();
  this.next();
  if (this.type === types$1.semi || this.canInsertSemicolon() || this.type !== types$1.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(types$1.star);
    node.argument = this.parseMaybeAssign(forInit);
  }
  return this.finishNode(node, "YieldExpression");
};
pp$5.parseAwait = function(forInit) {
  if (!this.awaitPos) {
    this.awaitPos = this.start;
  }
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeUnary(null, true, false, forInit);
  return this.finishNode(node, "AwaitExpression");
};
var pp$4 = Parser.prototype;
pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  if (this.sourceFile) {
    message += " in " + this.sourceFile;
  }
  var err = new SyntaxError(message);
  err.pos = pos;
  err.loc = loc;
  err.raisedAt = this.pos;
  throw err;
};
pp$4.raiseRecoverable = pp$4.raise;
pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart);
  }
};
var pp$3 = Parser.prototype;
var Scope = function Scope2(flags) {
  this.flags = flags;
  this.var = [];
  this.lexical = [];
  this.functions = [];
};
pp$3.enterScope = function(flags) {
  this.scopeStack.push(new Scope(flags));
};
pp$3.exitScope = function() {
  this.scopeStack.pop();
};
pp$3.treatFunctionsAsVarInScope = function(scope) {
  return scope.flags & SCOPE_FUNCTION || !this.inModule && scope.flags & SCOPE_TOP;
};
pp$3.declareName = function(name, bindingType, pos) {
  var redeclared = false;
  if (bindingType === BIND_LEXICAL) {
    var scope = this.currentScope();
    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    scope.lexical.push(name);
    if (this.inModule && scope.flags & SCOPE_TOP) {
      delete this.undefinedExports[name];
    }
  } else if (bindingType === BIND_SIMPLE_CATCH) {
    var scope$1 = this.currentScope();
    scope$1.lexical.push(name);
  } else if (bindingType === BIND_FUNCTION) {
    var scope$2 = this.currentScope();
    if (this.treatFunctionsAsVar) {
      redeclared = scope$2.lexical.indexOf(name) > -1;
    } else {
      redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1;
    }
    scope$2.functions.push(name);
  } else {
    for (var i = this.scopeStack.length - 1; i >= 0; --i) {
      var scope$3 = this.scopeStack[i];
      if (scope$3.lexical.indexOf(name) > -1 && !(scope$3.flags & SCOPE_SIMPLE_CATCH && scope$3.lexical[0] === name) || !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
        redeclared = true;
        break;
      }
      scope$3.var.push(name);
      if (this.inModule && scope$3.flags & SCOPE_TOP) {
        delete this.undefinedExports[name];
      }
      if (scope$3.flags & SCOPE_VAR) {
        break;
      }
    }
  }
  if (redeclared) {
    this.raiseRecoverable(pos, "Identifier '" + name + "' has already been declared");
  }
};
pp$3.checkLocalExport = function(id2) {
  if (this.scopeStack[0].lexical.indexOf(id2.name) === -1 && this.scopeStack[0].var.indexOf(id2.name) === -1) {
    this.undefinedExports[id2.name] = id2;
  }
};
pp$3.currentScope = function() {
  return this.scopeStack[this.scopeStack.length - 1];
};
pp$3.currentVarScope = function() {
  for (var i = this.scopeStack.length - 1; ; i--) {
    var scope = this.scopeStack[i];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK)) {
      return scope;
    }
  }
};
pp$3.currentThisScope = function() {
  for (var i = this.scopeStack.length - 1; ; i--) {
    var scope = this.scopeStack[i];
    if (scope.flags & (SCOPE_VAR | SCOPE_CLASS_FIELD_INIT | SCOPE_CLASS_STATIC_BLOCK) && !(scope.flags & SCOPE_ARROW)) {
      return scope;
    }
  }
};
var Node = function Node2(parser, pos, loc) {
  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser.options.locations) {
    this.loc = new SourceLocation(parser, loc);
  }
  if (parser.options.directSourceFile) {
    this.sourceFile = parser.options.directSourceFile;
  }
  if (parser.options.ranges) {
    this.range = [pos, 0];
  }
};
var pp$2 = Parser.prototype;
pp$2.startNode = function() {
  return new Node(this, this.start, this.startLoc);
};
pp$2.startNodeAt = function(pos, loc) {
  return new Node(this, pos, loc);
};
function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations) {
    node.loc.end = loc;
  }
  if (this.options.ranges) {
    node.range[1] = pos;
  }
  return node;
}
pp$2.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
};
pp$2.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc);
};
pp$2.copyNode = function(node) {
  var newNode = new Node(this, node.start, this.startLoc);
  for (var prop in node) {
    newNode[prop] = node[prop];
  }
  return newNode;
};
var scriptValuesAddedInUnicode = "Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sunu Sunuwar Todhri Todr Tulu_Tigalari Tutg Unknown Zzzz";
var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
var ecma11BinaryProperties = ecma10BinaryProperties;
var ecma12BinaryProperties = ecma11BinaryProperties + " EBase EComp EMod EPres ExtPict";
var ecma13BinaryProperties = ecma12BinaryProperties;
var ecma14BinaryProperties = ecma13BinaryProperties;
var unicodeBinaryProperties = {
  9: ecma9BinaryProperties,
  10: ecma10BinaryProperties,
  11: ecma11BinaryProperties,
  12: ecma12BinaryProperties,
  13: ecma13BinaryProperties,
  14: ecma14BinaryProperties
};
var ecma14BinaryPropertiesOfStrings = "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji";
var unicodeBinaryPropertiesOfStrings = {
  9: "",
  10: "",
  11: "",
  12: "",
  13: "",
  14: ecma14BinaryPropertiesOfStrings
};
var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";
var ecma9ScriptValues = "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
var ecma12ScriptValues = ecma11ScriptValues + " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi";
var ecma13ScriptValues = ecma12ScriptValues + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith";
var ecma14ScriptValues = ecma13ScriptValues + " " + scriptValuesAddedInUnicode;
var unicodeScriptValues = {
  9: ecma9ScriptValues,
  10: ecma10ScriptValues,
  11: ecma11ScriptValues,
  12: ecma12ScriptValues,
  13: ecma13ScriptValues,
  14: ecma14ScriptValues
};
var data = {};
function buildUnicodeData(ecmaVersion) {
  var d = data[ecmaVersion] = {
    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
    binaryOfStrings: wordsRegexp(unicodeBinaryPropertiesOfStrings[ecmaVersion]),
    nonBinary: {
      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
      Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
    }
  };
  d.nonBinary.Script_Extensions = d.nonBinary.Script;
  d.nonBinary.gc = d.nonBinary.General_Category;
  d.nonBinary.sc = d.nonBinary.Script;
  d.nonBinary.scx = d.nonBinary.Script_Extensions;
}
for (var i = 0, list = [9, 10, 11, 12, 13, 14]; i < list.length; i += 1) {
  var ecmaVersion = list[i];
  buildUnicodeData(ecmaVersion);
}
var pp$1 = Parser.prototype;
var BranchID = function BranchID2(parent, base) {
  this.parent = parent;
  this.base = base || this;
};
BranchID.prototype.separatedFrom = function separatedFrom(alt) {
  for (var self2 = this; self2; self2 = self2.parent) {
    for (var other = alt; other; other = other.parent) {
      if (self2.base === other.base && self2 !== other) {
        return true;
      }
    }
  }
  return false;
};
BranchID.prototype.sibling = function sibling() {
  return new BranchID(this.parent, this.base);
};
var RegExpValidationState = function RegExpValidationState2(parser) {
  this.parser = parser;
  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "") + (parser.options.ecmaVersion >= 13 ? "d" : "") + (parser.options.ecmaVersion >= 15 ? "v" : "");
  this.unicodeProperties = data[parser.options.ecmaVersion >= 14 ? 14 : parser.options.ecmaVersion];
  this.source = "";
  this.flags = "";
  this.start = 0;
  this.switchU = false;
  this.switchV = false;
  this.switchN = false;
  this.pos = 0;
  this.lastIntValue = 0;
  this.lastStringValue = "";
  this.lastAssertionIsQuantifiable = false;
  this.numCapturingParens = 0;
  this.maxBackReference = 0;
  this.groupNames = /* @__PURE__ */ Object.create(null);
  this.backReferenceNames = [];
  this.branchID = null;
};
RegExpValidationState.prototype.reset = function reset(start, pattern, flags) {
  var unicodeSets = flags.indexOf("v") !== -1;
  var unicode = flags.indexOf("u") !== -1;
  this.start = start | 0;
  this.source = pattern + "";
  this.flags = flags;
  if (unicodeSets && this.parser.options.ecmaVersion >= 15) {
    this.switchU = true;
    this.switchV = true;
    this.switchN = true;
  } else {
    this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
    this.switchV = false;
    this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
  }
};
RegExpValidationState.prototype.raise = function raise(message) {
  this.parser.raiseRecoverable(this.start, "Invalid regular expression: /" + this.source + "/: " + message);
};
RegExpValidationState.prototype.at = function at(i, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l = s.length;
  if (i >= l) {
    return -1;
  }
  var c = s.charCodeAt(i);
  if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i + 1 >= l) {
    return c;
  }
  var next = s.charCodeAt(i + 1);
  return next >= 56320 && next <= 57343 ? (c << 10) + next - 56613888 : c;
};
RegExpValidationState.prototype.nextIndex = function nextIndex(i, forceU) {
  if (forceU === void 0) forceU = false;
  var s = this.source;
  var l = s.length;
  if (i >= l) {
    return l;
  }
  var c = s.charCodeAt(i), next;
  if (!(forceU || this.switchU) || c <= 55295 || c >= 57344 || i + 1 >= l || (next = s.charCodeAt(i + 1)) < 56320 || next > 57343) {
    return i + 1;
  }
  return i + 2;
};
RegExpValidationState.prototype.current = function current(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.pos, forceU);
};
RegExpValidationState.prototype.lookahead = function lookahead(forceU) {
  if (forceU === void 0) forceU = false;
  return this.at(this.nextIndex(this.pos, forceU), forceU);
};
RegExpValidationState.prototype.advance = function advance(forceU) {
  if (forceU === void 0) forceU = false;
  this.pos = this.nextIndex(this.pos, forceU);
};
RegExpValidationState.prototype.eat = function eat(ch, forceU) {
  if (forceU === void 0) forceU = false;
  if (this.current(forceU) === ch) {
    this.advance(forceU);
    return true;
  }
  return false;
};
RegExpValidationState.prototype.eatChars = function eatChars(chs, forceU) {
  if (forceU === void 0) forceU = false;
  var pos = this.pos;
  for (var i = 0, list = chs; i < list.length; i += 1) {
    var ch = list[i];
    var current2 = this.at(pos, forceU);
    if (current2 === -1 || current2 !== ch) {
      return false;
    }
    pos = this.nextIndex(pos, forceU);
  }
  this.pos = pos;
  return true;
};
pp$1.validateRegExpFlags = function(state) {
  var validFlags = state.validFlags;
  var flags = state.flags;
  var u = false;
  var v2 = false;
  for (var i = 0; i < flags.length; i++) {
    var flag = flags.charAt(i);
    if (validFlags.indexOf(flag) === -1) {
      this.raise(state.start, "Invalid regular expression flag");
    }
    if (flags.indexOf(flag, i + 1) > -1) {
      this.raise(state.start, "Duplicate regular expression flag");
    }
    if (flag === "u") {
      u = true;
    }
    if (flag === "v") {
      v2 = true;
    }
  }
  if (this.options.ecmaVersion >= 15 && u && v2) {
    this.raise(state.start, "Invalid regular expression flag");
  }
};
function hasProp(obj) {
  for (var _ in obj) {
    return true;
  }
  return false;
}
pp$1.validateRegExpPattern = function(state) {
  this.regexp_pattern(state);
  if (!state.switchN && this.options.ecmaVersion >= 9 && hasProp(state.groupNames)) {
    state.switchN = true;
    this.regexp_pattern(state);
  }
};
pp$1.regexp_pattern = function(state) {
  state.pos = 0;
  state.lastIntValue = 0;
  state.lastStringValue = "";
  state.lastAssertionIsQuantifiable = false;
  state.numCapturingParens = 0;
  state.maxBackReference = 0;
  state.groupNames = /* @__PURE__ */ Object.create(null);
  state.backReferenceNames.length = 0;
  state.branchID = null;
  this.regexp_disjunction(state);
  if (state.pos !== state.source.length) {
    if (state.eat(
      41
      /* ) */
    )) {
      state.raise("Unmatched ')'");
    }
    if (state.eat(
      93
      /* ] */
    ) || state.eat(
      125
      /* } */
    )) {
      state.raise("Lone quantifier brackets");
    }
  }
  if (state.maxBackReference > state.numCapturingParens) {
    state.raise("Invalid escape");
  }
  for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
    var name = list[i];
    if (!state.groupNames[name]) {
      state.raise("Invalid named capture referenced");
    }
  }
};
pp$1.regexp_disjunction = function(state) {
  var trackDisjunction = this.options.ecmaVersion >= 16;
  if (trackDisjunction) {
    state.branchID = new BranchID(state.branchID, null);
  }
  this.regexp_alternative(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (trackDisjunction) {
      state.branchID = state.branchID.sibling();
    }
    this.regexp_alternative(state);
  }
  if (trackDisjunction) {
    state.branchID = state.branchID.parent;
  }
  if (this.regexp_eatQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  if (state.eat(
    123
    /* { */
  )) {
    state.raise("Lone quantifier brackets");
  }
};
pp$1.regexp_alternative = function(state) {
  while (state.pos < state.source.length && this.regexp_eatTerm(state)) {
  }
};
pp$1.regexp_eatTerm = function(state) {
  if (this.regexp_eatAssertion(state)) {
    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
      if (state.switchU) {
        state.raise("Invalid quantifier");
      }
    }
    return true;
  }
  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    this.regexp_eatQuantifier(state);
    return true;
  }
  return false;
};
pp$1.regexp_eatAssertion = function(state) {
  var start = state.pos;
  state.lastAssertionIsQuantifiable = false;
  if (state.eat(
    94
    /* ^ */
  ) || state.eat(
    36
    /* $ */
  )) {
    return true;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    if (state.eat(
      66
      /* B */
    ) || state.eat(
      98
      /* b */
    )) {
      return true;
    }
    state.pos = start;
  }
  if (state.eat(
    40
    /* ( */
  ) && state.eat(
    63
    /* ? */
  )) {
    var lookbehind = false;
    if (this.options.ecmaVersion >= 9) {
      lookbehind = state.eat(
        60
        /* < */
      );
    }
    if (state.eat(
      61
      /* = */
    ) || state.eat(
      33
      /* ! */
    )) {
      this.regexp_disjunction(state);
      if (!state.eat(
        41
        /* ) */
      )) {
        state.raise("Unterminated group");
      }
      state.lastAssertionIsQuantifiable = !lookbehind;
      return true;
    }
  }
  state.pos = start;
  return false;
};
pp$1.regexp_eatQuantifier = function(state, noError) {
  if (noError === void 0) noError = false;
  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    state.eat(
      63
      /* ? */
    );
    return true;
  }
  return false;
};
pp$1.regexp_eatQuantifierPrefix = function(state, noError) {
  return state.eat(
    42
    /* * */
  ) || state.eat(
    43
    /* + */
  ) || state.eat(
    63
    /* ? */
  ) || this.regexp_eatBracedQuantifier(state, noError);
};
pp$1.regexp_eatBracedQuantifier = function(state, noError) {
  var start = state.pos;
  if (state.eat(
    123
    /* { */
  )) {
    var min = 0, max = -1;
    if (this.regexp_eatDecimalDigits(state)) {
      min = state.lastIntValue;
      if (state.eat(
        44
        /* , */
      ) && this.regexp_eatDecimalDigits(state)) {
        max = state.lastIntValue;
      }
      if (state.eat(
        125
        /* } */
      )) {
        if (max !== -1 && max < min && !noError) {
          state.raise("numbers out of order in {} quantifier");
        }
        return true;
      }
    }
    if (state.switchU && !noError) {
      state.raise("Incomplete quantifier");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatAtom = function(state) {
  return this.regexp_eatPatternCharacters(state) || state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state);
};
pp$1.regexp_eatReverseSolidusAtomEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatAtomEscape(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatUncapturingGroup = function(state) {
  var start = state.pos;
  if (state.eat(
    40
    /* ( */
  )) {
    if (state.eat(
      63
      /* ? */
    )) {
      if (this.options.ecmaVersion >= 16) {
        var addModifiers = this.regexp_eatModifiers(state);
        var hasHyphen = state.eat(
          45
          /* - */
        );
        if (addModifiers || hasHyphen) {
          for (var i = 0; i < addModifiers.length; i++) {
            var modifier = addModifiers.charAt(i);
            if (addModifiers.indexOf(modifier, i + 1) > -1) {
              state.raise("Duplicate regular expression modifiers");
            }
          }
          if (hasHyphen) {
            var removeModifiers = this.regexp_eatModifiers(state);
            if (!addModifiers && !removeModifiers && state.current() === 58) {
              state.raise("Invalid regular expression modifiers");
            }
            for (var i$1 = 0; i$1 < removeModifiers.length; i$1++) {
              var modifier$1 = removeModifiers.charAt(i$1);
              if (removeModifiers.indexOf(modifier$1, i$1 + 1) > -1 || addModifiers.indexOf(modifier$1) > -1) {
                state.raise("Duplicate regular expression modifiers");
              }
            }
          }
        }
      }
      if (state.eat(
        58
        /* : */
      )) {
        this.regexp_disjunction(state);
        if (state.eat(
          41
          /* ) */
        )) {
          return true;
        }
        state.raise("Unterminated group");
      }
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatCapturingGroup = function(state) {
  if (state.eat(
    40
    /* ( */
  )) {
    if (this.options.ecmaVersion >= 9) {
      this.regexp_groupSpecifier(state);
    } else if (state.current() === 63) {
      state.raise("Invalid group");
    }
    this.regexp_disjunction(state);
    if (state.eat(
      41
      /* ) */
    )) {
      state.numCapturingParens += 1;
      return true;
    }
    state.raise("Unterminated group");
  }
  return false;
};
pp$1.regexp_eatModifiers = function(state) {
  var modifiers = "";
  var ch = 0;
  while ((ch = state.current()) !== -1 && isRegularExpressionModifier(ch)) {
    modifiers += codePointToString(ch);
    state.advance();
  }
  return modifiers;
};
function isRegularExpressionModifier(ch) {
  return ch === 105 || ch === 109 || ch === 115;
}
pp$1.regexp_eatExtendedAtom = function(state) {
  return state.eat(
    46
    /* . */
  ) || this.regexp_eatReverseSolidusAtomEscape(state) || this.regexp_eatCharacterClass(state) || this.regexp_eatUncapturingGroup(state) || this.regexp_eatCapturingGroup(state) || this.regexp_eatInvalidBracedQuantifier(state) || this.regexp_eatExtendedPatternCharacter(state);
};
pp$1.regexp_eatInvalidBracedQuantifier = function(state) {
  if (this.regexp_eatBracedQuantifier(state, true)) {
    state.raise("Nothing to repeat");
  }
  return false;
};
pp$1.regexp_eatSyntaxCharacter = function(state) {
  var ch = state.current();
  if (isSyntaxCharacter(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
function isSyntaxCharacter(ch) {
  return ch === 36 || ch >= 40 && ch <= 43 || ch === 46 || ch === 63 || ch >= 91 && ch <= 94 || ch >= 123 && ch <= 125;
}
pp$1.regexp_eatPatternCharacters = function(state) {
  var start = state.pos;
  var ch = 0;
  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
    state.advance();
  }
  return state.pos !== start;
};
pp$1.regexp_eatExtendedPatternCharacter = function(state) {
  var ch = state.current();
  if (ch !== -1 && ch !== 36 && !(ch >= 40 && ch <= 43) && ch !== 46 && ch !== 63 && ch !== 91 && ch !== 94 && ch !== 124) {
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_groupSpecifier = function(state) {
  if (state.eat(
    63
    /* ? */
  )) {
    if (!this.regexp_eatGroupName(state)) {
      state.raise("Invalid group");
    }
    var trackDisjunction = this.options.ecmaVersion >= 16;
    var known = state.groupNames[state.lastStringValue];
    if (known) {
      if (trackDisjunction) {
        for (var i = 0, list = known; i < list.length; i += 1) {
          var altID = list[i];
          if (!altID.separatedFrom(state.branchID)) {
            state.raise("Duplicate capture group name");
          }
        }
      } else {
        state.raise("Duplicate capture group name");
      }
    }
    if (trackDisjunction) {
      (known || (state.groupNames[state.lastStringValue] = [])).push(state.branchID);
    } else {
      state.groupNames[state.lastStringValue] = true;
    }
  }
};
pp$1.regexp_eatGroupName = function(state) {
  state.lastStringValue = "";
  if (state.eat(
    60
    /* < */
  )) {
    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(
      62
      /* > */
    )) {
      return true;
    }
    state.raise("Invalid capture group name");
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierName = function(state) {
  state.lastStringValue = "";
  if (this.regexp_eatRegExpIdentifierStart(state)) {
    state.lastStringValue += codePointToString(state.lastIntValue);
    while (this.regexp_eatRegExpIdentifierPart(state)) {
      state.lastStringValue += codePointToString(state.lastIntValue);
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatRegExpIdentifierStart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierStart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierStart(ch) {
  return isIdentifierStart(ch, true) || ch === 36 || ch === 95;
}
pp$1.regexp_eatRegExpIdentifierPart = function(state) {
  var start = state.pos;
  var forceU = this.options.ecmaVersion >= 11;
  var ch = state.current(forceU);
  state.advance(forceU);
  if (ch === 92 && this.regexp_eatRegExpUnicodeEscapeSequence(state, forceU)) {
    ch = state.lastIntValue;
  }
  if (isRegExpIdentifierPart(ch)) {
    state.lastIntValue = ch;
    return true;
  }
  state.pos = start;
  return false;
};
function isRegExpIdentifierPart(ch) {
  return isIdentifierChar(ch, true) || ch === 36 || ch === 95 || ch === 8204 || ch === 8205;
}
pp$1.regexp_eatAtomEscape = function(state) {
  if (this.regexp_eatBackReference(state) || this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state) || state.switchN && this.regexp_eatKGroupName(state)) {
    return true;
  }
  if (state.switchU) {
    if (state.current() === 99) {
      state.raise("Invalid unicode escape");
    }
    state.raise("Invalid escape");
  }
  return false;
};
pp$1.regexp_eatBackReference = function(state) {
  var start = state.pos;
  if (this.regexp_eatDecimalEscape(state)) {
    var n = state.lastIntValue;
    if (state.switchU) {
      if (n > state.maxBackReference) {
        state.maxBackReference = n;
      }
      return true;
    }
    if (n <= state.numCapturingParens) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatKGroupName = function(state) {
  if (state.eat(
    107
    /* k */
  )) {
    if (this.regexp_eatGroupName(state)) {
      state.backReferenceNames.push(state.lastStringValue);
      return true;
    }
    state.raise("Invalid named reference");
  }
  return false;
};
pp$1.regexp_eatCharacterEscape = function(state) {
  return this.regexp_eatControlEscape(state) || this.regexp_eatCControlLetter(state) || this.regexp_eatZero(state) || this.regexp_eatHexEscapeSequence(state) || this.regexp_eatRegExpUnicodeEscapeSequence(state, false) || !state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state) || this.regexp_eatIdentityEscape(state);
};
pp$1.regexp_eatCControlLetter = function(state) {
  var start = state.pos;
  if (state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatZero = function(state) {
  if (state.current() === 48 && !isDecimalDigit(state.lookahead())) {
    state.lastIntValue = 0;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlEscape = function(state) {
  var ch = state.current();
  if (ch === 116) {
    state.lastIntValue = 9;
    state.advance();
    return true;
  }
  if (ch === 110) {
    state.lastIntValue = 10;
    state.advance();
    return true;
  }
  if (ch === 118) {
    state.lastIntValue = 11;
    state.advance();
    return true;
  }
  if (ch === 102) {
    state.lastIntValue = 12;
    state.advance();
    return true;
  }
  if (ch === 114) {
    state.lastIntValue = 13;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatControlLetter = function(state) {
  var ch = state.current();
  if (isControlLetter(ch)) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
function isControlLetter(ch) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122;
}
pp$1.regexp_eatRegExpUnicodeEscapeSequence = function(state, forceU) {
  if (forceU === void 0) forceU = false;
  var start = state.pos;
  var switchU = forceU || state.switchU;
  if (state.eat(
    117
    /* u */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 4)) {
      var lead = state.lastIntValue;
      if (switchU && lead >= 55296 && lead <= 56319) {
        var leadSurrogateEnd = state.pos;
        if (state.eat(
          92
          /* \ */
        ) && state.eat(
          117
          /* u */
        ) && this.regexp_eatFixedHexDigits(state, 4)) {
          var trail = state.lastIntValue;
          if (trail >= 56320 && trail <= 57343) {
            state.lastIntValue = (lead - 55296) * 1024 + (trail - 56320) + 65536;
            return true;
          }
        }
        state.pos = leadSurrogateEnd;
        state.lastIntValue = lead;
      }
      return true;
    }
    if (switchU && state.eat(
      123
      /* { */
    ) && this.regexp_eatHexDigits(state) && state.eat(
      125
      /* } */
    ) && isValidUnicode(state.lastIntValue)) {
      return true;
    }
    if (switchU) {
      state.raise("Invalid unicode escape");
    }
    state.pos = start;
  }
  return false;
};
function isValidUnicode(ch) {
  return ch >= 0 && ch <= 1114111;
}
pp$1.regexp_eatIdentityEscape = function(state) {
  if (state.switchU) {
    if (this.regexp_eatSyntaxCharacter(state)) {
      return true;
    }
    if (state.eat(
      47
      /* / */
    )) {
      state.lastIntValue = 47;
      return true;
    }
    return false;
  }
  var ch = state.current();
  if (ch !== 99 && (!state.switchN || ch !== 107)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatDecimalEscape = function(state) {
  state.lastIntValue = 0;
  var ch = state.current();
  if (ch >= 49 && ch <= 57) {
    do {
      state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
      state.advance();
    } while ((ch = state.current()) >= 48 && ch <= 57);
    return true;
  }
  return false;
};
var CharSetNone = 0;
var CharSetOk = 1;
var CharSetString = 2;
pp$1.regexp_eatCharacterClassEscape = function(state) {
  var ch = state.current();
  if (isCharacterClassEscape(ch)) {
    state.lastIntValue = -1;
    state.advance();
    return CharSetOk;
  }
  var negate = false;
  if (state.switchU && this.options.ecmaVersion >= 9 && ((negate = ch === 80) || ch === 112)) {
    state.lastIntValue = -1;
    state.advance();
    var result;
    if (state.eat(
      123
      /* { */
    ) && (result = this.regexp_eatUnicodePropertyValueExpression(state)) && state.eat(
      125
      /* } */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Invalid property name");
      }
      return result;
    }
    state.raise("Invalid property name");
  }
  return CharSetNone;
};
function isCharacterClassEscape(ch) {
  return ch === 100 || ch === 68 || ch === 115 || ch === 83 || ch === 119 || ch === 87;
}
pp$1.regexp_eatUnicodePropertyValueExpression = function(state) {
  var start = state.pos;
  if (this.regexp_eatUnicodePropertyName(state) && state.eat(
    61
    /* = */
  )) {
    var name = state.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(state)) {
      var value = state.lastStringValue;
      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
      return CharSetOk;
    }
  }
  state.pos = start;
  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    var nameOrValue = state.lastStringValue;
    return this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
  }
  return CharSetNone;
};
pp$1.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
  if (!hasOwn(state.unicodeProperties.nonBinary, name)) {
    state.raise("Invalid property name");
  }
  if (!state.unicodeProperties.nonBinary[name].test(value)) {
    state.raise("Invalid property value");
  }
};
pp$1.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
  if (state.unicodeProperties.binary.test(nameOrValue)) {
    return CharSetOk;
  }
  if (state.switchV && state.unicodeProperties.binaryOfStrings.test(nameOrValue)) {
    return CharSetString;
  }
  state.raise("Invalid property name");
};
pp$1.regexp_eatUnicodePropertyName = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyNameCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyNameCharacter(ch) {
  return isControlLetter(ch) || ch === 95;
}
pp$1.regexp_eatUnicodePropertyValue = function(state) {
  var ch = 0;
  state.lastStringValue = "";
  while (isUnicodePropertyValueCharacter(ch = state.current())) {
    state.lastStringValue += codePointToString(ch);
    state.advance();
  }
  return state.lastStringValue !== "";
};
function isUnicodePropertyValueCharacter(ch) {
  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch);
}
pp$1.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
  return this.regexp_eatUnicodePropertyValue(state);
};
pp$1.regexp_eatCharacterClass = function(state) {
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (!state.eat(
      93
      /* ] */
    )) {
      state.raise("Unterminated character class");
    }
    if (negate && result === CharSetString) {
      state.raise("Negated character class may contain strings");
    }
    return true;
  }
  return false;
};
pp$1.regexp_classContents = function(state) {
  if (state.current() === 93) {
    return CharSetOk;
  }
  if (state.switchV) {
    return this.regexp_classSetExpression(state);
  }
  this.regexp_nonEmptyClassRanges(state);
  return CharSetOk;
};
pp$1.regexp_nonEmptyClassRanges = function(state) {
  while (this.regexp_eatClassAtom(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassAtom(state)) {
      var right = state.lastIntValue;
      if (state.switchU && (left === -1 || right === -1)) {
        state.raise("Invalid character class");
      }
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
    }
  }
};
pp$1.regexp_eatClassAtom = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatClassEscape(state)) {
      return true;
    }
    if (state.switchU) {
      var ch$1 = state.current();
      if (ch$1 === 99 || isOctalDigit(ch$1)) {
        state.raise("Invalid class escape");
      }
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  var ch = state.current();
  if (ch !== 93) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatClassEscape = function(state) {
  var start = state.pos;
  if (state.eat(
    98
    /* b */
  )) {
    state.lastIntValue = 8;
    return true;
  }
  if (state.switchU && state.eat(
    45
    /* - */
  )) {
    state.lastIntValue = 45;
    return true;
  }
  if (!state.switchU && state.eat(
    99
    /* c */
  )) {
    if (this.regexp_eatClassControlLetter(state)) {
      return true;
    }
    state.pos = start;
  }
  return this.regexp_eatCharacterClassEscape(state) || this.regexp_eatCharacterEscape(state);
};
pp$1.regexp_classSetExpression = function(state) {
  var result = CharSetOk, subResult;
  if (this.regexp_eatClassSetRange(state)) ;
  else if (subResult = this.regexp_eatClassSetOperand(state)) {
    if (subResult === CharSetString) {
      result = CharSetString;
    }
    var start = state.pos;
    while (state.eatChars(
      [38, 38]
      /* && */
    )) {
      if (state.current() !== 38 && (subResult = this.regexp_eatClassSetOperand(state))) {
        if (subResult !== CharSetString) {
          result = CharSetOk;
        }
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
    while (state.eatChars(
      [45, 45]
      /* -- */
    )) {
      if (this.regexp_eatClassSetOperand(state)) {
        continue;
      }
      state.raise("Invalid character in character class");
    }
    if (start !== state.pos) {
      return result;
    }
  } else {
    state.raise("Invalid character in character class");
  }
  for (; ; ) {
    if (this.regexp_eatClassSetRange(state)) {
      continue;
    }
    subResult = this.regexp_eatClassSetOperand(state);
    if (!subResult) {
      return result;
    }
    if (subResult === CharSetString) {
      result = CharSetString;
    }
  }
};
pp$1.regexp_eatClassSetRange = function(state) {
  var start = state.pos;
  if (this.regexp_eatClassSetCharacter(state)) {
    var left = state.lastIntValue;
    if (state.eat(
      45
      /* - */
    ) && this.regexp_eatClassSetCharacter(state)) {
      var right = state.lastIntValue;
      if (left !== -1 && right !== -1 && left > right) {
        state.raise("Range out of order in character class");
      }
      return true;
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatClassSetOperand = function(state) {
  if (this.regexp_eatClassSetCharacter(state)) {
    return CharSetOk;
  }
  return this.regexp_eatClassStringDisjunction(state) || this.regexp_eatNestedClass(state);
};
pp$1.regexp_eatNestedClass = function(state) {
  var start = state.pos;
  if (state.eat(
    91
    /* [ */
  )) {
    var negate = state.eat(
      94
      /* ^ */
    );
    var result = this.regexp_classContents(state);
    if (state.eat(
      93
      /* ] */
    )) {
      if (negate && result === CharSetString) {
        state.raise("Negated character class may contain strings");
      }
      return result;
    }
    state.pos = start;
  }
  if (state.eat(
    92
    /* \ */
  )) {
    var result$1 = this.regexp_eatCharacterClassEscape(state);
    if (result$1) {
      return result$1;
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_eatClassStringDisjunction = function(state) {
  var start = state.pos;
  if (state.eatChars(
    [92, 113]
    /* \q */
  )) {
    if (state.eat(
      123
      /* { */
    )) {
      var result = this.regexp_classStringDisjunctionContents(state);
      if (state.eat(
        125
        /* } */
      )) {
        return result;
      }
    } else {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return null;
};
pp$1.regexp_classStringDisjunctionContents = function(state) {
  var result = this.regexp_classString(state);
  while (state.eat(
    124
    /* | */
  )) {
    if (this.regexp_classString(state) === CharSetString) {
      result = CharSetString;
    }
  }
  return result;
};
pp$1.regexp_classString = function(state) {
  var count = 0;
  while (this.regexp_eatClassSetCharacter(state)) {
    count++;
  }
  return count === 1 ? CharSetOk : CharSetString;
};
pp$1.regexp_eatClassSetCharacter = function(state) {
  var start = state.pos;
  if (state.eat(
    92
    /* \ */
  )) {
    if (this.regexp_eatCharacterEscape(state) || this.regexp_eatClassSetReservedPunctuator(state)) {
      return true;
    }
    if (state.eat(
      98
      /* b */
    )) {
      state.lastIntValue = 8;
      return true;
    }
    state.pos = start;
    return false;
  }
  var ch = state.current();
  if (ch < 0 || ch === state.lookahead() && isClassSetReservedDoublePunctuatorCharacter(ch)) {
    return false;
  }
  if (isClassSetSyntaxCharacter(ch)) {
    return false;
  }
  state.advance();
  state.lastIntValue = ch;
  return true;
};
function isClassSetReservedDoublePunctuatorCharacter(ch) {
  return ch === 33 || ch >= 35 && ch <= 38 || ch >= 42 && ch <= 44 || ch === 46 || ch >= 58 && ch <= 64 || ch === 94 || ch === 96 || ch === 126;
}
function isClassSetSyntaxCharacter(ch) {
  return ch === 40 || ch === 41 || ch === 45 || ch === 47 || ch >= 91 && ch <= 93 || ch >= 123 && ch <= 125;
}
pp$1.regexp_eatClassSetReservedPunctuator = function(state) {
  var ch = state.current();
  if (isClassSetReservedPunctuator(ch)) {
    state.lastIntValue = ch;
    state.advance();
    return true;
  }
  return false;
};
function isClassSetReservedPunctuator(ch) {
  return ch === 33 || ch === 35 || ch === 37 || ch === 38 || ch === 44 || ch === 45 || ch >= 58 && ch <= 62 || ch === 64 || ch === 96 || ch === 126;
}
pp$1.regexp_eatClassControlLetter = function(state) {
  var ch = state.current();
  if (isDecimalDigit(ch) || ch === 95) {
    state.lastIntValue = ch % 32;
    state.advance();
    return true;
  }
  return false;
};
pp$1.regexp_eatHexEscapeSequence = function(state) {
  var start = state.pos;
  if (state.eat(
    120
    /* x */
  )) {
    if (this.regexp_eatFixedHexDigits(state, 2)) {
      return true;
    }
    if (state.switchU) {
      state.raise("Invalid escape");
    }
    state.pos = start;
  }
  return false;
};
pp$1.regexp_eatDecimalDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isDecimalDigit(ch = state.current())) {
    state.lastIntValue = 10 * state.lastIntValue + (ch - 48);
    state.advance();
  }
  return state.pos !== start;
};
function isDecimalDigit(ch) {
  return ch >= 48 && ch <= 57;
}
pp$1.regexp_eatHexDigits = function(state) {
  var start = state.pos;
  var ch = 0;
  state.lastIntValue = 0;
  while (isHexDigit(ch = state.current())) {
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return state.pos !== start;
};
function isHexDigit(ch) {
  return ch >= 48 && ch <= 57 || ch >= 65 && ch <= 70 || ch >= 97 && ch <= 102;
}
function hexToInt(ch) {
  if (ch >= 65 && ch <= 70) {
    return 10 + (ch - 65);
  }
  if (ch >= 97 && ch <= 102) {
    return 10 + (ch - 97);
  }
  return ch - 48;
}
pp$1.regexp_eatLegacyOctalEscapeSequence = function(state) {
  if (this.regexp_eatOctalDigit(state)) {
    var n1 = state.lastIntValue;
    if (this.regexp_eatOctalDigit(state)) {
      var n2 = state.lastIntValue;
      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
      } else {
        state.lastIntValue = n1 * 8 + n2;
      }
    } else {
      state.lastIntValue = n1;
    }
    return true;
  }
  return false;
};
pp$1.regexp_eatOctalDigit = function(state) {
  var ch = state.current();
  if (isOctalDigit(ch)) {
    state.lastIntValue = ch - 48;
    state.advance();
    return true;
  }
  state.lastIntValue = 0;
  return false;
};
function isOctalDigit(ch) {
  return ch >= 48 && ch <= 55;
}
pp$1.regexp_eatFixedHexDigits = function(state, length) {
  var start = state.pos;
  state.lastIntValue = 0;
  for (var i = 0; i < length; ++i) {
    var ch = state.current();
    if (!isHexDigit(ch)) {
      state.pos = start;
      return false;
    }
    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    state.advance();
  }
  return true;
};
var Token = function Token2(p) {
  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations) {
    this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
  }
  if (p.options.ranges) {
    this.range = [p.start, p.end];
  }
};
var pp = Parser.prototype;
pp.next = function(ignoreEscapeSequenceInKeyword) {
  if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc) {
    this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword);
  }
  if (this.options.onToken) {
    this.options.onToken(new Token(this));
  }
  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};
pp.getToken = function() {
  this.next();
  return new Token(this);
};
if (typeof Symbol !== "undefined") {
  pp[Symbol.iterator] = function() {
    var this$1$1 = this;
    return {
      next: function() {
        var token = this$1$1.getToken();
        return {
          done: token.type === types$1.eof,
          value: token
        };
      }
    };
  };
}
pp.nextToken = function() {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) {
    this.skipSpace();
  }
  this.start = this.pos;
  if (this.options.locations) {
    this.startLoc = this.curPosition();
  }
  if (this.pos >= this.input.length) {
    return this.finishToken(types$1.eof);
  }
  if (curContext.override) {
    return curContext.override(this);
  } else {
    this.readToken(this.fullCharCodeAtPos());
  }
};
pp.readToken = function(code) {
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92) {
    return this.readWord();
  }
  return this.getTokenFromCode(code);
};
pp.fullCharCodeAtPos = function() {
  var code = this.input.charCodeAt(this.pos);
  if (code <= 55295 || code >= 56320) {
    return code;
  }
  var next = this.input.charCodeAt(this.pos + 1);
  return next <= 56319 || next >= 57344 ? code : (code << 10) + next - 56613888;
};
pp.skipBlockComment = function() {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) {
    this.raise(this.pos - 2, "Unterminated comment");
  }
  this.pos = end + 2;
  if (this.options.locations) {
    for (var nextBreak = void 0, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1; ) {
      ++this.curLine;
      pos = this.lineStart = nextBreak;
    }
  }
  if (this.options.onComment) {
    this.options.onComment(
      true,
      this.input.slice(start + 2, end),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp.skipLineComment = function(startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && !isNewLine(ch)) {
    ch = this.input.charCodeAt(++this.pos);
  }
  if (this.options.onComment) {
    this.options.onComment(
      false,
      this.input.slice(start + startSkip, this.pos),
      start,
      this.pos,
      startLoc,
      this.curPosition()
    );
  }
};
pp.skipSpace = function() {
  loop: while (this.pos < this.input.length) {
    var ch = this.input.charCodeAt(this.pos);
    switch (ch) {
      case 32:
      case 160:
        ++this.pos;
        break;
      case 13:
        if (this.input.charCodeAt(this.pos + 1) === 10) {
          ++this.pos;
        }
      case 10:
      case 8232:
      case 8233:
        ++this.pos;
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        break;
      case 47:
        switch (this.input.charCodeAt(this.pos + 1)) {
          case 42:
            this.skipBlockComment();
            break;
          case 47:
            this.skipLineComment(2);
            break;
          default:
            break loop;
        }
        break;
      default:
        if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
          ++this.pos;
        } else {
          break loop;
        }
    }
  }
};
pp.finishToken = function(type, val) {
  this.end = this.pos;
  if (this.options.locations) {
    this.endLoc = this.curPosition();
  }
  var prevType = this.type;
  this.type = type;
  this.value = val;
  this.updateContext(prevType);
};
pp.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) {
    return this.readNumber(true);
  }
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
    this.pos += 3;
    return this.finishToken(types$1.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(types$1.dot);
  }
};
pp.readToken_slash = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;
    return this.readRegexp();
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.slash, 1);
};
pp.readToken_mult_modulo_exp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  var tokentype = code === 42 ? types$1.star : types$1.modulo;
  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
    ++size;
    tokentype = types$1.starstar;
    next = this.input.charCodeAt(this.pos + 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, size + 1);
  }
  return this.finishOp(tokentype, size);
};
pp.readToken_pipe_amp = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (this.options.ecmaVersion >= 12) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 === 61) {
        return this.finishOp(types$1.assign, 3);
      }
    }
    return this.finishOp(code === 124 ? types$1.logicalOR : types$1.logicalAND, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(code === 124 ? types$1.bitwiseOR : types$1.bitwiseAND, 1);
};
pp.readToken_caret = function() {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.bitwiseXOR, 1);
};
pp.readToken_plus_min = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 && (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(types$1.incDec, 2);
  }
  if (next === 61) {
    return this.finishOp(types$1.assign, 2);
  }
  return this.finishOp(types$1.plusMin, 1);
};
pp.readToken_lt_gt = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) {
      return this.finishOp(types$1.assign, size + 1);
    }
    return this.finishOp(types$1.bitShift, size);
  }
  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 && this.input.charCodeAt(this.pos + 3) === 45) {
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) {
    size = 2;
  }
  return this.finishOp(types$1.relational, size);
};
pp.readToken_eq_excl = function(code) {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) {
    return this.finishOp(types$1.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  }
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    this.pos += 2;
    return this.finishToken(types$1.arrow);
  }
  return this.finishOp(code === 61 ? types$1.eq : types$1.prefix, 1);
};
pp.readToken_question = function() {
  var ecmaVersion = this.options.ecmaVersion;
  if (ecmaVersion >= 11) {
    var next = this.input.charCodeAt(this.pos + 1);
    if (next === 46) {
      var next2 = this.input.charCodeAt(this.pos + 2);
      if (next2 < 48 || next2 > 57) {
        return this.finishOp(types$1.questionDot, 2);
      }
    }
    if (next === 63) {
      if (ecmaVersion >= 12) {
        var next2$1 = this.input.charCodeAt(this.pos + 2);
        if (next2$1 === 61) {
          return this.finishOp(types$1.assign, 3);
        }
      }
      return this.finishOp(types$1.coalesce, 2);
    }
  }
  return this.finishOp(types$1.question, 1);
};
pp.readToken_numberSign = function() {
  var ecmaVersion = this.options.ecmaVersion;
  var code = 35;
  if (ecmaVersion >= 13) {
    ++this.pos;
    code = this.fullCharCodeAtPos();
    if (isIdentifierStart(code, true) || code === 92) {
      return this.finishToken(types$1.privateId, this.readWord1());
    }
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};
pp.getTokenFromCode = function(code) {
  switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46:
      return this.readToken_dot();
    // Punctuation tokens.
    case 40:
      ++this.pos;
      return this.finishToken(types$1.parenL);
    case 41:
      ++this.pos;
      return this.finishToken(types$1.parenR);
    case 59:
      ++this.pos;
      return this.finishToken(types$1.semi);
    case 44:
      ++this.pos;
      return this.finishToken(types$1.comma);
    case 91:
      ++this.pos;
      return this.finishToken(types$1.bracketL);
    case 93:
      ++this.pos;
      return this.finishToken(types$1.bracketR);
    case 123:
      ++this.pos;
      return this.finishToken(types$1.braceL);
    case 125:
      ++this.pos;
      return this.finishToken(types$1.braceR);
    case 58:
      ++this.pos;
      return this.finishToken(types$1.colon);
    case 96:
      if (this.options.ecmaVersion < 6) {
        break;
      }
      ++this.pos;
      return this.finishToken(types$1.backQuote);
    case 48:
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) {
        return this.readRadixNumber(16);
      }
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) {
          return this.readRadixNumber(8);
        }
        if (next === 98 || next === 66) {
          return this.readRadixNumber(2);
        }
      }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return this.readNumber(false);
    // Quotes produce strings.
    case 34:
    case 39:
      return this.readString(code);
    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.
    case 47:
      return this.readToken_slash();
    case 37:
    case 42:
      return this.readToken_mult_modulo_exp(code);
    case 124:
    case 38:
      return this.readToken_pipe_amp(code);
    case 94:
      return this.readToken_caret();
    case 43:
    case 45:
      return this.readToken_plus_min(code);
    case 60:
    case 62:
      return this.readToken_lt_gt(code);
    case 61:
    case 33:
      return this.readToken_eq_excl(code);
    case 63:
      return this.readToken_question();
    case 126:
      return this.finishOp(types$1.prefix, 1);
    case 35:
      return this.readToken_numberSign();
  }
  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};
pp.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};
pp.readRegexp = function() {
  var escaped, inClass, start = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(start, "Unterminated regular expression");
    }
    var ch = this.input.charAt(this.pos);
    if (lineBreak.test(ch)) {
      this.raise(start, "Unterminated regular expression");
    }
    if (!escaped) {
      if (ch === "[") {
        inClass = true;
      } else if (ch === "]" && inClass) {
        inClass = false;
      } else if (ch === "/" && !inClass) {
        break;
      }
      escaped = ch === "\\";
    } else {
      escaped = false;
    }
    ++this.pos;
  }
  var pattern = this.input.slice(start, this.pos);
  ++this.pos;
  var flagsStart = this.pos;
  var flags = this.readWord1();
  if (this.containsEsc) {
    this.unexpected(flagsStart);
  }
  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
  state.reset(start, pattern, flags);
  this.validateRegExpFlags(state);
  this.validateRegExpPattern(state);
  var value = null;
  try {
    value = new RegExp(pattern, flags);
  } catch (e) {
  }
  return this.finishToken(types$1.regexp, { pattern, flags, value });
};
pp.readInt = function(radix, len, maybeLegacyOctalNumericLiteral) {
  var allowSeparators = this.options.ecmaVersion >= 12 && len === void 0;
  var isLegacyOctalNumericLiteral = maybeLegacyOctalNumericLiteral && this.input.charCodeAt(this.pos) === 48;
  var start = this.pos, total = 0, lastCode = 0;
  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
    var code = this.input.charCodeAt(this.pos), val = void 0;
    if (allowSeparators && code === 95) {
      if (isLegacyOctalNumericLiteral) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed in legacy octal numeric literals");
      }
      if (lastCode === 95) {
        this.raiseRecoverable(this.pos, "Numeric separator must be exactly one underscore");
      }
      if (i === 0) {
        this.raiseRecoverable(this.pos, "Numeric separator is not allowed at the first of digits");
      }
      lastCode = code;
      continue;
    }
    if (code >= 97) {
      val = code - 97 + 10;
    } else if (code >= 65) {
      val = code - 65 + 10;
    } else if (code >= 48 && code <= 57) {
      val = code - 48;
    } else {
      val = Infinity;
    }
    if (val >= radix) {
      break;
    }
    lastCode = code;
    total = total * radix + val;
  }
  if (allowSeparators && lastCode === 95) {
    this.raiseRecoverable(this.pos - 1, "Numeric separator is not allowed at the last of digits");
  }
  if (this.pos === start || len != null && this.pos - start !== len) {
    return null;
  }
  return total;
};
function stringToNumber(str, isLegacyOctalNumericLiteral) {
  if (isLegacyOctalNumericLiteral) {
    return parseInt(str, 8);
  }
  return parseFloat(str.replace(/_/g, ""));
}
function stringToBigInt(str) {
  if (typeof BigInt !== "function") {
    return null;
  }
  return BigInt(str.replace(/_/g, ""));
}
pp.readRadixNumber = function(radix) {
  var start = this.pos;
  this.pos += 2;
  var val = this.readInt(radix);
  if (val == null) {
    this.raise(this.start + 2, "Expected number in radix " + radix);
  }
  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    val = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
  } else if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  return this.finishToken(types$1.num, val);
};
pp.readNumber = function(startsWithDot) {
  var start = this.pos;
  if (!startsWithDot && this.readInt(10, void 0, true) === null) {
    this.raise(start, "Invalid number");
  }
  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
  if (octal && this.strict) {
    this.raise(start, "Invalid number");
  }
  var next = this.input.charCodeAt(this.pos);
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    var val$1 = stringToBigInt(this.input.slice(start, this.pos));
    ++this.pos;
    if (isIdentifierStart(this.fullCharCodeAtPos())) {
      this.raise(this.pos, "Identifier directly after number");
    }
    return this.finishToken(types$1.num, val$1);
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) {
    octal = false;
  }
  if (next === 46 && !octal) {
    ++this.pos;
    this.readInt(10);
    next = this.input.charCodeAt(this.pos);
  }
  if ((next === 69 || next === 101) && !octal) {
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) {
      ++this.pos;
    }
    if (this.readInt(10) === null) {
      this.raise(start, "Invalid number");
    }
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) {
    this.raise(this.pos, "Identifier directly after number");
  }
  var val = stringToNumber(this.input.slice(start, this.pos), octal);
  return this.finishToken(types$1.num, val);
};
pp.readCodePoint = function() {
  var ch = this.input.charCodeAt(this.pos), code;
  if (ch === 123) {
    if (this.options.ecmaVersion < 6) {
      this.unexpected();
    }
    var codePos = ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 1114111) {
      this.invalidStringToken(codePos, "Code point out of bounds");
    }
  } else {
    code = this.readHexChar(4);
  }
  return code;
};
pp.readString = function(quote) {
  var out = "", chunkStart = ++this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated string constant");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === quote) {
      break;
    }
    if (ch === 92) {
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else if (ch === 8232 || ch === 8233) {
      if (this.options.ecmaVersion < 10) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
      if (this.options.locations) {
        this.curLine++;
        this.lineStart = this.pos;
      }
    } else {
      if (isNewLine(ch)) {
        this.raise(this.start, "Unterminated string constant");
      }
      ++this.pos;
    }
  }
  out += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(types$1.string, out);
};
var INVALID_TEMPLATE_ESCAPE_ERROR = {};
pp.tryReadTemplateToken = function() {
  this.inTemplateElement = true;
  try {
    this.readTmplToken();
  } catch (err) {
    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
      this.readInvalidTemplateToken();
    } else {
      throw err;
    }
  }
  this.inTemplateElement = false;
};
pp.invalidStringToken = function(position, message) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    throw INVALID_TEMPLATE_ESCAPE_ERROR;
  } else {
    this.raise(position, message);
  }
};
pp.readTmplToken = function() {
  var out = "", chunkStart = this.pos;
  for (; ; ) {
    if (this.pos >= this.input.length) {
      this.raise(this.start, "Unterminated template");
    }
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
      if (this.pos === this.start && (this.type === types$1.template || this.type === types$1.invalidTemplate)) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(types$1.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(types$1.backQuote);
        }
      }
      out += this.input.slice(chunkStart, this.pos);
      return this.finishToken(types$1.template, out);
    }
    if (ch === 92) {
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) {
            ++this.pos;
          }
        case 10:
          out += "\n";
          break;
        default:
          out += String.fromCharCode(ch);
          break;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};
pp.readInvalidTemplateToken = function() {
  for (; this.pos < this.input.length; this.pos++) {
    switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break;
      case "$":
        if (this.input[this.pos + 1] !== "{") {
          break;
        }
      // fall through
      case "`":
        return this.finishToken(types$1.invalidTemplate, this.input.slice(this.start, this.pos));
      case "\r":
        if (this.input[this.pos + 1] === "\n") {
          ++this.pos;
        }
      // fall through
      case "\n":
      case "\u2028":
      case "\u2029":
        ++this.curLine;
        this.lineStart = this.pos + 1;
        break;
    }
  }
  this.raise(this.start, "Unterminated template");
};
pp.readEscapedChar = function(inTemplate) {
  var ch = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch) {
    case 110:
      return "\n";
    // 'n' -> '\n'
    case 114:
      return "\r";
    // 'r' -> '\r'
    case 120:
      return String.fromCharCode(this.readHexChar(2));
    // 'x'
    case 117:
      return codePointToString(this.readCodePoint());
    // 'u'
    case 116:
      return "	";
    // 't' -> '\t'
    case 98:
      return "\b";
    // 'b' -> '\b'
    case 118:
      return "\v";
    // 'v' -> '\u000b'
    case 102:
      return "\f";
    // 'f' -> '\f'
    case 13:
      if (this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
      }
    // '\r\n'
    case 10:
      if (this.options.locations) {
        this.lineStart = this.pos;
        ++this.curLine;
      }
      return "";
    case 56:
    case 57:
      if (this.strict) {
        this.invalidStringToken(
          this.pos - 1,
          "Invalid escape sequence"
        );
      }
      if (inTemplate) {
        var codePos = this.pos - 1;
        this.invalidStringToken(
          codePos,
          "Invalid escape sequence in template string"
        );
      }
    default:
      if (ch >= 48 && ch <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        this.pos += octalStr.length - 1;
        ch = this.input.charCodeAt(this.pos);
        if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
          this.invalidStringToken(
            this.pos - 1 - octalStr.length,
            inTemplate ? "Octal literal in template string" : "Octal literal in strict mode"
          );
        }
        return String.fromCharCode(octal);
      }
      if (isNewLine(ch)) {
        if (this.options.locations) {
          this.lineStart = this.pos;
          ++this.curLine;
        }
        return "";
      }
      return String.fromCharCode(ch);
  }
};
pp.readHexChar = function(len) {
  var codePos = this.pos;
  var n = this.readInt(16, len);
  if (n === null) {
    this.invalidStringToken(codePos, "Bad character escape sequence");
  }
  return n;
};
pp.readWord1 = function() {
  this.containsEsc = false;
  var word = "", first = true, chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch, astral)) {
      this.pos += ch <= 65535 ? 1 : 2;
    } else if (ch === 92) {
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) !== 117) {
        this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      }
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) {
        this.invalidStringToken(escStart, "Invalid Unicode escape");
      }
      word += codePointToString(esc);
      chunkStart = this.pos;
    } else {
      break;
    }
    first = false;
  }
  return word + this.input.slice(chunkStart, this.pos);
};
pp.readWord = function() {
  var word = this.readWord1();
  var type = types$1.name;
  if (this.keywords.test(word)) {
    type = keywords[word];
  }
  return this.finishToken(type, word);
};
var version = "8.14.1";
Parser.acorn = {
  Parser,
  version,
  defaultOptions,
  Position,
  SourceLocation,
  getLineInfo,
  Node,
  TokenType,
  tokTypes: types$1,
  keywordTypes: keywords,
  TokContext,
  tokContexts: types,
  isIdentifierChar,
  isIdentifierStart,
  Token,
  isNewLine,
  lineBreak,
  lineBreakG,
  nonASCIIwhitespace
};
const { stringify } = JSON;
if (!String.prototype.repeat) {
  throw new Error(
    "String.prototype.repeat is undefined, see https://github.com/davidbonnet/astring#installation"
  );
}
if (!String.prototype.endsWith) {
  throw new Error(
    "String.prototype.endsWith is undefined, see https://github.com/davidbonnet/astring#installation"
  );
}
const OPERATOR_PRECEDENCE = {
  "||": 2,
  "??": 3,
  "&&": 4,
  "|": 5,
  "^": 6,
  "&": 7,
  "==": 8,
  "!=": 8,
  "===": 8,
  "!==": 8,
  "<": 9,
  ">": 9,
  "<=": 9,
  ">=": 9,
  in: 9,
  instanceof: 9,
  "<<": 10,
  ">>": 10,
  ">>>": 10,
  "+": 11,
  "-": 11,
  "*": 12,
  "%": 12,
  "/": 12,
  "**": 13
};
const NEEDS_PARENTHESES = 17;
const EXPRESSIONS_PRECEDENCE = {
  // Definitions
  ArrayExpression: 20,
  TaggedTemplateExpression: 20,
  ThisExpression: 20,
  Identifier: 20,
  PrivateIdentifier: 20,
  Literal: 18,
  TemplateLiteral: 20,
  Super: 20,
  SequenceExpression: 20,
  // Operations
  MemberExpression: 19,
  ChainExpression: 19,
  CallExpression: 19,
  NewExpression: 19,
  // Other definitions
  ArrowFunctionExpression: NEEDS_PARENTHESES,
  ClassExpression: NEEDS_PARENTHESES,
  FunctionExpression: NEEDS_PARENTHESES,
  ObjectExpression: NEEDS_PARENTHESES,
  // Other operations
  UpdateExpression: 16,
  UnaryExpression: 15,
  AwaitExpression: 15,
  BinaryExpression: 14,
  LogicalExpression: 13,
  ConditionalExpression: 4,
  AssignmentExpression: 3,
  YieldExpression: 2,
  RestElement: 1
};
function formatSequence(state, nodes) {
  const { generator } = state;
  state.write("(");
  if (nodes != null && nodes.length > 0) {
    generator[nodes[0].type](nodes[0], state);
    const { length } = nodes;
    for (let i = 1; i < length; i++) {
      const param = nodes[i];
      state.write(", ");
      generator[param.type](param, state);
    }
  }
  state.write(")");
}
function expressionNeedsParenthesis(state, node, parentNode, isRightHand) {
  const nodePrecedence = state.expressionsPrecedence[node.type];
  if (nodePrecedence === NEEDS_PARENTHESES) {
    return true;
  }
  const parentNodePrecedence = state.expressionsPrecedence[parentNode.type];
  if (nodePrecedence !== parentNodePrecedence) {
    return !isRightHand && nodePrecedence === 15 && parentNodePrecedence === 14 && parentNode.operator === "**" || nodePrecedence < parentNodePrecedence;
  }
  if (nodePrecedence !== 13 && nodePrecedence !== 14) {
    return false;
  }
  if (node.operator === "**" && parentNode.operator === "**") {
    return !isRightHand;
  }
  if (nodePrecedence === 13 && parentNodePrecedence === 13 && (node.operator === "??" || parentNode.operator === "??")) {
    return true;
  }
  if (isRightHand) {
    return OPERATOR_PRECEDENCE[node.operator] <= OPERATOR_PRECEDENCE[parentNode.operator];
  }
  return OPERATOR_PRECEDENCE[node.operator] < OPERATOR_PRECEDENCE[parentNode.operator];
}
function formatExpression(state, node, parentNode, isRightHand) {
  const { generator } = state;
  if (expressionNeedsParenthesis(state, node, parentNode, isRightHand)) {
    state.write("(");
    generator[node.type](node, state);
    state.write(")");
  } else {
    generator[node.type](node, state);
  }
}
function reindent(state, text, indent, lineEnd) {
  const lines = text.split("\n");
  const end = lines.length - 1;
  state.write(lines[0].trim());
  if (end > 0) {
    state.write(lineEnd);
    for (let i = 1; i < end; i++) {
      state.write(indent + lines[i].trim() + lineEnd);
    }
    state.write(indent + lines[end].trim());
  }
}
function formatComments(state, comments, indent, lineEnd) {
  const { length } = comments;
  for (let i = 0; i < length; i++) {
    const comment = comments[i];
    state.write(indent);
    if (comment.type[0] === "L") {
      state.write("// " + comment.value.trim() + "\n", comment);
    } else {
      state.write("/*");
      reindent(state, comment.value, indent, lineEnd);
      state.write("*/" + lineEnd);
    }
  }
}
function hasCallExpression(node) {
  let currentNode = node;
  while (currentNode != null) {
    const { type } = currentNode;
    if (type[0] === "C" && type[1] === "a") {
      return true;
    } else if (type[0] === "M" && type[1] === "e" && type[2] === "m") {
      currentNode = currentNode.object;
    } else {
      return false;
    }
  }
}
function formatVariableDeclaration(state, node) {
  const { generator } = state;
  const { declarations } = node;
  state.write(node.kind + " ");
  const { length } = declarations;
  if (length > 0) {
    generator.VariableDeclarator(declarations[0], state);
    for (let i = 1; i < length; i++) {
      state.write(", ");
      generator.VariableDeclarator(declarations[i], state);
    }
  }
}
let ForInStatement, FunctionDeclaration, RestElement, BinaryExpression, ArrayExpression, BlockStatement;
const GENERATOR = {
  /*
  Default generator.
  */
  Program(node, state) {
    const indent = state.indent.repeat(state.indentLevel);
    const { lineEnd, writeComments } = state;
    if (writeComments && node.comments != null) {
      formatComments(state, node.comments, indent, lineEnd);
    }
    const statements = node.body;
    const { length } = statements;
    for (let i = 0; i < length; i++) {
      const statement = statements[i];
      if (writeComments && statement.comments != null) {
        formatComments(state, statement.comments, indent, lineEnd);
      }
      state.write(indent);
      this[statement.type](statement, state);
      state.write(lineEnd);
    }
    if (writeComments && node.trailingComments != null) {
      formatComments(state, node.trailingComments, indent, lineEnd);
    }
  },
  BlockStatement: BlockStatement = function(node, state) {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd, writeComments } = state;
    const statementIndent = indent + state.indent;
    state.write("{");
    const statements = node.body;
    if (statements != null && statements.length > 0) {
      state.write(lineEnd);
      if (writeComments && node.comments != null) {
        formatComments(state, node.comments, statementIndent, lineEnd);
      }
      const { length } = statements;
      for (let i = 0; i < length; i++) {
        const statement = statements[i];
        if (writeComments && statement.comments != null) {
          formatComments(state, statement.comments, statementIndent, lineEnd);
        }
        state.write(statementIndent);
        this[statement.type](statement, state);
        state.write(lineEnd);
      }
      state.write(indent);
    } else {
      if (writeComments && node.comments != null) {
        state.write(lineEnd);
        formatComments(state, node.comments, statementIndent, lineEnd);
        state.write(indent);
      }
    }
    if (writeComments && node.trailingComments != null) {
      formatComments(state, node.trailingComments, statementIndent, lineEnd);
    }
    state.write("}");
    state.indentLevel--;
  },
  ClassBody: BlockStatement,
  StaticBlock(node, state) {
    state.write("static ");
    this.BlockStatement(node, state);
  },
  EmptyStatement(node, state) {
    state.write(";");
  },
  ExpressionStatement(node, state) {
    const precedence = state.expressionsPrecedence[node.expression.type];
    if (precedence === NEEDS_PARENTHESES || precedence === 3 && node.expression.left.type[0] === "O") {
      state.write("(");
      this[node.expression.type](node.expression, state);
      state.write(")");
    } else {
      this[node.expression.type](node.expression, state);
    }
    state.write(";");
  },
  IfStatement(node, state) {
    state.write("if (");
    this[node.test.type](node.test, state);
    state.write(") ");
    this[node.consequent.type](node.consequent, state);
    if (node.alternate != null) {
      state.write(" else ");
      this[node.alternate.type](node.alternate, state);
    }
  },
  LabeledStatement(node, state) {
    this[node.label.type](node.label, state);
    state.write(": ");
    this[node.body.type](node.body, state);
  },
  BreakStatement(node, state) {
    state.write("break");
    if (node.label != null) {
      state.write(" ");
      this[node.label.type](node.label, state);
    }
    state.write(";");
  },
  ContinueStatement(node, state) {
    state.write("continue");
    if (node.label != null) {
      state.write(" ");
      this[node.label.type](node.label, state);
    }
    state.write(";");
  },
  WithStatement(node, state) {
    state.write("with (");
    this[node.object.type](node.object, state);
    state.write(") ");
    this[node.body.type](node.body, state);
  },
  SwitchStatement(node, state) {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd, writeComments } = state;
    state.indentLevel++;
    const caseIndent = indent + state.indent;
    const statementIndent = caseIndent + state.indent;
    state.write("switch (");
    this[node.discriminant.type](node.discriminant, state);
    state.write(") {" + lineEnd);
    const { cases: occurences } = node;
    const { length: occurencesCount } = occurences;
    for (let i = 0; i < occurencesCount; i++) {
      const occurence = occurences[i];
      if (writeComments && occurence.comments != null) {
        formatComments(state, occurence.comments, caseIndent, lineEnd);
      }
      if (occurence.test) {
        state.write(caseIndent + "case ");
        this[occurence.test.type](occurence.test, state);
        state.write(":" + lineEnd);
      } else {
        state.write(caseIndent + "default:" + lineEnd);
      }
      const { consequent } = occurence;
      const { length: consequentCount } = consequent;
      for (let i2 = 0; i2 < consequentCount; i2++) {
        const statement = consequent[i2];
        if (writeComments && statement.comments != null) {
          formatComments(state, statement.comments, statementIndent, lineEnd);
        }
        state.write(statementIndent);
        this[statement.type](statement, state);
        state.write(lineEnd);
      }
    }
    state.indentLevel -= 2;
    state.write(indent + "}");
  },
  ReturnStatement(node, state) {
    state.write("return");
    if (node.argument) {
      state.write(" ");
      this[node.argument.type](node.argument, state);
    }
    state.write(";");
  },
  ThrowStatement(node, state) {
    state.write("throw ");
    this[node.argument.type](node.argument, state);
    state.write(";");
  },
  TryStatement(node, state) {
    state.write("try ");
    this[node.block.type](node.block, state);
    if (node.handler) {
      const { handler } = node;
      if (handler.param == null) {
        state.write(" catch ");
      } else {
        state.write(" catch (");
        this[handler.param.type](handler.param, state);
        state.write(") ");
      }
      this[handler.body.type](handler.body, state);
    }
    if (node.finalizer) {
      state.write(" finally ");
      this[node.finalizer.type](node.finalizer, state);
    }
  },
  WhileStatement(node, state) {
    state.write("while (");
    this[node.test.type](node.test, state);
    state.write(") ");
    this[node.body.type](node.body, state);
  },
  DoWhileStatement(node, state) {
    state.write("do ");
    this[node.body.type](node.body, state);
    state.write(" while (");
    this[node.test.type](node.test, state);
    state.write(");");
  },
  ForStatement(node, state) {
    state.write("for (");
    if (node.init != null) {
      const { init } = node;
      if (init.type[0] === "V") {
        formatVariableDeclaration(state, init);
      } else {
        this[init.type](init, state);
      }
    }
    state.write("; ");
    if (node.test) {
      this[node.test.type](node.test, state);
    }
    state.write("; ");
    if (node.update) {
      this[node.update.type](node.update, state);
    }
    state.write(") ");
    this[node.body.type](node.body, state);
  },
  ForInStatement: ForInStatement = function(node, state) {
    state.write(`for ${node.await ? "await " : ""}(`);
    const { left } = node;
    if (left.type[0] === "V") {
      formatVariableDeclaration(state, left);
    } else {
      this[left.type](left, state);
    }
    state.write(node.type[3] === "I" ? " in " : " of ");
    this[node.right.type](node.right, state);
    state.write(") ");
    this[node.body.type](node.body, state);
  },
  ForOfStatement: ForInStatement,
  DebuggerStatement(node, state) {
    state.write("debugger;", node);
  },
  FunctionDeclaration: FunctionDeclaration = function(node, state) {
    state.write(
      (node.async ? "async " : "") + (node.generator ? "function* " : "function ") + (node.id ? node.id.name : ""),
      node
    );
    formatSequence(state, node.params);
    state.write(" ");
    this[node.body.type](node.body, state);
  },
  FunctionExpression: FunctionDeclaration,
  VariableDeclaration(node, state) {
    formatVariableDeclaration(state, node);
    state.write(";");
  },
  VariableDeclarator(node, state) {
    this[node.id.type](node.id, state);
    if (node.init != null) {
      state.write(" = ");
      this[node.init.type](node.init, state);
    }
  },
  ClassDeclaration(node, state) {
    state.write("class " + (node.id ? `${node.id.name} ` : ""), node);
    if (node.superClass) {
      state.write("extends ");
      const { superClass } = node;
      const { type } = superClass;
      const precedence = state.expressionsPrecedence[type];
      if ((type[0] !== "C" || type[1] !== "l" || type[5] !== "E") && (precedence === NEEDS_PARENTHESES || precedence < state.expressionsPrecedence.ClassExpression)) {
        state.write("(");
        this[node.superClass.type](superClass, state);
        state.write(")");
      } else {
        this[superClass.type](superClass, state);
      }
      state.write(" ");
    }
    this.ClassBody(node.body, state);
  },
  ImportDeclaration(node, state) {
    state.write("import ");
    const { specifiers, attributes } = node;
    const { length } = specifiers;
    let i = 0;
    if (length > 0) {
      for (; i < length; ) {
        if (i > 0) {
          state.write(", ");
        }
        const specifier = specifiers[i];
        const type = specifier.type[6];
        if (type === "D") {
          state.write(specifier.local.name, specifier);
          i++;
        } else if (type === "N") {
          state.write("* as " + specifier.local.name, specifier);
          i++;
        } else {
          break;
        }
      }
      if (i < length) {
        state.write("{");
        for (; ; ) {
          const specifier = specifiers[i];
          const { name } = specifier.imported;
          state.write(name, specifier);
          if (name !== specifier.local.name) {
            state.write(" as " + specifier.local.name);
          }
          if (++i < length) {
            state.write(", ");
          } else {
            break;
          }
        }
        state.write("}");
      }
      state.write(" from ");
    }
    this.Literal(node.source, state);
    if (attributes && attributes.length > 0) {
      state.write(" with { ");
      for (let i2 = 0; i2 < attributes.length; i2++) {
        this.ImportAttribute(attributes[i2], state);
        if (i2 < attributes.length - 1) state.write(", ");
      }
      state.write(" }");
    }
    state.write(";");
  },
  ImportAttribute(node, state) {
    this.Identifier(node.key, state);
    state.write(": ");
    this.Literal(node.value, state);
  },
  ImportExpression(node, state) {
    state.write("import(");
    this[node.source.type](node.source, state);
    state.write(")");
  },
  ExportDefaultDeclaration(node, state) {
    state.write("export default ");
    this[node.declaration.type](node.declaration, state);
    if (state.expressionsPrecedence[node.declaration.type] != null && node.declaration.type[0] !== "F") {
      state.write(";");
    }
  },
  ExportNamedDeclaration(node, state) {
    state.write("export ");
    if (node.declaration) {
      this[node.declaration.type](node.declaration, state);
    } else {
      state.write("{");
      const { specifiers } = node, { length } = specifiers;
      if (length > 0) {
        for (let i = 0; ; ) {
          const specifier = specifiers[i];
          const { name } = specifier.local;
          state.write(name, specifier);
          if (name !== specifier.exported.name) {
            state.write(" as " + specifier.exported.name);
          }
          if (++i < length) {
            state.write(", ");
          } else {
            break;
          }
        }
      }
      state.write("}");
      if (node.source) {
        state.write(" from ");
        this.Literal(node.source, state);
      }
      if (node.attributes && node.attributes.length > 0) {
        state.write(" with { ");
        for (let i = 0; i < node.attributes.length; i++) {
          this.ImportAttribute(node.attributes[i], state);
          if (i < node.attributes.length - 1) state.write(", ");
        }
        state.write(" }");
      }
      state.write(";");
    }
  },
  ExportAllDeclaration(node, state) {
    if (node.exported != null) {
      state.write("export * as " + node.exported.name + " from ");
    } else {
      state.write("export * from ");
    }
    this.Literal(node.source, state);
    if (node.attributes && node.attributes.length > 0) {
      state.write(" with { ");
      for (let i = 0; i < node.attributes.length; i++) {
        this.ImportAttribute(node.attributes[i], state);
        if (i < node.attributes.length - 1) state.write(", ");
      }
      state.write(" }");
    }
    state.write(";");
  },
  MethodDefinition(node, state) {
    if (node.static) {
      state.write("static ");
    }
    const kind = node.kind[0];
    if (kind === "g" || kind === "s") {
      state.write(node.kind + " ");
    }
    if (node.value.async) {
      state.write("async ");
    }
    if (node.value.generator) {
      state.write("*");
    }
    if (node.computed) {
      state.write("[");
      this[node.key.type](node.key, state);
      state.write("]");
    } else {
      this[node.key.type](node.key, state);
    }
    formatSequence(state, node.value.params);
    state.write(" ");
    this[node.value.body.type](node.value.body, state);
  },
  ClassExpression(node, state) {
    this.ClassDeclaration(node, state);
  },
  ArrowFunctionExpression(node, state) {
    state.write(node.async ? "async " : "", node);
    const { params } = node;
    if (params != null) {
      if (params.length === 1 && params[0].type[0] === "I") {
        state.write(params[0].name, params[0]);
      } else {
        formatSequence(state, node.params);
      }
    }
    state.write(" => ");
    if (node.body.type[0] === "O") {
      state.write("(");
      this.ObjectExpression(node.body, state);
      state.write(")");
    } else {
      this[node.body.type](node.body, state);
    }
  },
  ThisExpression(node, state) {
    state.write("this", node);
  },
  Super(node, state) {
    state.write("super", node);
  },
  RestElement: RestElement = function(node, state) {
    state.write("...");
    this[node.argument.type](node.argument, state);
  },
  SpreadElement: RestElement,
  YieldExpression(node, state) {
    state.write(node.delegate ? "yield*" : "yield");
    if (node.argument) {
      state.write(" ");
      this[node.argument.type](node.argument, state);
    }
  },
  AwaitExpression(node, state) {
    state.write("await ", node);
    formatExpression(state, node.argument, node);
  },
  TemplateLiteral(node, state) {
    const { quasis, expressions } = node;
    state.write("`");
    const { length } = expressions;
    for (let i = 0; i < length; i++) {
      const expression = expressions[i];
      const quasi2 = quasis[i];
      state.write(quasi2.value.raw, quasi2);
      state.write("${");
      this[expression.type](expression, state);
      state.write("}");
    }
    const quasi = quasis[quasis.length - 1];
    state.write(quasi.value.raw, quasi);
    state.write("`");
  },
  TemplateElement(node, state) {
    state.write(node.value.raw, node);
  },
  TaggedTemplateExpression(node, state) {
    formatExpression(state, node.tag, node);
    this[node.quasi.type](node.quasi, state);
  },
  ArrayExpression: ArrayExpression = function(node, state) {
    state.write("[");
    if (node.elements.length > 0) {
      const { elements } = node, { length } = elements;
      for (let i = 0; ; ) {
        const element = elements[i];
        if (element != null) {
          this[element.type](element, state);
        }
        if (++i < length) {
          state.write(", ");
        } else {
          if (element == null) {
            state.write(", ");
          }
          break;
        }
      }
    }
    state.write("]");
  },
  ArrayPattern: ArrayExpression,
  ObjectExpression(node, state) {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd, writeComments } = state;
    const propertyIndent = indent + state.indent;
    state.write("{");
    if (node.properties.length > 0) {
      state.write(lineEnd);
      if (writeComments && node.comments != null) {
        formatComments(state, node.comments, propertyIndent, lineEnd);
      }
      const comma = "," + lineEnd;
      const { properties } = node, { length } = properties;
      for (let i = 0; ; ) {
        const property = properties[i];
        if (writeComments && property.comments != null) {
          formatComments(state, property.comments, propertyIndent, lineEnd);
        }
        state.write(propertyIndent);
        this[property.type](property, state);
        if (++i < length) {
          state.write(comma);
        } else {
          break;
        }
      }
      state.write(lineEnd);
      if (writeComments && node.trailingComments != null) {
        formatComments(state, node.trailingComments, propertyIndent, lineEnd);
      }
      state.write(indent + "}");
    } else if (writeComments) {
      if (node.comments != null) {
        state.write(lineEnd);
        formatComments(state, node.comments, propertyIndent, lineEnd);
        if (node.trailingComments != null) {
          formatComments(state, node.trailingComments, propertyIndent, lineEnd);
        }
        state.write(indent + "}");
      } else if (node.trailingComments != null) {
        state.write(lineEnd);
        formatComments(state, node.trailingComments, propertyIndent, lineEnd);
        state.write(indent + "}");
      } else {
        state.write("}");
      }
    } else {
      state.write("}");
    }
    state.indentLevel--;
  },
  Property(node, state) {
    if (node.method || node.kind[0] !== "i") {
      this.MethodDefinition(node, state);
    } else {
      if (!node.shorthand) {
        if (node.computed) {
          state.write("[");
          this[node.key.type](node.key, state);
          state.write("]");
        } else {
          this[node.key.type](node.key, state);
        }
        state.write(": ");
      }
      this[node.value.type](node.value, state);
    }
  },
  PropertyDefinition(node, state) {
    if (node.static) {
      state.write("static ");
    }
    if (node.computed) {
      state.write("[");
    }
    this[node.key.type](node.key, state);
    if (node.computed) {
      state.write("]");
    }
    if (node.value == null) {
      if (node.key.type[0] !== "F") {
        state.write(";");
      }
      return;
    }
    state.write(" = ");
    this[node.value.type](node.value, state);
    state.write(";");
  },
  ObjectPattern(node, state) {
    state.write("{");
    if (node.properties.length > 0) {
      const { properties } = node, { length } = properties;
      for (let i = 0; ; ) {
        this[properties[i].type](properties[i], state);
        if (++i < length) {
          state.write(", ");
        } else {
          break;
        }
      }
    }
    state.write("}");
  },
  SequenceExpression(node, state) {
    formatSequence(state, node.expressions);
  },
  UnaryExpression(node, state) {
    if (node.prefix) {
      const {
        operator,
        argument,
        argument: { type }
      } = node;
      state.write(operator);
      const needsParentheses = expressionNeedsParenthesis(state, argument, node);
      if (!needsParentheses && (operator.length > 1 || type[0] === "U" && (type[1] === "n" || type[1] === "p") && argument.prefix && argument.operator[0] === operator && (operator === "+" || operator === "-"))) {
        state.write(" ");
      }
      if (needsParentheses) {
        state.write(operator.length > 1 ? " (" : "(");
        this[type](argument, state);
        state.write(")");
      } else {
        this[type](argument, state);
      }
    } else {
      this[node.argument.type](node.argument, state);
      state.write(node.operator);
    }
  },
  UpdateExpression(node, state) {
    if (node.prefix) {
      state.write(node.operator);
      this[node.argument.type](node.argument, state);
    } else {
      this[node.argument.type](node.argument, state);
      state.write(node.operator);
    }
  },
  AssignmentExpression(node, state) {
    this[node.left.type](node.left, state);
    state.write(" " + node.operator + " ");
    this[node.right.type](node.right, state);
  },
  AssignmentPattern(node, state) {
    this[node.left.type](node.left, state);
    state.write(" = ");
    this[node.right.type](node.right, state);
  },
  BinaryExpression: BinaryExpression = function(node, state) {
    const isIn = node.operator === "in";
    if (isIn) {
      state.write("(");
    }
    formatExpression(state, node.left, node, false);
    state.write(" " + node.operator + " ");
    formatExpression(state, node.right, node, true);
    if (isIn) {
      state.write(")");
    }
  },
  LogicalExpression: BinaryExpression,
  ConditionalExpression(node, state) {
    const { test } = node;
    const precedence = state.expressionsPrecedence[test.type];
    if (precedence === NEEDS_PARENTHESES || precedence <= state.expressionsPrecedence.ConditionalExpression) {
      state.write("(");
      this[test.type](test, state);
      state.write(")");
    } else {
      this[test.type](test, state);
    }
    state.write(" ? ");
    this[node.consequent.type](node.consequent, state);
    state.write(" : ");
    this[node.alternate.type](node.alternate, state);
  },
  NewExpression(node, state) {
    state.write("new ");
    const precedence = state.expressionsPrecedence[node.callee.type];
    if (precedence === NEEDS_PARENTHESES || precedence < state.expressionsPrecedence.CallExpression || hasCallExpression(node.callee)) {
      state.write("(");
      this[node.callee.type](node.callee, state);
      state.write(")");
    } else {
      this[node.callee.type](node.callee, state);
    }
    formatSequence(state, node["arguments"]);
  },
  CallExpression(node, state) {
    const precedence = state.expressionsPrecedence[node.callee.type];
    if (precedence === NEEDS_PARENTHESES || precedence < state.expressionsPrecedence.CallExpression) {
      state.write("(");
      this[node.callee.type](node.callee, state);
      state.write(")");
    } else {
      this[node.callee.type](node.callee, state);
    }
    if (node.optional) {
      state.write("?.");
    }
    formatSequence(state, node["arguments"]);
  },
  ChainExpression(node, state) {
    this[node.expression.type](node.expression, state);
  },
  MemberExpression(node, state) {
    const precedence = state.expressionsPrecedence[node.object.type];
    if (precedence === NEEDS_PARENTHESES || precedence < state.expressionsPrecedence.MemberExpression) {
      state.write("(");
      this[node.object.type](node.object, state);
      state.write(")");
    } else {
      this[node.object.type](node.object, state);
    }
    if (node.computed) {
      if (node.optional) {
        state.write("?.");
      }
      state.write("[");
      this[node.property.type](node.property, state);
      state.write("]");
    } else {
      if (node.optional) {
        state.write("?.");
      } else {
        state.write(".");
      }
      this[node.property.type](node.property, state);
    }
  },
  MetaProperty(node, state) {
    state.write(node.meta.name + "." + node.property.name, node);
  },
  Identifier(node, state) {
    state.write(node.name, node);
  },
  PrivateIdentifier(node, state) {
    state.write(`#${node.name}`, node);
  },
  Literal(node, state) {
    if (node.raw != null) {
      state.write(node.raw, node);
    } else if (node.regex != null) {
      this.RegExpLiteral(node, state);
    } else if (node.bigint != null) {
      state.write(node.bigint + "n", node);
    } else {
      state.write(stringify(node.value), node);
    }
  },
  RegExpLiteral(node, state) {
    const { regex } = node;
    state.write(`/${regex.pattern}/${regex.flags}`, node);
  }
};
const EMPTY_OBJECT = {};
class State {
  constructor(options) {
    const setup = options == null ? EMPTY_OBJECT : options;
    this.output = "";
    if (setup.output != null) {
      this.output = setup.output;
      this.write = this.writeToStream;
    } else {
      this.output = "";
    }
    this.generator = setup.generator != null ? setup.generator : GENERATOR;
    this.expressionsPrecedence = setup.expressionsPrecedence != null ? setup.expressionsPrecedence : EXPRESSIONS_PRECEDENCE;
    this.indent = setup.indent != null ? setup.indent : "  ";
    this.lineEnd = setup.lineEnd != null ? setup.lineEnd : "\n";
    this.indentLevel = setup.startingIndentLevel != null ? setup.startingIndentLevel : 0;
    this.writeComments = setup.comments ? setup.comments : false;
    if (setup.sourceMap != null) {
      this.write = setup.output == null ? this.writeAndMap : this.writeToStreamAndMap;
      this.sourceMap = setup.sourceMap;
      this.line = 1;
      this.column = 0;
      this.lineEndSize = this.lineEnd.split("\n").length - 1;
      this.mapping = {
        original: null,
        // Uses the entire state to avoid generating ephemeral objects
        generated: this,
        name: void 0,
        source: setup.sourceMap.file || setup.sourceMap._file
      };
    }
  }
  write(code) {
    this.output += code;
  }
  writeToStream(code) {
    this.output.write(code);
  }
  writeAndMap(code, node) {
    this.output += code;
    this.map(code, node);
  }
  writeToStreamAndMap(code, node) {
    this.output.write(code);
    this.map(code, node);
  }
  map(code, node) {
    if (node != null) {
      const { type } = node;
      if (type[0] === "L" && type[2] === "n") {
        this.column = 0;
        this.line++;
        return;
      }
      if (node.loc != null) {
        const { mapping } = this;
        mapping.original = node.loc.start;
        mapping.name = node.name;
        this.sourceMap.addMapping(mapping);
      }
      if (type[0] === "T" && type[8] === "E" || type[0] === "L" && type[1] === "i" && typeof node.value === "string") {
        const { length: length2 } = code;
        let { column, line: line2 } = this;
        for (let i = 0; i < length2; i++) {
          if (code[i] === "\n") {
            column = 0;
            line2++;
          } else {
            column++;
          }
        }
        this.column = column;
        this.line = line2;
        return;
      }
    }
    const { length } = code;
    const { lineEnd } = this;
    if (length > 0) {
      if (this.lineEndSize > 0 && (lineEnd.length === 1 ? code[length - 1] === lineEnd : code.endsWith(lineEnd))) {
        this.line += this.lineEndSize;
        this.column = 0;
      } else {
        this.column += length;
      }
    }
  }
  toString() {
    return this.output;
  }
}
function generate(node, options) {
  const state = new State(options);
  state.generator[node.type](node, state);
  return state.output;
}
var astravel = {};
var defaultTraveler = {};
var hasRequiredDefaultTraveler;
function requireDefaultTraveler() {
  if (hasRequiredDefaultTraveler) return defaultTraveler;
  hasRequiredDefaultTraveler = 1;
  (function(exports) {
    (function(global, factory) {
      {
        factory(exports);
      }
    })(defaultTraveler, function(exports2) {
      exports2.__esModule = true;
      function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
          throw new TypeError("Cannot call a class as a function");
        }
      }
      var ForInStatement2 = void 0, FunctionDeclaration2 = void 0, RestElement2 = void 0, BinaryExpression2 = void 0, ArrayExpression2 = void 0;
      var ignore = Function.prototype;
      var Found = function Found2(node, state) {
        _classCallCheck(this, Found2);
        this.node = node;
        this.state = state;
      };
      exports2.default = {
        // Basic methods
        go: function go(node, state) {
          this[node.type](node, state);
        },
        find: function find(predicate, node, state) {
          var finder = Object.create(this);
          finder.go = function(node2, state2) {
            if (predicate(node2, state2)) {
              throw new Found(node2, state2);
            }
            this[node2.type](node2, state2);
          };
          try {
            finder.go(node, state);
          } catch (error) {
            if (error instanceof Found) {
              return error;
            } else {
              throw error;
            }
          }
        },
        makeChild: function makeChild() {
          var properties = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
          var traveler = Object.create(this);
          traveler.super = this;
          for (var key in properties) {
            traveler[key] = properties[key];
          }
          return traveler;
        },
        // JavaScript 5
        Program: function Program(node, state) {
          var statements = node.body, length = statements.length;
          for (var i = 0; i < length; i++) {
            this.go(statements[i], state);
          }
        },
        BlockStatement: function BlockStatement2(node, state) {
          var statements = node.body;
          if (statements != null) {
            for (var i = 0, length = statements.length; i < length; i++) {
              this.go(statements[i], state);
            }
          }
        },
        EmptyStatement: ignore,
        ExpressionStatement: function ExpressionStatement(node, state) {
          this.go(node.expression, state);
        },
        IfStatement: function IfStatement(node, state) {
          this.go(node.test, state);
          this.go(node.consequent, state);
          if (node.alternate != null) {
            this.go(node.alternate, state);
          }
        },
        LabeledStatement: function LabeledStatement(node, state) {
          this.go(node.label, state);
          this.go(node.body, state);
        },
        BreakStatement: function BreakStatement(node, state) {
          if (node.label) {
            this.go(node.label, state);
          }
        },
        ContinueStatement: function ContinueStatement(node, state) {
          if (node.label) {
            this.go(node.label, state);
          }
        },
        WithStatement: function WithStatement(node, state) {
          this.go(node.object, state);
          this.go(node.body, state);
        },
        SwitchStatement: function SwitchStatement(node, state) {
          this.go(node.discriminant, state);
          var cases = node.cases, length = cases.length;
          for (var i = 0; i < length; i++) {
            this.go(cases[i], state);
          }
        },
        SwitchCase: function SwitchCase(node, state) {
          if (node.test != null) {
            this.go(node.test, state);
          }
          var statements = node.consequent, length = statements.length;
          for (var i = 0; i < length; i++) {
            this.go(statements[i], state);
          }
        },
        ReturnStatement: function ReturnStatement(node, state) {
          if (node.argument) {
            this.go(node.argument, state);
          }
        },
        ThrowStatement: function ThrowStatement(node, state) {
          this.go(node.argument, state);
        },
        TryStatement: function TryStatement(node, state) {
          this.go(node.block, state);
          if (node.handler != null) {
            this.go(node.handler, state);
          }
          if (node.finalizer != null) {
            this.go(node.finalizer, state);
          }
        },
        CatchClause: function CatchClause(node, state) {
          if (node.param != null) {
            this.go(node.param, state);
          }
          this.go(node.body, state);
        },
        WhileStatement: function WhileStatement(node, state) {
          this.go(node.test, state);
          this.go(node.body, state);
        },
        DoWhileStatement: function DoWhileStatement(node, state) {
          this.go(node.body, state);
          this.go(node.test, state);
        },
        ForStatement: function ForStatement(node, state) {
          if (node.init != null) {
            this.go(node.init, state);
          }
          if (node.test != null) {
            this.go(node.test, state);
          }
          if (node.update != null) {
            this.go(node.update, state);
          }
          this.go(node.body, state);
        },
        ForInStatement: ForInStatement2 = function ForInStatement22(node, state) {
          this.go(node.left, state);
          this.go(node.right, state);
          this.go(node.body, state);
        },
        DebuggerStatement: ignore,
        FunctionDeclaration: FunctionDeclaration2 = function FunctionDeclaration22(node, state) {
          if (node.id != null) {
            this.go(node.id, state);
          }
          var params = node.params;
          if (params != null) {
            for (var i = 0, length = params.length; i < length; i++) {
              this.go(params[i], state);
            }
          }
          this.go(node.body, state);
        },
        VariableDeclaration: function VariableDeclaration(node, state) {
          var declarations = node.declarations, length = declarations.length;
          for (var i = 0; i < length; i++) {
            this.go(declarations[i], state);
          }
        },
        VariableDeclarator: function VariableDeclarator(node, state) {
          this.go(node.id, state);
          if (node.init != null) {
            this.go(node.init, state);
          }
        },
        ArrowFunctionExpression: function ArrowFunctionExpression(node, state) {
          var params = node.params;
          if (params != null) {
            for (var i = 0, length = params.length; i < length; i++) {
              this.go(params[i], state);
            }
          }
          this.go(node.body, state);
        },
        ThisExpression: ignore,
        ArrayExpression: ArrayExpression2 = function ArrayExpression22(node, state) {
          var elements = node.elements, length = elements.length;
          for (var i = 0; i < length; i++) {
            var element = elements[i];
            if (element != null) {
              this.go(elements[i], state);
            }
          }
        },
        ObjectExpression: function ObjectExpression(node, state) {
          var properties = node.properties, length = properties.length;
          for (var i = 0; i < length; i++) {
            this.go(properties[i], state);
          }
        },
        Property: function Property(node, state) {
          this.go(node.key, state);
          if (!node.shorthand) {
            this.go(node.value, state);
          }
        },
        FunctionExpression: FunctionDeclaration2,
        SequenceExpression: function SequenceExpression(node, state) {
          var expressions = node.expressions, length = expressions.length;
          for (var i = 0; i < length; i++) {
            this.go(expressions[i], state);
          }
        },
        UnaryExpression: function UnaryExpression(node, state) {
          this.go(node.argument, state);
        },
        UpdateExpression: function UpdateExpression(node, state) {
          this.go(node.argument, state);
        },
        AssignmentExpression: function AssignmentExpression(node, state) {
          this.go(node.left, state);
          this.go(node.right, state);
        },
        BinaryExpression: BinaryExpression2 = function BinaryExpression22(node, state) {
          this.go(node.left, state);
          this.go(node.right, state);
        },
        LogicalExpression: BinaryExpression2,
        ConditionalExpression: function ConditionalExpression(node, state) {
          this.go(node.test, state);
          this.go(node.consequent, state);
          this.go(node.alternate, state);
        },
        NewExpression: function NewExpression(node, state) {
          this.CallExpression(node, state);
        },
        CallExpression: function CallExpression(node, state) {
          this.go(node.callee, state);
          var args = node["arguments"], length = args.length;
          for (var i = 0; i < length; i++) {
            this.go(args[i], state);
          }
        },
        MemberExpression: function MemberExpression(node, state) {
          this.go(node.object, state);
          this.go(node.property, state);
        },
        Identifier: ignore,
        Literal: ignore,
        // JavaScript 6
        ForOfStatement: ForInStatement2,
        ClassDeclaration: function ClassDeclaration(node, state) {
          if (node.id) {
            this.go(node.id, state);
          }
          if (node.superClass) {
            this.go(node.superClass, state);
          }
          this.go(node.body, state);
        },
        ClassBody: function ClassBody(node, state) {
          var body = node.body, length = body.length;
          for (var i = 0; i < length; i++) {
            this.go(body[i], state);
          }
        },
        ImportDeclaration: function ImportDeclaration(node, state) {
          var specifiers = node.specifiers, length = specifiers.length;
          for (var i = 0; i < length; i++) {
            this.go(specifiers[i], state);
          }
          this.go(node.source, state);
        },
        ImportNamespaceSpecifier: function ImportNamespaceSpecifier(node, state) {
          this.go(node.local, state);
        },
        ImportDefaultSpecifier: function ImportDefaultSpecifier(node, state) {
          this.go(node.local, state);
        },
        ImportSpecifier: function ImportSpecifier(node, state) {
          this.go(node.imported, state);
          this.go(node.local, state);
        },
        ExportDefaultDeclaration: function ExportDefaultDeclaration(node, state) {
          this.go(node.declaration, state);
        },
        ExportNamedDeclaration: function ExportNamedDeclaration(node, state) {
          if (node.declaration) {
            this.go(node.declaration, state);
          }
          var specifiers = node.specifiers, length = specifiers.length;
          for (var i = 0; i < length; i++) {
            this.go(specifiers[i], state);
          }
          if (node.source) {
            this.go(node.source, state);
          }
        },
        ExportSpecifier: function ExportSpecifier(node, state) {
          this.go(node.local, state);
          this.go(node.exported, state);
        },
        ExportAllDeclaration: function ExportAllDeclaration(node, state) {
          this.go(node.source, state);
        },
        MethodDefinition: function MethodDefinition(node, state) {
          this.go(node.key, state);
          this.go(node.value, state);
        },
        ClassExpression: function ClassExpression(node, state) {
          this.ClassDeclaration(node, state);
        },
        Super: ignore,
        RestElement: RestElement2 = function RestElement22(node, state) {
          this.go(node.argument, state);
        },
        SpreadElement: RestElement2,
        YieldExpression: function YieldExpression(node, state) {
          if (node.argument) {
            this.go(node.argument, state);
          }
        },
        TaggedTemplateExpression: function TaggedTemplateExpression(node, state) {
          this.go(node.tag, state);
          this.go(node.quasi, state);
        },
        TemplateLiteral: function TemplateLiteral(node, state) {
          var quasis = node.quasis, expressions = node.expressions;
          for (var i = 0, length = expressions.length; i < length; i++) {
            this.go(expressions[i], state);
          }
          for (var _i = 0, _length = quasis.length; _i < _length; _i++) {
            this.go(quasis[_i], state);
          }
        },
        TemplateElement: ignore,
        ObjectPattern: function ObjectPattern(node, state) {
          var properties = node.properties, length = properties.length;
          for (var i = 0; i < length; i++) {
            this.go(properties[i], state);
          }
        },
        ArrayPattern: ArrayExpression2,
        AssignmentPattern: function AssignmentPattern(node, state) {
          this.go(node.left, state);
          this.go(node.right, state);
        },
        MetaProperty: function MetaProperty(node, state) {
          this.go(node.meta, state);
          this.go(node.property, state);
        },
        // JavaScript 7
        AwaitExpression: function AwaitExpression(node, state) {
          this.go(node.argument, state);
        }
      };
    });
  })(defaultTraveler);
  return defaultTraveler;
}
var attachComments = {};
var hasRequiredAttachComments;
function requireAttachComments() {
  if (hasRequiredAttachComments) return attachComments;
  hasRequiredAttachComments = 1;
  (function(exports) {
    (function(global, factory) {
      {
        factory(exports, requireDefaultTraveler());
      }
    })(attachComments, function(exports2, _defaultTraveler) {
      exports2.__esModule = true;
      exports2.default = function(node, comments) {
        customTraveler[node.type](node, {
          comments,
          index: 0
        });
        return node;
      };
      var _defaultTraveler2 = _interopRequireDefault(_defaultTraveler);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
          default: obj
        };
      }
      function attachComments2(parent, children, findHeadingComments, state, traveler) {
        var index = state.index, comments = state.comments;
        var comment = comments[index];
        var boundComments = void 0, trailingComments = void 0;
        if (comment != null) {
          if (children == null || children.length === 0) {
            boundComments = parent.comments != null ? parent.comments : [];
            while (comment != null && comment.end < parent.end) {
              boundComments.push(comment);
              comment = comments[++index];
            }
            state.index = index;
            if (boundComments.length !== 0 && parent.comments == null) parent.comments = boundComments;
          } else {
            if (findHeadingComments) {
              boundComments = parent.comments != null ? parent.comments : [];
              var start = children[0].start;
              while (comment != null && comment.type[0] === "B" && comment.end < start) {
                boundComments.push(comment);
                comment = comments[++index];
              }
              if (boundComments.length !== 0 && parent.comments == null) parent.comments = boundComments;
            }
            for (var i = 0, length = children.length; comment != null && i < length; i++) {
              var child = children[i];
              boundComments = [];
              while (comment != null && comment.end < child.start) {
                boundComments.push(comment);
                comment = comments[++index];
              }
              if (comment != null && comment.type[0] === "L") {
                if (comment.loc.start.line === child.loc.end.line) {
                  boundComments.push(comment);
                  comment = comments[++index];
                }
              }
              if (boundComments.length !== 0) child.comments = boundComments;
              state.index = index;
              traveler[child.type](child, state);
              index = state.index;
              comment = comments[index];
            }
            trailingComments = [];
            while (comment != null && comment.end < parent.end) {
              trailingComments.push(comment);
              comment = comments[++index];
            }
            if (trailingComments.length !== 0) parent.trailingComments = trailingComments;
            state.index = index;
          }
        }
      }
      var Program = void 0;
      var customTraveler = _defaultTraveler2.default.makeChild(
        {
          Program: Program = function Program2(node, state) {
            attachComments2(node, node.body, true, state, this);
          },
          BlockStatement: Program,
          ObjectExpression: function ObjectExpression(node, state) {
            attachComments2(node, node.properties, true, state, this);
          },
          ArrayExpression: function ArrayExpression2(node, state) {
            attachComments2(node, node.elements, true, state, this);
          },
          SwitchStatement: function SwitchStatement(node, state) {
            attachComments2(node, node.cases, false, state, this);
          },
          SwitchCase: function SwitchCase(node, state) {
            attachComments2(node, node.consequent, false, state, this);
          }
        }
        // TODO: Consider ArrayExpression ?
      );
    });
  })(attachComments);
  return attachComments;
}
var hasRequiredAstravel;
function requireAstravel() {
  if (hasRequiredAstravel) return astravel;
  hasRequiredAstravel = 1;
  (function(exports) {
    (function(global, factory) {
      {
        factory(exports, requireDefaultTraveler(), requireAttachComments());
      }
    })(astravel, function(exports2, _defaultTraveler, _attachComments) {
      exports2.__esModule = true;
      exports2.makeTraveler = exports2.attachComments = exports2.defaultTraveler = void 0;
      var _defaultTraveler2 = _interopRequireDefault(_defaultTraveler);
      var _attachComments2 = _interopRequireDefault(_attachComments);
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
          default: obj
        };
      }
      function makeTraveler(properties) {
        return _defaultTraveler2.default.makeChild(properties);
      }
      exports2.defaultTraveler = _defaultTraveler2.default;
      exports2.attachComments = _attachComments2.default;
      exports2.makeTraveler = makeTraveler;
    });
  })(astravel);
  return astravel;
}
var astravelExports = requireAstravel();
const watchListArray = ["time", "fps", "speed", "bpm"];
const watchList = new Set(watchListArray);
function Deglobalize(textIn, prefix) {
  let textCleaned = textIn.replace(/[\u200B-\u200D\uFEFF]/g, "");
  let text = "async function* f() {\n" + textCleaned + "\n}";
  let traveler = astravelExports.makeTraveler({
    go: function(node, state2) {
      if (node.type === "Identifier") {
        if (watchList.has(node.name)) {
          state2.refTab.push(node);
        }
      }
      this.super.go.call(this, node, state2);
    }
    //MemberExpression: ignore
  });
  var comments = [];
  let ast;
  try {
    ast = Parser.parse(
      text,
      {
        locations: false,
        ecmaVersion: "latest",
        allowReserved: true,
        allowAwaitOutsideFunction: true,
        onComment: comments
      }
    );
  } catch (err) {
    console.log("Deglobalize err: " + err);
    console.log(textCleaned);
    return textCleaned;
  }
  let state = {
    refTab: []
  };
  traveler.go(ast, state);
  if (state.refTab.length === 0) return textCleaned;
  for (let i = 0; i < state.refTab.length; ++i) {
    let node = state.refTab[i];
    let vn = node.name;
    node.type = "MemberExpression";
    delete node.name;
    node.object = { type: "Identifier", name: prefix };
    node.property = { type: "Identifier", name: vn };
    node.computed = false;
    node.optional = false;
  }
  let regen = generate(ast);
  return stripOutStuff(regen);
}
function stripOutStuff(inp) {
  let firstX = inp.indexOf("{");
  let lastX = inp.lastIndexOf("}");
  if (firstX === -1 || lastX === -1) return inp;
  let outp = inp.substring(firstX + 1, lastX);
  return outp;
}
function parseObj(objText, options = {}) {
  const { swapYZ = false } = options;
  const vertices = [];
  const normals = [];
  const uvs = [];
  const faces = [];
  const materialNames = [];
  const materialToId = /* @__PURE__ */ new Map();
  let currentMaterial = null;
  const lines = objText.split("\n");
  for (const line2 of lines) {
    const parts = line2.trim().split(/\s+/);
    if (parts[0] === "v") {
      const x2 = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      vertices.push(swapYZ ? [x2, z, y] : [x2, y, z]);
    } else if (parts[0] === "vn") {
      const x2 = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      normals.push(swapYZ ? [x2, z, y] : [x2, y, z]);
    } else if (parts[0] === "vt") {
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (parts[0] === "usemtl") {
      const matName = parts.slice(1).join(" ");
      if (!materialToId.has(matName)) {
        materialToId.set(matName, materialNames.length);
        materialNames.push(matName);
      }
      currentMaterial = materialToId.get(matName);
    } else if (parts[0] === "f") {
      const faceVerts = [];
      const faceUVs = [];
      const faceNormals = [];
      for (let i = 1; i < parts.length; i++) {
        const indices = parts[i].split("/");
        faceVerts.push(parseInt(indices[0]) - 1);
        if (indices[1]) faceUVs.push(parseInt(indices[1]) - 1);
        if (indices[2]) faceNormals.push(parseInt(indices[2]) - 1);
      }
      faces.push({ verts: faceVerts, uvs: faceUVs, normals: faceNormals, material: currentMaterial });
    }
  }
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const v2 of vertices) {
    minX = Math.min(minX, v2[0]);
    maxX = Math.max(maxX, v2[0]);
    minY = Math.min(minY, v2[1]);
    maxY = Math.max(maxY, v2[1]);
    minZ = Math.min(minZ, v2[2]);
    maxZ = Math.max(maxZ, v2[2]);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeZ = maxZ - minZ;
  const maxRange = Math.max(rangeX, rangeY, rangeZ);
  const scale = 1 / maxRange;
  const verts = [];
  const outNormals = [];
  const outUVs = [];
  const outFaceIds = [];
  const hasNormals = normals.length > 0;
  const hasExplicitUVs = uvs.length > 0;
  const hasMaterials = materialNames.length > 0;
  const defaultQuadUVs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const defaultTriUVs = [[0, 0], [1, 0], [0.5, 1]];
  const addVertex = (vertIdx, uv, normalIdx, materialId) => {
    const v2 = vertices[vertIdx];
    verts.push((v2[0] - centerX) * scale);
    verts.push((v2[1] - centerY) * scale);
    verts.push((v2[2] - centerZ) * scale);
    if (hasNormals && normalIdx !== void 0) {
      const n = normals[normalIdx];
      outNormals.push(n[0], n[1], n[2]);
    }
    outUVs.push(uv[0], uv[1]);
    if (hasMaterials) {
      outFaceIds.push(materialId !== null ? materialId : 0);
    }
  };
  for (const face of faces) {
    const fv = face.verts;
    const fu = face.uvs;
    const fn = face.normals;
    const fm = face.material;
    if (fv.length === 3) {
      for (let i = 0; i < 3; i++) {
        const uv = hasExplicitUVs && fu[i] !== void 0 ? uvs[fu[i]] : defaultTriUVs[i];
        addVertex(fv[i], uv, fn[i], fm);
      }
    } else if (fv.length >= 4) {
      for (let i = 1; i < fv.length - 1; i++) {
        const uv0 = hasExplicitUVs && fu[0] !== void 0 ? uvs[fu[0]] : defaultQuadUVs[0];
        const uv1 = hasExplicitUVs && fu[i] !== void 0 ? uvs[fu[i]] : defaultQuadUVs[i];
        const uv2 = hasExplicitUVs && fu[i + 1] !== void 0 ? uvs[fu[i + 1]] : defaultQuadUVs[i + 1];
        addVertex(fv[0], uv0, fn[0], fm);
        addVertex(fv[i], uv1, fn[i], fm);
        addVertex(fv[i + 1], uv2, fn[i + 1], fm);
      }
    }
  }
  const vs = new VertexSource(verts);
  vs.is3D = true;
  if (outNormals.length > 0) vs.normals = outNormals;
  if (outUVs.length > 0) vs.uvs = outUVs;
  if (outFaceIds.length > 0) {
    vs.faceIds = outFaceIds;
    vs.materialNames = materialNames;
  }
  return vs;
}
async function loadObj(url, options = {}) {
  const response = await fetch(url);
  const text = await response.text();
  return parseObj(text, options);
}
function parseGlb(arrayBuffer, options = {}) {
  const { meshIndex = 0, primitiveIndex } = options;
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  if (magic !== 1179937895) {
    throw new Error("Invalid GLB file: bad magic number");
  }
  const version2 = view.getUint32(4, true);
  if (version2 !== 2) {
    throw new Error(`Unsupported glTF version: ${version2}`);
  }
  let jsonChunk = null;
  let binChunk = null;
  let offset2 = 12;
  while (offset2 < arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset2, true);
    const chunkType = view.getUint32(offset2 + 4, true);
    const chunkData = new Uint8Array(arrayBuffer, offset2 + 8, chunkLength);
    if (chunkType === 1313821514) {
      const decoder = new TextDecoder("utf-8");
      jsonChunk = JSON.parse(decoder.decode(chunkData));
    } else if (chunkType === 5130562) {
      binChunk = chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength);
    }
    offset2 += 8 + chunkLength;
    if (offset2 % 4 !== 0) offset2 += 4 - offset2 % 4;
  }
  if (!jsonChunk) throw new Error("GLB missing JSON chunk");
  return extractMeshFromGltf(jsonChunk, binChunk, meshIndex, primitiveIndex);
}
function extractMeshFromGltf(gltf, binBuffer, meshIndex, primitiveIndex) {
  var _a;
  const mesh = (_a = gltf.meshes) == null ? void 0 : _a[meshIndex];
  if (!mesh) throw new Error(`Mesh ${meshIndex} not found`);
  const readAccessor = (accessorIndex) => {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const componentType = accessor.componentType;
    const count = accessor.count;
    const type = accessor.type;
    const typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const components = typeComponents[type] || 1;
    const TypedArray = {
      5120: Int8Array,
      // BYTE
      5121: Uint8Array,
      // UNSIGNED_BYTE
      5122: Int16Array,
      // SHORT
      5123: Uint16Array,
      // UNSIGNED_SHORT
      5125: Uint32Array,
      // UNSIGNED_INT
      5126: Float32Array
      // FLOAT
    }[componentType];
    if (!TypedArray) throw new Error(`Unsupported component type: ${componentType}`);
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const byteStride = bufferView.byteStride || 0;
    if (byteStride === 0 || byteStride === components * TypedArray.BYTES_PER_ELEMENT) {
      return new TypedArray(binBuffer, byteOffset, count * components);
    }
    const result = new TypedArray(count * components);
    const srcView = new DataView(binBuffer);
    for (let i = 0; i < count; i++) {
      const srcOffset = byteOffset + i * byteStride;
      for (let j = 0; j < components; j++) {
        if (TypedArray === Float32Array) {
          result[i * components + j] = srcView.getFloat32(srcOffset + j * 4, true);
        } else if (TypedArray === Uint16Array) {
          result[i * components + j] = srcView.getUint16(srcOffset + j * 2, true);
        } else if (TypedArray === Uint32Array) {
          result[i * components + j] = srcView.getUint32(srcOffset + j * 4, true);
        }
      }
    }
    return result;
  };
  const primitives = primitiveIndex !== void 0 ? [mesh.primitives[primitiveIndex]] : mesh.primitives;
  if (!primitives || primitives.length === 0) {
    throw new Error(`No primitives found in mesh ${meshIndex}`);
  }
  const verts = [];
  const outNormals = [];
  const outUVs = [];
  const outTangents = [];
  let hasAnyUVs = false;
  for (const primitive of primitives) {
    const positionAccessor = primitive.attributes.POSITION;
    if (positionAccessor === void 0) continue;
    const positions = readAccessor(positionAccessor);
    const normals = primitive.attributes.NORMAL !== void 0 ? readAccessor(primitive.attributes.NORMAL) : null;
    const uvs = primitive.attributes.TEXCOORD_0 !== void 0 ? readAccessor(primitive.attributes.TEXCOORD_0) : null;
    const tangents = primitive.attributes.TANGENT !== void 0 ? readAccessor(primitive.attributes.TANGENT) : null;
    if (uvs) hasAnyUVs = true;
    const indices = primitive.indices !== void 0 ? readAccessor(primitive.indices) : null;
    const addVertex = (idx) => {
      verts.push(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);
      if (normals) {
        outNormals.push(normals[idx * 3], normals[idx * 3 + 1], normals[idx * 3 + 2]);
      }
      if (uvs) {
        outUVs.push(uvs[idx * 2], uvs[idx * 2 + 1]);
      }
      if (tangents) {
        outTangents.push(tangents[idx * 4], tangents[idx * 4 + 1], tangents[idx * 4 + 2], tangents[idx * 4 + 3]);
      }
    };
    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        addVertex(indices[i]);
      }
    } else {
      const vertexCount = positions.length / 3;
      for (let i = 0; i < vertexCount; i++) {
        addVertex(i);
      }
    }
  }
  if (verts.length === 0) {
    throw new Error("No vertex data found in mesh");
  }
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < verts.length; i += 3) {
    minX = Math.min(minX, verts[i]);
    maxX = Math.max(maxX, verts[i]);
    minY = Math.min(minY, verts[i + 1]);
    maxY = Math.max(maxY, verts[i + 1]);
    minZ = Math.min(minZ, verts[i + 2]);
    maxZ = Math.max(maxZ, verts[i + 2]);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeZ = maxZ - minZ;
  const maxRange = Math.max(rangeX, rangeY, rangeZ);
  const scale = maxRange > 0 ? 1 / maxRange : 1;
  for (let i = 0; i < verts.length; i += 3) {
    verts[i] = (verts[i] - centerX) * scale;
    verts[i + 1] = (verts[i + 1] - centerY) * scale;
    verts[i + 2] = (verts[i + 2] - centerZ) * scale;
  }
  if (!hasAnyUVs) {
    for (let i = 0; i < verts.length; i += 3) {
      const x2 = verts[i], y = verts[i + 1], z = verts[i + 2];
      const u = 0.5 + Math.atan2(z, x2) / (2 * Math.PI);
      const v2 = 0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
      outUVs.push(u, v2);
    }
  }
  const vs = new VertexSource(verts);
  vs.is3D = true;
  if (outNormals.length > 0) vs.normals = outNormals;
  if (outUVs.length > 0) vs.uvs = outUVs;
  if (outTangents.length > 0) vs.tangents = outTangents;
  return vs;
}
async function loadGlb(url, options = {}) {
  var _a;
  const { extractTextures = true, ...parseOptions } = options;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GLB from ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 12) {
    throw new Error(`Invalid GLB file from ${url}: file too small (${arrayBuffer.byteLength} bytes)`);
  }
  const model = parseGlb(arrayBuffer, parseOptions);
  if (extractTextures) {
    const textures = await extractGlbTextures(arrayBuffer);
    model.texture = ((_a = textures[0]) == null ? void 0 : _a.image) || null;
    model.textures = textures.map((t) => t.image);
  }
  return model;
}
async function extractGlbTextures(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  if (magic !== 1179937895) throw new Error("Invalid GLB");
  let jsonChunk = null;
  let binStart = 0;
  let offset2 = 12;
  while (offset2 < arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset2, true);
    const chunkType = view.getUint32(offset2 + 4, true);
    if (chunkType === 1313821514) {
      const chunkData = new Uint8Array(arrayBuffer, offset2 + 8, chunkLength);
      jsonChunk = JSON.parse(new TextDecoder().decode(chunkData));
    } else if (chunkType === 5130562) {
      binStart = offset2 + 8;
    }
    offset2 += 8 + chunkLength;
    if (offset2 % 4 !== 0) offset2 += 4 - offset2 % 4;
  }
  if (!jsonChunk || !jsonChunk.images) return [];
  const textures = [];
  for (let i = 0; i < jsonChunk.images.length; i++) {
    const imgDef = jsonChunk.images[i];
    if (imgDef.bufferView === void 0) continue;
    const bv = jsonChunk.bufferViews[imgDef.bufferView];
    const imgBytes = new Uint8Array(arrayBuffer, binStart + (bv.byteOffset || 0), bv.byteLength);
    let mimeType = imgDef.mimeType;
    if (!mimeType) {
      if (imgBytes[0] === 137 && imgBytes[1] === 80) mimeType = "image/png";
      else if (imgBytes[0] === 255 && imgBytes[1] === 216) mimeType = "image/jpeg";
      else mimeType = "image/png";
    }
    const blob = new Blob([imgBytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    textures.push({ image: img, index: i, blobUrl: url });
  }
  return textures;
}
async function createGlbSpriteSheet(urls, options = {}) {
  const { cellSize = 256 } = options;
  const results = await Promise.all(urls.map(async (url) => {
    var _a;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const model = parseGlb(arrayBuffer, options);
    const textures = await extractGlbTextures(arrayBuffer);
    return { model, texture: ((_a = textures[0]) == null ? void 0 : _a.image) || null };
  }));
  const count = results.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext("2d");
  results.forEach((r, i) => {
    if (r.texture) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      ctx.drawImage(r.texture, col * cellSize, row * cellSize, cellSize, cellSize);
    }
  });
  const models = results.map((r, i) => {
    r.model.spriteIndex = i;
    return r.model;
  });
  return { canvas, models, cols, rows, cellSize };
}
function tri(size = 1, centerX = 0, centerY = 0) {
  const h = size * Math.sqrt(3) / 2;
  const verts = [
    centerX,
    centerY + h * 2 / 3,
    centerX - size / 2,
    centerY - h / 3,
    centerX + size / 2,
    centerY - h / 3
  ];
  return new VertexSource(verts);
}
function quad(width = 1, height = 1, centerX = 0, centerY = 0) {
  const hw = width / 2, hh = height / 2;
  const verts = [
    // Triangle 1
    centerX - hw,
    centerY - hh,
    centerX + hw,
    centerY - hh,
    centerX + hw,
    centerY + hh,
    // Triangle 2
    centerX - hw,
    centerY - hh,
    centerX + hw,
    centerY + hh,
    centerX - hw,
    centerY + hh
  ];
  return new VertexSource(verts);
}
function poly(sides, radius = 1, centerX = 0, centerY = 0) {
  const verts = [];
  for (let i = 0; i < sides; i++) {
    const a1 = i / sides * Math.PI * 2 - Math.PI / 2;
    const a2 = (i + 1) / sides * Math.PI * 2 - Math.PI / 2;
    verts.push(centerX, centerY);
    verts.push(centerX + Math.cos(a1) * radius, centerY + Math.sin(a1) * radius);
    verts.push(centerX + Math.cos(a2) * radius, centerY + Math.sin(a2) * radius);
  }
  return new VertexSource(verts);
}
function circle(radius = 1, centerX = 0, centerY = 0, segments = 32) {
  return poly(segments, radius, centerX, centerY);
}
function line(x1, y1, x2, y2, thickness = 0.02) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len * thickness / 2;
  const ny = dx / len * thickness / 2;
  const verts = [
    x1 + nx,
    y1 + ny,
    x1 - nx,
    y1 - ny,
    x2 - nx,
    y2 - ny,
    x1 + nx,
    y1 + ny,
    x2 - nx,
    y2 - ny,
    x2 + nx,
    y2 + ny
  ];
  return new VertexSource(verts);
}
function ring(outerRadius = 1, innerRadius = 0.5, centerX = 0, centerY = 0, segments = 32) {
  const verts = [];
  for (let i = 0; i < segments; i++) {
    const a1 = i / segments * Math.PI * 2;
    const a2 = (i + 1) / segments * Math.PI * 2;
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
    verts.push(centerX + cos1 * innerRadius, centerY + sin1 * innerRadius);
    verts.push(centerX + cos1 * outerRadius, centerY + sin1 * outerRadius);
    verts.push(centerX + cos2 * outerRadius, centerY + sin2 * outerRadius);
    verts.push(centerX + cos1 * innerRadius, centerY + sin1 * innerRadius);
    verts.push(centerX + cos2 * outerRadius, centerY + sin2 * outerRadius);
    verts.push(centerX + cos2 * innerRadius, centerY + sin2 * innerRadius);
  }
  return new VertexSource(verts);
}
function cube(size = 0.5) {
  const s = size;
  const corners = [
    [-s, -s, s],
    // 0: front-bottom-left
    [s, -s, s],
    // 1: front-bottom-right
    [s, s, s],
    // 2: front-top-right
    [-s, s, s],
    // 3: front-top-left
    [-s, -s, -s],
    // 4: back-bottom-left
    [s, -s, -s],
    // 5: back-bottom-right
    [s, s, -s],
    // 6: back-top-right
    [-s, s, -s]
    // 7: back-top-left
  ];
  const faces = [
    { indices: [0, 1, 2, 0, 2, 3], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    // front (0)
    { indices: [5, 4, 7, 5, 7, 6], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    // back (1)
    { indices: [3, 2, 6, 3, 6, 7], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    // top (2)
    { indices: [4, 5, 1, 4, 1, 0], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    // bottom (3)
    { indices: [1, 5, 6, 1, 6, 2], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] },
    // right (4)
    { indices: [4, 0, 3, 4, 3, 7], uvs: [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]] }
    // left (5)
  ];
  const verts = [];
  const uvs = [];
  const faceIds = [];
  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx];
    for (let i = 0; i < face.indices.length; i++) {
      verts.push(...corners[face.indices[i]]);
      uvs.push(...face.uvs[i]);
      faceIds.push(faceIdx);
    }
  }
  const vs = new VertexSource(verts);
  vs.uvs = uvs;
  vs.faceIds = faceIds;
  vs.is3D = true;
  return vs;
}
class SpriteSheet {
  constructor(options = {}) {
    this.cols = options.cols || 1;
    this.rows = options.rows || 1;
    this.total = this.cols * this.rows;
    this.cells = options.cells || null;
    this.source = options.source || null;
    this.padding = options.padding || 0;
  }
  // Get UV bounds for a cell index
  // Returns { uMin, vMin, uMax, vMax }
  getUVBounds(index) {
    const idx = typeof index === "function" ? index() : index;
    const i = Math.floor(idx) % this.total;
    const safeIndex = i < 0 ? i + this.total : i;
    if (this.cells) {
      const cell = this.cells[safeIndex] || this.cells[0];
      return {
        uMin: cell.x,
        vMin: cell.y,
        uMax: cell.x + cell.width,
        vMax: cell.y + cell.height
      };
    }
    const col = safeIndex % this.cols;
    const row = Math.floor(safeIndex / this.cols);
    const cellWidth = (1 - this.padding * (this.cols + 1)) / this.cols;
    const cellHeight = (1 - this.padding * (this.rows + 1)) / this.rows;
    const uMin = this.padding + col * (cellWidth + this.padding);
    const vMin = this.padding + row * (cellHeight + this.padding);
    return {
      uMin,
      vMin,
      uMax: uMin + cellWidth,
      vMax: vMin + cellHeight
    };
  }
  // Create a picker that returns UV bounds
  // Can be static index, lambda, or Hydra source
  pick(indexOrSource) {
    return {
      sheet: this,
      index: indexOrSource,
      type: "sprite-pick",
      // Get UV bounds (called per-frame if lambda)
      getUVBounds: () => this.getUVBounds(indexOrSource)
    };
  }
  // Use material ID from vertex data
  fromModel() {
    return {
      sheet: this,
      type: "sprite-from-model",
      // UV transform happens in shader using vertex materialId
      getUVBounds: () => ({
        uMin: 0,
        vMin: 0,
        uMax: 1,
        vMax: 1,
        useVertexMaterialId: true,
        cols: this.cols,
        rows: this.rows
      })
    };
  }
  // Get GLSL code for UV transformation
  // For use in fragment shader
  getGlslTransform(indexUniform = "u_spriteIndex") {
    return `
vec2 spriteUV(vec2 uv, float index) {
  float idx = floor(mod(index, ${this.total}.0));
  float col = mod(idx, ${this.cols}.0);
  float row = floor(idx / ${this.cols}.0);
  float cellW = 1.0 / ${this.cols}.0;
  float cellH = 1.0 / ${this.rows}.0;
  return vec2(
    (col + uv.x) * cellW,
    (row + uv.y) * cellH
  );
}
`;
  }
  // Get WGSL code for UV transformation
  getWgslTransform(indexUniform = "u_spriteIndex") {
    return `
fn spriteUV(uv: vec2f, index: f32) -> vec2f {
  let idx = floor(index % ${this.total}.0);
  let col = idx % ${this.cols}.0;
  let row = floor(idx / ${this.cols}.0);
  let cellW = 1.0 / ${this.cols}.0;
  let cellH = 1.0 / ${this.rows}.0;
  return vec2f(
    (col + uv.x) * cellW,
    (row + uv.y) * cellH
  );
}
`;
  }
}
function spriteSheet(source, cols = 1, rows = 1, options = {}) {
  return new SpriteSheet({
    source,
    cols,
    rows,
    ...options
  });
}
function spriteAtlas(source, cells, options = {}) {
  return new SpriteSheet({
    source,
    cells,
    ...options
  });
}
function parseAseprite(json, source = null) {
  const data2 = typeof json === "string" ? JSON.parse(json) : json;
  const meta = data2.meta || {};
  const size = meta.size || { w: 1, h: 1 };
  const imageWidth = size.w;
  const imageHeight = size.h;
  const frames = data2.frames;
  const cells = [];
  const names = {};
  const durations = [];
  if (Array.isArray(frames)) {
    frames.forEach((f, i) => {
      const cell = {
        name: f.filename,
        x: f.frame.x / imageWidth,
        y: f.frame.y / imageHeight,
        width: f.frame.w / imageWidth,
        height: f.frame.h / imageHeight
      };
      names[f.filename] = i;
      cells.push(cell);
      durations.push(f.duration || 100);
    });
  } else {
    const keys = Object.keys(frames);
    keys.forEach((key, i) => {
      const f = frames[key];
      const cell = {
        name: key,
        x: f.frame.x / imageWidth,
        y: f.frame.y / imageHeight,
        width: f.frame.w / imageWidth,
        height: f.frame.h / imageHeight
      };
      names[key] = i;
      cells.push(cell);
      durations.push(f.duration || 100);
    });
  }
  const animations = {};
  const frameTags = meta.frameTags || [];
  for (const tag of frameTags) {
    animations[tag.name] = {
      from: tag.from,
      to: tag.to,
      direction: tag.direction || "forward",
      frames: []
    };
    for (let i = tag.from; i <= tag.to; i++) {
      animations[tag.name].frames.push(i);
    }
  }
  const sheet = new SpriteSheet({
    source,
    cells,
    cols: cells.length,
    // for compatibility
    rows: 1
  });
  sheet.names = names;
  sheet.durations = durations;
  sheet.animations = animations;
  sheet.imageWidth = imageWidth;
  sheet.imageHeight = imageHeight;
  sheet.playAnimation = function(animName, speed = 1) {
    const anim = this.animations[animName];
    if (!anim) {
      console.warn(`Animation "${animName}" not found`);
      return this.pick(0);
    }
    return {
      sheet: this,
      animation: anim,
      type: "sprite-animation",
      getUVBounds: () => {
        const totalDuration = anim.frames.reduce((sum, i) => sum + this.durations[i], 0);
        const now2 = typeof performance !== "undefined" ? performance.now() : Date.now();
        let elapsed = now2 * speed % totalDuration;
        let frameIndex = anim.from;
        for (const i of anim.frames) {
          elapsed -= this.durations[i];
          if (elapsed <= 0) {
            frameIndex = i;
            break;
          }
        }
        return this.getUVBounds(frameIndex);
      }
    };
  };
  sheet.pickByName = function(name) {
    const index = this.names[name];
    if (index === void 0) {
      console.warn(`Frame "${name}" not found`);
      return this.pick(0);
    }
    return this.pick(index);
  };
  return sheet;
}
async function loadAseprite(jsonUrl, source = null) {
  const response = await fetch(jsonUrl);
  const json = await response.json();
  return parseAseprite(json, source);
}
const AsyncGeneratorFunction = (async function* () {
}).constructor;
let Mouse;
if (!(typeof self !== "undefined" && self.constructor && self.constructor.name === "DedicatedWorkerGlobalScope")) {
  Mouse = mouseListen();
  console.log("Not running as a web worker");
} else {
  Mouse = { x: 0, y: 0 };
  console.log("Running as a web worker");
}
class HydraRenderer {
  constructor({
    pb = null,
    width = 1280,
    height = 720,
    numSources = 4,
    numOutputs = 4,
    makeGlobal = true,
    autoLoop = true,
    detectAudio = true,
    enableStreamCapture = true,
    useWGSL = false,
    canvas,
    precision,
    regen = false,
    resetOut = true,
    extendTransforms = {},
    // add your own functions on init
    gpuDevice = null,
    // Optional shared GPUDevice for zero-copy texture sharing
    preserveDrawingBuffer = false
    // Enable for Syphon/pixel readback
  } = {}) {
    this.preserveDrawingBuffer = preserveDrawingBuffer;
    ArrayUtils.init();
    this.pb = pb;
    this.width = width;
    this.height = height;
    this.renderAll = false;
    this.detectAudio = detectAudio;
    this.useWGSL = useWGSL;
    if (this.useWGSL) {
      console.log("Creating HydraRenderer with WGSL and WebGPU.");
    }
    this.wgslReady = false;
    this.useRAF = false;
    this.gpuDevice = gpuDevice;
    this._initCanvas(canvas);
    this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: void 0,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      _destroy: this._destroy.bind(this),
      setResolution: this.setResolution.bind(this),
      update: (dt) => {
      },
      // user defined update function
      hush: this.hush.bind(this),
      tick: this.tick.bind(this),
      // Geometry helpers for vertex shaders
      tri,
      quad,
      poly,
      circle,
      line,
      ring,
      cube,
      loadObj,
      loadGlb,
      parseGlb,
      extractGlbTextures,
      createGlbSpriteSheet,
      // Sprite sheet helpers
      spriteSheet,
      spriteAtlas,
      parseAseprite,
      loadAseprite,
      // Vertex data proxy for accessing vertex shader outputs in fragment shaders
      // Usage: osc(10).mult(v.normal.z).out()
      v
    };
    if (makeGlobal) window.loadScript = this.loadScript;
    this.timeSinceLastUpdate = 0;
    this._time = 0;
    let precisionOptions = ["lowp", "mediump", "highp"];
    if (precision && precisionOptions.includes(precision.toLowerCase())) {
      this.precision = precision.toLowerCase();
    } else {
      let isIOS = (/iPad|iPhone|iPod/.test(navigator.platform) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) && !window.MSStream;
      this.precision = isIOS ? "highp" : "mediump";
    }
    this.extendTransforms = extendTransforms;
    this.saveFrame = false;
    this.captureStream = null;
    this.generatorFunction = void 0;
    this.generatorFunctionTimer = -1;
    this.numOutputs = numOutputs;
    this.regen = regen;
    this.regenInfo = new Array(numOutputs);
    this.resetOut = resetOut;
    if (this.useWGSL) {
      this.wgslHydra = new wgslHydra(this, this.canvas, 4, this.gpuDevice);
      this.wgslPromise = new Promise((resolve, reject) => {
        this._initOutputsWgsl(numOutputs);
        this.wgslHydra.setupHydra().then(() => {
          this._initSources(numSources);
          this._generateGlslTransforms();
          this.sandbox = new EvalSandbox(this.synth, makeGlobal, ["speed", "update", "bpm", "fps"]);
          if (autoLoop) {
            this.useRAF = false;
            this.looper = loop(this.tick.bind(this)).start();
          }
          resolve(true);
        });
      });
    } else {
      this._initRegl();
      this._initOutputs(numOutputs);
      this._initSources(numSources);
      this._generateGlslTransforms();
      this.sandbox = new EvalSandbox(this.synth, makeGlobal, ["speed", "update", "bpm", "fps"]);
      this.synth.screencap = () => {
        this.saveFrame = true;
      };
      if (enableStreamCapture) {
        try {
          this.captureStream = this.canvas.captureStream(25);
          this.synth.vidRecorder = new VideoRecorder(this.captureStream);
        } catch (e) {
          console.warn("[hydra-synth warning]\nnew MediaSource() is not currently supported on iOS.");
          console.error(e);
        }
      }
    }
    if (detectAudio) this._initAudio();
    if (this.useWGSL) return;
    if (autoLoop) {
      this.looper = loop(this.tick.bind(this)).start();
    }
    this.sandbox = new EvalSandbox(this.synth, makeGlobal, ["speed", "update", "bpm", "fps"]);
  }
  async eval(codeIn) {
    if (this.resetOut) this.synth.render(this.o[0]);
    let code = Deglobalize(codeIn, "_h");
    let h = this.synth;
    let keys = Object.keys(h);
    let values = [];
    for (let i = 0; i < keys.length; ++i) values.push(h[keys[i]]);
    keys.push("h");
    values.push(h);
    keys.push("_h");
    values.push(h);
    try {
      let fn = new AsyncGeneratorFunction(...keys, code);
      this.done = false;
      this.generatorFunction = fn(...values);
    } catch (err) {
      console.log("Error compiling generator function");
      console.log(err);
      this.generatorFunctionTimer = -1;
      return;
    }
    this.generatorFunctionTimer = -1;
    try {
      let reply = await this.generatorFunction.next();
      this.planNext(reply);
    } catch (err) {
      console.log("Error calling initial generator function.next()");
      console.log(err);
      delete this.generatorFunction;
      return;
    }
  }
  // Called from the general tick() function.
  async generatorTick() {
    if (!this.generatorFunction || this.generatorFunctionTimer === -1) return;
    if (this.synth.time < this.generatorFunctionTimer) return;
    let f = this.generatorFunction;
    if (!f) {
      this.generatorFunctionTimer = -1;
    } else
      try {
        let reply = await f.next();
        this.planNext(reply);
      } catch (err) {
        console.log("Error calling generator function.next()");
        console.log(err);
        this.generatorFunctionTimer = -1;
        delete this.generatorFunction;
      }
  }
  planNext(reply) {
    if (!reply) return;
    if (!reply.done) {
      let wT = reply.value;
      if (wT === void 0) {
        wT = 0.01;
      }
      this.generatorFunctionTimer = this.synth.time + wT;
    } else {
      this.done = true;
      delete this.generatorFunction;
    }
  }
  getScreenImage(callback) {
    this.imageCallback = callback;
    this.saveFrame = true;
  }
  // Teardown this hydra-synth, stopping periodic activity and reclaiming memory.
  _destroy() {
    this.hush();
    if (this.looper) {
      this.looper.stop();
      delete this.looper;
    }
    if (this.regl) {
      this.regl.destroy();
      delete this.regl;
    }
    if (this.synth && this.synth.a) {
      this.synth.a.destroy();
    }
  }
  hush() {
    this.regenInfo = [];
    this.s.forEach((source) => {
      source.clear();
    });
    this.o.forEach((output) => {
      if (output.clearSprites) {
        output.clearSprites();
      }
      this.synth.solid(0, 0, 0, 0).out(output);
    });
    this.synth.render(this.o[0]);
    this.sandbox.set("update", (dt) => {
    });
  }
  loadScript(url = "") {
    const p = new Promise((res, rej) => {
      var script = document.createElement("script");
      script.onload = function() {
        console.log(`loaded script ${url}`);
        res();
      };
      script.onerror = (err) => {
        console.log(`error loading script ${url}`, "log-error");
        res();
      };
      script.src = url;
      document.head.appendChild(script);
    });
    return p;
  }
  noteRegenString(outIndex, regenStr) {
    this.regenInfo[outIndex] = { str: regenStr, modTime: performance.now() };
  }
  // Return the regenerated strings from at or before a given time.
  // time unit "highTime" is performance.now() + performance.timeOrigin
  activeFromBefore(highTime) {
    let timeBase = performance.timeOrigin;
    let os = [];
    for (let j = 0; j < this.s.length; ++j) {
      let src = this.s[j];
      if (src && src.active && src.modTime + timeBase <= highTime) {
        os.push(src.setupString());
        os.push("\n");
      }
    }
    for (let i = 0; i < this.regenInfo.length; ++i) {
      let ent = this.regenInfo[i];
      if (ent) {
        if (ent.modTime + timeBase <= highTime) {
          let filtered = ent.str.replaceAll("_h.", "");
          os.push(filtered);
          os.push("\n");
        }
      }
    }
    return os.join("");
  }
  setResolution(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.sandbox.set("width", width);
    this.sandbox.set("height", height);
    console.log(this.width);
    this.o.forEach((output) => {
      output.resize(width, height);
    });
    this.s.forEach((source) => {
      source.resize(width, height);
    });
    if (this.useWGSL) {
      this.wgslHydra.resizeOutputsTo(width, height);
    } else {
      this.regl._refresh();
    }
  }
  canvasToImage(callback) {
    const a2 = document.createElement("a");
    a2.style.display = "none";
    let d = /* @__PURE__ */ new Date();
    a2.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.png`;
    document.body.appendChild(a2);
    var self2 = this;
    this.canvas.toBlob((blob) => {
      if (self2.imageCallback) {
        self2.imageCallback(blob);
        delete self2.imageCallback;
      } else {
        a2.href = URL.createObjectURL(blob);
        console.log(a2.href);
        a2.click();
      }
    }, "image/png");
    setTimeout(() => {
      document.body.removeChild(a2);
      window.URL.revokeObjectURL(a2.href);
    }, 300);
  }
  _initAudio() {
    this.synth.a = new Audio({
      numBins: 4,
      parentEl: this.canvas.parentNode
    });
  }
  // create main output canvas and add to screen
  _initCanvas(canvas) {
    if (canvas) {
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
    } else {
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.imageRendering = "pixelated";
      document.body.appendChild(this.canvas);
    }
  }
  _initRegl() {
    this.regl = regl({
      //  profile: true,
      canvas: this.canvas,
      pixelRatio: 1,
      attributes: {
        preserveDrawingBuffer: this.preserveDrawingBuffer
      }
      // extensions: [
      //   'oes_texture_half_float',
      //   'oes_texture_half_float_linear'
      // ],
      // optionalExtensions: [
      //   'oes_texture_float',
      //   'oes_texture_float_linear'
      //]
    });
    this.regl.clear({
      color: [0, 0, 0, 1]
    });
    this.renderAll = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform sampler2D tex0;
      uniform sampler2D tex1;
      uniform sampler2D tex2;
      uniform sampler2D tex3;

      void main () {
        vec2 st = vec2(1.0 - uv.x, uv.y);
        st*= vec2(2);
        vec2 q = floor(st).xy*(vec2(2.0, 1.0));
        int quad = int(q.x) + int(q.y);
        st.x += step(1., mod(st.y,2.0));
        st.y += step(1., mod(st.x,2.0));
        st = fract(st);
        if(quad==0){
          gl_FragColor = texture2D(tex0, st);
        } else if(quad==1){
          gl_FragColor = texture2D(tex1, st);
        } else if (quad==2){
          gl_FragColor = texture2D(tex2, st);
        } else {
          gl_FragColor = texture2D(tex3, st);
        }

      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop("tex0"),
        tex1: this.regl.prop("tex1"),
        tex2: this.regl.prop("tex2"),
        tex3: this.regl.prop("tex3")
      },
      count: 3,
      depth: { enable: false }
    });
    this.renderFbo = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop("tex0"),
        resolution: this.regl.prop("resolution")
      },
      count: 3,
      depth: { enable: false }
    });
  }
  _initOutputs(numOutputs) {
    const self2 = this;
    this.o = Array(numOutputs).fill().map((el, index) => {
      var o = new Output({
        regl: this.regl,
        chanNum: index,
        hydraSynth: this,
        width: this.width,
        height: this.height,
        precision: this.precision,
        label: `o${index}`
      });
      o.id = index;
      self2.synth["o" + index] = o;
      return o;
    });
    this.output = this.o[0];
  }
  _initOutputsWgsl(numOutputs) {
    const self2 = this;
    this.o = Array(numOutputs).fill().map((el, index) => {
      var o = new OutputWgsl({
        wgslHydra: this.wgslHydra,
        hydraSynth: this,
        width: this.width,
        height: this.height,
        chanNum: index,
        label: `o${index}`
      });
      o.id = index;
      self2.synth["o" + index] = o;
      return o;
    });
    this.output = this.o[0];
  }
  _initSources(numSources) {
    this.s = [];
    for (var i = 0; i < numSources; i++) {
      this.createSource(i);
    }
  }
  createSource(i) {
    let s = new HydraSource({
      regl: this.regl,
      hydraSynth: this,
      wgsl: this.wgslHydra,
      pb: this.pb,
      width: this.width,
      height: this.height,
      chanNum: i,
      label: `s${i}`
    });
    this.synth["s" + this.s.length] = s;
    this.s.push(s);
    return s;
  }
  _generateGlslTransforms() {
    var self2 = this;
    this.generator = new GeneratorFactory({
      genWGSL: this.useWGSL,
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({ type, method, synth }) => {
        if (type === "add") {
          self2.synth[method] = synth.generators[method];
          if (self2.sandbox) self2.sandbox.add(method);
        }
      }
    });
    this.synth.setFunction = this.generator.setFunction.bind(this.generator);
  }
  _render(output) {
    if (output) {
      this.output = output;
      this.isRenderingAll = false;
      if (this.wgslHydra) {
        this.wgslHydra.showQuad = false;
        if (output.chanNum < this.numOutputs) {
          this.wgslHydra.outChannel = output.chanNum;
        }
      }
    } else {
      this.isRenderingAll = true;
      if (this.wgslHydra) {
        this.wgslHydra.showQuad = true;
      }
    }
  }
  // dt in ms
  tick(dt) {
    if (!this.sandbox) return;
    this.sandbox.tick();
    if (this.detectAudio && this.synth && this.synth.a && this.synth.a.tick) this.synth.a.tick();
    this.sandbox.set("time", this.synth.time += dt * 1e-3 * this.synth.speed);
    this.timeSinceLastUpdate += dt;
    this.generatorTick();
    if (!this.synth.fps || this.timeSinceLastUpdate >= 1e3 / this.synth.fps) {
      if (this.useWGSL) {
        for (let i = 0; i < this.s.length; i++) {
          this.s[i].tick(this.synth.time);
        }
        this.wgslHydra.relayUniformInfo(this.synth.mouse);
        this.wgslHydra.animate(dt);
      } else {
        this.synth.stats.fps = Math.ceil(1e3 / this.timeSinceLastUpdate);
        if (this.synth.update) {
          try {
            this.synth.update(this.timeSinceLastUpdate);
          } catch (e) {
            console.log(e);
          }
        }
        for (let i = 0; i < this.s.length; i++) {
          this.s[i].tick(this.synth.time);
        }
        for (let i = 0; i < this.o.length; i++) {
          this.o[i].tick({
            time: this.synth.time,
            mouse: this.synth.mouse,
            bpm: this.synth.bpm,
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        if (this.isRenderingAll) {
          this.renderAll({
            tex0: this.o[0].getCurrent(),
            tex1: this.o[1].getCurrent(),
            tex2: this.o[2].getCurrent(),
            tex3: this.o[3].getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        } else {
          this.renderFbo({
            tex0: this.output.getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        this.timeSinceLastUpdate = 0;
      }
    }
    if (this.saveFrame === true) {
      this.canvasToImage();
      this.saveFrame = false;
    }
  }
}
let sharedDevice = null;
let sharedAdapter = null;
let initPromise = null;
async function initSharedDevice() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported on this browser.");
  }
  sharedAdapter = await navigator.gpu.requestAdapter();
  if (!sharedAdapter) {
    throw new Error("Failed to get GPU adapter.");
  }
  const hasBGRA8unormStorage = sharedAdapter.features.has("bgra8unorm-storage");
  sharedDevice = await sharedAdapter.requestDevice({
    requiredFeatures: hasBGRA8unormStorage ? ["bgra8unorm-storage"] : []
  });
  sharedDevice.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);
    sharedDevice = null;
    sharedAdapter = null;
    initPromise = null;
  });
  return sharedDevice;
}
async function getSharedDevice() {
  if (sharedDevice) {
    return sharedDevice;
  }
  if (!initPromise) {
    initPromise = initSharedDevice();
  }
  return initPromise;
}
function hasSharedDevice() {
  return sharedDevice !== null;
}
function releaseSharedDevice() {
  if (sharedDevice) {
    sharedDevice.destroy();
    sharedDevice = null;
    sharedAdapter = null;
    initPromise = null;
  }
}
export {
  HydraRenderer as Hydra,
  getSharedDevice,
  hasSharedDevice,
  releaseSharedDevice
};
