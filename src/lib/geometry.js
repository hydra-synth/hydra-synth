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
  const colors = []  // Vertex colors (OBJ extension: v x y z r g b)
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
      // OBJ extension: vertex colors as r g b after coordinates
      if (parts.length >= 7) {
        colors.push([parseFloat(parts[4]), parseFloat(parts[5]), parseFloat(parts[6])])
      }
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
  const outColors = []
  const hasNormals = normals.length > 0
  const hasExplicitUVs = uvs.length > 0
  const hasMaterials = materialNames.length > 0
  const hasColors = colors.length === vertices.length  // Must have color per vertex

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
    if (hasColors) {
      const c = colors[vertIdx]
      outColors.push(c[0], c[1], c[2], 1.0)  // RGB + alpha=1
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
  if (outColors.length > 0) vs.colors = outColors
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

// ============================================================================
// GLB/glTF Loader
// ============================================================================

// Parse GLB binary file and return VertexSource
// GLB format: 12-byte header + JSON chunk + BIN chunk
// Options:
//   meshIndex: which mesh to load (default 0)
//   primitiveIndex: which primitive to load (default: all primitives combined)
export function parseGlb(arrayBuffer, options = {}) {
  const { meshIndex = 0, primitiveIndex } = options  // primitiveIndex undefined = load all
  const view = new DataView(arrayBuffer)

  // Parse GLB header (12 bytes)
  const magic = view.getUint32(0, true)
  if (magic !== 0x46546C67) { // "glTF" in little-endian
    throw new Error('Invalid GLB file: bad magic number')
  }
  const version = view.getUint32(4, true)
  if (version !== 2) {
    throw new Error(`Unsupported glTF version: ${version}`)
  }
  // const length = view.getUint32(8, true)

  // Parse chunks
  let jsonChunk = null
  let binChunk = null
  let offset = 12

  while (offset < arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunkData = new Uint8Array(arrayBuffer, offset + 8, chunkLength)

    if (chunkType === 0x4E4F534A) { // JSON
      const decoder = new TextDecoder('utf-8')
      jsonChunk = JSON.parse(decoder.decode(chunkData))
    } else if (chunkType === 0x004E4942) { // BIN
      binChunk = chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength)
    }

    offset += 8 + chunkLength
    // Align to 4-byte boundary
    if (offset % 4 !== 0) offset += 4 - (offset % 4)
  }

  if (!jsonChunk) throw new Error('GLB missing JSON chunk')

  return extractMeshFromGltf(jsonChunk, binChunk, meshIndex, primitiveIndex)
}

