---
name: goblin-empire-project
description: Follow Goblin Empire project conventions when modifying this repository. Use for planning, implementation, refactoring, localization, UI work, gameplay systems, data changes, and validation in this browser incremental game project.
---

# Goblin Empire Project Conventions

## Project Shape

Work as if this is a browser incremental/idle game project inspired by the Kittens Game codebase, with Chinese design documents defining a new "哥布林帝国" game.

- `策划案/` contains the authoritative Chinese design documents for the new game. Read the relevant document before implementing or changing mechanics.
- `game/` is the target implementation area for Goblin Empire code when new project code is created.
- Root `AGENTS.md` applies to the whole workspace. If subdirectory instructions are added later, follow the most specific applicable file.

## Design Sources

Use the planning documents as product requirements.

- Start with `策划案/00_策划案索引.md` to locate the relevant design document.
- `策划案/01_猫国建设者源码机制分析.md` explains how `cat` systems work and which patterns are worth borrowing.
- `策划案/02_哥布林帝国核心策划案.md` defines the fantasy, core loop, phase structure, and target experience.
- `策划案/03_资源建筑职业系统.md` defines resources, production chains, buildings, jobs, and numeric direction.
- `策划案/04_科技外交信仰与重置.md` defines technology, workshop upgrades, diplomacy, sacrifice/faith, prestige reset, and challenge modes.
- `策划案/05_界面交互与开发落地规格.md` defines UI structure, save-data shape, unlock rules, formulas, and development milestones.
- Do not copy Kittens Game theme text, cat-specific resources, or original assets into Goblin Empire features. Borrow system structure only.

## Goblin Empire Implementation Style

When adding or changing the new game implementation, prefer clear, data-driven browser code.

- Keep domain data explicit: resources, buildings, technologies, jobs, unlock bundles, policies, captives, prestige, and statistics should be represented in structured objects or JSON-like tables.
- Keep IDs stable and machine-readable in English or pinyin-style ASCII where possible; keep player-facing names and descriptions in Chinese.
- Separate mechanics from presentation when practical: production formulas, unlock checks, price scaling, save/load, and UI rendering should not be tangled more than necessary.
- Match the selected local stack in `game/` once it exists. Do not introduce frameworks, build tools, or package managers unless the user asks or the existing implementation already uses them.
- If no implementation stack exists yet, a simple static browser app is preferred over heavy tooling for early playable prototypes.
- Use concise Chinese comments for non-obvious game rules, formulas, public data fields, and design intent.

## Mandatory Code Style

These rules are mandatory for new Goblin Empire code and for substantial edits to existing Goblin Empire code. Do not weaken them for convenience.

- Code must be readable by a future maintainer who has only read the planning documents. Favor explicit names and simple control flow over cleverness.
- Keep files focused. A file should have one clear responsibility such as data definitions, tick/update logic, save/load, rendering, UI events, or a specific game system.
- Do not mix unrelated systems in one change. For example, a resource-production change should not also restructure rendering unless the change cannot work otherwise.
- Prefer small pure helper functions for formulas, unlock checks, price calculation, visibility checks, and formatting. Side effects should be concentrated in update/apply functions.
- Do not hide gameplay constants inside UI code. Resource rates, prices, unlock thresholds, and scaling factors must live in data tables or clearly named constants.
- Avoid global mutable state except for the main game state object and intentional module-level configuration/data tables.
- Do not introduce asynchronous behavior for core simulation unless there is a concrete need. The main game loop should remain deterministic and inspectable.
- Do not rely on DOM text as state. State must live in JavaScript objects; the DOM is a projection of that state.
- Do not duplicate the same formula or unlock condition in multiple places. Extract a helper or central data field.
- Do not silently swallow errors in save/load, migration, or core update logic. Handle expected invalid data explicitly and make unexpected failures visible during development.

## Naming Rules

Names are part of the project contract and must be stable.

