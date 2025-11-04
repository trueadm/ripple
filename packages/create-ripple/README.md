# create-ripple

Interactive CLI tool for creating new Ripple applications. Alias for the `@ripple-ts/cli` package.

## Usage

### Interactive Mode

```bash
npx create-ripple
# or
npm create ripple
# or
yarn create ripple
# or
pnpm create ripple
```

### With Arguments

- `project-name`: Optional. Name of the project to create
- `-p, --package-manager <pm>`: Package manager to use - npm, yarn, pnpm (default: npm)
- `--template <template>`: Choose a predefined template (default and currently only option: basic)
- `--yes` or `-y`: Skip all prompts and use defaults
- `--no-git`: Skip initializing a Git repository

Examples:

````bash
npm create ripple my-app
# or
npx create-ripple my-app

```bash
npm create ripple my-app --yes --no-git
# or
npx create ripple my-app --yes --no-git
````

## Features

- 🎯 **Interactive prompts** - Guides you through project setup
- 📁 **Template selection** - Choose from predefined templates
- ✅ **Project validation** - Ensures valid project names
- 🎨 **Beautiful CLI** - Colored output with progress indicators
- ⚡ **Fast setup** - Quickly scaffold new Ripple projects

## Templates

### Basic

A minimal Ripple application with:

- Vite for development and building
- TypeScript support
- Prettier for code formatting
- Basic project structure

## Requirements

- Node.js 20.0.0 or higher

## License

MIT
