const functions = require('./glsl-functions.js')
const fs = require('fs');

let glslFunctions = []


const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: ['vec2 _st']
  },
  'coord': {
    returnType: 'vec2',
    args: ['vec2 _st']
  },
  'color': {
    returnType: 'vec4',
    args: ['vec4 _c0']
  },
  'combine': {
    returnType: 'vec4',
    args: ['vec4 _c0', 'vec4 _c1']
  },
  'combineCoords': {
    returnType: 'vec2',
    args: ['vec2 _st', 'vec4 c0']
  }
}

var output = `module.exports = [
  ${functions.map((transform) => {
    var inputs = transform.inputs
     var res = transform.glsl.split('\n')
    // res.splice(0, 1)
    // res.splice(res.length-1, 1)
    var padded = res.map((str) => `   ${str}`)
    var str = `${padded.join('\n')}`
    return`{
  name: '${transform.name}',
  type: '${transform.type}',
  inputs: [
    ${inputs.map((input) => `{
      type: '${input.type}',
      name: '${input.name}',
      default: ${parseFloat(input.default)},
    }`).join(',\n')}
  ],
  glsl:
\`${str}\`
}`
  }).join(',\n')}
]`

// var output = `module.exports = [
//   ${Object.keys(functions).map((key) => {
// //  console.log(key)
//
//   var inputs = transform.inputs
//   var res = functions[key].glsl.split('\n')
//   res.splice(0, 1)
//   res.splice(res.length-1, 1)
//   var str = `${res.join('\n')}`
//   //   console.log(str)
//   // var str = `testing
//   // hey`
//   var obj = {
//     name: key,
//     type: functions[key].type,
//     inputs: inputs,
//     glsl: str
//   }
//   glslFunctions.push(obj)
// //  console.log('  ')
//   return str
// })}`

fs.writeFileSync('./converted-functions.js', output, 'utf-8')