- Internal IDs must be ASCII, stable, and machine-readable, for example `fungus`, `ore`, `mud_hut`, `graffiti_wall`, `chief_hall`.
- Player-facing names must be Chinese, for example `菌菇`, `矿石`, `泥棚`, `涂鸦墙`, `酋长厅`.
- Do not use player-facing Chinese names as object keys or save identifiers.
- Use `camelCase` for JavaScript variables, functions, object properties, and methods.
- Use `PascalCase` only for constructor functions, classes, and type-like factory names.
- Use `UPPER_SNAKE_CASE` for true constants that are not expected to vary by save data, player progress, or balancing tables.
- Every variable declaration must have an adjacent Chinese comment that explains the variable's purpose and explicitly states its data type, including local variables, loop variables, constants, module-level bindings, and destructured bindings.
- Variable comments must use precise type wording such as `number`、`string`、`boolean`、`ResourceState`、`Price[]`、`Record<ResourceId, ResourceState>`；numeric variables must also state the unit or number kind when relevant, such as integer count, floating-point rate, milliseconds, seconds, percentage ratio, resource amount, or ID index.
- Do not introduce undocumented variables during refactors. Renaming, splitting, or changing a variable's type requires updating its comment in the same change.
- Boolean names must read as predicates, such as `isUnlocked`, `canAfford`, `hasCapacity`, `shouldReveal`.
- Functions that mutate state must use imperative names, such as `applyProduction`, `spendResources`, `unlockTechnology`, `assignWorker`.
- Functions that only compute or query must use descriptive non-mutating names, such as `getPrice`, `canBuyBuilding`, `calculatePerSecond`, `formatResourceAmount`.
- Avoid vague names such as `data`, `obj`, `item`, `temp`, `foo`, `handleStuff`, except in very small local scopes where the meaning is obvious.

## Data Shape Rules

Data definitions must be consistent and easy to diff.

- Generic catch-all containers are forbidden for game data. Do not use vague dictionaries or maps such as `data`, `values`, `extra`, `meta`, `payload`, `params`, `options`, or `Record<string, any>` unless the exact key contract is documented immediately next to the declaration.
- Every object/dictionary key used for game state, static config, save data, UI view models, events, or migrations must have a written explanation and a declared data type.
- Dictionary-like containers must declare allowed keys. Open-ended arbitrary keys are not allowed unless the key space itself is the data model, for example `resourcesById`, and the key type and value type are documented.
- For ID-indexed dictionaries, document both the key and value type, for example `Record<ResourceId, ResourceState>` where each key is a stable resource ID and each value follows `ResourceState`.
- Do not use untyped nested objects as shortcuts. If an object has nested keys, document the nested shape as a named contract or inline schema.
- Prefer named data contracts such as `ResourceDefinition`, `BuildingDefinition`, `GameState`, `SaveData`, `Price`, and `UnlockBundle` over anonymous object shapes.
- If the project uses TypeScript later, define explicit interfaces/types instead of `any`, `object`, broad `Record<string, unknown>`, or unconstrained generics.
- In plain JavaScript, use JSDoc `@typedef` blocks or adjacent schema comments to document object and dictionary shapes before first use.
- Every resource definition must include at least `id`, `name`, `category`, and initial visibility/capacity behavior.
- Every building definition must include at least `id`, `name`, `description`, `basePrice`, `priceRatio`, `effects`, and unlock information.
- Every technology definition must include at least `id`, `name`, `description`, `price`, and unlock effects.
- Every job definition must include at least `id`, `name`, unlock information, and production/consumption modifiers.
- Store prices as arrays or objects with explicit resource IDs and numeric amounts. Do not encode prices in display strings.
- Unlock conditions must be data-driven when practical. Do not scatter equivalent threshold checks across UI handlers.
- Save data must store only progress/state, not full static definitions copied from data tables.
- When changing a data schema, update save/load and migration behavior in the same change.

## Comment And Documentation Requirements

Comments are required where they clarify design intent, formulas, data contracts, or non-obvious behavior. They are not optional decoration.

