import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Printer, 
  FileText, 
  Send, 
  CheckCircle2, 
  Clock, 
  Layers, 
  CheckSquare, 
  Square, 
  ArrowRightLeft, 
  Scale, 
  Calendar,
  Building2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Search
} from 'lucide-react';
import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ConfiguracionDespacho,
  ArticuloCOPP,
  getCaracterDisplay
} from '../types/judicial';
import { formatFechaDisplay, evaluarAlertaBoleta } from '../utils/alerts';
import { exportarHojaRutaAlguacilPDF } from '../utils/exportPDF';

interface EnrutamientoAlguacilesViewProps {
  boletas: BoletaJudicial[];
  alguaciles: Alguacil[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
  onUpdateBoletas: (updated: BoletaJudicial[]) => void;
  onOpenNewBoletaForAlguacil?: (alguacilNombre: string) => void;
  onNavigateToAcuses?: (tribunalCode: string, boletaIds?: string[]) => void;
}

export const EnrutamientoAlguacilesView: React.FC<EnrutamientoAlguacilesViewProps> = ({
  boletas,
  alguaciles,
  tribunales,
  config,
  onUpdateBoletas,
  onOpenNewBoletaForAlguacil,
  onNavigateToAcuses,
}) => {
  const [selectedAlguacilName, setSelectedAlguacilName] = useState<string>(alguaciles[0]?.nombre || 'ELISET');
  const [filterEstado, setFilterEstado] = useState<'PENDIENTES' | 'PRACTICADAS' | 'DEVUELTAS' | 'TODAS'>('PENDIENTES');
  const [selectedBoletaIds, setSelectedBoletaIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modales rápidos de acción en lote
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [nuevoAlguacilDestino, setNuevoAlguacilDestino] = useState(alguaciles[1]?.nombre || alguaciles[0]?.nombre || '');
  
  const [showRecibirUACModal, setShowRecibirUACModal] = useState(false);
  const [fechaReciboUAC, setFechaReciboUAC] = useState(new Date().toISOString().slice(0, 10));

  // Boletas filtradas por alguacil seleccionado
  const boletasAlguacil = useMemo(() => {
    return boletas.filter(b => b.alguacilPractica?.toUpperCase() === selectedAlguacilName.toUpperCase());
  }, [boletas, selectedAlguacilName]);

  // Métricas del alguacil
  const totalAsignadas = boletasAlguacil.length;
  const pendientesPractica = boletasAlguacil.filter(b => !b.devueltaAlTribunal && !b.fechaRecibidoUAC).length;
  const practicadasEnUAC = boletasAlguacil.filter(b => !b.devueltaAlTribunal && !!b.fechaRecibidoUAC).length;
  const yaDevueltas = boletasAlguacil.filter(b => b.devueltaAlTribunal).length;

  // Boletas mostradas según el filtro y búsqueda
  const boletasFiltradas = useMemo(() => {
    let list = boletasAlguacil;

    if (filterEstado === 'PENDIENTES') {
      list = list.filter(b => !b.devueltaAlTribunal && !b.fechaRecibidoUAC);
    } else if (filterEstado === 'PRACTICADAS') {
      list = list.filter(b => !b.devueltaAlTribunal && !!b.fechaRecibidoUAC);
    } else if (filterEstado === 'DEVUELTAS') {
      list = list.filter(b => b.devueltaAlTribunal);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(b => 
        b.numeroCausa.toLowerCase().includes(term) ||
        b.boletaNumero.toLowerCase().includes(term) ||
        b.notificadoCitado.toLowerCase().includes(term) ||
        b.tribunal.toLowerCase().includes(term) ||
        (b.direccionCitacion && b.direccionCitacion.toLowerCase().includes(term))
      );
    }

    return list;
  }, [boletasAlguacil, filterEstado, searchTerm]);

  // Manejo de selecciones
  const toggleSelectBoleta = (id: string) => {
    setSelectedBoletaIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllVisibles = () => {
    setSelectedBoletaIds(boletasFiltradas.map(b => b.id));
  };

  const clearSelection = () => {
    setSelectedBoletaIds([]);
  };

  // Generar Hoja de Ruta Oficial en PDF para imprimir y entregar al alguacil
  const handleExportarHojaRutaPDF = () => {
    const boletasAImprimir = selectedBoletaIds.length > 0
      ? boletasAlguacil.filter(b => selectedBoletaIds.includes(b.id))
      : boletasFiltradas;

    if (boletasAImprimir.length === 0) {
      alert('No hay boletas seleccionadas o en lista para generar la hoja de ruta.');
      return;
    }

    exportarHojaRutaAlguacilPDF(
      selectedAlguacilName,
      boletasAImprimir,
      config,
      new Date().toISOString().slice(0, 10)
    );
  };

  // Reasignar lote a otro alguacil
  const handleReasignarLote = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBoletaIds.length === 0 || !nuevoAlguacilDestino) return;

    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        return {
          ...b,
          alguacilPractica: nuevoAlguacilDestino,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
    setShowReasignarModal(false);
  };

  // Recibir boletas practicadas en UAC (cuando el alguacil vuelve de la calle/diligencia)
  const handleRecibirEnUAC = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBoletaIds.length === 0) return;

    const updated = boletas.map(b => {
      if (selectedBoletaIds.includes(b.id)) {
        return {
          ...b,
          fechaRecibidoUAC: fechaReciboUAC,
          estado: 'PRACTICADA' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });

    onUpdateBoletas(updated);
    setSelectedBoletaIds([]);
    setShowRecibirUACModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Selector de Alguaciles */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Enrutamiento y Asignación por Alguacil
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Selecciona un funcionario para generar su hoja de ruta física de salida o asentar diligencias
          </p>
        </div>

        {/* Tarjetas de Alguaciles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {alguaciles.map(a => {
            const isSelected = selectedAlguacilName.toUpperCase() === a.nombre.toUpperCase();
            const totalAlg = boletas.filter(b => b.alguacilPractica?.toUpperCase() === a.nombre.toUpperCase()).length;
            const pendAlg = boletas.filter(b => b.alguacilPractica?.toUpperCase() === a.nombre.toUpperCase() && !b.devueltaAlTribunal && !b.fechaRecibidoUAC).length;

            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedAlguacilName(a.nombre);
                  setSelectedBoletaIds([]);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-sm ring-2 ring-indigo-500/30'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {a.nombre}
                  </span>
                  {pendAlg > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                      {pendAlg} pend
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>Total: {totalAlg}</span>
                  <span className="text-[10px] text-slate-400">{a.cargo || 'Alguacil'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen del Alguacil Seleccionado y Acciones de Ruta */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                {selectedAlguacilName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Hoja de Diligencias de: <span className="text-indigo-600">{selectedAlguacilName}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Ruta Mes: <span className="font-semibold text-slate-700">{config.mesRutaActual}</span> • {totalAsignadas} boletas asignadas en total
                </p>
              </div>
            </div>
          </div>

          {/* Botón de Impresión de Hoja de Ruta para Entrega */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportarHojaRutaPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Generar e imprimir el listado formal de boletas para que el alguacil salga a practicarlas"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja de Ruta para Alguacil (PDF)</span>
            </button>
          </div>
        </div>

        {/* Tarjetas Cuantitativas de Estado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div 
            onClick={() => setFilterEstado('PENDIENTES')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterEstado === 'PENDIENTES'
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Por Practicar (Calle/Sala)</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-900 mt-1.5">{pendientesPractica}</p>
            <p className="text-[10px] text-amber-700 mt-0.5">En mano del alguacil</p>
          </div>

          <div 
            onClick={() => setFilterEstado('PRACTICADAS')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterEstado === 'PRACTICADAS'
                ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Recibidas en UAC</span>
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-blue-900 mt-1.5">{practicadasEnUAC}</p>
            <p className="text-[10px] text-blue-700 mt-0.5">Listas para acuse al tribunal</p>
          </div>

          <div 
            onClick={() => setFilterEstado('DEVUELTAS')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterEstado === 'DEVUELTAS'
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Devueltas a Tribunal</span>
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-900 mt-1.5">{yaDevueltas}</p>
            <p className="text-[10px] text-emerald-700 mt-0.5">Concluidas con oficio</p>
          </div>

          <div 
            onClick={() => setFilterEstado('TODAS')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              filterEstado === 'TODAS'
                ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Total Asignadas</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1.5">{totalAsignadas}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Todas las órdenes del mes</p>
          </div>
        </div>

        {/* Barra de Filtros de Lista y Acciones Masivas */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar causa, boleta, citado, tribunal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-7 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedBoletaIds.length > 0 && (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                {selectedBoletaIds.length} seleccionada(s)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedBoletaIds.length > 0 ? (
              <>
                {/* Asignación Rápida de Artículo en Lote */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                  <Scale className="w-3.5 h-3.5 text-indigo-600" />
                  <select
                    onChange={(e) => {
                      if (e.target.value !== undefined) {
                        const art = e.target.value as ArticuloCOPP;
                        const updated = boletas.map(b => 
                          selectedBoletaIds.includes(b.id) ? { ...b, articuloCOPP: art, updatedAt: new Date().toISOString() } : b
                        );
                        onUpdateBoletas(updated);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                    title="Asignar artículo COPP a todas las boletas seleccionadas"
                  >
                    <option value="" disabled>Asignar Art. COPP...</option>
                    <option value="167">Art. 167 (Personal)</option>
                    <option value="168">Art. 168 (Víctimas/Expertos)</option>
                    <option value="169">Art. 169 (Telemática/Correo)</option>
                    <option value="170">Art. 170 (Funcionarios/Policías)</option>
                    <option value="171">Art. 171 (Cartel/Edictos)</option>
                    <option value="165">Art. 165 (Solo Notif.)</option>
                    <option value="S_165">Art. S 165 (Notif. Especial)</option>
                    <option value="">Sin Artículo (Desasignar)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRecibirUACModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Marcar Practicadas en UAC ({selectedBoletaIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const firstBoleta = boletas.find(b => selectedBoletaIds.includes(b.id));
                    if (firstBoleta && onNavigateToAcuses) {
                      onNavigateToAcuses(firstBoleta.tribunal, selectedBoletaIds);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  title="Enviar las boletas seleccionadas al apartado de Acuses del Tribunal"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar a Acuse Tribunal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReasignarModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reasignar Alguacil</span>
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Deseleccionar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={selectAllVisibles}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                <span>Seleccionar Todas ({boletasFiltradas.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Boletas del Alguacil */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1e293b] text-slate-200 font-bold border-b border-slate-700 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-10">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th className="py-3 px-3 min-w-[140px]">Nº de Causa</th>
                <th className="py-3 px-3 min-w-[80px] text-center">Boleta</th>
                <th className="py-3 px-3 w-16 text-center">Tribunal</th>
                <th className="py-3 px-3 min-w-[200px]">Persona Notificada / Citada</th>
                <th className="py-3 px-3 min-w-[150px]">Dirección / Ubicación</th>
                <th className="py-3 px-3 min-w-[110px] text-center">F. Audiencia</th>
                <th className="py-3 px-3 w-14 text-center">Art.</th>
                <th className="py-3 px-3 min-w-[120px] text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {boletasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No hay boletas asignadas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                boletasFiltradas.map((boleta) => {
                  const isSelected = selectedBoletaIds.includes(boleta.id);
                  const alerta = evaluarAlertaBoleta(boleta);

                  return (
                    <tr 
                      key={boleta.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectBoleta(boleta.id)}
                          className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {boleta.numeroCausa}
                      </td>

                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                        {boleta.boletaNumero}
                      </td>

                      <td className="py-2.5 px-3 text-center font-black text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {boleta.tribunal}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div>{boleta.notificadoCitado}</div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {getCaracterDisplay(boleta.tipoCitado)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {boleta.direccionCitacion || <span className="text-slate-400 italic">Sede tribunal / Domicilio en autos</span>}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {boleta.esSoloNotificacion ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px]">
                            Mera Notif.
                          </span>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-800">
                              {formatFechaDisplay(boleta.fechaAudiencia)}
                            </span>
                            {boleta.horaAudiencia && (
                              <div className="text-[10px] text-slate-400">{boleta.horaAudiencia}</div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-black">
                        <select
                          value={boleta.articuloCOPP || ''}
                          onChange={(e) => {
                            const newArt = e.target.value as ArticuloCOPP;
                            const updated = boletas.map(b => 
                              b.id === boleta.id ? { ...b, articuloCOPP: newArt, updatedAt: new Date().toISOString() } : b
                            );
                            onUpdateBoletas(updated);
                          }}
                          className={`text-xs font-black px-1.5 py-0.5 rounded cursor-pointer transition-all border ${
                            boleta.articuloCOPP === '167' ? 'bg-slate-600 text-white border-slate-700' :
                            boleta.articuloCOPP === '168' ? 'bg-blue-700 text-white border-blue-800' :
                            boleta.articuloCOPP === '169' ? 'bg-sky-400 text-slate-900 border-sky-500' :
                            boleta.articuloCOPP === '170' ? 'bg-emerald-500 text-white border-emerald-600' :
                            boleta.articuloCOPP === '171' ? 'bg-red-600 text-white border-red-700' :
                            boleta.articuloCOPP === '165' ? 'bg-yellow-400 text-slate-950 border-yellow-500' :
                            boleta.articuloCOPP === 'S_165' ? 'bg-orange-500 text-white border-orange-600' :
                            'bg-amber-50 text-amber-700 border-dashed border-amber-300 hover:bg-amber-100 font-bold'
                          }`}
                          title="Clic para asignar o cambiar el Artículo COPP"
                        >
                          <option value="" className="bg-white text-slate-700 font-normal">Sin Art. (+ Asignar)</option>
                          <option value="167" className="bg-white text-slate-900 font-bold">167 (Personal)</option>
                          <option value="168" className="bg-white text-blue-700 font-bold">168 (Víctimas)</option>
                          <option value="169" className="bg-white text-sky-600 font-bold">169 (Telemática)</option>
                          <option value="170" className="bg-white text-emerald-600 font-bold">170 (Policías)</option>
                          <option value="171" className="bg-white text-red-600 font-bold">171 (Cartel)</option>
                          <option value="165" className="bg-white text-yellow-600 font-bold">165 (Notificación)</option>
                          <option value="S_165" className="bg-white text-orange-600 font-bold">S 165 (Especial)</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {boleta.devueltaAlTribunal ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                              Devuelta ({formatFechaDisplay(boleta.fechaDevueltaTribunal || '')})
                            </span>
                          ) : boleta.fechaRecibidoUAC ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200">
                                Practicada en UAC
                              </span>
                              {onNavigateToAcuses && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToAcuses(boleta.tribunal, [boleta.id])}
                                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                  title="Enviar al Acuse del Tribunal"
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              alerta.nivel === 'CRITICA'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : alerta.nivel === 'URGENTE'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              En diligencia
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Reasignar Lote */}
      {showReasignarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between">
              <h4 className="font-bold text-sm">Reasignar Boletas a otro Alguacil</h4>
              <button onClick={() => setShowReasignarModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleReasignarLote} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Se reasignarán <strong>{selectedBoletaIds.length} boleta(s)</strong> de {selectedAlguacilName} hacia:
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nuevo Alguacil Asignado:</label>
                <select
                  value={nuevoAlguacilDestino}
                  onChange={(e) => setNuevoAlguacilDestino(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-indigo-700 bg-white"
                >
                  {alguaciles.map(a => (
                    <option key={a.id} value={a.nombre}>{a.nombre} {a.telefono ? `(${a.telefono})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReasignarModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Confirmar Reasignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Marcar Practicadas en UAC */}
      {showRecibirUACModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1e293b] text-white flex items-center justify-between">
              <h4 className="font-bold text-sm">Registrar Diligencia / Recibo en U.A.C.</h4>
              <button onClick={() => setShowRecibirUACModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleRecibirEnUAC} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Marcar <strong>{selectedBoletaIds.length} boleta(s)</strong> como entregadas por el alguacil en la oficina de Alguacilazgo para posterior acuse al Tribunal.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fecha de Recibido en UAC:</label>
                <input
                  type="date"
                  value={fechaReciboUAC}
                  onChange={(e) => setFechaReciboUAC(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecibirUACModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Registrar Recibido en UAC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
