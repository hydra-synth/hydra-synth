// to do: transform time rather than values, similar to hydra

var easing = require('./easing-functions.js')

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  init: () => {


    Array.prototype.fast = function(speed) {
      this._speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth) {
      this._smooth = smooth ? smooth : 1
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
      //  console.log(low, high, lowest, highest)
      var newArr = this.map((num) => map(num, lowest, highest, low, high))
      console.log(this, newArr)
      newArr._speed = this._speed
      newArr._smooth = this._smooth
      newArr._ease = this._ease
      return newArr
      //  return this
    }
  },
  getValue: (arr = []) => ({time, bpm}) =>{
      let speed = arr._speed ? arr._speed : 1
      let smooth = arr._smooth ? arr._smooth : 0
      let ease = arr._ease ? arr._ease : easing['linear']
      console.log(smooth)
      let index = time * speed * (bpm / 60)

      // let currValue = arr[Math.floor(index % (arr.length))]
      // let nextValue = currValue
      // if(arr.modifiers.bounce == true){
      //   if(index%arr.length != 0){
      //      if( Math.floor(index/arr.length)%2 == 0) {
      //       let currValue = arr[Math.floor(arr.length - index % (arr.length) )]
      //       let nextValue = arr[Math.floor(arr.length - (index + 1) % (arr.length) )]
      //   //    let _t = (index%1)*smooth
      //       console.log('rev', currValue, nextValue)
      //     } else {
      //       let nextValue = arr[Math.floor((index + 1) % (arr.length))]
      //     }
      //   //  console.log(newArr, Math.floor(index/newArr.length), index/newArr.length)
      //   //  return nextValue*_t + currValue*(1-_t)
      //   }
      // } else {
      //   let nextValue = arr[Math.floor((index + 1) % (arr.length))]
      //     console.log( currValue, nextValue)
      // }
     let currValue = arr[Math.floor(index % (arr.length))]
      let nextValue = arr[Math.floor((index + 1) % (arr.length))]

      let _t = (index%1)*smooth
      let t = ease(_t)
    //  console.log(arr, Math.floor(index/newArr.length), index/newArr.length)
      return nextValue*t + currValue*(1-t)
  }
}
//
// const seq = (arr = []) => ({time, bpm}) =>
// {
//   let speed = arr.speed ? arr.speed : 1
//   let smooth = arr.smooth ? arr.smooth : 0
//   let index = time * speed * (bpm / 60)
//   let currValue = arr[Math.floor(index % (arr.length))]
//   let nextValue = arr[Math.floor((index + 1) % (arr.length))]
//   let _t = (index%1)*smooth
//   return nextValue*_t + currValue*(1-_t)
// }
//
// // ARRAY SMOOTHING
//
// seq = (arr = []) => ({time, bpm}) =>
// {
//   let speed = arr.speed ? arr.speed : 1
//   return arr[Math.floor(time * speed * (bpm / 60) % (arr.length))]
// }
//
//
// smooth = (arr = []) => ({time, bpm}) =>
// {
//   let speed = arr.speed ? arr.speed : 1
//   let index = time * speed * (bpm / 60)
//   let currValue = arr[Math.floor(index % (arr.length))]
//   let nextValue = arr[Math.floor((index + 1) % (arr.length))]
//   let t = index%1
//   // easing
//   // let _t = t
//   let _t = t<.5 ? 2*t*t : -1+(4-2*t)*t
//   let value = nextValue*_t + currValue*(1-_t)
//   // console.log(currValue, nextValue, progress, value)
//   return value
// }
// //
// shape(4, smooth([0.2, 0.4, 0.5, 0.1].fast(1))).out()
//
// bpm = 2
//
// Array.prototype.fast = function(speed) {
//   this.speed = speed
//   return this
// }
//
// // some time to pause at each place, with easing
//
// // fit(0, width)
//
// Array.prototype.fit = function(low = 0, high =1) {
//   console.log(this)
//   //  let low = _low ? _low : 0
//   //  let high = _high ? _high : 1
//   let lowest = Math.min(...this)
//   let highest =  Math.max(...this)
//   console.log(low, high, lowest, highest)
//   return this.map((num) => map(num, lowest, highest, low, high))
//   //  return this
// }
//
// [3, 4, 5].fit()
