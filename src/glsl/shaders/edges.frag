precision mediump float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D prevBuffer;
//varying vec2 uv;

//#pragma glslify: blur = require('glsl-fast-gaussian-blur')

#pragma glslify: cannyEdgeDetection = require(glsl-canny-edge-detection);

uniform float uWeakThreshold;
uniform float uStrongThreshold;


void main () {
vec2 st = gl_FragCoord.xy/resolution;
  float edge = cannyEdgeDetection(
    prevBuffer, st, resolution, uWeakThreshold, uStrongThreshold);
  gl_FragColor = vec4(vec3(edge), 1.);
}
