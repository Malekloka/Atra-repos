import openai from "./openai.js";

export default class Analyzer {
  constructor(theme) {
    this.theme = theme;
  }

  createInstruction() {
    return 'How much the text relate to the word ' + this.theme + ' as a main theme from 0 to 1? just the number, no explanation';
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
        }
      ]
    });

    let content = response.choices[0].message.content;
    return content;
  }
}