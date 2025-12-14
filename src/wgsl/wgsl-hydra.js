import {FBOToCanvas} from "./FBOToCanvas.js";
import {FBO4ToCanvas} from "./FBO4ToCanvas.js";
import {BLEND_MODES} from "./outputWgsl.js";

// Used to enable a single pass through the "animate" routine.
// Used for testing to avoid a flood of console error messages.
const oneShot = false;
let fired = false;

const trace = false;

// ------------------------------------------------------------------------------
// standard prefix strings for all shaders
//
const vertexPrefix = `
	 struct VertexOutput {
  	@builtin(position) position : vec4f,
  	@location(0) texcoord : vec2f,
  	@location(1) faceId : f32,
	 };
`;

const fragPrefix = `
   @group(0) @binding(0) var<uniform> time: f32;
   @group(0) @binding(1) var<uniform> resolution: vec2<f32>;
   @group(0) @binding(2) var<uniform> mouse: vec2<f32>;
   @group(0) @binding(3) var<uniform> u_spriteUV: vec4<f32>;
   @group(0) @binding(4) var<uniform> u_spriteGrid: vec2<f32>;
`;

// ------------------------------------------------------------------------------
// standard vertex shader that sends position and uv for a quad
// 
 const vertexShaderCode = vertexPrefix + `
    @vertex
    fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
      var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0),

        vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0)
      );

     var output : VertexOutput;
     output.position = vec4<f32>( positions[vertexIndex], 0.0, 1.0);
     output.texcoord = positions[vertexIndex] / 2.0 + 0.5; // positions are -1 to 1, texcoords are 0
     output.faceId = 0.0;
     return output;
    }
`;

// Per-sprite data for a sprite render pass
class SpritePassEntry {
	constructor(chan, level) {
		this.chan = chan;
		this.level = level;
		this.reset();
	}

	reset() {
		this.fragmentShaderSource = undefined;
		this.fragmentShaderModule = undefined;
		this.vertexShaderModule = undefined;
		this.pipelineLayout = undefined;
		this.pipeline = undefined;

		this.uniformList = undefined;
		this.channelUniforms = [];
		this.textureUniforms = [];
		this.valueUniforms = [];
		this.bindGroupHeader = undefined;
		this.bindGroupLayout = undefined;

		this.hasValueUniforms = false;
		this.structString = undefined;
		this.valueStructView = undefined;
		this.structUniformBuffer = undefined;

		// Vertex buffer support
		this.hasCustomGeometry = false;
		this.vertexBuffer = undefined;
		this.vertexCount = 0;
		this.vertexWgsl = undefined;
		this.vertexUniforms = [];
		this.vertexUniformBuffer = undefined;
		this.vertexUniformView = undefined;
		this.vertexBindGroupLayout = undefined;
		this.vertexBindGroup = undefined;

		// Blend mode
		this.blendMode = 'normal';
	}
}

// Per channel data - now holds multiple sprites
class RenderPassEntry {
	constructor(chan) {
		this.chan = chan;
		this.channelTexInfo = [];
		// Map<spriteLevel, SpritePassEntry>
		this.sprites = new Map();
		this.reset();
	}

	reset() {
		this.pingPongs = 0;

		// Legacy single-pipeline fields (for backward compat with setupHydraChain)
		this.fragmentShaderSource = undefined;
		this.fragmentShaderModule = undefined
		this.pipelineLayout = undefined;
		this.pipeline = undefined;

		this.uniformList = undefined;
		this.channelUniforms = []; // all listEntries
		this.textureUniforms = []; // all uniformTextureListEntries
		this.valueUniforms = [];	 // all uniformValueListEntries
		this.bindGroupHeader = undefined;
		this.bindGroupLayout = undefined;

		this.hasValueUniforms = false;
		this.structString = undefined;
		this.valueStructView = undefined;
		this.structUniformBuffer = undefined;

		// Clear sprites
		this.sprites.clear();
	}
};

// ------------------------------------------------------------------------------
// wgslHydra manages a set of N "channels", each one driving a given output channel.
// 
class wgslHydra {
	// externalDevice: optional GPUDevice for sharing textures between Hydra instances
	constructor (hydra, canvas, numChannels = 4, externalDevice = null) {
		this.hydra = hydra;
		this.canvas = canvas;
	  this.context = this.canvas.getContext("webgpu");
	  this.externalDevice = externalDevice;  // If provided, use shared device

	  this.aspect = this.canvas.width / this.canvas.height;

	  this.numChannels =  numChannels ? numChannels : 4;

		this.renderPassInfo = new Array(numChannels);
		for (let i = 0; i < numChannels; ++i) this.renderPassInfo[i] = new RenderPassEntry(i);
	  this.time = 0.0;
	  this.mousePos = {x: 0, y: 0};
	  this.showQuad = false;
	  this.outChannel = 0;

	}
	
	relayUniformInfo(mouse) {
		this.mousePos = mouse;
	}

