// converts a tree of javascript functions to a shader

module.exports = function (transforms) {
  var shaderParams = {
    uniforms: [], // list of uniforms used in shader
    glslFunctions: [], // list of functions used in shader
    fragColor: ''
  }

  var gen = processTransforms(transforms, shaderParams)('st')
  shaderParams.fragColor = gen
  return shaderParams
}


// recursive function for generating shader string from object containing functions and user arguments. Order of functions in string depends on type of function
// to do: improve variable names
function processTransforms (transforms, shaderParams) {

  // transform function that outputs a shader string corresponding to gl_FragColor
  var fragColor = () => ''
  // var uniforms = []
  // var glslFunctions = []
  transforms.forEach((transform) => {
    var inputs = processArguments(transform, shaderParams)
    inputs.forEach((input) => {
      if(input.isUniform) shaderParams.uniforms.push(input)

    })
    //glFuncts.push(transform.name)

    shaderParams.glslFunctions = mergeArrays(shaderParams.glslFunctions, [transform.name])
    // current function for generating frag color shader code
    var f0 = fragColor
    if (transform.transform.type === 'src') {
      fragColor = (uv) => `${shaderString(uv, transform.name, inputs)}`
    } else if (transform.transform.type === 'coord') {
      fragColor = (uv) => `${f0(`${shaderString(uv, transform.name, inputs)}`)}`
    } else if (transform.transform.type === 'color') {
      fragColor = (uv) =>  `${shaderString(`${f0(uv)}`, transform.name, inputs)}`
    } else if (transform.transform.type === 'combine') {
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      var f1 = (uv) => `${processTransforms(inputs[0].value.transforms, shaderParams)(uv)}`
      fragColor = (uv) => `${shaderString(`${f0(uv)}, ${f1(uv)}`, transform.name, inputs.slice(1))}`
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      var f1 = (uv) => `${processTransforms(inputs[0].value.transforms, shaderParams)(uv)}`
      fragColor = (uv) => `${f0(`${shaderString(`${uv}, ${f1(uv)}`, transform.name, inputs.slice(1))}`)}`
    }
  })

  return fragColor
}



// assemples a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString (uv, method, inputs) {
  var str = ''
  inputs.forEach((input) => {
    str += ', ' + input.name
  })
  return `${method}(${uv}${str})`
}

// merge two arrays and remove duplicates
function mergeArrays (a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }))
}

// convert arrays to this function
const seq = (arr = []) => ({time, bpm}) =>
{
   let speed = arr.speed ? arr.speed : 1
   return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
}


function processArguments (transform, shaderParams) {
  const defaultArgs = transform.transform.inputs
  const userArgs = transform.userArgs
  return defaultArgs.map( (input, index) => {
    var typedArg = {
      value: input.default,
      type: input.type, //
      isUniform: false,
      name: input.name,
    //  generateGlsl: null // function for creating glsl
    }


    // if user has input something for this argument
    if(userArgs.length > index) {
      typedArg.value = userArgs[index]
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
       typedArg.value = (context, props, batchId) => (userArgs[index](props))
        typedArg.isUniform = true
      } else if (userArgs[index].constructor === Array) {
      //  console.log("is Array")
        typedArg.value = (context, props, batchId) => seq(userArgs[index])(props)
        typedArg.isUniform = true
      }
    }

    if(typedArg.type === 'float' && typeof typedArg.value == 'number') {
    //  var newValue = typedArg.value +
      var val = '' + typedArg.value // convert to string
      if(val.indexOf('.') < 0) val += '.'
      typedArg.value = val
    } else if (input.type === 'texture') {
      // typedArg.tex = typedArg.value
      var x = typedArg.value
      typedArg.value = () => (x.getTexture())
      typedArg.isUniform = true
    } else {
      // if passing in a texture reference, when function asks for vec4, convert to vec4
      if (typedArg.value.getTexture && input.type === 'vec4') {
        var x1 = typedArg.value
        typedArg.value = src(x1)
        typedArg.isUniform = false
      }
    }

    // add tp uniform array if is a function that will pass in a different value on each render frame,
    // or a texture/ external source
    if(typedArg.isUniform) {
      typedArg.name += shaderParams.uniforms.length
    //  shaderParams.uniforms.push(typedArg)
    } else {
      typedArg.name = typedArg.value
    }
    return typedArg
  })
}
