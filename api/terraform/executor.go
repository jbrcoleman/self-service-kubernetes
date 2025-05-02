package terraform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Executor manages Terraform operations
type Executor struct {
	basePath    string
	statePath   string
	tfBinary    string
	environment []string
}

// NewExecutor creates a new Terraform executor
func NewExecutor(basePath string) *Executor {
	return &Executor{
		basePath:    basePath,
		statePath:   "/tmp/terraform-state",
		tfBinary:    "terraform",
		environment: os.Environ(),
	}
}

// Apply applies Terraform configuration
func (e *Executor) Apply(module string, vars map[string]interface{}) error {
	// Create working directory
	workDir := fmt.Sprintf("%s-%d", module, time.Now().Unix())
	workPath := filepath.Join(e.statePath, workDir)
	
	err := os.MkdirAll(workPath, 0755)
	if err != nil {
		return fmt.Errorf("failed to create work directory: %w", err)
	}
	
	// Write variables file
	varsFile := filepath.Join(workPath, "terraform.tfvars.json")
	varsJSON, err := json.MarshalIndent(vars, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal variables: %w", err)
	}
	
	err = ioutil.WriteFile(varsFile, varsJSON, 0644)
	if err != nil {
		return fmt.Errorf("failed to write variables file: %w", err)
	}
	
	// Get module path
	modulePath := filepath.Join(e.basePath, module)
	
	// Initialize Terraform
	err = e.runCommand(workPath, "init", "-no-color", modulePath)
	if err != nil {
		return fmt.Errorf("terraform init failed: %w", err)
	}
	
	// Apply configuration
	err = e.runCommand(workPath, "apply", "-no-color", "-auto-approve", "-var-file=terraform.tfvars.json")
	if err != nil {
		return fmt.Errorf("terraform apply failed: %w", err)
	}
	
	return nil
}

// Destroy destroys Terraform-managed infrastructure
func (e *Executor) Destroy(module string, vars map[string]interface{}) error {
	// Create working directory
	workDir := fmt.Sprintf("%s-%d", module, time.Now().Unix())
	workPath := filepath.Join(e.statePath, workDir)
	
	err := os.MkdirAll(workPath, 0755)
	if err != nil {
		return fmt.Errorf("failed to create work directory: %w", err)
	}
	
	// Write variables file
	varsFile := filepath.Join(workPath, "terraform.tfvars.json")
	varsJSON, err := json.MarshalIndent(vars, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal variables: %w", err)
	}
	
	err = ioutil.WriteFile(varsFile, varsJSON, 0644)
	if err != nil {
		return fmt.Errorf("failed to write variables file: %w", err)
	}
	
	// Get module path
	modulePath := filepath.Join(e.basePath, module)
	
	// Initialize Terraform
	err = e.runCommand(workPath, "init", "-no-color", modulePath)
	if err != nil {
		return fmt.Errorf("terraform init failed: %w", err)
	}
	
	// Destroy infrastructure
	err = e.runCommand(workPath, "destroy", "-no-color", "-auto-approve", "-var-file=terraform.tfvars.json")
	if err != nil {
		return fmt.Errorf("terraform destroy failed: %w", err)
	}
	
	return nil
}

// GetOutputs retrieves outputs from Terraform state
func (e *Executor) GetOutputs(module string) (map[string]interface{}, error) {
	// Find latest working directory for module
	dirs, err := ioutil.ReadDir(e.statePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read state directory: %w", err)
	}
	
	var latestDir string
	var latestTime int64
	
	for _, dir := range dirs {
		if dir.IsDir() && strings.HasPrefix(dir.Name(), module+"-") {
			parts := strings.Split(dir.Name(), "-")
			if len(parts) > 1 {
				timestamp, err := StringToInt64(parts[1])
				if err == nil && timestamp > latestTime {
					latestTime = timestamp
					latestDir = dir.Name()
				}
			}
		}
	}
	
	if latestDir == "" {
		return nil, fmt.Errorf("no state directory found for module %s", module)
	}
	
	workPath := filepath.Join(e.statePath, latestDir)
	
	// Get outputs
	var stdout, stderr bytes.Buffer
	cmd := exec.Command(e.tfBinary, "output", "-no-color", "-json")
	cmd.Dir = workPath
	cmd.Env = e.environment
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	err = cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("terraform output failed: %w, stderr: %s", err, stderr.String())
	}
	
	// Parse outputs
	var outputs map[string]struct {
		Value interface{} `json:"value"`
	}
	
	err = json.Unmarshal(stdout.Bytes(), &outputs)
	if err != nil {
		return nil, fmt.Errorf("failed to parse outputs: %w", err)
	}
	
	// Extract values
	result := make(map[string]interface{})
	for key, output := range outputs {
		result[key] = output.Value
	}
	
	return result, nil
}

// runCommand runs a Terraform command
func (e *Executor) runCommand(workDir string, args ...string) error {
	var stdout, stderr bytes.Buffer
	cmd := exec.Command(e.tfBinary, args...)
	cmd.Dir = workDir
	cmd.Env = e.environment
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	log.Printf("Running Terraform command: %s %s", e.tfBinary, strings.Join(args, " "))
	
	err := cmd.Run()
	if err != nil {
		log.Printf("Terraform command failed: %v", err)
		log.Printf("Stderr: %s", stderr.String())
		return fmt.Errorf("terraform command failed: %w, stderr: %s", err, stderr.String())
	}
	
	log.Printf("Terraform command succeeded")
	
	return nil
}

// StringToInt64 converts a string to int64
func StringToInt64(s string) (int64, error) {
	var result int64
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}