import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
    'src/env-classification.ts',
    'src/scanner.ts',
    'src/registry.ts',
    'src/graph.ts',
    'src/bundle-scan.ts',
    'src/reporter.ts',
    'src/worker.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  deps: {
    neverBundle: ['vite', '@jridgewell/trace-mapping'],
  },
  outExtensions({ format }) {
    if (format === 'es') return { js: '.js', dts: '.d.ts' }
    if (format === 'cjs') return { js: '.cjs', dts: '.d.ts' }
    return { js: '.js', dts: '.d.ts' }
  },
})
