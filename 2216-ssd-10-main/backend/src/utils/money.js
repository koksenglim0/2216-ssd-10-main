const Decimal = require('decimal.js');

function toDecimal(value) {
  return new Decimal(value || 0);
}

function formatMoney(value) {
  return toDecimal(value).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed(8);
}

function calculateFee(amount, feePercent) {
  return toDecimal(amount).mul(feePercent).div(100).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
}

function calculateConversion(amount, feePercent, rate) {
  const sourceAmount = toDecimal(amount);
  const feeAmount = calculateFee(sourceAmount, feePercent);
  const netSourceAmount = sourceAmount.minus(feeAmount);
  const targetAmount = netSourceAmount.mul(rate).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);

  return {
    sourceAmount: formatMoney(sourceAmount),
    feeAmount: formatMoney(feeAmount),
    netSourceAmount: formatMoney(netSourceAmount),
    targetAmount: formatMoney(targetAmount),
    rate: String(rate)
  };
}

module.exports = { formatMoney, calculateConversion };
