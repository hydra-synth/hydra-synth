### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

This is the main logic of hydra packaged as a javascript module, intended for use within javascript projects. If you are looking to get started with hydra quickly, visit the [web editor](https://hydra.ojack.xyz) or the [main repo](https://github.com/ojack/hydra). To use hydra within atom, follow the instructions at https://github.com/ojack/hydra-examples.

### To install:


```
npm install hydra-synth
```

### To develop:
```javascript
npm run example
```
Sets up an example using hydra-synth that is automatically updated when source files are updated. It is possible to write test code by editing /example/index.js or by writing hydra code into the developer console.

#### To use:
```javascript
const Hydra = require('hydra-synth')


window.onload = function () {
  const hydra = new Hydra()

  // by default, hydra makes everything global.
  // see options to change parameters
  osc().out()
}
```

#### API:
```javascript
hydra = new Hydra([opts])
```
create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.

```javascript
{
  canvas: null, // canvas element to render to. If none is supplied, a canvas will be created and appended to the screen

  autoLoop: true, // if true, will automatically loop using requestAnimationFrame.If set to false, you must implement your own loop function using the tick() method (below)

  makeGlobal: true, // if false, will not pollute global namespace

  numSources: 4, // number of source buffers to create initially

  detectAudio = true,

  numOutputs: 4, // number of output buffers to use. Note: untested with numbers other than 4. render() method might behave unpredictably

  extendTransforms: [] // An array of transforms to be added to the synth, or an object representing a single transform

  precision: 'mediump' // force precision of shaders, can also be 'highp' (recommended for ios). When no precision is specified, will use highp for ios, and mediump for everything else.
}

```


#### Non-global mode [in progress // CURRENTLY NOT WORKING VERY WELL]
If makeGlobal is set to false, buffers and functions can be accessed via the synth property of the hydra instance. Note that sources and buffers are contained in an array and accessed by index. E.g.:
```javascript
let synth = hydra.synth
synth.osc().out()
synth.s0.initCam()
```

#### Custom render loop
You can use your own render loop for triggering hydra updates, instead of the automatic looping. To use, set autoLoop to false, and call
```javascript
hydra.tick(dt)
```
where dt is the time elapsed in milliseconds since the last update
