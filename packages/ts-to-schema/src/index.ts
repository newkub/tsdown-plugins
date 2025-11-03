import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import type { Plugin } from "rolldown";

/**
 * JSON Schema definition
 */
interface JSONSchema {
	type?: string | string[];
	properties?: Record<string, JSONSchema>;
	required?: string[];
	items?: JSONSchema;
	anyOf?: JSONSchema[];
	allOf?: JSONSchema[];
	enum?: unknown[];
	const?: unknown;
	$schema?: string;
	description?: string;
}

/**
 * Options for generating JSON Schema from TypeScript types
 */
export interface GenerateSchemaOptions {
	/**
	 * The name of the type to generate schema for (also used as filename)
	 */
	name: string;
	/**
	 * The input TypeScript file path containing the type definition
	 */
	input: string;
	/**
	 * The output directory for the generated schema file
	 */
	outputDir: string;
}

/**
 * Create TypeScript program from file path
 */
function createProgram(filePath: string): ts.Program {
	return ts.createProgram([filePath], {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		skipLibCheck: true,
	});
}

/**
 * Find type declaration in source file
 */
function findTypeDeclaration(
	sourceFile: ts.SourceFile,
	typeName: string,
	checker: ts.TypeChecker,
): ts.Type {
	let targetType: ts.Type | undefined;

	ts.forEachChild(sourceFile, (node: ts.Node) => {
		if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
			if (node.name.text === typeName) {
				const symbol = checker.getSymbolAtLocation(node.name);
				if (symbol) {
					targetType = checker.getDeclaredTypeOfSymbol(symbol);
				}
			}
		}
	});

	if (!targetType) {
		throw new Error(`Type "${typeName}" not found in source file`);
	}

	return targetType;
}

/**
 * Extract JSDoc description from symbol
 */
function getSymbolDescription(symbol: ts.Symbol): string | undefined {
	const documentation = symbol.getDocumentationComment(undefined);
	if (documentation.length > 0) {
		return documentation.map((part) => part.text).join("");
	}
	return undefined;
}

/**
 * Convert TypeScript type properties to JSON Schema properties
 */
function typePropertiesToSchema(
	type: ts.Type,
	checker: ts.TypeChecker,
	sourceFile: ts.SourceFile,
): { properties: Record<string, JSONSchema>; required: string[] } {
	const properties: Record<string, JSONSchema> = {};
	const required: string[] = [];

	for (const prop of type.getProperties()) {
		const propType = checker.getTypeOfSymbolAtLocation(prop, sourceFile);
		const propName = prop.getName();
		const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
		const description = getSymbolDescription(prop);

		const schema = getTypeSchema(propType, checker);
		if (description) {
			schema.description = description;
		}

		properties[propName] = schema;

		if (!isOptional) {
			required.push(propName);
		}
	}

	return { properties, required };
}

/**
 * Create JSON Schema from TypeScript type
 */
function createSchemaFromType(filePath: string, typeName: string): JSONSchema {
	const program = createProgram(filePath);
	const sourceFile = program.getSourceFile(filePath);

	if (!sourceFile) {
		throw new Error(`Source file not found: "${filePath}"`);
	}

	const checker = program.getTypeChecker();
	const targetType = findTypeDeclaration(sourceFile, typeName, checker);
	const { properties, required } = typePropertiesToSchema(
		targetType,
		checker,
		sourceFile,
	);

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		type: "object",
		properties,
		...(required.length > 0 && { required }),
	};
}

/**
 * Convert TypeScript type to JSON Schema
 */
