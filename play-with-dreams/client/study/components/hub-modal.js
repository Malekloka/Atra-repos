import EventEmitter from "../util/event-emitter.js";

class HubModal extends EventEmitter{
  constructor(el){
    super();
    this.el = el;
    this.bindClose();
  }

  bindClose(){
    document.addEventListener('mousedown', (e) => {
      if(!this.el.contains(e.target)){
        this.hide();
      }
    });
  }

  setOptions(options){
    this.options = options;
    this.el.innerHTML = '';
    this.createDOM(options);
  }

  translate(language){
    // Translate the placeholder option (first option in select)
    const select = this.el.querySelector('select');
    if (select && select.options.length > 0) {
      const placeholderOption = select.options[0];
      const translations = {
        en: 'Type',
        he: 'סוג',
        ar: 'نوع'
      };
      placeholderOption.textContent = translations[language] || translations.en;
    }
    
    // Translate theme options (skip the first "None" option)
    this.elOptions.forEach((optionEl, i) => {
      optionEl.textContent = this.options[i][language] ?? this.options[i].text;
    });
  }

  createDOM(options){
    const select = document.createElement('select');
    this.el.appendChild(select);

    // Add placeholder option as the first option
    const placeholderOption = document.createElement('option');
    placeholderOption.textContent = 'Type';
    placeholderOption.value = '';
    placeholderOption.disabled = true; // Make it non-selectable
    placeholderOption.selected = true; // Selected by default
    select.appendChild(placeholderOption);

    this.elOptions = options.map(option => {
      const optionEl = document.createElement('option');
      optionEl.textContent = option.text;
      optionEl.value = option._id;
      select.appendChild(optionEl);
      return optionEl;
    });

    // Set default selection to "None"
    select.selectedIndex = 0;

    select.addEventListener('change', async (e) => {
      const opt = select.options[select.selectedIndex];
      const themeId = opt.value;
      
      // Only emit change if a theme is actually selected (not placeholder)
      if (themeId && themeId !== '') {
        this.emit('change', {themeId, pos: this.pos, themeName: opt.textContent});
        this.id = themeId;
        this.hide();
      }
      // If placeholder is selected, do nothing (it's disabled anyway)
    });
  }

  show({x, y}){
    this.pos = {x, y};

    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.classList.add('is-active');
    
    // Reset selection to placeholder when showing the modal
    const select = this.el.querySelector('select');
    if (select) {
      select.selectedIndex = 0; // Select the placeholder option
    }
  }

  hide(){
    this.el.classList.remove('is-active');
  }

  get isOpen(){
    return this.el.classList.contains('is-active');
  }
}

export default HubModal;