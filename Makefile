# Self-Service Kubernetes Environment Provisioner Makefile

# Variables
ENV ?= dev
AWS_REGION ?= us-west-2
CLUSTER_NAME ?= k8s-env-provisioner-$(ENV)
DOCKER_REGISTRY ?= your-registry
VERSION ?= 0.1.0

# Tools
KUBECTL := kubectl
TERRAFORM := terraform
HELM := helm
GO := go
NPM := npm
DOCKER := docker
KIND := kind
FLUX := flux

# Targets
.PHONY: all deps build clean test dev deploy upgrade destroy

# Default target
all: build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	# Install backend dependencies
	cd api && $(GO) mod download
	# Install frontend dependencies
	cd frontend && $(NPM) install
	# Install kubectl plugins
	$(KUBECTL) krew install ctx ns
	# Install Flux CLI (if not already installed)
	if ! command -v flux > /dev/null; then \
		curl -s https://fluxcd.io/install.sh | sudo bash; \
	fi

# Build the project
build: build-api build-frontend build-controller

# Build the API server
build-api:
	@echo "Building API server..."
	cd api && $(GO) build -o ../bin/provisioner-api

# Build the frontend
build-frontend:
	@echo "Building frontend..."
	cd frontend && $(NPM) run build

# Build the multi-tenancy controller
build-controller:
	@echo "Building multi-tenancy controller..."
	cd multi-tenancy && $(GO) build -o ../bin/multi-tenancy-controller

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -rf frontend/build/
	rm -rf api/tmp/
	rm -rf .terraform/

# Run tests
test: test-api test-frontend

# Run API tests
test-api:
	@echo "Running API tests..."
	cd api && $(GO) test -v ./...

# Run frontend tests
test-frontend:
	@echo "Running frontend tests..."
	cd frontend && $(NPM) test

# Run integration tests
integration-tests:
	@echo "Running integration tests..."
	./scripts/run-integration-tests.sh

# Run end-to-end tests
e2e-tests:
	@echo "Running end-to-end tests..."
	./scripts/run-e2e-tests.sh

# Start local development environment
dev: setup-kind deploy-local-components

# Setup a local Kubernetes cluster using kind
setup-kind:
	@echo "Setting up kind cluster..."
	$(KIND) create cluster --config=scripts/kind-config.yaml --name=k8s-provisioner-local
	$(KUBECTL) config use-context kind-k8s-provisioner-local

# Deploy components to local kind cluster
deploy-local-components:
	@echo "Deploying components to local cluster..."
	# Install Istio
	./scripts/install-istio.sh
	# Install Prometheus stack
	$(HELM) repo add prometheus-community https://prometheus-community.github.io/helm-charts
	$(HELM) upgrade --install monitoring prometheus-community/kube-prometheus-stack \
		--namespace monitoring --create-namespace -f monitoring/prometheus/values.yaml
	# Install Flux
	$(FLUX) install
	# Deploy API server
	$(KUBECTL) apply -f kubernetes/api/deployment.yaml
	# Setup port forwarding for local development
	./scripts/setup-port-forwarding.sh

# Deploy to AWS
deploy:
	@echo "Deploying to $(ENV) environment..."
	# Apply Terraform configuration
	cd provisioning/aws && $(TERRAFORM) init \
		-backend-config="key=state/$(CLUSTER_NAME).tfstate"
	cd provisioning/aws && $(TERRAFORM) apply \
		-var-file="../config/$(ENV).tfvars" \
		-var="cluster_name=$(CLUSTER_NAME)" \
		-auto-approve
	# Update kubeconfig
	aws eks update-kubeconfig --region $(AWS_REGION) --name $(CLUSTER_NAME)
	# Install platform components
	./scripts/deploy-platform-components.sh $(ENV)

# Upgrade deployment
upgrade:
	@echo "Upgrading $(ENV) environment..."
	# Pull latest changes
	git pull
	# Apply Terraform changes
	cd provisioning/aws && $(TERRAFORM) init \
		-backend-config="key=state/$(CLUSTER_NAME).tfstate"
	cd provisioning/aws && $(TERRAFORM) apply \
		-var-file="../config/$(ENV).tfvars" \
		-var="cluster_name=$(CLUSTER_NAME)" \
		-auto-approve
	# Upgrade platform components
	./scripts/upgrade-platform-components.sh $(ENV)

# Destroy infrastructure
destroy:
	@echo "Destroying $(ENV) environment..."
	cd provisioning/aws && $(TERRAFORM) init \
		-backend-config="key=state/$(CLUSTER_NAME).tfstate"
	cd provisioning/aws && $(TERRAFORM) destroy \
		-var-file="../config/$(ENV).tfvars" \
		-var="cluster_name=$(CLUSTER_NAME)" \
		-auto-approve

# Build Docker images
docker-build:
	@echo "Building Docker images..."
	$(DOCKER) build -t $(DOCKER_REGISTRY)/k8s-env-provisioner/api:$(VERSION) -f api/Dockerfile ./api
	$(DOCKER) build -t $(DOCKER_REGISTRY)/k8s-env-provisioner/frontend:$(VERSION) -f frontend/Dockerfile ./frontend
	$(DOCKER) build -t $(DOCKER_REGISTRY)/k8s-env-provisioner/multi-tenancy-controller:$(VERSION) -f multi-tenancy/Dockerfile ./multi-tenancy

# Push Docker images
docker-push:
	@echo "Pushing Docker images..."
	$(DOCKER) push $(DOCKER_REGISTRY)/k8s-env-provisioner/api:$(VERSION)
	$(DOCKER) push $(DOCKER_REGISTRY)/k8s-env-provisioner/frontend:$(VERSION)
	$(DOCKER) push $(DOCKER_REGISTRY)/k8s-env-provisioner/multi-tenancy-controller:$(VERSION)