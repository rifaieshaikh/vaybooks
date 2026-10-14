import { describe, expect, it } from 'vitest';
import {
  excludeOption,
  toCategoryOptions,
  toCustomerOptions,
  toLocationOptions,
  toProductOptions,
  withNoneOption,
} from '../pickerOptions';

describe('toProductOptions', () => {
  it('maps name and sku', () => {
    expect(
      toProductOptions([{ id: 'p1', name: 'Widget', sku: 'W-1' }]),
    ).toEqual([{ value: 'p1', label: 'Widget', sublabel: 'W-1' }]);
  });
});

describe('toLocationOptions', () => {
  it('prefers code then type for sublabel', () => {
    expect(
      toLocationOptions([{ id: 'l1', name: 'Main', code: 'MAIN', location_type: 'Warehouse' }]),
    ).toEqual([{ value: 'l1', label: 'Main', sublabel: 'MAIN' }]);
    expect(
      toLocationOptions([{ id: 'l2', name: 'Store', location_type: 'Retail Store' }]),
    ).toEqual([{ value: 'l2', label: 'Store', sublabel: 'Retail Store' }]);
  });
});

describe('toCategoryOptions', () => {
  it('maps name', () => {
    expect(toCategoryOptions([{ id: 'c1', name: 'Apparel' }])).toEqual([
      { value: 'c1', label: 'Apparel' },
    ]);
  });
});

describe('toCustomerOptions', () => {
  it('uses customer_name or name and phone sublabel', () => {
    expect(
      toCustomerOptions([{ id: 'cu1', customer_name: 'Ada', phone_number: '999' }]),
    ).toEqual([{ value: 'cu1', label: 'Ada', sublabel: '999' }]);
  });
});

describe('withNoneOption', () => {
  it('prepends empty value', () => {
    const opts = withNoneOption([{ value: 'a', label: 'A' }]);
    expect(opts[0]).toEqual({ value: '', label: '— None —' });
    expect(opts).toHaveLength(2);
  });
});

describe('excludeOption', () => {
  it('drops matching id', () => {
    const opts = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    expect(excludeOption(opts, 'a')).toEqual([{ value: 'b', label: 'B' }]);
    expect(excludeOption(opts, '')).toEqual(opts);
  });
});
