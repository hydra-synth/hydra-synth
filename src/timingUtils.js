
const seq = (arr = []) => ({time}) =>
{
    let speed = arr.speed ? arr.speed : 1
   return arr[Math.floor(time * speed % (arr.length))]
}

export { seq }
