import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Heading,
  Badge,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Input,
  Select,
  HStack,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { AddIcon, ChevronDownIcon, SearchIcon } from '@chakra-ui/icons';
import { FaEllipsisV } from 'react-icons/fa';
import { fetchEnvironments, deleteEnvironment } from '../api/environments';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import DateFormat from '../components/DateFormat';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

const Environments = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [environmentToDelete, setEnvironmentToDelete] = useState(null);
  const cancelRef = React.useRef();

  // Fetch environments
  const { data: environments, isLoading, isError, error, refetch } = useQuery(
    ['environments', user?.id],
    () => fetchEnvironments({ userId: user?.id }),
    {
      enabled: !!user,
    }
  );

  // Handle environment deletion
  const handleDeleteClick = (environment) => {
    setEnvironmentToDelete(environment);
    onOpen();
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteEnvironment(environmentToDelete.id);
      toast({
        title: 'Environment deleted.',
        description: `${environmentToDelete.name} has been deleted.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      refetch();
    } catch (err) {
      toast({
        title: 'Error deleting environment.',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      onClose();
      setEnvironmentToDelete(null);
    }
  };

  // Filter environments
  const filteredEnvironments = environments?.filter((env) => {
    const matchesSearch = env.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      env.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || env.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Render loading state
  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="80vh">
        <Spinner size="xl" color="brand.500" />
      </Flex>
    );
  }

  // Render error state
  if (isError) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  // Render empty state
  if (environments?.length === 0) {
    return (
      <EmptyState
        title="No environments found"
        description="Create your first Kubernetes environment to get started."
        buttonText="Create Environment"
        buttonLink="/environments/create"
      />
    );
  }

  return (
    <Box p={4}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Kubernetes Environments</Heading>
        <Button
          as={Link}
          to="/environments/create"
          colorScheme="brand"
          leftIcon={<AddIcon />}
        >
          Create Environment
        </Button>
      </Flex>

      <Flex mb={6} gap={4} wrap="wrap">
        <Box flex={1} minW="200px">
          <Input
            placeholder="Search environments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<SearchIcon />}
          />
        </Box>
        <Select
          placeholder="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          w={{ base: 'full', md: '200px' }}
        >
          <option value="">All Statuses</option>
          <option value="CREATING">Creating</option>
          <option value="ACTIVE">Active</option>
          <option value="UPDATING">Updating</option>
          <option value="ERROR">Error</option>
          <option value="DELETING">Deleting</option>
        </Select>
      </Flex>

      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th>Resources</Th>
              <Th>Created</Th>
              <Th>Owner</Th>
              <Th width="50px"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredEnvironments.map((environment) => (
              <Tr key={environment.id}>
                <Td>
                  <Link to={`/environments/${environment.id}`}>
                    <Text fontWeight="medium" color="brand.600">
                      {environment.name}
                    </Text>
                    {environment.description && (
                      <Text fontSize="sm" color="gray.600" noOfLines={1}>
                        {environment.description}
                      </Text>
                    )}
                  </Link>
                </Td>
                <Td>
                  <StatusBadge status={environment.status} />
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Badge colorScheme="blue">
                      CPU: {environment.resourceLimits.cpu}
                    </Badge>
                    <Badge colorScheme="purple">
                      Mem: {environment.resourceLimits.memory}
                    </Badge>
                  </HStack>
                </Td>
                <Td>
                  <DateFormat date={environment.createdAt} />
                </Td>
                <Td>{environment.userId}</Td>
                <Td>
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label="Options"
                      icon={<FaEllipsisV />}
                      variant="ghost"
                      size="sm"
                    />
                    <MenuList>
                      <MenuItem as={Link} to={`/environments/${environment.id}`}>
                        View Details
                      </MenuItem>
                      <MenuItem
                        isDisabled={environment.status === 'DELETING'}
                        onClick={() => handleDeleteClick(environment)}
                        color="red.500"
                      >
                        Delete
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Environment
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete{' '}
              <strong>{environmentToDelete?.name}</strong>? This action cannot be
              undone, and all resources will be permanently deleted.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Environments;