import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import {
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Heading,
  IconButton,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  SimpleGrid,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Card,
  CardBody,
  Text,
  Badge,
  Spinner,
  Checkbox,
  Radio,
  RadioGroup,
  Stack,
  Tag,
  TagLabel,
  TagCloseButton,
  useColorModeValue,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { ArrowBackIcon, InfoIcon } from '@chakra-ui/icons';
import { fetchTemplates } from '../api/templates';
import { createEnvironment } from '../api/environments';
import { useAuth } from '../contexts/AuthContext';
import ErrorState from '../components/ErrorState';

const CreateEnvironment = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const bgColor = useColorModeValue('white', 'gray.700');
  
  // Fetch templates
  const { data: templates, isLoading: templatesLoading, isError: templatesError, error: templatesErrorMessage } = 
    useQuery('templates', fetchTemplates);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateId: '',
    userId: user?.id || '',
    resourceLimits: {
      cpu: '2',
      memory: '4Gi',
      storage: '20Gi',
      maxNodeCount: 3,
      maxNamespaces: 5,
      maxLoadBalancers: 1
    },
    networkPolicy: {
      allowIngressFromCIDR: ['10.0.0.0/8'],
      allowEgressToCIDR: ['0.0.0.0/0'],
      defaultDenyIngress: true,
      defaultDenyEgress: false,
      allowIntraNamespace: true,
      allowCrossNamespace: false,
      allowExternalServices: []
    },
    serviceMesh: {
      enabled: true,
      mtlsMode: 'STRICT',
      enableTracing: true,
      enableMetrics: true,
      enableCircuitBreaker: true,
      enableOutlierDetection: true,
      enableFaultInjection: false,
      enableRequestThrottling: false,
      enableVirtualServiceRBAC: false
    },
    monitoring: {
      enablePrometheus: true,
      enableGrafana: true,
      enableAlertManager: false,
      scrapeInterval: '30s',
      retentionPeriod: '7d',
      defaultAlertThreshold: '80'
    },
    gitOps: {
      enabled: false,
      gitRepository: '',
      gitBranch: 'main',
      syncInterval: '5m',
      automatedSync: true,
      syncTimeout: '5m',
      gitCredentialId: ''
    },
    addons: [],
    tags: {}
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [externalService, setExternalService] = useState('');
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');
  
  // Create environment mutation
  const createEnvironmentMutation = useMutation(createEnvironment, {
    onSuccess: (data) => {
      toast({
        title: 'Environment created successfully',
        description: `Your Kubernetes environment "${data.name}" is being provisioned.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      navigate(`/environments/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error creating environment',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  });
  
  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: '' });
    }
  };
  
  // Handle nested object change
  const handleNestedChange = (category, field, value) => {
    setFormData({
      ...formData,
      [category]: {
        ...formData[category],
        [field]: value
      }
    });
  };
  
  // Handle checkbox change
  const handleCheckboxChange = (category, field) => (e) => {
    handleNestedChange(category, field, e.target.checked);
  };
  
  // Handle template selection
  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setFormData({
      ...formData,
      templateId
    });
    
    if (templateId) {
      const selectedTemplate = templates.find(t => t.id === templateId);
      if (selectedTemplate) {
        // Apply template defaults
        setFormData({
          ...formData,
          templateId,
          resourceLimits: selectedTemplate.defaultResources,
          networkPolicy: selectedTemplate.defaultNetPolicy,
          serviceMesh: selectedTemplate.defaultServiceMesh,
          monitoring: selectedTemplate.defaultMonitoring,
          gitOps: selectedTemplate.defaultGitOps,
          addons: selectedTemplate.defaultAddons
        });
      }
    }
  };
  
  // Add external service
  const addExternalService = () => {
    if (externalService && !formData.networkPolicy.allowExternalServices.includes(externalService)) {
      handleNestedChange(
        'networkPolicy',
        'allowExternalServices',
        [...formData.networkPolicy.allowExternalServices, externalService]
      );
      setExternalService('');
    }
  };
  
  // Remove external service
  const removeExternalService = (service) => {
    handleNestedChange(
      'networkPolicy',
      'allowExternalServices',
      formData.networkPolicy.allowExternalServices.filter(s => s !== service)
    );
  };
  
  // Add tag
  const addTag = () => {
    if (tagKey && tagValue) {
      setFormData({
        ...formData,
        tags: {
          ...formData.tags,
          [tagKey]: tagValue
        }
      });
      setTagKey('');
      setTagValue('');
    }
  };
  
  // Remove tag
  const removeTag = (key) => {
    const newTags = { ...formData.tags };
    delete newTags[key];
    setFormData({
      ...formData,
      tags: newTags
    });
  };
  
  // Toggle addon
  const toggleAddon = (addon) => {
    const updatedAddons = formData.addons.includes(addon)
      ? formData.addons.filter(a => a !== addon)
      : [...formData.addons, addon];
    
    setFormData({
      ...formData,
      addons: updatedAddons
    });
  };
  
  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name) {
      errors.name = 'Name is required';
    } else if (formData.name.length < 3 || formData.name.length > 63) {
      errors.name = 'Name must be between 3 and 63 characters';
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(formData.name)) {
      errors.name = 'Name must contain only lowercase letters, numbers, and hyphens, and must start and end with an alphanumeric character';
    }
    
    if (!formData.templateId) {
      errors.templateId = 'Template is required';
    }
    
    if (formData.gitOps.enabled && !formData.gitOps.gitRepository) {
      errors.gitRepository = 'Git repository is required when GitOps is enabled';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      createEnvironmentMutation.mutate(formData);
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Available addons
  const availableAddons = [
    { id: 'prometheus-operator', name: 'Prometheus Operator', description: 'Monitoring stack with Prometheus, Grafana, and AlertManager' },
    { id: 'cert-manager', name: 'Cert Manager', description: 'Automated certificate management for Kubernetes' },
    { id: 'external-dns', name: 'External DNS', description: 'Synchronize exposed Kubernetes Services with DNS providers' },
    { id: 'velero', name: 'Velero', description: 'Backup and restore your Kubernetes cluster resources and volumes' },
    { id: 'argo-cd', name: 'Argo CD', description: 'Declarative, GitOps continuous delivery tool for Kubernetes' },
    { id: 'ingress-nginx', name: 'NGINX Ingress Controller', description: 'Kubernetes ingress controller using NGINX as a reverse proxy' },
    { id: 'aws-load-balancer-controller', name: 'AWS Load Balancer Controller', description: 'Manage AWS Elastic Load Balancers for Kubernetes Services' },
    { id: 'metrics-server', name: 'Metrics Server', description: 'Scalable, efficient source of container resource metrics' },
  ];
  
  // Handle loading and error states
  if (templatesLoading) {
    return (
      <Flex justify="center" align="center" height="80vh">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }
  
  if (templatesError) {
    return <ErrorState message={templatesErrorMessage.message} />;
  }
  
  return (
    <Box p={4}>
      <Flex mb={6} align="center">
        <IconButton
          icon={<ArrowBackIcon />}
          variant="ghost"
          mr={2}
          onClick={() => navigate('/environments')}
          aria-label="Back to environments"
        />
        <Heading size="lg">Create New Environment</Heading>
      </Flex>
      
      <form onSubmit={handleSubmit}>
        <Card mb={6} bg={bgColor}>
          <CardBody>
            <Heading size="md" mb={4}>Basic Information</Heading>
            
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl isRequired isInvalid={formErrors.name}>
                <FormLabel>Environment Name</FormLabel>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., dev-environment"
                />
                <FormHelperText>
                  Must contain only lowercase letters, numbers, and hyphens.
                </FormHelperText>
                {formErrors.name && (
                  <FormErrorMessage>{formErrors.name}</FormErrorMessage>
                )}
              </FormControl>
              
              <FormControl isRequired isInvalid={formErrors.templateId}>
                <FormLabel>Template</FormLabel>
                <Select
                  name="templateId"
                  value={formData.templateId}
                  onChange={handleTemplateChange}
                  placeholder="Select a template"
                >
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.kubernetesVersion}
                    </option>
                  ))}
                </Select>
                <FormHelperText>
                  Templates provide pre-configured settings for your environment.
                </FormHelperText>
                {formErrors.templateId && (
                  <FormErrorMessage>{formErrors.templateId}</FormErrorMessage>
                )}
              </FormControl>
              
              <FormControl gridColumn={{ md: 'span 2' }}>
                <FormLabel>Description</FormLabel>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the purpose of this environment"
                  rows={3}
                />
              </FormControl>
            </SimpleGrid>
          </CardBody>
        </Card>
        
        <Tabs variant="enclosed" mb={6}>
          <TabList>
            <Tab>Resources</Tab>
            <Tab>Networking</Tab>
            <Tab>Service Mesh</Tab>
            <Tab>Monitoring</Tab>
            <Tab>GitOps</Tab>
            <Tab>Addons</Tab>
            <Tab>Tags</Tab>
          </TabList>
          
          <TabPanels>
            {/* Resources Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Heading size="md" mb={4}>Resource Limits</Heading>
                  
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
                    <FormControl>
                      <FormLabel>CPU</FormLabel>
                      <Input
                        value={formData.resourceLimits.cpu}
                        onChange={(e) => handleNestedChange('resourceLimits', 'cpu', e.target.value)}
                        placeholder="e.g., 2"
                      />
                      <FormHelperText>Maximum CPU cores</FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Memory</FormLabel>
                      <Input
                        value={formData.resourceLimits.memory}
                        onChange={(e) => handleNestedChange('resourceLimits', 'memory', e.target.value)}
                        placeholder="e.g., 4Gi"
                      />
                      <FormHelperText>Maximum memory allocation</FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Storage</FormLabel>
                      <Input
                        value={formData.resourceLimits.storage}
                        onChange={(e) => handleNestedChange('resourceLimits', 'storage', e.target.value)}
                        placeholder="e.g., 20Gi"
                      />
                      <FormHelperText>Maximum storage allocation</FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Max Node Count</FormLabel>
                      <NumberInput
                        min={1}
                        max={10}
                        value={formData.resourceLimits.maxNodeCount}
                        onChange={(value) => handleNestedChange('resourceLimits', 'maxNodeCount', parseInt(value))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>Maximum number of nodes</FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Max Namespaces</FormLabel>
                      <NumberInput
                        min={1}
                        max={20}
                        value={formData.resourceLimits.maxNamespaces}
                        onChange={(value) => handleNestedChange('resourceLimits', 'maxNamespaces', parseInt(value))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>Maximum number of namespaces</FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Max Load Balancers</FormLabel>
                      <NumberInput
                        min={0}
                        max={5}
                        value={formData.resourceLimits.maxLoadBalancers}
                        onChange={(value) => handleNestedChange('resourceLimits', 'maxLoadBalancers', parseInt(value))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                      <FormHelperText>Maximum number of load balancers</FormHelperText>
                    </FormControl>
                  </SimpleGrid>
                  
                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    These resource limits apply to the entire environment and will be enforced using resource quotas.
                  </Alert>
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* Networking Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Heading size="md" mb={4}>Network Policies</Heading>
                  
                  <VStack align="stretch" spacing={6}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Default Deny Ingress</FormLabel>
                        <Switch
                          isChecked={formData.networkPolicy.defaultDenyIngress}
                          onChange={handleCheckboxChange('networkPolicy', 'defaultDenyIngress')}
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Default Deny Egress</FormLabel>
                        <Switch
                          isChecked={formData.networkPolicy.defaultDenyEgress}
                          onChange={handleCheckboxChange('networkPolicy', 'defaultDenyEgress')}
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Allow Intra-Namespace Traffic</FormLabel>
                        <Switch
                          isChecked={formData.networkPolicy.allowIntraNamespace}
                          onChange={handleCheckboxChange('networkPolicy', 'allowIntraNamespace')}
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Allow Cross-Namespace Traffic</FormLabel>
                        <Switch
                          isChecked={formData.networkPolicy.allowCrossNamespace}
                          onChange={handleCheckboxChange('networkPolicy', 'allowCrossNamespace')}
                        />
                      </FormControl>
                    </SimpleGrid>
                    
                    <Divider />
                    
                    <FormControl>
                      <FormLabel>Allow Ingress from CIDR Blocks</FormLabel>
                      <Input
                        value={formData.networkPolicy.allowIngressFromCIDR.join(', ')}
                        onChange={(e) => handleNestedChange(
                          'networkPolicy',
                          'allowIngressFromCIDR',
                          e.target.value.split(',').map(cidr => cidr.trim()).filter(Boolean)
                        )}
                        placeholder="e.g., 10.0.0.0/8, 172.16.0.0/12"
                      />
                      <FormHelperText>
                        Comma-separated list of CIDR blocks allowed for ingress traffic
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Allow Egress to CIDR Blocks</FormLabel>
                      <Input
                        value={formData.networkPolicy.allowEgressToCIDR.join(', ')}
                        onChange={(e) => handleNestedChange(
                          'networkPolicy',
                          'allowEgressToCIDR',
                          e.target.value.split(',').map(cidr => cidr.trim()).filter(Boolean)
                        )}
                        placeholder="e.g., 0.0.0.0/0"
                      />
                      <FormHelperText>
                        Comma-separated list of CIDR blocks allowed for egress traffic
                      </FormHelperText>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel>Allow External Services</FormLabel>
                      <HStack>
                        <Input
                          value={externalService}
                          onChange={(e) => setExternalService(e.target.value)}
                          placeholder="e.g., .amazonaws.com"
                        />
                        <Button onClick={addExternalService}>Add</Button>
                      </HStack>
                      <FormHelperText>
                        Domains that are allowed for egress traffic (e.g., .amazonaws.com)
                      </FormHelperText>
                      
                      <Box mt={2}>
                        {formData.networkPolicy.allowExternalServices.length > 0 ? (
                          <HStack spacing={2} flexWrap="wrap">
                            {formData.networkPolicy.allowExternalServices.map((service, index) => (
                              <Tag key={index} size="md" borderRadius="full" variant="solid" colorScheme="brand" my={1}>
                                <TagLabel>{service}</TagLabel>
                                <TagCloseButton onClick={() => removeExternalService(service)} />
                              </Tag>
                            ))}
                          </HStack>
                        ) : (
                          <Text fontSize="sm" color="gray.500">No external services added</Text>
                        )}
                      </Box>
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* Service Mesh Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Service Mesh (Istio)</Heading>
                    <FormControl display="flex" alignItems="center" width="auto">
                      <FormLabel htmlFor="serviceMeshEnabled" mb="0" mr={2}>Enable</FormLabel>
                      <Switch
                        id="serviceMeshEnabled"
                        isChecked={formData.serviceMesh.enabled}
                        onChange={handleCheckboxChange('serviceMesh', 'enabled')}
                      />
                    </FormControl>
                  </Flex>
                  
                  {formData.serviceMesh.enabled ? (
                    <VStack align="stretch" spacing={6}>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        <FormControl>
                          <FormLabel>mTLS Mode</FormLabel>
                          <Select
                            value={formData.serviceMesh.mtlsMode}
                            onChange={(e) => handleNestedChange('serviceMesh', 'mtlsMode', e.target.value)}
                          >
                            <option value="STRICT">STRICT</option>
                            <option value="PERMISSIVE">PERMISSIVE</option>
                            <option value="DISABLE">DISABLE</option>
                          </Select>
                          <FormHelperText>
                            Controls mutual TLS authentication between services
                          </FormHelperText>
                        </FormControl>
                      </SimpleGrid>
                      
                      <Divider />
                      
                      <Heading size="sm" mb={2}>Observability</Heading>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Tracing</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableTracing}
                            onChange={handleCheckboxChange('serviceMesh', 'enableTracing')}
                          />
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Metrics</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableMetrics}
                            onChange={handleCheckboxChange('serviceMesh', 'enableMetrics')}
                          />
                        </FormControl>
                      </SimpleGrid>
                      
                      <Divider />
                      
                      <Heading size="sm" mb={2}>Traffic Management</Heading>
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Circuit Breaker</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableCircuitBreaker}
                            onChange={handleCheckboxChange('serviceMesh', 'enableCircuitBreaker')}
                          />
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Outlier Detection</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableOutlierDetection}
                            onChange={handleCheckboxChange('serviceMesh', 'enableOutlierDetection')}
                          />
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Fault Injection</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableFaultInjection}
                            onChange={handleCheckboxChange('serviceMesh', 'enableFaultInjection')}
                          />
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Enable Request Throttling</FormLabel>
                          <Switch
                            isChecked={formData.serviceMesh.enableRequestThrottling}
                            onChange={handleCheckboxChange('serviceMesh', 'enableRequestThrottling')}
                          />
                        </FormControl>
                      </SimpleGrid>
                      
                      <Divider />
                      
                      <Heading size="sm" mb={2}>Security</Heading>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable Virtual Service RBAC</FormLabel>
                        <Switch
                          isChecked={formData.serviceMesh.enableVirtualServiceRBAC}
                          onChange={handleCheckboxChange('serviceMesh', 'enableVirtualServiceRBAC')}
                        />
                      </FormControl>
                    </VStack>
                  ) : (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      Service mesh is disabled. Enable it to configure Istio settings.
                    </Alert>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* Monitoring Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Heading size="md" mb={4}>Monitoring Stack</Heading>
                  
                  <VStack align="stretch" spacing={6}>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable Prometheus</FormLabel>
                        <Switch
                          isChecked={formData.monitoring.enablePrometheus}
                          onChange={handleCheckboxChange('monitoring', 'enablePrometheus')}
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable Grafana</FormLabel>
                        <Switch
                          isChecked={formData.monitoring.enableGrafana}
                          onChange={handleCheckboxChange('monitoring', 'enableGrafana')}
                        />
                      </FormControl>
                      
                      <FormControl display="flex" alignItems="center">
                        <FormLabel mb="0">Enable Alert Manager</FormLabel>
                        <Switch
                          isChecked={formData.monitoring.enableAlertManager}
                          onChange={handleCheckboxChange('monitoring', 'enableAlertManager')}
                        />
                      </FormControl>
                    </SimpleGrid>
                    
                    <Divider />
                    
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                      <FormControl>
                        <FormLabel>Scrape Interval</FormLabel>
                        <Select
                          value={formData.monitoring.scrapeInterval}
                          onChange={(e) => handleNestedChange('monitoring', 'scrapeInterval', e.target.value)}
                        >
                          <option value="15s">15 seconds</option>
                          <option value="30s">30 seconds</option>
                          <option value="1m">1 minute</option>
                          <option value="5m">5 minutes</option>
                        </Select>
                        <FormHelperText>
                          How frequently Prometheus collects metrics
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Retention Period</FormLabel>
                        <Select
                          value={formData.monitoring.retentionPeriod}
                          onChange={(e) => handleNestedChange('monitoring', 'retentionPeriod', e.target.value)}
                        >
                          <option value="1d">1 day</option>
                          <option value="7d">7 days</option>
                          <option value="14d">14 days</option>
                          <option value="30d">30 days</option>
                        </Select>
                        <FormHelperText>
                          How long Prometheus stores metrics
                        </FormHelperText>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Default Alert Threshold (%)</FormLabel>
                        <NumberInput
                          min={50}
                          max={95}
                          value={formData.monitoring.defaultAlertThreshold}
                          onChange={(value) => handleNestedChange('monitoring', 'defaultAlertThreshold', value)}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <FormHelperText>
                          Threshold for default resource alerts
                        </FormHelperText>
                      </FormControl>
                    </SimpleGrid>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* GitOps Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">GitOps Configuration (Flux)</Heading>
                    <FormControl display="flex" alignItems="center" width="auto">
                      <FormLabel htmlFor="gitopsEnabled" mb="0" mr={2}>Enable</FormLabel>
                      <Switch
                        id="gitopsEnabled"
                        isChecked={formData.gitOps.enabled}
                        onChange={handleCheckboxChange('gitOps', 'enabled')}
                      />
                    </FormControl>
                  </Flex>
                  
                  {formData.gitOps.enabled ? (
                    <VStack align="stretch" spacing={6}>
                      <FormControl isInvalid={formErrors.gitRepository}>
                        <FormLabel>Git Repository URL</FormLabel>
                        <Input
                          value={formData.gitOps.gitRepository}
                          onChange={(e) => handleNestedChange('gitOps', 'gitRepository', e.target.value)}
                          placeholder="e.g., https://github.com/yourusername/gitops-repo.git"
                        />
                        <FormHelperText>
                          Git repository containing your Kubernetes manifests
                        </FormHelperText>
                        {formErrors.gitRepository && (
                          <FormErrorMessage>{formErrors.gitRepository}</FormErrorMessage>
                        )}
                      </FormControl>
                      
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        <FormControl>
                          <FormLabel>Git Branch</FormLabel>
                          <Input
                            value={formData.gitOps.gitBranch}
                            onChange={(e) => handleNestedChange('gitOps', 'gitBranch', e.target.value)}
                            placeholder="e.g., main"
                          />
                          <FormHelperText>
                            Branch to sync from
                          </FormHelperText>
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel>Sync Interval</FormLabel>
                          <Select
                            value={formData.gitOps.syncInterval}
                            onChange={(e) => handleNestedChange('gitOps', 'syncInterval', e.target.value)}
                          >
                            <option value="1m">1 minute</option>
                            <option value="5m">5 minutes</option>
                            <option value="10m">10 minutes</option>
                            <option value="15m">15 minutes</option>
                            <option value="30m">30 minutes</option>
                            <option value="1h">1 hour</option>
                          </Select>
                          <FormHelperText>
                            How frequently to sync with the Git repository
                          </FormHelperText>
                        </FormControl>
                        
                        <FormControl display="flex" alignItems="center">
                          <FormLabel mb="0">Automated Sync</FormLabel>
                          <Switch
                            isChecked={formData.gitOps.automatedSync}
                            onChange={handleCheckboxChange('gitOps', 'automatedSync')}
                          />
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel>Sync Timeout</FormLabel>
                          <Select
                            value={formData.gitOps.syncTimeout}
                            onChange={(e) => handleNestedChange('gitOps', 'syncTimeout', e.target.value)}
                          >
                            <option value="1m">1 minute</option>
                            <option value="5m">5 minutes</option>
                            <option value="10m">10 minutes</option>
                          </Select>
                          <FormHelperText>
                            Timeout for sync operations
                          </FormHelperText>
                        </FormControl>
                      </SimpleGrid>
                    </VStack>
                  ) : (
                    <Alert status="info" borderRadius="md">
                      <AlertIcon />
                      GitOps is disabled. Enable it to configure Flux settings for continuous delivery.
                    </Alert>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* Addons Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Heading size="md" mb={4}>Available Addons</Heading>
                  
                  <VStack align="stretch" spacing={4}>
                    {availableAddons.map((addon) => (
                      <Card key={addon.id} variant="outline" size="sm">
                        <CardBody>
                          <Flex justify="space-between" align="center">
                            <Box>
                              <Heading size="sm">{addon.name}</Heading>
                              <Text fontSize="sm" color="gray.600">{addon.description}</Text>
                            </Box>
                            <Checkbox
                              isChecked={formData.addons.includes(addon.id)}
                              onChange={() => toggleAddon(addon.id)}
                              size="lg"
                            />
                          </Flex>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
            
            {/* Tags Tab */}
            <TabPanel>
              <Card bg={bgColor}>
                <CardBody>
                  <Heading size="md" mb={4}>Tags</Heading>
                  
                  <VStack align="stretch" spacing={6}>
                    <HStack>
                      <FormControl>
                        <FormLabel>Key</FormLabel>
                        <Input
                          value={tagKey}
                          onChange={(e) => setTagKey(e.target.value)}
                          placeholder="e.g., environment"
                        />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Value</FormLabel>
                        <Input
                          value={tagValue}
                          onChange={(e) => setTagValue(e.target.value)}
                          placeholder="e.g., development"
                        />
                      </FormControl>
                      
                      <Button alignSelf="flex-end" onClick={addTag}>Add Tag</Button>
                    </HStack>
                    
                    <Box>
                      {Object.keys(formData.tags).length > 0 ? (
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                          {Object.entries(formData.tags).map(([key, value]) => (
                            <Tag key={key} size="lg" borderRadius="full" variant="subtle" colorScheme="brand">
                              <TagLabel>{key}: {value}</TagLabel>
                              <TagCloseButton onClick={() => removeTag(key)} />
                            </Tag>
                          ))}
                        </SimpleGrid>
                      ) : (
                        <Text fontSize="sm" color="gray.500">No tags added</Text>
                      )}
                    </Box>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
        
        <Flex justify="flex-end" mt={6} gap={4}>
          <Button
            variant="outline"
            onClick={() => navigate('/environments')}
          >
            Cancel
          </Button>
          <Button
            colorScheme="brand"
            type="submit"
            isLoading={createEnvironmentMutation.isLoading}
            loadingText="Creating..."
          >
            Create Environment
          </Button>
        </Flex>
      </form>
    </Box>
  );
};

export default CreateEnvironment;