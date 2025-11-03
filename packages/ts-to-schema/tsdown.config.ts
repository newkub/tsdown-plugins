import { defineConfig } from "tsdown";
import { tsToSchemaPlugin } from "./src/index";

export default defineConfig({
	exports: true,
	dts: true,
	entry: ["src/index.ts"],
	plugins: [
		tsToSchemaPlugin({
			schemas: [
				{
					name: "DotfilesConfig",
					input: "src/examples.ts",
					outputDir: "public",
				},
			],
		}),
	],
});
