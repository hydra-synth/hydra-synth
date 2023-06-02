### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

This is the main logic of hydra packaged as a javascript module, intended for use within javascript projects. If you are looking to get started with hydra quickly, visit the [web editor](https://hydra.ojack.xyz) or the [main repo](https://github.com/ojack/hydra). To use hydra within atom, follow the instructions at https://github.com/ojack/hydra-examples.

![image of hydra in webpage](/assets/hydra-webpage.png?raw=true)

### To include in a webpage (bundled version):
Include the bundled version of this library in your html file:
```html
<script src="https://unpkg.com/hydra-synth"></script>
<script>
      // create a new hydra-synth instance
      var hydra = new Hydra({ detectAudio: false })
      osc(4, 0.1, 1.2).out()
</script>
```

You can see and remix a live example here: https://glitch.com/edit/#!/hydra-webpage

### To use as a module:
Download the module:
```
npm install --save hydra-synth
```

Include in your app:
```javascript
import Hydra from 'hydra-synth'

const hydra = new Hydra({ detectAudio: false })
osc(4, 0.1, 1.2).out()
```

### To use using cjs/require syntax:
```javascript
const Hydra = require('hydra-synth')
```


The rest of this README is about configuring hydra-synth. For broader hydra documentation and usage, see [getting started](https://github.com/ojack/hydra#basic-functions), [interactive function documentation](https://ojack.xyz/hydra-functions/), and [Hydra Book (by Naoto Hieda)](https://hydra-book.naotohieda.com/#/).

#### API:
```javascript
const hydra = new Hydra([opts])
```
create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.

```javascript
{
  canvas: null, // canvas element to render to. If none is supplied, a canvas will be created and appended to the screen

  width: // defaults to canvas width when included, 1280 if not

  height: // defaults to canvas height when included, 720 if not

  autoLoop: true, // if true, will automatically loop using requestAnimationFrame.If set to false, you must implement your own loop function using the tick() method (below)

  makeGlobal: true, // if false, will not pollute global namespace (note: there are currently bugs with this)

  detectAudio: true, // recommend setting this to false to avoid asking for microphone

  numSources: 4, // number of source buffers to create initially

  numOutputs: 4, // number of output buffers to use. Note: untested with numbers other than 4. render() method might behave unpredictably

  extendTransforms: [] // An array of transforms to be added to the synth, or an object representing a single transform

  precision: null  // force precision of shaders, can be 'highp', 'mediump', or 'lowp' (recommended for ios). When no precision is specified, will use highp for ios, and mediump for everything else.

  pb = null, // instance of rtc-patch-bay to use for streaming
}

```

#### Custom render loop
You can use your own render loop for triggering hydra updates, instead of the automatic looping. To use, set autoLoop to false, and call
```javascript
hydra.tick(dt)
```
where dt is the time elapsed in milliseconds since the last update

### To develop:
```javascript
npm run dev
```
Sets up an example using hydra-synth that is automatically updated when source files are updated. It is possible to write test code by editing /example/index.js or by writing hydra code into the developer console.

#### Non-global mode
If makeGlobal is set to false, buffers and functions can be accessed via the synth property of the hydra instance.
```javascript
const h = new Hydra({ makeGlobal: false, detectAudio: false }).synth
h.osc().rotate().out()
```

In non-global mode, it is important to start all hydra functions, buffers, and variables by referencing the instance of hydra synth you are currently using.e.g.
```javascript
const h = new Hydra({ makeGlobal: false, detectAudio: false }).synth
h.osc().diff(h.shape()).out()
h.gradient().out(h.o1)
h.render()
```

This also makes it possible to use more than one hydra canvas at once:
```javascript
const h = new Hydra({ makeGlobal: false, detectAudio: false }).synth
h.osc().diff(h.shape()).out()
h.gradient().out(h.o1)
h.render()

const h2 = new Hydra({ makeGlobal: false, detectAudio: false }).synth
h2.shape(4).diff(h2.osc(2, 0.1, 1.2)).out()
```

See https://glitch.com/edit/#!/multi-hydra for a working example of multiple hydra canvases, created by Naoto Hieda.

If you would like to keep the same syntax as hydra in non-global mode, consider destructuring the object further:
```javascript
const { src, osc, gradient, shape, voronoi, noise, s0, s1, s2, s3, o0, o1, o2, o3, render } = hydra
shape(4).diff(osc(2, 0.1, 1.2)).out()
```

[hydra-ts](https://github.com/folz/hydra-ts) is a fork of hydra-synth in Typescript maintained by @folz. 

### Known issues / troubleshooting

#### Vite
When using hydra with Vite, you might see the error 

#### Autoplay on iOS

*from issue https://github.com/hydra-synth/hydra-synth/issues/137*

It seems on mobile safari, videos won't autoplay because of several reasons:

* you need playsinline attribute (which can be added programmatically) https://stackoverflow.com/questions/43570460/html5-video-autoplay-on-iphone
* If the `<video>` element is not rendered on screen, the video does not update. As a workaround, you can make a small render of the video in a corner and this seems to work

```html
    <video style="position:static;top:1px;width:1px;height:1px" id="vid" autoplay loop muted playsinline crossorigin>
      <source src="https://cdn.glitch.global/8df667c3-e544-4cbb-8c16-f604238e8d2e/paper.mov?v=1682418858521">
    </video>
```

```
let v = document.getElementById("vid")
v.addEventListener('loadeddata', () => {
  s0.init({src: v})
})
```

Here is a live example: https://glitch.com/edit/#!/hydra-video-autoplay-ios
