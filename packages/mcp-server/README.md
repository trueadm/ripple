# @ripple-ts/mcp-server

Model Context Protocol (MCP) server for Ripple, providing AI assistants with tools to compile, parse, and analyze Ripple code.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open protocol that standardizes how applications provide context to LLMs. This MCP server exposes Ripple's compiler and analysis tools to AI assistants like Claude, enabling them to understand and work with Ripple code.

## Features

This MCP server provides the following capabilities:

### Tools

- **`ripple_compile`** - Compiles Ripple source code to JavaScript and CSS, and returns the AST
- **`ripple_create_component`** - Creates a new Ripple component file
- **`ripple_analyze_reactivity`** - Analyzes Ripple code for reactive variables and potential issues
- **`ripple_list_sections`** - Lists available Ripple documentation sections
- **`ripple_get_documentation`** - Fetches documentation content for specific sections

### Resources

- **`ripple://compiled/{path}`** - Reads a local file, compiles it, and returns the JavaScript output

## Installation

```bash
npm install @ripple-ts/mcp-server
```

## Usage

### Connecting to Claude Desktop

Add the server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ripple": {
      "command": "node",
      "args": ["/path/to/ripple/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "ripple": {
      "command": "npx",
      "args": ["-y", "@ripple-ts/mcp-server"]
    }
  }
}
```

After updating the configuration, restart Claude Desktop.

### Connecting to Other MCP Clients

The server uses stdio transport and can be connected to any MCP-compatible client. Example with the MCP SDK:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/ripple/packages/mcp-server/dist/index.js'],
});

const client = new Client(
  {
    name: 'my-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  },
);

await client.connect(transport);
```

## Available Tools

### ripple_compile

Compiles Ripple source code to JavaScript and CSS. Also returns the AST for analysis.

**Parameters:**

- `code` (string, required) - The Ripple source code to compile
- `filename` (string, required) - The filename for source map generation
- `mode` (string, optional) - Compilation mode: `'client'` or `'server'` (default: `'client'`)

**Example:**

```typescript
const result = await client.callTool('ripple_compile', {
  code: `
    export component Button(props: { text: string }) {
      <button>{props.text}</button>
    }
  `,
  filename: 'Button.ripple',
  mode: 'client',
});
```

**Returns:**

```json
{
  "js": "compiled JavaScript code",
  "css": "compiled CSS code",
  "map": "source map",
  "ast": { /* Abstract Syntax Tree */ }
}
```

### ripple_create_component

Creates a new Ripple component file on disk.

**Parameters:**

- `name` (string, required) - The name of the component (e.g., "Button")
- `content` (string, required) - The content of the component
- `path` (string, optional) - The directory path to create the component in

**Example:**

```typescript
const result = await client.callTool('ripple_create_component', {
  name: 'Button',
  content: `
    export component Button(props: { text: string }) {
      <button>{props.text}</button>
    }
  `,
  path: './src/components',
});
```

### ripple_analyze_reactivity

Analyzes Ripple code for reactive variables, tracked collections, and potential issues.

**Parameters:**

- `code` (string, required) - The Ripple source code to analyze
- `filename` (string, required) - The filename for error messages

**Example:**

```typescript
const result = await client.callTool('ripple_analyze_reactivity', {
  code: `
    import { track } from 'ripple';

    export component Counter() {
      let count = track(0);
      const items = #[1, 2, 3];

      <div>
        <p>{"Count: "}{@count}</p>
        <button onClick={() => @count++}>{"Increment"}</button>
      </div>
    }
  `,
  filename: 'Counter.ripple',
});
```

**Returns:**

Analysis results including:

- Reactive variables (using `track()` or `tracked()`)
- Reactive collections (using `#[]`, `#{}`, `new #Set()`, `new #Map()`, etc.)
- Variables with `@` prefix
- Warnings for unescaped strings in HTML templates

### ripple_list_sections

Lists all available Ripple documentation sections by fetching from ripplejs.com.

**Parameters:**

- `category` (string, optional) - Filter by category: "Getting Started", "Guide", or "Further Reading"

**Example:**

```typescript
const result = await client.callTool('ripple_list_sections', {
  category: 'Guide',
});
```

**Returns:**

```json
{
  "sections": [
    {
      "id": "guide-reactivity",
      "title": "Reactivity",
      "category": "Guide",
      "description": "Master Ripple reactivity system...",
      "path": "/docs/guide/reactivity"
    }
  ],
  "categories": ["Getting Started", "Guide", "Further Reading"],
  "totalSections": 15
}
```

### ripple_get_documentation

Fetches full documentation content for specific sections.

**Parameters:**

- `sections` (array of strings, required) - Array of section IDs to retrieve (e.g., `["guide-reactivity", "guide-components"]`)

**Example:**

```typescript
const result = await client.callTool('ripple_get_documentation', {
  sections: ['guide-reactivity', 'introduction'],
});
```

**Returns:**

```json
{
  "documentation": [
    {
      "id": "guide-reactivity",
      "title": "Reactivity",
      "category": "Guide",
      "url": "https://www.ripplejs.com/docs/guide/reactivity",
      "description": "Master Ripple reactivity system...",
      "content": "## Reactive Variables\n\n...",
      "subsections": [...]
    }
  ],
  "requested": 2,
  "found": 2
}
```

## Adding New Tools

To add a new tool to the MCP server:

1. **Create a new tool file** in `src/tools/`:

```typescript
// src/tools/my_tool.ts
import { z } from 'zod';

export const MyToolSchema = z.object({
  input: z.string(),
  // Add your parameters here
});

export const ripple_my_tool = {
  name: 'ripple_my_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Description of the input parameter',
      },
      // Add more properties as needed
    },
    required: ['input'],
  },
  handler: async (args: unknown) => {
    const { input } = MyToolSchema.parse(args);

    try {
      // Your tool logic here
      const result = processInput(input);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
};
```

2. **Export the tool** from `src/tools/index.ts`:

```typescript
import { ripple_my_tool } from './my_tool.js';

export { ripple_my_tool };

export const tools = [
  // ... existing tools
  ripple_my_tool,
];
```

3. **Test your tool**:

```bash
npm test
```

4. **Rebuild the server**:

```bash
npm run build
```

## Development

### Building

```bash
npm run build
```

### Running in Development Mode

```bash
npm run dev
```

### Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
packages/mcp-server/
├── src/
│   ├── index.ts           # Main server setup
│   └── tools/
│       ├── index.ts       # Tool exports
│       ├── compile.ts     # Compile tool
│       ├── parse.ts       # Parse tool
│       ├── create_component.ts    # Create component tool
│       ├── analyze_reactivity.ts  # Reactivity analysis tool
│       ├── check_documentation.ts # Documentation search tool
│       └── docs_index.json        # Pre-generated documentation index
├── scripts/
│   └── generate_docs_index.ts     # Documentation indexing script
├── tests/                 # Test files
├── package.json
└── README.md
```

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Ripple Documentation](https://www.ripplejs.com/docs)

## License

MIT License - see [LICENSE](../../LICENSE) for details.