	// Changes the destination canvas size and the outputs too.
	async resizeOutputsTo(width, height) {
    this.canvas.width = Math.max(1, Math.min(width, this.device.limits.maxTextureDimension2D));
    this.canvas.height = Math.max(1, Math.min(height, this.device.limits.maxTextureDimension2D));

		this.createOutputTextures();

// resize the renderers by making new ones.
		 this.fboRenderer = new FBOToCanvas(this.canvas, this.device);
		 this.fbo4Renderer = new FBO4ToCanvas(this.canvas, this.device);
	   await this.fboRenderer.initializeFBOdrawing();
	   await this.fbo4Renderer.initializeFBOdrawing();
	}

 
	 createOutputTextures() {
	  this.outputChannelObjects = this.hydra.o;
    this.destTextureDescriptor = {
        size: {
            width: this.canvas.width,
            height: this.canvas.height
        },
        mipLevelCount: 1,
        format: this.format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    };

		for (let chan = 0; chan < this.numChannels; ++chan) {
			let outp = this.outputChannelObjects[chan];
			outp.createTexturesAndViews(this.device, this.destTextureDescriptor);
 	 	}
	 }

	// Lazily create depth texture for 3D rendering
	ensureDepthTexture() {
		if (this.depthTexture) return;
		this.depthTexture = this.device.createTexture({
			label: 'depthTexture',
			size: { width: this.canvas.width, height: this.canvas.height },
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		});
		this.depthTextureView = this.depthTexture.createView();
	}

	async setupHydra() {
			if (trace) console.timeStamp("setupHydra");
	      // Step 1: Check for WebGPU support
      if (!navigator.gpu) {
        console.error("WebGPU is not supported on this browser.");
        return;
      }

      // Step 2: Use external device if provided, otherwise create our own
      if (this.externalDevice) {
        this.device = this.externalDevice;
        console.log("wgslHydra: Using shared external GPUDevice");
      } else {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          console.error("Failed to get GPU adapter.");
          return;
        }

        const hasBGRA8unormStorage = adapter.features.has('bgra8unorm-storage');
        this.device = await adapter.requestDevice({
          requiredFeatures: hasBGRA8unormStorage ? ['bgra8unorm-storage'] : [],
        });
      }

			// The fboRenderer is used to copy the results of our efforts to the final display canvas.
			this.fboRenderer = new FBOToCanvas(this.canvas, this.device);
			this.fbo4Renderer = new FBO4ToCanvas(this.canvas, this.device);

			// setup the WebGPU context this Hydra will use.
      this.format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: this.format,
        alphaMode: "opaque",   //premultiplied / opaque
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
      });

    this.dummyTexture = await this.device.createTexture({
    size: [320, 240],
    format: this.format, // was "rgba8unorm"
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });

		// ------------------------------------------------------------------------------
		// create shared bind group layout for time, resolution, mouse, spriteUV, spriteGrid.
		this.sharedBindGroupLayout = this.device.createBindGroupLayout({
			label: "",
  		entries: [
    	{
      	binding: 0, // Binding index for time.
     	  visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	buffer: { type: "uniform" }, // Resource type
    	},
    	{
      	binding: 1, // Binding index "resolution"
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	buffer: { type: "uniform" }, // Resource type
    	},
    	{
      	binding: 2, // Binding index "mouse"
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	buffer: { type: "uniform" }, // Resource type
    	},
    	{
      	binding: 3, // Binding index "u_spriteUV"
     	  visibility: GPUShaderStage.FRAGMENT,
      	buffer: { type: "uniform" },
    	},
    	{
      	binding: 4, // Binding index "u_spriteGrid"
     	  visibility: GPUShaderStage.FRAGMENT,
      	buffer: { type: "uniform" },
    	},
  		],
		});

