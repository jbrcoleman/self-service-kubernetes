package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/yourusername/k8s-env-provisioner/api/models"
	"github.com/yourusername/k8s-env-provisioner/api/terraform"
)

// EnvironmentHandler handles environment-related requests
type EnvironmentHandler struct {
	dynamoClient      *dynamodb.Client
	terraformExecutor *terraform.Executor
	validate          *validator.Validate
	tableName         string
}

// NewEnvironmentHandler creates a new environment handler
func NewEnvironmentHandler(dynamoClient *dynamodb.Client, terraformExecutor *terraform.Executor, validate *validator.Validate) *EnvironmentHandler {
	return &EnvironmentHandler{
		dynamoClient:      dynamoClient,
		terraformExecutor: terraformExecutor,
		validate:          validate,
		tableName:         "environments",
	}
}

// ListEnvironments returns all environments
func (h *EnvironmentHandler) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Extract query parameters
	queryParams := r.URL.Query()
	userID := queryParams.Get("userId")
	status := queryParams.Get("status")
	
	// Build query
	scanInput := &dynamodb.ScanInput{
		TableName: aws.String(h.tableName),
	}
	
	// Apply filters if provided
	var filterExpressions []string
	expressionAttributeValues := make(map[string]types.AttributeValue)
	expressionAttributeNames := make(map[string]string)
	
	if userID != "" {
		filterExpressions = append(filterExpressions, "#userId = :userId")
		expressionAttributeNames["#userId"] = "UserID"
		expressionAttributeValues[":userId"], _ = attributevalue.Marshal(userID)
	}
	
	if status != "" {
		filterExpressions = append(filterExpressions, "#status = :status")
		expressionAttributeNames["#status"] = "Status"
		expressionAttributeValues[":status"], _ = attributevalue.Marshal(status)
	}
	
	// Only include non-deleted environments
	filterExpressions = append(filterExpressions, "attribute_not_exists(DeletedAt)")
	
	// Combine filter expressions
	if len(filterExpressions) > 0 {
		filterExpression := filterExpressions[0]
		for i := 1; i < len(filterExpressions); i++ {
			filterExpression += " AND " + filterExpressions[i]
		}
		scanInput.FilterExpression = aws.String(filterExpression)
		scanInput.ExpressionAttributeNames = expressionAttributeNames
		scanInput.ExpressionAttributeValues = expressionAttributeValues
	}
	
	// Execute query
	result, err := h.dynamoClient.Scan(ctx, scanInput)
	if err != nil {
		log.Printf("Failed to scan environments: %v", err)
		http.Error(w, "Failed to retrieve environments", http.StatusInternalServerError)
		return
	}
	
	// Unmarshal results
	var environments []models.Environment
	err = attributevalue.UnmarshalListOfMaps(result.Items, &environments)
	if err != nil {
		log.Printf("Failed to unmarshal environments: %v", err)
		http.Error(w, "Failed to process environments", http.StatusInternalServerError)
		return
	}
	
	// Return environments
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(environments)
}

// CreateEnvironment creates a new environment
func (h *EnvironmentHandler) CreateEnvironment(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Parse request
	var envRequest models.EnvironmentRequest
	if err := json.NewDecoder(r.Body).Decode(&envRequest); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	
	// Validate request
	if err := h.validate.Struct(envRequest); err != nil {
		http.Error(w, "Validation error: "+err.Error(), http.StatusBadRequest)
		return
	}
	
	// Create environment record
	envID := uuid.New().String()
	clusterName := "env-" + envID[:8]
	
	environment := models.Environment{
		ID:             envID,
		Name:           envRequest.Name,
		Description:    envRequest.Description,
		TemplateID:     envRequest.TemplateID,
		UserID:         envRequest.UserID,
		ResourceLimits: envRequest.ResourceLimits,
		NetworkPolicy:  envRequest.NetworkPolicy,
		ServiceMesh:    envRequest.ServiceMesh,
		Monitoring:     envRequest.Monitoring,
		GitOps:         envRequest.GitOps,
		Addons:         envRequest.Addons,
		Tags:           envRequest.Tags,
		Status:         "CREATING",
		StatusMessage:  "Environment creation initiated",
		ClusterName:    clusterName,
		ConsoleURL:     "",  // Will be populated after provisioning
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	
	// Convert to DynamoDB item
	item, err := attributevalue.MarshalMap(environment)
	if err != nil {
		log.Printf("Failed to marshal environment: %v", err)
		http.Error(w, "Failed to create environment", http.StatusInternalServerError)
		return
	}
	
	// Save to DynamoDB
	_, err = h.dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(h.tableName),
		Item:      item,
	})
	if err != nil {
		log.Printf("Failed to save environment: %v", err)
		http.Error(w, "Failed to save environment", http.StatusInternalServerError)
		return
	}
	
	// Trigger provisioning in background
	go h.provisionEnvironment(environment)
	
	// Return the created environment
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(environment)
}

