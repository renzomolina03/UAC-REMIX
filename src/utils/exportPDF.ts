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
 * Imprime un documento PDF directamente en el sistema sin necesidad de descargarlo primero a disco.
 * 1. Aplica doc.autoPrint() para que el motor de renderizado abra el diálogo de impresión del sistema.
 * 2. Emite el evento 'uac-impresion-directa' para que el visor interactivo de la aplicación muestre la vista previa y controles inmediatos.
 * 3. Invoca la impresión silenciosa mediante iframe sin guardar archivos en la carpeta de descargas del usuario.
 */
export function safePrintPDF(doc: jsPDF, rawFileName: string = 'documento.pdf', titulo?: string) {
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
      }
    });
    window.dispatchEvent(event);

    // Intentar también imprimir vía iframe invisible
    const iframe = document.createElement('iframe');
    iframe.id = 'uac-direct-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.warn('Iframe print bloqueado por política de seguridad del navegador:', printErr);
        }
      }, 400);
    };

    // Limpieza de iframe
    setTimeout(() => {
      try {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch (e) {}
    }, 120000);

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
  titulo?: string
) {
  if (modo === 'imprimir') {
    safePrintPDF(doc, rawFileName, titulo);
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

  const capacidad = opcionesHojas?.capacidadPorHoja || 30;
  const idInicial = opcionesHojas?.idInicial || 'uac0001';
  
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

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const esSobreseimiento = opcionesHojas?.seccion === 'SOBRESEIMIENTO' || 
    (boletasAExportar.length > 0 && boletasAExportar.every(b => b.seccionRuta === 'SOBRESEIMIENTO'));

  // Columnas para la tabla del listado
  const tableHeaders = [
    'Nº',
    'Nº CAUSA',
    'BOLETA Nº',
    'NOTIFICADO Y CITADO',
    esSobreseimiento ? 'NOTIFICACIÓN SOBRESEIMIENTO' : 'F. AUDIENCIA',
    'HORA',
    'F. ASIG.',
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

  // Renderizar cada hoja seleccionada en su propia página física
  hojasAImprimir.forEach((hoja, sheetIdx) => {
    if (sheetIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // 1. Encabezado institucional superior
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 15, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, 148.5, 5.5, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, 148.5, 9.5, { align: 'center' });
    doc.text(config.unidad, 148.5, 13, { align: 'center' });

    // 2. Subtítulo de ruta (Izquierda)
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const tituloRuta = esSobreseimiento
      ? `CONTROL DE BOLETAS JUDICIALES - SOBRESEIMIENTO - RUTA ${config.mesRutaActual.toUpperCase()}`
      : `CONTROL DE BOLETAS JUDICIALES - RUTA ${config.mesRutaActual.toUpperCase()}`;
    doc.text(tituloRuta, 14, 21);

    // Detección precisa de alguaciles asignados en esta hoja
    // Si aún no se le ha asignado alguacil a las boletas de esta hoja, NO debe mostrar alguaciles asignados
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

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${textoAlguaciles} | ${textoFecha}${filtroTribunal ? ` | Tribunal: ${filtroTribunal}` : ' | Todos los Tribunales'}`,
      14,
      25.5
    );

    // 3. Recuadro destacado de Folio de Hoja (Limpia, UAC al final del listado)
    const badgeX = 205;
    const badgeY = 16.5;
    const badgeW = 78;
    const badgeH = 10;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`FOLIO: PÁG. ${hoja.numeroHoja} DE ${todasLasHojas.length}`, badgeX + 4, badgeY + 4.2);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const estadoHojaText = hoja.estaLlena 
      ? `HOJA LLENA (${hoja.cantidad}/${hoja.capacidad})` 
      : `EN CURSO (${hoja.cantidad}/${hoja.capacidad})`;
    doc.text(`Capacidad: ${estadoHojaText}`, badgeX + 4, badgeY + 8);

    // 4. Preparar filas de la tabla correspondientes a esta hoja
    // Requisito: Si está sin alguacil cuando se imprima que salga en blanco, si está seleccionado algún alguacil en la impresión debe aparecer el alguacil.
    const tableBody = hoja.boletas.map((b, idx) => {
      const itemNum = (hoja.numeroHoja - 1) * hoja.capacidad + idx + 1;
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
        formatFechaDisplay(b.fechaAsignacion),
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

    // 5. Generar tabla de la hoja con jspdf-autotable
    autoTable(doc, {
      startY: 28,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        cellPadding: 1.2,
        minCellHeight: 6.2,
        valign: 'middle',
        font: 'helvetica',
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [30, 41, 59], // Slate 800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 34 },
        2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 55 }, // NOTIFICADO Y CITADO centrado
        4: { halign: 'center', cellWidth: 27 }, // F. AUDIENCIA ampliado para que 'NOTIFICACIÓN' quepa sin partir la N
        5: { halign: 'center', cellWidth: 14 }, // HORA
        6: { halign: 'center', cellWidth: 15 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 11 },
        8: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 167
        9: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 168
        10: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 169
        11: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 170
        12: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 171
        13: { halign: 'center', fontStyle: 'bold', cellWidth: 9 }, // 165
        14: { halign: 'center', fontStyle: 'bold', cellWidth: 11 }, // S 165
        15: { halign: 'center', cellWidth: 24 },   // ALGUACIL
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw || '').toUpperCase();
          if (val.includes('NOTIFICAC')) {
            data.cell.styles.fontSize = 6.7;
            data.cell.styles.cellPadding = 0.6;
          }
        }
        if (data.section === 'head') {
          if (data.column.index === 8) { // 167 Gris
            data.cell.styles.fillColor = [143, 156, 168];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 9) { // 168 Azul
            data.cell.styles.fillColor = [92, 152, 226];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 10) { // 169 Azul Acero
            data.cell.styles.fillColor = [142, 168, 190];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 11) { // 170 Verde Lima
            data.cell.styles.fillColor = [157, 206, 100];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 12) { // 171 Rojo
            data.cell.styles.fillColor = [231, 68, 75];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 13) { // 165 Amarillo
            data.cell.styles.fillColor = [252, 228, 68];
            data.cell.styles.textColor = [0, 0, 0];
          } else if (data.column.index === 14) { // S 165 Naranja
            data.cell.styles.fillColor = [223, 122, 64];
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      }
    });

    // 6. Resumen y Firmas oficiales de esta hoja al pie de la página
    const tableEnd = doc.lastAutoTable?.finalY || 160;
    const finalY = Math.max(tableEnd + 3, 168);

    renderSheetSummaryAndSignatures(doc, config, hoja, todasLasHojas.length, finalY);

    // Pie de página de seguridad
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Hoja Oficial: ${hoja.idHoja} | Circuito Judicial Penal del Estado Mérida | Impresión de Folio: Pág. ${sheetIdx + 1} de ${hojasAImprimir.length}`,
      14,
      206
    );
  });

  // Guardar archivo PDF con nombre descriptivo y sanitizado
  let fileName = '';
  if (hojasAImprimir.length === 1) {
    fileName = `Listado_Boletas_Hoja_${hojasAImprimir[0].idHoja}_${config.mesRutaActual}.pdf`;
  } else if (hojasAImprimir.length === todasLasHojas.length) {
    fileName = `Listado_Boletas_Completo_${todasLasHojas[0]?.idHoja}_al_${todasLasHojas[todasLasHojas.length - 1]?.idHoja}_${config.mesRutaActual}.pdf`;
  } else {
    fileName = `Listado_Boletas_Hojas_Seleccionadas_${hojasAImprimir.length}_folioso_${config.mesRutaActual}.pdf`;
  }

  const modo = opcionesHojas?.modoSalida || 'imprimir';
  const tituloDesc = hojasAImprimir.length === 1
    ? `Listado de Boletas - Folio ${hojasAImprimir[0].idHoja}`
    : `Listado de Boletas (${hojasAImprimir.length} Folios)`;
  procesarSalidaPDF(doc, fileName, modo, tituloDesc);
}

function renderSheetSummaryAndSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  hoja: HojaLote,
  totalHojasLote: number,
  startY: number
) {
  // Recuadro de Totales de Esta Hoja
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, startY, 136, 23, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, startY, 136, 23, 2, 2, 'S');

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`RESUMEN DE FOLIO ${hoja.numeroHoja}/${totalHojasLote}:`, 18, startY + 4.5);

  // Nomenclatura oficial UAC al final del listado para archivo y búsqueda de resultas (Pie de la hoja)
  const idUacFormateado = hoja.idHoja.toUpperCase().startsWith('UAC') 
    ? hoja.idHoja.toUpperCase() 
    : `UAC: ${hoja.idHoja.padStart(4, '0')}`;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(88, startY + 1.8, 62, 5.5, 1, 1, 'F');
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(idUacFormateado, 119, startY + 5.6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Boletas en esta Hoja: ${hoja.cantidad} de ${hoja.capacidad} (${hoja.estaLlena ? 'LLENA' : 'EN CURSO'})`,
    18,
    startY + 9
  );
  doc.text(
    `Devueltas al Tribunal: ${hoja.totalDevueltas} (${hoja.porcentajeEfectividad}%) | Pendientes: ${hoja.pendientes}`,
    18,
    startY + 13.5
  );
  doc.text(
    `Tribunales: ${hoja.tribunalesInvolucrados.slice(0, 5).join(', ')}${hoja.tribunalesInvolucrados.length > 5 ? '...' : ''}`,
    18,
    startY + 18
  );

  const c = hoja.conteosArticulos;
  doc.text(`Artículos COPP: 167(${c['167']}) 168(${c['168']}) 169(${c['169']}) 170(${c['170']})`, 76, startY + 10.5);
  doc.text(`                171(${c['171']}) 165(${c['165']}) S 165(${c['S_165']})`, 76, startY + 15);

  // Firmas de Responsabilidad (A la derecha)
  const firmaY = startY + 14.5;
  doc.setDrawColor(100, 116, 139);
  
  // Firma 1: Alguacilazgo
  doc.line(162, firmaY, 217, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACIL DISTRIBUIDOR', 189.5, firmaY + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Unidad de Actos y Comunicación', 189.5, firmaY + 6.2, { align: 'center' });

  // Firma 2: Tribunal Receptor / Coordinador
  doc.line(230, firmaY, 285, firmaY);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.text('COORDINACIÓN / SECRETARÍA', 257.5, firmaY + 3.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Sello y Recibido Conforme', 257.5, firmaY + 6.2, { align: 'center' });
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
    format: 'a4',
  }) as jsPDFWithPlugin;

  // Membrete Judicial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 105, 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 105, 19, { align: 'center' });
  doc.text(config.unidad, 105, 23, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 26, 196, 26);

  // Título del Oficio de Entrega de Acuses
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILLA DE RELACIÓN Y ENTREGA DE ACUSES DE BOLETAS', 105, 33, { align: 'center' });

  // Cuadro informativo limpio: ELIMINADO Nº DE OFICIO / CONTROL y FUNCIONARIO ENTREGA
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 37, 182, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 37, 182, 13, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`TRIBUNAL DESTINATARIO:`, 18, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(tribunalNombre, 62, 45);

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
  doc.text(`FECHA DE ENTREGA:`, 128, 45);
  doc.setFont('helvetica', 'normal');
  doc.text(textoEntrega, 162, 45);

  // Ordenar boletas y detectar duplicados por (tri, numeroCausa, boletaNumero)
  // Requerimiento: Si hay varias boletas con el mismo número de expediente y número de boleta, 
  // aparece una sola boleta con: Nº, Nº DE CAUSA, BOLETA, PERSONA NOTIFICADA / CITADA, TRI, ART., ESTADO, RECIBIDA POR.
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

  const tableHeaders = ['Nº', 'Nº DE CAUSA', 'BOLETA', 'CARÁCTER', 'PERSONA NOTIFICADA / CITADA', 'TRI', 'ESTADO', 'RECIBIDA'];
  const tableBody = boletasConsolidadas.map((item, idx) => {
    const caracterDisplay = item.caracteres.length > 0 
      ? item.caracteres.join(', ') 
      : '-';

    const personasDisplay = item.notificados.length > 0
      ? item.notificados.join(' / ')
      : '-';

    const estadoTexto = item.esDevuelta
      ? (item.fechaDevuelta ? `ENTREGADO (${formatFechaDisplay(item.fechaDevuelta)})` : 'ENTREGADO')
      : 'POR ENTREGAR';

    const recibidaTexto = item.recibidaPor ? item.recibidaPor : '___________________';

    return [
      idx + 1,
      item.numeroCausa,
      item.boletaNumero,
      caracterDisplay,
      personasDisplay,
      item.tribunal,
      estadoTexto,
      recibidaTexto,
    ];
  });

  autoTable(doc, {
    startY: 53,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
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
      0: { halign: 'center', cellWidth: 8 }, // Nº
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 38 }, // Nº DE CAUSA
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 }, // BOLETA
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 }, // CARÁCTER
      4: { halign: 'left', cellWidth: 42 }, // PERSONA NOTIFICADA / CITADA
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 12 }, // TRI
      6: { halign: 'center', cellWidth: 20 }, // ESTADO
      7: { halign: 'center', cellWidth: 20 }, // RECIBIDA POR
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  const renderSignatures = (posY: number) => {
    // Texto legal
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Se hace formal entrega a la Secretaría de este Despacho Judicial de los acuses de las boletas supra indicadas para ser agregadas a sus respectivos autos y expedientes.`,
      14,
      posY,
      { maxWidth: 182 }
    );

    const firmaBoxY = posY + 6;

    // Determinar Alguacil generado por el sistema
    const alguacilesLista = Array.from(new Set(boletas.map(b => (b.alguacilPractica || '').trim()).filter(a => a && !a.toUpperCase().includes('SIN ALGUACIL') && !a.toUpperCase().includes('SIN ASIGNAR'))));
    const alguacilGenerado = (alguacilSeleccionado && !alguacilSeleccionado.toUpperCase().includes('SIN ALGUACIL') && !alguacilSeleccionado.toUpperCase().includes('SIN ASIGNAR'))
      ? alguacilSeleccionado
      : (alguacilesLista.length > 0 ? alguacilesLista.join(', ') : 'SIN ASIGNAR');

    // ENTREGADO POR (ALGUACILAZGO):
    // el nombre del alguacil generado por el sistema
    // encargado RENZO M.
    doc.rect(14, firmaBoxY, 86, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Alguacil: ${alguacilGenerado}`, 16, firmaBoxY + 13, { maxWidth: 82 });
    const textoEncargado = config.jefeAlguacilazgo && config.jefeAlguacilazgo !== 'ABG. COORDINADOR DE ALGUACILAZGO'
      ? `ENCARGADO: ${config.jefeAlguacilazgo}`
      : 'ENCARGADO:';
    doc.text(textoEncargado, 16, firmaBoxY + 21);
    doc.text(`Firma: __________________________________`, 16, firmaBoxY + 31);

    // RECIBIDO POR (SECRETARÍA TRIBUNAL):
    // Nombre: _________________________________
    // FECHA: ________________ Hora: ___________
    // Firma y Sello: _____________________
    doc.rect(110, firmaBoxY, 86, 38);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RECIBIDO POR (SECRETARÍA TRIBUNAL):', 112, firmaBoxY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Nombre: _________________________________`, 112, firmaBoxY + 14);
    doc.text(`FECHA: ________________ Hora: ___________`, 112, firmaBoxY + 22);
    doc.text(`Firma y Sello: __________________________`, 112, firmaBoxY + 31);
  };

  if (finalY > pageHeight - 50) {
    doc.addPage();
    renderSignatures(20);
  } else {
    renderSignatures(finalY);
  }

  const fileName = `Acuse_Entrega_${tribunalNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  procesarSalidaPDF(doc, fileName, modoSalida, `Planilla de Acuses - ${tribunalNombre}`);
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
    format: 'a4',
  }) as jsPDFWithPlugin;

  const totalBoletas = boletas.length;
  const totalDevueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  const efectividadGlobal = totalBoletas > 0 ? ((totalDevueltas / totalBoletas) * 100).toFixed(1) : '100.0';

  // Conteo de Artículos COPP para el QR global
  const total167 = boletas.filter(b => hasArticulo(b, '167')).length;
  const total168 = boletas.filter(b => hasArticulo(b, '168')).length;
  const total169 = boletas.filter(b => hasArticulo(b, '169')).length;
  const total170 = boletas.filter(b => hasArticulo(b, '170')).length;
  const total171 = boletas.filter(b => hasArticulo(b, '171')).length;
  const total165 = boletas.filter(b => hasArticulo(b, '165')).length;
  const totalS165 = boletas.filter(b => hasArticulo(b, 'S_165')).length;

  const coppCounts = [total167, total168, total169, total170, total171, total165, totalS165];
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

  const rows = tribunales.map(t => {
    const courtBoletas = boletas.filter(b => b.tribunal.toUpperCase() === t.codigo.toUpperCase());
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

  // Fila de Totales
  const tot167 = boletas.filter(b => hasArticulo(b, '167')).length;
  const tot168 = boletas.filter(b => hasArticulo(b, '168')).length;
  const tot169 = boletas.filter(b => hasArticulo(b, '169')).length;
  const tot170 = boletas.filter(b => hasArticulo(b, '170')).length;
  const tot171 = boletas.filter(b => hasArticulo(b, '171')).length;
  const tot165 = boletas.filter(b => hasArticulo(b, '165')).length;
  const totS165 = boletas.filter(b => hasArticulo(b, 'S_165')).length;

  rows.push([
    'TOTAL GENERAL',
    tot167,
    tot168,
    tot169,
    tot170,
    tot171,
    tot165,
    totS165,
    totalBoletas,
    totalDevueltas,
    `${efectividadGlobal}%`
  ]);

  autoTable(doc, {
    startY: 64,
    head: [tableHeaders],
    body: rows,
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
    format: 'a4',
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

  // Categorías de Sujetos Procesales
  const categoriasSujetos: { label: string; filter: (b: BoletaJudicial) => boolean }[] = [
    {
      label: 'DEFENSA (PÚBLICA / PRIVADA)',
      filter: (b) => b.tipoCitado === 'ABOGADO_DEFENSA' || b.tipoCitado === 'DEFENSA_PUBLICA'
    },
    {
      label: 'MINISTERIO PÚBLICO (FISCALÍAS)',
      filter: (b) => b.tipoCitado === 'FISCALIA'
    },
    {
      label: 'IMPUTADOS / ACUSADOS / PENADOS',
      filter: (b) => b.tipoCitado === 'IMPUTADO' || b.tipoCitado === 'ACUSADO' || b.tipoCitado === 'PENADO'
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
      label: 'CUERPOS POLICIALES / MILITARES',
      filter: (b) => b.tipoCitado === 'ORGANO_POLICIAL'
    },
    {
      label: 'OTROS (TERCEROS / FIADORES / REP.)',
      filter: (b) => ['TERCERO', 'FIADOR', 'APODERADO', 'REPRESENTANTE_LEGAL', 'OTRO'].includes(b.tipoCitado) || 
                     !['ABOGADO_DEFENSA', 'DEFENSA_PUBLICA', 'FISCALIA', 'IMPUTADO', 'ACUSADO', 'PENADO', 'VICTIMA', 'QUERELLANTE', 'DENUNCIANTE', 'TESTIGO', 'EXPERTO', 'ORGANO_POLICIAL'].includes(b.tipoCitado)
    }
  ];

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

  // Fila Total de Sujetos
  rowsSujetos.push([
    'TOTAL GENERAL',
    tot167 || 0,
    tot168 || 0,
    tot169 || 0,
    tot170 || 0,
    tot171 || 0,
    tot165 || 0,
    totS165 || 0,
    total,
    devueltas,
    `${pctEfectividad}%`
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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const cleanCode = (tribunalCodigo || '').trim().toUpperCase();
  const boletasFiltradas = (boletas || []).filter(
    b => matchesTribunal(b?.tribunal, cleanCode)
  );
  const boletasTribunal = boletasFiltradas.length > 0 ? boletasFiltradas : (boletas || []);

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 148.5, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 148.5, 11, { align: 'center' });
  doc.text(config.unidad, 148.5, 15, { align: 'center' });

  // Subtítulo del Reporte por Tribunal
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 21, 269, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 21, 269, 13, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`REPORTE DE BOLETAS Y RESULTADOS DE PRÁCTICA - ${tribunalCodigo.toUpperCase()}`, 18, 27);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Despacho: ${tribunalNombre} | Total Boletas: ${boletasTribunal.length} | Fecha de Emisión: ${new Date().toLocaleDateString('es-ES')}`,
    18,
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
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    margin: { left: 14, right: 14, top: 37, bottom: 20 },
    tableWidth: 269,
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'left', cellWidth: 47 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 19 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
      7: { halign: 'left', fontStyle: 'bold', cellWidth: 25 },
      8: { halign: 'center', cellWidth: 31 },
      9: { halign: 'left', cellWidth: 41 },
      10: { halign: 'center', cellWidth: 19 },
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

  const count167 = boletas.filter(b => b.articuloCOPP === '167').length;
  const count168 = boletas.filter(b => b.articuloCOPP === '168').length;
  const count169 = boletas.filter(b => b.articuloCOPP === '169').length;
  const count170 = boletas.filter(b => b.articuloCOPP === '170').length;
  const count171 = boletas.filter(b => b.articuloCOPP === '171').length;
  const count165 = boletas.filter(b => b.articuloCOPP === '165').length;
  const countS165 = boletas.filter(b => b.articuloCOPP === 'S_165').length;

  // Box Resumen
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, startY, 130, 26, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, startY, 130, 26, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTALES ${tribunalCodigo}:`, 18, startY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Total Boletas: ${total}`, 18, startY + 10);
  doc.text(`Practicadas Concluidas: ${practicadas}`, 18, startY + 15);
  doc.text(`Devueltas a Secretaría: ${devueltas} (${total > 0 ? Math.round((devueltas/total)*100) : 0}%)`, 18, startY + 20);

  doc.text(`Artículos COPP:`, 75, startY + 10);
  doc.text(`167(${count167}) 168(${count168}) 169(${count169}) 170(${count170})`, 75, startY + 15);
  doc.text(`171(${count171}) 165(${count165}) S 165(${countS165})`, 75, startY + 20);

  // Firmas
  const firmaY = startY + 17;
  doc.setDrawColor(100, 116, 139);

  // Alguacilazgo
  doc.line(160, firmaY, 215, firmaY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ALGUACILAZGO / PRÁCTICA', 187.5, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Funcionario Responsable', 187.5, firmaY + 7, { align: 'center' });

  // Secretaría del Tribunal
  doc.line(230, firmaY, 285, firmaY);
  doc.setFont('helvetica', 'bold');
  doc.text(`SECRETARÍA ${tribunalCodigo}`, 257.5, firmaY + 3.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Sello y Recibido en Autos', 257.5, firmaY + 7, { align: 'center' });
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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const fechaImpresion = fechaRuta || new Date().toISOString().slice(0, 10);
  const esSobreseimiento = opciones?.esSobreseimiento || (boletas || []).some(b => b?.seccionRuta === 'SOBRESEIMIENTO');

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(config.entePrincipal, 148.5, 7, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 148.5, 11, { align: 'center' });
  doc.text(config.unidad, 148.5, 15, { align: 'center' });

  // Cuadro superior con datos del Alguacil y Enrutamiento
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 22, 269, 15, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 22, 269, 15, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const tituloBox = esSobreseimiento 
    ? 'HOJA DE RUTA / SOBRESEIMIENTO - LISTADO DE BOLETAS' 
    : 'HOJA DE RUTA / LISTADO DE BOLETAS A PRACTICAR';
  doc.text(tituloBox, 18, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`ALGUACIL ASIGNADO:`, 18, 33);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(alguacilNombre.toUpperCase(), 57, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`FECHA DE ASIGNACIÓN / RUTA:`, 135, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFechaDisplay(fechaImpresion), 190, 33);

  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL BOLETAS:`, 225, 33);
  doc.setFont('helvetica', 'normal');
  doc.text(`${boletas.length} orden(es)`, 255, 33);

  // Columnas para la tabla de práctica de boletas
  const tableHeaders = [
    'Nº',
    'Nº DE CAUSA',
    'BOLETA Nº',
    'TRIB.',
    'PERSONA A CITAR / NOTIFICAR',
    'DIRECCIÓN / SEDE',
    esSobreseimiento ? 'NOTIFICACIÓN SOBRESEIMIENTO' : 'F. AUDIENCIA',
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
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      4: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
      5: { halign: 'left', cellWidth: 50 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      8: { halign: 'left', cellWidth: 62 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  const pageHeight = doc.internal.pageSize.height;

  // Si no cabe en la misma página, agregar una nueva
  if (finalY > pageHeight - 35) {
    doc.addPage();
    renderAlguacilSignatures(doc, config, alguacilNombre, 15);
  } else {
    renderAlguacilSignatures(doc, config, alguacilNombre, finalY);
  }

  const fileName = esSobreseimiento
    ? `Hoja_Ruta_Sobreseimiento_${alguacilNombre.replace(/\s+/g, '_')}_${fechaImpresion}.pdf`
    : `Hoja_Ruta_Alguacil_${alguacilNombre.replace(/\s+/g, '_')}_${fechaImpresion}.pdf`;
  const modo = opciones?.modoSalida || 'imprimir';
  procesarSalidaPDF(doc, fileName, modo, `Hoja de Ruta - ${alguacilNombre}`);
}

function renderAlguacilSignatures(
  doc: jsPDF,
  config: ConfiguracionDespacho,
  alguacilNombre: string,
  startY: number
) {
  const boxWidth = 125;
  const boxHeight = 24;

  // Firma 1: Alguacil Distribuidor / Encargado
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, startY, boxWidth, boxHeight, 'F');
  doc.rect(14, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ENTREGADO POR (ALGUACIL DISTRIBUIDOR / ENCARGADO):', 18, startY + 5);
  
  doc.setDrawColor(100, 116, 139);
  doc.line(25, startY + 16, 120, startY + 16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y Sello de Salida / Distribución', 72.5, startY + 20, { align: 'center' });

  // Firma 2: Alguacil que Practica / Recibe
  doc.rect(158, startY, boxWidth, boxHeight, 'F');
  doc.rect(158, startY, boxWidth, boxHeight, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`RECIBIDO CONFORME (ALGUACIL QUE PRACTICA):`, 162, startY + 5);

  doc.line(170, startY + 16, 265, startY + 16);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Alguacil: ${alguacilNombre.toUpperCase()} - Firma y C.I.`, 217.5, startY + 20, { align: 'center' });
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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
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
      doc.addPage();
    }

    // Encabezado institucional azul profundo
    doc.setFillColor(11, 30, 59); // institucional #0B1E3B
    doc.rect(0, 0, 297, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(config.entePrincipal, 148.5, 7, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(config.circuitoJudicial, 148.5, 11, { align: 'center' });
    doc.text(config.unidad, 148.5, 15, { align: 'center' });

    // Cuadro superior con datos del Alguacil y Enrutamiento Compartido
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 22, 269, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 22, 269, 16, 'S');

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const tituloBox = esSobreseimiento
      ? `HOJA DE RUTA COMPARTIDA (PARTE ${parteNum} DE ${totalPartes}) - SOBRESEIMIENTO`
      : (opciones?.tituloRuta 
          ? `${opciones.tituloRuta.toUpperCase()} (PARTE ${parteNum} DE ${totalPartes})` 
          : `HOJA DE RUTA COMPARTIDA (PARTE ${parteNum} DE ${totalPartes}) - RUTA NOTIFICACIÓN Y CITACIÓN`);
    doc.text(tituloBox, 18, 28);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`ALGUACIL ASIGNADO:`, 18, 34);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(alguacilNombre.toUpperCase(), 57, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA ASIGNACIÓN:`, 135, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(formatFechaDisplay(fechaImpresion), 173, 34);

    doc.setFont('helvetica', 'bold');
    doc.text(`BOLETAS ASIGNADAS:`, 210, 34);
    doc.setFont('helvetica', 'normal');
    doc.text(`${boletasSub.length} boleta(s)`, 248, 34);

    // Columnas para la tabla
    const tableHeaders = [
      'Nº',
      'Nº DE CAUSA',
      'BOLETA Nº',
      'TRIB.',
      'PERSONA A CITAR / NOTIFICAR',
      'DIRECCIÓN / SEDE',
      esSobreseimiento ? 'NOTIFICACIÓN SOBRESEIMIENTO' : 'F. AUDIENCIA',
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
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle',
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [11, 30, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
        4: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
        5: { halign: 'left', cellWidth: 50 },
        6: { halign: 'center', cellWidth: 20 },
        7: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
        8: { halign: 'left', cellWidth: 62 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
    const pageHeight = doc.internal.pageSize.height;

    if (finalY > pageHeight - 35) {
      doc.addPage();
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
  procesarSalidaPDF(doc, fileName, modo, `Hoja de Ruta Compartida (${asignaciones.length} Alguaciles)`);
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
    format: 'a4',
  }) as jsPDFWithPlugin;

  const pageWidth = doc.internal.pageSize.width; // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm

  boletas.forEach((b, idx) => {
    if (idx > 0) {
      doc.addPage('a4', 'portrait');
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
    format: 'a4',
  }) as jsPDFWithPlugin;

  const pageWidth = doc.internal.pageSize.width; // 210mm
  const pageHeight = doc.internal.pageSize.height; // 297mm

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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  const boletasMerida = (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');
  const boletasAProcesar = boletasMerida.length > 0 ? boletasMerida : (boletas || []);

  // Encabezado institucional
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text((config.entePrincipal || 'REPÚBLICA BOLIVARIANA DE VENEZUELA • PODER JUDICIAL').toUpperCase(), 148.5, 6.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text((config.circuitoJudicial || 'CIRCUITO JUDICIAL PENAL EXTENSIÓN EL VIGÍA ESTADO MÉRIDA').toUpperCase(), 148.5, 11, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text((config.unidad || 'UNIDAD DE ACTOS Y COMUNICACIÓN (ALGUACILAZGO)').toUpperCase(), 148.5, 15, { align: 'center' });

  // Título del documento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RELACIÓN UNIFICADA DE ACUSES Y RESULTAS DE BOLETAS - MÉRIDA Y OTROS TRIBUNALES', 14, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Listado consolidado de causas foráneas y de la ciudad de Mérida • Período / Ruta: ${config.mesRutaActual.toUpperCase()} • Total: ${boletasAProcesar.length} Boletas`, 14, 30);

  // Línea divisoria
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 32, 283, 32);

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
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 44 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 24 },
      8: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 40 },
      10: { cellWidth: 19, halign: 'center', fontStyle: 'bold' },
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

  if (finalY > 165) {
    doc.addPage();
    doc.setPage(doc.getNumberOfPages());
  }

  const signY = finalY > 165 ? 20 : finalY;

  // Cuadro de Firmas de Entrega y Recepción Unificada
  doc.rect(14, signY, 86, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('REMITIDO POR (ALGUACILAZGO / UAC):', 16, signY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Encargado: ${config.jefeAlguacilazgo || 'Coordinación de Alguacilazgo'}`, 16, signY + 12);
  doc.text('Firma y Sello: ____________________________________', 16, signY + 24);

  doc.rect(105, signY, 86, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ALGUACIL RESPONSABLE DE LA DILIGENCIA:', 107, signY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`Comisión: ${config.alguacilesRuta || 'Alguaciles Asignados'}`, 107, signY + 12);
  doc.text('Firma: ___________________________________________', 107, signY + 24);

  doc.rect(196, signY, 87, 32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RECIBIDO EN SEDE / CORREO / ENLACE FORÁNEO:', 198, signY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Receptor / Dependencia: _____________________________', 198, signY + 12);
  doc.text('Fecha: ____/____/________   Hora: _________________', 198, signY + 18);
  doc.text('Firma y Sello de Recibido: ___________________________', 198, signY + 25);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${pageCount} • UNIDAD DE ACTOS Y COMUNICACIÓN • RELACIÓN UNIFICADA DE MÉRIDA Y OTROS ESTADOS • ${new Date().toLocaleDateString('es-VE')}`,
      148.5,
      203,
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
    format: 'a4',
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
 * Guarda e imprime la Relación Periódica oficial de boletas (por Día, Semana o Mes)
 * Formato apaisado (landscape) con membrete oficial, casillas de firma y tabla ejecutiva.
 */
export function exportarRelacionPeriodicaPDF(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  tipoPeriodo: 'DIA' | 'SEMANA' | 'MES',
  etiquetaPeriodo: string,
  modoSalida: ModoSalidaDocumento = 'descargar'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  }) as jsPDFWithPlugin;

  // Membrete Judicial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(config.entePrincipal, 148, 12, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(config.circuitoJudicial, 148, 17, { align: 'center' });
  doc.text(config.unidad, 148, 21, { align: 'center' });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(14, 24, 283, 24);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`RELACIÓN JUDICIAL DE BOLETAS Y OFICIOS (${tipoPeriodo}: ${etiquetaPeriodo.toUpperCase()})`, 14, 30);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const totalDevueltas = boletas.filter(b => b.devueltaAlTribunal).length;
  doc.text(
    `Total Actuaciones: ${boletas.length} | Practicadas/Devueltas: ${totalDevueltas} | Pendientes en Ruta: ${boletas.length - totalDevueltas} | Generado el: ${new Date().toLocaleDateString('es-VE')}`, 
    14, 
    35
  );

  const headers = ['Nº', 'F. ASIG.', 'CAUSA Nº', 'BOLETA', 'OFICIO', 'NOTIFICADO / CITADO', 'CARÁCTER', 'TRI', 'AUDIENCIA', 'ALGUACIL', 'ART.', 'ESTADO'];
  const rows = boletas.map((b, idx) => {
    const esNotif = b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia;
    return [
      idx + 1,
      b.fechaAsignacion ? formatFechaDisplay(b.fechaAsignacion) : '-',
      b.numeroCausa || '-',
      b.boletaNumero || '-',
      b.numeroOficio || '-',
      b.notificadoCitado || '-',
      b.tipoCitado || '-',
      b.tribunalOtro || b.tribunal || '-',
      esNotif ? 'NOTIF.' : formatFechaDisplay(b.fechaAudiencia),
      b.alguacilPractica || 'SIN ASIGNAR',
      b.articuloCOPP || (b.articulosCOPP ? b.articulosCOPP.join(', ') : '-'),
      b.devueltaAlTribunal ? 'DEVUELTA' : 'EN RUTA'
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
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
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'left', cellWidth: 46 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'left', cellWidth: 32 },
      10: { halign: 'center', cellWidth: 16 },
      11: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
  if (finalY < 185) {
    doc.rect(14, finalY, 120, 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('ENTREGADO POR (ALGUACILAZGO):', 16, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(`ENCARGADO: ${config.jefeAlguacilazgo || '_________________________'}`, 16, finalY + 12);
    doc.text('Firma y Sello: _________________________________', 16, finalY + 18);

    doc.rect(160, finalY, 123, 22);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBIDO CONFORME (DESPACHO / TRIBUNAL):', 162, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('Nombre del Funcionario: _________________________', 162, finalY + 12);
    doc.text('Fecha y Sello: __________________________________', 162, finalY + 18);
  }

  const cleanEtiqueta = etiquetaPeriodo.replace(/[\s/\\:]+/g, '_');
  const fileName = `Relacion_${tipoPeriodo}_${cleanEtiqueta}_${config.mesRutaActual.replace(/\s+/g, '_')}.pdf`;
  procesarSalidaPDF(doc, fileName, modoSalida, `Relación ${tipoPeriodo}: ${etiquetaPeriodo}`);
}



