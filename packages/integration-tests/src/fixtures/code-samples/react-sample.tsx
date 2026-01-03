/**
 * Sample React component for import parsing tests
 * Demonstrates React-specific patterns and imports
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

// Type imports
import type { User, Post, Comment } from '@types/index';
import type { RootState } from '@store/index';

// Component imports
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card } from '@components/ui/Card';
import { Loader } from '@components/common/Loader';

// Hook imports
import { useAuth } from '@hooks/useAuth';
import { useDebounce } from '@hooks/useDebounce';
import { useLocalStorage } from '@hooks/useLocalStorage';

// Utility imports
import { formatDate, formatNumber } from '@utils/formatters';
import { api } from '@services/api';

// Store imports
import { fetchUsers, selectUserById } from '@store/slices/users';
import { addNotification } from '@store/slices/notifications';

interface DashboardProps {
  title: string;
  userId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ title, userId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // State hooks
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useLocalStorage('darkMode', false);

  // Custom hooks
  const { user: authUser, logout } = useAuth();
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Redux selectors
  const users = useSelector((state: RootState) => state.users.items);
  const isLoading = useSelector((state: RootState) => state.users.loading);

  // React Query hooks
  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ['posts', userId],
    queryFn: () => api.getPosts(userId),
    enabled: !!userId
  });

  const createPostMutation = useMutation({
    mutationFn: api.createPost,
    onSuccess: () => {
      dispatch(addNotification({
        type: 'success',
        message: 'Post created successfully'
      }));
    }
  });

  // Memoized values
  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [users, debouncedSearch]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalPosts: posts?.length || 0,
    activeUsers: users.filter(u => u.isActive).length
  }), [users, posts]);

  // Callbacks
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleUserClick = useCallback((user: User) => {
    setSelectedUser(user);
    navigate(`/users/${user.id}`);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // Effects
  useEffect(() => {
    if (!authUser) {
      navigate('/login');
    }
  }, [authUser, navigate]);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header>
        <h1>{title}</h1>
        <p>Welcome, {authUser?.name}</p>
        <Button onClick={handleLogout}>Logout</Button>
      </header>

      <section>
        <Input
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search users..."
        />
      </section>

      <section>
        <Card>
          <h2>Statistics</h2>
          <ul>
            <li>Total Users: {formatNumber(stats.totalUsers)}</li>
            <li>Total Posts: {formatNumber(stats.totalPosts)}</li>
            <li>Active Users: {formatNumber(stats.activeUsers)}</li>
          </ul>
        </Card>
      </section>

      <section>
        {isLoading || postsLoading ? (
          <Loader />
        ) : (
          <AnimatePresence>
            {filteredUsers.map(user => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onClick={() => handleUserClick(user)}
              >
                <Card>
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <small>Joined: {formatDate(user.createdAt)}</small>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>
    </motion.div>
  );
};

export default Dashboard;
