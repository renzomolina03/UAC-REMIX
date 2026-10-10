import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { 
  BoletaJudicial, 
  ConfiguracionDespacho, 
  TribunalInfo, 
  ArticuloCOPP,
  hasArticulo, 
  matchesTribunal,
  getCaracterDisplay, 
  getCaracterPriority 
} from '../types/judicial';
import { formatFechaDisplay, evaluarAlertaBoleta } from './alerts';
import { calcularHojasLote, HojaLote } from './sheetCalculation';
import { encodeTribunalQRUrl, encodeGlobalQRUrl } from './qrPayloadHelper';

// Extender tipos de jsPDF para autotable
interface jsPDFWithPlugin extends jsPDF {
  lastAutoTable?: {
    finalY?: number;
  };
}

export type ModoSalidaDocumento = 'imprimir' | 'descargar';

export interface OpcionesImpresionHojas {
  hojasSeleccionadas?: number[]; // números de hoja a imprimir (1-based), ej: [1, 2]
  capacidadPorHoja?: number; // por defecto 30 boletas por hoja
  idInicial?: string; // por defecto 'uac0001'
  seccion?: string; // sección de trabajo (ej: 'SOBRESEIMIENTO')
  modoSalida?: ModoSalidaDocumento; // 'imprimir' (directo sin descarga) o 'descargar' (guardar archivo)
}

/**
 * Función segura para descargar PDFs en cualquier navegador y SO,
 * evitando caracteres inválidos como ':' o '/' en el nombre de archivo,
 * con fallback directo a Blob si doc.save es bloqueado.
 */
export function safeSavePDF(doc: jsPDF, rawFileName: string) {
  const sanitized = (rawFileName || 'documento.pdf')
    .replace(/[:*?"<>|\\/]/g, '_')
    .replace(/\s+/g, '_')
    .trim();

  try {
    doc.save(sanitized);
  } catch (saveErr) {
    console.warn('doc.save falló, ejecutando descarga vía Blob:', saveErr);
    try {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sanitized;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (blobErr) {
      console.error('Error definitivo al generar descarga del PDF:', blobErr);
      alert('No se pudo iniciar la descarga automática del archivo PDF.');
    }
  }
}

/**
 * Envía el contenido HTML oficial a la impresora configurado específicamente para Hoja Tipo Oficio Vertical.
 * Utiliza un iframe invisible dedicado con estilos completos e independientes para garantizar
 * que el diálogo nativo de la impresora siempre muestre el documento nítido y completo.
 */
export function imprimirHtmlDirecto(htmlContent: string) {
  try {
    // 1. Inyectar en #uac-print-area para soporte de window.print()
    let printArea = document.getElementById('uac-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'uac-print-area';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = htmlContent;

    // 2. Crear iframe aislado temporal para ejecutar el diálogo de la impresora de forma infalible
    const iframeId = 'uac-direct-print-iframe';
    let printIframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    if (printIframe) {
      try {
        printIframe.remove();
      } catch (e) {}
    }

    printIframe = document.createElement('iframe');
    printIframe.id = iframeId;
    printIframe.setAttribute('style', 'position: fixed; top: -10000px; left: -10000px; width: 1000px; height: 1400px; opacity: 0; pointer-events: none; border: none;');
    document.body.appendChild(printIframe);

    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Impresión Oficial Judicial</title>
          <style>
            @page {
              size: legal portrait;
              margin: 6mm 8mm 6mm 8mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .hoja-pagina-oficio {
              page-break-after: always;
              break-after: page;
              margin-bottom: 20px;
            }
            .hoja-pagina-oficio:last-child {
              page-break-after: auto;
              break-after: auto;
              margin-bottom: 0;
            }
            table {
              page-break-inside: auto;
              break-inside: auto;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            td {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          if (printIframe?.contentWindow) {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
            return;
          }
        } catch (iframeErr) {
          console.warn('Iframe print error, usando window.print():', iframeErr);
        }
        window.focus();
        window.print();
      }, 250);
      return;
    }
  } catch (err) {
    console.error('Error al preparar impresión directa:', err);
  }

  // Fallback directo en ventana principal
  setTimeout(() => {
    window.focus();
    window.print();
  }, 200);
}

/**
 * Genera el documento HTML correspondiente a las hojas del lote en formato oficial Hoja Tipo Oficio Vertical
 */
export function generarHtmlHojaOficio(
  hojas: HojaLote[],
  config: ConfiguracionDespacho,
  filtroTribunal?: string,
  esSobreseimiento?: boolean
): string {
  return hojas.map((hoja, idx) => {
    const alguacilesEnEstaHoja = Array.from(
      new Set(
        hoja.boletas
          .map(b => (b.alguacilPractica || '').trim())
          .filter(a => a && !a.toUpperCase().includes('SIN ALGUACIL') && !a.toUpperCase().includes('SIN ASIGNAR'))
      )
    );
    const textoAlguaciles = alguacilesEnEstaHoja.length > 0
      ? `Alguacil(es): ${alguacilesEnEstaHoja.join(' - ')}`
      : 'Alguacil: Sin Asignar';
    const textoFecha = hoja.fechaAsignacion 
      ? `Fecha Asig: ${formatFechaDisplay(hoja.fechaAsignacion)}`
      : `Fecha: ${new Date().toLocaleDateString('es-ES')}`;

    const idUacFormateado = hoja.idHoja.toUpperCase().startsWith('UAC')
      ? hoja.idHoja.toUpperCase()
      : `UAC: ${hoja.idHoja.padStart(4, '0')}`;

    const rows = hoja.boletas.map((b, rowIdx) => {
      const itemNum = b.numeroItem !== undefined ? b.numeroItem : (hoja.rangoItems ? (hoja.rangoItems.desde + rowIdx) : (rowIdx + 1));
      const algStr = (b.alguacilPractica || '').trim();
      const algUpper = algStr.toUpperCase();
      const alguacilImpresion = (!algStr || algUpper.includes('SIN ALGUACIL') || algUpper.includes('SIN ASIGNAR')) ? '' : algStr;
      const fAud = (b.seccionRuta === 'SOBRESEIMIENTO' || esSobreseimiento)
        ? 'NOTIFICACIÓN SOBRESEIMIENTO'
        : ((b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia) ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia));
      const hAud = (b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia) ? '' : (b.horaAudiencia || '');

      return `
        <tr style="height: 22px; font-size: 8px; ${rowIdx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="text-align: center; font-weight: bold; width: 20px; border: 1px solid #cbd5e1;">${itemNum}</td>
          <td style="font-weight: bold; padding: 2px 4px; border: 1px solid #cbd5e1;">${b.numeroCausa}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${b.boletaNumero}</td>
          <td style="text-align: center; padding: 2px 4px; border: 1px solid #cbd5e1; font-weight: 500;">${b.notificadoCitado}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; font-size: ${fAud.includes('NOTIFICAC') ? '7px' : '8px'};">${fAud}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1;">${hAud}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${b.tribunal}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '167') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '168') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '169') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '170') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '171') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, '165') ? '1' : ''}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${hasArticulo(b, 'S_165') ? '1' : ''}</td>
          <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 7.5px;">${alguacilImpresion}</td>
        </tr>
      `;
    }).join('');

    const c = hoja.conteosArticulos;
    const fechaAsigTexto = hoja.fechaAsignacion ? formatFechaDisplay(hoja.fechaAsignacion) : formatFechaDisplay(new Date().toISOString().slice(0, 10));

    return `
      <div class="hoja-pagina-oficio" style="width: 100%; box-sizing: border-box; page-break-after: always; padding: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
        <!-- Encabezado Institucional -->
        <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px;">
          <div style="font-size: 10.5px; font-weight: bold; letter-spacing: 0.5px;">${config.entePrincipal}</div>
          <div style="font-size: 9px;">${config.circuitoJudicial}</div>
          <div style="font-size: 8.5px; opacity: 0.9;">${config.unidad}</div>
        </div>

        <!-- Subtítulo de Ruta -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: #0f172a; text-transform: uppercase;">
            ${esSobreseimiento ? 'RUTA DE SOBRESEIMIENTO' : 'RUTA DE NOTIFICACIÓN Y CITACIÓN'}
          </div>
          <div style="font-size: 9px; font-weight: bold; color: #1e293b; margin-top: 2px;">
            F. ASIG: ${fechaAsigTexto}
          </div>
          <div style="font-size: 8px; color: #475569; margin-top: 2px;">
            ${textoAlguaciles}${filtroTribunal ? ` | Tribunal: ${filtroTribunal}` : ' | Todos los Tribunales'}
          </div>
        </div>

        <!-- Tabla Oficial (con espacio ampliado al eliminar F. ASIG.) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #94a3b8;">
          <thead>
            <tr style="background-color: #1e293b; color: #ffffff; font-size: 7.5px; height: 24px;">
              <th style="border: 1px solid #64748b; width: 20px;">Nº</th>
              <th style="border: 1px solid #64748b; width: 115px; text-align: left; padding-left: 4px;">Nº CAUSA</th>
              <th style="border: 1px solid #64748b; width: 55px;">BOLETA Nº</th>
              <th style="border: 1px solid #64748b; width: 185px;">NOTIFICADO Y CITADO</th>
              <th style="border: 1px solid #64748b; width: 90px;">${esSobreseimiento ? 'NOTIF. SOBRESEIMIENTO' : 'F. AUDIENCIA'}</th>
              <th style="border: 1px solid #64748b; width: 35px;">HORA</th>
              <th style="border: 1px solid #64748b; width: 30px;">TRI</th>
              <th style="border: 1px solid #64748b; background-color: #8F9CA8; color: #000; width: 20px;">167</th>
              <th style="border: 1px solid #64748b; background-color: #5C98E2; color: #000; width: 20px;">168</th>
              <th style="border: 1px solid #64748b; background-color: #8EA8BE; color: #000; width: 20px;">169</th>
              <th style="border: 1px solid #64748b; background-color: #9DCE64; color: #000; width: 20px;">170</th>
              <th style="border: 1px solid #64748b; background-color: #E7444B; color: #000; width: 20px;">171</th>
              <th style="border: 1px solid #64748b; background-color: #FCE444; color: #000; width: 20px;">165</th>
              <th style="border: 1px solid #64748b; background-color: #DF7A40; color: #000; width: 22px;">S 165</th>
              <th style="border: 1px solid #64748b; width: 75px;">ALGUACIL</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <!-- Resumen y Firmas -->
        <div style="display: flex; justify-content: ${hoja.estaLlena ? 'space-between' : 'flex-end'}; align-items: stretch; margin-top: 8px;">
          ${hoja.estaLlena ? `
          <!-- Resumen de Folio (Solo cuando la hoja esté llena completa) -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; width: 55%; font-size: 7.5px; line-height: 1.4;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span style="font-weight: bold; color: #0f172a; font-size: 8px;">RESUMEN:</span>
              <span style="background-color: #0f172a; color: #ffffff; padding: 1.5px 5px; border-radius: 3px; font-weight: bold; font-size: 7.5px;">${idUacFormateado}</span>
            </div>
            <div>Boletas en esta Hoja: <strong>${hoja.cantidad} de ${hoja.capacidad}</strong> (LLENA)</div>
            <div>Devueltas al Tribunal: <strong>${hoja.totalDevueltas} (${hoja.porcentajeEfectividad}%)</strong> | Pendientes: <strong>${hoja.pendientes}</strong></div>
            <div>Tribunales: ${hoja.tribunalesInvolucrados.slice(0, 5).join(', ')}${hoja.tribunalesInvolucrados.length > 5 ? '...' : ''}</div>
            <div style="margin-top: 2px; font-size: 7px; color: #334155;">
              COPP: 167(${c['167']}) 168(${c['168']}) 169(${c['169']}) 170(${c['170']}) 171(${c['171']}) 165(${c['165']}) S 165(${c['S_165']})
            </div>
          </div>
          ` : ''}

          <!-- Firmas -->
          <div style="display: flex; justify-content: space-around; width: ${hoja.estaLlena ? '42%' : '50%'}; text-align: center; align-items: flex-end; padding-bottom: 4px;">
            <div style="width: 46%;">
              <div style="border-top: 1px solid #475569; padding-top: 4px; font-weight: bold; font-size: 7.5px; color: #0f172a;">ALGUACIL DISTRIBUIDOR</div>
              <div style="font-size: 6.5px; color: #64748b;">Unidad de Actos y Comunicación</div>
            </div>
            <div style="width: 46%;">
              <div style="border-top: 1px solid #475569; padding-top: 4px; font-weight: bold; font-size: 7.5px; color: #0f172a;">COORDINACIÓN / SECRETARÍA</div>
              <div style="font-size: 6.5px; color: #64748b;">Sello y Recibido Conforme</div>
            </div>
          </div>
        </div>

        <!-- Pie de Página Oficial Centrado -->
        <div style="margin-top: 6px; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 3px; text-align: center;">
          <span>Hoja Oficial: ${idUacFormateado} • Pág. ${idx + 1} de ${hojas.length}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Imprime un documento PDF directamente en el sistema sin necesidad de descargarlo primero a disco.
 * 1. Emite el evento 'uac-impresion-directa' para que el visor interactivo de la aplicación muestre la vista previa y controles inmediatos.
 * 2. Si viene contenido HTML formateado para Hoja Tipo Oficio Vertical, lo envía directamente al motor de impresión del navegador.
 */
export function safePrintPDF(
  doc: jsPDF, 
  rawFileName: string = 'documento.pdf', 
  titulo?: string,
  htmlPrintContent?: string
) {
  try {
    try {
      doc.autoPrint();
    } catch (e) {
      console.warn('doc.autoPrint no soportado:', e);
    }

    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const sanitizedTitle = (titulo || rawFileName.replace(/\.pdf$/i, '').replace(/_/g, ' ')).trim();

    // Notificar al visor de impresión directa de la aplicación
    const event = new CustomEvent('uac-impresion-directa', {
      detail: {
        blobUrl,
        fileName: rawFileName,
        doc,
        titulo: sanitizedTitle,
        htmlContent: htmlPrintContent,
      }
    });
    window.dispatchEvent(event);

    // Si viene contenido HTML preparado para imprimir, enviarlo de inmediato
    if (htmlPrintContent) {
      imprimirHtmlDirecto(htmlPrintContent);
    }

  } catch (err) {
    console.error('Error al preparar impresión directa:', err);
    safeSavePDF(doc, rawFileName);
  }
}

/**
 * Procesa la salida del documento PDF según la preferencia del usuario:
 * - 'imprimir': imprime directamente en el sistema sin descargar el archivo.
 * - 'descargar': guarda el archivo físico en el disco de la computadora.
 */
export function procesarSalidaPDF(
  doc: jsPDF, 
  rawFileName: string, 
  modo: ModoSalidaDocumento = 'imprimir', 
  titulo?: string,
  htmlPrintContent?: string
) {
  if (modo === 'imprimir') {
    safePrintPDF(doc, rawFileName, titulo, htmlPrintContent);
  } else {
    safeSavePDF(doc, rawFileName);
  }
}

export function exportarBoletasPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  filtroTribunal?: string,
  opcionesHojas?: OpcionesImpresionHojas
) {
  const boletasAExportar = filtroTribunal
    ? boletas.filter(b => b.tribunal.toUpperCase() === filtroTribunal.toUpperCase())
    : boletas;

  if (boletasAExportar.length === 0) {
    alert('No hay boletas en el listado para generar el documento.');
    return;
  }

  const capacidad = opcionesHojas?.capacidadPorHoja || 40;
  const idInicial = opcionesHojas?.idInicial || 'UAC: 0001';
  
  // Calcular todas las hojas del lote según su capacidad y cortes de página
  const todasLasHojas = calcularHojasLote(boletasAExportar, capacidad, idInicial);

  // Filtrar las hojas que el usuario seleccionó para imprimir (o imprimir todas si no hay filtro)
  const hojasAImprimir = (opcionesHojas?.hojasSeleccionadas && opcionesHojas.hojasSeleccionadas.length > 0)
    ? todasLasHojas.filter(h => opcionesHojas.hojasSeleccionadas!.includes(h.numeroHoja))
    : todasLasHojas;

  if (hojasAImprimir.length === 0) {
    alert('No has seleccionado ninguna hoja para imprimir.');
    return;
  }

  // Configurado estrictamente en Hoja Tipo Oficio Vertical (Legal Portrait: 215.9 x 355.6 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const esSobreseimiento = opcionesHojas?.seccion === 'SOBRESEIMIENTO' || 
    (boletasAExportar.length > 0 && boletasAExportar.every(b => b.seccionRuta === 'SOBRESEIMIENTO'));

  // Columnas para la tabla del listado (ampliadas al suprimir F. ASIG.)
  const tableHeaders = [
    'Nº',
    'Nº CAUSA',
    'BOLETA Nº',
    'NOTIFICADO Y CITADO',
    esSobreseimiento ? 'NOTIFICACIÓN SOBRESEIMIENTO' : 'F. AUDIENCIA',
    'HORA',
    'TRI',
    '167',
    '168',
    '169',
    '170',
    '171',
    '165',
    'S 165',
    'ALGUACIL',
  ];

  // Renderizar cada hoja seleccionada en su propia página física tipo Oficio Vertical
  hojasAImprimir.forEach((hoja, sheetIdx) => {
    if (sheetIdx > 0) {
      doc.addPage('legal', 'portrait');
    }

    // 1. Encabezado institucional superior (ancho de hoja oficio: 215.9mm)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 215.9, 15, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, 107.95, 5.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, 107.95, 9.5, { align: 'center' });
    doc.text(config.unidad, 107.95, 13, { align: 'center' });

    // 2. Subtítulo de ruta (Izquierda)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const fechaAsigDoc = hoja.fechaAsignacion ? formatFechaDisplay(hoja.fechaAsignacion) : formatFechaDisplay(new Date().toISOString().slice(0, 10));
    const tituloRuta = esSobreseimiento
      ? 'RUTA DE SOBRESEIMIENTO'
      : 'RUTA DE NOTIFICACIÓN Y CITACIÓN';
    doc.text(tituloRuta, 8, 19.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`F. ASIG: ${fechaAsigDoc}`, 8, 23.5);

    // Detección precisa de alguaciles asignados en esta hoja
    const alguacilesEnEstaHoja = Array.from(
      new Set(
        hoja.boletas
          .map(b => (b.alguacilPractica || '').trim())
          .filter(a => a && !a.toUpperCase().includes('SIN ALGUACIL') && !a.toUpperCase().includes('SIN ASIGNAR'))
      )
    );

    const textoAlguaciles = alguacilesEnEstaHoja.length > 0
      ? `Alguacil(es): ${alguacilesEnEstaHoja.join(' - ')}`
      : 'Alguacil: Sin Asignar';

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${textoAlguaciles}${filtroTribunal ? ` | Tribunal: ${filtroTribunal}` : ' | Todos los Tribunales'}`,
      8,
      27
    );

    // 4. Preparar filas de la tabla correspondientes a esta hoja
    const tableBody = hoja.boletas.map((b, idx) => {
      const itemNum = b.numeroItem !== undefined ? b.numeroItem : (hoja.rangoItems ? (hoja.rangoItems.desde + idx) : (idx + 1));
      const algStr = (b.alguacilPractica || '').trim();
      const algUpper = algStr.toUpperCase();
      const alguacilImpresion = (!algStr || algUpper.includes('SIN ALGUACIL') || algUpper.includes('SIN ASIGNAR')) ? '' : algStr;

      return [
        itemNum,
        b.numeroCausa,
        b.boletaNumero,
        b.notificadoCitado,
        (b.seccionRuta === 'SOBRESEIMIENTO' || esSobreseimiento) 
          ? 'NOTIFICACIÓN SOBRESEIMIENTO' 
          : ((b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia) ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia)),
        (b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia) ? '' : (b.horaAudiencia || ''),
        b.tribunal,
        hasArticulo(b, '167') ? '1' : '',
        hasArticulo(b, '168') ? '1' : '',
        hasArticulo(b, '169') ? '1' : '',
        hasArticulo(b, '170') ? '1' : '',
        hasArticulo(b, '171') ? '1' : '',
        hasArticulo(b, '165') ? '1' : '',
        hasArticulo(b, 'S_165') ? '1' : '',
        alguacilImpresion,
      ];
    });

    // 5. Generar tabla de la hoja con jspdf-autotable ajustada para Hoja Tipo Oficio Vertical (ancho útil: ~199.9mm)
    autoTable(doc, {
      startY: 29.5,
      margin: { left: 8, right: 8 },
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 6.8,
        cellPadding: 1,
        minCellHeight: 5.5,
        valign: 'middle',
        font: 'helvetica',
        textColor: [15, 23, 42],
      },
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 6 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 }, // Nº CAUSA ampliado
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 }, // BOLETA Nº
        3: { halign: 'center', cellWidth: 50 }, // NOTIFICADO Y CITADO ampliado
        4: { halign: 'center', cellWidth: 22 }, // F. AUDIENCIA
        5: { halign: 'center', cellWidth: 9 }, // HORA
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 8 }, // TRI
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 167
        8: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 168
        9: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 169
        10: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 170
        11: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 171
        12: { halign: 'center', fontStyle: 'bold', cellWidth: 5.8 }, // 165
        13: { halign: 'center', fontStyle: 'bold', cellWidth: 6.3 }, // S 165
        14: { halign: 'center', cellWidth: 19 },   // ALGUACIL
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw || '').toUpperCase();
          if (val.includes('NOTIFICAC')) {
            data.cell.styles.fontSize = 6.2;
            data.cell.styles.cellPadding = 0.5;
          }
        }
        if (data.section === 'head') {
          if (data.column.index === 7) { // 167 Gris
            data.cell.styles.fillColor = [143, 156, 168];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 8) { // 168 Azul
            data.cell.styles.fillColor = [92, 152, 226];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 9) { // 169 Azul Acero
            data.cell.styles.fillColor = [142, 168, 190];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 10) { // 170 Verde Lima
            data.cell.styles.fillColor = [157, 206, 100];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 11) { // 171 Rojo
            data.cell.styles.fillColor = [231, 68, 75];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 12) { // 165 Amarillo
            data.cell.styles.fillColor = [252, 228, 68];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 13) { // S 165 Naranja
            data.cell.styles.fillColor = [223, 122, 64];
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });

    // 6. Resumen y Firmas oficiales de esta hoja al pie de la página
    const tableEnd = doc.lastAutoTable?.finalY || 200;
    const finalY = Math.max(tableEnd + 4, 230);

    renderSheetSummaryAndSignatures(doc, config, hoja, todasLasHojas.length, finalY);

    // Pie de página de seguridad Centrado: Hoja Oficial: UAC: 0001 • Pág. 1 de 1
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    const idUacCentrado = hoja.idHoja.toUpperCase().startsWith('UAC')
      ? hoja.idHoja.toUpperCase()
      : `UAC: ${hoja.idHoja.padStart(4, '0')}`;
    doc.text(
      `Hoja Oficial: ${idUacCentrado} • Pág. ${sheetIdx + 1} de ${hojasAImprimir.length}`,
      107.95,
      350,
      { align: 'center' }
    );
  });

  // Guardar archivo PDF con nombre descriptivo y sanitizado
  let fileName = '';
  if (hojasAImprimir.length === 1) {
    fileName = `Listado_Boletas_Hoja_${hojasAImprimir[0].idHoja}_${config.mesRutaActual}.pdf`;
  } else if (hojasAImprimir.length === todasLasHojas.length) {
    fileName = `Listado_Boletas_Completo_${todasLasHojas[0]?.idHoja}_al_${todasLasHojas[todasLasHojas.length - 1]?.idHoja}_${config.mesRutaActual}.pdf`;
  } else {
    fileName = `Listado_Boletas_Hojas_Seleccionadas_${hojasAImprimir.length}_folios_${config.mesRutaActual}.pdf`;
  }

  const modo = opcionesHojas?.modoSalida || 'imprimir';
  const tituloDesc = hojasAImprimir.length === 1
    ? `Listado de Boletas - Folio ${hojasAImprimir[0].idHoja} (Hoja Oficio)`
    : `Listado de Boletas (${hojasAImprimir.length} Folios - Hoja Oficio)`;

  const htmlPrint = generarHtmlHojaOficio(hojasAImprimir, config, filtroTribunal, esSobreseimiento);
  procesarSalidaPDF(doc, fileName, modo, tituloDesc, htmlPrint);
}

function renderSheetSummaryAndSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  hoja: HojaLote,
  totalHojasLote: number,
  startY: number
) {
  // En el listado principal, eliminar RESUMEN cuando no esté la hoja llena o lista completa
  if (hoja.estaLlena) {
    // Recuadro de Totales de Esta Hoja ajustado al ancho de Hoja Oficio Vertical
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(8, startY, 114, 28, 1.5, 1.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(8, startY, 114, 28, 1.5, 1.5, 'S');

    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`RESUMEN DE FOLIO ${hoja.numeroHoja}/${totalHojasLote}:`, 12, startY + 4.5);

    // Nomenclatura oficial UAC al final del listado para archivo y búsqueda de resultas (Pie de la hoja)
    const idUacFormateado = hoja.idHoja.toUpperCase().startsWith('UAC') 
      ? hoja.idHoja.toUpperCase() 
      : `UAC: ${hoja.idHoja.padStart(4, '0')}`;

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(70, startY + 1.8, 48, 5, 1, 1, 'F');
    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(idUacFormateado, 94, startY + 5.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Boletas en esta Hoja: ${hoja.cantidad} de ${hoja.capacidad} (LLENA)`,
      12,
      startY + 9
    );
    doc.text(
      `Devueltas al Tribunal: ${hoja.totalDevueltas} (${hoja.porcentajeEfectividad}%) | Pendientes: ${hoja.pendientes}`,
      12,
      startY + 13.5
    );
    doc.text(
      `Tribunales: ${hoja.tribunalesInvolucrados.slice(0, 5).join(', ')}${hoja.tribunalesInvolucrados.length > 5 ? '...' : ''}`,
      12,
      startY + 18
    );

    const c = hoja.conteosArticulos;
    doc.text(`Artículos COPP: 167(${c['167']}) 168(${c['168']}) 169(${c['169']}) 170(${c['170']})`, 12, startY + 22.5);
    doc.text(`                171(${c['171']}) 165(${c['165']}) S 165(${c['S_165']})`, 12, startY + 26);
  }

  // Firmas de Responsabilidad (A la derecha, dentro del ancho 215.9mm)
  const firmaY = startY + 15;
  doc.setDrawColor(100, 116, 139);
  
  // Firma 1: Alguacilazgo
  doc.line(128, firmaY, 166, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACIL DISTRIBUIDOR', 147, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Unidad de Actos y Comunicación', 147, firmaY + 6.5, { align: 'center' });

  // Firma 2: Tribunal Receptor / Coordinador
  doc.line(170, firmaY, 208, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.text('COORDINACIÓN / SECRETARÍA', 189, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Sello y Recibido Conforme', 189, firmaY + 6.5, { align: 'center' });
}

/**
 * Genera el documento HTML correspondiente a la Planilla de Acuses en formato oficial Hoja Tipo Oficio Vertical
 */
export function generarHtmlPlanillaAcuses(
  tribunalNombre: string,
  boletasConsolidadas: Array<{
    numeroCausa: string;
    boletaNumero: string;
    tribunal: string;
    caracteres: string[];
    notificados: string[];
    esDevuelta: boolean;
    fechaDevuelta?: string;
    recibidaPor?: string;
  }>,
  config: ConfiguracionDespacho,
  textoEntrega: string,
  alguacilGenerado: string
): string {
  const rows = boletasConsolidadas.map((item, idx) => {
    const caracterDisplay = item.caracteres.length > 0 ? item.caracteres.join(', ') : '-';
    const personasDisplay = item.notificados.length > 0 ? item.notificados.join(' / ') : '-';
    const estadoTexto = item.esDevuelta
      ? (item.fechaDevuelta 
          ? `<span style="font-weight: bold; color: #166534; display: block; line-height: 1.15; font-size: 7.5px; white-space: nowrap;">ENTREGADO</span><span style="font-size: 7px; color: #475569; display: block; margin-top: 2px; white-space: nowrap; font-family: monospace;">(${formatFechaDisplay(item.fechaDevuelta)})</span>` 
          : `<span style="font-weight: bold; color: #166534; display: block; font-size: 7.5px; white-space: nowrap;">ENTREGADO</span>`)
      : `<span style="font-weight: bold; color: #854d0e; display: block; font-size: 7.5px; white-space: nowrap;">POR ENTREGAR</span>`;

    return `
      <tr style="height: 22px; font-size: 8px; page-break-inside: avoid; break-inside: avoid; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="text-align: center; font-weight: bold; width: 24px; border: 1px solid #cbd5e1;">${idx + 1}</td>
        <td style="font-weight: bold; padding: 2px 5px; border: 1px solid #cbd5e1;">${item.numeroCausa}</td>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${item.boletaNumero}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1;">${caracterDisplay}</td>
        <td style="padding: 2px 5px; border: 1px solid #cbd5e1; font-weight: 500;">${personasDisplay}</td>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${item.tribunal}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 7.5px; white-space: nowrap; padding: 2px 5px; width: 100px;">${estadoTexto}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="hoja-pagina-oficio" style="width: 100%; box-sizing: border-box; padding: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
      <!-- Encabezado Institucional -->
      <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px;">
        <div style="font-size: 10.5px; font-weight: bold; letter-spacing: 0.5px;">${config.entePrincipal}</div>
        <div style="font-size: 9px;">${config.circuitoJudicial}</div>
        <div style="font-size: 8.5px; opacity: 0.9;">${config.unidad}</div>
      </div>

      <!-- Título y Datos de Entrega -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px;">
        <div style="font-size: 10.5px; font-weight: bold; color: #0f172a; text-align: center; margin-bottom: 4px;">
          PLANILLA DE RELACIÓN Y ENTREGA DE ACUSES DE BOLETAS (HOJA OFICIO)
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: #334155;">
          <span><strong>TRIBUNAL DESTINATARIO:</strong> ${tribunalNombre}</span>
          <span><strong>FECHA DE ENTREGA:</strong> ${textoEntrega}</span>
          <span><strong>TOTAL:</strong> ${boletasConsolidadas.length} causas</span>
        </div>
      </div>

      <!-- Tabla de Acuses -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background-color: #1e293b; color: #ffffff; font-size: 7.5px; height: 24px;">
            <th style="border: 1px solid #64748b; width: 24px;">Nº</th>
            <th style="border: 1px solid #64748b; width: 120px; text-align: left; padding-left: 5px;">Nº DE CAUSA</th>
            <th style="border: 1px solid #64748b; width: 55px;">BOLETA</th>
            <th style="border: 1px solid #64748b; width: 75px;">CARÁCTER</th>
            <th style="border: 1px solid #64748b; width: 185px;">PERSONA NOTIFICADA / CITADA</th>
            <th style="border: 1px solid #64748b; width: 40px;">TRI</th>
            <th style="border: 1px solid #64748b; width: 100px;">ESTADO</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      ${(() => {
        const totalBols = boletasConsolidadas.length;
        const cap = totalBols >= 35 ? (totalBols >= 40 ? 40 : 38) : 30;
        const devs = boletasConsolidadas.filter(b => b.esDevuelta).length;
        const pends = totalBols - devs;
        const pct = totalBols > 0 ? Math.round((devs / totalBols) * 100) : 0;
        const tribs = Array.from(new Set(boletasConsolidadas.map(b => b.tribunal))).filter(Boolean);
        const tribsStr = tribs.slice(0, 8).join(', ') + (tribs.length > 8 ? '...' : '');

        let a167 = 0, a168 = 0, a169 = 0, a170 = 0, a171 = 0, a165 = 0, aS165 = 0;
        boletasConsolidadas.forEach(b => {
          const arts = (b as any).articulos || [];
          if (arts.some((a: string) => a.includes('167'))) a167++;
          if (arts.some((a: string) => a.includes('168'))) a168++;
          if (arts.some((a: string) => a.includes('169'))) a169++;
          if (arts.some((a: string) => a.includes('170'))) a170++;
          if (arts.some((a: string) => a.includes('171'))) a171++;
          if (arts.some((a: string) => a === '165')) a165++;
          if (arts.some((a: string) => a.includes('S_165') || a.includes('S 165'))) aS165++;
        });

        return `
          <!-- RESUMEN OFICIAL Y CONSTANCIA FORMAL DE ENTREGA DENTRO DEL CUADRO -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px; font-size: 8px; line-height: 1.45; box-sizing: border-box;">
            <div style="font-weight: bold; color: #0f172a; font-size: 8.5px; margin-bottom: 2px;">RESUMEN:</div>
            <div>Devueltas al Tribunal: <strong>${devs} (${pct}%)</strong> | Pendientes: <strong>${pends}</strong></div>
            <div>Tribunales: ${tribsStr}</div>
            <div style="margin-top: 2px; font-size: 7.5px; color: #334155; font-weight: 500;">
              Artículos COPP: 167(${a167}) 168(${a168}) 169(${a169}) 170(${a170}) 171(${a171}) 165(${a165}) S 165(${aS165})
            </div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-size: 7.5px; color: #0f172a; font-style: italic; line-height: 1.4; word-break: normal;">
              Se hace formal entrega a la Secretaría de este Despacho Judicial de los acuses de las boletas supra indicadas para ser agregadas a sus respectivos autos y expedientes.
            </div>
          </div>
        `;
      })()}

      <!-- Firmas Oficiales -->
      <div style="display: flex; justify-content: space-between; margin-top: 8px; padding: 0 10px;">
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; width: 46%;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 4px;">ENTREGADO POR (ALGUACILAZGO):</div>
          <div style="font-size: 7.5px; color: #334155;">Alguacil: ${alguacilGenerado}</div>
          <div style="margin-top: 20px; border-top: 1px solid #475569; padding-top: 2px; font-size: 7px; color: #64748b;">Firma y Sello</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; width: 46%;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 4px;">RECIBIDO POR (SECRETARÍA TRIBUNAL):</div>
          <div style="font-size: 7.5px; color: #334155;">Nombre: _________________________________</div>
          <div style="font-size: 7.5px; color: #334155; margin-top: 2px;">FECHA: ________________ Hora: ___________</div>
          <div style="margin-top: 16px; border-top: 1px solid #475569; padding-top: 2px; font-size: 7px; color: #64748b;">Firma y Sello Conforme</div>
        </div>
      </div>
    </div>
  `;
}

export function exportarPlanillaAcusesPDF(
  tribunalNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaEntregaCustom?: string,
  alguacilSeleccionado?: string,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  // Membrete Judicial (Ancho Hoja Oficio: 215.9mm, centro: 107.95mm)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 107.95, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 107.95, 19, { align: 'center' });
  doc.text(config.unidad, 107.95, 23, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(10, 26, 205.9, 26);

  // Título del Oficio de Entrega de Acuses
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILLA DE RELACIÓN Y ENTREGA DE ACUSES DE BOLETAS', 107.95, 33, { align: 'center' });

  // Cuadro informativo limpio
  doc.setFillColor(248, 250, 252);
  doc.rect(10, 37, 195.9, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(10, 37, 195.9, 13, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`TRIBUNAL DESTINATARIO:`, 14, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(tribunalNombre, 58, 45);

  // Fecha de entrega (por regla: se relacionan hoy para entregar mañana, salvo urgente hoy)
  const fechaManana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const fechaEntregaFinal = fechaEntregaCustom 
    ? (fechaEntregaCustom.includes('-') ? formatFechaDisplay(fechaEntregaCustom) : fechaEntregaCustom)
    : formatFechaDisplay(fechaManana);

  const esUrgenteEntrega = fechaEntregaCustom === fechaHoy;
  const textoEntrega = esUrgenteEntrega 
    ? `${fechaEntregaFinal} (URGENTE)`
    : `${fechaEntregaFinal}`;

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA DE ENTREGA:`, 135, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(textoEntrega, 170, 45);

  // Ordenar boletas y detectar duplicados por (tri, numeroCausa, boletaNumero)
  const boletasConsolidadasMap = new Map<string, {
    numeroCausa: string;
    boletaNumero: string;
    tribunal: string;
    caracteres: string[];
    notificados: string[];
    fechaAudiencia: string;
    esSoloNotificacion: boolean;
    horaAudiencia: string;
    articulos: string[];
    minCaracterPriority: number;
    esDevuelta: boolean;
    fechaDevuelta?: string;
    recibidaPor?: string;
  }>();

  for (const b of boletas) {
    const triSpecified = (
      b.tribunalOtro ||
      (b.tribunal && b.tribunal.toUpperCase() !== 'OTRO' ? b.tribunal : '') ||
      b.tribunal ||
      'FORÁNEO'
    ).trim().toUpperCase();
    const key = `${triSpecified}|${(b.numeroCausa || '').trim().toUpperCase()}|${(b.boletaNumero || '').trim().toUpperCase()}`;
    const caracterStr = getCaracterDisplay(b.tipoCitado);
    const caracterPrio = getCaracterPriority(b.tipoCitado);
    const arts = b.articulosCOPP && b.articulosCOPP.length > 0 
      ? b.articulosCOPP 
      : (b.articuloCOPP ? [b.articuloCOPP] : []);

    if (!boletasConsolidadasMap.has(key)) {
      boletasConsolidadasMap.set(key, {
        numeroCausa: b.numeroCausa,
        boletaNumero: b.boletaNumero,
        tribunal: triSpecified,
        caracteres: [caracterStr],
        notificados: b.notificadoCitado ? [b.notificadoCitado] : [],
        fechaAudiencia: b.fechaAudiencia,
        esSoloNotificacion: !!b.esSoloNotificacion,
        horaAudiencia: b.horaAudiencia || '',
        articulos: [...arts],
        minCaracterPriority: caracterPrio,
        esDevuelta: !!b.devueltaAlTribunal,
        fechaDevuelta: b.fechaDevueltaTribunal,
        recibidaPor: b.acuseRecibidoPor,
      });
    } else {
      const existing = boletasConsolidadasMap.get(key)!;
      if (!existing.caracteres.includes(caracterStr)) {
        existing.caracteres.push(caracterStr);
      }
      if (b.notificadoCitado && !existing.notificados.includes(b.notificadoCitado)) {
        existing.notificados.push(b.notificadoCitado);
      }
      for (const a of arts) {
        if (!existing.articulos.includes(a)) {
          existing.articulos.push(a);
        }
      }
      if (caracterPrio < existing.minCaracterPriority) {
        existing.minCaracterPriority = caracterPrio;
      }
      if (!existing.horaAudiencia && b.horaAudiencia) {
        existing.horaAudiencia = b.horaAudiencia;
      }
      if (existing.esSoloNotificacion && !b.esSoloNotificacion) {
        existing.esSoloNotificacion = false;
        existing.fechaAudiencia = b.fechaAudiencia;
      }
      if (b.devueltaAlTribunal) {
        existing.esDevuelta = true;
        if (!existing.fechaDevuelta && b.fechaDevueltaTribunal) {
          existing.fechaDevuelta = b.fechaDevueltaTribunal;
        }
        if (!existing.recibidaPor && b.acuseRecibidoPor) {
          existing.recibidaPor = b.acuseRecibidoPor;
        }
      }
    }
  }

  // Ordenar consolidado: mantener el orden de registro
  const boletasConsolidadas = Array.from(boletasConsolidadasMap.values());

  const tableHeaders = ['Nº', 'Nº DE CAUSA', 'BOLETA', 'CARÁCTER', 'PERSONA NOTIFICADA / CITADA', 'TRI', 'ESTADO'];
  const tableBody = boletasConsolidadas.map((item, idx) => {
    const caracterDisplay = item.caracteres.length > 0 
      ? item.caracteres.join(', ') 
      : '-';

    const personasDisplay = item.notificados.length > 0
      ? item.notificados.join(' / ')
      : '-';

    const estadoTexto = item.esDevuelta
      ? (item.fechaDevuelta ? `ENTREGADO\n(${formatFechaDisplay(item.fechaDevuelta)})` : 'ENTREGADO')
      : 'POR ENTREGAR';

    return [
      idx + 1,
      item.numeroCausa,
      item.boletaNumero,
      caracterDisplay,
      personasDisplay,
      item.tribunal,
      estadoTexto,
    ];
  });

  autoTable(doc, {
    startY: 53,
    margin: { left: 10, right: 10 },
    tableWidth: 195.9,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      font: 'helvetica',
      valign: 'middle',
    },
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 }, // Nº
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 43 }, // Nº DE CAUSA
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 19 }, // BOLETA
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 28 }, // CARÁCTER
      4: { halign: 'left', cellWidth: 54.9 }, // PERSONA NOTIFICADA / CITADA
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 14 }, // TRI
      6: { halign: 'center', cellWidth: 28 }, // ESTADO (ampliado a 28mm para que no se separe nunca)
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  // Determinar Alguacil generado por el sistema
  const alguacilesLista = Array.from(new Set(boletas.map(b => (b.alguacilPractica || '').trim()).filter(a => a && !a.toUpperCase().includes('SIN ALGUACIL') && !a.toUpperCase().includes('SIN ASIGNAR'))));
  const alguacilGenerado = (alguacilSeleccionado && !alguacilSeleccionado.toUpperCase().includes('SIN ALGUACIL') && !alguacilSeleccionado.toUpperCase().includes('SIN ASIGNAR'))
    ? alguacilSeleccionado
    : (alguacilesLista.length > 0 ? alguacilesLista.join(', ') : 'SIN ASIGNAR');

  const renderSignatures = (posY: number) => {
    // RESUMEN OFICIAL Y CONSTANCIA FORMAL DE ENTREGA DENTRO DEL CUADRO
    const textoFormalEntrega = 'Se hace formal entrega a la Secretaría de este Despacho Judicial de los acuses de las boletas supra indicadas para ser agregadas a sus respectivos autos y expedientes.';
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    const lineasFormal = doc.splitTextToSize(textoFormalEntrega, 187);
    const boxHeight = 22 + (lineasFormal.length * 3.8) + 4; // Garantiza espacio total para que el texto siempre quede contenido dentro del cuadro

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, posY, 195.9, boxHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(10, posY, 195.9, boxHeight, 1.5, 1.5, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('RESUMEN:', 14, posY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const totalBols = boletasConsolidadas.length;
    const devs = boletasConsolidadas.filter(b => b.esDevuelta).length;
    const pends = totalBols - devs;
    const pct = totalBols > 0 ? Math.round((devs / totalBols) * 100) : 0;
    const tribs = Array.from(new Set(boletasConsolidadas.map(b => b.tribunal))).filter(Boolean);
    const tribsStr = tribs.slice(0, 8).join(', ') + (tribs.length > 8 ? '...' : '');

    let a167 = 0, a168 = 0, a169 = 0, a170 = 0, a171 = 0, a165 = 0, aS165 = 0;
    boletasConsolidadas.forEach(b => {
      const arts = (b as any).articulos || [];
      if (arts.some((a: string) => a.includes('167'))) a167++;
      if (arts.some((a: string) => a.includes('168'))) a168++;
      if (arts.some((a: string) => a.includes('169'))) a169++;
      if (arts.some((a: string) => a.includes('170'))) a170++;
      if (arts.some((a: string) => a.includes('171'))) a171++;
      if (arts.some((a: string) => a === '165')) a165++;
      if (arts.some((a: string) => a.includes('S_165') || a.includes('S 165'))) aS165++;
    });

    doc.text(`Devueltas al Tribunal: ${devs} (${pct}%) | Pendientes: ${pends}`, 14, posY + 8.5);
    doc.text(`Tribunales: ${tribsStr}`, 14, posY + 12.5);
    doc.text(`Artículos COPP: 167(${a167}) 168(${a168}) 169(${a169}) 170(${a170}) 171(${a171}) 165(${a165}) S 165(${aS165})`, 14, posY + 16.5);

    // Línea divisoria suave dentro del cuadro
    doc.setDrawColor(226, 232, 240);
    doc.line(14, posY + 19.5, 201.9, posY + 19.5);

    // Texto de entrega formal DENTRO del cuadro con márgenes internos
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(lineasFormal, 14, posY + 24);

    const firmaBoxY = posY + boxHeight + 4;

    // ENTREGADO POR (ALGUACILAZGO) - Sin ENCARGADO
    doc.rect(10, firmaBoxY, 94, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ENTREGADO POR (ALGUACILAZGO):', 12, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Alguacil: ${alguacilGenerado}`, 12, firmaBoxY + 12, { maxWidth: 90 });
    doc.text(`Firma y Sello: __________________________`, 12, firmaBoxY + 24);

    // RECIBIDO POR (SECRETARÍA TRIBUNAL)
    doc.rect(111.9, firmaBoxY, 94, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RECIBIDO POR (SECRETARÍA TRIBUNAL):', 114, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Nombre: _________________________________`, 114, firmaBoxY + 12);
    doc.text(`FECHA: ________________ Hora: ___________`, 114, firmaBoxY + 18);
    doc.text(`Firma y Sello: __________________________`, 114, firmaBoxY + 24);
  };

  if (finalY > pageHeight - 85) {
    doc.addPage('legal', 'portrait');
    renderSignatures(20);
  } else {
    renderSignatures(finalY);
  }

  const fileName = `Acuse_Entrega_${tribunalNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  const htmlPrint = generarHtmlPlanillaAcuses(tribunalNombre, boletasConsolidadas, config, textoEntrega, alguacilGenerado);
  procesarSalidaPDF(doc, fileName, modoSalida, `Planilla de Acuses - ${tribunalNombre} (Hoja Oficio)`, htmlPrint);
}

/**
 * Genera el Oficio Oficial de Rendición de Estadísticas Globales por Artículos del COPP y Tribunales
 * con Código QR institucional integrado en la esquina superior derecha
 */
export async function exportarOficioEstadisticasGlobalesPDF(
  boletas: BoletaJudicial[],
  tribunales: TribunalInfo[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  let sum167 = 0;
  let sum168 = 0;
  let sum169 = 0;
  let sum170 = 0;
  let sum171 = 0;
  let sum165 = 0;
  let sumS165 = 0;
  let sumTotal = 0;
  let sumDevueltas = 0;

  const rows = tribunales.map(t => {
    const courtBoletas = boletas.filter(b => {
      if (t.codigo === 'OTRO') {
        const localCodes = tribunales.filter(x => x.codigo !== 'OTRO').map(x => x.codigo);
        return !localCodes.some(lc => matchesTribunal(b?.tribunal, lc)) || matchesTribunal(b?.tribunal, 'OTRO');
      }
      return matchesTribunal(b?.tribunal, t.codigo);
    });

    const c167 = courtBoletas.filter(b => hasArticulo(b, '167')).length;
    const c168 = courtBoletas.filter(b => hasArticulo(b, '168')).length;
    const c169 = courtBoletas.filter(b => hasArticulo(b, '169')).length;
    const c170 = courtBoletas.filter(b => hasArticulo(b, '170')).length;
    const c171 = courtBoletas.filter(b => hasArticulo(b, '171')).length;
    const c165 = courtBoletas.filter(b => hasArticulo(b, '165')).length;
    const cS165 = courtBoletas.filter(b => hasArticulo(b, 'S_165')).length;
    const total = courtBoletas.length;
    const devueltas = courtBoletas.filter(b => b.devueltaAlTribunal).length;
    const pct = total > 0 ? `${Math.round((devueltas / total) * 100)}%` : '0%';

    sum167 += c167;
    sum168 += c168;
    sum169 += c169;
    sum170 += c170;
    sum171 += c171;
    sum165 += c165;
    sumS165 += cS165;
    sumTotal += total;
    sumDevueltas += devueltas;

    return [
      `${t.codigo} - ${t.nombre.length > 22 ? t.nombre.slice(0, 20) + '...' : t.nombre}`,
      c167 || '-',
      c168 || '-',
      c169 || '-',
      c170 || '-',
      c171 || '-',
      c165 || '-',
      cS165 || '-',
      total,
      devueltas,
      pct
    ];
  });

  const totalBoletas = sumTotal;
  const totalDevueltas = sumDevueltas;
  const efectividadGlobal = totalBoletas > 0 ? ((totalDevueltas / totalBoletas) * 100).toFixed(1) : '100.0';

  // Conteo de Artículos COPP para el QR global matemáticamente exacto con la tabla
  const coppCounts = [sum167, sum168, sum169, sum170, sum171, sum165, sumS165];
  const qrUrl = encodeGlobalQRUrl(totalBoletas, totalDevueltas, parseFloat(efectividadGlobal), coppCounts, config);

  // Código QR de alta resolución (600px) con zona de seguridad (margin 3) y contraste puro para detección óptica instantánea
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 600,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' }
  });

  // Membrete Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 85, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 85, 19, { align: 'center' });
  doc.text(config.unidad, 85, 23, { align: 'center' });

  // Estampar Código QR en la esquina superior derecha
  doc.addImage(qrDataUrl, 'PNG', 165, 8, 30, 30);
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('VALIDACIÓN OFICIAL QR', 180, 40, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 160, 28);

  // Encabezado del Oficio
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`OFICIO Nº UAC-EST-${config.mesRutaActual.replace(/\s+/g, '-').toUpperCase()}`, 14, 36);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CIUDADANO(A) JUEZ(A) PRESIDENTE(A) / COORDINADOR(A) DEL CIRCUITO JUDICIAL PENAL`, 14, 43);
  const remitenteEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN (${config.jefeAlguacilazgo})`
    : 'DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN';
  doc.text(remitenteEncargado, 14, 48);
  doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-ES')}`, 14, 53);
  doc.setFont('helvetica', 'bold');
  doc.text(`ASUNTO: OFICIO DE RENDICIÓN DE ESTADÍSTICAS GLOBALES POR ARTÍCULOS DEL COPP`, 14, 58);

  // Matriz de Estadísticas por Artículos y Tribunales
  const tableHeaders = ['TRIBUNAL', '167', '168', '169', '170', '171', '165', 'S 165', 'TOTAL', 'PRACT.', '% EFECT.'];

  const pctGlobal = sumTotal > 0 ? `${Math.round((sumDevueltas / sumTotal) * 100)}%` : '100%';

  // Fila de Totales matemáticamente idéntica a la suma de cada columna
  const tableBodyWithTotal = [
    ...rows,
    [
      'TOTAL GENERAL',
      sum167,
      sum168,
      sum169,
      sum170,
      sum171,
      sum165,
      sumS165,
      sumTotal,
      sumDevueltas,
      pctGlobal
    ]
  ];

  autoTable(doc, {
    startY: 64,
    head: [tableHeaders],
    body: tableBodyWithTotal,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
    },
    didParseCell: function(data) {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 190) + 10;

  // Cuadro de firmas oficial
  doc.rect(14, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, finalY + 6);
  doc.setFont('helvetica', 'normal');
  const firmaEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `ENCARGADO: ${config.jefeAlguacilazgo}`
    : 'ENCARGADO:';
  doc.text(firmaEncargado, 16, finalY + 16);
  doc.text(`Firma y Sello: __________________________`, 16, finalY + 28);

  doc.rect(110, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBIDO CONFORME (PRESIDENCIA):', 112, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: _________________________________`, 112, finalY + 16);
  doc.text(`FECHA: ________________ Hora: ___________`, 112, finalY + 24);
  doc.text(`Firma y Sello: __________________________`, 112, finalY + 31);

  const fileName = `Oficio_Rendicion_Estadisticas_Globales_COPP_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`;
  procesarSalidaPDF(doc, fileName, modoSalida, 'Oficio de Rendición de Estadísticas Globales COPP');
}

/**
 * Genera el Oficio de Rendición por Tribunal con desglose de los 7 Artículos del COPP,
 * efectividad porcentual, firmas oficiales y Código QR de validación institucional.
 * Formato ejecutivo oficial con QR interactivo que permite descargar el listado completo con resultas.
 */
export async function exportarInformeMatrizTribunalPDF(
  tribunal: TribunalInfo,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const courtBoletas = (boletas || []).filter(b => matchesTribunal(b?.tribunal, tribunal.codigo));
  const total = courtBoletas.length;
  const devueltas = courtBoletas.filter(b => b.devueltaAlTribunal).length;
  const pctEfectividad = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  // Conteo por cada uno de los 7 Artículos del COPP para este Tribunal
  const tot167 = courtBoletas.filter(b => hasArticulo(b, '167')).length;
  const tot168 = courtBoletas.filter(b => hasArticulo(b, '168')).length;
  const tot169 = courtBoletas.filter(b => hasArticulo(b, '169')).length;
  const tot170 = courtBoletas.filter(b => hasArticulo(b, '170')).length;
  const tot171 = courtBoletas.filter(b => hasArticulo(b, '171')).length;
  const tot165 = courtBoletas.filter(b => hasArticulo(b, '165')).length;
  const totS165 = courtBoletas.filter(b => hasArticulo(b, 'S_165')).length;

  // Generar QR de Validación URL para el Oficio del Tribunal (permite detección óptica instantánea y descarga)
  let qrDataUrl = '';
  try {
    const qrUrl = encodeTribunalQRUrl(tribunal.codigo, tribunal.nombre, boletas || [], config);
    qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (qrErr) {
    console.warn('Error al generar QR del tribunal, reintentando con fallback limpio:', qrErr);
    try {
      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://sistema-alguacilazgo.tribunales.gob.ve';
      const cleanUrl = `${baseUrl}?val_tribunal=${encodeURIComponent(tribunal.codigo)}`;
      qrDataUrl = await QRCode.toDataURL(cleanUrl, {
        width: 600,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (cleanErr) {
      console.error('Error al generar QR de respaldo:', cleanErr);
      qrDataUrl = '';
    }
  }

  // Membrete Oficial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 85, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 85, 19, { align: 'center' });
  doc.text(config.unidad, 85, 23, { align: 'center' });

  // Estampar Código QR en la esquina superior derecha con indicación de descarga de resultas
  doc.addImage(qrDataUrl, 'PNG', 164, 6, 31, 31);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('VALIDACIÓN OFICIAL QR', 179.5, 39, { align: 'center' });
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Escanear para descargar listado', 179.5, 41.5, { align: 'center' });
  doc.text('completo con todas las resultas', 179.5, 44, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 160, 28);

  // Encabezado del Oficio
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`OFICIO Nº UAC-TRI-${tribunal.codigo.toUpperCase()}-${config.mesRutaActual.replace(/\s+/g, '-').toUpperCase()}`, 14, 36);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`CIUDADANO(A) JUEZ(A) Y SECRETARIO(A) DEL TRIBUNAL ${tribunal.codigo.toUpperCase()} (${tribunal.nombre.toUpperCase()})`, 14, 43);
  const remitenteEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN (${config.jefeAlguacilazgo})`
    : 'DE: ENCARGADO DE LA UNIDAD DE ACTOS Y COMUNICACIÓN';
  doc.text(remitenteEncargado, 14, 48);
  doc.text(`FECHA DE EMISIÓN: ${new Date().toLocaleDateString('es-ES')}`, 14, 53);
  doc.setFont('helvetica', 'bold');
  doc.text(`ASUNTO: OFICIO DE RENDICIÓN DE ESTADÍSTICAS POR ARTÍCULOS DEL COPP`, 14, 58);

  // Columnas de la Matriz Oficial
  const tableHeaders = ['CARÁCTER / SUJETO PROCESAL', '167', '168', '169', '170', '171', '165', 'S 165', 'TOTAL', 'PRACT.', '% EFECT.'];

  // Categorías de Sujetos Procesales en el orden exacto solicitado
  const categoriasSujetos: { label: string; filter: (b: BoletaJudicial) => boolean }[] = [
    {
      label: 'MINISTERIO PÚBLICO (FISCALÍAS)',
      filter: (b) => b.tipoCitado === 'FISCALIA'
    },
    {
      label: 'DEFENSA (PÚBLICA / PRIVADA)',
      filter: (b) => b.tipoCitado === 'ABOGADO_DEFENSA' || b.tipoCitado === 'DEFENSA_PUBLICA'
    },
    {
      label: 'IMPUTADOS / ACUSADOS / PENADOS',
      filter: (b) => b.tipoCitado === 'IMPUTADO' || b.tipoCitado === 'ACUSADO' || b.tipoCitado === 'PENADO' || b.tipoCitado === 'INVESTIGADO'
    },
    {
      label: 'VÍCTIMAS, QUERELLANTES Y DENUNC.',
      filter: (b) => b.tipoCitado === 'VICTIMA' || b.tipoCitado === 'QUERELLANTE' || b.tipoCitado === 'DENUNCIANTE'
    },
    {
      label: 'TESTIGOS Y EXPERTOS',
      filter: (b) => b.tipoCitado === 'TESTIGO' || b.tipoCitado === 'EXPERTO'
    },
    {
      label: 'FUNCIONARIOS / CUERPOS POLICIALES.',
      filter: (b) => b.tipoCitado === 'ORGANO_POLICIAL' || b.tipoCitado === 'FUNCIONARIO'
    },
    {
      label: 'OTROS (TERCEROS / FIADORES / REP.).',
      filter: (b) => ['TERCERO', 'FIADOR', 'APODERADO', 'REPRESENTANTE_LEGAL', 'SOLICITANTE', 'CIUDADANO', 'OTRO'].includes(b.tipoCitado) || 
                     !['FISCALIA', 'ABOGADO_DEFENSA', 'DEFENSA_PUBLICA', 'IMPUTADO', 'ACUSADO', 'PENADO', 'INVESTIGADO', 'VICTIMA', 'QUERELLANTE', 'DENUNCIANTE', 'TESTIGO', 'EXPERTO', 'ORGANO_POLICIAL', 'FUNCIONARIO'].includes(b.tipoCitado)
    }
  ];

  let sumSujetos167 = 0;
  let sumSujetos168 = 0;
  let sumSujetos169 = 0;
  let sumSujetos170 = 0;
  let sumSujetos171 = 0;
  let sumSujetos165 = 0;
  let sumSujetosS165 = 0;
  let sumSujetosTot = 0;
  let sumSujetosDev = 0;

  const rowsSujetos = categoriasSujetos.map(cat => {
    const sub = courtBoletas.filter(cat.filter);
    const c167 = sub.filter(b => hasArticulo(b, '167')).length;
    const c168 = sub.filter(b => hasArticulo(b, '168')).length;
    const c169 = sub.filter(b => hasArticulo(b, '169')).length;
    const c170 = sub.filter(b => hasArticulo(b, '170')).length;
    const c171 = sub.filter(b => hasArticulo(b, '171')).length;
    const c165 = sub.filter(b => hasArticulo(b, '165')).length;
    const cS165 = sub.filter(b => hasArticulo(b, 'S_165')).length;
    const tot = sub.length;
    const dev = sub.filter(b => b.devueltaAlTribunal).length;
    const pct = tot > 0 ? `${Math.round((dev / tot) * 100)}%` : '0%';

    sumSujetos167 += c167;
    sumSujetos168 += c168;
    sumSujetos169 += c169;
    sumSujetos170 += c170;
    sumSujetos171 += c171;
    sumSujetos165 += c165;
    sumSujetosS165 += cS165;
    sumSujetosTot += tot;
    sumSujetosDev += dev;

    return [
      cat.label,
      c167 || '-',
      c168 || '-',
      c169 || '-',
      c170 || '-',
      c171 || '-',
      c165 || '-',
      cS165 || '-',
      tot,
      dev,
      pct
    ];
  });

  const pctSujetosGlobal = sumSujetosTot > 0 ? `${Math.round((sumSujetosDev / sumSujetosTot) * 100)}%` : '0%';

  // Fila Total de Sujetos matemáticamente idéntica a la suma de cada columna
  rowsSujetos.push([
    'TOTAL GENERAL',
    sumSujetos167,
    sumSujetos168,
    sumSujetos169,
    sumSujetos170,
    sumSujetos171,
    sumSujetos165,
    sumSujetosS165,
    sumSujetosTot,
    sumSujetosDev,
    pctSujetosGlobal
  ]);

  // Tabla 1: Desglose por Sujeto / Carácter Procesal
  autoTable(doc, {
    startY: 64,
    head: [tableHeaders],
    body: rowsSujetos,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
    },
    didParseCell: function(data) {
      if (data.row.index === rowsSujetos.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 135) + 18;

  // Cuadro de firmas oficial
  doc.rect(14, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, finalY + 6);
  doc.setFont('helvetica', 'normal');
  const firmaEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
    ? `ENCARGADO: ${config.jefeAlguacilazgo}`
    : 'ENCARGADO:';
  doc.text(firmaEncargado, 16, finalY + 16);
  doc.text(`Firma y Sello: __________________________`, 16, finalY + 28);

  doc.rect(110, finalY, 86, 36);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECIBIDO CONFORME (SECRETARÍA TRIBUNAL ${tribunal.codigo}):`, 112, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre Secretaria / Receptor: _____________________`, 112, finalY + 16);
  doc.text(`FECHA: ________________ Hora: ___________`, 112, finalY + 24);
  doc.text(`Firma y Sello: __________________________`, 112, finalY + 31);

  const fileName = `Oficio_Rendicion_Tribunal_${tribunal.codigo}_COPP_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`;
  procesarSalidaPDF(doc, fileName, modoSalida, `Oficio de Rendición con QR - ${tribunal.nombre}`);
}

/**
 * Oficio por Tribunal - Sin listado detallado de boletas (delega al formato ejecutivo oficial)
 */
export async function exportarListadoDiligenciasRutasPDF(
  tribunal: TribunalInfo,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho
) {
  // Siguiendo la instrucción de eliminar el listado detallado de boletas individuales,
  // se emite el Oficio formal de Rendición por Tribunal con Artículos del COPP y Código QR.
  return exportarInformeMatrizTribunalPDF(tribunal, boletas, config);
}

/**
 * Reporte Oficial para Imprimir por Tribunal con el resultado completo:
 * Incluye Artículo COPP, Alguacil que practicó, Estado, Audiencia y Firmas.
 */
export function exportarReporteTribunalResultadosPDF(
  tribunalCodigo: string,
  tribunalNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const cleanCode = (tribunalCodigo || '').trim().toUpperCase();
  const boletasFiltradas = (boletas || []).filter(
    b => matchesTribunal(b?.tribunal, cleanCode)
  );
  const boletasTribunal = boletasFiltradas.length > 0 ? boletasFiltradas : (boletas || []);

  // Encabezado institucional (Hoja Oficio: 215.9mm ancho, centro: 107.95mm)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 215.9, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 107.95, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 107.95, 11, { align: 'center' });
  doc.text(config.unidad, 107.95, 15, { align: 'center' });

  // Subtítulo del Reporte por Tribunal
  doc.setFillColor(248, 250, 252);
  doc.rect(8, 21, 199.9, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(8, 21, 199.9, 13, 'S');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`REPORTE DE BOLETAS Y RESULTADOS DE PRÁCTICA - ${tribunalCodigo.toUpperCase()}`, 12, 27);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Despacho: ${tribunalNombre} | Total Boletas: ${boletasTribunal.length} | Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}`,
    12,
    31.5
  );

  // Columnas de la tabla
  const tableHeaders = [
    'Nº',
    'Nº DE CAUSA',
    'BOLETA Nº',
    'PERSONA NOTIFICADA / CITADA',
    'CARÁCTER',
    'F. AUDIENCIA',
    'ART. COPP',
    'ALGUACIL QUE PRACTICÓ',
    'RESULTADO / ESTADO',
    'RECIBIDO EN TRIBUNAL POR',
    'DEVUELTA TRIBUNAL',
  ];

  const tableBody = boletasTribunal.map((b, idx) => {
    const esDevuelta = !!b.devueltaAlTribunal;
    const algLimpio = (b.alguacilPractica || '').trim();
    const tieneAlguacilValido = algLimpio !== '' && !algLimpio.toUpperCase().includes('SIN ASIGNAR') && !algLimpio.toUpperCase().includes('SIN ALGUACIL');
    
    // Una boleta está formalmente practicada o concluida si fue devuelta al tribunal o tiene acuse formal de entrega
    const esPracticadaReal = esDevuelta || (b.estado === 'PRACTICADA' && tieneAlguacilValido && !!b.acuseRecibidoPor);
    const esNoPracticadaReal = b.estado === 'NO_PRACTICADA' && (esDevuelta || !!b.motivoNoPractica);
    const esConcluida = esPracticadaReal || esNoPracticadaReal;

    // Si la boleta está PENDIENTE (aún no practicada ni devuelta), tanto ALGUACIL QUE PRACTICÓ como RESULTADO / ESTADO salen estrictamente EN BLANCO ("")
    let alguacilPracticoTexto = '';
    let resultadoTexto = '';

    if (esConcluida) {
      alguacilPracticoTexto = tieneAlguacilValido ? algLimpio.toUpperCase() : '';
      if (esDevuelta) {
        resultadoTexto = esNoPracticadaReal
          ? (b.motivoNoPractica ? `NO PRACTICADA (${b.motivoNoPractica})` : 'NO PRACTICADA')
          : (b.estado === 'PRACTICADA' ? 'PRACTICADA (POSITIVA)' : 'DEVUELTA A TRIBUNAL');
      } else if (esPracticadaReal) {
        resultadoTexto = 'PRACTICADA (POSITIVA)';
      } else if (esNoPracticadaReal) {
        resultadoTexto = b.motivoNoPractica ? `NO PRACTICADA (${b.motivoNoPractica})` : 'NO PRACTICADA';
      }
    } else {
      // PENDIENTE: estrictamente en blanco
      alguacilPracticoTexto = '';
      resultadoTexto = '';
    }

    const receptorTexto = b.acuseRecibidoPor
      ? `${b.acuseRecibidoPor}${b.acuseHoraEntrega ? ` (${b.acuseHoraEntrega})` : ''}`
      : (esDevuelta ? 'SECRETARÍA DEL TRIBUNAL' : 'PENDIENTE DE ENTREGA');

    const artTexto = b.articuloCOPP === 'S_165'
      ? 'S 165'
      : (b.articuloCOPP && !b.articuloCOPP.toUpperCase().includes('SIN ASIGNAR') ? b.articuloCOPP : '');

    return [
      idx + 1,
      b.numeroCausa,
      b.boletaNumero || 'S/N',
      b.notificadoCitado,
      b.tipoCitado || 'IMPUTADO',
      b.esSoloNotificacion ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia),
      artTexto,
      alguacilPracticoTexto,
      resultadoTexto,
      receptorTexto,
      b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : (esDevuelta ? 'SÍ' : 'PENDIENTE'),
    ];
  });

  if (tableBody.length === 0) {
    tableBody.push([
      '1',
      'SIN INCIDENCIAS',
      'S/N',
      'EL DESPACHO JUDICIAL NO REGISTRA BOLETAS PENDIENTES EN EL PERÍODO (100% AL DÍA)',
      'PARTES',
      'AL DÍA',
      'CONFORME',
      config.jefeAlguacilazgo || 'ALGUACILAZGO',
      'DESPACHO AL DÍA',
      'SECRETARÍA DEL TRIBUNAL',
      'CONFORME'
    ]);
  }

  autoTable(doc, {
    startY: 37,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      valign: 'middle',
      font: 'helvetica',
    },
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    margin: { left: 8, right: 8, top: 37, bottom: 20 },
    tableWidth: 199.9,
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'left', cellWidth: 38 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 11 },
      7: { halign: 'left', fontStyle: 'bold', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 22 },
      9: { halign: 'left', cellWidth: 18 },
      10: { halign: 'center', cellWidth: 10.9 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: function(data) {
      // Resaltar Artículo COPP
      if (data.section === 'body' && data.column.index === 6) {
        const art = String(data.cell.raw || '');
        if (art === '167') {
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.textColor = [15, 23, 42];
        } else if (art === '168') {
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [29, 78, 216];
        } else if (art === '169') {
          data.cell.styles.fillColor = [224, 242, 254];
          data.cell.styles.textColor = [3, 105, 161];
        } else if (art === '170') {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [4, 120, 87];
        } else if (art === '171') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [185, 28, 28];
        } else if (art === '165') {
          data.cell.styles.fillColor = [254, 240, 138];
          data.cell.styles.textColor = [133, 77, 14];
        } else if (art.includes('165')) {
          data.cell.styles.fillColor = [254, 215, 170];
          data.cell.styles.textColor = [154, 52, 18];
        }
      }
      // Resaltar Resultado
      if (data.section === 'body' && data.column.index === 8) {
        const res = String(data.cell.raw || '');
        if (res.includes('DEVUELTA') || res.includes('PRACTICADA')) {
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 6;
  const pageHeight = doc.internal.pageSize.height;

  if (finalY > pageHeight - 45) {
    doc.addPage();
    renderTribunalSummaryAndSignatures(doc, config, boletasTribunal, tribunalCodigo, 15);
  } else {
    renderTribunalSummaryAndSignatures(doc, config, boletasTribunal, tribunalCodigo, finalY);
  }

  const fileName = `Resultados_Tribunal_${tribunalCodigo}_${new Date().toISOString().slice(0, 10)}.pdf`;
  procesarSalidaPDF(doc, fileName, modoSalida, `Resultados del Tribunal ${tribunalCodigo}`);
}

function renderTribunalSummaryAndSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  boletas: BoletaJudicial[],
  tribunalCodigo: string,
  startY: number
) {
  const total = boletas.length;
  const devueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const practicadas = boletas.filter(b => {
    const alg = (b.alguacilPractica || '').trim().toUpperCase();
    const tieneAlg = alg !== '' && !alg.includes('SIN ASIGNAR') && !alg.includes('SIN ALGUACIL');
    return b.devueltaAlTribunal || (b.estado === 'PRACTICADA' && tieneAlg && !!b.acuseRecibidoPor);
  }).length;

  const count167 = boletas.filter(b => hasArticulo(b, '167')).length;
  const count168 = boletas.filter(b => hasArticulo(b, '168')).length;
  const count169 = boletas.filter(b => hasArticulo(b, '169')).length;
  const count170 = boletas.filter(b => hasArticulo(b, '170')).length;
  const count171 = boletas.filter(b => hasArticulo(b, '171')).length;
  const count165 = boletas.filter(b => hasArticulo(b, '165')).length;
  const countS165 = boletas.filter(b => hasArticulo(b, 'S_165')).length;

  // Box Resumen
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(8, startY, 114, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(8, startY, 114, 26, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTALES ${tribunalCodigo}:`, 12, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Total Boletas: ${total}`, 12, startY + 10);
  doc.text(`Practicadas Concluidas: ${practicadas}`, 12, startY + 15);
  doc.text(`Devueltas a Secretaría: ${devueltas} (${total > 0 ? Math.round((devueltas/total)*100) : 0}%)`, 12, startY + 20);

  doc.text(`Artículos COPP:`, 65, startY + 10);
  doc.text(`167(${count167}) 168(${count168}) 169(${count169}) 170(${count170})`, 65, startY + 15);
  doc.text(`171(${count171}) 165(${count165}) S 165(${countS165})`, 65, startY + 20);

  // Firmas
  const firmaY = startY + 16;
  doc.setDrawColor(100, 116, 139);

  // Alguacilazgo
  doc.line(128, firmaY, 166, firmaY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACILAZGO / PRÁCTICA', 147, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Funcionario Responsable', 147, firmaY + 7, { align: 'center' });

  // Secretaría del Tribunal
  doc.line(170, firmaY, 208, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.text(`SECRETARÍA ${tribunalCodigo}`, 189, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Sello y Recibido en Autos', 189, firmaY + 7, { align: 'center' });
}

export function exportarHojaRutaAlguacilPDF(
  alguacilNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaRuta?: string,
  observacionesGenerales?: string,
  opciones?: { esSobreseimiento?: boolean; tituloRuta?: string; modoSalida?: ModoSalidaDocumento }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const fechaImpresion = fechaRuta || new Date().toISOString().slice(0, 10);
  const esSobreseimiento = opciones?.esSobreseimiento || (boletas || []).some(b => b?.seccionRuta === 'SOBRESEIMIENTO');

  // Encabezado institucional (Hoja Oficio: 215.9mm ancho)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 215.9, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 107.95, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 107.95, 11, { align: 'center' });
  doc.text(config.unidad, 107.95, 15, { align: 'center' });

  // Cuadro superior con datos del Alguacil y Enrutamiento
  doc.setFillColor(248, 250, 252);
  doc.rect(8, 22, 199.9, 15, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(8, 22, 199.9, 15, 'S');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const tituloBox = esSobreseimiento 
    ? 'HOJA DE RUTA / SOBRESEIMIENTO - LISTADO DE BOLETAS (HOJA OFICIO)' 
    : 'HOJA DE RUTA / LISTADO DE BOLETAS A PRACTICAR (HOJA OFICIO)';
  doc.text(tituloBox, 12, 27.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`ALGUACIL ASIGNADO:`, 12, 33);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(alguacilNombre.toUpperCase(), 48, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA RUTA:`, 110, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFechaDisplay(fechaImpresion), 133, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL:`, 175, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(`${boletas.length} orden(es)`, 188, 33);

  // Columnas para la tabla de práctica de boletas
  const tableHeaders = [
    'Nº',
    'Nº DE CAUSA',
    'BOLETA Nº',
    'TRIB.',
    'PERSONA A CITAR / NOTIFICAR',
    'DIRECCIÓN / SEDE',
    esSobreseimiento ? 'NOTIF. SOBRESEIMIENTO' : 'F. AUDIENCIA',
    'ART.',
    'RESULTADO / FIRMA DEL CITADO / DILIGENCIA',
  ];

  const tableBody = boletas.map((b, idx) => {
    return [
      idx + 1,
      b.numeroCausa,
      b.boletaNumero,
      b.tribunal,
      b.notificadoCitado,
      b.direccionCitacion || 'Sede / Domicilio en autos',
      (esSobreseimiento || b.seccionRuta === 'SOBRESEIMIENTO') 
        ? 'NOTIFICACIÓN SOBRESEIMIENTO' 
        : (b.esSoloNotificacion ? 'SOLO NOTIF.' : formatFechaDisplay(b.fechaAudiencia)),
      b.articuloCOPP,
      b.observaciones || '[  ] Positiva   [  ] Negativa   Firma: ________________',
    ];
  });

  autoTable(doc, {
    startY: 40,
    margin: { left: 8, right: 8 },
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      valign: 'middle',
      font: 'helvetica',
    },
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 9 },
      4: { halign: 'left', fontStyle: 'bold', cellWidth: 38 },
      5: { halign: 'left', cellWidth: 35 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 9 },
      8: { halign: 'left', cellWidth: 43.9 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  // Si no cabe en la misma página, agregar una nueva
  if (finalY > pageHeight - 35) {
    doc.addPage('legal', 'portrait');
    renderAlguacilSignatures(doc, config, alguacilNombre, 15);
  } else {
    renderAlguacilSignatures(doc, config, alguacilNombre, finalY);
  }

  const fileName = esSobreseimiento
    ? `Hoja_Ruta_Sobreseimiento_${alguacilNombre.replace(/\s+/g, '_')}_${fechaImpresion}.pdf`
    : `Hoja_Ruta_Alguacil_${alguacilNombre.replace(/\s+/g, '_')}_${fechaImpresion}.pdf`;
  const modo = opciones?.modoSalida || 'imprimir';
  const htmlPrint = generarHtmlHojaRutaAlguacil(alguacilNombre, boletas, config, fechaImpresion, esSobreseimiento);
  procesarSalidaPDF(doc, fileName, modo, `Hoja de Ruta - ${alguacilNombre} (Hoja Oficio)`, htmlPrint);
}

/**
 * Genera el documento HTML correspondiente a la Hoja de Ruta de Alguacil en formato oficial Hoja Tipo Oficio Vertical
 */
export function generarHtmlHojaRutaAlguacil(
  alguacilNombre: string,
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaRuta?: string,
  esSobreseimiento?: boolean
): string {
  const fechaImpresion = fechaRuta || new Date().toISOString().slice(0, 10);
  const rows = boletas.map((b, idx) => {
    const audTexto = (esSobreseimiento || b.seccionRuta === 'SOBRESEIMIENTO')
      ? 'NOTIFICACIÓN SOBRESEIMIENTO'
      : (b.esSoloNotificacion ? 'SOLO NOTIF.' : formatFechaDisplay(b.fechaAudiencia));
    return `
      <tr style="height: 22px; font-size: 8px; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="text-align: center; font-weight: bold; width: 22px; border: 1px solid #cbd5e1;">${idx + 1}</td>
        <td style="font-weight: bold; padding: 2px 4px; border: 1px solid #cbd5e1;">${b.numeroCausa}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1;">${b.boletaNumero || 'S/N'}</td>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${b.tribunal}</td>
        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; font-weight: 500;">${b.notificadoCitado}</td>
        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; font-size: 7.5px;">${b.direccionCitacion || 'Sede / Domicilio en autos'}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; font-size: 7.5px;">${audTexto}</td>
        <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1;">${b.articuloCOPP || '-'}</td>
        <td style="padding: 2px 4px; border: 1px solid #cbd5e1; font-size: 7.5px;">${b.observaciones || '[  ] Positiva   [  ] Negativa   Firma: _______________'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="hoja-pagina-oficio" style="width: 100%; box-sizing: border-box; padding: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
      <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px;">
        <div style="font-size: 10.5px; font-weight: bold; letter-spacing: 0.5px;">${config.entePrincipal}</div>
        <div style="font-size: 9px;">${config.circuitoJudicial}</div>
        <div style="font-size: 8.5px; opacity: 0.9;">${config.unidad}</div>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px;">
        <div style="font-size: 10.5px; font-weight: bold; color: #0f172a;">
          ${esSobreseimiento ? 'HOJA DE RUTA / SOBRESEIMIENTO - LISTADO DE BOLETAS (HOJA OFICIO)' : 'HOJA DE RUTA / LISTADO DE BOLETAS A PRACTICAR (HOJA OFICIO)'}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8.5px; margin-top: 4px; color: #334155;">
          <span><strong>ALGUACIL ASIGNADO:</strong> ${alguacilNombre.toUpperCase()}</span>
          <span><strong>FECHA RUTA:</strong> ${formatFechaDisplay(fechaImpresion)}</span>
          <span><strong>TOTAL:</strong> ${boletas.length} orden(es)</span>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #94a3b8;">
        <thead>
          <tr style="background-color: #1e293b; color: #ffffff; font-size: 7.5px; height: 24px;">
            <th style="border: 1px solid #64748b; width: 22px;">Nº</th>
            <th style="border: 1px solid #64748b; width: 85px; text-align: left; padding-left: 4px;">Nº DE CAUSA</th>
            <th style="border: 1px solid #64748b; width: 50px;">BOLETA Nº</th>
            <th style="border: 1px solid #64748b; width: 35px;">TRIB.</th>
            <th style="border: 1px solid #64748b; width: 130px;">PERSONA A CITAR / NOTIFICAR</th>
            <th style="border: 1px solid #64748b; width: 130px;">DIRECCIÓN / SEDE</th>
            <th style="border: 1px solid #64748b; width: 75px;">${esSobreseimiento ? 'NOTIF. SOBRESEIMIENTO' : 'F. AUDIENCIA'}</th>
            <th style="border: 1px solid #64748b; width: 35px;">ART.</th>
            <th style="border: 1px solid #64748b;">RESULTADO / FIRMA DEL CITADO / DILIGENCIA</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div style="display: flex; justify-content: space-between; margin-top: 14px; padding: 0 10px;">
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; width: 46%; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 22px;">ENTREGADO POR (ALGUACIL DISTRIBUIDOR):</div>
          <div style="border-top: 1px solid #475569; padding-top: 4px; font-size: 7px; color: #64748b;">Firma y Sello de Salida / Distribución</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; width: 46%; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 22px;">RECIBIDO CONFORME (ALGUACIL):</div>
          <div style="border-top: 1px solid #475569; padding-top: 4px; font-size: 7px; color: #64748b;">Alguacil: ${alguacilNombre.toUpperCase()}</div>
        </div>
      </div>
    </div>
  `;
}

function renderAlguacilSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  alguacilNombre: string,
  startY: number
) {
  const boxWidth = 96;
  const boxHeight = 24;

  // Firma 1: Alguacil Distribuidor / Encargado
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(8, startY, boxWidth, boxHeight, 'F');
  doc.rect(8, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ENTREGADO POR (ALGUACIL DISTRIBUIDOR):', 12, startY + 5);
  
  doc.setDrawColor(100, 116, 139);
  doc.line(16, startY + 16, 96, startY + 16);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y Sello de Salida / Distribución', 56, startY + 20, { align: 'center' });

  // Firma 2: Alguacil que Practica / Recibe
  doc.rect(111, startY, boxWidth, boxHeight, 'F');
  doc.rect(111, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECIBIDO CONFORME (ALGUACIL):`, 115, startY + 5);

  doc.line(119, startY + 16, 199, startY + 16);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Alguacil: ${alguacilNombre.toUpperCase()}`, 159, startY + 20, { align: 'center' });
}

export interface AsignacionAlguacilRuta {
  alguacil: string;
  boletas: BoletaJudicial[];
}

/**
 * Genera la Hoja de Ruta Compartida para 2, 3, 4 o más Alguaciles (ej. Sobreseimiento o Ruta Compartida).
 * Emite cada parte con foliado (Parte 1 de N, Parte 2 de N, etc.) en un único documento oficial.
 */
export function exportarHojaRutaCompartidaMultiplesAlguacilesPDF(
  asignaciones: AsignacionAlguacilRuta[],
  config: ConfiguracionDespacho,
  fechaRuta?: string,
  opciones?: { esSobreseimiento?: boolean; tituloRuta?: string; modoSalida?: ModoSalidaDocumento }
) {
  if (!asignaciones || asignaciones.length === 0) {
    alert('No hay asignaciones de alguaciles para generar la hoja de ruta.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const fechaImpresion = fechaRuta || new Date().toISOString().slice(0, 10);
  const esSobreseimiento = opciones?.esSobreseimiento || 
    (asignaciones || []).some(asig => (asig?.boletas || []).some(b => b?.seccionRuta === 'SOBRESEIMIENTO'));
  const totalPartes = asignaciones.length;

  asignaciones.forEach((asig, index) => {
    const isFirstPage = index === 0;
    const parteNum = index + 1;
    const alguacilNombre = asig.alguacil || 'SIN ASIGNAR';
    const boletasSub = asig.boletas;

    if (!isFirstPage) {
      doc.addPage('legal', 'portrait');
    }

    // Encabezado institucional azul profundo
    doc.setFillColor(11, 30, 59); // institucional #0B1E3B
    doc.rect(0, 0, 215.9, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, 107.95, 7, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, 107.95, 11, { align: 'center' });
    doc.text(config.unidad, 107.95, 15, { align: 'center' });

    // Cuadro superior con datos del Alguacil y Enrutamiento Compartido
    doc.setFillColor(248, 250, 252);
    doc.rect(8, 22, 199.9, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(8, 22, 199.9, 16, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const tituloBox = esSobreseimiento
      ? `HOJA DE RUTA COMPARTIDA (PARTE ${parteNum} DE ${totalPartes}) - SOBRESEIMIENTO`
      : (opciones?.tituloRuta 
          ? `${opciones.tituloRuta.toUpperCase()} (PARTE ${parteNum} DE ${totalPartes})` 
          : `HOJA DE RUTA COMPARTIDA (PARTE ${parteNum} DE ${totalPartes}) - RUTA NOTIFICACIÓN Y CITACIÓN`);
    doc.text(tituloBox, 12, 28);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`ALGUACIL ASIGNADO:`, 12, 34);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(alguacilNombre.toUpperCase(), 48, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA ASIGNACIÓN:`, 105, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(formatFechaDisplay(fechaImpresion), 140, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`BOLETAS:`, 172, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`${boletasSub.length}`, 190, 34);

    // Columnas para la tabla
    const tableHeaders = [
      'Nº',
      'Nº DE CAUSA',
      'BOLETA Nº',
      'TRIB.',
      'PERSONA A CITAR / NOTIFICAR',
      'DIRECCIÓN / SEDE',
      esSobreseimiento ? 'NOTIF. SOBRESEIMIENTO' : 'F. AUDIENCIA',
      'ART.',
      'RESULTADO / FIRMA DEL CITADO / DILIGENCIA',
    ];

    const tableBody = boletasSub.map((b, idx) => {
      return [
        idx + 1,
        b.numeroCausa,
        b.boletaNumero,
        b.tribunal,
        b.notificadoCitado,
        b.direccionCitacion || 'Sede / Domicilio en autos',
        (esSobreseimiento || b.seccionRuta === 'SOBRESEIMIENTO')
          ? 'NOTIFICACIÓN SOBRESEIMIENTO'
          : (b.esSoloNotificacion ? 'SOLO NOTIF.' : formatFechaDisplay(b.fechaAudiencia)),
        b.articuloCOPP || '',
        b.observaciones || '[  ] Positiva   [  ] Negativa   Firma: ________________',
      ];
    });

    autoTable(doc, {
      startY: 41,
      margin: { left: 8, right: 8 },
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.5,
        valign: 'middle',
        font: 'helvetica',
      },
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: [11, 30, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 6 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 9 },
        4: { halign: 'left', fontStyle: 'bold', cellWidth: 38 },
        5: { halign: 'left', cellWidth: 35 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 9 },
        8: { halign: 'left', cellWidth: 43.9 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
    const pageHeight = doc.internal.pageSize.height;

    if (finalY > pageHeight - 35) {
      doc.addPage('legal', 'portrait');
      renderAlguacilSignatures(doc, config, alguacilNombre, 15);
    } else {
      renderAlguacilSignatures(doc, config, alguacilNombre, finalY);
    }
  });

  const nombresLimpios = asignaciones.map(a => (a.alguacil || 'SIN_ASIGNAR').replace(/\s+/g, '_')).join('_y_');
  const fileName = esSobreseimiento
    ? `Ruta_Sobreseimiento_Compartida_${nombresLimpios}_${fechaImpresion}.pdf`
    : `Ruta_Compartida_${nombresLimpios}_${fechaImpresion}.pdf`;
  const modo = opciones?.modoSalida || 'imprimir';
  procesarSalidaPDF(doc, fileName, modo, `Hoja de Ruta Compartida (${asignaciones.length} Alguaciles) - Hoja Oficio`);
}

/**
 * Genera la Hoja de Ruta Compartida para Dos Alguaciles (ej. Mitad para Renzo y Mitad para Pablo).
 * Emite las dos hojas de ruta en un único documento oficial foliado para entrega simultánea.
 */
export function exportarHojaRutaCompartidaDosAlguacilesPDF(
  alguacil1: string,
  boletasAlguacil1: BoletaJudicial[],
  alguacil2: string,
  boletasAlguacil2: BoletaJudicial[],
  config: ConfiguracionDespacho,
  fechaRuta?: string,
  opciones?: { esSobreseimiento?: boolean; tituloRuta?: string; modoSalida?: ModoSalidaDocumento }
) {
  return exportarHojaRutaCompartidaMultiplesAlguacilesPDF(
    [
      { alguacil: alguacil1, boletas: boletasAlguacil1 },
      { alguacil: alguacil2, boletas: boletasAlguacil2 },
    ],
    config,
    fechaRuta,
    opciones
  );
}

/**
 * Imprime las boletas seleccionadas en formato de Boleta Judicial Oficial individual.
 * Si se pasa una sola boleta o un conjunto de boletas, genera una página por boleta,
 * lista para entregar al Alguacil y practicar la diligencia de notificación/citación.
 */
export function exportarBoletasSeleccionadasPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  if (!boletas || boletas.length === 0) {
    alert('No hay ninguna boleta seleccionada para imprimir.');
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const pageWidth = doc.internal.pageSize.width; // 215.9mm
  const pageHeight = doc.internal.pageSize.height; // 355.6mm

  boletas.forEach((b, idx) => {
    if (idx > 0) {
      doc.addPage('legal', 'portrait');
    }

    // 1. Franja superior institucional Azul Marino Oficial
    doc.setFillColor(11, 30, 59); // #0B1E3B
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Membrete Superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, pageWidth / 2, 6.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, pageWidth / 2, 11, { align: 'center' });
    doc.text(config.unidad, pageWidth / 2, 15, { align: 'center' });

    // Línea dorada institucional sutil
    doc.setDrawColor(217, 119, 6); // amber-600
    doc.setLineWidth(0.6);
    doc.line(12, 21, pageWidth - 12, 21);

    // 2. Título de la Boleta Oficial
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 30, 59);
    const tipoTitulo = b.esSoloNotificacion 
      ? 'BOLETA DE NOTIFICACIÓN JUDICIAL' 
      : 'BOLETA DE CITACIÓN Y NOTIFICACIÓN JUDICIAL';
    doc.text(tipoTitulo, pageWidth / 2, 28, { align: 'center' });

    // 3. Recuadro Principal de Datos de la Causa (Identificación Judicial)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, 32, pageWidth - 24, 28, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(12, 32, pageWidth - 24, 28, 2, 2, 'S');

    // Columna Izquierda: Causa y Boleta
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nº DE ASUNTO / CAUSA PRINCIPAL:', 16, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 30, 59);
    doc.text(b.numeroCausa, 16, 44);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TRIBUNAL DE LA CAUSA:', 16, 51);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(b.tribunal, 16, 56);

    // Columna Derecha: Boleta Nº y Fecha Asignación
    const colDerX = 135;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('BOLETA Nº:', colDerX, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(b.boletaNumero || 'S/N', colDerX, 44);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('FECHA DE EXPEDICIÓN:', colDerX, 51);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(formatFechaDisplay(b.fechaAsignacion), colDerX, 56);

    // 4. Datos del Destinatario (Persona Citada o Notificada)
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(12, 63, pageWidth - 24, 25, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(12, 63, pageWidth - 24, 25, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DIRIGIDO A / CIUDADANO(A):', 16, 69);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 30, 59);
    doc.text((b.notificadoCitado || 'A QUIEN CORRESPONDA').toUpperCase(), 16, 75);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('EN SU CARÁCTER DE:', 16, 82);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text(getCaracterDisplay(b.tipoCitado), 55, 82);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DIRECCIÓN / UBICACIÓN:', colDerX, 69);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const dirTexto = (b.direccionCitacion && b.direccionCitacion.trim() !== '')
      ? b.direccionCitacion 
      : (b.observaciones && b.observaciones.trim() !== '' ? b.observaciones : 'Jurisdicción del Estado Mérida');
    const lineasDir = doc.splitTextToSize(dirTexto, 65);
    doc.text(lineasDir, colDerX, 74);

    // 5. Contenido del Mandamiento Judicial (Audiencia o Notificación)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(12, 91, pageWidth - 24, 30, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(11, 30, 59);
    doc.text('OBJETO DEL ACTO Y COMPARECENCIA:', 16, 97);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    if (b.esSoloNotificacion) {
      const textoNotif = `Por disposición del ${b.tribunal} de la Circunscripción Judicial del Estado Mérida, se le hace saber y se le NOTIFICA formalmente del contenido del auto o resolución judicial dictada en la causa penal número ${b.numeroCausa}, para que surta los efectos procesales correspondientes.`;
      const lineasTexto = doc.splitTextToSize(textoNotif, pageWidth - 32);
      doc.text(lineasTexto, 16, 103);
    } else {
      const fechaAudStr = b.fechaAudiencia ? formatFechaDisplay(b.fechaAudiencia) : 'POR FIJAR';
      const horaAudStr = b.horaAudiencia ? b.horaAudiencia : '09:00 AM';
      const textoCita = `Por disposición del ${b.tribunal} de la Circunscripción Judicial del Estado Mérida, se le CITA formalmente para que COMPAREZCA ante la sede del despacho judicial ubicado en el Palacio de Justicia de Mérida el día:`;
      const lineasTexto = doc.splitTextToSize(textoCita, pageWidth - 32);
      doc.text(lineasTexto, 16, 103);

      // Destacado de Fecha y Hora de Audiencia
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.roundedRect(16, 109, pageWidth - 32, 9, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 58, 138);
      doc.text(`AUDIENCIA: ${fechaAudStr}  —  HORA: ${horaAudStr}`, (pageWidth - 32) / 2 + 16, 115, { align: 'center' });
    }

    // 6. Artículos Legales Aplicables del COPP
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, 124, pageWidth - 24, 38, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(12, 124, pageWidth - 24, 38, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 30, 59);
    doc.text('FUNDAMENTOS LEGALES - CÓDIGO ORGÁNICO PROCESAL PENAL (COPP):', 16, 130);

    const articulosLabels: { key: ArticuloCOPP; label: string; desc: string }[] = [
      { key: '167', label: 'Art. 167', desc: 'Citación personal mediante entrega de boleta con constancia del día y hora.' },
      { key: '168', label: 'Art. 168', desc: 'Notificación de víctimas, expertos, intérpretes y testigos por cualquier medio idóneo.' },
      { key: '169', label: 'Art. 169', desc: 'Citación dejada en el domicilio con persona mayor que habite en el mismo.' },
      { key: '170', label: 'Art. 170', desc: 'Citación o notificación de funcionarios públicos o militares en servicio.' },
      { key: '171', label: 'Art. 171', desc: 'Citación por edicto ante imposibilidad de ubicación personal.' },
      { key: '165', label: 'Art. 165', desc: 'Mandamiento formal de comparecencia obligatoria a audiencias y actos procesales.' },
      { key: 'S_165', label: 'S 165', desc: 'Citación de subordinados en su lugar de trabajo o personas jurídicas.' },
    ];

    let artY = 135;
    let mostroAlguno = false;
    articulosLabels.forEach(art => {
      if (hasArticulo(b, art.key)) {
        mostroAlguno = true;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 58, 138);
        doc.text(`• ${art.label}:`, 18, artY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(art.desc, 34, artY);
        artY += 4.2;
      }
    });

    if (!mostroAlguno) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 58, 138);
      doc.text('• Art. 167:', 18, artY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(51, 65, 85);
      doc.text('Citación personal mediante entrega de boleta con constancia del día y hora en la sede o residencia.', 34, artY);
      artY += 4.5;
    }

    // Advertencia legal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28); // rose-700
    doc.text('ADVERTENCIA: La incomparecencia injustificada acarreará las medidas coercitivas previstas en la legislación penal adjetiva vigente.', 16, 158);

    // 7. Funcionario Alguacil Asignado (o en blanco si no tiene)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(12, 164, pageWidth - 24, 11, 1, 1, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('ALGUACIL ASIGNADO PARA LA PRÁCTICA:', 16, 171);

    const algNombre = (b.alguacilPractica || '').trim();
    const esSinAlguacil = !algNombre || algNombre.toUpperCase().includes('SIN ALGUACIL') || algNombre.toUpperCase().includes('SIN ASIGNAR');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(11, 30, 59);
    if (esSinAlguacil) {
      doc.text('__________________________________________________________', 85, 171);
    } else {
      doc.text(algNombre, 85, 171);
    }

    // 8. DILIGENCIA Y CONSTANCIA DE ENTREGA / ACUSE (Al pie de la boleta)
    const acuseY = 179;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, acuseY, pageWidth - 24, 98, 2, 2, 'F');
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.4);
    doc.roundedRect(12, acuseY, pageWidth - 24, 98, 2, 2, 'S');

    doc.setFillColor(11, 30, 59);
    doc.roundedRect(12, acuseY, pageWidth - 24, 6.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CONSTANCIA DE PRÁCTICA DE LA NOTIFICACIÓN / CITACIÓN', pageWidth / 2, acuseY + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text('Hoy, en fecha: _______ / _______ / 2026, siendo las: _______ : _______ horas.', 16, acuseY + 12);
    doc.text('Dirección de la práctica: ____________________________________________________________________________________', 16, acuseY + 18);
    doc.text('Hice entrega de la presente boleta a: ________________________________________________________________________', 16, acuseY + 24);
    doc.text('Cédula de Identidad Nº: _____________________________   Teléfono de Contacto: _________________________________', 16, acuseY + 30);
    doc.text('Parentesco o relación con el citado/notificado: [   ] Propia persona   [   ] Familiar   [   ] Encargado/Laboral   [   ] Otro', 16, acuseY + 36);

    // Líneas de observaciones
    doc.text('Observaciones del funcionario actuante: ______________________________________________________________________', 16, acuseY + 42);
    doc.text('____________________________________________________________________________________________________________', 16, acuseY + 48);

    // Firmas: Receptor / Notificado + Huella + Alguacil
    const firmasY = acuseY + 70;
    
    // Firma Receptor
    doc.setDrawColor(100, 116, 139);
    doc.line(18, firmasY, 78, firmasY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('FIRMA DE QUIEN RECIBE', 48, firmasY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Cédula: ________________________', 48, firmasY + 7, { align: 'center' });

    // Huella Dactilar
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(88, firmasY - 14, 28, 26, 1, 1, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PULGAR DERECHO', 102, firmasY + 15, { align: 'center' });

    // Firma y Sello del Alguacil
    doc.setDrawColor(100, 116, 139);
    doc.line(126, firmasY, 192, firmasY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('FIRMA Y SELLO DEL ALGUACIL', 159, firmasY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Unidad de Actos y Comunicación (UAC)', 159, firmasY + 7, { align: 'center' });

    // 9. IDENTIFICADOR UAC EN LA PARTE INFERIOR (ESTRICTO REQUERIMIENTO)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    const itemNum = b.numeroItem || (idx + 1);
    const hojaNum = Math.ceil(itemNum / 30) || 1;
    const uacInferior = `UAC: ${String(hojaNum).padStart(4, '0')}`;
    doc.text(`${uacInferior}  •  Palacio de Justicia del Estado Mérida  •  Poder Judicial`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  });

  const nombreArchivo = boletas.length === 1
    ? `Boleta_${(boletas[0].numeroCausa || 'Judicial').replace(/[^a-zA-Z0-9]/g, '_')}_${boletas[0].boletaNumero || '1'}.pdf`
    : `Boletas_Seleccionadas_${boletas.length}_unidades.pdf`;

  const tituloDesc = boletas.length === 1 
    ? `Boleta N° ${boletas[0].boletaNumero} - Causa ${boletas[0].numeroCausa}` 
    : `Boletas Seleccionadas (${boletas.length})`;
  procesarSalidaPDF(doc, nombreArchivo, modoSalida, tituloDesc);
}

export interface OpcionesResultaFisico {
  boleta: BoletaJudicial;
  alguacilResulta: string;
  fechaPractica: string; // YYYY-MM-DD
  horaPractica: string;  // Ej: "10:30 AM"
  articuloCOPP?: string;
  tipoDiligencia?: string; // Descripción del artículo o tipo
  relatoDiligencia?: string; // El relato o "cuento" de cómo fue la práctica
  modoLineasCuaderno?: boolean; // Si imprime líneas de cuaderno para escribir a puño y letra
  observaciones?: string;
  config: ConfiguracionDespacho;
  modoSalida?: ModoSalidaDocumento;
}

/**
 * Genera el formato oficial de RESULTA EN FÍSICO para una boleta seleccionada.
 * Incluye expediente, boleta, tribunal, persona citada, carácter, nombre del alguacil,
 * artículos C.O.P.P. y pauta de líneas de cuaderno para redactar a puño y letra o con relato digital.
 */
export function exportarFormatoResultaFisicoPDF(opciones: OpcionesResultaFisico) {
  const {
    boleta,
    alguacilResulta,
    fechaPractica,
    horaPractica,
    tipoDiligencia,
    relatoDiligencia,
    modoLineasCuaderno = true,
    observaciones,
    config,
  } = opciones;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const pageWidth = doc.internal.pageSize.width; // 215.9mm
  const pageHeight = doc.internal.pageSize.height; // 355.6mm

  // 1. Franja institucional superior
  doc.setFillColor(11, 30, 59); // Navy Blue
  doc.rect(0, 0, pageWidth, 17, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal || 'REPÚBLICA BOLIVARIANA DE VENEZUELA - PODER JUDICIAL', pageWidth / 2, 6, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial || 'CIRCUITO JUDICIAL PENAL DEL ESTADO MÉRIDA', pageWidth / 2, 10.8, { align: 'center' });
  doc.text('UNIDAD DE ACTOS DE COMUNICACIÓN (ALGUACILAZGO)', pageWidth / 2, 14.8, { align: 'center' });

  // Línea dorada institucional
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(14, 19.5, pageWidth - 14, 19.5);

  // 2. Título Oficial del Formato
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('RESULTA JUDICIAL', pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('ACTA DE FE PÚBLICA Y PRÁCTICA DE DILIGENCIA - CÓDIGO ORGÁNICO PROCESAL PENAL', pageWidth / 2, 29, { align: 'center' });

  // Artículos C.O.P.P. a desplegar
  const articuloDesplegado = tipoDiligencia || (boleta.articuloCOPP ? `ART. ${boleta.articuloCOPP} C.O.P.P.` : 'ART. 167 C.O.P.P.');

  // 3. Cuadro Compacto de Identificación Oficial (4 columnas para ahorrar espacio vertical)
  autoTable(doc, {
    startY: 32,
    head: [[
      {
        content: 'DATOS DE LA CAUSA, ASIGNACIÓN JUDICIAL Y ARTÍCULOS C.O.P.P.',
        colSpan: 4,
        styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 1.2 }
      }
    ]],
    body: [
      [
        { content: 'Nº ASUNTO / CAUSA:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 42 } },
        { content: boleta.numeroCausa || '-', styles: { fontStyle: 'bold', textColor: [11, 30, 59], cellWidth: 50 } },
        { content: 'Nº BOLETA JUDICIAL:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 42 } },
        { content: boleta.boletaNumero || 'S/N', styles: { fontStyle: 'bold', cellWidth: 48 } },
      ],
      [
        { content: 'TRIBUNAL DE ORIGEN:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: boleta.tribunal || '-' },
        { content: 'CARÁCTER PROCESAL:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: getCaracterDisplay(boleta.tipoCitado) },
      ],
      [
        { content: 'PERSONA A CITAR/NOTIFICAR:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: boleta.notificadoCitado || '-', styles: { fontStyle: 'bold' } },
        { content: 'ARTÍCULO(S) C.O.P.P.:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: articuloDesplegado, styles: { fontStyle: 'bold', textColor: [180, 83, 9], fontSize: 6.8 } },
      ],
      [
        { content: 'AUDIENCIA / TRÁMITE:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: boleta.esSoloNotificacion ? 'NOTIFICACIÓN DE CAUSA' : `${formatFechaDisplay(boleta.fechaAudiencia)} ${boleta.horaAudiencia || ''}`.trim() },
        { content: 'FECHA Y HORA PRÁCTICA:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: `${formatFechaDisplay(fechaPractica)} - ${horaPractica || 'HORA LABORABLE'}` },
      ],
      [
        { content: 'ALGUACIL PRACTICANTE:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: (alguacilResulta || boleta.alguacilPractica || 'SIN ASIGNAR').toUpperCase() },
        { content: 'DIRECCIÓN DE CITACIÓN:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: boleta.direccionCitacion || 'Indicada en el expediente judicial' },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.3,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
  });

  const tableEnd = doc.lastAutoTable?.finalY || 59;

  // 4. Texto introductorio declarativo de fe pública
  // Cuando se imprime con líneas de cuaderno, se omite este recuadro porque toda la información
  // ya está detallada en la parte superior y se aprovecha el espacio al máximo para los renglones de cuaderno.
  let relatoStartY = tableEnd + 3.5;

  if (!modoLineasCuaderno) {
    const introY = tableEnd + 3;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, introY, pageWidth - 28, 13, 1.5, 1.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, introY, pageWidth - 28, 13, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text('DILIGENCIA Y FE PÚBLICA DEL ALGUACIL PRACTICANTE (CÓDIGO ORGÁNICO PROCESAL PENAL):', 17, introY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    const textoIntro = `En Mérida, a la fecha ${formatFechaDisplay(fechaPractica)}, siendo las ${horaPractica || '____:____'}, yo, ${(alguacilResulta || 'EL ALGUACIL DESIGNADO').toUpperCase()}, adscrito a la Unidad de Actos de Comunicación, en cumplimiento de orden emanada del Tribunal ${boleta.tribunal} en el asunto ${boleta.numeroCausa}, me trasladé a practicar la boleta a ${boleta.notificadoCitado}, conforme a los ARTÍCULOS C.O.P.P. (${articuloDesplegado}), dejando formal constancia de las siguientes circunstancias:`;
    const splitIntro = doc.splitTextToSize(textoIntro, pageWidth - 34);
    doc.text(splitIntro, 17, introY + 7.8);
    relatoStartY = introY + 15.5;
  }

  // 5. Área de Relato Circunstanciado / Renglones Pautados Estilo Cuaderno
  const firmasY = 250;
  const relatoEndY = firmasY - 3.5; // 246.5mm
  const relatoHeight = relatoEndY - relatoStartY; // Máximo espacio aprovechado para escribir

  // Caja exterior de la resulta
  doc.setFillColor(255, 255, 255);
  doc.rect(14, relatoStartY, pageWidth - 28, relatoHeight, 'F');
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.rect(14, relatoStartY, pageWidth - 28, relatoHeight, 'S');

  // Barra de título del relato
  doc.setFillColor(248, 250, 252);
  doc.rect(14.2, relatoStartY + 0.2, pageWidth - 28.4, 6.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(14, relatoStartY + 6.7, pageWidth - 14, relatoStartY + 6.7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('RELATO CIRCUNSTANCIADO DE LA DILIGENCIA (CIRCUNSTANCIAS ENCONTRADAS Y FE PÚBLICA):', 17, relatoStartY + 4.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    modoLineasCuaderno 
      ? '(Espacio pautado estilo cuaderno para redactar circunstancias de la diligencia a puño y letra)' 
      : '(Espacio para redactar circunstancias de la diligencia a puño y letra o redacción digital)',
    pageWidth - 17,
    relatoStartY + 4.5,
    { align: 'right' }
  );

  // Margen vertical rojo/rosa estilo cuaderno judicial oficial
  const marginX = 26;
  doc.setDrawColor(252, 165, 165); // Rojo/rosa suave de margen de cuaderno
  doc.setLineWidth(0.4);
  doc.line(marginX, relatoStartY + 6.7, marginX, relatoEndY);

  // Configuración de Renglones horizontales tipo cuaderno
  const firstLineY = relatoStartY + 13;
  const lineSpacing = 7.5; // Espaciado amplio y cómodo para escritura manual
  const totalLines = Math.floor((relatoEndY - firstLineY) / lineSpacing);

  doc.setDrawColor(203, 220, 235); // Azul suave clásico de renglón de cuaderno
  doc.setLineWidth(0.25);

  let currentLineIndex = 0;

  // Si se ingresó relato digital, escribirlo en las primeras líneas
  const textoRedactado = relatoDiligencia?.trim() || observaciones?.trim() || '';
  if (textoRedactado.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    const splitRelato = doc.splitTextToSize(textoRedactado, pageWidth - 32 - (marginX - 14));
    
    splitRelato.forEach((lineText: string) => {
      const currentY = firstLineY + (currentLineIndex * lineSpacing);
      if (currentY < relatoEndY - 4) {
        doc.text(lineText, marginX + 3, currentY - 1.6);
        // Dibujar la línea de cuaderno debajo del texto
        doc.line(14, currentY, pageWidth - 14, currentY);
        currentLineIndex++;
      }
    });
  }

  // Dibujar los renglones restantes con líneas de cuaderno para puño y letra
  for (let i = currentLineIndex; i <= totalLines; i++) {
    const lineY = firstLineY + (i * lineSpacing);
    if (lineY <= relatoEndY - 2) {
      doc.line(14, lineY, pageWidth - 14, lineY);
    }
  }

  // 6. Bloque de Firmas y Huella Dactilar
  // firmasY fijado en 250 para alineación perfecta al pie
  doc.setDrawColor(100, 116, 139);
  doc.line(17, firmasY + 16, 73, firmasY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('EL ALGUACIL PRACTICANTE', 45, firmasY + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text((alguacilResulta || 'Firma y Sello Oficial').toUpperCase(), 45, firmasY + 23.5, { align: 'center' });
  doc.text('C.I. V-__________________', 45, firmasY + 27, { align: 'center' });

  // Recuadro Huella Dactilar
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(82, firmasY, 34, 29, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('HUELLA DACTILAR', 99, firmasY + 11.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('(PULGAR DERECHO)', 99, firmasY + 15.5, { align: 'center' });
  doc.text('De quien recibe / comparece', 99, firmasY + 19.5, { align: 'center' });

  // Firma 2: Persona que Recibe / Constancia de Negativa Art. 171
  doc.setDrawColor(100, 116, 139);
  doc.line(127, firmasY + 16, 193, firmasY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('PERSONA CITADA / RECEPTOR', 160, firmasY + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Nombre: _________________________________', 160, firmasY + 23.5, { align: 'center' });
  doc.text('C.I.: _______________ Telf: ______________', 160, firmasY + 27, { align: 'center' });

  // 7. Pie de página institucional
  const uacInferior = `UAC: ${String(boleta.numeroItem || 1).padStart(4, '0')} • RESULTA JUDICIAL • UNIDAD DE ACTOS DE COMUNICACIÓN (ALGUACILAZGO) • ESTADO MÉRIDA`;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text(uacInferior, pageWidth / 2, pageHeight - 6, { align: 'center' });

  const cleanExp = (boleta.numeroCausa || 'Exp').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanBol = (boleta.boletaNumero || 'Bol').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Resulta_Judicial_Exp_${cleanExp}_Boleta_${cleanBol}_${fechaPractica}.pdf`;

  procesarSalidaPDF(doc, fileName, opciones.modoSalida || 'imprimir', `Resulta en Físico - Boleta ${boleta.boletaNumero}`);
}

/**
 * RELACIÓN UNIFICADA DE ACUSES Y RESULTAS DE BOLETAS JUDICIALES
 * SECCIÓN: MÉRIDA Y OTROS ESTADOS / DESPACHOS FORÁNEOS
 * Descarga en UN SOLO LISTADO consolidado todas las boletas de los distintos tribunales foráneos,
 * sin separarlos por tribunal individual.
 */
export function exportarAcusesUnificadosMeridaPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const boletasMerida = (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');
  const boletasAProcesar = boletasMerida.length > 0 ? boletasMerida : (boletas || []);

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 215.9, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text((config.entePrincipal || 'REPÚBLICA BOLIVARIANA DE VENEZUELA • PODER JUDICIAL').toUpperCase(), 107.95, 6.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text((config.circuitoJudicial || 'CIRCUITO JUDICIAL PENAL EXTENSIÓN EL VIGÍA ESTADO MÉRIDA').toUpperCase(), 107.95, 11, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text((config.unidad || 'UNIDAD DE ACTOS Y COMUNICACIÓN (ALGUACILAZGO)').toUpperCase(), 107.95, 15, { align: 'center' });

  // Título del documento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RELACIÓN UNIFICADA DE ACUSES Y RESULTAS DE BOLETAS', 8, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Listado consolidado de causas foráneas y de la ciudad de Mérida • Período / Ruta: ${config.mesRutaActual.toUpperCase()} • Total: ${boletasAProcesar.length} Boletas`, 8, 29);

  // Línea divisoria
  doc.setDrawColor(203, 213, 225);
  doc.line(8, 31, 207.9, 31);

  // Preparar datos de la tabla unificada
  const tableRows = boletasAProcesar.map((b, idx) => {
    const artText = b.articulosCOPP && b.articulosCOPP.length > 0
      ? b.articulosCOPP.join(', ')
      : (b.articuloCOPP || '-');

    const acuseDetalle = b.acuseRecibidoPor
      ? `${b.acuseRecibidoPor}${b.acuseFechaEntrega ? ` (${formatFechaDisplay(b.acuseFechaEntrega)})` : ''}`
      : 'PENDIENTE DE ACUSE';

    const estadoDevuelta = b.devueltaAlTribunal
      ? `SÍ${b.fechaDevueltaTribunal ? ` (${formatFechaDisplay(b.fechaDevueltaTribunal)})` : ''}`
      : 'NO';

    const esDevuelta = !!b.devueltaAlTribunal;
    const algLimpio = (b.alguacilPractica || '').trim();
    const tieneAlguacilValido = algLimpio !== '' && !algLimpio.toUpperCase().includes('SIN ASIGNAR') && !algLimpio.toUpperCase().includes('SIN ALGUACIL');
    const esPracticadaReal = esDevuelta || (b.estado === 'PRACTICADA' && tieneAlguacilValido && !!b.acuseRecibidoPor);
    const esNoPracticadaReal = b.estado === 'NO_PRACTICADA' && (esDevuelta || !!b.motivoNoPractica);
    const esConcluida = esPracticadaReal || esNoPracticadaReal;

    const algTexto = tieneAlguacilValido ? algLimpio.toUpperCase() : '';
    const resulta = esConcluida
      ? (esNoPracticadaReal ? 'NO PRACT.' : 'PRACTICADA')
      : '';

    return [
      String(idx + 1),
      (b.tribunal || 'FORÁNEO').toUpperCase(),
      b.numeroCausa || '-',
      b.boletaNumero || '-',
      b.notificadoCitado || '-',
      getCaracterDisplay(b.tipoCitado),
      artText,
      algTexto,
      resulta,
      acuseDetalle,
      estadoDevuelta,
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [[
      'Nº',
      'TRIBUNAL DE ORIGEN',
      'Nº CAUSA',
      'BOLETA',
      'PERSONA CITADA / NOTIFICADA',
      'CARÁCTER',
      'ART. COPP',
      'ALGUACIL',
      'RESULTA',
      'ACUSE / RECEPCIÓN EN DESPACHO',
      'DEVUELTA',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: 'middle',
    },
    rowPageBreak: 'avoid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    margin: { left: 8, right: 8 },
    tableWidth: 199.9,
    columnStyles: {
      0: { cellWidth: 6, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 38 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 11, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 20 },
      8: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 16 },
      10: { cellWidth: 10.9, halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 8) {
          const val = String(data.cell.raw);
          if (val === 'PRACTICADA') {
            data.cell.styles.textColor = [22, 101, 52];
          } else if (val === 'NO PRACT.') {
            data.cell.styles.textColor = [153, 27, 27];
          }
        }
        if (data.column.index === 10) {
          const val = String(data.cell.raw);
          if (val.startsWith('SÍ')) {
            data.cell.styles.textColor = [30, 64, 175];
          }
        }
      }
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 140) + 12;

  if (finalY > 300) {
    doc.addPage('legal', 'portrait');
    doc.setPage(doc.getNumberOfPages());
  }

  const signY = finalY > 300 ? 20 : finalY;

  // Cuadro de Firmas de Entrega y Recepción Unificada (Hoja Oficio)
  doc.rect(8, signY, 96, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('REMITIDO POR (ALGUACILAZGO / UAC):', 11, signY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Encargado: ${config.jefeAlguacilazgo || 'Coordinación de Alguacilazgo'}`, 11, signY + 12);
  doc.text('Firma y Sello: ___________________________', 11, signY + 24);

  doc.rect(111.9, signY, 96, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RECIBIDO EN SEDE / ENLACE FORÁNEO:', 114, signY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Receptor: ________________________________', 114, signY + 12);
  doc.text('Firma y Sello: ___________________________', 114, signY + 24);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${pageCount} • UNIDAD DE ACTOS Y COMUNICACIÓN • RELACIÓN UNIFICADA DE MÉRIDA Y OTROS ESTADOS • ${new Date().toLocaleDateString('es-VE')}`,
      107.95,
      350,
      { align: 'center' }
    );
  }

  procesarSalidaPDF(doc, `Relacion_Unificada_Acuses_Merida_Otros_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`, modoSalida, 'Relación Unificada de Acuses - Mérida y Otros');
}

/**
 * INFORME ESTADÍSTICO DE BOLETAS - MÉRIDA Y OTROS ESTADOS
 * Genera el informe estadístico con el desglose por tribunal foráneo,
 * alguaciles que practicaron y artículos del COPP.
 */
export function exportarEstadisticasMeridaPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  modoSalida: ModoSalidaDocumento = 'imprimir'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  const boletasMerida = (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');
  const total = boletasMerida.length;

  let practicadas = 0;
  let devueltas = 0;
  let noPracticadas = 0;
  const tribunalStatsMap = new Map<string, { total: number; pract: number; dev: number }>();
  const alguacilMap = new Map<string, { total: number; pract: number; dev: number }>();

  boletasMerida.forEach(b => {
    const esPract = b.estado === 'PRACTICADA' || b.devueltaAlTribunal;
    const esDev = !!b.devueltaAlTribunal;
    if (esPract) practicadas++;
    else if (b.estado === 'NO_PRACTICADA') noPracticadas++;
    if (esDev) devueltas++;

    const tri = (b.tribunal || 'FORÁNEO').trim().toUpperCase();
    if (!tribunalStatsMap.has(tri)) {
      tribunalStatsMap.set(tri, { total: 0, pract: 0, dev: 0 });
    }
    const t = tribunalStatsMap.get(tri)!;
    t.total++;
    if (esPract) t.pract++;
    if (esDev) t.dev++;

    const alg = (b.alguacilPractica || '').trim().toUpperCase();
    const tieneAlg = alg !== '' && !alg.includes('SIN ASIGNAR') && !alg.includes('SIN ALGUACIL');
    if (tieneAlg) {
      if (!alguacilMap.has(alg)) {
        alguacilMap.set(alg, { total: 0, pract: 0, dev: 0 });
      }
      const a = alguacilMap.get(alg)!;
      a.total++;
      if (esPract) a.pract++;
      if (esDev) a.dev++;
    }
  });

  const efectividad = total > 0 ? Math.round((practicadas / total) * 100) : 0;
  const pctDevueltas = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  // Membrete oficial
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text((config.entePrincipal || 'REPÚBLICA BOLIVARIANA DE VENEZUELA • PODER JUDICIAL').toUpperCase(), 105, 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text((config.circuitoJudicial || 'CIRCUITO JUDICIAL PENAL EXTENSIÓN EL VIGÍA ESTADO MÉRIDA').toUpperCase(), 105, 10.5, { align: 'center' });
  doc.text((config.unidad || 'UNIDAD DE ACTOS Y COMUNICACIÓN (ALGUACILAZGO)').toUpperCase(), 105, 14, { align: 'center' });

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INFORME ESTADÍSTICO DE CAUSAS FORÁNEAS - MÉRIDA Y OTROS ESTADOS', 14, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ruta / Período: ${config.mesRutaActual.toUpperCase()} • Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`, 14, 29);

  // Cuadros resumen
  const kpiY = 32;
  const kpis = [
    { label: 'TOTAL BOLETAS', val: String(total), color: [15, 23, 42] },
    { label: 'PRACTICADAS', val: `${practicadas} (${efectividad}%)`, color: [22, 101, 52] },
    { label: 'DEVUELTAS', val: `${devueltas} (${pctDevueltas}%)`, color: [30, 64, 175] },
    { label: 'PENDIENTES', val: String(total - devueltas), color: [180, 83, 9] },
  ];

  kpis.forEach((kpi, i) => {
    const x = 14 + i * 46;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, kpiY, 43, 15, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 21.5, kpiY + 4.5, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 21.5, kpiY + 11.5, { align: 'center' });
  });

  // Tabla 1: Desglose por Tribunal Foráneo
  const tribunalRows = Array.from(tribunalStatsMap.entries()).map(([tri, data]) => {
    const ef = data.total > 0 ? `${Math.round((data.pract / data.total) * 100)}%` : '0%';
    return [
      tri,
      String(data.total),
      String(data.pract),
      String(data.dev),
      String(data.total - data.dev),
      ef,
    ];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RENDIMIENTO POR DESPACHO Y TRIBUNAL FORÁNEO', 14, 53);

  autoTable(doc, {
    startY: 55,
    head: [['TRIBUNAL DE ORIGEN', 'TOTAL', 'PRACTICADAS', 'DEVUELTAS', 'PENDIENTES', 'EFECTIVIDAD']],
    body: tribunalRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
    },
  });

  // Tabla 2: Rendimiento por Alguacil en Mérida / Otros
  const nextY = (doc.lastAutoTable?.finalY || 100) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. PARTICIPACIÓN Y GESTIÓN POR ALGUACIL', 14, nextY);

  const alguacilRows = Array.from(alguacilMap.entries()).map(([alg, data]) => {
    const ef = data.total > 0 ? `${Math.round((data.pract / data.total) * 100)}%` : '0%';
    return [
      alg,
      String(data.total),
      String(data.pract),
      String(data.dev),
      ef,
    ];
  });

  autoTable(doc, {
    startY: nextY + 2,
    head: [['ALGUACIL RESPONSABLE', 'BOLETAS ASIGNADAS', 'PRACTICADAS', 'DEVUELTAS', 'EFECTIVIDAD']],
    body: alguacilRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
    },
  });

  const finalSignY = (doc.lastAutoTable?.finalY || 160) + 12;

  // Cuadro de firmas oficial
  doc.rect(14, finalSignY, 86, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('COORDINACIÓN DE ALGUACILAZGO:', 16, finalSignY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(config.jefeAlguacilazgo || 'Abg. Coordinador de Alguacilazgo', 16, finalSignY + 11);
  doc.text('Firma y Sello Oficial: _______________________', 16, finalSignY + 22);

  doc.rect(110, finalSignY, 86, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CONTROL Y ESTADÍSTICA UAC:', 112, finalSignY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Unidad de Actos y Comunicación', 112, finalSignY + 11);
  doc.text('Firma y Sello Oficial: _______________________', 112, finalSignY + 22);

  procesarSalidaPDF(doc, `Informe_Estadistico_Merida_Otros_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`, modoSalida, 'Informe Estadístico - Mérida y Otros Estados');
}

/**
 * Genera el documento HTML del Reporte Estadístico Periódico (Día, Semana o Mes)
 * Formato 100% estadístico con KPIs, matrices de tribunales, artículos del COPP y firmas.
 */
export function generarHtmlRelacionPeriodica(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  tipoPeriodo: 'DIA' | 'SEMANA' | 'MES',
  etiquetaPeriodo: string
): string {
  const total = boletas.length;
  const devueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const enRuta = total - devueltas;
  const pct = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  // Tribunales
  const tribunalesCodigos = ['C1', 'C2', 'C3', 'J1', 'J2', 'J3', 'E1', 'E2', 'TPM1', 'TPM2', 'SPA 1', 'OTRO'];
  const tribStats = tribunalesCodigos.map(tri => {
    const bols = boletas.filter(b => {
      const t = (b.tribunal || '').toUpperCase().trim();
      if (tri === 'OTRO') return t === 'OTRO' || !tribunalesCodigos.slice(0, 11).includes(t);
      return t === tri;
    });
    const dev = bols.filter(b => b.devueltaAlTribunal).length;
    return {
      codigo: tri,
      total: bols.length,
      devueltas: dev,
      pendientes: bols.length - dev,
      efectividad: bols.length > 0 ? Math.round((dev / bols.length) * 100) : 0
    };
  }).filter(t => t.total > 0);

  // Artículos COPP
  let a167 = 0, a168 = 0, a169 = 0, a170 = 0, a171 = 0, a165 = 0, aS165 = 0;
  boletas.forEach(b => {
    if (hasArticulo(b, '167')) a167++;
    if (hasArticulo(b, '168')) a168++;
    if (hasArticulo(b, '169')) a169++;
    if (hasArticulo(b, '170')) a170++;
    if (hasArticulo(b, '171')) a171++;
    if (hasArticulo(b, '165')) a165++;
    if (hasArticulo(b, 'S_165')) aS165++;
  });
  const totalArts = a167 + a168 + a169 + a170 + a171 + a165 + aS165;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 15px; color: #0f172a;">
      <div style="background-color: #0f172a; color: #ffffff; text-align: center; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: bold;">${config.entePrincipal}</div>
        <div style="font-size: 9.5px;">${config.circuitoJudicial}</div>
        <div style="font-size: 9px; opacity: 0.9;">${config.unidad}</div>
      </div>

      <div style="margin-bottom: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
        <h2 style="font-size: 13px; font-weight: bold; margin: 0; color: #0f172a; text-transform: uppercase;">
          REPORTE ESTADÍSTICO JUDICIAL - CONTROL PERIÓDICO (${tipoPeriodo}: ${etiquetaPeriodo.toUpperCase()})
        </h2>
        <div style="font-size: 9px; color: #475569; margin-top: 3px;">
          Rendición de Cuentas, Totales, Efectividad y Artículos del COPP (Sin listado individual de boletas) • Emisión: ${new Date().toLocaleDateString('es-VE')}
        </div>
      </div>

      <!-- Tarjetas KPIs -->
      <div style="display: flex; gap: 8px; margin-bottom: 14px;">
        <div style="flex: 1; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #475569; text-transform: uppercase;">Total Asignadas</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${total}</div>
        </div>
        <div style="flex: 1; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #047857; text-transform: uppercase;">Practicadas / Devueltas</div>
          <div style="font-size: 16px; font-weight: bold; color: #065f46;">${devueltas}</div>
        </div>
        <div style="flex: 1; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #b45309; text-transform: uppercase;">En Ruta / Pendientes</div>
          <div style="font-size: 16px; font-weight: bold; color: #92400e;">${enRuta}</div>
        </div>
        <div style="flex: 1; background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 8px; text-align: center;">
          <div style="font-size: 8px; font-weight: bold; color: #4338ca; text-transform: uppercase;">Efectividad</div>
          <div style="font-size: 16px; font-weight: bold; color: #3730a3;">${pct}%</div>
        </div>
      </div>

      <!-- Matriz por Tribunales -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #1e293b;">1. MATRIZ ESTADÍSTICA POR TRIBUNAL</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              <th style="padding: 5px; text-align: left;">Despacho Judicial</th>
              <th style="padding: 5px; text-align: center;">Asignadas</th>
              <th style="padding: 5px; text-align: center;">Practicadas (Devueltas)</th>
              <th style="padding: 5px; text-align: center;">En Ruta (Pendientes)</th>
              <th style="padding: 5px; text-align: center;">% Efectividad</th>
            </tr>
          </thead>
          <tbody>
            ${tribStats.map((t, idx) => `
              <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 4px 6px; font-weight: bold;">Tribunal ${t.codigo}</td>
                <td style="padding: 4px; text-align: center;">${t.total}</td>
                <td style="padding: 4px; text-align: center; color: #047857; font-weight: bold;">${t.devueltas}</td>
                <td style="padding: 4px; text-align: center; color: #b45309;">${t.pendientes}</td>
                <td style="padding: 4px; text-align: center; font-weight: bold;">${t.efectividad}%</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
              <td style="padding: 5px 6px;">TOTAL CONSOLIDADO</td>
              <td style="padding: 5px; text-align: center;">${total}</td>
              <td style="padding: 5px; text-align: center; color: #047857;">${devueltas}</td>
              <td style="padding: 5px; text-align: center; color: #b45309;">${enRuta}</td>
              <td style="padding: 5px; text-align: center;">${pct}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Matriz por Artículos COPP -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #1e293b;">2. TIPIFICACIÓN POR ARTÍCULOS DEL C.O.P.P.</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background-color: #1e293b; color: white;">
              <th style="padding: 5px; text-align: center; width: 100px;">Artículo COPP</th>
              <th style="padding: 5px; text-align: center; width: 80px;">Diligencias</th>
              <th style="padding: 5px; text-align: left;">Descripción Legal de la Diligencia</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding: 4px; text-align: center; font-weight: bold;">167</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a167}</td><td style="padding: 4px 6px;">Citación Personal del Imputado</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 4px; text-align: center; font-weight: bold;">168</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a168}</td><td style="padding: 4px 6px;">Citación por Boleta / Domicilio</td></tr>
            <tr><td style="padding: 4px; text-align: center; font-weight: bold;">169</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a169}</td><td style="padding: 4px 6px;">Citación por Cartel en Estrado o Prensa</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 4px; text-align: center; font-weight: bold;">170</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a170}</td><td style="padding: 4px 6px;">Citación de Víctimas, Testigos, Expertos y Terceros</td></tr>
            <tr><td style="padding: 4px; text-align: center; font-weight: bold;">171</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a171}</td><td style="padding: 4px 6px;">Citación de Militares y Funcionarios / Exhorto o Comisión</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 4px; text-align: center; font-weight: bold;">165</td><td style="padding: 4px; text-align: center; font-weight: bold;">${a165}</td><td style="padding: 4px 6px;">Notificación de Autos, Decretos y Resoluciones</td></tr>
            <tr><td style="padding: 4px; text-align: center; font-weight: bold;">S 165</td><td style="padding: 4px; text-align: center; font-weight: bold;">${aS165}</td><td style="padding: 4px 6px;">Notificación de Sobreseimiento</td></tr>
            <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
              <td style="padding: 4px; text-align: center;">TOTAL DILIGENCIAS</td>
              <td style="padding: 4px; text-align: center; color: #4338ca;">${totalArts}</td>
              <td style="padding: 4px 6px;">Artículos COPP aplicados en el período</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Firmas Oficiales -->
      <div style="display: flex; justify-content: space-between; margin-top: 18px;">
        <div style="width: 46%; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 25px;">ENTREGADO POR (ALGUACILAZGO):</div>
          <div style="border-top: 1px solid #475569; padding-top: 3px; font-size: 7.5px; color: #64748b; text-align: center;">Firma y Sello Oficial</div>
        </div>
        <div style="width: 46%; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background-color: #f8fafc;">
          <div style="font-size: 8px; font-weight: bold; color: #0f172a; margin-bottom: 25px;">RECIBIDO CONFORME (PRESIDENCIA / SECRETARÍA):</div>
          <div style="border-top: 1px solid #475569; padding-top: 3px; font-size: 7.5px; color: #64748b; text-align: center;">Firma, Fecha y Sello Conforme</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Guarda e imprime el Reporte Estadístico Periódico oficial (por Día, Semana o Mes)
 * Formato 100% estadístico: Membrete oficial, métricas clave, matriz de tribunales, artículos del COPP y firmas.
 * Sin listado individual de boletas.
 */
export function exportarRelacionPeriodicaPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  tipoPeriodo: 'DIA' | 'SEMANA' | 'MES',
  etiquetaPeriodo: string,
  modoSalida: ModoSalidaDocumento = 'descargar'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'legal',
  }) as jsPDFWithPlugin;

  // 1. Membrete Judicial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 107.95, 12, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 107.95, 17, { align: 'center' });
  doc.text(config.unidad, 107.95, 21, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(8, 24, 207.9, 24);

  // 2. Título Estadístico
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`REPORTE ESTADÍSTICO JUDICIAL - CONTROL PERIÓDICO (${tipoPeriodo}: ${etiquetaPeriodo.toUpperCase()})`, 8, 30);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Resumen Numérico Consolidado de Gestión y Rendición de Cuentas • Emisión: ${new Date().toLocaleDateString('es-VE')}`,
    8,
    34.5
  );

  const total = boletas.length;
  const devueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const enRuta = total - devueltas;
  const pct = total > 0 ? Math.round((devueltas / total) * 100) : 0;

  // 3. Cuadros de Indicadores Clave (KPIs)
  const kpiY = 38;
  const boxWidth = 47.5;
  const boxHeight = 14;
  const gap = 3.3;

  // Box 1: Total Asignadas
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(8, kpiY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('TOTAL ASIGNADAS', 8 + boxWidth / 2, kpiY + 4.5, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(String(total), 8 + boxWidth / 2, kpiY + 11, { align: 'center' });

  // Box 2: Practicadas (Devueltas)
  const b2X = 8 + boxWidth + gap;
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(b2X, kpiY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFontSize(6.8);
  doc.setTextColor(4, 120, 87);
  doc.text('PRACTICADAS (DEVUELTAS)', b2X + boxWidth / 2, kpiY + 4.5, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text(String(devueltas), b2X + boxWidth / 2, kpiY + 11, { align: 'center' });

  // Box 3: En Ruta (Pendientes)
  const b3X = b2X + boxWidth + gap;
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(b3X, kpiY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFontSize(6.8);
  doc.setTextColor(180, 83, 9);
  doc.text('EN RUTA (PENDIENTES)', b3X + boxWidth / 2, kpiY + 4.5, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  doc.text(String(enRuta), b3X + boxWidth / 2, kpiY + 11, { align: 'center' });

  // Box 4: % Efectividad
  const b4X = b3X + boxWidth + gap;
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(b4X, kpiY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  doc.setFontSize(6.8);
  doc.setTextColor(67, 56, 202);
  doc.text('EFECTIVIDAD PROCESAL', b4X + boxWidth / 2, kpiY + 4.5, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(55, 48, 163);
  doc.text(`${pct}%`, b4X + boxWidth / 2, kpiY + 11, { align: 'center' });

  // 4. Tabla 1: Matriz de Gestión por Tribunales
  const tribunalesCodigos = ['C1', 'C2', 'C3', 'J1', 'J2', 'J3', 'E1', 'E2', 'TPM1', 'TPM2', 'SPA 1', 'OTRO'];
  const tribRows: (string | number)[][] = [];

  tribunalesCodigos.forEach(tri => {
    const bols = boletas.filter(b => {
      const t = (b.tribunal || '').toUpperCase().trim();
      if (tri === 'OTRO') return t === 'OTRO' || !tribunalesCodigos.slice(0, 11).includes(t);
      return t === tri;
    });
    if (bols.length > 0) {
      const dev = bols.filter(b => b.devueltaAlTribunal).length;
      const pend = bols.length - dev;
      const pctTri = Math.round((dev / bols.length) * 100);
      tribRows.push([`Tribunal ${tri}`, bols.length, dev, pend, `${pctTri}%`]);
    }
  });

  tribRows.push(['TOTAL GENERAL CONSOLIDADO', total, devueltas, enRuta, `${pct}%`]);

  autoTable(doc, {
    startY: kpiY + boxHeight + 4,
    margin: { left: 8, right: 8 },
    tableWidth: 199.9,
    head: [['DESPACHO JUDICIAL', 'ASIGNADAS', 'PRACTICADAS (DEVUELTAS)', 'EN RUTA (PENDIENTES)', '% EFECTIVIDAD']],
    body: tribRows,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 35 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 27.9 },
    },
  });

  // 5. Tabla 2: Artículos del C.O.P.P.
  let a167 = 0, a168 = 0, a169 = 0, a170 = 0, a171 = 0, a165 = 0, aS165 = 0;
  boletas.forEach(b => {
    if (hasArticulo(b, '167')) a167++;
    if (hasArticulo(b, '168')) a168++;
    if (hasArticulo(b, '169')) a169++;
    if (hasArticulo(b, '170')) a170++;
    if (hasArticulo(b, '171')) a171++;
    if (hasArticulo(b, '165')) a165++;
    if (hasArticulo(b, 'S_165')) aS165++;
  });
  const totalArts = a167 + a168 + a169 + a170 + a171 + a165 + aS165;

  const artsRows = [
    ['Artículo 167', a167, 'Citación Personal del Imputado'],
    ['Artículo 168', a168, 'Citación por Boleta / Domicilio'],
    ['Artículo 169', a169, 'Citación por Cartel en Estrado o Prensa'],
    ['Artículo 170', a170, 'Citación de Víctimas, Testigos, Expertos y Terceros'],
    ['Artículo 171', a171, 'Citación de Militares y Funcionarios / Exhorto o Comisión'],
    ['Artículo 165', a165, 'Notificación de Autos, Decretos y Resoluciones'],
    ['S 165', aS165, 'Notificación de Sobreseimiento'],
    ['TOTAL ARTÍCULOS', totalArts, 'Total de Diligencias Tipificadas COPP en el Período'],
  ];

  const table1End = doc.lastAutoTable?.finalY || 120;

  autoTable(doc, {
    startY: table1End + 5,
    margin: { left: 8, right: 8 },
    tableWidth: 199.9,
    head: [['ARTÍCULO C.O.P.P.', 'DILIGENCIAS', 'DESCRIPCIÓN LEGAL DE LA DILIGENCIA']],
    body: artsRows,
    theme: 'grid',
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 45 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
      2: { halign: 'left', cellWidth: 124.9 },
    },
  });

  // 6. Firmas oficiales de responsabilidad
  const finalY = (doc.lastAutoTable?.finalY || 200) + 8;
  const pageHeight = doc.internal.pageSize.height;

  if (finalY < pageHeight - 35) {
    // Firma 1: Alguacilazgo (Sin ENCARGADO)
    doc.rect(8, finalY, 96, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('ENTREGADO POR (ALGUACILAZGO):', 11, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Unidad de Actos y Comunicación', 11, finalY + 11);
    doc.text('Firma y Sello Oficial: _________________________', 11, finalY + 18);

    // Firma 2: Tribunal / Presidencia
    doc.rect(111.9, finalY, 96, 22);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBIDO CONFORME (PRESIDENCIA / SECRETARÍA):', 114, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Nombre del Funcionario: _________________________', 114, finalY + 11);
    doc.text('Fecha y Sello: __________________________________', 114, finalY + 18);
  }

  const cleanEtiqueta = etiquetaPeriodo.replace(/[\s/\\:]+/g, '_');
  const fileName = `Estadisticas_${tipoPeriodo}_${cleanEtiqueta}_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`;
  const htmlPrint = generarHtmlRelacionPeriodica(boletas, config, tipoPeriodo, etiquetaPeriodo);
  procesarSalidaPDF(doc, fileName, modoSalida, `Estadísticas ${tipoPeriodo}: ${etiquetaPeriodo} (Reporte Oficial)`, htmlPrint);
}



