#!/bin/bash
set -e

echo "Setting up port forwarding for local development..."

# Start port forwarding for API server
API_POD=$(kubectl get pods -n default -l app=k8s-env-provisioner-api -o jsonpath="{.items[0].metadata.name}")
if [ -n "$API_POD" ]; then
  echo "Setting up port forwarding for API server pod: $API_POD"
  kubectl port-forward -n default pod/$API_POD 8080:8080 &
  echo "API server available at: http://localhost:8080"
else
  echo "Warning: API server pod not found"
fi

# Start port forwarding for frontend (if deployed)
FRONTEND_POD=$(kubectl get pods -n default -l app=k8s-env-provisioner-frontend -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")
if [ -n "$FRONTEND_POD" ]; then
  echo "Setting up port forwarding for frontend pod: $FRONTEND_POD"
  kubectl port-forward -n default pod/$FRONTEND_POD 3000:80 &
  echo "Frontend available at: http://localhost:3000"
fi

# Start port forwarding for Grafana
GRAFANA_POD=$(kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")
if [ -n "$GRAFANA_POD" ]; then
  echo "Setting up port forwarding for Grafana: $GRAFANA_POD"
  kubectl port-forward -n monitoring pod/$GRAFANA_POD 3001:3000 &
  echo "Grafana available at: http://localhost:3001"
fi

# Start port forwarding for Prometheus
PROMETHEUS_POD=$(kubectl get pods -n monitoring -l app=prometheus,component=server -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")
if [ -n "$PROMETHEUS_POD" ]; then
  echo "Setting up port forwarding for Prometheus: $PROMETHEUS_POD"
  kubectl port-forward -n monitoring pod/$PROMETHEUS_POD 9090:9090 &
  echo "Prometheus available at: http://localhost:9090"
fi

# Start port forwarding for Kiali
KIALI_POD=$(kubectl get pods -n istio-system -l app=kiali -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")
if [ -n "$KIALI_POD" ]; then
  echo "Setting up port forwarding for Kiali: $KIALI_POD"
  kubectl port-forward -n istio-system pod/$KIALI_POD 20001:20001 &
  echo "Kiali available at: http://localhost:20001"
fi

echo "Port forwarding set up complete."
echo "Press Ctrl+C to terminate all port forwarding processes."

# Wait for Ctrl+C
wait
