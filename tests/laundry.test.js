const test = require('node:test');
const assert = require('node:assert/strict');
const { getLaundryAdvice, STRONG_WIND_THRESHOLD_KMH } = require('../components/laundry');

test('no rain, no wind -> ok', () => {
  const result = getLaundryAdvice(0, 20, 5, {});
  assert.equal(result.status, 'ok');
});

test('precipitation probability >= 50 -> ng', () => {
  const result = getLaundryAdvice(0, 50, 0, {});
  assert.equal(result.status, 'ng');
});

test('precipitation probability just under 50 -> not ng', () => {
  const result = getLaundryAdvice(0, 49, 0, {});
  assert.notEqual(result.status, 'ng');
});

test('any measurable precipitation -> ng regardless of probability', () => {
  const result = getLaundryAdvice(0.1, 0, 0, {});
  assert.equal(result.status, 'ng');
});

test('strong wind with considerWind on -> caution', () => {
  const result = getLaundryAdvice(0, 0, STRONG_WIND_THRESHOLD_KMH, { considerWind: true });
  assert.equal(result.status, 'caution');
});

test('strong wind with considerWind off -> ok', () => {
  const result = getLaundryAdvice(0, 0, STRONG_WIND_THRESHOLD_KMH, { considerWind: false });
  assert.equal(result.status, 'ok');
});

test('pollen season (spring) with considerPollen on -> caution', () => {
  const result = getLaundryAdvice(0, 0, 0, { considerPollen: true }, 3); // March
  assert.equal(result.status, 'caution');
});

test('pollen season (autumn) with considerPollen on -> caution', () => {
  const result = getLaundryAdvice(0, 0, 0, { considerPollen: true }, 9); // September
  assert.equal(result.status, 'caution');
});

test('pollen consideration does not apply outside spring/autumn', () => {
  const result = getLaundryAdvice(0, 0, 0, { considerPollen: true }, 12); // December
  assert.equal(result.status, 'ok');
});

test('pollen consideration is ignored once already ng from rain', () => {
  const result = getLaundryAdvice(1, 0, 0, { considerPollen: true }, 3);
  assert.equal(result.status, 'ng');
});

test('pickup advice is included in comments when laundry is going outside', () => {
  const result = getLaundryAdvice(0, 20, 0, {}, 6, '15時から雨の可能性。14時までに取り込むと安心です');
  assert.ok(result.comments.includes('15時から雨の可能性。14時までに取り込むと安心です'));
});

test('pickup advice is ignored when status is already ng', () => {
  const result = getLaundryAdvice(1, 0, 0, {}, 6, '15時から雨の可能性。14時までに取り込むと安心です');
  assert.ok(!result.comments.includes('15時から雨の可能性。14時までに取り込むと安心です'));
});
