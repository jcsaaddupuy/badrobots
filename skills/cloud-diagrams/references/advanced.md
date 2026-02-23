# Advanced Features

Advanced techniques and patterns for the diagrams library.

## Custom Icons

Use your own icons for proprietary or unsupported services.

### Basic Custom Icons

```python
from diagrams import Diagram
from diagrams.custom import Custom

with Diagram("Custom Icons", show=False):
    # Use a local image file
    custom_service = Custom("My Service", "./icons/my-service.png")
    
    # PNG, JPG, and other image formats supported
    custom_db = Custom("Custom DB", "./icons/database.png")
    
    custom_service >> custom_db
```

### Custom Icon Requirements

- **Format**: PNG, JPG, SVG recommended
- **Size**: Icons work best at ~256x256 pixels
- **Path**: Relative to the Python script location
- **Transparency**: PNG with transparency recommended

### Mixed Custom and Standard Icons

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.custom import Custom

with Diagram("Mixed Icons", show=False):
    # Standard AWS icon
    app = EC2("app")
    
    # Custom proprietary service
    legacy = Custom("Legacy System", "./icons/legacy.png")
    
    app >> legacy
```

## Programmatic Diagram Generation

Generate diagrams dynamically based on configuration or data.

### Dynamic Multi-Region Architecture

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.network import ELB

def create_multi_region(regions, instances_per_region=3):
    with Diagram("Multi-Region Architecture", show=False):
        global_lb = ELB("Global LB")
        
        for region in regions:
            with Cluster(f"Region: {region}"):
                regional_lb = ELB(f"{region}-lb")
                instances = [
                    EC2(f"{region}-app-{i}") 
                    for i in range(1, instances_per_region + 1)
                ]
                global_lb >> regional_lb >> instances

# Generate for 3 regions with 3 instances each
create_multi_region(["us-east-1", "eu-west-1", "ap-southeast-1"])
```

### Configuration-Driven Diagrams

```python
import yaml
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

def generate_from_config(config_file):
    with open(config_file) as f:
        config = yaml.safe_load(f)
    
    with Diagram(config['name'], show=False):
        services = {}
        
        # Create all services
        for svc in config['services']:
            if svc['type'] == 'compute':
                services[svc['name']] = EC2(svc['label'])
            elif svc['type'] == 'database':
                services[svc['name']] = RDS(svc['label'])
        
        # Create connections
        for conn in config['connections']:
            services[conn['from']] >> services[conn['to']]

# config.yaml:
# name: "My Architecture"
# services:
#   - name: web
#     type: compute
#     label: "Web Server"
#   - name: db
#     type: database
#     label: "Database"
# connections:
#   - from: web
#     to: db

generate_from_config('config.yaml')
```

### Loop-Based Generation

```python
from diagrams import Diagram
from diagrams.aws.compute import Lambda

def create_lambda_fanout(num_functions):
    with Diagram(f"Lambda Fanout ({num_functions})", show=False):
        functions = [Lambda(f"fn-{i}") for i in range(num_functions)]
        
        # Create connections between consecutive functions
        for i in range(len(functions) - 1):
            functions[i] >> functions[i + 1]

create_lambda_fanout(10)
```

## Advanced Edge Styling

### Edge Attributes

```python
from diagrams import Diagram, Edge
from diagrams.aws.compute import EC2

with Diagram("Advanced Edges", show=False):
    web = EC2("web")
    api = EC2("api")
    db = EC2("db")
    cache = EC2("cache")
    
    # Colored edges
    web >> Edge(color="red") >> api
    
    # Styled edges
    api >> Edge(style="dashed") >> db
    
    # Labeled edges
    api >> Edge(label="async") >> cache
    
    # Combined attributes
    web >> Edge(
        color="blue",
        style="bold",
        label="HTTPS"
    ) >> cache
```

### Available Edge Styles

| Style | Appearance | Use Case |
|-------|------------|----------|
| `"solid"` | ──── | Default connections |
| `"dashed"` | ---- | Async/optional connections |
| `"dotted"` | ····· | Weak dependencies |
| `"bold"` | ━━━━ | Primary/critical paths |

### Edge Colors

