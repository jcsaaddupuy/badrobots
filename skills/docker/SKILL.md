---
name: docker
description: "Docker and Docker Compose reference guide"
---

# Docker - Agent Usage Guide

## Critical Reference Files
**IMPORTANT**: Before working with Docker, read these reference files:

- [Core Rules](references/core-rules.md) - Build requirements, proxy config, SSL certificates, validation

## Core Concept
Docker containerizes applications for consistent deployment across environments. Use it to package code, dependencies, and runtime into portable containers.

## Critical Principles

1. **Multi-stage builds** for smaller production images (see [references/core-rules.md](references/core-rules.md))
2. **Non-root users** for security
3. **Layer caching** optimization for faster builds
4. **Health checks** for container monitoring
5. **Secrets via environment variables** never hardcode in images
6. **Proxy configuration** as build args (see [references/core-rules.md](references/core-rules.md))
7. **SSL certificates** for corporate environments (see [references/core-rules.md](references/core-rules.md))

## Decision Tree: What to create?

**First**: Read [references/core-rules.md](references/core-rules.md) for build requirements and validation rules.

### When user needs a NEW Dockerfile:
- **Python app** → Multi-stage build with uv (see [../python/SKILL.md](../python/SKILL.md))
- **Node.js app** → Multi-stage with npm/yarn
- **Static site** → Nginx-based image
- **Development** → Mount volumes, hot reload
- **Production** → Distroless/Alpine base, non-root user

### When user needs Docker Compose:
- **Multi-service app** → Define all services
- **Database + App** → Include health checks, depends_on
- **Development environment** → Volume mounts, env files
- **Testing** → Separate service for tests

### When user needs to RUN containers:
- **Single container** → `docker run`
- **Multiple services** → `docker compose up`
- **Background services** → Add `-d` flag
- **Interactive session** → Add `-it` flags

### Before building/deploying:
1. **Validate** Dockerfile with hadolint (see [references/core-rules.md](references/core-rules.md))
2. **Test** build process works
3. **Verify** all stages compile
4. **Check** proxy and SSL configuration

## Dockerfile Patterns

### Python Application (with uv)
```dockerfile
# Multi-stage build for Python with uv
FROM python:3.12-slim as builder

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies (frozen lock)
RUN uv sync --frozen --no-dev

# Production stage
FROM python:3.12-slim

# Create non-root user
RUN useradd -m -u 1000 appuser

# Set working directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Expose port
EXPOSE 8000

# Run application
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Python Development Dockerfile
```dockerfile
FROM python:3.12-slim

# Install uv
RUN pip install uv

# Create non-root user
RUN useradd -m -u 1000 devuser

WORKDIR /app

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync

# Switch to non-root user
USER devuser

# Mount source code via volume
# Hot reload enabled

ENV PATH="/app/.venv/bin:$PATH"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Node.js Application
```dockerfile
# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

WORKDIR /app

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy application
COPY --chown=appuser:appuser . .

USER appuser

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node healthcheck.js || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
```

### Static Site (Nginx)
```dockerfile
# Build stage
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Run as non-root (nginx user exists)
USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Docker Compose Patterns

### Python App + PostgreSQL
```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME:-myapp}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@db:5432/${DB_NAME:-myapp}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

### Development Environment with Hot Reload
```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp_dev
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DEBUG: "true"
    ports:
      - "8000:8000"
    volumes:
      # Mount source code for hot reload
      - ./src:/app/src
      - ./tests:/app/tests
    depends_on:
      - db
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

volumes:
  postgres_dev_data:
```

### Testing Environment
```yaml
version: '3.8'

services:
  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      DATABASE_URL: postgresql://test_user:test_pass@test-db:5432/test_db
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - test-db
    volumes:
      - ./src:/app/src
      - ./tests:/app/tests
      - ./htmlcov:/app/htmlcov  # Coverage reports
    command: ["pytest", "--cov=src", "--cov-report=html"]
```

