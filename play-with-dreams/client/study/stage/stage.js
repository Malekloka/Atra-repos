import StageConstraint from "./stage-constraint.js";
import StageItem from "./stage-item.js";
import StageHub from "./hub.js";
import EventEmitter from "../util/event-emitter.js";
import mathUtils from "../util/math.js";

const { World, Engine, Render, Runner, Composite, Bodies, Events } = Matter;

const kMinFitScale = 0.6;

class Stage extends EventEmitter {
  constructor(el) {
    super();
    this.el = el;
    this.elItemsContainer = el.querySelector('.stage__items');
    this.elConstraintsCanvas = el.querySelector('.stage__constraints');
    this.items = [];
    this.hubs = [];
    this.constraints = [];
    this.createMatter();
    this.bind();
  }

  createMatter(){
    this.engine = Engine.create({
      gravity: {scale: 0} // Keep no gravity, but items will be constrained by connections
    });

    this.viewport = {
      position: {x: 0, y: 0},
      size: {width: window.innerWidth, height: window.innerHeight},
      scale: 1
    }

    this.world = this.engine.world;

    // create renderer
    this.render = Render.create({
      canvas: document.querySelector('#canvas'),
      engine: this.engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        showAngleIndicator: true,
      }
    });


    // fit the render viewport to the scene
    Render.lookAt(this.render, {
      min: { x: 0, y: 0 },
      max: { x: 2000, y: 1600 }
    });

    this.addWalls();

    // create runner
    this.runner = Runner.create()
    Runner.run(this.runner, this.engine);

    // run the renderer
    Render.run(this.render);
    
