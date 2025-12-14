// Geometry helper functions - return VertexSource for chainable transforms
import VertexSource from '../vertex-source.js'

// Parse OBJ file text and return VertexSource
// Supports vertices (v), normals (vn), UVs (vt), faces (f), and materials (usemtl)
// Triangulates quads automatically, normalizes model to fit in a unit cube
// Options:
//   swapYZ: swap Y and Z axes (for Z-up exports like Blender). Default: false (Y-up, WebGL standard)
export function parseObj(objText, options = {}) {
  const { swapYZ = false } = options
  const vertices = []
  const normals = []
  const uvs = []
  const faces = []

  // Material tracking for faceIds
  const materialNames = []
  const materialToId = new Map()
  let currentMaterial = null

  const lines = objText.split('\n')
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts[0] === 'v') {
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])
      // Swap Y and Z if needed (converts Z-up to Y-up)
      vertices.push(swapYZ ? [x, z, y] : [x, y, z])
    } else if (parts[0] === 'vn') {
      const x = parseFloat(parts[1])
      const y = parseFloat(parts[2])
      const z = parseFloat(parts[3])
      normals.push(swapYZ ? [x, z, y] : [x, y, z])
    } else if (parts[0] === 'vt') {
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2])])
    } else if (parts[0] === 'usemtl') {
      // Track material for faceId assignment
      const matName = parts.slice(1).join(' ')
      if (!materialToId.has(matName)) {
        materialToId.set(matName, materialNames.length)
        materialNames.push(matName)
      }
      currentMaterial = materialToId.get(matName)
    } else if (parts[0] === 'f') {
      // Parse face indices - format can be v, v/vt, v/vt/vn, or v//vn
      const faceVerts = []
      const faceUVs = []
      const faceNormals = []
      for (let i = 1; i < parts.length; i++) {
        const indices = parts[i].split('/')
        faceVerts.push(parseInt(indices[0]) - 1)
        if (indices[1]) faceUVs.push(parseInt(indices[1]) - 1)
        if (indices[2]) faceNormals.push(parseInt(indices[2]) - 1)
      }
      faces.push({ verts: faceVerts, uvs: faceUVs, normals: faceNormals, material: currentMaterial })
    }
  }

  // Calculate bounding box
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const v of vertices) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0])
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1])
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2])
  }

  // Center and normalize to fit in unit cube
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const rangeZ = maxZ - minZ
  const maxRange = Math.max(rangeX, rangeY, rangeZ)
  const scale = 1.0 / maxRange  // Fit largest dimension to 1.0

  // Build triangle list from faces (triangulate quads and n-gons)
  const verts = []
  const outNormals = []
  const outUVs = []
  const outFaceIds = []
  const hasNormals = normals.length > 0
  const hasExplicitUVs = uvs.length > 0
  const hasMaterials = materialNames.length > 0

  // Default per-face UVs for quads (when OBJ doesn't have vt coordinates)
  // Maps quad corners to (0,0), (1,0), (1,1), (0,1) so texture fills the face
  const defaultQuadUVs = [[0, 0], [1, 0], [1, 1], [0, 1]]
  // For triangles: (0,0), (1,0), (0.5,1)
  const defaultTriUVs = [[0, 0], [1, 0], [0.5, 1]]

  // Helper to add a vertex with its attributes
  const addVertex = (vertIdx, uv, normalIdx, materialId) => {
    const v = vertices[vertIdx]
    verts.push((v[0] - centerX) * scale)
    verts.push((v[1] - centerY) * scale)
    verts.push((v[2] - centerZ) * scale)
    if (hasNormals && normalIdx !== undefined) {
      const n = normals[normalIdx]
      outNormals.push(n[0], n[1], n[2])
    }
    // Always output UVs (explicit from file or generated per-face)
    outUVs.push(uv[0], uv[1])
    if (hasMaterials) {
      outFaceIds.push(materialId !== null ? materialId : 0)
    }
  }

  for (const face of faces) {
    const fv = face.verts
    const fu = face.uvs
    const fn = face.normals
    const fm = face.material
    if (fv.length === 3) {
      // Triangle
      for (let i = 0; i < 3; i++) {
        const uv = hasExplicitUVs && fu[i] !== undefined ? uvs[fu[i]] : defaultTriUVs[i]
        addVertex(fv[i], uv, fn[i], fm)
      }
    } else if (fv.length >= 4) {
      // Fan triangulation for quads and n-gons
      for (let i = 1; i < fv.length - 1; i++) {
        // For quads, use default UVs if no explicit UVs
        const uv0 = hasExplicitUVs && fu[0] !== undefined ? uvs[fu[0]] : defaultQuadUVs[0]
        const uv1 = hasExplicitUVs && fu[i] !== undefined ? uvs[fu[i]] : defaultQuadUVs[i]
        const uv2 = hasExplicitUVs && fu[i + 1] !== undefined ? uvs[fu[i + 1]] : defaultQuadUVs[i + 1]
        addVertex(fv[0], uv0, fn[0], fm)
        addVertex(fv[i], uv1, fn[i], fm)
        addVertex(fv[i + 1], uv2, fn[i + 1], fm)
      }
    }
  }

  const vs = new VertexSource(verts)
  vs.is3D = true
  if (outNormals.length > 0) vs.normals = outNormals
  if (outUVs.length > 0) vs.uvs = outUVs
  if (outFaceIds.length > 0) {
    vs.faceIds = outFaceIds
    vs.materialNames = materialNames  // Expose material names for debugging/tooling
  }
  return vs
}

// Load OBJ file from URL and return Promise<VertexSource>
// Options:
//   swapYZ: swap Y and Z axes (for Z-up exports like Blender). Default: false (Y-up, WebGL standard)
export async function loadObj(url, options = {}) {
  const response = await fetch(url)
  const text = await response.text()
  return parseObj(text, options)
}

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
