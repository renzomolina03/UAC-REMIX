import * as XLSX from 'xlsx';
import { BoletaJudicial, ConfiguracionDespacho, hasArticulo } from '../types/judicial';
import { formatFechaDisplay } from './alerts';

/**
 * Genera el texto plano separado por tabulaciones (TSV)
 * en el orden exacto de la planilla física / Excel
 * con HORA DE AUDIENCIA al lado de FECHA DE AUDIENCIA
 * para copiar y pegar directamente con Ctrl+V en Microsoft Excel o Google Sheets.
 */
export function generarTextoParaExcel(boletas: BoletaJudicial[], incluirEncabezados: boolean = true): string {
  const headers = [
    'Nº DE CAUSA',
    'BOLETA Nº',
    'NOTIFICADO Y CITADO',
    'FECHA DE AUDIENCIA',
    'HORA DE AUDIENCIA',
    'FECHA DE ASIGNACION',
    'TRI',
    '167',
    '168',
    '169',
    '170',
    '171',
    '165',
    'S 165',
    'ALGUACIL DE CITACION QUE PRACTICA',
  ];

  const rows = boletas.map(b => {
    const esNotif = b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia;
    return [
      b.numeroCausa,
      b.boletaNumero,
      b.notificadoCitado,
      esNotif ? 'NOTIFICACION' : formatFechaDisplay(b.fechaAudiencia),
      esNotif ? '' : (b.horaAudiencia || ''),
      formatFechaDisplay(b.fechaAsignacion),
      b.tribunal,
      hasArticulo(b, '167') ? '1' : '',
      hasArticulo(b, '168') ? '1' : '',
      hasArticulo(b, '169') ? '1' : '',
      hasArticulo(b, '170') ? '1' : '',
      hasArticulo(b, '171') ? '1' : '',
      hasArticulo(b, '165') ? '1' : '',
      hasArticulo(b, 'S_165') ? '1' : '',
      b.alguacilPractica,
    ];
  });

  const allRows = incluirEncabezados ? [headers, ...rows] : rows;
  return allRows.map(row => row.join('\t')).join('\n');
}

/**
 * Copia al portapapeles en formato tabular nativo para Excel
 */
export async function copiarBoletasParaExcel(boletas: BoletaJudicial[], incluirEncabezados: boolean = true): Promise<boolean> {
  try {
    const text = generarTextoParaExcel(boletas, incluirEncabezados);
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback para entornos donde clipboard API esté restringido
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      textArea.remove();
      return success;
    }
  } catch (err) {
    console.error('Error al copiar para Excel:', err);
    return false;
  }
}

