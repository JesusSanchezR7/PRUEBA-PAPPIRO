import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { 
  QrCode, Camera, CheckCircle, Search,
  Package, User, Calendar, AlertCircle,
  Video, VideoOff, CameraOff, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@supabase/supabase-js';
import { qrExpirationService } from '../../services/qrExpirationService';

// Inicializar cliente Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Datos de ejemplo
const mockOrders = [
  {
    id: 'ORD-001',
    qrCode: 'PAPPIRO-ORD001-2024-ABC123',
    user: { name: 'Juan Pérez', email: 'juan@estudiante.com' },
    status: 'ready',
    total: 245.5,
    createdAt: new Date(),
    items: [
      { product: { name: 'Cuaderno Profesional', price: 85 }, quantity: 2 },
      { product: { name: 'Lápices Técnicos', price: 25.5 }, quantity: 3 }
    ]
  },
  {
    id: 'ORD-002',
    qrCode: 'PAPPIRO-ORD002-2024-DEF456',
    user: { name: 'María García', email: 'maria@profesor.com' },
    status: 'ready',
    total: 189.75,
    createdAt: new Date(),
    items: [
      { product: { name: 'Calculadora Científica', price: 150 }, quantity: 1 },
      { product: { name: 'Borradores', price: 13.25 }, quantity: 3 }
    ]
  }
];

export function QRValidator() {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [qrCode, setQrCode] = useState('');
  const [scannedOrder, setScannedOrder] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanAnimationRef = useRef<number | null>(null);
  const jsQRModuleRef = useRef<any>(null);
  const isScanningRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<any[]>([]);

  // Inicializar cámara
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Prioriza cámara trasera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
        // Intentar cargar jsQR dinámicamente para detección en vivo
        try {
          if (!jsQRModuleRef.current) {
            const mod = await import('jsqr');
            jsQRModuleRef.current = mod.default || mod;
          }
          // Iniciar loop de escaneo
          isScanningRef.current = true;
          scanLoop();
        } catch (e) {
          // si no está instalado, mantén la simulación disponible
          console.warn('jsQR no disponible, use simulateCameraScan para pruebas locales', e);
        }
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
    // detener loop de escaneo
    if (scanAnimationRef.current) {
      cancelAnimationFrame(scanAnimationRef.current);
      scanAnimationRef.current = null;
    }
    isScanningRef.current = false;
    setIsCameraActive(false);
  };

  const scanLoop = () => {
    const run = async () => {
      if (!isScanningRef.current) return;
      if (!videoRef.current) {
        scanAnimationRef.current = requestAnimationFrame(run);
        return;
      }

      const video = videoRef.current as HTMLVideoElement;
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width === 0 || height === 0) {
        scanAnimationRef.current = requestAnimationFrame(run);
        return;
      }

      if (!canvasRef.current) {
        const c = document.createElement('canvas');
        canvasRef.current = c;
      }

      const canvas = canvasRef.current as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        scanAnimationRef.current = requestAnimationFrame(run);
        return;
      }

      // Dibujar video en canvas de trabajo
      canvas.width = width;
      canvas.height = height;
      try {
        ctx.drawImage(video, 0, 0, width, height);
      } catch (e) {
        // En algunos navegadores drawImage puede fallar momentáneamente
        scanAnimationRef.current = requestAnimationFrame(run);
        return;
      }

      const jsQR = jsQRModuleRef.current;
      if (!jsQR) {
        scanAnimationRef.current = requestAnimationFrame(run);
        return;
      }

      // Intentos con diferentes escalas y preprocesamiento para mejorar detección
      const scaleCandidates = [1, 0.75, 0.5];
      let found: any = null;
      for (let s = 0; s < scaleCandidates.length && !found; s++) {
        const scale = scaleCandidates[s];

        const sw = Math.max(100, Math.floor(width * scale));
        const sh = Math.max(100, Math.floor(height * scale));

        // Usar canvas temporal para escalado y procesamiento
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tctx = tempCanvas.getContext('2d');
        if (!tctx) continue;

        // Center-crop para enfocarnos en el área probable del QR
        const cropW = Math.floor(width * 0.6);
        const cropH = Math.floor(height * 0.6);
        const sx = Math.max(0, Math.floor((width - cropW) / 2));
        const sy = Math.max(0, Math.floor((height - cropH) / 2));

        tctx.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, sw, sh);

        // Obtener imageData y aplicar un ajuste ligero de contraste/grises
        let imageData = tctx.getImageData(0, 0, sw, sh);
        const data = imageData.data;
        // ligero aumento de contraste y conversión a escala de grises
        const contrast = 1.2; // ajustar si es necesario
        for (let i = 0; i < data.length; i += 4) {
          // luminancia
          const r = data[i], g = data[i + 1], b = data[i + 2];
          let l = (0.299 * r + 0.587 * g + 0.114 * b);
          // aplicar contraste
          l = ((l - 128) * contrast) + 128;
          const v = Math.max(0, Math.min(255, Math.round(l)));
          data[i] = data[i + 1] = data[i + 2] = v;
        }
        tctx.putImageData(imageData, 0, 0);

        try {
          // intentar decodificar en esta escala
          const code = jsQR(imageData.data, sw, sh, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            found = code;
            break;
          }
        } catch (e) {
          console.debug('jsQR error en escala', scale, e);
        }

        // Intentar rotación 90° (algunos QR vienen rotados)
        try {
          const rotCanvas = document.createElement('canvas');
          rotCanvas.width = sh;
          rotCanvas.height = sw;
          const rctx = rotCanvas.getContext('2d');
          if (rctx) {
            rctx.translate(sh / 2, sw / 2);
            rctx.rotate((90 * Math.PI) / 180);
            rctx.drawImage(tempCanvas, -sw / 2, -sh / 2, sw, sh);
            const rotData = rctx.getImageData(0, 0, sh, sw);
            try {
              const codeR = jsQR(rotData.data, sh, sw, { inversionAttempts: 'attemptBoth' });
              if (codeR && codeR.data) {
                found = codeR;
                break;
              }
            } catch (re) {
              console.debug('jsQR rot error', re);
            }
          }
        } catch (e) {
          // ignore rotate errors
        }
      }

      if (found && found.data) {
        // detected QR
        isScanningRef.current = false;
        setQrCode(found.data);
        validateQRCode(found.data);
        return;
      }

      // no detectado: continuar
      scanAnimationRef.current = requestAnimationFrame(run);
    };

    scanAnimationRef.current = requestAnimationFrame(run);
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

  // Simular escaneo de QR (si `jsqr` no está instalado o pruebas locales)
  const handleScan = () => {
    if (!qrCode.trim()) {
      toast.error('Ingrese un código QR');
      return;
    }

    // Si el código manual empieza con PAPP- lo tratamos como manual
    if (/^PAPP-/i.test(qrCode.trim())) {
      validateQRCode(qrCode.trim(), true);
    } else {
      validateQRCode(qrCode.trim(), false);
    }
  };

  // Función para simular detección de QR desde cámara
  const simulateCameraScan = () => {
    // En un proyecto real, aquí integrarías jsQR o @zxing/library
    // Para este ejemplo, simularé un escaneo exitoso
    const simulatedQR = 'PAPPIRO-ORD001-2024-ABC123';
    setQrCode(simulatedQR);
    validateQRCode(simulatedQR);
    toast.info('QR detectado desde cámara (simulación)');
  };
  const validateQRCode = async (code: string, isManual: boolean = false) => {
    if (!code || !code.trim()) {
      toast.error('Código vacío');
      return;
    }

    setIsValidating(true);
    try {
      let order: any = null;

      if (isManual) {
        // formato esperado: PAPP-<id>-<amount> (consistente con la app)
        const parts = code.split('-');
        if (parts.length < 3 || !/^PAPP/.test(parts[0])) {
          toast.error('Formato de código manual inválido. Esperado: PAPP-{idPedido}-{monto}');
          setIsValidating(false);
          return;
        }

        const pedidoId = parseInt(parts[1], 10);
        if (Number.isNaN(pedidoId)) {
          toast.error('ID de pedido inválido en código manual');
          setIsValidating(false);
          return;
        }

        // Checar si el QR ha expirado
        const expirationInfo = await qrExpirationService.getQRExpirationInfo(pedidoId);
        if (expirationInfo?.isExpired) {
          toast.error(`❌ Código QR expirado. Tiempo máximo: 24 horas. Este QR fue generado hace ${Math.floor(24 - expirationInfo.timeRemainingHours)} horas.`);
          setIsValidating(false);
          return;
        }

        const { data: pedidoData, error: pedidoErr } = await supabase
          .from('pedidos')
          .select('*, pedido_items(*, productos(id_producto, nombre_producto, precio_unidad, imagen_url, stock_actual, descripcion))')
          .eq('id_pedido', pedidoId)
          .single();

        if (pedidoErr || !pedidoData) {
          console.error('Error buscando pedido manual', pedidoErr);
          toast.error('Código manual no encontrado');
          setIsValidating(false);
          return;
        }

        // ✅ VALIDACIÓN NUEVA: Chequear si el pedido está cancelado
        if (pedidoData.estatus === 'cancelado' || pedidoData.status === 'cancelled') {
          toast.error(`❌ No se puede validar este código. El pedido #${pedidoId} ha sido cancelado.`);
          setIsValidating(false);
          return;
        }

        // Verificar si el QR asociado ya fue validado
        const { data: qrCheck } = await supabase
          .from('pedido_qr')
          .select('validado_en')
          .eq('id_pedido', pedidoId)
          .single();

        if (qrCheck?.validado_en) {
          const validatedDate = new Date(qrCheck.validado_en).toLocaleString('es-MX');
          toast.error(`🚫 Este código ya fue validado el ${validatedDate}. No se puede usar nuevamente.`);
          setIsValidating(false);
          return;
        }

        order = pedidoData;
      } else {
        // buscar token en tabla pedido_qr y traer pedido relacionado
        // Primero chequear expiración
        const qrValidation = await qrExpirationService.validateQRExists(code);
        if (!qrValidation.valid) {
          if (qrValidation.expired) {
            toast.error('❌ Código QR expirado. El código fue generado hace más de 24 horas y ya no es válido.');
          } else {
            toast.error('Código QR no encontrado o ya fue utilizado');
          }
          setIsValidating(false);
          return;
        }

        const { data: qrData, error: qrErr } = await supabase
          .from('pedido_qr')
          .select('*, pedidos(*, pedido_items(*, productos(id_producto, nombre_producto, precio_unidad)))')
          .eq('token_qr', code)
          .single();

        if (qrErr || !qrData || !qrData.pedidos) {
          console.error('Error buscando token QR', qrErr);
          toast.error('Código QR no encontrado');
          setIsValidating(false);
          return;
        }

        // ✅ VALIDACIÓN NUEVA: Chequear si el pedido está cancelado
        if (qrData.pedidos.estatus === 'cancelado' || qrData.pedidos.status === 'cancelled') {
          toast.error(`❌ No se puede validar este código. El pedido #${qrData.pedidos.id_pedido} ha sido cancelado.`);
          setIsValidating(false);
          return;
        }

        // Verificar si el QR ya fue validado previamente
        if (qrData.validado_en) {
          const validatedDate = new Date(qrData.validado_en).toLocaleString('es-MX');
          toast.error(`🚫 Este código QR ya fue validado el ${validatedDate}. No se puede usar nuevamente.`);
          setIsValidating(false);
          return;
        }

        order = qrData.pedidos;
      }

      if (order) {
        // obtener datos de usuario si existe referencia
        let user = { name: 'Cliente', email: 'N/A' };
        try {
          if (order.id_usuario) {
            const { data: userData } = await supabase
              .from('usuarios')
              .select('nombre, email')
              .eq('id', order.id_usuario)
              .single();
            if (userData) user = { name: userData.nombre || user.name, email: userData.email || user.email };
          }
        } catch (e) {
          console.warn('No se pudo obtener usuario:', e);
        }

        // normalizar estructura para UI (espera campos como en mockOrders)
        const normalized = {
          id: order.id_pedido || order.id || 'N/A',
          status: order.status || 'ready',
          total: order.total || 0,
          createdAt: order.created_at || order.createdAt || new Date().toISOString(),
          items: (order.pedido_items || order.items || []).map((it: any) => ({
            product: { 
              name: it.productos?.nombre_producto || it.nombre_producto || `Producto #${it.id_producto}`,
              price: parseFloat(it.productos?.precio_unidad || it.precio_unidad || it.precio_unitario || it.price || 0) 
            },
            quantity: it.cantidad || it.quantity || 1
          })),
          user
        };

        setScannedOrder(normalized);
        // 🔄 AUTO-SCROLL hacia abajo para mostrar la tarjeta verde de validación
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
        toast.success(`QR válido - Pedido #${normalized.id}`);
      }
    } catch (error) {
      console.error('validateQRCode error', error);
      toast.error('Error al validar código');
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidatePickup = () => {
    if (!scannedOrder) return;

    toast.success(`Pedido ${scannedOrder.id} marcado como entregado`);
    setScannedOrder(null);
    setQrCode('');
    
    // Detener cámara después de entrega
    if (isCameraActive && scanMode === 'camera') {
      stopCamera();
      setTimeout(() => startCamera(), 500); // Reiniciar para siguiente escaneo
    }
    
    // actualizar estado en DB: marcar como entregado
    (async () => {
      try {
        const pedidoId = parseInt(scannedOrder.id) || scannedOrder.id;
        const tokenQr = scannedOrder.qrCode;
        
        // Verificación adicional: revisar si ya fue validado (doble capa de seguridad)
        const { data: qrCheckBeforeUpdate } = await supabase
          .from('pedido_qr')
          .select('validado_en')
          .eq('id_pedido', pedidoId)
          .single();

        if (qrCheckBeforeUpdate?.validado_en) {
          const validatedDate = new Date(qrCheckBeforeUpdate.validado_en).toLocaleString('es-MX');
          toast.error(`🚫 Este pedido ya fue entregado el ${validatedDate}. No se puede validar nuevamente.`);
          setScannedOrder(null);
          setQrCode('');
          return;
        }
        
        // Obtener usuario actual (quien valida)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let validadoPor: any = null;
        
        // Obtener el ID del usuario admin en la BD
        if (authUser?.id) {
          const { data: userData } = await supabase
            .from('usuarios')
            .select('id')
            .eq('id_auth', authUser.id)
            .single();
          
          if (userData?.id) validadoPor = userData.id;
        }
        
        // 1. Actualizar registro en pedido_qr con auditoría de validación
        const timestamp = new Date().toISOString();
        
        // Primero intentar encontrar si ya existe un registro para este pedido
        const { data: existingQR } = await supabase
          .from('pedido_qr')
          .select('id')
          .eq('id_pedido', pedidoId)
          .single();

        if (existingQR) {
          // Si existe, actualizar el registro
          const { error: updateError } = await supabase
            .from('pedido_qr')
            .update({
              token_qr: tokenQr,
              validado_en: timestamp,
              validado_por: validadoPor
            })
            .eq('id_pedido', pedidoId);

          if (updateError) {
            console.error('❌ Error actualizando validación:', updateError);
            toast.error('Error al guardar validación');
            return;
          }
        } else {
          // Si no existe, crear uno nuevo
          const { error: insertError } = await supabase
            .from('pedido_qr')
            .insert({
              id_pedido: pedidoId,
              token_qr: tokenQr,
              generado_en: new Date().toISOString(),
              validado_en: timestamp,
              validado_por: validadoPor
            });

          if (insertError) {
            console.error('❌ Error creando validación:', insertError);
            toast.error('Error al guardar validación');
            return;
          }
        }

        console.log(`✅ Pedido ${pedidoId} validado - Guardado en BD:`, { validado_en: timestamp, validado_por: validadoPor });
        
        // 1.5. Actualizar estado del pedido a 'entregado'
        const { error: statusError } = await supabase
          .from('pedidos')
          .update({ estatus: 'entregado' })
          .eq('id_pedido', pedidoId);
        
        if (statusError) {
          console.error('❌ Error actualizando estado a completado:', statusError);
          toast.error('Error al marcar como entregado');
          return;
        }
        
        console.log(`✅ Pedido ${pedidoId} estado actualizado a completado`);

        // 2. Crear recibo asociado al pedido para que el usuario pueda verlo
        try {
          const reciboPayload = {
            id_pedido: pedidoId,
            validado_en: timestamp,
            validado_por: validadoPor,
            total: scannedOrder.total,
            items: scannedOrder.items,
            usuario: scannedOrder.user,
          };

          const { data: reciboData, error: reciboErr } = await supabase
            .from('recibos')
            .insert([{ id_pedido: pedidoId, contenido: JSON.stringify(reciboPayload), creado_en: timestamp }])
            .select()
            .single();

          if (reciboErr) {
            console.error('❌ Error creando recibo en Dashboard:', reciboErr);
            toast.error('No se pudo crear el recibo (ver consola)');
          } else {
            console.log('✅ Recibo creado:', reciboData);
            toast.success('Recibo generado correctamente');
          }
        } catch (e) {
          console.error('Error creando recibo tras validación en Dashboard:', e);
        }

        // refresh orders list
        fetchOrders();
      } catch (e) {
        console.error('Error marcando pedido como entregado', e);
        toast.error('Error al marcar pedido como entregado');
      }
    })();
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pendiente': return <Badge className="bg-yellow-500">Pendiente</Badge>;
      case 'pagado': return <Badge className="bg-green-500">Pagado</Badge>;
      case 'entregado': return <Badge className="bg-gray-500">Ya Entregado</Badge>;
      case 'cancelado': return <Badge variant="destructive">Cancelado</Badge>;
      case 'ready': return <Badge className="bg-green-500">Listo para Recoger</Badge>;
      case 'processing': return <Badge className="bg-blue-500">Procesando</Badge>;
      case 'picked-up': return <Badge className="bg-gray-500">Ya Entregado</Badge>;
      default: return <Badge>Desconocido</Badge>;
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
  }, []);

  // Fetch orders from Supabase to populate side panel and stats
  const fetchOrders = async (showToast: boolean = false) => {
    try {
      console.log('🔄 INICIANDO FETCH DE ÓRDENES...');
      
      // Traer TODOS los pedidos sin filtro
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('*');

      console.log('✅ RESPUESTA DE PEDIDOS:', {
        count: pedidosData?.length || 0,
        error: pedidosError
      });

      if (!pedidosData || pedidosData.length === 0) {
        console.warn('⚠️ NO HAY PEDIDOS EN LA BD');
        if (showToast) {
          toast.error('No hay pedidos en la base de datos');
        }
        setOrders([]);
        return;
      }

      // Si hay pedidos, normalizarlos
      const normalized = pedidosData.map((o: any) => ({
        id: o.id_pedido || o.id || 'SIN_ID',
        status: o.estatus || o.status || 'desconocido',
        total: o.total || 0,
        createdAt: o.created_at || new Date().toISOString(),
        items: [],
        user: { name: 'Usuario', email: 'N/A' },
        validado_en: false
      }));

      console.log('📊 ÓRDENES NORMALIZADAS:', {
        total: normalized.length,
        por_entregar: normalized.filter((o: any) => o.status !== 'entregado').length,
        entregadas: normalized.filter((o: any) => o.status === 'entregado').length
      });

      setOrders(normalized);
    } catch (e) {
      console.error('❌ ERROR EN FETCH:', e);
      if (showToast) {
        toast.error('Error al cargar órdenes: ' + String(e));
      }
    }
  };

  // Fetch initial orders y establecer polling automático cada 5 segundos
  useEffect(() => {
    console.log('🔄 Iniciando carga de órdenes...');
    fetchOrders(true); // Mostrar toast solo en el fetch inicial
    
    // Recargar órdenes cada 5 segundos (sin mostrar toasts)
    const interval = setInterval(() => {
      console.log('🔄 Recargando órdenes automáticamente...');
      fetchOrders(false); // No mostrar toast en polling automático
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Validación de QR</h2>
          <p className="text-gray-600 text-sm md:text-base">
          Escanee códigos QR para confirmar entregas en tienda
        </p>
        </div>
      </div>

      <div ref={scrollContainerRef} className="grid gap-6 lg:grid-cols-3">
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
                  variant="default"
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
              </div>

              {/* Vista de cámara */}
              {scanMode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg overflow-hidden">
                    {cameraError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                        <CameraOff className="h-16 w-16 mb-4 text-white/50" />
                        <p className="text-lg font-medium">Cámara no disponible</p>
                        <p className="text-sm text-white/70 mt-2"></p>
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
                    {isCameraActive ? (
                      <Button 
                        onClick={stopCamera}
                        variant="outline"
                        className="bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <VideoOff className="mr-2 h-4 w-4" />
                        Apagar Cámara
                      </Button>
                    ) : (
                      <Button 
                        onClick={startCamera}
                        variant="outline"
                      >
                        <Video className="mr-2 h-4 w-4" />
                        Encender Cámara
                      </Button>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      O ingrese el código manualmente:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Código QR"
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        className="font-mono flex-1"
                      />
                      <Button onClick={handleScan} disabled={isValidating}>
                        Validar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <strong>Instrucciones:</strong> Enfoca el código QR del cliente dentro del marco verde.
                    </p>
                  </div>
                </div>
              )}

              {/* Entrada manual */}
              {scanMode === 'manual' && (
                <div className="space-y-3">
                  <Label htmlFor="qrCode">Código QR del Pedido</Label>
                  <Input
                    id="qrCode"
                    placeholder="Ej: PAPPIRO-ORD001-2024-ABC123"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    className="font-mono"
                  />
                  <Button 
                    onClick={handleScan} 
                    className="w-full"
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Validar Código
                      </>
                    )}
                  </Button>
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
                      <div className="font-bold text-lg font-mono">{scannedOrder.id}</div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Estado</Label>
                      <div>{getOrderStatusBadge(scannedOrder.status)}</div>
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
                        <span className="font-bold text-lg">${scannedOrder.total}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Fecha del Pedido</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>{new Date(scannedOrder.createdAt).toLocaleString('es-MX', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Productos</Label>
                    <div className="space-y-2 mt-2">
                      {scannedOrder.items.map((item: any, index: number) => (
                        <div key={`${item.product.name}-${index}`} className="flex justify-between items-center bg-white p-3 rounded-lg border hover:shadow-sm">
                          <div className="flex-1">
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-sm text-gray-500">{item.quantity} × ${item.product.price}</div>
                          </div>
                          <div className="font-bold text-green-700">${item.product.price * item.quantity}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleValidatePickup}
                      className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
                      size="lg"
                    >
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Confirmar Entrega y Marcar como Entregado
                    </Button>
                    <p className="text-sm text-gray-500 text-center mt-2">
                      Esta acción marcará el pedido como entregado en el sistema
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel de información lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas del Día</CardTitle>
              <CardDescription>Resumen de entregas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Entregas Realizadas:</span>
                  <span className="font-bold text-green-600">
                    {orders.filter(o => o.validado_en || o.status === 'entregado').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Por Entregar:</span>
                  <span className="font-bold text-blue-600">
                    {orders.filter(o => !o.validado_en && o.status !== 'entregado' && o.status !== 'cancelado').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
