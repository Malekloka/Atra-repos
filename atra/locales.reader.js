var fs = require('fs');

const cache = {};

const get = async (lang) => {
  if(cache[lang]){
    return cache[lang];
  }
  let file = `locales/${lang}.json`;
  if(!fs.existsSync(file)){
    file = `locales/en.json`;
  }
  const content = await fs.promises.readFile(file, 'utf8');
  const data = JSON.parse(content);
  data['locale'] = lang;
  cache[lang] = data;
  return data;
}

module.exports = {
  get
}
