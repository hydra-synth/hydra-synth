var hydraShader = require('./../shader-generator.js')

var shaderGenerator = new hydraShader()

var myShader = shaderGenerator.eval('osc(() => 4).out()')
console.log(myShader)
