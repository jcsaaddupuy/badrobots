---
name: duckdb
description: DuckDB patterns for JSON/JSONL analysis, array unnesting, and common gotchas. Use when querying JSON files, nested data, or encountering "UNNEST not supported here" errors.
---

# DuckDB Patterns

## JSONL Loading

```sql
-- Load multiple JSONL files with schema variations
SELECT * FROM read_ndjson('path/**/*.jsonl', 
    union_by_name=true,    -- Handle varying schemas across files
    filename=true          -- Include source file path
);
```

## Unnesting JSON Arrays

### Correct Pattern

```sql
-- Use (unnest(col)).field syntax for struct field access
SELECT 
    id,
    (unnest(message.content)).name as tool_name,
    (unnest(message.content)).type as content_type,
    (unnest(message.content)).arguments::VARCHAR as args
FROM sessions;
```

### Critical Gotcha: UNNEST in WHERE Clause

```sql
-- WRONG: UNNEST not supported in WHERE
SELECT * FROM t WHERE (unnest(col)).type = 'x';  -- ERROR!

-- CORRECT: Use temp table approach
CREATE TEMP TABLE extracted AS
SELECT id, (unnest(col)).field as f FROM source;

SELECT * FROM extracted WHERE f = 'x';
```

## Common Patterns

### Response-Level Aggregation

After unnesting, aggregate back to original entity:

```sql
-- Get dominant value per group (MODE)
SELECT id, 
    (SELECT value FROM unnested t2 
     WHERE t2.id = t1.id 
     GROUP BY value 
     ORDER BY COUNT(*) DESC 
     LIMIT 1) as dominant
FROM (SELECT DISTINCT id FROM source) t1;
```

### Text Matching in Arguments

Cast JSON arguments to VARCHAR for ILIKE:

```sql
-- JSON fields need casting for string matching
SELECT * FROM tools 
WHERE args::VARCHAR ILIKE '%pattern%';
```

### Handling NULL Struct Fields

```sql
-- Filter out NULL tool names from unnested arrays
WHERE tool_name IS NOT NULL AND content_type = 'toolCall'
```

## Memory Optimization

```sql
-- Drop temp tables when done with large datasets
DROP TABLE IF EXISTS temp_table;

-- Or use CREATE TEMP TABLE (auto-drops on session end)
CREATE TEMP TABLE intermediate AS
SELECT * FROM source WHERE condition;
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "UNNEST not supported here" | UNNEST in WHERE clause | Use temp table |
| "Table does not have column named 'x'" | Wrong struct access syntax | Use `(unnest(col)).field` |
| "Set operations require same columns" | UNION with mismatched columns | Align SELECT lists |
| JSON text not matching | Uncast JSON field | Cast to VARCHAR: `field::VARCHAR ILIKE` |