import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Send, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Download, 
  Plus, 
  Search, 
  Zap, 
  BarChart3, 
  Layers, 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  AlertCircle,
  Users,
  ShieldCheck,
  Calendar,
  X,
  Printer,
  ChevronRight,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { 
  BoletaJudicial, 
  ConfiguracionDespacho, 
  Alguacil, 
  TribunalInfo,
  TipoCitado,
  TIPOS_CITADO_OPTIONS,
  getCaracterDisplay,
  validarRequisitosDevuelta,
  toggleArticuloBoleta
} from '../types/judicial';
import { 
  TRIBUNALES_MERIDA_OTROS_SUGERIDOS, 
  calcularEstadisticasMeridaOtros 
} from '../data/meridaOtrosData';
import { 
  exportarAcusesUnificadosMeridaPDF, 
  exportarEstadisticasMeridaPDF 
} from '../utils/exportPDF';
import { 
  exportarAcusesUnificadosMeridaExcel, 
  copiarBoletasParaExcel 
} from '../utils/exportExcel';
import { formatFechaDisplay } from '../utils/alerts';

interface MeridaOtrosViewProps {
  boletas: BoletaJudicial[];
  alguaciles: Alguacil[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
  onUpdateBoleta: (boleta: BoletaJudicial) => void;
  onAddBoleta: (boleta: Omit<BoletaJudicial, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteBoleta: (id: string) => void;
  onOpenBatchMode?: () => void;
  onVolverPrincipal?: () => void;
}

export const MeridaOtrosView: React.FC<MeridaOtrosViewProps> = ({
  boletas,
  alguaciles,
  config,
  onUpdateBoleta,
  onAddBoleta,
  onDeleteBoleta,
  onOpenBatchMode,
  onVolverPrincipal,
}) => {
  // Pestañas internas de la sección
  const [subTab, setSubTab] = useState<'boletas' | 'acuses' | 'stats'>('boletas');

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTribunal, setFiltroTribunal] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODAS' | 'PRACTICADAS' | 'DEVUELTAS' | 'PENDIENTES'>('TODAS');

  // Estado de copiado
  const [copied, setCopied] = useState(false);

  // Formulario rápido de adición en la sección Mérida / Otros
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTribunal, setQuickTribunal] = useState('1º CONTROL MÉRIDA');
  const [customTribunalInput, setCustomTribunalInput] = useState('');
  const [isCustomTribunal, setIsCustomTribunal] = useState(false);
  const [quickCausa, setQuickCausa] = useState('');
  const [quickBoleta, setQuickBoleta] = useState('');
  const [quickNombre, setQuickNombre] = useState('');
  const [quickTipoCitado, setQuickTipoCitado] = useState<TipoCitado>('IMPUTADO');
  const [quickEsNotificacion, setQuickEsNotificacion] = useState(false);
  const [quickFechaAudiencia, setQuickFechaAudiencia] = useState('');
  const [quickArticulo, setQuickArticulo] = useState<'167' | '168' | '169' | '170' | '171' | '165' | 'S 165'>('167');
  const [quickAlguacil, setQuickAlguacil] = useState('');

  // Modal de registro rápido de acuse (individual o por fila)
  const [editingAcuseBoleta, setEditingAcuseBoleta] = useState<BoletaJudicial | null>(null);
  const [acuseRecibidoPor, setAcuseRecibidoPor] = useState('');
  const [acuseFechaEntrega, setAcuseFechaEntrega] = useState(new Date().toISOString().slice(0, 10));
  const [acuseHoraEntrega, setAcuseHoraEntrega] = useState('10:00 AM');
  const [acuseObservaciones, setAcuseObservaciones] = useState('');

