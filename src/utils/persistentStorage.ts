import { BoletaJudicial, ConfiguracionDespacho, Alguacil } from '../types/judicial';

export const STORAGE_KEY_BOLETAS = 'tsj_control_boletas_v1';
export const STORAGE_KEY_BOLETAS_BACKUP = 'tsj_control_boletas_backup_v1';
export const STORAGE_KEY_CONFIG = 'tsj_config_despacho_v1';
export const STORAGE_KEY_CONFIG_BACKUP = 'tsj_config_backup_v1';
export const STORAGE_KEY_ALGUACILES = 'tsj_alguaciles_v1';
export const STORAGE_KEY_ALGUACILES_BACKUP = 'tsj_alguaciles_backup_v1';
export const STORAGE_KEY_SNAPSHOTS = 'tsj_snapshots_history_v1';
export const STORAGE_KEY_LAST_SAVED_AT = 'tsj_last_saved_timestamp_v1';

const DB_NAME = 'TSJ_Judicial_DB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

export interface SnapshotItem {
  id: string;
  timestamp: string;
  boletasCount: number;
  boletas: BoletaJudicial[];
  descripcion: string;
}

// ----------------------------------------------------
// 1. Inicialización de IndexedDB Transaccional (ACID)
// ----------------------------------------------------
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no soportado en este entorno'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function guardarEnIndexedDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(value, key);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Advertencia al escribir en IndexedDB:', err);
  }
}

export async function leerDeIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(key);

      getRequest.onsuccess = () => resolve((getRequest.result as T) ?? null);
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Advertencia al leer de IndexedDB:', err);
    return null;
  }
}

// ----------------------------------------------------
// 2. Solicitud de Persistencia Duradera al Navegador
// ----------------------------------------------------
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const esPersistente = await navigator.storage.persist();
      console.log('Almacenamiento persistente garantizado por el navegador:', esPersistente);
      return esPersistente;
    } catch (e) {
      console.warn('No se pudo solicitar almacenamiento persistente:', e);
      return false;
    }
  }
  return false;
}

export async function verificarEstadoPersistencia(): Promise<{ persistente: boolean; cuotaMb?: number; usoMb?: number }> {
  let persistente = false;
  let cuotaMb: number | undefined;
  let usoMb: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.persisted) {
      persistente = await navigator.storage.persisted();
    }
    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) cuotaMb = Math.round(estimate.quota / (1024 * 1024));
      if (estimate.usage) usoMb = Math.round(estimate.usage / (1024 * 1024));
    }
  }

  return { persistente, cuotaMb, usoMb };
}

// ----------------------------------------------------
// 3. Guardado Doble Capa Anti-Apagones (Zero-Delay)
// ----------------------------------------------------
export function guardarBoletasSeguro(boletas: BoletaJudicial[], motivo?: string): void {
  try {
    const serializado = JSON.stringify(boletas);
    // 1. Escribir copia primaria
    localStorage.setItem(STORAGE_KEY_BOLETAS, serializado);
    // 2. Escribir copia espejo/sombra instantánea
    localStorage.setItem(STORAGE_KEY_BOLETAS_BACKUP, serializado);
    // 3. Registrar marca de tiempo de último guardado exitoso
    const nowIso = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_LAST_SAVED_AT, nowIso);

    // 4. Escribir a IndexedDB de forma asíncrona transaccional
    guardarEnIndexedDB(STORAGE_KEY_BOLETAS, boletas).catch(() => {});

    // 5. Registrar snapshot de recuperación (si hay cambio relevante o cada cierto tiempo)
    registrarSnapshot(boletas, motivo || 'Guardado automático');
  } catch (error) {
    console.error('Error crítico al guardar boletas:', error);
  }
}

export function guardarConfigSeguro(config: ConfiguracionDespacho): void {
  try {
    const s = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEY_CONFIG, s);
    localStorage.setItem(STORAGE_KEY_CONFIG_BACKUP, s);
    guardarEnIndexedDB(STORAGE_KEY_CONFIG, config).catch(() => {});
  } catch (error) {
    console.error('Error guardando configuración:', error);
  }
}

export function guardarAlguacilesSeguro(alguaciles: Alguacil[]): void {
  try {
    const s = JSON.stringify(alguaciles);
    localStorage.setItem(STORAGE_KEY_ALGUACILES, s);
    localStorage.setItem(STORAGE_KEY_ALGUACILES_BACKUP, s);
    guardarEnIndexedDB(STORAGE_KEY_ALGUACILES, alguaciles).catch(() => {});
  } catch (error) {
    console.error('Error guardando alguaciles:', error);
  }
}

