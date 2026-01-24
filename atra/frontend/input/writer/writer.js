const textarea = document.querySelector('#text');

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const updateText = debounce(async function() {
  const response = await fetch('update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: textarea.value })
  });
  if (!response.ok) {
    traceError('Failed to update text');
  }
}, 300);


textarea.addEventListener('input', updateText);

const loadText = async function() {
  const response = await fetch('load', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    traceError('Failed to load text');
    return;
  }
  const { text } = await response.json();
  textarea.value = text || '';
}

loadText();
