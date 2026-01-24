import { toFile } from "openai";

import openai from "../openai/openai.js";

const getStreamFromUrl = async (url) => {
  // In local/dev environment we may only have a relative URL (e.g. /uploads/...)
  // Build a full URL against the atra server so fetch works.
  if (url && url.startsWith('/')) {
    const base = process.env.ATRA_BASE_URL || 'http://localhost:8000';
    url = base.replace(/\/$/, '') + url;
  }

  const response = await fetch(url);
  return await toFile(response, 'audio.mp3');
};

export default class Transcriber {
  constructor(language = null) {
    this.language = language; // Optional: 'he', 'ar', 'en', etc.
  }

  async transcribe(audioUrl, language = null) {
    // Use provided language, or instance language, or default to Hebrew
    const lang = language || this.language || 'he';
    
    const transcription = await openai.audio.transcriptions.create({
      file: await getStreamFromUrl(audioUrl),
      model: "whisper-1",
      language: lang, // Explicitly specify language for better accuracy
      response_format: "json"
    });
    
    return transcription;
  }
}