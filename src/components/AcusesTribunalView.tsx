import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Send, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Download, 
  Printer, 
  Calendar, 
  UserCheck, 
  Layers, 
  FileCheck2,
  CheckSquare,
  Square,
  AlertCircle,
  CalendarClock,
  Filter,
  QrCode,
  Pencil,
  Edit3,
  Check,
  X,
  Users,
  Search,
  Lock,
  Zap,
  Info
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  ConfiguracionDespacho,
  getCaracterDisplay,
  getCaracterPriority
} from '../types/judicial';
import { formatFechaDisplay } from '../utils/alerts';
import { 
  exportarPlanillaAcusesPDF,
  exportarListadoDiligenciasRutasPDF,
  exportarInformeMatrizTribunalPDF,
  exportarOficioEstadisticasGlobalesPDF
} from '../utils/exportPDF';

export interface BoletaAcuseRow {
  key: string;
  idPrincipal: string;
  ids: string[];
  numeroCausa: string;
  boletaNumero: string;
  tribunal: string;
  caracteres: string[];
  personas: {
    nombre: string;
    caracter: string;
    prioridad: number;
  }[];
  esDevuelta: boolean;
  fechaDevueltaTribunal?: string;
  acuseRecibidoPor?: string;
  acuseFechaEntrega?: string;
  acuseHoraEntrega?: string;
  acuseNumeroControl?: string;
  totalEnGrupo: number;
  boletasOriginales: BoletaJudicial[];
  esUrgente: boolean;
}

/**
 * Detecta si una boleta judicial tiene naturaleza de entrega urgente / inmediata
 * (se relaciona de una vez y se entrega de una vez hoy)
 */
export function isBoletaUrgente(b: BoletaJudicial): boolean {
  if (!b) return false;
  const textToCheck = `${b.observaciones || ''} ${b.tipoAudiencia || ''} ${b.notificadoCitado || ''} ${b.numeroCausa || ''}`.toUpperCase();
  return textToCheck.includes('URGENTE') || 
         textToCheck.includes('FLAGRANCIA') || 
         textToCheck.includes('APREHENSION') || 
         textToCheck.includes('APREHENSIÓN') || 
         textToCheck.includes('IMPUTACIÓN') || 
         textToCheck.includes('IMPUTACION') ||
         textToCheck.includes('MEDIDA CAUTELAR') ||
         textToCheck.includes('DE INMEDIATO') ||
         textToCheck.includes('INMEDIATA');
}

interface AcusesTribunalViewProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
  initialTribunalCode?: string;
  initialSelectedBoletaIds?: string[];
  onUpdateBoletas: (updated: BoletaJudicial[]) => void;
}

