// singleton class that generates ids to use has unique variable names for variables
// counter.js

function Counter () {
  this.value = 0
  this.increment = () => this.value++
  this.get = () => this.value
  this.new = () => new Counter()
}

const counter = new Counter()

module.exports = counter
