# @ripple-ts/cli

Interactive CLI tool for creating and managing Ripple applications.

To create a Ripple app with simpler syntax, you can also use `create-ripple` package.

## Installation

You can run it directly without installing:

```bash
npx @ripple-ts/cli <command>
```

---

## Available Commands

### `create`

Create a new Ripple application using the interactive mode:

```bash
npx @ripple-ts/cli create
```

Or use with arguments:

- `project-name`: Optional. Name of the project to create
- `-p, --package-manager <pm>`: Package manager to use - npm, yarn, pnpm (default: npm)
- `--template <template>`: Choose a predefined template (default and currently only option: basic)
- `--yes` or `-y`: Skip all prompts and use defaults
- `--no-git`: Skip initializing a Git repository

Example:

```bash
npx @ripple-ts/cli create my-app --yes --no-git
```

---

### More commands are coming soon...

---

## Features

- 🎯 **Interactive prompts** – Guides you step by step through project setup
- 📁 **Template selection** – Choose from predefined templates
- ✅ **Project validation** – Ensures valid project names
- 🎨 **Beautiful CLI** – Colored output with progress indicators
- ⚡ **Fast setup** – Quickly scaffold new Ripple projects

---

## Templates

### Basic

A minimal Ripple application with:

- Vite for development and building
- TypeScript support
- Prettier for code formatting
- Basic project structure

---

## Usage Notes

- The CLI requires **explicit subcommands** (`create`).
- Running `npx @ripple-ts/cli` without a subcommand will display the help message.
- Use `create-ripple` for simpler syntax.

---

## Requirements

- Node.js 20.0.0 or higher

---

## License

MIT
