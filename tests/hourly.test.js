const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary, getWeatherSeverity, buildHourlyRainProbabilities, getLaundryPickupAdvice } = require('../components/hourly');

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

function hourlyData(probByHour) {
  const time = [];
  const precipitation_probability = [];
  Object.entries(probByHour).forEach(([h, prob]) => {
    time.push(`2026-06-16T${String(h).padStart(2, '0')}:00`);
    precipitation_probability.push(prob);
  });
  return {
    daily: { time: ['2026-06-15', '2026-06-16'] },
    hourly: { time, precipitation_probability },
  };
}

test('buildHourlyRainProbabilities covers 6:00-21:00 for tomorrow', () => {
  const hours = buildHourlyRainProbabilities(hourlyData({ 12: 80 }));
  assert.equal(hours.length, 16); // 6..21 inclusive
  assert.equal(hours.find(h => h.h === 12).prob, 80);
  assert.equal(hours.find(h => h.h === 6).prob, 0); // missing hour defaults to 0
});

test('getLaundryPickupAdvice finds the first risky hour at/after 9am', () => {
  const hours = buildHourlyRainProbabilities(hourlyData({ 8: 90, 15: 60 }));
  const advice = getLaundryPickupAdvice(hours);
  assert.match(advice, /15時から雨/);
  assert.match(advice, /14時までに/);
});

test('getLaundryPickupAdvice returns null when no hour crosses the threshold', () => {
  const hours = buildHourlyRainProbabilities(hourlyData({ 12: 40 }));
  assert.equal(getLaundryPickupAdvice(hours), null);
});
