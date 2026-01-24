let pass = 'null';
const getFileName=str => {
  if(!str) return;
  const match = str.match(/\/[^\/]+$/);
  if(!match || !match[0]) return;
  return match[0].substr(1)
}
const itemHTMLRenderer = (data) => `<div class="item" data-id="${data._id}">
<small><strong>(${data.index})</strong></small>
<small> ${new Date(data.updatedAt).toLocaleString('he-il')}</small>
<div class="name">${data.fullname || 'ללא שם'}${data.organization ? ' - ' + data.organization : ''}</div>
<div class="description">${data.text || data.description}</div>
${data.audioUrl ? `<div class="audio"><audio controls src="${data.audioUrl?.replace(/\.\w+$/, '.mp3')}" preload="none" /></div>` : ''}
<div class="actions">
<a href="/view/view.html?id=${data._id}">צפייה</a>&nbsp;
<a href="download/${data._id}" download="${getFileName(data.audioUrl)}">הורדה</a>&nbsp;
<button class="btn-delete">מחיקה</button>
</div>
</div>`
const postRequest = (url, data) => {
  data.pass = pass;
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  })
  .then(r => r.json())
  .then(data => {
    if(data.error === 'unauthorized'){
      setShowingLogin(true)
      throw 'Unauthorized';
    } else {
      setShowingLogin(false)
      return data;
    }
  })
}

const setShowingLogin = (showLogin) => {
  document.querySelector('.login').classList.toggle('hidden', !showLogin);
  document.querySelector('.search').classList.toggle('hidden', showLogin);
  document.querySelector('.results').classList.toggle('hidden', showLogin);
}


const search = async () => {
  const resultsContainer = document.querySelector('.results');
  resultsContainer.classList.add('loading');
  const formData = new FormData(document.querySelector('form.search'))
  console.log(formData)
  const object = {
    searchText: formData.get('searchText'),
    filters: {}
  };

  if(formData.get('anonymize')){
    object.filters.anonymize = formData.get('anonymize'); 
  }

  if(formData.get('original')){
    object.filters.original = formData.get('original'); 
  }

  if(formData.get('prayer_language')){
    object.filters.prayer_language = formData.get('prayer_language'); 
  }


  if(formData.get('startDate')){
    object.filters.startDate = formData.get('startDate'); 
  }

  if(formData.get('endDate')){
    object.filters.endDate = formData.get('endDate'); 
  }

  const results = await postRequest('/archive/search', object);
  resultsContainer.innerHTML = results.map(itemHTMLRenderer).join('');
  resultsContainer.classList.remove('loading');
  document.querySelector('.count').textContent = results.length;
}

let searchTimer;

const debounceSearch = () => {
  const resultsContainer = document.querySelector('.results');
  resultsContainer.classList.add('loading');
  resultsContainer.innerHTML = '';
  clearTimeout(searchTimer)
  searchTimer = setTimeout(search, 2000);
}

document.querySelector('form.search').addEventListener('input', debounceSearch)

document.querySelector('form.search').addEventListener('submit', e => {
  e.preventDefault();
  clearTimeout(searchTimer);
  search()
})

document.addEventListener('click', e => {
  const item = e.target.closest('.item');
  if(!item) {
    return;
  }
  
  if(e.target.className == 'btn-delete'){
    const shouldDelete = confirm('בטוח שברצונך למחוק?');
    if(shouldDelete){
      console.log('ughhh', item.dataset.id)
      postRequest('remove', {id: item.dataset.id}).then(() => {
        item.remove();
      });
    }
  }
})

document.querySelector('form.login').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  pass = formData.get('pass');
  e.currentTarget.reset();
  search();
})