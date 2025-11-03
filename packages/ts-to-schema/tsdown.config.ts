import { defineConfig } from 'tsdown';
import { generateAndWriteSchema } from './src';

export default defineConfig({
    exports: true,
    dts: true,
    entry: ['src/index.ts'],
    hooks(hooks) {
        hooks.hook('build:prepare', () => {
            generateAndWriteSchema({
                name: 'DotfilesConfig',
                input: 'src/examples.ts',
                outputDir: 'public',
            });
        });
    },
});