/**
 * Determines whether a commit message likely represents a bug fix.
 * Uses a fast, simple regex heuristic checking for common fix-related keywords.
 * 
 * @param commitMessage The raw commit message string.
 * @returns true if it matches fix keywords, false otherwise.
 */
export function isFixCommit(commitMessage: string): boolean {
  if (!commitMessage) return false;
  
  // Use word boundaries (\b) to avoid matching substrings like "prefix" or "buggy" 
  // (though "buggy" might be okay, we'll stick to clear root words).
  const fixRegex = /\b(fix|fixed|fixes|bug|resolve|resolved|resolves|patch|hotfix)\b/i;
  
  return fixRegex.test(commitMessage);
}

/**
 * Performs lightweight cleanup on a fix commit message to convert it into a 
 * human-readable bug description.
 * - Extracts the subject (first line)
 * - Strips conventional commit prefixes like "fix:" or "hotfix(ui):"
 * - Trims whitespace and capitalizes the first letter
 * 
 * @param commitMessage The raw commit message string.
 * @returns A clean, readable bug description.
 */
export function extractBugDescription(commitMessage: string): string {
  if (!commitMessage) return 'Unknown issue';

  // Get the subject line (first line of the commit message)
  let subject = commitMessage.split('\n')[0].trim();

  // Strip conventional prefixes like "fix:", "fix(ui):", "bug:", etc.
  // This regex matches an optional keyword, optional scope in parens, followed by a colon and space
  const prefixRegex = /^(?:fix|bug|hotfix|patch|resolve)(?:\([^)]+\))?:\s*/i;
  subject = subject.replace(prefixRegex, '');

  // Clean up any remaining leading/trailing whitespace
  subject = subject.trim();

  // Capitalize the first letter if it exists
  if (subject.length > 0) {
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  } else {
    return 'Unknown issue';
  }

  return subject;
}
