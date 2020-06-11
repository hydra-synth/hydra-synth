const HydraShaders = require('./../shader-generator.js')
const shader = new HydraShaders()

let x = shader.eval('osc().out()')
console.log(x.frag, x.uniforms)

let y = shader.eval(`
    let myFunc = () => 4
    osc(myFunc).out()
`)
console.log(y.frag, y.uniforms)
//
// let z = shader.eval(`
//     src(s0).out()
// `)
// console.log(z.frag, z.uniforms)
