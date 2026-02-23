# Cloud Diagrams Examples

Real-world architecture examples demonstrating various cloud patterns and use cases.

## Running Examples

All examples use `uvx` for dependency-free execution:

```bash
# Run a single example
uvx --with diagrams python examples/microservices.py

# Generate all examples
for example in examples/*.py; do
    uvx --with diagrams python "$example"
done
```

## Example Index

### 1. Microservices Architecture (`microservices.py`)

**Use Case**: Modern microservices-based e-commerce platform

**Demonstrates**:
- Multiple independent services (User, Order, Inventory, Payment)
- Service-specific databases and caching
- Async event processing with SQS/Lambda
- API Gateway for unified interface
- Monitoring and logging infrastructure

**Key Patterns**:
- Service isolation with dedicated data stores
- Event-driven communication
- Caching strategies
- Observability best practices

**Complexity**: Medium-High

**Generate**:
```bash
uvx --with diagrams python examples/microservices.py
# Output: microservices.png
```

---

### 2. Multi-Cloud Disaster Recovery (`multi_cloud_dr.py`)

**Use Case**: High-availability system with cross-cloud DR

**Demonstrates**:
- Primary region on AWS with active traffic
- Passive DR site on GCP
- Cross-cloud database replication
- DNS-based failover routing
- Cross-cloud backup synchronization

**Key Patterns**:
- Active-passive DR setup
- Multi-cloud redundancy
- Automated backup strategies
- Health-check based failover

**Complexity**: High

**Generate**:
```bash
uvx --with diagrams python examples/multi_cloud_dr.py
# Output: multi_cloud_dr.png
```

---

### 3. Data Pipeline Architecture (`data_pipeline.py`)

**Use Case**: Big data processing and analytics platform

**Demonstrates**:
- Multiple data ingestion sources (mobile, web, IoT)
- Real-time stream processing with Kinesis/Lambda
- Batch processing with Glue/EMR
- Data lake layers (Bronze/Silver/Gold)
- Analytics with Athena, Redshift, Snowflake

**Key Patterns**:
- Lambda architecture (batch + stream)
- Data lake zones (raw, processed, curated)
- Multi-tool analytics approach
- Scalable ingestion patterns

**Complexity**: High

**Generate**:
```bash
uvx --with diagrams python examples/data_pipeline.py
# Output: data_pipeline.png
```

---

### 4. Kubernetes Production Deployment (`kubernetes_production.py`)

**Use Case**: Production-ready Kubernetes application

**Demonstrates**:
- Ingress for external access
- Deployments with horizontal pod autoscaling
- StatefulSets for databases and caches
- Persistent storage with PV/PVC
- ConfigMaps and Secrets for configuration
- DaemonSets for logging
- Prometheus/Grafana monitoring

**Key Patterns**:
- Separation of stateless and stateful workloads
- Storage abstraction layers
- Configuration management
- Comprehensive observability

**Complexity**: High

**Generate**:
```bash
uvx --with diagrams python examples/kubernetes_production.py
# Output: kubernetes_production.png
```

---

### 5. Serverless Application (`serverless_app.py`)

**Use Case**: Fully serverless application with AWS managed services

**Demonstrates**:
- API Gateway + Lambda for backend
- Cognito for authentication
- DynamoDB for data persistence
- S3 for static hosting and storage
- EventBridge for event-driven architecture
- SQS for async job processing
- SNS for notifications
- CloudWatch for monitoring

**Key Patterns**:
- 100% serverless (no server management)
- Event-driven microservices
- Static frontend with dynamic backend
- Async job processing with queues
- Dead letter queues for error handling

**Complexity**: Medium-High

**Generate**:
```bash
uvx --with diagrams python examples/serverless_app.py
# Output: serverless_app.png
```

## Common Patterns Across Examples

### Clustering Strategy

All examples use clusters to group related components:

```python
with Cluster("Logical Group"):
    component1 = Service("component1")
    component2 = Service("component2")
```

### Edge Labeling

Examples use labeled edges for clarity:

```python
service1 >> Edge(label="HTTP", color="green") >> service2
service2 >> Edge(label="async", style="dashed") >> queue
```

### Direction Choices

- **TB (Top-Bottom)**: Hierarchical architectures (microservices, serverless)
- **LR (Left-Right)**: Sequential flows (data pipelines, DR)

### Color Coding

