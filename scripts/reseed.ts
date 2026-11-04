/*
 * Development-only: wipes every application table and rebuilds the deterministic dataset.
 *
 *   node --env-file=.env --import tsx scripts/reseed.ts
 *
 * Refused when NODE_ENV=production unless ALLOW_DEV_RESET=true (use only on a disposable database).
 */
import { resetAndSeedDevelopmentData } from "../src/lib/seed";

resetAndSeedDevelopmentData()
  .then((summary) => {
    console.log("Development dataset rebuilt:", JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
