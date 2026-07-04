import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { LineRange } from './parseHistory';

// Handle interoperability for Babel traverse in different module environments
const traverse = typeof _traverse === 'function' ? _traverse : (_traverse as any).default;

/**
 * Checks if a given AST node's line range overlaps with any of our modified ranges.
 */
function doesOverlap(nodeStart: number, nodeEnd: number, ranges: LineRange[]): boolean {
  return ranges.some(range => {
    // Overlap condition:
    // The start of the node is before or on the end of the range
    // AND the end of the node is after or on the start of the range
    return nodeStart <= range.end && nodeEnd >= range.start;
  });
}

/**
 * Best-effort regex to extract a function or class name from a single line of code.
 * Works decently for Python, Go, Rust, Java, C++, Ruby, etc.
 */
function extractFunctionName(line: string): string | null {
  // Python / Ruby
  let match = line.match(/^\s*(?:def|class)\s+([a-zA-Z_]\w*)/);
  if (match) return match[1];

  // Go
  match = line.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z_]\w*)/);
  if (match) return match[1];

  // Rust
  match = line.match(/^\s*(?:pub\s+)?fn\s+([a-zA-Z_]\w*)/);
  if (match) return match[1];

  // C-like languages (Java, C++, C#, generic fallback)
  // Matches: optional modifiers -> optional return type -> name -> (
  match = line.match(/^\s*(?:(?:public|private|protected|static|export|default|async|virtual|override)\s+)*(?:[\w<>\[\]]+\s+)?([a-zA-Z_]\w*)\s*\(/);
  if (match) {
    const reserved = ['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'super', 'this'];
    if (!reserved.includes(match[1])) {
      return match[1];
    }
  }

  return null;
}

/**
 * A fallback mechanism that iterates through lines, tracking the last seen function name
 * and matching it against the modified line ranges.
 */
function mapLinesToFunctionsRegex(lineRanges: LineRange[], fileContent: string): string[] {
  const lines = fileContent.split('\n');
  const matchedFunctions = new Set<string>();
  let currentFunction: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1; // 1-indexed
    const lineText = lines[i];
    
    const name = extractFunctionName(lineText);
    if (name) {
      currentFunction = name;
    }
    
    const inRange = lineRanges.some(r => lineNum >= r.start && lineNum <= r.end);
    if (inRange && currentFunction) {
      matchedFunctions.add(currentFunction);
    }
  }
  
  return Array.from(matchedFunctions);
}

/**
 * Parses the file content and maps the provided line ranges to the enclosing function names.
 * Best effort extraction of function names.
 *
 * @param filePath The path of the file (used for extension checking)
 * @param lineRanges Array of line ranges that were changed
 * @param fileContent The string content of the file
 * @returns Array of function names that contain the changes
 */
export function mapLinesToFunctions(filePath: string, lineRanges: LineRange[], fileContent: string): string[] {
  if (lineRanges.length === 0 || !fileContent) {
    return [];
  }

  // Use the regex fallback for non-JS/TS files
  if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
    return mapLinesToFunctionsRegex(lineRanges, fileContent);
  }

  try {
    const ast = parse(fileContent, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy'
      ]
    });

    const matchedFunctions = new Set<string>();

    traverse(ast, {
      enter(path: any) {
        const node = path.node;
        if (!node.loc) return;
        
        const isFunction = 
          node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression' ||
          node.type === 'ClassMethod' ||
          node.type === 'ObjectMethod';

        if (isFunction) {
          if (doesOverlap(node.loc.start.line, node.loc.end.line, lineRanges)) {
            let name = 'anonymous';

            if (node.type === 'FunctionDeclaration' && node.id) {
              name = node.id.name;
            } else if ((node.type === 'ClassMethod' || node.type === 'ObjectMethod') && node.key) {
              if (node.key.type === 'Identifier') {
                name = node.key.name;
              }
            } else if (path.parent.type === 'VariableDeclarator' && path.parent.id.type === 'Identifier') {
              name = path.parent.id.name;
            } else if (path.parent.type === 'ObjectProperty' && path.parent.key.type === 'Identifier') {
              name = path.parent.key.name;
            }
            
            matchedFunctions.add(name);
          }
        }
      }
    });

    return Array.from(matchedFunctions);
  } catch (error) {
    console.warn(`[mapFunctions] Failed to parse AST for ${filePath}. Falling back to regex mapping.`);
    return mapLinesToFunctionsRegex(lineRanges, fileContent);
  }
}
