import openai from "../openai/openai.js";

const languageNames = {
  'en': 'English',
  'he': 'Hebrew',
  'ar': 'Arabic'
}

const languageTestsRegex = {
  'en': /[a-zA-Z]/,
  'he': /[\u0590-\u05FF]/,
  'ar': /[\u0600-\u06FF]/,
}

export default class Translator {
  constructor(langCode) {
    this.langCode = langCode;
    this.language = languageNames[langCode] || langCode;
  }

  createInstruction() {
    return 'Translate the following text to ' + this.language + ". return the translated text as a response. if the text is already in " + this.language + " return the same text";
  }

  async translate(text) {
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

  isInTargetLanguage(text) {
    return languageTestsRegex[this.langCode].test(text);
  }
}