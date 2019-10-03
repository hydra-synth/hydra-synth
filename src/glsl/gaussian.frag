precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D prevBuffer;
//varying vec2 uv;

#pragma glslify: blur = require('glsl-fast-gaussian-blur')

uniform float directionX;
uniform float directionY;


void main () {
  vec2 st = gl_FragCoord.xy/resolution;
  gl_FragColor = blur(prevBuffer, st, resolution, vec2(directionX, directionY));
}
