import express from 'express';
import datastore from '../services/database/datastore.js';
import { ObjectId } from 'mongodb';
import Extractor from '../services/analysis/extractor.js';
import Translator from '../services/translation/translator.js';
import SentimentAnalyzer from '../services/analysis/sentiment-analyzer.js';

const router = express.Router();

const kEmotions = ['fear', 'happiness', 'sadness', 'anger', 'confusion', 'hope', 'peacefulness'];

router.post('/api/poll', async (req, res) => {
  const { lastPoll, mapName, city, originalMapName } = req.body;
  
  // Get the map first to check if it's a combined cities map or dual cluster map
  const map = await datastore.maps.get({name: mapName || 'map'});
  const isCombinedCitiesMap = map && map.cities && Array.isArray(map.cities) && map.cities.length > 0 && !map.isDualCluster;
  const isDualClusterMap = map && map.isDualCluster;
  
  // For dual cluster maps, use originalMapName for theme queries (if provided)
  // This ensures we get the correct themes (Life Topics or Jungian) based on the actual map type
  // If originalMapName is not provided for dual cluster, infer from map name
  let themeMapName = mapName;
  if (isDualClusterMap) {
    if (originalMapName) {
      themeMapName = originalMapName;
    } else {
      // Infer from dual cluster map name if originalMapName not provided
      if (mapName === 'map_dual_clusters_jungian') {
        themeMapName = 'jungian';
      } else {
        themeMapName = 'map'; // Default to Life Topics
      }
      console.log(`[Backend] Warning: originalMapName not provided for dual cluster map ${mapName}, inferred: ${themeMapName}`);
    }
  }
  
  // Build query - start with updateAt if lastPoll exists
  const query = {};
  if (lastPoll) {
    query.updateAt = { $gt: lastPoll };
  }
  
  // Filter by city if city filter is selected OR if using combined cities map
  if (isDualClusterMap) {
    // For dual cluster map, ONLY show dreams that have a city (arad or tel-aviv)
    // Exclude dreams without a city specified - must have city field and it must be arad or tel-aviv
    // Use $and to combine multiple conditions on the same field
    const cityConditions = [
      { city: { $exists: true } },
      { city: { $ne: null } },
      { city: { $ne: '' } },
      { city: { $in: ['arad', 'tel-aviv'] } }
    ];
    
    if (query.$and) {
      query.$and = [...query.$and, ...cityConditions];
    } else {
      query.$and = cityConditions;
    }
  } else if (isCombinedCitiesMap) {
    // For combined cities map, show dreams from both cities
    query.city = { $in: map.cities };
  } else if (city && city !== '') {
    if (city === 'both') {
      // Special case: "both" means show Arad and Tel-Aviv together
      query.city = { $in: ['arad', 'tel-aviv'] };
    } else {
      // Filter for specific city
      const normalizedCity = city === 'telaviv' ? 'tel-aviv' : city;
      query.city = normalizedCity;
    }
  }
  // If no city filter (null, undefined, or empty string), show all dreams (no city filter applied)
  
  const items = await datastore.items.collectPublished(query, { 
    _id: 1, 
    text: 1, 
    audioUrl: 1, 
    fullyAnalyzed: 1, 
    name: 1,
    en: 1,
    he: 1,
    ar: 1, 
    good_bad_dream: 1,
    city: 1,
    ...kEmotions.reduce((acc, emotion) => ({ ...acc, [emotion]: 1 }), {})
  });

  // Ensure each item has translations in all interface languages (en, he, ar)
  // This makes new dreams immediately viewable on the map in the current UI language
  const uiLanguages = ['en', 'he', 'ar'];
  const translators = {
    en: new Translator('en'),
    he: new Translator('he'),
    ar: new Translator('ar')
  };

  // Helper to detect which language a text is in
  const detectLanguage = (text) => {
    if (!text || typeof text !== 'string') return null;
    
    // Count matches for each language
    const scores = {
      en: (text.match(/[a-zA-Z]/g) || []).length,
      he: (text.match(/[\u0590-\u05FF]/g) || []).length,
      ar: (text.match(/[\u0600-\u06FF]/g) || []).length,
    };
    
    // Return the language with the highest score
    const maxScore = Math.max(scores.en, scores.he, scores.ar);
    if (maxScore === 0) return null;
    
    if (scores.en === maxScore) return 'en';
    if (scores.he === maxScore) return 'he';
    if (scores.ar === maxScore) return 'ar';
    
    return null;
  };

  // Helper to find the best source text for translation
  const findSourceText = (item) => {
    // Priority: use existing language-specific field if available
    if (item.en && item.en.trim()) return { text: item.en, lang: 'en' };
    if (item.he && item.he.trim()) return { text: item.he, lang: 'he' };
    if (item.ar && item.ar.trim()) return { text: item.ar, lang: 'ar' };
    
    // Fallback: use text field and detect its language
    if (item.text && item.text.trim()) {
      const detectedLang = detectLanguage(item.text);
      return { text: item.text, lang: detectedLang };
    }
    
    return null;
  };

  for (const item of items) {
    const source = findSourceText(item);
    if (!source) continue;

    const updates = {};
    for (const lang of uiLanguages) {
      // Skip if already has translation
      if (item[lang] && item[lang].trim()) {
        continue;
      }
      
      // Skip if source language is the same as target - just use the original text
      if (source.lang === lang) {
        // If source.lang is detected, store it in the proper field
        if (source.lang && !item[source.lang]) {
          updates[source.lang] = source.text;
        }
        continue;
      }
      
      // Check if text is already in target language before translating
      const targetTranslator = translators[lang];
      if (targetTranslator.isInTargetLanguage(source.text)) {
        // Text is already in target language, just use it as-is
        updates[lang] = source.text;
        item[lang] = source.text;
        console.log(`✓ Item ${item._id}: text already in ${lang}, using original`);
        continue;
      }
      
      // Translate from source to target language
      try {
        const translated = await translators[lang].translate(source.text);
        updates[lang] = translated;
        item[lang] = translated;
        console.log(`🌐 Auto-translated item ${item._id} from ${source.lang || 'detected'} to ${lang}`);
      } catch (error) {
        console.error(`Error auto-translating item ${item._id} to ${lang}:`, error);
      }
    }

    if (Object.keys(updates).length > 0) {
      await datastore.items.update(item._id, updates, { silent: true });
    }
  }
  
  // Get all published maps, but exclude individual city-specific maps and dual cluster map
  // Dual cluster map is only accessible via city filter dropdown, not main maps dropdown
  // City filtering is now handled by the separate city filter dropdown OR by map selection
  const allMaps = lastPoll ? null : await datastore.maps.collect({isPublished: true}, {name: 1, en: 1, he: 1, ar: 1, cities: 1, isDualCluster: 1});
  const maps = allMaps ? allMaps.filter(m => {
    // Exclude individual city maps and dual cluster map (only accessible via city filter)
    if (m.name === 'map_arad' || m.name === 'map_tel-aviv' || m.name === 'map_dual_clusters' || m.isDualCluster) return false;
    return true; // Include all other maps
  }) : null;
  
  // Get themes - always include all themes for the current map (not just updated ones)
  // This ensures the hub modal dropdown shows all available categories
  // For dual cluster maps, use themeMapName (which is originalMapName) instead of mapName
  let themesQuery;
  
  // Simple rule: Only show themes that belong to the current map
  // For dual cluster maps, use the original map name (Life Topics or Jungian) for theme queries
  if (themeMapName === 'map' || !themeMapName) {
    // For Life Topics map: show ALL themes with mapName='map' (no mapName filter needed since we fixed DB)
    // We want ALL Life Topics themes, not just ones referenced by hubs
    themesQuery = {
      mapName: 'map'
    };
  } else {
    // For other maps (like Jungian): ONLY show themes with matching mapName
    themesQuery = {
      mapName: themeMapName
    };
  }
  
  // Always get all themes for the map (for dropdown completeness)
  // This ensures the hub modal shows ALL available themes for the map type, not just default ones
  // IMPORTANT: Always fetch ALL themes, regardless of lastPoll, to ensure dropdown is complete
  // When lastPoll is null (initial load or map switch), we get all themes
  // When lastPoll exists (incremental update), we STILL get all themes to ensure completeness
  const allThemesForMap = await datastore.themes.collect(themesQuery);
  
  // For incremental updates, also get recently updated themes to catch any new ones
  // But we always include all themes above, so this is just for catching new additions
  const updatedThemes = lastPoll 
    ? await datastore.themes.collect({ 
        updateAt: { $gt: lastPoll },
        ...themesQuery  // Only get updated themes that match the current map
      })
    : [];
  
  // Merge: combine all map themes with updated themes, removing duplicates
  // Since we always fetch all themes above, this ensures the dropdown is always complete
  const themeMap = new Map();
  allThemesForMap.forEach(theme => {
    themeMap.set(theme._id.toString(), theme);
  });
  updatedThemes.forEach(theme => {
    themeMap.set(theme._id.toString(), theme);
  });
  const themes = Array.from(themeMap.values());
  
  // Verify we have all themes - if we're querying for Life Topics, we should have 20 themes
  if (themeMapName === 'map' && themes.length < 20) {
    console.error(`[Backend] WARNING: Expected 20 Life Topics themes but only got ${themes.length}!`);
  }
  
  // Filter connections to only include connections for items that were returned
  // This ensures connections match the filtered items (by city or otherwise)
  const itemIds = items.map(item => {
    return typeof item._id === 'string' ? new ObjectId(item._id) : item._id;
  });
  
  let connectionsQuery = { value: { $gt: 0.1 } };
  
  // Always filter connections by itemIds (the items that were returned)
  if (itemIds.length > 0) {
    connectionsQuery.itemId = { $in: itemIds };
  } else {
    // If no items match, return empty connections
    connectionsQuery = { _id: { $exists: false } }; // Impossible query
  }
  
  const connections = await datastore.connections.collect(
    connectionsQuery, 
    { themeId:1, itemId: 1, value: 1 });

  res.json({items, themes, connections, map, maps, time: new Date(), emotions: kEmotions});
});

