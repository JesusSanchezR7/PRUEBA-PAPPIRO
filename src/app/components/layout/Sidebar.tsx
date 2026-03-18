import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  QrCode
} from 'lucide-react';

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}

interface SidebarProps {
  isOpen: boolean;
  menuItems: MenuItem[];
  onClose: () => void;
  isSidebarExpandedDesktop?: boolean;
  isSidebarPinned?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
}

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  QrCode
};

export function Sidebar({ 
  isOpen, 
  menuItems, 
  onClose,
  isSidebarExpandedDesktop = false,
  isSidebarPinned = false,
  onHoverChange = () => {}
}: SidebarProps) {
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;

    if (isOpen && isMobile) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    return undefined;
  }, [isOpen]);

  return (
    <>
      {/* Sidebar DESKTOP - Google Classroom style (solo lg y superiores) */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'relative w-auto',
          'bg-white',
          'transition-all duration-300 ease-in-out',
          isSidebarExpandedDesktop ? 'w-64' : 'w-20',
          'h-full overflow-hidden'
        )}
        onMouseEnter={() => !isSidebarPinned && onHoverChange(true)}
        onMouseLeave={() => !isSidebarPinned && onHoverChange(false)}
      >
        {/* Menú de navegación - Desktop */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200',
                    'relative whitespace-nowrap',
                    isActive
                      ? 'bg-slate-200 text-blue-700 border-l-4 border-l-blue-500'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                {/* Icon container */}
                <div className="flex-shrink-0 flex items-center justify-center h-5 w-5">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Label - solo visible cuando expandido */}
                {isSidebarExpandedDesktop && (
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="font-medium text-sm truncate">{item.label}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.description}
                    </div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer del sidebar - Desktop */}
        {isSidebarExpandedDesktop && (
          <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              v1.0 • {new Date().getFullYear()}
            </p>
          </div>
        )}
      </aside>

      {/* Sidebar MÓVIL - Comportamiento original intacto */}
      <aside
        className={cn(
          'fixed top-[120px] left-0 z-30 w-64 bg-white h-[calc(100vh-120px)]',
          'transition-transform duration-300 ease-in-out',
          'flex flex-col lg:hidden overflow-hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Contenedor interno con altura completa */}
        <div className="h-full min-h-0 flex flex-col">
          {/* Menú de navegación */}
          <nav className="flex-1 min-h-0 px-4 pt-6 pb-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = iconMap[item.icon] || LayoutDashboard;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={() => {
                    // Cerrar en móvil al hacer clic
                    if (window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                      'text-sm font-medium',
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-l-blue-500'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <Icon className="h-5 w-5 flex-shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          {/* Pie del sidebar - SIMPLIFICADO */}
          <div className="p-4 border-t bg-white flex-shrink-0">
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                v1.0 • {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay para móvil */}
      {isOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          className="fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity duration-300"
          style={{ top: '120px' }}
          onClick={onClose}
        />
      )}
    </>
  );
}