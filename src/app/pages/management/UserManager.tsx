import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Search, GraduationCap, User, BookOpen, Eye, Loader2 } from 'lucide-react';
import { User as UserType } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { userService } from '../../services/userService';
import { debugSupabase } from '../../services/debugService';

export function UserManager() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [educationFilter, setEducationFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // Cargar usuarios desde Supabase
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setIsLoading(true);
        console.log('📱 Iniciando carga de usuarios...');
        
        // Ejecutar prueba de conexión
        console.log('🔍 Ejecutando prueba de Supabase...');
        const testResult = await debugSupabase.testConnection();
        console.log('Resultado de prueba:', testResult);
        
        const fetchedUsers = await userService.getAllUsers();
        console.log('✅ Usuarios obtenidos:', fetchedUsers);
        console.log('Total:', fetchedUsers.length);
        
        setUsers(fetchedUsers);
        if (fetchedUsers.length === 0) {
          console.warn('⚠️ No hay usuarios en la respuesta');
        }
      } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        toast.error('Error al cargar los usuarios');
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, []);

  const getRoleBadge = (role: UserType['role']) => {
    const badges = {
      teacher: <Badge className="bg-blue-500">Profesor</Badge>,
      student: <Badge className="bg-green-500">Estudiante</Badge>,
    };
    return badges[role];
  };

  const getEducationLevelBadge = (level: UserType['educationLevel']) => {
    const levels = {
      primaria: 'Primaria',
      secundaria: 'Secundaria',
      preparatoria: 'Preparatoria',
      universidad: 'Universidad',
    };
    return <Badge variant="outline">{levels[level]}</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesEducation = educationFilter === 'all' || user.educationLevel === educationFilter;
    return matchesSearch && matchesRole && matchesEducation;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };



  const handleViewProfile = (user: UserType) => {
    setSelectedUser(user);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Consulta de Usuarios Móviles</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Visualización de estudiantes y profesores registrados en la app
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Roles</SelectItem>
            <SelectItem value="student">Estudiantes</SelectItem>
            <SelectItem value="teacher">Profesores</SelectItem>
          </SelectContent>
        </Select>
        <Select value={educationFilter} onValueChange={setEducationFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Nivel Educativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Niveles</SelectItem>
            <SelectItem value="primaria">Primaria</SelectItem>
            <SelectItem value="secundaria">Secundaria</SelectItem>
            <SelectItem value="preparatoria">Preparatoria</SelectItem>
            <SelectItem value="universidad">Universidad</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estadísticas rápidas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2 text-muted-foreground">Cargando usuarios...</p>
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Usuarios</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Estudiantes</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <BookOpen className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'student').length}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Profesores</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <GraduationCap className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'teacher').length}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gray-50 shadow-md transition-shadow duration-300 after:absolute after:left-0 after:top-0 after:bottom-4 after:w-1 after:rounded-r-full after:bg-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Activos</CardTitle>
            <div className="p-2 rounded-full border-2 border-blue-500 bg-blue-50">
              <User className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.status === 'active').length}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Lista de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados en App Móvil</CardTitle>
          <CardDescription>
            Lista de estudiantes y profesores 
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
             <thead>
  <tr className="border-b bg-muted/50">
    <th className="p-4 text-left font-medium">Usuario</th>
    <th className="p-4 text-left font-medium">Correo</th>
    <th className="p-4 text-left font-medium">Rol</th>
    <th className="p-4 text-left font-medium">Nivel Educativo</th>
    <th className="p-4 text-left font-medium">Registro</th>
    <th className="p-4 text-left font-medium">Acción</th>
  </tr>
</thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                          </div>
                        </div>
                      </td>
                     <td className="p-4">
                     <div className="text-sm">{user.email}</div>
                     </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4">{getEducationLevelBadge(user.educationLevel)}</td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(user.createdAt).toLocaleDateString('es-MX')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Estado: {user.status === 'active' ? 'Activo' : 'Suspendido'}
                        </div>
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewProfile(user)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No se encontraron usuarios</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ajuste los filtros de búsqueda
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md w-full mx-4">
          <DialogHeader>
            <DialogTitle>Perfil de Usuario</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback>
                    {selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <span className="text-sm font-medium">Rol</span>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div>
                  <span className="text-sm font-medium">Nivel Educativo</span>
                  <div className="mt-1">{getEducationLevelBadge(selectedUser.educationLevel)}</div>
                </div>
                <div>
                  <span className="text-sm font-medium">Estado</span>
                  <div className="mt-1">
                    <Badge variant={selectedUser.status === 'active' ? 'default' : 'secondary'}>
                      {selectedUser.status === 'active' ? 'Activo' : 'Suspendido'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">Fecha de Registro</span>
                <div className="mt-1 text-sm">
                  {new Date(selectedUser.createdAt).toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}