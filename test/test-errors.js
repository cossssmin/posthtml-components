'use strict';

const test = require('ava');
const plugin = require('../src');
const posthtml = require('posthtml');
const clean = html => html.replace(/(\n|\t)/g, '').trim();

test('Must fail when namespace path is not found without fallback root', async t => {
  const actual = `<div><x-empty-namespace::button>Submit</x-empty-namespace::button></div>`;

  await t.throwsAsync(async () => posthtml([plugin({root: './test/templates', namespaceFallback: false, namespaces: [{name: 'empty-namespace', root: './test/templates/empty-namespace'}]})]).process(actual).then(result => clean(result.html)));
});

test('Must fail when namespace path is not found with fallback root', async t => {
  const actual = `<div><x-empty-namespace::button>Submit</x-empty-namespace::button></div>`;

  await t.throwsAsync(async () => posthtml([plugin({root: './test/templates', namespaceFallback: true, namespaces: [{name: 'empty-namespace', root: './test/templates/empty-namespace'}]})]).process(actual).then(result => clean(result.html)));
});

test('Must fail when namespace is unknown', async t => {
  const actual = `<div><x-unknown-namespace::button>Submit</x-unknown-namespace::button></div>`;

  await t.throwsAsync(async () => posthtml([plugin({root: './test/templates'})]).process(actual).then(result => clean(result.html)));
});

test('Must return node as-is when namespace is unknown with strict mode disabled', async t => {
  const actual = `<div><x-unknown-namespace::button>Submit</x-unknown-namespace::button></div>`;
  const expected = `<div><x-unknown-namespace::button>Submit</x-unknown-namespace::button></div>`;

  const html = await posthtml([plugin({root: './test/templates', strict: false})]).process(actual).then(result => clean(result.html));

  t.is(html, expected);
});

test('Must return node as-is when namespace is empty with strict mode disabled', async t => {
  const actual = `<div><x-empty-namespace::button>Submit</x-empty-namespace::button></div>`;
  const expected = `<div><x-empty-namespace::button>Submit</x-empty-namespace::button></div>`;

  const html = await posthtml([plugin({root: './test/templates', strict: false, namespaces: [{name: 'empty-namespace', root: './test/templates/empty-namespace'}]})]).process(actual).then(result => clean(result.html));

  t.is(html, expected);
});

test('Must return node as-is when all defined roots are empty with strict mode disabled', async t => {
  const actual = `<div><x-button>Submit</x-button></div>`;
  const expected = `<div><x-button>Submit</x-button></div>`;

  const html = await posthtml([plugin({root: './test/templates/empty-root', strict: false})]).process(actual).then(result => clean(result.html));

  t.is(html, expected);
});
