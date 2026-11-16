import { afterEach, describe, expect, it } from 'vitest';
import { fmt, plural, setLocale, t } from '../src/i18n';
import { it as italian } from '../src/i18n/locales/it.sample';

afterEach(() => setLocale('en-GB'));

describe('i18n', () => {
  it('returns the English source by default, with variables filled in', () => {
    expect(t('Find musicians')).toBe('Find musicians');
    expect(t('Free on {date}', { date: '14 Mar' })).toBe('Free on 14 Mar');
    expect(plural(1, '{n} musician', '{n} musicians')).toBe('1 musician');
    expect(plural(3, '{n} musician', '{n} musicians')).toBe('3 musicians');
  });

  it('switches language by registering a dictionary and falls back to English', () => {
    setLocale('it-IT', italian);
    expect(t('Find musicians')).toBe('Trova musicisti');
    expect(plural(1, '{n} musician', '{n} musicians')).toBe('1 musicista');
    expect(plural(4, '{n} musician', '{n} musicians')).toBe('4 musicisti');
    expect(t('Something not translated yet')).toBe('Something not translated yet');
  });

  it('formats dates and money for the active locale', () => {
    expect(fmt.date('2027-03-14')).toBe('14 Mar 2027');
    expect(fmt.money(250)).toBe('€250');
    setLocale('it-IT', italian);
    expect(fmt.date('2027-03-14')).toBe('14 mar 2027');
    expect(fmt.money(250).replace(/\s/g, ' ')).toBe('250 €');
  });
});
