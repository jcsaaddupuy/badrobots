# Docker Core Rules

## Dockerfile Location
- Dockerfiles should be at top level of the project, or in a `docker/` folder
- `docker-compose.yml` should be at top level

## Build Requirements
- All docker images must be buildable using:
  - `docker build . -f Dockerfile` OR
  - `docker compose build`

## Best Practices
- Prefer multistage builds
- Prefer non-root users
- Prefer rootless, distroless images for production

## Image Selection
- Always prefer Alpine as base image
- May use Debian-based images when needed

## Proxy Configuration
- Always pass proxy configuration as build args:
  - `http_proxy`
  - `https_proxy`
  - `no_proxy`
  - `HTTP_PROXY`
  - `HTTPS_PROXY`
  - `NO_PROXY`
- **DO NOT** pass `http_proxy`, `https_proxy`, `HTTP_PROXY`, `HTTPS_PROXY` environment variables

Example in Dockerfile:
```Dockerfile
# Set build arguments for proxy configuration
ARG http_proxy
ARG https_proxy
ARG no_proxy
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# No http_proxy, https_proxy, ... environment variables
```

## SSL Certificates
Always install corporate SSL certificate:

```Dockerfile
# Configure SSL certificates, example for debian based image (ubuntu, ...)
# curl, openssl ca-certificates must be installed
RUN curl -k -L --silent https://artifactory-ncsa01.ubisoft.org/generic/ssl/cacert.pem | \
    openssl x509 -inform PEM -out /usr/local/share/ca-certificates/cacert.crt
RUN update-ca-certificates
```

## Validation
- Validate all stages can be built
- When applicable, validate that `docker compose build` is working
- Validate dockerfile with hadolint: `hadolint Dockerfile`
- Ensure the docker builds and runs without error

## Docker Compose
- When needed, configure build-args in docker compose
- **DO NOT** pass `http_proxy`, `https_proxy`, `HTTP_PROXY`, `HTTPS_PROXY` environment variables
