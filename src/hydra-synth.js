
import Output from './output.js'
import {OutputWgsl} from './wgsl/outputWgsl.js';
import {loop} from './raf-loop.js'
import Source from './hydra-source.js'
import MouseTools from './lib/mouse.js'
import Audio from './lib/audio.js'
import VidRecorder from './lib/video-recorder.js'
import ArrayUtils from './lib/array-utils.js'
import Sandbox from './eval-sandbox.js'
import Generator from './generator-factory.js'
import regl from 'regl'
// const window = global.window
import {wgslHydra} from './wgsl/wgsl-hydra.js';
import {Deglobalize} from './Deglobalize.js';
import { tri, quad, poly, circle, line, ring, cube, loadObj, loadGlb, parseGlb, extractGlbTextures, createGlbSpriteSheet } from './lib/geometry.js';
import { spriteSheet, spriteAtlas, parseAseprite, loadAseprite } from './lib/sprite-sheet.js';

const AsyncGeneratorFunction = async function* () {}.constructor;

let Mouse;
if (!(typeof self !== 'undefined' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope')) {
  Mouse = MouseTools();
	console.log("Not running as a web worker");
} else {
	  Mouse = {x: 0, y: 0}
		console.log("Running as a web worker");
}
// to do: add ability to pass in certain uniforms and transforms
class HydraRenderer {

  constructor ({
    pb = null,
    width = 1280,
    height = 720,
    numSources = 4,
    numOutputs = 4,
    makeGlobal = true,
    autoLoop = true,
    detectAudio = true,
    enableStreamCapture = true,
    useWGSL = false,
    canvas,
    precision,
    regen = false,
    resetOut = true,
    extendTransforms = {}, // add your own functions on init
    gpuDevice = null,  // Optional shared GPUDevice for zero-copy texture sharing
    preserveDrawingBuffer = false  // Enable for Syphon/pixel readback
  } = {}) {
    this.preserveDrawingBuffer = preserveDrawingBuffer;

    ArrayUtils.init()

    this.pb = pb

    this.width = width
    this.height = height
    this.renderAll = false
    this.detectAudio = detectAudio
    this.useWGSL = useWGSL;
    if (this.useWGSL) {
    	console.log("Creating HydraRenderer with WGSL and WebGPU.");
    }
    this.wgslReady = false;
		this.useRAF = false;
		this.gpuDevice = gpuDevice;  // Store for passing to wgslHydra
    this._initCanvas(canvas)

    // object that contains all properties that will be made available on the global context and during local evaluation
    this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: undefined,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      _destroy: this._destroy.bind(this),
      setResolution: this.setResolution.bind(this),
      update: (dt) => {},// user defined update function
      hush: this.hush.bind(this),
      tick: this.tick.bind(this),
      // Geometry helpers for vertex shaders
      tri: tri,
      quad: quad,
      poly: poly,
      circle: circle,
      line: line,
      ring: ring,
      cube: cube,
      loadObj: loadObj,
      loadGlb: loadGlb,
      parseGlb: parseGlb,
      extractGlbTextures: extractGlbTextures,
      createGlbSpriteSheet: createGlbSpriteSheet,
      // Sprite sheet helpers
      spriteSheet: spriteSheet,
      spriteAtlas: spriteAtlas,
      parseAseprite: parseAseprite,
      loadAseprite: loadAseprite,
    }

    if (makeGlobal) window.loadScript = this.loadScript


    this.timeSinceLastUpdate = 0
    this._time = 0 // for internal use, only to use for deciding when to render frames

    // only allow valid precision options
    let precisionOptions = ['lowp','mediump','highp']
    if(precision && precisionOptions.includes(precision.toLowerCase())) {
      this.precision = precision.toLowerCase()
      //
      // if(!precisionValid){
      //   console.warn('[hydra-synth warning]\nConstructor was provided an invalid floating point precision value of "' + precision + '". Using default value of "mediump" instead.')
      // }
    } else {
      let isIOS =
    (/iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
    !window.MSStream;
      this.precision = isIOS ? 'highp' : 'mediump'
    }

    this.extendTransforms = extendTransforms

    // boolean to store when to save screenshot
    this.saveFrame = false

    // if stream capture is enabled, this object contains the capture stream
    this.captureStream = null

    this.generatorFunction = undefined
    this.generatorFunctionTimer = -1;

		this.numOutputs = numOutputs;
		
		this.regen = regen;
		this.regenInfo = new Array(numOutputs);
		
		this.resetOut = resetOut;

		if (this.useWGSL) {
			this.wgslHydra = new wgslHydra(this, this.canvas, 4, this.gpuDevice);
			this.wgslPromise = new Promise((resolve, reject)=> {
			this._initOutputsWgsl(numOutputs);
			this.wgslHydra.setupHydra().then(()=>{
					this._initSources(numSources);
					this._generateGlslTransforms();	
					this.sandbox = new Sandbox(this.synth, makeGlobal, ['speed', 'update', 'bpm', 'fps'])
					if(autoLoop) {
//						 if (!requestAnimationFrame) {
						 	  this.useRAF = false;
						 		this.looper = loop(this.tick.bind(this)).start();
//						 } else {
//						 	  this.useRAF = true;
//						 	  requestAnimationFrame(this.tick.bind(this));
//						}
					}
				  resolve(true);
			})
		});
		} else {
		// Run with regl
        this._initRegl()
        this._initOutputs(numOutputs)
        this._initSources(numSources)
        this._generateGlslTransforms()
				this.sandbox = new Sandbox(this.synth, makeGlobal, ['speed', 'update', 'bpm', 'fps'])

        this.synth.screencap = () => {
          this.saveFrame = true
        }
    
        if (enableStreamCapture) {
          try {
            this.captureStream = this.canvas.captureStream(25)
            // to do: enable capture stream of specific sources and outputs
            this.synth.vidRecorder = new VidRecorder(this.captureStream)
          } catch (e) {
            console.warn('[hydra-synth warning]\nnew MediaSource() is not currently supported on iOS.')
            console.error(e)
          }
        }
    }
    if(detectAudio) this._initAudio()


    if(this.useWGSL) return;

		if(autoLoop) {
//					if (!requestAnimationFrame) {
//						 this.useRAF = false;
						 this.looper = loop(this.tick.bind(this)).start();
//					} else {
//						 	this.useRAF = true;
//						 	requestAnimationFrame(this.tick.bind(this));
//					}
				}

    // final argument is properties that the user can set, all others are treated as read-only
    this.sandbox = new Sandbox(this.synth, makeGlobal, ['speed', 'update', 'bpm', 'fps'])
  }


  async eval(codeIn) {
  	
  	if (this.resetOut) this.synth.render(this.o[0])
  	// Reset 
    let code = Deglobalize(codeIn, '_h');
    // convert all keys in h into strings
    let h = this.synth;
    let keys = Object.keys(h);
    let values = [];

    for (let i = 0; i < keys.length; ++i) values.push(h[keys[i]]);
    keys.push("h");
    values.push(h);
    keys.push("_h"); // _h used for fixing-up primitive-valued 'global' references, like "time".
    values.push(h);
    try {
    	let fn = new AsyncGeneratorFunction(...keys, code);
    	this.done = false;
    	this.generatorFunction = fn(...values);
    } catch (err) {
    	console.log("Error compiling generator function");
    	console.log(err);
    	this.generatorFunctionTimer = -1;
    	return;
    }
    this.generatorFunctionTimer = -1;
    try {
    	let reply = await this.generatorFunction.next();
    	this.planNext(reply);
    } catch (err) {
    	console.log("Error calling initial generator function.next()");
    	console.log(err);
    	delete this.generatorFunction;
    	return;
    }
}

// Called from the general tick() function.
 async generatorTick() {
	if (!this.generatorFunction || this.generatorFunctionTimer === -1) return;
	if (this.synth.time < this.generatorFunctionTimer) return;
	let f = this.generatorFunction;
	if (!f) {
			this.generatorFunctionTimer = -1;
	} else
	try {
		let reply = await f.next();
		this.planNext(reply);
	} catch (err) {
    	console.log("Error calling generator function.next()");
    	console.log(err);
    	this.generatorFunctionTimer = -1;
    	delete this.generatorFunction;
	}
}

 planNext(reply) {
	 if (!reply) return;

   if (!reply.done) {
    		let wT = reply.value;
    		if (wT === undefined) {
    			wT = 0.010;
    		}
    		this.generatorFunctionTimer = this.synth.time + wT;
    } else {
        this.done = true;
    		delete this.generatorFunction;
    }
}


  getScreenImage(callback) {
    this.imageCallback = callback
    this.saveFrame = true
  }
  
// Teardown this hydra-synth, stopping periodic activity and reclaiming memory.
  _destroy() {
 		this.hush();
 		if (this.looper) {
 			this.looper.stop();
 			delete this.looper;
 		}
 		if (this.regl) {
 			this.regl.destroy();
 			delete this.regl;
 		}
 		if(this.synth && this.synth.a) {
 			 this.synth.a.destroy();
 		}
// 		if (cancelAnimationFrame) {
// 			cancelAnimationFrame();
// 		}
 }

  hush() {
  	this.regenInfo = [];
    this.s.forEach((source) => {
      source.clear()
    })
    this.o.forEach((output) => {
      // Clear all sprite levels before resetting
      if (output.clearSprites) {
        output.clearSprites()
      }
      this.synth.solid(0, 0, 0, 0).out(output)
    })
    this.synth.render(this.o[0])
    // this.synth.update = (dt) => {}
    this.sandbox.set('update', (dt) => {})
  }

  loadScript(url = "") {
   const p = new Promise((res, rej) => {
     var script = document.createElement("script");
     script.onload = function () {
       console.log(`loaded script ${url}`);
       res();
     };
     script.onerror = (err) => {
       console.log(`error loading script ${url}`, "log-error");
       res()
     };
     script.src = url;
     document.head.appendChild(script);
   });
   return p;
 }

 noteRegenString(outIndex, regenStr) {

 	this.regenInfo[outIndex] = {str: regenStr, modTime: performance.now()} ;
}

 // Return the regenerated strings from at or before a given time.
 // time unit "highTime" is performance.now() + performance.timeOrigin
 activeFromBefore(highTime) {
 	  let timeBase = performance.timeOrigin;
 	  
 		let os = [];
 		for (let j = 0; j < this.s.length; ++j) {
 			let src = this.s[j];
 			if (src && src.active && ((src.modTime + timeBase) <= highTime)) {
 				os.push(src.setupString());
 				os.push('\n');
 			}
 		}

 		for (let i = 0; i < this.regenInfo.length; ++i) {
 			let ent  = this.regenInfo[i];
 			if (ent) {
 			 if ((ent.modTime + timeBase) <= highTime) {
 			 	let filtered = ent.str.replaceAll("_h.","");
 				 os.push(filtered);
 				 os.push('\n');
 				}
 			}
 		}
 		return os.join('');
	}

  setResolution(width, height) {
  //  console.log(width, height)
    this.canvas.width = width
    this.canvas.height = height
    this.width = width // is this necessary?
    this.height = height // ?
    this.sandbox.set('width', width)
    this.sandbox.set('height', height)
    console.log(this.width)
    this.o.forEach((output) => {
      output.resize(width, height)
    })
    this.s.forEach((source) => {
      source.resize(width, height)
    })
    if (this.useWGSL) {
    	this.wgslHydra.resizeOutputsTo(width, height);
    } else {
    	this.regl._refresh()
    }
  }

  canvasToImage (callback) {
    const a = document.createElement('a')
    a.style.display = 'none'

    let d = new Date()
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.png`
    document.body.appendChild(a)
    var self = this
    this.canvas.toBlob( (blob) => {
        if(self.imageCallback){
          self.imageCallback(blob)
          delete self.imageCallback
        } else {
          a.href = URL.createObjectURL(blob)
          console.log(a.href)
          a.click()
        }
    }, 'image/png')
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
    }, 300);
  }

  _initAudio () {
    this.synth.a = new Audio({
      numBins: 4,
      parentEl: this.canvas.parentNode
    })
  }
  // create main output canvas and add to screen
  _initCanvas (canvas) {
    if (canvas) {
      this.canvas = canvas
      this.width = canvas.width
      this.height = canvas.height
    } else {
      this.canvas = document.createElement('canvas')
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.canvas.style.width = '100%'
      this.canvas.style.height = '100%'
      this.canvas.style.imageRendering = 'pixelated'
      document.body.appendChild(this.canvas)
    }
  }

  _initRegl () {
    this.regl = regl({
    //  profile: true,
      canvas: this.canvas,
      pixelRatio: 1,
      attributes: {
        preserveDrawingBuffer: this.preserveDrawingBuffer
      }
      // extensions: [
      //   'oes_texture_half_float',
      //   'oes_texture_half_float_linear'
      // ],
      // optionalExtensions: [
      //   'oes_texture_float',
      //   'oes_texture_float_linear'
     //]
   })

    // This clears the color buffer to black and the depth buffer to 1
    this.regl.clear({
      color: [0, 0, 0, 1]
    })

    this.renderAll = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform sampler2D tex0;
      uniform sampler2D tex1;
      uniform sampler2D tex2;
      uniform sampler2D tex3;

      void main () {
        vec2 st = vec2(1.0 - uv.x, uv.y);
        st*= vec2(2);
        vec2 q = floor(st).xy*(vec2(2.0, 1.0));
        int quad = int(q.x) + int(q.y);
        st.x += step(1., mod(st.y,2.0));
        st.y += step(1., mod(st.x,2.0));
        st = fract(st);
        if(quad==0){
          gl_FragColor = texture2D(tex0, st);
        } else if(quad==1){
          gl_FragColor = texture2D(tex1, st);
        } else if (quad==2){
          gl_FragColor = texture2D(tex2, st);
        } else {
          gl_FragColor = texture2D(tex3, st);
        }

      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop('tex0'),
        tex1: this.regl.prop('tex1'),
        tex2: this.regl.prop('tex2'),
        tex3: this.regl.prop('tex3')
      },
      count: 3,
      depth: { enable: false }
    })

    this.renderFbo = this.regl({
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop('tex0'),
        resolution: this.regl.prop('resolution')
      },
      count: 3,
      depth: { enable: false }
    })
  }

  _initOutputs (numOutputs) {
    const self = this
    this.o = (Array(numOutputs)).fill().map((el, index) => {
      var o = new Output({
        regl: this.regl,
        chanNum: index,
        hydraSynth: this,
        width: this.width,
        height: this.height,
        precision: this.precision,
        label: `o${index}`
      })
    //  o.render()
      o.id = index
      self.synth['o'+index] = o
      return o
    })

    // set default output
    this.output = this.o[0]
  }

  _initOutputsWgsl (numOutputs) {
    const self = this
    this.o = (Array(numOutputs)).fill().map((el, index) => {
      var o = new OutputWgsl({
      	wgslHydra: this.wgslHydra,
      	hydraSynth: this,
        width: this.width,
        height: this.height,
        chanNum: index,
        label: `o${index}`
      })
    //  o.render()
      o.id = index
      self.synth['o'+index] = o
      return o
    })

    // set default output
    this.output = this.o[0]
  }

  _initSources (numSources) {
    this.s = []
    for(var i = 0; i < numSources; i++) {
      this.createSource(i)
    }
  }

  createSource (i) {
    let s = new Source({regl: this.regl, hydraSynth: this, wgsl: this.wgslHydra,
    		 pb: this.pb, width: this.width, height: this.height, chanNum: i, label: `s${i}`})
    this.synth['s' + this.s.length] = s
    this.s.push(s)
    return s
  }


  _generateGlslTransforms () {
    var self = this
    this.generator = new Generator({
    	genWGSL:  this.useWGSL,
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({type, method, synth}) => {
          if (type === 'add') {
            self.synth[method] = synth.generators[method]
            if(self.sandbox) self.sandbox.add(method)
          } else if (type === 'remove') {
            // what to do here? dangerously deleting window methods
            //delete window[method]
          }
      //  }
      }
    })
    this.synth.setFunction = this.generator.setFunction.bind(this.generator)
  }

  _render (output) {
    if (output) {
      this.output = output
      this.isRenderingAll = false
       if (this.wgslHydra) {
      		 this.wgslHydra.showQuad = false;
					if (output.chanNum < this.numOutputs ) {
			 			this.wgslHydra.outChannel = output.chanNum;
	      	}
	      }
    } else {
      this.isRenderingAll = true
     	if (this.wgslHydra) {
      		 this.wgslHydra.showQuad = true;
      	}
    }
  }

  // dt in ms
  tick (dt) {
//  	if (this.useRAF) {
// 		requestAnimationFrame(this.tick.bind(this))
//  	}
    if(!this.sandbox) return;
    this.sandbox.tick()

    if(this.detectAudio &&
      this.synth && this.synth.a && this.synth.a.tick) this.synth.a.tick();
  //  let updateInterval = 1000/this.synth.fps // ms
    this.sandbox.set('time', this.synth.time += dt * 0.001 * this.synth.speed)
    this.timeSinceLastUpdate += dt
    this.generatorTick();
    if(!this.synth.fps || this.timeSinceLastUpdate >= 1000/this.synth.fps) {
        if (this.useWGSL) {
        		// Visit sources.
        		//  console.log(this.synth.speed, this.synth.time)
          	for (let i = 0; i < this.s.length; i++) {
            	this.s[i].tick(this.synth.time)
          }
          this.wgslHydra.relayUniformInfo(this.synth.mouse);
        	this.wgslHydra.animate(dt);
        } else 
        {
        //  console.log(1000/this.timeSinceLastUpdate)
          this.synth.stats.fps = Math.ceil(1000/this.timeSinceLastUpdate)
          if(this.synth.update) {
            try { this.synth.update(this.timeSinceLastUpdate) } catch (e) { console.log(e) }
          }
        //  console.log(this.synth.speed, this.synth.time)
          for (let i = 0; i < this.s.length; i++) {
            this.s[i].tick(this.synth.time)
          }
        //  console.log(this.canvas.width, this.canvas.height)
          for (let i = 0; i < this.o.length; i++) {
            this.o[i].tick({
              time: this.synth.time,
              mouse: this.synth.mouse,
              bpm: this.synth.bpm,
              resolution: [this.canvas.width, this.canvas.height]
            })
          }
          if (this.isRenderingAll) {
            this.renderAll({
              tex0: this.o[0].getCurrent(),
              tex1: this.o[1].getCurrent(),
              tex2: this.o[2].getCurrent(),
              tex3: this.o[3].getCurrent(),
              resolution: [this.canvas.width, this.canvas.height]
            })
          } else {
     
            this.renderFbo({
              tex0: this.output.getCurrent(),
              resolution: [this.canvas.width, this.canvas.height]
            })
          }
          this.timeSinceLastUpdate = 0
        }
     }
    if(this.saveFrame === true) {
      this.canvasToImage()
      this.saveFrame = false
    }
  //  this.regl.poll()
  }


}

export default HydraRenderer
