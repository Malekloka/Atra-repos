const express = require('express');
const path = require('path');
const app = express.Router();
const locales = require('./locales.reader');
const config = require('./config');
const DataStore = require('./services/database/datastore');
const uploader = require('./services/storage/uploader');
const axios = require('axios');
const { randomStarName } = require('./services/names/names')
const { requestProcess } = require('./request-process');
const { OpenAI } = require('openai');

const ADMIN_COOKIE = 'admin';
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const TENANT_COOKIE = 'tenantId';

const isAdmin = (req) => {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.includes(`${ADMIN_COOKIE}=1`);
};

const setAdminCookie = (res) => {
  const cookieValue = `${ADMIN_COOKIE}=1; Path=/; HttpOnly`;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
    return;
  }
  res.setHeader('Set-Cookie', [existing, cookieValue]);
};

const setTenantCookie = (res, tenantId) => {
  const cookieValue = `${TENANT_COOKIE}=${encodeURIComponent(tenantId)}; Path=/`;
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
    return;
  }
  res.setHeader('Set-Cookie', [existing, cookieValue]);
};

const normalizeLocationKey = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const translateLocation = async (name, targetLanguage) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return name;
  }
  try {
    const client = new OpenAI({ apiKey });
    const prompt = `Translate the location name into ${targetLanguage}. Return only the translated text.\n\nLocation: ${name}`;
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });
    return response.choices?.[0]?.message?.content?.trim() || name;
  } catch {
    return name;
  }
};

const datastore = new DataStore({
  connectionString: config.database.connectionString//process.env.MONGODB_URI
});

// Serve locally stored uploads in dev (when not using S3)
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

//uploader
app.post('/upload_file', uploader.audioUpload, async (req, res) => {
  console.log('uploading file');
  const filePath = req.file?.path ?? req.file?.location;
  console.log(req.file);

  if (!filePath) {
    return res.json({error: true});
  }

  // When using local disk storage, return a web-accessible URL under /uploads.
  // When using S3, req.file.location is already a full URL.
  let url;
  if (req.file.location) {
    url = req.file.location;
  } else {
    const fileName = path.basename(filePath);
    url = `/uploads/${fileName}`;
  }

  res.json({url, job: req.file?.job});
})

app.get('/api/locations', async (req, res) => {
  const locations = await datastore.locations
    .find({})
    .sort({ en: 1 })
    .toArray();
  res.json({ locations });
});

app.post('/api/tenant', async (req, res) => {
  const tenantId = (req.body?.tenant || '').trim();
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant is required' });
  }
  setTenantCookie(res, tenantId);
  res.json({ ok: true });
});

app.get('/admin', async (req, res) => {
  res.render('admin/admin', {
    isAdmin: isAdmin(req) ? 'true' : ''
  });
});

