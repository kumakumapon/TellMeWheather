const test = require('node:test');
const assert = require('node:assert/strict');
const { getHeatLevel } = require('../components/heatstroke');

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
