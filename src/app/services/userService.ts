import { supabase } from '../../lib/supabase';
import { MobileUser } from '../types';
import { logger } from '../utils/logger';

export const userService = {
  // Obtener todos los usuarios de la app móvil
  async getAllUsers(): Promise<MobileUser[]> {
    try {
      logger.log('🔍 userService.getAllUsers() - Iniciando query...');
      
      const { data, error, status } = await supabase
        .from('usuarios')
        .select('*')
        .order('creado_en', { ascending: false });

      logger.log('Response status:', status);

      if (error) {
        logger.error('❌ Error de Supabase:', error);
        return[];
      }

      if (!data) {
        logger.warn('⚠️ Data es null');
        return [];
      }

      logger.log(`📊 Total registros recibidos: ${data.length}`);

      if (data.length === 0) {
        logger.warn('⚠️ No hay registros en la tabla usuarios');
        return [];
      }

      // Mapear datos de Supabase al tipo MobileUser
      const mappedUsers: MobileUser[] = (data || []).map((user: any) => {
        // Mapear rol: puede ser "alumno", "student", "profesor", "teacher"
        let mappedRole: 'student' | 'teacher' = 'student';
        if (user.rol) {
          const rolLower = user.rol.toLowerCase().trim();
          if (rolLower === 'profesor' || rolLower === 'teacher') {
            mappedRole = 'teacher';
          } else {
            mappedRole = 'student';
          }
        }

        // Mapear estatus: puede ser "Activo", "activo", "Suspended", "suspended"
        let mappedStatus: 'active' | 'suspended' = 'active';
        if (user.estatus) {
          const statusLower = user.estatus.toLowerCase().trim();
          mappedStatus = statusLower.includes('suspendido') || statusLower.includes('suspended') ? 'suspended' : 'active';
        }

        // Mapear nivel educativo: validar que sea uno de los valores permitidos
        let mappedEducationLevel: 'primaria' | 'secundaria' | 'preparatoria' | 'universidad' = 'primaria';
        if (user.nivel_educativo) {
          const eduLower = user.nivel_educativo.toLowerCase().trim();
          if (eduLower === 'primaria') {
            mappedEducationLevel = 'primaria';
          } else if (eduLower === 'secundaria') {
            mappedEducationLevel = 'secundaria';
          } else if (eduLower === 'preparatoria') {
            mappedEducationLevel = 'preparatoria';
          } else if (eduLower === 'universidad') {
            mappedEducationLevel = 'universidad';
          }
        }

        return {
          id: user.id?.toString() || '',
          name: user.nombre || '',
          email: user.email || '',
          role: mappedRole,
          educationLevel: mappedEducationLevel,
          phone: user.telefono,
          createdAt: user.creado_en || new Date().toISOString(),
          status: mappedStatus,
        };
      });

      logger.log('✅ Usuarios mapeados correctamente:', mappedUsers.length);
      return mappedUsers;
    } catch (error) {
      logger.error('❌ Excepción en getAllUsers:', error);
      return [];
    }
  },

  // Obtener usuario por ID
  async getUserById(id: string): Promise<MobileUser | null> {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Error obteniendo usuario:', error);
        return null;
      }

      // Mapear rol
      let mappedRole: 'student' | 'teacher' = 'student';
      if (data.rol) {
        const rolLower = data.rol.toLowerCase().trim();
        if (rolLower === 'profesor' || rolLower === 'teacher') {
          mappedRole = 'teacher';
        } else {
          mappedRole = 'student';
        }
      }

      // Mapear estatus
      let mappedStatus: 'active' | 'suspended' = 'active';
      if (data.estatus) {
        const statusLower = data.estatus.toLowerCase().trim();
        mappedStatus = statusLower.includes('suspendido') || statusLower.includes('suspended') ? 'suspended' : 'active';
      }

      const mappedUser: MobileUser = {
        id: data.id?.toString() || '',
        name: data.nombre || '',
        email: data.email || '',
        role: mappedRole,
        educationLevel: (data.nivel_educativo || 'primaria') as 'primaria' | 'secundaria' | 'preparatoria' | 'universidad',
        phone: data.telefono,
        createdAt: data.creado_en || new Date().toISOString(),
        status: mappedStatus,
      };

      return mappedUser;
    } catch (error) {
      console.error('Error en getUserById:', error);
      return null;
    }
  },

  // Obtener usuarios por rol
  async getUsersByRole(rol: 'student' | 'teacher'): Promise<MobileUser[]> {
    try {
      // La app móvil puede usar "alumno" o "profesor", así que buscamos ambos
      const rolValues = rol === 'teacher' ? ['profesor', 'teacher'] : ['alumno', 'student'];
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .in('rol', rolValues)
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error obteniendo usuarios por rol:', error);
        return [];
      }

      const mappedUsers: MobileUser[] = (data || []).map((user: any) => {
        // Mapear rol
        let mappedRole: 'student' | 'teacher' = 'student';
        if (user.rol) {
          const rolLower = user.rol.toLowerCase().trim();
          if (rolLower === 'profesor' || rolLower === 'teacher') {
            mappedRole = 'teacher';
          } else {
            mappedRole = 'student';
          }
        }

        // Mapear estatus
        let mappedStatus: 'active' | 'suspended' = 'active';
        if (user.estatus) {
          const statusLower = user.estatus.toLowerCase().trim();
          mappedStatus = statusLower.includes('suspendido') || statusLower.includes('suspended') ? 'suspended' : 'active';
        }

        return {
          id: user.id?.toString() || '',
          name: user.nombre || '',
          email: user.email || '',
          role: mappedRole,
          educationLevel: (user.nivel_educativo || 'primaria') as 'primaria' | 'secundaria' | 'preparatoria' | 'universidad',
          phone: user.telefono,
          createdAt: user.creado_en || new Date().toISOString(),
          status: mappedStatus,
        };
      });

      return mappedUsers;
    } catch (error) {
      console.error('Error en getUsersByRole:', error);
      return [];
    }
  },

  // Obtener usuarios por nivel educativo
  async getUsersByEducationLevel(
    level: 'primaria' | 'secundaria' | 'preparatoria' | 'universidad'
  ): Promise<MobileUser[]> {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('nivel_educativo', level)
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error obteniendo usuarios por nivel educativo:', error);
        return [];
      }

      const mappedUsers: MobileUser[] = (data || []).map((user: any) => {
        // Mapear rol
        let mappedRole: 'student' | 'teacher' = 'student';
        if (user.rol) {
          const rolLower = user.rol.toLowerCase().trim();
          if (rolLower === 'profesor' || rolLower === 'teacher') {
            mappedRole = 'teacher';
          } else {
            mappedRole = 'student';
          }
        }

        // Mapear estatus
        let mappedStatus: 'active' | 'suspended' = 'active';
        if (user.estatus) {
          const statusLower = user.estatus.toLowerCase().trim();
          mappedStatus = statusLower.includes('suspendido') || statusLower.includes('suspended') ? 'suspended' : 'active';
        }

        return {
          id: user.id?.toString() || '',
          name: user.nombre || '',
          email: user.email || '',
          role: mappedRole,
          educationLevel: level,
          phone: user.telefono,
          createdAt: user.creado_en || new Date().toISOString(),
          status: mappedStatus,
        };
      });

      return mappedUsers;
    } catch (error) {
      console.error('Error en getUsersByEducationLevel:', error);
      return [];
    }
  },
};
