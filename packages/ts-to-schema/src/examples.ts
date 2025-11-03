import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export interface FileMapping {
  source: string
  target: string
}

export type GitRemote = {
  url?: string
  branch: string
}

export interface Config {
  $schema?: string
  /** @format uri */
  dotfilesDir: string
  files: FileMapping[]
  remote?: GitRemote
  /** 
   * Editor to use for opening files
   * @examples ["code", "sublime", "vim"] 
   */
  editor?: string
  initialized: boolean
}

export interface DotfilesConfig extends Config {}

export interface SchemaOptions {
  name?: string | undefined;
  target?: 'jsonSchema7' | 'jsonSchema2019-09' | 'openApi3' | undefined;
}

export function generateConfigSchema(options: SchemaOptions) {
  // ตัวอย่าง schema พื้นฐาน
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: options.name || 'Config Schema',
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  };
}


export const CONFIG_PATH = join(homedir(), '.dotfile-manager.json')

export const loadDotfileConfig = async (): Promise<Config> => {
  if (!existsSync(CONFIG_PATH)) {
    return {} as Config
  }
  const content = readFileSync(CONFIG_PATH, 'utf-8')
  return JSON.parse(content) as Config
}

export const saveDotfileConfig = (config: Config): void => {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
