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
| `loadObj(url, options)` | Load OBJ file (async, returns Promise) |

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
| `.scale(x, y, z)` | 3D scale (z defaults to 1) |
| `.offset(x, y, z)` | 3D translate |
| `.perspective(fov, near, far)` | Perspective projection |

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

### Built-in Cube

```javascript
osc(10).out(o0, cube(0.5).rotateY(() => time).perspective(45))
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
