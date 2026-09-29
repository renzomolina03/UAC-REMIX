import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  Building2, 
  User, 
  Calendar, 
  Scale, 
  Navigation,
  FolderOpen,
  FolderPlus,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  FileSpreadsheet,
  Clipboard,
  Check,
  Copy
} from 'lucide-react';
import { parseExcelClipboardText, ParsedExcelRow } from '../utils/excelBatchParser';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ArticuloCOPP, 
  TipoCitado,
  TIPOS_CITADO_OPTIONS,
  SeccionRuta,
  SeccionTrabajoInfo,
  SECCIONES_INFO,
  detectCaracterFromText
} from '../types/judicial';
import { ModalCrearSeccionTrabajo } from './ModalCrearSeccionTrabajo';

interface QuickRow {
  id: string;
  numeroItem?: number;
  numeroCausa: string;
  boletaNumero: string;
  numeroOficio?: string;
  notificadoCitado: string;
  tipoCitado: TipoCitado;
  esSoloNotificacion: boolean;
  fechaAudiencia: string;
  horaAudiencia?: string;
  fechaAsignacion: string;
  tribunal: string;
  tribunalOtro?: string;
  articuloCOPP: ArticuloCOPP;
  alguacilPractica: string;
  seccionRuta: SeccionRuta;
  direccionCitacion: string;
  finDePagina?: boolean;
}

interface BoletaQuickBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBatch: (boletas: Partial<BoletaJudicial>[], replaceExisting?: boolean) => void;
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  proximoNumeroItem: number;
  mesRutaActual: string;
  boletasExistentes?: BoletaJudicial[];
  seccionesCustom?: SeccionTrabajoInfo[];
  seccionActiva?: string;
  onSaveNuevaSeccion?: (nueva: SeccionTrabajoInfo) => void;
  dependenciaActiva?: 'NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS';
  responsableActual?: string;
}

