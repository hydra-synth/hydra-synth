import VertexSource, { generateVertexGlsl } from './vertex-source.js'
import { computeSkinningMatrices, applySkinning } from './lib/geometry.js'

// Blend mode configurations for regl
const BLEND_MODES = {
  normal: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one minus src alpha',
      dstAlpha: 'one minus src alpha'
    }
  },
  add: {
    enable: true,
    func: {
      srcRGB: 'src alpha',
      srcAlpha: 1,
      dstRGB: 'one',
      dstAlpha: 'one'
    }
  },
  multiply: {
    enable: true,
    func: {
      srcRGB: 'dst color',
      srcAlpha: 1,
      dstRGB: 'zero',
      dstAlpha: 'one'
    }
  },
  screen: {
    enable: true,
    func: {
      srcRGB: 'one',
      srcAlpha: 1,
      dstRGB: 'one minus src color',
      dstAlpha: 'one'
    }
  }
}

var Output = function ({ regl, precision, label = "", chanNum, hydraSynth, width, height}) {
  this.regl = regl
  this.precision = precision
  this.label = label
  this.chanNum = chanNum
  this.hydraSynth = hydraSynth

  // Default fullscreen triangle (covers clip space with overdraw)
  // Using vec3 for forward compatibility with 3D (z=0 for 2D)
  this.defaultPositionBuffer = this.regl.buffer([
    [-2, 0, 0],
    [0, -2, 0],
    [2, 2, 0]
  ])
  // Keep for backwards compatibility
  this.positionBuffer = this.defaultPositionBuffer

  // Sprite registry: Map<spriteLevel, SpriteConfig>
  this.sprites = new Map()

  this.draw = () => {}
  this.init()
  this.pingPongIndex = 0

  // for each output, create two fbos for pingponging
  // Depth buffer added lazily when 3D geometry is first used
  this.hasDepthBuffer = false
  this.fbos = (Array(2)).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: 'nearest',
      width: width,
      height: height,
      format: 'rgba'
    }),
    depthStencil: false
  }))

  // array containing render passes
//  this.passes = []
}

Output.prototype.resize = function(width, height) {
  this.fbos.forEach((fbo) => {
    fbo.resize(width, height)
  })
//  console.log(this)
}

// Lazily enable depth buffer for 3D rendering
// Called automatically when 3D geometry is first registered
Output.prototype.enableDepthBuffer = function() {
  if (this.hasDepthBuffer) return  // Already enabled

  // Get current dimensions from existing fbo
  const width = this.fbos[0].width
  const height = this.fbos[0].height

  // Destroy old framebuffers
  this.fbos.forEach(fbo => fbo.destroy())

  // Create new framebuffers with depth
  this.fbos = (Array(2)).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: 'nearest',
      width: width,
      height: height,
      format: 'rgba'
    }),
    depth: true
  }))

  this.hasDepthBuffer = true
}

Output.prototype.getCurrent = function () {
  return this.fbos[this.pingPongIndex]
}

Output.prototype.getTexture = function () {
   var index = this.pingPongIndex ? 0 : 1
  return this.fbos[index]
}

