export type ArticuloCOPP = '167' | '168' | '169' | '170' | '171' | '165' | 'S_165' | 'S 165' | 'SIN_ART' | '';

export type SeccionRuta = 
  | 'RUTA_NOTIFICACION_CITACION' 
  | 'CORREO_EXT' 
  | 'RUTA_INTERNA' 
  | 'OTROS_ESTADOS_MERIDA'
  | 'SOBRESEIMIENTO'
  | string;

export interface SeccionTrabajoInfo {
  codigo: string;
  nombre: string;
  corto: string;
  descripcion: string;
  color: string;
  badgeBg: string;
  tabBgActive?: string;
  tabBgInactive?: string;
  colorHex?: string;
  esPersonalizada?: boolean;
}

export const SECCIONES_INFO: Record<string, SeccionTrabajoInfo> = {
  RUTA_NOTIFICACION_CITACION: {
    codigo: 'RUTA_NOTIFICACION_CITACION',
    nombre: 'RUTA DE NOTIFICACIÓN Y CITACIÓN',
    corto: '1. Notif. y Citación',
    descripcion: 'Ruta ordinaria de calle / Alguacilazgo en el municipio y circunscripción',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    tabBgActive: 'bg-indigo-600 text-white shadow-xs',
    tabBgInactive: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900',
  },
  CORREO_EXT: {
    codigo: 'CORREO_EXT',
    nombre: 'CORREO EXT.',
    corto: '2. Correo Ext.',
    descripcion: 'Correo Externo / Envíos postales / Telegramas y despachos foráneos',
    color: 'text-sky-700',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    tabBgActive: 'bg-sky-600 text-white shadow-xs',
    tabBgInactive: 'bg-sky-50 hover:bg-sky-100 text-sky-900',
  },
  RUTA_INTERNA: {
    codigo: 'RUTA_INTERNA',
    nombre: 'RUTA INTERNA',
    corto: '3. Ruta Interna',
    descripcion: 'Sede del Palacio de Justicia, Tribunales, Fiscalía y Defensa Pública',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    tabBgActive: 'bg-emerald-600 text-white shadow-xs',
    tabBgInactive: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900',
  },
  OTROS_ESTADOS_MERIDA: {
    codigo: 'OTROS_ESTADOS_MERIDA',
    nombre: 'BOLETAS DE OTROS ESTADOS Y MÉRIDA',
    corto: '4. Mérida / Otros',
    descripcion: 'Exhortos, despachos de comisión, Mérida Capital y otros Estados de la República',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    tabBgActive: 'bg-amber-600 text-white shadow-xs',
    tabBgInactive: 'bg-amber-50 hover:bg-amber-100 text-amber-900',
  },
  SOBRESEIMIENTO: {
    codigo: 'SOBRESEIMIENTO',
    nombre: 'SOBRESEIMIENTO',
    corto: '5. Sobreseimiento',
    descripcion: 'Notificaciones de Sobreseimiento judicial y archivo de causas',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    tabBgActive: 'bg-purple-600 text-white shadow-xs',
    tabBgInactive: 'bg-purple-50 hover:bg-purple-100 text-purple-900',
  },
};

export interface TribunalInfo {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'CONTROL' | 'JUICIO' | 'EJECUCION' | 'TPM' | 'SPA';
  juez?: string;
  secretario?: string;
}

export interface Alguacil {
  id: string;
  nombre: string;
  cedula?: string;
  telefono?: string;
  activo: boolean;
}

export type TipoCitado = 
  | 'FISCALIA' 
  | 'ABOGADO_DEFENSA' 
  | 'DEFENSA_PUBLICA'
  | 'IMPUTADO' 
  | 'ACUSADO'
  | 'INVESTIGADO'
  | 'PENADO'
  | 'VICTIMA' 
  | 'QUERELLANTE'
  | 'DENUNCIANTE'
  | 'FUNCIONARIO'
  | 'ORGANO_POLICIAL'
  | 'CIUDADANO'
  | 'TESTIGO' 
  | 'EXPERTO' 
  | 'TERCERO'
  | 'FIADOR'
  | 'APODERADO'
  | 'REPRESENTANTE_LEGAL'
  | 'SOLICITANTE'
  | 'OTRO';

