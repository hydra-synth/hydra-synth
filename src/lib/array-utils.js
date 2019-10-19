// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

var easing = require('./easing-functions.js')

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  init: () => {


    Array.prototype.fast = function(speed = 1) {
      this._speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth = 1) {
      this._smooth = smooth
      return this
    }

    Array.prototype.ease = function(ease) {
      if(ease && easing[ease]) {
        this._smooth = 1
        this._ease = easing[ease]
      }
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
    let ease = arr._ease ? arr._ease : easing['linear']
    // console.log(smooth)
    let index = time * speed * (bpm / 60)

    let currValue = arr[Math.floor(index % (arr.length))]
    let nextValue = arr[Math.floor((index + 1) % (arr.length))]

    let _t = (index%1)*smooth
    let t = ease(_t)
    //  console.log(arr, Math.floor(index/newArr.length), index/newArr.length)
    return nextValue*t + currValue*(1-t)
  }
}
