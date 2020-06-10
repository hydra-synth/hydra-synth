### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

This is the main logic of hydra packaged as a javascript module, intended for use within javascript projects. If you are looking to get started with hydra quickly, visit the [web editor](https://hydra.ojack.xyz) or the [main repo](https://github.com/ojack/hydra). To use hydra within atom, follow the instructions at https://github.com/ojack/hydra-examples.

### To install:


```
npm install hydra-synth
```

### To develop:
```
npm run example
```
Sets up an example using hydra-synth that is automatically updated when source files are updated. It is possible to write test code by editing /example/index.js or by writing hydra code into the developer console.

#### To use:
```
const Hydra = require('hydra-synth')


window.onload = function () {
  const hydra = new Hydra()

  // by default, hydra makes everything global.
  // see options to change parameters
  osc().out()
}
```

#### API:
```
hydra = new Hydra([opts])
```
create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.

```
{
  canvas: null, // canvas element to render to. If none is supplied, a canvas will be created and appended to the screen

  autoLoop: true, // if true, will automatically loop using requestAnimationFrame.If set to false, you must implement your own loop function using the tick() method (below)

  makeGlobal: true, // if false, will not pollute global namespace

  numSources: 4, // number of source buffers to create initially

  numOutputs: 4, // number of output buffers to use. Note: untested with numbers other than 4. render() method might behave unpredictably

  extendTransforms: [] // An array of transforms to be added to the synth, or an object representing a single transform

  precision: 'mediump' // precision of shaders, can also be 'highp'
}

```

set the resolution of the hydra canvas (note: this changes the underlying resolution. To change appearance on the screen, you should edit the css)
```
hydra.setResolution(width, height)
```

render an oscillator with parameters frequency, sync, and rgb offset:
```
osc(20, 0.1, 0.8).out()
```

rotate the oscillator 1.5 radians:
```
osc(20, 0.1, 0.8).rotate(0.8).out()
```
pixelate the output of the above function:
```
osc(20, 0.1, 0.8).rotate(0.8).pixelate(20, 30).out()
```
show webcam output:
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).out() //render source buffer s0
```

webcam kaleidoscope:
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).kaleid(4).out() //render the webcam to a kaleidoscope
```

use a video as a source:
```
s0.initVideo("https://media.giphy.com/media/eLjKthx6c1ZvJ3lJeJ/giphy.mp4")
src(s0).out()
```


use an image as a source:
```
s0.initImage("https://upload.wikimedia.org/wikipedia/commons/2/25/Hydra-Foto.jpg")
src(s0).out()
```

By default, the environment contains four separate output buffers that can each render different graphics.  The outputs are accessed by the variables o0, o1, o2, and o3.
to render to output buffer o1:
```
osc().out(o1)
render(o1) //render the contents of o1
```

to show all render buffers at once:
```
render()
```

The output buffers can then be mixed and composited to produce what is shown on the screen.
```
s0.initCam() //initialize a webcam in source buffer s0
src(s0).out(o0) //set the source of o0 to render the buffer containing the webcam
osc(10, 0.2, 0.8).diff(o0).out(o1) //initialize a gradient in output buffer o1, composite with the contents of o0
render(o1) // render o1 to the screen
```

The composite functions blend(), diff(), mult(), and add() perform arithmetic operations to combine the input texture color with the base texture color, similar to photoshop blend modes.

modulate(texture, amount) uses the red and green channels of the input texture to modify the x and y coordinates of the base texture. More about modulation at: https://lumen-app.com/guide/modulation/
```
osc(21, 0).modulate(o1).out(o0)
osc(40).rotate(1.57).out(o1)
```

#### Passing functions as variables
Each parameter can be defined as a function rather than a static variable. For example,
```
osc(function(t){return 100*Math.sin(t*0.1)}).out()
```
modifies the oscillator frequency as a function of time. This can be written more concisely using es6 syntax:
```
osc((t) => (100*Math.sin(t*0.1))).out()
```

#### Using Custom Sources
Any canvas, video, or image element can serve as a source in addition to the built-in source functions for sharing camera, screen capture, and remote streams. Video and images must be fully loaded before being passed to hydra.

Add a custom source:

```
s0.init({
  src: <canvas, video, or image element>,
  dynamic: true // optional parameter. Set to false if using a static image or something that will not change
})
```

You can add new source buffers once hydra has been initialized:
```
let src = hydra.newSource()
src.init({ src: canvasEl})
```

Clear a source buffer:
```
s0.clear()
```


#### Non-global mode [in progress]
If makeGlobal is set to false, buffers and functions can be accessed via the synth property of the hydra instance. Note that sources and buffers are contained in an array and accessed by index. E.g.:
```
let synth = hydra.synth
synth.osc().out()
synth.s0.initCam()
```

#### Custom render loop
You can use your own render loop for triggering hydra updates, instead of the automatic looping. To use, set autoLoop to false, and call
```
hydra.tick(dt)
```
where dt is the time elapsed in milliseconds since the last update

### Directly using shader code
You can get access to the hydra shader code without rendering using hydra. For example,
```
osc().rotate().glsl()
```
returns a fragment shader string and list of uniforms. For vertex shader and attribute implentation, see https://github.com/ojack/hydra-synth/blob/master/src/output.js.

#### Adding/editing transformation functions

All of the available functions for transforming coordinates and color, as well as compositing textures, correspond directly to a snippet of fragment shader code. These transformations are defined in the file hydra/hydra-server/app/src/composable-glsl-transforms.js. When running locally, you can edit this file to change the available functions, and refresh the page to see changes.


#### Desktop capture
To use screen capture or a browser tab as an input texture, you must first install the chrome extension for screensharing, and restart chrome. Desktop capture can be useful for inputing graphics from another application, or a video or website in another browser tab. It can also be used to create interesting feedback effects.

To install, go to http://chrome://extensions/
Click "Load unpacked extension", and select the "extensions" folder in "screen-capture-extension" in this repo. Restart chrome. The extension should work from now on without needing to reinstall.

select a screen tab to use as input texture:
```
s0.initScreen()
```

render screen tab:
```
s0.initScreen()
o0.src(s0)
```
