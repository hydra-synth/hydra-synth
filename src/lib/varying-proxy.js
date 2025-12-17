// Varying Proxy - provides access to vertex shader data in fragment shaders
// Usage: v.normal.z, v.position.xy, v.depth, etc.

// Special class to mark varying references that need backend-specific handling
class VaryingRef {
  constructor(glslName, wgslName) {
    this.glslName = glslName
    this.wgslName = wgslName
    this._isVaryingRef = true  // Marker for detection
  }

  // Default toString returns GLSL name
  toString() {
    return this.glslName
  }
}

// Creates a nested proxy that allows property access like v.normal.z
function createComponentProxy(baseName) {
  return new Proxy({}, {
    get(target, prop) {
      // Handle vec3 swizzles (x, y, z, xyz, xy, etc.)
      // and vec4 swizzles (x, y, z, w, xyzw, rgb, rgba, etc.)
      const validSwizzles = ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a',
        'xy', 'xz', 'yz', 'xyz', 'xyzw',
        'rg', 'rb', 'gb', 'rgb', 'rgba']

      if (typeof prop === 'string') {
        // Return VaryingRef for the full path
        const glslPath = `${baseName}.${prop}`
        const wgslPath = `ourIn.${baseName}.${prop}`
        return new VaryingRef(glslPath, wgslPath)
      }
      return undefined
    }
  })
}

// Main v proxy object
// Provides access to vertex data: v.position, v.normal, v.viewDir, v.depth
const v = new Proxy({}, {
  get(target, prop) {
    switch (prop) {
      case 'position':
        return createComponentProxy('v_position')
      case 'normal':
        return createComponentProxy('v_normal')
      case 'viewDir':
        return createComponentProxy('v_viewDir')
      case 'depth':
        // depth is a float, return VaryingRef directly
        return new VaryingRef('v_depth', 'ourIn.v_depth')
      case 'uv':
        // uv is available as existing varying
        return createComponentProxy('uv')
      case 'faceId':
        // faceId for sprite sheet indexing
        return new VaryingRef('v_faceId', 'ourIn.faceId')
      default:
        console.warn(`Unknown varying property: v.${prop}`)
        return undefined
    }
  }
})

// Helper to check if a value is a VaryingRef
function isVaryingRef(value) {
  return value && value._isVaryingRef === true
}

// Get the appropriate string for the current backend
function getVaryingString(varyingRef, isWGSL) {
  if (!isVaryingRef(varyingRef)) return varyingRef
  return isWGSL ? varyingRef.wgslName : varyingRef.glslName
}

export { v, VaryingRef, isVaryingRef, getVaryingString }
export default v
