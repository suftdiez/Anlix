'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { authApi } from './api';

interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = Cookies.get('token');
    if (savedToken) {
      setToken(savedToken);
      fetchProfile(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchProfile = async (authToken: string) => {
    try {
      const data = await authApi.getProfile();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      Cookies.remove('token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    Cookies.set('token', data.token, { expires: 7 });
    setToken(data.token);
    setUser(data.user);
  };

  const loginWithGoogle = async (credential: string) => {
    const data = await authApi.googleLogin(credential);
    Cookies.set('token', data.token, { expires: 7 });
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, username: string) => {
    const data = await authApi.register({ email, password, username });
    Cookies.set('token', data.token, { expires: 7 });
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    Cookies.remove('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your_google_client_id_here'}>
      <AuthContext.Provider
        value={{
          user,
          token,
          isLoading,
          isAuthenticated: !!user,
          login,
          loginWithGoogle,
          register,
          logout,
          updateUser,
        }}
      >
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