  // Boletas filtradas que pertenecen exclusivamente a OTROS_ESTADOS_MERIDA
  const boletasMerida = useMemo(() => {
    return (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');
  }, [boletas]);

  // En la sección de Mérida / Otros todas la boleta prácticada y devuelta deben de salir en acuses de OTROS
  const boletasAcusesMerida = useMemo(() => {
    return boletasMerida.filter(b => b.estado === 'PRACTICADA' || !!b.devueltaAlTribunal);
  }, [boletasMerida]);

  // Estadísticas calculadas en tiempo real
  const stats = useMemo(() => {
    return calcularEstadisticasMeridaOtros(boletas);
  }, [boletas]);

  // Lista de tribunales foráneos únicos presentes en los datos
  const tribunalesForaneosPresentes = useMemo(() => {
    const setT = new Set<string>();
    boletasMerida.forEach(b => {
      if (b.tribunal && b.tribunal.trim()) {
        setT.add(b.tribunal.trim().toUpperCase());
      }
    });
    return Array.from(setT).sort();
  }, [boletasMerida]);

  // Boletas filtradas según los controles de búsqueda
  const boletasFiltradas = useMemo(() => {
    return boletasMerida.filter(b => {
      // Búsqueda por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchCausa = (b.numeroCausa || '').toLowerCase().includes(term);
        const matchBoleta = (b.boletaNumero || '').toLowerCase().includes(term);
        const matchNombre = (b.notificadoCitado || '').toLowerCase().includes(term);
        const matchTribunal = (b.tribunal || '').toLowerCase().includes(term);
        const matchAlguacil = (b.alguacilPractica || '').toLowerCase().includes(term);
        if (!matchCausa && !matchBoleta && !matchNombre && !matchTribunal && !matchAlguacil) {
          return false;
        }
      }

      // Filtro por Tribunal
      if (filtroTribunal !== 'TODOS') {
        if ((b.tribunal || '').toUpperCase() !== filtroTribunal.toUpperCase()) {
          return false;
        }
      }

      // Filtro por Estado
      if (filtroEstado === 'PRACTICADAS') {
        return b.estado === 'PRACTICADA' || b.devueltaAlTribunal;
      }
      if (filtroEstado === 'DEVUELTAS') {
        return !!b.devueltaAlTribunal;
      }
      if (filtroEstado === 'PENDIENTES') {
        return !b.devueltaAlTribunal;
      }

      return true;
    });
  }, [boletasMerida, searchTerm, filtroTribunal, filtroEstado]);

