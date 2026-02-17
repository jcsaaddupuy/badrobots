# Session Prompt: Generate Project Architecture Documentation

## Objective
Generate a concise, high-level architecture document for a multi-package repository that summarizes the role, dependencies, and relationships between Python projects.

## Instructions

1. **Discover Project Structure**
   - Find all Python packages in the repository (look for `pyproject.toml` or `setup.py`)
   - Identify the main/entry package
   - List all sub-packages and their locations

2. **Analyze Each Package**
   For each package, extract:
   - **Purpose**: What does this package do? (check README.md, pyproject.toml description)
   - **Key Dependencies**: Major external libraries (langchain, pandas, spacy, etc.)
   - **Role**: How does it fit in the overall architecture?
   - **Notes**: Any important caveats (scalability issues, POC status, etc.)

3. **Document Relationships**
   - Identify internal dependencies (which packages depend on which)
   - Map the data/control flow between packages
   - Note integration points

4. **Generate Documentation**
   Create a markdown file with:
   - Brief introduction explaining the repository's purpose
   - Section for each package with:
     - Name and purpose (1-2 sentences)
     - Key dependencies (bullet list)
     - Role in the system
     - Important notes/caveats
   - Architecture diagrams (Mermaid):
     - Data flow diagram (how user requests flow through the system)
     - Dependency graph (which packages depend on which)
   - Optional: Technology stack summary table

## Style Guidelines

- **Keep it simple**: Straight to the point, no fluff
- **Be concise**: 1-2 sentences per concept
- **Use clear structure**: Headers, bullet points, tables
- **Limit diagrams**: 1-2 Mermaid diagrams maximum
- **Highlight key info**: Dependencies, roles, caveats
- **Avoid verbosity**: This is a quick reference, not a manual

## Output Format

```markdown
# Project Architecture

[Brief introduction]

## Core Packages

### package-name
**Purpose**: [1-2 sentences]

**Key Dependencies**:
- dependency1 - purpose
- dependency2 - purpose

**Role**: [How it fits in the system]

**Note**: [Any caveats]

---

[Repeat for each package]

## Architecture Overview

[Mermaid diagram showing data flow]

## Dependency Flow

[Mermaid diagram showing package dependencies]

## Key Technology Stack

[Optional summary table]
```

## Key Points to Remember

- Focus on **what** each package does, not **how**
- Emphasize **relationships** between packages
- Call out **scalability concerns** or **POC status**
- Keep the document **scannable** - use formatting effectively
- Target audience: developers who need a quick understanding of the codebase

## Example Use Cases

- Onboarding new developers
- Planning refactoring efforts
- Understanding system boundaries
- Identifying technical debt
- Creating deployment documentation