const test = require('node:test');
const assert = require('node:assert/strict');
const { getClothingAdvice } = require('../components/clothes');

test('cold sensitivity shifts effective temperature down', () => {
  const normal = getClothingAdvice(17, 'normal', 0, 0);
  const cold = getClothingAdvice(17, 'cold', 0, 0);
  assert.equal(normal.outfit, '長袖 or 半袖＋薄手パーカー');
  assert.equal(cold.outfit, '長袖＋上着');
});

test('hot sensitivity shifts effective temperature up', () => {
  const hot = getClothingAdvice(23, 'hot', 0, 0);
  assert.equal(hot.outfit, '半袖');
});

test('high precipitation probability adds an umbrella', () => {
  const result = getClothingAdvice(20, 'normal', 30, 0);
  assert.ok(result.items.includes('折り畳み傘'));
});

test('high UV index adds sun protection items', () => {
  const result = getClothingAdvice(20, 'normal', 0, 8);
  assert.ok(result.items.includes('帽子'));
  assert.ok(result.items.includes('日焼け止め'));
});

test('large morning/afternoon temperature gap adds a note', () => {
  const result = getClothingAdvice(20, 'normal', 0, 0, { morning: 10, afternoon: 20 });
  assert.ok(result.notes.length > 0);
});
