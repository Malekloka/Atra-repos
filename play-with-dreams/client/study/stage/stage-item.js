import EventEmitter from "../util/event-emitter.js";

const { Bodies, Body } = Matter

const kItemRadius = 12;

const kTooSlow = 0.4; // Slightly lower threshold for more continuous movement

class StageItem extends EventEmitter {
  constructor(item, startPosition){
    super();
    this.item = item;
    this.createMatter(startPosition);
    this.createHTMLElement();
    
    // ALWAYS set good_bad_dream value - ensure EVERY dream has a color
    // Default to 5 (neutral/green) if missing
    const value = item.good_bad_dream !== null && item.good_bad_dream !== undefined 
      ? item.good_bad_dream 
      : 5;
    const clampedValue = Math.max(0, Math.min(10, value));
    const valueStr = String(clampedValue);
    
    // Set the value using the method
    this.setGoodBadDream(value);
    
    // Force set attribute immediately after element creation - CRITICAL
    if (this.el) {
      this.el.setAttribute('data-good-bad-dream', valueStr);
      this.el.dataset.goodBadDream = valueStr;
    }
    
    this.bindDOM();
    this.isAnalyzing = !this.item.fullyAnalyzed;
    this.id = item._id;
  }

  set isAnalyzing(val){
    this.el.classList.toggle('is-analyzing', val);
  }


  highlight(){
    this.el.classList.add('is-highlighted');
    const highlight = document.createElement('div');
    highlight.textContent = 'Your Dream';
    highlight.classList.add('highlight');

    this.el.appendChild(highlight);
  }

  setGoodBadDream(good_bad_dream){
    // Always set a value, defaulting to 5 if not provided
    const value = good_bad_dream !== null && good_bad_dream !== undefined 
      ? good_bad_dream 
      : 5;
    const clampedValue = Math.max(0, Math.min(10, value));
    const valueStr = String(clampedValue);
    
    if (this.el) {
      this.el.setAttribute('data-good-bad-dream', valueStr);
      this.el.dataset.goodBadDream = valueStr;
      // Trigger a reflow to ensure CSS applies
      this.el.offsetHeight; // Force reflow
    }
  }

  drawEmotions(emotions, emotionColors){
    this.emotionsWheel = this.el.querySelector('.emotions-wheel');
    // conic wheel
    const segment = 360 / emotions.length;
    this.emotionsWheel.style.background = `conic-gradient(${emotions.map((_, index) => {
      const hasEmotion = !!this.item[emotions[index]];
      return `${hasEmotion ? emotionColors[index] : 'transparent'} ${index * segment}deg ${index * segment + segment}deg`
    }).join(', ')})`;

    this.el.prepend(this.emotionsWheel);
  }

  createMatter({x, y}){
    this.matter = Bodies.circle(x, y, kItemRadius);
    this.matter.friction = 0; // No friction to allow floating
    this.matter.frictionAir = 0.03; // Low air friction to allow floating but prevent excessive speed
    this.matter.inertia = Infinity;
    this.matter.restitution = 0.4; // Good bounce for floating dynamics
    Body.setMass(this.matter, 10);
    Body.setStatic(this.matter, false);

    // Add initial force to start floating motion
    this.addRandomForce();
  }

  bindDOM(){
    this.el.addEventListener('mouseenter', () => {
      // if is mobile, skip
      if(window.innerWidth < 768) return;

      Body.setStatic(this.matter, true);
      this.emit('hover', {item: this.item})
    });
    
    this.el.addEventListener('click', () => {
      this.emit('open', {item: this.item})
      this.el.classList.add('is-open');
    });

    this.el.addEventListener('mouseleave', () => {
      // if is mobile, skip
      if(window.innerWidth < 768) return;

      Body.setStatic(this.matter, false);
      this.addRandomForce();
      this.emit('unhover', {item: this.item})
    });
  }

  afterUpdate() {
    // Apply continuous floating forces - nodes try to float around
    // Connections will pull them back, creating a dynamic balance
    const { x: vx, y: vy } = this.matter.velocity;
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    // Always apply some force to keep nodes trying to float
    if (speed < kTooSlow) {
      // When slow, apply force more frequently
      if(Math.random() < 0.35) {
        this.addRandomForce();
      }
    } else {
      // Even when moving, apply regular forces to maintain floating motion
      if(Math.random() < 0.2) {
        this.addRandomForce();
      }
    }
  }

  addRandomForce(){
    // Stronger forces to make nodes try to float - connections will pull them back
    var fx = 0.01 * (Math.random() - 0.5)
    var fy = 0.01 * (Math.random() - 0.5)
    Body.applyForce(this.matter, this.matter.position, { x: fx, y: fy })
  }

  createHTMLElement(){
    this.el = document.createElement('div');
    this.el.classList.add('stage-item');
    // Add animation class
    this.el.classList.add('animate-in');

    this.el.innerHTML = `<div class="stage-item__pin">
      <div class="emotions-wheel"></div>
    </div>`
    return this.el;
  }

  syncPosition(calcPosFunc, scale){
    const pos = calcPosFunc(this.matter.position);
    this.el.style.left = pos.x + 'px';
    this.el.style.top = pos.y + 'px';
    this.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
}

export default StageItem;
