import { closeDatabase } from "@/db";
import { revokeDemoSessionTokens } from "@/lib/demo-token-revocation";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await revokeDemoSessionTokens({ apply });
  process.stdout.write(`Demo-session revocation ${result.mode}: ${result.matched} token(s) matched.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Revocation failed."}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
