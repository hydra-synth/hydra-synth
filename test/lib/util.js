
class DummyOutput {
  constructor () {
    this.passes = []
  }

  renderPasses (passes) {
    this.passes.push(passes)
  }
}

module.exports = {
  DummyOutput
}
