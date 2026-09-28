const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMaterialConsumption } = require('./materialCalculator');

// Тип продукции 1 (Стаканчик) => коэффициент 1.2, тип материала 1 (Пластик) => брак 5%.
// Значения справочников см. в referenceData.js.

test('Тест 1 (Стандартный): корректный расчет с известным результатом', () => {
  // база = 2 * 3 * 1.2 = 7.2; чистый = 7.2 * 10 = 72; с браком = 72 * 1.05 = 75.6 => ceil = 76
  const result = calculateMaterialConsumption(1, 1, 10, 2, 3);
  assert.equal(result, 76);
});

test('Тест 2 (Округление): дробный результат округляется строго вверх', () => {
  // база = 1 * 1 * 1.0 = 1; чистый = 1 * 3 = 3; с браком (материал 3, брак 3%) = 3 * 1.03 = 3.09 => ceil = 4
  const result = calculateMaterialConsumption(2, 3, 3, 1, 1);
  assert.equal(result, 4);
});

test('Тест 3 (Несуществующий тип): возврат -1 при неизвестном ID типа продукции или материала', () => {
  assert.equal(calculateMaterialConsumption(999, 1, 10, 2, 3), -1);
  assert.equal(calculateMaterialConsumption(1, 999, 10, 2, 3), -1);
});

test('Тест 4 (Отрицательные параметры): возврат -1 при отрицательных param_1 или param_2', () => {
  assert.equal(calculateMaterialConsumption(1, 1, 10, -2, 3), -1);
  assert.equal(calculateMaterialConsumption(1, 1, 10, 2, -3), -1);
});

test('Тест 5 (Нулевое количество): возврат -1, если количество продукции <= 0', () => {
  assert.equal(calculateMaterialConsumption(1, 1, 0, 2, 3), -1);
  assert.equal(calculateMaterialConsumption(1, 1, -5, 2, 3), -1);
});

test('Дополнительно: возврат -1 при нецелом количестве продукции', () => {
  assert.equal(calculateMaterialConsumption(1, 1, 2.5, 2, 3), -1);
});
