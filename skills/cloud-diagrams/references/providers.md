# Cloud Provider Reference

Complete catalog of supported providers and their resources in the diagrams library.

## Provider Overview

The diagrams library supports 15+ providers with hundreds of node types. Each provider is organized into categories (compute, database, network, storage, etc.).

## AWS (Amazon Web Services)

### Import Pattern
```python
from diagrams.aws.{category} import {Service}
```

### Categories and Common Services

#### Compute
```python
from diagrams.aws.compute import (
    EC2,                    # Elastic Compute Cloud
    Lambda,                 # Serverless Functions
    ECS,                    # Elastic Container Service
    EKS,                    # Elastic Kubernetes Service
    Batch,                  # Batch Processing
    ElasticBeanstalk,       # Platform as a Service
    Fargate,                # Serverless Containers
    LightsailContainer,     # Simplified Containers
)
```

#### Database
```python
from diagrams.aws.database import (
    RDS,                    # Relational Database Service
    DynamoDB,               # NoSQL Database
    ElastiCache,            # In-Memory Cache (Redis/Memcached)
    Redshift,               # Data Warehouse
    Aurora,                 # High-Performance Relational DB
    DocumentDB,             # MongoDB-compatible
    Neptune,                # Graph Database
    Timestream,             # Time Series Database
)
```

#### Network
```python
from diagrams.aws.network import (
    ELB,                    # Elastic Load Balancer
    Route53,                # DNS Service
    CloudFront,             # CDN
    VPC,                    # Virtual Private Cloud
    APIGateway,             # API Management
    DirectConnect,          # Dedicated Network
    PrivateLink,            # Private Connectivity
    TransitGateway,         # VPC Interconnection
)
```

#### Storage
```python
from diagrams.aws.storage import (
    S3,                     # Object Storage
    EBS,                    # Block Storage
    EFS,                    # Elastic File System
    Glacier,                # Archive Storage
    Storage,                # General Storage
    Backup,                 # Backup Service
)
```

#### Integration
```python
from diagrams.aws.integration import (
    SQS,                    # Simple Queue Service
    SNS,                    # Simple Notification Service
    Eventbridge,            # Event Bus
    StepFunctions,          # Workflow Orchestration
    MQ,                     # Managed Message Broker
    AppFlow,                # Application Integration
)
```

#### Analytics
```python
from diagrams.aws.analytics import (
    Kinesis,                # Real-time Data Streaming
    EMR,                    # Elastic MapReduce
    Athena,                 # Serverless Query Service
    Glue,                   # ETL Service
    DataPipeline,           # Data Workflow
    QuickSight,             # Business Intelligence
)
```

#### Security
```python
from diagrams.aws.security import (
    IAM,                    # Identity & Access Management
    Cognito,                # User Authentication
    SecretsManager,         # Secrets Storage
    WAF,                    # Web Application Firewall
    Shield,                 # DDoS Protection
    GuardDuty,              # Threat Detection
    KMS,                    # Key Management Service
)
```

## GCP (Google Cloud Platform)

### Import Pattern
```python
from diagrams.gcp.{category} import {Service}
```

### Categories and Common Services

#### Compute
```python
from diagrams.gcp.compute import (
    GCE,                    # Google Compute Engine
    GKE,                    # Google Kubernetes Engine
    Functions,              # Cloud Functions (Serverless)
    Run,                    # Cloud Run (Containers)
    AppEngine,              # Platform as a Service
    ComputeEngine,          # VM Instances
)
```

#### Database
```python
from diagrams.gcp.database import (
    SQL,                    # Cloud SQL
    Spanner,                # Globally Distributed Database
    BigTable,               # NoSQL Big Data
    Firestore,              # Document Database
    Datastore,              # NoSQL Database
)
```

#### Storage
```python
from diagrams.gcp.storage import (
    GCS,                    # Google Cloud Storage
    PersistentDisk,         # Block Storage
    Filestore,              # Managed File Storage
)
```

#### Network
```python
from diagrams.gcp.network import (
    LoadBalancing,          # Cloud Load Balancing
    CDN,                    # Cloud CDN
    DNS,                    # Cloud DNS
    VPC,                    # Virtual Private Cloud
    Armor,                  # DDoS Protection
)
```

#### Analytics
```python
from diagrams.gcp.analytics import (
    BigQuery,               # Data Warehouse
    PubSub,                 # Pub/Sub Messaging
    Dataflow,               # Stream/Batch Processing
    Dataproc,               # Managed Hadoop/Spark
    Composer,               # Managed Apache Airflow
)
```

#### ML/AI
```python
from diagrams.gcp.ml import (
    AutoML,                 # AutoML Platform
    VertexAI,               # Unified ML Platform
    NaturalLanguageAPI,     # NLP Service
    VisionAPI,              # Computer Vision
)
```

## Azure (Microsoft Azure)

### Import Pattern
```python
from diagrams.azure.{category} import {Service}
```

### Categories and Common Services

