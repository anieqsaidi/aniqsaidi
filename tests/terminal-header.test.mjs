import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Script } from 'node:vm';

const header = await readFile(new URL('../src/components/TerminalHeader.astro', import.meta.url), 'utf8');
const script = new Script(header.match(/<script is:inline>([\s\S]*?)<\/script>/)[1]);

function openHeader(at) {
  let now = Date.parse(at);
  let timerId = 0;
  const timers = new Map();
  const windowEvents = new Map();
  const documentEvents = new Map();
  const element = (textContent = '') => ({
    textContent,
    hidden: true,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const elements = {
    'birthday-emoji': element(),
    'header-clock': element(),
    'clock-hour': element('--'),
    'clock-minute': element('--'),
    '.header-date-full': element('OCTOBER 1, 2026'),
    '.header-date-short': element('01-OCT-26'),
    '.header-mobile-date': element('// 01-OCT-26'),
  };
  const document = {
    hidden: false,
    getElementById: (id) => elements[id],
    querySelector: (selector) => elements[selector],
    addEventListener: (event, callback) => documentEvents.set(event, callback),
  };
  script.runInNewContext({
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    Intl,
    document,
    window: {
      matchMedia: () => ({ matches: true }),
      setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
      clearTimeout: (id) => timers.delete(id),
      addEventListener: (event, callback) => windowEvents.set(event, callback),
    },
  });
  return {
    elements,
    timers,
    setTime(at) { now = Date.parse(at); },
    nextMinute() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      now += timer.delay;
      timer.callback();
    },
    showPage() { windowEvents.get('pageshow')(); },
    showTab() { documentEvents.get('visibilitychange')(); },
  };
}

test('all header date formats use the visit date in Malaysia instead of a stale build date', () => {
  const { elements } = openHeader('2026-10-11T16:05:00Z');
  assert.equal(elements['.header-date-full'].textContent, 'OCTOBER 12, 2026');
  assert.equal(elements['.header-date-short'].textContent, '12-OCT-26');
  assert.equal(elements['.header-mobile-date'].textContent, '// 12-OCT-26');
  assert.equal(elements['.header-mobile-date'].attributes['aria-label'], 'Current date in Malaysia: OCTOBER 12, 2026');
  assert.equal(elements['clock-hour'].textContent, '00');
  assert.equal(elements['clock-minute'].textContent, '05');
});

test('an open page advances to the next date at Malaysian midnight', () => {
  const header = openHeader('2026-10-11T15:59:59Z');
  assert.equal(header.elements['.header-date-full'].textContent, 'OCTOBER 11, 2026');
  header.nextMinute();
  assert.equal(header.elements['.header-date-full'].textContent, 'OCTOBER 12, 2026');
  assert.equal(header.elements['.header-date-short'].textContent, '12-OCT-26');
  assert.equal(header.elements['.header-mobile-date'].textContent, '// 12-OCT-26');
  assert.equal(header.elements['clock-hour'].textContent, '00');
  assert.equal(header.elements['clock-minute'].textContent, '00');
  assert.equal(header.timers.size, 1);
});

test('restored pages and resumed tabs refresh immediately without duplicate clock timers', () => {
  const header = openHeader('2026-10-01T04:00:00Z');
  header.setTime('2026-10-11T16:05:00Z');
  header.showPage();
  assert.equal(header.elements['.header-date-full'].textContent, 'OCTOBER 12, 2026');
  assert.equal(header.timers.size, 1);
  header.setTime('2026-12-31T16:00:00Z');
  header.showTab();
  assert.equal(header.elements['.header-date-full'].textContent, 'JANUARY 1, 2027');
  assert.equal(header.elements['.header-mobile-date'].textContent, '// 01-JAN-27');
  assert.equal(header.timers.size, 1);
});

test('the birthday indicator starts and ends on August 2 in Malaysia', () => {
  const header = openHeader('2026-08-01T15:59:59Z');
  assert.equal(header.elements['birthday-emoji'].hidden, true);
  header.nextMinute();
  assert.equal(header.elements['birthday-emoji'].hidden, false);
  header.setTime('2026-08-02T16:00:00Z');
  header.showTab();
  assert.equal(header.elements['birthday-emoji'].hidden, true);
});
