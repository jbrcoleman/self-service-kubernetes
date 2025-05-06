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
echo "Upgrading platform components in ${ENVIRONMENT} environment (${CLUSTER_NAME})..."

# Make sure kubectl is configured
kubectl cluster-info || { echo "kubectl not configured, please check your connection to the cluster"; exit 1; }

# Upgrade Istio
echo "Upgrading Istio..."
helm repo update istio
helm upgrade istio-base istio/base \
  --namespace istio-system \
  --wait
helm upgrade istiod istio/istiod \
  --namespace istio-system \
  --wait
helm upgrade istio-ingress istio/gateway \
  --namespace istio-system \
  --wait

# Upgrade Prometheus stack
echo "Upgrading Prometheus stack..."
helm repo update prometheus-community
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values monitoring/prometheus/values.yaml \
  --wait

# Upgrade Flux
echo "Upgrading Flux..."
flux check --pre
flux install --upgrade

# Upgrade OPA Gatekeeper
echo "Upgrading OPA Gatekeeper..."
helm repo update gatekeeper
helm upgrade gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system \
  --wait

# Upgrade AWS Load Balancer Controller if in AWS
if [[ "$ENVIRONMENT" != "local" ]]; then
  echo "Upgrading AWS Load Balancer Controller..."
  helm repo update eks
  helm upgrade aws-load-balancer-controller eks/aws-load-balancer-controller \
    --namespace kube-system \
    --set clusterName=$CLUSTER_NAME \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller
fi

# Upgrade API and Frontend
echo "Upgrading API and Frontend deployments..."
kubectl apply -f kubernetes/api/deployment.yaml
kubectl apply -f kubernetes/frontend/deployment.yaml

echo "Platform components upgraded successfully in ${ENVIRONMENT} environment!"
