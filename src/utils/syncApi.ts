import { BoletaJudicial } from '../types/judicial';

/**
 * Módulo de sincronización client-server para que cualquier dispositivo
 * (móvil, tablet u otro PC) que escanee un Código QR acceda a las mismas boletas
 * y resultas judiciales generadas desde el despacho principal.
 */

export async function fetchBoletasFromServer(): Promise<BoletaJudicial[] | null> {
  try {
    const res = await fetch('/api/boletas');
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.boletas) && data.boletas.length > 0) {
      return data.boletas;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveBoletasToServer(boletas: BoletaJudicial[]): Promise<boolean> {
  if (!boletas || boletas.length === 0) return false;
  try {
    const res = await fetch('/api/boletas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boletas }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchTribunalBoletasFromServer(tribunalCodigo: string): Promise<BoletaJudicial[] | null> {
  try {
    const res = await fetch(`/api/rendicion/${encodeURIComponent(tribunalCodigo)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.boletas)) {
      return data.boletas;
    }
    return null;
  } catch {
    return null;
  }
}