export const TIPOS_CITADO_OPTIONS: { value: TipoCitado; label: string }[] = [
  { value: 'IMPUTADO', label: 'Imputado' },
  { value: 'VICTIMA', label: 'Víctima' },
  { value: 'FUNCIONARIO', label: 'Funcionario' },
  { value: 'FISCALIA', label: 'Fiscalía (MP)' },
  { value: 'INVESTIGADO', label: 'Investigado' },
  { value: 'ACUSADO', label: 'Acusado' },
  { value: 'TESTIGO', label: 'Testigo' },
  { value: 'DEFENSA_PUBLICA', label: 'Defensa Pública' },
  { value: 'ABOGADO_DEFENSA', label: 'Defensa Privada' },
  { value: 'PENADO', label: 'Penado' },
  { value: 'SOLICITANTE', label: 'Solicitante' },
  { value: 'CIUDADANO', label: 'Ciudadano' },
  { value: 'QUERELLANTE', label: 'Querellante' },
  { value: 'DENUNCIANTE', label: 'Denunciante' },
  { value: 'EXPERTO', label: 'Experto / Perito' },
  { value: 'TERCERO', label: 'Tercero Interesado' },
  { value: 'FIADOR', label: 'Fiador / Garante' },
  { value: 'APODERADO', label: 'Apoderado Judicial' },
  { value: 'REPRESENTANTE_LEGAL', label: 'Representante Legal' },
  { value: 'OTRO', label: 'Otro' },
];

/**
 * Detecta automáticamente el Carácter según prefijos y palabras clave en el nombre del Notificado/Citado:
 * VICT. -> VICTIMA
 * IMP. -> IMPUTADO
 * FUN. -> FUNCIONARIO
 * FISCALIA -> FISCALIA (MP)
 * INV. -> INVESTIGADO
 * ACUS. -> ACUSADO
 * TESTIGO -> TESTIGO
 * APOD -> APODERADO
 * ABG. / DEFENSA / DEFEN. -> DEFENSA
 * PENADO. -> PENADO
 * SOLIC. -> SOLICITANTE
 * QUERE... -> QUERELLAD@ / QUERELLANTE
 */
