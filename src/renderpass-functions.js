// to add: ripple: https://www.shadertoy.com/view/4djGzz
// mask
// convolution
// basic sdf shapes
// repeat
// iq color palletes

module.exports = {
  _convolution: {
    type: 'renderpass_util',
    glsl: `
      float kernel [9];

      vec4 _convolution (vec2 uv, float[9] _kernel, float kernelWeight) {
        vec2 st = uv/resolution.xy;
        vec2 onePixel = vec2(4.0, 4.0) / resolution.xy;
        //  vec2 onePixel = vec2(1.0, 1.0);
        vec4 colorSum =
          texture2D(prevBuffer, st + onePixel * vec2(-1, -1)) * _kernel[0] +
          texture2D(prevBuffer, st + onePixel * vec2( 0, -1)) * _kernel[1] +
          texture2D(prevBuffer, st + onePixel * vec2( 1, -1)) * _kernel[2] +
          texture2D(prevBuffer, st + onePixel * vec2(-1,  0)) * _kernel[3] +
          texture2D(prevBuffer, st + onePixel * vec2( 0,  0)) * _kernel[4] +
          texture2D(prevBuffer, st + onePixel * vec2( 1,  0)) * _kernel[5] +
          texture2D(prevBuffer, st + onePixel * vec2(-1,  1)) * _kernel[6] +
          texture2D(prevBuffer, st + onePixel * vec2( 0,  1)) * _kernel[7] +
          texture2D(prevBuffer, st + onePixel * vec2( 1,  1)) * _kernel[8] ;
        colorSum /= kernelWeight;
        return colorSum;
      }
    `
  },
  rgbShift: {
    type: 'renderpass',
    glsl: `

    void main() {
      vec2 p = st;
      vec4 shift = vec4(-0.01, 0.02, 0.03, -0.04);
      vec2 rs = vec2(shift.x,-shift.y);
      vec2 gs = vec2(shift.y,-shift.z);
      vec2 bs = vec2(shift.z,-shift.x);

      float r = texture2D(prevBuffer, p+rs, 0.0).x;
      float g = texture2D(prevBuffer, p+gs, 0.0).y;
      float b = texture2D(prevBuffer, p+bs, 0.0).z;
    }
    `
  },
  edges: {
    type: 'renderpass',
    glsl: `
      void main () {
    //    kernel[0] = -0.125; kernel[1] = -0.125; kernel[2] = -0.125;
      //  kernel[3] = -0.125; kernel[4] = 1.0; kernel[5] = -0.125;
      //  kernel[6] = -0.125; kernel[7] = -0.125; kernel[8] = -0.125;

// blur
     kernel[0] = 0.0; kernel[1] = 1.0; kernel[2] = 0.0;
     kernel[3] = 1.0; kernel[4] = 1.0; kernel[5] = 1.0;
     kernel[6] = 0.0; kernel[7] = 1.0; kernel[8] = 0.0;

      kernel[0] = 5.0; kernel[1] = -0.0; kernel[2] = -0.0;
      kernel[3] = 0.0; kernel[4] = 0.0; kernel[5] = 0.0;
      kernel[6] = -0.0; kernel[7] = -0.0; kernel[8] = -5.0;

        vec4 sum = _convolution( gl_FragCoord.xy, kernel, 10.0);
        gl_FragColor = clamp(sum , vec4(0.0), vec4(1.0));
    //   vec2 st = gl_FragCoord.xy/resolution.xy;
    //    vec4 col = texture2D(prevBuffer, fract(st));
    //  gl_FragColor = vec4(st, 1.0, 1.0);
      }
    `
  }
}
