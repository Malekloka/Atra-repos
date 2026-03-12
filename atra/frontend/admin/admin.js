const loginSection = document.getElementById('admin-login');
const panelSection = document.getElementById('admin-panel');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('admin-login-error');
const locationForm = document.getElementById('location-form');
const locationError = document.getElementById('location-error');
const locationsList = document.getElementById('locations-list');
const locationsSearch = document.getElementById('locations-search');

let cachedLocations = [];

const setAdminView = (isAdmin) => {
  if (isAdmin) {
    loginSection.classList.add('hidden');
    panelSection.classList.remove('hidden');
  } else {
    loginSection.classList.remove('hidden');
    panelSection.classList.add('hidden');
  }
};

const renderLocations = (locations) => {
  locationsList.innerHTML = '';
  (locations || []).forEach((location) => {
    const item = document.createElement('li');
    item.className = 'location-item';
    item.innerHTML = `
      <div class="location-header">
        <strong>${location.en}</strong>
        <span class="location-key">${location.key}</span>
        <button type="button" class="btn-toggle" aria-label="Edit location" data-key="${location.key}">✎</button>
      </div>
      <div class="location-edit">
        <input type="text" data-field="en" value="${location.en || ''}" placeholder="English" />
        <input type="text" data-field="he" value="${location.he || ''}" placeholder="Hebrew" />
        <input type="text" data-field="ar" value="${location.ar || ''}" placeholder="Arabic" />
        <div class="location-actions">
          <button type="button" class="btn-save" data-key="${location.key}">Save</button>
          <button type="button" class="btn-delete" data-key="${location.key}">Delete</button>
        </div>
        <div class="location-error error" data-key="${location.key}"></div>
      </div>
    `;
    locationsList.appendChild(item);
  });

  locationsList.querySelectorAll('.btn-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('.location-item');
      const wasOpen = row.classList.contains('is-open');
      locationsList.querySelectorAll('.location-item').forEach((row) => {
        row.classList.remove('is-open');
      });
      if (!wasOpen) {
        row.classList.add('is-open');
      }
    });
  });

  locationsList.querySelectorAll('.btn-save').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.getAttribute('data-key');
      const row = button.closest('.location-item');
      const errorEl = row.querySelector('.location-error');
      errorEl.textContent = '';
      const en = row.querySelector('input[data-field="en"]').value.trim();
      const he = row.querySelector('input[data-field="he"]').value.trim();
      const ar = row.querySelector('input[data-field="ar"]').value.trim();
      if (!en) {
        errorEl.textContent = 'English name is required.';
        return;
      }
      try {
        const response = await fetch(`/admin/locations/${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ en, he, ar })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update location');
        }
        loadLocations();
      } catch (error) {
        errorEl.textContent = error.message;
      }
    });
  });

  locationsList.querySelectorAll('.btn-delete').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.getAttribute('data-key');
      if (!confirm(`Delete location "${key}" and all related data?`)) {
        return;
      }
      try {
        const response = await fetch(`/admin/locations/${encodeURIComponent(key)}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete location');
        }
        loadLocations();
      } catch (error) {
        alert(error.message);
      }
    });
  });
};

const loadLocations = async () => {
  const response = await fetch('/api/locations');
  const data = await response.json();
  cachedLocations = data.locations || [];
  renderLocations(cachedLocations);
};

setAdminView(window.__IS_ADMIN__);
if (window.__IS_ADMIN__) {
  loadLocations();
}

locationsSearch.addEventListener('input', () => {
  const query = locationsSearch.value.trim().toLowerCase();
  if (!query) {
    renderLocations(cachedLocations);
    return;
  }
  const filtered = cachedLocations.filter((location) => {
    return (
      (location.en || '').toLowerCase().includes(query) ||
      (location.he || '').toLowerCase().includes(query) ||
      (location.ar || '').toLowerCase().includes(query) ||
      (location.key || '').toLowerCase().includes(query)
    );
  });
  renderLocations(filtered);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value.trim();
  try {
    const response = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      throw new Error('Invalid credentials');
    }
    window.location.reload();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

locationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  locationError.textContent = '';
  const name = document.getElementById('location-name').value.trim();
  const nameHe = document.getElementById('location-name-he').value.trim();
  const nameAr = document.getElementById('location-name-ar').value.trim();
  if (!name) {
    locationError.textContent = 'Location name is required.';
    return;
  }
  try {
    const response = await fetch('/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, he: nameHe, ar: nameAr })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add location');
    }
    document.getElementById('location-name').value = '';
    document.getElementById('location-name-he').value = '';
    document.getElementById('location-name-ar').value = '';
    loadLocations();
  } catch (error) {
    locationError.textContent = error.message;
  }
});
