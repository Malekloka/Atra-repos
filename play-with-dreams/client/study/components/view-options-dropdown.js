import EventEmitter from '../util/event-emitter.js';

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

export default LanguagesDropdown;