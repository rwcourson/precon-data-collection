/**
 * Rebuilds only the sheet tree from the Smartsheet export, leaving pursuit
 * records alone. Reclassifying a sheet or widening a filter is a sheet-tree
 * change, and a full re-import to see it costs minutes and rolls the demo
 * personas' ids.
 */
import path from "path";
import { seedSheetsFromExport } from "./seed-sheets";

async function main() {
  const dir = path.join(process.cwd(), "data/smartsheet/json");
  const tree = await seedSheetsFromExport(dir);
  console.log(
    `Workspace rebuilt: ${tree.views} pursuit views + ${tree.grids} standalone sheets (${tree.rows.toLocaleString()} rows).`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
