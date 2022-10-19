import formatArguments from './format-arguments.js'

// Add extra functionality to Array.prototype for generating sequences in time
import arrayUtils from './lib/array-utils.js'



// converts a tree of javascript functions to a shader
export default function (transforms) {
    var shaderParams = {
      uniforms: [], // list of uniforms used in shader
      glslFunctions: [], // list of functions used in shader
      fragColor: ''
    }

    var gen = generateGlsl(transforms, shaderParams)('st')
    shaderParams.fragColor = gen
    // remove uniforms with duplicate names
    let uniforms = {}
    shaderParams.uniforms.forEach((uniform) => uniforms[uniform.name] = uniform)
    shaderParams.uniforms = Object.values(uniforms)
    return shaderParams

}


// recursive function for generating shader string from object containing functions and user arguments. Order of functions in string depends on type of function
// to do: improve variable names
function generateGlsl (transforms, shaderParams) {
  // transform function that outputs a shader string corresponding to gl_FragColor
  var fragColor = () => ''
  // var uniforms = []
  // var glslFunctions = []
  transforms.forEach((transform) => {
    var inputs = formatArguments(transform, shaderParams.uniforms.length)
    inputs.forEach((input) => {
      if(input.isUniform) shaderParams.uniforms.push(input)
    })

    // add new glsl function to running list of functions
    if(!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform)

    // current function for generating frag color shader code
    var f0 = fragColor
    if (transform.transform.type === 'src') {
      fragColor = (uv) => `${shaderString(uv, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'coord') {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs, shaderParams)}`)}`
    } else if (transform.transform.type === 'color') {
      fragColor = (uv) =>  `${shaderString(`${f0(uv)}`, transform.name, inputs, shaderParams)}`
    } else if (transform.transform.type === 'combine') {
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
      (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
      (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      var f1 = inputs[0].value && inputs[0].value.transforms ?
      (uv) => `${generateGlsl(inputs[0].value.transforms, shaderParams)(uv)}` :
      (inputs[0].isUniform ? () => inputs[0].name : () => inputs[0].value)
      fragColor = (uv) => `${f0(`${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1), shaderParams)}`)}`


    }
  })
//  console.log(fragColor)
  //  break;
  return fragColor
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString (uv, method, inputs, shaderParams) {
  const str = inputs.map((input) => {
    if (input.isUniform) {
      return input.name
    } else if (input.value && input.value.transforms) {
      // this by definition needs to be a generator, hence we start with 'st' as the initial value for generating the glsl fragment
      return `${generateGlsl(input.value.transforms, shaderParams)('st')}`
    }
    return input.value
  }).reduce((p, c) => `${p}, ${c}`, '')

  return `${method}(${uv}${str})`
}

// merge two arrays and remove duplicates
function mergeArrays (a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }))
}

// check whether array
function contains(object, arr) {
  for(var i = 0; i < arr.length; i++){
    if(object.name == arr[i].name) return true
  }
  return false
}



