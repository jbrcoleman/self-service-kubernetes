package models

import (
	"time"
)

// ResourceLimits defines the resource limits for an environment
type ResourceLimits struct {
	CPU              string `json:"cpu" validate:"required"`
	Memory           string `json:"memory" validate:"required"`
	Storage          string `json:"storage" validate:"required"`
	MaxNodeCount     int    `json:"maxNodeCount" validate:"required,gte=1,lte=10"`
	MaxNamespaces    int    `json:"maxNamespaces" validate:"required,gte=1,lte=20"`
	MaxLoadBalancers int    `json:"maxLoadBalancers" validate:"required,gte=0,lte=5"`
}

// NetworkPolicy defines the network policy for an environment
type NetworkPolicy struct {
	AllowIngressFromCIDR  []string `json:"allowIngressFromCIDR"`
	AllowEgressToCIDR     []string `json:"allowEgressToCIDR"`
	DefaultDenyIngress    bool     `json:"defaultDenyIngress"`
	DefaultDenyEgress     bool     `json:"defaultDenyEgress"`
	AllowIntraNamespace   bool     `json:"allowIntraNamespace"`
	AllowCrossNamespace   bool     `json:"allowCrossNamespace"`
	AllowExternalServices []string `json:"allowExternalServices"`
}

// ServiceMeshConfig defines the service mesh configuration for an environment
type ServiceMeshConfig struct {
	Enabled                  bool   `json:"enabled"`
	MTLSMode                 string `json:"mtlsMode" validate:"omitempty,oneof=STRICT PERMISSIVE DISABLE"`
	EnableTracing            bool   `json:"enableTracing"`
	EnableMetrics            bool   `json:"enableMetrics"`
	EnableCircuitBreaker     bool   `json:"enableCircuitBreaker"`
	EnableOutlierDetection   bool   `json:"enableOutlierDetection"`
	EnableFaultInjection     bool   `json:"enableFaultInjection"`
	EnableRequestThrottling  bool   `json:"enableRequestThrottling"`
	EnableVirtualServiceRBAC bool   `json:"enableVirtualServiceRBAC"`
}

// MonitoringConfig defines the monitoring configuration for an environment
type MonitoringConfig struct {
	EnablePrometheus      bool   `json:"enablePrometheus"`
	EnableGrafana         bool   `json:"enableGrafana"`
	EnableAlertManager    bool   `json:"enableAlertManager"`
	ScrapeInterval        string `json:"scrapeInterval" validate:"omitempty,oneof=15s 30s 1m 5m"`
	RetentionPeriod       string `json:"retentionPeriod" validate:"omitempty,oneof=1d 7d 14d 30d"`
	DefaultAlertThreshold string `json:"defaultAlertThreshold"`
}

// GitOpsConfig defines the GitOps configuration for an environment
type GitOpsConfig struct {
	Enabled         bool   `json:"enabled"`
	GitRepository   string `json:"gitRepository" validate:"omitempty,url"`
	GitBranch       string `json:"gitBranch"`
	SyncInterval    string `json:"syncInterval" validate:"omitempty,oneof=1m 5m 10m 15m 30m 1h"`
	AutomatedSync   bool   `json:"automatedSync"`
	SyncTimeout     string `json:"syncTimeout" validate:"omitempty,oneof=1m 5m 10m"`
	GitCredentialID string `json:"gitCredentialId"`
}

// EnvironmentRequest is used when creating a new environment
type EnvironmentRequest struct {
	Name           string            `json:"name" validate:"required,min=3,max=63"`
	Description    string            `json:"description" validate:"max=255"`
	TemplateID     string            `json:"templateId" validate:"required"`
	UserID         string            `json:"userId" validate:"required"`
	ResourceLimits ResourceLimits    `json:"resourceLimits" validate:"required"`
	NetworkPolicy  *NetworkPolicy    `json:"networkPolicy"`
	ServiceMesh    *ServiceMeshConfig `json:"serviceMesh"`
	Monitoring     *MonitoringConfig `json:"monitoring"`
	GitOps         *GitOpsConfig     `json:"gitOps"`
	Addons         []string          `json:"addons"`
	Tags           map[string]string `json:"tags"`
}

// Environment represents a Kubernetes environment in the system
type Environment struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	TemplateID     string            `json:"templateId"`
	UserID         string            `json:"userId"`
	ResourceLimits ResourceLimits    `json:"resourceLimits"`
	NetworkPolicy  *NetworkPolicy    `json:"networkPolicy"`
	ServiceMesh    *ServiceMeshConfig `json:"serviceMesh"`
	Monitoring     *MonitoringConfig `json:"monitoring"`
	GitOps         *GitOpsConfig     `json:"gitOps"`
	Addons         []string          `json:"addons"`
	Tags           map[string]string `json:"tags"`
	Status         string            `json:"status"`
	StatusMessage  string            `json:"statusMessage"`
	ClusterName    string            `json:"clusterName"`
	KubeConfig     string            `json:"kubeConfig,omitempty"`
	ConsoleURL     string            `json:"consoleUrl"`
	CreatedAt      time.Time         `json:"createdAt"`
	UpdatedAt      time.Time         `json:"updatedAt"`
	DeletedAt      *time.Time        `json:"deletedAt,omitempty"`
}

// EnvironmentPatch represents the fields that can be updated
type EnvironmentPatch struct {
	Description    *string            `json:"description"`
	ResourceLimits *ResourceLimits    `json:"resourceLimits"`
	NetworkPolicy  *NetworkPolicy     `json:"networkPolicy"`
	ServiceMesh    *ServiceMeshConfig `json:"serviceMesh"`
	Monitoring     *MonitoringConfig  `json:"monitoring"`
	GitOps         *GitOpsConfig      `json:"gitOps"`
	Addons         []string           `json:"addons"`
	Tags           map[string]string  `json:"tags"`
}

// EnvironmentStatus defines the detailed status of an environment
type EnvironmentStatus struct {
	Status                  string            `json:"status"`
	StatusMessage           string            `json:"statusMessage"`
	ResourceUtilization     ResourceUsage     `json:"resourceUtilization"`
	NodeStatus              []NodeStatus      `json:"nodeStatus"`
	NamespaceStatuses       []NamespaceStatus `json:"namespaceStatuses"`
	ServiceMeshStatus       string            `json:"serviceMeshStatus"`
	GitOpsStatus            string            `json:"gitOpsStatus"`
	LastSyncTime            *time.Time        `json:"lastSyncTime"`
	HealthChecks            map[string]string `json:"healthChecks"`
	LastIncidentTime        *time.Time        `json:"lastIncidentTime"`
	UptimePercentage        float64           `json:"uptimePercentage"`
	ResourceAllocationRatio float64           `json:"resourceAllocationRatio"`
}

// ResourceUsage defines the current resource usage of an environment
type ResourceUsage struct {
	CPUUsage       string `json:"cpuUsage"`
	CPUPercentage  float64 `json:"cpuPercentage"`
	MemoryUsage    string `json:"memoryUsage"`
	MemoryPercentage float64 `json:"memoryPercentage"`
	StorageUsage   string `json:"storageUsage"`
	StoragePercentage float64 `json:"storagePercentage"`
	NodeCount      int    `json:"nodeCount"`
	NamespaceCount int    `json:"namespaceCount"`
	PodCount       int    `json:"podCount"`
	ServiceCount   int    `json:"serviceCount"`
}

// NodeStatus defines the status of a node in the environment
type NodeStatus struct {
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	CPUPercentage  float64 `json:"cpuPercentage"`
	MemoryPercentage float64 `json:"memoryPercentage"`
	PodCount       int     `json:"