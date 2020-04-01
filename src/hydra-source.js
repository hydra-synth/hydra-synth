const Webcam = require('./lib/webcam.js')
const Screen = require('./lib/screenmedia.js')

class HydraSource  {

  constructor (opts) {
    this.regl = opts.regl
    this.src = null
    this.dynamic = true
    this.width = opts.width
    this.height = opts.height
    this.tex = this.regl.texture({
      shape: [opts.width, opts.height]
    })
    this.pb = opts.pb
  }

  init (opts) {
    if (opts.src) {
      this.src = opts.src
      this.tex = this.regl.texture(this.src)
    }
    if(opts.dynamic) this.dynamic = opts.dynamic
  }

  initCam (index) {
    const self = this
    Webcam(index).then((response) => {
      self.src = response.video
      self.tex = self.regl.texture(self.src)
    })
  }

  initStream (streamName) {
    console.log("initing stream!", streamName)
    let self = this
    if (streamName && this.pb) {
        this.pb.initSource(streamName)

        this.pb.on("got video", function(nick, video){
          if(nick === streamName) {
            self.src = video
            self.tex = self.regl.texture(self.src)
          }
        })

    }
  }

  initScreen () {
    const self = this
    Screen().then(function (response) {
       self.src = response.video
       self.tex = self.regl.texture(self.src)
     //  console.log("received screen input")
     })
  }

  resize (width, height) {
    this.width = width
    this.height = height
  }

  clear () {
    this.src = null
    this.tex = this.regl.texture({
      shape: [this.width, this.height]
    })
  }

  tick (time) {

    if (this.src !== null && this.dynamic === true) {

        if(this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
          this.tex.resize(this.src.videoWidth, this.src.videoHeight)
        }

        this.tex.subimage(this.src)
       //this.tex = this.regl.texture(this.src)
    }
  }

  getTexture () {
    return this.tex
  }
}

module.exports = HydraSource
