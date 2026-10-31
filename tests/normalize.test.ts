import { describe, expect, it } from 'vitest';
import { normalizeText } from '@decisionvault/shared/normalize';

describe('normalizeText', () => {
  it('handles empty or blank string', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText('   ')).toBe('');
  });

  it('normalizes Unicode via NFKC and converts to lowercase', () => {
    // ligature "ﬁ" (U+FB01) decomposes to "fi" in NFKC
    const input = 'Deﬁne NEW API';
    expect(normalizeText(input)).toBe('define new api');
  });

  it('converts curly single and double quotes to straight quotes', () => {
    const input = '“Smart quotes” and ‘single quotes’ with „low quotes“';
    expect(normalizeText(input)).toBe('"smart quotes" and \'single quotes\' with "low quotes"');
  });

  it('strips markdown emphasis (asterisks and underscores)', () => {
    expect(normalizeText('This is *italic* and **bold** and ***both*** text')).toBe(
      'this is italic and bold and both text',
    );
    expect(normalizeText('This is _italic_ and __bold__ text')).toBe(
      'this is italic and bold text',
    );
  });

  it('preserves intra-word underscores in snake_case identifiers', () => {
    expect(normalizeText('The variable `user_id_ref` or function_name_here')).toBe(
      'the variable user_id_ref or function_name_here',
    );
  });

  it('strips backticks and strikethroughs', () => {
    expect(normalizeText('Run `git clone` or ~~deprecated method~~ now')).toBe(
      'run git clone or deprecated method now',
    );
  });

  it('strips markdown links and reference links while retaining link text', () => {
    expect(
      normalizeText('Check out [Python Discussion](https://discuss.python.org/t/123) for details'),
    ).toBe('check out python discussion for details');

    expect(normalizeText('See [PEP 594][ref1] document')).toBe('see pep 594 document');
  });

  it('collapses multiple whitespace characters and trims boundaries', () => {
    const input = '  \t\n  lots   of   scattered   \n\n  spaces   \t ';
    expect(normalizeText(input)).toBe('lots of scattered spaces');
  });

  it('combines all transformations cleanly', () => {
    const input =
      '  “We should *NOT* use `sys.version_info` here!” — see [Discussion #42](https://github.com/org/repo/issues/42).  ';
    expect(normalizeText(input)).toBe(
      '"we should not use sys.version_info here!" — see discussion #42.',
    );
  });
});
