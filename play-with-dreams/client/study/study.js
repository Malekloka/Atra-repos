import Datastore from "./datastore.js";
import HubModal from "./components/hub-modal.js";
import Stage from "./stage/stage.js";
import StageHub from "./stage/hub.js";
import DetailsBox from "./components/details-box.js";
import LanguagesDropdown from "./components/languages-dropdown.js";
import MapsDropdown from "./components/maps-dropdown.js";
import ViewOptionsDropdown from "./components/view-options-dropdown.js";
import CityFilterDropdown from "./components/city-filter-dropdown.js";
import CheckBox from "./components/checkbox.js";
import mathUtils from "./util/math.js";

const translations = {
  chkColorGoodBadDream: {
    en: 'Show Color Good/Bad Dream Gradient',
    he: 'הצגת צבעי חלום טוב/רע',
    ar: 'الألوان الجيدة/السيئة للحلم'
  },
  chkShowEmotionsFelt: {
    en: 'Show Emotions Colors on Items',
    he: 'הצגת צבעי רגשות על הפריטים',
    ar: 'عرض ألوان المشاعر على العناصر'
  },
  emotions : {
    en: ['fear', 'happiness', 'sadness', 'anger', 'confusion', 'hope', 'peacefulness'],
    he: ['פחד', 'אושר', 'עצב', 'כעס', 'בלבול', 'תקווה', 'שלום'],
    ar: ['خوف', 'سعادة', 'حزن', 'غضب', 'الارتباك', 'الأمل', 'السلام'],
  },
  goodBarDream: {
    en: ['Good Dream', 'Bad Dream'],
    he: ['חלום טוב', 'חלום רע'],
    ar: ['حلم جيد', 'حلم سيء']
  },
  exportMap: {
    en: 'Export/Share Map',
    he: 'ייצוא/שיתוף מפה',
    ar: 'تصدير/مشاركة الخريطة'
  },
  exporting: {
    en: 'Exporting map...',
    he: 'מייצא מפה...',
    ar: 'جاري تصدير الخريطة...'
  },
  exportSuccess: {
    en: 'Map exported successfully!',
    he: 'המפה יוצאה בהצלחה!',
    ar: 'تم تصدير الخريطة بنجاح!'
  },
  exportError: {
    en: 'Error exporting map',
    he: 'שגיאה בייצוא המפה',
    ar: 'خطأ في تصدير الخريطة'
  }
}


const kEmotionColors = [
  '#FDBC68', // fear
  '#D674DB', // happiness
  '#609D9F', // sadness
  '#D07B5C', // anger
  '#B0E0D0', // confusion
  '#668EFF', // hope
  '#87CEEA'  // peacefulness
]

let socket;

const datastore = new Datastore();

const stage = new Stage(document.querySelector('.stage'));

const detailsBox = new DetailsBox(document.querySelector('.details-box-container'));

const hubModal = new HubModal(document.querySelector('.hub-modal'));

const languagesDropdown = new LanguagesDropdown(document.querySelector('#languages-dropdown'));

const mapsDropdown = new MapsDropdown(document.querySelector('#maps-dropdown'));

const cityFilterDropdown = new CityFilterDropdown(document.querySelector('#city-filter-dropdown'));

const viewOptionsDropdown = new ViewOptionsDropdown(document.querySelector('#view-options-dropdown'));

const chkColorGoodBadDream = new CheckBox(document.querySelector('#chk-color-good-bad-dream'), translations.chkColorGoodBadDream)

const chkShowEmotionsFelt = new CheckBox(document.querySelector('#chk-show-emotions-felt'), translations.chkShowEmotionsFelt)

const queryParams = new URLSearchParams(window.location.search);
const trackItemName = queryParams.get('item');

let mapName = queryParams.get('map') ?? 'map';
let selectedCity = ''; // Empty string means "All Cities"

// Initialize originalMapName for dual cluster maps on page load
if (mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian') {
  // If we're loading a dual cluster map, set originalMapName based on the map name
  if (mapName === 'map_dual_clusters_jungian') {
    datastore.originalMapName = 'jungian';
  } else {
    datastore.originalMapName = 'map'; // Default to Life Topics
  }
} else {
  // For regular maps, originalMapName is the same as mapName
  datastore.originalMapName = mapName;
}

const isGallery = !!queryParams.get('gallery');
const isGalleryControl = !!queryParams.get('galleryControl');

let _themes = [];

let _language = queryParams.get('lang') || 'he';
// Set initial language attribute for CSS language switching
document.body.setAttribute('data-lang', _language);

let _pollTimer;

let _activeItem;

let adminPassword = 'admin'; // Default admin password for map editing

let isStageLoaded = false;
let isInitialLoad = true; // Track if this is the first load after page refresh

// Function to update hub modal with filtered themes
function updateHubModalThemes() {
  // Don't update the modal if it's currently open - this would close it
  // The modal will be updated when it's opened next time, or when themes change on map switch
  if (hubModal.isOpen) {
    return;
  }

  if(_themes?.length > 0){
    // Filter themes to only show those for the current map
    // For dual cluster maps, use the original map name (not the dual cluster map name)
    let currentMapName = mapName;
    if (mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian') {
      // For dual cluster maps, we need to use the original map name
      // Check if originalMapName is set, otherwise infer from mapName
      if (datastore.originalMapName) {
        currentMapName = datastore.originalMapName;
      } else if (mapName === 'map_dual_clusters_jungian') {
        currentMapName = 'jungian';
      } else {
        currentMapName = 'map'; // Default to Life Topics for map_dual_clusters
      }
    }
    
    const filteredThemes = _themes.filter(theme => {
      // Simple rule: match by mapName
      if (currentMapName === 'map' || !currentMapName) {
        // Life Topics: show themes with mapName='map' OR no mapName
        return !theme.mapName || theme.mapName === 'map';
      } else {
        // Other maps (Jungian): ONLY show themes with matching mapName
        return theme.mapName === currentMapName;
      }
    });
    
    // Only update hub modal if we have filtered themes
    if (filteredThemes.length > 0) {
      hubModal.setOptions(filteredThemes);
      hubModal.translate(_language);
    } else {
      // Clear hub modal if no matching themes
      hubModal.setOptions([]);
    }
  } else {
    // If no themes, clear the hub modal options
    hubModal.setOptions([]);
  }
}

// Good/Bad filter button handlers
function setupGoodBadFilterButtons() {
  const btnShowGood = document.getElementById('btn-show-good-dreams');
  const btnShowBad = document.getElementById('btn-show-bad-dreams');

  if (!btnShowGood || !btnShowBad) return;

  btnShowGood.addEventListener('click', () => {
    // Toggle good filter
    if (goodBadFilter === 'good') {
      goodBadFilter = 'all';
      btnShowGood.classList.remove('active');
    } else {
      goodBadFilter = 'good';
      btnShowGood.classList.add('active');
      btnShowBad.classList.remove('active');
    }
    applyGoodBadFilter();
    setTimeout(updateStatistics, 100);
  });

  btnShowBad.addEventListener('click', () => {
    // Toggle bad filter
    if (goodBadFilter === 'bad') {
      goodBadFilter = 'all';
      btnShowBad.classList.remove('active');
    } else {
      goodBadFilter = 'bad';
      btnShowBad.classList.add('active');
      btnShowGood.classList.remove('active');
    }
    applyGoodBadFilter();
    setTimeout(updateStatistics, 100);
  });
}

const findTheme = (themeId) => {
  const theme = _themes.find(theme => theme._id === themeId);
  return theme;
}

