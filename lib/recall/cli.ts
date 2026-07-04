import * as readline from 'readline';
import { askRootCause } from './queryBuilder';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(promptText: string): Promise<string> {
  return new Promise((resolve) => rl.question(promptText, resolve));
}

async function main() {
  console.log("=== RootCause CLI ===");
  console.log("Ask a question about the codebase's bug history. Type 'exit' to quit.\n");

  while (true) {
    const question = await ask("\n> ");

    if (question.trim().toLowerCase() === "exit") {
      break;
    }

    if (!question.trim()) {
      continue;
    }

    try {
      console.log("\nSearching memory...\n");
      const result = await askRootCause(question, {
        datasetNames: ["demo-auth-bug"],
      });
      
      // Print the main answer
      if (result?.result?.kind === "Text") {
        console.log("Answer:");
        console.log(result.result.data);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  rl.close();
  process.exit(0);
}

main();