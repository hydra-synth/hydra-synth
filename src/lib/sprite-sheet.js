// Sprite Sheet Library
// Handles grid-based and atlas sprite sheets for UV mapping

class SpriteSheet {
  constructor(options = {}) {
    // Grid dimensions
    this.cols = options.cols || 1
    this.rows = options.rows || 1
    this.total = this.cols * this.rows

    // Optional: explicit cell definitions for non-uniform atlases
    // Format: [{ x, y, width, height }, ...] in normalized 0-1 coords
    this.cells = options.cells || null

    // Source reference (for Hydra integration)
    this.source = options.source || null

    // Padding between cells (in normalized coords)
    this.padding = options.padding || 0
  }

  // Get UV bounds for a cell index
  // Returns { uMin, vMin, uMax, vMax }
  getUVBounds(index) {
    // Handle lambda indices at call time
    const idx = typeof index === 'function' ? index() : index

    // Clamp to valid range
    const i = Math.floor(idx) % this.total
    const safeIndex = i < 0 ? i + this.total : i

    if (this.cells) {
      // Custom atlas layout
      const cell = this.cells[safeIndex] || this.cells[0]
      return {
        uMin: cell.x,
        vMin: cell.y,
        uMax: cell.x + cell.width,
        vMax: cell.y + cell.height
      }
    }

    // Regular grid layout
    const col = safeIndex % this.cols
    const row = Math.floor(safeIndex / this.cols)

    const cellWidth = (1 - this.padding * (this.cols + 1)) / this.cols
    const cellHeight = (1 - this.padding * (this.rows + 1)) / this.rows

    const uMin = this.padding + col * (cellWidth + this.padding)
    const vMin = this.padding + row * (cellHeight + this.padding)

    return {
      uMin,
      vMin,
      uMax: uMin + cellWidth,
      vMax: vMin + cellHeight
    }
  }

  // Create a picker that returns UV bounds
  // Can be static index, lambda, or Hydra source
  pick(indexOrSource) {
    return {
      sheet: this,
      index: indexOrSource,
      type: 'sprite-pick',

      // Get UV bounds (called per-frame if lambda)
      getUVBounds: () => this.getUVBounds(indexOrSource)
    }
  }

  // Use material ID from vertex data
  fromModel() {
    return {
      sheet: this,
      type: 'sprite-from-model',

      // UV transform happens in shader using vertex materialId
      getUVBounds: () => ({
        uMin: 0, vMin: 0, uMax: 1, vMax: 1,
        useVertexMaterialId: true,
        cols: this.cols,
        rows: this.rows
      })
    }
  }

  // Get GLSL code for UV transformation
  // For use in fragment shader
  getGlslTransform(indexUniform = 'u_spriteIndex') {
    return `
vec2 spriteUV(vec2 uv, float index) {
  float idx = floor(mod(index, ${this.total}.0));
  float col = mod(idx, ${this.cols}.0);
  float row = floor(idx / ${this.cols}.0);
  float cellW = 1.0 / ${this.cols}.0;
  float cellH = 1.0 / ${this.rows}.0;
  return vec2(
    (col + uv.x) * cellW,
    (row + uv.y) * cellH
  );
}
`
  }

  // Get WGSL code for UV transformation
  getWgslTransform(indexUniform = 'u_spriteIndex') {
    return `
fn spriteUV(uv: vec2f, index: f32) -> vec2f {
  let idx = floor(index % ${this.total}.0);
  let col = idx % ${this.cols}.0;
  let row = floor(idx / ${this.cols}.0);
  let cellW = 1.0 / ${this.cols}.0;
  let cellH = 1.0 / ${this.rows}.0;
  return vec2f(
    (col + uv.x) * cellW,
    (row + uv.y) * cellH
  );
}
`
  }
}

// Factory function for simple grid sheets
export function spriteSheet(source, cols = 1, rows = 1, options = {}) {
  return new SpriteSheet({
    source,
    cols,
    rows,
    ...options
  })
}

// Factory for custom atlas layouts (non-uniform cells)
export function spriteAtlas(source, cells, options = {}) {
  return new SpriteSheet({
    source,
    cells,
    ...options
  })
}