const changeLanguage = (new_language) => {
  _language = new_language;
  shouldSendGalleryState = true;
  
  // Update body data-lang attribute for CSS language switching
  document.body.setAttribute('data-lang', new_language);

  // translate all themes
  stage.hubs.forEach(hub => {
    hub.translate(_language);
  });

  // translate all components
  [
    hubModal,
    detailsBox,
    mapsDropdown,
    cityFilterDropdown,
    chkColorGoodBadDream,
    chkShowEmotionsFelt
  ].forEach(component => {
    component.translate(_language);
  });
  
  // Update export button title
  const btnExportMap = document.querySelector('#btn-export-map');
  if(btnExportMap) {
    btnExportMap.title = translations.exportMap[_language];
  }
  
  // draw emotions colors bar
  document.querySelector('.emotions-colors-bar').innerHTML = translations.emotions[_language].map((emotion, i) => {
    return `<li class="emotion-color" style="background-color: ${kEmotionColors[i]}">${emotion}</li>`
  }).join('');

  // draw good bad dream bar with 11 elements
  // Index 0 = Good Dream (cyan), Index 10 = Bad Dream (yellow) - colors reversed
  document.querySelector('.good-bad-dream-bar').innerHTML = Array.from({length: 11}).map((_, i) => {
    let text = '';
    if(i === 0){
      text = translations.goodBarDream[_language][0]; // Good Dream (cyan)
    } else if(i === 10){
      text = translations.goodBarDream[_language][1]; // Bad Dream (yellow)
    }
    return `<li class="good-bad-dream-color" data-good-bad-dream="${i}">${text}</li>`
  }).join('');

  // Update good/bad filter button titles based on language
  const btnShowGood = document.getElementById('btn-show-good-dreams');
  const btnShowBad = document.getElementById('btn-show-bad-dreams');
  if (btnShowGood && btnShowBad) {
    const goodLabel = translations.goodBarDream[_language][0];
    const badLabel = translations.goodBarDream[_language][1];
    btnShowGood.title = goodLabel;
    btnShowBad.title = badLabel;
  }
}

let isSwitchingMaps = false;

async function clearMap(){
  isSwitchingMaps = true;
  stage.clear();
  isStageLoaded = false;
  isInitialLoad = true; // Reset initial load flag when switching maps
  _themes = [];
}

async function poll(){
  if(_pollTimer){
    clearTimeout(_pollTimer);
  }

  const {items, connections, map, themes, maps, emotions} = await datastore.poll(selectedCity);
  
  // Check if this is a dual cluster map
  const isDualClusterMap = map && map.isDualCluster;
  stage.isDualClusterMap = isDualClusterMap; // Store in stage for label syncing
  
  // Show/hide cluster labels based on map type
  const aradLabel = document.getElementById('cluster-label-arad');
  const telavivLabel = document.getElementById('cluster-label-telaviv');
  if (isDualClusterMap) {
    if (aradLabel) aradLabel.style.display = 'block';
    if (telavivLabel) telavivLabel.style.display = 'block';
    // Sync label positions immediately
    stage.syncClusterLabels();
  } else {
    if (aradLabel) aradLabel.style.display = 'none';
    if (telavivLabel) telavivLabel.style.display = 'none';
  }
  
  // For dual cluster maps, filter out items that don't have a valid city on the client side too
  const filteredItems = isDualClusterMap ? items.filter(item => {
    const itemCity = item.city;
    const isValid = itemCity && itemCity !== '' && itemCity !== null && itemCity !== undefined && (itemCity === 'arad' || itemCity === 'tel-aviv');
    if (!isValid) {
      console.log(`[Dual Cluster] Filtering out item: ${item.name || item._id}, city: ${itemCity}`);
    }
    return isValid;
  }) : items;
  
  if (isDualClusterMap) {
    console.log(`[Dual Cluster] Filtered items: ${filteredItems.length} (from ${items.length} total)`);
    const byCity = {};
    filteredItems.forEach(item => {
      const city = item.city || 'unknown';
      byCity[city] = (byCity[city] || 0) + 1;
    });
    console.log(`[Dual Cluster] Items by city:`, byCity);
  }

  if(themes?.length){
    // Always replace themes entirely (don't merge) to ensure we have ALL themes for the current map
    // The backend always sends all themes for the map, so we should always replace, not merge
    _themes = themes;
    // Immediately update hub modal after replacing themes
    updateHubModalThemes();
  } else if (isInitialLoad) {
    // If no themes returned and it's initial load, clear themes array
    _themes = [];
    // Clear hub modal
    hubModal.setOptions([]);
  }

  for(const item of filteredItems){
    let stageItem = stage.getStageItemById(item._id);
    if(!stageItem){
      stageItem = stage.createItem(item);
      if(item.name === trackItemName){
        stageItem.highlight();
      }
      stageItem.drawEmotions(emotions, kEmotionColors);
    } else {
      stageItem.fullyAnalyzed = !!item.fullyAnalyzed;
    }
    
    // ALWAYS set color - ensure EVERY dream has a color attribute
    // Default to 5 if missing
    const colorValue = item.good_bad_dream !== null && item.good_bad_dream !== undefined 
      ? item.good_bad_dream 
      : 5;
    stageItem.setGoodBadDream(colorValue);
    
    // Force set attribute immediately on the element
    if (stageItem.el) {
      const clampedValue = Math.max(0, Math.min(10, colorValue));
      const valueStr = String(clampedValue);
      stageItem.el.setAttribute('data-good-bad-dream', valueStr);
      stageItem.el.dataset.goodBadDream = valueStr;
    }
  }
  
  // Apply colors immediately without delay for faster loading
  const checkboxEl = document.getElementById('chk-color-good-bad-dream');
  if (checkboxEl && checkboxEl.checked) {
    stage.el.classList.add('show-color-good-bad-dream');
    document.body.classList.add('show-color-good-bad-dream');
    stage.setShowColorGoodBadDream(true);
  }
  
  // Update statistics after items are loaded (reduced delay for faster loading)
  if(isInitialLoad){
    setTimeout(() => {
      updateStatistics();
    }, 100);
  } else {
    setTimeout(() => {
      updateStatistics();
    }, 200);
  }
  
  // Apply search filter if active
  if(searchFilter){
    filterDreams(searchFilter);
  }

  // Re-apply good/bad filter after new items are loaded
  applyGoodBadFilter();


  if(map?.hubs){
    // Track which hubs are in the database
    const dbHubIds = new Set();
    const isDualCluster = map.isDualCluster || false;
    
    for(const hub of map?.hubs){
      // For dual cluster maps, use clusterId if available, otherwise use themeId
      const hubId = (isDualCluster && hub.clusterId) ? hub.clusterId : (hub.themeId?.toString ? hub.themeId.toString() : hub.themeId);
      dbHubIds.add(hubId);
      
      // Check if hub already exists in stage
      const existingHub = stage.hubs.find(h => {
        const hId = h.id?.toString ? h.id.toString() : h.id;
        return hId === hubId;
      });
      
      // Compare IDs as strings to handle ObjectId vs string mismatches
      const hubTheme = _themes.find(theme => {
        const themeId = theme._id?.toString ? theme._id.toString() : theme._id;
        const hubThemeId = hub.themeId?.toString ? hub.themeId.toString() : hub.themeId;
        return themeId === hubThemeId;
      });
      
      if(hubTheme){
        if(existingHub){
          // On initial load, reset to database default state (position and visibility)
          // On subsequent polls, only update if hub was just added to database
          if(isInitialLoad){
            existingHub.defaultHidden = hub.hidden || false;
            existingHub.setPosition(hub.pos);
            // Restore visibility state from database
            if(hub.hidden && !existingHub.hidden){
              stage.hideHub(existingHub);
            } else if(!hub.hidden && existingHub.hidden){
              stage.showHub(existingHub);
            }
          } else {
            // On subsequent polls, just update defaultHidden but don't reset position/visibility
            existingHub.defaultHidden = hub.hidden || false;
          }
        } else {
          // Hub doesn't exist - create it from database
          // For dual cluster, use clusterId as the hub ID, otherwise use themeId
          const hubIdForCreation = (isDualCluster && hub.clusterId) ? hub.clusterId : hub.themeId;
          await createHub(hub, hubTheme, hubIdForCreation);
          const createdHub = stage.hubs.find(h => {
            const hId = h.id?.toString ? h.id.toString() : h.id;
            const targetId = hubIdForCreation?.toString ? hubIdForCreation.toString() : hubIdForCreation;
            return hId === targetId;
          });
          // Restore default hidden state from database
          if(createdHub){
            createdHub.defaultHidden = hub.hidden || false; // Store original default state
            createdHub.city = hub.city; // Store city for connection routing
            if(hub.hidden){
              stage.hideHub(createdHub);
            }
          }
        }
      } else {
        // If theme not found in current themes, skip creating the hub
        // This prevents creating "Unknown" hubs for invalid/incomplete data
        console.warn(`Theme not found for hub: ${hub.themeId}, themeName: ${hub.themeName} - skipping hub creation`);
      }
    }
    
    // On initial load, remove any hubs that are not in the database
    // On subsequent polls, allow temporary hubs to persist until refresh
    if(isInitialLoad){
      const hubsToRemove = stage.hubs.filter(hub => {
        const hubId = hub.id?.toString ? hub.id.toString() : hub.id;
        return !dbHubIds.has(hubId);
      });
      
      for(const hub of hubsToRemove){
        stage.removeStageItem(hub);
      }
    }
    
    if(!isStageLoaded){
      isStageLoaded = true;
      stage.fitToScreen();
      isInitialLoad = false; // Mark that initial load is complete
      // Update statistics after stage is fully loaded
      setTimeout(updateStatistics, 100);
    }
  }

  if(maps){
    mapsDropdown.setOptions(maps);
    mapsDropdown.select(mapName);
    mapsDropdown.translate(_language);
  }

  // Always use accumulated themes for the hub modal, filtered by current map type
  updateHubModalThemes();

  // For dual cluster maps, remove any items that don't have a valid city
  if (isDualClusterMap && isInitialLoad) {
    const itemsToRemove = stage.items.filter(item => {
      if (item instanceof StageHub) return false; // Don't remove hubs
      const itemCity = item.item?.city;
      const hasValidCity = itemCity && itemCity !== '' && itemCity !== null && itemCity !== undefined && (itemCity === 'arad' || itemCity === 'tel-aviv');
      if (!hasValidCity) {
        console.log(`[Dual Cluster] Removing item without valid city: ${item.item?.name || item.id}, city: ${itemCity}`);
      }
      return !hasValidCity;
    });
    if (itemsToRemove.length > 0) {
      console.log(`[Dual Cluster] Removing ${itemsToRemove.length} items without valid cities`);
    }
    itemsToRemove.forEach(item => {
      stage.removeStageItem(item);
    });
  }

  if(connections?.length){
    // For dual cluster maps, only include connections for items that have a city
    let validConnections = connections;
    if (isDualClusterMap) {
      const validItemIds = new Set(filteredItems.map(item => {
        const id = item._id?.toString ? item._id.toString() : item._id;
        return id;
      }));
      validConnections = connections.filter(c => {
        const itemId = c.itemId?.toString ? c.itemId.toString() : c.itemId;
        return validItemIds.has(itemId);
      });
    }
    
    // Filter connections to only include those with meaningful values (value > 0.1)
    const filteredConnections = validConnections.filter(c => c.value > 0.1);
    
    stage.createConnections(filteredConnections);
    // Update statistics after connections are created (reduced delay)
    if(!isInitialLoad){
      setTimeout(updateStatistics, 100);
    }
  }
  
  // Also update statistics after hubs are loaded (reduced delay)
  if(map?.hubs && map.hubs.length > 0 && !isInitialLoad){
    setTimeout(updateStatistics, 100);
  }
  
  _pollTimer = setTimeout(poll, 5*1000);
}

