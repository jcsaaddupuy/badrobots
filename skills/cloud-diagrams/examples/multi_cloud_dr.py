#!/usr/bin/env python3
"""
Multi-Cloud Disaster Recovery Example
Demonstrates a multi-cloud architecture with active-passive DR setup
using AWS as primary and GCP as backup.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import EC2, AutoScaling
from diagrams.aws.database import RDS
from diagrams.aws.network import ELB, Route53
from diagrams.aws.storage import S3
from diagrams.gcp.compute import GCE
from diagrams.gcp.database import SQL
from diagrams.gcp.storage import GCS
from diagrams.gcp.network import LoadBalancing
from diagrams.onprem.database import PostgreSQL

with Diagram(
    "Multi-Cloud Disaster Recovery",
    filename="multi_cloud_dr",
    show=False,
    direction="LR"
):
    # Global DNS with failover
    dns = Route53("Global DNS\n(Failover Routing)")
    
    with Cluster("Primary Region (AWS us-east-1)"):
        with Cluster("Production"):
            aws_lb = ELB("Load Balancer")
            
            with Cluster("Auto Scaling Group"):
                aws_web = [
                    EC2("web-1"),
                    EC2("web-2"),
                    EC2("web-3")
                ]
            
            with Cluster("Database (Multi-AZ)"):
                aws_db_primary = RDS("Primary\nPostgreSQL")
                aws_db_standby = RDS("Standby\n(Same Region)")
                aws_db_primary - Edge(label="sync replication") - aws_db_standby
            
            aws_backup = S3("Backup\nStorage")
        
        aws_lb >> aws_web >> aws_db_primary
        aws_db_primary >> Edge(label="automated backups", style="dashed") >> aws_backup
    
    with Cluster("DR Region (GCP us-central1)"):
        with Cluster("Standby (Passive)"):
            gcp_lb = LoadBalancing("Load Balancer\n(Inactive)")
            
            with Cluster("Minimal Instances"):
                gcp_web = GCE("web-standby")
            
            gcp_db = SQL("Replica DB\nPostgreSQL")
            
            gcp_backup = GCS("Backup\nStorage")
        
        gcp_lb >> gcp_web >> gcp_db
    
    # Cross-cloud replication
    dns >> Edge(label="active", color="green", style="bold") >> aws_lb
    dns >> Edge(label="failover", color="red", style="dashed") >> gcp_lb
    
    aws_db_primary >> Edge(
        label="async replication\n(cross-cloud)",
        color="blue",
        style="dashed"
    ) >> gcp_db
    
    aws_backup >> Edge(
        label="cross-region backup",
        style="dashed"
    ) >> gcp_backup