```python
from diagrams import Diagram, Edge
from diagrams.aws.network import ELB
from diagrams.aws.compute import EC2

with Diagram("Colored Edges", show=False):
    lb = ELB("lb")
    web = [EC2("web1"), EC2("web2"), EC2("web3")]
    
    # Different colors for different paths
    lb >> Edge(color="green") >> web[0]
    lb >> Edge(color="yellow") >> web[1]
    lb >> Edge(color="red") >> web[2]
```

**Common Colors**: red, green, blue, yellow, orange, purple, pink, brown, gray, black

**Hex Colors**: `Edge(color="#FF5733")`

### Bidirectional Edges

```python
from diagrams import Diagram, Edge
from diagrams.aws.database import RDS

with Diagram("Bidirectional", show=False):
    primary = RDS("primary")
    replica = RDS("replica")
    
    # Bidirectional with different styles
    primary >> Edge(label="replicate") >> replica
    primary << Edge(label="failover", style="dashed") << replica
```

### Edge Labels with Units

```python
from diagrams import Diagram, Edge
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

with Diagram("Performance Metrics", show=False):
    app = EC2("app")
    db = RDS("db")
    
    app >> Edge(label="10K req/s") >> db
```

## Complex Cluster Hierarchies

### Nested Clusters

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB

with Diagram("Nested Clusters", show=False):
    with Cluster("Production Environment"):
        with Cluster("Region: us-east-1"):
            with Cluster("Availability Zone A"):
                with Cluster("Public Subnet"):
                    lb_a = ELB("lb-a")
                
                with Cluster("Private Subnet"):
                    web_a = [EC2("web-a1"), EC2("web-a2")]
                    db_a = RDS("db-a")
            
            with Cluster("Availability Zone B"):
                with Cluster("Public Subnet"):
                    lb_b = ELB("lb-b")
                
                with Cluster("Private Subnet"):
                    web_b = [EC2("web-b1"), EC2("web-b2")]
                    db_b = RDS("db-b")
        
        lb_a >> web_a >> db_a
        lb_b >> web_b >> db_b
        db_a - db_b  # Replication
```

### Cluster Graph Attributes

Customize cluster appearance:

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2

with Diagram("Custom Clusters", show=False):
    with Cluster(
        "Production",
        graph_attr={
            "bgcolor": "lightblue",
            "fontsize": "20",
            "fontname": "bold"
        }
    ):
        EC2("web")
```

**Common Graph Attributes**:
- `bgcolor`: Background color
- `fontsize`: Font size for cluster label
- `fontname`: Font style (bold, italic)
- `pencolor`: Border color
- `penwidth`: Border width
- `style`: filled, dashed, etc.

### Dynamic Cluster Creation

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2

def create_environment(env_name, num_instances):
    with Cluster(f"{env_name} Environment"):
        return [EC2(f"{env_name}-{i}") for i in range(num_instances)]

with Diagram("Multiple Environments", show=False):
    prod = create_environment("prod", 5)
    staging = create_environment("staging", 3)
    dev = create_environment("dev", 1)
```

## Output Formats and Options

### Multiple Output Formats

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

formats = ["png", "jpg", "svg", "pdf"]

for fmt in formats:
    with Diagram(
        "Multi Format",
        filename=f"output_{fmt}",
        outformat=fmt,
        show=False
    ):
        EC2("server")
# Generates: output_png.png, output_jpg.jpg, output_svg.svg, output_pdf.pdf
```

### Format Comparison

| Format | Use Case | Pros | Cons |
|--------|----------|------|------|
| PNG | Documentation, web | Universal support, good quality | Not scalable |
| JPG | Compressed images | Smaller file size | Lossy compression |
| SVG | Web, scalable docs | Infinite scaling, editable | Limited tool support |
| PDF | Presentations, print | Professional, scalable | Larger file size |
| DOT | Debugging, modification | Graphviz source | Requires processing |

### High-Resolution Output

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram(
    "High Resolution",
    show=False,
    graph_attr={
        "dpi": "300"  # High DPI for print
    }
):
    EC2("server")
```

### Custom Filename Patterns

```python
from datetime import datetime
from diagrams import Diagram
from diagrams.aws.compute import EC2

