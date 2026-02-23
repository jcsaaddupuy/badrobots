#!/usr/bin/env python3
"""
Serverless Architecture Example
Demonstrates a complete serverless application using Lambda,
API Gateway, DynamoDB, and various AWS managed services.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.network import APIGateway, CloudFront, Route53
from diagrams.aws.database import DynamoDB
from diagrams.aws.storage import S3
from diagrams.aws.integration import SQS, SNS, Eventbridge
from diagrams.aws.security import Cognito, SecretsManager
from diagrams.aws.management import Cloudwatch
from diagrams.generic.device import Mobile

with Diagram(
    "Serverless Application Architecture",
    filename="serverless_app",
    show=False,
    direction="TB"
):
    # Entry points
    dns = Route53("DNS")
    cdn = CloudFront("CDN")
    
    with Cluster("Authentication"):
        cognito = Cognito("User Pool")
    
    with Cluster("API Layer"):
        api = APIGateway("API Gateway")
        
        with Cluster("API Functions"):
            auth_fn = Lambda("Authenticate")
            user_fn = Lambda("User CRUD")
            product_fn = Lambda("Product CRUD")
            order_fn = Lambda("Order CRUD")
    
    with Cluster("Data Layer"):
        users_table = DynamoDB("Users Table")
        products_table = DynamoDB("Products Table")
        orders_table = DynamoDB("Orders Table")
    
    with Cluster("Background Processing"):
        with Cluster("Event Processing"):
            event_bus = Eventbridge("Event Bus")
            
            order_processor = Lambda("Order Processor")
            notification_fn = Lambda("Notifications")
            analytics_fn = Lambda("Analytics")
        
        with Cluster("Async Jobs"):
            job_queue = SQS("Job Queue")
            dlq = SQS("Dead Letter Queue")
            
            image_processor = Lambda("Image Processor")
            report_generator = Lambda("Report Generator")
    
    with Cluster("Storage"):
        static_site = S3("Static Website\n(React/Vue)")
        uploads = S3("User Uploads")
        reports = S3("Generated Reports")
    
    with Cluster("Notifications"):
        notification_topic = SNS("Notification Topic")
    
    with Cluster("Configuration & Secrets"):
        secrets = SecretsManager("Secrets")
    
    with Cluster("Monitoring"):
        logs = Cloudwatch("CloudWatch Logs")
        metrics = Cloudwatch("CloudWatch Metrics")
    
    # Client access
    client = Mobile("Client")
    client >> dns >> cdn
    cdn >> static_site
    cdn >> api
    
    # Authentication flow
    client >> Edge(label="login") >> cognito
    cognito >> Edge(label="JWT") >> client
    
    # API routing
    api >> Edge(label="auth") >> auth_fn >> cognito
    api >> Edge(label="/users") >> user_fn >> users_table
    api >> Edge(label="/products") >> product_fn >> products_table
    api >> Edge(label="/orders") >> order_fn >> orders_table
    
    # Event-driven processing
    order_fn >> Edge(label="emit event") >> event_bus
    
    event_bus >> Edge(label="order.created") >> order_processor
    event_bus >> Edge(label="order.created") >> notification_fn
    event_bus >> Edge(label="*") >> analytics_fn
    
    order_processor >> orders_table
    notification_fn >> notification_topic
    
    # Async jobs
    user_fn >> Edge(label="upload image") >> job_queue
    job_queue >> image_processor >> uploads
    
    order_fn >> Edge(label="generate report") >> job_queue
    job_queue >> report_generator >> reports
    
    # Error handling
    job_queue >> Edge(label="failed", style="dashed", color="red") >> dlq
    
    # Secrets access
    [order_fn, notification_fn] >> Edge(style="dashed") >> secrets
    
    # Monitoring
    all_functions = [
        auth_fn, user_fn, product_fn, order_fn,
        order_processor, notification_fn, analytics_fn,
        image_processor, report_generator
    ]
    
    all_functions >> Edge(style="dashed", label="logs") >> logs
    all_functions >> Edge(style="dashed", label="metrics") >> metrics
