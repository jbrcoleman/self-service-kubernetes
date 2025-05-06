#!/bin/bash
set -e

echo "Running integration tests..."

# Set up environment variables
export TEST_NAMESPACE="integration-test-$(date +%s)"

# Create test namespace
kubectl create namespace $TEST_NAMESPACE

# Clean up function to run on exit
function cleanup {
  echo "Cleaning up test resources..."
  kubectl delete namespace $TEST_NAMESPACE --ignore-not-found
}

# Register cleanup function
trap cleanup EXIT

echo "Setting up test environment in namespace: $TEST_NAMESPACE"

# Run API tests
echo "Running API integration tests..."
cd api && go test -tags=integration ./... -v

# Run frontend integration tests
echo "Running frontend integration tests..."
cd frontend && npm run test:integration

echo "Integration tests completed successfully!"