Output.prototype.init = function () {
//  console.log('clearing')
  this.transformIndex = 0
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `

  this.fragBody = ``

  // Vertex shader uses vec3 for forward compatibility with 3D
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
  }`

  this.attributes = {
    position: this.positionBuffer
  }
  this.uniforms = {
    time: this.regl.prop('time'),
    resolution: this.regl.prop('resolution')
  }

  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `

  // Create copy command for persistence (no level 0 = keep previous frame)
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
      source: this.regl.prop('source')
    },
    count: 3,
    depth: { enable: false }
  })

  return this
}


// Reshape vertex data to vec3 format for forward compatibility with 3D
// Input: flat array of 2D coords [x,y, x,y, ...] or 3D coords [x,y,z, x,y,z, ...]
// Output: array of [x,y,z] triples
// is3D: explicit flag indicating 3D data (required for ambiguous lengths like 108 which is divisible by both 2 and 3)
function reshapeToVec3(flatArray, is3D = false) {
  const len = flatArray.length
  const stride = is3D ? 3 : 2

  const verts = []
  for (let i = 0; i < len; i += stride) {
    if (is3D) {
      verts.push([flatArray[i], flatArray[i + 1], flatArray[i + 2]])
    } else {
      // 2D input: add z=0
      verts.push([flatArray[i], flatArray[i + 1], 0.0])
    }
  }
  return verts
}

// Helper to normalize vertex option values (handles scalars, arrays, and lambdas)
function normalizeVertexOption(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue
  return value
}

// Register a sprite at a given level
// spriteLevel 0 clears the buffer before drawing
// spriteLevel 1+ composites over previous content
Output.prototype.registerSprite = function (spriteLevel, config) {
  const { passes, vertexData, blendMode = 'normal', vertexOptions = null, primitive = 'triangles', sprite = null } = config
  const pass = passes[0]
  const self = this

  // Extract raw vertices and check for VertexSource
  let rawVerts = null
  let vertexSource = null
  let has3D = false

  if (vertexData instanceof VertexSource) {
    vertexSource = vertexData
    rawVerts = vertexData.vertices
    has3D = vertexData.is3D || false
  } else if (vertexData && Array.isArray(vertexData)) {
    rawVerts = vertexData
  }

  // Enable depth buffer lazily for 3D geometry
  if (has3D) {
    this.enableDepthBuffer()
  }

  // Create vertex buffer for this sprite
  let positionBuffer, uvBuffer, faceIdBuffer, normalBuffer, tangentBuffer, colorBuffer, vertexCount
  let bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 }  // default fullscreen bounds
  let hasExplicitUVs = false
  let hasFaceIds = false
  let hasNormals = false
  let hasTangents = false
  let hasColors = false

  if (rawVerts && rawVerts.length >= 6) {
    // Custom geometry: reshape to vec3 for 3D forward-compatibility
    const verts = reshapeToVec3(rawVerts, has3D)
    positionBuffer = this.regl.buffer(verts)
    vertexCount = verts.length

    // Check for explicit UVs from VertexSource (e.g., cube)
    if (vertexSource && vertexSource.uvs && vertexSource.uvs.length > 0) {
      hasExplicitUVs = true
      // Reshape UVs to vec2 array
      const uvData = []
      for (let i = 0; i < vertexSource.uvs.length; i += 2) {
        uvData.push([vertexSource.uvs[i], vertexSource.uvs[i + 1]])
      }
      uvBuffer = this.regl.buffer(uvData)
    } else {
      // Compute bounds for UV normalization
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      for (const v of verts) {
        bounds.minX = Math.min(bounds.minX, v[0])
        bounds.maxX = Math.max(bounds.maxX, v[0])
        bounds.minY = Math.min(bounds.minY, v[1])
        bounds.maxY = Math.max(bounds.maxY, v[1])
      }
    }

    // Check for face IDs from VertexSource (e.g., cube for per-face materials)
    if (vertexSource && vertexSource.faceIds && vertexSource.faceIds.length > 0) {
      hasFaceIds = true
      // Wrap each faceId in array for explicit per-vertex scalar format
      // This matches how position [[x,y,z],...] and texcoord [[u,v],...] are structured
      faceIdBuffer = this.regl.buffer(vertexSource.faceIds.map(id => [id]))
    }

    // Check for normals from VertexSource (e.g., from GLB/OBJ models)
    if (vertexSource && vertexSource.normals && vertexSource.normals.length > 0) {
      hasNormals = true
      // Reshape normals to vec3 array
      const normalData = []
      for (let i = 0; i < vertexSource.normals.length; i += 3) {
        normalData.push([vertexSource.normals[i], vertexSource.normals[i + 1], vertexSource.normals[i + 2]])
      }
      normalBuffer = this.regl.buffer(normalData)
    }

    // Check for tangents from VertexSource (vec4: xyz = tangent, w = handedness)
    if (vertexSource && vertexSource.tangents && vertexSource.tangents.length > 0) {
      hasTangents = true
      // Reshape tangents to vec4 array
      const tangentData = []
      for (let i = 0; i < vertexSource.tangents.length; i += 4) {
        tangentData.push([vertexSource.tangents[i], vertexSource.tangents[i + 1], vertexSource.tangents[i + 2], vertexSource.tangents[i + 3]])
      }
      tangentBuffer = this.regl.buffer(tangentData)
    }

    // Check for vertex colors from VertexSource (vec4: RGBA)
    if (vertexSource && vertexSource.colors && vertexSource.colors.length > 0) {
      hasColors = true
      // Reshape colors to vec4 array
      const colorData = []
      for (let i = 0; i < vertexSource.colors.length; i += 4) {
        colorData.push([vertexSource.colors[i], vertexSource.colors[i + 1], vertexSource.colors[i + 2], vertexSource.colors[i + 3]])
      }
      colorBuffer = this.regl.buffer(colorData)
    }
  } else {
    // Default fullscreen triangle
    positionBuffer = this.defaultPositionBuffer
    vertexCount = 3
  }

  // Check if we need vertex transforms (from vertexOptions OR VertexSource chain)
  const hasChainedTransforms = vertexSource && vertexSource.hasTransforms
  const hasVertexOptions = rawVerts && vertexOptions && (
    vertexOptions.scale !== undefined ||
    vertexOptions.offset !== undefined ||
    vertexOptions.rotation !== undefined
  )
  const hasVertexTransforms = hasChainedTransforms || hasVertexOptions

  // Build uniforms with prevBuffer
  const uniforms = Object.assign({}, pass.uniforms, {
    prevBuffer: () => self.fbos[self.pingPongIndex]
  })

  // Add sprite UV uniform (default = full texture)
  if (sprite && sprite.getUVBounds) {
    // Dynamic sprite picker - call getUVBounds each frame
    uniforms.u_spriteUV = () => {
      const bounds = sprite.getUVBounds()
      return [bounds.uMin, bounds.vMin, bounds.uMax, bounds.vMax]
    }
  } else {
    // No sprite picking - use full texture
    uniforms.u_spriteUV = [0, 0, 1, 1]
  }

  // Add sprite grid uniform for faceId-based picking
  // If sprite has grid info, use it; otherwise default to [1, 1] (single cell)
  if (sprite && sprite.cols && sprite.rows) {
    uniforms.u_spriteGrid = [sprite.cols, sprite.rows]
  } else {
    uniforms.u_spriteGrid = [1, 1]
  }

  // Add bounds uniforms for UV normalization (custom geometry only)
  if (rawVerts) {
    uniforms.u_boundsMin = [bounds.minX, bounds.minY]
    uniforms.u_boundsMax = [bounds.maxX, bounds.maxY]
  }

  // Add vertex transform uniforms if needed (Phase 3 style only)
  // Phase 5 chained transforms get uniforms from generateVertexGlsl
  if (hasVertexOptions) {
    // Scale: can be number, [x,y] array, or lambda
    const scaleOpt = normalizeVertexOption(vertexOptions.scale, [1, 1])
    uniforms.u_scale = (context, props) => {
      const val = typeof scaleOpt === 'function' ? scaleOpt() : scaleOpt
      if (typeof val === 'number') return [val, val]
      return val
    }

    // Offset: can be [x,y] array or lambda
    const offsetOpt = normalizeVertexOption(vertexOptions.offset, [0, 0])
    uniforms.u_offset = (context, props) => {
      const val = typeof offsetOpt === 'function' ? offsetOpt() : offsetOpt
      return val
    }

    // Rotation: can be number (radians) or lambda
    const rotationOpt = normalizeVertexOption(vertexOptions.rotation, 0)
    uniforms.u_rotation = (context, props) => {
      const val = typeof rotationOpt === 'function' ? rotationOpt() : rotationOpt
      return val
    }
  }

  // Create vertex shader based on whether we have custom geometry
  let vert
  let vertexUniforms = {}

  if (rawVerts) {
    if (hasChainedTransforms) {
      // Use generateVertexGlsl for chained transforms (Phase 5)
      const generated = generateVertexGlsl(vertexSource, this.precision, { useExplicitUVs: hasExplicitUVs, useFaceIds: hasFaceIds, useNormals: hasNormals, useTangents: hasTangents, useColors: hasColors })
      vert = generated.glsl
      vertexUniforms = generated.uniforms
    } else if (hasVertexOptions) {
      // Custom geometry with vertexOptions (Phase 3 style)
      const uvAttrDecl = hasExplicitUVs ? 'attribute vec2 texcoord;' : ''
      const faceIdAttrDecl = hasFaceIds ? 'attribute float faceId;' : ''
      const uvCode = hasExplicitUVs
        ? 'uv = texcoord;'
        : 'uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);'
      const faceIdCode = hasFaceIds ? 'v_faceId = faceId;' : 'v_faceId = 0.0;'
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
        // UV ${hasExplicitUVs ? 'from explicit attribute' : 'normalized to shape bounds'}
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
      }`
    } else {
      // Custom geometry without transforms: simple passthrough
      const uvAttrDecl = hasExplicitUVs ? 'attribute vec2 texcoord;' : ''
      const faceIdAttrDecl = hasFaceIds ? 'attribute float faceId;' : ''
      const uvCode = hasExplicitUVs
        ? 'uv = texcoord;'
        : 'uv = (position.xy - u_boundsMin) / (u_boundsMax - u_boundsMin);'
      const faceIdCode = hasFaceIds ? 'v_faceId = faceId;' : 'v_faceId = 0.0;'
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
        // UV ${hasExplicitUVs ? 'from explicit attribute' : 'normalized to shape bounds'}
        ${uvCode}
        ${faceIdCode}

        // Default vertex data for 2D geometry
        v_position = vec3(position.xy, 0.0);
        v_normal = vec3(0.0, 0.0, 1.0);
        v_viewDir = vec3(0.0, 0.0, 1.0);
        v_depth = 1.0;

        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`
    }
  } else {
    // Fullscreen: use original vertex shader
    vert = this.vert
  }

  // Merge vertex uniforms with fragment uniforms
  Object.assign(uniforms, vertexUniforms)

  // Build attributes object
  const attributes = {
    position: positionBuffer
  }
  if (hasExplicitUVs && uvBuffer) {
    attributes.texcoord = uvBuffer
  }
  if (hasFaceIds && faceIdBuffer) {
    attributes.faceId = faceIdBuffer
  }
  if (hasNormals && normalBuffer) {
    attributes.normal = normalBuffer
  }
  if (hasTangents && tangentBuffer) {
    attributes.tangent = tangentBuffer
  }
  if (hasColors && colorBuffer) {
    attributes.color = colorBuffer
  }

  // Create the draw command
  const drawCommand = this.regl({
    frag: pass.frag,
    vert: vert,
    attributes: attributes,
    uniforms: uniforms,
    count: vertexCount,
    primitive: primitive,
    blend: BLEND_MODES[blendMode] || BLEND_MODES.normal,
    depth: { enable: has3D, func: 'less' }
  })

  // Store sprite config
  const spriteConfig = {
    drawCommand,
    positionBuffer,
    normalBuffer,
    blendMode,
    has3D
  }

  // Store animation data if present
  if (vertexSource && vertexSource._animTimeFunc) {
    spriteConfig.animation = {
      skeleton: vertexSource._skeleton,
      animations: vertexSource._animations,
      clipName: vertexSource._animClip,
      timeFunc: vertexSource._animTimeFunc,
      originalVerts: vertexSource._originalVerts || vertexSource.vertices,
      originalNormals: vertexSource._originalNormals || vertexSource.normals,
      joints: vertexSource.joints,
      weights: vertexSource.weights,
      gltf: vertexSource._gltf,
      normCenter: vertexSource._normCenter,  // For denormalize/renormalize during skinning
      normScale: vertexSource._normScale,
      is3D: has3D
    }
  }

  this.sprites.set(spriteLevel, spriteConfig)
}

// Clear all sprites (called by hush)
Output.prototype.clearSprites = function () {
  // Clean up any custom position buffers
  for (const [level, sprite] of this.sprites) {
    if (sprite.positionBuffer !== this.defaultPositionBuffer) {
      sprite.positionBuffer.destroy()
    }
  }
  this.sprites.clear()
}

// Legacy render method - registers at sprite level 0
Output.prototype.render = function (passes) {
  // Clear existing sprite at level 0 and register new one
  if (this.sprites.has(0)) {
    const oldSprite = this.sprites.get(0)
    if (oldSprite.positionBuffer !== this.defaultPositionBuffer) {
      oldSprite.positionBuffer.destroy()
    }
  }
  this.registerSprite(0, { passes, vertexData: null, blendMode: 'normal' })

  // For backwards compatibility, also set this.draw
  const self = this
  this.draw = function(props) {
    self._renderSprites(props)
  }
}

// Internal method to render all sprites in order
Output.prototype._renderSprites = function (props) {
  if (this.sprites.size === 0) return

  // Sort sprite levels ascending
  const levels = Array.from(this.sprites.keys()).sort((a, b) => a - b)

  // Swap ping-pong index once at start of frame
  this.pingPongIndex = this.pingPongIndex ? 0 : 1
  const targetFbo = this.fbos[this.pingPongIndex]
  const prevFbo = this.fbos[this.pingPongIndex ? 0 : 1]

  // Check if we have a level 0 (which clears)
  const hasLevel0 = levels.length > 0 && levels[0] === 0

  // Check if any sprite uses 3D (needs depth clearing)
  const needs3D = Array.from(this.sprites.values()).some(s => s.has3D)

  // If no level 0, copy previous frame for persistence/trails
  if (!hasLevel0) {
    // Blit previous buffer to target (preserves content)
    this.regl.clear({
      color: [0, 0, 0, 0],
      depth: needs3D ? 1 : undefined,
      framebuffer: targetFbo
    })
    // Draw previous frame content to target
    if (this.copyCommand) {
      targetFbo.use(() => {
        this.copyCommand({ source: prevFbo })
      })
    }
  }

  // Render each sprite level
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]
    const sprite = this.sprites.get(level)

    // Level 0 clears the framebuffer (and depth if 3D)
    if (level === 0) {
      this.regl.clear({
        color: [0, 0, 0, 1],
        depth: needs3D ? 1 : undefined,
        framebuffer: targetFbo
      })
    }

    // Update animation buffers if this sprite is animated
    if (sprite.animation) {
      const anim = sprite.animation
      const time = typeof anim.timeFunc === 'function' ? anim.timeFunc() : 0

      // Support dynamic clip name (function or string)
      const clipName = typeof anim.clipName === 'function' ? anim.clipName() : anim.clipName

      // Find clip and compute looped time (don't loop here - let timeFunc handle it for dynamic clips)
      const clip = anim.animations.find(a => a.name === clipName) || anim.animations[0]
      const loopedTime = clip ? (time % clip.duration) : time

      // Compute skinning matrices (pre-transformed for normalized coordinate space)
      const skinningMatrices = computeSkinningMatrices(
        anim.skeleton, anim.animations, clipName, loopedTime, anim.gltf,
        anim.normCenter, anim.normScale
      )

      if (skinningMatrices) {
        // Apply skinning to vertices
        const skinned = applySkinning(
          anim.originalVerts, anim.originalNormals,
          anim.joints, anim.weights, skinningMatrices
        )

        // Update position buffer with skinned vertices
        const skinnedVec3 = []
        for (let j = 0; j < skinned.vertices.length; j += 3) {
          skinnedVec3.push([skinned.vertices[j], skinned.vertices[j + 1], skinned.vertices[j + 2]])
        }
        sprite.positionBuffer(skinnedVec3)

        // Update normal buffer if present
        if (sprite.normalBuffer && skinned.normals) {
          const skinnedNormals = []
          for (let j = 0; j < skinned.normals.length; j += 3) {
            skinnedNormals.push([skinned.normals[j], skinned.normals[j + 1], skinned.normals[j + 2]])
          }
          sprite.normalBuffer(skinnedNormals)
        }
      }
    }

    // Draw to framebuffer
    targetFbo.use(() => {
      sprite.drawCommand(props)
    })
  }
}

Output.prototype.tick = function (props) {
  this._renderSprites(props)
}

export default Output
