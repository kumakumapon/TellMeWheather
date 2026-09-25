const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary, getWeatherSeverity } = require('../components/hourly');

function slot(name, label) {
  return { name, info: { label } };
}

test('heavy rain (65) ranks more severe than snow grains (77)', () => {
  assert.ok(getWeatherSeverity(65) > getWeatherSeverity(77));
});

test('heavy snow (75) ranks more severe than slight rain showers (80)', () => {
  assert.ok(getWeatherSeverity(75) > getWeatherSeverity(80));
});

test('unknown codes default to the lowest severity', () => {
  assert.equal(getWeatherSeverity(12345), 0);
});

test('buildSummary: sunny morning and afternoon', () => {
  const summary = buildSummary([slot('朝', '快晴'), slot('昼過ぎ', 'ほぼ晴れ')]);
  assert.match(summary, /終日晴れ/);
});

test('buildSummary: rain starting in the afternoon', () => {
  const summary = buildSummary([slot('朝', '快晴'), slot('昼過ぎ', '雨')]);
  assert.match(summary, /昼から雨/);
});

test('buildSummary: empty slots returns empty string', () => {
  assert.equal(buildSummary([]), '');
});
