import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/site.js', import.meta.url), 'utf8');

function element(id = '') {
  const classes = new Set();
  const attributes = new Map();
  const events = new Map();
  return {
    id, events, attributes, inert: false, disabled: false, scrollTop: 0,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    addEventListener: (name, callback) => events.set(name, callback),
    focus() { this.focused = true; },
    scrollIntoView() { this.scrolled = (this.scrolled || 0) + 1; },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null
  };
}

function fixture({ gsapEnabled = false, reduced = false, hash = '' } = {}) {
  const panels = ['top', 'projects', 'workbench', 'about'].map(element);
  const flow = element();
  panels[2].querySelector = (selector) => selector === '.flow-scene' ? flow : null;
  const prev = element();
  const next = element();
  const stage = element();
  stage.querySelectorAll = (selector) => selector === '[data-stage-panel]' ? panels : [];
  stage.querySelector = (selector) => selector === '[data-stage-prev]' ? prev : selector === '[data-stage-next]' ? next : null;
  const choices = panels.map((panel) => {
    const link = element();
    link.hash = '#' + panel.id;
    link.getAttribute = () => link.hash;
    return link;
  });
  const contactLink = element();
  contactLink.hash = '#contact';
  contactLink.getAttribute = () => '#contact';
  contactLink.closest = () => panels[0];
  stage.querySelectorAll = (selector) => selector === '[data-stage-panel]' ? panels : selector === '[data-stage-link]' ? choices : [];
  const contact = element('contact');
  const documentEvents = new Map();
  const windowEvents = new Map();
  const media = { matches: reduced, addEventListener(name, callback) { this.change = callback; } };
  const timelines = [];
  const gsap = gsapEnabled ? {
    set() {},
    timeline({ onComplete }) {
      const timeline = {
        killed: false,
        kill() { this.killed = true; },
        to() { return this; },
        fromTo() { return this; },
        finish() { onComplete(); }
      };
      timelines.push(timeline);
      return timeline;
    }
  } : undefined;
  const window = { location: { hash }, matchMedia: () => media, gsap, addEventListener: (name, callback) => windowEvents.set(name, callback) };
  const document = {
    documentElement: element(),
    querySelector: () => stage,
    querySelectorAll: () => [...choices, contactLink],
    getElementById: () => contact,
    addEventListener: (name, callback) => documentEvents.set(name, callback)
  };
  const history = { pushState(_state, _title, url) { window.location.hash = url; } };
  runInNewContext(source, { window, document, history });
  const click = (link) => link.events.get('click')({ preventDefault() {} });
  const current = () => panels.findIndex((panel) => panel.classList.contains('is-active'));
  return { panels, choices, contactLink, contact, prev, next, flow, stage, window, documentEvents, windowEvents, media, timelines, click, current };
}

{
  const app = fixture();
  assert.equal(app.current(), 0);
  assert.equal(app.panels.filter((panel) => !panel.inert).length, 1);
  assert.equal(app.prev.disabled, true);
  app.click(app.choices[1]);
  assert.equal(app.current(), 1);
  assert.equal(app.window.location.hash, '#projects');
  app.click(app.contactLink);
  assert.equal(app.current(), 3);
  assert.equal(app.window.location.hash, '#contact');
  assert.equal(app.contact.scrolled, 1);
  app.panels[3].scrollTop = 120;
  app.click(app.choices[3]);
  assert.equal(app.window.location.hash, '#about');
  assert.equal(app.panels[3].scrollTop, 0);
  app.window.location.hash = '#contact';
  app.windowEvents.get('popstate')();
  assert.equal(app.contact.scrolled, 2);
  app.documentEvents.get('keydown')({ key: 'ArrowLeft', target: { tagName: 'BODY' }, preventDefault() {} });
  assert.equal(app.current(), 2);
  assert.equal(app.panels[2].focused, true);
  app.stage.events.get('touchstart')({ touches: [{ clientX: 240, clientY: 100 }] });
  app.stage.events.get('touchend')({ changedTouches: [{ clientX: 90, clientY: 105 }] });
  assert.equal(app.current(), 3);
}

{
  const app = fixture({ hash: '#contact' });
  assert.equal(app.current(), 3);
  assert.equal(app.contact.scrolled, 1);
}

{
  const app = fixture({ gsapEnabled: true, reduced: true });
  app.click(app.choices[1]);
  assert.equal(app.current(), 1);
  assert.equal(app.timelines.length, 0);
}

{
  const app = fixture({ gsapEnabled: true });
  app.click(app.choices[1]);
  assert.equal(app.timelines.length, 1);
  app.click(app.choices[2]);
  assert.equal(app.timelines[0].killed, true);
  assert.equal(app.current(), 2);
  assert.equal(app.timelines.length, 2);
  app.windowEvents.get('hashchange')();
  assert.equal(app.timelines[1].killed, false);
  app.timelines[1].finish();
  assert.equal(app.panels.filter((panel) => !panel.inert).length, 1);
}

console.log('PASS: stage navigation, contact history, reduced motion and rapid transition state');
