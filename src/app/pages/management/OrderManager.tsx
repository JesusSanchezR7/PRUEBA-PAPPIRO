import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, CheckCircle, XCircle, Clock, Package, Eye, QrCode, User, Calendar, DollarSign, CreditCard, AlertCircle, Loader } from 'lucide-react';
import { Order } from '../../types';
import { orderService } from '../../services/orderService';
import { qrExpirationService } from '../../services/qrExpirationService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';

export function OrderManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Cargar pedidos al montar el componente
  useEffect(() => {
    loadOrders();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const fetchedOrders = await orderService.getAllOrders();
      setOrders(fetchedOrders);
      console.log('✅ Pedidos cargados:', fetchedOrders.length);
    } catch (error) {
      console.error('❌ Error cargando pedidos:', error);
      toast.error('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    const badges = {
      pending: <Badge className="bg-yellow-500">Pendiente</Badge>,
      processing: <Badge className="bg-blue-500">Procesando</Badge>,
      ready: <Badge className="bg-green-500">Listo para Recoger</Badge>,
      'picked-up': <Badge className="bg-gray-500">Entregado</Badge>,
      cancelled: <Badge variant="destructive">Cancelado</Badge>,
    };
    return badges[status];
  };

  const getPaymentStatusBadge = (paymentStatus: Order['paymentStatus'], orderStatus?: Order['status']) => {
    // Si el pedido está cancelado, mostrar Cancelado independientemente del estado de pago
    if (orderStatus === 'cancelled') {
      return <Badge variant="destructive">Cancelado</Badge>;
    }
    
    const badges = {
      pending: <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pago Pendiente</Badge>,
      completed: <Badge variant="outline" className="text-green-600 border-green-300">Pagado</Badge>,
      failed: <Badge variant="outline" className="text-red-600 border-red-300">Pago Fallido</Badge>,
    };
    return badges[paymentStatus];
  };

  const getPaymentMethodText = (method: Order['paymentMethod']) => {
    switch(method) {
      case 'card': return 'Tarjeta de Crédito/Débito';
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      default: return 'Desconocido';
    }
  };

  const formatTimeRemaining = (hours?: number) => {
    if (hours === undefined || hours === null) return null;
    const totalMinutes = Math.max(0, Math.floor(hours * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m restantes`;
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const success = await orderService.updateOrderStatus(orderId, newStatus);
      if (success) {
        await loadOrders(); // Recargar la lista
        const statusLabels: Record<Order['status'], string> = {
          'pending': 'Pendiente',
          'processing': 'Procesando',
          'ready': 'Listo para recoger',
          'picked-up': 'Entregado',
          'cancelled': 'Cancelado',
        };
        toast.success(`Pedido actualizado a: ${statusLabels[newStatus]}`);
      } else {
        toast.error('No se pudo actualizar el pedido');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar el pedido');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const success = await orderService.cancelOrder(orderId);
      if (success) {
        await loadOrders(); // Recargar la lista
        toast.success(`Pedido ${orderId} cancelado`);
      } else {
        toast.error('No se pudo cancelar el pedido');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cancelar el pedido');
    }
  };

  const handleMarkAsDelivered = async (orderId: string) => {
    try {
      const success = await orderService.updateOrderStatus(orderId, 'picked-up');
      if (success) {
        await loadOrders(); // Recargar la lista
        toast.success(`Pedido ${orderId} marcado como entregado`);
      } else {
        toast.error('No se pudo marcar como entregado');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al marcar como entregado');
    }
  };

  const handleViewQR = (order: Order) => {
    setSelectedOrder(order);
    setQrDialogOpen(true);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsDialogOpen(true);
  };

  const copyQRCode = () => {
    if (selectedOrder?.qrCode) {
      navigator.clipboard.writeText(selectedOrder.qrCode);
      toast.success('Código QR copiado al portapapeles');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeOrders = orders.filter(o => !['picked-up', 'cancelled'].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Pedidos</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Administración completa de pedidos desde la app móvil
          </p>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row">
          <Button 
            variant="outline"
            onClick={loadOrders}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
            Actualizar
          </Button>
          {/* Botón 'Cancelar Expirados' removido según petición del equipo */}
          <Button 
            variant="outline" 
            onClick={() => navigate('/qr-validator')}
            className="w-full sm:w-auto"
          >
            <QrCode className="mr-2 h-4 w-4" />
            Ir a Validación QR
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Pedidos</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <Package className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader className="h-6 w-6 animate-spin" /> : orders.length}
            </div>
          </CardContent>
        </Card>

        {/* Tarjeta 'Pendientes' removida según petición */}

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Entregados</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(o => o.status === 'picked-up').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, nombre o correo del cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="picked-up">Entregado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            {loading ? 'Cargando pedidos...' : `${filteredOrders.length} pedidos encontrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
                <p className="text-gray-600">Cargando pedidos desde la base de datos...</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado Pedido</TableHead>
                      <TableHead>Estado Pago</TableHead>
                      <TableHead>Tiempo QR</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No se encontraron pedidos</p>
                          <p className="text-sm text-gray-400 mt-1">
                            {searchTerm || statusFilter !== 'all' 
                              ? 'Ajusta los filtros de búsqueda'
                              : 'Los pedidos aparecerán aquí cuando los usuarios realicen compras'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-mono font-medium">
                          {order.id}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.user.name}</div>
                            <div className="text-sm text-gray-500">
                              {order.user.email}
                            </div>
                            <div className="text-xs text-gray-400">
                              {order.user.role === 'student' ? 'Estudiante' : 'Profesor'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {item.quantity} × {item.product.name}
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{order.items.length - 2} más...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-lg">
                          ${order.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(order.status)}
                            <div className="text-xs text-gray-500">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-MX') : 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge(order.paymentStatus, order.status)}
                        </TableCell>
                        <TableCell>
                          {order.validatedAt || order.status === 'picked-up' ? (
                            <Badge className="bg-green-500">Validado</Badge>
                          ) : order.qrExpired ? (
                            <Badge variant="destructive">Expirado</Badge>
                          ) : order.qrTimeRemainingHours !== undefined ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              {formatTimeRemaining(order.qrTimeRemainingHours)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">Sin QR</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* Ver QR */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewQR(order)}
                              title="Ver código QR"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>

                            {/* Ver detalles */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(order)}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Acciones según estado */}
                            {order.status === 'pending' && !order.validated && !order.qrExpired && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleMarkAsDelivered(order.id)}
                                title="Marcar como entregado"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Entregar
                              </Button>
                            )}

                            {/* Cancelar */}
                            {!['picked-up', 'cancelled'].includes(order.status) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelOrder(order.id)}
                                title="Cancelar pedido"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pedidos por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['pending', 'picked-up', 'cancelled'].map((status) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-sm capitalize">
                    {status === 'picked-up' ? 'Entregados' : 
                     status === 'pending' ? 'Pendientes' : 'Cancelados'}
                  </span>
                  <Badge variant="outline">
                    {orders.filter(o => o.status === status).length}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

          <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumen de Pagos</CardTitle>
          </CardHeader>
          <CardContent>
              <div>
                <div className="text-sm text-gray-500">Pagados</div>
                <div className="text-2xl font-bold text-green-600">
                  ${orders
                    .filter(o => o.paymentStatus === 'completed')
                    .reduce((sum, order) => sum + order.total, 0)
                    .toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  {orders.filter(o => o.paymentStatus === 'completed').length} pedidos
                </div>
              </div>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Código QR */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Código QR del Pedido
            </DialogTitle>
            <DialogDescription>
              Este código se usará para validar la entrega en tienda
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-gray-100 p-6 rounded-lg inline-block">
                  {/* Aquí iría un generador real de QR. Por ahora usamos texto */}
                  <div className="font-mono text-lg font-bold mb-2 p-4 bg-white rounded border">
                    {selectedOrder.qrCode}
                  </div>
                  <div className="text-sm text-gray-500">
                    Pedido: {selectedOrder.id}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Cliente</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>{selectedOrder.user.name}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-bold">${selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Código de Recogida removido por petición del equipo */}
              </div>
              
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={copyQRCode}>
                  Copiar Código QR
                </Button>
                <Button onClick={() => setQrDialogOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Detalles del Pedido */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Detalles Completos del Pedido
            </DialogTitle>
            <DialogDescription>
              Información detallada del pedido seleccionado
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Información general */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Información del Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="font-medium">{selectedOrder.user.name}</div>
                          <div className="text-sm text-gray-500">{selectedOrder.user.email}</div>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Rol:</span> {selectedOrder.user.role === 'student' ? 'Estudiante' : 'Profesor'}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Nivel:</span> {selectedOrder.user.educationLevel}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Información del Pedido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <div className="text-sm">
                          <span className="font-medium">Fecha:</span> {new Date(selectedOrder.createdAt).toLocaleDateString('es-MX', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">ID Pedido:</span> {selectedOrder.id}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Estado:</span> {getStatusBadge(selectedOrder.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Información de pago */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Información de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Método de Pago</div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-500" />
                        <span>{getPaymentMethodText(selectedOrder.paymentMethod)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Estado de Pago</div>
                      <div>{getPaymentStatusBadge(selectedOrder.paymentStatus, selectedOrder.status)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Total</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        ${selectedOrder.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Productos del pedido */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Productos del Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-sm text-gray-500">
                              Categoría: {item.product.category}
                            </div>
                            <div className="text-xs text-gray-400">
                              Niveles: {item.product.educationLevels.join(', ')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${item.product.price.toFixed(2)} c/u</div>
                          <div className="text-sm text-gray-500">
                            Cantidad: {item.quantity}
                          </div>
                          <div className="text-sm font-bold text-emerald-600">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Códigos especiales */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Códigos de Validación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Código QR</Label>
                      <div className="font-mono text-sm bg-gray-50 p-2 rounded mt-1 break-all">
                        {selectedOrder.qrCode}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => {
                          setDetailsDialogOpen(false);
                          handleViewQR(selectedOrder);
                        }}
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        Ver QR Completo
                      </Button>
                    </div>
                    {/* Código de Recogida removido */}
                  </div>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button onClick={() => setDetailsDialogOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}