function setActiveItem(item){
  _activeItem = item;
  shouldSendGalleryState = true;
}

function bind(){
  stage.on('hover', ({item}) => {
    if(isGallery) return;
    detailsBox.showItem(item, _language, false, datastore);
  })

  stage.on('unhover', () => {
    detailsBox.hideIfNotFixed();
  })

  stage.on('open', ({item}) => {
    setActiveItem(item);
    detailsBox.showItem(item, _language, true, datastore);
  })

  detailsBox.on('close', () => {
    setActiveItem(null);
  });

  stage.on('change', () => {
    // Changes are temporary and not saved - default view is always restored on page load
    // saveMapToDatastore();
  })

  // hub creation
  hubModal.on('change', async ({themeId, pos, themeName}) => {
    // Convert screen coordinates to stage coordinates
    const stagePos = stage.screenCoordsToStageCoords(pos);
    
    // For dual cluster maps, determine which cluster is closer
    let city = null;
    let clusterId = null;
    
    if (stage.isDualClusterMap) {
      const aradCenter = { x: 400, y: 540 };
      const telavivCenter = { x: 1520, y: 540 };
      
      const distToArad = Math.hypot(stagePos.x - aradCenter.x, stagePos.y - aradCenter.y);
      const distToTelAviv = Math.hypot(stagePos.x - telavivCenter.x, stagePos.y - telavivCenter.y);
      
      if (distToArad < distToTelAviv) {
        city = 'arad';
        clusterId = `arad_${themeId}`;
      } else {
        city = 'tel-aviv';
        clusterId = `tel-aviv_${themeId}`;
      }
    }
    
    await createHub({pos: stagePos, themeId, themeName, city, clusterId}, findTheme(themeId), clusterId);
    // Changes are temporary and not saved - default view is always restored on page load
    // saveMapToDatastore();
  });

  // right click
  stage.el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if(e.target === stage.el){
      // Ensure modal has the latest themes before showing
      updateHubModalThemes();
      hubModal.show({x: e.clientX, y: e.clientY});
    }
  });

  languagesDropdown.on('select', async (language) => {
    changeLanguage(language);
  });

  mapsDropdown.on('select', async (newMapName) => {
    if(newMapName === mapName) return;
    
    // Check if we're currently in a dual cluster view
    const isInDualCluster = mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian';
    
    // Store the original map name for dual cluster switching
    datastore.originalMapName = newMapName;
    
    // If we're in dual cluster view, switch to the corresponding dual cluster for the new map
    if (isInDualCluster) {
      if (newMapName === 'jungian') {
        mapName = 'map_dual_clusters_jungian';
      } else {
        mapName = 'map_dual_clusters';
      }
    } else {
      mapName = newMapName;
    }
    
    // Clear themes when switching maps to prevent showing wrong type
    _themes = [];
    
    datastore.setMap(mapName);
    selectedCity = ''; // Clear city filter when main map changes
    datastore.lastPoll = null; // Force full refresh
    isInitialLoad = true; // Force full reload to get correct themes
    await clearMap();
    // Wait a bit to ensure map is cleared before polling
    await new Promise(resolve => setTimeout(resolve, 100));
    await poll();
    isSwitchingMaps = false; // Re-enable saving after map switch is complete
  });

  cityFilterDropdown.on('select', async (city) => {
    // If "both" is selected, switch to dual cluster map based on current map type
    if (city === 'both') {
      // Determine which dual cluster map to use based on current map
      let dualClusterMapName;
      let originalMapName;
      
      // If we're already in a dual cluster, use the stored originalMapName
      // Otherwise, infer from current mapName
      if (mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian') {
        originalMapName = datastore.originalMapName || 'map';
      } else if (mapName === 'jungian') {
        originalMapName = 'jungian';
      } else {
        originalMapName = 'map'; // Default to Life Topics
      }
      
      if (originalMapName === 'jungian') {
        dualClusterMapName = 'map_dual_clusters_jungian';
      } else {
        // Default to Life Topics dual cluster
        dualClusterMapName = 'map_dual_clusters';
        originalMapName = 'map'; // Ensure it's 'map' for Life Topics
      }
      
      if (mapName !== dualClusterMapName) {
        mapName = dualClusterMapName;
        datastore.setMap(mapName);
        // Store the original map name so we can switch back AND for theme queries
        // This is critical - backend needs this to query correct themes
        datastore.originalMapName = originalMapName;
        console.log(`[cityFilterDropdown] Switching to dual cluster: ${dualClusterMapName}, originalMapName: ${originalMapName}`);
        selectedCity = ''; // Clear city filter - dual cluster map shows both cities
        datastore.lastPoll = null;
        isInitialLoad = true; // Force full reload
        _themes = []; // Clear themes when switching to dual cluster
        await clearMap();
        // Wait a bit to ensure map is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        await poll();
      } else {
        // Already in dual cluster mode, but make sure originalMapName is set
        if (!datastore.originalMapName) {
          datastore.originalMapName = originalMapName;
          console.log(`[cityFilterDropdown] Already in dual cluster, setting originalMapName: ${originalMapName}`);
        }
      }
    } else {
      // Normal city filter - switch back to original map if we were in dual cluster
      if (mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian') {
        // Restore the original map (Life Topics or Jungian)
        const originalMap = datastore.originalMapName || 'map';
        mapName = originalMap;
        datastore.setMap(mapName);
        delete datastore.originalMapName; // Clean up
        _themes = []; // Clear themes when switching back from dual cluster
      }
      selectedCity = city;
      // Reset lastPoll when city filter changes so we get all items for the new filter
      datastore.lastPoll = null;
      isInitialLoad = true; // Force full reload
      await clearMap();
      // Wait a bit to ensure map is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      await poll();
    }
  });

  // view options
  // chkColorGoodBadDream
  chkColorGoodBadDream.on('change', (checked) => {
    stage.setShowColorGoodBadDream(checked);
    stage.el.classList.toggle('show-color-good-bad-dream', checked);
    document.body.classList.toggle('show-color-good-bad-dream', checked);
    shouldSendGalleryState = true;
    
    // If enabled, ensure all items have colors
    if (checked) {
      setTimeout(() => {
        stage.items.forEach(item => {
          if (item.item && !stage.hubs.find(h => h.id === item.id)) {
            // This is a dream item, ensure it has color attribute
            if (item.el && !item.el.getAttribute('data-good-bad-dream')) {
              const value = item.item.good_bad_dream !== null && item.item.good_bad_dream !== undefined 
                ? item.item.good_bad_dream 
                : 5;
              item.setGoodBadDream(value);
            }
          }
        });
      }, 100);
    }
  });

  // chkShowEmotionsFelt
  chkShowEmotionsFelt.on('change', (checked) => {
    document.body.classList.toggle('show-emotions-felt', checked);
    shouldSendGalleryState = true;
  });

  // back button to home
  const btnBackHome = document.querySelector('#btn-back-home');
  if(btnBackHome) {
    btnBackHome.addEventListener('click', () => {
      window.location.href = `http://localhost:8000/${_language}/`;
    });
  }

  // export map button
  const btnExportMap = document.querySelector('#btn-export-map');
  if(btnExportMap) {
    btnExportMap.addEventListener('click', async () => {
      await exportMapAsImage();
    });
    // Update button title on language change
    btnExportMap.title = translations.exportMap[_language];
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    // Space: Toggle fullscreen
    if (e.code === 'Space' && !e.target.closest('button')) {
      e.preventDefault();
      const btnFullScreen = document.getElementById('btn-full-screen');
      if (btnFullScreen && btnFullScreen.style.display !== 'none') {
        btnFullScreen.click();
      }
    }

    // Plus/Equal: Zoom in
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault();
      const currentScale = stage.viewport.scale;
      const newScale = Math.min(2, currentScale + 0.1);
      const centerPoint = stage.screenCoordsToStageCoords({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      stage.setViewportPosition(
        mathUtils.add(
          stage.viewport.position,
          mathUtils.multiply(centerPoint, newScale - currentScale)
        )
      );
      stage.setViewportScale(newScale);
      stage.syncPosition();
    }

    // Minus: Zoom out
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      const currentScale = stage.viewport.scale;
      const newScale = Math.max(0.1, currentScale - 0.1);
      const centerPoint = stage.screenCoordsToStageCoords({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      stage.setViewportPosition(
        mathUtils.add(
          stage.viewport.position,
          mathUtils.multiply(centerPoint, newScale - currentScale)
        )
      );
      stage.setViewportScale(newScale);
      stage.syncPosition();
    }

    // Arrow keys: Pan
    const panSpeed = 50 / stage.viewport.scale; // Pan speed adjusted by zoom level
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      stage.setViewportPosition({
        x: stage.viewport.position.x,
        y: stage.viewport.position.y - panSpeed
      });
      stage.syncPosition();
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      stage.setViewportPosition({
        x: stage.viewport.position.x,
        y: stage.viewport.position.y + panSpeed
      });
      stage.syncPosition();
    }
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stage.setViewportPosition({
        x: stage.viewport.position.x - panSpeed,
        y: stage.viewport.position.y
      });
      stage.syncPosition();
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      stage.setViewportPosition({
        x: stage.viewport.position.x + panSpeed,
        y: stage.viewport.position.y
      });
      stage.syncPosition();
    }

    // F: Fit to screen
    if (e.code === 'KeyF') {
      e.preventDefault();
      stage.fitToScreen();
    }

    // Escape: Close details box or instructions
    if (e.code === 'Escape') {
      if (!detailsBox.boxEl.classList.contains('hidden')) {
        detailsBox.hide();
      }
      const instructions = document.querySelector('.instructions');
      if (instructions && !instructions.classList.contains('hidden')) {
        instructions.classList.add('hidden');
      }
    }
  });
}


