import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { authApi, LoginCredentials, SignupCredentials, User } from '../services/api';

// Abstracting SecureStore to handle web compatibility
const storage = {
  setItemAsync: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('SecureStore not available, falling back to localStorage', error);
      localStorage.setItem(key, value);
    }
  },
  getItemAsync: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('SecureStore not available, falling back to localStorage', error);
      return localStorage.getItem(key);
    }
  },
  deleteItemAsync: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('SecureStore not available, falling back to localStorage', error);
      localStorage.removeItem(key);
    }
  },
};


interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await storage.getItemAsync('auth_token');
        const storedUser = await storage.getItemAsync('user_data');

        if (storedToken && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to load stored auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response = await authApi.login(credentials);

      await storage.setItemAsync('auth_token', response.token);
      await storage.setItemAsync('user_data', JSON.stringify(response.user));

      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Login Failed', 'Please check your credentials and try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    try {
      setIsLoading(true);
      const response = await authApi.signup(credentials);

      await storage.setItemAsync('auth_token', response.token);
      await storage.setItemAsync('user_data', JSON.stringify(response.user));

      setUser(response.user);
    } catch (error) {
      console.error('Signup failed:', error);
      Alert.alert('Signup Failed', 'Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await storage.deleteItemAsync('auth_token');
      await storage.deleteItemAsync('user_data');
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const storedToken = await storage.getItemAsync('auth_token');
      if (storedToken) {
        const response = await authApi.getProfile();
        await storage.setItemAsync('user_data', JSON.stringify(response));
        setUser(response);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      signup,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;