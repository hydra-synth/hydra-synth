// Audio analysis now uses native Web Audio API (instead of Meyda)

class Audio {
  // Bark scale band edges (Hz) - 24 bands (similar to Meyda's numberOfBarkBands)
  static BARK_EDGES = [
    20, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480,
    1720, 2000, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500
  ]
  static BARK_BANDS = 24;

  // Gain correction to be as close as Meyda's analysis
  static GAIN_CORRECTION = 1

  constructor ({
    numBins = 4,
    cutoff = 2,
    smooth = 0.4,
    max = 15,
    scale = 10,
    isDrawing = false,
    parentEl = document.body
  }) {
    this.vol = 0
    this.scale = scale
    this.max = max
    this.cutoff = cutoff
    this.smooth = smooth
    this.setBins(numBins)

    // beat detection from: https://github.com/therewasaguy/p5-music-viz/blob/gh-pages/demos/01d_beat_detect_amplitude/sketch.js
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0, // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0 // keeps track of frames
    }

    this.onBeat = () => {
    //  console.log("beat")
    }

    this.canvas = document.createElement('canvas')
    this.canvas.width = 100
    this.canvas.height = 80
    this.canvas.style.width = "100px"
    this.canvas.style.height = "80px"
    this.canvas.style.position = 'absolute'
    this.canvas.style.right = '0px'
    this.canvas.style.bottom = '0px'
    parentEl.appendChild(this.canvas)

    this.isDrawing = isDrawing
    this.ctx = this.canvas.getContext('2d')
    this.ctx.fillStyle="#DFFFFF"
    this.ctx.strokeStyle="#0ff"
    this.ctx.lineWidth=0.5

