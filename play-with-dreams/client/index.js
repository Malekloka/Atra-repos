async function postRequest(path, data) {
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  .then(response => response.json())
  .then(data => data)
  .catch(error => console.error(error));
}

async function loadSpeechData() {
  return postRequest('/672b9e309aba02c5c3ae5425/load');
}

const getKeys = () => {
  return document.getElementById('keys').value.split('\n');
}

async function main(){
  const audio = document.getElementById('audio');
  const text = document.getElementById('text');
  const emotions = document.getElementById('emotions');
  const loader = document.getElementById('loader');

  const osc = new OSC();
  osc.open(); // connect by default to ws://localhost:8080

  const showLoader = () => {
    loader.style.display = '';
  }

  const hideLoader = () => {
    loader.style.display = 'none';
  }

  showLoader();
  
  const data = await loadSpeechData();
  
  hideLoader();

  audio.src = data.audioUrl;

  console.log(data);

  let lastSubtitleIndex = -1;

  const onNextSubtitle = (subtitle) => {
    const values = getKeys().map(key => subtitle.emotions[key]);
    var message = new OSC.Message('/test/random', ...values);
    osc.send(message);
  }

  const updateSubtitles = () => {
    const currentTime = audio.currentTime;
    const currentSubtitleIndex = data.segments.findIndex(subtitle => subtitle.start <= currentTime && subtitle.end >= currentTime);
    emotions.textContent = JSON.stringify(data.segments[currentSubtitleIndex].emotions, null, 2);
    text.innerHTML = data.segments.map((subtitle, index) => {
      if (index === currentSubtitleIndex) {
        return `<span class="highlight">${subtitle.text ?? subtitle.word}</span>`;
      }
      return subtitle.text ?? subtitle.word;
    }).join('. ');
    if(currentSubtitleIndex !== lastSubtitleIndex){
      lastSubtitleIndex = currentSubtitleIndex;
      onNextSubtitle(data.segments[currentSubtitleIndex]);
    }
  }

  text.innerHTML = data.segments.map(subtitle => {
    return subtitle.text ?? subtitle.word;
  }).join('. ');

  audio.addEventListener('timeupdate', updateSubtitles);

  if(data.segments[0].emotions){
    const keys = Object.keys(data.segments[0].emotions);
    document.getElementById('keys').value = keys.join('\n');
  }

  const replay = () => {
    lastSubtitleIndex = -1;
    audio.currentTime = 0;
    audio.play();
  }

  const analyzeButton = document.getElementById('btn-recalculate');
  analyzeButton.addEventListener('click', async () => {
    showLoader();
    const keys = getKeys();
    const response = await postRequest('/672b9e309aba02c5c3ae5425/recalculate', {keys});
    console.log(response);
    data.segments = response.segments;
    updateSubtitles();
    hideLoader();
  });

  const replayButton = document.getElementById('btn-replay');
  replayButton.addEventListener('click', replay);

  const btnSaveText = document.getElementById('btn-save-text');
  btnSaveText.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    showLoader();
    const response = await postRequest('/672b9e309aba02c5c3ae5425/create', {text: text.textContent, keys: getKeys()});
    console.log(response);
    data.segments = response.segments;
    audio.src = response.audioUrl;
    updateSubtitles();
    hideLoader();
  });
}

main();