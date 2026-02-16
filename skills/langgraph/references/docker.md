# LangGraph Docker Configuration

## Dockerfile Example
Project should have a Dockerfile and a service in docker-compose.yml to run the LangGraph project.

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

## Docker Compose Example

Example docker-compose.yml for LangGraph development:
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
      - LANGGRAPH_STUDIO_URL=https://langsmith.foundry.ubisoft.org
      - LANGSMITH_API_KEY
      # openai
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
    ports:
      - "127.0.0.1:2024:2024"
    command: uv run --project project-name langgraph dev --studio-url https://langsmith.foundry.ubisoft.org --config project-name/langgraph.json --host 0.0.0.0 --no-browser --server-log-level DEBUG
    working_dir: /app
```
