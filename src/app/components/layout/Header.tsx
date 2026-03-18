// src/components/layout/Header.tsx
import { Button } from '../ui/button';
import { 
  Menu, 
  X, 
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isSidebarPinned?: boolean;
  onTogglePin?: () => void;
}

export function Header({ 
  isSidebarOpen, 
  onToggleSidebar,
  isSidebarPinned = false,
  onTogglePin = () => {}
}: HeaderProps) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.info('Sesión cerrada correctamente');
  };

  return (
    <div className="relative h-20 flex-shrink-0">
      <header className="bg-blue-600 h-20">
        <div className="flex items-center justify-between px-4 h-full">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden rounded-md border border-gray-300 bg-gray-100 text-gray-500 shadow-sm hover:bg-white hover:border-gray-400 hover:text-gray-600"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          
          {/* Menu button para desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePin}
            className="hidden lg:flex rounded-md border border-gray-300 bg-gray-100 text-gray-500 shadow-sm hover:bg-white hover:border-gray-400 hover:text-gray-600 transition-all"
            title={isSidebarPinned ? 'Cerrar sidebar' : 'Abrir sidebar'}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            {/* Logo Pappiro - MEJORADO */}
            <div className="h-40 w-40 flex items-center justify-center">
              <img 
                src="/assets/logo-versionblanco.webp" 
                alt="Pappiro Logo" 
                className="h-40 w-40 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = document.createElement('span');
                  fallback.className = 'text-gray-800 font-bold text-lg';
                  fallback.textContent = 'P';
                  e.currentTarget.parentNode?.appendChild(fallback);
                }}
              />
            </div>
            
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-white">
              {user?.name || 'Usuario'}
            </p>
            <p className="text-xs text-white/80">
              {user?.email || 'usuario@pappiro.com'}
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
        </div>
      </header>

      <div className="pointer-events-none absolute left-0 right-0 top-full z-10 bg-blue-600 h-10 -mt-px">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="block h-full w-full text-white"
          aria-hidden="true"
        >
          <path
            d="M0,42 C60,80 120,80 180,42 C240,4 300,4 360,42 C420,80 480,80 540,42 C600,4 660,4 720,42 C780,80 840,80 900,42 C960,4 1020,4 1080,42 C1140,80 1200,80 1200,80 L1200,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
}