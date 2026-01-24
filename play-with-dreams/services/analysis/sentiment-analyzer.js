import openai from './openai.js';

export default class SentimentAnalyzer {
  constructor() {
    
  }

  createInstruction() {
    return 'Analyze the following dream text and determine if it was a good dream or a bad dream. ' +
           'Return a number from 0 to 10 where: ' +
           '0-4 = good/positive dream (peaceful, happy, pleasant, joyful, calm, content) ' +
           '5-10 = bad/negative dream (frightening, sad, stressful, disturbing, anxious, traumatic). ' +
           'Return ONLY the number (0-10), no explanation, no text, just the number.';
  }

  async analyze(text) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: this.createInstruction()
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3 // Lower temperature for more consistent results
      });

      let content = response.choices[0].message.content.trim();
      
      // Extract just the number, in case there's any extra text
      const numberMatch = content.match(/\d+/);
      if (numberMatch) {
        const value = parseInt(numberMatch[0], 10);
        // Clamp to 0-10 range
        return Math.max(0, Math.min(10, value));
      }
      
      // If no number found, default to neutral (5)
      console.warn('No number found in sentiment analysis response:', content);
      return 5;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      // Default to neutral (5) on error
      return 5;
    }
  }
}


