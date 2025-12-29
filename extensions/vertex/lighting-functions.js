// Lighting functions for vertex shader extension
// These use vertex data (normals, view direction) for shading effects

export default [
  {
    name: 'diffuse',
    type: 'color',
    inputs: [
      { type: 'float', name: 'lx', default: 0 },
      { type: 'float', name: 'ly', default: 1 },
      { type: 'float', name: 'lz', default: 0 },
      { type: 'float', name: 'ambient', default: 0.2 }
    ],
    glsl: `
      vec3 lightDir = normalize(vec3(lx, ly, lz));
      vec3 normal = normalize(v_worldNormal);
      float diff = max(0.0, dot(normal, lightDir));
      float lighting = ambient + (1.0 - ambient) * diff;
      return vec4(_c0.rgb * lighting, _c0.a);`,
    wgsl: `
      let lightDir = normalize(vec3<f32>(lx, ly, lz));
      let normal = normalize(v_worldNormal);
      let diff = max(0.0, dot(normal, lightDir));
      let lighting = ambient + (1.0 - ambient) * diff;
      return vec4<f32>(_c0.rgb * lighting, _c0.a);`
  },
  {
    name: 'specular',
    type: 'color',
    inputs: [
      { type: 'float', name: 'lx', default: 0 },
      { type: 'float', name: 'ly', default: 1 },
      { type: 'float', name: 'lz', default: 0 },
      { type: 'float', name: 'shininess', default: 32 },
      { type: 'float', name: 'intensity', default: 1 }
    ],
    glsl: `
      vec3 lightDir = normalize(vec3(lx, ly, lz));
      vec3 normal = normalize(v_worldNormal);
      vec3 viewDir = normalize(v_viewDir);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(0.0, dot(normal, halfDir)), shininess) * intensity;
      return vec4(_c0.rgb + spec, _c0.a);`,
    wgsl: `
      let lightDir = normalize(vec3<f32>(lx, ly, lz));
      let normal = normalize(v_worldNormal);
      let viewDir = normalize(v_viewDir);
      let halfDir = normalize(lightDir + viewDir);
      let spec = pow(max(0.0, dot(normal, halfDir)), shininess) * intensity;
      return vec4<f32>(_c0.rgb + spec, _c0.a);`
  },
  {
    name: 'fresnel',
    type: 'color',
    inputs: [
      { type: 'float', name: 'power', default: 2 },
      { type: 'float', name: 'intensity', default: 1 }
    ],
    glsl: `
      vec3 normal = normalize(v_worldNormal);
      vec3 viewDir = normalize(v_viewDir);
      float f = pow(1.0 - abs(dot(normal, viewDir)), power) * intensity;
      return vec4(_c0.rgb + f, _c0.a);`,
    wgsl: `
      let normal = normalize(v_worldNormal);
      let viewDir = normalize(v_viewDir);
      let f = pow(1.0 - abs(dot(normal, viewDir)), power) * intensity;
      return vec4<f32>(_c0.rgb + f, _c0.a);`
  },
  {
    name: 'halfLambert',
    type: 'color',
    inputs: [
      { type: 'float', name: 'lx', default: 0 },
      { type: 'float', name: 'ly', default: 1 },
      { type: 'float', name: 'lz', default: 0 }
    ],
    glsl: `
      vec3 lightDir = normalize(vec3(lx, ly, lz));
      vec3 normal = normalize(v_worldNormal);
      float diff = dot(normal, lightDir) * 0.5 + 0.5;
      return vec4(_c0.rgb * diff, _c0.a);`,
    wgsl: `
      let lightDir = normalize(vec3<f32>(lx, ly, lz));
      let normal = normalize(v_worldNormal);
      let diff = dot(normal, lightDir) * 0.5 + 0.5;
      return vec4<f32>(_c0.rgb * diff, _c0.a);`
  }
]
