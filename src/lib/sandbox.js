// attempt custom evaluation sandbox for hydra functions
// for now, just avoids polluting the global namespace
// should probably be replaced with an abstract syntax tree

export default (parent) => {
  var initialCode = ``

  var sandbox = createSandbox(initialCode)

  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `
    sandbox = createSandbox(initialCode)
  }


  return {
    addToContext: addToContext,
    eval: (code) => sandbox.eval(code)
  }

  function createSandbox (initial) {
    globalThis.eval(initial)
    // optional params
    var localEval = function (code)  {
      globalThis.eval(code)
    }

    // API/data for end-user
    return {
      eval: localEval
    }
  }
}