app.post('/admin/login', async (req, res) => {
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(500).json({ ok: false, error: 'Admin credentials not configured' });
  }
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    setAdminCookie(res);
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

app.post('/admin/locations', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const name = (req.body?.name || '').trim();
    const nameHe = (req.body?.he || '').trim();
    const nameAr = (req.body?.ar || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const key = normalizeLocationKey(name);
    if (!key) {
      return res.status(400).json({ error: 'Invalid location name' });
    }
    const existing = await datastore.locations.findOne({ key });
    if (existing) {
      return res.status(409).json({ error: 'Location already exists' });
    }
    const [he, ar] = await Promise.all([
      nameHe || translateLocation(name, 'Hebrew'),
      nameAr || translateLocation(name, 'Arabic')
    ]);
    await datastore.locations.insertOne({
      key,
      en: name,
      he: he || name,
      ar: ar || name,
      createdAt: new Date()
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin create location failed', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/admin/locations/:key', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const key = normalizeLocationKey(req.params.key || '');
    if (!key) {
      return res.status(400).json({ error: 'Invalid location key' });
    }
    const en = (req.body?.en || '').trim();
    const he = (req.body?.he || '').trim();
    const ar = (req.body?.ar || '').trim();
    if (!en) {
      return res.status(400).json({ error: 'English name is required' });
    }
    const existing = await datastore.locations.findOne({ key });
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }
    await datastore.locations.updateOne(
      { key },
      { $set: { en, he: he || en, ar: ar || en, updatedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin update location failed', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/admin/locations/:key', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    const key = normalizeLocationKey(req.params.key || '');
    if (!key) {
      return res.status(400).json({ error: 'Invalid location key' });
    }
    const existing = await datastore.locations.findOne({ key });
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const db = datastore.db;
    await Promise.all([
      db.collection('items').deleteMany({ tenantId: key }),
      db.collection('themes').deleteMany({ tenantId: key }),
      db.collection('maps').deleteMany({ tenantId: key }),
      db.collection('connections').deleteMany({ tenantId: key }),
      db.collection('comments').deleteMany({ tenantId: key }),
      db.collection('counters').deleteMany({ tenantId: key })
    ]);

    await datastore.locations.deleteOne({ key });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin delete location failed', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/check_file', async (req, res) => {
  console.log('checking file')
  const completed = await uploader.checkJob(req.body.job)
  res.json({completed})
})

app.get('/:locale(he|en|ar)/success', async (req, res) => {
  const strings = await locales.get(req.params.locale);
  const name = req.query.name;
  res.render('input/success/success', {
    ...strings.lang,
    ...strings.success,
    name: name,
    tenant: req.tenantId
  });
})

// views
app.get('/:locale(he|en|ar)/entry', async (req, res) => {
  const strings = await locales.get(req.params.locale);

  res.render('input/entry/entry', {
    ...strings.entry,
    ...strings.lang,
    tenant: req.tenantId
  })
})

app.post('/:locale(he|en|ar)/new', async (req, res) => {
  const index = await datastore.createItemId(req.tenantId);
  const id = await datastore.items.create(index.value, req.tenantId);
  const { type } = req.body;
  res.redirect(`/${req.params.locale}/${id}/${type}/`);
});
  

const preventReEdit = async (req, res, next) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  req.item = item;
  if (!item) {
    return res.redirect(`/${req.params.locale}/entry`);
  }
  if(item.isDraft === true){
    next();
  } else {
    res.redirect(`/${req.params.locale}/success`);
  }
}

app.get('/:locale(he|en|ar)/:id/record', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/recorder/recorder', {
    ...strings,
    ...strings.lang,
    ...strings.recorder,
    form_link: `/${req.params.locale}/${req.params.id}/fill/`,
    id: req.params.id,
    tenant: req.tenantId
  })
})

app.post('/:locale(he|en|ar)/:id/record/update', preventReEdit, async (req, res) => {
  const v = await datastore.items.update(req.params.id, req.body, { tenantId: req.tenantId });
  res.json({ok: true, updated: v.updated}) 
})

app.get('/:locale(he|en|ar)/:id/write', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/writer/writer', {
    ...strings,
    ...strings.lang,
    ...strings.writer,
    form_link: `/${req.params.locale}/${req.params.id}/fill/`,
    id: req.params.id,
    tenant: req.tenantId
  })
});

app.post('/:locale(he|en|ar)/:id/write/update', async (req, res) => {
  const values = {
    text: req.body.text,
    display_language: req.params.locale
  }

  const v = await datastore.items.update(req.params.id, values, { tenantId: req.tenantId });
  res.json({ok: true, updated: v.updated})
})

app.get('/:locale(he|en|ar)/:id/fill', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/form/form', {
    ...strings.form,
    ...strings.lang,
    id: req.params.id,
    item: req.item,
    tenant: req.tenantId
  })
});

app.post('/:locale(he|en|ar)/:id/write/load', async (req, res) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
})

app.post('/:locale(he|en|ar)/:id/fill/load', async (req, res) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
})

