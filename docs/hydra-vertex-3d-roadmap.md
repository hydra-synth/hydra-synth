# Hydra Vertex Shaders / 3D / WebGPU Roadmap

## Current State

Vertex shader support is in progress with geometry helpers (tri, quad, poly, circle, ring, line), GPU transforms (rotate, scale, offset), CPU transforms (mirror, repeat), sprite levels, and blend modes. WebGPU/WGSL backend exists but needs validation before being the primary path.

**Sequencing:** Ship vertex shaders on WebGL first. Keep GLSL and WGSL tracking together as features are added. WebGPU becomes primary once WGSL generator is proven complete.

---

## Recently Implemented: Source-as-Parameter & Noise Variants

### Auto Type Coercion (vec4 → float)

Sources can now be used directly as parameters to any function expecting a float. The `.r` channel is automatically extracted:

```javascript
// Basic: noise drives oscillator frequency
osc(noise(10)).out(o0)

// Deep nesting (FM synthesis style)
osc(40).scale(voronoi(osc(noise(10)))).out(o0)

// Works with chains including coord transforms
osc(src(o0).scale(0.5)).out(o0)
```

**How it works:** In `generate-glsl.js`, when a GlslSource is passed to a float parameter, the generated code wraps it with `.r` extraction. The coercion checks if any transform in the chain produces vec4 (src, color, combine types).

### Channel Extractors

Explicit control over which channel to use:

| Function | Extracts | Use Case |
|----------|----------|----------|
| `.r()`, `.g()`, `.b()`, `.a()` | Single channel | Pick specific channel |
| `.luminance()` | Perceptual brightness | Rec. 709 weighted grayscale |
| `.avg()` | `(r+g+b)/3` | Mathematical mean |
| `.cmax()` | `max(r,g,b)` | Brightest channel |
| `.cmin()` | `min(r,g,b)` | Darkest channel |
| `.clength()` | `length(rgb)` | Vector magnitude |

All extractors have optional `scale` and `offset` parameters:

```javascript
osc(noise(10).luminance(2, 0.5)).out(o0)  // amplified + offset
```

### Noise Variants

Four noise types with different spectral characteristics:

| Function | Spectrum | Character |
|----------|----------|-----------|
| `noise(scale, offset)` | Single octave Simplex | Smooth, blobby |
| `whiteNoise(scale, speed)` | Flat (random) | Harsh static, chunky blocks |
| `pinkNoise(scale, offset)` | 1/f | Natural, organic turbulence |
| `brownNoise(scale, offset)` | 1/f² | Very smooth, clouds/smoke |

**Comparison view:**

```javascript
whiteNoise().out(o0)     // flat - harsh, static
pinkNoise(10).out(o1)    // 1/f - softer, natural
brownNoise(10).out(o2)   // 1/f² - very smooth, clouds
noise().out(o3)          // simplex - single octave, blobby
render()
```

**Implementation notes:**
- White noise uses `floor()` on spatial coords for chunky blocks, smooth time
- Pink noise: 5 octaves with amplitude *= 0.707 (1/√2) per octave
- Brown noise: 5 octaves with amplitude *= 0.5 per octave
- All use sin-based hash for clean randomness (no moiré artifacts)

---

## Tier 1: Both Backends (WebGL + WebGPU)

| Feature | Status | Notes |
|---------|--------|-------|
| Geometry helpers | ✓ Done | tri, quad, poly, circle, ring, line, cube, sphere, plane, torus, cylinder, cone |
| GPU transforms | ✓ Done | rotate, scale, offset, rotateX/Y/Z, perspective |
| CPU transforms | ✓ Done | mirror, repeat |
| Sprite levels + blend | ✓ Done | Painter's algorithm, level 0 clears, 1+ composites |
| Model loading (OBJ) | ✓ Done | OBJ with materials, normals, UVs, auto-normalization |
| Model loading (GLB) | ✓ Done | glTF binary with embedded textures, skeleton, animations |
| Skeletal animation | ✓ Done | CPU skinning, bone hierarchy, animation clips |
| Sprite sheets | ✓ Done | faceId-based cell picking, per-face materials |
| Video matrices | TODO | Composite N sources to one output, index in |
| Displacement mapping | TODO | Sample texture, offset verts in vertex shader |
| Fixed 3D camera | Partial | perspective() transform, needs orbit controls |
| Normals in vertex buffer | ✓ Done | Parsed from OBJ/GLB |
| Basic lighting | ✓ Done | diffuse, fresnel, specular functions |
| Vertex data access | ✓ Done | v proxy for normal, depth, tangent, etc. in fragment shaders |

---

## Tier 2: WebGPU Only (Compute Shaders)

| Feature | Why Compute |
|---------|-------------|
| Vertex generation | Spawn geometry from rules/noise |
| Particle systems | Thousands of points, GPU-side state |
| Physics/simulation | Cloth, fluids, soft body |
| Mesh subdivision | Tessellation on GPU |
| Procedural terrain | Marching cubes, etc. |
| GPU-side audio analysis | FFT without CPU round-trip |

---

## Uber Vertex Struct

Single vertex→fragment interface to avoid pipeline switching:

```wgsl
struct VertexOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) normal: vec3f,
    @location(2) worldPos: vec3f,
    @location(3) @interpolate(flat) spriteIndex: u32,
    @location(4) @interpolate(flat) flags: u32,  // bitfield for future
}
```

