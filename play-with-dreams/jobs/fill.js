import datastore from '../services/database/datastore.js';

export async function runFill() {
  console.log('📋 Starting runFill: Creating connections between dreams and categories...');
  
  const items = await datastore.items.collectPublished({text: {$exists: true}}, { _id: 1 });
  console.log(`   Found ${items.length} published items with text`);

  const themes = await datastore.themes.collect({}, { _id: 1, text: 1 });
  console.log(`   Found ${themes.length} themes/categories`);

  const connections = [];

  for (const item of items) {
    for (const theme of themes) {
      if(theme._id && item._id && theme.text){
        connections.push({
          itemId: item._id,
          themeId: theme._id
        });
      }
    }
  }

  console.log(`   Creating/updating ${connections.length} connections...`);
  await datastore.connections.bulkUpsert(connections);

  console.log('✅ runFill completed');
}