export function detectCaracterFromText(text: string): { detectedTipo: TipoCitado | null; cleanName?: string } {
  if (!text) return { detectedTipo: null };
  const raw = text.trim();
  const upper = raw.toUpperCase();

  // 1. VICT. / VICTIMA
  if (/^(?:VICT\.?|V[IÍ]CTIMA:?)\s*/i.test(upper) || /\bVICT\.|\bV[IÍ]CTIMA\b/i.test(upper)) {
    const clean = raw.replace(/^(?:VICT\.?|V[IÍ]CTIMA:?)\s*/i, '').trim();
    return { detectedTipo: 'VICTIMA', cleanName: clean || raw };
  }

  // 2. IMP. / IMPUTADO
  if (/^(?:IMP\.?|IMPUTAD[OA@]:?)\s*/i.test(upper) || /\bIMP\.|\bIMPUTAD[OA@]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:IMP\.?|IMPUTAD[OA@]:?)\s*/i, '').trim();
    return { detectedTipo: 'IMPUTADO', cleanName: clean || raw };
  }

  // 3. FUN. / FUNCIONARIO
  if (/^(?:FUN\.?|FUNCIONARI[OA]:?)\s*/i.test(upper) || /\bFUN\.|\bFUNCIONARI[OA]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:FUN\.?|FUNCIONARI[OA]:?)\s*/i, '').trim();
    return { detectedTipo: 'FUNCIONARIO', cleanName: clean || raw };
  }

  // 4. FISCALIA / FISCALIA MP / FISC. / MINISTERIO PUBLICO
  if (/^(?:FISCAL[IÍ]A(?:\s*MP)?|FISC\.?|MINISTERIO\s*P[UÚ]BLICO):?\s*/i.test(upper) || /\bFISCAL[IÍ]A\b|\bFISC\.|\bMINISTERIO\s*P[UÚ]BLICO\b/i.test(upper)) {
    const clean = raw.replace(/^(?:FISCAL[IÍ]A(?:\s*MP)?|FISC\.?|MINISTERIO\s*P[UÚ]BLICO):?\s*/i, '').trim();
    return { detectedTipo: 'FISCALIA', cleanName: clean || raw };
  }

  // 5. INV. / INVESTIGADO
  if (/^(?:INV\.?|INVESTIGAD[OA@]:?)\s*/i.test(upper) || /\bINV\.|\bINVESTIGAD[OA@]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:INV\.?|INVESTIGAD[OA@]:?)\s*/i, '').trim();
    return { detectedTipo: 'INVESTIGADO', cleanName: clean || raw };
  }

  // 6. ACUS. / ACUSADO
  if (/^(?:ACUS\.?|ACUSAD[OA@]:?)\s*/i.test(upper) || /\bACUS\.|\bACUSAD[OA@]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:ACUS\.?|ACUSAD[OA@]:?)\s*/i, '').trim();
    return { detectedTipo: 'ACUSADO', cleanName: clean || raw };
  }

  // 7. TESTIGO / TEST.
  if (/^(?:TESTIGO:?|TEST\.?:?)\s*/i.test(upper) || /\bTESTIGO\b|\bTEST\.|\bTESTIGOS\b/i.test(upper)) {
    const clean = raw.replace(/^(?:TESTIGO:?|TEST\.?:?)\s*/i, '').trim();
    return { detectedTipo: 'TESTIGO', cleanName: clean || raw };
  }

  // 8. APOD / APODERADO
  if (/^(?:APOD\.?|APODERAD[OA@]:?)\s*/i.test(upper) || /\bAPOD\.|\bAPODERAD[OA@]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:APOD\.?|APODERAD[OA@]:?)\s*/i, '').trim();
    return { detectedTipo: 'APODERADO', cleanName: clean || raw };
  }

  // 9. ABG. / ABOGADO / DEFENSA / DEFEN. / DEF.
  if (
    /^(?:ABG\.?|ABOG\.?|ABOGAD[OA]:?|DEFENSA(?:\s*P[UÚ]BLICA)?|DEFEN\.?|DEF\.?):?\s*/i.test(upper) || 
    /\bABG\.|\bABOG\.|\bABOGAD[OA]\b|\bDEFENSA\b|\bDEFEN\.|\bDEF\./i.test(upper)
  ) {
    const esPublica = upper.includes('PUBLICA') || upper.includes('PÚBLICA');
    const clean = raw.replace(/^(?:ABG\.?|ABOG\.?|ABOGAD[OA]:?|DEFENSA(?:\s*P[UÚ]BLICA)?|DEFEN\.?|DEF\.?):?\s*/i, '').trim();
    return { detectedTipo: esPublica ? 'DEFENSA_PUBLICA' : 'ABOGADO_DEFENSA', cleanName: clean || raw };
  }

  // 10. PENADO / PENADO.
  if (/^(?:PENAD[OA]\.?|PENADO\.?):?\s*/i.test(upper) || /\bPENAD[OA]\.|\bPENAD[OA]\b/i.test(upper)) {
    const clean = raw.replace(/^(?:PENAD[OA]\.?|PENADO\.?):?\s*/i, '').trim();
    return { detectedTipo: 'PENADO', cleanName: clean || raw };
  }

  // 11. SOLIC. / SOLICITANTE
  if (/^(?:SOLIC\.?|SOLICITANTE:?)\s*/i.test(upper) || /\bSOLIC\.|\bSOLICITANTE\b/i.test(upper)) {
    const clean = raw.replace(/^(?:SOLIC\.?|SOLICITANTE:?)\s*/i, '').trim();
    return { detectedTipo: 'SOLICITANTE', cleanName: clean || raw };
  }

  // 12. QUERE... / QUERELLAD@ / QUERELLANTE / QUERELLADO / QUERELLADA
  if (/^(?:QUERE(?:LLAD[OA@]|LLANTE|\.\.\.)?:?)\s*/i.test(upper) || /\bQUERE(?:LLAD[OA@]|LLANTE|\.\.\.)\b/i.test(upper)) {
    const clean = raw.replace(/^(?:QUERE(?:LLAD[OA@]|LLANTE|\.\.\.)?:?)\s*/i, '').trim();
    return { detectedTipo: 'QUERELLANTE', cleanName: clean || raw };
  }

  return { detectedTipo: null };
}

