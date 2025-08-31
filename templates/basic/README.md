# Ripple Basic Template

A minimal Ripple application template with TypeScript and Vite.

## Getting Started

1. Install dependencies:

    ```bash
    npm install # or pnpm or yarn
    ```

2. Start the development server:

    ```bash
    npm run dev
    ```

3. Build for production:
    ```bash
    npm run build
    ```

## Code Formatting

This template includes Prettier with the Ripple plugin for consistent code formatting.

### Available Commands

- `npm run format` - Format all files
- `npm run format:check` - Check if files are formatted correctly

### Configuration

Prettier is configured in `.prettierrc` with the following settings:

- Uses tabs for indentation
- Single quotes for strings
- 100 character line width
- Includes the `prettier-plugin-ripple` for `.ripple` file formatting

### VS Code Integration

For the best development experience, install the [Prettier VS Code extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and the [Ripple VS Code extension](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin).

## Learn More

- [Ripple Documentation](https://github.com/trueadm/ripple)
- [Vite Documentation](https://vitejs.dev/)
