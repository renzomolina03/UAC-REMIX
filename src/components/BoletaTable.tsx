import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Check, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  Eye, 
  ArrowUpDown, 
  Scale, 
  Printer, 
  FolderOpen, 
  MapPin, 
  Mail, 
  Building2, 
  Globe2, 
  Plus, 
  Zap, 
  Users,
  CheckCircle,
  RotateCcw,
  Copy,
  Layers,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  ArrowRight,
  UserCheck,
  Lock,
  X,
  ExternalLink,
  Calendar,
  FileCheck2,
  Pencil,
  User
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ArticuloCOPP, 
  SeccionRuta, 
  SeccionTrabajoInfo,
  SECCIONES_INFO, 
  ConfiguracionDespacho,
  hasArticulo,
  toggleArticuloBoleta,
  getCaracterDisplay,
  validarRequisitosDevuelta,
  TipoCitado,
  TIPOS_CITADO_OPTIONS,
  detectCaracterFromText,
  DependenciaJudicial
} from '../types/judicial';
import { SesionActiva } from '../types/auth';
import { formatFechaDisplay, evaluarAlertaBoleta, esBoletaUrgente } from '../utils/alerts';
import { exportarBoletasPDF, exportarReporteTribunalResultadosPDF, exportarBoletasSeleccionadasPDF } from '../utils/exportPDF';
import { copiarBoletasParaExcel } from '../utils/exportExcel';
import { calcularHojasLote, mapearBoletasAHojas, HojaLote } from '../utils/sheetCalculation';
import { ImprimirHojasModal } from './ImprimirHojasModal';
import { ImprimirRutaCompartidaModal } from './ImprimirRutaCompartidaModal';
import { ModalCrearSeccionTrabajo } from './ModalCrearSeccionTrabajo';
import { FormatoResultaModal } from './FormatoResultaModal';

interface BoletaTableProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  config: ConfiguracionDespacho;
  filtroAlertaActivo: string;
  dependenciaActiva?: DependenciaJudicial;
  onCambiarDependencia?: (dep: DependenciaJudicial) => void;
  sesionActual?: SesionActiva | null;
  onEditBoleta: (boleta: BoletaJudicial) => void;
  onDeleteBoleta: (id: string) => void;
  onViewBoleta: (boleta: BoletaJudicial) => void;
  onToggleDevuelta: (id: string, devuelta: boolean) => void;
  onToggleFinDePagina?: (id: string) => void;
  onQuickAcuse: (boleta: BoletaJudicial) => void;
  onNavigateToAcuses?: (tribunalCode: string, boletaIds?: string[]) => void;
  onBulkDevuelta?: (boletaIds: string[]) => void;
  onBulkPracticada?: (boletaIds: string[]) => void;
  onBulkDelete?: (boletaIds: string[]) => void;
  onUpdateArticulo?: (boletaId: string, articulo: ArticuloCOPP, articulos?: ArticuloCOPP[]) => void;
  onBulkAssignArticulo?: (boletaIds: string[], articulo: ArticuloCOPP) => void;
  onUpdateAlguacil?: (boletaId: string, alguacil: string) => void;
  onBulkAssignAlguacil?: (boletaIds: string[], alguacil: string) => void;
  onBulkAssignCaracter?: (boletaIds: string[], caracter: TipoCitado) => void;
  onUpdateSeccion?: (boletaId: string, seccion: SeccionRuta) => void;
  onBulkAssignSeccion?: (boletaIds: string[], seccion: SeccionRuta) => void;
  onOpenNewBoleta?: () => void;
  onOpenBatchModal?: (seccion?: string) => void;
  onOpenExportModal?: () => void;
  onOpenNuevaListaModal?: () => void;
  onQuickAddBoleta?: (boleta: Partial<BoletaJudicial>) => void;
  onUpdateBoletasAsignadas?: (updated: BoletaJudicial[]) => void;
  onNavigateToMeridaOtros?: () => void;
  seccionesCustom?: SeccionTrabajoInfo[];
  onSaveNuevaSeccion?: (nueva: SeccionTrabajoInfo) => void;
  onUpdateReceptorTribunal?: (boletaId: string, datos: { acuseRecibidoPor: string; acuseFechaEntrega?: string; acuseHoraEntrega?: string }) => void;
}