export function getCaracterDisplay(tipo?: TipoCitado | string): string {
  switch (tipo) {
    case 'FISCALIA': return 'Fiscalía';
    case 'ABOGADO_DEFENSA': return 'Defensa';
    case 'DEFENSA_PUBLICA': return 'Defensa Pública';
    case 'IMPUTADO': return 'Imputado';
    case 'ACUSADO': return 'Acusado';
    case 'INVESTIGADO': return 'Investigado';
    case 'PENADO': return 'Penado';
    case 'SOLICITANTE': return 'Solicitante';
    case 'VICTIMA': return 'Víctima';
    case 'QUERELLANTE': return 'Querellante';
    case 'DENUNCIANTE': return 'Denunciante';
    case 'FUNCIONARIO':
    case 'ORGANO_POLICIAL': return 'Funcionario';
    case 'CIUDADANO': return 'Ciudadano';
    case 'TESTIGO': return 'Testigo';
    case 'EXPERTO': return 'Experto';
    case 'TERCERO': return 'Tercero';
    case 'FIADOR': return 'Fiador';
    case 'APODERADO': return 'Apoderado';
    case 'REPRESENTANTE_LEGAL': return 'Rep. Legal';
    case 'OTRO': return 'Otro';
    default: return tipo || 'Otro';
  }
}

export function getCaracterPriority(tipo?: TipoCitado | string): number {
  switch (tipo) {
    case 'FISCALIA': return 1;
    case 'ABOGADO_DEFENSA': return 2;
    case 'DEFENSA_PUBLICA': return 3;
    case 'IMPUTADO': return 4;
    case 'ACUSADO': return 5;
    case 'PENADO': return 6;
    case 'VICTIMA': return 7;
    case 'FUNCIONARIO': return 8;
    case 'CIUDADANO': return 9;
    case 'QUERELLANTE': return 10;
    case 'DENUNCIANTE': return 11;
    case 'ORGANO_POLICIAL': return 12;
    case 'TESTIGO': return 13;
    case 'EXPERTO': return 14;
    case 'TERCERO': return 15;
    case 'FIADOR': return 16;
    case 'APODERADO': return 17;
    case 'REPRESENTANTE_LEGAL': return 18;
    case 'OTRO': return 19;
    default: return 99;
  }
}

export type DependenciaJudicial = 'NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS';

export type EstadoBoleta = 'PENDIENTE' | 'ASIGNADA' | 'EN_RUTA' | 'PRACTICADA' | 'DEVUELTA_UAC' | 'DEVUELTA_TRIBUNAL' | 'NO_PRACTICADA';

export interface BoletaJudicial {
  id: string;
  numeroItem: number;
  numeroCausa: string; // Ej: LP11-Y-2026-581
  boletaNumero: string; // Ej: 4465
  numeroOficio?: string; // N° de Oficio judicial (diferenciador clave para el rol Secretario(a))
  dependencia?: 'NOTIFICACION_CITACION' | 'SECRETARIA'; // Dependencia a la que pertenece la causa/boleta
  responsableRelacion?: string; // Nombre del titular del login / responsable de la unidad que relaciona en el sistema
  notificadoCitado: string; // Ej: FISCALIA XVII, ABG. PAOLA RUIZ, IMP. JEAN CARLOS ROA
  tipoCitado: TipoCitado;
  
  // Fin de página manual / Salto de página
  finDePagina?: boolean; // Permite terminar la página con esta boleta (ej: a las 14 boletas) e iniciar una nueva
  
  // Fecha y tipo de audiencia
  esSoloNotificacion: boolean;
  fechaAudiencia: string; // YYYY-MM-DD o 'NOTIFICACION'
  horaAudiencia?: string; // Ej: "09:30 AM"
  tipoAudiencia?: string; // Preliminar, Apertura de Juicio, Continuación, Notificación, Convocatoria
  
  // Asignación interna
  fechaAsignacion: string; // YYYY-MM-DD (Fecha de ingreso/asignación)
  tribunal: string; // C1, C2, C3, J1, J2, J3, E1, E2, TPM1, TPM2, SPA 1, OTRO
  tribunalOtro?: string; // Nombre o especificación del tribunal cuando es OTRO (ej: J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA)
  
