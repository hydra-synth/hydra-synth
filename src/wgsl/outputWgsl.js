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
    const { passes, vertexData, blendMode = 'normal', primitive = 'triangles' } = config
    const pass = passes[0]

    // Extract raw vertices and check for VertexSource
    let rawVerts = null
    let vertexSource = null

    if (vertexData instanceof VertexSource) {
      vertexSource = vertexData
      rawVerts = vertexData.vertices
    } else if (vertexData && Array.isArray(vertexData)) {
      rawVerts = vertexData
    }

    // Determine vertex shader and uniforms
    let vertexWgsl = null
    let vertexUniforms = []
    const hasChainedTransforms = vertexSource && vertexSource.hasTransforms

    if (rawVerts) {
      if (hasChainedTransforms) {
        const generated = generateVertexWgsl(vertexSource)
        vertexWgsl = generated.wgsl
        vertexUniforms = generated.uniforms
      } else {
        vertexWgsl = getPassthroughVertexWgsl()
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
      hasCustomGeometry: rawVerts !== null
    })

    // Setup the pipeline in wgslHydra
    await this.wgslHydra.setupSpriteChain(this.chanNum, spriteLevel, {
      uniforms: pass.uniforms,
      fragShader: pass.frag,
      vertexWgsl,
      vertexUniforms,
      rawVerts,
      blendMode,
      primitive
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
