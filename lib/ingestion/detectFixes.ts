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