function getTypeSchema(type: ts.Type, checker: ts.TypeChecker): JSONSchema {
	// String type
	if (type.flags & ts.TypeFlags.String) {
		return { type: "string" };
	}

	// String literal type
	if (type.flags & ts.TypeFlags.StringLiteral) {
		const literalType = type as ts.StringLiteralType;
		return { type: "string", const: literalType.value };
	}

	// Number type
	if (type.flags & ts.TypeFlags.Number) {
		return { type: "number" };
	}

	// Number literal type
	if (type.flags & ts.TypeFlags.NumberLiteral) {
		const literalType = type as ts.NumberLiteralType;
		return { type: "number", const: literalType.value };
	}

	// Boolean type
	if (type.flags & ts.TypeFlags.Boolean) {
		return { type: "boolean" };
	}

	// Boolean literal type
	if (type.flags & ts.TypeFlags.BooleanLiteral) {
		const value = (type as unknown as { intrinsicName?: string }).intrinsicName === "true";
		return { type: "boolean", const: value };
	}

	// Null type
	if (type.flags & ts.TypeFlags.Null) {
		return { type: "null" };
	}

	// Undefined type
	if (type.flags & ts.TypeFlags.Undefined) {
		return { type: "null" };
	}

	// Union type
	if (type.isUnion()) {
		const types = type.types.map((t: ts.Type) => getTypeSchema(t, checker));
		// Filter out undefined/null for optional handling
		const nonNullTypes = types.filter((t) => t.type !== "null");
		if (nonNullTypes.length === 1) {
			return nonNullTypes[0];
		}
		return { anyOf: types };
	}

	// Intersection type
	if (type.isIntersection?.()) {
		return {
			allOf: type.types.map((t: ts.Type) => getTypeSchema(t, checker)),
		};
	}

	// Object type (including arrays)
	if (type.flags & ts.TypeFlags.Object) {
		const objectType = type as ts.ObjectType;

		// Array type
		if (checker.isArrayType(objectType)) {
			const typeArgs = checker.getTypeArguments(objectType as ts.TypeReference);
			return {
				type: "array",
				items: typeArgs.length > 0 ? getTypeSchema(typeArgs[0], checker) : {},
			};
		}

		// Tuple type
		if ((objectType.objectFlags & ts.ObjectFlags.Tuple) !== 0) {
			const typeArgs = checker.getTypeArguments(objectType as ts.TypeReference);
			return {
				type: "array",
				items: typeArgs.map((t) => getTypeSchema(t, checker)),
			};
		}

		return { type: "object" };
	}

	// Any/Unknown type
	if (
		type.flags & ts.TypeFlags.Any ||
		type.flags & ts.TypeFlags.Unknown
	) {
		return {};
	}

	// Default fallback
	return {};
}

/**
 * Ensure directory exists, create if not
 */
function ensureDirectoryExists(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

/**
 * Generate JSON Schema from TypeScript type and write to file
 * @throws Error if schema generation or file writing fails
 */
export function generateAndWriteSchema(
	options: GenerateSchemaOptions,
): { schemaPath: string; schema: JSONSchema } {
	const { name, input, outputDir } = options;

	const inputPath = resolve(process.cwd(), input);
	if (!existsSync(inputPath)) {
		throw new Error(`Input file not found: "${inputPath}"`);
	}

	const schema = createSchemaFromType(inputPath, name);
	const outputPath = resolve(process.cwd(), outputDir, `${name}.json`);
	const dir = dirname(outputPath);

	ensureDirectoryExists(dir);
	writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf-8");

	return { schemaPath: outputPath, schema };
}

/**
 * Plugin options for tsToSchemaPlugin
 */
export interface TsToSchemaPluginOptions {
	/**
	 * Array of schema generation configurations
	 */
	schemas: GenerateSchemaOptions[];
	/**
	 * Enable verbose logging
	 * @default false
	 */
	verbose?: boolean;
}

/**
 * Rolldown/Tsdown plugin to generate JSON Schema from TypeScript types
 * @example
 * ```ts
 * import { tsToSchemaPlugin } from 'ts-to-schema'
 *
 * export default defineConfig({
 *   plugins: [
 *     tsToSchemaPlugin({
 *       schemas: [{
 *         name: 'MyConfig',
 *         input: 'src/types.ts',
 *         outputDir: 'schemas'
 *       }]
 *     })
 *   ]
 * })
 * ```
 */
export function tsToSchemaPlugin(options: TsToSchemaPluginOptions): Plugin {
	const { schemas, verbose = false } = options;

	return {
		name: "ts-to-schema",
		buildStart() {
			for (const schema of schemas) {
				try {
					if (verbose) {
						console.log(
							`🔍 Generating schema for type: ${schema.name} from ${schema.input}`,
						);
					}

					const { schemaPath } = generateAndWriteSchema(schema);

					if (verbose) {
						console.log(`✅ Generated schema at: ${schemaPath}`);
					}
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error(
						`❌ Failed to generate schema for "${schema.name}": ${message}`,
					);
					throw error;
				}
			}
		},
	};
}
