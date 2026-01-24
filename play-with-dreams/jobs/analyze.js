import datastore from '../services/database/datastore.js';
import Analyzer from '../services/analysis/analyzer.js';

const EMOJI = '🧪';

const getNextConnection = async () => {
  return datastore.connections.get(
    {value: {$exists: false}}
  );
}

export async function runAnalyze() {
  let connection = await getNextConnection();
  let count = 0;
  let item;
  while(connection){
    count++;
    item = await datastore.items.get(connection.itemId);
    const theme = await datastore.themes.get(connection.themeId);
    if(!theme.text || !item.text || !connection.themeId){
      console.log(`${EMOJI} Deleting junk connection 🚮`);
      console.log('      :: ', connection._id, item._id, item?.text, theme?.text);

      await datastore.connections.delete(connection._id);
      connection = await getNextConnection();
      continue;
    }
    console.log('------------------------------------------');
    console.log(`${EMOJI} Analyzing connection between item ${item.text} and theme ${theme.text}`);
    
    const analyzer = new Analyzer(theme.text);
    const valueString = await analyzer.analyze(item.text);
    const value = parseFloat(valueString);
    await datastore.connections.update(connection._id, {value});
    console.log(`${EMOJI} Analyzed connection value was: ${value}`);

    const nextConnectionForItem = await datastore.connections.get({itemId: item._id, value: {$exists: false}});

    if(nextConnectionForItem){
      console.log(`${EMOJI} Item ${item._id} has more connections to analyze`);
      connection = nextConnectionForItem;
    } else {
      console.log(`${EMOJI} Item ${item._id} is fully analyzed`);
      await datastore.items.update(item._id, {fullyAnalyzed: true});
      connection = await getNextConnection();
      if(!connection){
        console.log(`${EMOJI} No more connections to analyze`);
        break;
      }
      item = await datastore.items.get(connection.itemId);
    }
  }

  // DONE
  console.log(`${EMOJI} Done analyzing ${count} connections`);
}
