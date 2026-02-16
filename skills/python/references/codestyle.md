---
name: python-codestyle
description: Guide for coding conventions for the Python code.
---


# Python Code Style (PEP 8 & PEP 20)

Industry-standard Python code style guidelines based on PEP 8 and the Zen of Python (PEP 20).

## The Zen of Python (PEP 20)

Guiding principles for Python code design by Tim Peters:

1. **Beautiful is better than ugly.**
2. **Explicit is better than implicit.**
3. **Simple is better than complex.**
4. **Complex is better than complicated.**
5. **Flat is better than nested.**
6. **Sparse is better than dense.**
7. **Readability counts.**
8. **Special cases aren't special enough to break the rules.**
9. **Although practicality beats purity.**
10. **Errors should never pass silently.**
11. **Unless explicitly silenced.**
12. **In the face of ambiguity, refuse the temptation to guess.**
13. **There should be one-- and preferably only one --obvious way to do it.**
14. **Although that way may not be obvious at first unless you're Dutch.**
15. **Now is better than never.**
16. **Although never is often better than *right* now.**
17. **If the implementation is hard to explain, it's a bad idea.**
18. **If the implementation is easy to explain, it may be a good idea.**
19. **Namespaces are one honking great idea -- let's do more of those!**

*Access via: `import this`*

### Key Takeaways for Code Style

- **Readability counts**: Clear code is better than clever code
- **Explicit is better than implicit**: Be clear about intentions
- **Simple is better than complex**: Favor straightforward solutions
- **Errors should never pass silently**: Handle exceptions explicitly
- **One obvious way to do it**: Follow established patterns and conventions

## Core Principle

**Code is read more often than written.** Prioritize readability and consistency.

### Consistency Hierarchy
1. Consistency within a module/function (most important)
2. Consistency within a project
3. Consistency with PEP 8

## Code Layout

### Indentation
- Use **4 spaces** per indentation level
- Never mix tabs and spaces
- Continuation lines: align with opening delimiter or use hanging indent

```python
# Aligned with opening delimiter
result = function_name(arg_one, arg_two,
                      arg_three, arg_four)

# Hanging indent (no args on first line)
result = function_name(
    arg_one, arg_two,
    arg_three, arg_four)

# Function definitions with extra indentation
def long_function_name(
        var_one, var_two, var_three,
        var_four):
    print(var_one)
```

### Line Length
- **Maximum 79 characters** for code
- **Maximum 72 characters** for comments and docstrings
- Teams may use up to 99 characters for code if agreed
- Use implicit line continuation (parentheses) over backslashes

```python
# Preferred: implicit continuation
with open('/path/to/file') as file_1, \
     open('/path/to/other/file', 'w') as file_2:
    file_2.write(file_1.read())
```

