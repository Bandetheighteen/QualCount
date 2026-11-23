#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveWorkspacePath, McpWorkspaceStorage } from './storageAdapter';
import { createPartnershipMcpServer } from './server';

export { McpWorkspaceStorage, resolveWorkspacePath } from './storageAdapter';
export { createPartnershipMcpServer } from './server';

async function runCli() {
  const workspacePath = resolveWorkspacePath();
  const storage = new McpWorkspaceStorage(workspacePath);
  await storage.ensureWorkspaceInitialized();

  const server = createPartnershipMcpServer(storage);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(`[QualCount MCP] Partnership Ledger Server running on stdio for workspace: ${workspacePath}`);
}

// Auto-run if executed as CLI entry point
const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.js') ||
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].includes('partnership-ledger-mcp') ||
  process.argv[1].includes('QualCount')
);

if (isMain) {
  runCli().catch((err) => {
    console.error('[QualCount MCP] Fatal server error:', err);
    process.exit(1);
  });
}
