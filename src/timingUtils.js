// some utility functions for managing time within hydra
// to do: add easing functions: https://github.com/bameyrick/js-easing-functions

// accepts a sequence of values as an array
const seq = (arr = []) => ({time, bpm}) =>
{
   let speed = arr.speed ? arr.speed : 1
   return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
}

// base sin oscillation
const sin = (amplitude = 1, period = 0.1, offset = 0, offsetTime = 0) => ({time, bpm}) => {
	return amplitude * Math.sin((time + offsetTime) * period * (bpm / 60)) + offset
}

// continuously increasing
const ramp = (scale = 1, offset = 0) => ({time, bpm}) => (time * scale + offset)

// Utility functions and variables for managing fade in and outs:
// creates a set of variables to store state.
// usage: osc(f0(10, 100)).out() , where there variables are: minimum, maximum, and multiple in time
// call fadeIn(0) to fade in all instances of f0, and fadeOut(0) to fadeOut
function createFades (numFades) {
  // variables containing current state of fade
  const gain = Array(numFades).fill().map(() => ({ progress: 0, dir: 1, mult: 1}))

  // fade function to use as parameter
  const fade = (i) => (min = 0, max = 10, mult = 1) => () => {
  //  console.log("gain", gain)
  	gain[i].progress++
  	if(gain[i].dir > 0) {
  		return Math.min(max, min + gain[i].progress * mult * gain[i].mult)
  	} else {
  		return Math.max(min, max - gain[i].progress * mult * gain[i].mult)
  	}
  }

  // to do: put this code somewhere else
  gain.forEach((gain, index) => {
    window['f'+index] = fade(index)
  })

  window.fadeIn = (index, _mult) => {
  	gain[index] = {
  		progress: 0, dir: 1, mult: _mult ? _mult : 1
  	}
  }
  //
  window.fadeOut = (index, _mult) => {
  	gain[index] = {
  		progress: 0, dir: -1, mult: _mult ? _mult : 1
  	}
  }
}

module.exports = {
  seq: seq,
  sin: sin,
  ramp: ramp,
  createFades: createFades
}
