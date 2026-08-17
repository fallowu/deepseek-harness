import { defineConfig } from 'tsdown'

/** Build the fleet root and invariant companion as independent bundles. */
export default defineConfig([
  {
    name: 'dsh-mcp-servers/index',
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    // The fleet artifact inlines the single-server plugin, so it carries no
    // dependency on dsh-mcp-client being Node-resolvable at load time.
    noExternal: [/@deepseek-ai\/dsh-mcp-client/],
  },
  {
    name: 'dsh-mcp-servers/invariant',
    entry: ['lib/types/invariant.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