#### Compute
```python
from diagrams.azure.compute import (
    VM,                     # Virtual Machines
    FunctionApps,           # Azure Functions
    ContainerInstances,     # Container Service
    AKS,                    # Azure Kubernetes Service
    AppServices,            # Web App Hosting
    BatchAccounts,          # Batch Processing
)
```

#### Database
```python
from diagrams.azure.database import (
    SQLDatabases,           # Azure SQL Database
    CosmosDB,               # NoSQL Database
    DatabaseForMysql,       # MySQL Service
    DatabaseForPostgresql,  # PostgreSQL Service
    SQLDataWarehouse,       # Data Warehouse
)
```

#### Storage
```python
from diagrams.azure.storage import (
    BlobStorage,            # Object Storage
    DataLakeStorage,        # Big Data Storage
    FileStorage,            # File Shares
    QueueStorage,           # Message Queue Storage
    StorageAccounts,        # General Storage
)
```

#### Network
```python
from diagrams.azure.network import (
    LoadBalancers,          # Load Balancer
    ApplicationGateway,     # Layer 7 Load Balancer
    CDN,                    # Content Delivery Network
    VirtualNetworks,        # VNet
    Firewall,               # Azure Firewall
    DNSZones,               # DNS Service
)
```

#### Integration
```python
from diagrams.azure.integration import (
    ServiceBus,             # Enterprise Messaging
    EventGrid,              # Event Routing
    LogicApps,              # Workflow Automation
)
```

## Kubernetes

### Import Pattern
```python
from diagrams.k8s.{category} import {Resource}
```

### Categories and Common Resources

#### Compute
```python
from diagrams.k8s.compute import (
    Pod,                    # Basic Compute Unit
    Deployment,             # Deployment Controller
    ReplicaSet,             # Replica Management
    StatefulSet,            # Stateful Applications
    DaemonSet,              # Node-level Daemons
    Job,                    # Batch Job
    CronJob,                # Scheduled Job
)
```

#### Network
```python
from diagrams.k8s.network import (
    Service,                # Service Abstraction
    Ingress,                # External Access
    NetworkPolicy,          # Network Rules
    Endpoint,               # Service Endpoint
)
```

#### Storage
```python
from diagrams.k8s.storage import (
    PersistentVolume,       # PV
    PersistentVolumeClaim,  # PVC
    StorageClass,           # Storage Class
    Volume,                 # Generic Volume
)
```

#### Config
```python
from diagrams.k8s.clusterconfig import (
    HPA,                    # Horizontal Pod Autoscaler
    ConfigMap,              # Configuration Data
    Secret,                 # Sensitive Data
    LimitRange,             # Resource Limits
)
```

#### RBAC
```python
from diagrams.k8s.rbac import (
    Role,                   # Role Definition
    RoleBinding,            # Role Assignment
    ServiceAccount,         # Service Account
    ClusterRole,            # Cluster-wide Role
)
```

## On-Premise

### Import Pattern
```python
from diagrams.onprem.{category} import {Service}
```

### Categories and Common Services

#### Compute
```python
from diagrams.onprem.compute import (
    Server,                 # Generic Server
    Rack,                   # Server Rack
)
```

#### Database
```python
from diagrams.onprem.database import (
    PostgreSQL,             # PostgreSQL
    MySQL,                  # MySQL
    MongoDB,                # MongoDB
    Cassandra,              # Cassandra
    ClickHouse,             # ClickHouse
    CockroachDB,            # CockroachDB
    Couchbase,              # Couchbase
    Oracle,                 # Oracle Database
)
```

#### Network
```python
from diagrams.onprem.network import (
    Nginx,                  # Nginx Web Server
    Apache,                 # Apache HTTP Server
    HAProxy,                # HAProxy Load Balancer
    Kong,                   # Kong API Gateway
    Istio,                  # Istio Service Mesh
    Traefik,                # Traefik Reverse Proxy
)
```

#### Queue
```python
from diagrams.onprem.queue import (
    Kafka,                  # Apache Kafka
    RabbitMQ,               # RabbitMQ
    ActiveMQ,               # ActiveMQ
    ZeroMQ,                 # ZeroMQ
    Celery,                 # Celery Task Queue
)
```

#### Monitoring
```python
from diagrams.onprem.monitoring import (
    Prometheus,             # Prometheus
    Grafana,                # Grafana
    Datadog,                # Datadog Agent
    Nagios,                 # Nagios
    Splunk,                 # Splunk
)
```

#### Logging
```python
from diagrams.onprem.aggregator import (
    Fluentd,                # Fluentd
    Logstash,               # Logstash
)
```

#### Analytics
```python
from diagrams.onprem.analytics import (
    Spark,                  # Apache Spark
    Hadoop,                 # Apache Hadoop
    Flink,                  # Apache Flink
    Storm,                  # Apache Storm
)
```

#### Container
```python
from diagrams.onprem.container import (
    Docker,                 # Docker
    Containerd,             # Containerd
)
```

#### CI/CD
```python
from diagrams.onprem.ci import (
    Jenkins,                # Jenkins
    GitlabCI,               # GitLab CI
    CircleCI,               # CircleCI
    TravisCI,               # Travis CI
    GithubActions,          # GitHub Actions
)
```

