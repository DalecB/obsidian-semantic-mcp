#!/usr/bin/env node
import { startServer } from '../src/server.mjs';

startServer().catch((error) => {
  console.error(`[obsidian-semantic-mcp] fatal: ${error?.stack || error}`);
  process.exit(1);
});