### Binary Operators
- Break **before** binary operators (Knuth's style)

```python
# Correct
income = (gross_wages
          + taxable_interest
          + (dividends - qualified_dividends)
          - ira_deduction
          - student_loan_interest)
```

### Blank Lines
- **2 blank lines** around top-level functions and classes
- **1 blank line** around method definitions inside classes
- Use blank lines sparingly within functions to indicate logical sections

### Imports
- Always at the top of the file (after docstring, before globals)
- Each import on separate line (except `from X import A, B`)
- Group in order: standard library, third-party, local application
- Separate groups with blank line
- Prefer absolute imports over relative

```python
"""Module docstring."""

from __future__ import annotations

__version__ = '1.0'
__author__ = 'Name'

import os
import sys

from third_party import package

from . import local_module
```

### Module-Level Dunders
Order: docstring → `__future__` → dunders → imports

## Whitespace Rules

### Avoid Extraneous Whitespace

```python
# Correct
spam(ham[1], {eggs: 2})
foo = (0,)
if x == 4: print(x, y); x, y = y, x

# Wrong
spam( ham[ 1 ], { eggs: 2 } )
bar = (0, )
if x == 4 : print(x , y) ; x , y = y , x
```

### Slices
```python
# Correct
ham[1:9], ham[1:9:3], ham[:9:3], ham[1::3]
ham[lower:upper], ham[lower+offset : upper+offset]

# Wrong
ham[lower + offset:upper + offset]
ham[1: 9], ham[1 :9]
```

### Operators
- Always surround with single space: `=`, `+=`, `==`, `<`, `>`, `!=`, `is`, `is not`, `and`, `or`
- Lower-priority operators may omit spaces

```python
# Correct
i = i + 1
x = x*2 - 1
hypot2 = x*x + y*y
c = (a+b) * (a-b)

# Wrong
i=i+1
x = x * 2 - 1
```

### Function Annotations
```python
# Correct
def munge(input: AnyStr) -> PosInt:
    ...

# With default value (spaces around =)
def munge(sep: AnyStr = None) -> AnyStr:
    ...

# Wrong
def munge(input:AnyStr)->PosInt:
    ...
```

### Keyword Arguments
```python
# Correct (no spaces)
def complex(real, imag=0.0):
    return magic(r=real, i=imag)

# Wrong
def complex(real, imag = 0.0):
    return magic(r = real, i = imag)
```

## Naming Conventions

### Styles Overview
- `lowercase`
- `lower_case_with_underscores`
- `UPPERCASE`
- `UPPER_CASE_WITH_UNDERSCORES`
- `CapitalizedWords` (CapWords/CamelCase)
- `_single_leading_underscore` (internal use indicator)
- `single_trailing_underscore_` (avoid keyword conflicts)
- `__double_leading_underscore` (name mangling in classes)
- `__double_leading_and_trailing__` (magic methods)

### Naming Rules

| Item | Convention | Example |
|------|------------|---------|
| Packages | lowercase, no underscores | `mypackage` |
| Modules | lowercase, underscores OK | `my_module` |
| Classes | CapWords | `MyClass` |
| Exceptions | CapWords + "Error" suffix | `ValueError` |
| Functions | lowercase_with_underscores | `my_function` |
| Variables | lowercase_with_underscores | `my_variable` |
| Constants | UPPER_CASE_WITH_UNDERSCORES | `MAX_OVERFLOW` |
| Methods | lowercase_with_underscores | `my_method` |
| Type variables | CapWords, short | `T`, `AnyStr` |

### Special Arguments
- **First argument** to instance methods: `self`
- **First argument** to class methods: `cls`
- Keyword conflicts: append `_` (e.g., `class_`)

### Private/Public
- **Public**: no leading underscore
- **Non-public**: single leading underscore `_internal`
- **Name mangling** (avoid subclass conflicts): double leading `__mangled`

### Characters to Avoid
Never use single characters: `l` (lowercase L), `O` (uppercase o), `I` (uppercase i)

## Comments

### General
- Keep comments up-to-date with code changes
- Complete sentences, capitalize first word
- Comments in English (unless 120% sure code won't be read by non-speakers)

### Block Comments
- Same indentation as code
- Start with `#` and single space
- Separate paragraphs with `#` line

### Inline Comments
- Use sparingly
- At least 2 spaces from statement
- Start with `#` and single space
- Avoid stating the obvious

```python
# Bad
x = x + 1  # Increment x

# OK
x = x + 1  # Compensate for border
```

### Docstrings
- All public modules, functions, classes, and methods
- Use triple double quotes `"""`
- One-liners: closing `"""` on same line
- Multi-line: closing `"""` on separate line

```python
def simple():
    """Return an ex-parrot."""
    
def complex():
    """Do something complex.
    
    This does many things including
    frobnication of the bizbaz.
    """
```

## String Quotes

- Single `'` or double `"` quotes are equivalent—pick one and be consistent
- Triple-quoted strings: always use `"""` (per PEP 257)

## Programming Recommendations

### Comparisons
```python
# Singletons: use 'is', not ==
if x is None:
if x is not None:

# Type checking
if isinstance(obj, int):  # Correct
if type(obj) is type(1):  # Wrong
```

### Sequences
```python
# Use truthiness for empty checks
if not seq:  # Correct
if len(seq) == 0:  # Wrong
```

### Booleans
```python
# Don't compare to True/False
if greeting:  # Correct
if greeting == True:  # Wrong
if greeting is True:  # Worse
```

### String Methods
```python
# Use startswith/endswith
if foo.startswith('bar'):  # Correct
if foo[:3] == 'bar':  # Wrong
```

### Functions
```python
# Use def, not lambda assignment
def f(x): return 2*x  # Correct
f = lambda x: 2*x  # Wrong
```

### Exceptions
- Derive from `Exception`, not `BaseException`
- Catch specific exceptions
- Limit `try` clause to minimum code
- Use `with` for resource management

```python
# Correct
try:
    value = collection[key]
except KeyError:
    return key_not_found(key)
else:
    return handle_value(value)

# Wrong: too broad
try:
    return handle_value(collection[key])
except KeyError:
    return key_not_found(key)
```

### Return Statements
- Be consistent: all return expressions or all return None explicitly

```python
# Correct
def foo(x):
    if x >= 0:
        return math.sqrt(x)
    else:
        return None

# Wrong
def foo(x):
    if x >= 0:
        return math.sqrt(x)
```

### Context Managers
```python
# Use with statement for resources
with open('/path/to/file') as f:
    data = f.read()
```

## Type Hints (PEP 484)

### Function Annotations
```python
def greeting(name: str) -> str:
    return f'Hello {name}'

# With defaults
def repeat(message: str, times: int = 1) -> None:
    print(message * times)
```

### Variable Annotations
```python
# Module/class level
code: int
label: str = '<unknown>'

# Correct spacing
code: int  # Space after colon
code: int = 42  # Spaces around =

# Wrong
code:int  # No space
code : int  # Space before colon
code: int=42  # No spaces around =
```

## When to Break the Rules

1. Applying the guideline makes code **less readable**
2. **Consistency** with surrounding code (but consider cleanup)
3. Code **predates** the guideline
4. **Backward compatibility** with older Python versions
5. **Project-specific** guidelines take precedence

## Quick Checklist

- [ ] 4-space indentation (no tabs)
- [ ] Lines ≤79 characters (≤72 for comments)
- [ ] 2 blank lines between top-level definitions
- [ ] Imports grouped and at top
- [ ] `CapWords` for classes, `lowercase_underscore` for functions/variables
- [ ] `UPPER_CASE` for constants
- [ ] Docstrings for all public APIs
- [ ] `is`/`is not` for singletons (None, True, False)
- [ ] Specific exception catching
- [ ] Consistent return statements
- [ ] Type hints where helpful
