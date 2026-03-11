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

app.post('/check_file', async (req, res) => {
  console.log('checking file')
  const completed = await uploader.checkJob(req.body.job)
  res.json({completed})
})

app.get('/:locale/success', async (req, res) => {
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
app.get('/:locale/entry', async (req, res) => {
  const strings = await locales.get(req.params.locale);

  res.render('input/entry/entry', {
    ...strings.entry,
    ...strings.lang,
    tenant: req.tenantId
  })
})

app.post('/:locale/new', async (req, res) => {
  const index = await datastore.createItemId(req.tenantId);
  const id = await datastore.items.create(index.value, req.tenantId);
  const { type } = req.body;
  res.redirect(`/t/${req.tenantId}/${req.params.locale}/${id}/${type}/`);
});
  

const preventReEdit = async (req, res, next) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  req.item = item;
  if (!item) {
    return res.redirect(`/t/${req.tenantId}/${req.params.locale}/entry`);
  }
  if(item.isDraft === true){
    next();
  } else {
    res.redirect(`/t/${req.tenantId}/${req.params.locale}/success`);
  }
}

app.get('/:locale/:id/record', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/recorder/recorder', {
    ...strings,
    ...strings.lang,
    ...strings.recorder,
    form_link: `/t/${req.tenantId}/${req.params.locale}/${req.params.id}/fill/`,
    id: req.params.id,
    tenant: req.tenantId
  })
})

app.post('/:locale/:id/record/update', preventReEdit, async (req, res) => {
  const v = await datastore.items.update(req.params.id, req.body, { tenantId: req.tenantId });
  res.json({ok: true, updated: v.updated}) 
})

app.get('/:locale/:id/write', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/writer/writer', {
    ...strings,
    ...strings.lang,
    ...strings.writer,
    form_link: `/t/${req.tenantId}/${req.params.locale}/${req.params.id}/fill/`,
    id: req.params.id,
    tenant: req.tenantId
  })
});

app.post('/:locale/:id/write/update', async (req, res) => {
  const values = {
    text: req.body.text,
    display_language: req.params.locale
  }

  const v = await datastore.items.update(req.params.id, values, { tenantId: req.tenantId });
  res.json({ok: true, updated: v.updated})
})

app.get('/:locale/:id/fill', preventReEdit, async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('input/form/form', {
    ...strings.form,
    ...strings.lang,
    id: req.params.id,
    item: req.item,
    tenant: req.tenantId
  })
});

app.post('/:locale/:id/write/load', async (req, res) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
})

app.post('/:locale/:id/fill/load', async (req, res) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
})

app.post('/:locale/:id/fill/save', async (req, res) => {
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

app.get('/:locale/', async (req, res) => {
  const strings = await locales.get(req.params.locale);
  res.render('index/index', {
    ...strings.index,
    ...strings.lang,
    tenant: req.tenantId
  })
})

app.get('/', async (req, res) => {
  res.redirect(`/t/${req.tenantId}/he/`);
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