// Extract mesh data from glTF JSON and binary buffer
// Combines all primitives in the mesh into a single VertexSource
function extractMeshFromGltf(gltf, binBuffer, meshIndex, primitiveIndex) {
  const mesh = gltf.meshes?.[meshIndex]
  if (!mesh) throw new Error(`Mesh ${meshIndex} not found`)

  // Helper to read accessor data
  const readAccessor = (accessorIndex) => {
    const accessor = gltf.accessors[accessorIndex]
    const bufferView = gltf.bufferViews[accessor.bufferView]
    const componentType = accessor.componentType
    const count = accessor.count
    const type = accessor.type

    // Component counts for each type
    const typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
    const components = typeComponents[type] || 1

    // Get the right typed array constructor
    const TypedArray = {
      5120: Int8Array,    // BYTE
      5121: Uint8Array,   // UNSIGNED_BYTE
      5122: Int16Array,   // SHORT
      5123: Uint16Array,  // UNSIGNED_SHORT
      5125: Uint32Array,  // UNSIGNED_INT
      5126: Float32Array  // FLOAT
    }[componentType]

    if (!TypedArray) throw new Error(`Unsupported component type: ${componentType}`)

    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0)
    const byteStride = bufferView.byteStride || 0

    // If tightly packed, read directly
    if (byteStride === 0 || byteStride === components * TypedArray.BYTES_PER_ELEMENT) {
      return new TypedArray(binBuffer, byteOffset, count * components)
    }

    // Otherwise, handle stride
    const result = new TypedArray(count * components)
    const srcView = new DataView(binBuffer)
    for (let i = 0; i < count; i++) {
      const srcOffset = byteOffset + i * byteStride
      for (let j = 0; j < components; j++) {
        if (TypedArray === Float32Array) {
          result[i * components + j] = srcView.getFloat32(srcOffset + j * 4, true)
        } else if (TypedArray === Uint16Array) {
          result[i * components + j] = srcView.getUint16(srcOffset + j * 2, true)
        } else if (TypedArray === Uint32Array) {
          result[i * components + j] = srcView.getUint32(srcOffset + j * 4, true)
        }
      }
    }
    return result
  }

  // Determine which primitives to load
  const primitives = primitiveIndex !== undefined
    ? [mesh.primitives[primitiveIndex]]
    : mesh.primitives  // Load all primitives if no specific index given

  if (!primitives || primitives.length === 0) {
    throw new Error(`No primitives found in mesh ${meshIndex}`)
  }

  // Accumulate vertices from all primitives
  const verts = []
  const outNormals = []
  const outUVs = []
  const outTangents = []
  const outColors = []
  let hasAnyUVs = false
  let hasAnyNormals = false
  let hasAnyTangents = false
  let hasAnyColors = false

  for (const primitive of primitives) {
    const positionAccessor = primitive.attributes.POSITION
    if (positionAccessor === undefined) continue  // Skip primitives without positions

    const positions = readAccessor(positionAccessor)
    const normals = primitive.attributes.NORMAL !== undefined
      ? readAccessor(primitive.attributes.NORMAL) : null
    const uvs = primitive.attributes.TEXCOORD_0 !== undefined
      ? readAccessor(primitive.attributes.TEXCOORD_0) : null
    // TANGENT is vec4: xyz = tangent direction, w = handedness for bitangent
    const tangents = primitive.attributes.TANGENT !== undefined
      ? readAccessor(primitive.attributes.TANGENT) : null
    // COLOR_0 can be vec3 (RGB) or vec4 (RGBA), we'll normalize to vec4
    const colors = primitive.attributes.COLOR_0 !== undefined
      ? readAccessor(primitive.attributes.COLOR_0) : null
    // Determine if colors are vec3 or vec4
    let colorStride = 0
    if (colors && primitive.attributes.COLOR_0 !== undefined) {
      const colorAccessor = accessors[primitive.attributes.COLOR_0]
      colorStride = colorAccessor.type === 'VEC4' ? 4 : 3
    }

    if (normals) hasAnyNormals = true
    if (uvs) hasAnyUVs = true
    if (tangents) hasAnyTangents = true
    if (colors) hasAnyColors = true

    // Read indices if present
    const indices = primitive.indices !== undefined
      ? readAccessor(primitive.indices) : null

    const addVertex = (idx) => {
      verts.push(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2])
      if (normals) {
        outNormals.push(normals[idx * 3], normals[idx * 3 + 1], normals[idx * 3 + 2])
      }
      if (uvs) {
        outUVs.push(uvs[idx * 2], uvs[idx * 2 + 1])
      }
      if (tangents) {
        // vec4: xyz = tangent, w = handedness
        outTangents.push(tangents[idx * 4], tangents[idx * 4 + 1], tangents[idx * 4 + 2], tangents[idx * 4 + 3])
      }
      if (colors) {
        // Normalize to vec4 (RGBA), default alpha = 1.0
        if (colorStride === 4) {
          outColors.push(colors[idx * 4], colors[idx * 4 + 1], colors[idx * 4 + 2], colors[idx * 4 + 3])
        } else {
          outColors.push(colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2], 1.0)
        }
      }
    }

    if (indices) {
      for (let i = 0; i < indices.length; i++) {
        addVertex(indices[i])
      }
    } else {
      const vertexCount = positions.length / 3
      for (let i = 0; i < vertexCount; i++) {
        addVertex(i)
      }
    }
  }

  if (verts.length === 0) {
    throw new Error('No vertex data found in mesh')
  }

  // Compute bounding box and normalize
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (let i = 0; i < verts.length; i += 3) {
    minX = Math.min(minX, verts[i]); maxX = Math.max(maxX, verts[i])
    minY = Math.min(minY, verts[i + 1]); maxY = Math.max(maxY, verts[i + 1])
    minZ = Math.min(minZ, verts[i + 2]); maxZ = Math.max(maxZ, verts[i + 2])
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const centerZ = (minZ + maxZ) / 2
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const rangeZ = maxZ - minZ
  const maxRange = Math.max(rangeX, rangeY, rangeZ)
  const scale = maxRange > 0 ? 1.0 / maxRange : 1.0

  // Normalize vertices
  for (let i = 0; i < verts.length; i += 3) {
    verts[i] = (verts[i] - centerX) * scale
    verts[i + 1] = (verts[i + 1] - centerY) * scale
    verts[i + 2] = (verts[i + 2] - centerZ) * scale
  }

  // Generate default UVs if model has none (spherical projection)
  if (!hasAnyUVs) {
    for (let i = 0; i < verts.length; i += 3) {
      const x = verts[i], y = verts[i + 1], z = verts[i + 2]
      // Spherical UV mapping
      const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI)
      const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI
      outUVs.push(u, v)
    }
  }

  // Create VertexSource
  const vs = new VertexSource(verts)
  vs.is3D = true
  if (outNormals.length > 0) vs.normals = outNormals
  if (outUVs.length > 0) vs.uvs = outUVs
  if (outTangents.length > 0) vs.tangents = outTangents
  if (outColors.length > 0) vs.colors = outColors

  return vs
}

