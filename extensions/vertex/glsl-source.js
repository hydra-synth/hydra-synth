import generateGlsl from './generate-glsl.js'
import utilityGlsl from './utility-functions.js'
// Import WGSL utilities from extension's wgsl folder
import utilityWgsl from './wgsl/utility-functions-wgsl.js'

// WGSL type mappings
const wgslTypeLookup = {
  'src': { returnType: 'vec4<f32>', args: [{ type: 'vec2<f32>', name: '_st' }] },
  'coord': { returnType: 'vec2<f32>', args: [{ type: 'vec2<f32>', name: '_st' }] },
  'color': { returnType: 'vec4<f32>', args: [{ type: 'vec4<f32>', name: '_c0' }] },
  'combine': { returnType: 'vec4<f32>', args: [{ type: 'vec4<f32>', name: '_c0' }, { type: 'vec4<f32>', name: '_c1' }] },
  'combineCoord': { returnType: 'vec2<f32>', args: [{ type: 'vec2<f32>', name: '_st' }, { type: 'vec4<f32>', name: '_c0' }] }
}

// Convert GLSL type to WGSL type
function toWgslType(glslType) {
  const typeMap = {
    'float': 'f32',
    'vec2': 'vec2<f32>',
    'vec3': 'vec3<f32>',
    'vec4': 'vec4<f32>',
    'sampler2D': 'texture_2d<f32>'
  }
  return typeMap[glslType] || glslType
}

// Wrap raw WGSL body in a function definition (like processGlsl does for GLSL)
function wrapWgslFunction(transform) {
  const t = wgslTypeLookup[transform.transform.type]
  if (!t) return transform.transform.wgsl || ''

  // Get inputs from the original transform definition
  // Note: processGlsl mutates obj.inputs to include base args (e.g., _c1 for combine types)
  // We filter those out since they're already in t.args
  const originalInputs = transform.transform.inputs || []
  const baseArgNames = new Set(t.args.map(a => a.name))
  const userInputs = originalInputs.filter(inp => !baseArgNames.has(inp.name))
  const allArgs = [...t.args, ...userInputs.map(inp => ({
    type: toWgslType(inp.type),
    name: inp.name
  }))]

  const args = allArgs.map(arg => `${arg.name}: ${arg.type}`).join(', ')
  const body = transform.transform.wgsl || ''

  return `
fn ${transform.name}(${args}) -> ${t.returnType} {
    ${body}
}
`
}

var GlslSource = function (obj) {
  this.transforms = []
  this.transforms.push(obj)
  this.defaultOutput = obj.defaultOutput
  this.synth = obj.synth
  this.type = 'GlslSource'
  this.defaultUniforms = obj.defaultUniforms
  this.isWGSL = obj.synth.isWGSL  // Track WGSL mode
  return this
}

GlslSource.prototype.addTransform = function (obj)  {
    this.transforms.push(obj)
}

// Extended out() signature with config object:
// out(output?, geometry?, config?)
//
// New API (config object):
//   osc(10).out(o0, tri(0.3), { level: 1, blend: 'add', primitive: 'triangles' })
//   osc(10).out(o0, tri(0.3))           // geometry with defaults
//   osc(10).out(o0)                      // fullscreen
//   osc(10).out()                        // fullscreen to default output
//
// Config options:
//   level: Integer for painter's algorithm (0 clears, 1+ composites) - default: 0
//   blend: 'normal', 'add', 'multiply', 'screen' - default: 'normal'
//   primitive: 'triangles', 'triangle strip', 'lines', etc. - default: 'triangles'
//
// Legacy positional API (still supported):
//   osc(10).out(o0, vertices, 1, 'add')
//
function isGeometry(arg) {
  if (!arg) return false
  if (Array.isArray(arg)) return true
  if (arg.vertices) return true  // VertexSource
  return false
}

function isConfig(arg) {
  if (!arg) return false
  if (typeof arg !== 'object') return false
  if (Array.isArray(arg)) return false
  if (arg.vertices) return false  // VertexSource
  // Check for config keys
  return 'level' in arg || 'blend' in arg || 'primitive' in arg || 'sprite' in arg || 'enabled' in arg
}

function isOutput(arg) {
  // Check if arg looks like an output object
  return arg && typeof arg === 'object' && 'registerSprite' in arg
}

