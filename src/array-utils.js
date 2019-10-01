// to do: transform time rather than values, similar to hydra

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

module.exports = {
  init: () => {
    Array.prototype.fast = function(speed) {
      this.speed = speed
      return this
    }

    Array.prototype.smooth = function(smooth) {
      this.smooth = smooth
      return this
    }

    Array.prototype.fit = function(low = 0, high =1) {
      let lowest = Math.min(...this)
      let highest =  Math.max(...this)
      //  console.log(low, high, lowest, highest)
      return this.map((num) => map(num, lowest, highest, low, high))
      //  return this
    }
  },
  getValue: (arr = []) => ({time, bpm}) =>{
      let speed = arr.speed ? arr.speed : 1
      let smooth = arr.smooth ? arr.smooth : 0
      let index = time * speed * (bpm / 60)
      let currValue = arr[Math.floor(index % (arr.length))]
      let nextValue = arr[Math.floor((index + 1) % (arr.length))]
      let _t = (index%1)*smooth
      return nextValue*_t + currValue*(1-_t)
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
