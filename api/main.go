package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/yourusername/k8s-env-provisioner/api/handlers"
	"github.com/yourusername/k8s-env-provisioner/api/middleware"
	"github.com/yourusername/k8s-env-provisioner/api/models"
	"github.com/yourusername/k8s-env-provisioner/api/terraform"
)

func main() {
	log.Println("Starting K8s Environment Provisioner API")

	// Load configuration
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
	if err != nil {
		log.Fatalf("Failed to load AWS SDK configuration: %v", err)
	}

	// Initialize DynamoDB client
	dynamoClient := dynamodb.NewFromConfig(cfg)

	// Initialize Terraform executor
	terraformExecutor := terraform.NewExecutor("../provisioning")

	// Initialize validator
	validate := validator.New()

	// Create router
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")

	// API routes
	apiRouter := router.PathPrefix("/api/v1").Subrouter()

	// Middleware
	apiRouter.Use(middleware.LoggingMiddleware)
	apiRouter.Use(middleware.AuthMiddleware)
	apiRouter.Use(middleware.ContentTypeMiddleware)

	// Environment routes
	environmentHandler := handlers.NewEnvironmentHandler(dynamoClient, terraformExecutor, validate)
	apiRouter.HandleFunc("/environments", environmentHandler.ListEnvironments).Methods("GET")
	apiRouter.HandleFunc("/environments", environmentHandler.CreateEnvironment).Methods("POST")
	apiRouter.HandleFunc("/environments/{id}", environmentHandler.GetEnvironment).Methods("GET")
	apiRouter.HandleFunc("/environments/{id}", environmentHandler.UpdateEnvironment).Methods("PATCH")
	apiRouter.HandleFunc("/environments/{id}", environmentHandler.DeleteEnvironment).Methods("DELETE")
	apiRouter.HandleFunc("/environments/{id}/status", environmentHandler.GetEnvironmentStatus).Methods("GET")

	// Cluster template routes
	templateHandler := handlers.NewTemplateHandler(dynamoClient, validate)
	apiRouter.HandleFunc("/templates", templateHandler.ListTemplates).Methods("GET")
	apiRouter.HandleFunc("/templates", templateHandler.CreateTemplate).Methods("POST")
	apiRouter.HandleFunc("/templates/{id}", templateHandler.GetTemplate).Methods("GET")
	apiRouter.HandleFunc("/templates/{id}", templateHandler.UpdateTemplate).Methods("PATCH")
	apiRouter.HandleFunc("/templates/{id}", templateHandler.DeleteTemplate).Methods("DELETE")

	// User routes
	userHandler := handlers.NewUserHandler(dynamoClient, validate)
	apiRouter.HandleFunc("/users", userHandler.ListUsers).Methods("GET")
	apiRouter.HandleFunc("/users", userHandler.CreateUser).Methods("POST")
	apiRouter.HandleFunc("/users/{id}", userHandler.GetUser).Methods("GET")
	apiRouter.HandleFunc("/users/{id}", userHandler.UpdateUser).Methods("PATCH")
	apiRouter.HandleFunc("/users/{id}", userHandler.DeleteUser).Methods("DELETE")

	// Metrics routes
	metricHandler := handlers.NewMetricHandler(dynamoClient)
	apiRouter.HandleFunc("/metrics/usage", metricHandler.GetUsageMetrics).Methods("GET")
	apiRouter.HandleFunc("/metrics/cost", metricHandler.GetCostMetrics).Methods("GET")

	// Documentation
	router.PathPrefix("/api/docs/").Handler(http.StripPrefix("/api/docs/", http.FileServer(http.Dir("./docs"))))

	// Set up server
	server := &http.Server{
		Addr:         ":8080",
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Set up graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}
	log.Println("Server gracefully stopped")
}

// Example of a handler implementation
func createEnvironmentHandler(w http.ResponseWriter, r *http.Request, dynamoClient *dynamodb.Client, validate *validator.Validate) {
	var env models.EnvironmentRequest
	if err := json.NewDecoder(r.Body).Decode(&env); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate request
	if err := validate.Struct(env); err != nil {
		http.Error(w, fmt.Sprintf("Validation error: %v", err), http.StatusBadRequest)
		return
	}

	// Create environment record
	envID := uuid.New().String()
	environment := models.Environment{
		ID:             envID,
		Name:           env.Name,
		Description:    env.Description,
		TemplateID:     env.TemplateID,
		UserID:         env.UserID,
		ResourceLimits: env.ResourceLimits,
		Status:         "CREATING",
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	// Store in DynamoDB
	// (Actual implementation would go here)

	// Trigger Terraform in a goroutine
	go provisionEnvironment(environment)

	// Return the created environment
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(environment)
}

// Simulate provisioning an environment
func provisionEnvironment(env models.Environment) {
	log.Printf("Provisioning environment: %s", env.Name)
	// Actual implementation would use Terraform to provision the environment
	time.Sleep(5 * time.Second)
	log.Printf("Environment provisioned: %s", env.Name)
	// Update status in DynamoDB
}