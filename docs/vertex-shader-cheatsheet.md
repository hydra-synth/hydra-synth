# Hydra Vertex Shader Cheat Sheet

## Geometry Helpers

| Function | Description |
|----------|-------------|
| `tri(size, cx, cy)` | Triangle |
| `quad(width, height, cx, cy)` | Rectangle |
| `poly(sides, radius, cx, cy)` | Regular polygon |
| `circle(radius, cx, cy, segments)` | Filled circle |
| `ring(outerR, innerR, cx, cy, segs)` | Donut shape |
| `line(x1, y1, x2, y2, thickness)` | Line segment |

All return `VertexSource`, chainable with transforms.
Coordinates are NDC: -1 to 1, center is (0,0).

---

## Chainable Transforms (GPU, animated)

| Transform | Description |
|-----------|-------------|
| `.rotate(angle)` | Radians, supports lambda |
| `.scale(x, y)` | Uniform if y omitted |
| `.offset(x, y)` | Translate position |
| `.translate(x, y)` | Alias for offset |

### Animation Examples

```javascript
tri(0.3).rotate(() => time)
poly(5, 0.4).scale(() => 0.5 + Math.sin(time) * 0.3)
ring(0.3, 0.2).offset(() => Math.sin(time) * 0.5, () => Math.cos(time) * 0.5)
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
