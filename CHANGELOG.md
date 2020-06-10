# Changelog
## [1.3.0] - 2020-06-10
### Changed
- wrapping for scroll, scrollX, modulateScroll functions

### Added
- initVideo(url)
- initImage(url)

## [1.1.8] - 2020-04-13
### Changed
- updated format for glsl-functions

## [1.1.7] - 2020-04-10
### Added
 - added smooth(), ease(), and fit() to array utils

### Changed
 - changed resize() to setResolution()

### Bugs / to do
 - setResolution() not scaling correctly. check whether textures are being resized

## [1.1.6] - 2020-04-03
### Fixed
 - error in eval-sandbox

## [1.1.5] - 2020-04-03
### Added
 - fps to set target rendering speed `fps=30`, not setting a value or `fps=undefined` will render as fast as possible
 - when canvas is stretched, uses pixelated rendering rather than blurry
 - stats.fps shows current fps (read-only)
 - update function called each time a new frame is rendered. can be used like
 ```
update = (dt) => {
      // something i want to do
}
```

### Fixed
 - invalid function does not crash editor

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
- ShaderGenerator [WIP], runs serverside
- check for errors on eval
- add outputs (o0, etc) and sources to shader generator
