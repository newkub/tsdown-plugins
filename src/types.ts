import type { Plugin } from 'tsdown';

/**
 * Config file ที่ต้องการ export
 */
export interface ConfigFile {
  /** เส้นทางไฟล์ที่เกี่ยวข้องกับ src directory */
  path: string;
  /** ชื่อที่ใช้สำหรับการ export */
  exportName: string;
}

/**
 * Options สำหรับการกำหนดค่าไฟล์ที่ต้องการ export
 */
export interface ExportConfigFilesOptions {
  /** รายการไฟล์ที่ต้องการ export */
  configFiles?: ConfigFile[];
  /** ไดเร็กทอรีต้นทางสำหรับหาไฟล์ */
  srcDir?: string;
}

/**
 * Plugin ที่จะ generate exports สำหรับไฟล์ config ต่างๆ ใน package
 * โดยจะเพิ่มไฟล์เหล่านี้เข้าไปใน bundle เมื่อ build
 */
export function exportConfigFiles(options?: ExportConfigFilesOptions): Plugin {
  return {
    name: 'export-config-files',
    generateBundle(options, bundle) {
      const srcDir = options?.srcDir || join(process.cwd(), 'src');

      // ใช้ configFiles ที่กำหนดหรือใช้ default
      const configFiles = options?.configFiles || [
        { path: 'biome.jsonc', exportName: './biome.jsonc' },
        { path: 'dprint.json', exportName: './dprint.json' },
        { path: 'eslint.config.mjs', exportName: './eslint.config.mjs' },
        { path: 'knip.json', exportName: './knip.json' },
        { path: 'lefthook.yml', exportName: './lefthook.yml' },
        { path: '.oxlintrc.json', exportName: './oxlintrc.json' },
        { path: 'node-modules-inspector.config.ts', exportName: './node-modules-inspector.config.ts' },
        { path: 'railway.json', exportName: './railway.json' },
        { path: '.release-it.json', exportName: './release-it.json' },
        { path: 'taze.config.ts', exportName: './taze.config.ts' },
        { path: 'tsconfig.json', exportName: './tsconfig.json' },
        { path: 'tsconfig.client.json', exportName: './tsconfig.client.json' },
        { path: 'tsdown.config.ts', exportName: './tsdown.config.ts' },
        { path: 'turbo.json', exportName: './turbo.json' },
        { path: 'uno.config.ts', exportName: './uno.config.ts' },
        { path: 'vite.config.ts', exportName: './vite.config.ts' },
        { path: 'vitest.config.ts', exportName: './vitest.config.ts' },
        { path: 'presetWrikka/index.ts', exportName: './wrikka-uno-preset.ts' }
      ];

      // สำหรับไฟล์แต่ละไฟล์ ให้อ่านเนื้อหาและเพิ่มเข้าไปใน bundle
      configFiles.forEach(({ path, exportName }) => {
        try {
          const fullPath = join(srcDir, path);

          // อ่านเนื้อหาไฟล์
          let source: string;
          try {
            source = readFileSync(fullPath, 'utf-8');
          } catch (error) {
            // ถ้าอ่านไฟล์ไม่สำเร็จ ข้ามไป
            return;
          }

          // กำหนด fileName สำหรับ bundle
          const fileName = exportName.replace('./', '');

          // เพิ่มไฟล์เข้าไปใน bundle โดยใช้ this.emitFile
          this.emitFile({
            type: 'asset',
            fileName,
            source
          });

          // สร้าง virtual module สำหรับการ import
          // โดยใช้ \0 prefix เพื่อป้องกันไม่ให้ plugin อื่นพยายาม process
          const virtualModuleId = `\0${exportName}`;

          // เพิ่ม virtual module เข้าไปใน bundle
          bundle[virtualModuleId] = {
            type: 'chunk',
            fileName: `${fileName}.js`,
            code: `export { default as config } from '${virtualModuleId.slice(1)}';
export * from '${virtualModuleId.slice(1)}';`,
            modules: {},
            name: fileName.replace(/\./g, '_'),
            imports: [],
            exports: ['config'],
            dynamicImports: [],
            facadeModuleId: virtualModuleId,
            isDynamicEntry: false,
            isEntry: false,
            isImplicitEntry: false,
            map: null,
            sourcemapFileName: null,
            preliminaryFileName: `${fileName}.js`,
            referencedFiles: [],
            implicitlyLoadedBefore: [],
            importedBindings: {},
            moduleIds: []
          } as any;

        } catch (error) {
          console.warn(`Warning: Could not process config file ${path}:`, error);
        }
      });
    }
  };
}
