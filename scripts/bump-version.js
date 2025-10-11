#!/usr/bin/env node

import("./bump-version.cjs").catch((error) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
