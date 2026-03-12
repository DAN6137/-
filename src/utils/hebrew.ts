/**
 * Reverses Hebrew character blocks in a string while keeping other characters in place.
 * This helps LTR-only players display Hebrew correctly.
 */
export function reverseHebrewInString(text: string): string {
  // Hebrew Unicode range: \u0590-\u05FF
  // We also include common Hebrew punctuation if needed, but usually just the letters.
  const hebrewRegex = /[\u0590-\u05FF]+/g;
  
  return text.replace(hebrewRegex, (match) => {
    return match.split('').reverse().join('');
  });
}

/**
 * Checks if a string contains any Hebrew characters.
 */
export function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}