async function createHub ({pos, themeId, themeName, clusterId, city}, theme, hubIdOverride = null) {
  // Use hubIdOverride if provided (for dual cluster maps), otherwise use themeId
  const hubId = hubIdOverride || themeId;
  
  // Check if hub already exists (might be hidden)
  // For dual cluster maps, also check if a hub with the same themeId exists in the same city
  let existingHub = stage.hubs.find(hub => {
    const hId = hub.id?.toString ? hub.id.toString() : hub.id;
    const targetId = hubId?.toString ? hubId.toString() : hubId;
    return hId === targetId;
  });
  
  // For dual cluster maps, also check if a hub with the same theme already exists in the same city cluster
  if (!existingHub && stage.isDualClusterMap && city && themeId) {
    const themeIdStr = themeId?.toString ? themeId.toString() : themeId;
    existingHub = stage.hubs.find(hub => {
      // Check if hub is in the same city cluster
      if (hub.city !== city) return false;
      // Check if hub has the same theme
      if (hub.theme && hub.theme._id) {
        const hubThemeId = hub.theme._id?.toString ? hub.theme._id.toString() : hub.theme._id;
        return hubThemeId === themeIdStr;
      }
      return false;
    });
  }
  
  if(existingHub){
    // If hub exists but is hidden, show it and update position
    if(existingHub.hidden){
      existingHub.setPosition(pos);
      stage.showHub(existingHub);
      const connections = await datastore.getConnections(themeId);
      stage.createConnections(connections.filter(connection => connection.value > 0.1));
      // Changes are temporary and not saved - default view is always restored on page load
      // saveMapToDatastore();
      return;
    }
    // Hub already exists and is visible - don't create duplicate
    return;
  }

  const hub = stage.createHub(pos, hubId, theme);
  hub.defaultHidden = false; // Newly created hubs are visible by default
  if (city) {
    hub.city = city; // Store city for connection routing in dual cluster maps
  }
  hub.translate(_language);
  
  // Get connections for this theme
  const connections = await datastore.getConnections(themeId);
  
  // For dual cluster maps, filter connections to only include items in the same city
  let filteredConnections = connections;
  if (stage.isDualClusterMap && city) {
    filteredConnections = connections.filter(connection => {
      const item = stage.items.find(i => {
        if (i instanceof StageHub) return false;
        const itemId = i.id?.toString ? i.id.toString() : i.id;
        const connItemId = connection.itemId?.toString ? connection.itemId.toString() : connection.itemId;
        return itemId === connItemId;
      });
      // Only include connections for items in the same city as the hub
      return item && item.item?.city === city;
    });
  }
  
  // Create connections - the createConnections method will handle routing to the correct hub
  stage.createConnections(filteredConnections.filter(connection => connection.value > 0.1));
  hub.on('move', async () => {
    // Changes are temporary and not saved - default view is always restored on page load
    // saveMapToDatastore();
  });
}

let shouldSendGalleryState = false;

