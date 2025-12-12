// Sprite Sheet Test
// Run with: npm run dev, then load index.html?test=spritesheet

export function testSpriteSheet(hydra) {
  const { spriteSheet, src, osc, noise, quad, s0, o0, o1, time, render } = hydra

  // Create a 4x4 test grid (generate from dev/assets/generate-test-grid.html)
  // Expected: 256x256 PNG with 64x64 cells numbered 0-15

  console.log('=== Sprite Sheet Test ===')

  // Test 1: Basic spriteSheet creation
  const sheet = spriteSheet(s0, 4, 4)
  console.log('Created 4x4 sprite sheet:', sheet)
  console.log('Total cells:', sheet.total) // Should be 16

  // Test 2: UV bounds calculation
  for (let i = 0; i < 4; i++) {
    const bounds = sheet.getUVBounds(i)
    console.log(`Cell ${i} UV bounds:`, bounds)
  }
  // Cell 0 should be: { uMin: 0, vMin: 0, uMax: 0.25, vMax: 0.25 }
  // Cell 1 should be: { uMin: 0.25, vMin: 0, uMax: 0.5, vMax: 0.25 }

  // Test 3: Picker creation
  const staticPick = sheet.pick(5)
  console.log('Static picker (cell 5):', staticPick)
  console.log('Picker UV bounds:', staticPick.getUVBounds())

  // Test 4: Lambda picker
  let testFrame = 0
  const animatedPick = sheet.pick(() => Math.floor(testFrame / 10) % 16)
  console.log('Animated picker:', animatedPick)
  testFrame = 50
  console.log('Animated picker at frame 50:', animatedPick.getUVBounds())

  // Test 5: Shader code generation
  console.log('GLSL transform:\n', sheet.getGlslTransform())
  console.log('WGSL transform:\n', sheet.getWgslTransform())

  // Test 6: fromModel picker
  const modelPick = sheet.fromModel()
  console.log('Model picker:', modelPick)
  console.log('Model picker UV bounds:', modelPick.getUVBounds())

  console.log('=== Tests Complete ===')

  // Visual test (uncomment when image is loaded):
  // s0.initImage('assets/test-grid-4x4.png')
  // src(s0).out(o0) // Should show full grid

  // To test sprite picking visually, we need fragment shader integration
  // For now, just show that the library is loaded and working
  osc(10, 0.1, 1.5).out(o0)

  return { sheet, staticPick, animatedPick }
}

export default testSpriteSheet
