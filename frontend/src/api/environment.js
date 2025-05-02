import axios from 'axios';

// Create axios instance with defaults
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle session expiration
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

/**
 * Fetch all environments
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Array of environments
 */
export const fetchEnvironments = async (params = {}) => {
  const response = await api.get('/environments', { params });
  return response.data;
};

/**
 * Fetch a single environment
 * @param {string} id - Environment ID
 * @returns {Promise<Object>} Environment data
 */
export const fetchEnvironment = async (id) => {
  const response = await api.get(`/environments/${id}`);
  return response.data;
};

/**
 * Create a new environment
 * @param {Object} environmentData - Environment data
 * @returns {Promise<Object>} Created environment
 */
export const createEnvironment = async (environmentData) => {
  const response = await api.post('/environments', environmentData);
  return response.data;
};

/**
 * Update an environment
 * @param {string} id - Environment ID
 * @param {Object} environmentData - Updated environment data
 * @returns {Promise<Object>} Updated environment
 */
export const updateEnvironment = async (id, environmentData) => {
  const response = await api.patch(`/environments/${id}`, environmentData);
  return response.data;
};

/**
 * Delete an environment
 * @param {string} id - Environment ID
 * @returns {Promise<void>}
 */
export const deleteEnvironment = async (id) => {
  await api.delete(`/environments/${id}`);
};

/**
 * Get environment status
 * @param {string} id - Environment ID
 * @returns {Promise<Object>} Environment status
 */
export const fetchEnvironmentStatus = async (id) => {
  const response = await api.get(`/environments/${id}/status`);
  return response.data;
};

/**
 * Get environment metrics
 * @param {string} id - Environment ID
 * @param {string} timeRange - Time range (e.g., '1h', '24h', '7d')
 * @returns {Promise<Object>} Environment metrics
 */
export const fetchEnvironmentMetrics = async (id, timeRange = '24h') => {
  const response = await api.get(`/environments/${id}/metrics`, {
    params: { timeRange },
  });
  return response.data;
};

/**
 * Get environment logs
 * @param {string} id - Environment ID
 * @param {Object} params - Query parameters (container, namespace, tail, etc.)
 * @returns {Promise<Array>} Environment logs
 */
export const fetchEnvironmentLogs = async (id, params = {}) => {
  const response = await api.get(`/environments/${id}/logs`, { params });
  return response.data;
};

/**
 * Get environment events
 * @param {string} id - Environment ID
 * @returns {Promise<Array>} Environment events
 */
export const fetchEnvironmentEvents = async (id) => {
  const response = await api.get(`/environments/${id}/events`);
  return response.data;
};

/**
 * Restart environment
 * @param {string} id - Environment ID
 * @returns {Promise<Object>} Operation result
 */
export const restartEnvironment = async (id) => {
  const response = await api.post(`/environments/${id}/restart`);
  return response.data;
};

/**
 * Upgrade environment
 * @param {string} id - Environment ID
 * @param {Object} upgradeData - Upgrade options
 * @returns {Promise<Object>} Operation result
 */
export const upgradeEnvironment = async (id, upgradeData) => {
  const response = await api.post(`/environments/${id}/upgrade`, upgradeData);
  return response.data;
};

/**
 * Get environment kubeconfig
 * @param {string} id - Environment ID
 * @returns {Promise<Object>} Kubeconfig data
 */
export const fetchEnvironmentKubeconfig = async (id) => {
  const response = await api.get(`/environments/${id}/kubeconfig`);
  return response.data;
};

/**
 * Get environment namespaces
 * @param {string} id - Environment ID
 * @returns {Promise<Array>} Environment namespaces
 */
export const fetchEnvironmentNamespaces = async (id) => {
  const response = await api.get(`/environments/${id}/namespaces`);
  return response.data;
};

/**
 * Create namespace in environment
 * @param {string} id - Environment ID
 * @param {Object} namespaceData - Namespace data
 * @returns {Promise<Object>} Created namespace
 */
export const createEnvironmentNamespace = async (id, namespaceData) => {
  const response = await api.post(`/environments/${id}/namespaces`, namespaceData);
  return response.data;
};

export default {
  fetchEnvironments,
  fetchEnvironment,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  fetchEnvironmentStatus,
  fetchEnvironmentMetrics,
  fetchEnvironmentLogs,
  fetchEnvironmentEvents,
  restartEnvironment,
  upgradeEnvironment,
  fetchEnvironmentKubeconfig,
  fetchEnvironmentNamespaces,
  createEnvironmentNamespace,
};