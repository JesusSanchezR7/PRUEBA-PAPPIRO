import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { offlineDetector } from '../utils/offlineDetector';

export type UserRole = 'admin'; // SEGÚN NUEVO SRS: Solo admin para dashboard

interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  avatarColor?: string;
  nivel_educativo?: string;
  estatus: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Solo admin
const getAvatarColor = (): string => {
  return 'bg-gradient-to-br from-blue-500 to-indigo-600';
};

const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'pappiro26@gmail.com').toLowerCase().trim();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('pappiro_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        return {
          ...parsed,
          avatarColor: getAvatarColor()
        };
      }
      return null;
    } catch {
      return null;
    }
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 🚀 Verificar sesión de Supabase al montar (solo si hay conexión)
  useEffect(() => {
    const checkSession = async () => {
      try {
        // 🔴 SI ESTÁ OFFLINE, solo usar localStorage y saltar
        if (!offlineDetector.isOnline()) {
          console.log('📴 Offline mode: usando localStorage de sesión');
          setIsInitializing(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        // Si hay sesión en Supabase pero no en localStorage, recuperar datos
        if (session && !user) {
          const { data: dbUser } = await supabase
            .from('usuarios')
            .select('id, nombre, email, nivel_educativo, estatus, rol')
            .eq('email', session.user.email)
            .eq('estatus', 'activo')
            .eq('rol', 'admin')
            .single();

          if (dbUser) {
            const userData: User = {
              id: session.user.id,
              email: dbUser.email,
              role: 'admin',
              name: dbUser.nombre,
              nivel_educativo: dbUser.nivel_educativo,
              estatus: dbUser.estatus,
              avatarColor: getAvatarColor()
            };
            setUser(userData);
            localStorage.setItem('pappiro_user', JSON.stringify(userData));
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // 🟡 En offline, esto es esperado; no hacer nada
        if (offlineDetector.isOnline()) {
          await supabase.auth.signOut();
          localStorage.removeItem('pappiro_user');
        }
      } finally {
      // 🔴 Validar conexión antes de intentar login
      if (!offlineDetector.isOnline()) {
        toast.error('Sin conexión', {
          description: 'Necesitas estar online para iniciar sesión',
        });
        throw new Error('No hay conexión a internet');
      }

        setIsInitializing(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const normalizedEmail = email.toLowerCase().trim();

      if (normalizedEmail !== adminEmail) {
        throw new Error('Solo el correo administrador autorizado puede iniciar sesión');
      }

      // 🚀 Optimización: Hacer las 2 consultas en paralelo
      const [authResult, userResult] = await Promise.all([
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        }),
        supabase
          .from('usuarios')
          .select('id, nombre, email, nivel_educativo, estatus, rol')
          .eq('email', normalizedEmail)
          .eq('estatus', 'activo')
          .eq('rol', 'admin')
          .single()
      ]);

      const { data: authData, error: authError } = authResult;
      const { data: dbUser, error: queryError } = userResult;

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Correo o contraseña incorrectos');
      }
      
      if (queryError || !dbUser) {
        await supabase.auth.signOut();
        throw new Error('Usuario admin no encontrado o inactivo');
      }

      // Crear objeto de usuario para estado local
      const userData: User = {
        id: authData.user.id || dbUser.id.toString(),
        email: dbUser.email,
        role: 'admin',
        name: dbUser.nombre,
        nivel_educativo: dbUser.nivel_educativo,
        estatus: dbUser.estatus,
        avatarColor: getAvatarColor()
      };
      
      // 🚀 Guardar en paralelo
      setUser(userData);
      localStorage.setItem('pappiro_user', JSON.stringify(userData));
      
      toast.success(`¡Bienvenido, ${userData.name}!`, {
        description: 'Acceso como Administrador',
      });
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pappiro_user');
    toast.info('Sesión cerrada', {
      description: 'Has cerrado sesión correctamente',
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}