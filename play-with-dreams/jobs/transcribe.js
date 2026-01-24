import datastore from '../services/database/datastore.js';
import Transcriber from '../services/transcriber/transcriber.js';

const EMOJI = '🎤';

const getNextItem = async () => {
  return datastore.items.getPublished({ 
    $or: [
      {text: {$exists: false}},
      {text: ''},
      {text: null},
      {text: undefined}
    ],
    audioUrl: {$exists: true}
  });
}

export async function runTranscribe(){
  const transcriber = new Transcriber();
  let item = await getNextItem();

  if (!item) {
    console.log(`${EMOJI} No items found that need transcription`);
    return;
  }

  let count = 0;
  while(item){
    count++;

    // Decide which URL to transcribe:
    // - For Cloudinary-style URLs (/video/upload/...), use an mp3-transformed URL.
    // - For local/dev uploads (/uploads/...) or any other URL, use the original audioUrl as-is.
    let sourceUrl = item.audioUrl;
    if (sourceUrl && sourceUrl.includes('/video/upload/')) {
      sourceUrl = sourceUrl
        .replace(/\.[a-z0-9]+$/i, '.mp3')
        .replace('/video/upload/', '/video/upload/e_volume:250/');
    }

    // Determine language for transcription
    // Use display_language if available, otherwise default to Hebrew
    let language = item.display_language || 'he';
    console.log(`${EMOJI} [${count}] Transcribing item ${item._id} (language: ${language}): ${sourceUrl}`);
    
    try {
      const transcription = await transcriber.transcribe(sourceUrl, language);
      // OpenAI returns { text: "..." } when response_format is "json"
      const text = transcription.text || transcription;
      if (!text || typeof text !== 'string') {
        console.error(`❌ Invalid transcription result for item ${item._id}:`, transcription);
        item = await getNextItem();
        continue;
      }
      item.text = text;
      await datastore.items.saveItem(item);
      console.log(`✅ [${count}] Transcribed item ${item._id}: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    } catch (error) {
      console.error(`❌ Error transcribing item ${item._id}:`, error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      // Continue with next item instead of stopping
    }
    item = await getNextItem();
  }

  console.log(`\n${EMOJI} Done transcribing ${count} item(s)`);
}