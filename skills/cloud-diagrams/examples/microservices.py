#!/usr/bin/env python3
"""
Microservices Architecture Example
Demonstrates a complete microservices setup with multiple services,
databases, message queues, and monitoring.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import ECS, Lambda
from diagrams.aws.database import RDS, ElastiCache, DynamoDB
from diagrams.aws.network import ELB, APIGateway, CloudFront, Route53
from diagrams.aws.integration import SQS, SNS
from diagrams.aws.storage import S3
from diagrams.onprem.monitoring import Prometheus, Grafana
from diagrams.onprem.logging import Fluentd

with Diagram(
    "Microservices Architecture",
    filename="microservices",
    show=False,
    direction="TB"
):
    # Entry points
    dns = Route53("DNS")
    cdn = CloudFront("CDN")
    lb = ELB("Load Balancer")
    
    # Static assets
    static = S3("Static Assets")
    
    with Cluster("API Gateway Layer"):
        gateway = APIGateway("API Gateway")
    
    with Cluster("Microservices"):
        with Cluster("User Service"):
            user_api = ECS("User API")
            user_db = RDS("User DB")
            user_cache = ElastiCache("User Cache")
            user_api >> user_db
            user_api >> user_cache
        
        with Cluster("Order Service"):
            order_api = ECS("Order API")
            order_db = DynamoDB("Order DB")
            order_api >> order_db
        
        with Cluster("Inventory Service"):
            inventory_api = ECS("Inventory API")
            inventory_db = RDS("Inventory DB")
            inventory_cache = ElastiCache("Inventory Cache")
            inventory_api >> inventory_db
            inventory_api >> inventory_cache
        
        with Cluster("Payment Service"):
            payment_api = ECS("Payment API")
            payment_db = RDS("Payment DB\n(Encrypted)")
            payment_api >> payment_db
    
    with Cluster("Async Processing"):
        event_queue = SQS("Event Queue")
        notification_topic = SNS("Notifications")
        
        email_worker = Lambda("Email Worker")
        analytics_worker = Lambda("Analytics Worker")
        
        event_queue >> email_worker
        event_queue >> analytics_worker
    
    with Cluster("Monitoring & Logging"):
        metrics = Prometheus("Metrics")
        dashboard = Grafana("Dashboard")
        logs = Fluentd("Logs")
        
        metrics >> dashboard
    
    # Main flow
    dns >> cdn >> lb >> gateway
    
    # Static content
    cdn >> static
    
    # API routing
    gateway >> user_api
    gateway >> order_api
    gateway >> inventory_api
    gateway >> payment_api
    
    # Service interactions
    order_api >> Edge(label="check stock") >> inventory_api
    order_api >> Edge(label="process payment") >> payment_api
    order_api >> Edge(label="get user") >> user_api
    
    # Async events
    order_api >> Edge(label="publish events") >> event_queue
    payment_api >> Edge(label="send confirmation") >> notification_topic
    notification_topic >> email_worker
    
    # Monitoring
    [user_api, order_api, inventory_api, payment_api] >> Edge(style="dashed") >> metrics
    [user_api, order_api, inventory_api, payment_api] >> Edge(style="dashed") >> logs
