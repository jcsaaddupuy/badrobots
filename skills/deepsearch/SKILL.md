---
name: deepsearch
description: "Deep research methodology: multi-hop investigation, iterative query refinement, and semantic knowledge synthesis. Use when solving complex problems requiring investigation across multiple sources, understanding API documentation, analyzing codebases, researching third-party services, or answering questions requiring cross-domain context."
---

# DeepSearch: Research Methodology for PI Agents

A research paradigm for iterative knowledge gathering and synthesis. Transforms vague research needs into structured multi-hop investigations.

## Core Algorithm

```
REPEAT until confidence(answer) > threshold:
  1. Check memory for cached knowledge
  2. Decompose query into focused sub-questions
  3. Select search mode (Quick/Pro/Deep)
  4. FOR each sub-question:
     a. Search sources (web/local)
     b. Extract & rank results by semantic relevance
     c. IF bookmarking skill available: bookmark + annotate key findings
     d. Detect pivot triggers (findings contradicting assumptions)
  5. Build synthesis context from top results
  6. Generate partial answer → evaluate confidence
  7. IF confidence < threshold: refine queries → iterate
  8. Store key findings in memory
```

## When to Use DeepSearch

**Single-hop research** (direct lookup): Skip deepsearch, use simple search tool.

**Multi-hop research**: Use deepsearch when:
- Question requires connecting multiple concepts
- Investigating unfamiliar systems/APIs/codebases
- Problem solving needs domain-specific knowledge first
- Cross-referencing multiple sources (standards, implementations, pricing, availability)
- Finding "best" options requires comparing across multiple dimensions

**Examples**:
- "Best laptop for machine learning under $2000" → Compare specs, prices, reviews across vendors
- "How to integrate Wikidata into a pi skill" → Find API docs, examples, existing implementations
- "Which open-source smartwatch OS has best support" → Compare features, hardware support, community
- "Evaluate cloud providers for enterprise migration" → Compare pricing, compliance, support SLAs

## Research Workflow

### 0. Memory Check (Always First)

Use the memory tool to recall cached knowledge:
```
memory action=recall query="<topic from query>"
```
- If high-quality results found → skip or narrow research scope
- If no results → proceed with full research

**Example**: Searching "best hackable smartwatch" → check memory first
- Found: cached comparison → focus on new aspects only
- Not found: proceed with full research

### 1. Mode Selection

Choose search mode BEFORE starting:

| Query Type | Mode | Reason |
|------------|------|--------|
| Product comparison (3-5 options) | Pro (<10s) | Multiple alternatives to compare |
| Finding "best" option | Deep (<30s) | Exhaustive search needed |
| Factual lookup | Quick (<2s) | Direct answer expected |
| Pricing/availability | Pro | Multiple sources to check |

### 2. Query Decomposition
Parse research goal into atomic sub-questions targeting specific knowledge gaps:

```
Query: "Best laptop for ML under $2000"
→ Sub-questions:
   - Which laptops have good GPU options in this range?
   - What are the performance benchmarks?
   - Which are available in my region?
   - What do reviews say about build quality?

Query: "Best hackable smartwatch at best price"
→ Sub-questions:
   - Which smartwatches support open-source OS?
   - What is the feature support for each?
   - Which are available new vs used?
   - What are the prices at different retailers?
```

### 3. Iterative Search & Extraction

**Parallel Searches**: When sub-questions are independent, run searches concurrently:

```
# Independent queries - run at the same time:
- Search "laptop GPU benchmarks"
- Search "RTX 4060 laptop pricing"
- Search "ML laptop recommendations 2025"

# Dependent queries - must be sequential:
1. Search "smartwatch OS options"      → First: discover what exists
2. Then: search pricing for specific models found
```

**Web Search Approaches**:
- Local search engine (Searx, Kagi, etc.)
- Domain-specific sources (official docs, GitHub, wikis)
- Comparison sites (pricing aggregators, review sites)

For each sub-question:
1. Query relevant sources (web, docs, memory)
2. Extract key facts from top N results
3. Rank by semantic relevance to the question

Rank by: **semantic relevance > authority > freshness > depth**.

### 3b. Bookmarking During Search (If Skill Available)

**When bookmarking skill (e.g., readeck) is available:**

```markdown
FOR each search iteration:
  1. Identify key sources (official docs, comparisons, pricing pages)
  2. Bookmark immediately with labels: [topic, research, source-type]
  3. FOR critical findings:
     - Add annotation with relevance note
     - Example note: "BEST OPTION: Price €268, feature X works, Y doesn't"
```

**Labels to use**:
- Primary topic (e.g., "smartwatch", "laptop")
- Research type (e.g., "features", "pricing", "comparison")
- Priority (e.g., "must-read", "reference")

**Annotate immediately, not at end** - context is clearer during search.

### 3c. Pivot Detection

**When findings contradict assumptions, pivot strategy:**

| Finding | Pivot Action | Example |
|---------|--------------|---------|
| Product discontinued | Switch to: used prices, alternatives, newer models | "TicWatch Pro 2018" discontinued → search used/refurbished |
| Feature not supported | Switch to: compare alternatives immediately | "No GPS on this model" → skip, check others |
| Price out of range | Switch to: budget options, older models | €500 → search €200-300 range |
| Only available used | Add: "used/refurb" to all subsequent queries | New not available → pivot to used market |

### 4. Context Building
Merge extracted knowledge into synthesis document:
- **Deduplicate**: Remove redundant facts across sources
- **Relate**: Link findings to original sub-questions
- **Tag gaps**: Note unanswered sub-questions for next iteration
- **Track sources**: Maintain source → finding mapping

