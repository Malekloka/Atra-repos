import openai from './openai.js';

export default class Extractor {
  constructor() {
    
  }

  createInstruction() {
    // return  'Shortly, and in English, What is the prominent theme of the following dream?';
    return 'In one English word, without explanation, What is the prominent symbol in the following dream?';
  }

  async analyze(text) {
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
        },
        {
          role: 'user',
          content: 'in English'
        }
      ]
    });

    const w = response.choices[0].message.content;

    // const cleaned = w.replace(/[^a-zA-Z ]/g, "");

    return w;
  }
}