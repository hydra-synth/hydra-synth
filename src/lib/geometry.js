// Geometry helper functions - return VertexSource for chainable transforms
import VertexSource from '../vertex-source.js'

// Equilateral triangle centered at (centerX, centerY)
export function tri(size = 1.0, centerX = 0, centerY = 0) {
  const h = size * Math.sqrt(3) / 2
  const verts = [
    centerX, centerY + h * 2/3,
    centerX - size/2, centerY - h/3,
    centerX + size/2, centerY - h/3
  ]
  return new VertexSource(verts)
}

// Rectangle as two triangles
export function quad(width = 1.0, height = 1.0, centerX = 0, centerY = 0) {
  const hw = width / 2, hh = height / 2
  const verts = [
    // Triangle 1
    centerX - hw, centerY - hh,
    centerX + hw, centerY - hh,
    centerX + hw, centerY + hh,
    // Triangle 2
    centerX - hw, centerY - hh,
    centerX + hw, centerY + hh,
    centerX - hw, centerY + hh
  ]
  return new VertexSource(verts)
}

// Regular polygon with n sides (triangle fan from center)
export function poly(sides, radius = 1.0, centerX = 0, centerY = 0) {
  const verts = []
  for (let i = 0; i < sides; i++) {
    const a1 = (i / sides) * Math.PI * 2 - Math.PI / 2
    const a2 = ((i + 1) / sides) * Math.PI * 2 - Math.PI / 2
    verts.push(centerX, centerY)
    verts.push(centerX + Math.cos(a1) * radius, centerY + Math.sin(a1) * radius)
    verts.push(centerX + Math.cos(a2) * radius, centerY + Math.sin(a2) * radius)
  }
  return new VertexSource(verts)
}

// Circle approximation (polygon with many sides)
export function circle(radius = 1.0, centerX = 0, centerY = 0, segments = 32) {
  return poly(segments, radius, centerX, centerY)
}

// Line as thin quad (for stroke-like rendering)
export function line(x1, y1, x2, y2, thickness = 0.02) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = -dy / len * thickness / 2
  const ny = dx / len * thickness / 2
  const verts = [
    x1 + nx, y1 + ny,
    x1 - nx, y1 - ny,
    x2 - nx, y2 - ny,
    x1 + nx, y1 + ny,
    x2 - nx, y2 - ny,
    x2 + nx, y2 + ny
  ]
  return new VertexSource(verts)
}

// Ring (annulus) - outer circle minus inner circle
export function ring(outerRadius = 1.0, innerRadius = 0.5, centerX = 0, centerY = 0, segments = 32) {
  const verts = []
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2
    const a2 = ((i + 1) / segments) * Math.PI * 2
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2)
    // Two triangles per segment
    verts.push(centerX + cos1 * innerRadius, centerY + sin1 * innerRadius)
    verts.push(centerX + cos1 * outerRadius, centerY + sin1 * outerRadius)
    verts.push(centerX + cos2 * outerRadius, centerY + sin2 * outerRadius)
    verts.push(centerX + cos1 * innerRadius, centerY + sin1 * innerRadius)
    verts.push(centerX + cos2 * outerRadius, centerY + sin2 * outerRadius)
    verts.push(centerX + cos2 * innerRadius, centerY + sin2 * innerRadius)
  }
  return new VertexSource(verts)
}

// 3D Cube - 6 faces, 12 triangles
// Returns 3D vertices with per-face UVs and faceIds
// Face order: front, back, top, bottom, right, left (indices 0-5)
export function cube(size = 0.5) {
  const s = size
  // 8 corners of the cube
  const corners = [
    [-s, -s,  s],  // 0: front-bottom-left
    [ s, -s,  s],  // 1: front-bottom-right
    [ s,  s,  s],  // 2: front-top-right
    [-s,  s,  s],  // 3: front-top-left
    [-s, -s, -s],  // 4: back-bottom-left
    [ s, -s, -s],  // 5: back-bottom-right
    [ s,  s, -s],  // 6: back-top-right
    [-s,  s, -s],  // 7: back-top-left
  ]

  // 6 faces, each as 2 triangles (CCW winding for front-facing)
  // Each face has vertex indices and corresponding UVs
  const faces = [
    { indices: [0, 1, 2, 0, 2, 3], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // front (0)
    { indices: [5, 4, 7, 5, 7, 6], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // back (1)
    { indices: [3, 2, 6, 3, 6, 7], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // top (2)
    { indices: [4, 5, 1, 4, 1, 0], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // bottom (3)
    { indices: [1, 5, 6, 1, 6, 2], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // right (4)
    { indices: [4, 0, 3, 4, 3, 7], uvs: [[0,0], [1,0], [1,1], [0,0], [1,1], [0,1]] },  // left (5)
  ]

  const verts = []
  const uvs = []
  const faceIds = []
  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const face = faces[faceIdx]
    for (let i = 0; i < face.indices.length; i++) {
      verts.push(...corners[face.indices[i]])
      uvs.push(...face.uvs[i])
      faceIds.push(faceIdx)  // Each vertex knows which face it belongs to
    }
  }

  const vs = new VertexSource(verts)
  vs.uvs = uvs  // Store UVs for later use
  vs.faceIds = faceIds  // Store face IDs for per-face materials
  vs.is3D = true
  return vs
}
