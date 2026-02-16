# GitLab CI Rules

## Shared Templates
- Use the shared templates from the-foundry/tools repo as much as possible
- Gitleaks must be enabled
- Linting must be enabled
- Tests must be enabled
- `gitlab-ci.yml` should be adapted to the current project, removing unneeded jobs and adding needed ones

## Project-Specific Templates

### Python Projects
- Use the python template from the-foundry/tools
- If the project uses AWS, use the python-aws template from the-foundry/tools

### Docker Projects
- Use the docker template from the-foundry/tools

### LangGraph Projects
- Use the langgraph template from the-foundry/tools

### Combined Projects
- If the project is python + docker + langgraph, use all three templates
- If the project is python + docker + langgraph + AWS, use all four templates

## Example Full-Featured gitlab-ci.yml

For Python projects with Docker and LangGraph:

```yaml
include:
  - project: the-foundry/tools/templates
    file: gitlab/default.yml
  - project: the-foundry/tools/templates
    file: gitlab/gitleaks-gitlab-ci.yml
  # Python template
  - project: the-foundry/tools/templates
    file: gitlab/python-gitlab-ci.yml
  # Python AWS template
  - project: the-foundry/tools/templates
    file: gitlab/python-aws-gitlab-ci.yml
  # Docker template
  - project: the-foundry/tools/templates
    file: gitlab/docker-gitlab-ci.yml
  # Langgraph template
  - ".gitlab/langgraph-gitlab-ci.yml"

stages:
  - security
  - lint
  - test
  - build:.pre
  - build
  - build:.post
  - push
  - deploy
  - deploy:.post
  - release

default:
  tags: !reference [.default, tags]
  retry: !reference [.default, retry]

variables:
  PYTHON_PROJECT: python-project-name
  DOCKER_BUILD_PATH: ${PYTHON_PROJECT}
  DOCKERFILE_NAME: ${PYTHON_PROJECT}/Dockerfile
  # UV_EXTRA_INDEX_URL will be populated by .pip:aws
  DOCKER_ARGS: "--build-arg UV_EXTRA_INDEX_URL"
  IMAGE_NAME: the-foundry/langchain-agents

#############################################
# Security
#############################################
gitleaks:
  extends: .gitleaks

################################################################
# Build
################################################################
dockerfile:
  extends: .langgraph:dockerfile

docker:build:
  extends:
    - .pip:aws:debug
    - .docker-build:aws
  before_script:
    - !reference [.pip:aws:debug, before_script]
    - !reference [.docker-build:aws, before_script]
  script:
    - !reference [.docker-build:aws, script]
    - !reference [.langgraph:docker:tests, script]
  rules:
    - if: $CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH
      when: on_success
  dependencies:
    - dockerfile

docker:push:
  extends:
    - .pip:aws:debug
    - .docker-push:aws
  variables:
    GIT_STRATEGY: none
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_success
  dependencies:
    - docker:build
```
