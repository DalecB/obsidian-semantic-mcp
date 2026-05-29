#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const DEFAULT_HOME = path.join(os.homedir(), '.obsidian-semantic-mcp');

async function main() {
  const args = new Set(process.argv.slice(2));
  const nonInteractive = args.has('--print') || args.has('--dry-run');
  const rl = readline.createInterface({ input, output });
  try {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    if (nodeMajor < 24) {
      fail(`Node.js >= 24 is required. Current: ${process.version}`);
    }

    const vaultRoot = nonInteractive
      ? process.env.OBSIDIAN_VAULT_ROOT || ''
      : await ask(rl, 'Obsidian vault path', process.env.OBSIDIAN_VAULT_ROOT || '');
    if (!vaultRoot) fail('Vault path is required.');
    if (!fs.existsSync(vaultRoot) || !fs.statSync(vaultRoot).isDirectory()) {
      fail(`Vault path does not exist or is not a directory: ${vaultRoot}`);
    }

    const appHome = process.env.OBSIDIAN_SEMANTIC_MCP_HOME || DEFAULT_HOME;
    const packageCmd = 'npx';
    const packageArgs = ['-y', '@dalecb/obsidian-semantic-mcp'];

    const ollamaOk = await checkOllama();
    const codexToml = renderCodexToml({ packageCmd, packageArgs, vaultRoot, appHome });
    const jsonConfig = renderJsonConfig({ packageCmd, packageArgs, vaultRoot, appHome });

    console.log('\nSetup check');
    console.log(`- Node: ${process.version}`);
    console.log(`- Vault: ${vaultRoot}`);
    console.log(`- Index home: ${appHome}`);
    console.log(`- Ollama API: ${ollamaOk ? 'reachable' : 'not reachable'}`);
    if (!ollamaOk) {
      console.log('\nInstall/start Ollama and pull the embedding model:');
      console.log('  ollama pull bge-m3');
    }

    console.log('\nCodex config.toml snippet');
    console.log(codexToml);

    console.log('\nClaude Desktop / JSON-style MCP config snippet');
    console.log(JSON.stringify(jsonConfig, null, 2));

    console.log('\nAfter adding the config, restart your MCP client and run:');
    console.log('  index_status');
    console.log('  index_vault { "mode": "incremental" }');
  } finally {
    rl.close();
  }
}

async function ask(rl, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function checkOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function renderCodexToml({ packageCmd, packageArgs, vaultRoot, appHome }) {
  const args = packageArgs.map((arg) => JSON.stringify(arg)).join(', ');
  return `[mcp_servers.obsidian_semantic]
command = ${JSON.stringify(packageCmd)}
args = [${args}]

[mcp_servers.obsidian_semantic.env]
OBSIDIAN_VAULT_ROOT = ${JSON.stringify(vaultRoot)}
OBSIDIAN_SEMANTIC_MCP_HOME = ${JSON.stringify(appHome)}
OBSIDIAN_EMBED_MODEL = "bge-m3"
OBSIDIAN_SEMANTIC_STARTUP_INDEX = "false"`;
}

function renderJsonConfig({ packageCmd, packageArgs, vaultRoot, appHome }) {
  return {
    mcpServers: {
      obsidian_semantic: {
        command: packageCmd,
        args: packageArgs,
        env: {
          OBSIDIAN_VAULT_ROOT: vaultRoot,
          OBSIDIAN_SEMANTIC_MCP_HOME: appHome,
          OBSIDIAN_EMBED_MODEL: 'bge-m3',
          OBSIDIAN_SEMANTIC_STARTUP_INDEX: 'false',
        },
      },
    },
  };
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
