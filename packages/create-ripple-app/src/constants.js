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
