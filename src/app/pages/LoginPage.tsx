// src/pages/LoginPage.tsx
import { LoginForm } from '../components/auth/LoginForm';
import { Toaster } from 'sonner';

export function LoginPage() {
  // Para compatibilidad si no usas AuthContext
  const handleDemoLogin = () => {
    // Lógica temporal para demo
    window.location.href = '/dashboard';
  };

  return (
    <>
      <LoginForm onLogin={handleDemoLogin} />
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'font-sans',
          duration: 4000,
        }}
      />
    </>
  );
}