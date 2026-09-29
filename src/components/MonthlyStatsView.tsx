import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Flame, 
  Users, 
  Building2, 
  FileSpreadsheet, 
  FileText,
  TrendingUp,
  QrCode,
  FileCheck2,
  Download,
  Eye,
  Printer,
  Calendar,
  CalendarDays,
  CalendarRange,
  Search
} from 'lucide-react';
import QRCode from 'qrcode';
import { BoletaJudicial, TribunalInfo, ConfiguracionDespacho, matchesTribunal } from '../types/judicial';
import { ARTICULOS_INFO } from '../data/mockBoletas';
import { evaluarAlertaBoleta, formatFechaDisplay, parseISODate } from '../utils/alerts';
import { exportarBoletasExcel, exportarRelacionPeriodicaExcel } from '../utils/exportExcel';
import { 
  exportarBoletasPDF, 
  exportarOficioEstadisticasGlobalesPDF, 
  exportarInformeMatrizTribunalPDF,
  exportarRelacionPeriodicaPDF
} from '../utils/exportPDF';
import { encodeTribunalQRUrl, encodeGlobalQRUrl } from '../utils/qrPayloadHelper';
import { saveBoletasToServer } from '../utils/syncApi';
import { ProbarQRModal } from './ProbarQRModal';

interface MonthlyStatsViewProps {
  boletas: BoletaJudicial[];
  tribunales: TribunalInfo[];
  config: ConfiguracionDespacho;
}

