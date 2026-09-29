import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Building2, 
  Calendar, 
  User, 
  Scale, 
  FileText, 
  Check, 
  Plus, 
  MapPin, 
  Save, 
  Zap,
  UserCheck,
  Clock
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ArticuloCOPP, 
  TipoCitado,
  SeccionRuta,
  SeccionTrabajoInfo,
  TIPOS_CITADO_OPTIONS,
  validarRequisitosDevuelta,
  detectCaracterFromText
} from '../types/judicial';

interface BoletaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boleta: Partial<BoletaJudicial>, keepOpen?: boolean) => void;
  onOpenBatchMode?: () => void;
  initialData?: BoletaJudicial | null;
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  proximoNumeroItem: number;
  mesRutaActual: string;
  seccionesCustom?: SeccionTrabajoInfo[];
  dependenciaActiva?: 'NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS';
  responsableActual?: string;
}

export const BoletaFormModal: React.FC<BoletaFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onOpenBatchMode,
  initialData,
  tribunales,
  alguaciles,
  proximoNumeroItem,
  seccionesCustom = [],
  dependenciaActiva = 'NOTIFICACION_CITACION',
  responsableActual = '',
}) => {
  const causaInputRef = useRef<HTMLInputElement>(null);

  // Secciones combinadas
  const allCustomSections = React.useMemo(() => {
    let local: SeccionTrabajoInfo[] = [];
    try {
      const stored = localStorage.getItem('uac_secciones_personalizadas');
      if (stored) local = JSON.parse(stored);
    } catch {}
    const map = new Map<string, SeccionTrabajoInfo>();
    local.forEach(s => map.set(s.codigo, s));
    seccionesCustom.forEach(s => map.set(s.codigo, s));
    return Array.from(map.values());
  }, [seccionesCustom, isOpen]);

  // Estados simples
  const [numeroCausa, setNumeroCausa] = useState('');
  const [boletaNumero, setBoletaNumero] = useState('');
  const [numeroOficio, setNumeroOficio] = useState('');
  const [responsableRelacion, setResponsableRelacion] = useState(responsableActual);
  const [dependencia, setDependencia] = useState<'NOTIFICACION_CITACION' | 'SECRETARIA'>('NOTIFICACION_CITACION');
  const [notificadoCitado, setNotificadoCitado] = useState('');
  const [tipoCitado, setTipoCitado] = useState<TipoCitado>('IMPUTADO');
  const [esSoloNotificacion, setEsSoloNotificacion] = useState(true);
  const [fechaAudiencia, setFechaAudiencia] = useState('NOTIFICACION');
  const [horaAudiencia, setHoraAudiencia] = useState('');
  const [fechaAsignacion, setFechaAsignacion] = useState(initialData?.fechaAsignacion || new Date().toISOString().slice(0, 10));
  const [tribunal, setTribunal] = useState(tribunales[0]?.codigo || 'C1');
  const [tribunalOtro, setTribunalOtro] = useState('');
  const [seccionRuta, setSeccionRuta] = useState<SeccionRuta>('RUTA_NOTIFICACION_CITACION');
  const [articuloCOPP, setArticuloCOPP] = useState<ArticuloCOPP>('');
  const [articulosCOPP, setArticulosCOPP] = useState<ArticuloCOPP[]>([]);
  const [alguacilPractica, setAlguacilPractica] = useState('');
  const [devueltaAlTribunal, setDevueltaAlTribunal] = useState(false);
  const [acuseRecibidoPor, setAcuseRecibidoPor] = useState('');
  const [acuseFechaEntrega, setAcuseFechaEntrega] = useState('');
  const [acuseHoraEntrega, setAcuseHoraEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialData) {
      setNumeroCausa(initialData.numeroCausa || '');
      setBoletaNumero(initialData.boletaNumero || '');
      setNumeroOficio(initialData.numeroOficio || '');
      setResponsableRelacion(initialData.responsableRelacion || responsableActual || '');
      setDependencia(initialData.dependencia || (dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION'));
      setNotificadoCitado(initialData.notificadoCitado || '');
      setTipoCitado(initialData.tipoCitado || 'IMPUTADO');
      setEsSoloNotificacion(initialData.esSoloNotificacion || initialData.fechaAudiencia === 'NOTIFICACION');
      setFechaAudiencia(initialData.fechaAudiencia === 'NOTIFICACION' ? '' : initialData.fechaAudiencia || '');
      setHoraAudiencia(initialData.horaAudiencia || '');
      setFechaAsignacion(initialData.fechaAsignacion || new Date().toISOString().slice(0, 10));
      setTribunal(initialData.tribunal || (tribunales[0]?.codigo || 'C1'));
      setTribunalOtro(initialData.tribunalOtro || '');
      setSeccionRuta(initialData.seccionRuta || 'RUTA_NOTIFICACION_CITACION');
      setArticuloCOPP(initialData.articuloCOPP || '');
      setArticulosCOPP(initialData.articulosCOPP || (initialData.articuloCOPP ? [initialData.articuloCOPP] : []));
      setAlguacilPractica(initialData.alguacilPractica || '');
      setDevueltaAlTribunal(!!initialData.devueltaAlTribunal);
      setAcuseRecibidoPor(initialData.acuseRecibidoPor || '');
      setAcuseFechaEntrega(initialData.acuseFechaEntrega || initialData.fechaDevueltaTribunal || '');
      setAcuseHoraEntrega(initialData.acuseHoraEntrega || '');
      setObservaciones(initialData.observaciones || '');
    } else {
      setNumeroCausa('');
      setBoletaNumero('');
      setNumeroOficio('');
      setResponsableRelacion(responsableActual || '');
      setDependencia(dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION');
      setNotificadoCitado('');
      setTipoCitado('IMPUTADO');
      setEsSoloNotificacion(true);
      setFechaAudiencia('NOTIFICACION');
      setHoraAudiencia('');
      setFechaAsignacion(new Date().toISOString().slice(0, 10));
      setTribunal(tribunales[0]?.codigo || 'C1');
      setTribunalOtro('');
      setSeccionRuta('RUTA_NOTIFICACION_CITACION');
      setArticuloCOPP('');
      setArticulosCOPP([]);
      setAlguacilPractica('');
      setDevueltaAlTribunal(false);
      setAcuseRecibidoPor('');
      setAcuseFechaEntrega('');
      setAcuseHoraEntrega('');
      setObservaciones('');
    }
    setErrorMsg('');
  }, [initialData, alguaciles, isOpen, dependenciaActiva, responsableActual]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => causaInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleArticulo = (art: ArticuloCOPP) => {
    let next: ArticuloCOPP[];
    if (articulosCOPP.includes(art)) {
      next = articulosCOPP.filter(a => a !== art);
    } else {
      if (articulosCOPP.length >= 2) {
        next = [articulosCOPP[articulosCOPP.length - 1], art];
      } else {
        next = [...articulosCOPP, art];
      }
    }
    setArticulosCOPP(next);
    setArticuloCOPP(next[0] || '');

    // Si ya no quedan artículos, no puede permanecer Devuelta al Tribunal
    if (next.length === 0 && devueltaAlTribunal) {
      setDevueltaAlTribunal(false);
    }
  };

  const handleSubmit = (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!numeroCausa.trim()) {
      setErrorMsg('Por favor ingresa el Nº de Causa');
      return;
    }
    if (!boletaNumero.trim()) {
      setErrorMsg('Por favor ingresa el Nº de Boleta');
      return;
    }
    if (!notificadoCitado.trim()) {
      setErrorMsg('Por favor ingresa el nombre de la persona');
      return;
    }

    if (devueltaAlTribunal) {
      const check = validarRequisitosDevuelta({
        articuloCOPP,
        articulosCOPP,
        alguacilPractica,
      });
      if (!check.puedeSerDevuelta) {
        setErrorMsg(check.mensajeError);
        return;
      }
    }

    const payload: Partial<BoletaJudicial> = {
      numeroItem: initialData ? initialData.numeroItem : proximoNumeroItem,
      numeroCausa: numeroCausa.trim().toUpperCase(),
      boletaNumero: boletaNumero.trim(),
      numeroOficio: numeroOficio.trim() ? numeroOficio.trim().toUpperCase() : undefined,
      dependencia: dependencia,
      responsableRelacion: responsableRelacion.trim() || responsableActual || undefined,
      notificadoCitado: notificadoCitado.trim().toUpperCase(),
      tipoCitado,
      esSoloNotificacion,
      fechaAudiencia: esSoloNotificacion ? 'NOTIFICACION' : fechaAudiencia,
      horaAudiencia: esSoloNotificacion ? undefined : (horaAudiencia.trim() || undefined),
      fechaAsignacion: fechaAsignacion || initialData?.fechaAsignacion || new Date().toISOString().slice(0, 10),
      tribunal,
      tribunalOtro: tribunal === 'OTRO' ? (tribunalOtro.trim() || undefined) : undefined,
      seccionRuta,
      articuloCOPP: articulosCOPP[0] || articuloCOPP || '',
      articulosCOPP: articulosCOPP.length > 0 ? articulosCOPP : (articuloCOPP ? [articuloCOPP] : []),
      alguacilPractica: alguacilPractica || '',
      devueltaAlTribunal: devueltaAlTribunal,
      fechaDevueltaTribunal: devueltaAlTribunal ? (acuseFechaEntrega || initialData?.fechaDevueltaTribunal || new Date().toISOString().slice(0, 10)) : undefined,
      acuseRecibidoPor: devueltaAlTribunal ? (acuseRecibidoPor.trim() || undefined) : undefined,
      acuseFechaEntrega: devueltaAlTribunal ? (acuseFechaEntrega || undefined) : undefined,
      acuseHoraEntrega: devueltaAlTribunal ? (acuseHoraEntrega.trim() || undefined) : undefined,
      acuseGenerado: devueltaAlTribunal ? (!!acuseRecibidoPor.trim() || initialData?.acuseGenerado) : false,
      observaciones: observaciones.trim() || undefined,
      estado: devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : (initialData?.estado === 'DEVUELTA_TRIBUNAL' ? 'ASIGNADA' : (initialData?.estado || 'ASIGNADA')),
    };

    onSave(payload, keepOpen);

    if (keepOpen) {
      // El número de boleta y oficio deben permanecer en blanco para la siguiente
      setBoletaNumero('');
      setNumeroOficio('');
      setNotificadoCitado('');
      setObservaciones('');
      setTimeout(() => causaInputRef.current?.focus(), 50);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Cabecera limpia */}
        <div className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white px-6 py-4 flex items-center justify-between border-b border-blue-400/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {initialData ? 'Modificar Registro Judicial' : 'Registrar en el Sistema'}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  dependencia === 'SECRETARIA'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/20 text-white border-white/30'
                }`}>
                  {dependencia === 'SECRETARIA' ? 'Secretaría (Oficios)' : 'Notificación y Citación'}
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {initialData ? `Item #${initialData.numeroItem} - Causa ${initialData.numeroCausa}` : 'Completa los datos de la causa y actuación'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!initialData && onOpenBatchMode && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatchMode();
                }}
                className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Cargar varias boletas seguidas en una tabla"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Modo Rápido</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensaje de error si falta algo */}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2 text-xs font-bold text-rose-700">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Barra de Persona Responsable de la Unidad (Titular del Login) */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-6 py-2 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Responsable de la Unidad (Relaciona):</span>
            <strong className="text-slate-900">{responsableRelacion || responsableActual || 'Titular del Login'}</strong>
          </div>
          {dependenciaActiva === 'TODAS' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Dependencia:</span>
              <select
                value={dependencia}
                onChange={(e) => setDependencia(e.target.value as any)}
                className="text-[11px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5"
              >
                <option value="NOTIFICACION_CITACION">Notif. y Citación</option>
                <option value="SECRETARIA">Secretaría (Oficios)</option>
              </select>
            </div>
          )}
        </div>

        {/* Formulario Limpio */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* 1. Tribunal y Causa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tribunal: *
              </label>
              <select
                value={tribunal}
                onChange={(e) => setTribunal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {tribunales.map((t) => (
                  <option key={t.id} value={t.codigo}>
                    {t.codigo} ({t.nombre})
                  </option>
                ))}
              </select>
              {tribunal === 'OTRO' && (
                <div className="mt-2">
                  <label className="block text-[11px] font-extrabold text-amber-900 mb-1">
                    Especifique el Tribunal: *
                  </label>
                  <input
                    type="text"
                    value={tribunalOtro}
                    onChange={(e) => setTribunalOtro(e.target.value.toUpperCase())}
                    placeholder="ej. J5 MERIDA, CORTE MERIDA, J5 TACHIRA, C5 STA BARBARA"
                    className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                    required
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nº de Causa (Expediente): *
              </label>
              <input
                ref={causaInputRef}
                type="text"
                value={numeroCausa}
                onChange={(e) => setNumeroCausa(e.target.value)}
                placeholder="ej. LP11-P-2026-000456"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* 2. Boleta Nº, N° de Oficio (Secretaría) y Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Boleta Nº: *
              </label>
              <input
                type="text"
                value={boletaNumero}
                onChange={(e) => setBoletaNumero(e.target.value)}
                placeholder="ej. 018 o S/N"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            {/* Campo N° de Oficio para el rol Secretario (a) */}
            {(dependencia === 'SECRETARIA' || numeroOficio || dependenciaActiva === 'SECRETARIA') ? (
              <div className="sm:col-span-1">
                <label className="block text-xs font-black text-emerald-800 mb-1 flex items-center gap-1">
                  <span>Nº de Oficio:</span>
                  <span className="text-[10px] text-emerald-600 font-bold">(Secretaría)</span>
                </label>
                <input
                  type="text"
                  value={numeroOficio}
                  onChange={(e) => setNumeroOficio(e.target.value)}
                  placeholder="ej. 045-2026"
                  className="w-full px-3 py-2 bg-emerald-50 border border-emerald-400 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            ) : null}

            <div className={dependencia === 'SECRETARIA' || numeroOficio || dependenciaActiva === 'SECRETARIA' ? 'sm:col-span-1' : 'sm:col-span-2'}>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Persona a Notificar / Citar: *
              </label>
              <input
                type="text"
                value={notificadoCitado}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setNotificadoCitado(val);
                  const detected = detectCaracterFromText(val);
                  if (detected.detectedTipo) {
                    setTipoCitado(detected.detectedTipo);
                  }
                }}
                placeholder="Nombre completo o institución"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* 3. Carácter, Fecha de Asignación, Audiencia y Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha de Asignación:
              </label>
              <input
                type="date"
                value={fechaAsignacion}
                onChange={(e) => setFechaAsignacion(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Carácter de la Persona:
              </label>
              <select
                value={tipoCitado}
                onChange={(e) => setTipoCitado(e.target.value as TipoCitado)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {TIPOS_CITADO_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Fecha y Hora de Audiencia:
                </label>
                <label className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esSoloNotificacion}
                    onChange={(e) => setEsSoloNotificacion(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Solo Notificación</span>
                </label>
              </div>

              {!esSoloNotificacion ? (
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="date"
                    value={fechaAudiencia}
                    onChange={(e) => setFechaAudiencia(e.target.value)}
                    className="col-span-3 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={horaAudiencia}
                    onChange={(e) => setHoraAudiencia(e.target.value)}
                    placeholder="Hora"
                    className="col-span-2 w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold text-center">
                  NOTIFICACIÓN (Sin audiencia)
                </div>
              )}
            </div>
          </div>

          {/* 4. Sección de Ruta, Alguacil y Artículo COPP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sección / Ruta:
              </label>
              <select
                value={seccionRuta}
                onChange={(e) => setSeccionRuta(e.target.value as SeccionRuta)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <optgroup label="Secciones del Sistema">
                  <option value="RUTA_NOTIFICACION_CITACION">1. RUTA NOTIF. Y CITACIÓN</option>
                  <option value="CORREO_EXT">2. CORREO EXT.</option>
                  <option value="RUTA_INTERNA">3. RUTA INTERNA</option>
                  <option value="OTROS_ESTADOS_MERIDA">4. OTROS ESTADOS Y MÉRIDA</option>
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
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alguacil:
              </label>
              <select
                value={alguacilPractica}
                onChange={(e) => {
                  const val = e.target.value;
                  setAlguacilPractica(val);
                  const check = validarRequisitosDevuelta({
                    articuloCOPP,
                    articulosCOPP,
                    alguacilPractica: val,
                  });
                  if (!check.puedeSerDevuelta && devueltaAlTribunal) {
                    setDevueltaAlTribunal(false);
                  }
                }}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="">Sin Asignar (Pendiente)</option>
                {alguaciles.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Artículos COPP:
                </label>
                <span className="text-[10px] text-indigo-700 font-semibold">
                  (Hasta 2)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('167')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('167')
                      ? 'bg-[#8f9ca8] text-slate-950 ring-2 ring-slate-800 shadow-sm scale-105'
                      : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 167 (Personal)"
                >
                  167
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('168')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('168')
                      ? 'bg-[#5c98e2] text-slate-950 ring-2 ring-blue-700 shadow-sm scale-105'
                      : 'bg-white hover:bg-blue-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 168 (Víctima/Expertos)"
                >
                  168
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('169')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('169')
                      ? 'bg-[#8ea8be] text-slate-950 ring-2 ring-sky-700 shadow-sm scale-105'
                      : 'bg-white hover:bg-sky-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 169 (Telemática/Correo)"
                >
                  169
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('170')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('170')
                      ? 'bg-[#9dce64] text-slate-950 ring-2 ring-lime-700 shadow-sm scale-105'
                      : 'bg-white hover:bg-lime-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 170 (Militares/Policías)"
                >
                  170
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('171')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('171')
                      ? 'bg-[#e7444b] text-slate-950 ring-2 ring-red-700 shadow-sm scale-105'
                      : 'bg-white hover:bg-red-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 171 (Cartel/Edictos)"
                >
                  171
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('165')}
                  className={`flex-1 min-w-[38px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('165')
                      ? 'bg-[#fce444] text-slate-950 ring-2 ring-yellow-600 shadow-sm scale-105'
                      : 'bg-white hover:bg-yellow-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. 165 (Notificación)"
                >
                  165
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArticulo('S_165')}
                  className={`flex-1 min-w-[42px] py-1.5 px-1 rounded-lg font-black text-xs transition-all cursor-pointer text-center ${
                    articulosCOPP.includes('S_165')
                      ? 'bg-[#df7a40] text-slate-950 ring-2 ring-orange-700 shadow-sm scale-105'
                      : 'bg-white hover:bg-orange-100 text-slate-700 border border-slate-300'
                  }`}
                  title="Art. S 165 (Notificación Especial)"
                >
                  S 165
                </button>
                {articulosCOPP.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setArticulosCOPP([]);
                      setArticuloCOPP('');
                      if (devueltaAlTribunal) {
                        setDevueltaAlTribunal(false);
                      }
                    }}
                    className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer"
                    title="Limpiar artículos"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 5. ¿Ya está Devuelta al Tribunal? */}
          {(() => {
            const req = validarRequisitosDevuelta({
              articuloCOPP,
              articulosCOPP,
              alguacilPractica,
            });

            return (
              <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                req.puedeSerDevuelta ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 block">
                      ¿La boleta ya fue practicada y devuelta al Tribunal?
                    </span>
                    {!req.puedeSerDevuelta && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
                        Requiere Artículo y Alguacil
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-indigo-700 block mt-0.5">
                    {req.puedeSerDevuelta
                      ? 'Márcalo si el alguacil ya consignó el resultado'
                      : req.mensajeError.replace(/\n/g, ' ')}
                  </span>
                </div>
                <label className={`relative inline-flex items-center ${req.puedeSerDevuelta ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    disabled={!req.puedeSerDevuelta}
                    checked={devueltaAlTribunal}
                    onChange={(e) => {
                      if (!req.puedeSerDevuelta) {
                        setErrorMsg(req.mensajeError);
                        return;
                      }
                      setErrorMsg(null);
                      setDevueltaAlTribunal(e.target.checked);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:width-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            );
          })()}

          {/* 5.1 Datos de Recepción en Tribunal (RECIBIDA POR) - Solo si ya fue devuelta al Tribunal */}
          {devueltaAlTribunal && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="text-xs font-extrabold text-blue-950 uppercase tracking-wide">
                  RECIBIDA EN TRIBUNAL POR (FECHA Y HORA)
                </span>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre de quien Recibió en el Tribunal:
                </label>
                <input
                  type="text"
                  value={acuseRecibidoPor}
                  onChange={(e) => {
                    setAcuseRecibidoPor(e.target.value);
                    if (e.target.value.trim() && !acuseFechaEntrega) {
                      setAcuseFechaEntrega(new Date().toISOString().slice(0, 10));
                    }
                    if (e.target.value.trim() && !acuseHoraEntrega) {
                      setAcuseHoraEntrega(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
                    }
                  }}
                  placeholder="Ej: Abg. María Gómez - Secretaria / Funcionario receptor"
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>Fecha de Recepción:</span>
                  </label>
                  <input
                    type="date"
                    value={acuseFechaEntrega}
                    onChange={(e) => setAcuseFechaEntrega(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <span>Hora de Recepción:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAcuseHoraEntrega(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer"
                    >
                      Hora actual
                    </button>
                  </div>
                  <input
                    type="text"
                    value={acuseHoraEntrega}
                    onChange={(e) => setAcuseHoraEntrega(e.target.value)}
                    placeholder="Ej: 10:30 AM"
                    className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. Observaciones (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Observaciones (Opcional):
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas breves, dirección, etc."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </form>

        {/* Botones de acción inferiores */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {!initialData && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar y Agregar Otra</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            className="px-5 py-2 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{initialData ? 'Guardar Cambios' : 'Guardar Boleta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
