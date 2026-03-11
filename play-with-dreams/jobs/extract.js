import datastore from '../services/database/datastore.js';
import Extractor from '../services/analysis/extractor.js';

const extractor = new Extractor();

const flagExtractedMainTheme = 'extracted-main-theme';

const details = {
  _id: 1,
  text: 1,
  audioUrl: 1,
  tags: 1,
  [flagExtractedMainTheme]: 1,
}

const queries = {
  unextractedItemsQuery: {[flagExtractedMainTheme]: {$exists: true}},
}

async function run(tenantId = 'default'){
  const unextractedItems = await datastore.items.collectPublished(
    { ...queries.unextractedItemsQuery, tenantId },
    details
  );
  for(const item of unextractedItems){
    const mainTheme = await extractor.analyze(item.text);
    console.log(item.text);
    console.log(mainTheme);
    item[flagExtractedMainTheme] = mainTheme;
    await datastore.items.saveItem(item);
    await datastore.themes.upsert(
      { sourceItem: item._id, tenantId },
      { text: mainTheme, tenantId }
    );
  }
}

async function addTheme (text, tenantId = 'default') {
  await datastore.themes.upsert({ text, tenantId });
  console.log('added theme ' + text);
}


addTheme('Home');
