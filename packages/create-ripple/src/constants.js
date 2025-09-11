import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Available templates configuration
 */
export const TEMPLATES = [
	{
		name: 'basic',
		display: 'Basic Ripple App',
		description: 'A minimal Ripple application with Vite and TypeScript'
	}
];

// Get the root directory of the monorepo
export const REPO_ROOT = resolve(__dirname, '../../../');
export const TEMPLATES_DIR = join(REPO_ROOT, 'templates');
