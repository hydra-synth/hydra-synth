// Structured error types for Hydra
// Allows consumer applications to display user-friendly error messages

export class HydraError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'HydraError'
    this.type = details.type || 'unknown'  // syntax, shader, load, runtime
    this.line = details.line               // Adjusted line number in user code
    this.column = details.column
    this.source = details.source           // The problematic code snippet
    this.suggestion = details.suggestion   // Optional helpful hint
    this.url = details.url                 // For load errors
    this.originalError = details.originalError  // Underlying error if wrapped
  }

  // Format for console display
  toString() {
    let str = `[Hydra ${this.type}] ${this.message}`
    if (this.line != null) {
      str += ` (line ${this.line}${this.column != null ? `:${this.column}` : ''})`
    }
    if (this.suggestion) {
      str += `\n  Suggestion: ${this.suggestion}`
    }
    return str
  }

  // Format for UI display
  toUserMessage() {
    return {
      title: this.type.charAt(0).toUpperCase() + this.type.slice(1) + ' Error',
      message: this.message,
      line: this.line,
      column: this.column,
      suggestion: this.suggestion
    }
  }
}

// Specific error types for common cases

export class SyntaxError extends HydraError {
  constructor(message, details = {}) {
    super(message, { ...details, type: 'syntax' })
    this.name = 'HydraSyntaxError'
  }
}

export class ShaderError extends HydraError {
  constructor(message, details = {}) {
    super(message, { ...details, type: 'shader' })
    this.name = 'HydraShaderError'
  }
}

export class LoadError extends HydraError {
  constructor(message, details = {}) {
    super(message, { ...details, type: 'load' })
    this.name = 'HydraLoadError'
  }
}

export class RuntimeError extends HydraError {
  constructor(message, details = {}) {
    super(message, { ...details, type: 'runtime' })
    this.name = 'HydraRuntimeError'
  }
}

export default HydraError
