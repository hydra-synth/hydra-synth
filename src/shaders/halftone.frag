precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D prevBuffer;
//varying vec2 uv;

#pragma glslify: halftone = require('glsl-halftone')

uniform float frequency;


void main () {
  vec2 st = gl_FragCoord.xy/resolution;
  vec4 color = texture2D(prevBuffer, st);

  gl_FragColor.rgb = halftone(color.rgb, st, frequency);
  gl_FragColor.a = color.a;
}