  // Artículo COPP (admite hasta 2 artículos marcados)
  articuloCOPP: ArticuloCOPP;
  articulosCOPP?: ArticuloCOPP[];
  
  // Sección de Ruta
  seccionRuta?: SeccionRuta;
  
  // Alguacil
  alguacilPractica: string; // Ej: ELISET, ÑERO, PABLO F., RENZO M.
  
  // Estado y Devoluciones
  estado: EstadoBoleta;
  motivoNoPractica?: string; // Motivo en caso de resulta no practicada
  devueltaAlTribunal: boolean;
  fechaDevueltaTribunal?: string; // YYYY-MM-DD
  fechaRecibidoUAC?: string; // YYYY-MM-DD (Fecha de recibido por U.A.C.)
  impresaDespacho?: boolean; // Si ya fue impresa en la lista de despacho
  fechaImpresionDespacho?: string;
  
  // Relación de Acuses para entrega a tribunales
  acuseGenerado: boolean;
  acuseNumeroControl?: string; // Número correlativo de acuse / oficio
  acuseFechaEntrega?: string;
  acuseHoraEntrega?: string; // Hora en que la secretaria recibió (ej: "10:30 AM")
  acuseRecibidoPor?: string; // Nombre y cargo de la secretaria que recibe en el tribunal
  acuseObservaciones?: string;
  
