// to add: ripple: https://www.shadertoy.com/view/4djGzz
// mask
// convolution
// basic sdf shapes
// repeat
// iq color palletes
var glsl = require('glslify')

module.exports = {
  sharpen: {
    type: 'renderpass',
    inputs: [
      {
        type: 'float',
        name: 'amountX',
        default: 1.0
      },
      {
        type: 'float',
        name: 'amountY',
        default: 1.0
      },
      {
        type: 'float',
        name: 'mixWithOriginal',
        default: 0.5
      }
    ],
    frag: glsl('./shaders/sharpen.frag')
  },
  edges: {
    type: 'renderpass',
    inputs: [
      {
        type: 'float',
        name: 'uWeakThreshold',
        default: 0.4
      },{
        type: 'float',
        name: 'uStrongThreshold',
        default: 0.6
      }
    ],
    frag: glsl('./shaders/edges.frag')
  },
  blur: {
    type: 'renderpass',
    inputs: [
      {
        type: 'float',
        name: 'directionX',
        default: 1.0
      },{
        type: 'float',
        name: 'directionY',
        default: 0.0
      }
    ],
    frag: glsl('./shaders/gaussian.frag')
  },
  halftone: {
    type: 'renderpass',
    inputs: [
      {
        type: 'float',
        name: 'frequency',
        default: 30.0
      }
    ],
    frag: glsl('./shaders/halftone.frag')
  },
  dither: {
    type: 'renderpass',
    inputs: [],
    frag: glsl('./shaders/dither.frag')
  }
}
