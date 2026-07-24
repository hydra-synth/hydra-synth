// Non-error logging, silenced unless the debug option is passed to the
// HydraRenderer constructor (issue #160). Module-level state so that classes
// without a reference to the renderer share the setting.
let enabled = false

export function setDebug (value) {
  enabled = value
}

export function debugLog (...messages) {
  if (enabled) console.log(...messages)
}