export const BoletaQuickBatchModal: React.FC<BoletaQuickBatchModalProps> = ({
  isOpen,
  onClose,
  onSaveBatch,
  tribunales,
  alguaciles,
  proximoNumeroItem,
  mesRutaActual,
  boletasExistentes = [],
  seccionesCustom: seccionesCustomProp = [],
  seccionActiva,
  onSaveNuevaSeccion,
  dependenciaActiva = 'NOTIFICACION_CITACION',
  responsableActual = '',
}) => {
  // Secciones personalizadas sincronizadas
  const [seccionesCustomLocal, setSeccionesCustomLocal] = useState<SeccionTrabajoInfo[]>(() => {
    try {
      const stored = localStorage.getItem('uac_secciones_personalizadas');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [isModalCrearSeccionOpen, setIsModalCrearSeccionOpen] = useState(false);

  // Re-sincronizar siempre que se abra el modal
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('uac_secciones_personalizadas');
        if (stored) {
          setSeccionesCustomLocal(JSON.parse(stored));
        }
      } catch (e) {}

      if (seccionActiva && seccionActiva !== 'TODAS') {
        setDefaultSeccion(seccionActiva as SeccionRuta);
      }
    }
  }, [isOpen, seccionActiva]);

  const allCustomSections = useMemo(() => {
    const map = new Map<string, SeccionTrabajoInfo>();
    seccionesCustomLocal.forEach(s => map.set(s.codigo, s));
    seccionesCustomProp.forEach(s => map.set(s.codigo, s));
    return Array.from(map.values());
  }, [seccionesCustomProp, seccionesCustomLocal]);

  const handleSaveNuevaSeccionBatch = (nueva: SeccionTrabajoInfo) => {
    const updated = [...allCustomSections.filter(s => s.codigo !== nueva.codigo), nueva];
    setSeccionesCustomLocal(updated);
    try {
      localStorage.setItem('uac_secciones_personalizadas', JSON.stringify(updated));
    } catch (e) {}
    if (onSaveNuevaSeccion) {
      onSaveNuevaSeccion(nueva);
    }
    setDefaultSeccion(nueva.codigo as SeccionRuta);
    setRows(prev => prev.map(r => ({ ...r, seccionRuta: nueva.codigo as SeccionRuta })));
    setIsModalCrearSeccionOpen(false);
  };

  // Contador de boletas añadidas en esta sesión sin cerrar el modal
  const [sessionAddedCount, setSessionAddedCount] = useState<number>(0);

  // Valores globales por defecto para nuevas filas
  const [defaultTribunal, setDefaultTribunal] = useState<string>(tribunales[0]?.codigo || 'C1');
  const [defaultAlguacil, setDefaultAlguacil] = useState<string>('');
  const [defaultSeccion, setDefaultSeccion] = useState<SeccionRuta>('RUTA_NOTIFICACION_CITACION');
  const [defaultFechaAsig, setDefaultFechaAsig] = useState<string>(new Date().toISOString().slice(0, 10));
  const [causaPrefix, setCausaPrefix] = useState<string>(() => {
    return localStorage.getItem('uac_ultimo_prefijo_causa') || 'LP11-P-2026-';
  });
  const [prefixFeedback, setPrefixFeedback] = useState<string | null>(null);

  // Estado para la funcionalidad de Pegar desde Excel
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [excelRawText, setExcelRawText] = useState<string>('');
  const [excelImportMode, setExcelImportMode] = useState<'REPLACE_EMPTY' | 'APPEND' | 'SYNC_COLUMNS'>('REPLACE_EMPTY');
  const [excelParsedRows, setExcelParsedRows] = useState<ParsedExcelRow[]>([]);

  // Última boleta registrada en el lote existente
  const ultimaBoleta = useMemo(() => {
    if (!boletasExistentes || boletasExistentes.length === 0) return null;
    return boletasExistentes[boletasExistentes.length - 1];
  }, [boletasExistentes]);

  // Cambiar letra en el prefijo (ej: cambiar P por Y en LP11-P-20 -> LP11-Y-20)
  const changePrefixLetter = (currentPrefix: string, newLetter: string): string => {
    if (!currentPrefix || currentPrefix.trim() === '') {
      return `LP11-${newLetter}-2026-`;
    }
    const parts = currentPrefix.split('-');
    if (parts.length >= 2) {
      parts[1] = newLetter;
      return parts.join('-');
    }
    return `${currentPrefix}-${newLetter}-`;
  };

  // Obtener letra activa del prefijo (ej: P, J, S, E, Y)
  const getActiveLetter = (prefix: string): string => {
    if (!prefix) return '';
    const parts = prefix.split('-');
    if (parts.length >= 2 && parts[1].length === 1) {
      return parts[1].toUpperCase();
    }
    return '';
  };

  // Aplicar nuevo prefijo a las filas existentes en la matriz en tiempo real
  const applyPrefixToRows = (newPrefix: string, oldPrefix: string, forceAll = false) => {
    setRows(prevRows => {
      return prevRows.map(row => {
        const current = row.numeroCausa.trim();
        
        // Si está vacía o tenía el prefijo viejo exacto
        if (!current || current === oldPrefix || current === oldPrefix.trim()) {
          return { ...row, numeroCausa: newPrefix };
        }

        // Si comienza con el prefijo anterior, reemplazar el prefijo conservando el correlativo o número
        if (oldPrefix && current.startsWith(oldPrefix)) {
          const suffix = current.slice(oldPrefix.length);
          return { ...row, numeroCausa: newPrefix + suffix };
        }

        // Si la causa termina en números precedidos de guion (ej: LP11-P-20-102 o LP11-P-2026-581)
        const numberMatch = current.match(/-(\d+)$/);
        if (numberMatch && (current.startsWith('LP11-') || (oldPrefix && current.startsWith(oldPrefix.slice(0, 4))))) {
          const numberPart = numberMatch[1];
          const cleanPrefix = newPrefix.endsWith('-') ? newPrefix : `${newPrefix}-`;
          return { ...row, numeroCausa: `${cleanPrefix}${numberPart}` };
        }

        // Si se fuerza para todas las filas
        if (forceAll) {
          return { ...row, numeroCausa: newPrefix };
        }

        return row;
      });
    });
  };

  const handleLetterClick = (letter: string) => {
    const nextPrefix = changePrefixLetter(causaPrefix, letter);
    const prevPrefix = causaPrefix;
    setCausaPrefix(nextPrefix);
    localStorage.setItem('uac_ultimo_prefijo_causa', nextPrefix);
    applyPrefixToRows(nextPrefix, prevPrefix);
  };

  const handlePrefixInputChange = (value: string) => {
    const prevPrefix = causaPrefix;
    const nextPrefix = value.toUpperCase();
    setCausaPrefix(nextPrefix);
    localStorage.setItem('uac_ultimo_prefijo_causa', nextPrefix);
    applyPrefixToRows(nextPrefix, prevPrefix);
  };

  // Filas en la matriz de carga rápida
  const createEmptyRow = (customCausa?: string, customBoleta?: string, customItem?: number, customFechaAsig?: string): QuickRow => ({
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    numeroItem: customItem,
    numeroCausa: customCausa !== undefined ? customCausa : (causaPrefix || 'LP11-P-2026-'),
    boletaNumero: customBoleta || '',
    numeroOficio: '',
    notificadoCitado: '',
    tipoCitado: 'IMPUTADO',
    esSoloNotificacion: true,
    fechaAudiencia: 'NOTIFICACION',
    fechaAsignacion: customFechaAsig || defaultFechaAsig || new Date().toISOString().slice(0, 10),
    tribunal: defaultTribunal,
    articuloCOPP: '',
    alguacilPractica: defaultAlguacil || '',
    seccionRuta: defaultSeccion,
    direccionCitacion: '',
    finDePagina: false,
  });

  const [rows, setRows] = useState<QuickRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  const [savedBatchCount, setSavedBatchCount] = useState<number | null>(null);

  // Inicializar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSessionAddedCount(0);
      setSavedBatchCount(null);

      // En carga rápida, el número de boleta debe permanecer en blanco
      setRows([
        createEmptyRow(),
        createEmptyRow(),
        createEmptyRow(),
      ]);
    }
  }, [isOpen]);

  // Item correlativo actual (continúa de forma fluida y clara)
  const itemBase = useMemo(() => {
    const maxItemExistente = boletasExistentes && boletasExistentes.length > 0
      ? Math.max(...boletasExistentes.map(b => b.numeroItem || 0))
      : 0;
    return Math.max(maxItemExistente + 1, proximoNumeroItem) + sessionAddedCount;
  }, [sessionAddedCount, boletasExistentes, proximoNumeroItem]);

  const totalBoletasEnLote = boletasExistentes.length + sessionAddedCount;

  // Cálculo en tiempo real de la distribución de hojas para las boletas preparadas
  // Capacidad reglamentaria: 30 boletas por hoja.
  // Termina la hoja si llega a 30 boletas, si el usuario marca fin de hoja (📄), o si cambia la fecha de asignación.
  const distribucionHojasEnCarga = useMemo(() => {
    const valid = rows.filter(r => 
      r.numeroCausa.trim().length > 3 && 
      r.boletaNumero.trim().length > 0 &&
      r.notificadoCitado.trim().length > 0
    );
    if (valid.length === 0) return null;

    interface HojaPreview {
      numero: number;
      cantidad: number;
      fecha: string;
      estaLlena: boolean;
    }
    const hojas: HojaPreview[] = [];
    let curCount = 0;
    let curFecha = valid[0]?.fechaAsignacion || defaultFechaAsig;

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      curCount++;
      const nextR = i < valid.length - 1 ? valid[i + 1] : null;
      const esCorteManual = !!r.finDePagina;
      const esLleno30 = curCount >= 30;
      const fechaActual = r.fechaAsignacion || defaultFechaAsig;
      const fechaSig = nextR ? (nextR.fechaAsignacion || defaultFechaAsig) : null;
      const esCambioFecha = !!fechaSig && fechaActual !== fechaSig;
      const esUltimo = i === valid.length - 1;

      if (esCorteManual || esLleno30 || esCambioFecha || esUltimo) {
        hojas.push({
          numero: hojas.length + 1,
          cantidad: curCount,
          fecha: curFecha,
          estaLlena: curCount >= 30,
        });
        curCount = 0;
        if (nextR) {
          curFecha = nextR.fechaAsignacion || defaultFechaAsig;
        }
      }
    }

    return {
      totalBoletas: valid.length,
      hojas,
    };
  }, [rows, defaultFechaAsig]);

  // Lista unificada de todos los alguaciles disponibles (registrados + detectados en Excel/filas)
  const todosLosAlguaciles = useMemo(() => {
    const list: { id: string; nombre: string; noRegistrado?: boolean }[] = alguaciles.map(a => ({
      id: a.id,
      nombre: a.nombre,
      noRegistrado: false,
    }));
    
    const nombresRegistrados = new Set(alguaciles.map(a => a.nombre.trim().toUpperCase()));

    // Agregar alguaciles de las filas actuales si no están registrados
    rows.forEach(r => {
      const nom = r.alguacilPractica?.trim();
      if (nom && !nombresRegistrados.has(nom.toUpperCase())) {
        nombresRegistrados.add(nom.toUpperCase());
        list.push({
          id: `alg-row-${nom}`,
          nombre: nom,
          noRegistrado: true,
        });
      }
    });

    // Agregar alguaciles de las filas parseadas de Excel si no están registrados
    excelParsedRows.forEach(p => {
      const nom = p.alguacilPractica?.trim();
      if (nom && !nombresRegistrados.has(nom.toUpperCase())) {
        nombresRegistrados.add(nom.toUpperCase());
        list.push({
          id: `alg-xl-${nom}`,
          nombre: nom,
          noRegistrado: true,
        });
      }
    });

    return list;
  }, [alguaciles, rows, excelParsedRows]);

  // Parsear texto de Excel en tiempo real
  useEffect(() => {
    if (!excelRawText.trim()) {
      setExcelParsedRows([]);
      return;
    }
    const parsed = parseExcelClipboardText(excelRawText, {
      defaultCausaPrefix: causaPrefix,
      defaultTribunal,
      defaultAlguacil,
      defaultSeccion,
      tribunales,
      alguaciles,
    });
    setExcelParsedRows(parsed);
  }, [excelRawText, causaPrefix, defaultTribunal, defaultAlguacil, defaultSeccion, tribunales, alguaciles]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setExcelRawText(text);
      } else {
        alert('El portapapeles está vacío. Por favor copia primero las celdas en tu hoja de Excel (Ctrl+C).');
      }
    } catch {
      alert('Por favor haz clic dentro del cuadro de texto y pulsa Ctrl+V (o Cmd+V) para pegar los datos copiados de Excel.');
    }
  };

  const handleApplyExcelRows = () => {
    if (excelParsedRows.length === 0) return;

    const hasFilledRows = (rows || []).some(r => 
      (r?.numeroCausa && r.numeroCausa.length > (causaPrefix?.length || 0)) || 
      r?.boletaNumero?.trim() || 
      r?.notificadoCitado?.trim()
    );

    const isPartialOnly = excelParsedRows.every(p => p.isPartialColumns);

    // Si el usuario eligió sincronizar columnas O si pegó columnas parciales (Tri, Art, Alguacil) teniendo filas existentes
    if (excelImportMode === 'SYNC_COLUMNS' || (isPartialOnly && hasFilledRows)) {
      setRows(prev => {
        return prev.map((row, idx) => {
          if (idx < excelParsedRows.length) {
            const p = excelParsedRows[idx];
            return {
              ...row,
              tribunal: p.tribunal || row.tribunal,
              articuloCOPP: p.articuloCOPP || row.articuloCOPP,
              alguacilPractica: p.alguacilPractica || row.alguacilPractica,
            };
          }
          return row;
        });
      });
      const count = Math.min(rows.length, excelParsedRows.length);
      setPrefixFeedback(`✓ ¡Sincronizados Tri, Art. COPP y Alguacil en ${count} filas de la matriz!`);
      setTimeout(() => setPrefixFeedback(null), 4000);
      setIsExcelModalOpen(false);
      setExcelRawText('');
      return;
    }

    const newRows: QuickRow[] = excelParsedRows.map(p => {
      const esSobreseimiento = 
        p.seccionRuta === 'SOBRESEIMIENTO' ||
        p.notificadoCitado.toUpperCase().includes('SOBRESE') ||
        (p.fechaAudiencia && p.fechaAudiencia.toUpperCase().includes('SOBRESE')) ||
        p.numeroCausa.toUpperCase().includes('SOBRESE');

      return {
        id: `row-xl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        numeroItem: p.numeroItem,
        numeroCausa: p.numeroCausa,
        boletaNumero: p.boletaNumero,
        notificadoCitado: p.notificadoCitado,
        tipoCitado: p.tipoCitado,
        esSoloNotificacion: esSobreseimiento ? true : p.esSoloNotificacion,
        fechaAudiencia: esSobreseimiento ? 'NOTIFICACION' : p.fechaAudiencia,
        horaAudiencia: p.horaAudiencia,
        fechaAsignacion: p.fechaAsignacion || defaultFechaAsig,
        tribunal: p.tribunal || defaultTribunal,
        tribunalOtro: p.tribunalOtro,
        articuloCOPP: p.articuloCOPP,
        alguacilPractica: p.alguacilPractica,
        seccionRuta: esSobreseimiento ? 'SOBRESEIMIENTO' : (p.seccionRuta || defaultSeccion),
        direccionCitacion: p.direccionCitacion || '',
        numeroOficio: p.numeroOficio || '',
      };
    });

    if (excelImportMode === 'REPLACE_EMPTY') {
      if (!hasFilledRows) {
        setRows(newRows);
      } else {
        const filled = rows.filter(r => r.boletaNumero.trim() || r.notificadoCitado.trim());
        setRows([...filled, ...newRows]);
      }
    } else {
      setRows(prev => [...prev, ...newRows]);
    }

    const sobreseimientoCount = newRows.filter(r => r.seccionRuta === 'SOBRESEIMIENTO').length;
    const msg = sobreseimientoCount > 0
      ? `✓ ¡${newRows.length} boletas pegadas desde Excel! (${sobreseimientoCount} enviadas automáticamente a SOBRESEIMIENTO)`
      : `✓ ¡${newRows.length} boletas pegadas desde Excel con éxito!`;
    setPrefixFeedback(msg);
    setTimeout(() => setPrefixFeedback(null), 4000);
    setIsExcelModalOpen(false);
    setExcelRawText('');
  };

  const handleLoadExcelExample = () => {
    const example = [
      `#\tNº DE CAUSA *\tBOLETA Nº\tNOTIFICADO / CITADO\tCARÁCTER\tF. AUDIENCIA / TIPO\tTRI\tART\tALGUACIL`,
      `1\tLP11-P-2026-000101\t041\tJUAN CARLOS PÉREZ\tIMPUTADO\t15/09/2026\tC1\t167\tRENZO`,
      `2\tLP11-P-2026-000102\t042\tMARÍA EUGENIA BLANCO\tVÍCTIMA\tNOTIFICACIÓN\tC1\t168\tALGUACIL EXTERNO`,
      `3\tLP11-J-2026-000085\t043\tDR. CARLOS MENDEZ (DEFENSA)\tDEFENSA_PUBLICA\t20/09/2026\tJ1\t169\tROXANA`,
      `4\tLP11-P-2026-000104\t044\tOFICIAL PEDRO CONTRERAS (SOBRESEIMIENTO)\tTESTIGO\tSOBRESEIMIENTO\tC2\t165\tNUEVO FUNCIONARIO`
    ].join('\n');
    setExcelRawText(example);
  };

  const handleTablePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    // Si contiene saltos de línea o tabuladores típicos de copiar filas/celdas de Excel
    if (text.includes('\n') || text.includes('\t')) {
      e.preventDefault();
      setExcelRawText(text);
      setIsExcelModalOpen(true);
    }
  };

  const handleCopiarDatosUltimaBoleta = () => {
    if (!ultimaBoleta) return;
    if (ultimaBoleta.tribunal) {
      setDefaultTribunal(ultimaBoleta.tribunal);
      setRows(prev => prev.map(r => ({ ...r, tribunal: ultimaBoleta.tribunal })));
    }
    if (ultimaBoleta.alguacilPractica) {
      setDefaultAlguacil(ultimaBoleta.alguacilPractica);
      setRows(prev => prev.map(r => ({ ...r, alguacilPractica: ultimaBoleta.alguacilPractica })));
    }
    if (ultimaBoleta.seccionRuta) {
      setDefaultSeccion(ultimaBoleta.seccionRuta);
      setRows(prev => prev.map(r => ({ ...r, seccionRuta: ultimaBoleta.seccionRuta })));
    }
    
    if (ultimaBoleta.numeroCausa) {
      const parts = ultimaBoleta.numeroCausa.split('-');
      if (parts.length >= 3) {
        const pref = `${parts[0]}-${parts[1]}-${parts[2]}-`;
        setCausaPrefix(pref);
        localStorage.setItem('uac_ultimo_prefijo_causa', pref);
      }
    }

    setPrefixFeedback(`Valores heredados del lote: Trib. ${ultimaBoleta.tribunal}, ${ultimaBoleta.alguacilPractica || 'Sin alguacil'}`);
    setTimeout(() => setPrefixFeedback(null), 3500);
  };

  const handleUpdateRow = (id: string, field: keyof QuickRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'notificadoCitado') {
        const detected = detectCaracterFromText(value);
        if (detected.detectedTipo) {
          updated.tipoCitado = detected.detectedTipo;
        }
      }
      return updated;
    }));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const handleAddMultipleRows = (count: number) => {
    const newRows: QuickRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setRows(prev => [...prev, ...newRows]);
  };

  const handleResetRows = () => {
    if (confirm('¿Deseas vaciar la tabla actual para empezar a llenar una nueva lista desde cero?')) {
      setRows([
        createEmptyRow(),
        createEmptyRow(),
        createEmptyRow(),
      ]);
      setSavedBatchCount(null);
    }
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) {
      setRows([createEmptyRow()]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleDuplicateRow = (id: string) => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;
    const sourceRow = rows[index];

    let nextBoleta = sourceRow.boletaNumero || '';
    if (/^\d+$/.test(nextBoleta.trim())) {
      const trimmed = nextBoleta.trim();
      const numLen = trimmed.length;
      const nextVal = parseInt(trimmed, 10) + 1;
      nextBoleta = String(nextVal).padStart(numLen, '0');
    }

    const duplicated: QuickRow = {
      ...sourceRow,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      boletaNumero: nextBoleta,
      numeroItem: undefined,
      fechaAsignacion: sourceRow.fechaAsignacion || defaultFechaAsig,
      finDePagina: false,
    };

    const newRows = [...rows];
    newRows.splice(index + 1, 0, duplicated);
    setRows(newRows);
  };

  const handleAddDefensaRow = (id: string) => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;
    const sourceRow = rows[index];

    let nextBoleta = sourceRow.boletaNumero || '';
    if (/^\d+$/.test(nextBoleta.trim())) {
      const trimmed = nextBoleta.trim();
      const numLen = trimmed.length;
      const nextVal = parseInt(trimmed, 10) + 1;
      nextBoleta = String(nextVal).padStart(numLen, '0');
    }

    const defensaRow: QuickRow = {
      ...sourceRow,
      id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      boletaNumero: nextBoleta,
      numeroItem: undefined,
      notificadoCitado: 'DEFENSA PÚBLICA',
      tipoCitado: 'DEFENSA_PUBLICA',
      articuloCOPP: sourceRow.articuloCOPP || '167',
      fechaAsignacion: sourceRow.fechaAsignacion || defaultFechaAsig,
      finDePagina: false,
    };

    const newRows = [...rows];
    newRows.splice(index + 1, 0, defensaRow);
    setRows(newRows);
  };

  const handleSave = (e: React.FormEvent, keepAddingInBatch = false) => {
    e.preventDefault();

    const validRows = rows.filter(r => 
      r.numeroCausa.trim().length > 3 && 
      r.boletaNumero.trim().length > 0 &&
      r.notificadoCitado.trim().length > 0
    );

    if (validRows.length === 0) {
      alert('Por favor completa al menos una boleta con Nº de Causa, Boleta Nº y Notificado.');
      return;
    }

    const currentBaseItem = itemBase;
    const isReplacing = false;

    const batchBoletas: Partial<BoletaJudicial>[] = validRows.map((r, idx) => {
      const esSobreseimiento = 
        r.seccionRuta === 'SOBRESEIMIENTO' ||
        r.notificadoCitado.toUpperCase().includes('SOBRESE') ||
        (r.fechaAudiencia && r.fechaAudiencia.toUpperCase().includes('SOBRESE')) ||
        r.numeroCausa.toUpperCase().includes('SOBRESE');

      const seccionFinal: SeccionRuta = esSobreseimiento ? 'SOBRESEIMIENTO' : (r.seccionRuta || defaultSeccion);

      return {
        numeroItem: r.numeroItem !== undefined ? r.numeroItem : (currentBaseItem + idx),
        numeroCausa: r.numeroCausa.trim().toUpperCase(),
        boletaNumero: r.boletaNumero.trim(),
        numeroOficio: r.numeroOficio?.trim() ? r.numeroOficio.trim().toUpperCase() : undefined,
        dependencia: dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION',
        responsableRelacion: responsableActual || undefined,
        notificadoCitado: r.notificadoCitado.trim().toUpperCase(),
        tipoCitado: r.tipoCitado,
        esSoloNotificacion: esSobreseimiento ? true : r.esSoloNotificacion,
        fechaAudiencia: esSobreseimiento ? 'NOTIFICACION' : (r.esSoloNotificacion ? 'NOTIFICACION' : (r.fechaAudiencia || 'NOTIFICACION')),
        horaAudiencia: r.horaAudiencia,
        fechaAsignacion: r.fechaAsignacion?.trim() || defaultFechaAsig || new Date().toISOString().slice(0, 10),
        tribunal: r.tribunal,
        tribunalOtro: r.tribunal === 'OTRO' ? (r.tribunalOtro?.trim() || undefined) : undefined,
        articuloCOPP: r.articuloCOPP || '',
        alguacilPractica: r.alguacilPractica,
        seccionRuta: seccionFinal,
        devueltaAlTribunal: false,
        acuseGenerado: false,
        direccionCitacion: r.direccionCitacion.trim() || undefined,
        mesRuta: mesRutaActual,
        estado: 'EN_RUTA',
        finDePagina: !!r.finDePagina,
      };
    });

    onSaveBatch(batchBoletas, isReplacing);

    if (keepAddingInBatch) {
      // Guardar y continuar agregando al lote sin cerrar
      const nextAddedCount = sessionAddedCount + validRows.length;
      setSessionAddedCount(nextAddedCount);
      setSavedBatchCount(validRows.length);

      // En carga rápida el número de boleta debe permanecer en blanco
      setRows([
        createEmptyRow(),
        createEmptyRow(),
        createEmptyRow(),
      ]);

      setTimeout(() => {
        setSavedBatchCount(null);
      }, 5000);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white flex items-center justify-between border-b border-blue-400/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 text-white font-bold shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white tracking-tight">
                  Carga Rápida en Lote de Boletas Judiciales
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold border border-white/30">
                  Modo Ráfaga / Enrutamiento
                </span>
              </div>
              <p className="text-[11px] text-blue-100">
                Registra el lote rápidamente con: Nº DE CAUSA, BOLETA Nº, NOTIFICADO/CITADO, CARÁCTER, F. AUDIENCIA/TIPO, TRI, ART. y ALGUACIL.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Lote Guardado y Nueva Lista Lista */}
        {savedBatchCount !== null && (
          <div className="p-3 bg-emerald-600 text-white flex items-center justify-between px-4 text-xs font-bold animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span>✓ ¡Lote de {savedBatchCount} boletas guardado exitosamente! El próximo ítem asignado es #{itemBase}. Continúa llenando las siguientes filas.</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSavedBatchCount(null)}
              className="text-white/80 hover:text-white px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra Superior: Correlativo de Ítem y Carga Rápida */}
        <div className="bg-slate-100/95 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="text-slate-600 font-semibold">Correlativo inicial:</span>
              <strong className="text-indigo-700 font-mono font-black text-sm">Ítem #{itemBase}</strong>
              {boletasExistentes.length > 0 && (
                <span className="text-[10px] text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded-md font-bold">
                  {boletasExistentes.length} registradas previamente
                </span>
              )}
            </div>

            {ultimaBoleta && (
              <button
                type="button"
                onClick={handleCopiarDatosUltimaBoleta}
                className="text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                title="Copiar Tribunal, Alguacil y prefijo de la última boleta registrada"
              >
                <span>↻ Heredar datos de última boleta</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Destacado: Pegar desde Excel */}
            <button
              type="button"
              onClick={() => setIsExcelModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              title="Copia las celdas en Excel (Ctrl+C) y pégalas aquí para cargar todo el lote al instante"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📋 Pegar desde Excel</span>
            </button>
          </div>
        </div>

        {/* 2. Barra de Configuración Rápida y Sección de Ruta */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sección de Destino */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
              <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-700">Sección:</span>
              <select
                value={defaultSeccion}
                onChange={(e) => {
                  const s = e.target.value as SeccionRuta;
                  setDefaultSeccion(s);
                  setRows(prev => prev.map(r => ({ ...r, seccionRuta: s })));
                }}
                className="font-bold text-indigo-950 bg-transparent focus:outline-none cursor-pointer text-xs max-w-[220px] truncate"
              >
                <optgroup label="Secciones del Sistema">
                  <option value="RUTA_NOTIFICACION_CITACION">1. RUTA DE NOTIFICACIÓN Y CITACIÓN</option>
                  <option value="CORREO_EXT">2. CORREO EXT.</option>
                  <option value="RUTA_INTERNA">3. RUTA INTERNA</option>
                  <option value="OTROS_ESTADOS_MERIDA">4. BOLETAS DE OTROS ESTADOS Y MÉRIDA</option>
                  <option value="SOBRESEIMIENTO">5. SOBRESEIMIENTO</option>
                </optgroup>
                {allCustomSections.length > 0 && (
                  <optgroup label="Secciones Creadas">
                    {allCustomSections.map(sec => (
                      <option key={sec.codigo} value={sec.codigo}>
                        {sec.nombre || sec.corto}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                type="button"
                onClick={() => setIsModalCrearSeccionOpen(true)}
                className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 cursor-pointer transition-colors"
                title="Crear una nueva sección de trabajo y sincronizarla"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Nueva</span>
              </button>
            </div>

            {/* Botón rápido: Todas Notificación */}
            <button
              type="button"
              onClick={() => {
                setRows(prev => prev.map(r => ({ ...r, esSoloNotificacion: true, fechaAudiencia: 'NOTIFICACION' })));
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 cursor-pointer shadow-xs transition-colors"
              title="Establecer todas las filas del lote como NOTIFICACIÓN (sin audiencia ni hora)"
            >
              <span>⚡ Todas Notificación</span>
            </button>

            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-700">F. Asignación Lote:</span>
              <input
                type="date"
                value={defaultFechaAsig}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDefaultFechaAsig(newDate);
                  setRows(prev => prev.map(r => ({ ...r, fechaAsignacion: newDate })));
                }}
                className="font-bold text-indigo-950 bg-indigo-50/60 px-2 py-0.5 rounded border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
                title="Fecha de asignación para las boletas de este lote"
              />
              <button
                type="button"
                onClick={() => {
                  setRows(prev => prev.map(r => ({ ...r, fechaAsignacion: defaultFechaAsig })));
                }}
                className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 cursor-pointer transition-colors"
                title="Aplicar esta fecha de asignación a todas las filas del lote"
              >
                Aplicar a todas
              </button>
            </div>
          </div>

          {/* Prefijo de Causa Modificable al Instante */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs">
              <span className="text-slate-600 font-bold text-xs">Prefijo Causa:</span>
              <input
                type="text"
                value={causaPrefix}
                onChange={(e) => handlePrefixInputChange(e.target.value)}
                placeholder="ej: LP11-P-2026- o LP11-P-20"
                className="w-36 px-2 py-1 font-mono font-bold text-indigo-950 bg-indigo-50 border border-indigo-200 rounded text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                title="Prefijo editable al instante. Modifica LP11, el año (2026, 2025, 2020) o la letra en cualquier momento."
              />
            </div>

            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 font-bold mr-0.5">Letra:</span>
              {[
                { letter: 'P', desc: 'P - Control (1ra Instancia)' },
                { letter: 'J', desc: 'J - Juicio (1ra Instancia)' },
                { letter: 'S', desc: 'S - Sentencia / Apelaciones' },
                { letter: 'E', desc: 'E - Ejecución' },
                { letter: 'Y', desc: 'Y - Adolescentes / Secc. Especial' }
              ].map(({ letter, desc }) => {
                const isSelected = getActiveLetter(causaPrefix) === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleLetterClick(letter)}
                    className={`w-7 h-7 rounded text-xs font-mono font-black transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 font-black scale-105'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    title={desc}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                applyPrefixToRows(causaPrefix, causaPrefix, true);
                setPrefixFeedback(`Prefijo "${causaPrefix}" aplicado a ${rows.length} filas`);
                setTimeout(() => setPrefixFeedback(null), 3500);
              }}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Aplica este prefijo a todas las filas en la tabla actual"
            >
              <span>Aplicar a filas</span>
            </button>

            {prefixFeedback && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200 animate-in fade-in">
                ✓ {prefixFeedback}
              </span>
            )}
          </div>
        </div>

        {/* Barra Informativa de Distribución en Hojas (30 boletas por hoja) */}
        {distribucionHojasEnCarga && (
          <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5 text-xs border-b border-slate-800 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-indigo-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Control de Hojas (30 boletas por hoja):</span>
              </span>
              <span className="font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
                {distribucionHojasEnCarga.totalBoletas} boleta(s) lista(s)
              </span>
              <span className="text-slate-500">•</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {distribucionHojasEnCarga.hojas.map(h => (
                  <span
                    key={`prev-h-${h.numero}`}
                    className={`px-2.5 py-0.5 rounded-lg font-bold text-xs flex items-center gap-1.5 ${
                      h.estaLlena
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <span>Hoja {h.numero}: <strong>{h.cantidad}/30</strong> {h.estaLlena ? '(Llena ✓)' : '(Continúa)'}</span>
                    {h.fecha && <span className="opacity-80 font-mono text-[10px]">[{h.fecha}]</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              * Si son 40 boletas: Hoja 1 se llena con 30 bol. y continúa en Hoja 2 con 10 bol.
            </div>
          </div>
        )}

        {/* Matriz de Filas Editables */}
        <form onSubmit={handleSave} onPaste={handleTablePaste} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-2 min-w-[150px]">Nº DE CAUSA *</th>
                  <th className="py-2.5 px-2 min-w-[90px]">BOLETA Nº *</th>
                  {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                    <th className="py-2.5 px-2 min-w-[110px] text-center bg-emerald-100 text-emerald-950 font-black border-r border-emerald-300 select-none text-[11px]" title="Número de Oficio para Secretaría">
                      Nº DE OFICIO *
                    </th>
                  )}
                  <th className="py-2.5 px-2 min-w-[200px]">NOTIFICADO / CITADO *</th>
                  <th className="py-2.5 px-2 min-w-[110px]">CARÁCTER</th>
                  <th className="py-2.5 px-2 min-w-[130px] text-center">NOTIFICACIÓN / AUDIENCIA</th>
                  <th className="py-2.5 px-2 min-w-[125px] text-center bg-indigo-50/80 text-indigo-950 font-black border-r border-indigo-200 select-none text-[11px]" title="Fecha de asignación para la boleta">
                    F. ASIGNACIÓN
                  </th>
                  <th className="py-2.5 px-2 w-16 text-center">TRI</th>
                  {/* 7 Columnas COPP idénticas a la imagen */}
                  <th className="py-2 px-1 text-center bg-[#8f9ca8] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 167">167</th>
                  <th className="py-2 px-1 text-center bg-[#5c98e2] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 168">168</th>
                  <th className="py-2 px-1 text-center bg-[#8ea8be] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 169">169</th>
                  <th className="py-2 px-1 text-center bg-[#9dce64] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 170">170</th>
                  <th className="py-2 px-1 text-center bg-[#e7444b] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 171">171</th>
                  <th className="py-2 px-1 text-center bg-[#fce444] text-slate-950 w-8 font-black border-r border-slate-300 select-none text-[11px]" title="Art. 165">165</th>
                  <th className="py-1 px-1 text-center bg-[#df7a40] text-slate-950 w-9 font-black select-none text-[10px] leading-tight" title="Art. S 165">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[8px] font-black leading-none">S</span>
                      <span className="text-[10px] font-black leading-none mt-0.5">165</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-2 min-w-[115px]">ALGUACIL</th>
                  <th className="py-2.5 px-2 w-16 text-center text-[10px] text-slate-500 font-bold">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, index) => (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                    {/* # */}
                    <td className="py-2 px-2 text-center font-bold text-slate-400">
                      {row.numeroItem !== undefined ? row.numeroItem : (index + 1)}
                    </td>

                    {/* Nº DE CAUSA * */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej: LP11-P-2026-102 o LP11-P-20"
                        value={row.numeroCausa}
                        onChange={(e) => handleUpdateRow(row.id, 'numeroCausa', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                      />
                    </td>

                    {/* BOLETA Nº * */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        required
                        placeholder="Ej: 4501"
                        value={row.boletaNumero}
                        onChange={(e) => handleUpdateRow(row.id, 'boletaNumero', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                      />
                    </td>

                    {/* Nº DE OFICIO (ROL SECRETARIO(A)) */}
                    {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                      <td className="py-2 px-2 bg-emerald-50/40">
                        <input
                          type="text"
                          placeholder="Ej: OF-2026-089"
                          value={row.numeroOficio || ''}
                          onChange={(e) => handleUpdateRow(row.id, 'numeroOficio', e.target.value.toUpperCase())}
                          className="w-full px-2 py-1.5 border border-emerald-300 rounded font-mono font-bold text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs text-center"
                        />
                      </td>
                    )}

                    {/* NOTIFICADO / CITADO * */}
                    <td className="py-2 px-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            required
                            placeholder="Ej: FISCALIA XVII, ABG. MARIO ROA"
                            value={row.notificadoCitado}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              handleUpdateRow(row.id, 'notificadoCitado', val);
                              if (val.includes('SOBRESE')) {
                                handleUpdateRow(row.id, 'seccionRuta', 'SOBRESEIMIENTO');
                                handleUpdateRow(row.id, 'esSoloNotificacion', true);
                                handleUpdateRow(row.id, 'fechaAudiencia', 'NOTIFICACION');
                              }
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                          />
                          {row.seccionRuta === 'SOBRESEIMIENTO' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black" title="Asignada a SOBRESEIMIENTO">
                              ⚖️ SOBRESEIMIENTO
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Dirección opcional..."
                          value={row.direccionCitacion}
                          onChange={(e) => handleUpdateRow(row.id, 'direccionCitacion', e.target.value)}
                          className="w-full px-2 py-0.5 border border-slate-200 rounded text-[10px] text-slate-600 bg-slate-50 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* CARÁCTER */}
                    <td className="py-2 px-2">
                      <select
                        value={row.tipoCitado}
                        onChange={(e) => handleUpdateRow(row.id, 'tipoCitado', e.target.value as TipoCitado)}
                        className="w-full px-1.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white text-xs font-medium"
                      >
                        {TIPOS_CITADO_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* NOTIFICACIÓN / AUDIENCIA */}
                    <td className="py-2 px-2 text-center">
                      <div className="space-y-1">
                        {row.esSoloNotificacion ? (
                          <div className="py-1 px-1.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold rounded text-center shadow-xs">
                            NOTIFICACIÓN
                          </div>
                        ) : (
                          <input
                            type="date"
                            value={row.fechaAudiencia === 'NOTIFICACION' ? '' : row.fechaAudiencia}
                            onChange={(e) => handleUpdateRow(row.id, 'fechaAudiencia', e.target.value)}
                            className="w-full px-1.5 py-1 border border-slate-300 rounded text-slate-800 bg-white text-xs font-semibold text-center"
                          />
                        )}
                        <label className="flex items-center justify-center gap-1 cursor-pointer select-none text-[10px] text-slate-600 font-medium">
                          <input
                            type="checkbox"
                            checked={row.esSoloNotificacion}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              handleUpdateRow(row.id, 'esSoloNotificacion', checked);
                              if (checked) {
                                handleUpdateRow(row.id, 'fechaAudiencia', 'NOTIFICACION');
                              } else {
                                handleUpdateRow(row.id, 'fechaAudiencia', '');
                              }
                            }}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                          <span>Notificación</span>
                        </label>
                      </div>
                    </td>

                    {/* F. ASIGNACIÓN */}
                    <td className="py-2 px-2 text-center bg-indigo-50/20">
                      <input
                        type="date"
                        value={row.fechaAsignacion || defaultFechaAsig}
                        onChange={(e) => handleUpdateRow(row.id, 'fechaAsignacion', e.target.value)}
                        className="w-full px-1.5 py-1 border border-indigo-200 rounded font-semibold text-slate-800 bg-white text-xs text-center focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        title="Fecha de asignación para esta boleta"
                      />
                    </td>

                    {/* TRI */}
                    <td className="py-2 px-2 text-center min-w-[100px]">
                      <select
                        value={row.tribunal}
                        onChange={(e) => handleUpdateRow(row.id, 'tribunal', e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-slate-300 rounded font-bold text-slate-900 bg-white text-xs text-center"
                      >
                        {row.tribunal && !tribunales.some(t => t.codigo.toUpperCase() === row.tribunal.toUpperCase()) && (
                          <option value={row.tribunal}>{row.tribunal}</option>
                        )}
                        {tribunales.map(t => (
                          <option key={t.id} value={t.codigo}>{t.codigo} {t.codigo === 'OTRO' ? '(Foráneo)' : ''}</option>
                        ))}
                      </select>
                      {row.tribunal === 'OTRO' && (
                        <input
                          type="text"
                          value={row.tribunalOtro || ''}
                          onChange={(e) => handleUpdateRow(row.id, 'tribunalOtro', e.target.value.toUpperCase())}
                          placeholder="Especifique tribunal (ej: J5 MERIDA)..."
                          className="w-full mt-1 px-1.5 py-0.5 text-[10px] border border-amber-300 rounded font-bold text-slate-900 bg-amber-50 focus:bg-white focus:outline-none"
                          title="Especifique tribunal foráneo o externo (ej: J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA)"
                        />
                      )}
                    </td>

                    {/* 167 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '167' ? '' : '167')}
                      className={`py-2 px-1 text-center border-l border-r border-slate-200 cursor-pointer hover:bg-slate-200 select-none ${
                        row.articuloCOPP === '167' ? 'bg-slate-100' : ''
                      }`}
                      title="Art. 167"
                    >
                      {row.articuloCOPP === '167' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8f9ca8] text-slate-950 font-black text-xs shadow-xs border border-slate-500">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 168 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '168' ? '' : '168')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-blue-100 select-none ${
                        row.articuloCOPP === '168' ? 'bg-blue-50' : ''
                      }`}
                      title="Art. 168"
                    >
                      {row.articuloCOPP === '168' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#5c98e2] text-slate-950 font-black text-xs shadow-xs border border-blue-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 169 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '169' ? '' : '169')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-sky-100 select-none ${
                        row.articuloCOPP === '169' ? 'bg-sky-50' : ''
                      }`}
                      title="Art. 169"
                    >
                      {row.articuloCOPP === '169' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8ea8be] text-slate-950 font-black text-xs shadow-xs border border-sky-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 170 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '170' ? '' : '170')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-lime-100 select-none ${
                        row.articuloCOPP === '170' ? 'bg-lime-50' : ''
                      }`}
                      title="Art. 170"
                    >
                      {row.articuloCOPP === '170' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9dce64] text-slate-950 font-black text-xs shadow-xs border border-lime-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 171 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '171' ? '' : '171')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-red-100 select-none ${
                        row.articuloCOPP === '171' ? 'bg-red-50' : ''
                      }`}
                      title="Art. 171"
                    >
                      {row.articuloCOPP === '171' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#e7444b] text-slate-950 font-black text-xs shadow-xs border border-red-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* 165 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === '165' ? '' : '165')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-yellow-100 select-none ${
                        row.articuloCOPP === '165' ? 'bg-yellow-50' : ''
                      }`}
                      title="Art. 165"
                    >
                      {row.articuloCOPP === '165' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fce444] text-slate-950 font-black text-xs shadow-xs border border-yellow-500">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* S 165 */}
                    <td 
                      onClick={() => handleUpdateRow(row.id, 'articuloCOPP', row.articuloCOPP === 'S_165' ? '' : 'S_165')}
                      className={`py-2 px-1 text-center border-r border-slate-200 cursor-pointer hover:bg-orange-100 select-none ${
                        row.articuloCOPP === 'S_165' ? 'bg-orange-50' : ''
                      }`}
                      title="Art. S 165"
                    >
                      {row.articuloCOPP === 'S_165' ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#df7a40] text-slate-950 font-black text-xs shadow-xs border border-orange-600">
                          1
                        </span>
                      ) : null}
                    </td>

                    {/* ALGUACIL */}
                    <td className="py-2 px-2 min-w-[130px]">
                      <div className="relative">
                        <input
                          type="text"
                          list={`alguaciles-list-${row.id}`}
                          value={row.alguacilPractica || ''}
                          onChange={(e) => handleUpdateRow(row.id, 'alguacilPractica', e.target.value.toUpperCase())}
                          placeholder="Alguacil..."
                          className="w-full px-2 py-1.5 border border-slate-300 rounded font-semibold text-slate-800 bg-white text-xs uppercase"
                        />
                        <datalist id={`alguaciles-list-${row.id}`}>
                          {todosLosAlguaciles.map(a => (
                            <option key={a.id} value={a.nombre}>
                              {a.nombre}{a.noRegistrado ? ' (Nuevo)' : ''}
                            </option>
                          ))}
                        </datalist>
                      </div>
                    </td>

                    {/* Acciones: Fin de Hoja, Copiar y Eliminar */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateRow(row.id, 'finDePagina', !row.finDePagina)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            row.finDePagina 
                              ? 'bg-amber-500 text-white font-black shadow-xs ring-2 ring-amber-300' 
                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                          }`}
                          title={row.finDePagina ? 'Quitar corte de hoja (Esta boleta finalizaba la hoja)' : 'Terminar hoja en esta boleta e iniciar una nueva'}
                        >
                          <span className="text-xs">📄</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDefensaRow(row.id)}
                          className="px-1.5 py-1 text-[10px] font-black bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-300 rounded transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                          title="Crear fila correlativa para Defensa Pública con el mismo artículo COPP y datos"
                        >
                          + Def.
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(row.id)}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                          title="Copiar datos y pegar en la fila siguiente (Duplicar)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Divisores informativos automáticos de límites de hoja y fechas */}
                  {row.finDePagina && (
                    <tr key={`salto-manual-${row.id}`} className="bg-amber-100 border-y-2 border-dashed border-amber-500 text-amber-950 font-bold text-xs select-none">
                      <td colSpan={19} className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span>📄</span>
                          <span>Corte de hoja manual: La hoja finaliza aquí (Boleta #{row.boletaNumero || (index + 1)}). La siguiente fila iniciará una nueva hoja.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!row.finDePagina && (index + 1) % 30 === 0 && index < rows.length - 1 && (
                    <tr key={`salto-capacidad-${row.id}`} className="bg-emerald-50 border-y-2 border-emerald-400 text-emerald-950 font-bold text-xs select-none">
                      <td colSpan={19} className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                          <span>✓ Hoja {Math.floor((index + 1) / 30)} completa con sus 30 boletas reglamentarias. Continúa en la Hoja {Math.floor((index + 1) / 30) + 1}.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!row.finDePagina && (index + 1) % 30 !== 0 && index < rows.length - 1 && row.fechaAsignacion && rows[index + 1].fechaAsignacion && row.fechaAsignacion !== rows[index + 1].fechaAsignacion && (
                    <tr key={`salto-fecha-${row.id}`} className="bg-indigo-50 border-y-2 border-indigo-400 text-indigo-950 font-bold text-xs select-none">
                      <td colSpan={19} className="py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span>📅</span>
                          <span>Cambio de fecha de asignación: La hoja de {row.fechaAsignacion} finaliza aquí. La siguiente fila inicia una nueva hoja para la fecha {rows[index + 1].fechaAsignacion}.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Botones para agregar filas */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+1 Fila</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddMultipleRows(3)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>+3 Filas</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddMultipleRows(5)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>+5 Filas</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs transition-colors cursor-pointer ml-2"
                title="Abrir ventana para pegar datos directamente desde Excel (Ctrl+V)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pegar desde Excel</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {rows.filter(r => r.numeroCausa.trim().length > 3 && r.boletaNumero.trim().length > 0 && r.notificadoCitado.trim().length > 0).length} de {rows.length} boletas listas para registrar
            </div>
          </div>

          {/* Barra de Acciones Finales */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetRows}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Vaciar las filas para empezar a llenar una nueva lista en blanco"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Limpiar Matriz</span>
              </button>
              <span className="text-[11px] text-slate-400 hidden lg:inline">
                💡 Puedes guardar este lote y seguir agregando al mismo sin salir del modal.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {/* Guardar y Continuar Agregando en el Lote */}
              <button
                type="button"
                onClick={(e) => handleSave(e, true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-sm transition-all cursor-pointer"
                title="Guarda las boletas registradas y deja la tabla limpia lista para seguir agregando sin cerrar la ventana"
              >
                <Layers className="w-4 h-4" />
                <span>Guardar y Seguir Agregando ⚡</span>
              </button>

              {/* Guardar y Cerrar */}
              <button
                type="button"
                onClick={(e) => handleSave(e, false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Finalizar</span>
              </button>
            </div>
          </div>
        </form>

        {/* Modal Flotante: Pegar desde Excel / Portapapeles */}
        {isExcelModalOpen && (
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header del modal Excel */}
              <div className="p-4 bg-emerald-700 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-800 rounded-xl shadow-xs">
                    <FileSpreadsheet className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base">Pegar Boletas desde Excel al Sistema</h4>
                    <p className="text-xs text-emerald-100">
                      Copia tus celdas en Excel (Ctrl+C) y pégalas aquí (Ctrl+V) para cargarlas automáticamente
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-emerald-800 text-emerald-100 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido principal */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Guía visual de columnas recomendadas */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>📋 Orden reconocido de columnas al copiar celdas en Excel:</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadExcelExample}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    >
                      Cargar ejemplo de prueba
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 text-center font-mono text-[11px]">
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 1</span>
                      <strong className="text-slate-800">#</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 2</span>
                      <strong className="text-slate-800">Nº Causa *</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 3</span>
                      <strong className="text-slate-800">Boleta Nº</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 4</span>
                      <strong className="text-slate-800">Notificado / Citado</strong>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 5</span>
                      <span className="text-slate-600 font-semibold">Carácter</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 6</span>
                      <span className="text-slate-600 font-semibold">F. Audiencia / Tipo</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 7</span>
                      <span className="text-slate-600 font-semibold">TRI</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 8</span>
                      <span className="text-slate-600 font-semibold">ART (COPP)</span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="block text-[9px] text-slate-400 uppercase">Col 9</span>
                      <span className="text-slate-600 font-semibold">Alguacil</span>
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1 text-[11px] text-emerald-900 bg-white/70 p-2 rounded-lg border border-emerald-200/60">
                    <p>
                      ⚖️ <strong>Auto-enrutamiento a SOBRESEIMIENTO:</strong> Si la boleta menciona <em>Sobreseimiento</em> (en la causa, notificado o audiencia), se asignará y guardará directamente en la sección de Sobreseimiento.
                    </p>
                    <p>
                      👮 <strong>Alguaciles Flexibles:</strong> Permite cargar y conservar cualquier alguacil aunque no esté registrado previamente en el sistema.
                    </p>
                    <p>
                      📖 <strong>Artículos COPP:</strong> Lee tanto la columna combinada <em>ART</em> como el formato de 7 casillas (167 al S 165).
                    </p>
                  </div>
                </div>

                {/* Área de pegado */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700 flex items-center gap-1.5">
                      <span>Pega aquí tus filas de Excel:</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="Leer directamente del portapapeles del navegador"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        <span>Pegar del Portapapeles</span>
                      </button>
                      {excelRawText && (
                        <button
                          type="button"
                          onClick={() => setExcelRawText('')}
                          className="text-slate-400 hover:text-rose-600 text-[11px] cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    rows={5}
                    value={excelRawText}
                    onChange={(e) => setExcelRawText(e.target.value)}
                    placeholder="Haz clic aquí y pulsa Ctrl+V para pegar las celdas copiadas de Excel..."
                    className="w-full p-3 font-mono text-xs border-2 border-slate-300 focus:border-emerald-500 rounded-xl focus:ring-2 focus:ring-emerald-200 focus:outline-none bg-slate-50 placeholder:text-slate-400"
                  />
                </div>

                {/* Vista Previa de Filas Parseadas */}
                {excelParsedRows.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                          ✓ {excelParsedRows.length} boletas detectadas
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          ({excelParsedRows.filter(r => r.isValid).length} listas sin observaciones)
                        </span>
                        {excelParsedRows.some(r => r.seccionRuta === 'SOBRESEIMIENTO') && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[10px]">
                            ⚖️ {excelParsedRows.filter(r => r.seccionRuta === 'SOBRESEIMIENTO').length} a Sobreseimiento
                          </span>
                        )}
                      </div>

                      {/* Modo de inserción */}
                      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-600">Al insertar:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="excelImportMode"
                            value="REPLACE_EMPTY"
                            checked={excelImportMode === 'REPLACE_EMPTY'}
                            onChange={() => setExcelImportMode('REPLACE_EMPTY')}
                            className="text-emerald-600"
                          />
                          <span>Reemplazar filas vacías</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="excelImportMode"
                            value="APPEND"
                            checked={excelImportMode === 'APPEND'}
                            onChange={() => setExcelImportMode('APPEND')}
                            className="text-emerald-600"
                          />
                          <span>Anexar al final</span>
                        </label>
                        {rows.length > 0 && (
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <input
                              type="radio"
                              name="excelImportMode"
                              value="SYNC_COLUMNS"
                              checked={excelImportMode === 'SYNC_COLUMNS'}
                              onChange={() => setExcelImportMode('SYNC_COLUMNS')}
                              className="text-indigo-600"
                            />
                            <span>Sincronizar columnas (Tri, Art, Alguacil)</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Tabla de previsualización */}
                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl shadow-xs">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="p-1.5 text-center w-8">#</th>
                            <th className="p-1.5">Nº Causa</th>
                            <th className="p-1.5 w-16">Boleta</th>
                            {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                              <th className="p-1.5 w-20 text-center bg-emerald-50 text-emerald-950">Nº Oficio</th>
                            )}
                            <th className="p-1.5">Notificado / Citado</th>
                            <th className="p-1.5 w-20">Carácter</th>
                            <th className="p-1.5 w-24">Audiencia</th>
                            <th className="p-1.5 w-20 text-center bg-indigo-50 text-indigo-950 font-bold">F. Asig</th>
                            <th className="p-1.5 w-12 text-center">Tri</th>
                            <th className="p-1.5 w-14 text-center">Art.</th>
                            <th className="p-1.5">Alguacil</th>
                            <th className="p-1.5 text-center">Sección Destino</th>
                            <th className="p-1.5 w-16 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {excelParsedRows.map((r, i) => (
                            <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60'}>
                              <td className="p-1.5 text-center font-bold text-slate-400">
                                {r.numeroItem !== undefined ? r.numeroItem : (i + 1)}
                              </td>
                              <td className="p-1.5 font-mono font-bold text-slate-900">{r.numeroCausa}</td>
                              <td className="p-1.5 font-bold text-indigo-700">{r.boletaNumero}</td>
                              {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                                <td className="p-1.5 font-mono text-center font-bold text-emerald-950 bg-emerald-50/30">
                                  {r.numeroOficio || '-'}
                                </td>
                              )}
                              <td className="p-1.5 font-semibold text-slate-800">{r.notificadoCitado}</td>
                              <td className="p-1.5 text-slate-600">{r.tipoCitado}</td>
                              <td className="p-1.5">
                                {r.esSoloNotificacion ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                    NOTIFICACIÓN
                                  </span>
                                ) : (
                                  <span className="font-mono text-slate-700">{r.fechaAudiencia}</span>
                                )}
                              </td>
                              <td className="p-1.5 font-mono text-center text-slate-700 bg-indigo-50/30">
                                {r.fechaAsignacion || defaultFechaAsig}
                              </td>
                              <td className="p-1.5 text-center font-bold">{r.tribunal}</td>
                              <td className="p-1.5 text-center font-mono font-bold">{r.articuloCOPP || '-'}</td>
                              <td className="p-1.5 text-slate-800 font-medium">
                                <span>{r.alguacilPractica || '-'}</span>
                                {r.alguacilPractica && !alguaciles.some(a => a.nombre.trim().toUpperCase() === r.alguacilPractica?.trim().toUpperCase()) && (
                                  <span className="ml-1 px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                    Nuevo
                                  </span>
                                )}
                              </td>
                              <td className="p-1.5 text-center">
                                {r.seccionRuta === 'SOBRESEIMIENTO' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 font-black text-[10px]">
                                    ⚖️ SOBRESEIMIENTO
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">
                                    {r.seccionRuta === 'RUTA_INTERNA' ? 'Ruta Interna' : 
                                     r.seccionRuta === 'CORREO_EXT' ? 'Correo Ext.' :
                                     r.seccionRuta === 'OTROS_ESTADOS_MERIDA' ? 'Mérida/Otros' : 'Notif./Citación'}
                                  </span>
                                )}
                              </td>
                              <td className="p-1.5 text-center">
                                {r.isValid ? (
                                  <span className="text-emerald-600 font-bold text-[10px]">✓ Lista</span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[10px]" title={r.validationNote}>Incompleta</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer del modal Excel */}
              <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="px-4 py-2 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-xs"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-2">
                  {rows.length > 0 && (
                    <button
                      type="button"
                      disabled={excelParsedRows.length === 0}
                      onClick={() => {
                        setExcelImportMode('SYNC_COLUMNS');
                        setTimeout(() => handleApplyExcelRows(), 50);
                      }}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border shadow-xs ${
                        excelParsedRows.length > 0
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100'
                          : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Sincroniza únicamente las columnas Tri, Art. COPP y Alguacil sobre las filas que ya tienes en la tabla"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Sincronizar Tri, Art, Alguacil ({Math.min(rows.length, excelParsedRows.length)} filas)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={excelParsedRows.length === 0}
                    onClick={handleApplyExcelRows}
                    className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      excelParsedRows.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02]'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {excelImportMode === 'SYNC_COLUMNS'
                        ? `Sincronizar ${Math.min(rows.length, excelParsedRows.length)} filas`
                        : `Insertar ${excelParsedRows.length} Boletas en la Matriz`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear Sección de Trabajo desde el Modal de Carga de Lotes */}
      <ModalCrearSeccionTrabajo
        isOpen={isModalCrearSeccionOpen}
        onClose={() => setIsModalCrearSeccionOpen(false)}
        onSaveSeccion={handleSaveNuevaSeccionBatch}
        seccionesExistentes={allCustomSections}
      />
    </div>
  );
};
