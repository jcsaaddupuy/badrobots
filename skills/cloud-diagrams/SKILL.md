---
name: cloud-diagrams
description: Create cloud architecture diagrams as code using Python and the mingrammer/diagrams library. Use when visualizing AWS, GCP, Azure, Kubernetes, or multi-cloud architectures.
---

# Cloud Architecture Diagrams

Create cloud system architecture diagrams as code using the [mingrammer/diagrams](https://github.com/mingrammer/diagrams) Python library with Graphviz.

## Quick Start

### Install Dependencies

```bash
brew install graphviz  # macOS
# apt-get install graphviz  # Linux
```

### Create Your First Diagram

```bash
# simple.py
from diagrams import Diagram
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB

with Diagram("Web Service", show=False):
    ELB("lb") >> EC2("web") >> RDS("db")

# Run with
uvx --with diagrams python simple.py
```

## The Basics

### Diagram Context

```python
with Diagram("Title",
             direction="LR",      # LR, RL, TB, BT
             filename="out",      # output filename
             show=False,          # don't auto-open
             outformat="png"):    # png, svg, pdf
    # ... add nodes and edges
```

### Nodes (Resources)

```python
from diagrams.aws.compute import EC2, Lambda
from diagrams.aws.database import RDS
from diagrams.gcp.compute import GCE
from diagrams.k8s.compute import Pod

web = EC2("web-server")
func = Lambda("processor")
db = RDS("database")
```

### Edges (Connections)

```python
# Linear flow
lb >> web >> db

# Fan-out
lb >> [web1, web2, web3] >> db

# Undirected
node1 - node2
```

### Edges with Labels

```python
from diagrams import Edge

web >> Edge(label="HTTPS", color="red", style="dashed") >> db
```

### Clusters (Groups)

```python
from diagrams import Cluster

with Cluster("Web Tier"):
    web = [EC2("web1"), EC2("web2")]

with Cluster("Database"):
    db_primary = RDS("primary")
    db_primary - RDS("replica")

web >> db_primary
```

## Common Patterns

### Pattern: Layered Architecture

```python
from diagrams import Diagram, Cluster
from diagrams.aws.network import ELB, Route53
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

with Diagram("Layered", show=False, direction="TB"):
    dns = Route53("dns")
    lb = ELB("lb")
    
    with Cluster("App"):
        web = [EC2("web1"), EC2("web2")]
    
    with Cluster("Database"):
        db = RDS("primary")
    
    dns >> lb >> web >> db
```

### Pattern: Fan-Out Workers

```python
with Diagram("Workers", show=False):
    queue = SQS("queue")
    workers = [Lambda(f"worker{i}") for i in range(1, 4)]
    db = RDS("db")
    
    queue >> workers >> db
```

### Pattern: Multi-Cloud

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.gcp.storage import GCS

with Diagram("Hybrid", show=False):
    with Cluster("AWS"):
        app = EC2("app")
    
    with Cluster("GCP"):
        storage = GCS("backup")
    
    app >> storage
```

## Supported Providers

| Provider | Import | Examples |
|----------|--------|----------|
| AWS | `diagrams.aws.*` | EC2, S3, Lambda, RDS, ELB |
| GCP | `diagrams.gcp.*` | GCE, BigQuery, GCS |
| Azure | `diagrams.azure.*` | VM, Functions, CosmosDB |
| Kubernetes | `diagrams.k8s.*` | Pod, Service, Deployment |
| On-Premise | `diagrams.onprem.*` | Server, PostgreSQL, Nginx |
| Alibaba | `diagrams.alibabacloud.*` | ECS, RDS |
| Oracle | `diagrams.oci.*` | Compute, Database |
| SaaS | `diagrams.saas.*` | Auth0, Datadog |

See [mingrammer/diagrams docs](https://diagrams.mingrammer.com/) for full catalog.

## Best Practices

1. **Use meaningful labels**: `RDS("users-db-prod")` not `RDS("db")`
2. **Group with clusters**: Organize by tier, service, or environment
3. **Set direction wisely**: LR for flows, TB for hierarchies
4. **Label edges**: Use `Edge(label="...")` for clarity
5. **Choose format**: PNG for docs, SVG for web, PDF for presentations

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Graphviz not found | Run `brew install graphviz` |
| Module not found | Use `uvx --with diagrams python` |
| Crowded diagram | Break into multiple diagrams or use clusters |
| Custom icon error | Check file path exists and is relative to script |

## Complete Example

```python
from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import EC2, Lambda
from diagrams.aws.database import RDS, ElastiCache
from diagrams.aws.network import ELB, Route53
from diagrams.aws.integration import SQS
from diagrams.aws.storage import S3

with Diagram("E-Commerce", direction="LR", show=False):
    dns = Route53("DNS")
    lb = ELB("LB")
    
    with Cluster("Web"):
        web = [EC2("web1"), EC2("web2")]
    
    with Cluster("Data"):
        cache = ElastiCache("Redis")
        db_primary = RDS("primary")
        db_primary - RDS("replica")
    
    with Cluster("Workers"):
        queue = SQS("queue")
        workers = [Lambda("w1"), Lambda("w2")]
    
    assets = S3("assets")
    
    dns >> lb >> web
    web >> cache
    web >> db_primary
    web >> Edge(label="jobs") >> queue >> workers >> db_primary
    web >> assets
```

## Run with uvx

```bash
uvx --with diagrams python my_diagram.py
uvx --with diagrams --with requests python my_diagram.py
uvx --python 3.12 --with diagrams python my_diagram.py
```
