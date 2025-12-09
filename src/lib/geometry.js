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
