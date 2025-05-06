#!/bin/bash
set -e

echo "Running end-to-end tests..."

# Set up environment variables
export E2E_NAMESPACE="e2e-test-$(date +%s)"

# Create test namespace
kubectl create namespace $E2E_NAMESPACE

# Clean up function to run on exit
function cleanup {
  echo "Cleaning up test resources..."
  kubectl delete namespace $E2E_NAMESPACE --ignore-not-found
}

# Register cleanup function
trap cleanup EXIT

echo "Setting up E2E test environment in namespace: $E2E_NAMESPACE"

# Deploy test instance
echo "Deploying test instance..."
helm install e2e-test ./charts/k8s-env-provisioner \
  --namespace $E2E_NAMESPACE \
  --set environment=test \
  --wait

# Run E2E tests
echo "Running Cypress E2E tests..."
cd frontend && npm run test:e2e

echo "End-to-end tests completed successfully!"
