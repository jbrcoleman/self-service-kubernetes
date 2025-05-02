# Self-Service Kubernetes Environment Provisioner

A platform enabling developers to provision isolated Kubernetes environments with predefined guardrails on AWS.

## Project Overview

This project creates a self-service platform that allows developers to spin up isolated Kubernetes environments on AWS with predefined guardrails. The platform leverages Infrastructure as Code (IaC), implements a service mesh for network security and observability, handles multi-tenancy management, provides a sleek developer experience through a simple UI/API, and integrates with GitOps workflows.

## Architecture

The platform consists of the following key components:

- **Frontend Portal**: React-based web interface for developers to request and manage environments
- **API Server**: Go-based API for handling environment requests and management
- **Provisioning Engine**: Terraform modules for creating AWS resources and EKS clusters
- **GitOps Controller**: Flux-based system for managing cluster configurations
- **Service Mesh**: Istio implementation for network security and observability
- **Monitoring Stack**: Prometheus, Grafana, and OpenTelemetry for monitoring
- **Multi-tenancy Controller**: Custom controller for managing namespaces and RBAC
- **Guardrails Engine**: Policy-based system using OPA Gatekeeper

## Repository Structure

```
.
├── .github/                      # GitHub Actions workflows
├── api/                          # API server implementation
├── docs/                         # Documentation
├── frontend/                     # React-based frontend portal
├── provisioning/                 # Infrastructure as Code (Terraform modules)
│   ├── aws/                      # AWS-specific resources
│   ├── kubernetes/               # Kubernetes resources
│   └── modules/                  # Reusable Terraform modules
├── gitops/                       # GitOps configuration
├── service-mesh/                 # Istio service mesh configuration
├── monitoring/                   # Monitoring stack setup
├── multi-tenancy/                # Multi-tenancy implementation
├── guardrails/                   # OPA Gatekeeper policies
├── scripts/                      # Utility scripts
├── examples/                     # Example configurations
├── charts/                       # Helm charts
├── Makefile                      # Makefile for common operations
├── README.md                     # Project documentation
└── LICENSE                       # Project license
```

## Getting Started

### Prerequisites

- AWS Account with appropriate permissions
- Terraform >= 1.0.0
- Kubernetes CLI (kubectl) >= 1.22
- Helm >= 3.8.0
- Go >= 1.19
- Node.js >= 16.x
- Docker and Docker Compose

### Local Development Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/k8s-env-provisioner.git
cd k8s-env-provisioner
```

2. Set up your AWS credentials:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-west-2"
```

3. Install dependencies:

```bash
make deps
```

4. Start the local development environment:

```bash
make dev
```

This will:
- Start a local Kubernetes cluster using kind
- Deploy the API server
- Start the frontend portal
- Set up a local GitOps workflow

### Deploying to AWS

1. Initialize Terraform:

```bash
cd provisioning/aws
terraform init
```

2. Create a terraform.tfvars file with your AWS configuration:

```hcl
aws_region     = "us-west-2"
cluster_name   = "dev-k8s-provisioner"
vpc_cidr       = "10.0.0.0/16"
instance_types = ["m5.large"]
```

3. Deploy the infrastructure:

```bash
terraform apply
```

4. Deploy the platform components:

```bash
make deploy
```

## Features

### Self-Service Portal

The frontend portal allows developers to:
- Request new Kubernetes environments
- Define resource quotas and limits
- Access environment details and credentials
- Monitor environment status
- Manage environment lifecycle

### Infrastructure as Code

All infrastructure is defined as code using Terraform:
- AWS VPC, Subnets, Security Groups
- EKS Cluster configuration
- Node Groups with autoscaling
- Load Balancers and DNS configuration

### Service Mesh Implementation

Istio service mesh provides:
- Traffic management with fine-grained routing
- Security with mTLS communication
- Observability with distributed tracing
- Network resilience with circuit breakers and retries

### Multi-tenancy Management

