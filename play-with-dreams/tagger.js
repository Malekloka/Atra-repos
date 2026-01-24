export default class Tagger {
  constructor(openai, keys) {
    this.keys = keys;
    console.log(keys);
    this.openai = openai;
    if(keys.length === 1){
      this.instruction = 'Analyze the the following text. ' +
      'say how much the text fits the word ' + keys[0] + ' from 0 to 1.' +
      'Return only a simple json object of the word and its score.';
    } else {
      this.instruction = 'Analyze the the following text. ' +
      'say how much the text fits each words from 0 to 1.' +
      'the words are: ' + keys.join(', ') + '.' +
      'Return only a simple json object of the words and their scores.';
    }
  }

  async analyze(sentence) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: this.instruction
        },
        {
          role: "user",
          content: sentence
        }
      ]
    });
    console.log(response.choices[0].message.content);

    let content = response.choices[0].message.content;
    content = content.replace(/```json|```/g, '');
    return JSON.parse(content);
  }
}