import { 
  TipoCitado, 
  ArticuloCOPP, 
  SeccionRuta, 
  TribunalInfo, 
  Alguacil,
  detectCaracterFromText
} from '../types/judicial';

export interface ParsedExcelRow {
  numeroItem?: number;
  numeroCausa: string;
  boletaNumero: string;
  notificadoCitado: string;
  tipoCitado: TipoCitado;
  esSoloNotificacion: boolean;
  fechaAudiencia: string; // YYYY-MM-DD o vacía si es notificación pura
  horaAudiencia?: string; // ej: 10:00 AM
  fechaAsignacion?: string; // YYYY-MM-DD
  tribunal: string; // C1, C2, J1, OTRO, etc.
  tribunalOtro?: string; // Nombre o especificación del tribunal cuando es foráneo/OTRO (ej: J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA)
  articuloCOPP: ArticuloCOPP;
  alguacilPractica: string;
  seccionRuta: SeccionRuta;
  isValid: boolean;
  validationNote?: string;
  isPartialColumns?: boolean;
  direccionCitacion?: string;
  numeroOficio?: string;
}

/**
 * Normaliza una cadena de fecha a formato estándar YYYY-MM-DD.
 */
export function normalizeDateString(val: string): { isDate: boolean; formatted: string; isNotifOnly: boolean } {
  if (!val) return { isDate: false, formatted: '', isNotifOnly: false };
  const raw = val.trim();
  const upper = raw.toUpperCase();

  // Si dice NOTIFICACION, SOBRESEIMIENTO, etc.
  if (
    upper.includes('NOTIF') || 
    upper.includes('SOBRESE') || 
    upper.includes('N/A') || 
    upper === 'NO' || 
    upper === 'S/F' ||
    upper === 'SIN FECHA'
  ) {
    return { isDate: false, formatted: '', isNotifOnly: true };
  }

  // Formato ISO: YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = upper.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return { isDate: true, formatted: `${y}-${m}-${d}`, isNotifOnly: false };
  }

  // Formato Latinoamericano: DD-MM-YYYY o DD/MM/YYYY o DD-MM-YY o DD/MM/YY
  const latinMatch = upper.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (latinMatch) {
    const d = latinMatch[1].padStart(2, '0');
    const m = latinMatch[2].padStart(2, '0');
    let y = latinMatch[3];
    if (y.length === 2) y = `20${y}`;
    return { isDate: true, formatted: `${y}-${m}-${d}`, isNotifOnly: false };
  }

  return { isDate: false, formatted: '', isNotifOnly: true };
}

/**
 * Detecta si una celda corresponde a una hora (ej: "10:00 AM", "09:30 AM", "2:00 PM", "8:30", "14:00")
 * Para que NUNCA sea confundida con el nombre de un alguacil
 */
export function isLikelyTime(val: string): boolean {
  if (!val) return false;
  const s = val.trim().toUpperCase();
  if (/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|A\.M\.|P\.M\.)?$/i.test(s)) return true;
  if (/^\d{1,2}\s*(?:AM|PM|A\.M\.|P\.M\.)$/i.test(s)) return true;
  return false;
}

/**
 * Normaliza el Carácter / Tipo de persona citada
 */
export function normalizeTipoCitado(val: string): TipoCitado | null {
  if (!val) return null;
  const upper = val.trim().toUpperCase();

  if (upper.includes('QUEREL')) return 'QUERELLANTE';
  if (upper.includes('DENUNC')) return 'DENUNCIANTE';
  if (upper.includes('PENAD')) return 'PENADO';
  if (upper.includes('ACUS')) return 'ACUSADO';
  if (upper.includes('INV') || upper.includes('INVESTIGAD')) return 'INVESTIGADO';
  if (upper.includes('IMP')) return 'IMPUTADO';
  if (upper.includes('VIC')) return 'VICTIMA';
  if (upper.includes('PUB') && (upper.includes('DEF') || upper.includes('DP'))) return 'DEFENSA_PUBLICA';
  if (upper.includes('DEF') || upper.includes('ABOG') || upper.includes('PRIVAD')) return 'ABOGADO_DEFENSA';
  if (upper.includes('FISC') || upper.includes('MP') || upper.includes('MINISTERIO')) return 'FISCALIA';
  if (upper.includes('TEST')) return 'TESTIGO';
  if (upper.includes('EXP') || upper.includes('PERIT')) return 'EXPERTO';
  if (upper.includes('POLI') || upper.includes('CICPC') || upper.includes('CPBEZ') || upper.includes('PNB') || upper.includes('GNB') || upper.includes('DGCIM')) return 'ORGANO_POLICIAL';
  if (upper.includes('FIAD') || upper.includes('GARAN')) return 'FIADOR';
  if (upper.includes('APOD')) return 'APODERADO';
  if (upper.includes('REPR') || upper.includes('CURAD') || upper.includes('TUTOR')) return 'REPRESENTANTE_LEGAL';
  if (upper.includes('TERC')) return 'TERCERO';
  if (upper.includes('OTR')) return 'OTRO';

  return null;
}

/**
 * Comprueba si una cadena parece corresponder a una fecha
 */
export function isLikelyDateString(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true;
  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) return true;
  const upper = s.toUpperCase();
  if (upper.includes('NOTIF') || upper.includes('SOBRESE')) return true;
  return false;
}

/**
 * Detecta tribunales externos o no registrados localmente
 * Ejemplos:
 * "tri. J5 MERIDA", "CORTE MERIDA", "J5 TACHIRA", "C5 STA BARBARA", "STA. BARBARA",
 * "J5 MERIDA", "CORTE DE APELACIONES MERIDA", "TRI. C1 MERIDA", "TACHIRA", etc.
 * Devuelve isExternal=true y tribunalOtro con el nombre específico a relacionar en OTRO.
 */
