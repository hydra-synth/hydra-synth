# Hydra Vertex Shader Extension

Adds 3D vertex shader capabilities to [hydra-synth](https://hydra.ojack.xyz/), including geometry primitives, lighting, model loading, and WebGPU support.

## Installation

### WebGL Mode (works with vanilla hydra-synth)

```javascript
// In hydra editor or your own setup
await import('https://your-host.com/vertex/index.js')
  .then(m => m.install(window.hydraSynth))

// Now use 3D features
osc(10).out(o0, sphere().perspective(60).rotateY(() => time))
```

### WebGPU Mode (experimental, better performance)

```javascript
import { createHydra } from 'hydra-vertex-extension'

const hydra = await createHydra({
  useWGSL: true,  // Enable WebGPU
  makeGlobal: true
})

// Same API as WebGL mode
osc(10).out(o0, sphere().perspective(60).rotateY(() => time))
```

## Features

### Geometry Primitives

| Function | Description |
|----------|-------------|
| `tri(size)` | Triangle |
| `quad(size)` | Quad/rectangle |
| `poly(sides, size)` | Regular polygon |
| `circle(radius, segments)` | Circle |
| `ring(inner, outer, segments)` | Ring/annulus |
| `line(points)` | Line strip |
| `cube(size)` | 3D cube |
| `sphere(radius, segments)` | 3D sphere |
| `plane(width, height)` | 3D plane |
| `torus(radius, tube, segments)` | 3D torus |
| `cylinder(radius, height, segments)` | 3D cylinder |
| `cone(radius, height, segments)` | 3D cone |

### Model Loading

```javascript
// Load GLB/GLTF models
loadGlb('https://example.com/model.glb').then(model => {
  osc(10).out(o0, model.rotateY(() => time).perspective(45))
})

// Load OBJ models
loadObj('https://example.com/model.obj').then(model => {
  solid(1, 0, 0).out(o0, model.scale(0.5))
})
```

### Vertex Transforms

Chain these on geometry:

```javascript
sphere()
  .rotateX(angle)      // Rotate around X axis
  .rotateY(angle)      // Rotate around Y axis
  .rotateZ(angle)      // Rotate around Z axis
  .scale(x, y, z)      // Scale geometry
  .translate(x, y, z)  // Move geometry
  .perspective(fov)    // Apply perspective projection
  .grid(nx, ny, nz, spacing)  // Create grid of instances
```

### Lighting Functions

```javascript
osc(10)
  .diffuse(lightX, lightY, lightZ)     // Diffuse lighting
  .specular(lightX, lightY, lightZ, shininess)  // Specular highlights
  .fresnel(power, bias)                // Fresnel rim lighting
  .out(o0, sphere().perspective(60))
```

### Sprite Layers

Multiple geometry layers with blending:

```javascript
// Level 0 clears, level 1+ composites
solid(1, 0, 0).out(o0, cube(), { level: 0 })
solid(0, 1, 0).out(o0, sphere(), { level: 1, blend: 'add' })
```

Blend modes: `'normal'`, `'add'`, `'multiply'`, `'screen'`

### Varying Proxy (v)

Access vertex shader data in fragment shaders:

```javascript
// Use vertex normal for coloring
solid(v.normal.x, v.normal.y, v.normal.z)
  .out(o0, sphere().perspective(60))

// Available: v.position, v.normal, v.uv, v.depth, v.viewDir
```

## Examples

```javascript
// Spinning cube with oscillator texture
osc(10, 0.1, 1).out(o0, cube().rotateY(() => time).perspective(60))

// Lit sphere
osc(5).diffuse(1, 1, 1).specular(1, 1, 1, 32)
  .out(o0, sphere().perspective(60).rotateY(() => time))

// Load and display 3D model
loadGlb('https://example.com/cat.glb').then(m => {
  osc(10).out(o0, m.scale(2).rotateY(() => time).perspective(45))
})

// Grid of rotating cubes
noise(3).out(o0, cube(0.1).grid(3, 3, 1, 0.3).rotateY(() => time).perspective(60))
```

## API Reference

### `install(hydra)`

Patches an existing hydra-synth instance to add vertex features. Works with vanilla hydra-synth (WebGL).

### `createHydra(options)`

Creates a new hydra instance with vertex extension pre-installed. Supports both WebGL and WebGPU.

Options:
- `useWGSL: boolean` - Enable WebGPU mode (default: false)
- `width, height: number` - Canvas dimensions
- `makeGlobal: boolean` - Expose functions globally (default: true)
- `canvas: HTMLCanvasElement` - Custom canvas element
- `detectAudio: boolean` - Enable audio reactivity

## Browser Support

- **WebGL mode**: All modern browsers
- **WebGPU mode**: Chrome 113+, Edge 113+, Firefox (behind flag)

## License

MIT