    // Native audio analysis replacement for Meyda loudness features
    this.analyser = null
    this.freqData = null
    this.linear = null
    this.specific = new Float32Array(Audio.BARK_BANDS)

    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia({ video: false, audio: true })
        .then((stream) => {
          this.stream = stream
          this.context = new AudioContext()
          const audio_stream = this.context.createMediaStreamSource(stream)
          this.analyser = this.context.createAnalyser()
          this.analyser.fftSize = 2048
          this.analyser.smoothingTimeConstant = 0 // keep custom smoothing implemented below
          this.freqData = new Float32Array(this.analyser.frequencyBinCount)
          this.linear = new Float32Array(this.analyser.frequencyBinCount)
          audio_stream.connect(this.analyser)
        })
        .catch((err) => console.log('ERROR', err))
    }
  }

  detectBeat (level) {
    //console.log(level,   this.beat._cutoff)
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.onBeat()
      this.beat._cutoff = level *1.2
      this.beat._framesSinceBeat = 0
    } else {
      if (this.beat._framesSinceBeat <= this.beat.holdFrames){
        this.beat._framesSinceBeat ++;
      } else {
        this.beat._cutoff *= this.beat.decay
        this.beat._cutoff = Math.max(  this.beat._cutoff, this.beat.threshold);
      }
    }
  }

  tick () {
    if (!this.analyser) return

    // Acquire current spectrum in decibels
    this.analyser.getFloatFrequencyData(this.freqData)

    // Convert dB to linear amplitude and unnormalize by FFT size (to match Meyda's raw FFT magnitudes)
    const fftSize = this.analyser.fftSize
    const binCount = this.freqData.length
    for (let i = 0; i < binCount; i++) {
      this.linear[i] = Math.pow(10, this.freqData[i] / 20) * fftSize
    }

    const nyquist = this.context.sampleRate / 2
    const binWidth = nyquist / binCount

    // Reset specific loudness accumulation (reuse array)
    this.specific.fill(0)

    // Accumulate frequency bins into bark bands
    let barkBandIndex = 0
    for (let i = 0; i < binCount; i++) {
      const freq = i * binWidth
      // Advance bark band index when frequency exceeds current band edge
      while (barkBandIndex < Audio.BARK_EDGES.length - 2 && freq >= Audio.BARK_EDGES[barkBandIndex + 1]) {
        barkBandIndex++
      }
      this.specific[barkBandIndex] += this.linear[i]
    }

    // Apply Meyda's power law for perceptual loudness scaling
    for (let i = 0; i < this.specific.length; i++) {
      this.specific[i] = Math.pow(this.specific[i], 0.23) * Audio.GAIN_CORRECTION
    }

    // Calculate total volume
    let vol = 0
    for (let i = 0; i < this.specific.length; i++) {
      vol += this.specific[i]
    }
    this.vol = vol
    this.detectBeat(this.vol)

    // Reduce specific array to bins with smoothing (combined single loop, no allocations)
    const spacing = Math.floor(this.specific.length / this.bins.length)
    for (let index = 0; index < this.bins.length; index++) {
      // Sum bark bands for this bin
      let sum = 0
      const start = index * spacing
      const end = (index + 1) * spacing
      for (let i = start; i < end; i++) {
        sum += this.specific[i]
      }
      // Apply smoothing using previous bin value
      const prevBin = this.bins[index]
      const smoothed = sum * (1.0 - this.settings[index].smooth) + prevBin * this.settings[index].smooth
      this.bins[index] = smoothed
      // Calculate FFT output
      this.fft[index] = Math.max(0, (smoothed - this.settings[index].cutoff) / this.settings[index].scale)
    }
    if(this.isDrawing) this.draw()
  }

  setCutoff (cutoff) {
    this.cutoff = cutoff
    this.settings = this.settings.map((el) => {
      el.cutoff = cutoff
      return el
    })
  }

  setSmooth (smooth) {
    this.smooth = smooth
    this.settings = this.settings.map((el) => {
      el.smooth = smooth
      return el
    })
  }

  setBins (numBins) {
    this.bins = Array(numBins).fill(0)
    this.fft = Array(numBins).fill(0)
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }))
    // to do: what to do in non-global mode?
    this.bins.forEach((bin, index) => {
      window['a' + index] = (scale = 1, offset = 0) => () => (a.fft[index] * scale + offset)
    })
  //  console.log(this.settings)
  }

  setScale(scale){
    this.scale = scale
    this.settings = this.settings.map((el) => {
      el.scale = scale
      return el
    })
  }

  setMax(max) {
    this.max = max
    console.log('set max is deprecated')
  }
  hide() {
    this.isDrawing = false
    this.canvas.style.display = 'none'
  }

  show() {
    this.isDrawing = true
    this.canvas.style.display = 'block'

  }

  draw () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    var spacing = this.canvas.width / this.bins.length
    var scale = this.canvas.height / (this.max * 2)
  //  console.log(this.bins)
    this.bins.forEach((bin, index) => {

      var height = bin * scale

     this.ctx.fillRect(index * spacing, this.canvas.height - height, spacing, height)

  //   console.log(this.settings[index])
     var y = this.canvas.height - scale*this.settings[index].cutoff
     this.ctx.beginPath()
     this.ctx.moveTo(index*spacing, y)
     this.ctx.lineTo((index+1)*spacing, y)
     this.ctx.stroke()

     var yMax = this.canvas.height - scale*(this.settings[index].scale + this.settings[index].cutoff)
     this.ctx.beginPath()
     this.ctx.moveTo(index*spacing, yMax)
     this.ctx.lineTo((index+1)*spacing, yMax)
     this.ctx.stroke()
    })


    /*var y = this.canvas.height - scale*this.cutoff
    this.ctx.beginPath()
    this.ctx.moveTo(0, y)
    this.ctx.lineTo(this.canvas.width, y)
    this.ctx.stroke()
    var yMax = this.canvas.height - scale*this.max
    this.ctx.beginPath()
    this.ctx.moveTo(0, yMax)
    this.ctx.lineTo(this.canvas.width, yMax)
    this.ctx.stroke()*/
  }
}

export default Audio
