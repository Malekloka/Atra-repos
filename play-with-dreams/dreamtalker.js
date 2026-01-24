export default class DreamTalker {
  constructor(openai, text) {
    this.openai = openai;
    this.text = text;
  }

  async create() {
    // Split text into sentences for segments
    const sentences = this.text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
    
    // If no sentence breaks, split by commas or create a single segment
    let segments = [];
    if (sentences.length === 0) {
      segments = [this.text];
    } else {
      segments = sentences;
    }

    // Create segments with estimated timing (assuming ~150 words per minute, ~2.5 words per second)
    const segmentsData = [];
    let currentTime = 0;
    const wordsPerSecond = 2.5;

    for (const segmentText of segments) {
      const wordCount = segmentText.split(/\s+/).length;
      const duration = wordCount / wordsPerSecond;
      
      segmentsData.push({
        start: currentTime,
        end: currentTime + duration,
        text: segmentText.trim()
      });
      
      currentTime += duration;
    }

    return {
      segments: segmentsData,
      text: this.text
    };
  }
}