// Statistics tracking
let stats = {
  total: 0,
  good: 0,
  bad: 0,
  topics: 0,
  connections: 0
};

// Update statistics
function updateStatistics() {
  // Count items that are actually visible in the DOM
  // Use querySelector to count actual visible elements, not just stage.items array
  const allStageItems = document.querySelectorAll('.stage-item');
  const visibleItems = Array.from(allStageItems).filter(el => {
    // Exclude hubs - hubs have different structure
    if (el.closest('.stage-hub') || el.classList.contains('stage-hub')) {
      return false;
    }
    // Check if actually visible
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const isVisible = style.opacity !== '0' && 
                      style.display !== 'none' && 
                      style.visibility !== 'hidden' &&
                      parseFloat(style.opacity) > 0 &&
                      rect.width > 0 && 
                      rect.height > 0;
    return isVisible;
  });
  
  // Get corresponding stage items for these visible elements
  const items = visibleItems.map(el => {
    return stage.items.find(item => item.el === el);
  }).filter(item => {
    // Make sure it's a dream item, not a hub
    if (!item || !item.item) return false;
    if (item.item.name?.startsWith('hub-')) return false;
    if (stage.hubs.find(h => h.id === item.id)) return false;
    
    // Double-check visibility - opacity must be > 0.5 (not 0.2 from search filter)
    const style = window.getComputedStyle(item.el);
    const opacity = parseFloat(style.opacity);
    return opacity > 0.5; // Only count items that are clearly visible
  });
  
  // Get hubs and constraints directly from stage
  const hubs = stage.hubs || [];
  const constraints = stage.constraints || [];
  
  stats.total = items.length;
  
  // Count all dreams: Good (0-4), Bad (5-10) - ALL dreams MUST be counted
  // If good_bad_dream is missing, default to 5 (neutral/bad)
  let goodCount = 0;
  let badCount = 0;
  
  items.forEach(item => {
    const value = item.item?.good_bad_dream;
    // If missing or null/undefined, check the actual value in the element
    let actualValue = value;
    if (actualValue === null || actualValue === undefined) {
      // Try to get from the element's data attribute
      if (item.el) {
        const attrValue = item.el.getAttribute('data-good-bad-dream');
        if (attrValue) {
          actualValue = parseInt(attrValue, 10);
        }
      }
      // If still missing, default to 5 (neutral/bad)
      if (actualValue === null || actualValue === undefined || isNaN(actualValue)) {
        actualValue = 5;
      }
    }
    
    // Count: 0-4 = good, 5-10 = bad
    if (actualValue <= 4) {
      goodCount++;
    } else {
      badCount++;
    }
  });
  
  stats.good = goodCount;
  stats.bad = badCount;
  
  // Ensure good + bad = total (sanity check)
  if (stats.good + stats.bad !== stats.total) {
    console.warn('Statistics mismatch!', {
      total: stats.total,
      good: stats.good,
      bad: stats.bad,
      sum: stats.good + stats.bad
    });
    // Fix: assign remaining to bad
    stats.bad = stats.total - stats.good;
  }
  stats.topics = hubs.length;
  stats.connections = constraints.length;
  
  // Update UI with animation
  animateValue('stat-total', stats.total);
  animateValue('stat-good', stats.good);
  animateValue('stat-bad', stats.bad);
  animateValue('stat-topics', stats.topics);
  animateValue('stat-connections', stats.connections);
}

// Animate number counting up
function animateValue(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const currentValue = parseInt(element.textContent) || 0;
  if (currentValue === targetValue) return;
  
  const duration = 500;
  const startTime = performance.now();
  const startValue = currentValue;
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startValue + (targetValue - startValue) * easeOut);
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = targetValue;
    }
  }
  
  requestAnimationFrame(update);
}

// Search functionality
let searchFilter = '';
let goodBadFilter = 'all'; // 'all' | 'good' | 'bad'

