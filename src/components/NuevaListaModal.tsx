import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Trash2, 
  RotateCcw, 
  Download, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Layers, 
  X,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { BoletaJudicial, ConfiguracionDespacho } from '../types/judicial';
import { exportarBoletasPDF } from '../utils/exportPDF';
import { exportarBoletasExcel } from '../utils/exportExcel';

interface NuevaListaModalProps {
  isOpen: boolean;
  onClose: () => void;
  boletas: BoletaJudicial[];
  config: ConfiguracionDespacho;
  onClearAll: () => void;
  onClearCompletedOnly: () => void;
  onOpenBatchModal: () => void;
  onResetDemoData: () => void;
}

export const NuevaListaModal: React.FC<NuevaListaModalProps> = ({
  isOpen,
  onClose,
  boletas,
  config,
  onClearAll,
  onClearCompletedOnly,
  onOpenBatchModal,
  onResetDemoData,
}) => {
  const [confirmStep, setConfirmStep] = useState<'NONE' | 'CLEAR_ALL' | 'CLEAR_COMPLETED'>('NONE');

  if (!isOpen) return null;

  const totalBoletas = boletas.length;
  const concluidas = boletas.filter(b => b.devueltaAlTribunal || b.acuseGenerado).length;
  const pendientes = totalBoletas - concluidas;

  const handleExportAndStartNew = (tipo: 'pdf' | 'excel') => {
    if (tipo === 'pdf') {
      exportarBoletasPDF(boletas, config);
    } else {
      exportarBoletasExcel(boletas, config);
    }
    // Después de exportar, limpiar para la nueva lista
    setTimeout(() => {
      onClearAll();
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto flex flex-col">
        
        {/* Cabecera */}
        <div className="p-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white flex items-center justify-between border-b border-blue-400/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 text-white shadow-md">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Iniciar Nueva Lista / Cerrar Jornada
              </h3>
              <p className="text-xs text-blue-100">
                Opciones para concluir el listado actual y comenzar uno nuevo
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setConfirmStep('NONE');
              onClose();
            }}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del Listado Actual */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-700 mb-2">Estado del Listado Actual:</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Boletas</span>
              <span className="text-base font-black text-slate-800">{totalBoletas}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Concluidas / Dev.</span>
              <span className="text-base font-black text-emerald-600">{concluidas}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-600 block">Pendientes</span>
              <span className="text-base font-black text-amber-600">{pendientes}</span>
            </div>
          </div>
        </div>

        {/* Cuerpo con Opciones */}
        <div className="p-5 space-y-3">
          {confirmStep === 'NONE' ? (
            <>
              {/* Opción 1: Exportar Respaldo y Empezar Lista en Blanco */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-all flex flex-col gap-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        1. Descargar Respaldo y Empezar Lista en Blanco
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Genera el informe de la lista terminada e inicia una lista limpia desde el Nº 1.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportAndStartNew('pdf')}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Guardar PDF y Nueva Lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportAndStartNew('excel')}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Guardar Excel y Nueva Lista</span>
                  </button>
                </div>
              </div>

              {/* Opción 2: Abrir Carga Rápida para Nuevo Lote */}
              <div 
                onClick={() => {
                  onClose();
                  onOpenBatchModal();
                }}
                className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-400 text-slate-950 font-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      2. Cargar Nuevo Lote de Boletas (Matriz Rápida)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Abre la tabla rápida de captura para tipear las nuevas boletas del día.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-200/70 px-2.5 py-1 rounded-lg">
                  Abrir ⚡
                </span>
              </div>

              {/* Opción 3: Limpiar solo boletas Concluidas (Mantener Pendientes) */}
              {concluidas > 0 && (
                <div 
                  onClick={() => setConfirmStep('CLEAR_COMPLETED')}
                  className="p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        3. Limpiar solo Boletas Devueltas ({concluidas})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Mantiene las {pendientes} boletas pendientes y quita las ya concluidas.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                    Depurar
                  </span>
                </div>
              )}

              {/* Opción 4: Limpiar Todo Directo */}
              <div 
                onClick={() => setConfirmStep('CLEAR_ALL')}
                className="p-3 rounded-xl border border-rose-200 hover:bg-rose-50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800">
                      4. Vaciar y Empezar Nueva Lista en Blanco
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Limpia todas las boletas de la tabla para iniciar una nueva jornada desde cero.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                  Vaciar
                </span>
              </div>
            </>
          ) : confirmStep === 'CLEAR_ALL' ? (
            /* Confirmación Vaciar Todo */
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>¿Confirmas que deseas vaciar el listado actual?</span>
              </div>
              <p className="text-xs text-slate-600">
                Se eliminarán las <strong>{totalBoletas} boletas</strong> de la lista actual para comenzar una nueva lista limpia.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep('NONE')}
                  className="flex-1 py-2 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmStep('NONE');
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Sí, Iniciar Nueva Lista
                </button>
              </div>
            </div>
          ) : (
            /* Confirmación Limpiar Concluidas */
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>¿Depurar {concluidas} boletas devueltas?</span>
              </div>
              <p className="text-xs text-slate-600">
                Se conservarán únicamente las <strong>{pendientes} boletas pendientes</strong> en la lista.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep('NONE')}
                  className="flex-1 py-2 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearCompletedOnly();
                    setConfirmStep('NONE');
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Sí, Conservar Pendientes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('¿Restablecer los datos de demostración iniciales?')) {
                onResetDemoData();
                onClose();
              }
            }}
            className="text-[11px] text-slate-500 hover:text-slate-800 font-medium cursor-pointer underline"
          >
            Restablecer datos de prueba
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmStep('NONE');
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
