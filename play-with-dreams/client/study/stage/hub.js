import EventEmitter from '../util/event-emitter.js';
import mathUtils from '../util/math.js';
import StageItem from "./stage-item.js";

const { Bodies, Body } = Matter

const kItemRadius = 70;

class StageHub extends EventEmitter {
  constructor(startPosition, themeId, theme, stage){
    super();
    this.id = themeId;
    this.theme = theme;
    this.stage = stage;
    this.createMatter(startPosition);
    this.createHTMLElement(theme);
    this.bindDOM();
  }

  createMatter({x, y}){
    this.matter = Bodies.circle(x, y, kItemRadius, {isStatic: true});
    this.matter.friction = 0;
    this.matter.frictionAir = 0;
    this.matter.inertia = Infinity;
    this.matter.restitution = 0.5;
    
    var vx = 10 * (Math.random() - 0.5)
    var vy = 10 * (Math.random() - 0.5)
    Body.setVelocity(this.matter, { x: vx, y: vy })
  }

  createHTMLElement(theme){
    this.el = document.createElement('div');
    this.el.classList.add('stage-item');
    this.el.classList.add('stage-hub');
    // Add animation class
    this.el.classList.add('animate-in');

    this.textContainer = document.createElement('div');
    this.textContainer.classList.add('stage-item__text');
    this.el.appendChild(this.textContainer);
    
    // Set initial text - will be updated by translate() method
    this.textContainer.textContent = '';

    this.btnDelete = document.createElement('button');
    this.btnDelete.textContent = '🗑️';
    this.btnDelete.classList.add('stage-item__delete');
    this.btnDelete.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.emit('delete');
    });
    this.btnDelete.title = 'Delete';
    this.el.appendChild(this.btnDelete);
    
    return this.el;
  }

  set text(text){
    this.textContainer.textContent = text;
  }

  translate(lang){
    // Try language-specific property first, then fall back to text property
    if(this.theme) {
      this.text = this.theme[lang] || this.theme.text || '';
    } else {
      this.text = '';
    }
  }

  bindDrag(downEvent, moveEvent, upEvent){
    const matter = this.matter;
    const emitMove = () => this.emit('move');
    const stage = this.stage;
    this.el.addEventListener(downEvent, (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('down');
      const getUserPosition = (e) => {
        if(e.touches){
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
      }
      const mousePositionAtStart = stage.screenCoordsToStageCoords(getUserPosition(e));
      const positionAtStart = {...matter.position};

      function mousemove(e){
        const mousePosition =  stage.screenCoordsToStageCoords(getUserPosition(e));
        const delta = mathUtils.subtract(mousePosition, mousePositionAtStart);
        const newPos = mathUtils.add(positionAtStart, delta);
        Body.setPosition(matter, newPos);
      }

      function mouseup(e){
        emitMove();
        document.removeEventListener(moveEvent, mousemove);
        document.removeEventListener(upEvent, mouseup);
      }

      document.addEventListener(moveEvent, mousemove);
      document.addEventListener(upEvent, mouseup);
    });
  }

  bindDOM(){
    this.bindDrag('mousedown', 'mousemove', 'mouseup');
    this.bindDrag('touchstart', 'touchmove', 'touchend');
  }
  
  addConnections(connections){
    for(const connection of connections){
      const item = new StageItem(connection);
      this.el.appendChild(item.el);
    }
  }

  setPosition({x, y}){
    Body.setPosition(this.matter, {x, y});
  }

  syncPosition(calcPosFunc, scale){
    const pos = calcPosFunc(this.matter.position);
    this.el.style.left = pos.x + 'px';
    this.el.style.top = pos.y + 'px';
    this.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}

export default StageHub;