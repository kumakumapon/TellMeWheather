const test = require('node:test');
const assert = require('node:assert/strict');
const { getWeatherInfo, parseLocalDate } = require('../components/weather');

test('known WMO code returns its label', () => {
  assert.equal(getWeatherInfo(0).label, '快晴');
  assert.equal(getWeatherInfo(61).label, '雨（弱）');
});

test('unknown WMO code falls back gracefully', () => {
  assert.equal(getWeatherInfo(12345).label, '不明');
});

test('string codes are coerced to numbers', () => {
  assert.equal(getWeatherInfo('0').label, '快晴');
});

test('parseLocalDate builds a date from local components, not UTC', () => {
  const date = parseLocalDate('2026-09-21');
  // new Date('2026-09-21') would be UTC midnight, which in a negative-UTC
  // offset timezone displays as 2026-09-20 — parseLocalDate must not do that.
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 8); // 0-based: September
  assert.equal(date.getDate(), 21);
});
