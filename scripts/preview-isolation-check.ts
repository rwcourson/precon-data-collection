import { previewDatabaseIsolationIssue } from "../src/lib/preview-isolation";

const issue = previewDatabaseIsolationIssue(process.env);
if (issue) {
  process.stderr.write(
    `release:check preview isolation: ${issue.key} ${issue.reason}\n`
  );
  process.exit(1);
}
process.stdout.write("release:check preview isolation ok\n");