// Parse search query into tags (quoted strings or space-separated terms)
function parseSearchTags(searchTerm) {
  const result = {
    tags: [],      // Quoted strings - search as tags (cities, emotions, themes)
    contentText: '' // Unquoted text - search dream content
  };
  
  const trimmed = searchTerm.trim();
  if (!trimmed) return result;
  
  // Match quoted strings first
  const quotedRegex = /"([^"]+)"/g;
  const quotedMatches = [];
  let match;
  
  while ((match = quotedRegex.exec(trimmed)) !== null) {
    quotedMatches.push({
      text: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Extract content text (everything not in quotes)
  if (quotedMatches.length > 0) {
    let contentParts = [];
    let lastIndex = 0;
    
    quotedMatches.forEach((quoted) => {
      // Add text before this quoted match as content text
      const beforeText = trimmed.substring(lastIndex, quoted.start).trim();
      if (beforeText) {
        contentParts.push(beforeText);
      }
      
      // Add the quoted tag to tags array
      result.tags.push(quoted.text.toLowerCase());
      
      lastIndex = quoted.end;
    });
    
    // Add remaining text after last quoted match
    const remaining = trimmed.substring(lastIndex).trim();
    if (remaining) {
      contentParts.push(remaining);
    }
    
    // Join all content parts
    result.contentText = contentParts.join(' ').trim();
  } else {
    // No quoted strings, treat entire search as content text
    result.contentText = trimmed;
  }
  
  return result;
}

// Check if a tag matches a city
function isCityTag(tag) {
  const cities = ['arad', 'tel-aviv', 'telaviv', 'ערד', 'תל אביב', 'תל-אביב'];
  return cities.includes(tag);
}

// Check if a tag matches an emotion
function isEmotionTag(tag) {
  const emotions = [
    'fear', 'happiness', 'sadness', 'anger', 'confusion', 'hope', 'peacefulness',
    'פחד', 'אושר', 'עצב', 'כעס', 'בלבול', 'תקווה', 'שלום',
    'خوف', 'سعادة', 'حزن', 'غضب', 'الارتباك', 'الأمل', 'السلام'
  ];
  return emotions.includes(tag);
}

// Normalize city tag
function normalizeCityTag(tag) {
  if (tag === 'telaviv' || tag === 'תל אביב' || tag === 'תל-אביב') return 'tel-aviv';
  if (tag === 'arad' || tag === 'ערד') return 'arad';
  return tag;
}

// Get themes connected to an item
function getItemThemes(itemId) {
  const themes = [];
  stage.constraints.forEach(constraint => {
    // Check if constraint connects to this item
    const connectsToItem = constraint.items.some(item => 
      item.id === itemId || item.id?.toString() === itemId?.toString()
    );
    
    if (connectsToItem) {
      // Find the other item (which should be a hub/theme)
      const otherItem = constraint.items.find(item => 
        item.id !== itemId && item.id?.toString() !== itemId?.toString()
      );
      
      if (otherItem) {
        const hub = stage.hubs.find(h => 
          h.id === otherItem.id || h.id?.toString() === otherItem.id?.toString()
        );
        if (hub && hub.theme) {
          themes.push(hub.theme);
        }
      }
    }
  });
  return themes;
}

// Check if item matches theme tag
function itemMatchesTheme(item, themeTag) {
  const themes = getItemThemes(item.id || item._id);
  return themes.some(theme => {
    const themeText = [
      theme.text,
      theme.he,
      theme.en,
      theme.ar
    ].filter(Boolean).join(' ').toLowerCase();
    return themeText.includes(themeTag);
  });
}

function filterDreams(searchTerm) {
  searchFilter = searchTerm.trim();
  
  if (!searchFilter) {
    // Show all items when search is empty
    stage.items.forEach(item => {
      item.el.style.opacity = '1';
      item.el.style.pointerEvents = 'auto';
    });
    stage.hubs.forEach(hub => {
      hub.el.style.opacity = '1';
      hub.el.style.pointerEvents = 'auto';
    });
    return;
  }
  
  // Parse search query - separate quoted tags from unquoted content text
  const searchParts = parseSearchTags(searchFilter);
  const tags = searchParts.tags; // Quoted strings - search as tags
  const contentText = searchParts.contentText; // Unquoted text - search dream content
  
  // Separate tags by type (only quoted strings are treated as tags)
  const cityTags = tags.filter(isCityTag).map(normalizeCityTag);
  const emotionTags = tags.filter(isEmotionTag);
  const themeTags = tags.filter(tag => !isCityTag(tag) && !isEmotionTag(tag));
  
  // Filter dream items (not hubs)
  const dreamItems = stage.items.filter(item => {
    // Exclude hubs - hubs are in stage.hubs array, not stage.items
    return !stage.hubs.find(hub => hub.id === item.id);
  });
  
  dreamItems.forEach(item => {
    let matches = true;
    
    // Check tag matches (only for quoted strings)
    // Check city match
    if (cityTags.length > 0) {
      const itemCity = item.item?.city;
      const normalizedItemCity = itemCity ? normalizeCityTag(itemCity.toLowerCase()) : null;
      const cityMatch = cityTags.some(cityTag => normalizedItemCity === cityTag);
      if (!cityMatch) {
        matches = false;
      }
    }
    
    // Check emotion match
    if (emotionTags.length > 0 && matches) {
      const emotionMatch = emotionTags.some(emotionTag => {
        // Map emotion tag to emotion property name
        const emotionMap = {
          'fear': 'fear', 'פחד': 'fear', 'خوف': 'fear',
          'happiness': 'happiness', 'אושר': 'happiness', 'سعادة': 'happiness',
          'sadness': 'sadness', 'עצב': 'sadness', 'حزن': 'sadness',
          'anger': 'anger', 'כעס': 'anger', 'غضب': 'anger',
          'confusion': 'confusion', 'בלבול': 'confusion', 'الارتباك': 'confusion',
          'hope': 'hope', 'תקווה': 'hope', 'الأمل': 'hope',
          'peacefulness': 'peacefulness', 'שלום': 'peacefulness', 'السلام': 'peacefulness'
        };
        const emotionProp = emotionMap[emotionTag];
        if (emotionProp && item.item && item.item[emotionProp] > 0) {
          return true;
        }
        return false;
      });
      if (!emotionMatch) {
        matches = false;
      }
    }
    
    // Check theme match - require ALL theme tags to match (dream must be connected to all specified themes)
    if (themeTags.length > 0 && matches) {
      const themeMatch = themeTags.every(themeTag => {
        return itemMatchesTheme(item, themeTag);
      });
      if (!themeMatch) {
        matches = false;
      }
    }
    
    // Check content text match (unquoted text searches dream content)
    if (contentText && matches) {
      const searchText = [
        item.item?.text,
        item.item?.he,
        item.item?.en,
        item.item?.ar,
        item.item?.name
      ].filter(Boolean).join(' ').toLowerCase();
      matches = searchText.includes(contentText.toLowerCase());
    }
    
    // If no tags and no content text, show all (shouldn't happen, but safety check)
    if (tags.length === 0 && !contentText) {
      matches = true;
    }
    
    item.el.style.opacity = matches ? '1' : '0.2';
    item.el.style.pointerEvents = matches ? 'auto' : 'none';
    
    // Add highlight class for matching items
    if (matches) {
      item.el.classList.add('search-match');
    } else {
      item.el.classList.remove('search-match');
    }
  });
  
  // Filter hubs (topics) - show if they match theme tags (quoted) or content text (unquoted)
  stage.hubs.forEach(hub => {
    let matches = true;
    
    // Check theme tag matches (quoted strings)
    if (themeTags.length > 0) {
      const theme = hub.theme || {};
      const searchText = [
        theme.text,
        theme.he,
        theme.en,
        theme.ar,
        hub.themeName
      ].filter(Boolean).join(' ').toLowerCase();
      
      matches = themeTags.some(themeTag => searchText.includes(themeTag));
    } else if (cityTags.length === 0 && emotionTags.length === 0 && contentText) {
      // If no tags but has content text, search hub names/content
      const theme = hub.theme || {};
      const searchText = [
        theme.text,
        theme.he,
        theme.en,
        theme.ar,
        hub.themeName
      ].filter(Boolean).join(' ').toLowerCase();
      
      matches = searchText.includes(contentText.toLowerCase());
    } else if (tags.length > 0 && themeTags.length === 0) {
      // Hide hubs if searching by city or emotion tags only (no theme tags)
      matches = false;
    } else if (!contentText && tags.length === 0) {
      // Show all if no search at all
      matches = true;
    }
    
    hub.el.style.opacity = matches ? '1' : '0.2';
    hub.el.style.pointerEvents = matches ? 'auto' : 'none';
  });
  
  // Highlight matching text in details box if open
  if (detailsBox.iShowing && detailsBox.item) {
    const item = detailsBox.item;
    const searchText = [
      item.text,
      item.he,
      item.en,
      item.ar,
      item.name
    ].filter(Boolean).join(' ').toLowerCase();
    
    if (searchText.includes(searchFilter.toLowerCase())) {
      highlightSearchTerm(detailsBox.boxEl, searchFilter);
    }
  }

  // After applying search filtering, also apply good/bad filter if active
  applyGoodBadFilter();
}

// Apply good/bad dream filter on top of current visibility (search, city, etc.)
function applyGoodBadFilter() {
  const dreamItems = stage.items.filter(item => {
    // Exclude hubs - hubs are in stage.hubs array, not stage.items
    return !stage.hubs.find(hub => hub.id === item.id);
  });

  dreamItems.forEach(item => {
    if (!item.el) return;

    // Start from current visibility (search/city filters)
    const style = window.getComputedStyle(item.el);
    const baseVisible = style.display !== 'none' &&
      style.visibility !== 'hidden';

    if (!baseVisible) {
      // Respect other filters
      return;
    }

    if (goodBadFilter === 'all') {
      // Restore full opacity if previously dimmed by this filter
      item.el.style.opacity = '1';
      item.el.style.pointerEvents = 'auto';
      return;
    }

    // Determine good/bad from good_bad_dream (0-4 = good, 5-10 = bad)
    let value = item.item?.good_bad_dream;
    if (value === null || value === undefined) {
      const attrValue = item.el.getAttribute('data-good-bad-dream');
      if (attrValue) {
        value = parseInt(attrValue, 10);
      }
    }
    if (value === null || value === undefined || isNaN(value)) {
      value = 5; // default neutral/bad
    }

    const isGood = value <= 4;
    const isBad = value > 4;

    const shouldShow =
      (goodBadFilter === 'good' && isGood) ||
      (goodBadFilter === 'bad' && isBad);

    item.el.style.opacity = shouldShow ? '1' : '0.1';
    item.el.style.pointerEvents = shouldShow ? 'auto' : 'none';
  });
}

function highlightSearchTerm(container, term) {
  if (!term) return;
  const textNodes = getTextNodes(container);
  textNodes.forEach(node => {
    const parent = node.parentNode;
    if (parent.tagName === 'MARK') return; // Already highlighted
    
    const text = node.textContent;
    const regex = new RegExp(`(${term})`, 'gi');
    if (regex.test(text)) {
      const highlighted = text.replace(regex, '<mark>$1</mark>');
      const wrapper = document.createElement('span');
      wrapper.innerHTML = highlighted;
      parent.replaceChild(wrapper, node);
    }
  });
}

function getTextNodes(node) {
  const textNodes = [];
  if (node.nodeType === 3) {
    textNodes.push(node);
  } else {
    for (const child of node.childNodes) {
      textNodes.push(...getTextNodes(child));
    }
  }
  return textNodes;
}

// Toast notification system for study page
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  
  return toast;
}

// Make showToast available globally for use in other modules
window.showToast = showToast;

// Export map as image
async function exportMapAsImage() {
  // Check if html2canvas is available
  if(typeof html2canvas === 'undefined') {
    showToast(translations.exportError[_language] + ' (html2canvas not loaded)', 'error', 3000);
    return;
  }
  
  // Get UI elements
  const toolbar = document.querySelector('.toolbar');
  const statsDashboard = document.getElementById('stats-dashboard');
  const bars = document.querySelector('.bars');
  const detailsBox = document.querySelector('.details-box-container');
  const hubModal = document.querySelector('.hub-modal');
  const instructions = document.querySelector('.instructions');
  const toastContainer = document.getElementById('toast-container');
  
  const originalDisplay = {
    toolbar: toolbar?.style.display,
    statsDashboard: statsDashboard?.style.display,
    bars: bars?.style.display,
    detailsBox: detailsBox?.style.display,
    hubModal: hubModal?.style.display,
    instructions: instructions?.style.display,
    toastContainer: toastContainer?.style.display
  };
  
  const restoreUI = () => {
    if(toolbar) toolbar.style.display = originalDisplay.toolbar || '';
    if(statsDashboard) statsDashboard.style.display = originalDisplay.statsDashboard || '';
    if(bars) bars.style.display = originalDisplay.bars || '';
    if(detailsBox) detailsBox.style.display = originalDisplay.detailsBox || '';
    if(hubModal) hubModal.style.display = originalDisplay.hubModal || '';
    if(instructions) instructions.style.display = originalDisplay.instructions || '';
    if(toastContainer) toastContainer.style.display = originalDisplay.toastContainer || '';
  };
  
  try {
    showToast(translations.exporting[_language], 'info', 2000);
    
    // Hide UI elements
    if(toolbar) toolbar.style.display = 'none';
    if(statsDashboard) statsDashboard.style.display = 'none';
    if(bars) bars.style.display = 'none';
    if(detailsBox) detailsBox.style.display = 'none';
    if(hubModal) hubModal.style.display = 'none';
    if(instructions) instructions.style.display = 'none';
    if(toastContainer) toastContainer.style.display = 'none';
    
    // Wait a bit for UI to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the stage element
    const stageEl = document.querySelector('.stage');
    
    if(!stageEl) {
      throw new Error('Stage element not found');
    }
    
    // Ensure fonts are loaded before capture
    await document.fonts.ready;
    
    // Temporarily ensure all text is visible and properly scaled
    const hubTexts = stageEl.querySelectorAll('.stage-item__text');
    const originalTextStyles = [];
    hubTexts.forEach((textEl, index) => {
      originalTextStyles[index] = {
        fontSize: textEl.style.fontSize,
        transform: textEl.style.transform,
        opacity: textEl.style.opacity,
        visibility: textEl.style.visibility,
        color: textEl.style.color,
        display: textEl.style.display
      };
      // Ensure text is visible and readable
      const computedStyle = window.getComputedStyle(textEl);
      const fontSize = parseFloat(computedStyle.fontSize);
      // Scale up text for export if it's too small
      if(fontSize < 12) {
        textEl.style.fontSize = `${Math.max(12, fontSize * 1.5)}px`;
      }
      textEl.style.opacity = '1';
      textEl.style.visibility = 'visible';
      textEl.style.display = 'block';
      // Ensure text color is visible (dark text on light hub background)
      if(!textEl.style.color || textEl.style.color === 'rgba(0, 0, 0, 0)') {
        textEl.style.color = '#111';
      }
    });
    
    // Also ensure delete buttons are hidden during export
    const deleteButtons = stageEl.querySelectorAll('.stage-item__delete');
    deleteButtons.forEach(btn => {
      btn.style.display = 'none';
    });
    
    // Wait a bit for styles to apply
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Use html2canvas to capture the stage (includes both canvas and items)
    const canvas = await html2canvas(stageEl, {
      backgroundColor: '#111',
      scale: 2, // Higher quality export
      useCORS: true,
      logging: false,
      allowTaint: false,
      width: stageEl.offsetWidth,
      height: stageEl.offsetHeight,
      foreignObjectRendering: false, // Better text rendering
      onclone: (clonedDoc) => {
        // Ensure fonts are available in cloned document
        const clonedStage = clonedDoc.querySelector('.stage');
        if(clonedStage) {
          // Ensure all text elements are visible in the clone
          const clonedTexts = clonedStage.querySelectorAll('.stage-item__text');
          clonedTexts.forEach(textEl => {
            textEl.style.opacity = '1';
            textEl.style.visibility = 'visible';
            textEl.style.display = 'block';
            textEl.style.color = '#111'; // Dark text on light background
            // Ensure text is readable size
            const computedSize = parseFloat(window.getComputedStyle(textEl).fontSize);
            if(computedSize < 12) {
              textEl.style.fontSize = '12px';
            }
            // Ensure parent hub is visible
            const parent = textEl.closest('.stage-hub');
            if(parent) {
              parent.style.opacity = '1';
              parent.style.visibility = 'visible';
            }
          });
          
          // Hide delete buttons in clone
          const clonedDeleteButtons = clonedStage.querySelectorAll('.stage-item__delete');
          clonedDeleteButtons.forEach(btn => {
            btn.style.display = 'none';
          });
        }
      }
    });
    
    // Restore original text styles
    hubTexts.forEach((textEl, index) => {
      if(originalTextStyles[index]) {
        textEl.style.fontSize = originalTextStyles[index].fontSize;
        textEl.style.transform = originalTextStyles[index].transform;
        textEl.style.opacity = originalTextStyles[index].opacity;
        textEl.style.visibility = originalTextStyles[index].visibility;
        textEl.style.color = originalTextStyles[index].color;
        textEl.style.display = originalTextStyles[index].display;
      }
    });
    
    // Restore delete buttons
    deleteButtons.forEach(btn => {
      btn.style.display = '';
    });
    
    // Restore UI elements immediately after capture
    restoreUI();
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
      if(!blob) {
        throw new Error('Failed to create image blob');
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `dream-map-${mapName}-${Date.now()}.png`;
      link.href = url;
      link.click();
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      showToast(translations.exportSuccess[_language], 'success', 3000);
      
      // Try to share if Web Share API is available (mobile devices)
      if(navigator.share && navigator.canShare) {
        const shareData = {
          title: `Dream Map - ${mapName}`,
          text: `Check out my dream map!`,
        };
        
        // Try to share with file if supported
        try {
          const file = new File([blob], `dream-map-${mapName}.png`, { type: 'image/png' });
          if(navigator.canShare({ files: [file] })) {
            navigator.share({
              ...shareData,
              files: [file]
            }).catch(() => {
              // Share failed, but download already happened
            });
          } else {
            // Fallback: share without file
            navigator.share(shareData).catch(() => {
              // Share failed, but download already happened
            });
          }
        } catch(e) {
          // File sharing not supported, just download
        }
      }
    }, 'image/png', 0.95);
    
  } catch(error) {
    console.error('Error exporting map:', error);
    showToast(translations.exportError[_language], 'error', 3000);
    restoreUI();
  }
}

