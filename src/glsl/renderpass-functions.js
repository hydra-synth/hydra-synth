// to add: ripple: https://www.shadertoy.com/view/4djGzz
// mask
// convolution
// basic sdf shapes
// repeat
// iq color palletes
var glsl = require('glslify')

module.exports = {
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
    frag: glsl('./gaussian.frag')
  }
}
