import assert from 'node:assert/strict';
import test from 'node:test';

class FakeElement {
  constructor({ title = '', date = '', container = false } = {}) {
    this.dataset = { sortTitle: title, sortDate: date };
    this.children = [];
    this.container = container;
  }

  matches(selector) { return selector === '[data-sort-container]' && this.container; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  hasAttribute(name) { return name === 'data-sort-item'; }
  append(item) {
    this.children = this.children.filter((child) => child !== item);
    this.children.push(item);
  }
}

globalThis.HTMLElement = FakeElement;
const { sortScope } = await import('../src/scripts/contentSort.ts');

test('sorts when the scope is also the sortable container', () => {
  const scope = new FakeElement({ container: true });
  scope.children = [
    new FakeElement({ title: 'Older', date: '2020' }),
    new FakeElement({ title: 'Latest', date: '2026' }),
    new FakeElement({ title: 'Middle', date: '2023' }),
  ];

  sortScope(scope, 'latest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Older', 'Latest', 'Middle']);

  sortScope(scope, 'oldest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Middle', 'Latest', 'Older']);

  sortScope(scope, 'title-asc');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Latest', 'Middle', 'Older']);

  sortScope(scope, 'latest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Older', 'Latest', 'Middle']);
});

test('keeps curated order for records with the same date', () => {
  const scope = new FakeElement({ container: true });
  scope.children = [
    new FakeElement({ title: 'Zulu', date: '2026' }),
    new FakeElement({ title: 'Alpha', date: '2026' }),
  ];
  sortScope(scope, 'latest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Zulu', 'Alpha']);
});

test('latest sorting preserves the CMS index order', () => {
  const scope = new FakeElement({ container: true });
  scope.children = [
    new FakeElement({ title: 'Newest', date: '2023' }),
    new FakeElement({ title: 'Older', date: '2016' }),
    new FakeElement({ title: 'Middle', date: '2020' }),
  ];
  sortScope(scope, 'latest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Newest', 'Older', 'Middle']);
});
