import VertexSource, { generateVertexWgsl, getPassthroughVertexWgsl } from '../vertex-source.js'

// Blend mode configurations for WebGPU
const BLEND_MODES = {
  normal: {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add'
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add'
    }
  },
  add: {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one',
      operation: 'add'
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one',
      operation: 'add'
    }
  },
  multiply: {
    color: {
      srcFactor: 'dst',
      dstFactor: 'zero',
      operation: 'add'
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one',
      operation: 'add'
    }
  },
  screen: {
    color: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src',
      operation: 'add'
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one',
      operation: 'add'
    }
  }
}

class OutputWgsl {
  constructor ({wgslHydra, hydraSynth, chanNum, label = "", width, height}) {
    this.wgslHydra = wgslHydra
    this.hydraSynth = hydraSynth
    this.chanNum = chanNum
    this.label = label
    this.precision = 'mediump' // For compatibility with glsl-source.js
    this.draw = () => {}

    // Sprite registry: Map<spriteLevel, SpriteConfig>
    this.sprites = new Map()

    this.init()
  }

  resize(width, height) {
    // Handled by wgslHydra.resizeOutputsTo
  }

  getCurrent() {
    let tex = this.getCurrentTextureView()
    return tex
  }

  getTexture() {
    let tex = this.getOppositeTextureView()
    return tex
  }

  init() {
    this.pingPongs = 0
    return this
  }

  // Register a sprite at a given level (parallel to WebGL Output.registerSprite)
  async registerSprite(spriteLevel, config) {
    const { passes, vertexData, blendMode = 'normal', primitive = 'triangles', sprite = null } = config
    const pass = passes[0]

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

    // Check for explicit UVs, faceIds, normals, and tangents
    let hasExplicitUVs = false
    let hasFaceIds = false
    let hasNormals = false
    let hasTangents = false
    if (vertexSource) {
      hasExplicitUVs = vertexSource.uvs && vertexSource.uvs.length > 0
      hasFaceIds = vertexSource.faceIds && vertexSource.faceIds.length > 0
      hasNormals = vertexSource.normals && vertexSource.normals.length > 0
      hasTangents = vertexSource.tangents && vertexSource.tangents.length > 0
    }

    // Compute bounds for UV normalization
    let bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 }
    if (rawVerts && rawVerts.length >= 6 && !hasExplicitUVs) {
      bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      // rawVerts is flat array [x,y, x,y, ...] or [x,y,z, ...]
      const stride = has3D ? 3 : 2
      for (let i = 0; i < rawVerts.length; i += stride) {
        bounds.minX = Math.min(bounds.minX, rawVerts[i])
        bounds.maxX = Math.max(bounds.maxX, rawVerts[i])
        bounds.minY = Math.min(bounds.minY, rawVerts[i + 1])
        bounds.maxY = Math.max(bounds.maxY, rawVerts[i + 1])
      }
    }

    // Determine vertex shader and uniforms
    let vertexWgsl = null
    let vertexUniforms = []
    const hasChainedTransforms = vertexSource && vertexSource.hasTransforms

    if (rawVerts) {
      // Add bounds uniforms for UV normalization
      const boundsUniforms = [
        { name: 'u_boundsMin', type: 'vec2f', value: [bounds.minX, bounds.minY] },
        { name: 'u_boundsMax', type: 'vec2f', value: [bounds.maxX, bounds.maxY] }
      ]

      if (hasChainedTransforms) {
        const generated = generateVertexWgsl(vertexSource, { useExplicitUVs: hasExplicitUVs, useFaceIds: hasFaceIds, useNormals: hasNormals, useTangents: hasTangents })
        vertexWgsl = generated.wgsl
        vertexUniforms = [...boundsUniforms, ...generated.uniforms]
      } else {
        vertexWgsl = getPassthroughVertexWgsl()
        vertexUniforms = boundsUniforms
      }
    }

    // Store sprite config
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
    })

    // Setup the pipeline in wgslHydra
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
      uvs: vertexSource?.uvs,
      faceIds: vertexSource?.faceIds,
      normals: vertexSource?.normals,
      tangents: vertexSource?.tangents,
      sprite
    })
  }

  // Legacy render method - registers at sprite level 0
  async render(passes) {
    // Clear existing sprites and register at level 0
    this.clearSprites()
    await this.registerSprite(0, { passes, vertexData: null, blendMode: 'normal' })
  }

  // Clear all sprites
  clearSprites() {
    this.sprites.clear()
    if (this.wgslHydra.clearSpriteChains) {
      this.wgslHydra.clearSpriteChains(this.chanNum)
    }
  }

  tick(props) {
    // Rendering handled by wgslHydra.animate
  }

  flipPingPong() {
    let x = this.pingPongs === 0 ? 1 : 0
    this.pingPongs = x
  }

  // This is called during setup and whenever canvas size changes
  createTexturesAndViews(device, destTextureDescriptor) {
    this.textures = new Array(2)
    this.views = new Array(2)
    for (let i = 0; i < 2; ++i) {
      this.textures[i] = device.createTexture(destTextureDescriptor)
      this.views[i] = this.textures[i].createView()
    }
  }

  getCurrentTextureView() {
    let p = this.pingPongs
    return this.views[p]
  }

  getCurrentTexture() {
    let p = this.pingPongs
    return this.textures[p]
  }

  getOppositeTextureView() {
    let p = this.pingPongs
    let x = p === 0 ? 1 : 0
    return this.views[x]
  }
}

export { OutputWgsl, BLEND_MODES }
