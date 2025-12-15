import {Webcam} from './lib/webcam.js'
import Screen from './lib/screenmedia.js'

class HydraSource {
  constructor ({ regl, wgsl, hydraSynth, width, height, chanNum, pb, label = ""}) {
    this.label = label;
    this.regl = regl;
    this.wgsl = wgsl;
    this.hydraSynth = hydraSynth;
    this.src = null;
    this.dynamic = true;
    this.width = width;
    this.height = height;
    this.chanNum = chanNum;
    this.indirect = false;
		this.active = false;
    this.pb = pb;
    this.tex = this.makeTexture({width, height});
  }

	noteTime() {
		this.modTime = performance.now();
	}

  makeTexture(params) {
  	let width = params.width;
 	  let height = params.height;

  	if (!this.wgsl) {
  		return this.regl.texture({
      	shape: [ width, height ],
      	...params
    		});
  	} else {
 	  let tex = this.wgsl.device.createTexture({
    	size: [width, height, 1],
    	format: this.wgsl.format, // was "rgba8unorm"
    	usage:
      		GPUTextureUsage.TEXTURE_BINDING |
      		GPUTextureUsage.COPY_DST |
      		GPUTextureUsage.RENDER_ATTACHMENT,
  			});
  		this.lastTexture = undefined; // flush view cache if needed.
    	return tex;
  	}
  }

	activate (width, height) {
		this.offscreencanvas = new OffscreenCanvas(width, height); 
		this.bmr = this.offscreencanvas.getContext("bitmaprenderer");

		if (!this.wgsl) {
			 this.src = this.offscreencanvas;
			 this.tex = this.makeTexture({ data: this.src, dynamic: true, width: width, height: height})
		} else {
			this.tex = this.makeTexture({width: width, height : height});
		}
		console.log("activate complete");
	}


  init (opts, params) {
  	this.what = 'init';
		this.noteTime();
    if ('src' in opts) {
      this.src = opts.src
      if (!this.wgsl) {
      	this.tex = this.regl.texture({ data: this.src, ...params })
      } else {
        // Check if src already has a .tex property (e.g., another HydraSource)
        if (opts.src.tex) {
          this.indirect = true;
          this.tex = opts.src.tex;
        } else {
          // src is an Image/Video/Canvas - create WGSL texture from it
          const w = opts.src.width || opts.src.videoWidth || this.width;
          const h = opts.src.height || opts.src.videoHeight || this.height;
          this.width = w;
          this.height = h;
          this.tex = this.wgsl.device.createTexture({
            size: [w, h, 1],
            format: this.wgsl.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          });
          // Copy image data to texture
          this.wgsl.device.queue.copyExternalImageToTexture(
            { source: opts.src, flipY: true },
            { texture: this.tex },
            [w, h]
          );
          this.indirect = false;
          this.lastTextureView = undefined; // Clear cached view
        }
      }
    }
    if ('dynamic' in opts) this.dynamic = opts.dynamic
		this.active = true;
  }

  // Initialize from another Hydra's output (for shared GPUDevice zero-copy)
  // outputWgsl: an OutputWgsl from another Hydra instance on the same GPUDevice
  initFromOutput(outputWgsl) {
    this.what = 'initFromOutput';
    this.noteTime();
    this.externalOutput = outputWgsl;  // Keep reference to get current texture
    this.indirect = true;
    this.dynamic = true;
    this.active = true;
    // Note: tex will be fetched dynamically in getTextureWGSL via externalOutput
  }

  // Initialize directly from a GPUTexture (for shared GPUDevice zero-copy)
  initFromTexture(gpuTexture) {
    this.what = 'initFromTexture';
    this.noteTime();
    this.tex = gpuTexture;
    this.indirect = true;
    this.dynamic = false;  // Static texture reference
    this.active = true;
  }

	setupString() {
		let outs = [];
		let w = this.what;
		outs.push(this.label);
		outs.push(".");
		outs.push(w);
		outs.push("(");
		if (w === 'initVideo' || w === 'initImage') {
			outs.push('"');
			outs.push(this.url);
			outs.push('"');		
		} else if (w === 'initStream') {
			outs.push('"');
			outs.push(this.streamName);
			outs.push('"');			
		} else if (w === 'initCam' || w === 'initScreen') {
			if (this.index !== undefined) outs.push(String.valueOf(this.index));
		}
		outs.push(")");
		return outs.join('');
	}

  initCam (index, params) {
  	this.what = 'initCam';
  	this.noteTime();
    const self = this
		self.index = index;
    Webcam(index)
      .then(response => {
        self.src = response.video
        self.dynamic = true
        self.width = self.src.videoWidth;
        self.height = self.src.videoHeight;
        self.tex = this.makeTexture({ width: self.width, height: self.height, data: self.src, ...params })
		    self.active = true;
      })
      .catch(err => console.log('could not get camera', err))
  }

  initVideo (url = '', params) {
    this.what = 'initVideo';
    this.url = url;
		this.noteTime();
    const vid = document.createElement('video')
    vid.crossOrigin = 'anonymous'
    vid.autoplay = true
    vid.loop = true
    vid.muted = true // mute in order to load without user interaction

    const onload = vid.addEventListener('loadeddata', () => {
      this.src = vid
      this.width = vid.videoWidth;
      this.height = vid.videoHeight;
      vid.play()
      self.tex = this.makeTexture({ width: this.width, height: this.height, data: this.src, ...params })
      this.dynamic = true
      this.active = true;
    })
    vid.src = url
  }