#### VCS
```python
from diagrams.onprem.vcs import (
    Git,                    # Git
    Github,                 # GitHub
    Gitlab,                 # GitLab
    Bitbucket,              # Bitbucket
)
```

## SaaS (Software as a Service)

### Import Pattern
```python
from diagrams.saas.{category} import {Service}
```

### Common Services
```python
from diagrams.saas.analytics import (
    Snowflake,              # Snowflake Data Warehouse
)

from diagrams.saas.cdn import (
    Cloudflare,             # Cloudflare CDN
    Fastly,                 # Fastly CDN
)

from diagrams.saas.chat import (
    Slack,                  # Slack
    Teams,                  # Microsoft Teams
)

from diagrams.saas.identity import (
    Auth0,                  # Auth0
    Okta,                   # Okta
)

from diagrams.saas.logging import (
    Datadog,                # Datadog
    NewRelic,               # New Relic
)
```

## Programming Languages/Frameworks

### Import Pattern
```python
from diagrams.programming.{category} import {Language}
```

### Languages
```python
from diagrams.programming.language import (
    Python,                 # Python
    Java,                   # Java
    JavaScript,             # JavaScript
    Go,                     # Go
    Rust,                   # Rust
    Csharp,                 # C#
    Ruby,                   # Ruby
    PHP,                    # PHP
    TypeScript,             # TypeScript
)
```

### Frameworks
```python
from diagrams.programming.framework import (
    React,                  # React
    Vue,                    # Vue.js
    Angular,                # Angular
    Django,                 # Django
    Flask,                  # Flask
    FastAPI,                # FastAPI
    Spring,                 # Spring Framework
    Rails,                  # Ruby on Rails
)
```

## Generic

### Import Pattern
```python
from diagrams.generic.{category} import {Component}
```

### Common Components
```python
from diagrams.generic.blank import Blank
from diagrams.generic.compute import Rack
from diagrams.generic.database import SQL
from diagrams.generic.device import Mobile, Tablet
from diagrams.generic.network import Firewall, Router, Switch
from diagrams.generic.os import (
    Android,                # Android
    IOS,                    # iOS
    LinuxGeneral,           # Linux
    Windows,                # Windows
    Mac,                    # macOS
)
from diagrams.generic.storage import Storage
from diagrams.generic.virtualization import (
    Virtualbox,             # VirtualBox
    VMware,                 # VMware
    XEN,                    # Xen
)
```

## Alibaba Cloud

### Import Pattern
```python
from diagrams.alibabacloud.{category} import {Service}
```

### Common Services
```python
from diagrams.alibabacloud.compute import ECS, ElasticSearch
from diagrams.alibabacloud.database import RDS
from diagrams.alibabacloud.network import SLB, VPC
from diagrams.alibabacloud.storage import OSS
```

## Oracle Cloud (OCI)

### Import Pattern
```python
from diagrams.oci.{category} import {Service}
```

### Common Services
```python
from diagrams.oci.compute import (
    Container,              # Container Instance
    Functions,              # Oracle Functions
    OCIR,                   # Container Registry
    VM,                     # Virtual Machine
)

from diagrams.oci.database import (
    Autonomous,             # Autonomous Database
    DatabaseService,        # Database Service
)

from diagrams.oci.network import (
    LoadBalancer,           # Load Balancer
    VCN,                    # Virtual Cloud Network
)

from diagrams.oci.storage import (
    ObjectStorage,          # Object Storage
    BlockStorage,           # Block Volume
    FileStorage,            # File Storage
)
```

## Usage Tips

### Finding Available Nodes

To see all available nodes for a provider:

```python
# List all AWS compute nodes
from diagrams import aws
import diagrams.aws.compute as compute
print([name for name in dir(compute) if not name.startswith('_')])
```

### Using Multiple Providers

Mix and match providers in a single diagram:

```python
from diagrams import Diagram, Cluster
from diagrams.aws.compute import EC2
from diagrams.gcp.storage import GCS
from diagrams.onprem.database import PostgreSQL

with Diagram("Multi-Cloud"):
    with Cluster("AWS"):
        app = EC2("app")
    
    with Cluster("GCP"):
        backup = GCS("backup")
    
    with Cluster("On-Prem"):
        db = PostgreSQL("db")
    
    app >> db
    db >> backup
```

### Alias Names

Many services have aliases for convenience:

```python
# These are the same
from diagrams.aws.database import RDS
from diagrams.aws.database import Relational  # alias

from diagrams.aws.compute import EC2
from diagrams.aws.compute import ElasticCompute  # alias
```

### Category Organization

Each provider organizes services into logical categories:
- **Compute**: VMs, containers, serverless
- **Database**: SQL, NoSQL, cache
- **Network**: Load balancers, CDN, DNS
- **Storage**: Object, block, file storage
- **Analytics**: Data processing, warehousing
- **Integration**: Messaging, events, workflows
- **Security**: IAM, encryption, firewalls
- **ML**: Machine learning services

Use the category that best fits your use case for consistent diagram organization.