// get connections
router.post('/api/connections', async (req, res) => {
  const { themeId } = req.body;
  const connections = await datastore.connections.collect({ themeId: new ObjectId(themeId) }, { themeId:1, itemId: 1, value: 1 });
  res.json(connections);
});

// get all themes
router.post('/api/themes', async (req, res) => {
  const themes = await datastore.themes.collect({}, { _id: 1, text: 1 });
  res.json(themes);
});

// save map
router.post('/api/map', async (req, res) => {
  const { update, mapName, adminPassword } = req.body;
  if(!adminPassword || adminPassword.trim() !== (process.env.ADMIN_PASSWORD ?? 'admin')){
    return res.status(403).json({error: 'Unauthorized'});
  }
  if(!mapName){
    return res.status(400).json({error: 'Map name is required'});
  }
  if(!update){
    return res.status(400).json({error: 'Update object is required'});
  }
  // Allow saving empty hubs array (for clearing maps)
  // Ensure hubs is always an array (even if empty)
  const updateData = {
    ...update,
    hubs: update.hubs || []
  };
  await datastore.maps.upsert({name: mapName}, updateData);
  res.json({status: 'ok'});
});

// get comments for a dream
router.post('/api/comments', async (req, res) => {
  try {
    const { itemId } = req.body;
    if(!itemId){
      return res.status(400).json({error: 'Item ID is required'});
    }
    const comments = await datastore.comments.collect(
      { itemId: new ObjectId(itemId) },
      { _id: 1, itemId: 1, text: 1, he: 1, en: 1, ar: 1, authorName: 1, createdAt: 1 }
    );
    // Sort by creation date, newest first
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(comments);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({error: 'Failed to get comments', details: error.message});
  }
});

