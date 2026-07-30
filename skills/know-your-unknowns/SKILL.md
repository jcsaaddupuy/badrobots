---
name: know-your-unknowns
description: "Blind-spot analysis before implementing or reviewing: surface unknown knowns and unknown unknowns by reading the territory before acting on the map. Use before any non-trivial spec review, design, or implementation task — especially in unfamiliar areas."
---

# Know Your Unknowns

The map (prompt, spec, design) is not the territory (codebase, API, system). The gap between
them is your unknowns. Assumptions made without reading the territory become bugs in the spec
and surprises mid-implementation.

## The Four Quadrants

| | Known | Unknown |
|---|---|---|
| **Known** | What's in the prompt | Gaps you're aware of — ask before starting |
| **Unknown** | What the territory enforces but nobody wrote down | What hasn't been considered at all |

**Unknown Knowns** are the dangerous ones — implicit constraints, existing conventions, hidden
coupling. You'd recognize them immediately if you saw them, but you won't see them unless you
look. Examples:
- An existing method does almost what you need — but has an extra filter that silently excludes your case
- A type conversion enforces an invariant that breaks the new path you're adding
- A helper you're planning to call doesn't exist yet — it's greenfield, not an extension
- A library/framework has an idiomatic pattern for this that your design ignores

## Procedure

1. **State your assumed understanding** in one sentence: "I think X works like Y."
2. **Read the territory** before writing spec or tasks — not to implement, to check assumptions:
   - Existing types, their constructors, conversion impls, and invariants
   - Port/interface definitions: what methods exist and what they actually do
   - Entry points, wiring, and shared state
   - Conventions: how similar problems were solved elsewhere in the codebase
3. **For each assumption, ask:** "Does the territory contradict this?"
4. **Name discoveries explicitly** in the spec/design, at the task that would otherwise hide the trap.

## When to Run This

- Before writing tasks in an area of the codebase you haven't read
- When a spec says "extend X" or "add Y to Z" — verify Z accepts it before writing the task
- When a design names a dependency without verifying it exists
- When reviewing someone else's spec — surface their unknown knowns, not just the stated gaps

## Anti-patterns

- Reading only the spec without opening the actual source
- Assuming a function does what its name suggests without checking its implementation
- Writing a task that calls something without specifying what it returns — leaving callers to guess
- Claiming atomicity or consistency guarantees without verifying the underlying primitive supports them
- Naming an interface or client in a task without confirming it exists
