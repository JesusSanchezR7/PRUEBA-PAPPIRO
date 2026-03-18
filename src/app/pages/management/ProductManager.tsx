import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Plus, Search, Edit, Trash2, Package,
  Upload, Image as ImageIcon, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabase';

interface ProductFormData {
  name: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  educationLevels: string[];
  featured: boolean;
  tags: string[];
}

export function ProductManager() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    category: 'escritura',
    price: '',
    stock: '',
    description: '',
    educationLevels: [],
    featured: false,
    tags: [],
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('Cargando productos desde BD...');

      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .eq('estatus', 'activo')
        .order('id_producto', { ascending: false });

      if (error) throw error;

      const enrichedProducts = await Promise.all(
        (data || []).map(async (product) => {
          const categoryName = await getCategoryNameFromIdAsync(product.id_categoria);
          return {
            ...product,
            categoria_nombre: categoryName,
            imagenes_url: product.imagenes_url || [],
            destacado: product.destacado || false,
          };
        })
      );

      setProducts(enrichedProducts);
    } catch (error) {
      console.error('Error al cargar:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryNameFromId = (id: number): string => {
    const categoryMap: Record<number, string> = {
      1: 'escritura',
      2: 'papeleria',
      3: 'arte',
      4: 'matematicas',
      5: 'organizacion',
      6: 'computo',
      7: 'ciencias',
    };
    return categoryMap[id] || 'escritura';
  };

  const getCategoryNameFromIdAsync = async (id: number): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('nombre')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.warn(`Categoria ID ${id} no encontrada`);
        return getCategoryNameFromId(id);
      }

      const nameToSlug: Record<string, string> = {
        'Escritura': 'escritura',
        'Papelería': 'papeleria',
        'Arte': 'arte',
        'Matemáticas': 'matematicas',
        'Organización': 'organizacion',
        'Cómputo': 'computo',
        'Ciencias': 'ciencias',
      };

      const slug = nameToSlug[data.nombre] || data.nombre.toLowerCase();
      return slug;
    } catch (error) {
      console.error('Error obteniendo nombre de categoria:', error);
      return getCategoryNameFromId(id);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.nombre_producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.descripcion && product.descripcion.toLowerCase().includes(searchTerm.toLowerCase()));
    const categoryName = product.categoria_nombre || getCategoryNameFromId(product.id_categoria);
    const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      escritura: 'bg-blue-100 text-blue-800',
      papeleria: 'bg-red-100 text-red-800',
      arte: 'bg-yellow-100 text-yellow-800',
      matematicas: 'bg-green-100 text-green-800',
      organizacion: 'bg-indigo-100 text-indigo-800',
      computo: 'bg-purple-100 text-purple-800',
      ciencias: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getStockIndicatorColor = (stock: number) => {
    if (stock === 0) return 'bg-red-500';
    if (stock < 5) return 'bg-red-400';
    if (stock < 20) return 'bg-orange-400';
    return 'bg-green-500';
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Agotado</Badge>;
    if (stock < 5) return <Badge className="bg-red-500">Critico</Badge>;
    if (stock < 20) return <Badge className="bg-orange-500">Bajo Stock</Badge>;
    return <Badge className="bg-green-500">Disponible</Badge>;
  };

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (files.length + imageFiles.length > 3) {
      toast.error('Maximo 3 imagenes permitidas');
      return;
    }

    const validTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
    const invalidFiles = files.filter(file => !validTypes.has(file.type));
    if (invalidFiles.length > 0) {
      toast.error('Solo se permiten imagenes JPG, PNG o WebP');
      return;
    }

    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Las imagenes no deben superar los 5MB');
      return;
    }

    try {
      const previews = await Promise.all(files.map(fileToDataUrl));
      setImageFiles(prev => [...prev, ...files]);
      setImagePreviews(prev => [...prev, ...previews]);
    } catch {
      toast.error('Error al procesar imagenes');
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const getCategoryId = async (categoryName: string): Promise<number> => {
    const categoryMap: Record<string, string> = {
      'escritura': 'Escritura',
      'papeleria': 'Papeleria',
      'arte': 'Arte',
      'matematicas': 'Matematicas',
      'organizacion': 'Organizacion',
      'computo': 'Computo',
      'ciencias': 'Ciencias',
    };

    const displayName = categoryMap[categoryName] || categoryName;

    try {
      const { data } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', displayName)
        .single();

      if (data) {
        console.log(`Categoria encontrada: ${displayName} (ID: ${data.id})`);
        return data.id;
      }

      console.log(`Creando categoria: ${displayName}`);
      const { data: newCategory, error: insertError } = await supabase
        .from('categorias')
        .insert([{ nombre: displayName }])
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Categoria creada: ${displayName} (ID: ${newCategory.id})`);
      return newCategory.id;
    } catch (error) {
      console.error('Error en getCategoryId:', error);
      return 1;
    }
  };

  const uploadMultipleImages = async (files: File[], productId: number): Promise<string[]> => {
    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `producto-${productId}-${i + 1}.${fileExtension}`;

        console.log(`Subiendo archivo: ${fileName}`);

        const { error } = await supabase.storage
          .from('Imagenes')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('Imagenes')
          .getPublicUrl(fileName);

        urls.push(publicUrlData.publicUrl);
      } catch (error) {
        console.error(`Error subiendo imagen ${i + 1}:`, error);
        throw error;
      }
    }

    return urls;
  };

  const deleteOldProductImages = async (productId: number) => {
    try {
      const { data: files } = await supabase.storage
        .from('Imagenes')
        .list();

      const productFiles = files?.filter(file =>
        file.name.startsWith(`producto-${productId}-`)
      ) || [];

      if (productFiles.length > 0) {
        await supabase.storage
          .from('Imagenes')
          .remove(productFiles.map(f => f.name));
      }
    } catch (error) {
      console.warn('Error eliminando imagenes:', error);
    }
  };

  const handleCreateProduct = async () => {
    if (!formData.name || !formData.price || !formData.stock) {
      toast.error('Nombre, precio y stock son obligatorios');
      return;
    }

    const price = Number.parseFloat(formData.price);
    const stock = Number.parseInt(formData.stock, 10);

    if (Number.isNaN(price) || price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }

    if (Number.isNaN(stock) || stock < 0) {
      toast.error('El stock no puede ser negativo');
      return;
    }

    const exists = products.some(p => p.nombre_producto.toLowerCase() === formData.name.toLowerCase());
    if (exists) {
      toast.error('Ya existe un producto con ese nombre');
      return;
    }

    try {
      setUploading(true);

      const categoryId = await getCategoryId(formData.category);

      const productData = {
        nombre_producto: formData.name.trim(),
        id_categoria: categoryId,
        precio_unidad: Number.parseFloat(price.toFixed(2)),
        stock_actual: stock,
        stock_minimo: 5,
        stock_maximo: 100,
        descripcion: formData.description.trim(),
        estatus: 'activo',
        niveles_educativos: formData.educationLevels.length > 0 ? formData.educationLevels : null,
        destacado: formData.featured,
        imagenes_url: [],
        imagen_url: null,
        tags: formData.tags.length > 0 ? formData.tags : null,
      };

      const { data: newProduct, error: createError } = await supabase
        .from('productos')
        .insert([productData])
        .select()
        .single();

      if (createError) throw createError;

      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        imageUrls = await uploadMultipleImages(imageFiles, newProduct.id_producto);
      }

      const updateData: any = {
        imagenes_url: imageUrls
      };

      if (imageUrls.length > 0) {
        updateData.imagen_url = imageUrls[0];
      }

      const { error: updateError } = await supabase
        .from('productos')
        .update(updateData)
        .eq('id_producto', newProduct.id_producto);

      if (updateError) throw updateError;

      toast.success(`Producto creado con ${imageUrls.length} imagenes`);
      await loadProducts();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error completo:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditProduct = async (product: any) => {
    console.log('Editando producto:', product);
    setEditingProduct(product);
    const categoryName = await getCategoryNameFromIdAsync(product.id_categoria);

    setFormData({
      name: product.nombre_producto,
      category: categoryName,
      price: product.precio_unidad.toString(),
      stock: product.stock_actual.toString(),
      description: product.descripcion || '',
      educationLevels: product.niveles_educativos || [],
      featured: product.destacado || false,
      tags: product.tags || [],
    });

    setCurrentTag('');

    if (product.imagenes_url && product.imagenes_url.length > 0) {
      setImagePreviews(product.imagenes_url);
      setImageFiles([]);
    } else if (product.imagen_url) {
      setImagePreviews([product.imagen_url]);
      setImageFiles([]);
    } else {
      setImagePreviews([]);
      setImageFiles([]);
    }

    setIsDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    const price = Number.parseFloat(formData.price);
    const stock = Number.parseInt(formData.stock, 10);

    if (Number.isNaN(price) || price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }

    if (Number.isNaN(stock) || stock < 0) {
      toast.error('El stock no puede ser negativo');
      return;
    }

    try {
      setUploading(true);

      let imageUrls: string[] = editingProduct.imagenes_url || [];

      if (imageFiles.length > 0) {
        await deleteOldProductImages(editingProduct.id_producto);
        imageUrls = await uploadMultipleImages(imageFiles, editingProduct.id_producto);
      }

      const categoryId = await getCategoryId(formData.category);

      const updateData = {
        nombre_producto: formData.name.trim(),
        id_categoria: categoryId,
        precio_unidad: Number.parseFloat(price.toFixed(2)),
        stock_actual: stock,
        descripcion: formData.description.trim(),
        destacado: formData.featured,
        imagenes_url: imageUrls,
        imagen_url: imageUrls.length > 0 ? imageUrls[0] : null,
        niveles_educativos: formData.educationLevels,
        tags: formData.tags.length > 0 ? formData.tags : null,
      };

      const { error } = await supabase
        .from('productos')
        .update(updateData)
        .eq('id_producto', editingProduct.id_producto);

      if (error) throw error;

      toast.success('Producto actualizado');
      await loadProducts();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error completo:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      console.log(`Eliminando producto ID: ${productId}`);

      try {
        await supabase.from('carrito_items').delete().eq('id_producto', productId);
      } catch (e) {
        console.warn('Error eliminando carrito_items:', e);
      }

      try {
        await supabase.from('pedido_items').delete().eq('id_producto', productId);
      } catch (e) {
        console.warn('Error eliminando pedido_items:', e);
      }

      await deleteOldProductImages(productId);

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id_producto', productId);

      if (error) throw error;

      toast.success('Producto eliminado correctamente');
      await loadProducts();
    } catch (error) {
      console.error('Error eliminando producto:', error);
      toast.error(`Error al eliminar: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const toggleEducationLevel = (level: string) => {
    setFormData(prev => ({
      ...prev,
      educationLevels: prev.educationLevels.includes(level)
        ? prev.educationLevels.filter(l => l !== level)
        : [...prev.educationLevels, level]
    }));
  };

  const addTag = () => {
    const trimmedTag = currentTag.trim();
    if (!trimmedTag) return;

    // Si contiene puntos, dividir en múltiples características
    if (trimmedTag.includes('.')) {
      const newTags = trimmedTag
        .split('.')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0 && !formData.tags.includes(tag));
      
      if (newTags.length > 0) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, ...newTags]
        }));
        setCurrentTag('');
      }
    } else if (!formData.tags.includes(trimmedTag)) {
      // Agregar como una sola característica
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmedTag]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag.trim() !== tagToRemove.trim())
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'escritura',
      price: '',
      stock: '',
      description: '',
      educationLevels: [],
      featured: false,
      tags: [],
    });
    setImageFiles([]);
    setImagePreviews([]);
    setEditingProduct(null);
    setCurrentTag('');
  };

  const getEducationLevelLabel = (level: string) => {
    if (level === 'kinder') return 'Kinder';
    if (level === 'maestro') return 'Maestro';
    return level;
  };

  const renderProductImagesCell = (product: any) => {
    const productImages = product.imagenes_url || [];

    if (productImages.length > 0) {
      return (
        <div className="flex gap-1">
          {productImages.slice(0, 3).map((img: string) => (
            <div key={img} className="h-12 w-12 rounded-md overflow-hidden border bg-gray-100">
              <img
                src={img}
                alt={product.nombre_producto}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      );
    }

    if (product.imagen_url) {
      return (
        <div className="h-12 w-12 rounded-md overflow-hidden border bg-gray-100">
          <img src={product.imagen_url} alt={product.nombre_producto} className="h-full w-full object-cover" />
        </div>
      );
    }

    return (
      <div className="h-12 w-12 rounded-md border bg-gray-100 flex items-center justify-center">
        <ImageIcon className="h-6 w-6 text-gray-400" />
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Gestion de Productos</h2>
          <p className="text-gray-600 text-sm md:text-base">
            Administra el catalogo de productos escolares
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Producto' : 'Crear Producto'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? 'Modifique la informacion del producto'
                  : 'Registre un nuevo producto escolar'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-4">
                <Label>Imagenes del Producto (maximo 3)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="flex-1">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors min-h-[200px]">
                      {imagePreviews.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {imagePreviews.map((preview, index) => (
                            <div key={preview} className="relative">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                onClick={() => removeImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <div className="text-xs text-gray-500 mt-1 text-center">
                                {index === 0 ? 'Principal' : `Imagen ${index + 1}`}
                              </div>
                            </div>
                          ))}
                          {[1, 2, 3].slice(imagePreviews.length).map((slot) => (
                            <div key={`empty-${slot}`} className="border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center h-32">
                              <ImageIcon className="h-8 w-8 text-gray-400" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8">
                          <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">Suba hasta 3 imagenes del producto</p>
                          <p className="text-sm text-gray-500 mb-4">
                            JPG, PNG o WebP • Max. 5MB cada una
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 md:pt-2">
                    <Input
                      id="images"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                      multiple
                    />
                    <Label
                      htmlFor="images"
                      className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors text-center"
                    >
                      <Upload className="h-5 w-5" />
                      {imagePreviews.length > 0 ? 'Agregar mas imagenes' : 'Seleccionar imagenes'}
                    </Label>
                    <p className="text-sm text-gray-500">
                      {imagePreviews.length}/3 imagenes seleccionadas
                    </p>
                    <p className="text-xs text-gray-400">
                      La primera imagen sera la principal
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Producto*</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Cuaderno Profesional 100 hojas"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria*</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="escritura">Escritura</SelectItem>
                      <SelectItem value="papeleria">Papeleria</SelectItem>
                      <SelectItem value="arte">Arte</SelectItem>
                      <SelectItem value="matematicas">Matematicas</SelectItem>
                      <SelectItem value="organizacion">Organizacion</SelectItem>
                      <SelectItem value="computo">Computo</SelectItem>
                      <SelectItem value="ciencias">Ciencias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio Unitario*</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock*</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripcion (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descripcion detallada del producto..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Características del Producto */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <Label>Características del Producto</Label>
                <p className="text-xs text-gray-500">
                  Agrega características que se mostrarán en la app móvil. Puedes escribir una por una o pegar varias separadas por puntos (.)
                </p>
                <p className="text-xs text-blue-600 font-medium">
                  💡 Ejemplo: Unidades por envase: 12. Tipo de crayón: jumbo. Hecho en cera
                </p>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Ej: Material premium o pega varias separadas por punto"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                  />
                  <Button
                    type="button"
                    onClick={addTag}
                    disabled={!currentTag.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1 px-3 py-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeTag(tag);
                          }}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {formData.tags.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    No hay características agregadas. Los productos sin características mostrarán valores por defecto en la app.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <Label>Niveles Educativos</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(['kinder', 'primaria', 'secundaria', 'preparatoria', 'universidad', 'maestro'] as const).map((level) => (
                      <div key={level} className="flex items-center gap-2 min-h-7">
                        <Checkbox
                          id={`level-${level}`}
                          checked={formData.educationLevels.includes(level)}
                          onCheckedChange={() => toggleEducationLevel(level)}
                        />
                        <Label
                          htmlFor={`level-${level}`}
                          className="text-sm font-normal cursor-pointer capitalize leading-none whitespace-nowrap"
                        >
                          {getEducationLevelLabel(level)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <Label>Destacado</Label>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, featured: checked === true })
                      }
                    />
                    <Label
                      htmlFor="featured"
                      className="text-sm font-normal cursor-pointer leading-5"
                    >
                      Marcar como producto destacado
                    </Label>
                  </div>
                  <p className="text-xs text-gray-500 leading-5">
                    Los productos destacados aparecen en la seccion especial
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="w-full sm:w-auto" onClick={editingProduct ? handleUpdateProduct : handleCreateProduct} disabled={uploading}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar productos por nombre o descripcion..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Categorias</SelectItem>
            <SelectItem value="escritura">Escritura</SelectItem>
            <SelectItem value="papeleria">Papeleria</SelectItem>
            <SelectItem value="arte">Arte</SelectItem>
            <SelectItem value="matematicas">Matematicas</SelectItem>
            <SelectItem value="organizacion">Organizacion</SelectItem>
            <SelectItem value="computo">Computo</SelectItem>
            <SelectItem value="ciencias">Ciencias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Productos</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <Package className="h-4 w-4 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.filter(p => p.estatus === 'activo').length}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Destacados</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <Package className="h-4 w-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.destacado && p.estatus === 'activo').length}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Stock Critico</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <Package className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.stock_actual < 5 && p.estatus === 'activo').length}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bajo Stock</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <Package className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.stock_actual >= 5 && p.stock_actual < 20 && p.estatus === 'activo').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos Registrados</CardTitle>
          <CardDescription>
            Catalogo completo de productos escolares con imagenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {filteredProducts.map((product) => (
                  <div key={product.id_producto} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium truncate">{product.nombre_producto}</p>
                        <p className="text-xs text-gray-500">ID: {product.id_producto}</p>
                      </div>
                      {product.destacado ? (
                        <Badge className="bg-yellow-500 shrink-0">Destacado</Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">-</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      {renderProductImagesCell(product)}
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Precio</p>
                        <p className="font-bold text-base">${Number.parseFloat(product.precio_unidad).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Badge className={getCategoryColor(product.categoria_nombre || getCategoryNameFromId(product.id_categoria))}>
                        {product.categoria_nombre || getCategoryNameFromId(product.id_categoria)}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStockIndicatorColor(product.stock_actual)}`} />
                        <span className="text-sm font-medium">{product.stock_actual}</span>
                        <span className="text-xs text-gray-500">unid.</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {product.estatus === 'activo' ? (
                        <Badge className="bg-blue-500 text-white">Activo</Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                      {getStockStatus(product.stock_actual)}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(product.id_producto)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-4 text-left font-medium">Imagenes</th>
                        <th className="p-4 text-left font-medium">Producto</th>
                        <th className="p-4 text-left font-medium">Destacado</th>
                        <th className="p-4 text-left font-medium">Categoria</th>
                        <th className="p-4 text-left font-medium">Precio</th>
                        <th className="p-4 text-left font-medium">Stock</th>
                        <th className="p-4 text-left font-medium">Estado</th>
                        <th className="p-4 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => {
                        return (
                          <tr key={product.id_producto} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              {renderProductImagesCell(product)}
                            </td>
                            <td className="p-4">
                              <div className="font-medium">{product.nombre_producto}</div>
                              <div className="text-xs text-gray-500">ID: {product.id_producto}</div>
                            </td>
                            <td className="p-4">
                              {product.destacado ? (
                                <Badge className="bg-yellow-500">Destacado</Badge>
                              ) : (
                                <Badge variant="outline">-</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge className={getCategoryColor(product.categoria_nombre || getCategoryNameFromId(product.id_categoria))}>
                                {product.categoria_nombre || getCategoryNameFromId(product.id_categoria)}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-lg">${Number.parseFloat(product.precio_unidad).toFixed(2)}</div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${getStockIndicatorColor(product.stock_actual)}`} />
                                <span className="font-medium">{product.stock_actual}</span>
                              </div>
                              {getStockStatus(product.stock_actual)}
                            </td>
                            <td className="p-4">
                              {product.estatus === 'activo' ? (
                                <Badge className="bg-blue-500 text-white">Activo</Badge>
                              ) : (
                                <Badge variant="outline">Inactivo</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditProduct(product)}>
                                  <Edit className="h-3 w-3 mr-1" />
                                  Editar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(product.id_producto)}>
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Eliminar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!loading && filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">No se encontraron productos activos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
