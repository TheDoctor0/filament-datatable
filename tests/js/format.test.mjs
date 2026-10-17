import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatInteger } from '../../resources/js/datagrid.js';

test('formatNumber matches toLocaleString after rounding to 2 decimals', () => {
    for (const locale of ['pl-PL', 'en-US', 'de-DE']) {
        for (const value of [0, 1, 999, -999, 1000, 16050, 1234.567, 19.8, -0.004, '2497', '12', null, 'abc']) {
            const rounded = Math.round((Number(value) || 0) * 100) / 100 || 0; // -0 shows as "0"
            assert.equal(formatNumber(value, locale), rounded.toLocaleString(locale));
        }
    }
});

test('formatInteger matches toLocaleString of the rounded value', () => {
    assert.equal(formatInteger(1234.6, 'pl-PL'), (1235).toLocaleString('pl-PL'));
    assert.equal(formatInteger('16050', 'en-US'), '16,050');
});

test('small integers skip the formatter only for ASCII-digit locales', () => {
    assert.equal(formatNumber('42', 'pl-PL'), '42');
    assert.equal(formatNumber(42, 'ar-EG'), (42).toLocaleString('ar-EG'));
});
