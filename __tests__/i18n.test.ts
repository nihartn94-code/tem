/**
 * i18n catalog integrity — en/hi must always have identical key trees.
 * A missing key renders the raw key string to users (real defect found in audit).
 */
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';

const flatten = (obj: unknown, prefix = ''): string[] =>
  Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('i18n catalogs', () => {
  it('en and hi have identical key trees', () => {
    const enKeys = new Set(flatten(en));
    const hiKeys = new Set(flatten(hi));
    const missingInEn = [...hiKeys].filter((k) => !enKeys.has(k));
    const missingInHi = [...enKeys].filter((k) => !hiKeys.has(k));
    expect(missingInEn).toEqual([]);
    expect(missingInHi).toEqual([]);
  });

  it('no value is an empty string (placeholder leaks)', () => {
    for (const catalog of [en, hi]) {
      for (const key of flatten(catalog)) {
        const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], catalog);
        expect(`${key}: "${value}"`).toBeTruthy();
        expect(value).not.toBe('');
      }
    }
  });
});
