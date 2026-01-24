import EventEmitter from '../util/event-emitter.js';

class CityFilterDropdown extends EventEmitter {
  constructor(el){
    super();
    this.el = el;
    this.bind();
    this.selected = null;
    this.lang = 'en';
    this.options = [
      { value: '', en: 'All Dreams', he: 'כל החלומות', ar: 'جميع الأحلام' },
      { value: 'arad', en: 'Arad', he: 'ערד', ar: 'عراد' },
      { value: 'tel-aviv', en: 'Tel-Aviv', he: 'תל אביב', ar: 'تل أبيب' },
      { value: 'both', en: 'Arad & Tel-Aviv', he: 'ערד ותל אביב', ar: 'عراد وتل-أبيب' }
    ];
    this.render();
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
    if(this.selected !== value){
      this.selected = value;
      const selectedOption = this.options.find(option => option.value === this.selected);
      if (selectedOption) {
        this.el.querySelector('.dropdown__button-open').textContent = selectedOption[this.lang];
      }
      this.emit('select', value);
    }
    this.close();
  }

  translate(lang){
    this.lang = lang;
    this.render();
  }

  render(){
    const optionsHTML = this.options.map(option => `
      <li>
        <button class="dropdown__option" data-value="${option.value}">
          ${option[this.lang]}
        </button>
      </li>
    `).join('');
    
    this.el.querySelector('.dropdown__options').innerHTML = optionsHTML;

    if(this.selected !== null){
      const selectedOption = this.options.find(option => option.value === this.selected);
      if (selectedOption) {
        this.el.querySelector('.dropdown__button-open').textContent = selectedOption[this.lang];
      }
    } else {
      // Default to "All Cities"
      this.el.querySelector('.dropdown__button-open').textContent = this.options[0][this.lang];
      this.selected = '';
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

      if(this.isOpen && this.el.contains(e.target) && e.target.dataset.value !== undefined){
        const value = e.target.dataset.value || '';
        this.select(value);
      }
    });
  }
}

export default CityFilterDropdown;

