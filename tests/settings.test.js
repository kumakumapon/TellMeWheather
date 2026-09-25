const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, getActiveLocation } = require('../components/settings');

test('normalizeSettings migrates the old flat city/lat/lon schema into locations', () => {
  const result = normalizeSettings({ city: '大阪市', lat: 34.6, lon: 135.5, kids: [] });
  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0].city, '大阪市');
  assert.equal(result.locations[0].lat, 34.6);
  assert.equal(result.locations[0].lon, 135.5);
  assert.equal(result.activeLocationIndex, 0);
  assert.equal('city' in result, false);
});

test('normalizeSettings leaves an already-migrated locations array alone', () => {
  const parsed = {
    locations: [
      { label: '自宅', city: '東京', lat: 35.6, lon: 139.7 },
      { label: '学校', city: '横浜市', lat: 35.4, lon: 139.6 },
    ],
    activeLocationIndex: 1,
  };
  const result = normalizeSettings(parsed);
  assert.equal(result.locations.length, 2);
  assert.equal(result.activeLocationIndex, 1);
});

test('normalizeSettings resets an out-of-range activeLocationIndex', () => {
  const result = normalizeSettings({ locations: [{ label: '自宅', city: '東京', lat: null, lon: null }], activeLocationIndex: 5 });
  assert.equal(result.activeLocationIndex, 0);
});

test('normalizeSettings backfills missing activityDays', () => {
  const result = normalizeSettings({});
  assert.equal(result.activityDays.length, 7);
  assert.ok(result.activityDays.every(v => v === false));
});

test('getActiveLocation returns the location at activeLocationIndex', () => {
  const settings = {
    locations: [{ label: '自宅', city: '東京' }, { label: '学校', city: '横浜市' }],
    activeLocationIndex: 1,
  };
  assert.equal(getActiveLocation(settings).label, '学校');
});

test('getActiveLocation falls back to the first location when the index is invalid', () => {
  const settings = { locations: [{ label: '自宅', city: '東京' }], activeLocationIndex: 3 };
  assert.equal(getActiveLocation(settings).label, '自宅');
});
