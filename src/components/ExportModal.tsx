import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  X, 
  Download, 
  Building2, 
  Calendar, 
  Check, 
  Send,
  CheckCircle,
  UserCheck,
  QrCode,
  Layers,
  Printer
} from 'lucide-react';
import { BoletaJudicial, TribunalInfo, ConfiguracionDespacho, Alguacil } from '../types/judicial';
import { exportarBoletasExcel } from '../utils/exportExcel';
import { 
  exportarBoletasPDF, 
  exportarPlanillaAcusesPDF, 
  exportarHojaRutaAlguacilPDF,
  exportarOficioEstadisticasGlobalesPDF,
  exportarInformeMatrizTribunalPDF
} from '../utils/exportPDF';
import { calcularHojasLote } from '../utils/sheetCalculation';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  alguaciles: Alguacil[];
  config: ConfiguracionDespacho;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  boletas,
  tribunales,
  alguaciles,
  config,
}) => {
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'acuse' | 'hoja_ruta' | 'oficio_global' | 'oficio_tribunal_qr'>('excel');
  const [selectedTribunal, setSelectedTribunal] = useState<string>('TODOS');
  const [selectedAlguacil, setSelectedAlguacil] = useState<string>(alguaciles[0]?.nombre || 'ELISET');
  const [successMsg, setSuccessMsg] = useState('');

  // Configuración de Hojas y Lotes para PDF
  const [pdfIdInicial, setPdfIdInicial] = useState<string>(() => {
    return localStorage.getItem('uac_ultimo_id_hoja') || 'uac1233';
  });
  const [pdfHojasSeleccionadas, setPdfHojasSeleccionadas] = useState<number[]>([]);
  const [pdfModoSeleccion, setPdfModoSeleccion] = useState<'todas' | 'seleccionadas'>('todas');

  // Boletas que se incluirán según el filtro de tribunal
  const boletasParaPdf = useMemo(() => {
    if (selectedTribunal === 'TODOS') return boletas;
    return boletas.filter(b => b.tribunal.toUpperCase() === selectedTribunal.toUpperCase());
  }, [boletas, selectedTribunal]);

  // Hojas calculadas dinámicamente (30 por hoja reglamentaria)
  const hojasCalculadasPdf = useMemo(() => {
    return calcularHojasLote(boletasParaPdf, 30, pdfIdInicial);
  }, [boletasParaPdf, pdfIdInicial]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setSuccessMsg('');
    const triFilter = selectedTribunal === 'TODOS' ? undefined : selectedTribunal;

    if (exportFormat === 'excel') {
      exportarBoletasExcel(boletas, config, triFilter);
      setSuccessMsg('¡Archivo Excel generado y descargado exitosamente!');
    } else if (exportFormat === 'pdf') {
      localStorage.setItem('uac_ultimo_id_hoja', pdfIdInicial);
      exportarBoletasPDF(boletas, config, triFilter, {
        hojasSeleccionadas: pdfModoSeleccion === 'seleccionadas' && pdfHojasSeleccionadas.length > 0
          ? pdfHojasSeleccionadas
          : undefined,
        capacidadPorHoja: 30,
        idInicial: pdfIdInicial
      });
      setSuccessMsg('¡Reporte PDF oficial por hojas generado exitosamente!');
    } else if (exportFormat === 'acuse') {
      const triObj = tribunales.find(t => t.codigo === (triFilter || (tribunales[0]?.codigo || 'C1'))) || tribunales[0];
      const boletasTri = boletas.filter(b => b.tribunal.toUpperCase() === triObj.codigo.toUpperCase() && b.devueltaAlTribunal);
      exportarPlanillaAcusesPDF(triObj.nombre, boletasTri, config);
      setSuccessMsg(`¡Planilla de Acuse para ${triObj.nombre} generada exitosamente!`);
    } else if (exportFormat === 'hoja_ruta') {
      const boletasAlg = boletas.filter(b => b.alguacilPractica?.toUpperCase() === selectedAlguacil.toUpperCase());
      exportarHojaRutaAlguacilPDF(selectedAlguacil, boletasAlg, config, new Date().toISOString().slice(0, 10));
      setSuccessMsg(`¡Hoja de Ruta para el Alguacil ${selectedAlguacil} generada exitosamente!`);
    } else if (exportFormat === 'oficio_global') {
      await exportarOficioEstadisticasGlobalesPDF(boletas, tribunales, config);
      setSuccessMsg('¡Oficio de Rendición de Estadísticas Globales por Artículos del COPP generado exitosamente!');
    } else if (exportFormat === 'oficio_tribunal_qr') {
      const triObj = tribunales.find(t => t.codigo === (triFilter || 'C1')) || tribunales[0];
      await exportarInformeMatrizTribunalPDF(triObj, boletas, config);
      setSuccessMsg(`¡Oficio de Rendición con QR para ${triObj.nombre} generado exitosamente!`);
    }

    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Encabezado */}
        <div className="p-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white flex items-center justify-between border-b border-blue-400/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/20 text-white shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Exportación de Reportes y Documentos</h3>
              <p className="text-[11px] text-blue-100">Excel (.xlsx), PDF oficiales y Hojas de Ruta</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formato de exportación */}
          <div>
            <label className="block font-bold text-slate-800 mb-2">
              Selecciona el Formato o Documento:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('excel')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'excel'
                    ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 mx-auto mb-1 text-emerald-300" />
                <span className="block text-[11px]">Libro Excel</span>
                <span className="text-[9px] opacity-80">.xlsx Completo</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'pdf'
                    ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 mx-auto mb-1 text-amber-300" />
                <span className="block text-[11px]">Reporte PDF</span>
                <span className="text-[9px] opacity-80">Oficial General</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('acuse')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'acuse'
                    ? 'bg-purple-600 text-white border-purple-700 font-bold shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <Send className="w-4 h-4 mx-auto mb-1 text-purple-300" />
                <span className="block text-[11px]">Planilla Acuse</span>
                <span className="text-[9px] opacity-80">Por Tribunal</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('hoja_ruta')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'hoja_ruta'
                    ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <UserCheck className="w-4 h-4 mx-auto mb-1 text-blue-300" />
                <span className="block text-[11px]">Hoja de Ruta</span>
                <span className="text-[9px] opacity-80">Por Alguacil</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('oficio_global')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'oficio_global'
                    ? 'bg-slate-900 text-white border-slate-950 font-bold shadow-md ring-2 ring-amber-400'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                <span className="block text-[11px]">Oficio Global (QR)</span>
                <span className="text-[9px] opacity-80">Rendición COPP</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('oficio_tribunal_qr')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  exportFormat === 'oficio_tribunal_qr'
                    ? 'bg-indigo-900 text-white border-indigo-950 font-bold shadow-md ring-2 ring-indigo-400'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 mx-auto mb-1 text-indigo-300" />
                <span className="block text-[11px]">Oficio Tribunal (QR)</span>
                <span className="text-[9px] opacity-80">Sin lista de boletas</span>
              </button>
            </div>
          </div>

          {/* Tribunal o Alguacil según el formato */}
          {exportFormat === 'hoja_ruta' ? (
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Selecciona el Alguacil para la Hoja de Ruta:
              </label>
              <select
                value={selectedAlguacil}
                onChange={(e) => setSelectedAlguacil(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {alguaciles.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre} {a.telefono ? `(${a.telefono})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Genera el listado ordenado de causas y boletas para entregar al alguacil antes de salir a la diligencia.
              </p>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Alcance de Tribunales:
              </label>
              <select
                value={selectedTribunal}
                onChange={(e) => setSelectedTribunal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Tribunales (Consolidado + Hojas Individuales)</option>
                {tribunales.map((t) => (
                  <option key={t.id} value={t.codigo}>
                    {t.codigo} - {t.nombre}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {exportFormat === 'excel' && 'En Excel se exportarán pestañas por cada tribunal y la hoja general.'}
                {exportFormat === 'pdf' && 'En PDF se generará el membrete oficial del Tribunal Supremo de Justicia por hojas físicas de 30 boletas.'}
                {exportFormat === 'acuse' && 'Genera planilla formal con casillas de firma de entrega y recepción.'}
              </p>
            </div>
          )}

          {/* Opciones de Hojas y Lotes en PDF */}
          {exportFormat === 'pdf' && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-indigo-200/60 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 text-xs">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Cálculo de Hojas del Lote (30 boletas por hoja)</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-bold text-slate-700">ID Inicial:</label>
                  <input
                    type="text"
                    value={pdfIdInicial}
                    onChange={(e) => setPdfIdInicial(e.target.value.toLowerCase().trim())}
                    placeholder="ej: uac1233"
                    className="w-24 px-2 py-1 bg-white border border-indigo-300 rounded font-mono font-black text-indigo-900 text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    title="Identificador correlativo para las hojas impresas (ej. uac1233, uac1234, ...)"
                  />
                </div>
              </div>

              {/* Selector de modo: Todas vs Seleccionar */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Seleccionar hojas a imprimir:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfModoSeleccion('todas');
                      setPdfHojasSeleccionadas([]);
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      pdfModoSeleccion === 'todas'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Todas ({hojasCalculadasPdf.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfModoSeleccion('seleccionadas');
                      if (pdfHojasSeleccionadas.length === 0 && hojasCalculadasPdf.length > 0) {
                        setPdfHojasSeleccionadas([hojasCalculadasPdf[0].numeroHoja]);
                      }
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      pdfModoSeleccion === 'seleccionadas'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Elegir Hojas
                  </button>
                </div>
              </div>

              {/* Lista visual de hojas calculadas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {hojasCalculadasPdf.map((hoja) => {
                  const isChecked = pdfModoSeleccion === 'todas' || pdfHojasSeleccionadas.includes(hoja.numeroHoja);
                  return (
                    <div
                      key={hoja.numeroHoja}
                      onClick={() => {
                        setPdfModoSeleccion('seleccionadas');
                        setPdfHojasSeleccionadas(prev =>
                          prev.includes(hoja.numeroHoja)
                            ? prev.filter(n => n !== hoja.numeroHoja)
                            : [...prev, hoja.numeroHoja]
                        );
                      }}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-white border-indigo-400 shadow-xs'
                          : 'bg-slate-100/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <div className="font-black text-slate-800 flex items-center gap-1.5">
                            <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded border border-indigo-200">
                              {hoja.idHoja}
                            </span>
                            <span>Hoja {hoja.numeroHoja}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Ítems {hoja.rangoItems.desde} - {hoja.rangoItems.hasta}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        hoja.estaLlena
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {hoja.cantidad}/{hoja.capacidad} {hoja.estaLlena ? '✓' : '⚡'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resumen del reporte */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Mes de Ruta:</span>
              <strong className="text-slate-800">{config.mesRutaActual}</strong>
            </div>
            {exportFormat === 'hoja_ruta' ? (
              <div className="flex justify-between">
                <span>Boletas asignadas a {selectedAlguacil}:</span>
                <strong className="text-slate-800">
                  {boletas.filter(b => b.alguacilPractica?.toUpperCase() === selectedAlguacil.toUpperCase()).length}
                </strong>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>Total de Boletas a incluir:</span>
                <strong className="text-slate-800">
                  {selectedTribunal === 'TODOS'
                    ? boletas.length
                    : boletas.filter(b => b.tribunal.toUpperCase() === selectedTribunal.toUpperCase()).length}
                </strong>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cerrar
            </button>
            <button
              id="btn-confirmar-descarga-export"
              type="button"
              onClick={handleExport}
              className="px-5 py-2 font-black text-white bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Generar y Descargar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