async function sendGalleryState() {
  if(shouldSendGalleryState && socket && stage.hubs?.length){
    socket.emit('update', {
      mapName,
      openItemId: _activeItem?._id,
      language: _language, 
      viewport: {
        position: stage.viewport.position,
        scale: stage.viewport.scale
      },
      options: {
        showColorGoodBadDream: chkColorGoodBadDream.checked,
        showEmotionsFelt: chkShowEmotionsFelt.checked
      },
      hubs: stage.hubs.map(hub => {
      return {
        pos: hub.matter.position,
        themeId: hub.id,
        themeName: hub.themeName
      }
    })});
    shouldSendGalleryState = false;
  }
  setTimeout(sendGalleryState, 60);
}

async function saveMapToDatastore () {
  // DISABLED: All changes are temporary and not saved
  // The default view from the database is always restored on page load
  // This ensures the default state remains untouched
  return;
  
  // Original save code (disabled):
  /*
  if(!adminPassword){
    return;
  }
  
  // Don't save during map switching to prevent overwriting default hubs
  if(isSwitchingMaps){
    return;
  }
  
  const mapHubs = stage.hubs.map(hub => {
    return {
      pos: hub.matter.position,
      themeId: hub.id,
      themeName: hub.themeName,
      // Use defaultHidden (from database) instead of current session hidden state
      // This ensures temporary bin clicks don't persist, but default state is preserved
      hidden: hub.defaultHidden !== undefined ? hub.defaultHidden : (hub.hidden || false)
    }
  });
  await datastore.saveMap({hubs: mapHubs}, adminPassword);
  */
}