// Parse a simple atlas definition file
// Format: "name,x,y,width,height" per line (coords in pixels)
export function parseAtlasDefinition(text, imageWidth, imageHeight) {
  const cells = []
  const names = {}

  const lines = text.trim().split('\n')
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 5) continue

    const [name, x, y, w, h] = parts
    const cell = {
      name,
      x: parseFloat(x) / imageWidth,
      y: parseFloat(y) / imageHeight,
      width: parseFloat(w) / imageWidth,
      height: parseFloat(h) / imageHeight
    }

    names[name] = cells.length
    cells.push(cell)
  }

  return { cells, names }
}

// Parse Aseprite JSON export format
// Returns a SpriteSheet with cells, animations, and frame durations
export function parseAseprite(json, source = null) {
  // Handle string input
  const data = typeof json === 'string' ? JSON.parse(json) : json

  const meta = data.meta || {}
  const size = meta.size || { w: 1, h: 1 }
  const imageWidth = size.w
  const imageHeight = size.h

  // Parse frames - can be object or array format
  const frames = data.frames
  const cells = []
  const names = {}
  const durations = []

  if (Array.isArray(frames)) {
    // Array format: [{ filename, frame, duration }, ...]
    frames.forEach((f, i) => {
      const cell = {
        name: f.filename,
        x: f.frame.x / imageWidth,
        y: f.frame.y / imageHeight,
        width: f.frame.w / imageWidth,
        height: f.frame.h / imageHeight
      }
      names[f.filename] = i
      cells.push(cell)
      durations.push(f.duration || 100)
    })
  } else {
    // Object format: { "name.png": { frame, duration }, ... }
    const keys = Object.keys(frames)
    keys.forEach((key, i) => {
      const f = frames[key]
      const cell = {
        name: key,
        x: f.frame.x / imageWidth,
        y: f.frame.y / imageHeight,
        width: f.frame.w / imageWidth,
        height: f.frame.h / imageHeight
      }
      names[key] = i
      cells.push(cell)
      durations.push(f.duration || 100)
    })
  }

  // Parse animation tags
  const animations = {}
  const frameTags = meta.frameTags || []
  for (const tag of frameTags) {
    animations[tag.name] = {
      from: tag.from,
      to: tag.to,
      direction: tag.direction || 'forward',
      frames: []
    }
    // Build frame list for this animation
    for (let i = tag.from; i <= tag.to; i++) {
      animations[tag.name].frames.push(i)
    }
  }

  // Create the sprite sheet
  const sheet = new SpriteSheet({
    source,
    cells,
    cols: cells.length, // for compatibility
    rows: 1
  })

  // Attach extra metadata
  sheet.names = names
  sheet.durations = durations
  sheet.animations = animations
  sheet.imageWidth = imageWidth
  sheet.imageHeight = imageHeight

  // Add animation picker helper
  sheet.playAnimation = function(animName, speed = 1) {
    const anim = this.animations[animName]
    if (!anim) {
      console.warn(`Animation "${animName}" not found`)
      return this.pick(0)
    }

    return {
      sheet: this,
      animation: anim,
      type: 'sprite-animation',
      getUVBounds: () => {
        // Calculate current frame based on time
        const totalDuration = anim.frames.reduce((sum, i) => sum + this.durations[i], 0)
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        let elapsed = (now * speed) % totalDuration

        // Find current frame
        let frameIndex = anim.from
        for (const i of anim.frames) {
          elapsed -= this.durations[i]
          if (elapsed <= 0) {
            frameIndex = i
            break
          }
        }

        return this.getUVBounds(frameIndex)
      }
    }
  }

  // Pick by name helper
  sheet.pickByName = function(name) {
    const index = this.names[name]
    if (index === undefined) {
      console.warn(`Frame "${name}" not found`)
      return this.pick(0)
    }
    return this.pick(index)
  }

  return sheet
}

// Load Aseprite JSON from URL
export async function loadAseprite(jsonUrl, source = null) {
  const response = await fetch(jsonUrl)
  const json = await response.json()
  return parseAseprite(json, source)
}

export default SpriteSheet