- Public modules or major sections must start with a short Chinese comment explaining what the section owns.
- New game systems must have a Chinese overview comment describing their role in the core loop.
- Every variable must have a Chinese comment that states both purpose and data type. This applies even when the variable name is self-explanatory.
- Variable comments must be immediately before the declaration, on the same line, or inside the destructuring/object schema comment that directly owns the declared name.
- For destructuring assignments, document every bound variable and its type either in separate comments or in a single adjacent schema comment that names each binding.
- For loop variables and short-lived intermediate variables, keep the comment concise but still include type and purpose.
- Non-trivial formulas must have a Chinese comment explaining the gameplay reason, not just the arithmetic.
- Unlock rules, price-scaling rules, prestige/reset rules, random event odds, and risk/reward logic must be commented.
- Save migrations must include comments explaining the old shape, new shape, and reason for the migration.
- Do not write comments that merely repeat the code, such as `// 加 1` before `count += 1`.
- Do not leave vague comments such as `// TODO`, `// fix later`, or `// 临时处理` without a concrete condition or next step.
- If a TODO is unavoidable, include owner/context in the text, for example `// TODO: 接入外交系统后，将固定关系值改为阵营关系表读取。`
- Keep comments close to the code or data they explain. Do not place important behavior notes only in distant documentation.
- JSDoc-style comments are required for exported/public helper functions once the codebase has modules or reusable APIs. At minimum document purpose, parameters, return value, and side effects.
- Every function must have an explicit Chinese comment or JSDoc block that documents its purpose, every parameter, and its return value.
- Every function parameter must have a documented type. Numeric parameters must state number kind and meaning, such as integer count, floating-point rate, milliseconds, seconds, percentage ratio, resource amount, or ID index.
- Every function return value must have a documented type. Functions with no meaningful return must explicitly document `void`/无返回值.
- Numeric return values must state their unit and range when relevant, such as `0-1` ratio, non-negative resource amount, signed per-second delta, integer owned count, or millisecond timestamp.
- Object and array parameters must document their expected shape or reference the data contract name, such as `GameState`, `ResourceState`, `Price[]`, or `UnlockBundle`.
- Dictionary/object parameters must document every allowed key and each key's data type, either through a named contract or an inline schema comment.
- Boolean parameters are discouraged. If used, the comment must explain exactly what `true` and `false` mean.
- Optional parameters must document default behavior when the parameter is omitted.
- Functions that mutate inputs or global game state must document the side effect explicitly.
- Event handlers and UI callbacks still need parameter and return documentation, even when they return `void`.
- Anonymous inline callbacks may omit full JSDoc only when they are shorter than five lines and their parameters are obvious from the immediate API call; otherwise extract them into a named documented function.
- Do not add undocumented parameters during refactors. Updating a function signature requires updating its comment in the same change.

Example for formulas:

```js
// 拥挤度用于压制人口增长：早期给玩家扩建压力，后期由制度和建筑缓解。
function calculateCrowdingPenalty(population, housing) {
    if (housing <= 0) {
        return 1;
    }
    return Math.max(0, (population - housing) / housing);
}
```

Required variable documentation style:

```js
// number 资源数量：当前菌菇库存，非负浮点数。
var fungusAmount = state.resourcesById.fungus.value;

// ResourceDefinition[] 可见资源定义列表：用于渲染资源栏。
var visibleResources = getVisibleResources(state);

// number 循环索引：遍历可见资源定义列表的整数下标。
for (var resourceIndex = 0; resourceIndex < visibleResources.length; resourceIndex += 1) {
    // ResourceDefinition 当前资源定义：本轮要渲染的资源配置。
    var resourceDefinition = visibleResources[resourceIndex];
}

// 解构绑定字段：resourceId 为 string 资源稳定 ID；amount 为 number 非负资源数量。
var { resourceId, amount } = priceEntry;
```

Required function documentation style:

```js
/**
 * 计算拥挤惩罚，用于降低人口增长和服从度恢复速度。
 *
 * @param {number} population - 当前哥布林数量，非负整数。
 * @param {number} housing - 当前住房容量，非负整数。
 * @returns {number} 拥挤惩罚倍率，范围为 0-1；0 表示无惩罚，1 表示满额惩罚。
 */
function calculateCrowdingPenalty(population, housing) {
    if (housing <= 0) {
        return 1;
    }
    return Math.min(1, Math.max(0, (population - housing) / housing));
}
```

Required mutating function documentation style:

```js
/**
 * 消耗资源并写回游戏状态。
 *
 * @param {GameState} state - 当前游戏状态对象，会被直接修改。
 * @param {Price[]} price - 价格数组；amount 为非负资源数量。
 * @returns {boolean} 是否成功支付；true 表示已扣除资源，false 表示资源不足且状态不变。
 */
function spendResources(state, price) {
    if (!canAfford(state, price)) {
        return false;
    }
    // ...
    return true;
}
```

Required object/dictionary contract style:

