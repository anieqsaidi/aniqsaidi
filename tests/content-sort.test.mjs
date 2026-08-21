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
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Latest', 'Middle', 'Older']);

  sortScope(scope, 'oldest');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Older', 'Middle', 'Latest']);

  sortScope(scope, 'title-asc');
  assert.deepEqual(scope.children.map((item) => item.dataset.sortTitle), ['Latest', 'Middle', 'Older']);
});