export function detectExternalTribunal(val: string): { isExternal: boolean; tribunalOtro: string } {
  if (!val) return { isExternal: false, tribunalOtro: '' };
  const raw = val.trim();
  const upper = raw.toUpperCase();
  const compact = upper.replace(/[\s.-]/g, '');

  if (/^\d+$/.test(compact) || isLikelyDateString(raw) || isLikelyTime(raw)) {
    return { isExternal: false, tribunalOtro: '' };
  }

  // Palabras o regiones externas conocidas
  const externalKeywords = [
    'MERIDA', 'MÉRIDA', 'TACHIRA', 'TÁCHIRA', 'STA BARBARA', 'STA. BARBARA', 'SANTA BARBARA',
    'TRUJILLO', 'ZULIA', 'BARINAS', 'CARACAS', 'CORTE', 'APELACIONES',
    'EXHORTO', 'COMISION', 'COMISIÓN', 'EXTERNO', 'FORANEO', 'FORÁNEO', 'FORANEA', 'FORÁNEA'
  ];

  const hasExternalKeyword = externalKeywords.some(kw => upper.includes(kw));

  // Patrón explícito de tribunal foráneo como "tri. J5 MERIDA", "J5 TACHIRA", "C5 STA BARBARA", "CORTE MERIDA", "TRI. C1 MERIDA"
  const hasExternalPattern = 
    /^(?:TRI\.?|TRIB\.?|TRIBUNAL|JUZGADO|CORTE)\s+/i.test(upper) ||
    /^(?:TRI\.?\s*)?(?:[CJSE]\d{1,2}|\d{1,2}[CJSE])\s+[A-Z]/i.test(upper) ||
    /^(?:TRI\.?\s*)?(?:CONTROL|JUICIO|SALA|EJECUCION)\s+\d+\s+[A-Z]/i.test(upper) ||
    /^(?:TRI\.?\s*)?(?:CORTE|JUZGADO|TRIBUNAL)\s+[A-Z]/i.test(upper);

  if (hasExternalKeyword || hasExternalPattern) {
    // Limpiar prefijo "TRI.", "TRI ", "TRIB. ", "TRIB ", etc.
    let clean = raw.replace(/^(?:TRI\.?|TRIB\.?|TRIBUNAL|JUZGADO)\s*:?\s*/i, '').trim();
    if (!clean) clean = raw;
    return { isExternal: true, tribunalOtro: clean.toUpperCase() };
  }

  return { isExternal: false, tribunalOtro: '' };
}

/**
 * Comprueba si una cadena parece corresponder a un código o nombre de Tribunal (local o externo)
 */
export function isLikelyTribunal(val: string, tribunales: TribunalInfo[]): boolean {
  if (!val) return false;
  const raw = val.trim().toUpperCase();
  const clean = raw.replace(/[\s.-]/g, '');
  if (!clean || clean.length > 35) return false;

  // Un número puro, hora o fecha NUNCA es un tribunal
  if (/^\d+$/.test(clean) || isLikelyDateString(raw) || isLikelyTime(raw)) return false;

  // Si coincide con tribunal externo detectado
  if (detectExternalTribunal(val).isExternal) return true;

  // Si comienza con prefijo judicial explícito
  if (/^(?:TRI\.?|TRIB\.?|TRIBUNAL|JUZGADO|CORTE)\b/i.test(raw)) return true;

  // Si coincide exactamente con el código de algún tribunal registrado (C1, J1, C2, etc.)
  if (tribunales && tribunales.some(t => {
    const tCode = t.codigo.toUpperCase().replace(/[\s.-]/g, '');
    return tCode === clean;
  })) {
    return true;
  }

  // Patrones tipo C1..C15, 1C..15C, J1..J9, 1J..9J, S1..S9, 1S..9S, E1..E9, 1E..9E
  if (/^([CJSE]\d{1,2}|\d{1,2}[CJSE])$/i.test(clean)) {
    return true;
  }

  // Patrones tipo CONTROL 1, JUICIO 2, SALA 1, EJECUCION 1
  if (/^(CONTROL|JUICIO|SALA|EJECUCION|TRIBUNAL|JUZGADO)\d{1,2}$/i.test(clean)) {
    return true;
  }

  // Coincidencia con nombre completo solo si tiene letras y al menos 3 caracteres
  if (tribunales && clean.length >= 3 && /[A-Z]/.test(clean)) {
    if (tribunales.some(t => t.nombre.toUpperCase().includes(raw) || raw.includes(t.nombre.toUpperCase()))) {
      return true;
    }
  }

  return false;
}

/**
 * Normaliza el código de tribunal.
 * Si es foráneo o no registrado localmente -> retorna 'OTRO'.
 */
export function normalizeTribunalCode(val: string, tribunales: TribunalInfo[], defaultTribunal: string): string {
  if (!val || !val.trim()) return defaultTribunal;
  const raw = val.trim().toUpperCase().replace(/\s+/g, ' ');

  // Si es un número puro, hora o fecha, no es tribunal
  if (/^\d+$/.test(raw) || isLikelyDateString(raw) || isLikelyTime(raw)) return defaultTribunal;

  // Detección de tribunales foráneos o no registrados localmente -> OTRO
  const ext = detectExternalTribunal(raw);
  if (ext.isExternal) {
    return 'OTRO';
  }

  // 1. Coincidencia exacta con código
  const exact = tribunales.find(t => t.codigo.toUpperCase() === raw);
  if (exact) return exact.codigo;

  // 2. Normalización de formatos tipo "CONTROL 1" -> "C1", "JUICIO 2" -> "J2"
  const nameToCodeMatch = raw.match(/^(CONTROL|JUICIO|SALA|EJECUCION)[ -]?(\d+)$/);
  if (nameToCodeMatch) {
    const prefix = nameToCodeMatch[1] === 'CONTROL' ? 'C' :
                   nameToCodeMatch[1] === 'JUICIO' ? 'J' :
                   nameToCodeMatch[1] === 'SALA' ? 'S' : 'E';
    const candidate = `${prefix}${nameToCodeMatch[2]}`;
    const match = tribunales.find(t => t.codigo.toUpperCase() === candidate);
    if (match) return match.codigo;
    return candidate;
  }

  // 3. Normalización de formatos tipo "1C" -> "C1", "1-C" -> "C1", "C-1" -> "C1", "C 1" -> "C1"
  const invertMatch = raw.match(/^(\d{1,2})[- ]?([A-Z]{1,3})$/);
  if (invertMatch) {
    const candidate = `${invertMatch[2]}${invertMatch[1]}`;
    const matchInv = tribunales.find(t => t.codigo.toUpperCase() === candidate);
    if (matchInv) return matchInv.codigo;
    if (/^[A-Z]+\d+$/.test(candidate)) return candidate;
  }
  const dashMatch = raw.match(/^([A-Z]{1,3})[- ]?(\d{1,2})$/);
  if (dashMatch) {
    const candidate = `${dashMatch[1]}${dashMatch[2]}`;
    const matchDash = tribunales.find(t => t.codigo.toUpperCase() === candidate);
    if (matchDash) return matchDash.codigo;
    if (/^[A-Z]+\d+$/.test(candidate)) return candidate;
  }

  // 4. Coincidencia parcial con nombre
  if (raw.length >= 3 && /[A-Z]/.test(raw)) {
    const byName = tribunales.find(t => 
      t.nombre.toUpperCase().includes(raw) || 
      raw.includes(t.nombre.toUpperCase())
    );
    if (byName) return byName.codigo;
  }

  // 5. Si parece tribunal pero no está en la lista registrada localmente -> OTRO
  if (isLikelyTribunal(raw, tribunales) || /^(?:TRI\.?|CORTE|JUZGADO|TRIBUNAL)\b/i.test(raw)) {
    return 'OTRO';
  }

  // Fallback si es código local razonable
  if (raw.length <= 8 && /[A-Z]/.test(raw)) return raw;
  return defaultTribunal;
}