  initImage (url = '', params) {
  	this.what = 'initImage';
  	this.url = url;
	  this.noteTime();
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.src = url
    this.oneShotDone = false;
    let self = this;
    img.onload = () => {
      self.src = img
      self.dynamic = false
      self.active = true;
      self.tex = this.makeTexture({ width: self.width, height: self.height, data: self.src, ...params })
    }
  }


  initStream (streamName, params) {
    //  console.log("initing stream!", streamName)
    let self = this
    self.what = 'initStream';
    this.noteTime();
    self.steamName = streamName;
    if (streamName && this.pb) {
      this.pb.initSource(streamName)

      this.pb.on('got video', function (nick, video) {
        if (nick === streamName) {
          self.src = video
          self.dynamic = true
          self.active = true;
          self.tex = this.makeTexture({ width: self.width, height: self.height, data: self.src, ...params })

        }
      })
    }
  }

  // index only relevant in atom-hydra + desktop apps
  initScreen (index = 0, params) {
    const self = this;
    self.what = 'initScreen';
    self.index = index;
    self.noteTime();
    Screen()
      .then(function (response) {
        self.src = response.video
        self.tex = self.regl.texture({ data: self.src, ...params})
        this.active = true;
        self.dynamic = true
        //  console.log("received screen input")
      })
      .catch(err => console.log('could not get screen', err))
  }

  // cache for the canvases, so we don't create them every time
  canvases = {}

  // Creates a canvas and returns the 2d context
  initCanvas (width = 1000, height = 1000) {
    if (this.canvases[this.label] == undefined) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext('2d')
      if(ctx != null)
        this.canvases[this.label] = ctx
    }

    const ctx = this.canvases[this.label]
    const canvas = ctx.canvas
    if (canvas.width !== width && canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    } else {
      ctx.clearRect(0, 0, width, height)
    }
    this.init({ src: canvas })

    this.dynamic = true
    return ctx
  }

  resize (width, height) {
    this.width = width
    this.height = height
  }

  clear () {
    if (this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach(track => track.stop())
      }
    }
    this.offscreencanvas = undefined;
		this.bmr = undefined;
    this.src = null
    this.active = false;
    this.what = '';
    if (!this.wgsl) {
    	this.tex = this.regl.texture({ shape: [ 1, 1 ] })
    } else {
    	this.tex = this.makeTexture({width: 1, height : 1});
    }
  }

  resizeTex(width, height) {
  	if (!this.wgsl) {
  		this.tex.resize(width, height)
  	} else {
			this.tex = this.makeTexture({width: width, height: height});
  	}
  		this.width = width;
  		this.height = height;
  }

  tick (time) {
    //  console.log(this.src, this.tex.width, this.tex.height)
    if (this.src && this.dynamic === true) {
      if (this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
        console.log(
          this.src.videoWidth,
          this.src.videoHeight,
          this.tex.width,
          this.tex.height
        )
        this.resizeTex(this.src.videoWidth, this.src.videoHeight)
      }

      if (this.src.width && this.src.width !== this.width) {
        this.resizeTex(this.src.width, this.src.height);
      }

			if (!this.wgsl) {
      	this.tex.subimage(this.src);
      } else {
      	this.updateTextureWGSL();
      }
    }
  }

 updateTextureWGSL() {
 	  if (!this.src) return;
 	  // Probably redundant.
 	  let w = this.width;
		let h = this.height;
		if (this.src.videoWidth) {
			w = this.src.videoWidth;
			h= this.src.videoHeight;
 	  }

 	  if (!this.dynamic) {
 	   if(!this.oneShotDone) {
 	  	// non-dynamic textures only need to be copied-in once.
 	  	 	this.wgsl.device.queue.copyExternalImageToTexture(
    			{ source: this.src, flipY: true},
    			{ texture: this.tex },
    			[ w, h ],
  			);
  			this.oneShotDone = true;
		 }
  		return;
 	  }
    // pull in the next texture;
    this.wgsl.device.queue.copyExternalImageToTexture(
    		{ source: this.src, flipY: true },
    		{ texture: this.tex },
    		[ w, h ],
  		);
    }

   getTexture () {
  		if (this.wgsl) return this.getTextureWGSL();
    	return this.tex
  	}

	// WGSL wants a "texture view", rather than a texture
	// To avoid creating a new view each frame, we do a simple cache.
   getTextureWGSL () {
    // For external outputs (cross-Hydra sharing), get texture from the source output
    if (this.externalOutput) {
      // Get the current texture from the external output (ping-pong aware)
      return this.externalOutput.getTexture();  // Returns view from opposite buffer
    }
  	if (!this.tex) return undefined;
  	if (this.lastTexture !== this.tex || !this.lastTextureView) {
  		// this.lastTexture = this.tex;
  		 this.lastTextureView = this.tex.createView();
  	}
  	if (this.lastTextureView) return this.lastTextureView;
    return undefined;
  }

  injectImage(img) {
  	if (!this.offscreencanvas) {
			this.activate(img.width, img.height);
		}
 		let sizeWrong = (this.tex.width !== img.width) || (this.tex.height !== img.height);
 		if (sizeWrong) {
 				this.activate(img.width, img.height);
 		}
		this.bmr.transferFromImageBitmap(img);

		// For WGSL/WebGPU, also copy from offscreencanvas to GPU texture
		if (this.wgsl && this.wgsl.device && this.tex) {
			try {
				this.wgsl.device.queue.copyExternalImageToTexture(
					{ source: this.offscreencanvas, flipY: true },
					{ texture: this.tex },
					[ img.width, img.height ]
				);
			} catch (err) {
				console.error('injectImage WebGPU copy failed:', err);
			}
		}
	}
}

export default HydraSource
