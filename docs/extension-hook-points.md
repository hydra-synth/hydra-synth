# Hydra Extension Hook Points

This document describes the hook points that would be needed to implement vertex shader support (and optionally WebGPU) as an extension rather than a fork.

## Overview

The vertex shader implementation touches several parts of hydra-synth. Rather than forking the entire codebase, these features could potentially be added via extensions if the core library exposed appropriate hook points.

There are two levels of extensibility:

1. **Vertex Shaders (WebGL)** - Additive to existing pipeline, ~5 hook points
2. **WebGPU Backend** - Parallel implementation, ~15 hook points + shader dual-targeting

---

## Vertex Shader Hook Points

These hooks would allow vertex shader support to be implemented as an extension to the existing WebGL/regl renderer.

### 1. GlslSource.out() - Before Render

**Location:** `src/glsl-source.js` line 61

**Current behavior:** Calls `output.render(passes)` with fragment shader passes only.

**Hook needed:** Allow passing geometry data and configuration through to output.

```javascript
// Hook signature
onBeforeRender(output, passes, geometry, config)
// config: { level, blend, primitive, sprite }
```

**Use case:** Extension intercepts .out() calls to handle geometry registration and sprite levels.

---

### 2. Fragment Shader Header - Varying Injection

**Location:** `src/output.js` line 130-135, `src/generate-glsl.js`

**Current behavior:** Fragment shader has fixed header with `varying vec2 uv;`

**Hook needed:** Allow injecting additional varying declarations.

```javascript
// Hook signature
modifyFragmentHeader(headerSource) → modifiedHeader

// Extension would inject:
varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_worldNormal;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying float v_depth;
```

**Use case:** Vertex data needs to be passed to fragment shader via varyings.

---

### 3. Draw Command Creation - Vertex Shader Override

**Location:** `src/output.js` line 544 (regl command creation)

**Current behavior:** Fixed vertex shader, fixed attributes (position only).

**Hook needed:** Allow custom vertex shader and additional attributes.

```javascript
// Hook signature
createDrawCommand(defaultConfig) → modifiedConfig

// defaultConfig contains: { frag, vert, attributes, uniforms, count, ... }
// Extension can override vert, add attributes (normal, uv, tangent, color)
```

**Use case:** 3D geometry needs custom vertex shader with transforms, and additional vertex attributes.

---

### 4. Render Tick - Pre-Frame Processing

**Location:** `src/output.js` line 712-714

**Current behavior:** Just calls draw commands.

**Hook needed:** Pre-render processing for animation buffer updates.

```javascript
// Hook signature
onBeforeTick(output, props)
```

**Use case:** Skeletal animation needs to compute skinning matrices and update vertex buffers each frame.

---

### 5. Hush - Cleanup

**Location:** `src/hydra-synth.js` hush() method

**Current behavior:** Resets outputs to default state.

**Hook needed:** Clean up extension resources.

```javascript
// Hook signature
onHush(output)
```

**Use case:** Clean up sprite registrations, destroy custom vertex buffers.

---

## Implementation Approach

These hooks could be implemented via **prototype patching** rather than requiring changes to hydra-synth core:

```javascript
// Extension wraps existing methods
const originalOut = GlslSource.prototype.out
GlslSource.prototype.out = function(...args) {
  // Pre-hook: parse geometry, modify args
  const result = originalOut.apply(this, args)
  // Post-hook: register sprites, etc.
  return result
}
```

**What Olivia could provide:**
- Documentation of which methods are safe to wrap
- Stable method signatures that won't change
- Access to internal state needed by extensions (e.g., output.regl, output.fbos)

---

## WebGPU Hook Points (Larger Scope)

WebGPU support requires a parallel rendering backend, not just hooks. The branch points are more extensive.

### HydraRenderer (hydra-synth.js)

| Hook Point | Line | Purpose |
|------------|------|---------|
| `renderer.init()` | 160-164 | Initialize WebGL or WebGPU |
| `renderer.resize(w,h)` | 440-441 | Resize framebuffers |
| `renderer.createOutput()` | 634 | Create output with correct backend |
| `renderer.createSource()` | 659 | Create source with texture handling |
| `renderer.setTarget(output)` | 692-701 | Set render target |
| `renderer.tick(dt)` | 721-728 | Frame render |

### Output Class

| Hook Point | Purpose |
|------------|---------|
| `createFramebuffer()` | Backend-specific FBO creation |
| `createBuffer()` | Vertex/index buffer creation |
| `compileShader()` | GLSL or WGSL compilation |
| `draw()` | Issue draw calls |

### Shader Generation

Every shader function in `glsl-functions.js` has both `glsl:` and `wgsl:` implementations (already done in this fork). A clean abstraction would need:

```javascript
{
  name: 'osc',
  glsl: `...GLSL code...`,
  wgsl: `...WGSL code...`,
  // ... other properties
}
```

The generator would select the appropriate version based on backend.

---

## Summary

| Feature | Hook Points | Complexity | Risk to Existing |
|---------|-------------|------------|------------------|
| Vertex Shaders | ~5 | Medium | Low (additive) |
| WebGPU Backend | ~15 + dual shaders | High | Medium (parallel path) |

**Vertex shaders** could realistically be implemented as an extension with cooperation from upstream on stable hook points.

**WebGPU** is better suited as either:
- A core architectural change (renderer abstraction)
- Or a maintained fork (current approach)

---

## Files Modified in This Fork

For reference, the vertex shader implementation touches:

**Core changes:**
- `src/output.js` - Sprite registration, vertex buffers, 3D rendering
- `src/glsl-source.js` - Extended .out() signature
- `src/vertex-source.js` - Vertex shader generation (new file)
- `src/lib/varying-proxy.js` - v.position, v.normal access (new file)
- `src/lib/geometry.js` - Model loaders, primitives (new file)
- `src/hydra-synth.js` - Global function registration

**WebGPU additions:**
- `src/wgsl/*.js` - ~2,300 lines of WebGPU-specific code
- `src/glsl-functions.js` - Added `wgsl:` to all ~70 functions
