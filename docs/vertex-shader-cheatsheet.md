# Hydra Vertex Shader Cheat Sheet

## Geometry Helpers

### 2D Shapes

| Function | Description |
|----------|-------------|
| `tri(size, cx, cy)` | Triangle |
| `quad(width, height, cx, cy)` | Rectangle |
| `poly(sides, radius, cx, cy)` | Regular polygon |
| `circle(radius, cx, cy, segments)` | Filled circle |
| `ring(outerR, innerR, cx, cy, segs)` | Donut shape |
| `line(x1, y1, x2, y2, thickness)` | Line segment |

### 3D Shapes

| Function | Description |
|----------|-------------|
| `cube(size)` | 3D cube with per-face UVs and faceIds |
| `sphere(radius, segments)` | UV sphere |
| `plane(width, height, segsW, segsH)` | Subdivided plane |
| `torus(majorR, minorR, segs, tubeSegs)` | Donut/ring |
| `cylinder(radius, height, segs)` | Cylinder with caps |
| `cone(radius, height, segs)` | Cone with base |
| `loadObj(url, options)` | Load OBJ file (async) |
| `loadGlb(url, options)` | Load GLB file with animations (async) |

All return `VertexSource`, chainable with transforms.
2D coordinates are NDC: -1 to 1, center is (0,0).
3D models are auto-normalized to fit in a unit cube.

---

## Chainable Transforms (GPU, animated)

### 2D Transforms

| Transform | Description |
|-----------|-------------|
| `.rotate(angle)` | Radians, supports lambda |
| `.scale(x, y)` | Uniform if y omitted |
| `.offset(x, y)` | Translate position |
| `.translate(x, y)` | Alias for offset |

### 3D Transforms

| Transform | Description |
|-----------|-------------|
| `.rotateX(angle)` | Rotate around X axis |
| `.rotateY(angle)` | Rotate around Y axis |
| `.rotateZ(angle)` | Rotate around Z axis |
| `.scale(x, y, z)` | 3D scale (uniform if only x given) |
| `.offset(x, y, z)` | 3D translate |
| `.perspective(fov, near, far)` | Perspective projection |
| `.animate(clipName, timeFunc)` | Skeletal animation (GLB models) |

### Animation Examples

```javascript
// 2D
tri(0.3).rotate(() => time)
poly(5, 0.4).scale(() => 0.5 + Math.sin(time) * 0.3)
ring(0.3, 0.2).offset(() => Math.sin(time) * 0.5, () => Math.cos(time) * 0.5)

// 3D
cube(0.5).rotateY(() => time).rotateX(() => time * 0.3).perspective(45)
loadObj('model.obj').then(m => m.scale(0.6).rotateY(() => time).perspective(45))
```

---

## Immediate Transforms (CPU, geometry duplication)

| Transform | Description |
|-----------|-------------|
| `.mirror('x' \| 'y' \| 'xy')` | Mirror geometry |
| `.repeat(nx, ny, spacing)` | Grid of copies |

### Example

```javascript
// 4 triangles in a grid
tri(0.2).repeat(2, 2, 0.6)
```

---

## out() API

```javascript
source.out(output, geometry, config)
```

### Config Options

| Option | Values | Default |
|--------|--------|---------|
| `level` | 0, 1, 2, ... | 0 |
| `blend` | `'normal'`, `'add'`, `'multiply'`, `'screen'` | `'normal'` |
| `primitive` | `'triangles'`, `'lines'`, etc. | `'triangles'` |

### Shorthand Forms

```javascript
osc().out()                              // Fullscreen to o0
osc().out(o1)                            // Fullscreen to o1
osc().out(o0, tri(0.3))                  // Geometry, level 0
osc().out(o0, tri(0.3), { level: 1 })    // Geometry, level 1
```

---

## Sprite Levels

| Level | Behavior |
|-------|----------|
| 0 | Clears framebuffer, draws geometry (or fullscreen) |
| 1+ | Composites over previous levels using blend mode |

### Layering Example

```javascript
osc(10).out(o0)                                                 // L0: background
noise(5).out(o0, tri(0.4), { level: 1, blend: 'add' })          // L1: triangle
gradient().out(o0, poly(6, 0.3), { level: 2, blend: 'screen' }) // L2: hexagon
```

---

## Blend Modes

| Mode | Effect |
|------|--------|
| `'normal'` | Standard alpha blending |
| `'add'` | Additive (brighter, glowy) |
| `'multiply'` | Darkens, color mixing |
| `'screen'` | Lightens, inverse multiply |

---

## Texture Behavior

Textures **fill the shape** - UV coordinates are normalized to the geometry bounds.

| Behavior | Description |
|----------|-------------|
| Texture fills shape | Full texture visible within geometry |
| Transforms affect both | Rotating geometry rotates the texture with it |
| Screen-independent | Texture doesn't depend on screen position |

### Example: Webcam in rotating triangle

```javascript
s0.initCam()
src(s0).out(o0, tri(0.5).rotate(() => time), { level: 1 })
// Face rotates WITH the triangle
```

---

## Quick Recipes

### Orbiting Shape

```javascript
osc(20).out(o0, circle(0.2).offset(
  () => Math.sin(time) * 0.5,
  () => Math.cos(time) * 0.5
), { level: 1, blend: 'add' })
```

### Pulsing Polygon

