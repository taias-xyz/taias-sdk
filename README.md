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

**1. Define a flow** — Map out your tool sequence:

```ts
import { defineFlow, createTaias } from "taias";

const flow = defineFlow("onboard", (flow) => {
  flow.step("scan_repo", () => ({ nextTool: "configure_app" }));
  flow.step("configure_app", () => ({ nextTool: "deploy" }));
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

const affordances = await taias.resolve({ toolName: "scan_repo" });

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

Creates a flow definition.

```ts
const myFlow = defineFlow("my_flow", (flow) => {
  flow.step("tool_name", (ctx) => ({
    nextTool: "next_tool_name",
  }));
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

Resolves a tool call to get the suggested next step. Advice text to send the LLM is generated based on the `nextTool` specified in your step handler.

```ts
const affordances = await taias.resolve({ toolName: "scan_repo" });
// affordances.advice → "FOR THE BEST USER EXPERIENCE, TELL THE USER TO USE THE configure_app TOOL NEXT!!!!!"
```

> The emphasis helps LLMs prioritize it.

**Parameters:**
- `ctx.toolName` - The name of the tool being called

**Returns:** `Affordances | null`
- Returns `{ advice: string }` with auto-generated advice if a matching step is found
- Returns `null` if no step matches or handler returns null

## Types

<details>
<summary>View all types</summary>

```ts
type TaiasContext = {
  toolName: string;
};

type StepDecision = {
  nextTool: string;
};

type Affordances = {
  advice: string;
};

type StepHandler = (
  ctx: TaiasContext
) => StepDecision | null | Promise<StepDecision | null>;

type FlowStep = {
  toolName: string;
  handler: StepHandler;
};

type FlowDefinition = {
  id: string;
  steps: Array<FlowStep>;
};

interface FlowBuilder {
  step(toolName: string, handler: StepHandler): void;
}

type TaiasOptions = {
  flow: FlowDefinition;
  devMode?: boolean;
  onMissingStep?: (ctx: TaiasContext) => void;
};

interface Taias {
  resolve(ctx: TaiasContext): Affordances | null | Promise<Affordances | null>;
}
```

</details>

See the [full documentation](https://taias.xyz/docs) for more details.

## Dev Mode

<details>
<summary>View dev mode features</summary>

When `devMode: true`, Taias performs additional validation:

1. **Duplicate toolName detection** — Throws an error if a flow defines the same tool name twice:
   ```
   Taias: Duplicate step for tool 'scan_repo' in flow 'onboard_repo'. Only one handler per tool is supported.
   ```

2. **Empty nextTool warning** — Logs a warning if a handler returns empty nextTool:
   ```
   Taias: nextTool for tool 'scan_repo' is empty.
   ```

</details>

See the [full documentation](https://taias.xyz/docs) for more details.

## Documentation

[Full Documentation](https://taias.xyz/docs)

## License

[Apache License 2.0](./LICENSE)
