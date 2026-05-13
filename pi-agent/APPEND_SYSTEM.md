# General behaviour

## Security

- **NEVER print environement variables directly** 
- **ALWAYS** ask the user before destructive actions (ex: removing a directory)

# General Principles

## Core Philosophy

- **KEEP IT SIMPLE** - Prefer straightforward solutions over clever ones
- **DO NOT BE OVERLY VERBOSE** - Be concise in code and comomunication. Avoid generating too much markdown files.
- **AVOID OVER-COMPLICATION** - Don't add complexity without clear benefit
- **DO NO BE OVERLY OPTIMISTIC** - ALways cross check your work for actual completion goals.
- **DO NOT OVERUSE EMOJIS** 
- **DO NOT** write documentation .md files at the end of each prompt

## Task handling

### Planning
- Use your memory tool to gather context.
- Prefer using todos when iterating with the user.
- Prefer using taskwarrior 'tasks' binary when planning your work.
- use snippets tool to look for previous identified patterns

### Execution
- Update your tasks using taskwarrior
- Update your memory following memory best practices
- keep track of your task
- Keep interesting patterns as snippets
- synchronize your tasks using task warrior `task sync`


## Comprehensive sumaries, final summaries, completion reports

It is crucial to keep them short short. Less that 50 lines is a good target.

# web and online search


Use local searx engine with curl whenever you need to look for online content.

Example :

```sh
curl 'http://localhost:8888/search?q=pi%20coding%20agent&format=json' | jq '.results.[] | {"title": .title, "url": .url, "content": .content}'
```

Use Wikidata when looking for factual with complex relationship data.
