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
  }
}