export function exportarBoletasExcel(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  filtroTribunal?: string
) {
  const wb = XLSX.utils.book_new();

  // Filtrar boletas si se especificó un tribunal
  const boletasAExportar = filtroTribunal
    ? boletas.filter(b => b.tribunal.toUpperCase() === filtroTribunal.toUpperCase())
    : boletas;

  // Formatear filas de datos en el orden exacto de la planilla
  const dataRows = boletasAExportar.map((b) => {
    const esNotif = b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia;
    return [
      b.numeroCausa,
      b.boletaNumero,
      b.numeroOficio || '',
      b.dependencia === 'SECRETARIA' ? 'SECRETARÍA' : 'NOTIF. Y CITACIÓN',
      b.responsableRelacion || config.jefeAlguacilazgo || '',
      b.notificadoCitado,
      esNotif ? 'NOTIFICACION' : formatFechaDisplay(b.fechaAudiencia),
      esNotif ? '' : (b.horaAudiencia || ''),
      formatFechaDisplay(b.fechaAsignacion),
      b.tribunal,
      hasArticulo(b, '167') ? 1 : '',
      hasArticulo(b, '168') ? 1 : '',
      hasArticulo(b, '169') ? 1 : '',
      hasArticulo(b, '170') ? 1 : '',
      hasArticulo(b, '171') ? 1 : '',
      hasArticulo(b, '165') ? 1 : '',
      hasArticulo(b, 'S_165') ? 1 : '',
      b.alguacilPractica,
      b.devueltaAlTribunal ? (b.fechaDevueltaTribunal ? `SÍ (${formatFechaDisplay(b.fechaDevueltaTribunal)})` : 'SÍ') : 'NO',
      b.fechaRecibidoUAC ? formatFechaDisplay(b.fechaRecibidoUAC) : '',
      b.acuseGenerado ? `SÍ - ${b.acuseRecibidoPor || 'Recibido'}` : 'PENDIENTE',
      b.observaciones || '',
    ];
  });

  // Encabezados
  const sheetHeader = [
    [config.entePrincipal],
    [config.circuitoJudicial],
    [config.unidad],
    [`RUTA ${config.mesRutaActual.toUpperCase()} - ${config.alguacilesRuta.toUpperCase()}${filtroTribunal ? ` - TRIBUNAL: ${filtroTribunal}` : ''}`],
    [],
    [
      'Nº DE CAUSA',
      'BOLETA Nº',
      'Nº DE OFICIO',
      'DEPENDENCIA',
      'RESPONSABLE DE RELACIÓN',
      'NOTIFICADO Y CITADO',
      'FECHA DE AUDIENCIA',
      'HORA DE AUDIENCIA',
      'FECHA DE ASIGNACION',
      'TRI',
      '167',
      '168',
      '169',
      '170',
      '171',
      '165',
      'S 165',
      'ALGUACIL DE CITACION QUE PRACTICA',
      'DEVUELTA AL TRIBUNAL',
      'FECHA DE RECIBIDO POR U.A.C.',
      'ACUSE / RECIBIDO EN TRIBUNAL',
      'OBSERVACIONES',
    ],
  ];

  const fullData = [...sheetHeader, ...dataRows];

  // Agregar totales y resumen de artículos
  const total167 = boletasAExportar.filter(b => hasArticulo(b, '167')).length;
  const total168 = boletasAExportar.filter(b => hasArticulo(b, '168')).length;
  const total169 = boletasAExportar.filter(b => hasArticulo(b, '169')).length;
  const total170 = boletasAExportar.filter(b => hasArticulo(b, '170')).length;
  const total171 = boletasAExportar.filter(b => hasArticulo(b, '171')).length;
  const total165 = boletasAExportar.filter(b => hasArticulo(b, '165')).length;
  const totalS165 = boletasAExportar.filter(b => hasArticulo(b, 'S_165')).length;
  const totalDevueltas = boletasAExportar.filter(b => b.devueltaAlTribunal).length;

  fullData.push([]);
  fullData.push([
    'TOTALES:',
    `${boletasAExportar.length} Boletas`,
    '',
    '',
    '',
    '',
    total167,
    total168,
    total169,
    total170,
    total171,
    total165,
    totalS165,
    '',
    `${totalDevueltas} Devueltas`,
    '',
    `${boletasAExportar.filter(b => b.acuseGenerado).length} con Acuse`,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(fullData);

  // Ancho de columnas recomendado
  ws['!cols'] = [
    { wch: 20 }, // Nº Causa
    { wch: 12 }, // Boleta Nº
    { wch: 36 }, // Notificado y Citado
    { wch: 18 }, // Fecha Audiencia
    { wch: 18 }, // Fecha Asignacion
    { wch: 10 }, // TRI
    { wch: 6 },  // 167
    { wch: 6 },  // 168
    { wch: 6 },  // 169
    { wch: 6 },  // 170
    { wch: 6 },  // 171
    { wch: 6 },  // 165
    { wch: 8 },  // S 165
    { wch: 24 }, // Alguacil de citacion que practica
    { wch: 18 }, // Devuelta
    { wch: 20 }, // Fecha Recibido UAC
    { wch: 24 }, // Acuse
    { wch: 32 }, // Observaciones
  ];

  const sheetName = filtroTribunal ? `TRIBUNAL ${filtroTribunal}` : 'RUTA_CITACIONES';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Si no se filtró, agregamos además hojas individuales por tribunal
  if (!filtroTribunal) {
    const tribunalesUnicos = Array.from(new Set(boletas.map(b => b.tribunal))).sort();
    tribunalesUnicos.forEach(tri => {
      const boletasTri = boletas.filter(b => b.tribunal === tri);
      if (boletasTri.length === 0) return;

      const rowsTri = boletasTri.map((b) => [
        b.numeroCausa,
        b.boletaNumero,
        b.notificadoCitado,
        b.esSoloNotificacion ? 'NOTIFICACION' : formatFechaDisplay(b.fechaAudiencia),
        formatFechaDisplay(b.fechaAsignacion),
        b.tribunal,
        b.articuloCOPP === '167' ? 1 : '',
        b.articuloCOPP === '168' ? 1 : '',
        b.articuloCOPP === '169' ? 1 : '',
        b.articuloCOPP === '170' ? 1 : '',
        b.articuloCOPP === '171' ? 1 : '',
        b.articuloCOPP === '165' ? 1 : '',
        b.articuloCOPP === 'S_165' ? 1 : '',
        b.alguacilPractica,
        b.devueltaAlTribunal ? 'SÍ' : 'NO',
        b.fechaRecibidoUAC ? formatFechaDisplay(b.fechaRecibidoUAC) : '',
        b.acuseGenerado ? `SÍ (${b.acuseRecibidoPor || ''})` : 'PENDIENTE',
        b.observaciones || '',
      ]);

      const dataTri = [
        [config.entePrincipal],
        [config.circuitoJudicial],
        [`RELACIÓN DE BOLETAS Y ACUSES - TRIBUNAL: ${tri}`],
        [],
        [
          'Nº DE CAUSA',
          'BOLETA Nº',
          'NOTIFICADO Y CITADO',
          'FECHA DE AUDIENCIA',
          'FECHA DE ASIGNACION',
          'TRI',
          '167',
          '168',
          '169',
          '170',
          '171',
          '165',
          'S 165',
          'ALGUACIL DE CITACION QUE PRACTICA',
          'DEVUELTA',
          'RECIBIDO UAC',
          'ACUSE ENTREGA',
          'OBSERVACIONES',
        ],
        ...rowsTri,
      ];

      const wsTri = XLSX.utils.aoa_to_sheet(dataTri);
      wsTri['!cols'] = ws['!cols'];
      const cleanSheetName = `TRI_${tri.replace(/[^a-zA-Z0-9]/g, '_')}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsTri, cleanSheetName);
    });
  }

  const fileName = `Control_Boletas_Judiciales_${config.mesRutaActual}_${filtroTribunal || 'CONSOLIDADO'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Exporta el listado unificado de acuses de Mérida y Otros Estados a Excel
 * consolidando TODOS los tribunales foráneos en una sola hoja.
 */
export function exportarAcusesUnificadosMeridaExcel(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho
) {
  const wb = XLSX.utils.book_new();
  const boletasMerida = (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');

  const rows = boletasMerida.map((b, idx) => [
    idx + 1,
    (b.tribunal || 'FORÁNEO').toUpperCase(),
    b.numeroCausa,
    b.boletaNumero,
    b.notificadoCitado,
    b.tipoCitado || 'CIUDADANO',
    b.esSoloNotificacion ? 'NOTIFICACION' : formatFechaDisplay(b.fechaAudiencia),
    b.horaAudiencia || '',
    formatFechaDisplay(b.fechaAsignacion),
    b.articulosCOPP && b.articulosCOPP.length > 0 ? b.articulosCOPP.join(', ') : (b.articuloCOPP || ''),
    b.alguacilPractica,
    b.estado === 'PRACTICADA' || b.devueltaAlTribunal ? 'PRACTICADA' : (b.estado === 'NO_PRACTICADA' ? 'NO PRACTICADA' : 'EN TRÁMITE'),
    b.devueltaAlTribunal ? 'SÍ' : 'NO',
    b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : '',
    b.acuseRecibidoPor || 'PENDIENTE DE ACUSE',
    b.acuseFechaEntrega ? `${formatFechaDisplay(b.acuseFechaEntrega)} ${b.acuseHoraEntrega || ''}` : '',
    b.observaciones || '',
  ]);

  const sheetData = [
    [config.entePrincipal],
    [config.circuitoJudicial],
    [config.unidad],
    [`RELACIÓN UNIFICADA DE ACUSES - MÉRIDA Y OTROS DESPACHOS FORÁNEOS (${config.mesRutaActual.toUpperCase()})`],
    [`Total Boletas: ${boletasMerida.length} • Fecha de Generación: ${new Date().toLocaleDateString('es-VE')}`],
    [],
    [
      'Nº',
      'TRIBUNAL DE ORIGEN',
      'Nº DE CAUSA',
      'BOLETA Nº',
      'PERSONA CITADA / NOTIFICADA',
      'CARÁCTER',
      'FECHA AUDIENCIA',
      'HORA',
      'FECHA ASIGNACIÓN',
      'ART. COPP',
      'ALGUACIL PRACTICA',
      'RESULTA / ESTADO',
      'DEVUELTA',
      'FECHA DEVOLUCIÓN',
      'RECIBIDO POR (ACUSE)',
      'FECHA/HORA DE ENTREGA',
      'OBSERVACIONES',
    ],
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 22 },
    { wch: 14 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 20 },
    { wch: 26 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Acuses_Merida_Otros');
  const fileName = `Acuses_Unificados_Merida_Otros_${config.mesRutaActual.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Guarda y exporta la relación judicial por Día, Semana o Mes en formato Excel estructurado
 */
export function exportarRelacionPeriodicaExcel(
  boletas: BoletaJudicial[],
  config: ConfiguracionDespacho,
  tipoPeriodo: 'DIA' | 'SEMANA' | 'MES',
  etiquetaPeriodo: string
) {
  const wb = XLSX.utils.book_new();

  const dataRows = boletas.map((b, idx) => {
    const esNotif = b.esSoloNotificacion || b.fechaAudiencia === 'NOTIFICACION' || !b.fechaAudiencia;
    return [
      idx + 1,
      b.fechaAsignacion ? formatFechaDisplay(b.fechaAsignacion) : '-',
      b.numeroCausa || '-',
      b.boletaNumero || '-',
      b.numeroOficio || '',
      b.dependencia === 'SECRETARIA' ? 'SECRETARÍA' : 'NOTIFICACIÓN Y CITACIÓN',
      b.notificadoCitado || '-',
      b.tipoCitado || 'IMPUTADO',
      b.tribunalOtro || b.tribunal || 'C1',
      esNotif ? 'NOTIFICACIÓN' : formatFechaDisplay(b.fechaAudiencia),
      b.alguacilPractica || 'SIN ASIGNAR',
      b.articuloCOPP || (b.articulosCOPP ? b.articulosCOPP.join(', ') : ''),
      b.devueltaAlTribunal ? `DEVUELTA (${b.fechaDevueltaTribunal ? formatFechaDisplay(b.fechaDevueltaTribunal) : 'SÍ'})` : 'EN RUTA',
      b.acuseRecibidoPor || '',
      b.observaciones || '',
    ];
  });

  const sheetHeader = [
    [config.entePrincipal],
    [config.circuitoJudicial],
    [config.unidad],
    [`RELACIÓN JUDICIAL DE CAUSAS Y BOLETAS - ${tipoPeriodo}: ${etiquetaPeriodo.toUpperCase()}`],
    [`Total Boletas: ${boletas.length} • Fecha de Generación: ${new Date().toLocaleDateString('es-VE')}`],
    [],
    [
      'Nº',
      'F. ASIGNACIÓN',
      'Nº DE CAUSA',
      'BOLETA Nº',
      'Nº DE OFICIO',
      'DEPENDENCIA',
      'PERSONA NOTIFICADA / CITADA',
      'CARÁCTER',
      'TRIBUNAL',
      'FECHA AUDIENCIA',
      'ALGUACIL PRACTICA',
      'ART. COPP',
      'ESTADO PROCESAL',
      'RECIBIDO POR',
      'OBSERVACIONES',
    ],
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetHeader);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 24 },
    { wch: 32 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 28 },
  ];

  const sheetName = `Relacion_${tipoPeriodo.slice(0, 10)}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const cleanEtiqueta = etiquetaPeriodo.replace(/[\s/\\:]+/g, '_');
  const fileName = `Relacion_${tipoPeriodo}_${cleanEtiqueta}_${config.mesRutaActual.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}