export const AcusesTribunalView: React.FC<AcusesTribunalViewProps> = ({
  boletas,
  tribunales,
  config,
  initialTribunalCode = 'C1',
  initialSelectedBoletaIds = [],
  onUpdateBoletas,
}) => {
  const [selectedTribunalCode, setSelectedTribunalCode] = useState<string>(initialTribunalCode);
  const [selectedBoletaIds, setSelectedBoletaIds] = useState<string[]>(initialSelectedBoletaIds);
  const [filterStatus, setFilterStatus] = useState<'TODAS' | 'DEVUELTAS_HOY' | 'PENDIENTES' | 'ENTREGADAS'>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFechaFiltro, setSelectedFechaFiltro] = useState<string>('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPlanillaModal, setShowPlanillaModal] = useState(false);
  
  // Filtro/Pestaña de organización por fecha de entrega
  // 'TODAS' = agrupado visualmente por fecha | 'MANANA' | 'HOY_URGENTE' | fecha YYYY-MM-DD
  const [selectedFechaTab, setSelectedFechaTab] = useState<string>('TODAS');

  // Fechas del sistema:
  // REGLA FUNDAMENTAL DE ACUSES: En los acuses se relacionan hoy para que sea entregado el día de mañana,
  // a menos que haya una boleta urgente por entregar que se relaciona de una vez y se entrega de una vez hoy.
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);
  const [fechaEntregaPlanilla, setFechaEntregaPlanilla] = useState(tomorrowStr);
  const [alguacilEntregaPlanilla, setAlguacilEntregaPlanilla] = useState('');
  
  // Sync if initial props change
  React.useEffect(() => {
    if (initialTribunalCode) {
      setSelectedTribunalCode(initialTribunalCode);
    }
  }, [initialTribunalCode]);

  React.useEffect(() => {
    if (initialSelectedBoletaIds && initialSelectedBoletaIds.length > 0) {
      setSelectedBoletaIds(initialSelectedBoletaIds);
    }
  }, [initialSelectedBoletaIds]);
  
  // Batch form fields: por defecto entrega mañana (salvo urgente hoy)
  const [batchFechaEntrega, setBatchFechaEntrega] = useState(tomorrowStr);
  const [batchHoraEntrega, setBatchHoraEntrega] = useState(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  const [batchRecibidoPor, setBatchRecibidoPor] = useState('');
  const [batchNumeroOficio, setBatchNumeroOficio] = useState('');
  const [batchObservaciones, setBatchObservaciones] = useState('');
  const [batchAlcance, setBatchAlcance] = useState<'SELECCIONADAS' | 'TODO_TRIBUNAL' | 'PENDIENTES'>('TODO_TRIBUNAL');

  // Info del tribunal seleccionado
  const selectedTribunal = useMemo(() => {
    return tribunales.find(t => t.codigo === selectedTribunalCode) || tribunales[0];
  }, [tribunales, selectedTribunalCode]);

  // Helper: Solo las boletas listas por entregar o ya entregadas aparecen en los acuses.
  // En la sección de Mérida / Otros todas la boleta prácticada y devuelta deben de salir en acuses de OTROS.
  const isBoletaListaPorEntregar = (b: BoletaJudicial): boolean => {
    if (selectedTribunalCode === 'OTRO' || b.seccionRuta === 'OTROS_ESTADOS_MERIDA') {
      return b.estado === 'PRACTICADA' || !!b.devueltaAlTribunal;
    }
    return !!b.devueltaAlTribunal;
  };

  // Todas las boletas registradas para este tribunal
  const boletasTodasTribunal = useMemo(() => {
    if (selectedTribunalCode === 'OTRO') {
      const tribunalesLocales = ['C1', 'C2', 'C3', 'J1', 'J2', 'J3', 'E1', 'E2', 'TPM1', 'TPM2', 'SPA 1'];
      return boletas.filter(b => {
        const triClean = (b.tribunal || '').toUpperCase().trim();
        return (
          b.seccionRuta === 'OTROS_ESTADOS_MERIDA' ||
          triClean === 'OTRO' ||
          !tribunalesLocales.includes(triClean)
        );
      });
    }
    return boletas.filter(b => b.tribunal.toUpperCase() === selectedTribunalCode.toUpperCase());
  }, [boletas, selectedTribunalCode]);

  // Boletas de este tribunal DEVUELTAS (solo estas aparecen en acuses por tribunal)
  const boletasTribunal = useMemo(() => {
    return boletasTodasTribunal.filter(b => isBoletaListaPorEntregar(b));
  }, [boletasTodasTribunal]);

  // Boletas de este tribunal pendientes por devolver (no aparecen en acuses)
  const boletasEnDiligencia = useMemo(() => {
    return boletasTodasTribunal.filter(b => !isBoletaListaPorEntregar(b));
  }, [boletasTodasTribunal]);

  // Boletas devueltas hoy en este tribunal
  const boletasDevueltasHoy = useMemo(() => {
    return boletasTribunal.filter(b => b.fechaDevueltaTribunal === todayStr);
  }, [boletasTribunal, todayStr]);

  // Consolidación de boletas por Tribunal, Nº de Causa/Expediente y Nº de Boleta
  // En los acuses solo aparece el CARÁCTER. Se elimina el ART.
  const boletasConsolidadasTribunal = useMemo<BoletaAcuseRow[]>(() => {
    const map = new Map<string, BoletaAcuseRow>();

    for (const b of boletasTribunal) {
      const c = (b.numeroCausa || '').trim().toUpperCase();
      const n = (b.boletaNumero || '').trim().toUpperCase();
      const triEspecificado = (
        b.tribunalOtro ||
        (b.tribunal && b.tribunal.toUpperCase() !== 'OTRO' ? b.tribunal : '') ||
        'TRIBUNAL FORÁNEO'
      ).trim().toUpperCase();
      const triKey = selectedTribunalCode === 'OTRO' ? triEspecificado : (b.tribunal || selectedTribunalCode).trim().toUpperCase();
      const key = `${triKey}:::${c}:::${n}`;

      const caracterStr = getCaracterDisplay(b.tipoCitado);
      const caracterPrio = getCaracterPriority(b.tipoCitado);
      const personaNombre = (b.notificadoCitado || '').trim();
      const esUrg = isBoletaUrgente(b);

      if (!map.has(key)) {
        map.set(key, {
          key,
          idPrincipal: b.id,
          ids: [b.id],
          numeroCausa: b.numeroCausa,
          boletaNumero: b.boletaNumero,
          tribunal: selectedTribunalCode === 'OTRO' ? triEspecificado : (b.tribunal || selectedTribunal.codigo),
          caracteres: [caracterStr],
          personas: personaNombre ? [{ nombre: personaNombre, caracter: caracterStr, prioridad: caracterPrio }] : [],
          esDevuelta: !!b.devueltaAlTribunal,
          fechaDevueltaTribunal: b.fechaDevueltaTribunal,
          acuseRecibidoPor: b.acuseRecibidoPor,
          acuseFechaEntrega: b.acuseFechaEntrega,
          acuseHoraEntrega: b.acuseHoraEntrega,
          acuseNumeroControl: b.acuseNumeroControl,
          totalEnGrupo: 1,
          boletasOriginales: [b],
          esUrgente: esUrg,
        });
      } else {
        const item = map.get(key)!;
        item.ids.push(b.id);
        item.totalEnGrupo += 1;
        item.boletasOriginales.push(b);
        if (esUrg) item.esUrgente = true;

        if (!item.caracteres.includes(caracterStr)) {
          item.caracteres.push(caracterStr);
        }

        // Personas (sin duplicados de nombre en la misma fila)
        if (personaNombre) {
          if (!item.personas) item.personas = [];
          const yaExiste = (item.personas || []).some(p => (p?.nombre || '').toLowerCase() === personaNombre.toLowerCase());
          if (!yaExiste) {
            item.personas.push({ nombre: personaNombre, caracter: caracterStr, prioridad: caracterPrio });
            item.personas.sort((p1, p2) => p1.prioridad - p2.prioridad);
          }
        }

        // Si la boleta tiene datos de entrega
        if (b.devueltaAlTribunal) {
          if (!item.fechaDevueltaTribunal && b.fechaDevueltaTribunal) {
            item.fechaDevueltaTribunal = b.fechaDevueltaTribunal;
          }
          if (!item.acuseRecibidoPor && b.acuseRecibidoPor) {
            item.acuseRecibidoPor = b.acuseRecibidoPor;
            item.acuseFechaEntrega = b.acuseFechaEntrega;
            item.acuseHoraEntrega = b.acuseHoraEntrega;
          }
        }

        // Devuelta solo si todas están devueltas
        item.esDevuelta = item.boletasOriginales.every(orig => orig.devueltaAlTribunal);
      }
    }

    // Mantener orden estable y consistente
    return Array.from(map.values()).sort((a, b) => {
      if (a.numeroCausa !== b.numeroCausa) {
        return a.numeroCausa.localeCompare(b.numeroCausa);
      }
      return a.boletaNumero.localeCompare(b.boletaNumero);
    });
  }, [boletasTribunal, selectedTribunalCode, selectedTribunal.codigo]);

  // Helper para determinar la fecha efectiva de entrega de cada causa/boleta
  // REGLA: Si no tiene fecha asignada aún: si es urgente -> hoy (de una vez), si es habitual -> mañana
  const getItemEffectiveDate = (item: BoletaAcuseRow): string => {
    if (item.acuseFechaEntrega) return item.acuseFechaEntrega;
    if (item.fechaDevueltaTribunal) return item.fechaDevueltaTribunal;
    return item.esUrgente ? todayStr : tomorrowStr;
  };

  // Boletas consolidadas filtradas según búsqueda por fecha, nomenclatura y estado
  const boletasConsolidadasFiltradas = useMemo(() => {
    return boletasConsolidadasTribunal.filter(item => {
      // 1. Filtro estricto por Selector de Fecha (si se seleccionó una fecha específica)
      if (selectedFechaFiltro) {
        const fEfectiva = getItemEffectiveDate(item);
        const matchesFechaSel = 
          fEfectiva === selectedFechaFiltro ||
          item.fechaDevueltaTribunal === selectedFechaFiltro ||
          item.acuseFechaEntrega === selectedFechaFiltro;
        if (!matchesFechaSel) return false;
      }

      // 2. Búsqueda por Nomenclatura, Boleta, Oficio, Fecha o Texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        // Quitar caracteres separadores para comparar nomenclatura sin preocuparse por guiones o barras
        const termClean = term.replace(/[\s\-_/.]/g, '');

        // Nomenclatura de Causa y Boleta
        const causaOriginal = (item.numeroCausa || '').toLowerCase();
        const causaClean = causaOriginal.replace(/[\s\-_/.]/g, '');
        const boletaOriginal = (item.boletaNumero || '').toLowerCase();
        const boletaClean = boletaOriginal.replace(/[\s\-_/.]/g, '');
        const controlOriginal = (item.acuseNumeroControl || '').toLowerCase();
        const controlClean = controlOriginal.replace(/[\s\-_/.]/g, '');

        const matchesCausa = causaOriginal.includes(term) || (termClean.length > 0 && causaClean.includes(termClean));
        const matchesBoleta = boletaOriginal.includes(term) || (termClean.length > 0 && boletaClean.includes(termClean));
        const matchesControl = controlOriginal.includes(term) || (termClean.length > 0 && controlClean.includes(termClean));
        const matchesTribunal = (item.tribunal || '').toLowerCase().includes(term);
        
        // Personas citadas / funcionario receptor
        const matchesPersona = (item.personas || []).some(p => (p?.nombre || '').toLowerCase().includes(term));
        const matchesRecibido = (item.acuseRecibidoPor || '').toLowerCase().includes(term);

        // Búsqueda por Fecha dentro del buscador de texto (soporta 2026-09-23, 23/09/2026, 23-09, etc.)
        const fEfectiva = getItemEffectiveDate(item);
        const fDevuelta = item.fechaDevueltaTribunal || '';
        const fAcuse = item.acuseFechaEntrega || '';

        const dispEfectiva = formatFechaDisplay(fEfectiva).toLowerCase();
        const dispDevuelta = formatFechaDisplay(fDevuelta).toLowerCase();
        const dispAcuse = formatFechaDisplay(fAcuse).toLowerCase();

        const matchesFecha =
          fEfectiva.includes(term) ||
          fDevuelta.includes(term) ||
          fAcuse.includes(term) ||
          dispEfectiva.includes(term) ||
          dispDevuelta.includes(term) ||
          dispAcuse.includes(term);

        // Revisar boletas originales por si algún dato secundario coincide
        const matchesOriginales = item.boletasOriginales.some(b => {
          const bCausa = (b.numeroCausa || '').toLowerCase();
          const bBoleta = (b.boletaNumero || '').toLowerCase();
          const bAlguacil = (b.alguacilPractica || '').toLowerCase();
          const bFechaAud = (b.fechaAudiencia || '').toLowerCase();
          return bCausa.includes(term) || bBoleta.includes(term) || bAlguacil.includes(term) || bFechaAud.includes(term);
        });

        if (!matchesCausa && !matchesBoleta && !matchesControl && !matchesPersona && !matchesRecibido && !matchesFecha && !matchesOriginales && !matchesTribunal) {
          return false;
        }
      }

      if (filterStatus === 'DEVUELTAS_HOY') {
        return item.esDevuelta && item.fechaDevueltaTribunal === todayStr;
      }
      if (filterStatus === 'PENDIENTES') {
        return !item.esDevuelta;
      }
      if (filterStatus === 'ENTREGADAS') {
        return item.esDevuelta;
      }
      return true;
    });
  }, [boletasConsolidadasTribunal, filterStatus, selectedFechaFiltro, todayStr, tomorrowStr, searchTerm]);

  // Agrupación visual y operativa por FECHA DE ENTREGA
  // (Evita ver todo junto en un solo listado y permite guardar/imprimir por fecha)
  const gruposPorFecha = useMemo(() => {
    const map = new Map<string, BoletaAcuseRow[]>();

    for (const item of boletasConsolidadasFiltradas) {
      const f = getItemEffectiveDate(item);
      if (!map.has(f)) {
        map.set(f, []);
      }
      map.get(f)!.push(item);
    }

    const result = Array.from(map.entries()).map(([fecha, items]) => {
      const esHoy = fecha === todayStr;
      const esManana = fecha === tomorrowStr;
      const contieneUrgentes = items.some(it => it.esUrgente);
      const totalBoletasFisicas = items.reduce((acc, it) => acc + (it.totalEnGrupo || 1), 0);

      let titulo = `ENTREGA REGISTRADA: ${formatFechaDisplay(fecha)}`;
      let subtitulo = `Acuses y causas guardadas para esta fecha`;
      let badgeTipo: 'MANANA' | 'HOY_URGENTE' | 'OTRA_FECHA' = 'OTRA_FECHA';

      if (esManana) {
        titulo = `ENTREGA PROGRAMADA: MAÑANA (${formatFechaDisplay(fecha)})`;
        subtitulo = `Relación elaborada hoy para entregar mañana en secretaría (Entrega Habitual)`;
        badgeTipo = 'MANANA';
      } else if (esHoy) {
        titulo = `ENTREGA DE HOY: ${formatFechaDisplay(fecha)} ${contieneUrgentes ? '(URGENTE)' : ''}`;
        subtitulo = contieneUrgentes 
          ? `Boletas urgentes: se relacionan y entregan de una vez hoy`
          : `Relacionadas para entregar de una vez hoy`;
        badgeTipo = 'HOY_URGENTE';
      }

      return {
        fecha,
        esHoy,
        esManana,
        contieneUrgentes,
        titulo,
        subtitulo,
        badgeTipo,
        items,
        totalBoletasFisicas,
      };
    });

    // Ordenar: primero mañana (si existe), luego hoy (si existe), luego por fecha descendente
    return result.sort((a, b) => {
      if (a.fecha === tomorrowStr) return -1;
      if (b.fecha === tomorrowStr) return 1;
      if (a.fecha === todayStr) return -1;
      if (b.fecha === todayStr) return 1;
      return b.fecha.localeCompare(a.fecha);
    });
  }, [boletasConsolidadasFiltradas, todayStr, tomorrowStr]);

  // Grupos filtrados según la pestaña de fecha seleccionada
  const gruposAMostrar = useMemo(() => {
    if (selectedFechaTab === 'TODAS') return gruposPorFecha;
    if (selectedFechaTab === 'MANANA') return gruposPorFecha.filter(g => g.fecha === tomorrowStr);
    if (selectedFechaTab === 'HOY_URGENTE') return gruposPorFecha.filter(g => g.fecha === todayStr);
    return gruposPorFecha.filter(g => g.fecha === selectedFechaTab);
  }, [gruposPorFecha, selectedFechaTab, tomorrowStr, todayStr]);

  // Contadores para las pestañas de fecha
  const countManana = useMemo(() => {
    const grp = gruposPorFecha.find(g => g.fecha === tomorrowStr);
    return grp ? grp.items.length : 0;
  }, [gruposPorFecha, tomorrowStr]);

  const countHoy = useMemo(() => {
    const grp = gruposPorFecha.find(g => g.fecha === todayStr);
    return grp ? grp.items.length : 0;
  }, [gruposPorFecha, todayStr]);

  // Generar planilla PDF exclusiva para una fecha específica
  const handleImprimirPlanillaPorFecha = (fecha: string, itemsFecha: BoletaAcuseRow[]) => {
    const boletasAExportar: BoletaJudicial[] = [];
    for (const it of itemsFecha) {
      boletasAExportar.push(...it.boletasOriginales);
    }
    if (boletasAExportar.length === 0) {
      alert('No hay boletas para exportar en esta fecha.');
      return;
    }
    const alguacilesLista = Array.from(new Set(
      boletasAExportar
        .map(b => (b.alguacilPractica || '').trim())
        .filter(a => a !== '' && !a.toUpperCase().includes('SIN ASIGNAR'))
    ));
    const alguacil = alguacilesLista.join(', ') || config.alguacilesRuta || 'ALGUACILAZGO';
    exportarPlanillaAcusesPDF(
      selectedTribunal.nombre,
      boletasAExportar,
      config,
      fecha,
      alguacil
    );
  };

  // Abrir modal de persona que recibió para todas las boletas de una fecha específica
  const handleEscribirReceptorPorFecha = (fecha: string, itemsFecha: BoletaAcuseRow[]) => {
    const ids: string[] = [];
    for (const it of itemsFecha) {
      ids.push(...it.ids);
    }
    setSelectedBoletaIds(ids);
    setBatchFechaEntrega(fecha);
    setBatchHoraEntrega(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    setBatchAlcance('SELECCIONADAS');
    setShowBatchModal(true);
  };

  // Seleccionar / deseleccionar todas las causas de un grupo de fecha
  const handleToggleSelectGrupoFecha = (itemsFecha: BoletaAcuseRow[], checked: boolean) => {
    const idsGrupo = itemsFecha.flatMap(it => it.ids);
    if (checked) {
      setSelectedBoletaIds(prev => Array.from(new Set([...prev, ...idsGrupo])));
    } else {
      setSelectedBoletaIds(prev => prev.filter(id => !idsGrupo.includes(id)));
    }
  };

  // Métricas del tribunal en Acuses (calculadas sobre las causas/boletas consolidadas)
  const totalBoletas = boletasTribunal.length;
  const totalConsolidadas = boletasConsolidadasTribunal.length;
  const listosParaEntregar = boletasConsolidadasTribunal.filter(b => !b.esDevuelta).length;
  const yaEntregados = boletasConsolidadasTribunal.filter(b => b.esDevuelta).length;
  const entregadasHoy = boletasConsolidadasTribunal.filter(b => b.esDevuelta && b.fechaDevueltaTribunal === todayStr).length;
  const totalNoListas = boletasEnDiligencia.length;

  // Detectar si hay causas/boletas repetidas con la misma causa y boleta
  const boletasRepetidasInfo = useMemo(() => {
    const gruposConsolidados = boletasConsolidadasTribunal.filter(g => g.totalEnGrupo > 1);
    const boletasEnGrupos = gruposConsolidados.reduce((acc, g) => acc + g.totalEnGrupo, 0);
    return {
      hayRepetidas: gruposConsolidados.length > 0,
      cantidadGrupos: gruposConsolidados.length,
      boletasEnGrupos,
    };
  }, [boletasConsolidadasTribunal]);

  // Marcar boletas en diligencia como recibidas en UAC (ponerlas listas para entregar)
  const handleMarcarEnDiligenciaComoListas = () => {
    if (boletasEnDiligencia.length === 0) return;
    if (!confirm(`¿Confirmas que regresaron y se recibieron en UAC las ${boletasEnDiligencia.length} boleta(s) de ${selectedTribunal.codigo} para ponerlas listas por entregar?`)) return;

    const ids = boletasEnDiligencia.map(b => b.id);
    const updated = boletas.map(b => {
      if (ids.includes(b.id)) {
        return {
          ...b,
          fechaRecibidoUAC: todayStr,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });
    onUpdateBoletas(updated);
  };

  // Inline registro para casilla "RECIBIDA POR"
  const [editingRecibidoKey, setEditingRecibidoKey] = useState<string | null>(null);
  const [editingRecibidoTargetIds, setEditingRecibidoTargetIds] = useState<string[]>([]);
  const [editRecibidoNombre, setEditRecibidoNombre] = useState('');
  const [editRecibidoFecha, setEditRecibidoFecha] = useState(tomorrowStr);
  const [editRecibidoHora, setEditRecibidoHora] = useState('');

  // Iniciar registro o modificación de quien recibió en el tribunal
  const handleStartEditRecibido = (item: BoletaAcuseRow) => {
    setEditingRecibidoKey(item.key);
    setEditingRecibidoTargetIds(item.ids);
    setEditRecibidoNombre(item.acuseRecibidoPor || '');
    const fechaDefecto = item.acuseFechaEntrega || item.fechaDevueltaTribunal || (item.esUrgente ? todayStr : tomorrowStr);
    setEditRecibidoFecha(fechaDefecto);
    setEditRecibidoHora(item.acuseHoraEntrega || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  // Guardar datos de quien recibió desde la casilla (editable en cualquier momento y reubica por fecha)
  const handleSaveEditRecibido = (targetIds: string[]) => {
    const nombreClean = editRecibidoNombre.trim();
    if (!nombreClean) {
      alert('Por favor ingrese el nombre de la persona que recibió en el tribunal.');
      return;
    }
    const fechaClean = editRecibidoFecha || tomorrowStr;
    const horaClean = editRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const updated = boletas.map(b => {
      if (targetIds.includes(b.id)) {
        return {
          ...b,
          acuseRecibidoPor: nombreClean,
          acuseFechaEntrega: fechaClean,
          acuseHoraEntrega: horaClean,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: fechaClean,
          acuseGenerado: true,
          estado: 'DEVUELTA_TRIBUNAL' as any,
          updatedAt: new Date().toISOString()
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setEditingRecibidoKey(null);
    setEditingRecibidoTargetIds([]);
  };

  // Toggle selección de un grupo consolidado
  const toggleSelectGrupo = (ids: string[]) => {
    setSelectedBoletaIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !ids.includes(id));
      } else {
        return Array.from(new Set([...prev, ...ids]));
      }
    });
  };

  // Checkbox de cabecera: selecciona o deselecciona todas las boletas filtradas visibles
  const isAllFilteredSelected = boletasConsolidadasFiltradas.length > 0 &&
    boletasConsolidadasFiltradas.every(item => (item.ids || []).every(id => selectedBoletaIds.includes(id)));

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = boletasConsolidadasFiltradas.flatMap(item => item.ids || []);
      setSelectedBoletaIds(prev => Array.from(new Set([...prev, ...allIds])));
    } else {
      const idsToRemove = new Set(boletasConsolidadasFiltradas.flatMap(item => item.ids || []));
      setSelectedBoletaIds(prev => prev.filter(id => !idsToRemove.has(id)));
    }
  };

  const selectAllPendientes = () => {
    const pendientesIds = boletasTribunal.filter(b => !b.devueltaAlTribunal).map(b => b.id);
    setSelectedBoletaIds(pendientesIds);
  };

  const selectAllDevueltasHoy = () => {
    const hoyIds = boletasDevueltasHoy.map(b => b.id);
    setSelectedBoletaIds(hoyIds);
  };

  const clearSelection = () => {
    setSelectedBoletaIds([]);
  };

  // Determinar boletas a incluir para la planilla
  const boletasAIncluir = useMemo(() => {
    if (selectedBoletaIds.length > 0) {
      return boletasTribunal.filter(b => selectedBoletaIds.includes(b.id));
    }
    // Si no hay seleccionadas manualmente, incluir las devueltas o pendientes según filtro
    const devueltas = boletasTribunal.filter(b => b.devueltaAlTribunal);
    return devueltas.length > 0 ? devueltas : boletasTribunal;
  }, [boletasTribunal, selectedBoletaIds]);

  // Abrir modal de confirmación y fecha antes de generar PDF
  const handleOpenPlanillaModal = () => {
    if (boletasTribunal.length === 0) {
      alert('No hay boletas registradas para este tribunal.');
      return;
    }
    const hayUrgentes = boletasAIncluir.some(isBoletaUrgente);
    setFechaEntregaPlanilla(hayUrgentes ? todayStr : tomorrowStr);
    const alguacilesLista = Array.from(new Set(boletasAIncluir.map(b => b.alguacilPractica).filter(Boolean)));
    setAlguacilEntregaPlanilla(alguacilesLista.join(', ') || config.alguacilesRuta || 'ALGUACILAZGO');
    setShowPlanillaModal(true);
  };

  // Generar Planilla PDF Oficial de Acuse con la fecha especificada
  const handleConfirmarGeneracionPlanilla = (marcarEntregadas: boolean = false) => {
    if (boletasAIncluir.length === 0) {
      alert('No hay boletas seleccionadas para generar la planilla.');
      return;
    }

    exportarPlanillaAcusesPDF(
      selectedTribunalCode === 'OTRO' ? 'MÉRIDA Y OTROS TRIBUNALES (FORÁNEOS)' : selectedTribunal.nombre,
      boletasAIncluir,
      config,
      fechaEntregaPlanilla,
      alguacilEntregaPlanilla || config.alguacilesRuta,
      'imprimir'
    );

    if (marcarEntregadas) {
      const idsAEntregar = boletasAIncluir.map(b => b.id);
      const updated = boletas.map(b => {
        if (idsAEntregar.includes(b.id)) {
          return {
            ...b,
            devueltaAlTribunal: true,
            fechaDevueltaTribunal: fechaEntregaPlanilla,
            acuseGenerado: true,
            acuseFechaEntrega: fechaEntregaPlanilla,
            estado: 'DEVUELTA_TRIBUNAL' as const,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });
      onUpdateBoletas(updated);
      setSelectedBoletaIds([]);
    }

    setShowPlanillaModal(false);
  };

  // Determinar boletas destino para asignación en lote
  const boletasDestinoLote = useMemo(() => {
    if (batchAlcance === 'SELECCIONADAS' && selectedBoletaIds.length > 0) {
      return boletasTribunal.filter(b => selectedBoletaIds.includes(b.id));
    }
    if (batchAlcance === 'PENDIENTES') {
      const sinReceptor = boletasTribunal.filter(b => !b.acuseRecibidoPor);
      return sinReceptor.length > 0 ? sinReceptor : boletasTribunal;
    }
    // TODO_TRIBUNAL: todas las boletas de este tribunal listas en acuses
    return boletasTribunal;
  }, [batchAlcance, selectedBoletaIds, boletasTribunal]);

  // Abrir modal de asignación en lote de Receptor
  const handleOpenLoteRecibidoModal = () => {
    const destino = selectedBoletaIds.length > 0 
      ? boletasTribunal.filter(b => selectedBoletaIds.includes(b.id))
      : boletasTribunal;
    const hayUrgentes = destino.some(isBoletaUrgente);
    setBatchFechaEntrega(hayUrgentes ? todayStr : tomorrowStr);
    setBatchHoraEntrega(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    if (selectedBoletaIds.length > 0) {
      setBatchAlcance('SELECCIONADAS');
    } else {
      setBatchAlcance('TODO_TRIBUNAL');
    }
    setShowBatchModal(true);
  };

  // Guardar entrega en lote con formulario modal
  const handleGuardarEntregaLote = (e: React.FormEvent) => {
    e.preventDefault();
    const nombreClean = batchRecibidoPor.trim();
    if (!nombreClean) {
      alert('Por favor ingrese el nombre de la persona que recibió en el tribunal.');
      return;
    }
    if (boletasDestinoLote.length === 0) {
      alert('No hay boletas disponibles para actualizar en el alcance seleccionado.');
      return;
    }

    const idsDestino = new Set(boletasDestinoLote.map(b => b.id));
    const fechaClean = batchFechaEntrega || tomorrowStr;
    const horaClean = batchHoraEntrega.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const updated = boletas.map(b => {
      if (idsDestino.has(b.id)) {
        return {
          ...b,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: fechaClean,
          acuseGenerado: true,
          acuseNumeroControl: batchNumeroOficio.trim() || b.acuseNumeroControl || `ACU-${selectedTribunal.codigo}-${fechaClean}`,
          acuseFechaEntrega: fechaClean,
          acuseHoraEntrega: horaClean,
          acuseRecibidoPor: nombreClean,
          acuseObservaciones: batchObservaciones.trim() || b.acuseObservaciones,
          estado: 'DEVUELTA_TRIBUNAL' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
    setShowBatchModal(false);
    setBatchRecibidoPor('');
    setBatchNumeroOficio('');
    setBatchObservaciones('');
  };

  // Marcado directo de entrega rápida (1 solo clic)
  const handleDirectMarkEntregadas = () => {
    if (selectedBoletaIds.length === 0) return;
    const selectedBoletas = boletas.filter(b => selectedBoletaIds.includes(b.id));
    const hayUrgentes = selectedBoletas.some(isBoletaUrgente);
    const defaultFecha = hayUrgentes ? todayStr : tomorrowStr;

    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        const esUrg = isBoletaUrgente(b);
        const fechaEsta = b.acuseFechaEntrega || (esUrg ? todayStr : defaultFecha);
        return {
          ...b,
          devueltaAlTribunal: true,
          fechaDevueltaTribunal: fechaEsta,
          acuseGenerado: true,
          acuseNumeroControl: b.acuseNumeroControl || `ACU-${selectedTribunal.codigo}-${fechaEsta}`,
          acuseFechaEntrega: fechaEsta,
          acuseRecibidoPor: b.acuseRecibidoPor || undefined,
          estado: 'DEVUELTA_TRIBUNAL' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
  };

  return (
    <div className="space-y-5">
      {/* Selector de Tribunales en Cuadrícula / Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Seleccionar Tribunal para Relación de Acuses
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            11 Tribunales del Circuito Judicial
          </span>
        </div>

        {/* Botones de Tribunales */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tribunales.map((tri) => {
            const esEsteTri = (b: BoletaJudicial) => {
              if (tri.codigo === 'OTRO') {
                const tribunalesLocales = ['C1', 'C2', 'C3', 'J1', 'J2', 'J3', 'E1', 'E2', 'TPM1', 'TPM2', 'SPA 1'];
                const triClean = (b.tribunal || '').toUpperCase().trim();
                return b.seccionRuta === 'OTROS_ESTADOS_MERIDA' || triClean === 'OTRO' || !tribunalesLocales.includes(triClean);
              }
              return b.tribunal.toUpperCase() === tri.codigo.toUpperCase();
            };
            const esListoEsteTri = (b: BoletaJudicial) => {
              if (tri.codigo === 'OTRO' || b.seccionRuta === 'OTROS_ESTADOS_MERIDA') {
                return b.estado === 'PRACTICADA' || !!b.devueltaAlTribunal;
              }
              return !!b.devueltaAlTribunal;
            };
            const count = boletas.filter(b => esEsteTri(b) && esListoEsteTri(b)).length;
            const pendientes = boletas.filter(b => esEsteTri(b) && esListoEsteTri(b) && !b.devueltaAlTribunal).length;
            const enRuta = boletas.filter(b => esEsteTri(b) && !esListoEsteTri(b)).length;
            const isSelected = selectedTribunalCode === tri.codigo;

            return (
              <button
                key={tri.id}
                id={`btn-select-tri-${tri.codigo}`}
                onClick={() => {
                  setSelectedTribunalCode(tri.codigo);
                  setSelectedBoletaIds([]);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${isSelected ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-800'}`}>
                    {tri.codigo}
                  </span>
                  {pendientes > 0 ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                      {pendientes} pend.
                    </span>
                  ) : count > 0 ? (
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-100' : 'text-emerald-600'}`}>
                      Al día
                    </span>
                  ) : (
                    <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      Sin boletas
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-semibold mt-1.5 truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                  {tri.nombre}
                </p>
                <div className={`flex items-center justify-between mt-1 text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                  <span>Listas: {count} {enRuta > 0 ? `(${enRuta} en ruta)` : ''}</span>
                  <span>{Math.round((count > 0 ? ((count - pendientes) / count) : 1) * 100)}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle y Gestión de Acuses del Tribunal Seleccionado */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Encabezado del Tribunal */}
        <div className="p-4 sm:p-5 bg-[#1e293b] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-700">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center font-black text-indigo-300 text-lg">
              {selectedTribunal.codigo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {selectedTribunalCode === 'OTRO' ? 'ACUSES OTROS TRIBUNALES / MÉRIDA Y FORÁNEOS' : selectedTribunal.nombre}
                </h3>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white font-extrabold rounded uppercase">
                  {selectedTribunal.tipo}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Relación y control de boletas judiciales, acuses de recibo y devoluciones
              </p>
            </div>
          </div>

          {/* Botones de acción del acuse */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              id="btn-imprimir-planilla-acuse"
              onClick={handleOpenPlanillaModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ring-1 ring-white/20"
              title="Generar Planilla Oficial de Entrega en formato PDF para imprimir"
            >
              <FileCheck2 className="w-4 h-4 text-white" />
              <span>Generar Planilla (PDF)</span>
            </button>

            {/* Botón Oficio de Rendición por Tribunal con QR (Sin listado detallado de boletas) */}
            <button
              id="btn-oficio-tribunal-qr"
              onClick={() => exportarInformeMatrizTribunalPDF(selectedTribunal, boletas, config)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ring-1 ring-white/10"
              title={`Descargar Oficio de Rendición por Tribunal con 7 Artículos COPP (167 al S 165), efectividad y QR para ${selectedTribunal.codigo}`}
            >
              <QrCode className="w-4 h-4 text-amber-300" />
              <span>Oficio Tribunal COPP (QR)</span>
            </button>

            <button
              id="btn-oficio-global-qr"
              onClick={() => exportarOficioEstadisticasGlobalesPDF(boletas, tribunales, config)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Descargar Oficio de Rendición de Estadísticas Globales por Artículos del COPP para Presidencia con Código QR"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Oficio Global COPP (QR)</span>
            </button>

            {selectedBoletaIds.length > 0 && (
              <button
                type="button"
                onClick={handleDirectMarkEntregadas}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Marcar inmediatamente como entregadas al tribunal sin abrir formulario"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Marcar Entregadas ({selectedBoletaIds.length})</span>
              </button>
            )}

            {/* Opción para registrar funcionario receptor y número de oficio */}
            <button
              id="btn-lote-persona-recibio"
              type="button"
              onClick={handleOpenLoteRecibidoModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer ring-1 ring-white/10"
              title="Asignar funcionario receptor, fecha y oficio de entrega"
            >
              <UserCheck className="w-4 h-4 text-emerald-300" />
              <span>Registrar Receptor / Oficio</span>
            </button>
          </div>
        </div>

        {/* Notificación de causas consolidadas si existen */}
        {boletasRepetidasInfo.hayRepetidas && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Consolidación por Causa y Boleta activa:</strong> Se detectaron {boletasRepetidasInfo.cantidadGrupos} casos ({boletasRepetidasInfo.boletasEnGrupos} boletas) que comparten Nº de Expediente/Causa y Boleta. Se muestran consolidadas en una sola boleta con: <strong>Nº, Nº DE CAUSA, BOLETA, CARÁCTER, PERSONA NOTIFICADA / CITADA, TRI, ESTADO, RECIBIDA POR</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Tarjetas de Resumen Rápido del Tribunal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Listas en Acuses</span>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{totalConsolidadas}</p>
            {totalBoletas !== totalConsolidadas && (
              <span className="text-[10px] text-slate-500 block">({totalBoletas} boletas individuales)</span>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Devueltas / Acusadas</span>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{yaEntregados}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider">Devueltas Hoy</span>
            <p className="text-2xl font-bold text-indigo-700 mt-0.5">{entregadasHoy}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/30 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">Pendientes de Entrega</span>
            <p className="text-2xl font-bold text-amber-800 mt-0.5">{listosParaEntregar}</p>
          </div>
        </div>

        {/* Notificación informativa: Boletas no listas por entregar (aún en diligencia en calle con alguacil) */}
        {totalNoListas > 0 && (
          <div className="px-4 py-2.5 bg-amber-50/90 border-b border-amber-200 text-amber-950 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{totalNoListas} boleta(s) aún en diligencia en la calle:</strong> No se muestran en estos acuses hasta que regresen a UAC o estén practicadas por el alguacil.
              </span>
            </div>
            <button
              type="button"
              onClick={handleMarcarEnDiligenciaComoListas}
              className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-lg font-bold text-[11px] cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
              title="Marcar que estas boletas ya fueron devueltas a la Unidad de Alguacilazgo para que aparezcan listas para acuse"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Marcar recibidas en UAC ({totalNoListas})</span>
            </button>
          </div>
        )}

        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Buscador de Nomenclatura (Causa, Boleta, Oficio, etc.) */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nomenclatura (Causa, Boleta, Oficio)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                title="Buscar por nomenclatura judicial (Nº de Causa/Expediente, Boleta, Oficio de entrega o fecha)"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por Fecha de Acuse / Entrega */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700 hidden sm:inline">Fecha:</span>
              <input
                type="date"
                value={selectedFechaFiltro}
                onChange={(e) => {
                  setSelectedFechaFiltro(e.target.value);
                  if (e.target.value) {
                    setSelectedFechaTab('TODAS');
                  }
                }}
                className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                title="Filtrar acuses por una fecha específica de entrega o devolución"
              />
              {selectedFechaFiltro && (
                <button
                  type="button"
                  onClick={() => setSelectedFechaFiltro('')}
                  className="text-[10px] font-black text-rose-600 hover:text-rose-800 px-1 py-0.5 rounded cursor-pointer"
                  title="Quitar filtro de fecha"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedFechaFiltro(todayStr);
                  setSelectedFechaTab('TODAS');
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  selectedFechaFiltro === todayStr 
                    ? 'bg-rose-700 text-white' 
                    : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
                title="Filtrar fecha de hoy"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFechaFiltro(tomorrowStr);
                  setSelectedFechaTab('TODAS');
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  selectedFechaFiltro === tomorrowStr 
                    ? 'bg-blue-700 text-white' 
                    : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
                title="Filtrar fecha de mañana"
              >
                Mañ
              </button>
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterStatus('TODAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'TODAS'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({totalConsolidadas})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('DEVUELTAS_HOY')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'DEVUELTAS_HOY'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Devueltas Hoy ({entregadasHoy})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PENDIENTES')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'PENDIENTES'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes ({listosParaEntregar})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ENTREGADAS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'ENTREGADAS'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Entregadas ({yaEntregados})
              </button>
            </div>

            {boletasDevueltasHoy.length > 0 && (
              <button
                onClick={selectAllDevueltasHoy}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold cursor-pointer border border-indigo-200"
                title="Seleccionar solo las boletas devueltas hoy"
              >
                <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Seleccionar devueltas de hoy ({boletasDevueltasHoy.length})</span>
              </button>
            )}

            <button
              onClick={selectAllPendientes}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer border border-slate-200"
            >
              <CheckSquare className="w-3.5 h-3.5 text-slate-600" />
              <span>Seleccionar pendientes</span>
            </button>

            {selectedBoletaIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleOpenLoteRecibidoModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer text-xs shadow-xs"
                  title="Asignar funcionario receptor a las boletas seleccionadas"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Asignar Receptor ({selectedBoletaIds.length})</span>
                </button>

                <button
                  onClick={clearSelection}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                >
                  Limpiar ({selectedBoletaIds.length})
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
              {selectedBoletaIds.length > 0 
                ? `${selectedBoletaIds.length} seleccionada(s) para imprimir/entregar` 
                : 'Ninguna marcada (se incluirán todas las del tribunal al imprimir)'}
            </span>
          </div>
        </div>

        {/* Barra informativa de Filtro Activo por Nomenclatura o Fecha */}
        {(searchTerm.trim() || selectedFechaFiltro) && (
          <div className="px-4 py-2 bg-indigo-50/90 border-b border-indigo-200 text-indigo-950 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700">Filtro aplicado:</span>
              {searchTerm.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-indigo-300 text-indigo-900 font-bold shadow-2xs">
                  <Search className="w-3 h-3 text-indigo-600" />
                  <span>Nomenclatura: <strong>"{searchTerm}"</strong></span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-slate-400 hover:text-rose-600 ml-1 font-black cursor-pointer"
                    title="Quitar filtro de nomenclatura"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedFechaFiltro && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-indigo-300 text-indigo-900 font-bold shadow-2xs">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Fecha: <strong>{formatFechaDisplay(selectedFechaFiltro)}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedFechaFiltro('')}
                    className="text-slate-400 hover:text-rose-600 ml-1 font-black cursor-pointer"
                    title="Quitar filtro de fecha"
                  >
                    ×
                  </button>
                </span>
              )}
              <span className="text-slate-500 font-semibold">
                — {boletasConsolidadasFiltradas.length} {boletasConsolidadasFiltradas.length === 1 ? 'causa encontrada' : 'causas encontradas'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedFechaFiltro('');
              }}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        )}

        {/* Selector / Pestañas de Organización por Fecha de Entrega */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider mr-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ver por Fecha de Entrega:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedFechaTab('TODAS')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFechaTab === 'TODAS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>Todas las Fechas (Separadas)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedFechaTab === 'TODAS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {boletasConsolidadasFiltradas.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFechaTab('MANANA')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFechaTab === 'MANANA'
                  ? 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-300'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Para Mañana ({formatFechaDisplay(tomorrowStr)}) — Habitual</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedFechaTab === 'MANANA' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-900'
              }`}>
                {countManana}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFechaTab('HOY_URGENTE')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFechaTab === 'HOY_URGENTE'
                  ? 'bg-rose-700 text-white shadow-xs ring-2 ring-rose-300'
                  : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Urgentes de Hoy ({formatFechaDisplay(todayStr)}) — De una vez</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedFechaTab === 'HOY_URGENTE' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
              }`}>
                {countHoy}
              </span>
            </button>

            {/* Otras fechas guardadas */}
            {gruposPorFecha
              .filter(g => g.fecha !== tomorrowStr && g.fecha !== todayStr)
              .map(g => (
                <button
                  key={g.fecha}
                  type="button"
                  onClick={() => setSelectedFechaTab(g.fecha)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFechaTab === g.fecha
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{formatFechaDisplay(g.fecha)}</span>
                  <span className="text-[10px] font-bold text-slate-500">({g.items.length})</span>
                </button>
              ))}
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Mostrando {gruposAMostrar.length} {gruposAMostrar.length === 1 ? 'grupo por fecha' : 'grupos por fecha'}
          </div>
        </div>

        {/* Contenido agrupado por fecha de entrega (No todo revuelto en una sola lista) */}
        <div className="p-4 space-y-6 bg-slate-100/60">
          {gruposAMostrar.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
              <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-700">No se encontraron acuses</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchTerm || selectedFechaFiltro
                  ? `No hay coincidencias para ${searchTerm ? `nomenclatura "${searchTerm}"` : ''} ${searchTerm && selectedFechaFiltro ? 'en la' : ''} ${selectedFechaFiltro ? `fecha ${formatFechaDisplay(selectedFechaFiltro)}` : ''}. Verifica los datos o limpia los filtros.`
                  : 'No hay boletas en esta fecha o filtro. Selecciona otra fecha o cambia el filtro de búsqueda superior.'}
              </p>
              {(searchTerm || selectedFechaFiltro) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedFechaFiltro('');
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar búsqueda y ver todos los acuses</span>
                </button>
              )}
            </div>
          ) : (
            gruposAMostrar.map((grupo) => {
              const isAllGrupoSelected = grupo.items.length > 0 &&
                grupo.items.every(item => (item.ids || []).every(id => selectedBoletaIds.includes(id)));

              return (
                <div 
                  key={grupo.fecha} 
                  className="rounded-xl border border-slate-300 overflow-hidden shadow-xs bg-white"
                >
                  {/* Encabezado del Grupo por Fecha */}
                  <div className={`px-4 py-3 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    grupo.badgeTipo === 'MANANA'
                      ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border-b border-indigo-700'
                      : grupo.badgeTipo === 'HOY_URGENTE'
                        ? 'bg-gradient-to-r from-rose-950 via-amber-950 to-slate-900 border-b border-rose-800'
                        : 'bg-[#1e293b] border-b border-slate-700'
                  }`}>
                    <div className="flex items-start sm:items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${
                        grupo.badgeTipo === 'MANANA' 
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                          : grupo.badgeTipo === 'HOY_URGENTE'
                            ? 'bg-rose-600/30 text-rose-300 border border-rose-400/30'
                            : 'bg-slate-700 text-slate-300'
                      }`}>
                        {grupo.badgeTipo === 'HOY_URGENTE' ? (
                          <Zap className="w-5 h-5 text-amber-300" />
                        ) : (
                          <Calendar className="w-5 h-5 text-blue-300" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black tracking-wide text-white">
                            {grupo.titulo}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            grupo.badgeTipo === 'MANANA'
                              ? 'bg-blue-500 text-white'
                              : grupo.badgeTipo === 'HOY_URGENTE'
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-700 text-slate-200'
                          }`}>
                            {grupo.items.length} {grupo.items.length === 1 ? 'Causa' : 'Causas'} ({grupo.totalBoletasFisicas} boletas)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {grupo.subtitulo}
                        </p>
                      </div>
                    </div>

                    {/* Acciones directas para este Grupo de Fecha */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectGrupoFecha(grupo.items, !isAllGrupoSelected)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        title="Seleccionar todas las boletas de esta fecha"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{isAllGrupoSelected ? 'Deseleccionar fecha' : 'Seleccionar fecha'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEscribirReceptorPorFecha(grupo.fecha, grupo.items)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-white/15"
                        title="Asignar funcionario receptor a todas las boletas de esta fecha"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Asignar Receptor</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleImprimirPlanillaPorFecha(grupo.fecha, grupo.items)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
                        title="Generar Planilla PDF solo de esta fecha"
                      >
                        <Printer className="w-3.5 h-3.5 text-white" />
                        <span>Planilla PDF ({grupo.items.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Tabla de Boletas de este grupo de fecha */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs border border-slate-300">
                      <thead>
                        <tr className="bg-[#0f294a] text-white font-bold border-b border-blue-900 text-[11px] uppercase tracking-wider">
                          <th className="py-2.5 px-3 text-center w-10 border border-slate-700">
                            <input
                              type="checkbox"
                              checked={isAllGrupoSelected}
                              onChange={(e) => handleToggleSelectGrupoFecha(grupo.items, e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              title="Seleccionar todas las causas de este grupo de fecha"
                            />
                          </th>
                          <th className="py-2.5 px-2 text-center w-12 border border-slate-700">Nº</th>
                          <th className="py-2.5 px-3 min-w-[160px] text-left border border-slate-700">Nº DE CAUSA</th>
                          <th className="py-2.5 px-2 text-center w-24 border border-slate-700">BOLETA</th>
                          <th className="py-2.5 px-3 min-w-[130px] text-center border border-slate-700">CARÁCTER</th>
                          <th className="py-2.5 px-3 min-w-[220px] text-left border border-slate-700">PERSONA NOTIFICADA / CITADA</th>
                          <th className="py-2.5 px-2 text-center w-16 border border-slate-700">TRI</th>
                          <th className="py-2.5 px-2 text-center min-w-[120px] border border-slate-700">ESTADO</th>
                          <th className="py-2.5 px-3 min-w-[180px] text-left border border-slate-700">RECIBIDA POR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {grupo.items.map((item, idx) => {
                          const isSelected = (item.ids || []).every(id => selectedBoletaIds.includes(id));
                          const isPartiallySelected = !isSelected && (item.ids || []).some(id => selectedBoletaIds.includes(id));
                          const isEditing = editingRecibidoKey === item.key;

                          return (
                            <tr 
                              key={item.key}
                              className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/70 font-medium' : ''}`}
                            >
                              <td className="py-2.5 px-3 text-center border border-slate-300">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  ref={input => {
                                    if (input) input.indeterminate = isPartiallySelected;
                                  }}
                                  onChange={() => toggleSelectGrupo(item.ids)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>

                              <td className="py-2.5 px-2 text-center font-bold text-slate-500 border border-slate-300">
                                {idx + 1}
                              </td>

                              {/* Nº DE CAUSA */}
                              <td className="py-2.5 px-3 font-bold text-blue-950 font-mono border border-slate-300 whitespace-normal break-words">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span>{item.numeroCausa}</span>
                                  {item.esUrgente && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300" title="Boleta urgente: se relaciona de una vez y se entrega de una vez hoy">
                                      ⚡ Urgente (De una vez)
                                    </span>
                                  )}
                                  {item.totalEnGrupo > 1 && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 print:hidden">
                                      {item.totalEnGrupo} boletas
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* BOLETA */}
                              <td className="py-2.5 px-2 text-center font-bold text-slate-800 bg-slate-50 border border-slate-300 font-mono">
                                {item.boletaNumero}
                              </td>

                              {/* CARÁCTER */}
                              <td className="py-2.5 px-3 text-center border border-slate-300">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {item.caracteres.map((car, cIdx) => (
                                    <span 
                                      key={cIdx}
                                      className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200 uppercase"
                                    >
                                      {car}
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* PERSONA NOTIFICADA / CITADA */}
                              <td className="py-2.5 px-3 border border-slate-300 text-slate-900">
                                {item.personas && item.personas.length > 0 ? (
                                  <div className="space-y-1">
                                    {item.personas.map((p, pIdx) => (
                                      <div key={pIdx} className="flex items-center justify-between gap-1 text-[11px]">
                                        <span className="font-semibold text-slate-900">{p.nombre}</span>
                                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200 shrink-0 uppercase font-medium">
                                          {p.caracter}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">No especificado</span>
                                )}
                              </td>

                              {/* TRI */}
                              <td className="py-2.5 px-2 text-center font-bold text-slate-700 bg-slate-50 border border-slate-300 font-mono text-[11px]">
                                {item.tribunal}
                              </td>

                              {/* ESTADO */}
                              <td className="py-2.5 px-2 text-center border border-slate-300">
                                {item.esDevuelta ? (
                                  <div className="flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>ENTREGADO</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {formatFechaDisplay(item.fechaDevueltaTribunal)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>POR ENTREGAR</span>
                                  </span>
                                )}
                              </td>

                              {/* RECIBIDA POR */}
                              <td className="py-2 px-3 border border-slate-300 min-w-[200px]">
                                {isEditing ? (
                                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 shadow-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                                        <UserCheck className="w-3 h-3 text-amber-700" />
                                        <span>Funcionario Receptor</span>
                                      </span>
                                    </div>

                                    <div>
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editRecibidoNombre}
                                        onChange={(e) => setEditRecibidoNombre(e.target.value)}
                                        placeholder="Nombre secretaria / receptor..."
                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-900 font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                                      />
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] text-slate-600 font-bold block">Fecha:</span>
                                          <div className="flex items-center gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditRecibidoFecha(tomorrowStr)}
                                              className="text-[8px] px-1 bg-blue-100 text-blue-800 rounded font-bold hover:bg-blue-200 cursor-pointer"
                                              title="Se relaciona hoy para entregar mañana"
                                            >
                                              Mañ
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditRecibidoFecha(todayStr)}
                                              className="text-[8px] px-1 bg-rose-100 text-rose-800 rounded font-bold hover:bg-rose-200 cursor-pointer"
                                              title="Boleta urgente: entrega de una vez hoy"
                                            >
                                              Hoy
                                            </button>
                                          </div>
                                        </div>
                                        <input
                                          type="date"
                                          value={editRecibidoFecha}
                                          onChange={(e) => setEditRecibidoFecha(e.target.value)}
                                          className="w-full px-1.5 py-0.5 text-[11px] border border-slate-300 rounded bg-white text-slate-800 font-medium"
                                        />
                                      </div>
                                      <div>
                                        <span className="text-[9px] text-slate-600 font-bold block">Hora:</span>
                                        <input
                                          type="text"
                                          value={editRecibidoHora}
                                          onChange={(e) => setEditRecibidoHora(e.target.value)}
                                          placeholder="ej. 10:30 AM"
                                          className="w-full px-1.5 py-0.5 text-[11px] border border-slate-300 rounded bg-white text-slate-800 font-medium"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-amber-200/80">
                                      <div className="flex items-center gap-1">
                                        {editRecibidoNombre && (
                                          <button
                                            type="button"
                                            onClick={() => setEditRecibidoNombre('')}
                                            className="px-1.5 py-0.5 text-[10px] text-amber-900 hover:bg-amber-200 rounded font-bold cursor-pointer"
                                            title="Borrar texto del campo"
                                          >
                                            Borrar
                                          </button>
                                        )}
                                      </div>
                                      
                                      <div className="flex flex-wrap items-center gap-1 ml-auto">
                                        <button
                                          type="button"
                                          onClick={() => setEditingRecibidoKey(null)}
                                          className="px-2 py-0.5 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer"
                                        >
                                          Cancelar
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleSaveEditRecibido(item.ids)}
                                          className="px-2.5 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold cursor-pointer flex items-center gap-1 shadow-2xs"
                                        >
                                          <Check className="w-3 h-3" />
                                          Guardar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : item.acuseRecibidoPor ? (
                                  <div 
                                    className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 shadow-2xs"
                                    title="Recepción registrada en el tribunal. Clic en Editar para modificar."
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-slate-900 text-[11px] leading-tight flex items-center gap-1">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>{item.acuseRecibidoPor}</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditRecibido(item)}
                                        className="text-[9px] font-extrabold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 cursor-pointer shadow-2xs transition-colors"
                                        title="Modificar nombre de quién recibió, fecha y hora"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                        <span>Editar</span>
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-600 font-mono mt-0.5">
                                      <Calendar className="w-2.5 h-2.5 text-slate-500" />
                                      <span>{formatFechaDisplay(item.acuseFechaEntrega || item.fechaDevueltaTribunal)}</span>
                                      {item.acuseHoraEntrega && (
                                        <>
                                          <span>•</span>
                                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                                          <span>{item.acuseHoraEntrega}</span>
                                        </>
                                      )}
                                    </div>
                                    {item.acuseNumeroControl && (
                                      <span className="text-[9px] text-indigo-700 font-mono font-semibold block">{item.acuseNumeroControl}</span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditRecibido(item)}
                                    className="w-full text-left py-1 px-2 rounded border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-400 hover:text-indigo-700 transition-colors flex items-center justify-between group cursor-pointer"
                                    title="Asignar funcionario receptor"
                                  >
                                    <span className="italic text-[11px] flex items-center gap-1">
                                      <UserCheck className="w-3 h-3 text-slate-300" />
                                      Sin receptor
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-indigo-200">
                                      <Edit3 className="w-2.5 h-2.5" />
                                      Asignar
                                    </span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: PREGUNTAR FECHA QUE SE HARÁ LA ENTREGA ANTES DE GENERAR PLANILLA PDF */}
      {showPlanillaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold">
                  Generar Planilla de Acuses (PDF) — {selectedTribunal.nombre}
                </h3>
              </div>
              <button
                onClick={() => setShowPlanillaModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Tribunal Destino:</span>
                  <span className="font-black bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded">{selectedTribunal.codigo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Boletas a incluir en el listado:</span>
                  <span className="font-extrabold text-indigo-700">{boletasAIncluir.length} boleta(s)</span>
                </div>
                {selectedBoletaIds.length > 0 ? (
                  <p className="text-[11px] text-indigo-700">
                    Se imprimirán exclusivamente las <strong>{selectedBoletaIds.length}</strong> boletas seleccionadas.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    No seleccionaste boletas individuales: se imprimirán todas las de este tribunal ({boletasAIncluir.length}).
                  </p>
                )}
              </div>

              {/* Pregunta Requerida: FECHA EN QUE SE HARÁ LA ENTREGA */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  📅 ¿EN QUÉ FECHA SE HARÁ LA ENTREGA AL TRIBUNAL?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    required
                    value={fechaEntregaPlanilla}
                    onChange={(e) => setFechaEntregaPlanilla(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setFechaEntregaPlanilla(todayStr)}
                    className="px-2.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechaEntregaPlanilla(tomorrowStr)}
                    className="px-2.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
                  >
                    Mañana
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Esta fecha aparecerá en el encabezado oficial del acuse de entrega.
                </p>
              </div>

              {/* Alguacil Entrega */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Entregado por (Alguacilazgo):
                </label>
                <input
                  type="text"
                  value={alguacilEntregaPlanilla}
                  onChange={(e) => setAlguacilEntregaPlanilla(e.target.value)}
                  placeholder="Ej: RENZO M. / ALGUACILAZGO"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Aviso de consolidación de causas si aplica */}
              {boletasRepetidasInfo.hayRepetidas && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                  <span className="font-bold">Regla de consolidación activa:</span> Si varias boletas tienen el mismo Tribunal, Nº de Causa y Boleta Nº, en el PDF se incluirán consolidadas con su respectivo <strong>Nº DE CAUSA, BOLETA Nº, CARÁCTER, TRI</strong>.
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPlanillaModal(false)}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                
                <button
                  type="button"
                  onClick={() => handleConfirmarGeneracionPlanilla(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer"
                  title="Genera e imprime/descarga el PDF directamente sin cambiar el estado de las boletas"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimir / Descargar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmarGeneracionPlanilla(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer"
                  title="Imprime/descarga el PDF y marca las boletas como entregadas con la fecha seleccionada"
                >
                  <FileCheck2 className="w-4 h-4 text-white" />
                  <span>Imprimir y Marcar Entregadas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Registro de Entrega en Lote / Persona que Recibió */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <UserCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight">
                    Registrar Funcionario Receptor / Oficio
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {selectedTribunal.nombre} ({selectedTribunal.codigo}) • <strong className="text-amber-300 font-mono font-bold">{boletasDestinoLote.length}</strong> boletas a actualizar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEntregaLote} className="p-5 space-y-4">
              {/* Selector de Alcance */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="block text-xs font-extrabold text-slate-800">
                  ¿A qué boletas desea asignar este receptor?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchAlcance('TODO_TRIBUNAL')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      batchAlcance === 'TODO_TRIBUNAL'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Todo el Lote</div>
                    <div className="text-[11px] text-slate-500 font-medium">{boletasTribunal.length} boletas</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchAlcance('PENDIENTES')}
                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                      batchAlcance === 'PENDIENTES'
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Sin Receptor</div>
                    <div className="text-[11px] text-slate-500 font-medium">{boletasTribunal.filter(b => !b.acuseRecibidoPor).length} boletas</div>
                  </button>

                  <button
                    type="button"
                    disabled={selectedBoletaIds.length === 0}
                    onClick={() => setBatchAlcance('SELECCIONADAS')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      selectedBoletaIds.length === 0
                        ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed text-slate-400'
                        : batchAlcance === 'SELECCIONADAS'
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300 text-blue-900 cursor-pointer'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="font-bold text-xs">Seleccionadas</div>
                    <div className="text-[11px] text-slate-500 font-medium">{selectedBoletaIds.length} boletas</div>
                  </button>
                </div>
              </div>

              {/* Nombre de la persona que recibió */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  Funcionario Receptor (Secretaría / Receptor) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Abg. María González - Secretaria de Sala"
                  value={batchRecibidoPor}
                  onChange={(e) => setBatchRecibidoPor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Escriba el nombre, cargo o secretaría de quien recibió las boletas y acuses.
                </p>
              </div>

              {/* Grid Fecha y Hora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Fecha de Entrega:</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBatchFechaEntrega(tomorrowStr)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all ${
                          batchFechaEntrega === tomorrowStr 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                        title="Relación de hoy para entregar mañana"
                      >
                        Mañana
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchFechaEntrega(todayStr)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition-all ${
                          batchFechaEntrega === todayStr 
                            ? 'bg-rose-600 text-white' 
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                        title="Boleta urgente: se entrega de una vez hoy"
                      >
                        Hoy (Urgente)
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    required
                    value={batchFechaEntrega}
                    onChange={(e) => setBatchFechaEntrega(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Hora de Recepción:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setBatchHoraEntrega(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Hora actual
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="ej. 10:30 AM"
                    value={batchHoraEntrega}
                    onChange={(e) => setBatchHoraEntrega(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Campos opcionales: Oficio y Observaciones */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nº de Oficio / Cargo de Entrega (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder={`Ej: OFI-${selectedTribunal.codigo}-2026-088`}
                    value={batchNumeroOficio}
                    onChange={(e) => setBatchNumeroOficio(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observaciones / Notas del Acuse (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Entregado con sello de recibido y firma autógrafa"
                    value={batchObservaciones}
                    onChange={(e) => setBatchObservaciones(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Receptor ({boletasDestinoLote.length})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