Examples use edge colors to indicate:
- **Green/Bold**: Active/primary paths
- **Red/Dashed**: Error/failover paths
- **Blue**: Data replication
- **Dashed**: Monitoring/logging/configuration

## Customizing Examples

### Modify Node Counts

```python
# Change from 3 to 5 workers
workers = [EC2(f"worker-{i}") for i in range(1, 6)]  # was range(1, 4)
```

### Change Output Format

```python
# Change to SVG
with Diagram("Architecture", outformat="svg", show=False):
    # ...
```

### Add Your Own Providers

```python
# Mix in Azure services
from diagrams.azure.compute import FunctionApps

azure_function = FunctionApps("Azure Function")
```

### Customize Appearance

```python
with Diagram(
    "Architecture",
    show=False,
    graph_attr={
        "bgcolor": "white",
        "fontsize": "45",
        "splines": "ortho"  # Orthogonal edges
    }
):
    # ...
```

## Best Practices from Examples

### 1. Organize with Nested Clusters

```python
with Cluster("Environment"):
    with Cluster("Application Tier"):
        # App components
    with Cluster("Data Tier"):
        # Data components
```

### 2. Use Descriptive Labels

```python
# Good
db = RDS("users-db-prod\nt3.large")

# Less helpful
db = RDS("db")
```

### 3. Show Different Connection Types

```python
# Sync/primary
app >> db

# Async/secondary
app >> Edge(style="dashed") >> queue

# Monitoring/optional
app >> Edge(style="dashed", label="metrics") >> prometheus
```

### 4. Group Similar Components

```python
# Create multiple instances efficiently
pods = [Pod(f"pod-{i}") for i in range(1, 4)]

# Connect as a group
service >> pods >> database
```

## Generating Your Own

Use these examples as templates:

1. **Copy** an example that's closest to your architecture
2. **Modify** the components to match your stack
3. **Adjust** the connections to reflect your data flow
4. **Refine** the layout (direction, clustering)
5. **Generate** and iterate

```bash
# Copy and modify
cp examples/microservices.py my_architecture.py
# Edit my_architecture.py
uvx --with diagrams python my_architecture.py
```

## Troubleshooting Examples

### Example Won't Generate

```bash
# Check for syntax errors
python -m py_compile examples/microservices.py

# Run with error output
uvx --with diagrams python examples/microservices.py 2>&1
```

### Output is Cluttered

- Reduce number of nodes
- Increase spacing: `graph_attr={"nodesep": "1.0"}`
- Split into multiple diagrams
- Try different direction (LR vs TB)

### Missing Icons

- Ensure you're importing from correct provider paths
- Check provider documentation for exact class names
- Use generic icons as fallback

## Integration Examples

### Generate in CI/CD

```bash
#!/bin/bash
# .github/workflows/diagrams.yml

# Install Graphviz
apt-get update && apt-get install -y graphviz

# Generate all diagrams
for diagram in diagrams/*.py; do
    uvx --with diagrams python "$diagram"
done

# Commit generated images
git config user.name "GitHub Actions"
git config user.email "actions@github.com"
git add *.png
git commit -m "Update architecture diagrams [skip ci]"
git push
```

### Documentation Integration

```python
# docs/generate_diagrams.py
"""Generate all architecture diagrams for documentation"""

import sys
from pathlib import Path

# Add examples to path
examples_dir = Path(__file__).parent.parent / "examples"
sys.path.insert(0, str(examples_dir))

# Import and run each example
import microservices
import data_pipeline
import kubernetes_production

print("✓ Generated all diagrams")
```

### Dynamic Diagram Generation

```python
#!/usr/bin/env python3
"""Generate diagrams from configuration"""

import json
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

def generate_from_config(config_path):
    with open(config_path) as f:
        config = json.load(f)
    
    with Diagram(config["name"], show=False):
        for cluster_config in config["clusters"]:
            with Cluster(cluster_config["name"]):
                # Create resources based on config
                pass

generate_from_config("infrastructure.json")
```

## Further Learning

- Study the imports to understand provider organization
- Examine the clustering strategies for logical grouping
- Note how edges are used to show different relationship types
- Observe naming conventions for clarity
- Compare patterns across different cloud providers

## Contributing Examples

Have a useful architecture pattern? Consider contributing:

1. Create a well-commented example
2. Follow the naming convention (`pattern_name.py`)
3. Include detailed docstring
4. Test generation
5. Add to this README
