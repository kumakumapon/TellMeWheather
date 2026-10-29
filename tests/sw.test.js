const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('offline weather reaches timestamped app cache instead of silently reusing an API response', async () => {
  const listeners = {};
  const context = vm.createContext({URL, self: {addEventListener: (name, listener) => {listeners[name] = listener;}}, fetch: () => Promise.reject(new Error('offline')), caches: {match: () => {throw new Error('must not read unversioned API cache');}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), context);
  let response;
  listeners.fetch({request: {method: 'GET', url: 'https://api.open-meteo.com/v1/forecast'}, respondWith: promise => {response = promise;}});
  await assert.rejects(response, /offline/);
});