  // Manejar creación rápida de boleta foránea
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCausa.trim() || !quickBoleta.trim() || !quickNombre.trim()) {
      alert('Por favor completa Nº de Causa, Boleta y Nombre de la persona');
      return;
    }

    const tribunalFinal = (isCustomTribunal ? customTribunalInput : quickTribunal).trim().toUpperCase();
    if (!tribunalFinal) {
      alert('Por favor indica el Tribunal o Despacho de origen');
      return;
    }

    // Calcular siguiente item correlativo
    const maxItem = boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem || 0)) : 0;

    onAddBoleta({
      numeroItem: maxItem + 1,
      numeroCausa: quickCausa.trim().toUpperCase(),
      boletaNumero: quickBoleta.trim(),
      notificadoCitado: quickNombre.trim().toUpperCase(),
      tipoCitado: quickTipoCitado,
      esSoloNotificacion: quickEsNotificacion,
      fechaAudiencia: quickEsNotificacion ? 'NOTIFICACION' : (quickFechaAudiencia || 'NOTIFICACION'),
      fechaAsignacion: new Date().toISOString().slice(0, 10),
      tribunal: tribunalFinal,
      articuloCOPP: quickArticulo,
      articulosCOPP: [quickArticulo],
      seccionRuta: 'OTROS_ESTADOS_MERIDA',
      alguacilPractica: quickAlguacil.trim().toUpperCase(),
      estado: quickAlguacil ? 'ASIGNADA' : 'ASIGNADA',
      devueltaAlTribunal: false,
      mesRuta: config.mesRutaActual,
    });

    // Resetear formulario manteniendo tribunal si se desea
    setQuickCausa('');
    setQuickBoleta('');
    setQuickNombre('');
    setShowQuickAdd(false);
  };

  // Manejar apertura del modal de acuse
  const handleOpenAcuseModal = (b: BoletaJudicial) => {
    setEditingAcuseBoleta(b);
    setAcuseRecibidoPor(b.acuseRecibidoPor || '');
    setAcuseFechaEntrega(b.acuseFechaEntrega || new Date().toISOString().slice(0, 10));
    setAcuseHoraEntrega(b.acuseHoraEntrega || '10:30 AM');
    setAcuseObservaciones(b.acuseObservaciones || '');
  };

  // Guardar acuse en la boleta
  const handleSaveAcuse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAcuseBoleta) return;

    const updated: BoletaJudicial = {
      ...editingAcuseBoleta,
      acuseRecibidoPor: acuseRecibidoPor.trim().toUpperCase(),
      acuseFechaEntrega: acuseFechaEntrega,
      acuseHoraEntrega: acuseHoraEntrega.trim(),
      acuseObservaciones: acuseObservaciones.trim(),
      acuseGenerado: true,
      updatedAt: new Date().toISOString(),
    };

    onUpdateBoleta(updated);
    setEditingAcuseBoleta(null);
  };

  // Alternar estado devuelta al tribunal con validación
  const handleToggleDevuelta = (b: BoletaJudicial) => {
    if (!b.devueltaAlTribunal) {
      const check = validarRequisitosDevuelta(b);
      if (!check.puedeSerDevuelta) {
        alert(check.mensajeError);
        return;
      }
      onUpdateBoleta({
        ...b,
        devueltaAlTribunal: true,
        fechaDevueltaTribunal: new Date().toISOString().slice(0, 10),
        estado: 'PRACTICADA',
        updatedAt: new Date().toISOString(),
      });
    } else {
      onUpdateBoleta({
        ...b,
        devueltaAlTribunal: false,
        fechaDevueltaTribunal: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Copiar al portapapeles
  const handleCopiarPortapapeles = async () => {
    const ok = await copiarBoletasParaExcel(boletasFiltradas);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert('No se pudo copiar automáticamente al portapapeles');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* 1. BANNER PRINCIPAL DE LA SECCIÓN MÉRIDA Y OTROS ESTADOS */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-amber-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider">
                Sección 4
              </span>
              <span className="text-amber-200 text-xs font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Despachos Foráneos y Ciudad Capital
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Mérida y Otros Estados</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                {boletasMerida.length} {boletasMerida.length === 1 ? 'Causa' : 'Causas'}
              </span>
            </h1>
            <p className="text-xs text-amber-100/80 max-w-2xl">
              Control consolidado de boletas procedentes de tribunales de Mérida Capital, otros Circuitos Judiciales del país y exhortos foráneos. Incluye acuses unificados multitribunal y estadísticas independientes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onVolverPrincipal && (
              <button
                onClick={onVolverPrincipal}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Regresar a la Lista Principal de El Vigía"
              >
                <span>← Lista El Vigía</span>
              </button>
            )}

            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{showQuickAdd ? 'Cerrar Registro' : 'Agregar Boleta Foránea'}</span>
            </button>

            {onOpenBatchMode && (
              <button
                onClick={onOpenBatchMode}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-amber-600/40"
                title="Cargar varias boletas seguidas o pegar desde Excel"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Carga Masiva</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Sub-Pestañas de Mérida / Otros */}
        <div className="mt-5 pt-3 border-t border-amber-700/40 flex flex-wrap gap-2">
          <button
            onClick={() => setSubTab('boletas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'boletas'
                ? 'bg-white text-slate-900 shadow-sm font-black'
                : 'bg-amber-950/40 text-amber-200 hover:bg-amber-950/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Listado de Boletas</span>
            <span className="px-1.5 py-0.2 rounded bg-black/15 text-[11px]">
              {boletasMerida.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('acuses')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'acuses'
                ? 'bg-white text-slate-900 shadow-sm font-black'
                : 'bg-amber-950/40 text-amber-200 hover:bg-amber-950/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Acuses Unificados (Multitribunal)</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-700 text-white text-[11px] font-bold">
              {stats.conAcuse} / {stats.totalBoletas}
            </span>
          </button>

          <button
            onClick={() => setSubTab('stats')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'stats'
                ? 'bg-white text-slate-900 shadow-sm font-black'
                : 'bg-amber-950/40 text-amber-200 hover:bg-amber-950/70'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>3. Estadísticas de Mérida / Otros</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
              {stats.porcentajeEfectividad}% Efec.
            </span>
          </button>
        </div>
      </div>

      {/* 2. FORMULARIO DE REGISTRO RÁPIDO PARA MÉRIDA / OTROS */}
      {showQuickAdd && (
        <form 
          onSubmit={handleQuickAddSubmit}
          className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm animate-in fade-in"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-600 text-white font-bold">
                <Plus className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase">
                  Registrar Causa en Mérida / Otros Estados
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ingresa el tribunal o despacho de origen y los datos de la diligencia
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Tribunal de Origen */}
            <div className="sm:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Tribunal de Origen: *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomTribunal(!isCustomTribunal)}
                  className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                >
                  {isCustomTribunal ? 'Elegir de lista sugerida' : '+ Escribir otro tribunal'}
                </button>
              </div>

              {isCustomTribunal ? (
                <input
                  type="text"
                  value={customTribunalInput}
                  onChange={(e) => setCustomTribunalInput(e.target.value)}
                  placeholder="ej. TRIBUNAL 2º JUICIO BARINAS / EXHORTO ZULIA"
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              ) : (
                <select
                  value={quickTribunal}
                  onChange={(e) => setQuickTribunal(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                >
                  {TRIBUNALES_MERIDA_OTROS_SUGERIDOS.map(t => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.codigo} ({t.nombre})
                    </option>
                  ))}
                  {tribunalesForaneosPresentes
                    .filter(t => !TRIBUNALES_MERIDA_OTROS_SUGERIDOS.some(s => s.codigo === t))
                    .map(t => (
                      <option key={t} value={t}>
                        {t} (Ya registrado)
                      </option>
                    ))
                  }
                </select>
              )}
            </div>

            {/* Causa */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nº de Causa Penal: *
              </label>
              <input
                type="text"
                value={quickCausa}
                onChange={(e) => setQuickCausa(e.target.value)}
                placeholder="ej. LP11-P-2026-000789"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Boleta */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Boleta Nº: *
              </label>
              <input
                type="text"
                value={quickBoleta}
                onChange={(e) => setQuickBoleta(e.target.value)}
                placeholder="ej. 045"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Carácter */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Carácter:
              </label>
              <select
                value={quickTipoCitado}
                onChange={(e) => setQuickTipoCitado(e.target.value as TipoCitado)}
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                {TIPOS_CITADO_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre Citado */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nombre de la Persona Notificada / Citada: *
              </label>
              <input
                type="text"
                value={quickNombre}
                onChange={(e) => setQuickNombre(e.target.value)}
                placeholder="Nombre, Apellido o Cargo de la persona"
                className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              />
            </div>

            {/* Audiencia o Notificación */}
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Audiencia / Tipo:
                </label>
                <label className="text-[10px] text-slate-600 flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickEsNotificacion}
                    onChange={(e) => setQuickEsNotificacion(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600"
                  />
                  <span>Solo Notif.</span>
                </label>
              </div>
              {quickEsNotificacion ? (
                <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 text-center">
                  NOTIFICACIÓN
                </div>
              ) : (
                <input
                  type="date"
                  value={quickFechaAudiencia}
                  onChange={(e) => setQuickFechaAudiencia(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              )}
            </div>

            {/* Artículo COPP */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Art. COPP:
              </label>
              <select
                value={quickArticulo}
                onChange={(e) => setQuickArticulo(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="167">167 (Personal)</option>
                <option value="168">168 (Víctima)</option>
                <option value="169">169 (Organismo)</option>
                <option value="170">170 (Fuerza)</option>
                <option value="171">171 (Fijada)</option>
                <option value="165">165 (Simple)</option>
                <option value="S 165">S 165</option>
              </select>
            </div>

            {/* Alguacil */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Alguacil:
              </label>
              <select
                value={quickAlguacil}
                onChange={(e) => setQuickAlguacil(e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="">Sin Asignar</option>
                {alguaciles.map(a => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en Mérida / Otros</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. VISTAS SEGÚN LA PESTAÑA SELECCIONADA */}

      {/* ========================================================
          SUBTAB 1: LISTADO DE BOLETAS DE MÉRIDA / OTROS
          ======================================================== */}
      {subTab === 'boletas' && (
        <div className="space-y-3">
          {/* Controles de Filtros y Búsqueda */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Buscador */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar causa, boleta, persona, tribunal..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro por Tribunal Foráneo */}
              <select
                value={filtroTribunal}
                onChange={(e) => setFiltroTribunal(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white cursor-pointer"
              >
                <option value="TODOS">Todos los Tribunales ({boletasMerida.length})</option>
                {tribunalesForaneosPresentes.map(t => {
                  const cant = boletasMerida.filter(b => (b.tribunal || '').toUpperCase() === t).length;
                  return (
                    <option key={t} value={t}>
                      {t} ({cant})
                    </option>
                  );
                })}
              </select>

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                {(['TODAS', 'PRACTICADAS', 'DEVUELTAS', 'PENDIENTES'] as const).map(est => (
                  <button
                    key={est}
                    onClick={() => setFiltroEstado(est)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      filtroEstado === est
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {est === 'TODAS' ? 'Todas' : est === 'PRACTICADAS' ? 'Practicadas' : est === 'DEVUELTAS' ? 'Devueltas' : 'Pendientes'}
                  </button>
                ))}
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopiarPortapapeles}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Copiar las filas filtradas para pegar directamente en Excel con Ctrl+V"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={() => exportarAcusesUnificadosMeridaExcel(boletasMerida, config)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="Descargar todas las boletas de Mérida y Otros en Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              <button
                onClick={() => exportarAcusesUnificadosMeridaPDF(boletasMerida, config)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="Descargar Listado Unificado Oficial en PDF con todos los tribunales"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Unificado</span>
              </button>
            </div>
          </div>

          {/* Tabla de Boletas */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {boletasFiltradas.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-amber-500/50 mx-auto" />
                <h3 className="text-sm font-black text-slate-800">
                  No hay boletas que coincidan en Mérida / Otros Estados
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {boletasMerida.length === 0 
                    ? 'Aún no has agregado boletas en esta sección. Pulsa "Agregar Boleta Foránea" o utiliza "Carga Masiva".'
                    : 'Intenta cambiar el filtro de búsqueda o el tribunal seleccionado.'}
                </p>
                {boletasMerida.length === 0 && (
                  <button
                    onClick={() => setShowQuickAdd(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Primera Boleta Foránea</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase text-[11px] tracking-wider">
                      <th className="py-2.5 px-3 w-12 text-center">Nº</th>
                      <th className="py-2.5 px-3">Tribunal de Origen</th>
                      <th className="py-2.5 px-3">Nº Causa</th>
                      <th className="py-2.5 px-3 text-center">Boleta</th>
                      <th className="py-2.5 px-3">Persona Notificada / Citada</th>
                      <th className="py-2.5 px-3 text-center">Audiencia</th>
                      <th className="py-2.5 px-3 text-center">Art. COPP</th>
                      <th className="py-2.5 px-3">Alguacil</th>
                      <th className="py-2.5 px-3 text-center">Devuelta</th>
                      <th className="py-2.5 px-3 text-center">Acuse</th>
                      <th className="py-2.5 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {boletasFiltradas.map((b, idx) => {
                      const tieneAcuse = !!(b.acuseRecibidoPor && b.acuseRecibidoPor.trim() !== '');
                      const esDev = !!b.devueltaAlTribunal;
                      const artText = b.articulosCOPP && b.articulosCOPP.length > 0 
                        ? b.articulosCOPP.join(', ')
                        : (b.articuloCOPP || '-');

                      return (
                        <tr key={b.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2 px-3 text-center font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-amber-900">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                              <span className="truncate max-w-[180px]" title={b.tribunal}>
                                {b.tribunal || 'FORÁNEO'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {b.numeroCausa}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50">
                            {b.boletaNumero}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            <div>
                              <div>{b.notificadoCitado}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                {getCaracterDisplay(b.tipoCitado)}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {b.esSoloNotificacion ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">
                                Notif.
                              </span>
                            ) : (
                              <span className="font-mono text-slate-800">
                                {formatFechaDisplay(b.fechaAudiencia)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-black text-[11px]">
                              {artText}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={b.alguacilPractica || ''}
                              onChange={(e) => onUpdateBoleta({
                                ...b,
                                alguacilPractica: e.target.value,
                                updatedAt: new Date().toISOString(),
                              })}
                              className="px-2 py-1 bg-slate-50 hover:bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="">Sin Asignar</option>
                              {alguaciles.map(a => (
                                <option key={a.id} value={a.nombre}>
                                  {a.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleToggleDevuelta(b)}
                              className={`px-2 py-1 rounded text-xs font-black cursor-pointer transition-colors ${
                                esDev
                                  ? 'bg-blue-700 hover:bg-blue-800 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                              title={esDev ? `Devuelta el ${formatFechaDisplay(b.fechaDevueltaTribunal)}` : 'Hacer clic para marcar como DEVUELTA'}
                            >
                              {esDev ? 'SÍ' : 'NO'}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleOpenAcuseModal(b)}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 mx-auto ${
                                tieneAcuse
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                              }`}
                              title={tieneAcuse ? `Recibido por: ${b.acuseRecibidoPor}` : 'Registrar datos de acuse'}
                            >
                              {tieneAcuse ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  <span>Recibido</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>Pendiente</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenAcuseModal(b)}
                                className="p-1 rounded text-slate-400 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                                title="Registrar / Modificar Acuse"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar la boleta #${b.boletaNumero} de la causa ${b.numeroCausa}?`)) {
                                    onDeleteBoleta(b.id);
                                  }
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                title="Eliminar Boleta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
        </div>
      )}

      {/* ========================================================
          SUBTAB 2: ACUSES UNIFICADOS (TODOS LOS TRIBUNALES EN 1 SOLO LISTADO)
          ======================================================== */}
      {subTab === 'acuses' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Tarjeta explicativa que responde exactamente a la petición del usuario */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 rounded-xl p-4 text-white border border-emerald-800/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-black text-[10px] uppercase">
                Listado Unificado Multitribunal
              </span>
              <h2 className="text-base md:text-lg font-black text-white">
                Acuses Consolidados de Mérida y Otros Despachos
              </h2>
              <p className="text-xs text-emerald-100/80 max-w-2xl">
                En esta sección no se dividen las causas tribunal por tribunal. Todas las boletas foráneas se descargan y gestionan en <strong>un solo listado continuo</strong>, conteniendo los datos de recepción, funcionario que recibe y número de oficio para su remisión oficial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportarAcusesUnificadosMeridaExcel(boletasAcusesMerida, config)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Excel Acuses</span>
              </button>

              <button
                onClick={() => exportarAcusesUnificadosMeridaPDF(boletasAcusesMerida, config, 'imprimir')}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Imprime directamente del sistema sin necesidad de descargar primero y ofrece opción de descarga"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                <span>Imprimir / Descargar Acuses (PDF)</span>
              </button>
            </div>
          </div>

          {/* Métricas rápidas de acuses */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block uppercase">
                Total Boletas en Listado
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {stats.totalBoletas}
              </span>
              <span className="text-[10px] text-slate-400">
                {stats.desglosePorTribunal.length} {stats.desglosePorTribunal.length === 1 ? 'tribunal foráneo' : 'tribunales foráneos'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 block uppercase">
                Con Acuse Registrado
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {stats.conAcuse}
              </span>
              <span className="text-[10px] text-emerald-600/80 font-bold">
                {stats.totalBoletas > 0 ? Math.round((stats.conAcuse / stats.totalBoletas) * 100) : 0}% con receptor
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 block uppercase">
                Pendientes de Acuse
              </span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {stats.pendientesAcuse}
              </span>
              <span className="text-[10px] text-amber-600/80">
                En diligencia o en camino
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 block uppercase">
                Devueltas a Origen
              </span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">
                {stats.devueltas}
              </span>
              <span className="text-[10px] text-blue-600/80 font-bold">
                {stats.porcentajeDevueltas}% concluidas
              </span>
            </div>
          </div>

          {/* Tabla de Acuses Unificados */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-black text-slate-900 uppercase">
                  Relación de Acuses y Entrega • Mérida y Despachos Foráneos
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Mostrando todas las causas en 1 solo listado
              </span>
            </div>

            {boletasAcusesMerida.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay boletas practicadas ni devueltas en la sección Mérida / Otros para incluir en acuses.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white border-b border-slate-700 text-[11px] font-bold uppercase">
                      <th className="py-2.5 px-3 w-10 text-center">Nº</th>
                      <th className="py-2.5 px-3">Tribunal de Origen</th>
                      <th className="py-2.5 px-3">Causa / Boleta</th>
                      <th className="py-2.5 px-3">Persona Citada / Notificada</th>
                      <th className="py-2.5 px-3">Alguacil</th>
                      <th className="py-2.5 px-3">Resulta</th>
                      <th className="py-2.5 px-3">Receptor / Sello en Despacho</th>
                      <th className="py-2.5 px-3 text-center">Fecha y Hora</th>
                      <th className="py-2.5 px-3 text-center">Devuelta</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {boletasAcusesMerida.map((b, idx) => {
                      const tieneAcuse = !!(b.acuseRecibidoPor && b.acuseRecibidoPor.trim() !== '');
                      const esDev = !!b.devueltaAlTribunal;

                      return (
                        <tr key={b.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2 px-3 text-center font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-amber-950">
                            {b.tribunalOtro || b.tribunal || 'FORÁNEO'}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            <div className="font-bold text-slate-900">{b.numeroCausa}</div>
                            <div className="text-[10px] text-indigo-700 font-bold">Bol: {b.boletaNumero}</div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">{b.notificadoCitado}</div>
                            <div className="text-[10px] text-slate-500">{getCaracterDisplay(b.tipoCitado)}</div>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-700">
                            {b.alguacilPractica || <span className="text-slate-400 italic">Sin Asignar</span>}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              b.estado === 'PRACTICADA' || b.devueltaAlTribunal
                                ? 'bg-emerald-100 text-emerald-900'
                                : (b.estado === 'NO_PRACTICADA' ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-800')
                            }`}>
                              {b.estado === 'PRACTICADA' || b.devueltaAlTribunal ? 'PRACTICADA' : (b.estado === 'NO_PRACTICADA' ? 'NO PRACT.' : 'EN TRÁMITE')}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {tieneAcuse ? (
                              <div className="font-bold text-emerald-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{b.acuseRecibidoPor}</span>
                              </div>
                            ) : (
                              <span className="text-amber-700 italic text-[11px] font-semibold">
                                Pendiente por asentar
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">
                            {b.acuseFechaEntrega ? (
                              <div>
                                <div>{formatFechaDisplay(b.acuseFechaEntrega)}</div>
                                <div className="text-[10px] text-slate-400">{b.acuseHoraEntrega || ''}</div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              esDev ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {esDev ? 'SÍ' : 'NO'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleOpenAcuseModal(b)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-800 hover:text-emerald-900 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{tieneAcuse ? 'Editar' : 'Registrar'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUBTAB 3: ESTADÍSTICAS EXCLUSIVAS DE MÉRIDA / OTROS
          ======================================================== */}
      {subTab === 'stats' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Header de Estadísticas */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                Módulo Estadístico Exclusivo
              </span>
              <h2 className="text-base md:text-lg font-black text-slate-900 mt-1">
                Estadísticas de Causas Foráneas • Mérida y Otros Circuitos
              </h2>
              <p className="text-xs text-slate-500">
                Métricas independientes calculadas sobre los tribunales de origen externos, separadas de los 12 tribunales locales de El Vigía.
              </p>
            </div>

            <button
              onClick={() => exportarEstadisticasMeridaPDF(boletasMerida, config)}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors cursor-pointer shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Informe Estadístico (PDF)</span>
            </button>
          </div>

          {/* Tarjetas KPIs Principales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Boletas</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{stats.totalBoletas}</span>
              <span className="text-[11px] text-slate-400">100% de la sección</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase block">Practicadas</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{stats.practicadas}</span>
              <span className="text-[11px] text-emerald-600 font-bold">{stats.porcentajeEfectividad}% efectividad</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 uppercase block">Devueltas</span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">{stats.devueltas}</span>
              <span className="text-[11px] text-blue-600 font-bold">{stats.porcentajeDevueltas}% con retorno</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase block">Pendientes</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">{stats.pendientesDevuelta}</span>
              <span className="text-[11px] text-amber-600 font-bold">Por devolver</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 md:col-span-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase block">Tribunales</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">{stats.desglosePorTribunal.length}</span>
              <span className="text-[11px] text-purple-600 font-bold">Despachos externos</span>
            </div>
          </div>

          {/* Tabla 1: Desglose por Tribunal Foráneo */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  1. Rendimiento Detallado por Tribunal Foráneo
                </h3>
              </div>
              <span className="text-[11px] text-slate-300">
                {stats.desglosePorTribunal.length} Despachos atendidos
              </span>
            </div>

            {stats.desglosePorTribunal.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay tribunales foráneos registrados todavía.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-bold uppercase">
                      <th className="py-2.5 px-3">Tribunal / Despacho de Origen</th>
                      <th className="py-2.5 px-3 text-center">Total Boletas</th>
                      <th className="py-2.5 px-3 text-center">Practicadas</th>
                      <th className="py-2.5 px-3 text-center">Devueltas</th>
                      <th className="py-2.5 px-3 text-center">Pendientes</th>
                      <th className="py-2.5 px-3 text-center">Con Acuse</th>
                      <th className="py-2.5 px-3 text-right">Efectividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stats.desglosePorTribunal.map(t => (
                      <tr key={t.tribunal} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                          <span>{t.tribunal}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {t.total}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/50">
                          {t.practicadas}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-700 bg-blue-50/50">
                          {t.devueltas}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                          {t.pendientesDevuelta}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                          {t.conAcuse} / {t.total}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-600 h-full rounded-full" 
                                style={{ width: `${t.porcentajeEfectividad}%` }} 
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-900 w-10 text-right">
                              {t.porcentajeEfectividad}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabla 2 y 3: Desglose por Alguacil y Artículos COPP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Por Alguacil */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black uppercase">
                    2. Alguaciles que Practicaron
                  </h3>
                </div>
              </div>
              <div className="p-3">
                {stats.desglosePorAlguacil.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">Sin registros</div>
                ) : (
                  <div className="space-y-2">
                    {stats.desglosePorAlguacil.map(a => (
                      <div key={a.alguacil} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                        <span className="font-bold text-slate-800">{a.alguacil}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">Total: <strong>{a.total}</strong></span>
                          <span className="text-emerald-700 font-bold">Pract: {a.practicadas}</span>
                          <span className="text-blue-700 font-bold">Dev: {a.devueltas}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 font-mono font-black text-[10px]">
                            {a.porcentaje}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Artículos COPP */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-black uppercase">
                    3. Artículos COPP Aplicados
                  </h3>
                </div>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(stats.desgloseArticulos).map(([art, cant]) => (
                    <div key={art} className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-black text-slate-800">Art. {art}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-black">
                        {cant} {cant === 1 ? 'boleta' : 'boletas'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE REGISTRO RÁPIDO DE ACUSE DE RECEPCIÓN
          ======================================================== */}
      {editingAcuseBoleta && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">
                  Registrar Acuse de Recepción
                </h3>
                <p className="text-xs text-slate-300">
                  Causa: {editingAcuseBoleta.numeroCausa} • Bol #{editingAcuseBoleta.boletaNumero}
                </p>
              </div>
              <button
                onClick={() => setEditingAcuseBoleta(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAcuse} className="p-5 space-y-3.5 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-950">
                <span className="font-bold block">Tribunal de Origen:</span>
                <span className="text-sm font-black">{editingAcuseBoleta.tribunal}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre y Cargo del Receptor en el Despacho / Correo: *
                </label>
                <input
                  type="text"
                  value={acuseRecibidoPor}
                  onChange={(e) => setAcuseRecibidoPor(e.target.value)}
                  placeholder="ej. ABG. MARÍA GÓMEZ (SECRETARIA) / RECEPTORÍA POSTAL"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fecha de Entrega / Retorno:
                  </label>
                  <input
                    type="date"
                    value={acuseFechaEntrega}
                    onChange={(e) => setAcuseFechaEntrega(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Hora:
                  </label>
                  <input
                    type="text"
                    value={acuseHoraEntrega}
                    onChange={(e) => setAcuseHoraEntrega(e.target.value)}
                    placeholder="ej. 10:30 AM"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Oficio / Observaciones del Acuse:
                </label>
                <textarea
                  value={acuseObservaciones}
                  onChange={(e) => setAcuseObservaciones(e.target.value)}
                  placeholder="ej. Entregado con Oficio de Remisión Nº 142-2026. Recibido conforme con sello húmedo."
                  rows={2}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAcuseBoleta(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm"
                >
                  Guardar Acuse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
