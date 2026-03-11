# Convex Type Safety Playbook

This is the canonical guide for adding or changing Convex-backed code in this repo.

Use it when you are:

- adding a new Convex `query`, `mutation`, or `action`
- calling one Convex function from another
- wiring a new frontend feature to Convex
- hitting `TS2589` (`Type instantiation is excessively deep and possibly infinite`)
- deciding where a cast or `makeFunctionReference(...)` is acceptable

Historical hardening notes still exist in `openspec/archive/refactor-*` and `runtime-type-hardening-2026-03-05.md`, but this file is the current source of truth for new code.

## Goals

- Keep runtime and UI code on explicit, local types.
- Keep unavoidable Convex typing escape hatches small and centralized.
- Prevent new generic string-ref factories, broad casts, and component-local ref creation.
- Make it obvious which pattern to use for each call site.

## Decision Table

| Situation | Preferred approach | Where | Why |
| --- | --- | --- | --- |
| Define a new public Convex query or mutation | Export a normal Convex function with narrow `v.*` args and a narrow return shape | `packages/convex/convex/**` | Keeps the source contract explicit and reusable |
| Call Convex from web or widget UI/runtime code | Use the local surface adapter plus a feature-local wrapper hook or fixed ref constant | `apps/web/src/**`, `apps/widget/src/**` | Keeps `convex/react` and ref typing out of runtime/UI modules |
| Call one Convex function from another and generated refs typecheck normally | Use generated `api.*` / `internal.*` refs | `packages/convex/convex/**` | This is the default, simplest path |
| Call one Convex function from another and generated refs hit `TS2589` | Add a local shallow `runQuery` / `runMutation` / `runAction` / `runAfter` helper | the hotspot file only | Shrinks type instantiation at the call boundary |
| The generated ref itself still triggers `TS2589` | Replace only that hot ref with a fixed, typed `makeFunctionReference("module:function")` constant | the hotspot file only | Avoids broad weakening of the entire module |
| Convex React hook tuple typing still needs help | Keep a tiny adapter-local helper/cast in the surface adapter | adapter file only | Localizes the last unavoidable boundary |

## Non-Negotiable Rules

### 1. Do not import `convex/react` in runtime or feature UI files

Use the surface adapter layer instead:

- web: `apps/web/src/lib/convex/hooks.ts`
- widget: `apps/widget/src/lib/convex/hooks.ts`
- mobile: follow the same local-wrapper pattern; do not add new direct screen/context-level `convex/react` usage

Direct `convex/react` imports are only acceptable in:

- explicit adapter files
- bootstrap/provider wiring
- targeted tests that intentionally mock the adapter boundary

The current hardening guards freeze these boundaries:

- `apps/web/src/app/typeHardeningGuard.test.ts`
- `apps/widget/src/test/refHardeningGuard.test.ts`
- `packages/react-native-sdk/tests/hookBoundaryGuard.test.ts`

### 2. Do not create refs inside React components or hooks

Bad:

```ts
function WidgetPane() {
  const listRef = makeFunctionReference<"query", Args, Result>("messages:list");
  const data = useQuery(listRef, args);
}
```

Good:

```ts
const LIST_REF = widgetQueryRef<Args, Result>("messages:list");

function WidgetPane() {
  const data = useWidgetQuery(LIST_REF, args);
}
```

All refs must be module-scope constants.

### 3. Do not add new generic string-ref factories

Do not introduce helpers like:

- `getQueryRef(name: string)`
- `getMutationRef(name: string)`
- `getActionRef(name: string)`

Those patterns weaken the type boundary and make review harder. Some older code still has them, but they are legacy, not the standard for new work.

Use named fixed refs instead:

```ts
const LIST_MESSAGES_REF = webQueryRef<ListMessagesArgs, MessageRecord[]>("messages:list");
const SEND_MESSAGE_REF = webMutationRef<SendMessageArgs, Id<"messages">>("messages:send");
```

### 4. Keep casts local, named, and justified

Allowed:

