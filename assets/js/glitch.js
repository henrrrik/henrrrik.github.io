(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const avatar = document.querySelector('.avatar');
  if (!avatar) return;

  let stopped = false;
  let timeoutId = null;

  function trigger() {
    if (stopped) return;
    avatar.classList.add('glitching');
    avatar.addEventListener('animationend', () => {
      avatar.classList.remove('glitching');
      schedule();
    }, { once: true });
  }

  function schedule() {
    if (stopped) return;
    const delay = 2500 + Math.random() * 5500;
    timeoutId = setTimeout(trigger, delay);
  }

  function stop() {
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    avatar.classList.remove('glitching');
  }

  avatar.addEventListener('pointerdown', stop, { once: true });

  schedule();
})();
