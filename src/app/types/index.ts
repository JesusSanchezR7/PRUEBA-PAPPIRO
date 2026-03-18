// Types para Pappiro V1.0 - SEGÚN NUEVO SRS

// ========== APP MÓVIL ==========
export interface MobileUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher'; // SOLO para app móvil
  educationLevel: 'primaria' | 'secundaria' | 'preparatoria' | 'universidad';
  phone?: string;
  createdAt: string;
  status: 'active' | 'suspended';
}

// ========== DASHBOARD WEB ==========
export interface Admin {
  id: string;
  name: string;
  email: string;
  role: 'admin'; // SOLO para dashboard web según RF-2.2
  createdAt: string;
  status: 'active' | 'suspended';
}

// ========== PRODUCTOS (RF-3) ==========
export interface Product {
  id: string;
  name: string;
  category: 'cuadernos' | 'lapices' | 'calculadoras' | 'mochilas' | 'libros' | 'material-arte';
  price: number;
  stock: number;
  description: string;
  imageUrl: string;
  educationLevels: Array<'primaria' | 'secundaria' | 'preparatoria' | 'universidad'>;
  status: 'active' | 'inactive';
}

// ========== PEDIDOS ==========
export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

export interface Order {
  id: string;
  userId: string;
  user: MobileUser; // Usuario de app móvil
  items: CartItem[];
  total: number;
  status: 'pending' | 'processing' | 'ready' | 'picked-up' | 'cancelled';
  qrCode: string; // RF-6
  createdAt: string;
  paymentMethod: 'card' | 'cash' | 'transfer';
  paymentStatus: 'pending' | 'completed' | 'failed';
  pickupCode?: string;
  // Nuevo: información de validación del QR
  validated?: boolean;
  validatedAt?: string | null;
  qrGeneratedAt?: string | null;
  qrExpired?: boolean;
  qrTimeRemainingHours?: number;
}

// ========== DASHBOARD MÉTRICAS (RF-7) ==========
export interface DashboardMetrics {
  // RF-7.1: Reporte de ventas
  totalSales: number;
  salesByCategory: Array<{ category: string; total: number }>;
  
  // RF-7.2: Pedidos recientes
  totalOrders: number;
  pendingOrders: number;
  recentOrders: Order[];
  
  // RF-7.3: Gestión de inventario
  lowStockProducts: number;
  criticalInventory: Product[];
  
  // Métricas adicionales
  totalUsers: number;
  activeUsers: number;
  usersByRole: {
    students: number;
    teachers: number;
  };
  educationDistribution: Array<{ level: string; count: number }>;
}

// Tipos para login según SRS
export type AppUserRole = 'student' | 'teacher'; // Solo app móvil (RF-2.1)
export type DashboardUserRole = 'admin'; // Solo dashboard (RF-2.2)