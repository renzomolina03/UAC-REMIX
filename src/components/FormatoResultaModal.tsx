import React, { useState, useEffect } from 'react';
import { BoletaJudicial, Alguacil, ConfiguracionDespacho, getCaracterDisplay } from '../types/judicial';
import { exportarFormatoResultaFisicoPDF } from '../utils/exportPDF';
import { formatFechaDisplay } from '../utils/alerts';
import { Printer, X, Calendar, Clock, FileText, PenTool, BookOpen } from 'lucide-react';

interface FormatoResultaModalProps {
  isOpen: boolean;
  onClose: () => void;
  boleta: BoletaJudicial | null;
  alguaciles: Alguacil[];
  config: ConfiguracionDespacho;
}

export const FormatoResultaModal: React.FC<FormatoResultaModalProps> = ({
  isOpen,
  onClose,
  boleta,
  alguaciles,
  config,
}) => {
  const [alguacilSeleccionado, setAlguacilSeleccionado] = useState('');
  const [fechaPractica, setFechaPractica] = useState(new Date().toISOString().slice(0, 10));
  const [horaPractica, setHoraPractica] = useState('');
  const [tipoDiligencia, setTipoDiligencia] = useState('ART. 167 C.O.P.P. - CITACIÓN PERSONAL (Directa al interesado o su defensor)');
  const [relatoDiligencia, setRelatoDiligencia] = useState('');
  const [modoLineasCuaderno, setModoLineasCuaderno] = useState(true);

  useEffect(() => {
    if (boleta) {
      setAlguacilSeleccionado(boleta.alguacilPractica || alguaciles[0]?.nombre || '');
      setFechaPractica(boleta.fechaPractica || new Date().toISOString().slice(0, 10));
      setHoraPractica(boleta.horaAudiencia || '10:00 AM');
      setRelatoDiligencia('');
      setModoLineasCuaderno(true);

      // Preseleccionar el artículo C.O.P.P. según la boleta
      const art = (boleta.articuloCOPP || boleta.articulosCOPP || '').toUpperCase();
      if (art.includes('168')) {
        setTipoDiligencia('ART. 168 C.O.P.P. - CITACIÓN EN MORADA O LUGAR DE TRABAJO (A familiar o empleado)');
      } else if (art.includes('169')) {
        setTipoDiligencia('ART. 169 C.O.P.P. - CITACIÓN DE MILITARES, POLICÍAS O FUNCIONARIOS PÚBLICOS');
      } else if (art.includes('170')) {
        setTipoDiligencia('ART. 170 C.O.P.P. - CITACIÓN DE VÍCTIMAS, EXPERTOS, INTÉRPRETES Y TESTIGOS');
      } else if (art.includes('171')) {
        setTipoDiligencia('ART. 171 C.O.P.P. - NEGATIVA A FIRMAR / NO LOCALIZADO / IMPOSIBILIDAD DE PRÁCTICA');
      } else if (art.includes('165') || boleta.esSoloNotificacion) {
        setTipoDiligencia('ART. 165 C.O.P.P. - NOTIFICACIÓN DE SENTENCIA, AUTO O RESOLUCIÓN JUDICIAL');
      } else {
        setTipoDiligencia('ART. 167 C.O.P.P. - CITACIÓN PERSONAL (Directa al interesado o su defensor)');
      }
    }
  }, [boleta, alguaciles]);

  if (!isOpen || !boleta) return null;

  const handleExportar = (forzarLineasEnBlanco: boolean = false) => {
    exportarFormatoResultaFisicoPDF({
      boleta,
      alguacilResulta: alguacilSeleccionado,
      fechaPractica,
      horaPractica,
      tipoDiligencia,
      relatoDiligencia: forzarLineasEnBlanco ? '' : relatoDiligencia,
      modoLineasCuaderno: forzarLineasEnBlanco ? true : modoLineasCuaderno,
      config,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExportar(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Encabezado */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Resulta Judicial en Físico</h3>
              <p className="text-xs text-slate-300">Generación oficial de Resulta Judicial con fe pública y pauta de cuaderno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ficha Resumen de la Boleta */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block font-medium">Nº Causa:</span>
              <span className="font-bold text-slate-900">{boleta.numeroCausa}</span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Boleta Nº:</span>
              <span className="font-bold text-slate-900">{boleta.boletaNumero}</span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Tribunal:</span>
              <span className="font-bold text-indigo-700">{boleta.tribunal}</span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Carácter:</span>
              <span className="font-bold text-slate-900">{getCaracterDisplay(boleta.tipoCitado)}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 text-xs">
            <span className="text-slate-500 font-medium mr-1">Citado/Notificado:</span>
            <span className="font-semibold text-slate-800">{boleta.notificadoCitado}</span>
          </div>
        </div>

        {/* Formulario de parámetros de la práctica */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Alguacil Responsable de la Resulta *
            </label>
            <div className="relative">
              <select
                value={alguacilSeleccionado}
                onChange={(e) => setAlguacilSeleccionado(e.target.value)}
                required
                className="w-full text-sm rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 py-2 pl-3 pr-8"
              >
                <option value="">-- Seleccionar Alguacil --</option>
                {alguaciles.map((alg) => (
                  <option key={alg.id} value={alg.nombre}>
                    {alg.nombre} {alg.cedula ? `(C.I. ${alg.cedula})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha de la Práctica *
              </label>
              <input
                type="date"
                value={fechaPractica}
                onChange={(e) => setFechaPractica(e.target.value)}
                required
                className="w-full text-sm rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Hora de la Práctica
              </label>
              <input
                type="text"
                placeholder="Ej: 10:30 AM"
                value={horaPractica}
                onChange={(e) => setHoraPractica(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-3"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tipo de Práctica / Diligencia (Artículos C.O.P.P.) *
            </label>
            <select
              value={tipoDiligencia}
              onChange={(e) => setTipoDiligencia(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 font-medium text-slate-800"
            >
              <option value="ART. 167 C.O.P.P. - CITACIÓN PERSONAL (Directa al interesado o su defensor)">
                ART. 167 C.O.P.P. - CITACIÓN PERSONAL (Directa al interesado o su defensor)
              </option>
              <option value="ART. 168 C.O.P.P. - CITACIÓN EN MORADA O LUGAR DE TRABAJO (A familiar o empleado)">
                ART. 168 C.O.P.P. - CITACIÓN EN MORADA O LUGAR DE TRABAJO (A familiar o empleado)
              </option>
              <option value="ART. 169 C.O.P.P. - CITACIÓN DE MILITARES, POLICÍAS O FUNCIONARIOS PÚBLICOS">
                ART. 169 C.O.P.P. - CITACIÓN DE MILITARES, POLICÍAS O FUNCIONARIOS PÚBLICOS
              </option>
              <option value="ART. 170 C.O.P.P. - CITACIÓN DE VÍCTIMAS, EXPERTOS, INTÉRPRETES Y TESTIGOS">
                ART. 170 C.O.P.P. - CITACIÓN DE VÍCTIMAS, EXPERTOS, INTÉRPRETES Y TESTIGOS
              </option>
              <option value="ART. 171 C.O.P.P. - NEGATIVA A FIRMAR / NO LOCALIZADO / IMPOSIBILIDAD DE PRÁCTICA">
                ART. 171 C.O.P.P. - NEGATIVA A FIRMAR / NO LOCALIZADO / IMPOSIBILIDAD DE PRÁCTICA
              </option>
              <option value="ART. 165 C.O.P.P. - NOTIFICACIÓN DE SENTENCIA, AUTO O RESOLUCIÓN JUDICIAL">
                ART. 165 C.O.P.P. - NOTIFICACIÓN DE SENTENCIA, AUTO O RESOLUCIÓN JUDICIAL
              </option>
              <option value="ART. 165 C.O.P.P. - NOTIFICACIÓN DE AUTO DE SOBRESEIMIENTO">
                ART. 165 C.O.P.P. - NOTIFICACIÓN DE AUTO DE SOBRESEIMIENTO
              </option>
              <option value="OTRO ACTO DE COMUNICACIÓN JUDICIAL CONFORME AL C.O.P.P.">
                OTRO ACTO DE COMUNICACIÓN JUDICIAL CONFORME AL C.O.P.P.
              </option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                Relato de la Diligencia / Circunstancias (Fe Pública)
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                Puño y letra o redacción digital
              </span>
            </div>
            <textarea
              rows={3}
              value={relatoDiligencia}
              onChange={(e) => setRelatoDiligencia(e.target.value)}
              placeholder="Describa aquí cómo fue la práctica de la boleta, con qué circunstancias se encontró el alguacil, etc. O déjelo en blanco para escribirlo a puño y letra en la hoja impresa..."
              className="w-full text-xs rounded-lg border-slate-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 p-2.5 font-normal placeholder:text-slate-400"
            />
            
            <div className="mt-2 flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <input
                type="checkbox"
                id="chk-lineas-cuaderno"
                checked={modoLineasCuaderno}
                onChange={(e) => setModoLineasCuaderno(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
              />
              <label htmlFor="chk-lineas-cuaderno" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
                <strong>Imprimir con renglones estilo cuaderno</strong> (para escribir o completar a puño y letra en físico)
              </label>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => handleExportar(true)}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              title="Descargar con líneas pautadas como un cuaderno para escribir a puño y letra"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Imprimir con Líneas de Cuaderno</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Generar Resulta</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
