import { describe, it, expect } from 'vitest';
import { mapLinesToFunctions } from '../mapFunctions';
import { LineRange } from '../parseHistory';

describe('mapLinesToFunctions', () => {
  const sampleCode = `import { Something } from 'somewhere';

// This is an import area edit

function firstFunction() {
  const x = 1;
  const y = 2;
  return x + y;
}

const secondFunction = () => {
  let a = 10;
  a++;
  return a;
};

class MyClass {
  thirdFunction() {
    console.log("hello");
  }
}
`;

  it('should map a clean single-function edit', () => {
    const ranges: LineRange[] = [{ start: 6, end: 6 }]; // 'const x = 1;'
    const result = mapLinesToFunctions('test.ts', ranges, sampleCode);
    expect(result).toEqual(['firstFunction']);
  });

  it('should map an edit spanning two functions', () => {
    // Spans from end of firstFunction to start of secondFunction
    const ranges: LineRange[] = [{ start: 9, end: 12 }];
    const result = mapLinesToFunctions('test.ts', ranges, sampleCode);
    expect(result).toContain('firstFunction');
    expect(result).toContain('secondFunction');
    expect(result.length).toBe(2);
  });

  it('should return an empty array for an edit outside any function', () => {
    // Edit in the imports area
    const ranges: LineRange[] = [{ start: 1, end: 2 }];
    const result = mapLinesToFunctions('test.ts', ranges, sampleCode);
    expect(result).toEqual([]);
  });
  
  it('should correctly identify class methods', () => {
    const ranges: LineRange[] = [{ start: 18, end: 19 }];
    const result = mapLinesToFunctions('test.ts', ranges, sampleCode);
    expect(result).toEqual(['thirdFunction']);
  });
  
  it('should fallback to regex for non-JS/TS files', () => {
    const pythonCode = `import os

def my_python_func():
    print("hello")
    return True
`;
    const ranges: LineRange[] = [{ start: 4, end: 5 }];
    const result = mapLinesToFunctions('test.py', ranges, pythonCode);
    expect(result).toEqual(['my_python_func']);
  });
});
