import { exportConfigFiles } from '../src/plugins/reexport';

export default {
  plugins: [
    exportConfigFiles({
      srcDir: './src',
      configFiles: [
        { path: 'tsconfig.json', exportName: './tsconfig.json' },
        { path: 'vitest.config.ts', exportName: './vitest.config.ts' }
      ]
    })
  ]
};