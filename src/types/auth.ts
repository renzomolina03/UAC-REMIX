export type RolUsuario = 
  | 'SUPERVISOR'
  | 'SECRETARIO'
  | 'NOTIFICACION_CITACION'
  | 'SUPER_ADMIN' 
  | 'COORDINADOR' 
  | 'ALGUACIL' 
  | 'AUDITOR';

export interface RolInfo {
  codigo: RolUsuario;
  nombre: string;
  descripcion: string;
  badgeBg: string;
  colorTexto: string;
  permisos: string[];
}

export const ROLES_CONFIG: Record<RolUsuario, RolInfo> = {
  SUPERVISOR: {
    codigo: 'SUPERVISOR',
    nombre: 'Supervisor de la Unidad',
    descripcion: 'Se encarga de ver todo lo que hacen ambos roles (Notificación y Citación y Secretaría). Puede alternar o auditar ambas dependencias.',
    badgeBg: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    colorTexto: 'text-indigo-400',
    permisos: ['todo', 'supervision_total', 'ver_todas_dependencias', 'cambiar_dependencia', 'gestion_usuarios', 'configuracion', 'auditoria_total']
  },
  SECRETARIO: {
    codigo: 'SECRETARIO',
    nombre: 'Secretario (a)',
    descripcion: 'Trabaja con el sistema de despacho judicial registrando N° de Oficio junto con boletas y causas.',
    badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    colorTexto: 'text-emerald-400',
    permisos: ['secretaria', 'crear_boletas', 'editar_boletas', 'oficios', 'enrutamiento', 'acuses', 'exportar_reportes']
  },
  NOTIFICACION_CITACION: {
    codigo: 'NOTIFICACION_CITACION',
    nombre: 'Notificación y Citación',
    descripcion: 'Trabaja con el sistema actual de control de boletas judiciales, causas, fechas de audiencia, alertas y acuses.',
    badgeBg: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
    colorTexto: 'text-blue-400',
    permisos: ['notificacion_citacion', 'crear_boletas', 'editar_boletas', 'enrutamiento', 'asignar_alguaciles', 'generar_acuses', 'exportar_reportes']
  },
  SUPER_ADMIN: {
    codigo: 'SUPER_ADMIN',
    nombre: 'Super Administrador / Director',
    descripcion: 'Control integral de alguacilazgo, gestión de usuarios, auditoría forense, configuración y respaldos.',
    badgeBg: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    colorTexto: 'text-rose-400',
    permisos: ['todo', 'gestion_usuarios', 'desbloqueo_cuentas', 'configuracion', 'eliminar_boletas', 'auditoria_total']
  },
  COORDINADOR: {
    codigo: 'COORDINADOR',
    nombre: 'Coordinador / Distribuidor Judicial',
    descripcion: 'Distribución de causas, enrutamiento por sectores, asignación a alguaciles y generación de acuses.',
    badgeBg: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
    colorTexto: 'text-blue-400',
    permisos: ['crear_boletas', 'editar_boletas', 'enrutamiento', 'asignar_alguaciles', 'generar_acuses', 'exportar_reportes']
  },
  ALGUACIL: {
    codigo: 'ALGUACIL',
    nombre: 'Alguacil Notificador de Calle',
    descripcion: 'Consulta de rutas asignadas, registro de resultados de citación (Art. 165-171 COPP) y acuses de entrega.',
    badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    colorTexto: 'text-emerald-400',
    permisos: ['ver_rutas', 'actualizar_resultado', 'ver_boletas', 'firmar_acuses']
  },
  AUDITOR: {
    codigo: 'AUDITOR',
    nombre: 'Auditor Judicial / Inspectoría',
    descripcion: 'Inspección de tiempos procesales, cumplimiento de lapsos, estadísticas y auditoría del despacho.',
    badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-500/40',
    colorTexto: 'text-purple-400',
    permisos: ['ver_boletas', 'ver_estadisticas', 'consultar_auditoria', 'exportar_reportes']
  }
};

export interface UsuarioJudicial {
  id: string;
  username: string;
  nombreCompleto: string;
  cedula: string;
  cargo: string;
  rol: RolUsuario;
  email?: string;
  telefono?: string;
  passwordHash: string;
  salt: string;
  pinRapidoHash?: string; // Hash del PIN de 6 dígitos para desbloqueo rápido de pantalla
  activo: boolean;
  intentosFallidos: number;
  bloqueadoHasta: string | null; // ISO timestamp
  ultimoAcceso: string | null;
  fechaCreacion: string;
  requiereCambioClave?: boolean;
}

export interface SesionActiva {
  token: string;
  usuarioId: string;
  username: string;
  nombreCompleto: string;
  cargo: string;
  rol: RolUsuario;
  iniciadaEn: string;
  expiraEn: string;
  recordarme: boolean;
  bloqueada: boolean;
  bloqueadaEn?: string;
}

export type TipoAccionAuditoria = 
  | 'LOGIN_EXITOSO'
  | 'LOGIN_FALLIDO'
  | 'LOGOUT'
  | 'BLOQUEO_CUENTA'
  | 'DESBLOQUEO_ADMIN'
  | 'DESBLOQUEO_PIN'
  | 'BLOQUEO_SESION'
  | 'CAMBIO_CLAVE'
  | 'RESTAURAR_RESPALDO'
  | 'PURGA_DATOS';

export interface RegistroAuditoria {
  id: string;
  timestamp: string;
  usuarioId?: string;
  username: string;
  accion: TipoAccionAuditoria;
  nivel: 'INFO' | 'WARNING' | 'CRITICAL';
  detalles: string;
  ip: string;
  dispositivo: string;
}

export interface RequisitosPassword {
  longitudMinima: boolean;
  tieneMayuscula: boolean;
  tieneMinuscula: boolean;
  tieneNumero: boolean;
  tieneEspecial: boolean;
}
