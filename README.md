### Hydra-Synth

Video synth engine for [hydra](https://github.com/ojack/hydra).

Currently experimental / in-progress.

To install:
```
npm install hydra-synth
```

#### To use:
```
const Hydra = require('hydra-synth')


window.onload = function () {
  const hydra = new Hydra()

  // by default, hydra makes everything global for easy use in live coding.
  // see options to change parameters
  osc().out(o0)
}
```

#### API:
```
hydra = new Hydra([opts])
```
create a new hydra instance

If `opts` is specified, the default options (shown below) will be overridden.



#### Not yet implemented:
- dynamically resize canvas
- add custom canvas, image, or video source
- pass in (json?) chain of functions to render rather than