# Timestamped filename
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
with Diagram("Architecture", filename=f"arch_{timestamp}", show=False):
    EC2("server")

# Version-based filename
version = "v1.2.3"
with Diagram("Architecture", filename=f"arch_{version}", show=False):
    EC2("server")
```

## Layout Control

### Direction Options

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

directions = {
    "LR": "Left to Right",
    "RL": "Right to Left", 
    "TB": "Top to Bottom",
    "BT": "Bottom to Top"
}

for code, desc in directions.items():
    with Diagram(
        desc,
        filename=f"layout_{code}",
        direction=code,
        show=False
    ):
        EC2("a") >> EC2("b") >> EC2("c")
```

### Graph Attributes

Control overall diagram appearance:

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram(
    "Custom Layout",
    show=False,
    graph_attr={
        "splines": "ortho",      # Orthogonal edges
        "rankdir": "LR",         # Left-to-right
        "bgcolor": "white",      # Background color
        "fontsize": "45",        # Title font size
        "fontcolor": "blue",     # Title color
        "pad": "0.5",            # Diagram padding
        "nodesep": "1.0",        # Space between nodes
        "ranksep": "1.0",        # Space between ranks
    }
):
    EC2("web") >> EC2("api") >> EC2("db")
```

**Graph Attributes Reference**:
- `splines`: Edge routing (ortho, curved, line, polyline)
- `rankdir`: Direction (TB, LR, RL, BT)
- `bgcolor`: Background color
- `pad`: Padding around diagram (inches)
- `nodesep`: Horizontal spacing between nodes
- `ranksep`: Vertical spacing between node ranks
- `dpi`: Output resolution

### Node Attributes

Customize individual node appearance:

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram("Custom Nodes", show=False):
    # Create node with custom attributes
    web = EC2(
        "web",
        # Note: Node-level customization limited
        # Most styling via Graphviz graph_attr
    )
```

## C4 Model Support

The diagrams library supports the C4 model for software architecture.

### C4 Context Diagram

```python
from diagrams import Diagram, Cluster, Edge
from diagrams.c4.c4 import (
    Person,
    Container,
    System,
    SystemBoundary,
    Relationship
)

with Diagram("C4 Context", show=False):
    customer = Person(
        name="Customer",
        description="User of the system"
    )
    
    with SystemBoundary("System Boundary"):
        system = System(
            name="Banking System",
            description="Core banking application"
        )
    
    external = System(
        name="Email System",
        description="External email service",
        external=True
    )
    
    customer >> Edge(label="Uses") >> system
    system >> Edge(label="Sends emails") >> external
```

### C4 Container Diagram

```python
from diagrams import Diagram
from diagrams.c4.c4 import Container, Database, Person

with Diagram("C4 Container", show=False):
    user = Person("User")
    
    web = Container("Web Application", "React", "Frontend")
    api = Container("API", "FastAPI", "Backend")
    db = Database("Database", "PostgreSQL", "Data store")
    
    user >> web >> api >> db
```

## Performance and Optimization

### Large Diagrams

For diagrams with many nodes (>100):

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram(
    "Large Diagram",
    show=False,
    graph_attr={
        # Improve layout for large diagrams
        "concentrate": "true",   # Merge edges
        "splines": "spline",     # Smoother edges
        "nodesep": "0.5",        # Tighter spacing
    }
):
    # Generate many nodes
    nodes = [EC2(f"node-{i}") for i in range(100)]
    
    # Connect in groups to reduce clutter
    for i in range(0, len(nodes), 10):
        group = nodes[i:i+10]
        for j in range(len(group)-1):
            group[j] >> group[j+1]
```

### Caching Generated Diagrams

```python
import os
from diagrams import Diagram
from diagrams.aws.compute import EC2

def create_diagram(force=False):
    filename = "architecture"
    output_file = f"{filename}.png"
    
    # Skip if already exists and not forcing
    if os.path.exists(output_file) and not force:
        print(f"Using cached {output_file}")
        return
    
    with Diagram("Architecture", filename=filename, show=False):
        EC2("server")
    
    print(f"Generated {output_file}")

