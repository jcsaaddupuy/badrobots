# Python Docker Integration

## Compiled Dependencies
- Use Rust and Maturin for compiled Python extensions
- Prefer Debian-based images for building Rust compiled dependencies

## Python Project Dockerfile
Project should have a Dockerfile and a service in docker-compose.yml to run the project.

Example Dockerfile for development:
```Dockerfile
# dev image only, disable Pin versions in apk add 
# hadolint global ignore=DL3018
FROM rust:alpine as base

SHELL ["/bin/sh", "-o", "pipefail", "-c"]

RUN apk update && apk add --no-cache python3 py3-pip curl git
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
RUN apk update && apk add --no-cache git build-base musl-dev libffi-dev rust cargo
ENV PATH="/root/.local/bin/:$PATH"

FROM base AS project-name
WORKDIR /app
COPY project-name /app/project-name

RUN uv install --deps-only --with 'maturin,uv-cython' --with /app/project-name
```

Example docker-compose.yml:
```yaml
services:
  project-name:
    build:
      dockerfile: dockerfiles/Dockerfile.dev
      target: project-name
    volumes:
      - .:/app
    environment:
      - PYTHONPATH=/app/project-name/src
      - UV_LINK_MODE=copy
      # openai
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
    ports:
      - "127.0.0.1:8080:8080"
    command: uv run --project project-name python -m project-name
    working_dir: /app
```
