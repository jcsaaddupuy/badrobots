# Python Security Rules

## Core Principle
- Shift security left: run security checks locally and in CI for every pull request.
- Fail the pipeline on high-confidence/high-severity findings.

## Mandatory Tooling

### 1) Bandit (SAST for Python code)
- Use `bandit` to detect insecure Python patterns.
- Run it recursively on source when relevant.
- Do not run bandit against unittests

Quick local scan:
```bash
uvx bandit -r src
uvx bandit -r .
```


CI-friendly JSON report:
```bash
uvx bandit -r src -f json -o reports/bandit.json
```

Recommended options:
- `-c pyproject.toml` to centralize config
- `-x` to exclude generated/vendor folders
- `-lll` to focus on high severity only when needed

Example:
```bash
uvx bandit -r src -c pyproject.toml -x .venv,build,dist
```

### 2) Dependency Vulnerability Scanning (`pip-audit`)
- Use `pip-audit` to detect known CVEs in dependencies.

If using `pyproject.toml` / lock-based workflow:
```bash
uvx pip-audit
```

With requirements file:
```bash
uvx pip-audit -r requirements.txt
```

## Strongly Recommended Tooling

### 3) Semgrep (security rules)
- Add `semgrep` for broader SAST coverage (framework misuse, injection patterns, etc.).

```bash
uvx semgrep --config p/security-audit src
```

### 4) Ruff security rules (`S`)
- Enable `ruff` security checks (Bandit-inspired rules) for fast feedback.

In `pyproject.toml`:
```toml
[tool.ruff.lint]
select = ["E", "F", "I", "S"]
```

Run:
```bash
uvx ruff check src tests
```

## CI Minimum Security Gate
Run all of the following in CI:

```bash
uvx bandit -r src -c pyproject.toml
uvx pip-audit
```

Optional extended gate:
```bash
uvx semgrep --config p/security-audit src
uvx ruff check src tests
```

## Secure Coding Expectations
- Never hardcode secrets in code, tests, fixtures, or notebooks.
- Use parameterized queries for SQL; never build SQL with string concatenation.
- Validate and sanitize all external input (API, CLI, files, env vars).
- Use `subprocess.run([...], check=True)` with argument lists (no `shell=True` unless justified).
- Prefer modern crypto primitives from trusted libraries (`cryptography`), never custom crypto.
- Keep dependencies pinned and updated; remove unused packages.

## Handling Findings
- Fix findings immediately when possible.
- If a finding is a false positive, document and suppress narrowly:
	- Bandit inline suppression: `# nosec` with a reason.
	- Prefer config-based targeted ignores over broad global ignores.
- Every suppression must include a clear justification in code review.