// ----------------------------------------------------
// 4. Carga a Prueba de Fallos y Corrupción por Apagón
// ----------------------------------------------------
export function cargarBoletasSeguro(fallbackInicial: BoletaJudicial[]): {
  boletas: BoletaJudicial[];
  recuperadoDeBackup: boolean;
} {
  // Intento 1: Cargar almacenamiento primario
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BOLETAS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { boletas: normalizarBoletas(parsed), recuperadoDeBackup: false };
      }
    }
  } catch (errPrimario) {
    console.warn('Fallo al leer datos primarios (posible corte eléctrico durante escritura):', errPrimario);
  }

  // Intento 2: Cargar copia sombra de emergencia (Backup instantáneo)
  try {
    const savedBackup = localStorage.getItem(STORAGE_KEY_BOLETAS_BACKUP);
    if (savedBackup) {
      const parsedBackup = JSON.parse(savedBackup);
      if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
        console.info('¡Éxito! Datos recuperados automáticamente desde la copia de seguridad sombra tras corte eléctrico.');
        // Restaurar primario inmediatamente
        localStorage.setItem(STORAGE_KEY_BOLETAS, savedBackup);
        return { boletas: normalizarBoletas(parsedBackup), recuperadoDeBackup: true };
      }
    }
  } catch (errBackup) {
    console.warn('Fallo al leer copia sombra:', errBackup);
  }

  // Intento 3: Cargar desde el último punto de restauración en historial
  const snapshots = obtenerSnapshots();
  if (snapshots.length > 0 && snapshots[0].boletas && snapshots[0].boletas.length > 0) {
    console.info('¡Recuperado desde el último snapshot de seguridad!');
    return { boletas: normalizarBoletas(snapshots[0].boletas), recuperadoDeBackup: true };
  }

  return { boletas: fallbackInicial, recuperadoDeBackup: false };
}

function normalizarBoletas(lista: any[]): BoletaJudicial[] {
  const seenIds = new Set<string>();
  const mockPendingIds = new Set([
    'bol-1', 'bol-2', 'bol-3', 'bol-4', 'bol-5', 'bol-6', 'bol-7',
    'bol-8', 'bol-9', 'bol-10', 'bol-11', 'bol-12', 'bol-13', 'bol-mer-4'
  ]);

  return lista.map((b: any, idx: number) => {
    let validId = b.id;
    if (!validId || seenIds.has(validId)) {
      validId = `bol-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
    }
    seenIds.add(validId);

    // Saneamiento riguroso de datos:
    let alg = typeof b.alguacilPractica === 'string' ? b.alguacilPractica.trim() : '';
    if (alg.toUpperCase().includes('SIN ASIGNAR') || alg.toUpperCase().includes('SIN ALGUACIL')) {
      alg = '';
    }

    const esDevuelta = !!b.devueltaAlTribunal;
    const tieneAcuse = !!b.acuseRecibidoPor;

    // Si la boleta NO ha sido devuelta al tribunal ni tiene acuse formal de entrega:
    // Está formalmente PENDIENTE de práctica.
    if (!esDevuelta && !tieneAcuse) {
      // 1. Si alguacilPractica contiene fechas heredadas ("30-01-26", "03-02-26") o proviene de IDs iniciales pendientes, limpiarlo a ""
      if (mockPendingIds.has(b.id) || /\d{1,2}[-/]\d{1,2}/.test(alg)) {
        alg = '';
      }

      return {
        ...b,
        id: validId,
        numeroItem: typeof b.numeroItem === 'number' ? b.numeroItem : idx + 1,
        alguacilPractica: alg,
        estado: 'PENDIENTE',
      };
    }

    return {
      ...b,
      id: validId,
      numeroItem: typeof b.numeroItem === 'number' ? b.numeroItem : idx + 1,
      alguacilPractica: alg,
      estado: b.estado || (esDevuelta ? 'PRACTICADA' : 'PENDIENTE'),
    };
  });
}

// ----------------------------------------------------
// 5. Historial de Puntos de Restauración (Snapshots)
// ----------------------------------------------------
export function obtenerSnapshots(): SnapshotItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (!saved) return [];
    const list = JSON.parse(saved);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function registrarSnapshot(boletas: BoletaJudicial[], descripcion: string): void {
  try {
    if (!boletas || boletas.length === 0) return;
    const ahora = Date.now();
    const snapshots = obtenerSnapshots();

    // Evitar generar snapshots idénticos con menos de 15 segundos de diferencia
    if (snapshots.length > 0) {
      const ultimo = snapshots[0];
      const diferenciaMs = ahora - new Date(ultimo.timestamp).getTime();
      if (diferenciaMs < 15000 && ultimo.boletasCount === boletas.length) {
        return;
      }
    }

    const nuevoSnapshot: SnapshotItem = {
      id: `snap-${ahora}`,
      timestamp: new Date().toISOString(),
      boletasCount: boletas.length,
      boletas: boletas.map(b => ({ ...b })),
      descripcion,
    };

    // Mantener los últimos 6 puntos de restauración automáticos
    const actualizados = [nuevoSnapshot, ...snapshots.slice(0, 5)];
    localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(actualizados));
  } catch (err) {
    console.warn('No se pudo guardar el snapshot:', err);
  }
}

// ----------------------------------------------------
// 6. Descarga y Carga Manual de Respaldo (.JSON)
// ----------------------------------------------------
export function descargarRespaldoCompletoJSON(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  alguaciles: Alguacil[]
): void {
  const data = {
    sistema: 'TSJ - Sistema de Control de Boletas Judiciales y Acuses',
    version: '1.0',
    fechaExportacion: new Date().toISOString(),
    boletas,
    config,
    alguaciles,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fechaStr = new Date().toISOString().slice(0, 10);
  a.download = `Respaldo_TSJ_Boletas_${fechaStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
