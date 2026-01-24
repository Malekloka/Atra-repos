import EventEmitter from './util/event-emitter.js';

const fetchPost = async (url, data) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

class Datastore extends EventEmitter {
  constructor(){
    super();
  }

  setMap(map){
    this.map = map;
    this.lastPoll = null;
  }

  async poll(city){
    const pollData = {mapName: this.map, lastPoll: this.lastPoll};
    // Only include city if it's a non-empty string
    if (city && city !== '') {
      pollData.city = city;
    }
    // For dual cluster maps, ALWAYS send the original map name so backend can query correct themes
    // If originalMapName is not set, infer it from the map name
    if (this.map === 'map_dual_clusters' || this.map === 'map_dual_clusters_jungian') {
      if (this.originalMapName) {
        pollData.originalMapName = this.originalMapName;
      } else {
        // Infer from map name if not set
      if (this.map === 'map_dual_clusters_jungian') {
        pollData.originalMapName = 'jungian';
      } else {
        pollData.originalMapName = 'map'; // Default to Life Topics
      }
    }
  }
    const data = await fetchPost('api/poll', pollData);
    this.lastPoll = data.time;
    return data;
  }

  async getConnections(themeId){
    return fetchPost('api/connections', {themeId});
  }

  async saveMap(map, adminPassword){
    return fetchPost('api/map', {mapName: this.map, update: map, adminPassword});
  }

  async getComments(itemId){
    return fetchPost('api/comments', {itemId});
  }

  async addComment(itemId, text, authorName, language){
    return fetchPost('api/add-comment', {itemId, text, authorName, language});
  }
}

export default Datastore;