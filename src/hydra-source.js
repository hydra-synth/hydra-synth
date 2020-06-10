const Webcam = require('./lib/webcam.js')
const Screen = require('./lib/screenmedia.js')

class HydraSource {
  constructor (opts) {
    this.regl = opts.regl
    this.src = null
    this.dynamic = true
    this.width = opts.width
    this.height = opts.height
    this.tex = this.regl.texture({
      //  shape: [opts.width, opts.height]
      shape: [ 1, 1 ]
    })
    this.pb = opts.pb
  }

  init (opts) {
    if (opts.src) {
      this.src = opts.src
      this.tex = this.regl.texture(this.src)
    }
    if (opts.dynamic) this.dynamic = opts.dynamic
  }

  initCam (index) {
    const self = this
    Webcam(index)
      .then(response => {
        self.src = response.video
        self.dynamic = true
        self.tex = self.regl.texture(self.src)
      })
      .catch(err => console.log('could not get camera', err))
  }

  initVideo (url = '') {
    // const self = this
    const vid = document.createElement('video')
    vid.crossOrigin = 'anonymous'
    vid.autoplay = true
    vid.loop = true
    vid.addEventListener('canplay', () => {
      this.src = vid
      vid.play()
      document.body.appendChild(vid)
      this.tex = this.regl.texture(this.src)
      this.dynamic = true
    })
    vid.src = url
  }

  initImage (url = '') {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.src = url
    img.onload = () => {
      this.src = img
      this.dynamic = false
      this.tex = this.regl.texture(this.src)
    }
  }

  initStream (streamName) {
    //  console.log("initing stream!", streamName)
    let self = this
    if (streamName && this.pb) {
      this.pb.initSource(streamName)

      this.pb.on('got video', function (nick, video) {
        if (nick === streamName) {
          self.src = video
          self.dynamic = true
          self.tex = self.regl.texture(self.src)
        }
      })
    }
  }

  initScreen () {
    const self = this
    Screen()
      .then(function (response) {
        self.src = response.video
        self.tex = self.regl.texture(self.src)
        self.dynamic = true
        //  console.log("received screen input")
      })
      .catch(err => console.log('could not get screen', err))
  }

  resize (width, height) {
    this.width = width
    this.height = height
  }

  clear () {
    if (this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach(track => track.stop())
      }
    }
    this.src = null
    this.tex = this.regl.texture({ shape: [ 1, 1 ] })
  }

  tick (time) {
    //  console.log(this.src, this.tex.width, this.tex.height)
    if (this.src !== null && this.dynamic === true) {
      if (this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
        console.log(
          this.src.videoWidth,
          this.src.videoHeight,
          this.tex.width,
          this.tex.height
        )
        this.tex.resize(this.src.videoWidth, this.src.videoHeight)
      }

      if (this.src.width && this.src.width !== this.tex.width) {
        this.tex.resize(this.src.width, this.src.height)
      }

      this.tex.subimage(this.src)
    }
  }

  getTexture () {
    return this.tex
  }
}

module.exports = HydraSource
