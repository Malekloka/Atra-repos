
// create particles
if (document.querySelector('.bg')) {
  document.querySelector('.bg').innerHTML = Array.from({ length: 20 }).map(() => `
      <div class="bg-particle">
        <div class="particle-inner"></div>
      </div>
    `).join('');

  const particles = document.querySelectorAll('.bg-particle');
  particles.forEach(particle => {
    const particleInner = particle.querySelector('.particle-inner');
    const size = Math.random() * 10;
    particleInner.style.width = `${size}px`;
    particleInner.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 50 + 50}vh`;
    particle.style.animationDuration = `${Math.random() * 6 + 2}s`;
    particle.style.animationDelay = `${Math.random() * 6}s`;
    particleInner.style.animationDuration = `${Math.random() * 6 + 1}s`;
    particleInner.style.animationDelay = `${Math.random() * 6}s`;
  });
}

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, data) {
    const event = this.events[eventName];
    if (event) {
      event.forEach(cb => cb(data));
    }
  }

  bubble(eventName, eventEmitter) {
    eventEmitter.on(eventName, (data) => {
      this.emit(eventName, data);
    });
  }
}

class LanguagesDropdown extends EventEmitter {
  constructor(el){
    super();
    this.el = el;
    this.bind();
  }

  get isOpen (){
    return this.el.classList.contains('is-open');
  } 

  close (){
    this.el.classList.remove('is-open');
  }

  open (){
    this.el.classList.add('is-open');
  }

  bind(){
    const buttonOpen = this.el.querySelector('.dropdown__button-open');
    
    buttonOpen.addEventListener('click', () => {
      if(this.isOpen){
        this.close();
      } else {
        this.open();
      }
    });

    // bind close when clicking outside
    document.addEventListener('click', (e) => {
      if(this.isOpen && !this.el.contains(e.target)){
        this.close();
      }
    });

    // emit event when selecting a language
    this.el.querySelectorAll('.dropdown__option').forEach(item => {
      item.addEventListener('click', () => {
        this.close();
        this.emit('select', item.dataset.value);
      });
    });
  }
}


if(document.querySelector('#languages-dropdown')){
  const dropdown = new LanguagesDropdown(document.querySelector('#languages-dropdown'));
  dropdown.on('select', (lang) => {
    window.location.href = window.location.href.replace(/\/[a-z]{2}(\/|$)/, `/${lang}/`);
  });
}