  observaciones?: string;
  direccionCitacion?: string;
  mesRuta: string; // Ej: "2026-08" (Agosto 2026)
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Determina si un artículo COPP está marcado en la boleta
 * Soporta múltiples artículos (hasta 2)
 */
export function hasArticulo(boleta: BoletaJudicial, art: ArticuloCOPP): boolean {
  if (!boleta || !art) return false;
  const matchArts = (art === 'S 165' || art === 'S_165') ? ['S 165', 'S_165'] : [art];
  if (boleta.articulosCOPP && Array.isArray(boleta.articulosCOPP)) {
    return boleta.articulosCOPP.some(a => matchArts.includes(a));
  }
  if (!boleta.articuloCOPP) return false;
  const parts = boleta.articuloCOPP.split(',').map(s => s.trim());
  return parts.some(p => matchArts.includes(p as ArticuloCOPP));
}

/**
 * Compara códigos de tribunales de manera flexible y robusta,
 * tolerando espacios, guiones o variaciones de mayúsculas/minúsculas
 * (ej: "SPA 1" coincide con "SPA1", "TPM1" con "TPM 1", "C1" con "c1").
 */
export function matchesTribunal(
  boletaTribunal: string | undefined | null,
  targetCode: string | undefined | null
): boolean {
  if (!boletaTribunal || !targetCode) return false;
  const bClean = boletaTribunal.trim().toUpperCase();
  const tClean = targetCode.trim().toUpperCase();
  if (bClean === tClean) return true;
  if (tClean === 'OTRO' && (bClean.startsWith('OTRO') || bClean === 'TACHIRA' || bClean === 'FORANEO' || bClean === 'FORÁNEO')) return true;
  if (bClean === 'OTRO' && (tClean.startsWith('OTRO') || tClean === 'TACHIRA')) return true;
  const bNorm = bClean.replace(/[^A-Z0-9]/g, '');
  const tNorm = tClean.replace(/[^A-Z0-9]/g, '');
  return bNorm.length > 0 && bNorm === tNorm;
}

/**
 * Alterna el marcado de un artículo en la boleta permitiendo marcar hasta 2 artículos
 */
export function toggleArticuloBoleta(
  boleta: BoletaJudicial, 
  art: ArticuloCOPP
): { articuloCOPP: ArticuloCOPP; articulosCOPP: ArticuloCOPP[] } {
  let currentList: ArticuloCOPP[] = [];
  if (boleta.articulosCOPP && Array.isArray(boleta.articulosCOPP) && boleta.articulosCOPP.length > 0) {
    currentList = [...boleta.articulosCOPP];
  } else if (boleta.articuloCOPP) {
    currentList = boleta.articuloCOPP.split(',').map(s => s.trim() as ArticuloCOPP).filter(Boolean);
  }

  const isSameArt = (a: ArticuloCOPP, b: ArticuloCOPP) => {
    if ((a === 'S 165' || a === 'S_165') && (b === 'S 165' || b === 'S_165')) return true;
    return a === b;
  };

  const existingIndex = currentList.findIndex(item => isSameArt(item, art));
  if (existingIndex >= 0) {
    // Si ya está presente, se desmarca
    currentList.splice(existingIndex, 1);
  } else {
    // Si ya tiene 2 artículos marcados, reemplaza el más antiguo para permitir máximo 2
    if (currentList.length >= 2) {
      currentList = [currentList[1], art];
    } else {
      currentList.push(art);
    }
  }

  return {
    articuloCOPP: (currentList.join(', ') || '') as ArticuloCOPP,
    articulosCOPP: currentList,
  };
}

/**
 * Valida si una boleta cumple con los requisitos obligatorios para marcarse como DEVUELTA AL TRIBUNAL (SÍ):
 * 1. Debe tener al menos un Artículo del C.O.P.P. seleccionado.
 * 2. Debe tener un Alguacil asignado que practicó la diligencia.
 */
export function validarRequisitosDevuelta(boleta: {
  articuloCOPP?: string;
  articulosCOPP?: string[];
  alguacilPractica?: string;
}): { puedeSerDevuelta: boolean; tieneArticulo: boolean; tieneAlguacil: boolean; mensajeError: string } {
  const tieneArticulo = !!(
    (boleta.articulosCOPP && boleta.articulosCOPP.length > 0) ||
    (boleta.articuloCOPP && boleta.articuloCOPP.trim() !== '')
  );
  const alg = (boleta.alguacilPractica || '').trim().toUpperCase();
  const tieneAlguacil = alg !== '' && !alg.includes('SIN ASIGNAR') && !alg.includes('SIN ALGUACIL');

  if (!tieneArticulo && !tieneAlguacil) {
    return {
      puedeSerDevuelta: false,
      tieneArticulo: false,
      tieneAlguacil: false,
      mensajeError: '⚠️ No se puede marcar como SÍ en Devuelta al Tribunal:\nDebes seleccionar el Artículo del C.O.P.P. y asignar el Alguacil responsable.',
    };
  }
  if (!tieneArticulo) {
    return {
      puedeSerDevuelta: false,
      tieneArticulo: false,
      tieneAlguacil: true,
      mensajeError: '⚠️ No se puede marcar como SÍ en Devuelta al Tribunal:\nFalta seleccionar el Artículo del C.O.P.P. (ej: 167, 168, 169, 170, 171, 165, S 165).',
    };
  }
  if (!tieneAlguacil) {
    return {
      puedeSerDevuelta: false,
      tieneArticulo: true,
      tieneAlguacil: false,
      mensajeError: '⚠️ No se puede marcar como SÍ en Devuelta al Tribunal:\nFalta asignar el Alguacil que practicó la diligencia.',
    };
  }

  return {
    puedeSerDevuelta: true,
    tieneArticulo: true,
    tieneAlguacil: true,
    mensajeError: '',
  };
}

export type NivelAlerta = 'CRITICA' | 'URGENTE' | 'PROXIMA' | 'NORMAL' | 'DEVUELTA';

export interface AlertaBoleta {
  boletaId: string;
  nivel: NivelAlerta;
  titulo: string;
  mensaje: string;
  diasRestantes?: number;
  diasDesdeAsignacion: number;
}

export interface ConfiguracionDespacho {
  entePrincipal: string; // "TRIBUNAL SUPREMO DE JUSTICIA"
  circuitoJudicial: string; // "CIRCUITO JUDICIAL PENAL EXTENSION EL VIGIA ESTADO MERIDA"
  unidad: string; // "UNIDAD DE ACTOS Y COMUNICACION / ALGUACILAZGO"
  jefeAlguacilazgo: string;
  alguacilesRuta: string; // "ALGUACILES PABLO F. - RENZO M."
  mesRutaActual: string; // "2026-08"
  añoActual: number;
  mostrarTabAlguaciles?: boolean; // Permite ocultar la pestaña 'Listados por Alguacil' si el despacho no la utiliza
}
