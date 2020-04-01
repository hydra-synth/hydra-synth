// handles code evaluation and attaching relevant objects to global and evaluation contexts

const Sandbox = require('./lib/sandbox.js')
const ArrayUtils = require('./lib/array-utils.js')

class EvalSandbox {
  constructor(parent, makeGlobal) {
    this.makeGlobal = makeGlobal
    this.sandbox = Sandbox(parent)
    this.parent = parent
    var properties = Object.keys(parent)
    properties.forEach((property) => this.add(property))
  }

  add(name) {
    if(this.makeGlobal) window[name] = this.parent[name]
    this.sandbox.addToContext(name, `parent.${name}`)
  }

  eval(code) {
    this.sandbox.eval(code)
  }
}

module.exports = EvalSandbox
