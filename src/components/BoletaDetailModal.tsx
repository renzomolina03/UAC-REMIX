import React from 'react';
import { 
  X, 
  Scale, 
  Calendar, 
  User, 
  Send, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Edit3,
  MapPin
} from 'lucide-react';
import { BoletaJudicial, TribunalInfo, getCaracterDisplay, validarRequisitosDevuelta } from '../types/judicial';
import { formatFechaDisplay, evaluarAlertaBoleta, getNivelAlertaBadge } from '../utils/alerts';
import { ARTICULOS_INFO } from '../data/mockBoletas';

interface BoletaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  boleta: BoletaJudicial | null;
  tribunales: TribunalInfo[];
  onEdit: (boleta: BoletaJudicial) => void;
  onToggleDevuelta: (id: string, devuelta: boolean) => void;
}

export const BoletaDetailModal: React.FC<BoletaDetailModalProps> = ({
  isOpen,
  onClose,
  boleta,
  tribunales,
  onEdit,
  onToggleDevuelta,
}) => {
  if (!isOpen || !boleta) return null;

  const alerta = evaluarAlertaBoleta(boleta);
  const badge = getNivelAlertaBadge(alerta.nivel);
  const tribunalObj = tribunales.find(t => t.codigo === boleta.tribunal);
  const artInfo = ARTICULOS_INFO[boleta.articuloCOPP];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col text-xs">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white flex items-center justify-between flex-shrink-0 border-b border-blue-400/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 text-white font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  Boleta Nº {boleta.boletaNumero}
                </h3>
                {boleta.numeroOficio && (
                  <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono font-bold text-[11px] border border-white/30">
                    Oficio Nº {boleta.numeroOficio}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-white/20 text-white font-mono font-bold text-[11px] border border-white/30">
                  Item #{boleta.numeroItem}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  boleta.dependencia === 'SECRETARIA'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/20 text-white border-white/30'
                }`}>
                  {boleta.dependencia === 'SECRETARIA' ? 'Secretaría' : 'Notificación y Citación'}
                </span>
              </div>
              <p className="text-[11px] text-blue-100">
                Causa / Expediente: <strong className="text-white font-mono">{boleta.numeroCausa}</strong>
                {boleta.responsableRelacion && (
                  <span className="ml-2 text-blue-200">
                    • Relacionado por: <strong>{boleta.responsableRelacion}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Estado y Alerta */}
        <div className={`p-3 border-b flex items-center justify-between ${
          alerta.nivel === 'CRITICA' ? 'bg-red-50 border-red-200 text-red-900' :
          alerta.nivel === 'URGENTE' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          alerta.nivel === 'DEVUELTA' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          'bg-slate-50 border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <span className="font-bold">{alerta.titulo}:</span>
            <span className="font-medium text-[11px]">{alerta.mensaje}</span>
          </div>
          {(() => {
            const req = validarRequisitosDevuelta(boleta);
            return (
              <button
                onClick={() => {
                  if (!boleta.devueltaAlTribunal) {
                    if (!req.puedeSerDevuelta) {
                      alert(req.mensajeError);
                      return;
                    }
                  }
                  onToggleDevuelta(boleta.id, !boleta.devueltaAlTribunal);
                }}
                className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                  boleta.devueltaAlTribunal
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : !req.puedeSerDevuelta
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
                title={
                  boleta.devueltaAlTribunal
                    ? 'Clic para cambiar a Pendiente'
                    : !req.puedeSerDevuelta
                      ? req.mensajeError.replace(/\n/g, ' ')
                      : 'Clic para marcar como Devuelta al Tribunal (SÍ)'
                }
              >
                {boleta.devueltaAlTribunal ? '✓ Devuelta al Tribunal' : 'Marcar como Devuelta'}
              </button>
            );
          })()}
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Fila 1: Persona Citada y Carácter */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Persona Notificada / Citada</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">{boleta.notificadoCitado}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                {getCaracterDisplay(boleta.tipoCitado)}
              </span>
              {boleta.direccionCitacion && (
                <span className="text-slate-600 text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {boleta.direccionCitacion}
                </span>
              )}
            </div>
          </div>

          {/* Fila 2: Cuadrícula de Fechas y Tribunal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tribunal */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tribunal Solicitante</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-1 rounded bg-slate-900 text-white font-extrabold text-xs">
                  {boleta.tribunal}
                </span>
                <span className="font-semibold text-slate-800 text-xs">
                  {boleta.tribunal === 'OTRO'
                    ? (boleta.tribunalOtro ? `OTRO: ${boleta.tribunalOtro}` : 'OTRO TRIBUNAL (FORÁNEO)')
                    : (tribunalObj ? tribunalObj.nombre : `TRIBUNAL ${boleta.tribunal}`)}
                </span>
              </div>
            </div>

            {/* Artículo COPP */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Artículo COPP Aplicable</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 rounded font-black text-xs ${artInfo.colorBg} ${artInfo.colorText}`}>
                  Art. {boleta.articuloCOPP}
                </span>
                <span className="font-semibold text-slate-800 text-[11px]">
                  {artInfo.nombre}
                </span>
              </div>
            </div>

            {/* Fecha de Asignación / Ingreso */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fecha de Asignación (Ingreso)</span>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {formatFechaDisplay(boleta.fechaAsignacion)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Alguacil Practicante: <strong className="text-slate-700">{boleta.alguacilPractica}</strong>
              </p>
            </div>

            {/* Fecha de Audiencia */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Fecha de Audiencia</span>
              {boleta.esSoloNotificacion ? (
                <p className="text-sm font-bold text-blue-700 mt-1">MERA NOTIFICACIÓN</p>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {formatFechaDisplay(boleta.fechaAudiencia)} {boleta.horaAudiencia && `• ${boleta.horaAudiencia}`}
                  </p>
                  {boleta.tipoAudiencia && (
                    <p className="text-[10px] text-slate-500 font-medium">{boleta.tipoAudiencia}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila 3: Registro de Acuses y Recibido */}
          <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/80 space-y-2">
            <h4 className="font-bold text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-purple-600" />
              Relación de Acuse para Entrega al Tribunal
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Recibido por U.A.C.:</span>
                <p className="font-bold text-slate-800">
                  {boleta.fechaRecibidoUAC ? formatFechaDisplay(boleta.fechaRecibidoUAC) : 'Pendiente de recepción en UAC'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Fecha Devolución al Tribunal:</span>
                <p className="font-bold text-slate-800">
                  {boleta.fechaDevueltaTribunal ? formatFechaDisplay(boleta.fechaDevueltaTribunal) : 'Sin entregar al Tribunal'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Recibido en Tribunal por:</span>
                <p className="font-bold text-slate-800">
                  {boleta.acuseRecibidoPor || 'Sin funcionario receptor registrado'}
                </p>
                {(boleta.acuseFechaEntrega || boleta.acuseHoraEntrega) && (
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {boleta.acuseFechaEntrega ? `Fecha: ${formatFechaDisplay(boleta.acuseFechaEntrega)}` : ''} 
                    {boleta.acuseHoraEntrega ? ` • Hora: ${boleta.acuseHoraEntrega}` : ''}
                  </p>
                )}
              </div>

              <div>
                <span className="text-slate-500 font-medium">Nº Control / Oficio:</span>
                <p className="font-mono font-bold text-slate-800">
                  {boleta.acuseNumeroControl || 'Sin correlativo'}
                </p>
              </div>
            </div>

            {boleta.observaciones && (
              <div className="pt-2 border-t border-purple-200/60 mt-2">
                <span className="text-slate-500 font-medium">Observaciones de la Diligencia:</span>
                <p className="text-slate-800 italic mt-0.5">{boleta.observaciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              onEdit(boleta);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white rounded-lg font-black text-xs shadow-sm cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Editar Boleta</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#003EA7] hover:bg-[#002B78] text-white rounded-lg font-bold text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