- a tiny adapter-local cast needed to satisfy a Convex hook tuple type
- a hotspot-local shallow helper for `ctx.runQuery`, `ctx.runMutation`, `ctx.runAction`, or `ctx.scheduler.runAfter`
- a hotspot-local typed `makeFunctionReference("module:function")` when generated refs trigger `TS2589`

Not allowed for new code:

- `as any`
- broad `unsafeApi` / `unsafeInternal` object aliases in runtime code
- repeated `as unknown as` across multiple call sites
- hiding transport typing inside UI/controller modules

### 5. Update guard tests when you add or move a boundary

If you intentionally add a new approved boundary, document it in the relevant guard test at the same time.

## Standard Patterns

## A. Defining a new Convex query or mutation

Default backend pattern:

```ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

type VisitorSummary = {
  _id: Id<"visitors">;
  name?: string;
  email?: string;
};

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<VisitorSummary[]> => {
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return visitors.map((visitor) => ({
      _id: visitor._id,
      name: visitor.name,
      email: visitor.email,
    }));
  },
});
```

Rules:

- Use narrow `v.*` validators.
- Prefer explicit local return types for shared, frontend-facing, or cross-function contracts.
- Convert untyped or broad data to a narrow shape before returning it.
- If you need `v.any()`, document it in `security/convex-v-any-arg-exceptions.json`.

## B. Consuming Convex from web or widget code

Runtime/UI files should consume feature-local wrappers or fixed refs through the local adapter.

Widget example:

```ts
import type { Id } from "@opencom/convex/dataModel";
import { useWidgetQuery, widgetQueryRef } from "../lib/convex/hooks";

type TicketRecord = {
  _id: Id<"tickets">;
  subject: string;
};

const VISITOR_TICKETS_REF = widgetQueryRef<
  { workspaceId: Id<"workspaces">; visitorId: Id<"visitors">; sessionToken: string },
  TicketRecord[]
>("tickets:listByVisitor");

export function useVisitorTickets(
  workspaceId: Id<"workspaces"> | undefined,
  visitorId: Id<"visitors"> | null,
  sessionToken: string | null
) {
  return useWidgetQuery(
    VISITOR_TICKETS_REF,
    workspaceId && visitorId && sessionToken
      ? { workspaceId, visitorId, sessionToken }
      : "skip"
  );
}
```

Use the same structure in web with `webQueryRef`, `webMutationRef`, `webActionRef`, `useWebQuery`, `useWebMutation`, and `useWebAction`.

Rules:

- Define refs once at module scope.
- Keep `skip` / gating logic in the wrapper where practical.
- Export narrow feature-local result types instead of leaking giant inferred shapes.
- Do not import `convex/react` directly in feature components, screens, contexts, or controller hooks.

## C. Calling one Convex function from another

### Preferred default: generated refs

Start here when the types are normal:

```ts
import { internal } from "./_generated/api";

await ctx.runMutation(internal.notifications.deliver, {
  conversationId,
});
```

This is the standard path until it hits a real `TS2589` problem.

### TS2589 fallback: shallow helper first

If `ctx.runQuery(...)`, `ctx.runMutation(...)`, `ctx.runAction(...)`, or `ctx.scheduler.runAfter(...)` causes deep-instantiation errors, add a local helper:

```ts
import { type FunctionReference } from "convex/server";

type ConvexRef<
  Type extends "query" | "mutation" | "action",
  Visibility extends "internal" | "public",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, Visibility, Args, Return>;

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <
    Visibility extends "internal" | "public",
    Args extends Record<string, unknown>,
    Return,
  >(
    mutationRef: ConvexRef<"mutation", Visibility, Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
}
```

Then call through the helper:

```ts
const runMutation = getShallowRunMutation(ctx);
await runMutation(internal.notifications.deliver, { conversationId });
```

### TS2589 fallback: fixed typed ref when the generated ref itself is the problem

If simply referencing `api.foo.bar` or `internal.foo.bar` still triggers `TS2589`, switch only that hot call site to a fixed typed ref:

