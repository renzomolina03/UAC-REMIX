import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { BoletaJudicial } from '../types/judicial';

interface ModalConfirmarEliminarProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  boleta?: BoletaJudicial | null;
  cantidad?: number;
}

export const ModalConfirmarEliminar: React.FC<ModalConfirmarEliminarProps> = ({
  isOpen,
  onClose,
  onConfirm,
  boleta,
  cantidad = 1,
}) => {
  if (!isOpen) return null;

  const isBulk = cantidad > 1 || !boleta;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Encabezado */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">
                {isBulk ? `¿Eliminar ${cantidad} boletas?` : '¿Eliminar boleta judicial?'}
              </h3>
              <p className="text-xs text-rose-800 font-medium">Confirmación obligatoria de seguridad</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            {isBulk
              ? `¿Está completamente seguro de eliminar las ${cantidad} boletas seleccionadas? Esta acción retirará los registros de la lista principal y de los acuses.`
              : '¿Está seguro de eliminar de forma permanente el registro de esta boleta judicial?'}
          </p>

          {!isBulk && boleta && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500 font-bold">Nº DE CAUSA:</span>
                <span className="font-mono font-black text-slate-900">{boleta.numeroCausa}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500 font-bold">BOLETA Nº:</span>
                <span className="font-mono font-black text-indigo-700">{boleta.boletaNumero}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500 font-bold">NOTIFICADO / CITADO:</span>
                <span className="font-bold text-slate-900 text-right max-w-[200px] truncate" title={boleta.notificadoCitado}>
                  {boleta.notificadoCitado}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">TRIBUNAL:</span>
                <span className="font-black text-slate-900">{boleta.tribunal}</span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-[11px]">
              <strong>Advertencia:</strong> Esta acción no se puede deshacer. Verifique que no requiera el respaldo de esta boleta antes de confirmar.
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sí, Eliminar Definitivamente</span>
          </button>
        </div>

      </div>
    </div>
  );
};
