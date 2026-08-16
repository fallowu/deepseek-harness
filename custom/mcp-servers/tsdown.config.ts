import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'dsh-custom-mcp-servers',
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  fixedExtension: false,
  clean: false,
  alias: {
    'dsh-custom-mcp-client': resolve('../mcp-client/src/index.ts'),
  },
  noExternal: ['dsh-custom-mcp-client'],
})