export const MonthlyStatsView: React.FC<MonthlyStatsViewProps> = ({
  boletas,
  tribunales,
  config,
}) => {
  const [selectedTribunalCodeForQR, setSelectedTribunalCodeForQR] = useState(tribunales[0]?.codigo || 'C1');
  const [downloadingMsg, setDownloadingMsg] = useState('');

  // Estado para el modal de prueba y previsualización de Códigos QR
  const [qrModalInfo, setQrModalInfo] = useState<{
    isOpen: boolean;
    titulo: string;
    subtitulo: string;
    qrDataUrl: string;
    qrUrl: string;
  } | null>(null);

  // Estadísticas del tribunal actualmente seleccionado en el desplegable
  const currentTriBoletas = React.useMemo(() => {
    return boletas.filter(b => matchesTribunal(b.tribunal, selectedTribunalCodeForQR));
  }, [boletas, selectedTribunalCodeForQR]);

  const currentTriDevueltas = React.useMemo(() => {
    return currentTriBoletas.filter(b => b.devueltaAlTribunal).length;
  }, [currentTriBoletas]);

  const currentTriPct = currentTriBoletas.length > 0 
    ? Math.round((currentTriDevueltas / currentTriBoletas.length) * 100) 
    : 0;

  // Requerimiento: Para las estadísticas deben aparecer solo las boletas que fueron DEVUELTAS al tribunal,
  // con Artículo COPP y con Alguacil que practicó.
  const boletasValidasParaEstadisticas = React.useMemo(() => {
    return boletas.filter(b => {
      const devuelta = !!b.devueltaAlTribunal;
      const tieneArticulo = !!(b.articuloCOPP && b.articuloCOPP.trim() !== '') || !!(b.articulosCOPP && b.articulosCOPP.length > 0);
      const tieneAlguacil = !!(b.alguacilPractica && b.alguacilPractica.trim() !== '' && !b.alguacilPractica.toUpperCase().includes('SIN ASIGNAR') && !b.alguacilPractica.toUpperCase().includes('SIN ALGUACIL'));
      return devuelta && tieneArticulo && tieneAlguacil;
    });
  }, [boletas]);

  const total = boletasValidasParaEstadisticas.length;
  const devueltas = total;
  const boletasSinDevolver = boletas.length - boletasValidasParaEstadisticas.length;
  const conAcuse = boletasValidasParaEstadisticas.filter(b => b.acuseGenerado).length;

  let criticas = 0;
  let urgentes = 0;
  boletas.forEach(b => {
    if (!b.devueltaAlTribunal) {
      const a = evaluarAlertaBoleta(b);
      if (a.nivel === 'CRITICA') criticas++;
      if (a.nivel === 'URGENTE') urgentes++;
    }
  });

  const porcentajeEfectividad = boletas.length > 0 ? Math.round((total / boletas.length) * 100) : 0;

  // Estados para Relación por Día, Semana y Mes (Requerimiento: "guardar toda la relacion por dia semana mes")
  const [tipoPeriodoRelacion, setTipoPeriodoRelacion] = useState<'DIA' | 'SEMANA' | 'MES'>('DIA');
  const [fechaRelacion, setFechaRelacion] = useState(() => new Date().toISOString().slice(0, 10));

  // Filtrado de boletas para la Relación según el Período seleccionado
  const boletasRelacionFiltradas = React.useMemo(() => {
    if (tipoPeriodoRelacion === 'DIA') {
      return boletas.filter(b => {
        const asig = b.fechaAsignacion?.trim();
        const dev = b.fechaDevueltaTribunal?.trim();
        const aud = b.fechaAudiencia?.trim();
        return asig === fechaRelacion || dev === fechaRelacion || aud === fechaRelacion;
      });
    }

    if (tipoPeriodoRelacion === 'SEMANA') {
      const refDate = parseISODate(fechaRelacion) || new Date();
      const currentDay = refDate.getDay();
      const diffToMonday = (currentDay + 6) % 7;
      const monday = new Date(refDate);
      monday.setDate(refDate.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      return boletas.filter(b => {
        const dAsig = parseISODate(b.fechaAsignacion);
        if (dAsig && dAsig >= monday && dAsig <= sunday) return true;
        const dDev = b.fechaDevueltaTribunal ? parseISODate(b.fechaDevueltaTribunal) : null;
        if (dDev && dDev >= monday && dDev <= sunday) return true;
        return false;
      });
    }

    // Por MES: todas las boletas del mes de ruta actual o del mes de la fecha seleccionada
    const targetMonthYear = fechaRelacion.slice(0, 7);
    return boletas.filter(b => {
      if (b.mesRuta?.toUpperCase() === config.mesRutaActual.toUpperCase()) return true;
      if (b.fechaAsignacion && b.fechaAsignacion.startsWith(targetMonthYear)) return true;
      return false;
    });
  }, [boletas, tipoPeriodoRelacion, fechaRelacion, config.mesRutaActual]);

  const handleDescargarRelacionExcel = () => {
    const etiqueta = tipoPeriodoRelacion === 'DIA' 
      ? formatFechaDisplay(fechaRelacion)
      : tipoPeriodoRelacion === 'SEMANA' 
      ? `Semana_${fechaRelacion}` 
      : config.mesRutaActual;
    exportarRelacionPeriodicaExcel(boletasRelacionFiltradas, config, tipoPeriodoRelacion, etiqueta);
    setDownloadingMsg(`✓ Relación por ${tipoPeriodoRelacion} exportada a Excel exitosamente.`);
    setTimeout(() => setDownloadingMsg(''), 3000);
  };

  const handleDescargarRelacionPDF = () => {
    const etiqueta = tipoPeriodoRelacion === 'DIA' 
      ? formatFechaDisplay(fechaRelacion)
      : tipoPeriodoRelacion === 'SEMANA' 
      ? `Semana_${fechaRelacion}` 
      : config.mesRutaActual;
    exportarRelacionPeriodicaPDF(boletasRelacionFiltradas, config, tipoPeriodoRelacion, etiqueta, 'descargar');
    setDownloadingMsg(`✓ Relación por ${tipoPeriodoRelacion} descargada en PDF exitosamente.`);
    setTimeout(() => setDownloadingMsg(''), 3000);
  };

  const handleImprimirRelacionPDF = () => {
    const etiqueta = tipoPeriodoRelacion === 'DIA' 
      ? formatFechaDisplay(fechaRelacion)
      : tipoPeriodoRelacion === 'SEMANA' 
      ? `Semana_${fechaRelacion}` 
      : config.mesRutaActual;
    exportarRelacionPeriodicaPDF(boletasRelacionFiltradas, config, tipoPeriodoRelacion, etiqueta, 'imprimir');
  };

  const handleDescargarOficioGlobal = async () => {
    setDownloadingMsg('Generando Oficio de Rendición de Estadísticas Globales por Artículos del COPP (QR)...');
    try {
      saveBoletasToServer(boletas).catch(() => {});
      const boletasAEnviar = boletasValidasParaEstadisticas.length > 0 ? boletasValidasParaEstadisticas : boletas;
      await exportarOficioEstadisticasGlobalesPDF(boletasAEnviar, tribunales, config, 'descargar');
      setDownloadingMsg('¡Oficio Global descargado exitosamente!');
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al generar el oficio');
    }
    setTimeout(() => setDownloadingMsg(''), 3500);
  };

  const handleImprimirOficioGlobal = async () => {
    setDownloadingMsg('Preparando impresión del Oficio Global...');
    try {
      const boletasAEnviar = boletasValidasParaEstadisticas.length > 0 ? boletasValidasParaEstadisticas : boletas;
      await exportarOficioEstadisticasGlobalesPDF(boletasAEnviar, tribunales, config, 'imprimir');
      setDownloadingMsg('');
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al preparar impresión');
    }
    setTimeout(() => setDownloadingMsg(''), 2500);
  };

  const handleDescargarOficioTribunal = async (triObj?: TribunalInfo) => {
    const targetTri = triObj || tribunales.find(t => t.codigo === selectedTribunalCodeForQR) || tribunales[0];
    if (!targetTri) return;
    setDownloadingMsg(`Generando Oficio de Rendición con QR para ${targetTri.codigo}...`);
    try {
      saveBoletasToServer(boletas).catch(() => {});
      await exportarInformeMatrizTribunalPDF(targetTri, boletas, config, 'descargar');
      setDownloadingMsg(`¡Oficio de Rendición con QR para ${targetTri.codigo} descargado!`);
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al generar el oficio');
    }
    setTimeout(() => setDownloadingMsg(''), 3500);
  };

  const handleImprimirOficioTribunal = async (triObj?: TribunalInfo) => {
    const targetTri = triObj || tribunales.find(t => t.codigo === selectedTribunalCodeForQR) || tribunales[0];
    if (!targetTri) return;
    setDownloadingMsg(`Preparando Oficio de Rendición para ${targetTri.codigo}...`);
    try {
      await exportarInformeMatrizTribunalPDF(targetTri, boletas, config, 'imprimir');
      setDownloadingMsg('');
    } catch (e) {
      console.error(e);
      setDownloadingMsg('Error al preparar impresión');
    }
    setTimeout(() => setDownloadingMsg(''), 2500);
  };

  const handleProbarQRGlobal = async () => {
    try {
      const tot167 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '167')).length;
      const tot168 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '168')).length;
      const tot169 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '169')).length;
      const tot170 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '170')).length;
      const tot171 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '171')).length;
      const tot165 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '165')).length;
      const totS165 = boletasValidasParaEstadisticas.filter(b => hasArticulo(b, 'S_165')).length;
      const coppCounts = [tot167, tot168, tot169, tot170, tot171, tot165, totS165];

      const url = encodeGlobalQRUrl(total, devueltas, porcentajeEfectividad, coppCounts, config);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 600,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });

      setQrModalInfo({
        isOpen: true,
        titulo: 'Código QR Oficial: Rendición Global del COPP',
        subtitulo: 'Certificación consolidada de los 11 despachos judiciales con tipificación legal',
        qrDataUrl: dataUrl,
        qrUrl: url,
      });
    } catch (err) {
      console.error('Error generando QR global para prueba:', err);
    }
  };

  const handleProbarQRTribunal = async () => {
    try {
      const targetTri = tribunales.find(t => t.codigo === selectedTribunalCodeForQR) || tribunales[0];
      if (!targetTri) return;

      const url = encodeTribunalQRUrl(targetTri.codigo, targetTri.nombre, boletas, config);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 600,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });

      setQrModalInfo({
        isOpen: true,
        titulo: `Código QR Oficial: ${targetTri.nombre} (${targetTri.codigo})`,
        subtitulo: `Oficio formal de rendición de cuentas con matriz de 7 Artículos del COPP`,
        qrDataUrl: dataUrl,
        qrUrl: url,
      });
    } catch (err) {
      console.error('Error generando QR de tribunal para prueba:', err);
    }
  };

  // Helper para verificar presencia de artículo (simple o múltiple)
  const hasArticulo = (b: BoletaJudicial, artCodigo: string) => {
    if (b.articulosCOPP && b.articulosCOPP.includes(artCodigo as any)) return true;
    if (b.articuloCOPP && b.articuloCOPP.includes(artCodigo)) return true;
    return false;
  };

  // Conteo por Artículo COPP (solo boletas devueltas válidas)
  const countArticulos = {
    '165': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '165')).length,
    '167': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '167')).length,
    '168': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '168')).length,
    '169': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '169')).length,
    '170': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '170')).length,
    '171': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, '171')).length,
    'S_165': boletasValidasParaEstadisticas.filter(b => hasArticulo(b, 'S_165') || hasArticulo(b, 'S 165')).length,
  };

  // Clasificación legal de resultados:
  // Todos los artículos son POSITIVOS menos el 171 que es NEGATIVO (Negativa).
  // El 169 es POSITIVO pero por MEDIO TELEMÁTICO (correo, fax, teléfono).
  const totalPositivos = countArticulos['165'] + countArticulos['167'] + countArticulos['168'] + countArticulos['169'] + countArticulos['170'] + countArticulos['S_165'];
  const totalNegativos = countArticulos['171'];
  const totalTelematicos = countArticulos['169'];
  const totalPresenciales = totalPositivos - totalTelematicos;

  // Conteo por Alguacil (solo boletas devueltas con resultado)
  const alguacilesStats = React.useMemo(() => {
    const map: Record<string, { total: number; devueltas: number; positivos: number; negativos: number; telematicos: number }> = {};
    boletasValidasParaEstadisticas.forEach(b => {
      const alg = b.alguacilPractica?.trim() || 'SIN ASIGNAR';
      if (!map[alg]) map[alg] = { total: 0, devueltas: 0, positivos: 0, negativos: 0, telematicos: 0 };
      map[alg].total++;
      map[alg].devueltas++;
      if (hasArticulo(b, '171')) {
        map[alg].negativos++;
      } else {
        map[alg].positivos++;
        if (hasArticulo(b, '169')) map[alg].telematicos++;
      }
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [boletasValidasParaEstadisticas]);

  return (
    <div className="space-y-5">
      {/* Header de Estadísticas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Informe Estadístico Mensual de Boletas y Alguacilazgo
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ruta {config.mesRutaActual} • {config.circuitoJudicial}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDescargarOficioGlobal}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Descargar Oficio Formal de Estadísticas Globales con Código QR para Presidencia"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Descargar Oficio Global (PDF)</span>
          </button>
          <button
            onClick={() => exportarBoletasExcel(boletas, config)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Descargar archivo Excel con todas las boletas y pestañas por tribunal"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>
          <button
            onClick={() => exportarBoletasPDF(boletas, config, undefined, { modoSalida: 'descargar' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Descargar archivo físico PDF con todas las hojas"
          >
            <Download className="w-4 h-4" />
            <span>Descargar PDF</span>
          </button>
          <button
            onClick={() => exportarBoletasPDF(boletas, config, undefined, { modoSalida: 'imprimir' })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Imprimir listado directamente sin descargar"
          >
            <Printer className="w-4 h-4 text-indigo-300" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {downloadingMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Clock className="w-4 h-4 animate-spin text-indigo-600" />
          <span>{downloadingMsg}</span>
        </div>
      )}

      {/* SECCIÓN INSTITUCIONAL: OFICIOS CON CÓDIGO QR */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-lg shadow-2xs border border-slate-800">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Unidad de Actos y Comunicación
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded">
                  Validación Oficial QR
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Emisión de Oficios Institucionales y Rendición de Cuentas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Certificación procesal por Artículos del COPP, efectividad de entrega y validación digital mediante Código QR
              </p>
            </div>
          </div>
          <span className="self-start sm:self-center text-[11px] px-3 py-1 bg-white border border-slate-200 text-slate-700 font-mono rounded-md shadow-2xs">
            Formato A4 • Membrete y Firmas
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/30">
          {/* OFICIO 1: GLOBAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Presidencia del Circuito • Global
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  11 Tribunales
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                Oficio: Rendición de Estadísticas Globales por Artículos del COPP
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Documento rector consolidado dirigido a la Presidencia del Circuito Judicial Penal. Incluye la matriz de los 11 tribunales, tipificación legal de los 7 Artículos del COPP (167 al S 165), efectividad global porcentual, firmas del Alguacilazgo y <strong>Código QR de validación institucional</strong>.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  id="btn-descargar-oficio-global-copp"
                  type="button"
                  onClick={handleDescargarOficioGlobal}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer hover:shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Descargar Oficio Global (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={handleImprimirOficioGlobal}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Imprimir Oficio Global</span>
                </button>
              </div>

              <button
                id="btn-probar-qr-global"
                type="button"
                onClick={handleProbarQRGlobal}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-slate-300"
                title="Probar y escanear el código QR directamente en pantalla"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Ver y Probar Código QR en Pantalla</span>
              </button>
            </div>
          </div>

          {/* OFICIO 2: POR TRIBUNAL */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-all overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Por Despacho Judicial • Juez y Secretaría
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  Formato Ejecutivo
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                Oficio de Rendición por Tribunal (Artículos del COPP y QR)
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Oficio formal individualizado para el Juez(a) y Secretario(a) del tribunal seleccionado. Certifica las diligencias asignadas y practicadas, matriz de los 7 Artículos del COPP, porcentaje de efectividad y firmas. <em>Formato ejecutivo oficial sin listado individual de boletas.</em>
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Seleccionar Despacho:</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {currentTriBoletas.length} Asignadas • {currentTriDevueltas} Practicadas ({currentTriPct}%)
                  </span>
                </div>

                <div className="relative">
                  <select
                    id="select-tribunal-oficio-qr"
                    value={selectedTribunalCodeForQR}
                    onChange={(e) => setSelectedTribunalCodeForQR(e.target.value)}
                    className="w-full min-w-0 max-w-full bg-slate-50 hover:bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white shadow-2xs transition-colors truncate cursor-pointer"
                  >
                    {tribunales.map((t) => {
                      const cBoletas = boletas.filter(b => (b.tribunal || '').toUpperCase() === t.codigo.toUpperCase());
                      const cDev = cBoletas.filter(b => b.devueltaAlTribunal).length;
                      return (
                        <option key={t.codigo} value={t.codigo} className="text-slate-900 font-medium">
                          {t.codigo} - {t.nombre} ({cBoletas.length} asignadas, {cDev} practicadas)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  id="btn-descargar-oficio-tribunal-qr"
                  type="button"
                  onClick={() => handleDescargarOficioTribunal()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer hover:shadow-md"
                  title={`Descargar Oficio de Rendición con QR para ${selectedTribunalCodeForQR}`}
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Descargar ({selectedTribunalCodeForQR})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleImprimirOficioTribunal()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer border border-indigo-700"
                  title={`Imprimir Oficio de Rendición con QR para ${selectedTribunalCodeForQR}`}
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Imprimir ({selectedTribunalCodeForQR})</span>
                </button>
              </div>

              <button
                id="btn-probar-qr-tribunal"
                type="button"
                onClick={handleProbarQRTribunal}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-800 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-indigo-200"
                title={`Probar y escanear el código QR del despacho ${selectedTribunalCodeForQR} en pantalla`}
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ver y Probar Código QR en Pantalla ({selectedTribunalCodeForQR})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MÓDULO: GUARDAR Y EXPORTAR RELACIÓN POR DÍA, SEMANA Y MES (REQUERIMIENTO OFICIAL) */}
      <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/40 rounded-xl text-indigo-300 shadow-md">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Control Periódico Judicial
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold rounded">
                  Excel y PDF Oficial
                </span>
              </div>
              <h3 className="text-sm font-black text-white tracking-tight mt-0.5">
                Guardar y Exportar Relación por Día, Semana y Mes
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Genera la relación completa y detallada de boletas u oficios del despacho judicial según el período deseado.
              </p>
            </div>
          </div>

          {/* Selector de Período */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-indigo-800/80 shrink-0">
            <button
              type="button"
              onClick={() => setTipoPeriodoRelacion('DIA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tipoPeriodoRelacion === 'DIA'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Por Día</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodoRelacion('SEMANA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tipoPeriodoRelacion === 'SEMANA'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Por Semana</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoPeriodoRelacion('MES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tipoPeriodoRelacion === 'MES'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Por Mes</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtro de Fecha y Acciones de Descarga */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 uppercase text-[11px]">
                {tipoPeriodoRelacion === 'DIA' ? 'Fecha de la Relación:' : tipoPeriodoRelacion === 'SEMANA' ? 'Semana de Referencia:' : 'Mes de la Relación:'}
              </span>
              <input
                type="date"
                value={fechaRelacion}
                onChange={(e) => setFechaRelacion(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 shadow-2xs">
              <span>Registros en esta relación: <strong className="text-indigo-700 font-mono text-sm">{boletasRelacionFiltradas.length}</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">Devueltas: {boletasRelacionFiltradas.filter(b => b.devueltaAlTribunal).length}</span>
              <span>•</span>
              <span className="text-amber-700 font-bold">En Ruta: {boletasRelacionFiltradas.filter(b => !b.devueltaAlTribunal).length}</span>
            </div>
          </div>

          {/* Botones para Guardar e Imprimir la Relación */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDescargarRelacionExcel}
              disabled={boletasRelacionFiltradas.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Guardar y descargar la relación en formato Microsoft Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Guardar en Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDescargarRelacionPDF}
              disabled={boletasRelacionFiltradas.length === 0}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Guardar y descargar la relación oficial en archivo PDF con membrete y firmas"
            >
              <Download className="w-4 h-4 text-indigo-200" />
              <span>Guardar en PDF (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleImprimirRelacionPDF}
              disabled={boletasRelacionFiltradas.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Imprimir directamente la relación judicial"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Vista Previa de la Relación (Primeros registros) */}
        {boletasRelacionFiltradas.length > 0 ? (
          <div className="overflow-x-auto max-h-60 border-t border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-8 text-center">#</th>
                  <th className="py-2 px-3">F. Asignación</th>
                  <th className="py-2 px-3">Causa Nº</th>
                  <th className="py-2 px-3 text-center">Boleta</th>
                  <th className="py-2 px-3 text-center">Oficio</th>
                  <th className="py-2 px-3">Notificado / Citado</th>
                  <th className="py-2 px-3 text-center">Carácter</th>
                  <th className="py-2 px-3 text-center">Tri</th>
                  <th className="py-2 px-3">Alguacil</th>
                  <th className="py-2 px-3 text-center">Art.</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {boletasRelacionFiltradas.slice(0, 15).map((b, idx) => (
                  <tr key={b.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-mono text-slate-600">{b.fechaAsignacion ? formatFechaDisplay(b.fechaAsignacion) : '-'}</td>
                    <td className="py-1.5 px-3 font-mono font-bold text-blue-900">{b.numeroCausa}</td>
                    <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-800">{b.boletaNumero}</td>
                    <td className="py-1.5 px-3 text-center font-mono text-slate-600">{b.numeroOficio || '-'}</td>
                    <td className="py-1.5 px-3 font-medium text-slate-800">{b.notificadoCitado}</td>
                    <td className="py-1.5 px-3 text-center font-bold text-slate-600">{b.tipoCitado}</td>
                    <td className="py-1.5 px-3 text-center font-bold text-slate-700">{b.tribunalOtro || b.tribunal}</td>
                    <td className="py-1.5 px-3 text-slate-700">{b.alguacilPractica || 'SIN ASIGNAR'}</td>
                    <td className="py-1.5 px-3 text-center font-bold text-slate-700">{b.articuloCOPP || '-'}</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.devueltaAlTribunal
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.devueltaAlTribunal ? 'DEVUELTA' : 'EN RUTA'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {boletasRelacionFiltradas.length > 15 && (
              <div className="py-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                Mostrando 15 de {boletasRelacionFiltradas.length} boletas. Al descargar en Excel o PDF se exportará la totalidad de la relación.
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 bg-slate-50">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-xs text-slate-600">No hay boletas u oficios registrados en el período seleccionado ({tipoPeriodoRelacion}: {formatFechaDisplay(fechaRelacion)}).</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Seleccione otra fecha o cambie el período para generar la relación.</p>
          </div>
        )}
      </div>

      {/* Nota de Regla de Rendición de Cuentas */}
      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-blue-600 text-white rounded-md text-[10px] font-black uppercase">
            Criterio Oficial
          </span>
          <span className="font-semibold">
            Solo se computan boletas <strong>Devueltas al Tribunal</strong> con Alguacil y Artículo COPP asignados.
          </span>
        </div>
        <div className="text-[11px] font-medium text-blue-800">
          Total devueltas computables: <strong className="font-mono text-sm">{total}</strong> | Pendientes en despacho: <strong className="font-mono text-sm">{boletasSinDevolver}</strong>
        </div>
      </div>

      {/* Tarjetas KPIs con desglose Positivo / Negativo / Telemático */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Devueltas Computables</span>
            <span className="p-1 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">Tribunal</span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Con Art. COPP y Alguacil asignado</p>
        </div>

        {/* Resultados Positivos */}
        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">Resultados Positivos</span>
            <span className="p-1 rounded-md bg-emerald-100 text-emerald-900 font-black text-[10px]">
              {total > 0 ? Math.round((totalPositivos / total) * 100) : 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{totalPositivos} <span className="text-xs font-semibold text-emerald-600">/ {total}</span></p>
          <p className="text-[11px] text-emerald-800 mt-1">
            {totalPresenciales} presenciales + <strong>{totalTelematicos} telemáticos (Art. 169)</strong>
          </p>
        </div>

        {/* Resultados Negativos (Art. 171) */}
        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-rose-800 tracking-wider">Resultados Negativos</span>
            <span className="p-1 rounded-md bg-rose-100 text-rose-900 font-black text-[10px]">
              {total > 0 ? Math.round((totalNegativos / total) * 100) : 0}%
            </span>
          </div>
          <p className="text-2xl font-black text-rose-700 mt-2">{totalNegativos} <span className="text-xs font-semibold text-rose-600">/ {total}</span></p>
          <p className="text-[11px] text-rose-800 mt-1">Art. 171 (Fijación de Cartel / No Localizado)</p>
        </div>

        {/* En Trámite / Pendientes */}
        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-800 tracking-wider">Pendientes de Devolución</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{boletasSinDevolver}</p>
          <p className="text-[11px] text-amber-800 mt-1">Por practicar o por devolver al tribunal</p>
        </div>
      </div>

      {/* Distribución por Artículos COPP y Tribunales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Distribución por Artículo COPP */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Distribución por Artículos del COPP (Devueltas)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Todos positivos excepto Art. 171 (Negativo) • Art. 169 (Medio Telemático)
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-bold">{total} Boletas</span>
          </div>

          <div className="space-y-3.5">
            {(['165', '167', '168', '169', '170', '171', 'S_165'] as const).map((key) => {
              const info = ARTICULOS_INFO[key];
              const count = countArticulos[key as keyof typeof countArticulos] || 0;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              const esNegativo = key === '171';
              const esTelematico = key === '169';

              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${info.colorBg}`}></span>
                      <span className="text-slate-800 font-bold">{info.nombre}</span>
                      {esNegativo ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                          Negativo
                        </span>
                      ) : esTelematico ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-900 border border-blue-300 uppercase">
                          Positivo (Medio Telemático)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase">
                          Positivo
                        </span>
                      )}
                    </div>
                    <span className="text-slate-700 font-mono font-bold">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${info.colorBg}`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por Tribunal */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-600" />
              Carga de Trabajo por Tribunal
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">11 Despachos Judiciales</span>
          </div>

          <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
            {tribunales.map((tri) => {
              const boletasTri = boletas.filter(b => b.tribunal.toUpperCase() === tri.codigo.toUpperCase());
              const count = boletasTri.length;
              const dev = boletasTri.filter(b => b.devueltaAlTribunal).length;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={tri.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-black text-[10px]">
                      {tri.codigo}
                    </span>
                    <span className="font-semibold text-slate-800 truncate max-w-[160px] sm:max-w-[220px]">
                      {tri.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-emerald-700 font-bold text-[11px] hidden sm:inline">
                      {dev}/{count} Devueltas
                    </span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-extrabold rounded text-[10px]">
                      {count}
                    </span>
                    <button
                      onClick={() => handleDescargarOficioTribunal(tri)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[10px] transition-colors cursor-pointer shadow-2xs"
                      title={`Descargar Oficio de Rendición con QR para ${tri.codigo}`}
                    >
                      <QrCode className="w-3 h-3 text-amber-400" />
                      <span>Oficio QR</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rendimiento por Alguacil */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-600" />
            Rendimiento y Asignaciones por Alguacil
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Funcionarios de Citación</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {alguacilesStats.map(([nombre, stat]) => {
            const efectividad = stat.total > 0 ? Math.round((stat.devueltas / stat.total) * 100) : 0;

            return (
              <div key={nombre} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-900">{nombre}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    {stat.total} boletas
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between mb-1">
                  <span>Devueltas:</span>
                  <span className="font-bold text-emerald-700">{stat.devueltas} / {stat.total}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-1.5 rounded-full" 
                    style={{ width: `${efectividad}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-right font-semibold text-slate-500 mt-1">
                  {efectividad}% de efectividad
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Probar y Escanear el Código QR en Pantalla */}
      {qrModalInfo && (
        <ProbarQRModal
          isOpen={qrModalInfo.isOpen}
          onClose={() => setQrModalInfo(null)}
          titulo={qrModalInfo.titulo}
          subtitulo={qrModalInfo.subtitulo}
          qrDataUrl={qrModalInfo.qrDataUrl}
          qrUrl={qrModalInfo.qrUrl}
          onAbrirValidacion={() => {
            window.location.href = qrModalInfo.qrUrl;
          }}
        />
      )}
    </div>
  );
};
