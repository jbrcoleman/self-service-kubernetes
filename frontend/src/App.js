import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Environments from './pages/Environments';
import EnvironmentDetails from './pages/EnvironmentDetails';
import CreateEnvironment from './pages/CreateEnvironment';
import Templates from './pages/Templates';
import TemplateDetails from './pages/TemplateDetails';
import CreateTemplate from './pages/CreateTemplate';
import Users from './pages/Users';
import UserProfile from './pages/UserProfile';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import './styles/main.css';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Extend the theme
const theme = extendTheme({
  colors: {
    brand: {
      50: '#e6f7ff',
      100: '#b3e0ff',
      200: '#80caff',
      300: '#4db4ff',
      400: '#1a9eff',
      500: '#0088e6',
      600: '#006bb4',
      700: '#004f82',
      800: '#003251',
      900: '#00161f',
    },
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
  },
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
});

// Private route component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="environments" element={<Environments />} />
                <Route path="environments/create" element={<CreateEnvironment />} />
                <Route path="environments/:id" element={<EnvironmentDetails />} />
                <Route path="templates" element={<Templates />} />
                <Route path="templates/create" element={<CreateTemplate />} />
                <Route path="templates/:id" element={<TemplateDetails />} />
                <Route path="users" element={<Users />} />
                <Route path="users/:id" element={<UserProfile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}

export default App;