/**
 * Normaliza el Artículo del COPP (admite número, prefijo ART o texto descriptivo)
 */
export function normalizeArticuloCOPP(val: string): ArticuloCOPP {
  if (!val || !val.trim()) return '';
  const clean = val.toUpperCase().trim();
  const upper = clean.replace(/[\s.-]/g, '');

  if (
    upper.includes('S165') || 
    upper.includes('S_165') || 
    upper.includes('S-165') || 
    upper === 'S165' ||
    clean.includes('S 165') ||
    clean.includes('S. 165') ||
    clean.includes('S.165') ||
    clean.includes('SUSTITUTIV')
  ) {
    return 'S_165';
  }
  if (upper === '167' || upper.startsWith('ART167') || upper.endsWith('167') || upper.includes('167') || clean.includes('PERSONAL')) return '167';
  if (upper === '168' || upper.startsWith('ART168') || upper.endsWith('168') || upper.includes('168') || clean.includes('FIRMADA')) return '168';
  if (upper === '169' || upper.startsWith('ART169') || upper.endsWith('169') || upper.includes('169') || clean.includes('TELEMAT') || clean.includes('TELEMÁT')) return '169';
  if (upper === '170' || upper.startsWith('ART170') || upper.endsWith('170') || upper.includes('170') || clean.includes('OTROS') || clean.includes('MEDIOS DE OTROS')) return '170';
  if (upper === '171' || upper.startsWith('ART171') || upper.endsWith('171') || upper.includes('171') || clean.includes('NEGATIVA')) return '171';
  if (upper === '165' || upper.startsWith('ART165') || upper.endsWith('165') || upper.includes('165') || clean.includes('PUERTAS')) return '165';
  return '';
}

/**
 * Normaliza el nombre del alguacil:
 * Filtra horas, tribunales y fechas para que NUNCA se peguen como alguacil.
 */
export function normalizeAlguacilName(val: string, alguaciles: Alguacil[], defaultAlguacil: string, tribunales: TribunalInfo[] = []): string {
  if (!val || !val.trim()) return defaultAlguacil;
  const raw = val.trim().replace(/\s+/g, ' ');
  const upper = raw.toUpperCase();

  // NUNCA es alguacil si es hora, fecha, tribunal o indicador vacío
  if (
    upper === '-' || 
    upper === 'S/A' || 
    upper === 'N/A' || 
    upper === 'NO' || 
    upper === 'SIN ALGUACIL' || 
    upper === 'S/N' ||
    isLikelyTime(raw) ||
    isLikelyDateString(raw) ||
    detectExternalTribunal(raw).isExternal ||
    isLikelyTribunal(raw, tribunales) ||
    /^(?:TRI\.?|TRIB\.?|CORTE|JUZGADO|TRIBUNAL)\b/i.test(upper) ||
    /^(?:[CJSE]\d+|\d+[CJSE])\b/i.test(upper)
  ) {
    return '';
  }

  const match = alguaciles.find(a => 
    a.nombre.toUpperCase() === upper ||
    a.nombre.toUpperCase().includes(upper) || 
    upper.includes(a.nombre.toUpperCase())
  );
  if (match) return match.nombre;

  // Permitir cualquier alguacil externo o no registrado que sea un nombre válido
  return raw.toUpperCase();
}

/**
 * Detecta si una línea de texto corresponde a una cabecera de Excel
 */
export function isExcelHeaderLine(line: string): boolean {
  if (!line || !line.trim()) return false;
  const parts = line.split(/[\t;,]/).map(p => p.trim().toUpperCase());
  
  const headerTokens = new Set([
    '#', 'ITEM', 'Nº', 'N°', 'NRO', 'NO.', 'CONSECUTIVO',
    'CAUSA', 'Nº DE CAUSA', 'EXPEDIENTE', 'EXP', 'EXP.',
    'BOLETA', 'BOLETA Nº', 'BOL', 'BOL.', 'OFICIO',
    'NOTIFICADO', 'CITADO', 'NOTIFICADO Y CITADO', 'NOTIFICADO / CITADO', 'DESTINATARIO', 'PERSONA',
    'CARÁCTER', 'CARACTER', 'CONDICION', 'CONDICIÓN', 'CALIDAD', 'ROL',
    'AUDIENCIA', 'FECHA AUDIENCIA', 'FECHA DE AUDIENCIA', 'F. AUD', 'F.AUD', 'HORA',
    'FECHA DE ASIGNACION', 'FECHA DE ASIGNACIÓN', 'FECHA ASIGNACION', 'FECHA ASIGNACIÓN', 'ASIGNACION', 'ASIGNACIÓN', 'F. ASIG', 'F.ASIG', 'INGRESO', 'ENTRADA',
    'TRI', 'TRI.', 'TRIB', 'TRIB.', 'TRIBUNAL', 'JUZGADO',
    'ART', 'ART.', 'ARTICULO', 'ARTÍCULO', 'COPP',
    '167', '168', '169', '170', '171', '165', 'S 165', 'S165', 'S. 165',
    'ALGUACIL', 'ALGUACIL DE CITACION QUE PRACTICA', 'FUNCIONARIO', 'PRACTICA', 'PRÁCTICA',
    'SECCION', 'SECCIÓN', 'RUTA', 'ESTADO'
  ]);

  let matches = 0;
  for (const part of parts) {
    if (!part) continue;
    if (headerTokens.has(part)) {
      matches++;
      continue;
    }
    if (
      part.includes('CAUSA') || 
      part.includes('BOLETA') || 
      part.includes('NOTIFICADO') || 
      part.includes('AUDIENCIA') || 
      part.includes('ALGUACIL') || 
      part.includes('ASIGNAC') ||
      part.startsWith('ART.') ||
      part === 'TRI' ||
      part === 'TRI.'
    ) {
      matches++;
    }
  }

  return matches >= 2;
}

