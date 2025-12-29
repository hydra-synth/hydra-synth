/**
 * WebGL1 Renderer Implementation
 *
 * Wraps existing regl-based rendering code to implement the RendererInterface.
 * This is the default renderer for hydra-synth.
 */

import { RendererInterface } from './RendererInterface.js'
import Output from '../output.js'
import Source from '../hydra-source.js'
import regl from 'regl'
import utilityGlsl from '../glsl/utility-functions.js'

export class WebGL1Renderer extends RendererInterface {

  constructor() {
    super()
    this._canvas = null
    this._regl = null
    this._width = 0
    this._height = 0
    this._precision = 'mediump'
    this._outputs = []
    this._sources = []

    // Compiled regl commands for screen rendering
    this._renderFboCommand = null
    this._renderAllCommand = null
  }

  init(canvas, options = {}) {
    const {
      precision = 'mediump',
      width = canvas.width || 1280,
      height = canvas.height || 720,
      pb = null
    } = options

    this._canvas = canvas
    this._width = width
    this._height = height
    this._precision = precision
    this._pb = pb

    // Initialize regl context
    this._regl = regl({
      canvas: this._canvas,
      pixelRatio: 1
    })

    // Clear to black
    this._regl.clear({
      color: [0, 0, 0, 1]
    })

    // Create the renderFbo command (single output to screen)
    this._renderFboCommand = this._regl({
      frag: `
      precision ${this._precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this._precision} float;
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
        tex0: this._regl.prop('tex0'),
        resolution: this._regl.prop('resolution')
      },
      count: 3,
      depth: { enable: false }
    })

    // Create the renderAll command (4-up grid)
    this._renderAllCommand = this._regl({
      frag: `
      precision ${this._precision} float;
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
      precision ${this._precision} float;
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
        tex0: this._regl.prop('tex0'),
        tex1: this._regl.prop('tex1'),
        tex2: this._regl.prop('tex2'),
        tex3: this._regl.prop('tex3')
      },
      count: 3,
      depth: { enable: false }
    })
  }

  destroy() {
    if (this._regl) {
      this._regl.destroy()
      this._regl = null
    }
    this._outputs = []
    this._sources = []
  }

  resize(width, height) {
    this._width = width
    this._height = height
    this._canvas.width = width
    this._canvas.height = height

    // Resize all outputs
    this._outputs.forEach(output => {
      output.resize(width, height)
    })

    // Resize all sources
    this._sources.forEach(source => {
      source.resize(width, height)
    })

    // Refresh regl state
    this._regl._refresh()
  }

  // ============================================================
  // Output Management
  // ============================================================

  createOutput(index, options = {}) {
    const output = new Output({
      regl: this._regl,
      width: options.width || this._width,
      height: options.height || this._height,
      precision: this._precision,
      label: options.label || `o${index}`
    })
    output.id = index
    this._outputs[index] = output
    return output
  }

  getOutput(index) {
    return this._outputs[index]
  }

  // ============================================================
  // Source Management
  // ============================================================

  createSource(index, options = {}) {
    const source = new Source({
      regl: this._regl,
      pb: this._pb,
      width: options.width || this._width,
      height: options.height || this._height,
      label: options.label || `s${index}`
    })
    this._sources[index] = source
    return source
  }

  // ============================================================
  // Rendering
  // ============================================================

  renderPass(output, pass) {
    // This delegates to Output.render() which sets up the draw command
    output.render([pass])
  }

  tickOutput(output, props) {
    output.tick(props)
  }

  renderToScreen(output) {
    this._renderFboCommand({
      tex0: output.getCurrent(),
      resolution: [this._width, this._height]
    })
  }

  renderAllToScreen(outputs) {
    this._renderAllCommand({
      tex0: outputs[0].getCurrent(),
      tex1: outputs[1].getCurrent(),
      tex2: outputs[2].getCurrent(),
      tex3: outputs[3].getCurrent(),
      resolution: [this._width, this._height]
    })
  }

  // ============================================================
  // Capabilities & Info
  // ============================================================

  get capabilities() {
    const gl = this._regl._gl
    return {
      name: 'webgl1',
      glslVersion: '100',
      instancing: !!gl.getExtension('ANGLE_instanced_arrays'),
      floatTextures: !!gl.getExtension('OES_texture_float'),
      halfFloatTextures: !!gl.getExtension('OES_texture_half_float'),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
    }
  }

  get canvas() {
    return this._canvas
  }

  get width() {
    return this._width
  }

  get height() {
    return this._height
  }

  // ============================================================
  // Additional accessors for compatibility
  // ============================================================

  get regl() {
    return this._regl
  }

  get precision() {
    return this._precision
  }

  get outputs() {
    return this._outputs
  }

  get sources() {
    return this._sources
  }

  // ============================================================
  // Shader Generation Hooks
  // ============================================================

  get shaderLanguage() {
    return 'glsl'
  }

  getUtilityFunctions() {
    return utilityGlsl
  }

  buildShader(shaderInfo, options = {}) {
    const precision = options.precision || this._precision

    return `
  precision ${precision} float;
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
  uniform sampler2D prevBuffer;

  ${Object.values(utilityGlsl).map((transform) => {
    return `
            ${transform.glsl}
          `
  }).join('')}

  ${shaderInfo.glslFunctions.map((transform) => {
    const shaderCode = transform.transform[this.shaderLanguage] || transform.transform.glsl
    return `
            ${shaderCode}
          `
  }).join('')}

  void main () {
    vec2 st = gl_FragCoord.xy/resolution.xy;

    ${shaderInfo.fragColor}
    gl_FragColor = c;
  }
  `
  }
}

export default WebGL1Renderer
