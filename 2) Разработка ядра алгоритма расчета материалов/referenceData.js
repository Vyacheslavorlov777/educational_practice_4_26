// Мок-справочники БД: в реальном приложении это были бы таблицы product_types и material_types.
// Ключ — ID справочной записи, значение — параметр, влияющий на расход материала.

const PRODUCT_TYPE_COEFFICIENTS = {
  1: 1.2, // Стаканчик (тонкостенное изделие — повышенный коэффициент расхода)
  2: 1.0, // Крышка
  3: 0.8, // Мешалка
};

const MATERIAL_DEFECT_PERCENTS = {
  1: 5, // Пластик — процент брака при литье
  2: 8, // Картон — процент брака при штамповке
  3: 3, // Дерево — процент брака при обработке
};

function getProductTypeCoefficient(productTypeId) {
  return PRODUCT_TYPE_COEFFICIENTS[productTypeId];
}

function getMaterialDefectPercent(materialTypeId) {
  return MATERIAL_DEFECT_PERCENTS[materialTypeId];
}

module.exports = { getProductTypeCoefficient, getMaterialDefectPercent };
