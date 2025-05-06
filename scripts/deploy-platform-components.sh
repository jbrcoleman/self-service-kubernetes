#!/bin/bash
set -e

# Check if environment parameter is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 dev"
    exit 1
fi

ENVIRONMENT=$1
CLUSTER_NAME="k8s-env-provisioner-${ENVIRONMENT}"
echo "Deploying platform components to ${ENVIRONMENT} environment (${CLUSTER_NAME})..."

# Make sure kubectl is configured
kubectl cluster-info || { echo "kubectl not configured, please check your connection to the cluster"; exit 1; }

# Create namespaces
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace istio-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace flux-system --dry-run=client -o yaml | kubectl apply -f -

# Install Istio
echo "Installing Istio..."
./scripts/install-istio.sh

# Install Prometheus stack
echo "Installing Prometheus stack..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values monitoring/prometheus/values.yaml \
  --wait

# Install Flux
echo "Installing Flux..."
kubectl apply -k gitops/flux/

# Set up GitOps repository
GITOPS_REPO=$(grep "GITOPS_REPO_URL" gitops/flux/gotk-sync.yaml | awk '{print $2}')
if [ -n "$GITOPS_REPO" ]; then
  echo "Setting up GitOps with repository: $GITOPS_REPO"
  # Replace placeholders in gotk-sync.yaml
  sed -i "s|\${GITOPS_REPO_URL}|$GITOPS_REPO|g" gitops/flux/gotk-sync.yaml
  sed -i "s|\${CLUSTER_NAME}|$CLUSTER_NAME|g" gitops/flux/gotk-sync.yaml
  
  # Apply updated sync configuration
  kubectl apply -f gitops/flux/gotk-sync.yaml
else
  echo "Warning: GitOps repository not configured"
fi

# Install AWS Load Balancer Controller if in AWS
if [[ "$ENVIRONMENT" != "local" ]]; then
  echo "Installing AWS Load Balancer Controller..."
  helm repo add eks https://aws.github.io/eks-charts
  helm repo update
  helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
    --namespace kube-system \
    --set clusterName=$CLUSTER_NAME \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller
fi

# Install OPA Gatekeeper
echo "Installing OPA Gatekeeper..."
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update
helm upgrade --install gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system --create-namespace \
  --wait

# Deploy API and Frontend
echo "Deploying API and Frontend..."
kubectl apply -f kubernetes/api/deployment.yaml
kubectl apply -f kubernetes/frontend/deployment.yaml

echo "Platform components deployed successfully to ${ENVIRONMENT} environment!"
