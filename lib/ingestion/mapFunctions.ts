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
 * Parses the file content and maps the provided line ranges to the enclosing function names.
 * Best effort extraction of function names.
 *
 * @param filePath The path of the file (used for extension checking)
 * @param lineRanges Array of line ranges that were changed
 * @param fileContent The string content of the file
 * @returns Array of function names that contain the changes
 */
export function mapLinesToFunctions(filePath: string, lineRanges: LineRange[], fileContent: string): string[] {
  // Only attempt to parse JS/TS/JSX/TSX files
  if (!/\.(js|jsx|ts|tsx)$/.test(filePath)) {
    return [];
  }

  if (lineRanges.length === 0 || !fileContent) {
    return [];
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

            // Function declaration (e.g. function foo() {})
            if (node.type === 'FunctionDeclaration' && node.id) {
              name = node.id.name;
            } 
            // Method (e.g. class { foo() {} } or { foo() {} })
            else if ((node.type === 'ClassMethod' || node.type === 'ObjectMethod') && node.key) {
              if (node.key.type === 'Identifier') {
                name = node.key.name;
              }
            }
            // Function assigned to variable (e.g. const foo = () => {})
            else if (path.parent.type === 'VariableDeclarator' && path.parent.id.type === 'Identifier') {
              name = path.parent.id.name;
            }
            // Object property assigned to function (e.g. { foo: () => {} })
            else if (path.parent.type === 'ObjectProperty' && path.parent.key.type === 'Identifier') {
              name = path.parent.key.name;
            }
            
            matchedFunctions.add(name);
          }
        }
      }
    });

    return Array.from(matchedFunctions);
  } catch (error) {
    // If parsing fails (unsupported syntax or malformed code), just return empty array
    console.warn(`[mapFunctions] Failed to parse AST for ${filePath}. Skipping function mapping.`);
    return [];
  }
}