interface ColumnIndexMap {
  itemCol: number;
  causaCol: number;
  boletaCol: number;
  notificadoCol: number;
  caracterCol: number;
  audienciaCol: number;
  horaCol: number;
  fechaAsigCol: number;
  tribunalCol: number;
  articuloCol: number;
  alguacilCol: number;
  seccionCol: number;
  col167: number;
  col168: number;
  col169: number;
  col170: number;
  col171: number;
  col165: number;
  colS165: number;
}

/**
 * Detecta índices de columnas a partir de la cabecera copiada de Excel
 */
function detectHeaderColumns(headerCols: string[]): ColumnIndexMap | null {
  const map: ColumnIndexMap = {
    itemCol: -1,
    causaCol: -1,
    boletaCol: -1,
    notificadoCol: -1,
    caracterCol: -1,
    audienciaCol: -1,
    horaCol: -1,
    fechaAsigCol: -1,
    tribunalCol: -1,
    articuloCol: -1,
    alguacilCol: -1,
    seccionCol: -1,
    col167: -1,
    col168: -1,
    col169: -1,
    col170: -1,
    col171: -1,
    col165: -1,
    colS165: -1,
  };

  headerCols.forEach((col, idx) => {
    const raw = col.toUpperCase().trim();
    const u = raw.replace(/\s+/g, ' ');
    const compact = raw.replace(/[\s.-]/g, '');

    if (u === '#' || u === 'ITEM' || u === 'Nº' || u === 'N°' || u === 'NO.' || u === 'CONSECUTIVO' || u === 'NRO') {
      map.itemCol = idx;
    } else if (u.includes('CAUSA') || u.includes('EXPEDIENTE') || u === 'EXP' || u.startsWith('EXP.')) {
      map.causaCol = idx;
    } else if (u.includes('BOLETA') || u === 'BOL' || u === 'BOL.' || u.includes('OFICIO')) {
      map.boletaCol = idx;
    } else if (u.includes('NOTIFICADO') || u.includes('CITADO') || u.includes('NOMBRE') || u.includes('DESTINATARIO') || u.includes('PERSONA')) {
      map.notificadoCol = idx;
    } else if (u.includes('CARÁCTER') || u.includes('CARACTER') || u.includes('CONDICION') || u.includes('CONDICIÓN') || u.includes('CALIDAD') || u.includes('ROL')) {
      map.caracterCol = idx;
    } else if (u.includes('HORA')) {
      map.horaCol = idx;
    } else if (
      u.includes('ASIG') || 
      u.includes('INGRESO') || 
      u.includes('ENTRADA') || 
      u.includes('RECEPCION') || 
      u.includes('RECEPCIÓN')
    ) {
      map.fechaAsigCol = idx;
    } else if (u.includes('AUDIENCIA') || u.includes('F. AUD') || u.includes('FECHA AUD') || u === 'F.AUD') {
      map.audienciaCol = idx;
    } else if (u === 'FECHA') {
      // Si la columna es simplemente "FECHA", puede ser asignación o audiencia
      if (map.audienciaCol === -1) {
        map.audienciaCol = idx;
      } else if (map.fechaAsigCol === -1) {
        map.fechaAsigCol = idx;
      }
    } else if (
      compact === 'TRI' || 
      compact === 'TRIB' || 
      compact.startsWith('TRI') || 
      u === 'TRI' || 
      u === 'TRI.' || 
      u.startsWith('TRI ') || 
      u.startsWith('TRI.') ||
      u.includes('TRIBUNAL') || 
      u.includes('JUZGADO') ||
      u.includes('CORTE')
    ) {
      map.tribunalCol = idx;
    } else if (compact === 'S165' || compact === 'ARTS165' || u.includes('S 165') || u.includes('S165') || u.includes('S_165')) {
      map.colS165 = idx;
    } else if (compact === '167' || compact === 'ART167') {
      map.col167 = idx;
    } else if (compact === '168' || compact === 'ART168') {
      map.col168 = idx;
    } else if (compact === '169' || compact === 'ART169') {
      map.col169 = idx;
    } else if (compact === '170' || compact === 'ART170') {
      map.col170 = idx;
    } else if (compact === '171' || compact === 'ART171') {
      map.col171 = idx;
    } else if (compact === '165' || compact === 'ART165') {
      map.col165 = idx;
    } else if (
      compact === 'ART' || 
      compact === 'ARTCOPP' || 
      compact.startsWith('ART') || 
      u === 'ART' || 
      u === 'ART.' || 
      u.startsWith('ART ') || 
      u.startsWith('ART.') ||
      u.includes('ARTICULO') || 
      u.includes('ARTÍCULO') || 
      u.includes('COPP')
    ) {
      map.articuloCol = idx;
    } else if (
      u.includes('ALGUACIL') || 
      u.includes('FUNCIONARIO') || 
      u.includes('PRACTICA') || 
      u.includes('PRÁCTICA') || 
      u.includes('CITADOR') || 
      u.includes('NOTIFICADOR') || 
      u.includes('ASIGNADO') || 
      u.includes('RESPONSABLE')
    ) {
      map.alguacilCol = idx;
    } else if (u.includes('SECCION') || u.includes('SECCIÓN') || u.includes('RUTA') || u.includes('DESTINO')) {
      map.seccionCol = idx;
    }
  });

  let detectedCount = 0;
  if (map.causaCol !== -1) detectedCount++;
  if (map.boletaCol !== -1) detectedCount++;
  if (map.notificadoCol !== -1) detectedCount++;
  if (map.audienciaCol !== -1 || map.fechaAsigCol !== -1) detectedCount++;
  if (map.tribunalCol !== -1) detectedCount++;
  if (map.articuloCol !== -1 || map.col167 !== -1) detectedCount++;
  if (map.alguacilCol !== -1) detectedCount++;

  if (detectedCount >= 2) {
    return map;
  }
  return null;
}

/**
 * Parsea el texto copiado de Excel (tab-separated o CSV)
 * Soporta:
 * - Detección automática de Carácter según prefijos en Notificado:
 *   VICT. -> VICTIMA, IMP. -> IMPUTADO, FUN. -> FUNCIONARIO, FISCALIA -> FISCALIA, INV. -> INVESTIGADO, ACUS. -> ACUSADO, TESTIGO -> TESTIGO
 * - Pegado fiel de fecha de asignación y fecha de audiencia
 * - Aislamiento de horas (evita que la hora se pegue en Alguacil)
 * - Tribunales foráneos y no registrados (ej: tri. J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA) relacionados en OTRO con especificación
 */
