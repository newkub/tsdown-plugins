import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createGenerator } from 'ts-json-schema-generator';

export interface GenerateSchemaOptions {
    /**
     * The name of the generated schema file.
     */
    name: string;
    /**
     * The input file path for the schema generation.
     */
    input: string;
    /**
     * The output directory for the generated schema file.
     */
    outputDir: string;
}

export function generateAndWriteSchema(options: GenerateSchemaOptions) {
    try {
        const {
            name,
            input,
            outputDir
        } = options;

        console.log(`🔍 Generating schema for type: ${name} from ${input}`);

        const generator = createGenerator({
            path: resolve(process.cwd(), input),
            type: name,
        });

        const schema = generator.createSchema(name);

        const outputPath = resolve(process.cwd(), outputDir, `${name}.json`);
        const dir = dirname(outputPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        writeFileSync(outputPath, JSON.stringify(schema, null, 2), 'utf-8');
        console.log(`✅ Generated config schema at: ${outputPath}`);
    } catch (error) {
        console.error('❌ Error generating schema:', error);
        process.exit(1);
    }
}