// Create the shared uniform buffer for time
		this.timeUniformBuffer = this.device.createBuffer({
  			label: "time uniform buffer",
  			size: 4, // 32-bit float is 4 bytes
  			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		// Create a typed array to hold the float value for time
		this.timeUniformValues = new Float32Array(1); // Array of 1 float

// Create the shared uniform buffer for resolution
		this.resolutionUniformBuffer = this.device.createBuffer({
  			label: "resolution uniform buffer",
  			size: 8, // 2 x 32-bit float
  			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.resolutionUniformValues = new Float32Array(2);

// Create the shared uniform buffer for mouse
		this.mouseUniformBuffer = this.device.createBuffer({
  			label: "mouse uniform buffer",
  			size: 8, // 2 x 32-bit float
  			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.mouseUniformValues = new Float32Array(2); // Array of 2 float

// Create the shared uniform buffer for spriteUV (vec4)
		this.spriteUVUniformBuffer = this.device.createBuffer({
  			label: "spriteUV uniform buffer",
  			size: 16, // 4 x 32-bit float
  			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.spriteUVUniformValues = new Float32Array([0, 0, 1, 1]); // Default: full texture

// Create the shared uniform buffer for spriteGrid (vec2)
		this.spriteGridUniformBuffer = this.device.createBuffer({
  			label: "spriteGrid uniform buffer",
  			size: 8, // 2 x 32-bit float
  			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.spriteGridUniformValues = new Float32Array([1, 1]); // Default: 1x1 grid

		this.sharedBindGroup = this.device.createBindGroup({
			 label: "shared bind group",
  	   layout: this.sharedBindGroupLayout,
  		 entries: [
    	{
      binding: 0,
      resource: { buffer: this.timeUniformBuffer }, // Resource for the binding
    	},
 			{
			binding: 1,
      resource: { buffer: this.resolutionUniformBuffer }, // Resource for the binding
			},
      {
      binding: 2,
      resource: { buffer: this.mouseUniformBuffer }, // Resource for the binding
    	},
      {
      binding: 3,
      resource: { buffer: this.spriteUVUniformBuffer },
    	},
      {
      binding: 4,
      resource: { buffer: this.spriteGridUniformBuffer },
    	}
     ],
		});



		// ------------------------------------------------------------------------------
		// Setup dest FBO and views for each channel:
		//

	 this.createOutputTextures();

	 // create a vertex shader for all
	 this.vertexShaderModule = this.device.createShaderModule({ label: "wgslvertex", code: vertexShaderCode });
	 // Setup the renderer that goes from an fbo to final screen.
	 await this.fboRenderer.initializeFBOdrawing();
	 await this.fbo4Renderer.initializeFBOdrawing();

	 if (trace) console.timeStamp("setup", "setupHydra", undefined, "wgsl-hydra", "hydra", "primary");

	}


		// ------------------------------------------------------------------------------
		// set up a output render chain for a given channel number, uniforms list, and fragment shader string
		//
  async setupHydraChain(chan, uniforms, shader) {
  		if (trace) console.timeStamp("setupHydraChain");
			const rpe = this.renderPassInfo[chan];
			rpe.reset();
			rpe.outputObject = this.outputChannelObjects[chan];
  		rpe.uniformList = uniforms;
			this.generateUniformDeclarations(chan); // bindGroupHeader[chan]
			rpe.fragmentShaderSource = vertexPrefix + fragPrefix + rpe.bindGroupHeader +  shader; //  + this.fragPrefix
			
			//console.log(this.fragmentShaderSource[chan]);

      // Step 5: Create fragment shader module
      rpe.fragmentShaderModule = this.device.createShaderModule({ label: "wgslsfrag", code: rpe.fragmentShaderSource });

		// Create BindGroupLayouts for our each of our BindGroups

		// We then use those BindGroupLayouts to concoct a Pipeline Layout we can give the Pipeline proper.
   	   rpe.pipelineLayout = this.device.createPipelineLayout({
          bindGroupLayouts: [this.sharedBindGroupLayout, rpe.bindGroupLayout],
      });

      // Step 6: Set up the render pipeline for this channel
      	rpe.pipeline = this.device.createRenderPipeline({
       	label: 'pipeline ' + chan,
        vertex: {
          module: this.vertexShaderModule,
          entryPoint: "main",
        },
        fragment: {
          module: rpe.fragmentShaderModule,
          entryPoint: "main",
          targets: [{ format: this.format }],
        },
        primitive: {
          topology: "triangle-list",
        },
        layout: rpe.pipelineLayout
      });

			this.createSamplerOrBuffersForChan(chan);

	    if (trace) console.timeStamp("hydraChain", "setupHydraChain", undefined, "wgsl-hydra", "hydra", "secondary-light");
   }

	// ------------------------------------------------------------------------------
	// Setup a sprite render chain with optional custom geometry and vertex shader
	//
	async setupSpriteChain(chan, spriteLevel, config) {
		if (trace) console.timeStamp("setupSpriteChain");
		const { uniforms, fragShader, vertexWgsl, vertexUniforms, rawVerts, blendMode, primitive, has3D,
			hasExplicitUVs, hasFaceIds, uvs, faceIds, sprite } = config;

		const rpe = this.renderPassInfo[chan];
		rpe.outputObject = this.outputChannelObjects[chan];

		// Create or get sprite entry
		let spe = rpe.sprites.get(spriteLevel);
		if (!spe) {
			spe = new SpritePassEntry(chan, spriteLevel);
			rpe.sprites.set(spriteLevel, spe);
		} else {
			spe.reset();
		}

		spe.uniformList = uniforms;
		spe.blendMode = blendMode || 'normal';
		spe.hasCustomGeometry = rawVerts !== null && rawVerts !== undefined;
		spe.hasExplicitUVs = hasExplicitUVs || false;
		spe.hasFaceIds = hasFaceIds || false;
		spe.sprite = sprite || null;

		// Generate uniform declarations for fragment shader
		this.generateSpriteUniformDeclarations(spe);

		// Build fragment shader source
		spe.fragmentShaderSource = vertexPrefix + fragPrefix + spe.bindGroupHeader + fragShader;
		spe.fragmentShaderModule = this.device.createShaderModule({
			label: `frag_c${chan}_s${spriteLevel}`,
			code: spe.fragmentShaderSource
		});

		// Setup vertex shader and buffer
		if (spe.hasCustomGeometry && vertexWgsl) {
			// Custom vertex shader with vertex buffer
			spe.vertexWgsl = vertexWgsl;
			spe.vertexUniforms = vertexUniforms || [];
			spe.has3D = has3D || false;
			spe.vertexShaderModule = this.device.createShaderModule({
				label: `vert_c${chan}_s${spriteLevel}`,
				code: vertexWgsl
			});

			// Create vertex buffer from raw vertices (reshape to vec3)
			const verts = this.reshapeToVec3(rawVerts, spe.has3D);
			spe.vertexCount = verts.length;
			const vertexData = new Float32Array(verts.flat());
			spe.vertexBuffer = this.device.createBuffer({
				label: `vertbuf_c${chan}_s${spriteLevel}`,
				size: vertexData.byteLength,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
			this.device.queue.writeBuffer(spe.vertexBuffer, 0, vertexData);

			// Create UV buffer if explicit UVs provided
			if (spe.hasExplicitUVs && uvs && uvs.length > 0) {
				const uvData = new Float32Array(uvs);
				spe.uvBuffer = this.device.createBuffer({
					label: `uvbuf_c${chan}_s${spriteLevel}`,
					size: uvData.byteLength,
					usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				});
				this.device.queue.writeBuffer(spe.uvBuffer, 0, uvData);
			}

			// Create faceId buffer if faceIds provided
			if (spe.hasFaceIds && faceIds && faceIds.length > 0) {
				const faceIdData = new Float32Array(faceIds);
				spe.faceIdBuffer = this.device.createBuffer({
					label: `faceidbuf_c${chan}_s${spriteLevel}`,
					size: faceIdData.byteLength,
					usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				});
				this.device.queue.writeBuffer(spe.faceIdBuffer, 0, faceIdData);
			}

			// Setup vertex uniform buffer if needed
			if (spe.vertexUniforms.length > 0) {
				this.setupVertexUniforms(spe);
			}
		} else {
			// Use default fullscreen vertex shader
			spe.vertexShaderModule = this.vertexShaderModule;
			spe.vertexCount = 6;
		}

		// Build pipeline layout
		const bindGroupLayouts = [this.sharedBindGroupLayout, spe.bindGroupLayout];
		if (spe.vertexBindGroupLayout) {
			bindGroupLayouts.push(spe.vertexBindGroupLayout);
		}
		spe.pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts });

		// Get blend state
		const blendState = BLEND_MODES[spe.blendMode] || BLEND_MODES.normal;

		// Create pipeline
		const pipelineDescriptor = {
			label: `pipeline_c${chan}_s${spriteLevel}`,
			layout: spe.pipelineLayout,
			vertex: {
				module: spe.vertexShaderModule,
				entryPoint: "main",
			},
			fragment: {
				module: spe.fragmentShaderModule,
				entryPoint: "main",
				targets: [{
					format: this.format,
					blend: blendState
				}],
			},
			primitive: {
				topology: "triangle-list",
			},
		};

		// Add vertex buffer layout if custom geometry
		if (spe.hasCustomGeometry) {
			const bufferLayouts = [{
				arrayStride: 12, // 3 floats * 4 bytes (position)
				attributes: [{
					shaderLocation: 0,
					offset: 0,
					format: 'float32x3'
				}]
			}];

			// Add UV buffer layout if explicit UVs
			if (spe.hasExplicitUVs && spe.uvBuffer) {
				bufferLayouts.push({
					arrayStride: 8, // 2 floats * 4 bytes (texcoord)
					attributes: [{
						shaderLocation: 1,
						offset: 0,
						format: 'float32x2'
					}]
				});
			}

			// Add faceId buffer layout if faceIds
			if (spe.hasFaceIds && spe.faceIdBuffer) {
				bufferLayouts.push({
					arrayStride: 4, // 1 float * 4 bytes (faceId)
					attributes: [{
						shaderLocation: 2,
						offset: 0,
						format: 'float32'
					}]
				});
			}

			pipelineDescriptor.vertex.buffers = bufferLayouts;
		}

		// Add depth testing for 3D geometry
		if (spe.has3D) {
			this.ensureDepthTexture();
			pipelineDescriptor.depthStencil = {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'less'
			};
		}

		spe.pipeline = this.device.createRenderPipeline(pipelineDescriptor);

		// Create samplers/buffers for fragment uniforms
		this.createSamplerOrBuffersForSprite(spe);

		if (trace) console.timeStamp("spriteChain", "setupSpriteChain", undefined, "wgsl-hydra", "hydra", "secondary-light");
	}

	// Clear all sprite chains for a channel
	clearSpriteChains(chan) {
		const rpe = this.renderPassInfo[chan];
		if (rpe.sprites) {
			for (const [level, spe] of rpe.sprites) {
				if (spe.vertexBuffer) {
					spe.vertexBuffer.destroy();
				}
				if (spe.uvBuffer) {
					spe.uvBuffer.destroy();
				}
				if (spe.faceIdBuffer) {
					spe.faceIdBuffer.destroy();
				}
				if (spe.vertexUniformBuffer) {
					spe.vertexUniformBuffer.destroy();
				}
			}
			rpe.sprites.clear();
		}
	}

	// Reshape vertex data to vec3 format
	// is3D: explicit flag indicating 3D data (required for ambiguous lengths divisible by both 2 and 3)
	reshapeToVec3(flatArray, is3D = false) {
		const len = flatArray.length;
		const stride = is3D ? 3 : 2;
		const verts = [];
		for (let i = 0; i < len; i += stride) {
			if (is3D) {
				verts.push([flatArray[i], flatArray[i + 1], flatArray[i + 2]]);
			} else {
				verts.push([flatArray[i], flatArray[i + 1], 0.0]);
			}
		}
		return verts;
	}

	// Setup vertex uniform buffer
	setupVertexUniforms(spe) {
		// Calculate buffer size with proper WGSL alignment
		// f32 = 4 bytes (align 4), vec2f = 8 bytes (align 8), vec3f = 12 bytes (align 16)
		let size = 0;
		for (const u of spe.vertexUniforms) {
			if (u.type === 'f32') {
				// Align to 4 bytes
				size = Math.ceil(size / 4) * 4;
				size += 4;
			} else if (u.type === 'vec2f') {
				// Align to 8 bytes
				size = Math.ceil(size / 8) * 8;
				size += 8;
			} else if (u.type === 'vec3f') {
				// Align to 16 bytes (WGSL requirement)
				size = Math.ceil(size / 16) * 16;
				size += 12; // vec3f is 12 bytes but needs 16-byte alignment
			}
		}
		// Align total to 16 bytes
		size = Math.ceil(size / 16) * 16;

		spe.vertexUniformBuffer = this.device.createBuffer({
			label: `vtxunif_c${spe.chan}_s${spe.level}`,
			size: Math.max(size, 16),
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		spe.vertexBindGroupLayout = this.device.createBindGroupLayout({
			label: `vtxbgl_c${spe.chan}_s${spe.level}`,
			entries: [{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: "uniform" }
			}]
		});

		spe.vertexBindGroup = this.device.createBindGroup({
			label: `vtxbg_c${spe.chan}_s${spe.level}`,
			layout: spe.vertexBindGroupLayout,
			entries: [{
				binding: 0,
				resource: { buffer: spe.vertexUniformBuffer }
			}]
		});
	}

	// Generate uniform declarations for a sprite
	generateSpriteUniformDeclarations(spe) {
		let uniInfo = spe.uniformList;
		let bindGroupEntry = "";
		let i = 1;
		let ui = 0;

		spe.channelUniforms = [];

		Object.keys(uniInfo).forEach(key => {
			if (key === 'prevBuffer') return;
			let uniEntry;
			if (key.startsWith("tex")) {
				uniEntry = new uniformTextureListEntry(spe.chan, i, key, uniInfo[key]);
				spe.textureUniforms.push(uniEntry);
				i += uniEntry.indexesUsed;
			} else {
				uniEntry = new uniformValueListEntry(spe.chan, ui, key, uniInfo[key], uniInfo);
				spe.valueUniforms.push(uniEntry);
				ui++;
			}
			spe.channelUniforms.push(uniEntry);
		});

		let ourValues = spe.valueUniforms;
		spe.hasValueUniforms = ourValues.length > 0;
		let bindings = "";
		let bgLayoutentries = [];

		if (spe.hasValueUniforms) {
			let struct = `struct UF {\n`;
			for (let j = 0; j < ourValues.length; ++j) {
				struct = struct + ourValues[j].getStructLineItem();
			}
			struct = struct + `};\n@group(1) @binding(0) var<uniform> uf : UF;\n`;
			spe.structString = struct;
			bindings = struct;
			bgLayoutentries = [{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" }
			}];
		}

		let ourTextureUniforms = spe.textureUniforms;
		for (let j = 0; j < ourTextureUniforms.length; ++j) {
			let aUnif = ourTextureUniforms[j];
			let bgs = aUnif.bindGroupString();
			bindings = bindings + bgs;
			bgLayoutentries.push(...aUnif.getBindGroupLayoutEntries());
		}

		spe.bindGroupLayout = this.device.createBindGroupLayout({
			label: "sprite bg layout " + spe.chan + "_" + spe.level,
			entries: bgLayoutentries
		});
		spe.bindGroupHeader = bindings;
	}

	// Create samplers/buffers for sprite
	createSamplerOrBuffersForSprite(spe) {
		if (spe.hasValueUniforms) {
			spe.valueStructView = new Float32Array(spe.valueUniforms.length);
			spe.valueStructBuffer = this.device.createBuffer({
				size: spe.valueStructView.byteLength,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			});
		}
		let ourUniforms = spe.textureUniforms;
		for (let i = 0; i < ourUniforms.length; ++i) {
			ourUniforms[i].createSamplerOrBuffers(this.device);
		}
	}

	// Fill bind group for sprite
	fillSpriteBindGroup(spe) {
		let allUniforms = spe.channelUniforms;
		if (!allUniforms || allUniforms.length === 0) {
			return {
				label: "spritebg" + spe.chan + "_" + spe.level,
				layout: spe.bindGroupLayout,
				entries: []
			};
		}

		let bga;
		if (spe.hasValueUniforms) {
			this.setSpriteValueUniformValues(spe, this.time);
			this.device.queue.writeBuffer(spe.valueStructBuffer, 0, spe.valueStructView);
			bga = [{ binding: 0, resource: { buffer: spe.valueStructBuffer } }];
		} else {
			bga = [];
		}

		let ourUniforms = spe.textureUniforms;
		for (let i = 0; i < ourUniforms.length; ++i) {
			let aUniform = ourUniforms[i];
			bga.push(...aUniform.getBindGroupEntries(this, this.time));
		}

		return {
			label: "spritebg" + spe.chan + "_" + spe.level,
			layout: spe.bindGroupLayout,
			entries: bga
		};
	}

	setSpriteValueUniformValues(spe, time) {
		let ourUniforms = spe.valueUniforms;
		for (let i = 0; i < ourUniforms.length; ++i) {
			ourUniforms[i].setUniformValues(spe, time);
		}
	}

	// Update vertex uniforms for a sprite
	updateVertexUniforms(spe) {
		if (!spe.vertexUniforms || spe.vertexUniforms.length === 0) return;

		// Calculate total size with alignment (matches setupVertexUniforms)
		let totalSize = 0;
		for (const u of spe.vertexUniforms) {
			if (u.type === 'f32') {
				totalSize = Math.ceil(totalSize / 4) * 4;
				totalSize += 4;
			} else if (u.type === 'vec2f') {
				totalSize = Math.ceil(totalSize / 8) * 8;
				totalSize += 8;
			} else if (u.type === 'vec3f') {
				totalSize = Math.ceil(totalSize / 16) * 16;
				totalSize += 12;
			}
		}
		totalSize = Math.ceil(totalSize / 16) * 16;

		// Create buffer with proper alignment
		const floatData = new Float32Array(Math.max(totalSize / 4, 4));
		let offset = 0;

		for (const u of spe.vertexUniforms) {
			let val = typeof u.value === 'function' ? u.value() : u.value;

			if (u.type === 'f32') {
				// Align to 4 bytes (1 float)
				offset = Math.ceil(offset);
				const v = Array.isArray(val) ? val[0] : val;
				floatData[offset] = typeof v === 'function' ? v() : v;
				offset += 1;
			} else if (u.type === 'vec2f') {
				// Align to 8 bytes (2 floats)
				offset = Math.ceil(offset / 2) * 2;
				const arr = Array.isArray(val) ? val : [val, val];
				floatData[offset] = typeof arr[0] === 'function' ? arr[0]() : arr[0];
				floatData[offset + 1] = typeof arr[1] === 'function' ? arr[1]() : arr[1];
				offset += 2;
			} else if (u.type === 'vec3f') {
				// Align to 16 bytes (4 floats)
				offset = Math.ceil(offset / 4) * 4;
				const arr = Array.isArray(val) ? val : [val, val, val];
				floatData[offset] = typeof arr[0] === 'function' ? arr[0]() : arr[0];
				floatData[offset + 1] = typeof arr[1] === 'function' ? arr[1]() : arr[1];
				floatData[offset + 2] = typeof arr[2] === 'function' ? arr[2]() : arr[2];
				offset += 3;
			}
		}

		this.device.queue.writeBuffer(spe.vertexUniformBuffer, 0, floatData);
	}

		// ------------------------------------------------------------------------------
		// animate function
		//
		async animate(dT) {
			if (trace) console.timeStamp("animate");
			if(oneShot) {
				 if(fired) return;
			   console.log("One Shot is set for requestAnimationFrame");
				 fired = true;
			}
		// Create a master command encoder.
    const commandEncoder = this.device.createCommandEncoder();

		// Setup the universal uniforms
		this.timeUniformValues[0] = this.time += (dT / 1000.0);
   	this.device.queue.writeBuffer(this.timeUniformBuffer, 0, this.timeUniformValues);

		this.resolutionUniformValues[0] = this.canvas.width;
		this.resolutionUniformValues[1] = this.canvas.height;
		this.device.queue.writeBuffer(this.resolutionUniformBuffer, 0, this.resolutionUniformValues);

		this.mouseUniformValues[0] = this.mousePos.x;
		this.mouseUniformValues[1] = this.mousePos.y;
		this.device.queue.writeBuffer(this.mouseUniformBuffer, 0, this.mouseUniformValues);

		// Write sprite uniforms (defaults - could be updated per-sprite later)
		this.device.queue.writeBuffer(this.spriteUVUniformBuffer, 0, this.spriteUVUniformValues);
		this.device.queue.writeBuffer(this.spriteGridUniformBuffer, 0, this.spriteGridUniformValues);

		// For each active channel...
    for (let chan = 0; chan < this.numChannels; ++chan) {
 			const rpe = this.renderPassInfo[chan];

			// Check if we have sprites or legacy pipeline
			const hasSprites = rpe.sprites && rpe.sprites.size > 0;
			const hasLegacyPipeline = rpe.pipeline;

			if (!hasSprites && !hasLegacyPipeline) continue;

		  rpe.outputObject.flipPingPong();

			if (hasSprites) {
				// Render sprites in level order
				const levels = Array.from(rpe.sprites.keys()).sort((a, b) => a - b);

				for (let i = 0; i < levels.length; i++) {
					const level = levels[i];
					const spe = rpe.sprites.get(level);

					// Level 0 clears, others load
					const loadOp = level === 0 ? "clear" : "load";

					const renderPassDescriptor = {
						label: `renderPass_c${chan}_s${level}`,
						colorAttachments: [{
							label: `attachment_c${chan}_s${level}`,
							view: rpe.outputObject.getCurrentTextureView(),
							clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
							loadOp: loadOp,
							storeOp: "store",
						}],
					};

					// Add depth attachment for 3D geometry
					if (spe.has3D && this.depthTextureView) {
						renderPassDescriptor.depthStencilAttachment = {
							view: this.depthTextureView,
							depthClearValue: 1.0,
							depthLoadOp: level === 0 ? 'clear' : 'load',
							depthStoreOp: 'store'
						};
					}

					// Fill bind group for fragment uniforms
					let ubgData = this.fillSpriteBindGroup(spe);
					let ubg = this.device.createBindGroup(ubgData);

					// Update vertex uniforms if needed
					if (spe.vertexUniforms && spe.vertexUniforms.length > 0) {
						this.updateVertexUniforms(spe);
					}

					// Update spriteGrid uniform for this sprite
					if (spe.sprite && spe.sprite.cols && spe.sprite.rows) {
						this.spriteGridUniformValues[0] = spe.sprite.cols;
						this.spriteGridUniformValues[1] = spe.sprite.rows;
					} else {
						this.spriteGridUniformValues[0] = 1;
						this.spriteGridUniformValues[1] = 1;
					}
					this.device.queue.writeBuffer(this.spriteGridUniformBuffer, 0, this.spriteGridUniformValues);

					if (trace) console.timeStamp("spritepass");
					const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
					passEncoder.setPipeline(spe.pipeline);
					passEncoder.setBindGroup(0, this.sharedBindGroup);
					passEncoder.setBindGroup(1, ubg);

					// Set vertex bind group if we have vertex uniforms
					if (spe.vertexBindGroup) {
						passEncoder.setBindGroup(2, spe.vertexBindGroup);
					}

					// Set vertex buffer if custom geometry
					if (spe.hasCustomGeometry && spe.vertexBuffer) {
						passEncoder.setVertexBuffer(0, spe.vertexBuffer);
						// Set UV buffer if explicit UVs
						if (spe.hasExplicitUVs && spe.uvBuffer) {
							passEncoder.setVertexBuffer(1, spe.uvBuffer);
						}
						// Set faceId buffer if faceIds
						if (spe.hasFaceIds && spe.faceIdBuffer) {
							passEncoder.setVertexBuffer(2, spe.faceIdBuffer);
						}
						passEncoder.draw(spe.vertexCount);
					} else {
						passEncoder.draw(6);
					}

					passEncoder.end();

					if (trace) console.timeStamp("sprite draw", "spritepass", undefined, "wgsl-hydra", "hydra", "tertiary");
				}
			} else {
				// Legacy single pipeline rendering
				const renderPassDescriptor = {
					label: "renderPassDescriptor",
					colorAttachments: [{
						label: "canvas textureView attachment " + chan,
						view: rpe.outputObject.getCurrentTextureView(),
						clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
						loadOp: "clear",
						storeOp: "store",
					}],
				};

				let ubgData = await this.fillBindGroup(chan);
				let ubg = await this.device.createBindGroup(ubgData);

				if (trace) console.timeStamp("pass");
				const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
				passEncoder.setPipeline(rpe.pipeline);
				passEncoder.setBindGroup(0, this.sharedBindGroup);
				passEncoder.setBindGroup(1, ubg);
				passEncoder.draw(6);
				passEncoder.end();

				if (trace) console.timeStamp("draw pass", "pass", undefined, "wgsl-hydra", "hydra", "tertiary");
			}
   } // end "chan" loop.
   // Do all the channels now.
    this.device.queue.submit([commandEncoder.finish()]);

    await this.device.queue.onSubmittedWorkDone();
 
    if (this.showQuad) {
			await this.fbo4Renderer.refreshCanvases(
				this.outputChannelObjects[0].getCurrentTexture(),
				this.outputChannelObjects[1].getCurrentTexture(),
				this.outputChannelObjects[2].getCurrentTexture(),
				this.outputChannelObjects[3].getCurrentTexture()
			);
    	}
    else {
    	await this.fboRenderer.refreshCanvas(this.outputChannelObjects[this.outChannel].getCurrentTexture());
		}
    //await this.device.queue.onSubmittedWorkDone();
		if (trace) console.timeStamp("animation", "animate", undefined, "wgsl-hydra", "hydra", "secondary");

	}

	generateUniformDeclarations(chan) {
		const rpe = this.renderPassInfo[chan];
		let uniInfo = rpe.uniformList;

		let bindGroupEntry = "";
		let i = 1;
		let ui = 0;

		rpe.channelUniforms = [];

		Object.keys(uniInfo).forEach(key => {
  			if (key === 'prevBuffer') return;
  			let uniEntry;
  			if (key.startsWith("tex")) {
  				// constructor(chan, index, name, valCallback)
  				uniEntry = new uniformTextureListEntry(chan, i, key, uniInfo[key]);
  				rpe.textureUniforms.push(uniEntry);
  				  			i += uniEntry.indexesUsed;
  			}
  			else {
  				uniEntry = new uniformValueListEntry(chan, ui, key, uniInfo[key], uniInfo);
  				rpe.valueUniforms.push(uniEntry);
  				ui++;
  			}
  			rpe.channelUniforms.push(uniEntry);

  		})

 		let ourUniforms = rpe.channelUniforms;
 		let ourValues = rpe.valueUniforms;
		rpe.hasValueUniforms = ourValues.length > 0;
		let bindings = "";
		let bgLayoutentries = [];
	if (rpe.hasValueUniforms) {
    	// Create the binding struct for the uniform f32 values.
    		let struct = `struct UF {
`;
    		for(let j = 0; j < ourValues.length; ++j) {
    			struct = struct + ourValues[j].getStructLineItem();
    		}
    		struct = struct + `};
    @group(1) @binding(0) var<uniform> uf : UF;
`;
    		rpe.structString = struct;
    		bindings = struct;
    		bgLayoutentries = [{
    			binding: 0,
    			visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
    			buffer: { type: "uniform" } // Resource type
        }];
	} // We had value uniforms

		let ourTextureUniforms = rpe.textureUniforms;
		for(let j = 0; j < ourTextureUniforms.length; ++ j) { // textureUniforms
 			let aUnif = ourTextureUniforms[j];
 			let bgs = aUnif.bindGroupString()
 			bindings = bindings + bgs;
 			bgLayoutentries.push(...aUnif.getBindGroupLayoutEntries());
 		}

		rpe.bindGroupLayout = this.device.createBindGroupLayout({
			label: "bg layout " + chan,
  		entries: bgLayoutentries
  	});
		rpe.bindGroupHeader = bindings;
	}

// called once since we can reuse samplers between frames.
	createSamplerOrBuffersForChan(chan) {
		const rpe = this.renderPassInfo[chan];
		// First handle the struct with the non-texture stuff
		if (rpe.hasValueUniforms) {
    		//rpe.structDefs = makeShaderDataDefinitions(rpe.structString);
    		rpe.valueStructView = new Float32Array(rpe.valueUniforms.length);
    		rpe.valueStructBuffer = this.device.createBuffer({
      		size: rpe.valueStructView.byteLength,
      		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    		});
		}
		// Now make samplers, etc.
		let ourUniforms = rpe.textureUniforms;
		for (let i = 0; i < ourUniforms.length; ++i)
				ourUniforms[i].createSamplerOrBuffers(this.device);
	
	}

	fillBindGroup(chan) {
		const rpe = this.renderPassInfo[chan];
		let allUniforms = rpe.channelUniforms;
		if (!allUniforms || allUniforms.length === 0) {
			return {label: "bg" + chan,
				layout: rpe.bindGroupLayout,
				entries: []
			};
		}

		let bga
		if (rpe.hasValueUniforms) {
			this.setAllValueUniformValues(chan, this.time);
			this.device.queue.writeBuffer(rpe.valueStructBuffer, 0, rpe.valueStructView);
			bga =[{binding: 0, resource: {buffer: rpe.valueStructBuffer}}];
		} else bga = [];

		let ourUniforms = rpe.textureUniforms;
		for (let i = 0; i < ourUniforms.length; ++i) {
			let aUniform = ourUniforms[i];
			bga.push(...aUniform.getBindGroupEntries(this, this.time));
		}
		let bgd = {
			label: "bg" + chan,
			layout: rpe.bindGroupLayout,
			entries: bga
		}
		return bgd;
 }


 	setAllValueUniformValues(chan, time) {
 		const rpe = this.renderPassInfo[chan];
 		let ourUniforms = rpe.valueUniforms;
 		for (let i = 0; i < ourUniforms.length; ++i) {
 			ourUniforms[i].setUniformValues(rpe, time);
 		}
 	}
}

// classes to represent uniforms. textures or f32 values.
class uniformTextureListEntry {
	constructor(chan, index, name, valCallback) {
		this.chan = chan;
		this.index = index;
		this.name = name;
		this.valCallback = valCallback;
		this.indexesUsed = 2;
	}

	indexesUsed() {
		return 2;
	}

	bindGroupString() {
				return `@group(1) @binding(${this.index}) var samp${this.name}: sampler;
 @group(1) @binding(${this.index + 1}) var ${this.name}:  texture_2d<f32>;
`;
		}

	getBindGroupLayoutEntries() {
				let samp =  {
				binding: this.index,
				visibility: GPUShaderStage.FRAGMENT,
					sampler: {
          	type: "filtering",
        	}
    		 };
    		 
    	 let text = {
       	binding: this.index + 1, // Binding index for texture.
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
         },
    		}
				return [samp, text];
		}

	createSamplerOrBuffers(device) {
			this.sampler = device.createSampler();
			return this.sampler;
	}
	
	getBindGroupEntries(renderer) {
		this.cbValue = this.valCallback();
		if (!this.cbValue) {
			this.cbValue = renderer.dummyTexture.createView();
		}
		return [
			{binding: this.index, resource: this.sampler},
			{binding: this.index+1, resource: this.cbValue}
		];
	}
}


class uniformValueListEntry {
	constructor(chan, index, name, valCallback) {
		this.chan = chan;
		this.index = index;
		this.name = name;
		this.valCallback = valCallback;
		this.indexesUsed = 0;
	}



	getBindGroupLayoutEntries() {
    return [{
			binding: this.index,
			visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
			buffer: { type: "uniform" } // Resource type
    }]
	}


  getStructLineItem() {
		return `${this.name} : f32,
`;
  }


	setUniformValues(rpe, time) {
		let argsToCB = {time: time, bpm: 120};
	  this.cbValue = this.valCallback(undefined, argsToCB);
	  if (!this.cbValue || this.cbValue === NaN) {
	  	this.cbValue = 0.0;
	   }
		rpe.valueStructView[this.index] = this.cbValue;
  }
}


export {wgslHydra}