### Multi-Service Application
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/myapp
      REDIS_URL: redis://redis:6379
      OPENAI_BASE_URL: ${OPENAI_BASE_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
```

## Command Templates

### Building Images
```bash
# Build image with tag
docker build -t myapp:latest .

# Build with specific Dockerfile
docker build -f Dockerfile.dev -t myapp:dev .

# Build with build args
docker build --build-arg PYTHON_VERSION=3.12 -t myapp:latest .

# Build without cache
docker build --no-cache -t myapp:latest .

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .
```

### Running Containers
```bash
# Run container interactively
docker run -it myapp:latest /bin/bash

# Run in background (detached)
docker run -d -p 8000:8000 myapp:latest

# Run with environment variables
docker run -e DATABASE_URL=postgres://... -p 8000:8000 myapp:latest

# Run with volume mount
docker run -v $(pwd)/data:/app/data -p 8000:8000 myapp:latest

# Run with env file
docker run --env-file .env -p 8000:8000 myapp:latest

# Run with network
docker run --network my-network -p 8000:8000 myapp:latest

# Run with name
docker run --name myapp-container -p 8000:8000 myapp:latest

# Run with auto-remove
docker run --rm -p 8000:8000 myapp:latest
```

### Docker Compose Commands
```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Build and start
docker compose up --build

# Start specific service
docker compose up app

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# View logs
docker compose logs

# Follow logs
docker compose logs -f

# Logs for specific service
docker compose logs -f app

# Execute command in running service
docker compose exec app python manage.py migrate

# Run one-off command
docker compose run --rm app pytest

# Rebuild specific service
docker compose build app

# Scale service
docker compose up -d --scale app=3
```

### Container Management
```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Stop container
docker stop <container-id>

# Start stopped container
docker start <container-id>

# Restart container
docker restart <container-id>

# Remove container
docker rm <container-id>

# Force remove running container
docker rm -f <container-id>

# View container logs
docker logs <container-id>

# Follow logs
docker logs -f <container-id>

# Execute command in running container
docker exec -it <container-id> /bin/bash

# Copy files to/from container
docker cp file.txt <container-id>:/app/
docker cp <container-id>:/app/output.txt ./

# Inspect container
docker inspect <container-id>

# View container stats
docker stats
```

### Image Management
```bash
# List images
docker images

# Remove image
docker rmi myapp:latest

# Remove unused images
docker image prune

# Remove all unused images
docker image prune -a

# Tag image
docker tag myapp:latest myapp:v1.0.0

# Push to registry
docker push myregistry/myapp:latest

# Pull from registry
docker pull myregistry/myapp:latest

# Save image to tar
docker save myapp:latest -o myapp.tar

# Load image from tar
docker load -i myapp.tar
```

### Volume Management
```bash
# List volumes
docker volume ls

# Create volume
docker volume create mydata

# Inspect volume
docker volume inspect mydata
```

### Network Management
```bash
# List networks
docker network ls

# Create network
docker network create my-network

# Inspect network
docker network inspect my-network

# Connect container to network
docker network connect my-network <container-id>

# Disconnect container from network
docker network disconnect my-network <container-id>

```

## Dockerfile Best Practices

### Layer Optimization
```dockerfile
# ✅ GOOD - Specific copy, better caching
COPY pyproject.toml uv.lock ./
RUN uv sync
COPY src/ ./src/

# ❌ BAD - Copies everything, breaks cache
COPY . .
RUN uv sync
```

### Security
```dockerfile
# ✅ GOOD - Non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# ❌ BAD - Runs as root
# No USER directive
```

### Image Size
```dockerfile
# ✅ GOOD - Multi-stage build
FROM python:3.12 as builder
RUN pip install uv && uv sync
FROM python:3.12-slim
COPY --from=builder /app/.venv /app/.venv

# ❌ BAD - Large base image with build tools
FROM python:3.12
RUN apt-get update && apt-get install -y build-essential
```

### Environment Variables
```dockerfile
# ✅ GOOD - Use ENV, document
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# ❌ BAD - Hardcoded secrets
ENV API_KEY="secret-key-123"
```

## Validation and Linting

### Hadolint (Dockerfile Linter)
```bash
# Lint Dockerfile
hadolint Dockerfile

# Lint with specific rules
hadolint --ignore DL3008 Dockerfile

# Output as JSON
hadolint --format json Dockerfile

# Lint all Dockerfiles
find . -name "Dockerfile*" -exec hadolint {} \;
```

### Docker Compose Validation
```bash
# Validate compose file
docker compose config

# Validate and view merged config
docker compose config --services

# Check for errors
docker compose config --quiet
```

## Health Checks

### HTTP Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
```

### Python Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1
```

### Database Health Check
```dockerfile
# In docker-compose.yml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## Environment Variable Patterns

### .env File
```bash
# .env (not committed)
DB_USER=postgres
DB_PASSWORD=secretpassword
DB_NAME=myapp
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

### .env.example File
```bash
# .env.example (committed)
DB_USER=postgres
DB_PASSWORD=changeme
DB_NAME=myapp
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Using in Docker Compose
```yaml
services:
  app:
    env_file:
      - .env
    environment:
      # Override or add specific vars
      DEBUG: "false"
```

## Agent Workflow for Docker

```
1. Understand application type
   ↓
2. Choose appropriate base image
   ├─ Python → python:3.12-slim
   ├─ Node.js → node:20-alpine
   └─ Static → nginx:alpine
   ↓
3. Determine build strategy
   ├─ Production → Multi-stage
   └─ Development → Single stage + volumes
   ↓
4. Write Dockerfile
   ├─ Use multi-stage if production
   ├─ Create non-root user
   ├─ Optimize layer caching
   ├─ Add health check
   └─ Set proper CMD/ENTRYPOINT
   ↓
5. Create docker-compose.yml if needed
   ├─ Define all services
   ├─ Add health checks
   ├─ Configure networks/volumes
   └─ Set environment variables
   ↓
6. Validate
   ├─ Run hadolint on Dockerfile
   ├─ Run docker compose config
   └─ Test build and run
   ↓
7. Document
   └─ Add comments and README
```

## Common Pitfalls to Avoid

1. ❌ **Running as root** → ✅ Create non-root user
2. ❌ **Hardcoding secrets** → ✅ Use env vars
3. ❌ **Large images** → ✅ Use alpine/slim, multi-stage
4. ❌ **No health checks** → ✅ Add HEALTHCHECK
5. ❌ **Poor layer caching** → ✅ Copy deps before code
6. ❌ **Missing .dockerignore** → ✅ Create .dockerignore
7. ❌ **Committing .env** → ✅ Add to .gitignore
8. ❌ **No resource limits** → ✅ Set memory/CPU limits

## .dockerignore Template
```
# Version control
.git
.gitignore

# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
*.so
.venv
venv/
*.egg-info

# Tests and coverage
.pytest_cache
.coverage
htmlcov/
.tox/

# IDEs
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docs
*.md
docs/

# CI/CD
.gitlab-ci.yml
.github/

# Env files (copy example manually if needed)
.env
.env.local

# Logs
*.log
logs/

# Build artifacts
dist/
build/
```

## Quick Reference Card

| Task | Command |
|------|---------|
| Build image | `docker build -t myapp .` |
| Run container | `docker run -p 8000:8000 myapp` |
| Start compose | `docker compose up -d` |
| Stop compose | `docker compose down` |
| View logs | `docker compose logs -f` |
| Execute in container | `docker exec -it <id> bash` |
| Lint Dockerfile | `hadolint Dockerfile` |
| Validate compose | `docker compose config` |
| Clean system | `docker system prune -a` |
| Build no cache | `docker build --no-cache -t myapp .` |