let audioUrl;
let openedMicrophoneStream = false;
let recordChunks = [];
let recordingBlobType;
let mediaRecorder;
let isRecording = false;
let microphoneStream;
let startRecordingTime;
let updateRecordingLengthTimer = null;
let hasMicPermission = false;

navigator.getUserMedia_ = ( navigator.getUserMedia
                       || navigator.webkitGetUserMedia 
                       || navigator.mozGetUserMedia 
                       || navigator.msGetUserMedia);

if(navigator.permissions && navigator.permissions.query){
  navigator.permissions.query({ name: "microphone" }).then((result) => {
    if (result.state === "granted") {
      hasMicPermission = true;
    }
  });
}

async function getConnectedDevices(type) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  trace(`user has ${devices.length} devices`);
  return devices.filter(device => device.kind === type)
}


function openMicrophoneStream() {
  if(openedMicrophoneStream){
    return Promise.resolve();
  }

  return new Promise(async (resolve, reject) => {
    const devices = await getConnectedDevices('audioinput');
    const prefferedAudioInputDevice = devices.find(device => device.label === 'Speakerphone');

    const constraints = { 
      audio: {
        echoCancellation: false, 
        noiseSuppression: false,
        autoGainControl: false,
        noiseCancellation: false
      }, 
      video: false
    }

    if(prefferedAudioInputDevice){
      constraints.audio.deviceId = prefferedAudioInputDevice.deviceId;
    }

    const showError = (e) => {
      trace('No microphone access\n' + e.message);
      reject(e);
    }

    const useMediaStream = (stream) => {
      microphoneStream = stream;
      meh(stream);
      openedMicrophoneStream = true;
      resolve();
    } 
  
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(constraints)
      .then(useMediaStream)
      .catch(showError)
    }
    else if(navigator.getUserMedia_){
      navigator.getUserMedia_(constraints, useMediaStream, showError);
    }
    else {
      showError({message: 'Device not supported'})
    }
  })
}

function meh(stream){
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

  analyser.smoothingTimeConstant = 0.8;
  analyser.fftSize = 1024;

  microphone.connect(analyser);
  analyser.connect(scriptProcessor);
  scriptProcessor.connect(audioContext.destination);
  scriptProcessor.onaudioprocess = function() {
    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    const middleOfArray = array.length / 4;
    const arraySum1 = array.slice(0, middleOfArray).reduce((a, value) => a + value, 0);
    const arraySum2 = array.slice(middleOfArray + 1).reduce((a, value) => a + value, 0);
    const average1 = Math.round(arraySum1 / array.length);
    const average2 = Math.round(arraySum2 / array.length);
    const s = 1 + Math.round(average1) / 10;
    document.querySelector('#circle1').style.transform = `scale(${s})`
    const s2 = 1 + Math.round(average2) / 10;
    document.querySelector('#circle2').style.transform = `scale(${s2})`
  };
  
}

function closeMicrophoneStream(){
  microphoneStream.getTracks().forEach(track => track.stop());
}

const startRecord = async (e) => {
  if(e) e.preventDefault();
  
  if(!openedMicrophoneStream){
    throw 'No microphone access';
  }


  if(window.recordingMimeType){
    trace('mimetype - recording with ' + window.recordingMimeType);
    mediaRecorder = new MediaRecorder(microphoneStream, {
      mimeType: window.recordingMimeType
    });
  } else {
    mediaRecorder = new MediaRecorder(microphoneStream);
  }

  isRecording = true;
  
  recordChunks = [];
  startRecordingTime = new Date();
    
  mediaRecorder.start();

  mediaRecorder.ondataavailable = (e) => {
    recordingBlobType = e.data.type;
    recordChunks.push(e.data);
    trace('pushed chunk');
    if (!isRecording) {
      trace('recording stopped');
      upload();
    }
  }
}

function uploadFileInput(fileInput){
  recordChunks = [];
  const files = fileInput.files;
  upload(files[0]);
}

async function upload(file){
  if(onUplading) onUplading();
  let job = null;

  let formData = new FormData();
  if(recordChunks && recordChunks.length){
    formData = new FormData();
    const blob = new Blob(recordChunks);
    const match = /audio\/(\w+)/.exec(recordingBlobType);
    console.log(match);
    const fileExtension = match ? '.' + match[1] : '';
    const mimeType = match ? '.' + match[0] : '';
    const file = new File([blob], 'file' + fileExtension, {type: mimeType})
    formData.append('file', file)  
  } else {
    formData.append('file', file)  
  }

  try {
    const r = await fetch('/upload_file', {
      method: 'post',
      body: formData,
    })
    const data = await r.json();
    if(data.error){
      throw "Server Error";
    }
    audioUrl = data.url;
    job = data.job;
  } catch (error) {
    alert(error);
  }

  if(onUpladingEnd) onUpladingEnd(audioUrl, job);
}

function stopRecord() {
  if(!isRecording)
    return;

  isRecording = false;
  mediaRecorder.stop();
  // closeMicrophoneStream();
}

function findBestMimeTypeForRecording(){
  const mimeTypes =[
    'audio/webm;codecs=pcm',
    'audio/wav;codecs=pcm',
    'audio/mp4;codecs=mp4a'
  ]
  if(MediaRecorder && MediaRecorder.isTypeSupported){
    for(const mimeType of mimeTypes){
      if(MediaRecorder.isTypeSupported(mimeType)){
        return mimeType;
      }
    }
  }
  return null;
}


window.recordingMimeType = findBestMimeTypeForRecording();

