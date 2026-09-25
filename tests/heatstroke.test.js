const test = require('node:test');
const assert = require('node:assert/strict');
const { getHeatLevel, estimateWbgt } = require('../components/heatstroke');

test('below 25C -> no alert', () => {
  assert.equal(getHeatLevel(24), null);
});

test('25-27C -> caution', () => {
  assert.equal(getHeatLevel(25).level, 'caution');
  assert.equal(getHeatLevel(27).level, 'caution');
});

test('28-30C -> warning', () => {
  assert.equal(getHeatLevel(28).level, 'warning');
});

test('31-34C -> severe', () => {
  assert.equal(getHeatLevel(31).level, 'severe');
});

test('35C and above -> danger', () => {
  assert.equal(getHeatLevel(35).level, 'danger');
  assert.equal(getHeatLevel(40).level, 'danger');
});

test('with humidity: same temperature is worse when humid', () => {
  const humid = getHeatLevel(30, 80);
  const dry = getHeatLevel(30, 30);
  assert.equal(humid.level, 'danger');
  assert.equal(dry.level, 'warning');
});

test('with humidity: high humidity can push a moderate temperature into an alert level', () => {
  // 22C alone is below the no-humidity-data 25C threshold, but high humidity
  // raises the effective WBGT enough to warrant a warning.
  assert.equal(getHeatLevel(22), null);
  assert.equal(getHeatLevel(22, 90).level, 'warning');
});

test('estimateWbgt increases with humidity at a fixed temperature', () => {
  assert.ok(estimateWbgt(30, 80) > estimateWbgt(30, 30));
});

test('activity day boosts the temperature-only threshold', () => {
  assert.equal(getHeatLevel(23, null, false), null);
  assert.equal(getHeatLevel(23, null, true).level, 'caution');
});

test('activity day boosts the humidity-based (WBGT) threshold', () => {
  const normal = getHeatLevel(27, 60, false);
  const activity = getHeatLevel(27, 60, true);
  assert.equal(normal.level, 'warning');
  assert.equal(activity.level, 'severe');
});
