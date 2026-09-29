import { 
  UsuarioJudicial, 
  SesionActiva, 
  RegistroAuditoria, 
  RequisitosPassword,
  RolUsuario 
} from '../types/auth';
import { guardarEnIndexedDB, leerDeIndexedDB } from './persistentStorage';

export const STORAGE_KEY_AUTH_USERS = 'tsj_usuarios_judiciales_v1';
export const STORAGE_KEY_AUTH_SESSION = 'tsj_sesion_activa_v1';
export const STORAGE_KEY_AUTH_AUDIT = 'tsj_bitacora_auditoria_v1';
export const STORAGE_KEY_ATTEMPTS = 'tsj_intentos_seguridad_v1';

// Clave Maestra Oficial de Respaldo para emergencias y soporte judicial
export const CLAVE_MAESTRA_EMERGENCIA = 'TSJ-VIGIA-MASTER-2026';

// ----------------------------------------------------
// 1. Criptografía SHA-256 Nativa con Web Crypto API
// ----------------------------------------------------
const PEPPER_SECRETO = 'TSJ_EL_VIGIA_PENAL_SECURE_2026_salt_hash_#';

export async function hashStringSHA256(texto: string, salt: string = ''): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${texto}::${PEPPER_SECRETO}`);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const buffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Error en crypto.subtle, usando algoritmo fallback:', e);
    }
  }
  // Fallback determinista en JS si Web Crypto no está presente
  return fallbackSHA256(`${salt}::${texto}::${PEPPER_SECRETO}`);
}

function fallbackSHA256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let i = 0;
  for (i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (let kIndex = 0; kIndex < 64; kIndex++) {
      let w15 = w[kIndex - 2], w2 = w[kIndex - 15];
      if (kIndex >= 16) {
        const s0 = rightRotate(w2, 7) ^ rightRotate(w2, 18) ^ (w2 >>> 3);
        const s1 = rightRotate(w15, 17) ^ rightRotate(w15, 19) ^ (w15 >>> 10);
        w[kIndex] = (w[kIndex - 16] + s0 + w[kIndex - 7] + s1) | 0;
      }
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const temp1 = hash[7] + s1 + ch + k[kIndex] + w[kIndex];
      const temp2 = s0 + maj;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let kIndex = 0; kIndex < 8; kIndex++) {
      hash[kIndex] = (hash[kIndex] + oldHash[kIndex]) | 0;
    }
  }

  for (let kIndex = 0; kIndex < 8; kIndex++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[kIndex] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function generarSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ----------------------------------------------------
// 2. Usuarios Iniciales del Poder Judicial
// ----------------------------------------------------
export interface CuentaDemoInfo {
  username: string;
  clavePlana: string;
  pinPlano: string;
  nombreCompleto: string;
  cargo: string;
  rol: RolUsuario;
  cedula: string;
  icono: string;
  descripcion: string;
}

export const CUENTAS_DEMO: CuentaDemoInfo[] = [
  {
    username: 'supervisor',
    clavePlana: 'Supervisor@2026!',
    pinPlano: '123456',
    nombreCompleto: 'Abg. Roberto Morales',
    cargo: 'Supervisor General de la Unidad',
    rol: 'SUPERVISOR',
    cedula: 'V-14.892.401',
    icono: 'ShieldAlert',
    descripcion: 'Supervisor de la unidad: Se encarga de ver todo lo que hacen ambos roles (Notificación y Citación y Secretaría).'
  },
  {
    username: 'secretario',
    clavePlana: 'Secretario@2026!',
    pinPlano: '123456',
    nombreCompleto: 'Dra. Elena Ramos',
    cargo: 'Secretaria de Despacho Judicial',
    rol: 'SECRETARIO',
    cedula: 'V-17.654.321',
    icono: 'FileSpreadsheet',
    descripcion: 'Secretario (a): Trabaja con el sistema de despacho judicial agregando N° de Oficio junto con la boleta y causa.'
  },
  {
    username: 'notificador',
    clavePlana: 'Notificacion@2026!',
    pinPlano: '123456',
    nombreCompleto: 'Lic. Wilmer Sánchez',
    cargo: 'Responsable de Notificación y Citación',
    rol: 'NOTIFICACION_CITACION',
    cedula: 'V-18.234.567',
    icono: 'MapPin',
    descripcion: 'Notificación y Citación: Trabaja con el sistema actual de control de boletas, citaciones y diligencias de alguacilazgo.'
  },
  {
    username: 'admin',
    clavePlana: 'Alguacilazgo@2026!',
    pinPlano: '123456',
    nombreCompleto: 'Abg. Roberto Morales',
    cargo: 'Supervisor General de la Unidad',
    rol: 'SUPERVISOR',
    cedula: 'V-14.892.401',
    icono: 'ShieldAlert',
    descripcion: 'Acceso de contingencia para Supervisor de la Unidad.'
  },
  {
    username: 'secretaria',
    clavePlana: 'Secretaria@2026!',
    pinPlano: '123456',
    nombreCompleto: 'Dra. Elena Ramos',
    cargo: 'Secretaria de Despacho Judicial',
    rol: 'SECRETARIO',
    cedula: 'V-17.654.321',
    icono: 'FileSpreadsheet',
    descripcion: 'Acceso alternativo de Secretaría de Despacho (N° de Oficio).'
  }
];

// Generar usuarios iniciales con sus hashes
export async function crearUsuariosIniciales(): Promise<UsuarioJudicial[]> {
  const usuarios: UsuarioJudicial[] = [];
  for (const c of CUENTAS_DEMO) {
    const salt = generarSalt();
    const passwordHash = await hashStringSHA256(c.clavePlana, salt);
    const pinRapidoHash = await hashStringSHA256(c.pinPlano, salt);

    usuarios.push({
      id: `usr_${c.username}`,
      username: c.username,
      nombreCompleto: c.nombreCompleto,
      cedula: c.cedula,
      cargo: c.cargo,
      rol: c.rol,
      email: `${c.username}@tsj.gob.ve`,
      telefono: '0275-8812345',
      passwordHash,
      salt,
      pinRapidoHash,
      activo: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoAcceso: null,
      fechaCreacion: new Date().toISOString(),
      requiereCambioClave: false
    });
  }
  return usuarios;
}

// ----------------------------------------------------
// 3. Inicialización y Gestión de Usuarios en Storage
// ----------------------------------------------------
export async function obtenerUsuariosRegistrados(): Promise<UsuarioJudicial[]> {
  try {
    let existing: UsuarioJudicial[] | null = null;
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_USERS);
    if (raw) {
      const parsed = JSON.parse(raw) as UsuarioJudicial[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        existing = parsed;
      }
    }
    if (!existing) {
      const fromIdb = await leerDeIndexedDB<UsuarioJudicial[]>(STORAGE_KEY_AUTH_USERS);
      if (fromIdb && Array.isArray(fromIdb) && fromIdb.length > 0) {
        existing = fromIdb;
      }
    }

    const nuevosOficiales = await crearUsuariosIniciales();

    if (existing && existing.length > 0) {
      // Verificar si ya tiene los 3 roles nuevos
      const usernames = existing.map(u => u.username.toLowerCase());
      let faltan = false;
      for (const reqUser of ['supervisor', 'secretario', 'notificador']) {
        if (!usernames.includes(reqUser)) {
          faltan = true;
          const found = nuevosOficiales.find(n => n.username.toLowerCase() === reqUser);
          if (found) existing.push(found);
        }
      }
      if (faltan) {
        guardarUsuariosRegistrados(existing);
      }
      return existing;
    }
  } catch (e) {
    console.warn('Error leyendo usuarios de storage:', e);
  }

  // Generar los usuarios iniciales oficiales
  const nuevos = await crearUsuariosIniciales();
  guardarUsuariosRegistrados(nuevos);
  return nuevos;
}

export function guardarUsuariosRegistrados(usuarios: UsuarioJudicial[]): void {
  try {
    const str = JSON.stringify(usuarios);
    localStorage.setItem(STORAGE_KEY_AUTH_USERS, str);
    guardarEnIndexedDB(STORAGE_KEY_AUTH_USERS, usuarios).catch(() => {});
  } catch (e) {
    console.error('Error guardando usuarios:', e);
  }
}

// ----------------------------------------------------
// 4. Bitácora de Auditoría Forense y Eventos de Seguridad
// ----------------------------------------------------
export function registrarEventoAuditoria(
  accion: RegistroAuditoria['accion'],
  username: string,
  detalles: string,
  nivel: RegistroAuditoria['nivel'] = 'INFO',
  usuarioId?: string
): void {
  try {
    const logs = obtenerBitacoraAuditoria();
    const nuevoRegistro: RegistroAuditoria = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      usuarioId,
      username: username || 'SISTEMA',
      accion,
      nivel,
      detalles,
      ip: '127.0.0.1 (Estación Local)',
      dispositivo: typeof navigator !== 'undefined' ? `${navigator.userAgent.slice(0, 70)}...` : 'Terminal Judicial'
    };

    // Mantener los últimos 300 eventos
    const actualizados = [nuevoRegistro, ...logs].slice(0, 300);
    localStorage.setItem(STORAGE_KEY_AUTH_AUDIT, JSON.stringify(actualizados));
    guardarEnIndexedDB(STORAGE_KEY_AUTH_AUDIT, actualizados).catch(() => {});
  } catch (e) {
    console.warn('Error al registrar auditoría:', e);
  }
}

export function obtenerBitacoraAuditoria(): RegistroAuditoria[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_AUDIT);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Error cargando auditoría:', e);
  }
  return [];
}

// ----------------------------------------------------
// 5. Autenticación, Brute-Force Shield y Rate-Limiting
// ----------------------------------------------------
export interface ResultadoLogin {
  exito: boolean;
  sesion?: SesionActiva;
  mensaje: string;
  cuentaBloqueada?: boolean;
  minutosRestantes?: number;
  intentosRestantes?: number;
  requiereEsperaSegundos?: number;
}

const MAX_INTENTOS_FALLIDOS = 5;
const TIEMPO_BLOQUEO_MINUTOS = 15;

export async function autenticarUsuario(
  usernameInput: string,
  passwordInput: string,
  recordarme: boolean = false
): Promise<ResultadoLogin> {
  const cleanUsername = usernameInput.trim().toLowerCase();
  const usuarios = await obtenerUsuariosRegistrados();
  const usuario = usuarios.find(u => u.username.toLowerCase() === cleanUsername);

  if (!usuario) {
    // Registrar intento fallido genérico
    registrarEventoAuditoria(
      'LOGIN_FALLIDO',
      cleanUsername,
      'Intento de acceso con usuario inexistente',
      'WARNING'
    );
    return {
      exito: false,
      mensaje: 'Credenciales inválidas. Verifique su usuario y contraseña institucional.'
    };
  }

  if (!usuario.activo) {
    return {
      exito: false,
      mensaje: 'Esta cuenta judicial se encuentra inactiva. Contacte a la Dirección de Alguacilazgo.'
    };
  }

  // Verificar si la cuenta está actualmente bloqueada por fuerza bruta
  const ahora = new Date();
  if (usuario.bloqueadoHasta) {
    const finBloqueo = new Date(usuario.bloqueadoHasta);
    if (ahora < finBloqueo) {
      const msRestantes = finBloqueo.getTime() - ahora.getTime();
      const minutos = Math.ceil(msRestantes / (1000 * 60));
      registrarEventoAuditoria(
        'LOGIN_FALLIDO',
        usuario.username,
        `Intento de acceso a cuenta bloqueada. Restan ${minutos} minutos de restricción.`,
        'CRITICAL',
        usuario.id
      );
      return {
        exito: false,
        cuentaBloqueada: true,
        minutosRestantes: minutos,
        mensaje: `CUENTA BLOQUEADA POR SEGURIDAD. Ha superado los 5 intentos fallidos permitidos. Espere ${minutos} minuto(s) o use la Clave Maestra Judicial.`
      };
    } else {
      // El tiempo de bloqueo ya expiró: restablecer intentos
      usuario.bloqueadoHasta = null;
      usuario.intentosFallidos = 0;
    }
  }

  // Verificar hash de contraseña
  const hashIngresado = await hashStringSHA256(passwordInput, usuario.salt);
  const passwordValido = hashIngresado === usuario.passwordHash;

  if (!passwordValido) {
    usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
    const intentosRestantes = Math.max(0, MAX_INTENTOS_FALLIDOS - usuario.intentosFallidos);

    if (usuario.intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
      // Bloquear la cuenta
      const bloqueoHasta = new Date(ahora.getTime() + TIEMPO_BLOQUEO_MINUTOS * 60 * 1000);
      usuario.bloqueadoHasta = bloqueoHasta.toISOString();
      guardarUsuariosRegistrados(usuarios);

      registrarEventoAuditoria(
        'BLOQUEO_CUENTA',
        usuario.username,
        `Cuenta bloqueada preventivamente tras ${MAX_INTENTOS_FALLIDOS} intentos fallidos consecutivos.`,
        'CRITICAL',
        usuario.id
      );

      return {
        exito: false,
        cuentaBloqueada: true,
        minutosRestantes: TIEMPO_BLOQUEO_MINUTOS,
        mensaje: `Ha superado el límite de 5 intentos. Su cuenta ha sido bloqueada por 15 minutos para proteger el despacho.`
      };
    } else {
      guardarUsuariosRegistrados(usuarios);
      registrarEventoAuditoria(
        'LOGIN_FALLIDO',
        usuario.username,
        `Contraseña incorrecta. Intento ${usuario.intentosFallidos} de ${MAX_INTENTOS_FALLIDOS}.`,
        'WARNING',
        usuario.id
      );

      return {
        exito: false,
        intentosRestantes,
        mensaje: `Contraseña incorrecta. Le restan ${intentosRestantes} intento(s) antes del bloqueo preventivo.`
      };
    }
  }

  // Login Exitoso: Restablecer contadores
  usuario.intentosFallidos = 0;
  usuario.bloqueadoHasta = null;
  usuario.ultimoAcceso = ahora.toISOString();
  guardarUsuariosRegistrados(usuarios);

  // Generar Token de Sesión Criptográfica
  const token = `tsj_sess_${Date.now()}_${generarSalt()}`;
  const duracionHoras = recordarme ? 24 * 30 : 12; // 30 días si recuerda, o 12 horas jornada completa
  const expiraEn = new Date(ahora.getTime() + duracionHoras * 60 * 60 * 1000).toISOString();

  const sesion: SesionActiva = {
    token,
    usuarioId: usuario.id,
    username: usuario.username,
    nombreCompleto: usuario.nombreCompleto,
    cargo: usuario.cargo,
    rol: usuario.rol,
    iniciadaEn: ahora.toISOString(),
    expiraEn,
    recordarme,
    bloqueada: false
  };

  guardarSesionActiva(sesion);

  registrarEventoAuditoria(
    'LOGIN_EXITOSO',
    usuario.username,
    `Inicio de sesión exitoso como ${usuario.rol} (${usuario.nombreCompleto}).`,
    'INFO',
    usuario.id
  );

  return {
    exito: true,
    sesion,
    mensaje: `¡Bienvenido(a), ${usuario.nombreCompleto}!`
  };
}

// ----------------------------------------------------
// 6. Desbloqueo de Emergencia por Clave Maestra Judicial
// ----------------------------------------------------
export async function desbloquearCuentaConClaveMaestra(
  username: string,
  claveMaestra: string
): Promise<{ exito: boolean; mensaje: string }> {
  if (claveMaestra.trim() !== CLAVE_MAESTRA_EMERGENCIA) {
    registrarEventoAuditoria(
      'LOGIN_FALLIDO',
      username,
      'Fallo al intentar desbloqueo de emergencia con Clave Maestra incorrecta.',
      'CRITICAL'
    );
    return {
      exito: false,
      mensaje: 'Clave Maestra de Desbloqueo no coincide con la emitida por el Tribunal Supremo.'
    };
  }

  const usuarios = await obtenerUsuariosRegistrados();
  const usuario = usuarios.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!usuario) {
    return { exito: false, mensaje: 'Usuario no encontrado en los registros judiciales.' };
  }

  usuario.intentosFallidos = 0;
  usuario.bloqueadoHasta = null;
  guardarUsuariosRegistrados(usuarios);

  registrarEventoAuditoria(
    'DESBLOQUEO_ADMIN',
    usuario.username,
    `Cuenta desbloqueada exitosamente mediante Clave Maestra Judicial Oficial.`,
    'CRITICAL',
    usuario.id
  );

  return {
    exito: true,
    mensaje: `Cuenta "${usuario.username}" desbloqueada con éxito. Ya puede iniciar sesión.`
  };
}

// ----------------------------------------------------
// 7. Gestión de Sesión Activa
// ----------------------------------------------------
export function guardarSesionActiva(sesion: SesionActiva | null): void {
  try {
    if (!sesion) {
      localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
      sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
      return;
    }
    const serialized = JSON.stringify(sesion);
    localStorage.setItem(STORAGE_KEY_AUTH_SESSION, serialized);
    sessionStorage.setItem(STORAGE_KEY_AUTH_SESSION, serialized);
  } catch (e) {
    console.error('Error guardando sesión:', e);
  }
}

export function obtenerSesionActiva(): SesionActiva | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_SESSION) || sessionStorage.getItem(STORAGE_KEY_AUTH_SESSION);
    if (!raw) return null;
    const sesion = JSON.parse(raw) as SesionActiva;
    if (new Date() > new Date(sesion.expiraEn)) {
      cerrarSesionSegura();
      return null;
    }
    return sesion;
  } catch (e) {
    return null;
  }
}

export function cerrarSesionSegura(): void {
  const sesion = obtenerSesionActiva();
  if (sesion) {
    registrarEventoAuditoria(
      'LOGOUT',
      sesion.username,
      `Cierre formal de sesión por el usuario.`,
      'INFO',
      sesion.usuarioId
    );
  }
  localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
  sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
}

// ----------------------------------------------------
// 8. Bloqueo de Estación y Desbloqueo por PIN / Contraseña
// ----------------------------------------------------
export function bloquearEstacionTrabajo(): void {
  const sesion = obtenerSesionActiva();
  if (sesion) {
    sesion.bloqueada = true;
    sesion.bloqueadaEn = new Date().toISOString();
    guardarSesionActiva(sesion);
    registrarEventoAuditoria(
      'BLOQUEO_SESION',
      sesion.username,
      `Estación bloqueada por inactividad o solicitud del operador.`,
      'INFO',
      sesion.usuarioId
    );
  }
}

export async function desbloquearEstacion(codigo: string): Promise<boolean> {
  const sesion = obtenerSesionActiva();
  if (!sesion) return false;

  const usuarios = await obtenerUsuariosRegistrados();
  const usuario = usuarios.find(u => u.id === sesion.usuarioId);
  if (!usuario) return false;

  // Probar primero si ingresó su PIN rápido o la clave completa
  const hashIngresado = await hashStringSHA256(codigo, usuario.salt);

  const esPinValido = usuario.pinRapidoHash && hashIngresado === usuario.pinRapidoHash;
  const esPasswordValido = hashIngresado === usuario.passwordHash;

  if (esPinValido || esPasswordValido) {
    sesion.bloqueada = false;
    sesion.bloqueadaEn = undefined;
    guardarSesionActiva(sesion);

    registrarEventoAuditoria(
      'DESBLOQUEO_PIN',
      usuario.username,
      `Desbloqueo de pantalla exitoso (${esPinValido ? 'mediante PIN rápido' : 'mediante contraseña'}).`,
      'INFO',
      usuario.id
    );
    return true;
  }

  registrarEventoAuditoria(
    'LOGIN_FALLIDO',
    usuario.username,
    `Intento fallido de desbloqueo de pantalla.`,
    'WARNING',
    usuario.id
  );
  return false;
}

// ----------------------------------------------------
// 9. Cambio Seguro de Contraseña
// ----------------------------------------------------
export async function cambiarPasswordUsuario(
  usuarioId: string,
  passwordActual: string,
  passwordNuevo: string
): Promise<{ exito: boolean; mensaje: string }> {
  const usuarios = await obtenerUsuariosRegistrados();
  const usuario = usuarios.find(u => u.id === usuarioId);

  if (!usuario) {
    return { exito: false, mensaje: 'Usuario no encontrado.' };
  }

  const hashActual = await hashStringSHA256(passwordActual, usuario.salt);
  if (hashActual !== usuario.passwordHash) {
    return { exito: false, mensaje: 'La contraseña actual no es correcta.' };
  }

  const evaluacion = evaluarFortalezaPassword(passwordNuevo);
  if (evaluacion.score < 3) {
    return { exito: false, mensaje: 'La nueva contraseña no cumple con los requisitos mínimos de seguridad institucional (8 caracteres, mayúsculas, minúsculas, números y caracteres especiales).' };
  }

  // Generar nuevo salt para renovación criptográfica completa
  const nuevoSalt = generarSalt();
  usuario.salt = nuevoSalt;
  usuario.passwordHash = await hashStringSHA256(passwordNuevo, nuevoSalt);
  usuario.requiereCambioClave = false;

  guardarUsuariosRegistrados(usuarios);

  registrarEventoAuditoria(
    'CAMBIO_CLAVE',
    usuario.username,
    `Actualización de contraseña completada satisfactoriamente con nuevo salt criptográfico.`,
    'CRITICAL',
    usuario.id
  );

  return { exito: true, mensaje: 'Contraseña actualizada con éxito y cifrada en el sistema.' };
}

// ----------------------------------------------------
// 10. Medidor de Fortaleza de Contraseña
// ----------------------------------------------------
export function evaluarFortalezaPassword(password: string): {
  requisitos: RequisitosPassword;
  score: number; // 0 a 5
  porcentaje: number;
  texto: string;
  color: string;
} {
  const requisitos: RequisitosPassword = {
    longitudMinima: password.length >= 8,
    tieneMayuscula: /[A-Z]/.test(password),
    tieneMinuscula: /[a-z]/.test(password),
    tieneNumero: /[0-9]/.test(password),
    tieneEspecial: /[^A-Za-z0-9]/.test(password),
  };

  let score = 0;
  if (requisitos.longitudMinima) score++;
  if (requisitos.tieneMayuscula) score++;
  if (requisitos.tieneMinuscula) score++;
  if (requisitos.tieneNumero) score++;
  if (requisitos.tieneEspecial) score++;

  let texto = 'Muy Débil';
  let color = 'bg-rose-500 text-rose-500';

  if (score === 1 || score === 2) {
    texto = 'Débil (Insegura)';
    color = 'bg-amber-500 text-amber-500';
  } else if (score === 3) {
    texto = 'Aceptable';
    color = 'bg-yellow-500 text-yellow-500';
  } else if (score === 4) {
    texto = 'Fuerte (Recomendada)';
    color = 'bg-blue-500 text-blue-500';
  } else if (score === 5) {
    texto = 'Excelente (Máxima Seguridad)';
    color = 'bg-emerald-500 text-emerald-500';
  }

  return {
    requisitos,
    score,
    porcentaje: (score / 5) * 100,
    texto,
    color,
  };
}