app.post('/:locale(he|en|ar)/:id/fill/save', async (req, res) => {
  const isPublishing = req.body.isDraft === false;
  const data = req.body;
  if (req.tenantId) {
    data.city = req.tenantId;
  }
  let name = '';
  if(isPublishing){
    while(true){
      name = randomStarName();
      console.log('Changing name of item ' + req.params.id + ' to ' + name);
      const alreadyUsedName = await datastore.items.get({ name, tenantId: req.tenantId });
      if(!alreadyUsedName){
        data.name = name;
        break;
      }
    }

    const whenOffset = parseInt(data.whenOffset);
    
    if(whenOffset){ // when offset is how many days ago the item was created
      data["date"] = new Date(new Date().getTime() + whenOffset * 24 * 60 * 60 * 1000);
    }
    
    // Normalize city field if provided (telaviv -> tel-aviv)
    // If empty string or null, remove city field so dream appears in main cluster
    if(data.city && data.city.trim()){
      const normalizedCity = data.city.toLowerCase().trim();
      data.city = normalizedCity === 'telaviv' ? 'tel-aviv' : normalizedCity;
    } else {
      // Remove city field if empty - dream will appear in main cluster (all dreams)
      delete data.city;
    }

    console.log("✨ new item: ", data);
  }
  if (!data.tenantId) {
    data.tenantId = req.tenantId;
  }
  const op = await datastore.items.update(req.params.id, data, { tenantId: req.tenantId });
  if(isPublishing){
    requestProcess(req.tenantId);
  }
  res.json({success: true, updated: op.updated, name});
})

app.get('/:locale(he|en|ar)/', async (req, res) => {
  const strings = await locales.get(req.params.locale);
  const mapBase = (process.env.PLAY_WITH_DREAMS_URL || 'http://localhost:9000').replace(
    /\/$/,
    ''
  );
  res.render('index/index', {
    ...strings.index,
    ...strings.lang,
    tenant: req.tenantId,
    map_base: mapBase
  })
})

app.get('/', async (req, res) => {
  res.redirect(`/he/`);
})


// archive ----------------------------------------------------------
const validatePassMiddlewear = (req, res, next) => {
  if(req.body.pass !== 'alltogethernow'){
    res.status(401).send({error: 'unauthorized'});
  } else {
    next();
  }
}

app.post('/archive/search', validatePassMiddlewear, async (req, res) => {
  const items = await datastore.items.textSearch(
    req.body.searchText,
    null,
    req.body.filters,
    req.tenantId
  );
  res.json(items);
})

app.get('/archive/download/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const item = await datastore.items.get(id, { tenantId: req.tenantId });
    const { audioUrl } = item;
    console.log('downloading', audioUrl);
    const response = await axios({
      url: audioUrl,
      method: 'GET',
      responseType: 'stream'
    })
    
    response.data.pipe(res)  
  } catch {
    res.send('error');
  }
})

app.post('/archive/remove', validatePassMiddlewear, async (req, res) => {
  const { id } = req.body;
  await datastore.items.remove(id, { tenantId: req.tenantId });
  res.json({success: true})
})

app.get('/view/item/:id', async (req, res) => {
  console.log('viewing item', req.params.id);
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
})

// sent recording from alte

// altar ------------------------------------------------------
app.post('/alte', uploader.audioUpload, async (req, res) => {
  const filePath = req.file?.path ?? req.file?.location;
  if(!filePath){
    res.json({error: true});
    return;
  }

  // Store a web-accessible URL for the audio
  const audioUrl = req.file.location
    ? req.file.location
    : `/uploads/${path.basename(filePath)}`;

  console.log('alte sent a recording', audioUrl);

  const index = await datastore.createItemId(req.tenantId);
  const id = await datastore.items.create(index.value, req.tenantId);

  await datastore.items.update(id, {
    audioUrl,
    anonymize: 'yes',
    isDraft: false,
    empty: false,
    fullname: 'alte',
    tenantId: req.tenantId
  }, { tenantId: req.tenantId })

  setTimeout(() => requestProcess(req.tenantId), 10*1000);

  res.json({success: true});
})

// static files
app.use('/', express.static('./frontend'));


module.exports = app;