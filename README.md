<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/taias-mcp/taias/main/static/taias_dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/taias-mcp/taias/main/static/taias_light.png">
  <img width="300" alt="Taias logo" src="https://raw.githubusercontent.com/taias-mcp/taias/main/static/taias_light.png">
</picture>

<br/>

www.taias.xyz

[![npm version](https://img.shields.io/npm/v/taias.svg)](https://www.npmjs.com/package/taias)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

</div>

Taias is a lightweight framework that helps MCP server builders influence and shape user experiences inside LLM-driven interfaces.

## Installation

```bash
npm install taias
```

## Quick Start

**1. Define a flow** — Express your logic as structured data:

```ts
import { defineFlow, createTaias } from "taias";

const flow = defineFlow("onboard", (flow) => {
  flow.step({ toolName: "scan_repo" }, { nextTool: "configure_app" });
  flow.step({ toolName: "configure_app" }, { nextTool: "deploy" });
});
```

**2. Create a Taias instance:**

```ts
const taias = createTaias({ 
  flow,
  devMode: true, // Enable validation and warnings during development
  onMissingStep: ({ toolName }) => {
    console.warn(`[Taias] No step defined for tool "${toolName}"`);
  },
});
```

**3. Append advice to your tool response:**

```ts
// Inside your tool handler

const affordances = await taias.resolve({
  toolName: "scan_repo",
  params: input,  // Pass tool input parameters (optional)
  result: { language: scanResult.language },  // Pass tool output (optional)
});

let message = "Scan successful!";

// Append Taias advice to guide the LLM to the next step
if (affordances?.advice) {
  message += `\n\n${affordances.advice}`;
}

return {
  content: [
    {
      type: "text",
      text: message,
    },
  ],
};
```

## API

### `defineFlow(flowId, builder)`

Creates a flow definition. Each step is a logic statement: a match condition paired with a decision.

```ts
const myFlow = defineFlow("my_flow", (flow) => {
  flow.step({ toolName: "tool_name" }, { nextTool: "next_tool_name" });
});
```

**Parameters:**
- `flowId` - Unique identifier for the flow
- `builder` - Callback receiving a `FlowBuilder` to define steps

**Returns:** `FlowDefinition`

### `createTaias(options)`

Creates a Taias instance from a flow.

```ts
const taias = createTaias({
  flow: myFlow,
  devMode: true,
  onMissingStep: (ctx) => {
    console.log(`No next step for tool: ${ctx.toolName}`);
  },
});
```

**Options:**
- `flow` - A `FlowDefinition` created by `defineFlow`
- `devMode` (optional) - Enable development mode checks
- `onMissingStep` (optional) - Callback invoked when no step matches

**Returns:** `Taias` instance

### `taias.resolve(ctx)`

Resolves a tool call to get the decision and its manifestations. Evaluates the matching logic statement and produces advice text, the decision object, and UI selections.

```ts
const affordances = await taias.resolve({
  toolName: "scan_repo",
  params: { repoUrl: "https://github.com/..." },  // optional
  result: { language: "python", hasConfig: true },  // optional
});
// affordances.advice → "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
```

> The emphasis helps LLMs prioritize it.

**Parameters:**
- `ctx.toolName` - The name of the tool being called
- `ctx.params` - The input parameters of the tool call (optional)
- `ctx.result` - The output of the tool's execution (optional)

**Returns:** `Affordances | null`
- Returns an `Affordances` object with `advice`, `decision`, and `selections` if a matching step is found
- Returns `null` if no step matches

See the [full documentation](https://taias.xyz/docs) for complete API reference and types.

## Dev Mode

<details>
<summary>View dev mode features</summary>

When `devMode: true`, Taias performs additional validation:

1. **Duplicate match condition detection** — Throws an error if a flow defines two steps with the same match condition:
   ```
   Taias: Duplicate match condition 'scan_repo' in flow 'onboard_repo'. Each step must have a unique match condition.
   ```

2. **Empty nextTool warning** — Logs a warning if a logic statement has an empty nextTool:
   ```
   Taias: nextTool for tool 'scan_repo' is empty.
   ```

</details>

See the [full documentation](https://taias.xyz/docs) for more details.

## Documentation

[Full Documentation](https://taias.xyz/docs)

## License

[Apache License 2.0](./LICENSE)
