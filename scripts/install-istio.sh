#!/bin/bash
set -e

# Install Istio script for Kubernetes Environment Provisioner

echo "Installing Istio service mesh..."

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo "Error: Helm is not installed. Please install Helm first."
    exit 1
fi

# Add Istio Helm repository
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

# Create namespace for Istio
kubectl create namespace istio-system --dry-run=client -o yaml | kubectl apply -f -

# Install Istio base chart
echo "Installing Istio base components..."
helm install istio-base istio/base \
  --namespace istio-system \
  --wait

# Install Istio discovery chart (istiod)
echo "Installing Istio discovery components..."
helm install istiod istio/istiod \
  --namespace istio-system \
  --wait

# Install Istio ingress gateway
echo "Installing Istio ingress gateway..."
helm install istio-ingress istio/gateway \
  --namespace istio-system \
  --set service.type=NodePort \
  --wait

echo "Istio installation completed successfully!"
