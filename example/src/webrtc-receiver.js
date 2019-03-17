/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* global main */

'use strict';

const video = document.querySelector('video');



let peerConn;
// websocket client
window.socket = new WebSocket('ws://127.0.0.1:8088');
window.socket.onmessage = function(evt) {
  var messageData = JSON.parse(evt.data);
  if (messageData.sdp) {
    console.log('Received SDP from remote peer');
    peerConn.setRemoteDescription(new RTCSessionDescription(messageData.sdp));
    peerConn.createAnswer(
      function (answer) {
        let ans = new RTCSessionDescription(answer);
        peerConn.setLocalDescription(ans, function () {
          window.socket.send(JSON.stringify({ 'sdp': ans }));
        },
        function (error) { console.log('createAndSendAnswer:' + error); }
        );
      },
      function (error) { console.log('createAndSendAnswer:' + error); }
    );
  } else if (messageData.candidate) {
    console.log('Received ICECandidate from remote peer ' + messageData.candidate);
    peerConn.addIceCandidate(new RTCIceCandidate(messageData.candidate));
  } else {
    console.log('Received from remote peer ' + evt.data);
  }
};

const offerOptions = {
  offerToReceiveAudio: 0,
  offerToReceiveVideo: 1
};

let startTime;

video.addEventListener('loadedmetadata', function() {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

video.onresize = () => {
  console.log(`Remote video size changed to ${video.videoWidth}x${video.videoHeight}`);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log(`Setup time: ${elapsedTime.toFixed(3)}ms`);
    startTime = null;
  }
};

call();

function call() {
  console.log('Starting call');
  startTime = window.performance.now();
  const servers = {
    'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]
  };

  peerConn = new RTCPeerConnection(servers);
  console.log('Created remote peer connection object peerConn');
  peerConn.onicecandidate = e => onIceCandidateHandler(peerConn, e);
  peerConn.oniceconnectionstatechange = e => onIceStateChange(peerConn, e);
  peerConn.ontrack = gotRemoteStream;
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

function onCreateOfferSuccess(desc) {

  console.log('peerConn setRemoteDescription start');
  peerConn.setRemoteDescription(desc, () => onSetRemoteSuccess(peerConn), onSetSessionDescriptionError);
  console.log('peerConn createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  peerConn.createAnswer(onCreateAnswerSuccess, onCreateSessionDescriptionError);
}

function onSetLocalSuccess(pc) {
  console.log(`setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
  if (video.srcObject !== e.streams[0]) {
    video.srcObject = e.streams[0];
    console.log('peerConn received remote stream');
  }
}

function onCreateAnswerSuccess(desc) {
  console.log(`Answer from peerConn:\n${desc.sdp}`);
  console.log('peerConn setLocalDescription start');
  peerConn.setLocalDescription(desc, () => onSetLocalSuccess(peerConn), onSetSessionDescriptionError);
}

function onIceCandidateHandler(pc, event) {
  console.log(`onIceCandidate`);
  peerConn.addIceCandidate(event.candidate)
    .then(
      () => onAddIceCandidateSuccess(pc),
      err => onAddIceCandidateError(pc, err)
    ); 
  console.log(`ICE candidate: ${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

