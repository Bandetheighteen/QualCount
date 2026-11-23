import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpWorkspaceStorage } from './storageAdapter';
import { registerDiscoveryTools } from './tools/discovery';
import { registerMutationTools } from './tools/mutation';
import { registerUtilityTools } from './tools/utility';
import { registerRiskTools } from './tools/risk';
import { registerSpreadsheetTools } from './tools/spreadsheet';
import { registerResources } from './resources';

/**
 * Creates and binds a complete QualCount Partnership Ledger MCP Server.
 * Registers all 17 Zod-validated tools and 4 URI resources.
 */
export function createPartnershipMcpServer(
  storage: McpWorkspaceStorage,
  serverInfo = { name: 'QualCount-partnership-ledger-mcp', version: '2.0.0' }
): McpServer {
  const server = new McpServer(serverInfo);

  // Register all 17 tools across 5 pillars
  registerDiscoveryTools(server, storage);
  registerMutationTools(server, storage);
  registerUtilityTools(server, storage);
  registerRiskTools(server, storage);
  registerSpreadsheetTools(server, storage);

  // Register all 4 read-only resources
  registerResources(server, storage);

  return server;
}