// add a comment to a dream
router.post('/api/add-comment', async (req, res) => {
  try {
    const { itemId, text, authorName, language } = req.body;
    
    if(!itemId || !text || !text.trim()){
      return res.status(400).json({error: 'Item ID and comment text are required'});
    }
    
    const originalText = text.trim();
    const sourceLang = language || 'en';
    
    // Translate comment to all languages
    const languages = ['en', 'he', 'ar'];
    const translations = {};
    
    // Store original text in source language
    translations[sourceLang] = originalText;
    
    // Translate to other languages
    for (const targetLang of languages) {
      if (targetLang === sourceLang) {
        continue; // Skip if it's the source language
      }
      
      try {
        const translator = new Translator(targetLang);
        const translated = await translator.translate(originalText);
        translations[targetLang] = translated;
        console.log(`Translated comment to ${targetLang}: "${translated}"`);
      } catch (error) {
        console.error(`Error translating comment to ${targetLang}:`, error);
        // Fallback to original text if translation fails
        translations[targetLang] = originalText;
      }
    }
    
    // Store comment with all translations
    const commentData = {
      itemId: new ObjectId(itemId),
      authorName: authorName?.trim() || 'Anonymous',
      createdAt: new Date(),
      en: translations.en || originalText,
      he: translations.he || originalText,
      ar: translations.ar || originalText,
      text: originalText // Keep original for backward compatibility
    };
    
    const commentId = await datastore.comments.create(commentData);
    
    const comment = await datastore.comments.get(commentId);
    
    // Emit socket event for real-time updates
    if(req.io){
      req.io.emit('new-comment', { itemId, comment });
    }
    
    res.json({
      success: true,
      comment: comment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({error: 'Failed to add comment', details: error.message});
  }
});

// add new dream with automatic categorization
router.post('/api/add-dream', async (req, res) => {
  try {
    const { text, mapName, city } = req.body;
    
    if(!text || !text.trim()){
      return res.status(400).json({error: 'Dream text is required'});
    }

    // Analyze sentiment to determine good/bad dream value (0-10)
    const sentimentAnalyzer = new SentimentAnalyzer();
    const goodBadDreamValue = await sentimentAnalyzer.analyze(text.trim());
    
    // Normalize city field if provided (telaviv -> tel-aviv)
    // If empty string or null, leave city undefined so dream appears in main cluster
    let normalizedCity = undefined;
    if(city && city.trim()){
      const cityLower = city.toLowerCase().trim();
      normalizedCity = cityLower === 'telaviv' ? 'tel-aviv' : cityLower;
    }
    
    // Create the dream item with good_bad_dream value
    const itemData = {
      text: text.trim(),
      isDraft: false,
      fullyAnalyzed: false,
      good_bad_dream: goodBadDreamValue,
      createdAt: new Date()
    };
    
    // Add city field only if provided
    if(normalizedCity){
      itemData.city = normalizedCity;
    }
    
    const itemId = await datastore.items.create(itemData);

    const item = await datastore.items.get(itemId);

    // Extract main theme from the dream
    const extractor = new Extractor();
    const mainTheme = await extractor.analyze(item.text);
    
    // Create/upsert the theme
    await datastore.themes.upsert({text: mainTheme.trim()}, {
      text: mainTheme.trim(),
      mapName: mapName || 'map',
      sourceItem: itemId
    });

    // Get all existing themes
    const themes = await datastore.themes.collect({}, { _id: 1, text: 1 });

    // Create connections between the new item and all themes
    const connections = [];
    for (const theme of themes) {
      if(theme._id && theme.text){
        connections.push({
          itemId: itemId,
          themeId: theme._id
        });
      }
    }

    if(connections.length > 0){
      await datastore.connections.bulkUpsert(connections);
    }

    // Return the created item
    res.json({
      success: true,
      item: {
        _id: itemId,
        text: item.text,
        mainTheme: mainTheme.trim()
      },
      message: 'Dream added successfully and categorized'
    });
  } catch (error) {
    console.error('Error adding dream:', error);
    res.status(500).json({error: 'Failed to add dream', details: error.message});
  }
});

export default router;