// GetEnvironment returns a specific environment
func (h *EnvironmentHandler) GetEnvironment(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Get environment ID from path
	vars := mux.Vars(r)
	envID := vars["id"]
	
	// Query DynamoDB
	result, err := h.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: envID},
		},
	})
	if err != nil {
		log.Printf("Failed to get environment: %v", err)
		http.Error(w, "Failed to retrieve environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment exists
	if result.Item == nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Unmarshal environment
	var environment models.Environment
	err = attributevalue.UnmarshalMap(result.Item, &environment)
	if err != nil {
		log.Printf("Failed to unmarshal environment: %v", err)
		http.Error(w, "Failed to process environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment is deleted
	if environment.DeletedAt != nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Return environment
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(environment)
}

// UpdateEnvironment updates an environment
func (h *EnvironmentHandler) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Get environment ID from path
	vars := mux.Vars(r)
	envID := vars["id"]
	
	// Parse request
	var envPatch models.EnvironmentPatch
	if err := json.NewDecoder(r.Body).Decode(&envPatch); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	
	// Validate request
	if err := h.validate.Struct(envPatch); err != nil {
		http.Error(w, "Validation error: "+err.Error(), http.StatusBadRequest)
		return
	}
	
	// Get existing environment
	result, err := h.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: envID},
		},
	})
	if err != nil {
		log.Printf("Failed to get environment: %v", err)
		http.Error(w, "Failed to retrieve environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment exists
	if result.Item == nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Unmarshal environment
	var environment models.Environment
	err = attributevalue.UnmarshalMap(result.Item, &environment)
	if err != nil {
		log.Printf("Failed to unmarshal environment: %v", err)
		http.Error(w, "Failed to process environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment is deleted
	if environment.DeletedAt != nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Apply updates
	if envPatch.Description != nil {
		environment.Description = *envPatch.Description
	}
	if envPatch.ResourceLimits != nil {
		environment.ResourceLimits = *envPatch.ResourceLimits
	}
	if envPatch.NetworkPolicy != nil {
		environment.NetworkPolicy = envPatch.NetworkPolicy
	}
	if envPatch.ServiceMesh != nil {
		environment.ServiceMesh = envPatch.ServiceMesh
	}
	if envPatch.Monitoring != nil {
		environment.Monitoring = envPatch.Monitoring
	}
	if envPatch.GitOps != nil {
		environment.GitOps = envPatch.GitOps
	}
	if envPatch.Addons != nil {
		environment.Addons = envPatch.Addons
	}
	if envPatch.Tags != nil {
		environment.Tags = envPatch.Tags
	}
	
	// Update timestamp
	environment.UpdatedAt = time.Now().UTC()
	environment.Status = "UPDATING"
	environment.StatusMessage = "Environment update initiated"
	
	// Save updated environment
	updatedItem, err := attributevalue.MarshalMap(environment)
	if err != nil {
		log.Printf("Failed to marshal environment: %v", err)
		http.Error(w, "Failed to update environment", http.StatusInternalServerError)
		return
	}
	
	_, err = h.dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(h.tableName),
		Item:      updatedItem,
	})
	if err != nil {
		log.Printf("Failed to save environment: %v", err)
		http.Error(w, "Failed to save environment", http.StatusInternalServerError)
		return
	}
	
	// Trigger update in background
	go h.updateEnvironment(environment)
	
	// Return updated environment
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(environment)
}

// DeleteEnvironment deletes an environment
func (h *EnvironmentHandler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Get environment ID from path
	vars := mux.Vars(r)
	envID := vars["id"]
	
	// Get existing environment
	result, err := h.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: envID},
		},
	})
	if err != nil {
		log.Printf("Failed to get environment: %v", err)
		http.Error(w, "Failed to retrieve environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment exists
	if result.Item == nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Unmarshal environment
	var environment models.Environment
	err = attributevalue.UnmarshalMap(result.Item, &environment)
	if err != nil {
		log.Printf("Failed to unmarshal environment: %v", err)
		http.Error(w, "Failed to process environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment is already deleted
	if environment.DeletedAt != nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Mark as deleting
	now := time.Now().UTC()
	environment.Status = "DELETING"
	environment.StatusMessage = "Environment deletion initiated"
	environment.UpdatedAt = now
	environment.DeletedAt = &now
	
	// Save updated environment
	updatedItem, err := attributevalue.MarshalMap(environment)
	if err != nil {
		log.Printf("Failed to marshal environment: %v", err)
		http.Error(w, "Failed to delete environment", http.StatusInternalServerError)
		return
	}
	
	_, err = h.dynamoClient.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(h.tableName),
		Item:      updatedItem,
	})
	if err != nil {
		log.Printf("Failed to save environment: %v", err)
		http.Error(w, "Failed to delete environment", http.StatusInternalServerError)
		return
	}
	
	// Trigger deletion in background
	go h.deleteEnvironment(environment)
	
	// Return success
	w.WriteHeader(http.StatusNoContent)
}

// GetEnvironmentStatus gets the detailed status of an environment
func (h *EnvironmentHandler) GetEnvironmentStatus(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	
	// Get environment ID from path
	vars := mux.Vars(r)
	envID := vars["id"]
	
	// Get environment from DynamoDB
	result, err := h.dynamoClient.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: envID},
		},
	})
	if err != nil {
		log.Printf("Failed to get environment: %v", err)
		http.Error(w, "Failed to retrieve environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment exists
	if result.Item == nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Unmarshal environment
	var environment models.Environment
	err = attributevalue.UnmarshalMap(result.Item, &environment)
	if err != nil {
		log.Printf("Failed to unmarshal environment: %v", err)
		http.Error(w, "Failed to process environment", http.StatusInternalServerError)
		return
	}
	
	// Check if environment is deleted
	if environment.DeletedAt != nil {
		http.Error(w, "Environment not found", http.StatusNotFound)
		return
	}
	
	// Get detailed status
	status, err := h.getEnvironmentDetailedStatus(environment)
	if err != nil {
		log.Printf("Failed to get detailed status: %v", err)
		http.Error(w, "Failed to retrieve environment status", http.StatusInternalServerError)
		return
	}
	
	// Return status
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// provisionEnvironment handles the provisioning of a new environment
func (h *EnvironmentHandler) provisionEnvironment(env models.Environment) {
	log.Printf("Provisioning environment: %s (%s)", env.Name, env.ID)
	
	// Update status
	h.updateEnvironmentStatus(env.ID, "PROVISIONING", "Provisioning resources")
	
	// Generate Terraform variables
	vars := map[string]interface{}{
		"cluster_name":     env.ClusterName,
		"region":           "us-west-2", // Get from template
		"environment":      "dev",
		"instance_types":   []string{"m5.large"},
		"min_nodes":        2,
		"max_nodes":        5,
		"desired_nodes":    2,
		"kubernetes_version": "1.26",
		"vpc_cidr":         "10.0.0.0/16",
		"resource_limits":  env.ResourceLimits,
		"network_policy":   env.NetworkPolicy,
		"service_mesh":     env.ServiceMesh,
		"monitoring":       env.Monitoring,
		"gitops":           env.GitOps,
		"addons":           env.Addons,
		"tags":             env.Tags,
	}
	
	// Execute Terraform
	err := h.terraformExecutor.Apply("aws", vars)
	if err != nil {
		log.Printf("Failed to provision environment: %v", err)
		h.updateEnvironmentStatus(env.ID, "ERROR", "Failed to provision resources: "+err.Error())
		return
	}
	
	// Get outputs
	outputs, err := h.terraformExecutor.GetOutputs("aws")
	if err != nil {
		log.Printf("Failed to get Terraform outputs: %v", err)
		h.updateEnvironmentStatus(env.ID, "ERROR", "Failed to get provisioning outputs: "+err.Error())
		return
	}
	
	// Extract kubeconfig
	kubeconfig, ok := outputs["kubeconfig"].(string)
	if !ok {
		log.Printf("Failed to get kubeconfig from outputs")
		h.updateEnvironmentStatus(env.ID, "ERROR", "Failed to get kubeconfig")
		return
	}
	
	// Extract console URL
	consoleURL, ok := outputs["console_url"].(string)
	if !ok {
		consoleURL = "" // Not critical, can be empty
	}
	
	// Configure Kubernetes resources
	err = h.configureKubernetesResources(env, kubeconfig)
	if err != nil {
		log.Printf("Failed to configure Kubernetes resources: %v", err)
		h.updateEnvironmentStatus(env.ID, "ERROR", "Failed to configure Kubernetes resources: "+err.Error())
		return
	}
	
	// Update environment with kubeconfig and console URL
	ctx := context.Background()
	_, err = h.dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: env.ID},
		},
		UpdateExpression: aws.String("SET KubeConfig = :kubeconfig, ConsoleURL = :consoleurl, Status = :status, StatusMessage = :message, UpdatedAt = :updated"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":kubeconfig": &types.AttributeValueMemberS{Value: kubeconfig},
			":consoleurl": &types.AttributeValueMemberS{Value: consoleURL},
			":status":     &types.AttributeValueMemberS{Value: "ACTIVE"},
			":message":    &types.AttributeValueMemberS{Value: "Environment provisioned successfully"},
			":updated":    &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	if err != nil {
		log.Printf("Failed to update environment: %v", err)
		return
	}
	
	log.Printf("Environment provisioned successfully: %s (%s)", env.Name, env.ID)
}

// updateEnvironment handles the update of an existing environment
func (h *EnvironmentHandler) updateEnvironment(env models.Environment) {
	log.Printf("Updating environment: %s (%s)", env.Name, env.ID)
	
	// Implementation omitted for brevity
	// Would use Terraform to update the environment
	
	// Update status after successful update
	h.updateEnvironmentStatus(env.ID, "ACTIVE", "Environment updated successfully")
}

// deleteEnvironment handles the deletion of an environment
func (h *EnvironmentHandler) deleteEnvironment(env models.Environment) {
	log.Printf("Deleting environment: %s (%s)", env.Name, env.ID)
	
	// Implementation omitted for brevity
	// Would use Terraform to destroy the environment
	
	// Update status after successful deletion
	h.updateEnvironmentStatus(env.ID, "DELETED", "Environment deleted successfully")
}

// configureKubernetesResources configures resources in the Kubernetes cluster
func (h *EnvironmentHandler) configureKubernetesResources(env models.Environment, kubeconfig string) error {
	// Implementation omitted for brevity
	// Would configure namespaces, RBAC, resource quotas, network policies, etc.
	return nil
}

// getEnvironmentDetailedStatus gets detailed status information about an environment
func (h *EnvironmentHandler) getEnvironmentDetailedStatus(env models.Environment) (models.EnvironmentStatus, error) {
	// Implementation omitted for brevity
	// Would get detailed status from Kubernetes API
	
	// Mock data for example
	status := models.EnvironmentStatus{
		Status:        env.Status,
		StatusMessage: env.StatusMessage,
		ResourceUtilization: models.ResourceUsage{
			CPUUsage:         "1.5",
			CPUPercentage:    30.0,
			MemoryUsage:      "4Gi",
			MemoryPercentage: 40.0,
			StorageUsage:     "10Gi",
			StoragePercentage: 20.0,
			NodeCount:        2,
			NamespaceCount:   3,
			PodCount:         10,
			ServiceCount:     5,
		},
		NodeStatus: []models.NodeStatus{
			{
				Name:             "node-1",
				Status:           "Ready",
				CPUPercentage:    30.0,
				MemoryPercentage: 40.0,
				PodCount:         5,
				Ready:            true,
				Age:              "2h",
				Version:          "v1.26.0",
				InternalIP:       "10.0.1.100",
			},
			{
				Name:             "node-2",
				Status:           "Ready",
				CPUPercentage:    30.0,
				MemoryPercentage: 40.0,
				PodCount:         5,
				Ready:            true,
				Age:              "2h",
				Version:          "v1.26.0",
				InternalIP:       "10.0.1.101",
			},
		},
		NamespaceStatuses: []models.NamespaceStatus{
			{
				Name:             "default",
				Status:           "Active",
				PodCount:         2,
				ServiceCount:     1,
				CPUUsage:         "0.5",
				CPUPercentage:    10.0,
				MemoryUsage:      "1Gi",
				MemoryPercentage: 20.0,
				StorageUsage:     "1Gi",
				Age:              "2h",
				Owner:            env.UserID,
			},
			{
				Name:             "kube-system",
				Status:           "Active",
				PodCount:         8,
				ServiceCount:     4,
				CPUUsage:         "1.0",
				CPUPercentage:    20.0,
				MemoryUsage:      "3Gi",
				MemoryPercentage: 30.0,
				StorageUsage:     "5Gi",
				Age:              "2h",
				Owner:            "system",
			},
		},
		ServiceMeshStatus: "Healthy",
		GitOpsStatus:      "Synced",
		LastSyncTime:      &time.Time{},
		HealthChecks: map[string]string{
			"api-server":   "Healthy",
			"etcd":         "Healthy",
			"scheduler":    "Healthy",
			"controller":   "Healthy",
			"service-mesh": "Healthy",
		},
		UptimePercentage:        100.0,
		ResourceAllocationRatio: 0.4,
	}
	
	return status, nil
}

// updateEnvironmentStatus updates the status of an environment
func (h *EnvironmentHandler) updateEnvironmentStatus(envID, status, message string) {
	ctx := context.Background()
	
	_, err := h.dynamoClient.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: aws.String(h.tableName),
		Key: map[string]types.AttributeValue{
			"ID": &types.AttributeValueMemberS{Value: envID},
		},
		UpdateExpression: aws.String("SET Status = :status, StatusMessage = :message, UpdatedAt = :updated"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":status":  &types.AttributeValueMemberS{Value: status},
			":message": &types.AttributeValueMemberS{Value: message},
			":updated": &types.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	if err != nil {
		log.Printf("Failed to update environment status: %v", err)
	}
}