```javascript
noise(10).out(o0, poly(5, 0.3).scale(
  () => 0.8 + Math.sin(time * 3) * 0.2
), { level: 1 })
```

### Spinning Ring

```javascript
voronoi(8).out(o0, ring(0.4, 0.25).rotate(
  () => time
), { level: 1, blend: 'screen' })
```

### Multiple Copies

```javascript
osc(30).out(o0, tri(0.15).repeat(3, 3, 0.5), { level: 1, blend: 'add' })
```

### Mirrored Geometry

```javascript
gradient().out(o0, tri(0.3).mirror('xy').rotate(
  () => time * 0.2
), { level: 1 })
```

---

## 3D Models

### Loading OBJ Files

```javascript
loadObj('model.obj').then(model => {
  osc(10).out(o0, model.scale(0.6).rotateY(() => time).perspective(45))
})

// Blender exports (Z-up) need axis swap
loadObj('blender.obj', { swapYZ: true }).then(model => { ... })
```

### Loading GLB Files (with Animation)

```javascript
loadGlb('character.glb').then(model => {
  // List available animations
  console.log(model.getAnimations())  // [{name: 'Walk', duration: 1.2}, ...]

  // Play animation
  solid(0.9, 0.7, 0.5)
    .diffuse(0, 1, 0, 0.3)
    .out(o0, model.animate('Walk', () => time)
      .scale(0.8)
      .rotateY(() => time * 0.2)
      .perspective(45))
})

// Dynamic clip switching
const clips = model.getAnimations()
let currentClip = 0
model.animate(() => clips[currentClip].name, () => time)
```

### Built-in Shapes

```javascript
osc(10).out(o0, cube(0.5).rotateY(() => time).perspective(45))
osc(10).out(o0, sphere(0.5).rotateY(() => time).perspective(45))
osc(10).out(o0, torus(0.4, 0.15).rotateX(() => time).perspective(45))
```

---

## Lighting

### Lighting Functions

| Function | Description |
|----------|-------------|
| `.diffuse(lx, ly, lz, ambient)` | Lambertian diffuse lighting |
| `.fresnel(power, intensity)` | Rim/edge lighting effect |
| `.specular(lx, ly, lz, shininess, intensity)` | Phong specular highlights |

### Examples

```javascript
// Basic diffuse lighting (light from front-top-right)
solid(0.9, 0.7, 0.5).diffuse(0.3, 0.6, 0.8, 0.3).out(o0, model.perspective(45))

// Rim lighting effect
osc(10).fresnel(3, 0.5).out(o0, sphere(0.5).perspective(45))

// Combined lighting
solid(1, 0.5, 0.2)
  .diffuse(0.5, 1, 0.3, 0.2)
  .add(solid(1, 1, 1).specular(0.5, 1, 0.3, 32, 0.5))
  .out(o0, model.perspective(45))
```

---

## Vertex Data Access (v proxy)

Access vertex attributes in fragment shaders for custom effects:

| Property | Type | Description |
|----------|------|-------------|
| `v.position` | vec3 | Vertex position |
| `v.normal` | vec3 | Model-space normal |
| `v.worldNormal` | vec3 | World-space normal (after transforms) |
| `v.tangent` | vec3 | Tangent vector (for normal mapping) |
| `v.bitangent` | vec3 | Bitangent vector |
| `v.depth` | float | Normalized depth (0=near, 1=far) |
| `v.color` | vec4 | Vertex color (if present) |

### Examples

```javascript
// Use normal for coloring
solid(v.worldNormal.x, v.worldNormal.y, v.worldNormal.z)
  .out(o0, sphere(0.5).perspective(45))

// Depth-based fog
osc(10).mult(solid(1,1,1), v.depth).out(o0, model.perspective(45))

// Custom rim lighting using view direction
solid(1, 0.5, 0).brightness(v.normal.z).out(o0, model.perspective(45))
```

---

## Sprite Sheets

Map different sprite cells to different faces of a 3D model using materials.

### Basic Usage

```javascript
s0.initImage('sprites-4x4.png')

loadObj('cube-with-materials.obj').then(model => {
  // Each material (usemtl) maps to a cell: 0→(0,0), 1→(1,0), 4→(0,1)...
  src(s0).out(o0,
    model.scale(0.6).rotateY(() => time).perspective(45),
    { sprite: { cols: 4, rows: 4 } }
  )
})
```

### With Built-in Cube

```javascript
// cube() has faceIds 0-5 for front, back, top, bottom, right, left
s0.initImage('dice.png')  // 4x4 grid with numbers
src(s0).out(o0, cube(0.5).rotateY(() => time).perspective(45), { sprite: { cols: 4, rows: 4 } })
```

---

## Full Example

```javascript
// Psychedelic geometry party
osc(20, 0.03, 1.5).kaleid(6).out(o0)

noise(8, 0.2).colorama(0.3).out(o0, tri(0.35).rotate(
  () => time * 0.5
), { level: 1, blend: 'add' })

gradient(0.5).hue(() => time * 0.1).out(o0, poly(6, 0.25).scale(
  () => 0.8 + Math.sin(time * 2) * 0.2
).offset(-0.35, 0.25), { level: 2, blend: 'screen' })

osc(60, 0.1, 2).thresh(0.5).out(o0, ring(0.2, 0.12).offset(
  () => Math.sin(time) * 0.4,
  () => Math.cos(time) * 0.3
), { level: 3, blend: 'add' })
```
