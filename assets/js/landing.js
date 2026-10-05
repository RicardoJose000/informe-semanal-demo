// Landing page interactions: reveal on scroll, 3D parallax, company switcher.
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal blocks as they enter the viewport
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, #videoFrame, #papers').forEach((el) => io.observe(el));

  // Hero 3D scene follows the pointer
  const stage = document.getElementById('stage');
  const scene = document.getElementById('scene');
  if (stage && scene && !reduced) {
    const base = { x: 12, y: -20, z: 2 };
    window.addEventListener('pointermove', (ev) => {
      const r = stage.getBoundingClientRect();
      const dx = (ev.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (ev.clientY - (r.top + r.height / 2)) / window.innerHeight;
      scene.style.transform = `rotateX(${base.x - dy * 10}deg) rotateY(${base.y + dx * 14}deg) rotateZ(${base.z}deg)`;
    });
  }

  // Requirement cards: subtle 3D tilt under the cursor
  if (!reduced) {
    document.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (ev) => {
        const r = card.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width - 0.5;
        const py = (ev.clientY - r.top) / r.height - 0.5;
        card.style.transform = `rotateX(${-py * 8}deg) rotateY(${px * 10}deg) translateZ(0)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  // Multi-company preview
  const card = document.getElementById('bdCard');
  document.querySelectorAll('#swatches .sw').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#swatches .sw').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      card.style.setProperty('--c1', btn.dataset.c1);
      card.style.setProperty('--c2', btn.dataset.c2);
      document.getElementById('bdLogo').textContent = btn.dataset.logo;
      document.getElementById('bdName').textContent = btn.dataset.name;
    });
  });

  // Play the walkthrough when it scrolls into view (muted)
  const walk = document.getElementById('walk');
  if (walk) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) walk.play().catch(() => {});
        else walk.pause();
      });
    }, { threshold: 0.5 });
    vio.observe(walk);

    // The video autoplays muted; one click turns the music on
    const sound = document.getElementById('sound');
    const syncSound = () => sound.classList.toggle('off', !walk.muted);
    sound.addEventListener('click', () => {
      walk.muted = false;
      if (walk.ended || walk.currentTime > walk.duration - 1) walk.currentTime = 0;
      walk.play().catch(() => {});
      syncSound();
    });
    walk.addEventListener('volumechange', syncSound);
  }
})();
