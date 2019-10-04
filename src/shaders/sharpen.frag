precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D prevBuffer;
varying vec2 uv;

uniform float mixWithOriginal;
uniform float amountX;
uniform float amountY;

float kernel [9];

vec4 _convolution (vec2 uv, float[9] _kernel, float kernelWeight, vec2 _scale) {
  vec2 st = uv/resolution;
  vec2 onePixel = (vec2(amountX, amountY) * _scale) / resolution;
  vec4 colorSum =
  //  texture2D(prevBuffer, st + onePixel * vec2(-1, 1)) * _kernel[0] +
    texture2D(prevBuffer, st + onePixel * vec2( 0, 1)) * _kernel[1] +
    //texture2D(prevBuffer, st + onePixel * vec2( 1, 1)) * _kernel[2] +
    texture2D(prevBuffer, st + onePixel * vec2(-1,  0)) * _kernel[3] +
    texture2D(prevBuffer, st + onePixel * vec2( 0,  0)) * _kernel[4] +
    texture2D(prevBuffer, st + onePixel * vec2( 1,  0)) * _kernel[5] +
    //texture2D(prevBuffer, st + onePixel * vec2(-1,  -1)) * _kernel[6] +
    texture2D(prevBuffer, st + onePixel * vec2( 0,  -1)) * _kernel[7];// +
    //texture2D(prevBuffer, st + onePixel * vec2( 1,  -1)) * _kernel[8] ;
  colorSum /= kernelWeight;
  return colorSum;
}


void main () {
  kernel[0] = 0.0; kernel[1] = -1.0; kernel[2] = 0.0;
  kernel[3] = -1.0; kernel[4] = 5.0; kernel[5] = -1.0;
  kernel[6] = 0.0; kernel[7] = -1.0; kernel[8] = 0.0;
  vec4 original = texture2D(prevBuffer,  gl_FragCoord.xy);
  vec4 sum = _convolution( gl_FragCoord.xy, kernel, 1.0, vec2(10.0, 1.0));
  gl_FragColor = mix(vec4(sum.rgb, original.a), original, mixWithOriginal) ;
}
