#!/usr/bin/env python3
"""
Data Pipeline Architecture Example
Demonstrates a complete data processing pipeline with ingestion,
processing, storage, and analytics layers.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.analytics import Kinesis, EMR, Glue, Athena
from diagrams.aws.storage import S3
from diagrams.aws.database import Redshift
from diagrams.aws.integration import SQS
from diagrams.aws.compute import Lambda
from diagrams.onprem.analytics import Spark
from diagrams.onprem.queue import Kafka
from diagrams.saas.analytics import Snowflake
from diagrams.generic.device import Mobile, Tablet

with Diagram(
    "Data Pipeline Architecture",
    filename="data_pipeline",
    show=False,
    direction="LR"
):
    with Cluster("Data Sources"):
        mobile = Mobile("Mobile Apps")
        web = Tablet("Web Apps")
        iot = [Mobile(f"IoT-{i}") for i in range(1, 4)]
    
    with Cluster("Ingestion Layer"):
        kinesis = Kinesis("Kinesis Streams")
        kafka = Kafka("Kafka")
        queue = SQS("SQS Queue")
    
    with Cluster("Processing Layer"):
        with Cluster("Real-time Processing"):
            lambda_processor = [
                Lambda("Stream Processor 1"),
                Lambda("Stream Processor 2")
            ]
        
        with Cluster("Batch Processing"):
            glue = Glue("ETL Jobs")
            emr = EMR("Spark Cluster")
    
    with Cluster("Storage Layer"):
        with Cluster("Data Lake"):
            raw_bucket = S3("Raw Data\n(Bronze)")
            processed_bucket = S3("Processed\n(Silver)")
            curated_bucket = S3("Curated\n(Gold)")
        
        warehouse = Redshift("Data Warehouse")
        snowflake = Snowflake("Snowflake\n(Analytics)")
    
    with Cluster("Analytics Layer"):
        athena = Athena("Athena\n(Ad-hoc Queries)")
        spark_analytics = Spark("Spark\n(Advanced Analytics)")
    
    # Data flow
    [mobile, web] >> kinesis
    iot >> kafka
    
    kinesis >> lambda_processor
    kafka >> Edge(label="batch") >> queue
    
    # Stream processing
    lambda_processor >> Edge(label="real-time") >> processed_bucket
    
    # Batch processing
    queue >> glue >> raw_bucket
    raw_bucket >> Edge(label="transform") >> emr >> processed_bucket
    processed_bucket >> Edge(label="aggregate") >> glue >> curated_bucket
    
    # Analytics
    curated_bucket >> warehouse
    curated_bucket >> snowflake
    curated_bucket >> athena
    warehouse >> spark_analytics
    
    # Query layer
    processed_bucket >> Edge(label="query") >> athena
