import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import datastore from './services/database/datastore.js';
import config from './config.js';
import { OpenAI, toFile } from "openai";
import Tagger from './tagger.js';
import studyRouter from './routes/study.routes.js';
import DreamTalker from './dreamtalker.js';
import {runJobs} from './jobs/index.js';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const port = process.env.PORT || 9000;

const app = express();

const TENANT_COOKIE = 'tenantId';

const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((part) => part.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
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

app.use((req, res, next) => {
  const match = req.url.match(/^\/t\/([^/]+)(\/|$)/);
  if (match) {
    const tenantId = decodeURIComponent(match[1]);
    req.tenantId = tenantId;
    req.url = req.url.replace(/^\/t\/[^/]+/, '') || '/';
    setTenantCookie(res, tenantId);
  } else {
    req.tenantId = getCookieValue(req.headers.cookie, TENANT_COOKIE) || 'demo';
  }
  next();
});

// Enable CORS for all routes
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const TENANT_ROOM_PREFIX = 'tenant:';

const getTenantFromCookie = (cookieHeader) =>
  getCookieValue(cookieHeader, TENANT_COOKIE) || 'default';

io.on('connection', (socket) => {
  const tenantId = getTenantFromCookie(socket.request.headers.cookie);
  const roomName = `${TENANT_ROOM_PREFIX}${tenantId}`;
  socket.join(roomName);

  socket.on('update', (message) => {
    io.to(roomName).emit('update', message);
  });
});

const openai = new OpenAI(config.openai);

app.get('/home', (req, res) => {
  res.sendFile('client/home.html', { root: process.cwd() });
});

app.get('/', (req, res) => {
  res.sendFile('client/home.html', { root: process.cwd() });
});

app.get('/map', (req, res) => {
  res.sendFile('client/study/study.html', { root: process.cwd() });
});

app.get('/add-dream', (req, res) => {
  res.sendFile('client/add-dream.html', { root: process.cwd() });
});

app.get('/my-page', (req, res) => {
  res.sendFile('client/my-page.html', { root: process.cwd() });
});

app.use(express.json());

// Serve static files from the 'client' folder
app.use('/', express.static('client'));

// Serve uploaded audio files from the atra project (shared uploads folder)
// This makes /uploads/... accessible on port 9000, matching audioUrl values from atra.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../atra/uploads');
app.use('/uploads', express.static(uploadsDir));

// Add io to request object for socket.io events
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/study', studyRouter);

app.use('/audio', express.static('audio'));
// Serve static files from the 'audio' folder

app.post('/:id/load/', async (req, res) => {
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });
  res.json(item);
  // const audioFolder = path.resolve(`./audio/${req.params.id}`);
  // const filePath = path.join(audioFolder, 'speech.json');
  // const fileContents = await fs.readFile(filePath, 'utf-8');
  // const data = JSON.parse(fileContents);
  // data.audioUrl = '/audio/' + req.params.id + '/speech.mp3';
  // res.json(data);
})

app.post('/:id/save', async (req, res) => {
  const item = req.body;
  if (!item.tenantId) {
    item.tenantId = req.tenantId;
  }
  datastore.items.saveItem(item);
  res.json(item);
});

app.post('/:id/recalculate', async (req, res) => {
  console.log(req.body);
  const { keys } = req.body;
  const item = await datastore.items.get(req.params.id, { tenantId: req.tenantId });

  const analyzer = new Tagger(openai, keys);
  item.segments = [];
  for(const segment of item.transcription.segments) {
    const emotions = await analyzer.analyze(segment.text);
    segment.emotions = emotions;
    item.segments.push({
      start: segment.start,
      end: segment.end,
      text: segment.text,
      emotions: emotions
    })
  }
  datastore.items.saveItem(item);
  res.json(item);
});

app.post('/:id/create', async (req, res) => {
  const { keys, text } = req.body;
  const talker = new DreamTalker(openai, text);
  const data = await talker.create();
  const analyzer = new Tagger(openai, keys);
  for(const segment of data.segments) {
    const emotions = await analyzer.analyze(segment.text);
    segment.emotions = emotions;
  }
  data.text = text;

  data.tenantId = data.tenantId ?? req.tenantId;
  const item = await datastore.items.update(req.params.id, data, { tenantId: req.tenantId });
  res.json(item);
});

app.post('/process', cors(), async (req, res) => {
  console.log('🔄 Processing request received - starting jobs...');
  runJobs(req.tenantId).catch(err => {
    console.error('❌ Error running jobs:', err);
  });
  res.json({status: 'ok', message: 'Processing started. Check server logs for progress.'});
});

// Endpoint to transcribe audio dreams only
app.post('/transcribe', cors(), async (req, res) => {
  console.log('🎤 Transcription request received...');
  try {
    const { runTranscribe } = await import('./jobs/transcribe.js');
    await runTranscribe(req.tenantId);
    res.json({status: 'ok', message: 'Transcription completed. Check server logs for details.'});
  } catch (err) {
    console.error('❌ Error during transcription:', err);
    res.status(500).json({status: 'error', message: err.message});
  }
});

// Endpoint to process old dreams that haven't been categorized
app.post('/process-old-dreams', cors(), async (req, res) => {
  console.log('🔄 Processing old dreams - creating connections and analyzing...');
  try {
    await runJobs(req.tenantId);
    res.json({status: 'ok', message: 'Old dreams processing completed. Check server logs for details.'});
  } catch (err) {
    console.error('❌ Error processing old dreams:', err);
    res.status(500).json({status: 'error', message: err.message});
  }
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

datastore.connect();