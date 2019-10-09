const getUserMedia = require('getusermedia')
const enumerateDevices = require('enumerate-devices')

module.exports = function (deviceId) {
  return new Promise(function (resolve, reject) {
    enumerateDevices()
    .then(devices => devices.filter(devices => devices.kind === 'videoinput'))
    .then(cameras =>
      {
        let constraints = { audio: false, video: true}
        if(cameras[deviceId]) {
          constraints['video'] = {
            deviceId: { exact: cameras[deviceId].deviceId }
          }
        }
        getUserMedia(constraints, function (err, stream) {
          if(err) {
            reject(err)
          } else {
            const video = document.createElement('video')
          //  video.src = window.URL.createObjectURL(stream)
          video.srcObject = stream
            video.addEventListener('loadedmetadata', () => {
              video.play().then(() => resolve({video: video}))
            })
          }
        })

        console.log(cameras)
      }
    ).catch(console.log.bind(console))

  })
}
