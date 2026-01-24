let isDraft = true;
let published = false;
let currentAudioUrl = null; // Store the audioUrl from loaded data
const infoFormEl = document.querySelector('#info-form');

// Toast notification system
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  
  return toast;
}

// Form progress calculation
function calculateFormProgress() {
  const formData = new FormData(infoFormEl);
  const requiredFields = [
    'good_bad_dream',
    'whenOffset',
    'beforeOctober7',
    'anonymize',
    'legal'
  ];
  
  let completedFields = 0;
  let totalFields = requiredFields.length;
  
  // Check required fields
  requiredFields.forEach(fieldName => {
    const value = formData.get(fieldName);
    if (value && value.trim() !== '') {
      completedFields++;
    }
  });
  
  // Check if at least one emotion is selected
  const emotions = ['fear', 'happiness', 'sadness', 'anger', 'confusion', 'hope', 'peacefulness'];
  const hasEmotion = emotions.some(emotion => formData.get(emotion) === 'yes');
  if (hasEmotion) {
    completedFields += 0.5; // Partial credit for emotions
    totalFields += 0.5;
  }
  
  // Check age (optional but adds to progress)
  if (formData.get('age')) {
    completedFields += 0.3;
    totalFields += 0.3;
  }
  
  // Check association (optional but adds to progress)
  if (formData.get('association') && formData.get('association').trim()) {
    completedFields += 0.2;
    totalFields += 0.2;
  }
  
  // If not anonymous, check name and email
  if (formData.get('anonymize') === 'no') {
    totalFields += 2;
    if (formData.get('fullname') && formData.get('fullname').trim()) {
      completedFields++;
    }
    if (formData.get('email') && formData.get('email').trim()) {
      completedFields++;
    }
  }
  
  const progress = Math.min(100, Math.round((completedFields / totalFields) * 100));
  return progress;
}

function updateFormProgress() {
  const progress = calculateFormProgress();
  const progressFill = document.getElementById('form-progress-fill');
  const progressText = document.getElementById('form-progress-text');
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = `${progress}%`;
  }
}

const postRequest = (url, data) => {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  }).then(r => r.json())
}


const setAudioPreview = (audioUrl) => {
  // Only convert to .mp3 and apply Cloudinary transforms for Cloudinary URLs
  if (audioUrl && audioUrl.includes('/video/upload/')) {
    audioUrl = audioUrl.replace(/\.[a-zA-Z0-9]+$/, '.mp3');
    audioUrl = audioUrl.replace('/video/upload/', '/video/upload/e_volume:250/')
  }
  // For local files, use the URL as-is
  document.querySelector('audio').src = audioUrl;
  document.querySelector('audio').style.display = '';
}

// Universal function to convert slider value to DB value based on text direction
// In LTR: slider 0 (left/yellow/bad) → DB 10 (bad), slider 10 (right/cyan/good) → DB 0 (good)
// In RTL: slider 0 (left/yellow/good) → DB 0 (good), slider 10 (right/cyan/bad) → DB 10 (bad)
const sliderToDbValue = (sliderValue) => {
  const isRTL = document.documentElement.dir === 'rtl';
  if (isRTL) {
    // RTL: no inversion needed, slider matches DB directly
    return parseInt(sliderValue);
  } else {
    // LTR: invert the value
    return 10 - parseInt(sliderValue);
  }
};

// Universal function to convert DB value to slider value based on text direction
const dbToSliderValue = (dbValue) => {
  const isRTL = document.documentElement.dir === 'rtl';
  if (isRTL) {
    // RTL: no inversion needed, DB matches slider directly
    return parseInt(dbValue);
  } else {
    // LTR: invert the value
    return 10 - parseInt(dbValue);
  }
};

const save = () => {
  const formData = new FormData(infoFormEl)
  const object = {
    isDraft: !!isDraft,
    published: !!published
  };
  formData.forEach((value, key) => {
    if(value.length != null){
      // Convert slider value to DB value based on text direction
      if (key === 'good_bad_dream') {
        object[key] = sliderToDbValue(value);
      } else {
        object[key] = value;
      }
    }
  });
  
  // Include audioUrl if it exists (from loaded data)
  if (currentAudioUrl) {
    object.audioUrl = currentAudioUrl;
  }
  
  trace('saving...', object);

  return postRequest('save', object).catch(error => {
    trace('Error in save request:', error);
    console.error('Save error:', error);
    throw error;
  });
}