    Events.on(this.engine, "afterUpdate", () => {
      this.afterUpdate();
      this.syncPosition();
    })

  }

  getHubsBounds(){
    const bounds = {
      min: {x: 400, y: 400},
      max: {x: 1200, y: 1200}
    };
    for(const item of this.items){
      if(item instanceof StageHub){
        bounds.min.x = Math.min(bounds.min.x, item.matter.position.x);
        bounds.min.y = Math.min(bounds.min.y, item.matter.position.y);
        bounds.max.x = Math.max(bounds.max.x, item.matter.position.x);
        bounds.max.y = Math.max(bounds.max.y, item.matter.position.y);
      }
    }
    return bounds;
  }

  fitToScreen(){
    this.viewport.size = {width: window.innerWidth, height: window.innerHeight};
    const bounds = this.getHubsBounds();
    const padding = {x:100, y:100}; // stage coordinates
    bounds.min = mathUtils.subtract(bounds.min, padding);
    bounds.max = mathUtils.add(bounds.max, padding);
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    
    this.setViewportScale(
      Math.max(
        kMinFitScale,
        Math.min(
          this.viewport.size.width / width, 
          this.viewport.size.height / height,
        )
      )
    );

    const viewportPos = {
      y: bounds.min.y - (this.viewport.size.height / this.viewport.scale - height) / 2,
      x: bounds.min.x - (this.viewport.size.width / this.viewport.scale - width) / 2
    }
    this.setViewportPosition(viewportPos);
  }

  bindDrag(eventDown, eventMove, eventUp) {
    this.el.addEventListener(eventDown, (e) => {
      if (e.target !== this.el) return;
      this.el.classList.add('grabbing');
      // drag
      const posBeforeGrab = this.viewport.position;
      const getUserPosition = (e) => {
        if(e.touches){
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
      }
      const mouseGrabPos = this.screenCoordsToStageCoords(getUserPosition(e));

      const mouseMove = (e) => {
        const p = this.screenCoordsToStageCoords(getUserPosition(e));
        const deltaX = mouseGrabPos.x - p.x;
        const deltaY = mouseGrabPos.y - p.y;

        const delta = mathUtils.multiply({x: deltaX, y: deltaY}, this.viewport.scale);

        this.setViewportPosition(
          mathUtils.add(posBeforeGrab, delta)
        );
      };

      const mouseUp = () => {
        this.el.removeEventListener(eventMove, mouseMove);
        this.el.removeEventListener(eventUp, mouseUp);
        this.el.classList.remove('grabbing');
      };

      this.el.addEventListener(eventMove, mouseMove);
      this.el.addEventListener(eventUp, mouseUp);
    });
  }

  bind(){
    this.bindDrag('mousedown', 'mousemove', 'mouseup');
    this.bindDrag('touchstart', 'touchmove', 'touchend');

    window.addEventListener('resize', () => {
      this.viewport.size = {width: window.innerWidth, height: window.innerHeight};
    });

    window.addEventListener('wheel', (e) => {
      const delta = e.deltaY / 1000;
      const newScale = this.viewport.scale + delta;
      
      const centerPoint = this.screenCoordsToStageCoords({
        x: e.clientX,
        y: e.clientY
      });
      
      if(newScale > 0.1 && newScale < 2){
        // move the center of the screen to the center of the wheel event
        this.setViewportPosition(
          mathUtils.add(
            this.viewport.position,
            mathUtils.multiply(centerPoint, newScale - this.viewport.scale)
          )
        );

        this.viewport.scale = newScale;
        this.syncPosition();
      }
    });

    const mc = new Hammer(this.el);
    mc.get('pinch').set({ enable: true });

    mc.on('pinchstart', e => {
      this._prePinchScale = this.viewport.scale;
      this._prePinchPosition = {...this.viewport.position};
    })

    mc.on('pinchmove', e => {
      const newScale = this._prePinchScale * e.scale;
      const centerPoint = this.screenCoordsToStageCoords({
        x: e.center.x,
        y: e.center.y
      });

      if(newScale > 0.1 && newScale < 2){
        this.setViewportPosition(mathUtils.add(
          this._prePinchPosition,
          mathUtils.multiply(centerPoint, newScale - this.viewport.scale)
        ));

        this.setViewportScale(newScale);
        this.syncPosition();
      }

    })
  }

  syncPosition(){
    for(const item of this.items){
      // item.syncPosition?.(pos => this.stageToScreenCoords(pos), this.scale);
      const pos = this.stageToScreenCoords(item.matter.position);
      item.el.style.left = pos.x + 'px';
      item.el.style.top = pos.y + 'px';
      item.el.style.transform = `translate(-50%, -50%) scale(${this.viewport.scale})`;  
    }
    
    // Sync cluster labels if this is a dual cluster map
    this.syncClusterLabels();
  }
  
  syncClusterLabels(){
    // Only sync if we're on a dual cluster map
    if (!this.isDualClusterMap) return;
    
    const aradLabel = document.getElementById('cluster-label-arad');
    const telavivLabel = document.getElementById('cluster-label-telaviv');
    
    // Cluster centers in world coordinates
    // Labels positioned higher up to avoid overlapping with nodes (cluster is at y=540, radius ~300)
    const aradCenter = { x: 400, y: 100 }; // Moved higher from y=200 to y=100
    const telavivCenter = { x: 1520, y: 100 }; // Moved higher from y=200 to y=100
    
    if (aradLabel) {
      const pos = this.stageToScreenCoords(aradCenter);
      aradLabel.style.left = pos.x + 'px';
      aradLabel.style.top = pos.y + 'px';
      aradLabel.style.transform = `translate(-50%, -50%) scale(${this.viewport.scale})`;
    }
    
    if (telavivLabel) {
      const pos = this.stageToScreenCoords(telavivCenter);
      telavivLabel.style.left = pos.x + 'px';
      telavivLabel.style.top = pos.y + 'px';
      telavivLabel.style.transform = `translate(-50%, -50%) scale(${this.viewport.scale})`;
    }
  }

  afterUpdate(){
    this.drawConstraints();
    for(const item of this.items){
      item.afterUpdate?.();
    }
  }

  addWalls(){
    const width = 2000;
    const height = 1600;

    const wallThickness = 50;

    Composite.add(this.world, [
      // walls
      Bodies.rectangle(width/2, 0, width, wallThickness, { isStatic: true }),
      Bodies.rectangle(width/2, height, width, wallThickness, { isStatic: true }),
      Bodies.rectangle(width, height/2, wallThickness, height, { isStatic: true }),
      Bodies.rectangle(0, height/2, wallThickness, height, { isStatic: true })
    ]);    
  }

  setViewportPosition({x, y}){
    this.viewport.position.x = x;
    this.viewport.position.y = y;
    this.syncPosition(); // This will also sync cluster labels
  }
  
  get viewportPosition(){
    return {
      x: this.viewport.position.x,
      y: this.viewport.position.y
    };
  }

  setViewportScale(scale){
    this.viewport.scale = scale;
    this.syncPosition(); // This will also sync cluster labels
  }

  get viewportScale(){
    return this.viewport.scale;
  }

  createItem(item){
    // Determine spawn position based on map type and item city
    let spawnPosition = {x: 800, y: 800}; // Default position
    
    // For dual cluster maps, spawn items at their city's cluster center
    if (this.isDualClusterMap && item.city) {
      if (item.city === 'arad') {
        spawnPosition = {x: 400, y: 540}; // Arad cluster center
      } else if (item.city === 'tel-aviv') {
        spawnPosition = {x: 1520, y: 540}; // Tel-Aviv cluster center
      }
    }
    
    const stageItem = new StageItem(item, spawnPosition);
    this.addStageItem(stageItem);
    this.items = this.items || [];
    this.items.push(stageItem);
    return stageItem;
  }

  createHub(pos, hubId, theme){
    const {x, y} = pos;
    const hub = new StageHub({x, y}, hubId, theme, this);
    hub.hidden = false; // Track if hub is hidden
    this.addStageItem(hub);
    hub.on('delete', () => {
      this.hideHub(hub);
    });
    this.hubs.push(hub);
    return hub;
  }

  hideHub(hub){
    hub.hidden = true;
    hub.el.style.display = 'none';
    // Remove from physics world but keep in hubs and items arrays
    World.remove(this.world, hub.matter);
    this.removeConnections(hub.id);
    this.emit('change');
  }

  showHub(hub){
    hub.hidden = false;
    hub.el.style.display = '';
    // Re-add to physics world if not already there
    if(!this.world.bodies.includes(hub.matter)){
      World.add(this.world, hub.matter);
    }
    // Re-add connections
    this.emit('change');
  }

  removeStageItem(stageItem){
    this.items = this.items.filter(item => item !== stageItem);
    World.remove(this.world, stageItem.matter);
    try {
      this.elItemsContainer.removeChild(stageItem.el);
    } catch {
      console.log('error removing element from stage');
      console.log(stageItem);
    }
    this.hubs = this.hubs.filter(hub => hub !== stageItem);
    this.removeConnections(stageItem.id);
    this.emit('change');
  }

  setShowColorGoodBadDream(show){
    this.el.classList.toggle('show-color-good-bad-dream', show);
  }

  removeConnections(themeId){
    for(let i=0; i<this.constraints.length;){
      const constraint = this.constraints[i];
      if(constraint.isConnectedTo(themeId)){
        World.remove(this.world, this.constraints[i].matter);
        this.constraints.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  connectionExists(connection){
    return this.constraints.some(constraint => {
      return constraint.isConnectedTo(connection.itemId) && constraint.isConnectedTo(connection.themeId);
    });
  }

  createConnections(connections){
    // Group connections by itemId to track which items have connections
    const connectionsByItem = new Map();
    
    for(const connection of connections){
      const item = this.getStageItemById(connection.itemId);
      if(!item) continue;
      
      // For dual cluster maps, find the correct hub based on item's city
      let hub = null;
      const itemCity = item.item?.city;
      
      if(itemCity && this.hubs.some(h => h.city)) {
        // This is a dual cluster map - find hub matching the item's city and theme
        hub = this.hubs.find(h => {
          if(!h.city || h.city !== itemCity) return false;
          // Check if this hub's theme matches the connection's themeId
          if(h.theme) {
            const hThemeId = h.theme._id?.toString ? h.theme._id.toString() : h.theme._id;
            const connThemeId = connection.themeId?.toString ? connection.themeId.toString() : connection.themeId;
            return hThemeId === connThemeId;
          }
          return false;
        });
        
        // If hub not found by theme, try finding by clusterId (for newly created hubs)
        if (!hub) {
          const connThemeId = connection.themeId?.toString ? connection.themeId.toString() : connection.themeId;
          const expectedClusterId = `${itemCity}_${connThemeId}`;
          hub = this.hubs.find(h => {
            const hId = h.id?.toString ? h.id.toString() : h.id;
            return hId === expectedClusterId;
          });
        }
      } else {
        // Normal map - use themeId directly
        hub = this.getStageItemById(connection.themeId);
      }
      
      if(!hub || !item){
        continue;
      }

      // Check if connection already exists
      if(this.connectionExists({itemId: item.id, themeId: hub.id})){
        continue;
      }

      // Track connections per item
      const itemId = connection.itemId;
      if(!connectionsByItem.has(itemId)){
        connectionsByItem.set(itemId, []);
      }
      connectionsByItem.get(itemId).push(connection);

      const constraint = new StageConstraint(
        item,
        hub,
        connection.value || 0.1
      );
      this.addConstraint(constraint);
    }
  }

  addConstraint(constraint){
    this.constraints.push(constraint);
    World.add(this.world, constraint.matter);
  }

  addStageItem(stageItem){
    this.elItemsContainer.appendChild(stageItem.el);
    this.items.push(stageItem);
    World.add(this.world, stageItem.matter);
    this.bubble('hover', stageItem);
    this.bubble('unhover', stageItem);
    this.bubble('open', stageItem);
  }

  getStageItemById(id){
    return this.items.find(item => item.id === id);
  }

  stop() {
    Matter.Runner.stop(this.runner);
  }

  stageToScreenCoords({x, y}){
    return mathUtils.multiply(
      mathUtils.subtract({x, y}, this.viewport.position), 
      this.viewport.scale
    );
  }

  screenCoordsToStageCoords({x, y}){
    return mathUtils.add(
      this.viewport.position,
      mathUtils.multiply({x, y}, 1/this.viewport.scale)
    );
  }

  drawConstraints(){
    const ctx = this.elConstraintsCanvas.getContext('2d');
    this.elConstraintsCanvas.width = this.viewport.size.width;
    this.elConstraintsCanvas.height = this.viewport.size.height;
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.clearRect(0, 0, this.viewport.size.width, this.viewport.size.height);
    for(const constraint of this.constraints){
      const pos1 = this.stageToScreenCoords(constraint.items[0].matter.position);
      const pos2 = this.stageToScreenCoords(constraint.items[1].matter.position);
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }
  }

  clear(){
    for(const item of this.items){
      this.removeStageItem(item);
    }

    this.items = [];

    // clear all connections
    for(const constraint of this.constraints){
      World.remove(this.world, constraint.matter);
    }
    this.constraints = [];

  }
}

export default Stage;