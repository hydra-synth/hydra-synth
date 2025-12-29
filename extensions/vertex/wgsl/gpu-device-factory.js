// Singleton factory for shared WebGPU device
// Allows multiple Hydra instances to share textures without copying

let sharedDevice = null;
let sharedAdapter = null;
let initPromise = null;

async function initSharedDevice() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported on this browser.");
  }

  sharedAdapter = await navigator.gpu.requestAdapter();
  if (!sharedAdapter) {
    throw new Error("Failed to get GPU adapter.");
  }

  const hasBGRA8unormStorage = sharedAdapter.features.has('bgra8unorm-storage');
  sharedDevice = await sharedAdapter.requestDevice({
    requiredFeatures: hasBGRA8unormStorage ? ['bgra8unorm-storage'] : [],
  });

  // Handle device loss
  sharedDevice.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);
    sharedDevice = null;
    sharedAdapter = null;
    initPromise = null;
  });

  return sharedDevice;
}

/**
 * Get the shared GPUDevice, creating it if necessary.
 * Multiple Hydra instances using this device can share textures directly.
 */
export async function getSharedDevice() {
  if (sharedDevice) {
    return sharedDevice;
  }

  // Avoid race conditions - only one init at a time
  if (!initPromise) {
    initPromise = initSharedDevice();
  }

  return initPromise;
}

/**
 * Check if a shared device already exists (without creating one)
 */
export function hasSharedDevice() {
  return sharedDevice !== null;
}

/**
 * Get the shared adapter (for feature queries)
 */
export function getSharedAdapter() {
  return sharedAdapter;
}

/**
 * Force release the shared device (for cleanup/testing)
 */
export function releaseSharedDevice() {
  if (sharedDevice) {
    sharedDevice.destroy();
    sharedDevice = null;
    sharedAdapter = null;
    initPromise = null;
  }
}
