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

const {validateWeatherData, alignWeatherToToday} = require('../components/weather');
const fixture = require('./fixtures/forecast');
test('cache rebases today/tomorrow after midnight in the forecast timezone', () => {
  const data = fixture(); data.timezone = 'Asia/Tokyo';
  const aligned = alignWeatherToToday(data, Date.parse('2026-10-28T16:00:00Z'));
  assert.equal(aligned.daily.time[0], '2026-10-29');
  assert.equal(aligned.daily.time[1], '2026-10-30');
  assert.equal(data.daily.time[0], '2026-10-28');
});
test('expired cache without tomorrow is rejected', () => {
  assert.throws(() => alignWeatherToToday(fixture(), Date.parse('2027-01-01')), /今日・明日/);
});
test('incomplete daily data is rejected and hourly data is optional', () => {
  const data = fixture(); delete data.daily.temperature_2m_max;
  assert.throws(() => validateWeatherData(data), /不完全/);
  const complete = fixture(); complete.hourly = {};
  assert.equal(validateWeatherData(complete).hourly, null);
});