# First run generates, second uses cache
create_diagram()
create_diagram()
create_diagram(force=True)  # Force regenerate
```

## Debugging

### DOT File Inspection

Generate DOT file to debug layout issues:

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram("Debug", outformat="dot", show=False):
    EC2("web") >> EC2("api") >> EC2("db")

# Inspect architecture.dot to see Graphviz source
with open("debug.dot") as f:
    print(f.read())
```

### Show Without Saving

Quick preview during development:

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2

# Opens diagram immediately, doesn't save to disk
with Diagram("Preview", show=True):
    EC2("test")
```

### Verbose Output

```python
import os
os.environ['GRAPHVIZ_DEBUG'] = '1'  # Enable Graphviz debugging

from diagrams import Diagram
from diagrams.aws.compute import EC2

with Diagram("Verbose", show=False):
    EC2("server")
```

## Integration Examples

### Generate from Terraform

```python
import json
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

def diagram_from_terraform_state(state_file):
    with open(state_file) as f:
        state = json.load(f)
    
    resources = {}
    for resource in state.get('resources', []):
        rtype = resource['type']
        name = resource['name']
        
        if rtype == 'aws_instance':
            resources[name] = EC2(name)
        elif rtype == 'aws_db_instance':
            resources[name] = RDS(name)
    
    with Diagram("Terraform Infrastructure", show=False):
        # Connect based on dependencies
        pass  # Add connection logic

diagram_from_terraform_state('terraform.tfstate')
```

### CI/CD Integration

```python
#!/usr/bin/env python3
"""Generate architecture diagrams in CI/CD"""

import sys
from pathlib import Path
from diagrams import Diagram
from diagrams.aws.compute import EC2

def main():
    output_dir = Path("diagrams")
    output_dir.mkdir(exist_ok=True)
    
    with Diagram(
        "CI Architecture",
        filename=str(output_dir / "architecture"),
        show=False
    ):
        EC2("build-server")
    
    print(f"✓ Generated diagrams in {output_dir}/")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### Documentation Generation

```python
"""Auto-generate diagrams for documentation"""

from pathlib import Path
from diagrams import Diagram
from diagrams.aws.compute import EC2, Lambda
from diagrams.aws.database import RDS

def generate_all_diagrams(output_dir="docs/diagrams"):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Generate multiple diagrams
    diagrams = {
        "web-tier": lambda: EC2("web") >> RDS("db"),
        "serverless": lambda: Lambda("function") >> RDS("db"),
    }
    
    for name, diagram_fn in diagrams.items():
        with Diagram(
            name.replace("-", " ").title(),
            filename=f"{output_dir}/{name}",
            show=False
        ):
            diagram_fn()

generate_all_diagrams()
```

## Tips and Tricks

### Reusable Components

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS

def create_web_tier(name_prefix):
    """Reusable web tier pattern"""
    return [EC2(f"{name_prefix}-web-{i}") for i in range(3)]

def create_db_cluster(name_prefix):
    """Reusable database cluster"""
    primary = RDS(f"{name_prefix}-primary")
    replicas = [RDS(f"{name_prefix}-replica-{i}") for i in range(2)]
    primary - replicas
    return primary, replicas

with Diagram("Reusable Components", show=False):
    web = create_web_tier("prod")
    db, replicas = create_db_cluster("prod")
    web >> db
```

### Conditional Diagrams

```python
import os
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

with Diagram(f"{ENVIRONMENT.title()} Architecture", show=False):
    if ENVIRONMENT == "prod":
        # Production has redundancy
        with Cluster("Production"):
            [EC2(f"web-{i}") for i in range(5)]
    else:
        # Dev/staging is simpler
        EC2("web")
```

### Labeling Best Practices

```python
from diagrams import Diagram
from diagrams.aws.compute import EC2, Lambda
from diagrams.aws.database import RDS

with Diagram("Clear Labels", show=False):
    # Good: Descriptive, includes purpose and environment
    web_prod = EC2("web-api-prod\n10.0.1.50")
    db_prod = RDS("users-db-prod\nt3.large")
    
    # Include relevant metadata
    lambda_fn = Lambda("order-processor\n256MB\nPython 3.11")
    
    web_prod >> db_prod
    web_prod >> lambda_fn
```
