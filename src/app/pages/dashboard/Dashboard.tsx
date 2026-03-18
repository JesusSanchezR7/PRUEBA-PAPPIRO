import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  ShoppingCart, Users, TrendingUp, Package, 
  AlertTriangle, DollarSign, Filter, BarChart3,
  TrendingDown, Calendar
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { orderService } from '../../services/orderService';
import { userService } from '../../services/userService';
import { DashboardMetrics, Order, Product, MobileUser } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [timeFilter, setTimeFilter] = useState('today');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    salesByCategory: [],
    totalOrders: 0,
    pendingOrders: 0,
    recentOrders: [],
    lowStockProducts: 0,
    criticalInventory: [],
    totalUsers: 0,
    activeUsers: 0,
    usersByRole: {
      students: 0,
      teachers: 0,
    },
    educationDistribution: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((product) => {
      map[product.id] = product;
    });
    return map;
  }, [products]);

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((product) => unique.add(product.category));
    return Array.from(unique).sort();
  }, [products]);

  // Función para recargar datos (usada por suscripciones en tiempo real)
  const reloadDashboardData = useCallback(async () => {
    const [ordersData, usersData, productsResult, categoriesResult] = await Promise.all([
      orderService.getAllOrders(),
      userService.getAllUsers(),
      supabase
        .from('productos')
        .select('id_producto, nombre_producto, precio_unidad, descripcion, imagen_url, stock_actual, id_categoria, estatus, niveles_educativos')
        .order('id_producto', { ascending: false }),
      supabase
        .from('categorias')
        .select('id, nombre')
    ]);

    const categoriesData = categoriesResult.data || [];
    const categorySlugById: Record<number, string> = {};
    const nameToSlug: Record<string, string> = {
      'Escritura': 'escritura',
      'Papeleria': 'papeleria',
      'Papelería': 'papeleria',
      'Arte': 'arte',
      'Matematicas': 'matematicas',
      'Matemáticas': 'matematicas',
      'Organizacion': 'organizacion',
      'Organización': 'organizacion',
      'Computo': 'computo',
      'Cómputo': 'computo',
      'Ciencias': 'ciencias',
    };

    categoriesData.forEach((category: any) => {
      const slug = nameToSlug[category.nombre] || String(category.nombre || '').toLowerCase();
      categorySlugById[category.id] = slug;
    });

    const productsData = productsResult.data || [];
    const mappedProducts: Product[] = productsData.map((product: any) => {
      const categorySlug = categorySlugById[product.id_categoria] || 'escritura';
      return {
        id: product.id_producto.toString(),
        name: product.nombre_producto,
        category: categorySlug,
        price: parseFloat(product.precio_unidad || 0),
        stock: product.stock_actual,
        description: product.descripcion || '',
        imageUrl: product.imagen_url || '',
        educationLevels: product.niveles_educativos 
          ? (typeof product.niveles_educativos === 'string' 
              ? JSON.parse(product.niveles_educativos) 
              : product.niveles_educativos)
          : [],
        status: product.estatus?.toLowerCase()?.includes('activo') ? 'active' : 'inactive',
      };
    });

    setOrders(ordersData);
    setUsers(usersData);
    setProducts(mappedProducts);

    const paidOrders = ordersData.filter((order) => order.paymentStatus === 'completed');
    const totalSales = paidOrders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = ordersData.length;
    const pendingOrders = ordersData.filter((order) =>
      order.status === 'pending' || order.status === 'processing' || order.status === 'ready'
    ).length;

    const activeUsers = usersData.filter((u) => u.status === 'active').length;
    const students = usersData.filter((u) => u.role === 'student').length;
    const teachers = usersData.filter((u) => u.role === 'teacher').length;

    const educationDistributionMap: Record<string, number> = {};
    usersData.forEach((u) => {
      const level = u.educationLevel || 'primaria';
      educationDistributionMap[level] = (educationDistributionMap[level] || 0) + 1;
    });

    const criticalInventory = mappedProducts
      .filter((p) => p.status === 'active' && p.stock < 20)
      .slice(0, 5);

    setMetrics({
      totalSales,
      salesByCategory: [],
      totalOrders,
      pendingOrders,
      recentOrders: ordersData.slice(0, 5),
      lowStockProducts: criticalInventory.length,
      criticalInventory,
      totalUsers: usersData.length,
      activeUsers,
      usersByRole: {
        students,
        teachers,
      },
      educationDistribution: Object.entries(educationDistributionMap).map(([level, count]) => ({
        level,
        count,
      })),
    });
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        const [ordersData, usersData, productsResult, categoriesResult] = await Promise.all([
          orderService.getAllOrders(),
          userService.getAllUsers(),
          supabase
            .from('productos')
            .select('id_producto, nombre_producto, precio_unidad, descripcion, imagen_url, stock_actual, id_categoria, estatus, niveles_educativos')
            .order('id_producto', { ascending: false }),
          supabase
            .from('categorias')
            .select('id, nombre')
        ]);

        const categoriesData = categoriesResult.data || [];
        const categorySlugById: Record<number, string> = {};
        const nameToSlug: Record<string, string> = {
          'Escritura': 'escritura',
          'Papeleria': 'papeleria',
          'Papelería': 'papeleria',
          'Arte': 'arte',
          'Matematicas': 'matematicas',
          'Matemáticas': 'matematicas',
          'Organizacion': 'organizacion',
          'Organización': 'organizacion',
          'Computo': 'computo',
          'Cómputo': 'computo',
          'Ciencias': 'ciencias',
        };

        categoriesData.forEach((category: any) => {
          const slug = nameToSlug[category.nombre] || String(category.nombre || '').toLowerCase();
          categorySlugById[category.id] = slug;
        });

        const productsData = productsResult.data || [];
        const mappedProducts: Product[] = productsData.map((product: any) => {
          const categorySlug = categorySlugById[product.id_categoria] || 'escritura';
          let educationLevels: Product['educationLevels'] = [];
          if (product.niveles_educativos) {
            try {
              const parsed = typeof product.niveles_educativos === 'string'
                ? JSON.parse(product.niveles_educativos)
                : product.niveles_educativos;
              educationLevels = Array.isArray(parsed) ? parsed : [];
            } catch {
              educationLevels = [];
            }
          }

          return {
            id: String(product.id_producto || ''),
            name: product.nombre_producto || 'Producto',
            category: categorySlug as Product['category'],
            price: parseFloat(product.precio_unidad || 0),
            stock: Number(product.stock_actual || 0),
            description: product.descripcion || '',
            imageUrl: product.imagen_url || '',
            educationLevels,
            status: String(product.estatus || '').toLowerCase().includes('activo') ? 'active' : 'inactive',
          };
        });

        setOrders(ordersData);
        setUsers(usersData);
        setProducts(mappedProducts);

        const paidOrders = ordersData.filter((order) => order.paymentStatus === 'completed');
        const totalSales = paidOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = ordersData.length;
        const pendingOrders = ordersData.filter((order) =>
          order.status === 'pending' || order.status === 'processing' || order.status === 'ready'
        ).length;

        const activeUsers = usersData.filter((u) => u.status === 'active').length;
        const students = usersData.filter((u) => u.role === 'student').length;
        const teachers = usersData.filter((u) => u.role === 'teacher').length;

        const educationDistributionMap: Record<string, number> = {};
        usersData.forEach((u) => {
          const level = u.educationLevel || 'primaria';
          educationDistributionMap[level] = (educationDistributionMap[level] || 0) + 1;
        });

        const salesByCategoryMap: Record<string, number> = {};
        paidOrders.forEach((order) => {
          order.items.forEach((item) => {
            const productId = item.productId || item.product?.id || '';
            const product = productId ? mappedProducts.find((p) => p.id === productId) : undefined;
            const category = product?.category || item.product?.category || 'escritura';
            const revenue = (item.quantity || 0) * (item.product?.price || product?.price || 0);
            salesByCategoryMap[category] = (salesByCategoryMap[category] || 0) + revenue;
          });
        });

        const salesByCategory = Object.entries(salesByCategoryMap).map(([category, total]) => ({
          category,
          total,
        }));

        const criticalInventory = mappedProducts
          .filter((product) => product.status === 'active' && product.stock < 20)
          .slice(0, 5);

        setMetrics({
          totalSales,
          salesByCategory,
          totalOrders,
          pendingOrders,
          recentOrders: ordersData.slice(0, 5),
          lowStockProducts: criticalInventory.length,
          criticalInventory,
          totalUsers: usersData.length,
          activeUsers,
          usersByRole: {
            students,
            teachers,
          },
          educationDistribution: Object.entries(educationDistributionMap).map(([level, count]) => ({
            level,
            count,
          })),
        });
      } catch (error) {
        console.error('Error cargando dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // 🔔 Suscripciones en tiempo real para actualización automática
  useRealtimeSubscription('pedidos', reloadDashboardData);
  useRealtimeSubscription('productos', reloadDashboardData);
  useRealtimeSubscription('usuarios', reloadDashboardData);
  
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (timeFilter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (timeFilter === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (timeFilter === 'month') {
      start.setMonth(now.getMonth() - 1);
    } else {
      start.setFullYear(now.getFullYear() - 1);
    }

    return orders.filter((order) => new Date(order.createdAt) >= start);
  }, [orders, timeFilter]);

  // Calcular productos más vendidos
  const topSellingProducts = calculateTopSellingProducts(
    filteredOrders,
    categoryFilter,
    productMap
  );
  
  // Pedidos recientes (RF-7.2)
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Inventario crítico (RF-7.3)
  const criticalInventory = products
    .filter(p => p.status === 'active' && p.stock < 20)
    .slice(0, 5);

  // Métricas rápidas según NUEVO SRS
  const quickStats = [
    {
      title: 'Ventas Totales',
      value: `$${metrics.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`,
      change: 'Actual',
      trend: 'up',
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      description: 'Acumulado del mes'
    },
    {
      title: 'Pedidos Totales',
      value: metrics.totalOrders,
      change: 'Actual',
      trend: 'up',
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      description: 'Pedidos procesados'
    },
    {
      title: 'Usuarios Activos',
      value: metrics.activeUsers,
      change: 'Actual',
      trend: 'up',
      icon: Users,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      description: 'App móvil'
    },
    {
      title: 'Stock Bajo',
      value: metrics.lowStockProducts,
      change: 'Reabastecer',
      trend: 'alert',
      icon: AlertTriangle,
      color: 'text-rose-500',
      bgColor: 'bg-rose-50',
      description: 'Productos críticos'
    }
  ];

  // Función para calcular productos más vendidos
  function calculateTopSellingProducts(
    orders: Order[],
    category: string,
    productsById: Record<string, Product>
  ) {
    const productSales: Record<string, { product: any; quantity: number; revenue: number }> = {};
    
    orders.forEach(order => {
      order.items.forEach((item: any) => {
        const productId = item.productId || item.product?.id || '';
        const product = productsById[productId] || item.product || {
          id: productId,
          name: 'Producto',
          category: 'escritura',
          price: 0,
          stock: 0,
          description: '',
          imageUrl: '',
          educationLevels: [],
          status: 'active',
        };
        const productCategory = product.category || 'escritura';

        if (category === 'all' || productCategory === category) {
          if (!productSales[productId]) {
            productSales[productId] = {
              product,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[productId].quantity += item.quantity;
          productSales[productId].revenue += (product.price || 0) * item.quantity;
        }
      });
    });
    
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Panel de Control</h1>
        <p className="text-gray-600">Cargando datos del dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pt-4"> {/* Cambiado: agregado pt-4 */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Panel de Control
          </h1>
          <p className="text-gray-600 mt-1">
            Bienvenido, Administrador {user?.name}
          </p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-full border border-blue-500 ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <p className="text-sm text-gray-500 mt-1">{stat.description}</p>
                  </div>
                  <Badge 
                    className={
                      stat.trend === 'alert' 
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    }
                    variant="outline"
                  >
                    {stat.trend === 'up' ? (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    ) : stat.trend === 'down' ? (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    ) : null}
                    {stat.change}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sección principal: Productos más vendidos con filtros (NUEVO SRS) */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                Productos Más Vendidos
              </CardTitle>
              <CardDescription>
                Top 10 productos según ventas con filtros por categoría
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="year">Este año</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Unidades Vendidas</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSellingProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No hay datos de ventas</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  topSellingProducts.map((item, index) => (
                    <TableRow key={item.product.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-xs text-gray-500">ID: {item.product.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {item.product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        ${item.revenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap min-w-max ${
                          item.product.stock < 5 
                            ? 'bg-rose-100 text-rose-700' 
                            : item.product.stock < 20 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.product.stock} unidades
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filtrado por: {categoryFilter === 'all' ? 'Todas las categorías' : categoryFilter}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Calendar className="h-4 w-4" />
              <span>Período: {
                timeFilter === 'today' ? 'Hoy' :
                timeFilter === 'week' ? 'Esta semana' :
                timeFilter === 'month' ? 'Este mes' : 'Este año'
              }</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Otras secciones (mantenidas pero simplificadas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos recientes */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-amber-500" />
                  Pedidos Recientes
                </CardTitle>
                <CardDescription>
                  Últimos pedidos realizados
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-medium">Cliente</TableHead>
                    <TableHead className="font-medium">Fecha</TableHead>
                    <TableHead className="font-medium">Estado</TableHead>
                    <TableHead className="font-medium text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.user.name}</p>
                          <p className="text-sm text-gray-500">
                            {order.user.role === 'student' ? 'Estudiante' : 'Profesor'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(order.createdAt).toLocaleDateString('es-MX')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            order.status === 'picked-up' 
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : order.status === 'ready'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : order.status === 'processing'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700'
                          }
                        >
                          {order.status === 'picked-up' ? 'Entregado' :
                           order.status === 'ready' ? 'Listo' :
                           order.status === 'processing' ? 'Procesando' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${order.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Inventario crítico */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-rose-500" />
                  Alerta de Inventario
                </CardTitle>
                <CardDescription>
                  Productos con stock bajo
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                {criticalInventory.length} productos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {criticalInventory.map((product) => (
                <div 
                  key={product.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        Categoría: {product.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      product.stock < 5 ? 'text-rose-600' :
                      product.stock < 10 ? 'text-amber-600' : 'text-gray-600'
                    }`}>
                      {product.stock} unidades
                    </div>
                    <div className="text-xs text-gray-500">
                      ${product.price.toFixed(2)} c/u
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen informativo */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Dashboard Pappiro Admin</h3>
              <p className="text-gray-600 mt-1">
               Productos más vendidos con filtros
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline">Total pedidos: {metrics.totalOrders}</Badge>
                <Badge variant="outline">Total usuarios: {metrics.totalUsers}</Badge>
                <Badge variant="outline">Productos: {products.length}</Badge>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {topSellingProducts.length}
              </div>
              <div className="text-gray-500">Productos en ranking</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}