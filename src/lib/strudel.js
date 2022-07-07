/*
    Utility functions for using strudel within hydra. 
    (EXPERIMENTAL) Parses all strings as mini notation. 
*/
import { mini } from '@strudel.cycles/mini'

window.mini = mini
const parseStrudel = (pattern) => ({ time, bpm }) => {
    try {
        const start = time * bpm / 60
        // const m = mini(str)
        const m = pattern
        const events = m.queryArc(start, start+ 0.0001)
        if(events.length > 0) {
          //  console.log(typeof events[0].value, events[0].value)
            if(typeof events[0].value === 'number') return events[0].value
        }
        return 0
    } catch (e) {
        console.warn("error within strudel pattern", e)
        return 0
    }
}

window.strudel = parseStrudel

module.exports = {
    parseStrudel: parseStrudel
}