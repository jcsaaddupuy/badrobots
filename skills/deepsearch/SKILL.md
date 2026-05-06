---
name: deepsearch
description: "Deep research methodology: multi-hop investigation, iterative query refinement, and semantic knowledge synthesis. Use when solving complex problems requiring investigation across multiple sources, understanding API documentation, analyzing codebases, researching third-party services, or answering questions requiring cross-domain context."
---

# DeepSearch: Research Methodology for PI Agents

A research paradigm for iterative knowledge gathering and synthesis. Transforms vague research needs into structured multi-hop investigations.

## Core Algorithm

```
REPEAT until confidence(answer) > threshold:
  1. Decompose query into focused sub-questions
  2. Search each sub-question (web/local/memory)
  3. Extract & rank results by semantic relevance
  4. Build synthesis context from top results
  5. Generate partial answer → refine next query
```

## When to Use DeepSearch

**Single-hop research** (direct lookup): Skip deepsearch, use simple search tool.

**Multi-hop research**: Use deepsearch when:
- Question requires connecting multiple concepts (e.g., "How do I integrate RDF data from Wikidata into a pi skill?")
- Investigating unfamiliar systems/APIs/codebases
- Problem solving needs domain-specific knowledge first
- Cross-referencing multiple sources (standards, implementations, examples)

## Research Workflow

### 1. Query Decomposition
Parse research goal into atomic sub-questions targeting specific knowledge gaps:

```
Query: "Best RDF data sources for pi skill development"
→ Sub-questions:
   - What are high-value public RDF endpoints?
   - Which have SPARQL query support?
   - Which support federation?
   - What are typical use cases?
```

### 2. Iterative Search & Extraction
For each sub-question:

```bash
search_results = query_sources(sub_question, depth=context_needed)
ranked = semantic_rank(results, sub_question)  # Rank by relevance
extracted = extract_context(ranked[:N], query_intent)  # Top N results
```

Rank by: **semantic relevance > authority > freshness > depth**.

### 3. Context Building
Merge extracted knowledge into synthesis document:
- **Deduplicate**: Remove redundant facts across sources
- **Relate**: Link findings to original sub-questions
- **Tag gaps**: Note unanswered sub-questions for next iteration

### 4. Synthesis & Validation
Use LLM to synthesize partial answer:

```
answer = llm(context, original_query, synthesis_prompt)
confidence = evaluate(answer_completeness, gaps_remaining)
if confidence < threshold: refine_query() → iterate
```

## Search Modes

| Mode | Latency | Depth | Use Case |
|------|---------|-------|----------|
| **Quick** | <2s | Surface-level | Known problem domain, focused query |
| **Pro** | <10s | Multi-hop | Unknown domain, complex synthesis needed |
| **Deep** | <30s | Exhaustive | Novel research, high confidence required |

## Key Principles

1. **Query precision**: Specific queries yield better results than broad ones
2. **Semantic ranking**: Prioritize semantic match over keyword match
3. **Early stopping**: Gather confidence first, then deep-dive if needed
4. **Source diversity**: Prefer multiple weak sources over single strong source
5. **Feedback loops**: Failed synthesis → query refinement → re-search

## Integration with PI

When called from pi agent, follow this pattern:

```
1. Identify research need (multi-hop vs single-hop)
2. memory.recall(query) → check for cached knowledge
3. decompose(query) → sub-questions
4. LOOP: search(sub_q) → extract() → rank() → synthesize()
5. memory.remember(key_findings) → persist for future queries
6. Return synthesized answer + source references
```

## Common Patterns

**API Integration Research**:
→ Decompose: purpose | auth method | endpoints | examples | limitations

**Codebase Understanding**:
→ Decompose: architecture | key modules | entry points | patterns | test examples

**Standard/Format Investigation**:
→ Decompose: specification | implementations | tools | community | adoption

**Problem Solving**:
→ Decompose: problem statement | existing solutions | tradeoffs | recommendations

## Output Format

Always return:
- **Synthesized answer**: Multi-paragraph response addressing original query
- **Source map**: Question → sources that answered it
- **Confidence**: Estimated answer quality (high/medium/low)
- **Gaps**: Unanswered sub-questions for follow-up
- **References**: Ranked list of sources used

---

**Paradigm**: Inspired by OpenDeepSearch (Sentient AGI) multi-hop reasoning architecture  
**Best for**: Complex problem-solving, unfamiliar domains, high-fidelity research
