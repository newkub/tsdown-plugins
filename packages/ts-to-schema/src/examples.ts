export interface DotfilesConfig {
	/**
	 * Name of the configuration
	 */
	name: string;
	/**
	 * Version of the configuration
	 */
	version?: string;
	/**
	 * List of plugins to use
	 */
	plugins: string[];
	/**
	 * Enable debug mode
	 */
	debug?: boolean;
}
