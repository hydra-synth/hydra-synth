// Replacement for the removed 'raf-loop' dependency.
// Usage: const loop = createAnimationLoop(cb); loop.start();
// Provides only start() and stop(), matching existing usage pattern.
export function createAnimationLoop (cb) {
  let rafId = null
  let lastTime = null

  function frame (t) {
    if (rafId == null) return
    const dt = lastTime == null ? 0 : (t - lastTime)
    lastTime = t
    try { cb(dt) } catch (e) { console.warn('animation loop error:', e) }
    rafId = requestAnimationFrame(frame)
  }

  return {
    start () {
      if (rafId != null) return
      if (typeof requestAnimationFrame === 'undefined') return
      lastTime = null
      rafId = requestAnimationFrame(frame)
    },
    stop () {
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
        lastTime = null
      }
    }
  }
}

export default function (cb) { return createAnimationLoop(cb) }
