import React from 'react';
import { 
  Building2, 
  FileCheck2, 
  FileSpreadsheet, 
  ShieldCheck, 
  ArrowRight, 
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import { DependenciaJudicial } from '../types/judicial';

interface ModalSeleccionDependenciaSupervisorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDependencia?: (dep: DependenciaJudicial) => void;
  onSeleccionarDependencia?: (dep: DependenciaJudicial) => void;
  supervisorNombre?: string;
  nombreSupervisor?: string;
  dependenciaActual?: DependenciaJudicial;
}

export const ModalSeleccionDependenciaSupervisor: React.FC<ModalSeleccionDependenciaSupervisorProps> = ({
  isOpen,
  onClose,
  onSelectDependencia,
  onSeleccionarDependencia,
  supervisorNombre,
  nombreSupervisor,
  dependenciaActual,
}) => {
  if (!isOpen) return null;

  const handleSelect = (dep: DependenciaJudicial) => {
    if (onSeleccionarDependencia) {
      onSeleccionarDependencia(dep);
    } else if (onSelectDependencia) {
      onSelectDependencia(dep);
    }
    onClose();
  };

  const nombreMostrado = supervisorNombre || nombreSupervisor || 'Supervisor de la Unidad';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-black/80 max-w-xl w-full overflow-hidden text-slate-100 flex flex-col">
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-indigo-950 via-[#0E2044] to-blue-950 p-6 border-b border-indigo-800/60 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                Rol: Supervisor de la Unidad
              </span>
              <h2 className="text-lg font-black text-white uppercase tracking-tight mt-0.5">
                ¿Qué Dependencia Desea Abrir?
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mt-2">
            Bienvenido, <strong className="text-white">{nombreMostrado}</strong>. Usted cuenta con permisos integrales para supervisar todo lo que realiza cada área. Seleccione con cuál dependencia desea comenzar a trabajar:
          </p>
        </div>

        {/* Opciones Principales */}
        <div className="p-6 space-y-3.5 bg-[#08152B]/95">
          {/* Opción 1: Notificación y Citación */}
          <button
            type="button"
            onClick={() => handleSelect('NOTIFICACION_CITACION')}
            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer shadow-sm ${
              dependenciaActual === 'NOTIFICACION_CITACION'
                ? 'bg-blue-900/60 border-blue-400 ring-2 ring-blue-500/50 shadow-blue-900/50'
                : 'bg-blue-950/40 hover:bg-blue-900/40 border-blue-800/60 hover:border-blue-400/80 shadow-sm hover:shadow-blue-900/40'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-400/40 flex items-center justify-center text-blue-300 group-hover:scale-105 transition-transform shrink-0">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-white group-hover:text-blue-200">
                    Notificación y Citación
                  </h3>
                  {dependenciaActual === 'NOTIFICACION_CITACION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ✓ ACTIVA AHORA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      Sistema Notificaciones
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Control de boletas judiciales de calle, citaciones, causas procesales y hojas de ruta para alguaciles.
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
          </button>

          {/* Opción 2: Secretario (a) con N° de Oficio */}
          <button
            type="button"
            onClick={() => handleSelect('SECRETARIA')}
            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer shadow-sm ${
              dependenciaActual === 'SECRETARIA'
                ? 'bg-emerald-900/60 border-emerald-400 ring-2 ring-emerald-500/50 shadow-emerald-900/50'
                : 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-800/60 hover:border-emerald-400/80 hover:shadow-emerald-900/40'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-600/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 group-hover:scale-105 transition-transform shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-white group-hover:text-emerald-200">
                    Secretario (a)
                  </h3>
                  {dependenciaActual === 'SECRETARIA' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ✓ ACTIVA AHORA
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      N° de Oficio Activo
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Gestión de Secretaría judicial con registro obligatorio/visible de N° de Oficio, boletas y actuaciones de despacho.
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
          </button>

          {/* Opción 3: Ver Ambas Dependencias (Supervisión Total) */}
          <button
            type="button"
            onClick={() => handleSelect('TODAS')}
            className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
              dependenciaActual === 'TODAS'
                ? 'bg-purple-900/60 border-purple-400 ring-2 ring-purple-500/50 shadow-purple-900/50'
                : 'bg-purple-950/30 hover:bg-purple-900/30 border-purple-800/40 hover:border-purple-400/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs text-purple-200">
                    Supervisión Integral (Ver Ambos Roles Simultáneamente)
                  </h4>
                  {dependenciaActual === 'TODAS' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-500/50">
                      ✓ ACTIVA AHORA
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Muestra la totalidad de boletas de Notificación/Citación y Secretaría en una sola vista consolidada.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
          </button>
        </div>

        {/* Pie con recordatorio */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Podrá alternar entre dependencias en cualquier momento desde la barra superior.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
