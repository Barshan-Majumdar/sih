import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Sweeps leftover "E2E ..." fixtures from previous aborted runs (a test that
 * fails mid-flow never reaches its own cleanup step). Deleting the tasks
 * cascades their commitments/updates.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    const { count } = await prisma.task.deleteMany({ where: { name: { startsWith: "E2E " } } });
    if (count > 0) console.log(`[e2e setup] removed ${count} leftover E2E task(s) from a previous run`);
  } finally {
    await prisma.$disconnect();
  }
}
