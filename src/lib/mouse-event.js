// https://github.com/mikolalysenko/mouse-event

const mouse = {}

function mouseButtons(ev) {
  if(typeof ev === 'object') {
    if('buttons' in ev) {
      return ev.buttons
    } else if('which' in ev) {
      var b = ev.which
      if(b === 2) {
        return 4
      } else if(b === 3) {
        return 2
      } else if(b > 0) {
        return 1<<(b-1)
      }
    } else if('button' in ev) {
      var b = ev.button
      if(b === 1) {
        return 4
      } else if(b === 2) {
        return 2
      } else if(b >= 0) {
        return 1<<b
      }
    }
  }
  return 0
}
mouse.buttons = mouseButtons

function mouseElement(ev) {
  return ev.target || ev.srcElement || window
}
mouse.element = mouseElement

function mouseRelativeX(ev) {
  if(typeof ev === 'object') {
    if('pageX' in ev) {
      return ev.pageX
    }
  }
  return 0
}
mouse.x = mouseRelativeX

function mouseRelativeY(ev) {
  if(typeof ev === 'object') {
    if('pageY' in ev) {
      return ev.pageY
    }
  }
  return 0
}
mouse.y = mouseRelativeY

export default mouse