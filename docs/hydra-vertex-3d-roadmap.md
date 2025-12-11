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
| Geometry helpers | ✓ Done | tri, quad, poly, circle, ring, line |
| GPU transforms | ✓ Done | rotate, scale, offset (animated via lambdas) |
| CPU transforms | ✓ Done | mirror, repeat |
| Sprite levels + blend | ✓ Done | Painter's algorithm, level 0 clears, 1+ composites |
| Model loading | TODO | OBJ first (simple parser), then glTF |
| Sprite sheets | TODO | Atlas UV math in frag shader |
| Video matrices | TODO | Composite N sources to one output, index in |
| Displacement mapping | TODO | Sample texture, offset verts in vertex shader |
| Fixed 3D camera | TODO | Ortho + perspective, simple orbit controls |
| Normals in vertex buffer | TODO | Required for lighting and displacement |
| Basic lighting | TODO | One directional + ambient |

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

### Sprite Sheets

Pack multiple textures into one atlas, index via UV math in frag shader.

```javascript
s0.initImage('sprites.png')
const sheet = spriteSheet(s0, 4, 4)  // 4x4 grid

// Static pick
osc(10).out(o0, model, { sprite: sheet.pick(3) })

// Animated
osc(10).out(o0, model, { sprite: sheet.pick(() => Math.floor(time * 8) % 16) })

// Driven by Hydra source
noise(2).out(o1)
osc(10).out(o0, model, { sprite: sheet.pick(o1) })
```

### Video Matrices

Composite live sources into a grid on one output, then index like a sprite sheet:

```javascript
src(s0).out(o3, quad(0.5, 0.5, -0.5, -0.5))  // top-left
src(s1).out(o3, quad(0.5, 0.5, 0.5, -0.5), { level: 1 })   // top-right
// ...

const matrix = spriteSheet(o3, 2, 2)
src(o3).out(o0, model, { sprite: matrix.pick(() => midiCC[16]) })
```

### Two Paths to Sprite Index

1. **From vertex:** Model's material ID baked into vertex buffer, passed flat to frag
2. **From Hydra source:** Frag shader samples picker texture, quantizes to index

Frag shader has both available; API chooses which:

```javascript
{ sprite: sheet.fromModel() }        // use vertex materialId
{ sprite: sheet.pick(noise(3)) }     // use dynamic source
```

---

## Model Loading

### Priority Formats

| Format | Pros | Cons |
|--------|------|------|
| OBJ | Trivial parser (~50 lines), universal | No hierarchy, separate .mtl |
| glTF/GLB | Modern standard, embedded textures, good JS libs | More complex |

### Vertex Buffer Contents

```
position: vec3
uv: vec2
normal: vec3
materialId: u32  // maps to sprite sheet index
```

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