export function parseExcelClipboardText(
  rawText: string,
  options: {
    defaultCausaPrefix: string;
    defaultTribunal: string;
    defaultAlguacil: string;
    defaultSeccion: SeccionRuta;
    tribunales: TribunalInfo[];
    alguaciles: Alguacil[];
  }
): ParsedExcelRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  const results: ParsedExcelRow[] = [];
  let headerMap: ColumnIndexMap | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Dividir columnas
    let cols: string[] = [];
    if (line.includes('\t')) {
      cols = line.split('\t');
    } else if (line.includes(';')) {
      cols = line.split(';');
    } else {
      cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    }

    cols = cols.map(c => c.trim().replace(/^["']|["']$/g, '').trim());

    if (cols.length === 0 || cols.every(c => c.length === 0)) {
      continue;
    }

    // Verificar si la primera fila es cabecera
    if (i === 0 && isExcelHeaderLine(line)) {
      headerMap = detectHeaderColumns(cols);
      continue;
    }

    let colItem = '';
    let colCausa = '';
    let colBoleta = '';
    let colNotificado = '';
    let colCaracter = '';
    let colAudiencia = '';
    let colHora = '';
    let colFechaAsig = '';
    let colTribunal = '';
    let colTribunalOtro = '';
    let colArticulo = '';
    let colAlguacil = '';
    let colSeccion = '';
    let isPartialRow = false;

    const isMarked = (val: string | undefined): boolean => {
      if (!val) return false;
      const v = val.trim().toUpperCase();
      // Cualquier número mayor que 0 (1, 2, 3, etc.) se reconoce como artículo marcado
      const numVal = Number(v);
      if (!isNaN(numVal) && numVal > 0) return true;
      return (
        v === '1' || 
        v === '1.0' || 
        v === '1,0' || 
        v === '2' || 
        v === '2.0' || 
        v === '2,0' || 
        v === 'X' || 
        v === 'SI' || 
        v === 'SÍ' || 
        v === 'S' || 
        v === '✓' || 
        v === 'V' || 
        v === '*' || 
        v === 'TRUE' || 
        v === 'OK'
      );
    };

    if (headerMap) {
      // Usar mapeo detectado de la cabecera
      colItem = headerMap.itemCol !== -1 ? cols[headerMap.itemCol] || '' : '';
      colCausa = headerMap.causaCol !== -1 ? cols[headerMap.causaCol] || '' : '';
      colBoleta = headerMap.boletaCol !== -1 ? cols[headerMap.boletaCol] || '' : '';
      colNotificado = headerMap.notificadoCol !== -1 ? cols[headerMap.notificadoCol] || '' : '';
      colCaracter = headerMap.caracterCol !== -1 ? cols[headerMap.caracterCol] || '' : '';
      colAudiencia = headerMap.audienciaCol !== -1 ? cols[headerMap.audienciaCol] || '' : '';
      colHora = headerMap.horaCol !== -1 ? cols[headerMap.horaCol] || '' : '';
      colFechaAsig = headerMap.fechaAsigCol !== -1 ? cols[headerMap.fechaAsigCol] || '' : '';
      colTribunal = headerMap.tribunalCol !== -1 ? cols[headerMap.tribunalCol] || '' : '';
      colAlguacil = headerMap.alguacilCol !== -1 ? cols[headerMap.alguacilCol] || '' : '';
      colSeccion = headerMap.seccionCol !== -1 ? cols[headerMap.seccionCol] || '' : '';

      // Detección de artículo desde las 7 columnas individuales
      if (headerMap.col167 !== -1 && isMarked(cols[headerMap.col167])) colArticulo = '167';
      else if (headerMap.col168 !== -1 && isMarked(cols[headerMap.col168])) colArticulo = '168';
      else if (headerMap.col169 !== -1 && isMarked(cols[headerMap.col169])) colArticulo = '169';
      else if (headerMap.col170 !== -1 && isMarked(cols[headerMap.col170])) colArticulo = '170';
      else if (headerMap.col171 !== -1 && isMarked(cols[headerMap.col171])) colArticulo = '171';
      else if (headerMap.col165 !== -1 && isMarked(cols[headerMap.col165])) colArticulo = '165';
      else if (headerMap.colS165 !== -1 && isMarked(cols[headerMap.colS165])) colArticulo = 'S_165';

      // Si no se encontró en las 7 columnas individuales, buscar en columna general ART
      if (!colArticulo && headerMap.articuloCol !== -1) {
        colArticulo = cols[headerMap.articuloCol] || '';
      }

      if (headerMap.causaCol === -1 && headerMap.boletaCol === -1) {
        isPartialRow = true;
      }
    } else {
      // Sin cabecera explícita: Detección inteligente por contenido de celda
      let remCols = [...cols];

      // Caso fila de asignación parcial
      if (remCols.length <= 10 && !remCols.some(c => c.length >= 3 && /^\d+$/.test(c.replace(/[-/]/g, '')))) {
        isPartialRow = true;
      }

      // Si la primera columna es un número de ítem secuencial (1..999)
      if (remCols.length > 0 && /^\d{1,4}$/.test(remCols[0].trim())) {
        const itemVal = parseInt(remCols[0].trim(), 10);
        if (itemVal > 0 && itemVal < 5000) {
          colItem = remCols[0].trim();
          remCols = remCols.slice(1);
        }
      }

      if (remCols.length >= 3) {
        colCausa = remCols[0] || '';
        colBoleta = remCols[1] || '';
        colNotificado = remCols[2] || '';

        const used = new Set<number>();
        used.add(0);
        used.add(1);
        used.add(2);

        // A) Identificar columnas de HORA
        for (let r = 3; r < remCols.length; r++) {
          if (!used.has(r) && isLikelyTime(remCols[r])) {
            colHora = remCols[r];
            used.add(r);
            break;
          }
        }

        // B) Identificar columnas de Fecha (Audiencia y Asignación)
        const dateIndices: number[] = [];
        for (let r = 3; r < remCols.length; r++) {
          if (!used.has(r) && isLikelyDateString(remCols[r])) {
            dateIndices.push(r);
            used.add(r);
          }
        }

        if (dateIndices.length === 1) {
          const singleDate = remCols[dateIndices[0]];
          if (singleDate.toUpperCase().includes('NOTIF') || singleDate.toUpperCase().includes('SOBRESE')) {
            colAudiencia = singleDate;
          } else {
            colAudiencia = singleDate;
            colFechaAsig = singleDate;
          }
        } else if (dateIndices.length >= 2) {
          const d0 = remCols[dateIndices[0]];
          const d1 = remCols[dateIndices[1]];
          // Si una dice NOTIFICACION o similar
          if (d0.toUpperCase().includes('NOTIF') || d0.toUpperCase().includes('SOBRESE')) {
            colAudiencia = d0;
            colFechaAsig = d1;
          } else if (d1.toUpperCase().includes('NOTIF') || d1.toUpperCase().includes('SOBRESE')) {
            colAudiencia = d1;
            colFechaAsig = d0;
          } else {
            // En plantillas judiciales en Venezuela, la primera fecha (col 4/5) es ASIGNACIÓN
            // y la segunda fecha (col 5/6) es AUDIENCIA
            const norm0 = normalizeDateString(d0).formatted;
            const norm1 = normalizeDateString(d1).formatted;
            if (norm0 && norm1 && norm0 > norm1) {
              colFechaAsig = d1;
              colAudiencia = d0;
            } else {
              colFechaAsig = d0;
              colAudiencia = d1;
            }
          }
        }

        // C) Identificar Tribunal (Foráneo o Local)
        let likelyTribIdx = -1;
        for (let r = 3; r < remCols.length; r++) {
          if (!used.has(r)) {
            const ext = detectExternalTribunal(remCols[r]);
            if (ext.isExternal) {
              likelyTribIdx = r;
              colTribunal = 'OTRO';
              colTribunalOtro = ext.tribunalOtro;
              used.add(r);
              break;
            } else if (isLikelyTribunal(remCols[r], options.tribunales)) {
              likelyTribIdx = r;
              colTribunal = remCols[r];
              used.add(r);
              break;
            }
          }
        }

        const COPP_KEYS: ArticuloCOPP[] = ['167', '168', '169', '170', '171', '165', 'S_165'];

        // D) Bloque de 7 columnas COPP entre fechas y tribunal
        if (likelyTribIdx !== -1) {
          const afterDatesIdx = dateIndices.length > 0 ? Math.max(...dateIndices) + 1 : 3;
          if (likelyTribIdx > afterDatesIdx) {
            const gapCols = remCols.slice(afterDatesIdx, likelyTribIdx);
            const allMarksOrEmpty = gapCols.every(c => {
              const v = (c || '').trim();
              return v === '' || isMarked(v) || /^\d+$/.test(v);
            });
            if (allMarksOrEmpty && gapCols.length >= 4 && gapCols.length <= 8) {
              for (let k = 0; k < gapCols.length && k < COPP_KEYS.length; k++) {
                used.add(afterDatesIdx + k);
                if (isMarked(gapCols[k])) {
                  colArticulo = COPP_KEYS[k];
                }
              }
            }
          }
        }

        // E) Si aún no se detectó artículo por gap, buscar ventana de 7..5 columnas
        if (!colArticulo) {
          for (const len of [7, 6, 5]) {
            for (let s = 3; s <= remCols.length - len; s++) {
              const indices = Array.from({ length: len }, (_, i) => s + i);
              if (indices.some(idx => used.has(idx))) continue;
              const slice = indices.map(i => remCols[i]);
              const isValidSlice = slice.every(c => {
                const v = (c || '').trim();
                return v === '' || isMarked(v) || /^\d+$/.test(v);
              });
              if (isValidSlice) {
                indices.forEach(idx => used.add(idx));
                for (let k = 0; k < slice.length && k < COPP_KEYS.length; k++) {
                  if (isMarked(slice[k])) {
                    colArticulo = COPP_KEYS[k];
                    break;
                  }
                }
                break;
              }
            }
            if (colArticulo) break;
          }
        }

        // F) Si aún no hay tribunal, buscar de nuevo
        if (!colTribunal) {
          for (let r = 3; r < remCols.length; r++) {
            if (!used.has(r)) {
              const ext = detectExternalTribunal(remCols[r]);
              if (ext.isExternal) {
                colTribunal = 'OTRO';
                colTribunalOtro = ext.tribunalOtro;
                used.add(r);
                break;
              } else if (isLikelyTribunal(remCols[r], options.tribunales)) {
                colTribunal = remCols[r];
                used.add(r);
                break;
              }
            }
          }
        }

        // G) Buscar artículo único si no se detectó
        if (!colArticulo) {
          for (let r = 3; r < remCols.length; r++) {
            if (!used.has(r)) {
              const art = normalizeArticuloCOPP(remCols[r]);
              if (art) {
                colArticulo = art;
                used.add(r);
                break;
              }
            }
          }
        }

        // H) Buscar Carácter
        for (let r = 3; r < remCols.length; r++) {
          if (!used.has(r)) {
            const tc = normalizeTipoCitado(remCols[r]);
            if (tc) {
              colCaracter = remCols[r];
              used.add(r);
              break;
            }
          }
        }

        // I) Buscar Alguacil (NUNCA hora, NUNCA tribunal, NUNCA fecha, NUNCA artículo)
        for (let r = 3; r < remCols.length; r++) {
          if (!used.has(r)) {
            const val = remCols[r].trim();
            if (
              val && 
              !/^\d+$/.test(val) && 
              val !== '-' && 
              !isLikelyDateString(val) && 
              !isLikelyTime(val) && 
              !isLikelyTribunal(val, options.tribunales) &&
              !detectExternalTribunal(val).isExternal &&
              !normalizeArticuloCOPP(val)
            ) {
              colAlguacil = val;
              used.add(r);
              break;
            }
          }
        }
      }
    }

    // --- SANEAMIENTO POST-EXTRACCIÓN (Garantiza que ningún valor quede en la columna equivocada) ---

    // 1. Si colAlguacil es una hora (ej. 10:00 AM, 09:30), aislarla en colHora
    if (colAlguacil && isLikelyTime(colAlguacil)) {
      if (!colHora) colHora = colAlguacil;
      colAlguacil = '';
    }

    // 2. Si colAlguacil es un tribunal (ej. tri. J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA, C1, etc.)
    // NUNCA puede ser alguacil, transferir a tribunal
    const extAlguacil = detectExternalTribunal(colAlguacil);
    if (extAlguacil.isExternal || isLikelyTribunal(colAlguacil, options.tribunales) || /^(?:TRI\.?|CORTE|JUZGADO|TRIBUNAL)\b/i.test(colAlguacil)) {
      if (!colTribunal || colTribunal === options.defaultTribunal) {
        if (extAlguacil.isExternal) {
          colTribunal = 'OTRO';
          colTribunalOtro = extAlguacil.tribunalOtro;
        } else {
          colTribunal = colAlguacil;
        }
      }
      colAlguacil = '';
    }

    // 3. Si colAlguacil es una fecha, transferir a fecha asignación
    if (colAlguacil && isLikelyDateString(colAlguacil)) {
      if (!colFechaAsig) colFechaAsig = colAlguacil;
      colAlguacil = '';
    }

    // 4. Si colTribunal tiene hora o fecha por error, limpiarlo
    if (colTribunal && (isLikelyTime(colTribunal) || isLikelyDateString(colTribunal))) {
      colTribunal = options.defaultTribunal;
    }

    // 5. Escaneo de rescate para el Artículo COPP si aún está en blanco
    if (!colArticulo) {
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        if (headerMap) {
          if (cIdx === headerMap.causaCol || cIdx === headerMap.boletaCol || cIdx === headerMap.notificadoCol) continue;
        } else if (cIdx <= 2) {
          continue;
        }
        const candidate = cols[cIdx];
        if (candidate) {
          const normArt = normalizeArticuloCOPP(candidate);
          if (normArt) {
            colArticulo = normArt;
            break;
          }
        }
      }
    }

    // 6. Escaneo de rescate para Tribunal si aún está en blanco
    if (!colTribunal || colTribunal === options.defaultTribunal) {
      for (let cIdx = 0; cIdx < cols.length; cIdx++) {
        if (headerMap && (cIdx === headerMap.causaCol || cIdx === headerMap.boletaCol || cIdx === headerMap.notificadoCol)) continue;
        else if (cIdx <= 2) continue;
        const candidate = cols[cIdx];
        if (candidate) {
          const ext = detectExternalTribunal(candidate);
          if (ext.isExternal) {
            colTribunal = 'OTRO';
            colTribunalOtro = ext.tribunalOtro;
            break;
          } else if (isLikelyTribunal(candidate, options.tribunales)) {
            colTribunal = candidate;
            break;
          }
        }
      }
    }

    // Número de ítem si vino en la columna #
    const numeroItem = /^\d+$/.test(colItem.trim()) ? parseInt(colItem.trim(), 10) : undefined;

    // Procesar Causa
    let numeroCausa = colCausa.toUpperCase().trim();
    if (numeroCausa) {
      if (!numeroCausa.startsWith('LP11-') && !numeroCausa.includes('-')) {
        const cleanPrefix = options.defaultCausaPrefix.endsWith('-') 
          ? options.defaultCausaPrefix 
          : `${options.defaultCausaPrefix}-`;
        numeroCausa = `${cleanPrefix}${numeroCausa}`;
      }
    }

    // Procesar Boleta
    const boletaNumero = colBoleta.trim();

    // Procesar Notificado
    let notificadoCitado = colNotificado.toUpperCase().trim();

    // DETECCIÓN AUTOMÁTICA DE CARÁCTER:
    // "Cuando en Notificado / Citado detecte VICT. (VICTIMA) IMP. (IMPUTADO) FUN. (FUNCIONARIO) FISCALIA (FISCALIA MP) INV. (INVESTIGADO) ACUS. (ACUSADO) TESTIGO (TESTIGO) ACTUALICE EL CARÁCTER AUTOMATICAMENTE."
    let tipoCitado: TipoCitado = 'IMPUTADO';
    const autoDetectFromNotif = detectCaracterFromText(colNotificado);
    if (autoDetectFromNotif.detectedTipo) {
      tipoCitado = autoDetectFromNotif.detectedTipo;
      if (autoDetectFromNotif.cleanName) {
        notificadoCitado = autoDetectFromNotif.cleanName.toUpperCase().trim();
      }
    } else if (colCaracter) {
      const detected = normalizeTipoCitado(colCaracter);
      if (detected) {
        tipoCitado = detected;
      }
    }

    // Detección automática de SOBRESEIMIENTO en toda la fila
    const rowRawText = cols.join(' ').toUpperCase();
    const esSobreseimiento = 
      rowRawText.includes('SOBRESE') ||
      colAudiencia.toUpperCase().includes('SOBRESE') ||
      colNotificado.toUpperCase().includes('SOBRESE') ||
      colCaracter.toUpperCase().includes('SOBRESE') ||
      colSeccion.toUpperCase().includes('SOBRESE') ||
      options.defaultSeccion === 'SOBRESEIMIENTO';

    // Determinar sección de ruta final
    let seccionRuta: SeccionRuta = options.defaultSeccion;
    if (esSobreseimiento) {
      seccionRuta = 'SOBRESEIMIENTO';
    } else if (colSeccion) {
      const seccRaw = colSeccion.toUpperCase();
      if (seccRaw.includes('INTERNA')) seccionRuta = 'RUTA_INTERNA';
      else if (seccRaw.includes('CORREO') || seccRaw.includes('EXT')) seccionRuta = 'CORREO_EXT';
      else if (seccRaw.includes('MERIDA') || seccRaw.includes('MÉRIDA') || seccRaw.includes('ESTADO')) seccionRuta = 'OTROS_ESTADOS_MERIDA';
      else if (seccRaw.includes('NOTIF') || seccRaw.includes('CITAC')) seccionRuta = 'RUTA_NOTIFICACION_CITACION';
    }

    // Procesar Audiencia / Notificación
    let fechaAudiencia = '';
    let esSoloNotificacion = false;

    if (esSobreseimiento) {
      esSoloNotificacion = true;
      fechaAudiencia = 'NOTIFICACION';
    } else if (colAudiencia) {
      const dateInfo = normalizeDateString(colAudiencia);
      if (dateInfo.isDate) {
        fechaAudiencia = dateInfo.formatted;
        esSoloNotificacion = false;
      } else {
        esSoloNotificacion = true;
        fechaAudiencia = '';
      }
    } else {
      esSoloNotificacion = true;
      fechaAudiencia = '';
    }

    // Procesar Fecha de Asignación
    let fechaAsignacion: string | undefined = undefined;
    if (colFechaAsig) {
      const asigInfo = normalizeDateString(colFechaAsig);
      if (asigInfo.isDate) {
        fechaAsignacion = asigInfo.formatted;
      }
    }

    // Procesar Tribunal (TRI)
    // "cambiar el nombre del tribunal de TACHIRA por OTRO y que especifique, ya que aquí se va relacionar los de otro tribunal.
    // quiero que también pegue tribunales que no no es local, se relacionaría en otro y con el tribunal que se esta pegando
    // por ejemplo tri. J5 MERIDA O CORTE MERIDA O J5 TACHIRA C5 STA BARBARA TODO ESE TIPO DE TRIBUNALES SE RELACIONAN EN OTROS"
    let tribunal = options.defaultTribunal;
    let tribunalOtro = colTribunalOtro || undefined;

    const extTrib = detectExternalTribunal(colTribunal);
    if (extTrib.isExternal) {
      tribunal = 'OTRO';
      tribunalOtro = extTrib.tribunalOtro;
    } else if (colTribunal) {
      const code = normalizeTribunalCode(colTribunal, options.tribunales, options.defaultTribunal);
      tribunal = code;
      if (code === 'OTRO') {
        if (!tribunalOtro) {
          tribunalOtro = colTribunal.replace(/^(?:TRI\.?|TRIB\.?|TRIBUNAL|JUZGADO)\s*:?\s*/i, '').trim().toUpperCase();
        }
      } else if (!options.tribunales.some(t => t.codigo.toUpperCase() === code.toUpperCase())) {
        tribunal = 'OTRO';
        if (!tribunalOtro) {
          tribunalOtro = colTribunal.replace(/^(?:TRI\.?|TRIB\.?|TRIBUNAL|JUZGADO)\s*:?\s*/i, '').trim().toUpperCase();
        }
      }
    }

    // Procesar Artículo COPP (ART)
    const articuloCOPP = normalizeArticuloCOPP(colArticulo);

    // Procesar Alguacil (Permitiendo tanto registrados como nuevos/externos, pero nunca horas ni tribunales)
    let alguacilPractica = '';
    if (
      colAlguacil && 
      !isLikelyTime(colAlguacil) && 
      !isLikelyDateString(colAlguacil) &&
      !detectExternalTribunal(colAlguacil).isExternal &&
      !isLikelyTribunal(colAlguacil, options.tribunales)
    ) {
      alguacilPractica = normalizeAlguacilName(colAlguacil, options.alguaciles, options.defaultAlguacil, options.tribunales);
    } else {
      alguacilPractica = options.defaultAlguacil;
    }

    const isPartialCols = isPartialRow || (!numeroCausa && !boletaNumero && (Boolean(colTribunal) || Boolean(articuloCOPP) || Boolean(alguacilPractica)));
    const isValid = (numeroCausa.length >= 3 && boletaNumero.length >= 1 && notificadoCitado.length >= 2) || isPartialCols;
    let validationNote = '';
    if (!isValid) {
      if (!numeroCausa) validationNote = 'Falta Nº de Causa';
      else if (!boletaNumero) validationNote = 'Falta Boleta Nº';
      else if (!notificadoCitado) validationNote = 'Falta Notificado/Citado';
    } else if (isPartialCols) {
      validationNote = 'Columnas Tri / Art / Alguacil detectadas';
    }

    // Si la celda contiene simultáneamente a Fiscalía y Defensa (ej. "FISCALIA Y DEFENSA", "FISCALIA 5TA / DEFENSA PUBLICA")
    const upperNotif = notificadoCitado.toUpperCase();
    const hasFiscalia = upperNotif.includes('FISC') || upperNotif.includes('MINISTERIO');
    const hasDefensa = upperNotif.includes('DEFEN') || upperNotif.includes(' ABG') || upperNotif.includes('ABOG') || upperNotif.includes(' D.P') || upperNotif.includes(' DP');

    if (hasFiscalia && hasDefensa) {
      let nombreFiscalia = 'FISCALÍA (MP)';
      let nombreDefensa = 'DEFENSA PÚBLICA';

      const partes = notificadoCitado.split(/\s+(?:Y|\/|-|CON|E)\s+/i);
      if (partes.length >= 2) {
        const p1 = partes[0].trim();
        const p2 = partes.slice(1).join(' / ').trim();
        if (/FISC|MINIST/i.test(p1)) {
          nombreFiscalia = p1;
          nombreDefensa = p2.replace(/^(?:DEFENSA(?:\s*P[UÚ]BLICA)?|ABG\.?|ABOG\.?)\s*:?\s*/i, 'DEFENSA PÚBLICA: ') || 'DEFENSA PÚBLICA';
        } else {
          nombreDefensa = p1;
          nombreFiscalia = p2;
        }
      }

      // Fila 1: Fiscalía
      results.push({
        numeroItem,
        numeroCausa,
        boletaNumero,
        notificadoCitado: nombreFiscalia,
        tipoCitado: 'FISCALIA',
        esSoloNotificacion,
        fechaAudiencia,
        horaAudiencia: colHora ? colHora.trim() : undefined,
        fechaAsignacion,
        tribunal,
        tribunalOtro,
        articuloCOPP,
        alguacilPractica,
        seccionRuta,
        isValid,
        validationNote,
        isPartialColumns: isPartialCols,
      });

      // Fila 2: Defensa Pública con boleta correlativa incrementada y mismo artículo
      let boletaDefensa = boletaNumero;
      if (/^\d+$/.test(boletaNumero.trim())) {
        const trimmed = boletaNumero.trim();
        const numLen = trimmed.length;
        const nextVal = parseInt(trimmed, 10) + 1;
        boletaDefensa = String(nextVal).padStart(numLen, '0');
      }

      results.push({
        numeroItem: numeroItem !== undefined ? numeroItem + 1 : undefined,
        numeroCausa,
        boletaNumero: boletaDefensa,
        notificadoCitado: nombreDefensa,
        tipoCitado: 'DEFENSA_PUBLICA',
        esSoloNotificacion,
        fechaAudiencia,
        horaAudiencia: colHora ? colHora.trim() : undefined,
        fechaAsignacion,
        tribunal,
        tribunalOtro,
        articuloCOPP,
        alguacilPractica,
        seccionRuta,
        isValid,
        validationNote,
        isPartialColumns: isPartialCols,
      });

      continue;
    }

    results.push({
      numeroItem,
      numeroCausa,
      boletaNumero,
      notificadoCitado,
      tipoCitado,
      esSoloNotificacion,
      fechaAudiencia,
      horaAudiencia: colHora ? colHora.trim() : undefined,
      fechaAsignacion,
      tribunal,
      tribunalOtro,
      articuloCOPP,
      alguacilPractica,
      seccionRuta,
      isValid,
      validationNote,
      isPartialColumns: isPartialCols,
    });
  }

  return results;
}
