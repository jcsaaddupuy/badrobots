---
name: elements-of-style
description: "Apply Kernighan & Plauger's programming style principles when writing, reviewing, refactoring, debugging, or optimizing code. Trigger on any code quality, readability, or style review request."
---

# The Elements of Programming Style

Apply Kernighan & Plauger's principles when working with code. The core idea: **programs should be written for humans to read, not just for compilers to accept.**

## Quick Reference by Activity

### When Writing Code

**Clarity first:**
- Write clearly — don't be too clever. Clever code is hard to maintain.
- Say what you mean, simply and directly. The obvious way is usually right.
- Parenthesize to avoid ambiguity. Don't make the reader guess precedence.
- If a logical expression is hard to understand, transform it (De Morgan's laws, etc.).
- Avoid unnecessary branches. Simplify conditionals.
- Avoid gotos completely if you can keep the program readable.

**Structure:**
- Modularize. Use procedures and functions with single responsibilities.
- Use library functions whenever feasible. Don't reinvent.
- Replace repetitive expressions by calls to common functions.
- Avoid too many temporary variables — they clutter the namespace.
- Use recursive procedures for recursively defined data structures.

**Naming & formatting:**
- Choose variable names that won't be confused with each other.
- Use variable names that mean something in the problem domain.
- Use statement labels that mean something (if labels are needed at all).
- Format a program to help the reader understand its structure.
- Document your data layouts — data structures need explanation.

**Data & state:**
- Choose a data representation that makes the program simple.
- Make sure all variables are initialized before use.
- Make sure your code does "nothing" gracefully (empty inputs, edge cases).

### When Reviewing Code

**Check each principle above, plus:**

**Comments:**
- Make sure comments and code agree. Stale comments are worse than none.
- Don't just echo the code with comments — make every comment count.
- Don't comment bad code — rewrite it instead.
- Don't over-comment. Clear code needs fewer comments.

**Correctness:**
- Watch out for off-by-one errors. Check loop bounds.
- Take care to branch the right way on equality.
- Be careful if a loop exits to the same place from the middle and the bottom.
- Make sure special cases are truly special, not just rare.

**Input/Output:**
- Make input easy to prepare and output self-explanatory.
- Use uniform input formats.
- Make input easy to proofread.
- Use self-identifying input. Allow defaults. Echo both on output.
- Terminate input by end-of-file marker, not by count.

### When Debugging

- Test input for plausibility and validity. Garbage in, garbage out.
- Make sure input doesn't violate the limits of the program.
- Identify bad input; recover if possible.
- Don't stop at one bug. Fix one, look for the next.
- Use debugging compilers and tools (linters, type checkers, sanitizers).
- Test programs at their boundary values.
- Check some answers by hand. Verify with small known cases.
- **10.0 times 0.1 is hardly ever 1.0** — floating point is approximate.
- **7/8 is zero while 7.0/8.0 is not zero** — know your type system.
- Don't compare floating point numbers solely for equality. Use epsilon.

### When Optimizing

**Order of priorities:**
1. Make it right before you make it faster.
2. Make it fail-safe before you make it faster.
3. Make it clear before you make it faster.
4. Don't sacrifice clarity for small gains in efficiency.

**How to optimize:**
- Let the machine do the dirty work. Trust your tools.
- Let your compiler do the simple optimizations. Don't hand-optimize what the compiler handles.
- Keep it simple to make it faster. Simple code is easier for compilers and humans.
- Don't diddle code to make it faster — find a better algorithm instead.
- Instrument your programs. Measure before making efficiency changes.

### When Refactoring

- Don't patch bad code — rewrite it. Patching compounds the mess.
- Write first in easy-to-understand pseudo language; then translate.
- Write and test a big program in small pieces. Incremental.
- Don't strain to re-use code; reorganize instead. Forcing reuse creates abstractions that don't fit.
- Make sure special cases are truly special. Don't add branches for things that should be the norm.

## The Core Philosophy

The book's title pays homage to Strunk & White's "The Elements of Style" — the same principles apply to code as to prose:

> **Omit needless words. Omit needless code.**
> **Make every statement count.**
> **Write for the reader, not the writer.**

When in doubt, ask: *"Will I understand this code in six months? Will someone else?"*
