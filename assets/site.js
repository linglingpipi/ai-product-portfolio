(() => {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const panels = [...stage.querySelectorAll('[data-stage-panel]')];
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const choices = [...stage.querySelectorAll('[data-stage-link]')];
  const prev = stage.querySelector('[data-stage-prev]');
  const next = stage.querySelector('[data-stage-next]');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  const indexFor = (hash) => {
    const id = (hash || '#top').slice(1);
    const target = id === 'contact' ? 'about' : id;
    const index = panels.findIndex((panel) => panel.id === target);
    return index < 0 ? 0 : index;
  };
  let active = indexFor(window.location.hash);
  let transition = null;

  function resetMotion() {
    transition?.kill();
    transition = null;
    if (!gsap) return;
    gsap.set(panels, { clearProps: 'opacity,transform,visibility,zIndex' });
    gsap.set(stage.querySelectorAll('[data-reveal], .screen-panel, .showcase-item, .scene-sticker, .flow-node'), { clearProps: 'opacity,transform,visibility' });
  }

  function markActive(index, focusPanel) {
    active = index;
    panels.forEach((panel, position) => {
      const selected = position === active;
      panel.classList.toggle('is-active', selected);
      panel.inert = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
      if (selected) {
        panel.scrollTop = 0;
        panel.querySelector('.flow-scene')?.classList.toggle('is-active', !motionQuery.matches);
        if (focusPanel) {
          panel.tabIndex = -1;
          panel.focus({ preventScroll: true });
        }
      } else panel.querySelector('.flow-scene')?.classList.remove('is-active');
    });
    choices.forEach((choice) => {
      if (choice.hash === '#' + panels[active].id) choice.setAttribute('aria-current', 'page');
      else choice.removeAttribute('aria-current');
    });
    prev.disabled = active === 0;
    next.disabled = active === panels.length - 1;
  }

  function animateDetails(panel, timeline) {
    const reveal = panel.querySelectorAll('[data-reveal]');
    if (reveal.length) timeline.fromTo(reveal, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .09, ease: 'power3.out' }, .18);
    const screens = panel.querySelectorAll('.screen-panel, .showcase-item');
    if (screens.length) {
      timeline.fromTo(screens, { autoAlpha: 0, y: 70, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1, duration: .64, stagger: .11, ease: 'back.out(1.2)' }, .28);
      const sticker = panel.querySelector('.scene-sticker');
      if (sticker) timeline.fromTo(sticker, { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: .4, ease: 'back.out(1.5)' }, .65);
    }
    const nodes = panel.querySelectorAll('.flow-node');
    if (nodes.length) timeline.fromTo(nodes, { autoAlpha: 0, y: 32, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1, duration: .36, stagger: .13, ease: 'power2.out' }, .32);
  }

  function show(index, focusPanel = false) {
    const bounded = Math.max(0, Math.min(panels.length - 1, index));
    const previous = active;
    if (bounded === previous) return;
    resetMotion();
    if (motionQuery.matches || !gsap) {
      markActive(bounded, focusPanel);
      return;
    }
    const outgoing = panels[previous];
    const incoming = panels[bounded];
    const direction = bounded > previous ? 1 : -1;
    markActive(bounded, focusPanel);
    gsap.set(outgoing, { visibility: 'visible', opacity: 1, xPercent: 0, zIndex: 1 });
    gsap.set(incoming, { visibility: 'visible', opacity: 1, xPercent: direction * 100, zIndex: 2 });
    transition = gsap.timeline({ onComplete: () => {
      gsap.set([outgoing, incoming], { clearProps: 'opacity,transform,visibility,zIndex' });
      const incomingDetails = incoming.querySelectorAll('[data-reveal], .screen-panel, .showcase-item, .scene-sticker, .flow-node');
      if (incomingDetails.length) gsap.set(incomingDetails, { clearProps: 'opacity,transform,visibility' });
      transition = null;
    } });
    transition.to(outgoing, { xPercent: -direction * 18, opacity: .4, duration: .62, ease: 'power2.inOut' }, 0);
    transition.to(incoming, { xPercent: 0, duration: .75, ease: 'power3.inOut' }, 0);
    animateDetails(incoming, transition);
  }

  function go(index, focusPanel = false, requestedHash = null) {
    const bounded = Math.max(0, Math.min(panels.length - 1, index));
    const destination = requestedHash || '#' + panels[bounded].id;
    if (bounded === active && destination !== '#contact') panels[bounded].scrollTop = 0;
    if (bounded === active && window.location.hash === destination) return;
    history.pushState(null, '', destination);
    if (bounded !== active) show(bounded, focusPanel);
    else if (focusPanel) panels[bounded].focus({ preventScroll: true });
  }

  for (const link of links) {
    const target = link.getAttribute('href');
    if (!['#top', '#projects', '#workbench', '#about', '#contact'].includes(target)) continue;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      go(indexFor(target), Boolean(link.closest('[data-stage-panel]')), target);
      if (target === '#contact') document.getElementById('contact')?.scrollIntoView({ block: 'nearest' });
    });
  }
  prev.addEventListener('click', () => go(active - 1, true));
  next.addEventListener('click', () => go(active + 1, true));
  function syncLocation() {
    const destination = indexFor(window.location.hash);
    if (destination !== active) show(destination);
    if (window.location.hash === '#contact') document.getElementById('contact')?.scrollIntoView({ block: 'nearest' });
    else if (window.location.hash === '#about') panels[destination].scrollTop = 0;
  }
  window.addEventListener('popstate', syncLocation);
  window.addEventListener('hashchange', syncLocation);
  motionQuery.addEventListener('change', () => {
    resetMotion();
    panels.forEach((panel, position) => panel.querySelector('.flow-scene')?.classList.toggle('is-active', position === active && !motionQuery.matches));
  });
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    go(active + (event.key === 'ArrowRight' ? 1 : -1), true);
  });

  let touchStart = null;
  stage.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  stage.addEventListener('touchend', (event) => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(active + (dx < 0 ? 1 : -1));
  }, { passive: true });

  markActive(active, false);
  document.documentElement.classList.add('stage-ready');
  if (gsap) document.documentElement.classList.add('stage-gsap');
  if (window.location.hash === '#contact') document.getElementById('contact')?.scrollIntoView({ block: 'nearest' });
})();
