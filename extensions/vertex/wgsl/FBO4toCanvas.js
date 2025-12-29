
// Class to manage the drawing of a frame buffer object to a browser canvas.
class FBO4ToCanvas {
	
	constructor (canvas, device) {
		this.canvas = canvas;
		this.device = device;
	  this.context = this.canvas.getContext("webgpu");
	  this.aspect = this.canvas.width / this.canvas.height;
	}


  async setupFromScratch() {

	  // Step 1: Check for WebGPU support
      if (!navigator.gpu) {
        console.error("WebGPU is not supported on this browser.");
        return;
      }

      // Step 2: Request GPU adapter and device
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error("Failed to get GPU adapter.");
        return;
      }

      this.device = await adapter.requestDevice();

			
  }


	async initializeFBOdrawing() {
  	if (!this.device) await this.setupFromScratch();

     // Step 3: Setup canvas and configure context
     //const format = "bgra8unorm"; // normal for MacOS according to 
     const format = navigator.gpu.getPreferredCanvasFormat();
     this.context.configure({
        device: this.device,
        format,
        alphaMode: "opaque",
      });

   const codePrefix = `
	 struct VertexOutput {
  	@builtin(position) position : vec4f,
  	@location(0) texcoord : vec2f,
	 };
   @group(0) @binding(0) var ourSamp0: sampler;
	 @group(0) @binding(1) var ourTex0:  texture_2d<f32>;
   @group(0) @binding(2) var ourSamp1: sampler;
	 @group(0) @binding(3) var ourTex1:  texture_2d<f32>;
   @group(0) @binding(4) var ourSamp2: sampler;
	 @group(0) @binding(5) var ourTex2:  texture_2d<f32>;
	 @group(0) @binding(6) var ourSamp3: sampler;
	 @group(0) @binding(7) var ourTex3:  texture_2d<f32>;
`;
      // Step 4: Define shaders
    const vertexShaderCode = codePrefix + `
        @vertex
        fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var positions = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, -1.0 ),

            vec2<f32>(1.0, -1.0),
            vec2<f32>(-1.0, 1.0),
            vec2<f32>(1.0, 1.0)
          );
         var output : VertexOutput;
         output.position = vec4<f32>( positions[vertexIndex], 0.0, 1);
         output.texcoord = positions[vertexIndex] / 2 + 0.5; // positions are -1.0 to 1.0, texcoords are 0.0 to 1.0.
         return output;
        }
      `;

    const fragmentShaderCode = codePrefix + `
        @fragment
        fn main(ourIn: VertexOutput) -> @location(0) vec4<f32> {
         var uv :vec2<f32>;
         uv = ourIn.texcoord; //* ourStruct.scale + ourStruct.offset;

        var st = vec2<f32>(uv.x, uv.y);
        st = st * vec2<f32>(2.0);
        let q = floor(st).xy*(vec2<f32>(2.0, 1.0));
        let quad : i32 = i32(q.x) + i32(q.y);
        st.x =  st.x + step(1., st.y % 2.0);
        st.y = st.y + step(1., st.x %2.0);
        st = fract(st);

        let val0 = textureSample(ourTex0, ourSamp0, st);
        let val1 = textureSample(ourTex1, ourSamp1, st);
        let val2 = textureSample(ourTex2, ourSamp2, st);
        let val3 = textureSample(ourTex3, ourSamp3, st);
   
        if(quad == 0){ // LLHC
					return val1;
        } else if (quad == 1) { // ULHC
					return val0;
        } else if (quad == 2){ // LRHC
					return val3;
        } else {
  				return val2; // URHC
        }
      }
`;

      // Step 5: Create shader modules
      const vertexShaderModule = this.device.createShaderModule({ label: "vertFBO", code: vertexShaderCode });
      const fragmentShaderModule = this.device.createShaderModule({ label: "fragFBO", code: fragmentShaderCode });

		// We need to create BindGroupLayouts for our each of our BindGroups
		// Each bind group with contain entries for each element within.
		// Bind group for time
		this.textureBindGroupLayout = this.device.createBindGroupLayout({
			label: "FBOtextureBindGroupLayout",
  		entries: [
//  0
     	{
      	binding: 0, // Binding index for sampler.
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
     	  sampler: {
          type: "filtering",
        },
    	},
    	
     	{
      	binding: 1, // Binding index for texture 0 
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
    	},
    	
 // 1
      	{
      	binding: 2, // Binding index for sampler.
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
     	  sampler: {
          type: "filtering",
        },
    	},
    	
     	{
      	binding: 3, // Binding index for texture 1
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
    	},
    	
 // 2
      {
      	binding: 4, // Binding index for sampler.
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
     	  sampler: {
          type: "filtering",
        },
    	},

     	{
      	binding: 5, // Binding index for texture 2
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
    	},
    	
  // 3   	
      	{
      	binding: 6, // Binding index for sampler.
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
     	  sampler: {
          type: "filtering",
        },
    	},
  
     	{
      	binding: 7, // Binding index for texture 3
     	  visibility: GPUShaderStage.FRAGMENT, // Shader stages where this binding is used
      	texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false,
        },
    	},
 
 
  		],
		});

		// We then use those BindGroupLayouts to concoct a Pipeline Layout we can give the Pipeline proper.
   	this.pipelineLayout = this.device.createPipelineLayout({
          bindGroupLayouts: [this.textureBindGroupLayout],
      });

      // Step 6: Set up the render pipeline
      this.pipeline = this.device.createRenderPipeline({
       	label: 'FBOrenderpipeline',
        vertex: {
          module: vertexShaderModule,
          entryPoint: "main",
        },
        fragment: {
          module: fragmentShaderModule,
          entryPoint: "main",
          targets: [{ format }],
        },
        primitive: {
          topology: "triangle-list",
        },
        layout: this.pipelineLayout
      });

 		this.sampler0 = this.device.createSampler();
 		this.sampler1 = this.device.createSampler();
 		this.sampler2 = this.device.createSampler();
 		this.sampler3 = this.device.createSampler();
 		 		 		 		
	 	//this.refreshCanvas(this.sourceTexture);
 }

	refreshCanvases(tex0, tex1, tex2, tex3) {
		// Create binding for our source texture, which may well have changed.
		if (!tex0 || !tex1 || !tex2 || !tex3) return;

		this.textureBindGroup = this.device.createBindGroup({
			 label: "texture bind group",
  	   layout: this.textureBindGroupLayout,
  		 entries: [
      	 {binding: 0, resource: this.sampler0},
    		 {binding: 1, resource: tex0.createView()},
      	 {binding: 2, resource: this.sampler1},
    		 {binding: 3, resource: tex1.createView()},
     	   {binding: 4, resource: this.sampler2},
    		 {binding: 5, resource: tex2.createView()},
      	 {binding: 6, resource: this.sampler3},
    		 {binding: 7, resource: tex3.createView()}	 
     	 ],
		});	

			// Step 7: Create the render pass descriptor (for the output texture).
			const canvasTextureView = this.context.getCurrentTexture().createView();

      this.renderPassDescriptor = {
      	label: "FBOrenderPassDescriptor",
        colorAttachments: [{
          label: "FBO canvas textureView attachment",
          view: canvasTextureView,
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        }],
      };

		// Step 8: create the command encoder, issue commands, and do the actual pass
			// and then do the pass.
			// We may be able to move some of this out of the anim loop?
     const commandEncoder = this.device.createCommandEncoder();
     const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
     passEncoder.setPipeline(this.pipeline);
		 passEncoder.setBindGroup(0, this.textureBindGroup);
     passEncoder.draw(6);  // call our vertex shader 6 times to draw the quad
     passEncoder.end();
     this.device.queue.submit([commandEncoder.finish()]);
		}
};

export {FBO4ToCanvas}