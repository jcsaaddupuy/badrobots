# Cloud Diagrams Skill

Create cloud architecture diagrams as code using Python and the mingrammer/diagrams library.

## Quick Reference

### Installation Check
```bash
# Check if Graphviz is installed (required)
which dot && dot -V

# Install Graphviz if needed
brew install graphviz  # macOS
```

### Quick Start
```bash
# Create a simple diagram
cat > simple.py << 'PYTHON'
from diagrams import Diagram
from diagrams.aws.compute import EC2
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB

with Diagram("Web Service", show=False):
    ELB("lb") >> EC2("web") >> RDS("userdb")
PYTHON

# Run with uvx (no installation needed)
uvx --with diagrams python simple.py
# Output: web_service.png
```

## Skill Structure

```
cloud-diagrams/
├── SKILL.md                    # Main skill documentation
├── README.md                   # This file
├── references/
│   ├── providers.md           # Complete provider catalog (AWS, GCP, Azure, K8s, etc.)
│   └── advanced.md            # Advanced features and techniques
└── examples/
    ├── README.md              # Example documentation
    ├── microservices.py       # Microservices architecture
    ├── multi_cloud_dr.py      # Multi-cloud disaster recovery
    ├── data_pipeline.py       # Data processing pipeline
    ├── kubernetes_production.py # Production K8s deployment
    └── serverless_app.py      # Serverless application
```

## What's Included

### Main Documentation (SKILL.md)
- When to use this skill
- Quick start guide
- Core concepts (Diagrams, Nodes, Edges, Clusters)
- Common patterns
- Multi-cloud examples
- Best practices
- Troubleshooting
- Complete quick reference

### Provider Reference (references/providers.md)
Complete catalog of 15+ providers:
- AWS (EC2, Lambda, RDS, S3, etc.)
- GCP (GCE, BigQuery, GCS, etc.)
- Azure (VM, Functions, CosmosDB, etc.)
- Kubernetes (Pod, Service, Deployment, etc.)
- On-Premise (PostgreSQL, Nginx, Kafka, etc.)
- SaaS (Datadog, Snowflake, etc.)
- Programming languages/frameworks
- Generic components

### Advanced Features (references/advanced.md)
- Custom icons for proprietary services
- Programmatic diagram generation
- Advanced edge styling
- Complex cluster hierarchies
- Multiple output formats (PNG, SVG, PDF)
- Layout control
- C4 Model support
- Performance optimization
- CI/CD integration

### Real-World Examples (examples/)
Five production-ready architecture examples:
1. **Microservices** - E-commerce platform with multiple services
2. **Multi-Cloud DR** - AWS primary with GCP disaster recovery
3. **Data Pipeline** - Complete data processing and analytics
4. **Kubernetes Production** - Full K8s deployment with observability
5. **Serverless App** - 100% serverless AWS application

## Usage Patterns

### Generate All Examples
```bash
cd ~/.pi/agent/skills/cloud-diagrams
for example in examples/*.py; do
    uvx --with diagrams python "$example"
done
```

### Use as Template
```bash
# Copy an example
cp ~/.pi/agent/skills/cloud-diagrams/examples/microservices.py my_architecture.py

# Modify for your needs
vi my_architecture.py

# Generate
uvx --with diagrams python my_architecture.py
```

### Quick Diagram from Command Line
```bash
uvx --with diagrams python -c "
from diagrams import Diagram
from diagrams.aws.compute import EC2
with Diagram('Quick', show=False):
    EC2('server')
"
```

## Key Features

✅ **Diagram as Code** - Version control your architectures
✅ **Multi-Cloud** - Supports AWS, GCP, Azure, K8s, and more
✅ **Zero Installation** - Use uvx for dependency-free execution
✅ **Rich Icons** - 400+ provider-specific icons
✅ **Flexible Layouts** - Multiple directions and styling options
✅ **Multiple Formats** - Export to PNG, SVG, PDF, DOT

## Requirements

- **Python**: 3.9+ (handled by uvx)
- **Graphviz**: Must be installed on system (`brew install graphviz`)
- **diagrams library**: Installed via uvx automatically

## Common Use Cases

1. **Documentation** - Create architecture diagrams for READMEs and wikis
2. **Design Reviews** - Prototype new system designs
3. **Knowledge Sharing** - Visualize existing infrastructure
4. **CI/CD** - Auto-generate diagrams from infrastructure code
5. **Presentations** - Export to PDF for slides

## Skill Documentation Navigation

1. **Start with**: [SKILL.md](SKILL.md) - Core concepts and quick start
2. **Reference**: [references/providers.md](references/providers.md) - Find specific services
3. **Learn from**: [examples/](examples/) - Real-world patterns
4. **Go deep**: [references/advanced.md](references/advanced.md) - Advanced techniques

## Tips

- Use `direction="LR"` for sequential flows
- Use `direction="TB"` for hierarchical structures
- Group related components with `Cluster`
- Use edge labels to clarify connections
- Export to SVG for web use
- Export to PDF for presentations

## Troubleshooting

**Graphviz not found**
```bash
brew install graphviz
```

**Import errors**
```bash
# Use uvx --with diagrams
uvx --with diagrams python diagram.py
```

**Cluttered diagrams**
- Reduce number of nodes
- Adjust direction (LR vs TB)
- Increase spacing with graph_attr
- Split into multiple diagrams

## Further Reading

- [Official Documentation](https://diagrams.mingrammer.com/)
- [GitHub Repository](https://github.com/mingrammer/diagrams)
- [DeepWiki Documentation](https://deepwiki.com/mingrammer/diagrams)

## Skill Metadata

- **Created from**: DeepWiki documentation for mingrammer/diagrams
- **Repository**: https://github.com/mingrammer/diagrams
- **Stars**: 41,896 ⭐
- **Language**: Python
- **License**: MIT
