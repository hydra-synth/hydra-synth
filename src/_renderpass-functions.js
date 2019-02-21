// to add: ripple: https://www.shadertoy.com/view/4djGzz
// mask
// convolution
// basic sdf shapes
// repeat
// iq color palletes

module.exports = {
  sharpen: {
    type: 'renderpass',
    frag: glslify('./shaders/sharpen.frag')
  }
}