The platform supports multi-tenancy with:
- Namespace isolation
- Resource quotas
- Network policies
- RBAC for access control
- Tenant-specific monitoring and logging

### GitOps Workflow

The GitOps approach ensures:
- Declarative configuration management
- Version-controlled environment configuration
- Automated synchronization with Git repositories
- Drift detection and reconciliation

### Guardrails and Policies

OPA Gatekeeper enforces policies for:
- Resource limits and quotas
- Security best practices
- Configuration standards
- Compliance requirements

## API Reference

The API documentation is available at `/api/docs` when running the platform. Key endpoints include:

- `POST /api/v1/environments`: Create a new environment
- `GET /api/v1/environments`: List all environments
- `GET /api/v1/environments/{id}`: Get environment details
- `DELETE /api/v1/environments/{id}`: Delete an environment
- `PATCH /api/v1/environments/{id}`: Update environment configuration

## Architecture Details

### Frontend Portal

The frontend portal is built with React and Chakra UI, providing a modern and responsive interface for developers to manage their Kubernetes environments. It includes:

- Dashboard with environment overview and metrics
- Environment creation wizard with templates
- Resource management interface
- Real-time status monitoring
- Access to logs and events
- Configuration management
- User and team management

### API Server

The API server is built with Go and provides a RESTful interface for managing environments. It:

- Authenticates and authorizes requests
- Validates input data
- Manages environment lifecycle
- Orchestrates Terraform operations
- Stores state in DynamoDB
- Provides metrics and monitoring
- Handles asynchronous operations

### Provisioning Engine

The provisioning engine uses Terraform to create and manage AWS resources and Kubernetes clusters. It:

- Creates VPC and networking infrastructure
- Provisions EKS clusters
- Configures node groups and autoscaling
- Sets up IAM roles and permissions
- Manages load balancers and DNS records
- Installs core platform components

### Multi-tenancy Controller

The multi-tenancy controller ensures proper isolation between environments. It:

- Creates and manages namespaces
- Configures resource quotas
- Sets up network policies
- Manages RBAC policies
- Enforces pod security policies
- Monitors namespace usage

### Service Mesh

The service mesh implementation using Istio provides:

- Secure service-to-service communication
- Traffic management and routing
- Observability with distributed tracing
- Resilience with circuit breakers and retries
- Fault injection for testing
- Access control and authorization

### Monitoring Stack

The monitoring stack includes:

- Prometheus for metrics collection
- Grafana for visualization
- Alertmanager for alerting
- OpenTelemetry for distributed tracing
- Loki for log aggregation
- Kiali for service mesh visualization

### GitOps Controller

The GitOps controller using Flux enables:

- Declarative configuration management
- Automated synchronization with Git repositories
- Continuous delivery workflows
- Drift detection and reconciliation
- Progressive delivery with canary deployments
- Secret management

## Development Workflow

### Setting Up Your Development Environment

1. Install prerequisites:
   - AWS CLI
   - Terraform
   - kubectl
   - Helm
   - Go
   - Node.js
   - Docker

2. Fork and clone the repository:
   ```bash
   git clone https://github.com/yourusername/k8s-env-provisioner.git
   cd k8s-env-provisioner
   ```

3. Create a development branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Install dependencies:
   ```bash
   make deps
   ```

5. Start the development environment:
   ```bash
   make dev
   ```

### Testing

Run tests with the following commands:

```bash
# Run API tests
cd api && go test ./...

# Run frontend tests
cd frontend && npm test

# Run integration tests
make integration-tests

# Run end-to-end tests
make e2e-tests
```

## Deployment

### Deploying to Production

1. Create a production deployment configuration:
   ```bash
   cp config/example.tfvars config/production.tfvars
   ```

2. Edit the production configuration in `config/production.tfvars`

3. Deploy to production:
   ```bash
   make deploy ENV=production
   ```

### Upgrading

To upgrade the platform:

1. Update your local repository:
   ```bash
   git pull origin main
   ```

2. Apply the upgrade:
   ```bash
   make upgrade ENV=production
   ```
