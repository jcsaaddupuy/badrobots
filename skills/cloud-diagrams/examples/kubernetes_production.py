#!/usr/bin/env python3
"""
Kubernetes Production Deployment Example
Demonstrates a production-ready Kubernetes deployment with
ingress, services, deployments, and supporting infrastructure.
"""

from diagrams import Diagram, Cluster, Edge
from diagrams.k8s.network import Ingress, Service
from diagrams.k8s.compute import Deployment, Pod, StatefulSet, DaemonSet
from diagrams.k8s.storage import PersistentVolume, PersistentVolumeClaim, StorageClass
from diagrams.k8s.clusterconfig import HPA, ConfigMap, Secret
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.monitoring import Prometheus, Grafana
from diagrams.onprem.logging import Fluentd
from diagrams.aws.storage import EBS

with Diagram(
    "Kubernetes Production Deployment",
    filename="kubernetes_production",
    show=False,
    direction="TB"
):
    ingress = Ingress("app.example.com")
    
    with Cluster("Application Layer"):
        frontend_svc = Service("frontend-svc")
        
        with Cluster("Frontend Deployment"):
            frontend_hpa = HPA("frontend-hpa")
            frontend_deploy = Deployment("frontend")
            frontend_pods = [
                Pod("frontend-1"),
                Pod("frontend-2"),
                Pod("frontend-3")
            ]
            frontend_deploy >> frontend_pods
            frontend_hpa >> frontend_deploy
        
        backend_svc = Service("backend-svc")
        
        with Cluster("Backend Deployment"):
            backend_hpa = HPA("backend-hpa")
            backend_deploy = Deployment("backend")
            backend_pods = [
                Pod("backend-1"),
                Pod("backend-2"),
                Pod("backend-3")
            ]
            backend_deploy >> backend_pods
            backend_hpa >> backend_deploy
    
    with Cluster("Data Layer"):
        with Cluster("PostgreSQL StatefulSet"):
            db_svc = Service("db-svc\n(Headless)")
            db_stateful = StatefulSet("postgresql")
            db_pods = [
                Pod("db-0\n(Primary)"),
                Pod("db-1\n(Replica)"),
                Pod("db-2\n(Replica)")
            ]
            db_stateful >> db_pods
        
        with Cluster("Redis StatefulSet"):
            cache_svc = Service("cache-svc\n(Headless)")
            cache_stateful = StatefulSet("redis")
            cache_pods = [
                Pod("redis-0"),
                Pod("redis-1"),
                Pod("redis-2")
            ]
            cache_stateful >> cache_pods
        
        with Cluster("Persistent Storage"):
            storage_class = StorageClass("fast-ssd")
            pv = PersistentVolume("db-pv")
            pvc = PersistentVolumeClaim("db-pvc")
            ebs = EBS("AWS EBS")
            
            storage_class >> pv >> pvc
            pv >> ebs
            db_pods >> pvc
    
    with Cluster("Configuration"):
        config = ConfigMap("app-config")
        secrets = Secret("app-secrets")
        
        [frontend_pods, backend_pods] >> Edge(style="dashed") >> config
        backend_pods >> Edge(style="dashed") >> secrets
    
    with Cluster("Observability"):
        with Cluster("Monitoring"):
            prometheus = Prometheus("Prometheus")
            grafana = Grafana("Grafana")
            prometheus >> grafana
        
        with Cluster("Logging"):
            fluentd_daemon = DaemonSet("fluentd")
            fluentd_pods = [
                Pod("fluentd-1"),
                Pod("fluentd-2"),
                Pod("fluentd-3")
            ]
            fluentd_daemon >> fluentd_pods
    
    # Traffic flow
    ingress >> frontend_svc >> frontend_pods
    frontend_pods >> backend_svc >> backend_pods
    backend_pods >> db_svc >> db_pods
    backend_pods >> cache_svc >> cache_pods
    
    # Monitoring
    [frontend_pods, backend_pods, db_pods, cache_pods] >> Edge(
        label="metrics",
        style="dashed"
    ) >> prometheus
    
    [frontend_pods, backend_pods, db_pods, cache_pods] >> Edge(
        label="logs",
        style="dashed"
    ) >> fluentd_pods