async function main(){
  datastore.setMap(mapName);

  bind();

  // Initialize original map name for dual cluster switching
  // If we're in a dual cluster map, set originalMapName based on the map name
  // Otherwise, originalMapName is the same as mapName
  if (mapName === 'map_dual_clusters' || mapName === 'map_dual_clusters_jungian') {
    if (mapName === 'map_dual_clusters_jungian') {
      datastore.originalMapName = 'jungian';
    } else {
      datastore.originalMapName = 'map'; // Default to Life Topics
    }
  } else {
    datastore.originalMapName = mapName;
  }

  await poll();

  // Close instructions modal when clicking backdrop
  document.querySelector('.instructions').addEventListener('click', (e) => {
    if(e.ctrlKey && e.target.tagName === 'H1'){
      document.querySelector('.admin-password').classList.remove('hidden');
      document.querySelector('.admin-password').focus();
      return;
    }
    // Close if clicking on the backdrop (not the instructions-box)
    if(e.target === e.currentTarget){
      e.currentTarget.classList.add('hidden');
    }
  });

  // Close button click handler
  document.querySelector('.instructions-box__close').addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.instructions').classList.add('hidden');
  });

  // btn-open-instructions
  document.querySelector('#btn-open-instructions').addEventListener('click', (e) => {
    document.querySelector('.instructions').classList.remove('hidden');
  });

  document.querySelector('.admin-password').addEventListener('input', async (e) => {
    adminPassword = e.target.value;

  });

  // Setup good/bad filter buttons
  setupGoodBadFilterButtons();

  changeLanguage(_language);
  
  // Update export button title when language changes
  const btnExportMap = document.querySelector('#btn-export-map');
  if(btnExportMap) {
    btnExportMap.title = translations.exportMap[_language];
  }

  // Initialize colors based on checkbox state (defaults to unchecked)
  const checkboxEl = document.getElementById('chk-color-good-bad-dream');
  if (checkboxEl && checkboxEl.checked) {
    stage.setShowColorGoodBadDream(true);
    stage.el.classList.add('show-color-good-bad-dream');
    document.body.classList.add('show-color-good-bad-dream');
  } else {
    stage.setShowColorGoodBadDream(false);
    stage.el.classList.remove('show-color-good-bad-dream');
    document.body.classList.remove('show-color-good-bad-dream');
  }
  if(chkShowEmotionsFelt.checked){
    document.body.classList.add('show-emotions-felt');
  }
  
  // Statistics dashboard toggle
  const statsToggle = document.getElementById('stats-toggle');
  const statsContent = document.getElementById('stats-content');
  if(statsToggle && statsContent){
    statsToggle.addEventListener('click', () => {
      const isCollapsed = statsContent.classList.toggle('collapsed');
      statsToggle.textContent = isCollapsed ? '+' : '−';
    });
  }
  
  // Search functionality
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  if(searchInput){
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value;
      filterDreams(term);
      searchClear.style.display = term ? 'flex' : 'none';
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        searchInput.value = '';
        filterDreams('');
        searchClear.style.display = 'none';
        searchInput.blur();
      }
    });
  }
  
  if(searchClear){
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      filterDreams('');
      searchClear.style.display = 'none';
      searchInput.focus();
    });
  }
  
  // Debug helper: Add a function to check color status
  window.debugDreamColors = () => {
    const items = stage.items;
    const withColors = items.filter(item => item.el.dataset.goodBadDream);
    const withoutColors = items.filter(item => !item.el.dataset.goodBadDream);
    console.log(`Total items: ${items.length}`);
    console.log(`Items with colors: ${withColors.length}`);
    console.log(`Items without colors: ${withoutColors.length}`);
    if(withoutColors.length > 0){
      console.log('Items without colors:', withoutColors.map(item => ({
        id: item.item._id,
        name: item.item.name,
        good_bad_dream: item.item.good_bad_dream
      })));
    }
    return {
      total: items.length,
      withColors: withColors.length,
      withoutColors: withoutColors.length,
      itemsWithoutColors: withoutColors.map(item => ({
        id: item.item._id,
        name: item.item.name,
        good_bad_dream: item.item.good_bad_dream
      }))
    };
  };

  let isFullScreen = false;

  // 2 minutes
  if(isGallery || isGalleryControl ){
    document.querySelector('.instructions').classList.add('hidden');

    document.getElementById('btn-full-screen').style.display = '';
    document.getElementById('btn-full-screen').addEventListener('click', () => {
      if(isFullScreen){
        document.exitFullscreen();
      } else {
        document.body.requestFullscreen();
      }
      isFullScreen = !isFullScreen
    });

    function invalidateGalleryPosition(){
      shouldSendGalleryState = true;
    }

    if(isGalleryControl){
      console.log('gallery control');
      document.body.addEventListener('touchdown', invalidateGalleryPosition);
      document.body.addEventListener('touchmove', invalidateGalleryPosition);
      document.body.addEventListener('mousedown', invalidateGalleryPosition);
      document.body.addEventListener('mousemove', invalidateGalleryPosition);


      sendGalleryState();
    }

    // createSocketIOConnection(); // DISABLED: Server connection stopped
  }
}

function createSocketIOConnection(){
  socket = io();
  
  socket.on('connect', () => {
    console.log('connected');
  });
  socket.on('disconnect', () => {
    console.log('disconnected');
  });
  socket.on('update', (data) => {
    if(isGalleryControl) return;
    const hubs = data.hubs;
    stage.hubs.forEach(hub => {
      if(!hubs.find(h => h.themeId === hub.id)){
        hub.destroy();
      }

      // move
      const hubData = hubs.find(h => h.themeId === hub.id);
      if(hubData){
        hub.setPosition(hubData.pos);
      }
    });
    if(data.openItemId){
      const stageItem = stage.getStageItemById(data.openItemId);
      if (stageItem) {
        detailsBox.showItem(stageItem.item, _language, true, datastore);
      }
    } else {
      detailsBox.hide();
    }

    if(data.language && data.language !== _language){
      changeLanguage(data.language);
    }

    const viewportChanged = data.viewport && (data.viewport.position.x !== stage.viewport.position.x || data.viewport.position.y !== stage.viewport.position.y || data.viewport.scale !== stage.viewport.scale);
    if(viewportChanged){
      console.log('viewport', data.viewport);
      stage.viewport.position = data.viewport.position;
      stage.viewport.scale = data.viewport.scale;
    }

    if(data.options){
      document.body.classList.toggle('show-color-good-bad-dream', data.options.showColorGoodBadDream);
      document.body.classList.toggle('show-emotions-felt', data.options.showEmotionsFelt);
    }

  });
  
  // Listen for new comments in real-time
  socket.on('new-comment', (data) => {
    const { itemId, comment } = data;
    // If the details box is showing this item, add the comment
    if(detailsBox.iShowing && detailsBox.item && detailsBox.item._id?.toString() === itemId.toString()){
      const commentsList = detailsBox.boxEl.querySelector(`#comments-list-${itemId}`);
      if(commentsList){
        const noCommentsMsg = commentsList.querySelector('.no-comments');
        if(noCommentsMsg){
          noCommentsMsg.remove();
        }
        
        // Get comment text in current interface language, fallback to original text
        const currentLang = _language;
        const commentText = comment[currentLang] || comment.text || '';
        
        // Show comment with translated text
        if(commentText){
          const commentEl = document.createElement('div');
          commentEl.className = 'comment';
          commentEl.innerHTML = `
            <div class="comment-header">
              <span class="comment-author">${comment.authorName || 'Anonymous'}</span>
              <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="comment-text">${commentText}</div>
          `;
          commentsList.insertBefore(commentEl, commentsList.firstChild);
        }
      }
    }
  });
  
}

// Stop servers: disconnect socket and stop polling
function stopServers() {
  // Stop polling
  if(_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
  
  // Disconnect socket if connected
  if(socket && socket.connected) {
    socket.disconnect();
    socket = null;
  }
}

main();

// Stop servers (uncomment to enable)
// stopServers();