// Load GLB file from URL and return Promise<VertexSource>
// The returned VertexSource has a .texture property (Image) if the GLB has embedded textures
// Options:
//   meshIndex: which mesh to load (default 0)
//   primitiveIndex: which primitive to load (default: all primitives combined)
//   extractTextures: extract embedded textures (default: true)
export async function loadGlb(url, options = {}) {
  const { extractTextures = true, ...parseOptions } = options
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load GLB from ${url}: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength < 12) {
    throw new Error(`Invalid GLB file from ${url}: file too small (${arrayBuffer.byteLength} bytes)`)
  }
  const model = parseGlb(arrayBuffer, parseOptions)

  // Attach embedded texture to model if available
  if (extractTextures) {
    const textures = await extractGlbTextures(arrayBuffer)
    model.texture = textures[0]?.image || null
    model.textures = textures.map(t => t.image)  // all textures if multiple
  }

  return model
}

// Extract embedded images from GLB as Image objects
// Returns array of { image: HTMLImageElement, index: number }
export async function extractGlbTextures(arrayBuffer) {
  const view = new DataView(arrayBuffer)

  // Parse header
  const magic = view.getUint32(0, true)
  if (magic !== 0x46546C67) throw new Error('Invalid GLB')

  // Find JSON and BIN chunks
  let jsonChunk = null
  let binStart = 0
  let offset = 12

  while (offset < arrayBuffer.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)

    if (chunkType === 0x4E4F534A) { // JSON
      const chunkData = new Uint8Array(arrayBuffer, offset + 8, chunkLength)
      jsonChunk = JSON.parse(new TextDecoder().decode(chunkData))
    } else if (chunkType === 0x004E4942) { // BIN
      binStart = offset + 8
    }

    offset += 8 + chunkLength
    if (offset % 4 !== 0) offset += 4 - (offset % 4)
  }

  if (!jsonChunk || !jsonChunk.images) return []

  // Extract each image
  const textures = []
  for (let i = 0; i < jsonChunk.images.length; i++) {
    const imgDef = jsonChunk.images[i]
    if (imgDef.bufferView === undefined) continue

    const bv = jsonChunk.bufferViews[imgDef.bufferView]
    const imgBytes = new Uint8Array(arrayBuffer, binStart + (bv.byteOffset || 0), bv.byteLength)

    // Detect mime type from magic bytes if not specified
    let mimeType = imgDef.mimeType
    if (!mimeType) {
      if (imgBytes[0] === 0x89 && imgBytes[1] === 0x50) mimeType = 'image/png'
      else if (imgBytes[0] === 0xFF && imgBytes[1] === 0xD8) mimeType = 'image/jpeg'
      else mimeType = 'image/png'
    }

    // Create blob URL and load as Image
    const blob = new Blob([imgBytes], { type: mimeType })
    const url = URL.createObjectURL(blob)

    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })

    textures.push({ image: img, index: i, blobUrl: url })
  }

  return textures
}

// Create a sprite sheet canvas from multiple GLB files
// Returns { canvas, models, cols, rows }
export async function createGlbSpriteSheet(urls, options = {}) {
  const { cellSize = 256 } = options

  // Load all GLBs and extract textures
  const results = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const model = parseGlb(arrayBuffer, options)
    const textures = await extractGlbTextures(arrayBuffer)
    return { model, texture: textures[0]?.image || null }
  }))

  // Calculate grid size
  const count = results.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = cols * cellSize
  canvas.height = rows * cellSize
  const ctx = canvas.getContext('2d')

  // Draw textures into grid
  results.forEach((r, i) => {
    if (r.texture) {
      const col = i % cols
      const row = Math.floor(i / cols)
      ctx.drawImage(r.texture, col * cellSize, row * cellSize, cellSize, cellSize)
    }
  })

  // Assign faceIds to models for sprite picking
  const models = results.map((r, i) => {
    r.model.spriteIndex = i
    return r.model
  })

  return { canvas, models, cols, rows, cellSize }
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
