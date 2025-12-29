// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

import easing from './easing-functions.js'

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// The '%' operator is a remainder operator, and Javascript lacks a dedicated
// modulo operator. This function is an implementation of the operation
// copied-n-pasted from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder#description
var modulo = (n, d) => {
    return ((n % d) + d) % d;
}

export default {
  init: () => {

    Array.prototype.fast = function(speed = 1) {
      this._speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth = 1) {
      this._smooth = smooth
      return this
    }

    Array.prototype.ease = function(ease = 'linear') {
      if (typeof ease == 'function') {
        this._smooth = 1
        this._ease = ease
      }
      else if (easing[ease]){
        this._smooth = 1
        this._ease = easing[ease]
      }
      return this
    }

    Array.prototype.offset = function(offset = 0.5) {
      this._offset = offset%1.0
      return this
    }

    // Array.prototype.bounce = function() {
    //   this.modifiers.bounce = true
    //   return this
    // }

    Array.prototype.fit = function(low = 0, high =1) {
      let lowest = Math.min(...this)
      let highest =  Math.max(...this)
      var newArr = this.map((num) => map(num, lowest, highest, low, high))
      newArr._speed = this._speed
      newArr._smooth = this._smooth
      newArr._ease = this._ease
      return newArr
    }
  },

  getValue: (arr = []) => ({time, bpm}) =>{
    let speed = arr._speed ? arr._speed : 1
    let smooth = arr._smooth ? arr._smooth : 0
    let index = time * speed * (bpm / 60) + (arr._offset || 0)

    if (smooth!==0) {
      let ease = arr._ease ? arr._ease : easing['linear']
      let _index = index - (smooth / 2)
      // Compute the first value used for the interpolation: wrap _index inside the range [0, arr.length), then round the resulting value towards 0.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // If we wrapped _index inside the range [0, arr.length) using the regular remainder operator, the result would be negative.
      // Passing a negative index to an array returns undefined, which ultimately causes a number of graphical glitches.
      // We need to use the modulo operation to prevent this.
      let currValue = arr[Math.floor(modulo(_index, arr.length))]
      // Compute the second value used for the interpolation, in a similar fashion to 'currValue'.
      // The above reasoning about the choice of the modulo operation applies for 'nextValue', too.
      let nextValue = arr[Math.floor(modulo(_index + 1, arr.length))]
      // Compute the time parameter for the interpolation.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // Assuming 'smooth' is positive, if we wrapped _index in the range [0, 1) using the regular remainder operator, t would become negative as a result.
      // This would cause the final interpolation to assume values inconsistent with the later ones.
      // E.g. [0, 1].smooth() should always generate values between 0 and 1, but the initial values would be negative.
      // We need to use the modulo operation to prevent this.
      let t = Math.min(modulo(_index, 1)/smooth,1)
      return ease(t) * (nextValue - currValue) + currValue
    }
    else {
      const val = arr[Math.floor(index % (arr.length))]
      return arr[Math.floor(index % (arr.length))]
    }
  }
}