```js
/**
 * @typedef {Object} ResourceState
 * @property {string} id - 资源稳定 ID，必须对应 ResourceDefinition.id。
 * @property {number} value - 当前资源数量，非负浮点数。
 * @property {number} maxValue - 当前资源容量上限，非负浮点数。
 * @property {boolean} isVisible - 是否已在资源栏中显示；true 表示玩家已解锁或见过该资源。
 */

/**
 * @typedef {Object.<string, ResourceState>} ResourceStateById
 * key: 资源稳定 ID，例如 "fungus" 或 "ore"。
 * value: 对应资源的运行时状态，结构必须符合 ResourceState。
 */
```

Example for data:

```js
{
    id: "mud_hut",
    name: "泥棚",
    description: "给新生哥布林提供最基础的栖身空间。",
    category: "housing",
    basePrice: [{ resource: "mud", amount: 20 }, { resource: "fungus_fiber", amount: 5 }],
    priceRatio: 1.15,
    effects: { housingMax: 2 },
    unlock: { resources: [{ id: "mud", amount: 10 }] }
}
```

## Formatting Rules

Formatting consistency is mandatory within touched files.

- Use 4-space indentation for new Goblin Empire JavaScript, JSON-like data, CSS, and HTML script blocks unless an existing file clearly uses another style.
- Use semicolons in JavaScript.
- Use double quotes for player-facing Chinese strings and stable string IDs unless a local file consistently uses single quotes.
- Keep object literals in data tables vertically formatted when they contain gameplay fields. Do not compress important game data onto one long line.
- Keep line length reasonable for review. Long data rows are acceptable only when wrapping would make the table less readable.
- Do not make whitespace-only changes outside the lines you are materially editing.

## Gameplay Rules

Keep mechanics aligned with the design direction.

- Core fantasy: underground goblin survival growing into a rough industrial empire through gathering, mining, smelting, raiding, worship, research, and prestige resets.
- Early game should emphasize food, population pressure, basic shelters, mining, and simple production chains.
- Mid game should emphasize city-state organization, military industry, trade/diplomacy, workshops, and sacrifice/faith systems.
- Late game should emphasize empire management, rune machinery, abyss expeditions, rare resources, challenges, and long-term prestige.
- Every new mechanic should have a clear role in the loop: produce resources, convert resources, raise capacity, unlock systems, create pressure, automate work, or support reset progression.
- Avoid one-off mechanics that do not connect to the resource economy, unlock system, or long-term progression.

## Data And Saves

Favor durable source data over hardcoded UI-only state.

- Follow the data shapes in `策划案/05_界面交互与开发落地规格.md` unless implementation constraints justify a small adaptation.
- Save data should include a version and enough stable IDs to survive display-name changes.
- Never make save compatibility worse casually. When changing save structure, add migration logic or document why saved games can be reset.
- Keep numeric formulas deterministic and easy to inspect. Avoid hidden randomness in production math unless the design calls for events, trade, raiding, or expedition risk.

## UI Guidance

Build a usable management interface, not a landing page.

- The first screen should be the playable management interface when implementing the game.
- Use the design's layout direction: resource/status overview, central tabs/actions, and log/event feedback.
- Important actions should show costs, effects, affordability, and missing resources.
- Hide unrevealed content, but surface near-unlocks when the design calls for `unlockRatio`-style hints.
- Keep text dense, readable, and suitable for repeated play. Avoid decorative UI that reduces scan speed.
- Use Chinese player-facing copy by default for Goblin Empire.

## Localization

- In new Goblin Empire code, centralize player-facing strings if the implementation has a localization layer. If not, keep strings easy to extract later.
- Do not mix internal IDs with display text. IDs should remain stable even if Chinese names are revised.

## Validation

Use the narrowest useful validation for the files changed.

- For static Goblin Empire prototypes in `game/`, open the HTML file directly when possible or start a minimal local server if browser module loading requires it.
- If no automated tests exist for new code, validate by running the app locally and checking the affected loop manually.

## Change Discipline

- Keep changes narrow and aligned with the current task.
- Before changing a system, inspect the closest existing implementation or design section and copy its conventions.
- Do not rename large sets of files, restructure directories, or run broad formatters unless explicitly requested.
- Do not treat generated or third-party-like files as primary authoring locations.
- When uncertain whether a requirement belongs in design docs or code, update the design doc first only if the user asked for planning/spec work; otherwise implement the smallest coherent behavior and note any assumption.
