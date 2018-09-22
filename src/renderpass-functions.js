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
        name: 'amount',
        default: 1.0
      }
    ],
    frag: glsl('./shaders/sharpen.frag')
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
