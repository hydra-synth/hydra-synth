# Changelog
## [1.3.29] - 2023-08-16
### Fixed
- skip accessing parent object, fixing [iframe issue](https://github.com/hydra-synth/hydra-synth/issues/139#issuecomment-1523755523)
- use `globalThis.eval` for vite compatibility

## [1.3.28] - 2023-05-22
### Fixed
- add explicit export of glsl-functions.js in package.json, see [here](https://github.com/hydra-synth/hydra-synth/issues/141)

### Added
- tips in readme for [iOS video autoplay](https://github.com/hydra-synth/hydra-synth/issues/137)

## [1.3.27] - 2023-04-26
### Fixed
- reverted changes from [1.3.25], see [here](https://github.com/hydra-synth/hydra-synth/pull/136#issuecomment-1523606639)

## [1.3.25] - 2023-04-19
### Changed
- Removed global eval() from sandbox

## [1.3.24] - 2022-10-27
### Fixed
- Fixed globally exposed transforms which broke multi hydra

## [1.3.22] - 2022-10-23
### Fixed
- Fixed bundled version that was broken in previous commit

## [1.3.21] - 2022-10-23
### Added
- support for ES6 modules and import syntax

### Removed
- removed extraneous files

## Changed
- 'window' to 'global.window' to work with es6 bundling

## [1.3.20] - 2022-07-07
### Fixed
- reverted Array typechecking as was causing error

## [1.3.19] - 2022-07-07
### Fixed
- better error handling for functions
- typechecking for arrays

## [1.3.18] - 2022-06-13
### Fixed
- updated Meyda to v5.5

## [1.3.17] - 2022-01-10
### Fixed
- Fix 'update' function error log 
- reset 'update' function when hush()
- `.tick()` working in non-global mode

## [1.3.16] - 2022-01-10
### Fixed 
- nested layers error

### Added 
- texture params to regl sources

### Changed
- hush() resets to source o0

## [1.3.15] - 2022-01-08
### Fixed 
- error in function argument formatting
### Added 
- texture params to regl sources

### Fixed
- arrayUtils imprted to formatArguents.js
## [1.3.14] - 2022-01-08
### Fixed
- arrayUtils imprted to formatArguents.js

### Changed
- mask function now preserves earlier transparency

## [1.3.12] - 2022-01-05
### Fixed
- bug with `src()` function in non-global mode

### Added
- additional multiple-canvas example including dereferencing
- link to `hydra-ts`

## [1.3.11] - 2021-12-13
- updated build version

## [1.3.10] - 2021-12-13
### Fixed
- camera working on ios

## [1.3.9] - 2021-11-02
### Fixed
- non-global mode

### Added
- documentation for non-global mode
- loadScript function to hydra-synth

## [1.3.8] - 2021-04-12
### Changed
- uses absolute position for mouse
- updated documentation

## [1.3.7] - 2021-04-06
### Fixed
- bug in precision for shaders

### Changed
- when no precision is specified, uses "highp" on ios, and "mediump" on everything else

## [1.3.5] - 2020-11-06
- Fixed divide by 0 on smoothstep

## [1.3.2] - 2020-11-04
### Fixed
- Typo on rotate function
- update for setResolution()
- warning of undefined type

### Changed
- video default to muted

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
