const { getProductTypeCoefficient, getMaterialDefectPercent } = require('./referenceData');

const INVALID_RESULT = -1;

// Рассчитывает итоговый расход материала (в целых единицах, с округлением вверх)
// на выпуск партии продукции заданного количества, с учетом типа изделия и брака материала.
// При любой некорректной комбинации входных данных возвращает -1 вместо исключения,
// чтобы вызывающий код (UI) мог отобразить понятное сообщение об ошибке, а не упасть.
function calculateMaterialConsumption(productTypeId, materialTypeId, quantity, param1, param2) {
  const coefficient = getProductTypeCoefficient(productTypeId);
  const defectPercent = getMaterialDefectPercent(materialTypeId);

  const hasUnknownReference = coefficient === undefined || defectPercent === undefined;
  const hasInvalidQuantity = !Number.isInteger(quantity) || quantity <= 0;
  const hasInvalidParams = !Number.isFinite(param1) || !Number.isFinite(param2) || param1 <= 0 || param2 <= 0;

  if (hasUnknownReference || hasInvalidQuantity || hasInvalidParams) {
    return INVALID_RESULT;
  }

  const baseConsumptionPerUnit = param1 * param2 * coefficient;
  const totalNetConsumption = baseConsumptionPerUnit * quantity;
  const totalConsumptionWithDefect = totalNetConsumption * (1 + defectPercent / 100);

  return Math.ceil(totalConsumptionWithDefect);
}

module.exports = { calculateMaterialConsumption, INVALID_RESULT };
