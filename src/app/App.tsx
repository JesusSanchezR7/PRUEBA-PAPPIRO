import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/dashboard/Dashboard';
import { ProductManager } from './pages/management/ProductManager';
import { OrderManager } from './pages/management/OrderManager';
import { UserManager } from './pages/management/UserManager';
import { QRValidator } from './pages/management/QRValidator';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { syncPendingActions } from './services/offlineSyncService';

// Componente de carga
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Cargando aplicación...</p>
      </div>
    </div>
  );
}

// Componente protegido por ruta (solo admin)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isInitializing } = useAuth();
  
  if (isInitializing) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Según nuevo SRS: Solo admin tiene acceso al dashboard
  if (user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Componente de rutas principales
function AppRoutes() {
  const { user, isInitializing } = useAuth();
  
  if (isInitializing) {
    return <LoadingScreen />;
  }
  
  return (
    <Routes>
      {/* Ruta pública - Login */}
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />
      
      {/* Rutas protegidas - Solo admin */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* RF-3: Módulo de Productos */}
        <Route path="products" element={<ProductManager />} />
        
        {/* RF-7.2: Control de Pedidos */}
        <Route path="orders" element={<OrderManager />} />
        
        {/* RF-1: Usuarios de App Móvil */}
        <Route path="users" element={<UserManager />} />
        
        {/* RF-6: Validación QR */}
        <Route path="qr-validator" element={<QRValidator />} />
      </Route>
      
      {/* Ruta 404 */}
      <Route path="*" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}

function NetworkStatusHandler() {
  useEffect(() => {
    const handleOffline = () => {
      toast.warning('Estás sin conexión', {
        description: 'Los cambios se guardarán localmente hasta recuperar internet.',
      });
    };

    const handleOnline = async () => {
      const syncedCount = await syncPendingActions();
      if (syncedCount > 0) {
        toast.success('Conexión restaurada', {
          description: `Se sincronizaron ${syncedCount} cambios pendientes.`,
        });
        return;
      }

      toast.success('Conexión restaurada');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    void syncPendingActions();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}

// Componente principal
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NetworkStatusHandler />
        <AppRoutes />
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'font-sans',
            duration: 4000,
          }}
        />
      </AuthProvider>
    </Router>
  );
}