export const BoletaTable: React.FC<BoletaTableProps> = ({
  boletas,
  tribunales,
  alguaciles,
  config,
  filtroAlertaActivo,
  dependenciaActiva = 'NOTIFICACION_CITACION',
  onCambiarDependencia,
  sesionActual,
  onEditBoleta,
  onDeleteBoleta,
  onViewBoleta,
  onToggleDevuelta,
  onToggleFinDePagina,
  onBulkDevuelta,
  onBulkDelete,
  onUpdateArticulo,
  onBulkAssignArticulo,
  onUpdateAlguacil,
  onBulkAssignAlguacil,
  onBulkAssignCaracter,
  onUpdateSeccion,
  onBulkAssignSeccion,
  onOpenNewBoleta,
  onOpenBatchModal,
  onOpenExportModal,
  onOpenNuevaListaModal,
  onQuickAddBoleta,
  onUpdateBoletasAsignadas,
  onNavigateToAcuses,
  onNavigateToMeridaOtros,
  seccionesCustom: propSeccionesCustom,
  onSaveNuevaSeccion: propOnSaveNuevaSeccion,
  onUpdateReceptorTribunal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeccion, setSelectedSeccion] = useState<string>('TODAS');
  const [selectedTribunal, setSelectedTribunal] = useState('TODOS');
  const [selectedAlguacil, setSelectedAlguacil] = useState('TODOS');
  const [selectedFecha, setSelectedFecha] = useState<string>('TODAS');
  const [agruparPorFecha, setAgruparPorFecha] = useState<boolean>(false);
  const [selectedBoletaIds, setSelectedBoletaIds] = useState<string[]>([]);
  const [bulkCaracterFeedback, setBulkCaracterFeedback] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'item' | 'audiencia'>('item');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isImprimirHojasOpen, setIsImprimirHojasOpen] = useState(false);
  const [isRutaCompartidaModalOpen, setIsRutaCompartidaModalOpen] = useState(false);
  const [isModalCrearSeccionOpen, setIsModalCrearSeccionOpen] = useState(false);
  const [seccionAEditar, setSeccionAEditar] = useState<SeccionTrabajoInfo | null>(null);
  const [isResultaModalOpen, setIsResultaModalOpen] = useState(false);
  const [boletaParaResulta, setBoletaParaResulta] = useState<BoletaJudicial | null>(null);

  // Edición rápida de receptor en tribunal para los resultados de búsqueda
  const [editingRecibidoId, setEditingRecibidoId] = useState<string | null>(null);
  const [editRecibidoNombre, setEditRecibidoNombre] = useState('');
  const [editRecibidoFecha, setEditRecibidoFecha] = useState('');
  const [editRecibidoHora, setEditRecibidoHora] = useState('');

  // Modal dedicado de registro y edición de quién recibió en tribunal (para la tabla principal y resultados)
  const [modalRecibidoBoleta, setModalRecibidoBoleta] = useState<BoletaJudicial | null>(null);
  const [modalRecibidoNombre, setModalRecibidoNombre] = useState('');
  const [modalRecibidoFecha, setModalRecibidoFecha] = useState('');
  const [modalRecibidoHora, setModalRecibidoHora] = useState('');

  const handleOpenRecibidoModal = (b: BoletaJudicial) => {
    setModalRecibidoBoleta(b);
    setModalRecibidoNombre(b.acuseRecibidoPor || '');
    setModalRecibidoFecha(b.acuseFechaEntrega || b.fechaDevueltaTribunal || new Date().toISOString().slice(0, 10));
    setModalRecibidoHora(b.acuseHoraEntrega || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  const handleSaveRecibidoModal = () => {
    if (!modalRecibidoBoleta) return;
    const nombreClean = modalRecibidoNombre.trim();
    const fechaClean = modalRecibidoFecha || new Date().toISOString().slice(0, 10);
    const horaClean = modalRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (onUpdateReceptorTribunal) {
      onUpdateReceptorTribunal(modalRecibidoBoleta.id, {
        acuseRecibidoPor: nombreClean,
        acuseFechaEntrega: fechaClean,
        acuseHoraEntrega: horaClean,
      });
    } else if (onUpdateBoletasAsignadas) {
      const updated: BoletaJudicial = {
        ...modalRecibidoBoleta,
        acuseRecibidoPor: nombreClean || undefined,
        acuseFechaEntrega: fechaClean,
        acuseHoraEntrega: horaClean,
        devueltaAlTribunal: !!nombreClean || modalRecibidoBoleta.devueltaAlTribunal,
        fechaDevueltaTribunal: nombreClean ? (modalRecibidoBoleta.fechaDevueltaTribunal || fechaClean) : modalRecibidoBoleta.fechaDevueltaTribunal,
        estado: nombreClean ? 'DEVUELTA_TRIBUNAL' : modalRecibidoBoleta.estado,
        updatedAt: new Date().toISOString(),
      };
      onUpdateBoletasAsignadas([updated]);
    }
    setModalRecibidoBoleta(null);
  };

  const handleStartEditRecibido = (b: BoletaJudicial) => {
    setEditingRecibidoId(b.id);
    setEditRecibidoNombre(b.acuseRecibidoPor || '');
    setEditRecibidoFecha(b.acuseFechaEntrega || b.fechaDevueltaTribunal || new Date().toISOString().slice(0, 10));
    setEditRecibidoHora(b.acuseHoraEntrega || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  const handleSaveEditRecibido = (b: BoletaJudicial) => {
    const nombreClean = editRecibidoNombre.trim();
    const fechaClean = editRecibidoFecha || new Date().toISOString().slice(0, 10);
    const horaClean = editRecibidoHora.trim() || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (onUpdateReceptorTribunal) {
      onUpdateReceptorTribunal(b.id, {
        acuseRecibidoPor: nombreClean,
        acuseFechaEntrega: fechaClean,
        acuseHoraEntrega: horaClean,
      });
    } else if (onUpdateBoletasAsignadas) {
      const updatedBoleta: BoletaJudicial = {
        ...b,
        acuseRecibidoPor: nombreClean || undefined,
        acuseFechaEntrega: fechaClean,
        acuseHoraEntrega: horaClean,
        devueltaAlTribunal: !!nombreClean || b.devueltaAlTribunal,
        fechaDevueltaTribunal: nombreClean ? (b.fechaDevueltaTribunal || fechaClean) : b.fechaDevueltaTribunal,
        estado: nombreClean ? 'DEVUELTA_TRIBUNAL' : b.estado,
        updatedAt: new Date().toISOString(),
      };
      onUpdateBoletasAsignadas([updatedBoleta]);
    }
    setEditingRecibidoId(null);
  };

  // Imprimir los resultados exactos de la búsqueda
  const handlePrintSearchResults = () => {
    if (boletasFiltradas.length === 0) return;
    exportarBoletasPDF(
      boletasFiltradas,
      config
    );
  };

  // Secciones personalizadas creadas por el usuario sincronizadas con App
  const [localSeccionesCustom, setLocalSeccionesCustom] = useState<SeccionTrabajoInfo[]>(() => {
    try {
      const stored = localStorage.getItem('uac_secciones_personalizadas');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const seccionesCustom = useMemo(() => {
    const map = new Map<string, SeccionTrabajoInfo>();
    localSeccionesCustom.forEach(s => map.set(s.codigo, s));
    if (propSeccionesCustom) {
      propSeccionesCustom.forEach(s => map.set(s.codigo, s));
    }
    return Array.from(map.values());
  }, [localSeccionesCustom, propSeccionesCustom]);

  const handleSaveNuevaSeccion = (nueva: SeccionTrabajoInfo) => {
    const updated = [...seccionesCustom.filter(s => s.codigo !== nueva.codigo), nueva];
    setLocalSeccionesCustom(updated);
    try {
      localStorage.setItem('uac_secciones_personalizadas', JSON.stringify(updated));
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
    if (propOnSaveNuevaSeccion) {
      propOnSaveNuevaSeccion(nueva);
    }
    setSelectedSeccion(nueva.codigo);
    setSeccionAEditar(null);
  };

  const handleEliminarSeccion = (codigo: string) => {
    const updated = localSeccionesCustom.filter(s => s.codigo !== codigo);
    setLocalSeccionesCustom(updated);
    try {
      localStorage.setItem('uac_secciones_personalizadas', JSON.stringify(updated));
    } catch (e) {}
    if (selectedSeccion === codigo) {
      setSelectedSeccion('TODAS');
    }
    setSeccionAEditar(null);
  };

  // Handler para imprimir boletas seleccionadas en formato de listado
  const handlePrintBoletasSeleccionadas = () => {
    const seleccionadas = boletas.filter(b => selectedBoletaIds.includes(b.id));
    if (seleccionadas.length === 0) {
      alert('Por favor selecciona al menos una boleta marcando la casilla de verificación (checkbox) para imprimir.');
      return;
    }
    exportarBoletasPDF(seleccionadas, config);
  };

  // Handler para abrir el Formato de Resulta en Físico de una boleta seleccionada
  const handleOpenResultaFisico = (targetBoleta?: BoletaJudicial) => {
    const target = targetBoleta || boletas.find(b => selectedBoletaIds.includes(b.id));
    if (!target) {
      alert('Por favor selecciona una boleta para generar su Formato de Resulta en Físico.');
      return;
    }
    setBoletaParaResulta(target);
    setIsResultaModalOpen(true);
  };

  // Selección individual libre: En el listado principal se puede seleccionar cualquier boleta
  // independientemente sin auto-seleccionar otras que compartan causa, boleta o tribunal
  const handleToggleSelectRow = (b: BoletaJudicial) => {
    setSelectedBoletaIds(prev =>
      prev.includes(b.id) ? prev.filter(id => id !== b.id) : [...prev, b.id]
    );
  };

  // Validación estricta: No permitir marcar SÍ en Devuelta sin Artículo y Alguacil asignados
  const handleToggleDevueltaRow = (b: BoletaJudicial) => {
    if (!b.devueltaAlTribunal) {
      const check = validarRequisitosDevuelta(b);
      if (!check.puedeSerDevuelta) {
        alert(check.mensajeError);
        return;
      }
      onToggleDevuelta(b.id, true);
      // Cuando se seleccione en PENDIENTE para devolver al tribunal NO pregunte Recibida en Tribunal por
    } else {
      onToggleDevuelta(b.id, false);
    }
  };

  // Modo de visualización de hojas: 'todas_con_separadores' (por defecto: muestra todas las hojas en el listado con separadores) o 'hoja_individual'
  const [modoVistaHojas, setModoVistaHojas] = useState<'todas_con_separadores' | 'hoja_individual'>('todas_con_separadores');
  const [selectedHojaFilter, setSelectedHojaFilter] = useState<number | null>(null);
  const [hojaFilterMode, setHojaFilterMode] = useState<'solo' | 'hasta'>('solo');
  const [hojaSearchInput, setHojaSearchInput] = useState<string>('');

  // Identificador UAC inicial con nomenclatura reglamentaria desde 0001
  const [idInicialUAC, setIdInicialUAC] = useState<string>(() => {
    const stored = localStorage.getItem('uac_ultimo_id_hoja');
    if (!stored || stored.toLowerCase() === 'uac1233') return 'uac0001';
    return stored;
  });

  const handleIdInicialUACChange = (val: string) => {
    const normalized = val.trim() || 'uac0001';
    setIdInicialUAC(val);
    try {
      localStorage.setItem('uac_ultimo_id_hoja', normalized);
    } catch (e) {
      // Ignorar si localStorage no está disponible
    }
  };

  // Mini formulario de carga directa (Barra Rápida Superior)
  const [quickCausa, setQuickCausa] = useState('');
  const [quickBoleta, setQuickBoleta] = useState('');
  const [quickNombre, setQuickNombre] = useState('');
  const [quickCaracter, setQuickCaracter] = useState<TipoCitado>('IMPUTADO');
  const [quickTribunal, setQuickTribunal] = useState(tribunales[0]?.codigo || 'C1');
  const [quickTribunalOtro, setQuickTribunalOtro] = useState('');
  const [quickAudiencia, setQuickAudiencia] = useState('');
  const [quickAlguacil, setQuickAlguacil] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [filterSoloUrgentes, setFilterSoloUrgentes] = useState(false);

  // Boletas pertenecientes a la dependencia activa actual (para conteos precisos)
  const boletasDeDependencia = useMemo(() => {
    return boletas.filter(b => {
      if (dependenciaActiva === 'SECRETARIA') {
        return b.dependencia === 'SECRETARIA' || !!b.numeroOficio;
      } else if (dependenciaActiva === 'NOTIFICACION_CITACION') {
        return b.dependencia !== 'SECRETARIA';
      }
      return true;
    });
  }, [boletas, dependenciaActiva]);

  // Conteos por sección incluyendo personalizadas y Sobreseimiento
  const conteoSecciones = useMemo(() => {
    const counts: Record<string, number> = {
      TODAS: boletasDeDependencia.length,
      RUTA_NOTIFICACION_CITACION: 0,
      CORREO_EXT: 0,
      RUTA_INTERNA: 0,
      OTROS_ESTADOS_MERIDA: 0,
      SOBRESEIMIENTO: 0,
    };
    seccionesCustom.forEach(s => {
      counts[s.codigo] = 0;
    });
    boletasDeDependencia.forEach(b => {
      const sec = b.seccionRuta || 'RUTA_NOTIFICACION_CITACION';
      if (counts[sec] !== undefined) counts[sec]++;
      else counts['RUTA_NOTIFICACION_CITACION']++;
    });
    return counts;
  }, [boletasDeDependencia, seccionesCustom]);

  // Conteo total de boletas urgentes dentro de la dependencia activa
  const conteoUrgentes = useMemo(() => {
    return boletasDeDependencia.filter(b => {
      if (b.devueltaAlTribunal) return false;
      const urg = esBoletaUrgente(b);
      const alerta = evaluarAlertaBoleta(b);
      return urg.esUrgente || alerta.nivel === 'URGENTE' || alerta.nivel === 'CRITICA' || !!b.esUrgente;
    }).length;
  }, [boletasDeDependencia]);

  // Lista de alguaciles únicos
  const alguacilesList = useMemo(() => {
    return Array.from(new Set(boletasDeDependencia.map(b => b.alguacilPractica))).filter(Boolean).sort();
  }, [boletasDeDependencia]);

  // Filtrado de boletas con soporte para UAC (0001) y acuses
  const boletasFiltradas = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    // Detección de búsqueda específica por página o hoja (ej. "pagina 1", "pag 1", "p1", "hoja 1", "h1")
    const pageSearchMatch = cleanSearch.match(/^(?:p[aá]gina|p[aá]g|p|hoja|h)\s*(\d+)$/i);
    const targetHojaNum = pageSearchMatch ? parseInt(pageSearchMatch[1], 10) : null;

    // Detección de búsqueda por número de UAC (ej: "0001", "uac 0001", "uac: 0001", "uac-0001", "uac1", "1")
    const uacMatch = cleanSearch.match(/^(?:uac[:\s\-_]*)?0*(\d+)$/i);
    const targetUacHojaNum = (uacMatch && uacMatch[1] && cleanSearch !== '') ? parseInt(uacMatch[1], 10) : null;

    return boletas.filter((b, idx) => {
      let matchDependencia = true;
      if (dependenciaActiva === 'SECRETARIA') {
        matchDependencia = b.dependencia === 'SECRETARIA' || !!b.numeroOficio;
      } else if (dependenciaActiva === 'NOTIFICACION_CITACION') {
        matchDependencia = b.dependencia !== 'SECRETARIA';
      }

      const sec = b.seccionRuta || 'RUTA_NOTIFICACION_CITACION';
      const matchSeccion = selectedSeccion === 'TODAS' || sec === selectedSeccion;

      const itemNumber = b.numeroItem !== undefined ? b.numeroItem : (idx + 1);
      const hojaAsignada = Math.ceil(itemNumber / 30);

      let matchHoja = false;
      if (targetHojaNum !== null && hojaAsignada === targetHojaNum) {
        matchHoja = true;
      }

      let matchUAC = false;
      if (targetUacHojaNum !== null && hojaAsignada === targetUacHojaNum) {
        matchUAC = true;
      }

      // Soporte para búsqueda por estado de acuse (devuelta o pendiente)
      let matchAcuse = false;
      if (
        cleanSearch === 'con acuse' ||
        cleanSearch === 'acuse' ||
        cleanSearch === 'devuelta' ||
        cleanSearch === 'devueltas' ||
        cleanSearch === 'si' ||
        cleanSearch === 'sí'
      ) {
        matchAcuse = b.devueltaAlTribunal === true;
      } else if (
        cleanSearch === 'sin acuse' ||
        cleanSearch === 'pendiente' ||
        cleanSearch === 'pendientes' ||
        cleanSearch === 'no devuelta'
      ) {
        matchAcuse = b.devueltaAlTribunal !== true;
      }

      const matchSearch =
        cleanSearch === '' ||
        matchHoja ||
        matchUAC ||
        matchAcuse ||
        b.numeroCausa.toLowerCase().includes(cleanSearch) ||
        b.boletaNumero.toLowerCase().includes(cleanSearch) ||
        (b.numeroOficio && b.numeroOficio.toLowerCase().includes(cleanSearch)) ||
        (b.responsableRelacion && b.responsableRelacion.toLowerCase().includes(cleanSearch)) ||
        b.notificadoCitado.toLowerCase().includes(cleanSearch) ||
        b.alguacilPractica.toLowerCase().includes(cleanSearch) ||
        b.tribunal.toLowerCase().includes(cleanSearch) ||
        (b.articuloCOPP && b.articuloCOPP.toLowerCase().includes(cleanSearch));

      const matchTribunal =
        selectedTribunal === 'TODOS' || b.tribunal.toUpperCase() === selectedTribunal.toUpperCase();

      const matchAlguacil =
        selectedAlguacil === 'TODOS' || b.alguacilPractica === selectedAlguacil;

      let matchAlerta = true;
      if (filterSoloUrgentes) {
        const urg = esBoletaUrgente(b);
        const alerta = evaluarAlertaBoleta(b);
        matchAlerta = (urg.esUrgente || alerta.nivel === 'URGENTE' || alerta.nivel === 'CRITICA' || !!b.esUrgente) && !b.devueltaAlTribunal;
      } else if (filtroAlertaActivo && filtroAlertaActivo !== 'TODAS') {
        const alerta = evaluarAlertaBoleta(b);
        const urg = esBoletaUrgente(b);
        if (filtroAlertaActivo === 'CRITICA') matchAlerta = alerta.nivel === 'CRITICA' || urg.motivo.toLowerCase().includes('hoy');
        else if (filtroAlertaActivo === 'URGENTE') matchAlerta = alerta.nivel === 'URGENTE' || urg.esUrgente;
        else if (filtroAlertaActivo === 'DEVUELTA') matchAlerta = b.devueltaAlTribunal;
      }

      const matchFecha =
        selectedFecha === 'TODAS' ||
        b.fechaAsignacion === selectedFecha ||
        b.fechaAudiencia === selectedFecha;

      return matchDependencia && matchSeccion && matchSearch && matchTribunal && matchAlguacil && matchFecha && matchAlerta;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'item') cmp = a.numeroItem - b.numeroItem;
      else if (sortField === 'audiencia') cmp = (a.fechaAudiencia || '').localeCompare(b.fechaAudiencia || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [boletas, searchTerm, selectedSeccion, selectedTribunal, selectedAlguacil, selectedFecha, filtroAlertaActivo, filterSoloUrgentes, sortField, sortDirection, dependenciaActiva]);

  // Cálculo de hojas del lote (30 boletas por hoja física) con UAC empezando desde 0001
  const hojasCalculadas = useMemo(() => {
    return calcularHojasLote(boletasFiltradas, 30, idInicialUAC);
  }, [boletasFiltradas, idInicialUAC]);

  const mapaBoletasHojas = useMemo(() => {
    return mapearBoletasAHojas(boletasFiltradas, 30, idInicialUAC);
  }, [boletasFiltradas, idInicialUAC]);

  // Objeto de la hoja seleccionada actualmente
  const currentHojaObj = useMemo(() => {
    if (selectedHojaFilter === null) return null;
    return hojasCalculadas.find(h => h.numeroHoja === selectedHojaFilter) || null;
  }, [hojasCalculadas, selectedHojaFilter]);

  // Boletas a mostrar en la tabla (aplica filtro por hoja con límite estricto o acumulado)
  const boletasAMostrarEnTabla = useMemo(() => {
    if (selectedHojaFilter === null) return boletasFiltradas;
    
    if (hojaFilterMode === 'hasta') {
      // Modo límite acumulado: desde el inicio hasta donde se haya trabajado hasta esa hoja
      const hojasHasta = hojasCalculadas.filter(h => h.numeroHoja <= selectedHojaFilter);
      return hojasHasta.flatMap(h => h.boletas);
    } else {
      // Modo sólo hoja: exactamente las boletas de esa hoja física con límite de 30
      const hojaObj = hojasCalculadas.find(h => h.numeroHoja === selectedHojaFilter);
      return hojaObj ? hojaObj.boletas : [];
    }
  }, [boletasFiltradas, selectedHojaFilter, hojaFilterMode, hojasCalculadas]);

  // Fechas únicas para filtrado y separación de listados por fecha
  const distinctFechas = useMemo(() => {
    const datesMap = new Map<string, number>();
    boletas.forEach(b => {
      const fecha = b.fechaAsignacion || (b.fechaAudiencia !== 'NOTIFICACION' ? b.fechaAudiencia : '');
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        datesMap.set(fecha, (datesMap.get(fecha) || 0) + 1);
      }
    });
    return Array.from(datesMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [boletas]);

  // Agrupación de boletas por fecha para el modo "Listados por Fecha (No todo junto)"
  const gruposPorFecha = useMemo(() => {
    if (!agruparPorFecha) return null;
    const groups = new Map<string, BoletaJudicial[]>();
    boletasAMostrarEnTabla.forEach(b => {
      const fechaKey = b.fechaAsignacion || (b.fechaAudiencia !== 'NOTIFICACION' ? b.fechaAudiencia : '') || 'SIN_FECHA';
      const list = groups.get(fechaKey) || [];
      list.push(b);
      groups.set(fechaKey, list);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'SIN_FECHA') return 1;
      if (b[0] === 'SIN_FECHA') return -1;
      return b[0].localeCompare(a[0]);
    });
  }, [agruparPorFecha, boletasAMostrarEnTabla]);

  const handlePrintGrupoFecha = (fechaKey: string, boletasGrupo: BoletaJudicial[]) => {
    exportarBoletasPDF(
      boletasGrupo,
      config,
      selectedTribunal !== 'TODOS' ? selectedTribunal : undefined,
      {
        capacidadPorHoja: 30,
        idInicial: idInicialUAC,
        seccion: selectedSeccion !== 'TODAS' ? selectedSeccion : undefined,
      }
    );
  };

  const handleBulkAssignCaracter = (boletaIds: string[], caracter: TipoCitado) => {
    if (onBulkAssignCaracter) {
      onBulkAssignCaracter(boletaIds, caracter);
    } else if (onUpdateBoletasAsignadas) {
      const updated = boletas.map(b => {
        if (boletaIds.includes(b.id)) {
          return { ...b, tipoCitado: caracter, updatedAt: new Date().toISOString() };
        }
        return b;
      });
      onUpdateBoletasAsignadas(updated);
    }
    setBulkCaracterFeedback(`✓ ¡Carácter actualizado a "${getCaracterDisplay(caracter)}" en ${boletaIds.length} boletas!`);
    setTimeout(() => setBulkCaracterFeedback(null), 3500);
  };

  // Manejador de cambio de Alguacil en fila: si la boleta está seleccionada y hay múltiples, actualiza TODAS
  const handleRowAlguacilChange = (boletaId: string, alguacil: string) => {
    if (selectedBoletaIds.includes(boletaId) && selectedBoletaIds.length > 1) {
      onBulkAssignAlguacil?.(selectedBoletaIds, alguacil);
    } else {
      onUpdateAlguacil?.(boletaId, alguacil);
    }
  };

  // Manejador de cambio de Artículo COPP en fila: si la boleta está seleccionada y hay múltiples, asigna a TODAS
  const handleRowArticuloToggle = (b: BoletaJudicial, art: ArticuloCOPP) => {
    if (selectedBoletaIds.includes(b.id) && selectedBoletaIds.length > 1) {
      onBulkAssignArticulo?.(selectedBoletaIds, art);
    } else {
      const result = toggleArticuloBoleta(b, art);
      onUpdateArticulo?.(b.id, result.articuloCOPP, result.articulosCOPP);
    }
  };

  // Scroll suave al separador de una hoja específica
  const scrollToHoja = (numeroHoja: number) => {
    setSelectedHojaFilter(null);
    setModoVistaHojas('todas_con_separadores');
    setTimeout(() => {
      const el = document.getElementById(`hoja-separador-${numeroHoja}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-400');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 2500);
      }
    }, 50);
  };

  // Ventana compacta de páginas para la barra de navegación (máximo 7 botones para no saturar)
  const visiblePageNumbers = useMemo(() => {
    const total = hojasCalculadas.length;
    if (total <= 8) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const current = selectedHojaFilter || 1;
    const pages = new Set<number>();

    // Siempre la primera y la última página
    pages.add(1);
    pages.add(total);

    // Páginas alrededor de la actual
    for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
      pages.add(i);
    }

    return Array.from(pages).sort((a, b) => a - b);
  }, [hojasCalculadas.length, selectedHojaFilter]);

  // Handler para imprimir una sola hoja física específica con su UAC
  const handlePrintSingleHoja = (hoja: HojaLote) => {
    exportarBoletasPDF(
      boletasFiltradas,
      config,
      selectedTribunal !== 'TODOS' ? selectedTribunal : undefined,
      {
        hojasSeleccionadas: [hoja.numeroHoja],
        capacidadPorHoja: 30,
        idInicial: idInicialUAC,
        seccion: selectedSeccion !== 'TODAS' ? selectedSeccion : undefined,
      }
    );
  };

  const handleSearchHojaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = hojaSearchInput.trim().toLowerCase();
    // Permite buscar por número ("1"), texto ("pagina 1", "hoja 1", "p1") o UAC ("uac0001", "0001")
    const uacMatch = clean.match(/^(?:uac[:\-\s]*)(\d+)$/i);
    const numMatch = clean.match(/^(?:p[aá]gina|p[aá]g|p|hoja|h)?\s*(\d+)$/i);

    let targetNum: number | null = null;
    if (uacMatch) {
      const uacNum = parseInt(uacMatch[1], 10);
      const foundIdx = hojasCalculadas.findIndex(h => {
        const hMatch = h.idHoja.match(/(\d+)$/);
        return hMatch ? parseInt(hMatch[1], 10) === uacNum : false;
      });
      if (foundIdx !== -1) targetNum = foundIdx + 1;
    } else if (numMatch) {
      targetNum = parseInt(numMatch[1], 10);
    }

    if (targetNum !== null && targetNum >= 1 && targetNum <= hojasCalculadas.length) {
      if (modoVistaHojas === 'todas_con_separadores') {
        scrollToHoja(targetNum);
      } else {
        setSelectedHojaFilter(targetNum);
      }
    } else if (targetNum !== null && targetNum > hojasCalculadas.length) {
      alert(`Actualmente hay ${hojasCalculadas.length} página(s)/hoja(s) trabajadas en el listado.`);
    }
  };

  const handlePrintListado = () => {
    if (boletasFiltradas.length === 0) {
      alert('No hay boletas en la vista actual para imprimir.');
      return;
    }
    setIsImprimirHojasOpen(true);
  };

  // Manejadores de copia rápida para Excel
  const handleCopyAllForExcel = async () => {
    const ok = await copiarBoletasParaExcel(boletasFiltradas, true);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  const handleCopySelectedForExcel = async () => {
    const selectedBoletas = boletas.filter(b => selectedBoletaIds.includes(b.id));
    if (selectedBoletas.length === 0) return;
    const ok = await copiarBoletasParaExcel(selectedBoletas, true);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCausa.trim() || !quickBoleta.trim() || !quickNombre.trim()) {
      alert('Por favor completa Nº de Causa, Boleta Nº y Nombre');
      return;
    }

    if (onQuickAddBoleta) {
      onQuickAddBoleta({
        numeroCausa: quickCausa.trim().toUpperCase(),
        boletaNumero: quickBoleta.trim(),
        notificadoCitado: quickNombre.trim().toUpperCase(),
        tipoCitado: quickCaracter,
        tribunal: quickTribunal,
        tribunalOtro: quickTribunal === 'OTRO' ? (quickTribunalOtro.trim() || undefined) : undefined,
        fechaAudiencia: selectedSeccion === 'SOBRESEIMIENTO' ? 'NOTIFICACION' : (quickAudiencia || undefined),
        esSoloNotificacion: selectedSeccion === 'SOBRESEIMIENTO' ? true : undefined,
        alguacilPractica: quickAlguacil,
        seccionRuta: (selectedSeccion !== 'TODAS' ? selectedSeccion : 'RUTA_NOTIFICACION_CITACION') as SeccionRuta,
        articuloCOPP: '',
        devueltaAlTribunal: false,
        dependencia: dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION',
        responsableRelacion: sesionActual?.nombreCompleto || config.jefeAlguacilazgo || undefined,
      });

      // En carga rápida el número de boleta debe permanecer en blanco
      setQuickBoleta('');
      setQuickNombre('');
      setQuickTribunalOtro('');
      setQuickAudiencia('');
    }
  };

  return (
    <div className="space-y-3">
      
      {/* Switcher compacto exclusivo para Supervisor de la Unidad (si aplica) */}
      {(sesionActual?.rol === 'SUPERVISOR' || sesionActual?.rol === 'SUPER_ADMIN') && onCambiarDependencia && (
        <div className="bg-slate-900 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-xs border border-slate-800">
          <span className="text-[11px] font-black uppercase text-indigo-300">Modo de Supervisión de Dependencia:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onCambiarDependencia('NOTIFICACION_CITACION')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dependenciaActiva === 'NOTIFICACION_CITACION'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Notif. y Citación
            </button>
            <button
              type="button"
              onClick={() => onCambiarDependencia('SECRETARIA')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dependenciaActiva === 'SECRETARIA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Secretario (a)
            </button>
            <button
              type="button"
              onClick={() => onCambiarDependencia('TODAS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dependenciaActiva === 'TODAS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Ver Todo
            </button>
          </div>
        </div>
      )}

      {/* 1. SECCIONES DE TRABAJO (Pestañas directas, institucionales y amigables) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <FolderOpen className="w-4 h-4 text-blue-700" />
            <span>Sección de Trabajo:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Opción para crear Sección de Trabajo personalizada con diseño elegante */}
            <button
              id="btn-crear-seccion-trabajo"
              type="button"
              onClick={() => {
                setSeccionAEditar(null);
                setIsModalCrearSeccionOpen(true);
              }}
              className="text-xs bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs border border-blue-400/40"
              title="Crear una nueva Sección de Trabajo personalizada o cambiar nombres"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-200" />
              <span>+ Nueva Sección</span>
            </button>

            {onOpenBatchModal && (
              <button
                id="btn-seccion-carga-rapida"
                onClick={() => onOpenBatchModal(selectedSeccion !== 'TODAS' ? selectedSeccion : undefined)}
                className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 py-1 rounded-lg font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                title="Carga Rápida en Lote / Pegar desde Excel"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Carga Rápida</span>
              </button>
            )}

            <button
              id="btn-toggle-quick-add"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors border border-blue-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showQuickAdd ? 'Ocultar Agregar Rápido' : '⚡ Agregar Boleta Aquí'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSeccion('TODAS')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'TODAS'
                ? 'bg-[#0053D5] text-white shadow-xs font-black'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>TODAS</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-white/20 font-black">{conteoSecciones['TODAS']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('RUTA_NOTIFICACION_CITACION')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'RUTA_NOTIFICACION_CITACION'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-900'
            }`}
          >
            <span className="truncate">1. Notif. y Citación</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['RUTA_NOTIFICACION_CITACION']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('CORREO_EXT')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'CORREO_EXT'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-900'
            }`}
          >
            <span className="truncate">2. Correo Ext.</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['CORREO_EXT']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('RUTA_INTERNA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'RUTA_INTERNA'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
            }`}
          >
            <span className="truncate">3. Ruta Interna</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['RUTA_INTERNA']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('OTROS_ESTADOS_MERIDA')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'OTROS_ESTADOS_MERIDA'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900'
            }`}
          >
            <span className="truncate">4. Mérida / Otros</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['OTROS_ESTADOS_MERIDA']}</span>
          </button>

          <button
            onClick={() => setSelectedSeccion('SOBRESEIMIENTO')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeccion === 'SOBRESEIMIENTO'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-900'
            }`}
          >
            <span className="truncate">5. Sobreseimiento</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded bg-black/20 font-black">{conteoSecciones['SOBRESEIMIENTO'] || 0}</span>
          </button>

          {/* Secciones personalizadas creadas por el usuario */}
          {seccionesCustom.map(sec => {
            const isSelected = selectedSeccion === sec.codigo;
            return (
              <div key={sec.codigo} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedSeccion(sec.codigo)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#0053D5] text-white border-blue-400 shadow-xs ring-1 ring-blue-300 font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                  title={sec.descripcion || sec.nombre}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.colorHex || '#2563EB' }} />
                  <span className="truncate">{sec.nombre}</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {conteoSecciones[sec.codigo] || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSeccionAEditar(sec);
                    setIsModalCrearSeccionOpen(true);
                  }}
                  className="ml-0.5 p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                  title={`Renombrar o modificar sección "${sec.nombre}"`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* BARRA DE AGREGAR RÁPIDO (SUPER FÁCIL) */}
      {showQuickAdd && (
        <form 
          onSubmit={handleQuickAddSubmit}
          className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Agregar boleta en 1 segundo:</span>
            </span>
            <span className="text-[11px] text-indigo-700">Llena los datos y pulsa Enter o Agregar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <div>
              <input
                type="text"
                value={quickCausa}
                onChange={(e) => setQuickCausa(e.target.value)}
                placeholder="Nº de Causa (ej. LP11-P-2026-000123)"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <input
                type="text"
                value={quickBoleta}
                onChange={(e) => setQuickBoleta(e.target.value)}
                placeholder="Boleta Nº (ej. 021)"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <input
                type="text"
                value={quickNombre}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuickNombre(val);
                  const detected = detectCaracterFromText(val);
                  if (detected.detectedTipo) {
                    setQuickCaracter(detected.detectedTipo);
                  }
                }}
                placeholder="Nombre de la persona a notificar (ej: VICT. MARIO ROA, IMP. JUAN PÉREZ)"
                className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <select
                value={quickTribunal}
                onChange={(e) => setQuickTribunal(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {tribunales.map((t, tIdx) => (
                  <option key={`quick-tri-${t.id || t.codigo || tIdx}`} value={t.codigo}>{t.codigo} ({t.nombre})</option>
                ))}
              </select>
              {quickTribunal === 'OTRO' && (
                <input
                  type="text"
                  value={quickTribunalOtro}
                  onChange={(e) => setQuickTribunalOtro(e.target.value.toUpperCase())}
                  placeholder="Especifique tribunal (ej: J5 MERIDA)..."
                  className="w-full mt-1 px-2 py-1 bg-amber-50 border border-amber-300 rounded text-[11px] font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:bg-white"
                  required
                />
              )}
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 2. BARRA DE BÚSQUEDA PRINCIPAL Y ACCIONES */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 space-y-3">
        {/* Buscador inteligente a ancho completo - SIEMPRE VISIBLE EN MODO ESCRITORIO Y MÓVIL */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-blue-700" />
          </div>
          <input
            id="input-buscador-principal-boletas"
            type="text"
            placeholder="🔍 Buscar por Nº Causa, Boleta, Persona citada, Alguacil, Tribunal, Acuse (devuelta)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-24 py-2.5 bg-slate-50 hover:bg-slate-100/70 border-2 border-slate-300 focus:border-blue-600 rounded-xl text-xs sm:text-sm text-slate-900 font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-3 focus:ring-blue-100 shadow-inner transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                title="Borrar texto de búsqueda"
              >
                <span>✕ Limpiar</span>
              </button>
            ) : (
              <span className="hidden sm:inline text-[11px] font-bold text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-md border border-slate-300/60">
                Buscador activo
              </span>
            )}
          </div>
        </div>

        {/* Filtros Dropdowns y Botones de Acción bien organizados */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tribunal */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="text-slate-500 font-bold mr-1.5">Tribunal:</span>
              <select
                value={selectedTribunal}
                onChange={(e) => setSelectedTribunal(e.target.value)}
                className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                {tribunales.map((t, tIdx) => (
                  <option key={`filter-tri-${t.id || t.codigo || tIdx}`} value={t.codigo}>{t.codigo} - {t.nombre}</option>
                ))}
              </select>
            </div>

            {/* Alguacil */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
              <span className="text-slate-500 font-bold mr-1.5">Alguacil:</span>
              <select
                value={selectedAlguacil}
                onChange={(e) => setSelectedAlguacil(e.target.value)}
                className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                {alguacilesList.map((a, aIdx) => (
                  <option key={`filter-alg-${a}-${aIdx}`} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Fecha (Listados por Fecha) */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 mr-1.5 shrink-0" />
              <span className="text-slate-500 font-bold mr-1.5">Fecha:</span>
              <select
                value={selectedFecha}
                onChange={(e) => setSelectedFecha(e.target.value)}
                className="bg-transparent font-black text-slate-800 focus:outline-none cursor-pointer max-w-[150px]"
                title="Filtrar por fecha específica (Asignación o Audiencia)"
              >
                <option value="TODAS">Todas las fechas</option>
                {distinctFechas.map(([f, count]) => (
                  <option key={`distinct-fecha-${f}`} value={f}>
                    {formatFechaDisplay(f)} ({count})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={selectedFecha !== 'TODAS' ? selectedFecha : ''}
                onChange={(e) => setSelectedFecha(e.target.value || 'TODAS')}
                className="ml-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded px-1 py-0.5 cursor-pointer"
                title="Seleccionar fecha en el calendario"
              />
              {selectedFecha !== 'TODAS' && (
                <button
                  type="button"
                  onClick={() => setSelectedFecha('TODAS')}
                  className="ml-1 text-slate-400 hover:text-slate-700 text-xs cursor-pointer font-bold px-1"
                  title="Restablecer a todas las fechas"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Botón Separar Listados por Fecha (No todo junto) */}
            <button
              type="button"
              onClick={() => setAgruparPorFecha(!agruparPorFecha)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                agruparPorFecha
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Separar el listado por fechas individuales para no ver todo junto en el sistema"
            >
              <Calendar className="w-3.5 h-3.5 text-current" />
              <span>{agruparPorFecha ? '✓ Separado por Fechas' : '📅 Separar por Fecha (No todo junto)'}</span>
            </button>

            {/* Botón Filtro Boletas Urgentes */}
            <button
              onClick={() => {
                const nextVal = !filterSoloUrgentes;
                setFilterSoloUrgentes(nextVal);
                if (nextVal) {
                  setSelectedHojaFilter(null);
                  setSelectedSeccion('TODAS');
                  setSelectedTribunal('TODOS');
                  setSelectedAlguacil('TODOS');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                filterSoloUrgentes
                  ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300 scale-105'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
              title="Filtrar solo boletas urgentes (audiencia de hoy para mañana, agregadas viernes para lunes/martes, o próximas a vencer)"
            >
              <Zap className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span>⚡ Bol. Urgentes ({conteoUrgentes})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botón Copiar para Excel */}
            <button
              onClick={handleCopyAllForExcel}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Copiar las filas filtradas al portapapeles en el orden exacto para pegar (Ctrl+V) en Excel"
            >
              <Copy className="w-3.5 h-3.5 text-blue-600" />
              <span>{copyFeedback ? '¡Copiado para Excel! ✓' : 'Copiar para Excel'}</span>
            </button>

            {/* Botón Nueva Lista */}
            {onOpenNuevaListaModal && (
              <button
                onClick={onOpenNuevaListaModal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-slate-700"
                title="Iniciar una nueva lista, cerrar jornada o limpiar tabla"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                <span>Nueva Lista</span>
              </button>
            )}

            {/* Botón Cargar Lote / Excel */}
            {onOpenBatchModal && (
              <button
                onClick={() => onOpenBatchModal(selectedSeccion !== 'TODAS' ? selectedSeccion : undefined)}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Cargar lote de boletas rápidamente o pegar desde Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-950" />
                <span>Cargar Lote / Excel</span>
              </button>
            )}

            {/* Botón Imprimir Ruta (Compartida o Un Solo Alguacil según el rol) */}
            {selectedSeccion === 'SOBRESEIMIENTO' ? (
              <button
                onClick={() => setIsRutaCompartidaModalOpen(true)}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-purple-900 ring-2 ring-purple-300"
                title="Desea dividir esta ruta de SOBRESEIMIENTO para dos Alguaciles de forma compartida"
              >
                <Users className="w-3.5 h-3.5 text-purple-200" />
                <span>Ruta Sobreseimiento (2 Alguaciles)</span>
              </button>
            ) : (dependenciaActiva === 'SECRETARIA' || sesionActual?.rol === 'SECRETARIA') ? (
              <button
                onClick={() => setIsRutaCompartidaModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-emerald-950"
                title="Imprimir Hoja de Ruta de Secretaría (Alguacil asignado único)"
              >
                <User className="w-3.5 h-3.5 text-emerald-300" />
                <span>Ruta Notificación (Alguacil)</span>
              </button>
            ) : (
              <button
                onClick={() => setIsRutaCompartidaModalOpen(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-blue-400/40"
                title="Imprimir Hoja de Ruta de Notificación y Citación con opción de dividir para dos Alguaciles (ej. mitad Renzo y mitad Pablo)"
              >
                <Users className="w-3.5 h-3.5 text-blue-200" />
                <span>Ruta Notif. y Citación</span>
              </button>
            )}

            {/* Opción Imprimir Boleta Seleccionada - Solo visible cuando se selecciona alguna boleta */}
            {selectedBoletaIds.length > 0 && (
              <button
                onClick={handlePrintBoletasSeleccionadas}
                className="px-3 py-1.5 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-blue-400/40 ring-2 ring-blue-300 animate-in fade-in"
                title={`Imprimir ${selectedBoletaIds.length} boleta(s) seleccionada(s) en formato judicial oficial`}
              >
                <Printer className="w-3.5 h-3.5 text-blue-200" />
                <span>Imprimir Boleta{selectedBoletaIds.length > 1 ? 's' : ''} Seleccionada{selectedBoletaIds.length > 1 ? 's' : ''} ({selectedBoletaIds.length})</span>
              </button>
            )}

            {/* Botón Imprimir Listado */}
            <button
              onClick={handlePrintListado}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Imprimir el listado actual de boletas filtradas en PDF oficial"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Listado</span>
            </button>
          </div>
        </div>
      </div>

      {/* BANNER INFORMATIVO DE BÚSQUEDA: LISTADO DETALLADO COMO EN ACUSES DE TRIBUNAL */}
      {searchTerm.trim() !== '' && (
        <div className="bg-white border-2 border-blue-300 rounded-2xl p-3.5 sm:p-4 shadow-md space-y-3 animate-in fade-in">
          {/* Header del bloque de búsqueda */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-[#004BB4] uppercase flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-700" />
                <span>Resultados de Búsqueda ({boletasFiltradas.length} boleta(s) encontrada(s))</span>
              </span>
              <span className="text-xs text-slate-600 font-medium">
                Búsqueda activa: <strong className="text-blue-900 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">"{searchTerm}"</strong>
              </span>
            </div>

            {/* Botones de acción rápida para la búsqueda */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintSearchResults}
                disabled={boletasFiltradas.length === 0}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Imprimir o exportar a PDF los resultados de búsqueda"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Resultados (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                Limpiar Búsqueda
              </button>
            </div>
          </div>

          {/* Badges de métricas de los resultados */}
          {boletasFiltradas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                Total Encontradas: {boletasFiltradas.length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-black flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Devueltas al Tribunal: {boletasFiltradas.filter(b => b.devueltaAlTribunal).length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-black flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Pendientes de Entrega: {boletasFiltradas.filter(b => !b.devueltaAlTribunal).length}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 font-bold">
                Practicadas: {boletasFiltradas.filter(b => b.estado === 'PRACTICADA' || b.devueltaAlTribunal).length}
              </span>
            </div>
          )}

          {boletasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              <Search className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
              <p className="text-xs font-semibold">No se encontraron boletas que coincidan con los términos de búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#003EA7] text-white font-bold border-b border-blue-400/40 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-10 border border-slate-700">
                      <input
                        type="checkbox"
                        checked={boletasFiltradas.length > 0 && boletasFiltradas.every(b => selectedBoletaIds.includes(b.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = Array.from(new Set([...selectedBoletaIds, ...boletasFiltradas.map(b => b.id)]));
                            setSelectedBoletaIds(newIds);
                          } else {
                            const filteredIds = new Set(boletasFiltradas.map(b => b.id));
                            setSelectedBoletaIds(selectedBoletaIds.filter(id => !filteredIds.has(id)));
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        title="Seleccionar todas las boletas de la búsqueda"
                      />
                    </th>
                    <th className="py-2.5 px-2 text-center w-12 border border-slate-700">Nº</th>
                    <th className="py-2.5 px-3 min-w-[150px] text-left border border-slate-700">Nº DE CAUSA</th>
                    <th className="py-2.5 px-2 text-center w-20 border border-slate-700">BOLETA</th>
                    <th className="py-2.5 px-2.5 text-center min-w-[120px] border border-slate-700">CARÁCTER</th>
                    <th className="py-2.5 px-3 min-w-[200px] text-left border border-slate-700">PERSONA NOTIFICADA / CITADA</th>
                    <th className="py-2.5 px-2 text-center w-16 border border-slate-700">TRI</th>
                    <th className="py-2.5 px-2 text-center w-16 border border-slate-700">ART. COPP</th>
                    <th className="py-2.5 px-2 text-center min-w-[100px] border border-slate-700">F. AUDIENCIA</th>
                    <th className="py-2.5 px-2.5 text-left min-w-[130px] border border-slate-700">ALGUACIL</th>
                    <th className="py-2.5 px-2 text-center min-w-[130px] border border-slate-700">RESULTA / ESTADO</th>
                    <th className="py-2.5 px-3 min-w-[220px] text-left border border-slate-700">RECIBIDA EN TRIBUNAL POR</th>
                    <th className="py-2.5 px-2 text-center w-24 border border-slate-700">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {boletasFiltradas.map((b, idx) => {
                    const isSelected = selectedBoletaIds.includes(b.id);
                    const isEditing = editingRecibidoId === b.id;
                    const art = b.articuloCOPP === 'S_165' ? 'S 165' : (b.articuloCOPP || '167');

                    return (
                      <tr 
                        key={`search-row-${b.id}`}
                        className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/80 font-medium' : ''}`}
                      >
                        {/* Checkbox de selección */}
                        <td className="py-2.5 px-3 text-center border border-slate-300">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(b)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Índice correlativo */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 border border-slate-300">
                          {idx + 1}
                        </td>

                        {/* Nº DE CAUSA */}
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-950 border border-slate-300 whitespace-normal break-words select-all">
                          {b.numeroCausa}
                        </td>

                        {/* BOLETA */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800 bg-slate-50 border border-slate-300 font-mono">
                          {b.boletaNumero || 'S/N'}
                        </td>

                        {/* CARÁCTER */}
                        <td className="py-2.5 px-2.5 text-center border border-slate-300">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-900 border border-blue-200 uppercase">
                            {getCaracterDisplay(b.tipoCitado) || b.tipoCitado || 'IMPUTADO'}
                          </span>
                        </td>

                        {/* PERSONA NOTIFICADA / CITADA */}
                        <td className="py-2.5 px-3 font-semibold text-slate-800 border border-slate-300">
                          {b.notificadoCitado}
                        </td>

                        {/* TRI */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700 border border-slate-300 whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-black text-[11px]">
                              {b.tribunal}
                            </span>
                            {b.tribunalOtro && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded truncate max-w-[120px]" title={b.tribunalOtro}>
                                {b.tribunalOtro}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ART. COPP */}
                        <td className="py-2.5 px-2 text-center font-black border border-slate-300">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                            art === '167' ? 'bg-slate-100 text-slate-900 border border-slate-300' :
                            art === '168' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                            art === '169' ? 'bg-sky-100 text-sky-900 border border-sky-200' :
                            art === '170' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                            art === '171' ? 'bg-red-100 text-red-900 border border-red-200' :
                            art === '165' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                            'bg-orange-100 text-orange-900 border border-orange-200'
                          }`}>
                            {art}
                          </span>
                        </td>

                        {/* F. AUDIENCIA / NOTIFICACIÓN */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 font-medium text-slate-700">
                          {b.esSoloNotificacion ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              NOTIFICACIÓN
                            </span>
                          ) : (
                            formatFechaDisplay(b.fechaAudiencia)
                          )}
                        </td>

                        {/* ALGUACIL */}
                        <td className="py-2.5 px-2.5 font-bold text-slate-800 border border-slate-300">
                          {b.alguacilPractica || (
                            <span className="text-slate-400 italic font-normal">Sin asignar</span>
                          )}
                        </td>

                        {/* RESULTA / ESTADO */}
                        <td className="py-2.5 px-2 text-center border border-slate-300">
                          {b.devueltaAlTribunal ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px] border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Entregado {b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : ''}</span>
                              </span>
                              <span className="text-[9px] font-bold text-emerald-800 block uppercase">
                                {b.estado || 'DEVUELTA'}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>Por Entregar</span>
                              </span>
                              <span className="text-[9px] font-bold text-slate-600 block uppercase">
                                {b.estado === 'NO_PRACTICADA' 
                                  ? (b.motivoNoPractica ? `NO PRACT. (${b.motivoNoPractica})` : 'NO PRACTICADA')
                                  : b.estado === 'PRACTICADA'
                                  ? 'PRACTICADA'
                                  : 'EN RUTA'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* RECIBIDA EN TRIBUNAL POR (SOLO LECTURA EN RESULTADOS DE BÚSQUEDA) */}
                        <td className="py-2 px-2.5 text-slate-700 border border-slate-300 align-top">
                          <div className="flex flex-col gap-1">
                            {b.acuseRecibidoPor ? (
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{b.acuseRecibidoPor}</span>
                                </span>
                                {(b.acuseFechaEntrega || b.acuseHoraEntrega) && (
                                  <span className="text-[10px] text-slate-500 block">
                                    {b.acuseFechaEntrega ? formatFechaDisplay(b.acuseFechaEntrega) : ''} {b.acuseHoraEntrega ? `(${b.acuseHoraEntrega})` : ''}
                                  </span>
                                )}
                              </div>
                            ) : b.devueltaAlTribunal ? (
                              <span className="text-amber-800 font-semibold text-[11px] block">
                                Sin receptor asignado
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px] block">
                                Por entregar
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ACCIONES */}
                        <td className="py-2.5 px-2 text-center border border-slate-300">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditBoleta(b)}
                              className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              title="Ver / Modificar Boleta Judicial"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {onNavigateToAcuses && (
                              <button
                                type="button"
                                onClick={() => onNavigateToAcuses(b.tribunal, [b.id])}
                                className="p-1.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                title={`Ir al Acuse de Tribunal (${b.tribunal}) con esta boleta`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. BARRA DE ACCIONES MASIVAS (Si hay seleccionadas) */}
      {selectedBoletaIds.length > 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-black text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-300 shadow-xs text-xs">
              ⚡ {selectedBoletaIds.length} boletas seleccionadas
            </span>
            <button
              onClick={() => setSelectedBoletaIds([])}
              className="text-indigo-700 hover:text-indigo-900 underline font-bold cursor-pointer"
            >
              Deseleccionar
            </button>
            {/* Botón Imprimir Boleta Seleccionada en la barra de selección */}
            <button
              onClick={handlePrintBoletasSeleccionadas}
              className="px-3 py-1 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white rounded-lg font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs border border-blue-400/40"
              title="Imprimir boleta(s) seleccionada(s) en formato de listado oficial"
            >
              <Printer className="w-3.5 h-3.5 text-blue-200" />
              <span>Imprimir Listado Seleccionadas</span>
            </button>
            <button
              onClick={() => handleOpenResultaFisico()}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="Generar formato oficial de diligencia / resulta judicial en físico"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>📄 Formato Resulta en Físico</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Asignar Alguacil a seleccionadas */}
            {onBulkAssignAlguacil && (
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-indigo-300 shadow-xs">
                <span className="text-[11px] font-bold text-indigo-950 whitespace-nowrap">Alguacil:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      onBulkAssignAlguacil(selectedBoletaIds, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 font-bold text-slate-900 px-2 py-0.5 rounded text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" disabled>Asignar a las {selectedBoletaIds.length} seleccionadas...</option>
                  {alguaciles.map((a, aIdx) => (
                    <option key={`bulk-alg-${a.id || a.nombre || aIdx}`} value={a.nombre}>{a.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cambiar Carácter a seleccionadas */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-indigo-300 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-950 whitespace-nowrap">Carácter:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAssignCaracter(selectedBoletaIds, e.target.value as TipoCitado);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 font-bold text-slate-900 px-2 py-0.5 rounded text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                title={`Cambiar el carácter de las ${selectedBoletaIds.length} boletas seleccionadas`}
              >
                <option value="" disabled>Cambiar carácter ({selectedBoletaIds.length})...</option>
                {TIPOS_CITADO_OPTIONS.map((opt) => (
                  <option key={`bulk-carac-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Asignación rápida de Artículos COPP con 7 botones de colores idénticos a la imagen */}
            {onBulkAssignArticulo && (
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg shadow-xs">
                <span className="text-[11px] text-white font-bold px-1 hidden sm:inline whitespace-nowrap">
                  Asignar Art ({selectedBoletaIds.length}):
                </span>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '167')}
                  className="px-2 py-0.5 rounded bg-[#8f9ca8] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 167 a todas las seleccionadas"
                >
                  167
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '168')}
                  className="px-2 py-0.5 rounded bg-[#5c98e2] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 168 a todas las seleccionadas"
                >
                  168
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '169')}
                  className="px-2 py-0.5 rounded bg-[#8ea8be] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 169 a todas las seleccionadas"
                >
                  169
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '170')}
                  className="px-2 py-0.5 rounded bg-[#9dce64] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 170 a todas las seleccionadas"
                >
                  170
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '171')}
                  className="px-2 py-0.5 rounded bg-[#e7444b] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 171 a todas las seleccionadas"
                >
                  171
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '165')}
                  className="px-2 py-0.5 rounded bg-[#fce444] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. 165 a todas las seleccionadas"
                >
                  165
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, 'S_165')}
                  className="px-2 py-0.5 rounded bg-[#df7a40] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  title="Asignar Art. S 165 a todas las seleccionadas"
                >
                  S 165
                </button>
                <button
                  type="button"
                  onClick={() => onBulkAssignArticulo(selectedBoletaIds, '')}
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-semibold cursor-pointer"
                  title="Limpiar artículo de todas las seleccionadas"
                >
                  Borrar
                </button>
              </div>
            )}

            {/* Marcar Devueltas */}
            {onBulkDevuelta && (
              <button
                onClick={() => {
                  onBulkDevuelta(selectedBoletaIds);
                  setSelectedBoletaIds([]);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer transition-colors shadow-xs"
              >
                ✓ Marcar Devueltas
              </button>
            )}

            {/* Eliminar */}
            {onBulkDelete && (
              <button
                type="button"
                onClick={() => {
                  onBulkDelete(selectedBoletaIds);
                  setSelectedBoletaIds([]);
                }}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-1"
                title="Eliminar las boletas seleccionadas (pedirá confirmación)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Eliminar ({selectedBoletaIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notificación de cambio masivo de Carácter */}
      {bulkCaracterFeedback && (
        <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 px-3.5 py-2 rounded-xl text-xs font-black shadow-xs animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{bulkCaracterFeedback}</span>
        </div>
      )}

      {/* 3.5. CONTROL DE PÁGINAS Y HOJAS DEL LOTE (DISEÑO ORGANIZADO Y COMPACTO) */}
      <div className="bg-gradient-to-r from-[#0053D5] via-[#004BB4] to-[#003EA7] text-white rounded-xl shadow-md border border-blue-400/30 p-3 space-y-3 text-xs">
        {/* Fila Superior: Título, Modo de Vista y Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-black text-white">
              <Layers className="w-4 h-4 text-blue-200" />
              <span>Hojas y Folios Físicos:</span>
            </div>

            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold border border-white/30 text-[11px]">
              {hojasCalculadas.length} {hojasCalculadas.length === 1 ? 'Hoja' : 'Hojas'} ({boletasFiltradas.length} boletas • 30 por hoja)
            </span>

            {/* Selector de Modo: Todas con Separadores vs Filtrar Hoja Individual */}
            <div className="inline-flex rounded-lg p-0.5 bg-black/25 border border-white/20 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setModoVistaHojas('todas_con_separadores');
                  setSelectedHojaFilter(null);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoVistaHojas === 'todas_con_separadores' && selectedHojaFilter === null
                    ? 'bg-white text-[#004BB4] shadow-xs font-black'
                    : 'text-blue-100 hover:text-white'
                }`}
                title="Muestra todas las hojas en el listado continuo pero con separadores visuales claros para cada folio"
              >
                <span>📜 Todas con Separadores</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoVistaHojas('hoja_individual');
                  if (selectedHojaFilter === null) setSelectedHojaFilter(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedHojaFilter !== null || modoVistaHojas === 'hoja_individual'
                    ? 'bg-white text-[#004BB4] shadow-xs font-black'
                    : 'text-blue-100 hover:text-white'
                }`}
                title="Filtra la tabla para ver únicamente las 30 boletas de una hoja específica"
              >
                <span>📄 Filtrar Hoja Individual</span>
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2">
            {selectedSeccion === 'SOBRESEIMIENTO' && (
              <button
                type="button"
                onClick={() => setIsRutaCompartidaModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Generar e imprimir ruta compartida de sobreseimiento para 2 alguaciles"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Ruta 2 Alguaciles</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsImprimirHojasOpen(true)}
              className="px-3.5 py-1.5 bg-white hover:bg-blue-50 text-[#004BB4] rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Seleccionar y configurar hojas para imprimir en PDF con nomenclatura UAC"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Hojas PDF</span>
            </button>
          </div>
        </div>

        {/* Fila Inferior: Navegación Ergonómica (Selector Desplegable + Ventana de Páginas + Salto Rápido) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/20">
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector Desplegable Limpio de Hojas (Sin saturación visual) */}
            <div className="flex items-center gap-1.5">
              <span className="text-blue-100 text-xs font-bold hidden sm:inline">Ir a Hoja:</span>
              <select
                value={modoVistaHojas === 'todas_con_separadores' && selectedHojaFilter === null ? 'TODAS' : (selectedHojaFilter || 1)}
                onChange={(e) => {
                  if (e.target.value === 'TODAS') {
                    setModoVistaHojas('todas_con_separadores');
                    setSelectedHojaFilter(null);
                  } else {
                    const num = parseInt(e.target.value, 10);
                    if (modoVistaHojas === 'todas_con_separadores') {
                      scrollToHoja(num);
                    } else {
                      setSelectedHojaFilter(num);
                    }
                  }
                }}
                className="bg-[#002773] text-white font-bold text-xs py-1.5 px-2.5 rounded-lg border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none max-w-[280px] sm:max-w-[340px] truncate cursor-pointer"
                title="Selecciona una hoja para saltar a ella en el listado o aislarla"
              >
                <option value="TODAS">📜 Ver Todas las Hojas ({hojasCalculadas.length}) con Separadores</option>
                {hojasCalculadas.map((h) => (
                  <option key={`opt-select-hoja-${h.numeroHoja}`} value={h.numeroHoja}>
                    Hoja {h.numeroHoja} [{h.idHoja}] — {h.cantidad}/30 boletas {h.estaLlena ? '✓ Llena' : `(Restan ${h.capacidad - h.cantidad})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Controles de Paginación Compactos (Ventana Inteligente, Máximo 7 Botones) */}
            <div className="flex items-center gap-1 bg-black/25 p-1 rounded-lg border border-white/20">
              {/* Botón Anterior */}
              <button
                type="button"
                disabled={hojasCalculadas.length === 0 || (selectedHojaFilter !== null && selectedHojaFilter <= 1)}
                onClick={() => {
                  if (selectedHojaFilter === null) {
                    scrollToHoja(1);
                  } else if (selectedHojaFilter > 1) {
                    const prev = selectedHojaFilter - 1;
                    if (modoVistaHojas === 'todas_con_separadores') {
                      scrollToHoja(prev);
                    } else {
                      setSelectedHojaFilter(prev);
                    }
                  }
                }}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Hoja anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Botón Ver Todas */}
              <button
                type="button"
                onClick={() => {
                  setModoVistaHojas('todas_con_separadores');
                  setSelectedHojaFilter(null);
                }}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedHojaFilter === null
                    ? 'bg-indigo-600 text-white font-black'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Ver todas las hojas con separadores"
              >
                Todas
              </button>

              {/* Botones de ventana compacta */}
              {visiblePageNumbers.map((pageNum, idx) => {
                const prevPage = idx > 0 ? visiblePageNumbers[idx - 1] : null;
                const showEllipsisBefore = prevPage !== null && pageNum - prevPage > 1;
                const isSelected = selectedHojaFilter === pageNum;

                return (
                  <React.Fragment key={`page-win-btn-${pageNum}`}>
                    {showEllipsisBefore && (
                      <span className="px-1 text-slate-500 font-bold select-none text-[11px]">...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (modoVistaHojas === 'todas_con_separadores') {
                          scrollToHoja(pageNum);
                        } else {
                          setSelectedHojaFilter(pageNum);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-slate-900 font-black shadow-xs ring-1 ring-indigo-400'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title={`Hoja ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  </React.Fragment>
                );
              })}

              {/* Botón Siguiente */}
              <button
                type="button"
                disabled={hojasCalculadas.length === 0 || (selectedHojaFilter !== null && selectedHojaFilter >= hojasCalculadas.length)}
                onClick={() => {
                  if (selectedHojaFilter === null) {
                    scrollToHoja(Math.min(2, hojasCalculadas.length));
                  } else if (selectedHojaFilter < hojasCalculadas.length) {
                    const next = selectedHojaFilter + 1;
                    if (modoVistaHojas === 'todas_con_separadores') {
                      scrollToHoja(next);
                    } else {
                      setSelectedHojaFilter(next);
                    }
                  }
                }}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Hoja siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Salto Rápido por Número o UAC */}
          <form onSubmit={handleSearchHojaSubmit} className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs font-medium hidden sm:inline">Salto directo:</span>
            <input
              type="text"
              placeholder="Nº o UAC"
              value={hojaSearchInput}
              onChange={(e) => setHojaSearchInput(e.target.value)}
              className="w-20 bg-slate-800 border border-slate-700 px-2 py-1 rounded-lg text-xs font-mono text-center text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              title="Escribe el número de hoja (ej: 87) o UAC (ej: 0087)"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors border border-indigo-500/60 shadow-xs"
              title="Saltar a la hoja indicada"
            >
              Ir
            </button>
          </form>
        </div>
      </div>

      {/* Banner Informativo cuando se está visualizando una Página / Hoja específica */}
      {selectedHojaFilter !== null && currentHojaObj && (
        <div className="bg-indigo-950 text-white rounded-xl p-3 border-2 border-indigo-500 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-blue-700 font-bold text-xs text-white shadow-xs">
              Página {currentHojaObj.numeroHoja}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-200">
                Rango: Ítems {currentHojaObj.rangoItems.desde} al {currentHojaObj.rangoItems.hasta}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-bold text-indigo-300">
                Límite físico: 30 boletas
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-300">
                Trabajadas: <strong className="text-white">{currentHojaObj.cantidad} de 30</strong>
              </span>
              {currentHojaObj.fechaAsignacion && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-amber-300">
                    Fecha Asig: <strong>{formatFechaDisplay(currentHojaObj.fechaAsignacion)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentHojaObj.estaLlena ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                {(currentHojaObj.boletas || []).some(b => b.finDePagina)
                  ? `✓ Página finalizada manualmente (${currentHojaObj.cantidad} boletas)`
                  : '✓ Límite de 30 alcanzado (Página completa)'}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                ⚡ Trabajadas {currentHojaObj.cantidad}/30 (Restan {currentHojaObj.capacidad - currentHojaObj.cantidad} para alcanzar el límite)
              </span>
            )}

            {/* Opción para terminar página y empezar una nueva */}
            {onToggleFinDePagina && (currentHojaObj.boletas?.length || 0) > 0 && (
              (() => {
                const ultimaBoleta = currentHojaObj.boletas[currentHojaObj.boletas.length - 1];
                const esFinActivo = !!ultimaBoleta.finDePagina;
                return (
                  <button
                    type="button"
                    onClick={() => onToggleFinDePagina(ultimaBoleta.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                      esFinActivo
                        ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 hover:shadow-md'
                    }`}
                    title={
                      esFinActivo
                        ? 'Deshacer fin de página manual y permitir que continúe hasta el límite de 30'
                        : 'Cerrar esta página con las boletas actuales e iniciar una nueva página para las siguientes'
                    }
                  >
                    <span>{esFinActivo ? '↩️ Deshacer fin de página' : '📄 Terminar página y empezar una nueva'}</span>
                  </button>
                );
              })()
            )}

            <button
              type="button"
              onClick={() => setSelectedHojaFilter(null)}
              className="text-xs text-indigo-300 hover:text-white underline font-bold cursor-pointer ml-1"
            >
              Ver todas
            </button>
          </div>
        </div>
      )}

      {/* 4. TABLA PRINCIPAL (CON BORDES MARCADOS VISIBLES Y CLAROS) */}
      <div className="bg-white rounded-xl shadow-xs border-2 border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-400 text-xs min-w-[1300px]">
            <thead>
              <tr className="bg-[#003EA7] text-white font-bold text-[11px]">
                <th className="py-3 px-2 text-center w-8 border border-slate-700">
                  <input
                    type="checkbox"
                    checked={boletasFiltradas.length > 0 && boletasFiltradas.every(b => selectedBoletaIds.includes(b.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBoletaIds(boletasFiltradas.map(b => b.id));
                      else setSelectedBoletaIds([]);
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 text-center w-10 border border-slate-700">Nº</th>
                <th className="py-3 px-3 border border-slate-700 whitespace-nowrap min-w-[200px] text-left">
                  <span>Nº DE CAUSA</span>
                </th>
                <th className="py-3 px-2 text-center w-20 border border-slate-700">BOLETA Nº</th>
                {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                  <th className="py-3 px-2 text-center min-w-[100px] border border-slate-700 bg-emerald-950/80 text-emerald-200" title="Número de Oficio Judicial (Secretaría)">
                    Nº DE OFICIO
                  </th>
                )}
                
                {/* NOTIFICADO Y CITADO CENTRADO */}
                <th className="py-3 px-3 min-w-[200px] text-center border border-slate-700">NOTIFICADO Y CITADO</th>
                
                {/* FECHA DE AUDIENCIA / NOTIFICACIÓN */}
                <th 
                  className="py-3 px-2 text-center min-w-[95px] cursor-pointer hover:bg-slate-800 border border-slate-700"
                  onClick={() => {
                    if (sortField === 'audiencia') setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                    else { setSortField('audiencia'); setSortDirection('asc'); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{selectedSeccion === 'SOBRESEIMIENTO' ? 'NOTIFICACIÓN SOBRESEIMIENTO' : 'FECHA DE AUDIENCIA / NOTIF.'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="py-3 px-2 text-center min-w-[90px] text-slate-300 border border-slate-700">
                  FECHA DE ASIGNACION
                </th>
                <th className="py-3 px-2 text-center w-12 border border-slate-700">TRI</th>

                {/* 7 Columnas COPP idénticas a la imagen con bordes marcados */}
                <th className="py-2 px-1 text-center bg-[#8f9ca8] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 167 COPP - Boleta personal directa">167</th>
                <th className="py-2 px-1 text-center bg-[#5c98e2] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 168 COPP - Víctima/Expertos">168</th>
                <th className="py-2 px-1 text-center bg-[#8ea8be] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 169 COPP - Telemática / Fax / Correo">169</th>
                <th className="py-2 px-1 text-center bg-[#9dce64] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 170 COPP - Funcionarios / Militares">170</th>
                <th className="py-2 px-1 text-center bg-[#e7444b] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 171 COPP - Cartel / Edictos">171</th>
                <th className="py-2 px-1 text-center bg-[#fce444] text-slate-950 w-8 font-black border border-slate-600 select-none text-[11px]" title="Art. 165 COPP - Notificación Ordinaria">165</th>
                <th className="py-1 px-1 text-center bg-[#df7a40] text-slate-950 w-9 font-black border border-slate-600 select-none text-[10px] leading-tight" title="Art. S 165 COPP - Notificación Especial / Sustitutiva">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black leading-none">S</span>
                    <span className="text-[10px] font-black leading-none mt-0.5">165</span>
                  </div>
                </th>

                <th className="py-3 px-3 min-w-[140px] text-center border border-slate-700">ALGUACIL</th>
                <th className="py-3 px-2 text-center min-w-[90px] border border-slate-700">DEVUELTA</th>
                
                {/* ACCIONES (FIJO A LA DERECHA - SIEMPRE VISIBLE) */}
                <th className="py-3 px-2 text-center min-w-[70px] w-20 border border-slate-700 sticky right-0 bg-[#003EA7] z-20 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.35)]">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {boletasAMostrarEnTabla.length === 0 ? (
                <tr>
                  <td colSpan={dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS' ? 19 : 18} className="py-12 text-center text-slate-500 border border-slate-300">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <p className="font-bold text-slate-700 text-sm">No hay boletas en esta vista</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Puedes agregar una usando la barra rápida o el botón Nueva Boleta.
                      </p>
                      {onOpenBatchModal && (
                        <button
                          onClick={() => onOpenBatchModal(selectedSeccion !== 'TODAS' ? selectedSeccion : undefined)}
                          className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Cargar Lote
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                (() => {
                  const renderBoletaRow = (b: BoletaJudicial, idx: number) => {
                    const alerta = evaluarAlertaBoleta(b);
                    const urgencia = esBoletaUrgente(b);
                    const isSelected = selectedBoletaIds.includes(b.id);
                    const is167 = hasArticulo(b, '167');
                    const is168 = hasArticulo(b, '168');
                    const is169 = hasArticulo(b, '169');
                    const is170 = hasArticulo(b, '170');
                    const is171 = hasArticulo(b, '171');
                    const is165 = hasArticulo(b, '165');
                    const isS165 = hasArticulo(b, 'S_165');

                    return (
                      <React.Fragment key={b.id ? `boleta-frag-${b.id}` : `boleta-frag-${b.numeroItem}-${idx}`}>
                        <tr 
                          key={b.id ? `boleta-row-${b.id}` : `boleta-row-${b.numeroItem}-${idx}`}
                          className={`hover:bg-indigo-50/50 transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50/80' 
                              : (alerta.nivel === 'CRITICA' 
                                  ? 'bg-rose-50/40' 
                                  : (urgencia.esUrgente && !b.devueltaAlTribunal ? 'bg-amber-50/40' : ''))
                          }`}
                        >
                        {/* Checkbox individual para selección libre */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectRow(b)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Nº */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700 border border-slate-300">
                          {b.numeroItem}
                        </td>

                        {/* Nº DE CAUSA (COMPLETO, NUNCA TRUNCADO - SIN LÁPIZ REDUNDANTE) */}
                        <td className="py-2.5 px-3 font-bold text-indigo-950 font-mono border border-slate-300 whitespace-nowrap min-w-[200px] text-xs">
                          <button
                            type="button"
                            onClick={() => onEditBoleta(b)}
                            className="whitespace-nowrap select-all tracking-tight text-left hover:text-blue-700 hover:underline cursor-pointer flex items-center"
                            title="Clic directo para modificar esta boleta"
                          >
                            <span>{b.numeroCausa}</span>
                          </button>
                        </td>

                        {/* BOLETA */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800 bg-slate-50/70 border border-slate-300 whitespace-nowrap">
                          {b.boletaNumero}
                        </td>

                        {/* Nº DE OFICIO (ROL SECRETARIO(A)) */}
                        {(dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS') && (
                          <td className="py-2.5 px-2 text-center font-bold border border-slate-300 whitespace-nowrap bg-emerald-50/40">
                            {b.numeroOficio ? (
                              <span className="font-mono text-emerald-950 font-extrabold text-[11px] bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded">
                                {b.numeroOficio}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">-</span>
                            )}
                          </td>
                        )}

                        {/* PERSONA (CENTRADA SEGÚN SOLICITUD) */}
                        <td className="py-2.5 px-3 text-center border border-slate-300">
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="font-bold text-slate-900 block truncate max-w-[240px]" title={b.notificadoCitado}>
                              {b.notificadoCitado}
                            </span>
                            {b.tipoCitado && (
                              <select
                                value={b.tipoCitado}
                                onChange={(e) => {
                                  const newCarac = e.target.value as TipoCitado;
                                  if (selectedBoletaIds.includes(b.id) && selectedBoletaIds.length > 1) {
                                    handleBulkAssignCaracter(selectedBoletaIds, newCarac);
                                  } else {
                                    handleBulkAssignCaracter([b.id], newCarac);
                                  }
                                }}
                                className="mt-1 text-[10px] font-extrabold text-blue-900 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 uppercase"
                                title={
                                  selectedBoletaIds.includes(b.id) && selectedBoletaIds.length > 1
                                    ? `⚡ Cambiar carácter de las ${selectedBoletaIds.length} boletas seleccionadas`
                                    : 'Cambiar carácter de esta boleta'
                                }
                              >
                                {TIPOS_CITADO_OPTIONS.map(opt => (
                                  <option key={`row-carac-${b.id}-${opt.value}`} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>

                        {/* FECHA DE AUDIENCIA / NOTIFICACIÓN */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 whitespace-nowrap">
                          {b.seccionRuta === 'SOBRESEIMIENTO' || selectedSeccion === 'SOBRESEIMIENTO' ? (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-black uppercase tracking-tight border border-purple-200 shadow-xs">
                              Notificación Sobreseimiento
                            </span>
                          ) : (b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia || b.fechaAudiencia.toUpperCase().includes('NOTIF')) ? (
                            <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold tracking-wide shadow-xs">
                              NOTIFICACIÓN
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-slate-800">
                                {formatFechaDisplay(b.fechaAudiencia)}
                              </span>
                              {urgencia.esUrgente && !b.devueltaAlTribunal ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilterSoloUrgentes(true);
                                    setSelectedHojaFilter(null);
                                    setSelectedSeccion('TODAS');
                                    setSelectedTribunal('TODOS');
                                    setSelectedAlguacil('TODOS');
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center gap-0.5 shadow-xs animate-pulse tracking-tight cursor-pointer transition-transform hover:scale-105"
                                  title={`Bol. Urgente: ${urgencia.motivo}. Clic para filtrar solo urgentes.`}
                                >
                                  ⚡ Bol. Urgente
                                </button>
                              ) : alerta.nivel === 'CRITICA' ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                                  ¡Hoy / Urgente!
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>

                        {/* FECHA DE ASIGNACIÓN */}
                        <td className="py-2.5 px-2 text-center text-slate-700 font-medium border border-slate-300 whitespace-nowrap">
                          {formatFechaDisplay(b.fechaAsignacion)}
                        </td>

                        {/* TRIBUNAL (CON ESPECIFICACIÓN CUANDO ES OTRO / FORÁNEO) */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-black text-[11px]">
                              {b.tribunal}
                            </span>
                            {b.tribunalOtro && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded truncate max-w-[120px]" title={b.tribunalOtro}>
                                {b.tribunalOtro}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 167 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '167')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-slate-200 select-none ${
                            is167 ? 'bg-slate-100' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 167 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 167 (permite hasta 2)'
                          }
                        >
                          {is167 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8f9ca8] text-slate-950 font-black text-xs shadow-xs border border-slate-500">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* 168 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '168')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-blue-200 select-none ${
                            is168 ? 'bg-blue-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 168 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 168 (permite hasta 2)'
                          }
                        >
                          {is168 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#5c98e2] text-slate-950 font-black text-xs shadow-xs border border-blue-600">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* 169 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '169')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-sky-200 select-none ${
                            is169 ? 'bg-sky-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 169 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 169 (permite hasta 2)'
                          }
                        >
                          {is169 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#8ea8be] text-slate-950 font-black text-xs shadow-xs border border-sky-600">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* 170 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '170')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-emerald-200 select-none ${
                            is170 ? 'bg-emerald-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 170 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 170 (permite hasta 2)'
                          }
                        >
                          {is170 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#9dce64] text-slate-950 font-black text-xs shadow-xs border border-emerald-600">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* 171 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '171')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-red-200 select-none ${
                            is171 ? 'bg-red-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 171 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 171 (permite hasta 2)'
                          }
                        >
                          {is171 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#e7444b] text-slate-950 font-black text-xs shadow-xs border border-red-600">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* 165 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, '165')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-yellow-200 select-none ${
                            is165 ? 'bg-yellow-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. 165 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. 165 (permite hasta 2)'
                          }
                        >
                          {is165 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#fce444] text-slate-950 font-black text-xs shadow-xs border border-yellow-500">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* S 165 */}
                        <td 
                          onClick={() => handleRowArticuloToggle(b, 'S_165')}
                          className={`py-2 px-1 text-center border border-slate-300 cursor-pointer transition-all hover:bg-orange-100 select-none ${
                            isS165 ? 'bg-orange-50' : ''
                          } ${isSelected && selectedBoletaIds.length > 1 ? 'ring-1 ring-inset ring-indigo-300' : ''}`}
                          title={
                            isSelected && selectedBoletaIds.length > 1
                              ? `Clic para asignar Art. S 165 a las ${selectedBoletaIds.length} boletas seleccionadas`
                              : 'Clic para marcar/desmarcar Art. S 165 (permite hasta 2)'
                          }
                        >
                          {isS165 ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#df7a40] text-slate-950 font-black text-xs shadow-xs border border-orange-600">
                              1
                            </span>
                          ) : null}
                        </td>

                        {/* ALGUACIL */}
                        <td className="py-2.5 px-3 border border-slate-300 min-w-[140px]">
                          <select
                            value={b.alguacilPractica || ''}
                            onChange={(e) => handleRowAlguacilChange(b.id, e.target.value)}
                            className={`w-full font-bold px-2 py-1 rounded-lg text-xs border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              isSelected && selectedBoletaIds.length > 1
                                ? 'bg-indigo-100/90 text-indigo-950 border-indigo-400 ring-1 ring-indigo-300'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
                            }`}
                            title={
                              isSelected && selectedBoletaIds.length > 1
                                ? `⚡ ¡Atención! Cambiar este alguacil modificará las ${selectedBoletaIds.length} boletas seleccionadas`
                                : 'Seleccionar Alguacil'
                            }
                          >
                            <option value="">(Sin Alguacil)</option>
                            {alguaciles.map((a, aIdx) => (
                              <option key={`row-alg-${b.id || idx}-${a.id || a.nombre || aIdx}`} value={a.nombre}>{a.nombre}</option>
                            ))}
                            {b.alguacilPractica && !alguaciles.some(a => a.nombre.trim().toUpperCase() === b.alguacilPractica?.trim().toUpperCase()) && (
                              <option value={b.alguacilPractica}>{b.alguacilPractica} (Externo)</option>
                            )}
                          </select>
                        </td>

                        {/* DEVUELTA (Botón Toggle 1 clic con estado y recibida por) */}
                        <td className="py-2.5 px-2 text-center border border-slate-300 whitespace-nowrap">
                          {(() => {
                            const req = validarRequisitosDevuelta(b);
                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleDevueltaRow(b)}
                                  className={`px-3 py-0.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                                    b.devueltaAlTribunal
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                      : !req.puedeSerDevuelta
                                        ? 'bg-slate-100 hover:bg-amber-100 text-slate-500 border border-slate-300 hover:border-amber-400'
                                        : 'bg-amber-100 hover:bg-emerald-100 text-amber-900 border border-amber-300 hover:border-emerald-400'
                                  }`}
                                  title={
                                    b.devueltaAlTribunal
                                      ? 'Clic para cambiar a Pendiente'
                                      : !req.puedeSerDevuelta
                                        ? req.mensajeError.replace(/\n/g, ' ')
                                        : 'Clic para marcar como Devuelta (SÍ)'
                                  }
                                >
                                  {b.devueltaAlTribunal ? '✓ DEVUELTA' : '⏳ PENDIENTE'}
                                </button>
                                {b.devueltaAlTribunal ? (
                                  <div className="text-center text-[10px] leading-tight flex flex-col items-center w-full mt-1">
                                    <span className="font-extrabold text-emerald-800 block text-[9px] uppercase tracking-wide">
                                      ESTADO: {b.estado || 'DEVUELTA'}
                                    </span>
                                    {b.acuseRecibidoPor ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRecibidoModal(b)}
                                        className="group/recibido mt-1 flex flex-col items-center text-center p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 hover:border-emerald-400 transition-all cursor-pointer shadow-2xs max-w-[145px] w-full"
                                        title="Clic para editar el nombre de quién recibió, fecha y hora"
                                      >
                                        <div className="flex items-center justify-center gap-1 w-full text-slate-800 font-bold text-[10px]">
                                          <UserCheck className="w-3 h-3 text-emerald-700 shrink-0" />
                                          <span className="truncate max-w-[105px]" title={b.acuseRecibidoPor}>
                                            {b.acuseRecibidoPor}
                                          </span>
                                          <Edit3 className="w-2.5 h-2.5 text-blue-600 opacity-60 group-hover/recibido:opacity-100 shrink-0" />
                                        </div>
                                        {(b.acuseFechaEntrega || b.acuseHoraEntrega || b.fechaDevueltaTribunal) && (
                                          <span className="text-[9px] text-slate-600 font-semibold block mt-0.5">
                                            {b.acuseFechaEntrega ? formatFechaDisplay(b.acuseFechaEntrega) : (b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : '')} {b.acuseHoraEntrega ? `(${b.acuseHoraEntrega})` : ''}
                                          </span>
                                        )}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRecibidoModal(b)}
                                        className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 text-amber-900 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                                        title="Clic para colocar nombre de quién recibió con fecha y hora"
                                      >
                                        <Edit3 className="w-2.5 h-2.5 text-amber-700" />
                                        <span>+ Quién recibió</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                    No devuelta
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* ACCIONES (FIJO A LA DERECHA - VISIBLE SIEMPRE SIN TENER QUE DESLIZAR) */}
                        <td className="py-2 px-2 text-center border border-slate-300 whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.15)] select-none">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditBoleta(b)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title="Modificar boleta"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteBoleta(b.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Eliminar boleta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {b.finDePagina && (
                        <tr key={`salto-pag-${b.id}`} className="bg-amber-100/90 border-y-2 border-dashed border-amber-500 text-amber-950 print:hidden">
                          <td colSpan={18} className="py-2.5 px-4 font-bold text-xs text-center">
                            <div className="flex flex-wrap items-center justify-center gap-3">
                              <span className="text-base">📄</span>
                              <span>
                                Salto de página manual: La página finaliza en la boleta <strong>#{b.numeroItem}</strong> ({b.notificadoCitado}) e inicia una nueva página física.
                              </span>
                              {onToggleFinDePagina && (
                                <button
                                  type="button"
                                  onClick={() => onToggleFinDePagina(b.id)}
                                  className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border border-rose-300 rounded-lg text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                                  title="Deshacer este corte manual de página"
                                >
                                  <span>✕ Deshacer Corte de Página</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  };

                  if (agruparPorFecha && gruposPorFecha && gruposPorFecha.length > 0) {
                    return (
                      <>
                        {gruposPorFecha.map(([fechaKey, boletasGrupo]) => (
                          <React.Fragment key={`grupo-fecha-${fechaKey}`}>
                            {/* Fila Encabezado de la Fecha - Destacada e Institucional */}
                            <tr className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white border-y-2 border-blue-400 sticky top-0 z-10 shadow-xs">
                              <td colSpan={18} className="py-2.5 px-3">
                                <div className="flex flex-wrap items-center justify-between gap-2.5">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-200 shrink-0" />
                                    <span className="font-black text-xs uppercase tracking-wider">
                                      {fechaKey === 'SIN_FECHA' ? 'BOLETAS SIN FECHA REGISTRADA' : `LISTADO POR FECHA: ${formatFechaDisplay(fechaKey)}`}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-black border border-white/30 shadow-2xs">
                                      {boletasGrupo.length} {boletasGrupo.length === 1 ? 'boleta' : 'boletas'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handlePrintGrupoFecha(fechaKey, boletasGrupo)}
                                      className="px-3 py-1 bg-white hover:bg-slate-100 text-[#004BB4] rounded-lg font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors border border-blue-200"
                                      title={`Imprimir únicamente el listado del ${formatFechaDisplay(fechaKey)} (${boletasGrupo.length} boletas)`}
                                    >
                                      <Printer className="w-3.5 h-3.5 text-[#004BB4]" />
                                      <span>Imprimir este Listado ({boletasGrupo.length})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ids = boletasGrupo.map(b => b.id);
                                        setSelectedBoletaIds(prev => Array.from(new Set([...prev, ...ids])));
                                      }}
                                      className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
                                      title="Seleccionar todas las boletas de esta fecha"
                                    >
                                      ✓ Seleccionar ({boletasGrupo.length})
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Boletas de esta fecha */}
                            {boletasGrupo.map((b, gIdx) => renderBoletaRow(b, gIdx))}
                          </React.Fragment>
                        ))}
                      </>
                    );
                  }

                  if (selectedHojaFilter === null) {
                    const totalCols = dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS' ? 19 : 18;
                    return (
                      <>
                        {hojasCalculadas.map((hoja) => {
                          const isHojaSelectedAll = (hoja.boletas || []).length > 0 && (hoja.boletas || []).every(b => selectedBoletaIds.includes(b.id));

                          return (
                            <React.Fragment key={`hoja-group-${hoja.numeroHoja}-${hoja.idHoja}`}>
                              {/* SEPARADOR OFICIAL DE HOJA FÍSICA (30 BOLETAS POR FOLIO) */}
                              <tr
                                id={`hoja-separador-${hoja.numeroHoja}`}
                                className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white border-y-2 border-blue-400/60 sticky top-0 z-10 shadow-md transition-all duration-300"
                              >
                                <td colSpan={totalCols} className="py-2.5 px-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2.5 py-1 rounded-md bg-white text-[#004BB4] font-black text-xs shadow-xs flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-[#004BB4]" />
                                        <span>HOJA {hoja.numeroHoja}</span>
                                      </span>

                                      <span className="font-mono text-xs font-black text-white bg-white/20 px-2 py-0.5 rounded border border-white/30">
                                        [{hoja.idHoja}]
                                      </span>

                                      <span className="text-slate-200 font-semibold text-xs">
                                        Ítems <strong className="text-white font-mono">{hoja.rangoItems.desde} al {hoja.rangoItems.hasta}</strong> ({hoja.cantidad} boletas)
                                      </span>

                                      {hoja.fechaAsignacion && (
                                        <span className="text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                                          📅 Asig: {formatFechaDisplay(hoja.fechaAsignacion)}
                                        </span>
                                      )}

                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                          hoja.estaLlena
                                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                            : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                        }`}
                                      >
                                        {hoja.cantidad}/30 boletas {hoja.estaLlena ? '✓ Llena' : `(Restan ${hoja.capacidad - hoja.cantidad})`}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {/* Seleccionar Hoja */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const hojaIds = hoja.boletas.map(b => b.id);
                                          if (isHojaSelectedAll) {
                                            setSelectedBoletaIds(prev => prev.filter(id => !hojaIds.includes(id)));
                                          } else {
                                            setSelectedBoletaIds(prev => Array.from(new Set([...prev, ...hojaIds])));
                                          }
                                        }}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                                        title={isHojaSelectedAll ? 'Deseleccionar boletas de esta hoja' : 'Seleccionar las boletas de esta hoja'}
                                      >
                                        {isHojaSelectedAll ? 'Deseleccionar' : `Sel. Hoja (${hoja.cantidad})`}
                                      </button>

                                      {/* Aislar esta hoja */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedHojaFilter(hoja.numeroHoja);
                                          setModoVistaHojas('hoja_individual');
                                        }}
                                        className="px-2 py-0.5 bg-indigo-900 hover:bg-indigo-800 text-indigo-200 border border-indigo-500/60 rounded text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                                        title={`Ver únicamente la Hoja ${hoja.numeroHoja}`}
                                      >
                                        Ver sólo esta hoja
                                      </button>

                                      {/* Imprimir Hoja */}
                                      <button
                                        type="button"
                                        onClick={() => handlePrintSingleHoja(hoja)}
                                        className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                                        title={`Imprimir en PDF Hoja ${hoja.numeroHoja} [${hoja.idHoja}]`}
                                      >
                                        <Printer className="w-3 h-3 text-indigo-200" />
                                        <span>Imprimir Hoja</span>
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {/* Boletas de esta hoja */}
                              {hoja.boletas.map((b, bIdx) => renderBoletaRow(b, bIdx))}

                              {/* Indicador de límite si la hoja aún no está llena */}
                              {!hoja.estaLlena && (
                                <tr className="bg-amber-50/70 border-b-2 border-dashed border-amber-300">
                                  <td
                                    colSpan={totalCols}
                                    className="py-1.5 px-4 text-center text-amber-900 font-bold text-xs"
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                      <span>
                                        Fin de Hoja {hoja.numeroHoja} [{hoja.idHoja}]: {hoja.cantidad} de 30 boletas trabajadas (quedan {hoja.capacidad - hoja.cantidad} espacios disponibles para completar la hoja).
                                      </span>
                                      {onToggleFinDePagina && hoja.boletas.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => onToggleFinDePagina(hoja.boletas[hoja.boletas.length - 1].id)}
                                          className="ml-2 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-400 cursor-pointer shadow-xs"
                                        >
                                          {hoja.boletas[hoja.boletas.length - 1].finDePagina ? '↩️ Deshacer fin de página' : '📄 Cerrar hoja aquí'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </>
                    );
                  }

                  return (
                    <>
                      {/* Cabecera de la hoja individual seleccionada */}
                      {currentHojaObj && (
                        <tr className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white border-y-2 border-blue-400/60 sticky top-0 z-10 shadow-md">
                          <td colSpan={dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS' ? 19 : 18} className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-1 rounded-md bg-white text-[#004BB4] font-black text-xs shadow-xs flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-[#004BB4]" />
                                  <span>HOJA {currentHojaObj.numeroHoja} DE {hojasCalculadas.length}</span>
                                </span>
                                <span className="font-mono text-xs font-black text-white bg-white/20 px-2 py-0.5 rounded border border-white/30">
                                  [{currentHojaObj.idHoja}]
                                </span>
                                <span className="text-slate-200 font-semibold text-xs">
                                  Ítems <strong className="text-white font-mono">{currentHojaObj.rangoItems.desde} al {currentHojaObj.rangoItems.hasta}</strong> ({currentHojaObj.cantidad} boletas)
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                    currentHojaObj.estaLlena
                                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                      : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                                  }`}
                                >
                                  {currentHojaObj.cantidad}/30 boletas {currentHojaObj.estaLlena ? '✓ Llena' : `(Restan ${currentHojaObj.capacidad - currentHojaObj.cantidad})`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedHojaFilter(null);
                                    setModoVistaHojas('todas_con_separadores');
                                  }}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded text-xs font-bold cursor-pointer transition-colors"
                                >
                                  📜 Ver Todas con Separadores
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintSingleHoja(currentHojaObj)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                                >
                                  <Printer className="w-3.5 h-3.5 text-indigo-200" />
                                  <span>Imprimir Hoja</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {boletasAMostrarEnTabla.map((b, idx) => renderBoletaRow(b, idx))}
                    </>
                  );
                })()
              )}

              {/* Indicador de límite de página cuando se está filtrando una página en modo 'solo' */}
              {selectedHojaFilter !== null && hojaFilterMode === 'solo' && currentHojaObj && !currentHojaObj.estaLlena && (
                <tr className="bg-amber-50/60 border-t-2 border-dashed border-amber-300">
                  <td colSpan={dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS' ? 19 : 18} className="py-2.5 px-4 text-center text-amber-900 font-bold text-xs">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>
                        Límite de la Página {selectedHojaFilter} [{currentHojaObj.idHoja}]: 30 boletas físicas reglamentarias. (Se han trabajado {currentHojaObj.cantidad} de 30; quedan {currentHojaObj.capacidad - currentHojaObj.cantidad} espacios disponibles para completar la página).
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {selectedHojaFilter !== null && hojaFilterMode === 'solo' && currentHojaObj && currentHojaObj.estaLlena && (
                <tr className="bg-emerald-50/60 border-t-2 border-emerald-400">
                  <td colSpan={dependenciaActiva === 'SECRETARIA' || dependenciaActiva === 'TODAS' ? 19 : 18} className="py-2.5 px-4 text-center text-emerald-900 font-bold text-xs">
                    ✓ Límite completado: Página {selectedHojaFilter} [{currentHojaObj.idHoja}] llena con sus 30 boletas reglamentarias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Impresión y Selección de Hojas */}
      <ImprimirHojasModal
        isOpen={isImprimirHojasOpen}
        onClose={() => setIsImprimirHojasOpen(false)}
        boletas={boletasFiltradas}
        config={config}
        filtroTribunal={selectedTribunal}
        idInicial={idInicialUAC}
      />

      {/* Modal de Impresión de Hoja de Ruta Compartida o Individual */}
      <ImprimirRutaCompartidaModal
        isOpen={isRutaCompartidaModalOpen}
        onClose={() => setIsRutaCompartidaModalOpen(false)}
        boletas={boletas.filter(b => (selectedSeccion === 'TODAS' || (b.seccionRuta || 'RUTA_NOTIFICACION_CITACION') === selectedSeccion))}
        alguaciles={alguaciles}
        config={config}
        esSobreseimiento={selectedSeccion === 'SOBRESEIMIENTO'}
        esSecretaria={dependenciaActiva === 'SECRETARIA' || sesionActual?.rol === 'SECRETARIA'}
        tituloRuta={
          selectedSeccion === 'SOBRESEIMIENTO' 
            ? 'Ruta de Notificación de Sobreseimiento' 
            : (dependenciaActiva === 'SECRETARIA' || sesionActual?.rol === 'SECRETARIA')
            ? 'Hoja de Ruta de Notificación - Secretaría'
            : undefined
        }
        hojaActualNumero={selectedHojaFilter || 1}
        onActualizarAsignaciones={(actualizadas) => {
          if (onUpdateBoletasAsignadas) {
            onUpdateBoletasAsignadas(actualizadas);
          }
        }}
      />

      {/* Modal para Crear o Renombrar Sección de Trabajo */}
      <ModalCrearSeccionTrabajo
        isOpen={isModalCrearSeccionOpen}
        onClose={() => {
          setIsModalCrearSeccionOpen(false);
          setSeccionAEditar(null);
        }}
        seccionAEditar={seccionAEditar}
        onEliminarSeccion={handleEliminarSeccion}
        onGuardar={handleSaveNuevaSeccion}
        onSaveSeccion={handleSaveNuevaSeccion}
        seccionesExistentes={[...Object.values(SECCIONES_INFO), ...(seccionesCustom || [])]}
      />

      {/* Modal para Formato de Resulta en Físico */}
      <FormatoResultaModal
        isOpen={isResultaModalOpen}
        onClose={() => {
          setIsResultaModalOpen(false);
          setBoletaParaResulta(null);
        }}
        boleta={boletaParaResulta}
        alguaciles={alguaciles}
        config={config}
      />

      {/* Modal para Registrar / Editar quién recibió en Tribunal con Fecha y Hora */}
      {modalRecibidoBoleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 text-white">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">
                    Recibida en Tribunal por
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Boleta Nº <span className="font-mono font-bold text-amber-300">{modalRecibidoBoleta.boletaNumero}</span> • Causa: <span className="font-mono">{modalRecibidoBoleta.numeroCausa}</span> • Tribunal: <span className="font-bold">{modalRecibidoBoleta.tribunal}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRecibidoBoleta(null)}
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Notificado / Citado info pill */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Persona Citada / Notificada</span>
                  <span className="font-bold text-slate-900">{modalRecibidoBoleta.notificadoCitado}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Alguacil que Practicó</span>
                  <span className="font-bold text-slate-800">{modalRecibidoBoleta.alguacilPractica || '(Sin asignar)'}</span>
                </div>
              </div>

              {/* Nombre de quien recibió */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nombre y Apellido de quien Recibió <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    value={modalRecibidoNombre}
                    onChange={(e) => setModalRecibidoNombre(e.target.value)}
                    placeholder="Ej: Abg. María Gómez - Secretaria de Sala"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRecibidoModal();
                      if (e.key === 'Escape') setModalRecibidoBoleta(null);
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Indique el nombre completo de la persona, secretaria o funcionario que recibió la resulta en el tribunal.
                </p>
              </div>

              {/* Grid: Fecha y Hora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Fecha de Recepción</span>
                  </label>
                  <input
                    type="date"
                    value={modalRecibidoFecha}
                    onChange={(e) => setModalRecibidoFecha(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Hora de Recepción</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalRecibidoHora(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Hora actual
                    </button>
                  </div>
                  <input
                    type="text"
                    value={modalRecibidoHora}
                    onChange={(e) => setModalRecibidoHora(e.target.value)}
                    placeholder="Ej: 10:30 AM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opciones rápidas */}
              {modalRecibidoBoleta.acuseRecibidoPor && (
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModalRecibidoNombre('');
                      setModalRecibidoHora('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold hover:underline cursor-pointer"
                  >
                    Limpiar datos de recepción
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalRecibidoBoleta(null)}
                className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRecibidoModal}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Receptor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
