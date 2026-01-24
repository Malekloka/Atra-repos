import EventEmitter from '../util/event-emitter.js';

class MapsDropdown extends EventEmitter {
  constructor(el){
    super();
    this.el = el;
    this.bind();
    this.selected = null;
    this.lang = 'en';
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

  select(value){
    if(this.selected && this.selected !== value){
      this.emit('select', value);
    }

    this.selected = value;
    const selectedOption = this.options?.find(option => option.name === this.selected);
    if (selectedOption && this.el.querySelector('.dropdown__button-open')) {
      this.el.querySelector('.dropdown__button-open').textContent = selectedOption[this.lang];
    }
    this.el.querySelectorAll('.dropdown__option').forEach(item => item.classList.remove('is-selected'));
    this.el.querySelector('.dropdown__option[data-value="'+value+'"]')?.classList.add('is-selected');
  }

  setOptions (options){
    this.options = options;
    this.render();
  }

  translate(lang){
    this.lang = lang;
    this.render();
  }

  render(){
    const optionsHTML = this.options.map(option => `
      <li>
        <button class="dropdown__option" data-value="${option.name}">
          ${option[this.lang]}
        </button>
      </li>
    `).join('');
    
    this.el.querySelector('.dropdown__options').innerHTML = optionsHTML;

    if(this.selected){
      const selectedOption = this.options?.find(option => option.name === this.selected);
      if (selectedOption && this.el.querySelector('.dropdown__button-open')) {
        this.el.querySelector('.dropdown__button-open').textContent = selectedOption[this.lang];
      }
    }
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

      if(this.isOpen && this.el.contains(e.target) && e.target.dataset.value){
        this.close();
        this.select(e.target.dataset.value);
      }
    });
  }
}

export default MapsDropdown;