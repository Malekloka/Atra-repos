import EventEmitter from '../util/event-emitter.js';

class CheckBox extends EventEmitter {
  constructor(el, translations) {
    super();
    this.el = el;
    this.translations = translations;
    this.bind();
  }

  get checked(){
    return this.el.checked;
  }

  translate(lang) {
    this.el.closest('label').querySelector('.text').textContent = this.translations[lang];
  }

  bind() {
    this.el.addEventListener('click', () => {
      this.emit('change', this.el.checked);
    });
  }
}

export default CheckBox;