import { McpServer } from '/Users/mic/workspace/deepseek-harness/node_modules/.pnpm/@modelcontextprotocol+sdk@1.29.0_zod@4.4.3/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js'
import { StdioServerTransport } from '/Users/mic/workspace/deepseek-harness/node_modules/.pnpm/@modelcontextprotocol+sdk@1.29.0_zod@4.4.3/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js'
import { z } from '/Users/mic/workspace/deepseek-harness/node_modules/.pnpm/zod@4.4.3/node_modules/zod/index.js'

const server = new McpServer({ name: 'mini', version: '1.0.0' })
server.registerTool('echo', { description: 'Echo text.', inputSchema: { text: z.string() } },
  async ({ text }) => ({ content: [{ type: 'text', text: 'echo: ' + text }] }))
server.registerResource('notes', 'notes://weekly', { description: 'Weekly notes', mimeType: 'text/markdown' },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: '# Notes' + String.fromCharCode(10) + '- fleet reconciler works' }] }))
server.registerPrompt('review', { description: 'Review', argsSchema: { topic: z.string() } },
  ({ topic }) => ({ messages: [{ role: 'user', content: { type: 'text', text: 'Review ' + topic } }] }))
await server.connect(new StdioServerTransport())
