import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Import the actual implementation for testing
import { exportConfigFiles as realExportConfigFiles, ConfigFile } from '../src/plugins/reexport';

// Mock fs and path modules
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);
const mockJoin = vi.mocked(join);

const mockExportConfigFiles = vi.mocked(realExportConfigFiles);

describe('exportConfigFiles', () => {
  let mockBundle: any;
  let mockOptions: any;

  beforeEach(() => {
    mockBundle = {};
    mockOptions = {};
    vi.clearAllMocks();

    // Setup mock implementation that can read real files for testing
    mockExportConfigFiles.mockImplementation((options = {}) => {
      return {
        name: 'export-config-files',
        generateBundle: vi.fn().mockImplementation(function(options, bundle) {
          // Use the real implementation but with controlled file system
          const srcDir = options?.srcDir || join(process.cwd(), 'src');

          // Create a mock context that can read test files
          const mockContext = {
            emitFile: vi.fn(),
            ...this
          };

          // Get the real plugin and call its generateBundle with our mock context
          const realPlugin = realExportConfigFiles(options);
          realPlugin.generateBundle.call(mockContext, options, bundle);

          // Copy emitFile calls to our mock for testing
          if (mockContext.emitFile.mock.calls.length > 0) {
            mockContext.emitFile.mock.calls.forEach(call => {
              this.emitFile(call[0]);
            });
          }
        })
      };
    });
  });

  it('should create plugin with correct name', () => {
    const plugin = realExportConfigFiles();

    expect(plugin.name).toBe('export-config-files');
    expect(typeof plugin.generateBundle).toBe('function');
  });

  it('should use default srcDir as join(process.cwd(), "src") when not specified', () => {
    // Mock the join function to capture the call
    mockJoin.mockImplementation((...args) => args.join('/'));

    const plugin = realExportConfigFiles();
    plugin.generateBundle(mockOptions, mockBundle);

    // The plugin should call join with process.cwd() and 'src'
    expect(mockJoin).toHaveBeenCalledWith(process.cwd(), 'src');
  });

  it('should use srcDir specified through options', () => {
    const customSrcDir = '/custom/src';
    // Mock the join function to capture the call
    mockJoin.mockImplementation((...args) => args.join('/'));

    const plugin = realExportConfigFiles({ srcDir: customSrcDir });
    plugin.generateBundle(mockOptions, mockBundle);

    // The plugin should call join with custom srcDir
    expect(mockJoin).toHaveBeenCalledWith(customSrcDir, expect.any(String));
  });

  it('should use default configFiles when configFiles are not specified in options', () => {
    // Set up mocks for some of the default config files that likely exist
    const existingFiles = ['tsconfig.json', 'vitest.config.ts', 'tsdown.config.ts'];

    existingFiles.forEach((file, index) => {
      mockJoin.mockReturnValueOnce(`/src/${file}`);
      mockReadFileSync.mockReturnValueOnce(`{"test": "content${index}"}`);
    });

    // Mock files that don't exist to throw errors
    mockReadFileSync.mockImplementation((path) => {
      const pathStr = String(path);
      if (existingFiles.some(file => pathStr.includes(file))) {
        return `{"test": "content"}`;
      }
      throw new Error('File not found');
    });

    const plugin = realExportConfigFiles();
    plugin.generateBundle(mockOptions, mockBundle);

    // Should call readFileSync for all default config files (18 files total)
    expect(mockReadFileSync).toHaveBeenCalledTimes(18);
  });

  it('should use configFiles specified through options', () => {
    const customConfigFiles = [
      { path: 'custom.json', exportName: './custom.json' }
    ];

    mockJoin.mockReturnValue('/src/custom.json');
    mockReadFileSync.mockReturnValue('{"custom": "content"}');

    const plugin = realExportConfigFiles({ configFiles: customConfigFiles });
    plugin.generateBundle(mockOptions, mockBundle);

    expect(mockReadFileSync).toHaveBeenCalledWith('/src/custom.json', 'utf-8');
  });

  it('should skip files that cannot be read', () => {
    const customConfigFiles = [
      { path: 'existing.json', exportName: './existing.json' },
      { path: 'missing.json', exportName: './missing.json' }
    ];

    // First file exists, second file throws error
    mockJoin
      .mockReturnValueOnce('/src/existing.json')
      .mockReturnValueOnce('/src/missing.json');

    mockReadFileSync
      .mockReturnValueOnce('{"exists": true}')
      .mockImplementationOnce(() => {
        throw new Error('File not found');
      });

    const plugin = realExportConfigFiles({ configFiles: customConfigFiles });

    // Should not throw error when file cannot be read
    expect(() => {
      plugin.generateBundle(mockOptions, mockBundle);
    }).not.toThrow();

    // Should call readFileSync for both files
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);
  });

  it('should add files to bundle using this.emitFile', () => {
    const customConfigFiles = [
      { path: 'test.json', exportName: './test.json' }
    ];

    const mockEmitFile = vi.fn();
    const mockThis = {
      emitFile: mockEmitFile
    };

    // Set up mocks
    mockJoin.mockReturnValue('/src/test.json');
    mockReadFileSync.mockReturnValue('{"test": "data"}');

    const plugin = realExportConfigFiles({ configFiles: customConfigFiles });
    plugin.generateBundle.call(mockThis, mockOptions, mockBundle);

    expect(mockEmitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'test.json',
      source: '{"test": "data"}'
    });
  });

  it('should create virtual module in bundle', () => {
    const customConfigFiles = [
      { path: 'test.json', exportName: './test.json' }
    ];

    // Set up mocks
    mockJoin.mockReturnValue('/src/test.json');
    mockReadFileSync.mockReturnValue('{"test": "data"}');

    const plugin = realExportConfigFiles({ configFiles: customConfigFiles });
    plugin.generateBundle(mockOptions, mockBundle);

    // Verify that virtual module has been added to bundle
    const virtualModuleId = '\0./test.json';
    expect(mockBundle[virtualModuleId]).toBeDefined();
    expect(mockBundle[virtualModuleId].type).toBe('chunk');
    expect(mockBundle[virtualModuleId].fileName).toBe('test.json.js');
  });
});
