'use strict';

function toViettelWeightGrams(value) {
 if (typeof value !== 'number' && typeof value !== 'string') throw new TypeError('Số ký phải là số lớn hơn 0');
 const kg = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : value;
 if (!Number.isFinite(kg) || kg <= 0 || !Number.isSafeInteger(Math.round(kg * 1000))) throw new RangeError('Số ký phải là số hợp lệ lớn hơn 0');
 const grams = Math.round(kg * 1000);
 if (grams <= 3000) return 1000;
 if (grams <= 4000) return 2000;
 if (grams <= 6000) return 3000;
 if (grams <= 7000) return 4000;
 if (grams <= 8000) return 5000;
 if (grams <= 9000) return 6000;
 if (grams <= 10000) return 7000;
 if (grams <= 11000) return 8000;
 if (grams <= 13000) return 9000;
 if (grams <= 14000) return 10000;
 return grams - 5000;
}

module.exports = { toViettelWeightGrams };
