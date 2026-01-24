const app = document.querySelector('.app'); 
const audio = document.querySelector('#audio');

const screens = {
  startRecording: 1,
  recording: 2,
  saving: 3,
  play: 4
}

let timeRecordingStarted = 0;
let recordingTimer;
let isPlayingRecording = false;

function gotoScreen(screenIndex){
  trace(`Going to screen ${screenIndex}`);
  app.dataset.screenIndex = screenIndex;
}

function handleStartRecording(){
  timeRecordingStarted = new Date();
  recordingTimer = setInterval(updateTime, 1000);

  if(!hasMicPermission){
    trace('Requesting microphone permission');
    document.querySelector('.access-warning').style.display = 'block';
  }

  openMicrophoneStream().then(() => {
    trace('Microphone stream opened');
    document.querySelector('.above-button').style.display = 'none';
    startRecord();
    gotoScreen(screens.recording);
  }).catch(() => {
    traceError('No microphone access');
    alert('אין גישה למיקרופון');
  });
}

function handleEndRecording(){
  clearInterval(recordingTimer);
  gotoScreen(screens.saving);
  stopRecord();
}

function handleSavingEnded(){
  gotoScreen(screens.play);
}

function handlePlayRecording(){
  audio.play();
}

function handleStopPlayingRecording(){
  audio.pause();
  audio.currentTime = 1;
}

function handleRecordAgain(){
  audio.src = null;
  gotoScreen(screens.startRecording);
}

// Set audio element to the given URL and wait until it can be played.
// We no longer force a .mp3 extension here; the caller should pass the correct URL.
const setAudioPreview = (audioUrl) => {
  return new Promise((resolve) => {
    let resolved = false;
    const resolveOnlyOnce = () => {
      if(!resolved){
        resolved = true;
        resolve();
      }
    }

    setTimeout(() => {
      document.querySelector('audio').src = audioUrl; 
      document.querySelector('audio').addEventListener('canplaythrough', resolveOnlyOnce, {once: true}); 
    }, 2000)

    setTimeout(resolveOnlyOnce, 6000);
  })
}


function updateTime(){
  const time = (new Date() - timeRecordingStarted) / 1000;
  setTimeLabel(time);
}

function setTimeLabel(time){
  const seconds = Math.floor(time % 60).toString();
  const minutes = Math.floor(time / 60).toString();
  const timeString = `00:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
  document.querySelectorAll('.time').forEach(t => t.textContent = timeString)
}

document.querySelector('#btn-play-stop').addEventListener('click', () => {
  if(!isPlayingRecording){
    handlePlayRecording();
  } else {
    handleStopPlayingRecording();
  }
})

function setIsPlaying(isPlaying){
  isPlayingRecording = isPlaying;
  document.querySelector('#btn-play-stop').classList.toggle('playing', isPlaying);
  document.querySelector('.my-recording .dancing-bars').classList.toggle('static', !isPlaying);
}

audio.addEventListener('playing', () => { setIsPlaying(true) })
audio.addEventListener('pause', () => { setIsPlaying(false); })

audio.addEventListener('timeupdate', () => {
  setTimeLabel(audio.currentTime);
})

function onUplading(){
  gotoScreen(screens.saving);
}

function onUpladingEnd(audioUrl, job){
  postRequest('update', {audioUrl, job})

  const audioUrlMp3 = audioUrl.replace(/\.[a-zA-Z0-9]+$/, '.mp3');

  waitForJobToFinish(job)
    .then(() => {
      trace('conversion job finished');
    })
    .then(() => setAudioPreview(audioUrlMp3))
    .then(() => setTimeout(() => {
      gotoScreen(screens.play);
    }, 2000))
}

function waitForJobToFinish(job){
  return new Promise((resolve) => {
    const checkJob = async () => {
      try {
        const data = await postRequest('/check_file', {job})
        if(data.completed){
          resolve();
        } else {
          setTimeout(checkJob, 2000);
        }
      } catch {
        setTimeout(checkJob, 2000);
      }
    }

    setTimeout(checkJob, 2000);
  })
}

const postRequest = (url, data) => {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  }).then(r => r.json())
    .catch(e => {
      traceError(`Error posting ${url}`)
      console.log(e)
    })
}

document.querySelectorAll('input[type="file"]').forEach(fileInput => {
  fileInput.addEventListener('change', () => uploadFileInput(fileInput));
})