GlslSource.prototype.out = function (arg1, arg2, arg3, arg4) {
  let output, geometry, config

  // Parse arguments flexibly
  if (isGeometry(arg1)) {
    // out(geometry, config?) - no output specified
    output = this.defaultOutput
    geometry = arg1
    config = isConfig(arg2) ? arg2 : {}
    // Legacy: out(geometry, level, blend)
    if (typeof arg2 === 'number') {
      config = { level: arg2, blend: arg3 || 'normal' }
    }
  } else if (isOutput(arg1) || arg1 === undefined || arg1 === null) {
    // out(output?, geometry?, config?)
    output = arg1 || this.defaultOutput

    if (isGeometry(arg2)) {
      geometry = arg2
      config = isConfig(arg3) ? arg3 : {}
      // Legacy: out(output, geometry, level, blend)
      if (typeof arg3 === 'number') {
        config = { level: arg3, blend: arg4 || 'normal' }
      }
    } else if (isConfig(arg2)) {
      // out(output, config) - fullscreen with config
      geometry = null
      config = arg2
    } else if (arg2 === null && isConfig(arg3)) {
      // out(output, null, config) - explicit null geometry with config
      geometry = null
      config = arg3
    } else {
      // out(output) or out() - fullscreen
      geometry = null
      config = {}
    }
  } else {
    // Fallback: treat arg1 as output
    output = arg1 || this.defaultOutput
    geometry = null
    config = {}
  }

  // Extract config values with defaults
  const level = config.level !== undefined ? config.level : 0
  const blend = config.blend || 'normal'
  const primitive = config.primitive || 'triangles'
  const sprite = config.sprite || null
  const enabled = config.enabled !== undefined ? config.enabled : true

  if(output) try {
    var glsl = this.glsl(output)
    this.synth.currentFunctions = []

    // Clean up existing sprite at this level if it exists
    if (output.sprites && output.sprites.has(level) && output.defaultPositionBuffer) {
      const oldSprite = output.sprites.get(level)
      if (oldSprite.positionBuffer && oldSprite.positionBuffer !== output.defaultPositionBuffer) {
        oldSprite.positionBuffer.destroy()
      }
    }

    // Register sprite at the specified level
    output.registerSprite(level, {
      passes: glsl,
      vertexData: geometry,
      blendMode: blend,
      primitive: primitive,
      sprite: sprite,
      enabled: enabled
    })
  } catch (error) {
    console.warn('shader could not compile', error)
  }
}

GlslSource.prototype.glsl = function () {
  var self = this
  var passes = []
  var transforms = []

  this.transforms.forEach((transform) => {
    if(transform.transform.type === 'renderpass'){
      console.warn('no support for renderpass')
    } else {
      transforms.push(transform)
    }
  })

  if (transforms.length > 0) passes.push(this.compile(transforms))

  return passes
}

GlslSource.prototype.compile = function (transforms) {
  var shaderInfo = generateGlsl(transforms, this.synth)
  var uniforms = {}
  shaderInfo.uniforms.forEach((uniform) => { uniforms[uniform.name] = uniform.value })

  let frag

  // Check both this.isWGSL and this.synth.isWGSL (for patched vanilla instances)
  const isWGSL = this.isWGSL || (this.synth && this.synth.isWGSL)

  if (isWGSL) {
    // Generate WGSL fragment shader
    // Module-scope private variables for varyings (accessible from all functions)
    frag = `
var<private> v_position: vec3<f32>;
var<private> v_normal: vec3<f32>;
var<private> v_worldNormal: vec3<f32>;
var<private> v_tangent: vec3<f32>;
var<private> v_bitangent: vec3<f32>;
var<private> v_viewDir: vec3<f32>;
var<private> v_depth: f32;
var<private> v_color: vec4<f32>;

${Object.values(utilityWgsl).map((transform) => {
      return `
            ${transform.wgsl}
          `
    }).join('')}

${shaderInfo.glslFunctions.map((transform) => {
      if (isWGSL && transform.transform.strange) return ''
      return wrapWgslFunction(transform)
    }).join('')}

  @fragment
  fn main(ourIn: VertexOutput) -> @location(0) vec4<f32> {
    let c: vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1.0);
    let st: vec2<f32> = ourIn.texcoord;
    // Copy varyings to module-scope private variables
    v_position = ourIn.v_position;
    v_normal = ourIn.v_normal;
    v_worldNormal = ourIn.v_worldNormal;
    v_tangent = ourIn.v_tangent;
    v_bitangent = ourIn.v_bitangent;
    v_viewDir = ourIn.v_viewDir;
    v_depth = ourIn.v_depth;
    v_color = ourIn.v_color;
    return ${shaderInfo.fragColor};
  }
`
  } else {
    // Generate GLSL fragment shader
    frag = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(shaderInfo.uniforms).map((uniform) => {
    let type = uniform.type
    switch (uniform.type) {
      case 'texture':
        type = 'sampler2D'
        break
    }
    return `
      uniform ${type} ${uniform.name};`
  }).join('')}
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
  varying vec4 v_color;

  uniform sampler2D prevBuffer;
  uniform vec4 u_spriteUV;  // x=uMin, y=vMin, z=uMax, w=vMax (fallback when no faceId)
  uniform vec2 u_spriteGrid;  // cols, rows for faceId-based sprite picking

  ${Object.values(utilityGlsl).map((transform) => {
    return `
            ${transform.glsl}
          `
  }).join('')}

  ${shaderInfo.glslFunctions.map((transform) => {
    return `
            ${transform.transform.glsl}
          `
  }).join('')}

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

    vec4 c = ${shaderInfo.fragColor};
    gl_FragColor = c;
  }
  `
  }

  return {
    frag: frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  }
}

export default GlslSource
