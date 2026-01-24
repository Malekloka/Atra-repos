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
    const size = Math.random() * 10 + 2;
    particleInner.style.width = `${size}px`;
    particleInner.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 50 + 50}vh`;
    const duration = Math.random() * 6 + 2;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `${Math.random() * 6}s`;
    particleInner.style.animationDuration = `${Math.random() * 6 + 1}s`;
    particleInner.style.animationDelay = `${Math.random() * 6}s`;
  });
}

// popup functionality
const btnPopup = document.querySelector('#btn-popup');
const popup = document.querySelector('#popup');
if (btnPopup && popup) {
  btnPopup.addEventListener('click', () => {
    popup.showModal();
  });
  
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.close();
    }
  });
  
  const popupClose = document.querySelector('.popup-close');
  if (popupClose) {
    popupClose.addEventListener('click', () => {
      popup.close();
    });
  }
}

