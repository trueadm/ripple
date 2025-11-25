# @ripple-ts/mcp-server

Model Context Protocol (MCP) server for Ripple, providing AI assistants with tools to compile, parse, and analyze Ripple code.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open protocol that standardizes how applications provide context to LLMs. This MCP server exposes Ripple's compiler and analysis tools to AI assistants like Claude, enabling them to understand and work with Ripple code.

## Features

This MCP server provides the following capabilities:

### Tools

- **`ripple_compile`** - Compiles Ripple source code to JavaScript and CSS
- **`ripple_parse`** - Parses Ripple code and returns the AST
- **`ripple_create_component`** - Creates a new Ripple component file
- **`ripple_analyze_reactivity`** - Analyzes Ripple code for reactive variables and potential issues
- **`ripple_check_documentation`** - Searches the Ripple documentation for answers to implementation questions
- **`ripple_generate_playground_link`** - Generates shareable Ripple playground links with code
- **`ripple_create_task`** - Creates tasks for orchestrating complex projects
- **`ripple_update_task`** - Updates task step status and progress
- **`ripple_get_task`** - Retrieves current task state and next steps

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

Compiles Ripple source code to JavaScript and CSS.

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
  "map": "source map"
}
```

### ripple_parse

Parses Ripple code and returns the Abstract Syntax Tree (AST).

**Parameters:**

- `code` (string, required) - The Ripple source code to parse
- `filename` (string, required) - The filename for error messages

**Example:**

```typescript
const result = await client.callTool('ripple_parse', {
  code: `
    export component App() {
      <div>Hello World</div>
    }
  `,
  filename: 'App.ripple',
});
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

### ripple_check_documentation

Searches the Ripple documentation for answers to implementation questions. This tool uses a pre-generated index of all official Ripple documentation pages to quickly find relevant information.

**Parameters:**

- `query` (string, required) - The question or topic to search for in the documentation
- `maxResults` (number, optional) - Maximum number of results to return (default: 3)

**Example:**

```typescript
const result = await client.callTool('ripple_check_documentation', {
  query: 'How do I create tracked variables?',
  maxResults: 3,
});
```

**Returns:**

```json
{
  "query": "How do I create tracked variables?",
  "results": [
    {
      "page": "Reactivity",
      "url": "https://www.ripplejs.com/docs/guide/reactivity",
      "section": "Reactive Variables",
      "content": "You use track to create a single tracked value...",
      "relevance": 68.4
    }
  ],
  "totalResults": 3,
  "indexLastUpdated": "2025-11-25T13:24:00.000Z"
}
```

The tool searches through all documentation pages and returns the most relevant sections based on keyword matching and relevance scoring. Results include direct links to the official documentation.

**Updating the Documentation Index:**

The documentation index is pre-generated and stored in the package. To update it with the latest documentation:

```bash
npm run generate-docs-index
```

This will crawl all documentation pages from https://www.ripplejs.com/docs/ and regenerate the search index.

### ripple_generate_playground_link

Generates a shareable Ripple playground link with the provided code.

**Parameters:**

- `code` (string, required) - The Ripple source code to encode in the playground link
- `title` (string, optional) - Optional title for the playground (e.g., "Counter App")
- `version` (string, optional) - Optional Ripple version (e.g., "0.2.175")

**Example:**

```typescript
const result = await client.callTool('ripple_generate_playground_link', {
  code: 'component Counter() { let count = track(0); <button onClick={() => @count++}>{@count}</button> }',
  title: 'Counter Example',
  version: '0.2.175',
});
```

**Returns:**

```json
{
  "url": "https://www.ripplejs.com/playground?v=0.2.175&title=Counter+Example#config=code%2F...",
  "shortUrl": "ripplejs.com/playground?v=0.2.175&title=Counter+Example#config=code/...",
  "title": "Counter Example",
  "version": "0.2.175",
  "codeLength": 95
}
```

### ripple_create_task

Creates a new task for orchestrating complex Ripple projects. Tasks help break down work into manageable steps with dependencies.

**Parameters:**

- `name` (string, required) - Name of the task
- `description` (string, required) - Description of what the task accomplishes
- `template` (string, optional) - Task template: `new_app`, `add_feature`, `refactor`, or `custom`
- `steps` (array, optional) - Custom steps (required if template is `custom`)

**Templates:**

- **`new_app`** - Create a new Ripple application (setup, components, routing, features, styling, testing)
- **`add_feature`** - Add a feature to existing app (analyze, design, implement, integrate, test, document)
- **`refactor`** - Refactor code (identify, plan, extract, update, test, cleanup)
- **`custom`** - Define your own steps with dependencies

**Example:**

```typescript
const result = await client.callTool('ripple_create_task', {
  name: 'Build Todo App',
  description: 'Create a todo list application',
  template: 'new_app',
});
```

**Returns:**

```json
{
  "taskId": "uuid-here",
  "name": "Build Todo App",
  "description": "Create a todo list application",
  "template": "new_app",
  "totalSteps": 6,
  "nextSteps": [
    {
      "id": "setup",
      "description": "Set up project structure and dependencies"
    }
  ],
  "progress": {
    "completed": 0,
    "inProgress": 0,
    "pending": 6
  }
}
```

### ripple_update_task

Updates the status of a task step and optionally adds notes about the progress.

**Parameters:**

- `taskId` (string, required) - ID of the task to update
- `stepId` (string, required) - ID of the step to update
- `status` (string, required) - New status: `pending`, `in_progress`, or `completed`
- `notes` (string, optional) - Optional notes about the update

**Example:**

```typescript
const result = await client.callTool('ripple_update_task', {
  taskId: 'uuid-here',
  stepId: 'setup',
  status: 'completed',
  notes: 'Project structure created successfully',
});
```

### ripple_get_task

Retrieves the current state of a task, including all steps, progress, and next actions.

**Parameters:**

- `taskId` (string, required) - ID of the task to retrieve

**Example:**

```typescript
const result = await client.callTool('ripple_get_task', {
  taskId: 'uuid-here',
});
```

**Returns:**

```json
{
  "task": {
    "id": "uuid-here",
    "name": "Build Todo App",
    "description": "Create a todo list application",
    "template": "new_app",
    "createdAt": "2025-11-25T14:00:00.000Z",
    "updatedAt": "2025-11-25T14:30:00.000Z"
  },
  "steps": [...],
  "progress": {
    "completed": 2,
    "inProgress": 1,
    "pending": 3
  },
  "nextSteps": [...],
  "isComplete": false
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
