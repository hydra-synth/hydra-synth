# Changelog
## [1.1.4] - 2020-04-02

### Added
 - hush() function clears all screens and stops cameras
 - speed variable for controlling time
 
### Changed
 - s0.initScreen() now possible with no extension installed (in chrome)
 - source textures default to one pixel when no source is specified
 - screen share working in FireFox
 - s0.clear() stops webcam and clears texture
 - removed dependency on webrtc-adapter

## [1.1.2] - 2020-04-02
### Changed
 - changed format for defining custom functions

2.0.0

- resize() function
- updates to MakeGlobal
- eval() function on hydra synth
- dynamically add functions
- need to require hydra.synth rather than just base repo
- width and height globally defined
- update function


to do:
- set framerate
- ShaderGenerator [WIP], runs serverside
- check for errors on eval
- add outputs (o0, etc) and sources to shader generator
