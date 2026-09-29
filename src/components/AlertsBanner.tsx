import React, { useState } from 'react';
import { Clock, CheckCircle2, Flame, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { BoletaJudicial } from '../types/judicial';
import { evaluarAlertaBoleta } from '../utils/alerts';

interface AlertsBannerProps {
  boletas: BoletaJudicial[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  boletas,
  activeFilter,
  onSelectFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  let criticas = 0;
  let urgentes = 0;
  let devueltas = 0;

  boletas.forEach((b) => {
    const alerta = evaluarAlertaBoleta(b);
    if (alerta.nivel === 'CRITICA') criticas++;
    else if (alerta.nivel === 'URGENTE') urgentes++;
    if (b.devueltaAlTribunal) devueltas++;
  });

  const total = boletas.length;
  const pendientes = total - devueltas;

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 mb-3 transition-all">
      <div className="flex items-center justify-between gap-3">
        {/* Resumen Rápido Amigable */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-800">Estado General:</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              Total: {total}
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              ✓ Devueltas: {devueltas}
            </span>
            <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
              ⏳ Pendientes: {pendientes}
            </span>
            {criticas > 0 && (
              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
                🔥 {criticas} Urgentes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeFilter !== 'TODAS' && (
            <button
              onClick={() => onSelectFilter('TODAS')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
            >
              Ver todas
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100"
          >
            <span>{isOpen ? 'Ocultar Filtros' : 'Filtrar por Urgencia'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 text-xs">
          <button
            onClick={() => onSelectFilter(activeFilter === 'CRITICA' ? 'TODAS' : 'CRITICA')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center justify-between border cursor-pointer ${
              activeFilter === 'CRITICA'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>🔥 Audiencia Hoy / Inmediata</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded">{criticas}</span>
          </button>

          <button
            onClick={() => onSelectFilter(activeFilter === 'URGENTE' ? 'TODAS' : 'URGENTE')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center justify-between border cursor-pointer ${
              activeFilter === 'URGENTE'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>⚡ Próximas (48 Horas)</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded">{urgentes}</span>
          </button>

          <button
            onClick={() => onSelectFilter(activeFilter === 'DEVUELTA' ? 'TODAS' : 'DEVUELTA')}
            className={`px-3 py-2 rounded-lg font-bold flex items-center justify-between border cursor-pointer ${
              activeFilter === 'DEVUELTA'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>✓ Solo Devueltas</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded">{devueltas}</span>
          </button>

          <button
            onClick={() => onSelectFilter('TODAS')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold border border-slate-200 text-center cursor-pointer"
          >
            Mostrar Todas
          </button>
        </div>
      )}
    </div>
  );
};