### 5. Synthesis & Confidence Evaluation

Synthesize findings into a coherent answer addressing the original query.

**Evaluate confidence by checking**:
- Are all sub-questions answered?
- Do multiple sources agree on key points?
- Are there gaps in the information?

IF confidence is low:
1. Identify what's missing
2. Refine queries based on gaps
3. Return to step 3 (search again)

**Confidence levels**:
- HIGH: All sub-questions answered, multiple sources agree, no gaps
- MEDIUM: Most sub-questions answered, some gaps, single-source claims
- LOW: Key questions unanswered, conflicting information, major gaps

### 6. Memory Storage

Store non-obvious findings for future use using the memory tool:

```
memory action=remember
  content="Key findings (not task logs)"
  type="conceptual"
  tags="topic,subtopic"
  context="gotcha|decision|constraint"
```

**Store**: Gotchas, decisions, constraints, non-obvious facts
**Don't store**: Task logs, TODO status, session summaries, obvious facts



## Key Principles

1. **Memory first**: Always check cached knowledge before searching
2. **Query precision**: Specific queries yield better results than broad ones
3. **Semantic ranking**: Prioritize semantic match over keyword match
4. **Bookmark during search**: Annotate key findings immediately, not at end
5. **Pivot on contradictions**: When findings contradict assumptions, change strategy
6. **Parallel when possible**: Run independent searches concurrently
7. **Source diversity**: Prefer multiple weak sources over single strong source
8. **Confidence tracking**: Evaluate completeness, identify gaps explicitly
9. **Feedback loops**: Failed synthesis → query refinement → re-search



## Common Patterns

**Product/Option Comparison**:
→ Decompose: options available | feature comparison | pricing | availability | reviews
→ Pivot if: discontinued, out of stock, price out of range
→ Bookmark: comparison tables, pricing pages, official specs

**API/Service Integration**:
→ Decompose: purpose | auth method | endpoints | examples | rate limits | limitations
→ Bookmark: official docs, authentication guides, SDK references

**Codebase Understanding**:
→ Decompose: architecture | key modules | entry points | patterns | test examples

**Standard/Format Investigation**:
→ Decompose: specification | implementations | tools | community | adoption

**Vendor/Service Evaluation**:
→ Decompose: capabilities | pricing models | compliance | support SLAs | migration paths
→ Pivot if: vendor discontinued, pricing model changed, compliance gaps
→ Bookmark: pricing pages, SLA docs, compliance certifications

**Problem Solving**:
→ Decompose: problem statement | existing solutions | tradeoffs | recommendations

## Output Format

Always return:

### Synthesized Answer
[2-3 paragraphs addressing original query with actionable recommendations]

### Source Map
| Sub-question | Sources Used |
|--------------|---------------|
| [Sub-q 1] | [source1, source2] |
| [Sub-q 2] | [source3, source4] |

### Confidence: [HIGH/MEDIUM/LOW]
**Reason**: [Why this confidence level]

### Gaps
- [Unanswered sub-question 1]
- [Unanswered sub-question 2]

### Bookmarks (If Applicable)
- [Number] sources bookmarked with labels
- [Number] annotations added
- Key annotations: [list 2-3 most important]

---

**Paradigm**: Inspired by OpenDeepSearch (Sentient AGI) multi-hop reasoning architecture  
**Best for**: Complex problem-solving, unfamiliar domains, high-fidelity research

## Examples

**Example 1: Evaluate cloud providers for enterprise data migration**

```
Mode: Deep (enterprise decision, high stakes)

Decomposition:
1. Which cloud providers support our compliance requirements (GDPR, SOC2)?
2. What are the data transfer and storage costs?
3. What migration tools and support are available?
4. What are the SLAs for uptime and support response?

Parallel searches: Compliance certifications, pricing calculators, migration guides
Pivot detected: Provider A doesn't support required encryption standard
→ Removed Provider A from comparison
→ Added security audit reports to search

Bookmarks: Official docs, pricing pages, compliance whitepapers
Confidence: HIGH (multiple official sources, clear pricing)
```

**Example 2: Best hackable smartwatch at best price**

```
Mode: Deep (exhaustive search for "best")

Decomposition:
1. Which smartwatches support open-source OS?
2. What are the feature ratings for each?
3. Which are available NEW vs USED?
4. What are the prices?

Pivot detected: Best option (TicWatch Pro) discontinued
→ Added "used/refurbished" to all subsequent queries
→ Compared NEW alternatives with worse support

Bookmarks: 15 pages, 8 annotations
Confidence: MEDIUM (price volatility, availability changes)
```

**Example 3: Best laptop for ML under $2000**

```
Mode: Pro (compare 3-5 options)

Decomposition:
1. Which laptops have RTX GPUs under $2000?
2. What are the performance benchmarks?
3. Which have good Linux support?
4. What are Thermals/build quality?

Parallel searches: GPU benchmarks, pricing, Linux support
Pivot: None needed

Bookmarks: 12 pages, 5 annotations
Confidence: HIGH (multiple agreeing sources)
```

**Example 4: Choose logging framework for microservices architecture**

```
Mode: Pro (compare architecture decisions)

Decomposition:
1. Which logging frameworks support distributed tracing?
2. What are the performance impacts (latency, throughput)?
3. Which integrate with our tech stack (Kubernetes, Prometheus)?
4. What are the operational costs (self-hosted vs SaaS)?

Pivot detected: Framework A requires paid enterprise features for tracing
→ Added open-source alternatives to comparison
→ Searched for self-hosted vs SaaS cost comparisons

Bookmarks: Official docs, benchmark comparisons, integration guides
Confidence: MEDIUM (operational cost estimates vary significantly)
```
