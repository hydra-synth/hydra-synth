
const seq = (arr = [], speed = 1) => ({time}) => ( arr[Math.floor(time * speed % (arr.length))]
)

export { seq }
