precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D prevBuffer;
//varying vec2 uv;

#pragma glslify: dither = require(glsl-dither/2x2)


void main () {
  vec2 st = gl_FragCoord.xy/resolution;
  vec4 color = texture2D(prevBuffer, st);
  gl_FragColor = dither(gl_FragCoord.xy, color);
}
