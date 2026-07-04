/**
 * Represents a Git commit in the repository.
 */
export interface Commit {
  /** 
   * The unique SHA-1 hash identifier of the commit. 
   */
  hash: string;
  
  /** 
   * The commit message describing the changes made. 
   */
  message: string;
  
  /** 
   * The name or email of the person who authored the commit. 
   */
  author: string;
  
  /** 
   * The time the commit was made, represented as an ISO 8601 string or Unix timestamp. 
   */
  timestamp: string | number;

  /**
   * The list of files that were modified, added, or deleted in this commit.
   */
  files?: FileEntity[];

  /**
   * The list of functions that were touched in this commit.
   */
  functions?: FunctionEntity[];
}

/**
 * Represents a file within the codebase.
 */
export interface FileEntity {
  /** 
   * The relative path of the file from the root of the repository. 
   */
  path: string;
}

/**
 * Represents a function defined within a codebase file.
 */
export interface FunctionEntity {
  /** 
   * The name of the function. 
   */
  name: string;
  
  /** 
   * The path of the file where this function is defined, or a reference to the FileEntity itself. 
   */
  file: string | FileEntity;

  /**
   * The hash of the commit that touched this function.
   */
  commitHash?: string;
}

/**
 * Represents a software bug or issue discovered in the system.
 */
export interface Bug {
  /** 
   * A human-readable description explaining the bug and its impact. 
   */
  description: string;
  
  /** 
   * The stack trace, log snippet, or unique signature identifying the error. 
   */
  errorSignature: string;
}

/**
 * Represents a fix implemented to resolve a specific bug.
 */
export interface Fix {
  /** 
   * The hash of the commit that implements this fix. 
   */
  commitHash: string;
  
  /** 
   * An identifier or reference to the Bug that this fix resolves. 
   */
  resolvesBug: string | Bug;
  
  /** 
   * Indicates whether the fix is currently on hold, blocked, or pending further action. 
   */
  held: boolean;
}
