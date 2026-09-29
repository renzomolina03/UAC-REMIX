import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Users,
  User,
  Sliders,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowRightLeft,
  Plus,
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  Sparkles,
  Download
} from 'lucide-react';
import { BoletaJudicial, Alguacil, ConfiguracionDespacho } from '../types/judicial';
import { exportarHojaRutaAlguacilPDF, exportarHojaRutaCompartidaMultiplesAlguacilesPDF, AsignacionAlguacilRuta, ModoSalidaDocumento } from '../utils/exportPDF';
import { calcularHojasLote, HojaLote } from '../utils/sheetCalculation';

interface ImprimirRutaCompartidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  boletas: BoletaJudicial[];
  alguaciles: Alguacil[];
  config: ConfiguracionDespacho;
  onUpdateBoletasAsignadas?: (updated: BoletaJudicial[]) => void;
  onActualizarAsignaciones?: (updated: BoletaJudicial[]) => void;
  esSobreseimiento?: boolean;
  esSecretaria?: boolean;
  tituloRuta?: string;
  hojaActualNumero?: number | null;
}

interface AlguacilSlot {
  id: string;
  alguacil: string;
  cantidad: number;
}

export const ImprimirRutaCompartidaModal: React.FC<ImprimirRutaCompartidaModalProps> = ({
  isOpen,
  onClose,
  boletas,
  alguaciles,
  config,
  onUpdateBoletasAsignadas,
  onActualizarAsignaciones,
  esSobreseimiento,
  esSecretaria,
  tituloRuta,
  hojaActualNumero,
}) => {
  const isSobreseimiento = esSobreseimiento || (boletas || []).some(b => b?.seccionRuta === 'SOBRESEIMIENTO');
  const [modo, setModo] = useState<'COMPARTIDA' | 'INDIVIDUAL'>(() => esSecretaria ? 'INDIVIDUAL' : 'COMPARTIDA');

  // Calcular las hojas del lote completo (30 boletas por hoja por defecto reglamentario)
  const todasLasHojas: HojaLote[] = useMemo(() => {
    return calcularHojasLote(boletas, 30);
  }, [boletas]);

  // Selección de hojas: 'HOJA_ACTUAL' | 'VARIAS_HOJAS' | 'TODAS'
  const [modoSeleccionHojas, setModoSeleccionHojas] = useState<'HOJA_ACTUAL' | 'VARIAS_HOJAS' | 'TODAS'>(() => {
    if (hojaActualNumero && hojaActualNumero > 0) return 'HOJA_ACTUAL';
    return todasLasHojas.length > 1 ? 'HOJA_ACTUAL' : 'TODAS';
  });

  const [hojaActualIndex, setHojaActualIndex] = useState<number>(() => {
    if (hojaActualNumero && hojaActualNumero > 0) return hojaActualNumero;
    return 1;
  });

  const [hojasSeleccionadas, setHojasSeleccionadas] = useState<number[]>([1]);

  // Sincronizar hoja actual cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (esSecretaria) {
        setModo('INDIVIDUAL');
      }
      const initialHoja = hojaActualNumero && hojaActualNumero > 0 ? hojaActualNumero : 1;
      setHojaActualIndex(initialHoja);
      setHojasSeleccionadas([initialHoja]);
      if (todasLasHojas.length > 1) {
        setModoSeleccionHojas('HOJA_ACTUAL');
      } else {
        setModoSeleccionHojas('TODAS');
      }
    }
  }, [isOpen, hojaActualNumero, todasLasHojas.length]);

  // Boletas filtradas según la hoja actual o las hojas seleccionadas
  const boletasActivas: BoletaJudicial[] = useMemo(() => {
    if (todasLasHojas.length === 0) return boletas;

    if (modoSeleccionHojas === 'HOJA_ACTUAL') {
      const encontrada = todasLasHojas.find(h => h.numeroHoja === hojaActualIndex);
      return encontrada ? encontrada.boletas : (todasLasHojas[0]?.boletas || boletas);
    }

    if (modoSeleccionHojas === 'VARIAS_HOJAS') {
      const hojasElegidas = todasLasHojas.filter(h => hojasSeleccionadas.includes(h.numeroHoja));
      if (hojasElegidas.length === 0) return boletas;
      return hojasElegidas.flatMap(h => h.boletas);
    }

    // Modo 'TODAS'
    return boletas;
  }, [boletas, todasLasHojas, modoSeleccionHojas, hojaActualIndex, hojasSeleccionadas]);

  const totalBoletasActivas = boletasActivas.length;

  // Nombres de alguaciles disponibles
  const listaNombres = useMemo(() => {
    const list = alguaciles.map(a => a.nombre).filter(Boolean);
    if (!list.includes('RENZO')) list.push('RENZO');
    if (!list.includes('PABLO')) list.push('PABLO');
    if (!list.includes('WUILMAR')) list.push('WUILMAR');
    if (!list.includes('ROXANA')) list.push('ROXANA');
    if (!list.includes('ELISET')) list.push('ELISET');
    return Array.from(new Set(list));
  }, [alguaciles]);

  const defaultAlg1 = listaNombres.find(n => n.toUpperCase().includes('RENZO')) || listaNombres[0] || 'RENZO';
  const defaultAlg2 = listaNombres.find(n => n.toUpperCase().includes('PABLO')) || listaNombres[1] || 'PABLO';

  const mitadExacta = Math.ceil(totalBoletasActivas / 2);

  // Lista dinámica de alguaciles para la ruta compartida
  const [slots, setSlots] = useState<AlguacilSlot[]>([
    { id: 'slot-1', alguacil: defaultAlg1, cantidad: mitadExacta },
    { id: 'slot-2', alguacil: defaultAlg2, cantidad: Math.max(0, totalBoletasActivas - mitadExacta) },
  ]);

  const [alguacilIndividual, setAlguacilIndividual] = useState<string>(defaultAlg1);
  const [actualizarEnSistema, setActualizarEnSistema] = useState<boolean>(true);

  // Repartir equitativamente las boletas activas entre los slots
  const repartirEquitativamente = (currentSlots: AlguacilSlot[], total: number = totalBoletasActivas) => {
    if (currentSlots.length === 0) return [];
    const base = Math.floor(total / currentSlots.length);
    let sobrante = total % currentSlots.length;

    return currentSlots.map((s) => {
      const extra = sobrante > 0 ? 1 : 0;
      if (sobrante > 0) sobrante--;
      return {
        ...s,
        cantidad: base + extra,
      };
    });
  };

  // Sincronizar cantidades al cambiar las boletas activas seleccionadas
  useEffect(() => {
    if (isOpen && totalBoletasActivas > 0) {
      setSlots(prev => repartirEquitativamente(prev, totalBoletasActivas));
    }
  }, [isOpen, totalBoletasActivas]);

  if (!isOpen) return null;

  // Toggle de selección múltiple de hojas
  const handleToggleHojaSeleccionada = (numHoja: number) => {
    setHojasSeleccionadas(prev => {
      if (prev.includes(numHoja)) {
        if (prev.length === 1) return prev; // Mantener al menos una
        return prev.filter(n => n !== numHoja);
      } else {
        return [...prev, numHoja].sort((a, b) => a - b);
      }
    });
  };

  // Agregar nuevo Alguacil a la ruta compartida
  const handleAgregarAlguacil = () => {
    const seleccionados = slots.map(s => s.alguacil.toUpperCase());
    const noSeleccionado = listaNombres.find(n => !seleccionados.includes(n.toUpperCase())) || listaNombres[0] || 'ALGUACIL';
    const newSlot: AlguacilSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      alguacil: noSeleccionado,
      cantidad: 0,
    };
    const updated = [...slots, newSlot];
    setSlots(repartirEquitativamente(updated, totalBoletasActivas));
  };

  // Eliminar un Alguacil de la ruta compartida
  const handleEliminarAlguacil = (index: number) => {
    if (slots.length <= 2) {
      alert('La ruta compartida requiere al menos 2 alguaciles. Para un solo alguacil use la opción "Ruta Individual".');
      return;
    }
    const updated = slots.filter((_, i) => i !== index);
    setSlots(repartirEquitativamente(updated, totalBoletasActivas));
  };

  const handleChangeAlguacil = (index: number, nuevoNombre: string) => {
    setSlots(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], alguacil: nuevoNombre };
      return copy;
    });
  };

  const handleChangeCantidad = (index: number, valor: number) => {
    const safeVal = Math.max(0, isNaN(valor) ? 0 : valor);
    setSlots(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], cantidad: safeVal };
      return copy;
    });
  };

  const totalAsignado = slots.reduce((acc, s) => acc + s.cantidad, 0);

  const handleGenerarPDF = (modoSalidaForzado: ModoSalidaDocumento = 'imprimir') => {
    if (boletasActivas.length === 0) {
      alert('No hay boletas en la hoja o selección para imprimir.');
      return;
    }

    const callbackUpdate = onUpdateBoletasAsignadas || onActualizarAsignaciones;

    if (modo === 'INDIVIDUAL') {
      if (!alguacilIndividual) {
        alert('Por favor selecciona un Alguacil.');
        return;
      }

      if (actualizarEnSistema && callbackUpdate) {
        const updated = boletasActivas.map(b => ({
          ...b,
          alguacilPractica: alguacilIndividual,
          updatedAt: new Date().toISOString(),
        }));
        callbackUpdate(updated);
      }

      exportarHojaRutaAlguacilPDF(
        alguacilIndividual,
        boletasActivas,
        config,
        new Date().toISOString().slice(0, 10),
        undefined,
        { esSobreseimiento: isSobreseimiento, tituloRuta, modoSalida: modoSalidaForzado }
      );
    } else {
      // Modo Compartido (Múltiples Alguaciles)
      if (slots.length < 2) {
        alert('Debes tener al menos 2 alguaciles asignados para la ruta compartida.');
        return;
      }

      if (totalAsignado !== totalBoletasActivas) {
        if (!confirm(`La suma de boletas asignadas (${totalAsignado}) no coincide con el total de boletas seleccionadas (${totalBoletasActivas}). ¿Deseas repartir automáticamente en partes iguales antes de imprimir?`)) {
          return;
        }
        const equitativas = repartirEquitativamente(slots, totalBoletasActivas);
        setSlots(equitativas);
      }

      // Crear asignaciones rebanando las boletas activas
      const asignaciones: AsignacionAlguacilRuta[] = [];
      let cursor = 0;
      slots.forEach(slot => {
        const slice = boletasActivas.slice(cursor, cursor + slot.cantidad);
        cursor += slot.cantidad;
        asignaciones.push({
          alguacil: slot.alguacil,
          boletas: slice,
        });
      });

      if (cursor < boletasActivas.length && asignaciones.length > 0) {
        const restantes = boletasActivas.slice(cursor);
        asignaciones[asignaciones.length - 1].boletas.push(...restantes);
      }

      if (actualizarEnSistema && callbackUpdate) {
        const updatedBoletas: BoletaJudicial[] = [];
        asignaciones.forEach(asig => {
          asig.boletas.forEach(b => {
            updatedBoletas.push({
              ...b,
              alguacilPractica: asig.alguacil,
              updatedAt: new Date().toISOString(),
            });
          });
        });
        callbackUpdate(updatedBoletas);
      }

      exportarHojaRutaCompartidaMultiplesAlguacilesPDF(
        asignaciones,
        config,
        new Date().toISOString().slice(0, 10),
        { esSobreseimiento: isSobreseimiento, tituloRuta, modoSalida: modoSalidaForzado }
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabecera */}
        <div className={`text-white p-4.5 flex items-center justify-between border-b ${isSobreseimiento ? 'bg-purple-900 border-purple-800' : 'bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] border-blue-400/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-white shrink-0 shadow-sm ${isSobreseimiento ? 'bg-purple-700 border-purple-400/40' : 'bg-white/15 border-white/30'}`}>
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
                {isSobreseimiento ? 'Ruta de Sobreseimiento Compartida' : (tituloRuta || 'Ruta de Notificación y Citación Compartida')}
              </h2>
              <p className="text-xs text-blue-100">
                División de ruta entre Alguaciles • {totalBoletasActivas} boleta(s) seleccionadas ({boletas.length} total ruta)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Pregunta inicial destacada */}
          {!esSecretaria ? (
            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
              <Users className="w-5 h-5 text-[#004BB4] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-[#004BB4] uppercase tracking-wide">
                  ¿Desea dividir esta ruta para varios Alguaciles de forma compartida?
                </p>
                <p className="text-slate-600 mt-0.5 leading-relaxed text-[11.5px]">
                  Seleccione si desea dividir la <strong>hoja actual</strong>, <strong>varias hojas</strong> o <strong>toda la ruta</strong> entre los Alguaciles asignados (ej. Renzo y Pablo).
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <User className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  Ruta de Notificación de Secretaría (Asignación de Un Solo Alguacil)
                </p>
                <p className="text-emerald-800 mt-0.5 leading-relaxed text-[11.5px]">
                  En el rol de secretaría la ruta se asigna y emite para un solo alguacil titular responsable de las diligencias.
                </p>
              </div>
            </div>
          )}

          {/* SELECCIÓN DE HOJAS (HOJA ACTUAL / VARIAS HOJAS / TODAS) */}
          <div className="bg-slate-50 border-2 border-indigo-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Selección de Hojas para la División de Ruta:</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                {todasLasHojas.length} Hoja(s) en la Ruta
              </span>
            </div>

            {/* Selector de Modo de Hojas */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModoSeleccionHojas('HOJA_ACTUAL')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  modoSeleccionHojas === 'HOJA_ACTUAL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Hoja Actual</span>
                <span className="text-[10px] opacity-90">({hojaActualIndex})</span>
              </button>

              <button
                type="button"
                onClick={() => setModoSeleccionHojas('VARIAS_HOJAS')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  modoSeleccionHojas === 'VARIAS_HOJAS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Varias Hojas</span>
                <span className="text-[10px] opacity-90">({hojasSeleccionadas.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setModoSeleccionHojas('TODAS')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  modoSeleccionHojas === 'TODAS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>Toda la Ruta</span>
                <span className="text-[10px] opacity-90">({boletas.length})</span>
              </button>
            </div>

            {/* Controles específicos según el modo de hoja seleccionado */}
            {modoSeleccionHojas === 'HOJA_ACTUAL' && (
              <div className="pt-1">
                <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Seleccione la hoja específica a dividir entre los Alguaciles:
                </span>
                <div className="flex flex-wrap gap-2">
                  {todasLasHojas.map((hoja) => (
                    <button
                      key={`hoja-opt-${hoja.numeroHoja}`}
                      type="button"
                      onClick={() => setHojaActualIndex(hoja.numeroHoja)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        hojaActualIndex === hoja.numeroHoja
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-400 font-black'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>Hoja {hoja.numeroHoja}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {hoja.idHoja} • {hoja.cantidad} boletas
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modoSeleccionHojas === 'VARIAS_HOJAS' && (
              <div className="pt-1">
                <span className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Marque las hojas que desea incluir en esta división compartida:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {todasLasHojas.map((hoja) => {
                    const isChecked = hojasSeleccionadas.includes(hoja.numeroHoja);
                    return (
                      <button
                        key={`check-hoja-${hoja.numeroHoja}`}
                        type="button"
                        onClick={() => handleToggleHojaSeleccionada(hoja.numeroHoja)}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-50/80 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div>
                            <span className="font-extrabold text-xs block">
                              Hoja {hoja.numeroHoja} ({hoja.idHoja})
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Ítems {hoja.rangoItems.desde} al {hoja.rangoItems.hasta}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          {hoja.cantidad} boletas
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {modoSeleccionHojas === 'TODAS' && (
              <p className="text-[11px] text-slate-600 italic">
                Se dividirán todas las boletas de la ruta completa ({boletas.length} boletas distribuidas en {todasLasHojas.length} folios).
              </p>
            )}
          </div>

          {/* Selector de Modo Compartida vs Individual (oculto en Secretaría porque es de un solo alguacil) */}
          {!esSecretaria && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setModo('COMPARTIDA')}
                className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  modo === 'COMPARTIDA'
                    ? 'bg-[#1E40AF] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Ruta Compartida ({slots.length} Alguaciles)</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('INDIVIDUAL')}
                className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  modo === 'INDIVIDUAL'
                    ? 'bg-[#1E40AF] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Ruta Individual (1 Alguacil)</span>
              </button>
            </div>
          )}

          {/* Configuración de Modo Compartido */}
          {modo === 'COMPARTIDA' && (
            <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-slate-900 uppercase block">
                    Alguaciles Asignados en la División ({slots.length}):
                  </span>
                  <span className={`text-[11px] font-bold ${totalAsignado === totalBoletasActivas ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {totalAsignado} de {totalBoletasActivas} boletas asignadas {totalAsignado === totalBoletasActivas ? '✓' : `(Diferencia: ${totalBoletasActivas - totalAsignado})`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSlots(repartirEquitativamente(slots, totalBoletasActivas))}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors"
                    title="Repartir boletas en partes iguales entre los alguaciles"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repartir Iguales</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAgregarAlguacil}
                    className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-md shadow-xs transition-colors"
                    title="Agregar otro alguacil a esta ruta compartida"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agregar Alguacil</span>
                  </button>
                </div>
              </div>

              {/* Lista dinámica de slots de Alguaciles */}
              <div className="space-y-2.5">
                {(() => {
                  let runningCount = 0;
                  return slots.map((slot, index) => {
                    const startItem = runningCount + 1;
                    const endItem = runningCount + slot.cantidad;
                    runningCount += slot.cantidad;
                    const percent = totalBoletasActivas > 0 ? Math.round((slot.cantidad / totalBoletasActivas) * 100) : 0;

                    return (
                      <div
                        key={slot.id}
                        className="bg-white border-2 border-slate-200 hover:border-blue-300 rounded-xl p-3 shadow-xs transition-colors flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-[200px] flex-1">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-900 text-xs font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-0.5">
                              Alguacil {index + 1}:
                            </label>
                            <select
                              value={slot.alguacil}
                              onChange={(e) => handleChangeAlguacil(index, e.target.value)}
                              className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                              {listaNombres.map((nom) => (
                                <option key={`slot-${slot.id}-${nom}`} value={nom}>
                                  {nom.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-0.5">
                              Boletas:
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={totalBoletasActivas}
                                value={slot.cantidad}
                                onChange={(e) => handleChangeCantidad(index, parseInt(e.target.value, 10))}
                                className="w-16 text-center text-xs font-black bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <span className="text-[11px] text-slate-500 font-bold">({percent}%)</span>
                            </div>
                          </div>

                          <div className="text-right text-[10px] text-slate-500 min-w-[90px] hidden md:block">
                            <span className="block font-semibold">Rango:</span>
                            <span className="font-mono text-slate-800 font-bold">
                              {slot.cantidad > 0 ? `Ítems ${startItem} - ${endItem}` : '0 boletas'}
                            </span>
                          </div>

                          {slots.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleEliminarAlguacil(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar este alguacil de la ruta compartida"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Configuración de Modo Individual */}
          {modo === 'INDIVIDUAL' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-black text-slate-900 uppercase">
                Seleccionar Alguacil Responsable de las {totalBoletasActivas} Boletas:
              </label>
              <select
                value={alguacilIndividual}
                onChange={(e) => setAlguacilIndividual(e.target.value)}
                className="w-full text-sm font-bold bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {listaNombres.map((nom) => (
                  <option key={`alg-ind-${nom}`} value={nom}>
                    {nom.toUpperCase()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Se imprimirá la Hoja de Ruta para las <strong>{totalBoletasActivas} boletas seleccionadas</strong> a nombre de <strong>{alguacilIndividual}</strong>.
              </p>
            </div>
          )}

          {/* Opción de sincronizar la base de datos */}
          <label className="flex items-center gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
            <input
              type="checkbox"
              checked={actualizarEnSistema}
              onChange={(e) => setActualizarEnSistema(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-emerald-950">
              Actualizar automáticamente en el sistema la asignación de Alguacil en cada boleta
            </span>
          </label>
        </div>

        {/* Pie con Acciones */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleGenerarPDF('imprimir')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              title="Imprime directamente del sistema sin necesidad de descargar el archivo primero"
            >
              <Printer className="w-4 h-4 text-emerald-100" />
              <span>
                {modo === 'COMPARTIDA'
                  ? `Imprimir / Descargar Ruta (${slots.map(s => s.alguacil).join(', ')}) • ${totalBoletasActivas} Boletas`
                  : `Imprimir / Descargar Ruta (${alguacilIndividual}) • ${totalBoletasActivas} Boletas`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