**Rationale:** Interpolation cost is negligible for <16 vec4s. Unused fields still interpolate but it's free. One pipeline = no state switching overhead. `flat` on integer fields skips interpolation entirely.

---

## Sprite Sheet / Video Matrix Design

### Sprite Sheets with FaceId (Implemented)

Each face of a 3D model can display a different cell from a sprite sheet atlas, based on the model's material assignments.

```javascript
// Load sprite sheet and model
s0.initImage('sprites-4x4.png')

loadObj('cube-with-materials.obj').then(cube => {
  // Each face shows its material's cell from the 4x4 grid
  // Material 0 → cell 0, Material 1 → cell 1, etc.
  src(s0).out(o0,
    cube.scale(0.6).rotateY(() => time).perspective(45),
    { sprite: { cols: 4, rows: 4 } }
  )
})
```

### How FaceId Mapping Works

1. OBJ `usemtl` lines assign material indices (0, 1, 2, ...) to faces
2. Each vertex gets a `faceId` attribute matching its face's material
3. Fragment shader uses faceId to select sprite cell in row-major order:
   - faceId 0 → cell (0,0), faceId 1 → cell (1,0), faceId 4 → cell (0,1), etc.

### Built-in Cube with Materials

```javascript
// cube() returns a VertexSource with faceIds 0-5 for the 6 faces
src(s0).out(o0,
  cube(0.5).rotateY(() => time).perspective(45),
  { sprite: { cols: 4, rows: 4 } }
)
```

### Video Matrices (TODO)

Composite live sources into a grid on one output, then index like a sprite sheet:

```javascript
src(s0).out(o3, quad(0.5, 0.5, -0.5, -0.5))  // top-left
src(s1).out(o3, quad(0.5, 0.5, 0.5, -0.5), { level: 1 })   // top-right
// ...

// Future: use as sprite sheet
src(o3).out(o0, model, { sprite: { cols: 2, rows: 2 } })
```

### Future: Dynamic Sprite Picking

```javascript
// Pick cell dynamically from Hydra source (not yet implemented)
{ sprite: sheet.pick(noise(3)) }     // sample source to determine cell
```

---

## Model Loading (Implemented)

### OBJ Loader

```javascript
// Load and display a spinning 3D model
loadObj('model.obj').then(model => {
  src(s0).out(o0,
    model.scale(0.6).rotateY(() => time).perspective(45)
  )
})

// With axis swap for Blender exports (Z-up → Y-up)
loadObj('blender-export.obj', { swapYZ: true }).then(model => { ... })
```

### Supported OBJ Features

| Feature | OBJ Syntax | Notes |
|---------|------------|-------|
| Vertices | `v x y z` | Auto-centered and normalized to unit cube |
| Normals | `vn x y z` | Optional, parsed if present |
| UVs | `vt u v` | Optional, auto-generated per-face if missing |
| Faces | `f v/vt/vn` | Triangles and quads (auto-triangulated) |
| Materials | `usemtl name` | Maps to faceId for sprite sheet picking |

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `swapYZ` | `false` | Swap Y and Z axes (Blender Z-up → WebGL Y-up) |

### Vertex Buffer Contents

```
position: vec3     // Auto-normalized to fit unit cube
uv: vec2           // From OBJ or auto-generated per-face
normal: vec3       // From OBJ (optional)
faceId: float      // Material index for sprite sheet picking
```

### GLB Loading (Implemented)

```javascript
loadGlb('character.glb').then(model => {
  // Check available animations
  console.log(model.getAnimations())  // [{name: 'Walk', duration: 1.2}, ...]

  // Play with lighting
  solid(0.9, 0.7, 0.5)
    .diffuse(0.3, 0.6, 0.8, 0.3)
    .out(o0, model.animate('Walk', () => time).scale(0.8).perspective(45))
})
```

### Supported GLB Features

| Feature | Notes |
|---------|-------|
| Meshes | Multiple meshes, auto-normalized to unit cube |
| Skeleton | Joint hierarchy with inverse bind matrices |
| Animations | Translation, rotation, scale keyframes with interpolation |
| Skin weights | Up to 4 bone influences per vertex |

### Animation Viewer Tool

Diagnostic tool for previewing all animations in a GLB:

```
dev/animation-viewer.html?model=path/to/model.glb
```

Controls: Drag=rotate, Scroll=zoom, Space=pause, ←/→=prev/next animation

---

## 3D Camera (Simple)

```javascript
hydra.camera.ortho()                              // default
hydra.camera.perspective(45)                      // FOV degrees
hydra.camera.distance = 3
hydra.camera.rotation = () => [0, time * 0.5, 0]  // animated orbit
```

Start with orbit controls: distance, yaw, pitch. Keep it simple.

---

## Geometry Deformation

Olivia's request. Needs normals in vertex buffer.

```javascript
// Displace vertices by sampling a Hydra source
tri(0.3).displace(src(o1), 0.1)

// Noise-based wobble
poly(32, 0.4).displace(noise(3), 0.05)
```

Vertex shader samples displacement map, offsets position along normal.

---

## Open Questions

- Depth buffer: on by default, or opt-in? Some effects want painter's algorithm
- Multiple UV sets for models?
- Backface culling: default on for 3D, off for 2D?
