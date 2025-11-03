# ts-to-schema

A simple utility to generate JSON schema from TypeScript types, primarily for use with `tsdown` build hooks.

## Features

- Generates JSON Schema from TypeScript interfaces.
- Integrates with `tsdown`'s build process.

## Installation

```bash
bun add -d ts-to-schema
```

## Usage

This package is intended to be used as a `tsdown` plugin.

1.  **Configure `tsdown.config.ts`:**

    Create or update your `tsdown.config.ts` to use the `schemaGenerator` hook.

    ```typescript
    import { defineConfig } from 'tsdown';
    import { schemaGenerator } from 'ts-to-schema';

    export default defineConfig({
        entry: ['src/index.ts'],
        // ... other options
        plugins: [
            schemaGenerator({
                path: 'public/config-schema.json',
                name: 'MyConfigSchema',
                target: 'jsonSchema7'
            })
        ]
    });
    ```

2.  **Define your types:**

    Create a file with the types you want to convert to a schema (e.g., `src/types.ts`).

    ```typescript
    export interface MyConfig {
        /**
         * The source directory for your dotfiles.
         * @format uri
         */
        dotfilesDir: string;
        files: { source: string; target: string }[];
        editor?: 'code' | 'vim' | 'sublime';
    }
    ```

3.  **Run the build:**

    When you run your build command, the schema will be generated automatically.

    ```bash
    bun run build
    ```

This will generate a `config-schema.json` file in your `public` directory.