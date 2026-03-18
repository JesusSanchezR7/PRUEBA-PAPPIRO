import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  description: string;
}

export function DashboardLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    return window.innerWidth < 1024;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return window.innerWidth >= 1024;
  });

  const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
    return window.innerWidth >= 1024;
  });

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const isSidebarExpandedDesktop = isSidebarPinned || isSidebarHovered;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsSidebarOpen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldLockMainScroll = isMobile && isSidebarOpen;

  // Menu items
  const menuItems: MenuItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', description: 'Reportes y métricas' },
    { path: '/products', label: 'Productos', icon: 'Package', description: 'Gestión CRUD de inventario' },
    { path: '/orders', label: 'Pedidos', icon: 'ShoppingCart', description: 'Control de pedidos' },
    { path: '/users', label: 'Usuarios App', icon: 'Users', description: 'Usuarios móviles (consulta)' },
    { path: '/qr-validator', label: 'Validación QR', icon: 'QrCode', description: 'Escaneo de códigos QR' },
  ];

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleTogglePin = () => {
    setIsSidebarPinned(!isSidebarPinned);
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-100">
      <div className="h-full bg-white overflow-x-hidden">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          isSidebarPinned={isSidebarPinned}
          onTogglePin={handleTogglePin}
        />
        <div className="h-[calc(100vh-120px)] mt-10 flex">
          <Sidebar
            isOpen={isSidebarOpen}
            menuItems={menuItems}
            onClose={() => setIsSidebarOpen(false)}
            isSidebarExpandedDesktop={isSidebarExpandedDesktop}
            isSidebarPinned={isSidebarPinned}
            onHoverChange={setIsSidebarHovered}
          />
          <main className={`flex-1 bg-white ${shouldLockMainScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <div className="p-4 md:p-6">
              <div className="max-w-7xl mx-auto">
                <div className="mt-4 md:mt-6">
                  <Outlet />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}