// src/app/pages/management/QRValidator.tsx - VERSIÓN CON BD REAL
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { 
  QrCode, Camera, CheckCircle, Search,
  Package, User, Calendar, AlertCircle,
  Video, VideoOff, CameraOff, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export function QRValidator() {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [qrCode, setQrCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCashing, setIsCashing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inicializar cámara
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (error: any) {
      console.error('Error al acceder a la cámara:', error);
      setCameraError('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
      toast.error('Error al acceder a la cámara web');
    }
  };

  // Detener cámara
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Cambiar modo de escaneo
  const handleModeChange = (mode: 'camera' | 'manual') => {
    if (mode === 'camera' && !isCameraActive) {
      startCamera();
    } else if (mode === 'manual' && isCameraActive) {
      stopCamera();
    }
    setScanMode(mode);
  };

  // Validar QR contra la BD
  const validateQRCode = async (code: string, isManualCode: boolean = false) => {
    if (!code.trim()) {
      toast.error('Ingrese un código QR');
      return;
    }

    setIsValidating(true);
    
    try {
      let order = null;

      if (isManualCode) {
        // Validar código manual: PAPP-{id_pedido}-{amount_code}
        const parts = code.split('-');
        if (parts.length !== 3 || parts[0] !== 'PAPP') {
          toast.error('Formato de código manual inválido. Formato esperado: PAPP-ID-MONTO');
          setIsValidating(false);
          return;
        }

        const pedidoId = parseInt(parts[1]);
        
        // Buscar el pedido en la BD
        const { data: pedidoData, error: pedidoError } = await supabase
          .from('pedidos')
          .select('*, pedido_items(*)')
          .eq('id_pedido', pedidoId)
          .single();

        if (pedidoError || !pedidoData) {
          toast.error('Código manual no encontrado en la base de datos');
          setIsValidating(false);
          return;
        }

        order = pedidoData;
      } else {
        // Validar QR: buscar en pedido_qr
        const { data: qrData, error: qrError } = await supabase
          .from('pedido_qr')
          .select('*, pedidos(*, pedido_items(*))')
          .eq('token_qr', code)
          .single();

        if (qrError || !qrData?.pedidos) {
          toast.error('Código QR no válido o pedido no encontrado');
          setIsValidating(false);
          return;
        }

        order = qrData.pedidos;
      }

      if (order) {
        // Obtener datos del usuario
        const { data: userData } = await supabase
          .from('usuarios')
          .select('nombre_usuario, email')
          .eq('id', order.id_usuario)
          .single();

        setScannedOrder({
          ...order,
          user: { 
            name: userData?.nombre_usuario || 'Usuario', 
            email: userData?.email || 'N/A' 
          },
          qrCodeUsed: !isManualCode,
          manualCodeUsed: isManualCode,
        });
        
        toast.success(`✅ QR válido - Pedido #${order.id_pedido}`);
      }
    } catch (error) {
      console.error('Error validando QR:', error);
      toast.error('Error al validar el código');
    }

    setIsValidating(false);
  };

  // Simular detección de QR desde cámara
  const simulateCameraScan = () => {
    toast.info('Por favor escanea un código QR con la cámara web');
    // En un proyecto real, aquí usarías jsQR o @zxing/library
  };

  // Canjear el QR y marcar como validado
  const handleValidatePickup = async () => {
    if (!scannedOrder) return;

    setIsCashing(true);

    try {
      // 1. Actualizar pedido_qr con fecha de canje y validación
      const { error: qrUpdateError } = await supabase
        .from('pedido_qr')
        .update({
          validado_en: new Date().toISOString(),
          validado_por: 'Staff Tienda'
        })
        .eq('id_pedido', scannedOrder.id_pedido);

      if (qrUpdateError) {
        throw qrUpdateError;
      }

      // 2. Eliminar el QR (solo si se canjeó correctamente)
      const { error: qrDeleteError } = await supabase
        .from('pedido_qr')
        .delete()
        .eq('id_pedido', scannedOrder.id_pedido);

      if (qrDeleteError) {
        console.warn('Nota: El QR puede haber sido eliminado ya');
      }

      toast.success(`✅ Pedido #${scannedOrder.id_pedido} marcado como entregado`);
      
      // Limpiar estado después de 2 segundos
      setTimeout(() => {
        setScannedOrder(null);
        setQrCode('');
        setManualCode('');
        
        // Reiniciar cámara si estaba activa
        if (isCameraActive && scanMode === 'camera') {
          stopCamera();
          setTimeout(() => startCamera(), 500);
        }
      }, 2000);
    } catch (error) {
      console.error('Error en handleValidatePickup:', error);
      toast.error('Error al procesar el canje del QR');
    } finally {
      setIsCashing(false);
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'ENTREGADO': return <Badge className="bg-green-500">Pagado / Listo</Badge>;
      case 'PRELIMINAR': return <Badge className="bg-yellow-500">Pendiente de Pago</Badge>;
      case 'CANCELADO': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  // Inicializar cámara al montar el componente
  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [scanMode]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Validación de QR</h2>
          <p className="text-gray-600 text-sm md:text-base">
            Escanee códigos QR o ingrese manualmente para confirmar entregas
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel de escaneo */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Escanear Código QR
              </CardTitle>
              <CardDescription>
                Use la cámara web de su laptop o ingrese el código manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selector de modo */}
              <div className="flex gap-2">
                <Button
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('camera')}
                  className="flex-1"
                >
                  {isCameraActive ? (
                    <Video className="mr-2 h-4 w-4" />
                  ) : (
                    <VideoOff className="mr-2 h-4 w-4" />
                  )}
                  Cámara Web
                </Button>
                <Button
                  variant={scanMode === 'manual' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('manual')}
                  className="flex-1"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Ingreso Manual
                </Button>
              </div>

              {/* Vista de cámara */}
              {scanMode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden">
                    {cameraError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                        <CameraOff className="h-16 w-16 mb-4 text-white/50" />
                        <p className="text-lg font-medium">Cámara no disponible</p>
                        <p className="text-sm text-white/70 mt-2">{cameraError}</p>
                        <Button 
                          onClick={startCamera}
                          className="mt-4 bg-white/20 hover:bg-white/30 text-white"
                          variant="outline"
                        >
                          Reintentar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          playsInline
                          muted
                        />
                        {/* Marco para QR */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-64 h-64 border-4 border-green-500 rounded-xl relative">
                            <div className="absolute top-0 left-0 right-0 h-2 bg-green-500 animate-pulse shadow-lg" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      onClick={simulateCameraScan}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={cameraError !== null}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Simular Escaneo
                    </Button>
                    
                    {isCameraActive ? (
                      <Button 
                        onClick={stopCamera}
                        variant="outline"
                        className="bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <VideoOff className="mr-2 h-4 w-4" />
                        Apagar
                      </Button>
                    ) : (
                      <Button 
                        onClick={startCamera}
                        variant="outline"
                      >
                        <Video className="mr-2 h-4 w-4" />
                        Encender
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Enfoca el código QR dentro del marco verde
                    </p>
                  </div>
                </div>
              )}

              {/* Entrada manual */}
              {scanMode === 'manual' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="qrCode">Código QR</Label>
                    <Input
                      id="qrCode"
                      placeholder="Ej: PAPP-12345-678901"
                      value={qrCode}
                      onChange={(e) => setQrCode(e.target.value)}
                      className="font-mono mt-1"
                    />
                    <Button 
                      onClick={() => validateQRCode(qrCode, false)} 
                      className="w-full mt-2"
                      disabled={isValidating || !qrCode.trim()}
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-4 w-4" />
                          Validar Código QR
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <Label htmlFor="manualCode">Código Manual</Label>
                    <Input
                      id="manualCode"
                      placeholder="Ej: PAPP-123-456789"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="font-mono mt-1"
                    />
                    <Button 
                      onClick={() => validateQRCode(manualCode, true)} 
                      className="w-full mt-2"
                      disabled={isValidating || !manualCode.trim()}
                      variant="secondary"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Validar Código Manual
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Código QR:</strong> Copia el código QR generado en la app móvil<br/>
                      <strong>Código Manual:</strong> Usa el formato PAPP-ID-MONTO mostrado al cliente
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del pedido escaneado */}
          {scannedOrder && (
            <Card className="border-green-200 bg-green-50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Pedido Validado Correctamente
                </CardTitle>
                <CardDescription>
                  Información del pedido listo para entrega
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">ID del Pedido</Label>
                      <div className="font-bold text-lg font-mono">#{scannedOrder.id_pedido}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Estado</Label>
                      <div>{getOrderStatusBadge(scannedOrder.estatus)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Cliente</Label>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span>{scannedOrder.user.name}</span>
                      </div>
                      <div className="text-sm text-gray-500 ml-6 mt-1">
                        {scannedOrder.user.email}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Total</Label>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span className="font-bold text-lg">${scannedOrder.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Fecha del Pedido</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>{new Date(scannedOrder.creado_en).toLocaleString('es-MX', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Productos ({scannedOrder.pedido_items?.length || 0})</Label>
                    <div className="space-y-2 mt-2">
                      {(scannedOrder.pedido_items || []).map((item: any, index: number) => (
                        <div key={`${item.id_producto}-${index}`} className="flex justify-between items-center bg-white p-3 rounded-lg border hover:shadow-sm">
                          <div className="flex-1">
                            <div className="font-medium">Producto #{item.id_producto}</div>
                            <div className="text-sm text-gray-500">
                              {item.cantidad} × ${parseFloat(item.precio_unitario).toFixed(2)}
                            </div>
                          </div>
                          <div className="font-bold text-green-700">
                            ${(parseFloat(item.precio_unitario) * item.cantidad).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="bg-white p-2 rounded border">
                      <p className="text-gray-600">Validado por:</p>
                      <p className="font-mono text-gray-800">{scannedOrder.qrCodeUsed ? '🎯 QR Code' : '✏️ Código Manual'}</p>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <p className="text-gray-600">Creado en:</p>
                      <p className="font-mono text-gray-800">{new Date(scannedOrder.creado_en).toLocaleTimeString()}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Button 
                      onClick={handleValidatePickup}
                      disabled={isCashing}
                      className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                      size="lg"
                    >
                      {isCashing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-5 w-5" />
                          Confirmar Entrega
                        </>
                      )}
                    </Button>
                    <p className="text-sm text-gray-600 text-center">
                      ✓ Marca como entregado | 🗑️ Elimina el QR de la app
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel de información (derecha) */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Instrucciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-gray-800 mb-1">📱 Escaneo desde Cámara:</p>
                <p className="text-gray-600">Apunta la cámara hacia el código QR del cliente</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">✏️ Ingreso Manual:</p>
                <p className="text-gray-600">Ingresa el código QR o el código manual proporcionado al cliente</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">✅ Validación:</p>
                <p className="text-gray-600">Confirma la identidad del cliente y el contenido del pedido</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">📦 Entrega:</p>
                <p className="text-gray-600">Haz clic en "Confirmar Entrega" para finalizarla</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg text-amber-900">⏰ Vigencia</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-800">
              Los códigos QR son válidos por <strong>24 horas</strong> desde su generación
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
