/**
 * Renderer Module
 *
 * Exports the renderer interface and available implementations.
 */

export { RendererInterface } from './RendererInterface.js'
export { WebGL1Renderer } from './WebGL1Renderer.js'

// Default renderer
export { WebGL1Renderer as default } from './WebGL1Renderer.js'

/**
 * Create a renderer by name
 * @param {string} name - 'webgl1', 'webgl', or 'auto'
 * @returns {RendererInterface}
 */
export function createRenderer(name = 'webgl1') {
  switch (name.toLowerCase()) {
    case 'webgl1':
    case 'webgl':
    case 'auto':
    default:
      return new WebGL1Renderer()
  }
}
