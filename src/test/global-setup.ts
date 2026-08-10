import { migrateCurrentDatabase } from "@/db/migrations";
import { seedDemoData } from "@/db/seed";

export default async function setup() {
  await migrateCurrentDatabase();
  await seedDemoData();
}
