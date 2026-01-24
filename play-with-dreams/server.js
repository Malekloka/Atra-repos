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

// Enable CORS for all routes
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const activeSockets = [];

io.on('connection', (socket) => {
  activeSockets.push(socket);

  socket.on('update', (message) => {
    io.emit('update', message);
  });

  socket.on('disconnect', () => {
    const index = activeSockets.indexOf(socket);
    if (index !== -1) {
      activeSockets.splice(index, 1);
    }
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
  const item = await datastore.items.get(req.params.id);
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
  datastore.items.saveItem(item);
  res.json(item);
});

app.post('/:id/recalculate', async (req, res) => {
  console.log(req.body);
  const { keys } = req.body;
  const item = await datastore.items.get(req.params.id);

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

  const item = await datastore.items.update(req.params.id, data);
  res.json(item);
});

app.post('/process', cors(), async (req, res) => {
  console.log('🔄 Processing request received - starting jobs...');
  runJobs().catch(err => {
    console.error('❌ Error running jobs:', err);
  });
  res.json({status: 'ok', message: 'Processing started. Check server logs for progress.'});
});

// Endpoint to transcribe audio dreams only
app.post('/transcribe', cors(), async (req, res) => {
  console.log('🎤 Transcription request received...');
  try {
    const { runTranscribe } = await import('./jobs/transcribe.js');
    await runTranscribe();
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
    await runJobs();
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