const load = async () => {
  trace('loading form data');

  const data = await postRequest('load');
  if(data.contact_options){
    let chkboxName = (() => {
      switch(data.contact_options){
        case 'phone':
          return 'contact_via_phone';
        case 'email':
          return 'contact_via_email';
        case 'whatsapp':
          return 'contact_via_whatsapp';
      }
    })();
    
    if(chkboxName){
      data[chkboxName] = 'yes';
    }
  }

  for(const formEl of infoFormEl.elements){
    if(formEl.name && data[formEl.name]){
      if(formEl.type === 'radio'){
        if(formEl.value === data[formEl.name])
          formEl.checked = true;
      } 
      else if (formEl.type === 'checkbox'){
        formEl.checked = data[formEl.name] === 'yes';
      } 
      else {
        // Convert DB value to slider value based on text direction
        if (formEl.name === 'good_bad_dream' && data[formEl.name] !== undefined && data[formEl.name] !== null) {
          formEl.value = dbToSliderValue(data[formEl.name]);
        } else {
          formEl.value = data[formEl.name];
        }
      }
    }
  }

  if(data.audioUrl){
    trace('setting audio preview');
    currentAudioUrl = data.audioUrl; // Store the audioUrl for saving
    setAudioPreview(data.audioUrl);
  }

  if(document.querySelector('.past-audios')){
    document.querySelector('.past-audios').innerHTML = data.audioUrlVersions.map(url => `
    <audio src="${url}" controls></audio>
    `).join('');
  }

  isDraft = !!data.isDraft;
  
  updateWhatToShow();

  setTimeout(() => {
    document.querySelector('.page-loader').remove();
    if(document.querySelector('.file-upload-dialog'))
      document.querySelector('.file-upload-dialog').style.display = '';
  }, 1000)  
}

function undraft(){
  trace('undrafting form');
  const required = ["anonymize", "legal", "beforeOctober7"];
  const formData = new FormData(infoFormEl);
  
  // If not anonymous, require fullname and email
  const anonymize = formData.get('anonymize');
  if(anonymize === 'no'){
    const fullname = formData.get('fullname');
    const email = formData.get('email');
    
    if(!fullname || !fullname.trim()){
      required.push('fullname');
    }
    if(!email || !email.trim()){
      required.push('email');
    } else {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailRegex.test(email.trim())){
        required.push('email');
        // Mark email field as invalid
        const emailInput = infoFormEl.querySelector('#email');
        if(emailInput){
          emailInput.setCustomValidity('Please enter a valid email address');
        }
      } else {
        const emailInput = infoFormEl.querySelector('#email');
        if(emailInput){
          emailInput.setCustomValidity('');
        }
      }
    }
  }
  
  const invalid = required.filter(name => {
    const value = formData.get(name);
    return !value || (typeof value === 'string' && !value.trim());
  });

  let firstInvalidEl;

  for(const formEl of infoFormEl.elements){
    if(invalid.includes(formEl.name)){
      if(!firstInvalidEl){
        firstInvalidEl = formEl.closest('fieldset') || formEl.closest('.row') || formEl;
      } 
      const fieldset = formEl.closest('fieldset');
      if(fieldset){
        fieldset.classList.add('invalid');
      } else {
        formEl.closest('.row')?.classList.add('invalid');
      }
    }
  }

  if(firstInvalidEl)
    firstInvalidEl.scrollIntoView({behavior: 'smooth', 'block': 'center'});

  if(invalid.length > 0){
    trace('Form validation failed:', invalid);
    showToast('Please fill in all required fields', 'error');
    return;
  }

  isDraft = false;
  published = true;
  showToast('Submitting your dream...', 'info', 2000);
  save().then(({name}) => {
    if(name){
      showToast('Dream submitted successfully!', 'success', 2000);
      setTimeout(() => {
        window.location.href = '../../success?name=' + name;
      }, 500);
    } else {
      trace('Error: No name returned from save');
      showToast('There was an error submitting the form. Please try again.', 'error');
    }
  }).catch(error => {
    trace('Error saving form:', error);
    showToast('There was an error submitting the form. Please check your connection and try again.', 'error');
    console.error('Form save error:', error);
  });
}

let saveTimer;

const debounceSave = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 3000);
}

const updateWhatToShow = () => {
  const formData = new FormData(infoFormEl);
  document.querySelectorAll('[data-show-when]').forEach(el => {
    const [showWhenKey, showWhenValue] = el.dataset.showWhen.split('=');
    const show = formData.get(showWhenKey) === showWhenValue;
    el.style.display=show ? '' : 'none';
  })
}

load();

infoFormEl.addEventListener('input', () => {
  debounceSave();
  setTimeout(updateWhatToShow, 100);
  updateFormProgress();
})

// Update progress on page load
setTimeout(() => {
  updateFormProgress();
}, 500);

if(document.querySelector('.btn-publish'))
  document.querySelector('.btn-publish').addEventListener('click', undraft);


document.querySelectorAll('fieldset, .row').forEach(f => {
  f.addEventListener('change', () => {
    f.classList.remove('invalid');
  })
})

// Also remove invalid class when input changes
infoFormEl.addEventListener('input', (e) => {
  const row = e.target.closest('.row');
  const fieldset = e.target.closest('fieldset');
  if(row) row.classList.remove('invalid');
  if(fieldset) fieldset.classList.remove('invalid');
})
