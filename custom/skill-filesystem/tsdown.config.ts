import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'dsh-custom-skill-filesystem',
  entry: ['src/index.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  fixedExtension: false,
  clean: false,
})