```ts
import { makeFunctionReference, type FunctionReference } from "convex/server";

type DeliverArgs = { conversationId: Id<"conversations"> };
type DeliverResult = null;

type ConvexRef<
  Type extends "query" | "mutation" | "action",
  Visibility extends "internal" | "public",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<Type, Visibility, Args, Return>;

const DELIVER_NOTIFICATION_REF = makeFunctionReference<
  "mutation",
  DeliverArgs,
  DeliverResult
>("notifications:deliver") as unknown as ConvexRef<
  "mutation",
  "internal",
  DeliverArgs,
  DeliverResult
>;
```

Use this only after the generated ref path proved pathological.

## Which approach to choose

### Use generated `api` / `internal` refs when

- the call is backend-to-backend
- the generated ref typechecks normally
- you are not in a known `TS2589` hotspot

### Use fixed typed `makeFunctionReference(...)` constants when

- you are in a surface adapter or feature-local wrapper file
- you need a stable local ref for a frontend wrapper
- a backend hotspot still blows up after trying generated refs

### Use local wrapper hooks when

- the consumer is React UI, runtime, controller, screen, or context code
- the feature needs gating or `skip` behavior
- you want to normalize the result shape once for multiple consumers

### Use a shallow backend helper when

- the problem is `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` / `runAfter`
- the ref type is okay, but the invocation is too deep

### Use an adapter-local cast only when

- Convex’s React hook typing still needs an exact tuple or helper shape
- the cast can stay in the adapter file and nowhere else

## Current Surface Standards

### Backend (`packages/convex`)

- Default to generated refs.
- Localize `TS2589` workarounds with named `getShallowRun*` helpers.
- If needed, use fixed typed refs at the hotspot only.
- Keep guard coverage in `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`.

### Web (`apps/web`)

- Feature/runtime code should not import `convex/react` directly.
- Use feature-local wrapper hooks and the web adapter in `apps/web/src/lib/convex/hooks.ts`.
- Keep refs at module scope.
- Guard coverage lives in `apps/web/src/app/typeHardeningGuard.test.ts`.

### Widget (`apps/widget`)

- Feature/runtime code should not import `convex/react` directly.
- Use the widget adapter in `apps/widget/src/lib/convex/hooks.ts`.
- The only remaining adapter escape hatch is the query-args tuple helper required by Convex’s hook typing.
- Guard coverage lives in `apps/widget/src/test/refHardeningGuard.test.ts`.

### Mobile (`apps/mobile`)

- Target the same pattern as web/widget: local wrapper hooks plus module-scope typed refs.
- Do not add new direct `convex/react` usage to screens, contexts, or controller-style hooks.
- If a local adapter/wrapper does not exist for the feature yet, create one instead of importing hooks directly into runtime UI.

## Anti-Patterns To Avoid

- `function getQueryRef(name: string) { ... }`
- `function getMutationRef(name: string) { ... }`
- `function getActionRef(name: string) { ... }`
- component-local `makeFunctionReference(...)`
- `as any`
- broad `unsafeApi` / `unsafeInternal` aliases
- scattering the same `as unknown as` across many call sites
- returning `unknown` or `string` when a branded `Id<"...">` or explicit object type is the real contract

## Verification Checklist

After changing Convex typing boundaries:

1. Run the touched package typecheck first.
2. Run the touched package tests.
3. Run the relevant hardening guard tests.
4. If this work is OpenSpec-driven, run strict OpenSpec validation.

Useful commands:

```bash
pnpm --filter @opencom/convex typecheck
pnpm --filter @opencom/web typecheck
pnpm --filter @opencom/widget typecheck

pnpm --filter @opencom/convex test -- --run tests/runtimeTypeHardeningGuard.test.ts
pnpm --filter @opencom/web test -- --run src/app/typeHardeningGuard.test.ts
pnpm --filter @opencom/widget test -- --run src/test/refHardeningGuard.test.ts
```

## Review Rule of Thumb

If you are about to:

- add a new direct `convex/react` import in feature code
- add a new `get*Ref(name: string)` factory
- add `unsafeApi`, `unsafeInternal`, `as any`, or repeated `as unknown as`
- create a ref inside a React component

stop and use one of the standard patterns above instead.
