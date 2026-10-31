/**
 * DecisionVault Text Normalization
 * Matches Architecture v3 Section 7:
 * 1. Unicode NFKC normalization
 * 2. Lowercase
 * 3. Convert curly quotes to straight quotes
 * 4. Strip Markdown emphasis, backticks and link syntax markers
 * 5. Collapse all whitespace to single spaces
 * 6. Trim
 */
export function normalizeText(input: string): string {
  if (!input) {
    return '';
  }

  // 1. Unicode NFKC normalization
  let text = input.normalize('NFKC');

  // Strip non-printable control characters (ASCII 0x00-0x1F except \t, \n, \r, and 0x7F)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 2. Lowercase
  text = text.toLowerCase();

  // 3. Convert curly quotes to straight quotes
  text = text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // 4. Strip Markdown syntax markers
  // Images: ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Reference links: [text][ref] -> text
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // Strikethrough: ~~text~~ -> text
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Code backticks: remove backticks
  text = text.replace(/`+/g, '');

  // Bold and italic with asterisks (***text***, **text**, *text*)
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');

  // Bold and italic with underscores (_text_, __text__, ___text___)
  // Ensure we match markdown delimiter boundaries without breaking intra-word snake_case
  text = text.replace(
    /(^|[\s,.;:!?()[\]{}<>"'])_{1,3}([^_]+)_{1,3}(?=[\s,.;:!?()[\]{}<>"']|$)/g,
    '$1$2',
  );

  // 5. Collapse all whitespace to single spaces
  text = text.replace(/\s+/g, ' ');

  // 6. Trim
  return text.trim();
}
