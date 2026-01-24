import datastore from '../services/database/datastore.js';
import Translator from '../services/translation/translator.js';

const EMOJI = '🌐';

const languages = ['en', 'he', 'ar'];

async function runTranslateThemes(language){
  const themes = await datastore.themes.collect({ [language]: {$exists: false} });
  const translator = new Translator(language);
  let count = 0;
  for(const theme of themes){
    count++;
    const translatedTheme = await translator.translate(theme.text);
    theme[language] = translatedTheme;
    console.log(`${EMOJI} translating themes (${count}) to [${language}]: translated "${theme.text}" to "${translatedTheme}"`);
    await datastore.themes.saveItem(theme);
  }
  console.log(`${EMOJI} done translating ${count} themes to ${language}`);
}

async function runTranslateItems(language, fixAll){
  const items = await datastore.items.collectPublished(fixAll ? {} : { [language]: {$exists: false} });
  const translator = new Translator(language);
  let count = 0;
  for(const item of items){
    count++;
    console.log(`${EMOJI} translating items to [${language}]: translating item ${count} of ${items.length}`);

    // already in target language, no need to translate, just save
    if(translator.isInTargetLanguage(item.text)){
      item[language] = item.text;
      await datastore.items.saveItem(item);
      continue;
    }

    // skip short items
    if(!item.text || item.text?.length < 10){
      item[language] = item.text;
      await datastore.items.saveItem(item);
      console.log(`${EMOJI} translating items to [${language}]: item ${count} of ${items.length} is too short to translate`);
      continue;
    }

    // need to translate
    const translatedItem = item.text ? await translator.translate(item['en'] ?? item.text) : '';
    if(translator.isInTargetLanguage(translatedItem)){
      item[language] = translatedItem;
      await datastore.items.saveItem(item);
    } else {
      item[language] = item['en'] ?? item.text;
      await datastore.items.saveItem(item);
      console.log(`${EMOJI} translating items to [${language}]: item ${count} of ${items.length} failed to translate`);
    }
  }
  console.log(`${EMOJI} done translating ${items.length} items to ${language}`);
}


export async function runTranslate(){
  for(const language of languages){
    await runTranslateThemes(language);
    await runTranslateItems(language);
  }
  console.log(`${EMOJI} done translating`);
}