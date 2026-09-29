import { BoletaJudicial } from '../types/judicial';

/**
 * Listado de despachos judiciales frecuentes de Mérida Capital y otros Circuitos Judiciales del país.
 * El usuario puede seleccionar cualquiera de ellos o escribir libremente cualquier otro despacho foráneo.
 */
export const TRIBUNALES_MERIDA_OTROS_SUGERIDOS = [
  { codigo: '1º CONTROL MÉRIDA', nombre: 'Tribunal Primero de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '2º CONTROL MÉRIDA', nombre: 'Tribunal Segundo de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '3º CONTROL MÉRIDA', nombre: 'Tribunal Tercero de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '4º CONTROL MÉRIDA', nombre: 'Tribunal Cuarto de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '5º CONTROL MÉRIDA', nombre: 'Tribunal Quinto de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '6º CONTROL MÉRIDA', nombre: 'Tribunal Sexto de Primera Instancia en Funciones de Control - Mérida' },
  { codigo: '1º JUICIO MÉRIDA', nombre: 'Tribunal Primero de Primera Instancia en Funciones de Juicio - Mérida' },
  { codigo: '2º JUICIO MÉRIDA', nombre: 'Tribunal Segundo de Primera Instancia en Funciones de Juicio - Mérida' },
  { codigo: '3º JUICIO MÉRIDA', nombre: 'Tribunal Tercero de Primera Instancia en Funciones de Juicio - Mérida' },
  { codigo: '1º EJECUCIÓN MÉRIDA', nombre: 'Tribunal Primero de Ejecución - Mérida' },
  { codigo: '2º EJECUCIÓN MÉRIDA', nombre: 'Tribunal Segundo de Ejecución - Mérida' },
  { codigo: 'CORTE DE APELACIONES MÉRIDA', nombre: 'Corte de Apelaciones del Circuito Judicial Penal - Mérida' },
  { codigo: 'TPM 1 MÉRIDA', nombre: 'Tribunal Primero Penal Municipal - Mérida' },
  { codigo: 'TPM 2 MÉRIDA', nombre: 'Tribunal Segundo Penal Municipal - Mérida' },
  { codigo: 'TRIBUNAL PENAL TÁCHIRA', nombre: 'Circuito Judicial Penal del Estado Táchira (San Cristóbal)' },
  { codigo: 'TRIBUNAL PENAL TRUJILLO', nombre: 'Circuito Judicial Penal del Estado Trujillo' },
  { codigo: 'TRIBUNAL PENAL BARINAS', nombre: 'Circuito Judicial Penal del Estado Barinas' },
  { codigo: 'TRIBUNAL PENAL ZULIA', nombre: 'Circuito Judicial Penal del Estado Zulia' },
  { codigo: 'TRIBUNAL PENAL CARACAS', nombre: 'Circuito Judicial Penal del Área Metropolitana de Caracas' },
  { codigo: 'EXHORTO FORÁNEO', nombre: 'Comisión Foránea / Exhorto Nacional' },
];

export interface EstadisticasTribunalForaneo {
  tribunal: string;
  total: number;
  practicadas: number;
  noPracticadas: number;
  devueltas: number;
  pendientesDevuelta: number;
  conAcuse: number;
  pendientesAcuse: number;
  porcentajeEfectividad: number;
}

export interface EstadisticasMeridaOtros {
  totalBoletas: number;
  practicadas: number;
  noPracticadas: number;
  enRuta: number;
  devueltas: number;
  pendientesDevuelta: number;
  conAcuse: number;
  pendientesAcuse: number;
  porcentajeEfectividad: number;
  porcentajeDevueltas: number;
  desglosePorTribunal: EstadisticasTribunalForaneo[];
  desglosePorAlguacil: Array<{
    alguacil: string;
    total: number;
    practicadas: number;
    devueltas: number;
    porcentaje: number;
  }>;
  desgloseArticulos: Record<string, number>;
}

/**
 * Calcula las estadísticas exclusivas para la sección 4. Mérida / Otros Estados
 */
export function calcularEstadisticasMeridaOtros(boletas: BoletaJudicial[]): EstadisticasMeridaOtros {
  const boletasMerida = (boletas || []).filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA');
  const totalBoletas = boletasMerida.length;

  let practicadas = 0;
  let noPracticadas = 0;
  let enRuta = 0;
  let devueltas = 0;
  let conAcuse = 0;

  const tribunalMap = new Map<string, EstadisticasTribunalForaneo>();
  const alguacilMap = new Map<string, { total: number; practicadas: number; devueltas: number }>();
  const articulosMap: Record<string, number> = {
    '167': 0,
    '168': 0,
    '169': 0,
    '170': 0,
    '171': 0,
    '165': 0,
    'S 165': 0,
  };

  boletasMerida.forEach(b => {
    const estado = b.estado;
    const esPract = estado === 'PRACTICADA' || b.devueltaAlTribunal;
    const esNoPract = estado === 'NO_PRACTICADA';
    const esDev = !!b.devueltaAlTribunal;
    const tieneAcuse = !!(b.acuseRecibidoPor && b.acuseRecibidoPor.trim() !== '');

    if (esDev) {
      devueltas++;
    }
    if (esPract) {
      practicadas++;
    } else if (esNoPract) {
      noPracticadas++;
    } else {
      enRuta++;
    }

    if (tieneAcuse) {
      conAcuse++;
    }

    // Por Tribunal
    const triCode = (b.tribunal || 'SIN TRIBUNAL').trim().toUpperCase();
    if (!tribunalMap.has(triCode)) {
      tribunalMap.set(triCode, {
        tribunal: triCode,
        total: 0,
        practicadas: 0,
        noPracticadas: 0,
        devueltas: 0,
        pendientesDevuelta: 0,
        conAcuse: 0,
        pendientesAcuse: 0,
        porcentajeEfectividad: 0,
      });
    }
    const triStat = tribunalMap.get(triCode)!;
    triStat.total++;
    if (esPract) triStat.practicadas++;
    if (esNoPract) triStat.noPracticadas++;
    if (esDev) triStat.devueltas++;
    else triStat.pendientesDevuelta++;
    if (tieneAcuse) triStat.conAcuse++;
    else triStat.pendientesAcuse++;

    // Por Alguacil
    const alg = (b.alguacilPractica || 'SIN ASIGNAR').trim().toUpperCase();
    if (!alguacilMap.has(alg)) {
      alguacilMap.set(alg, { total: 0, practicadas: 0, devueltas: 0 });
    }
    const algStat = alguacilMap.get(alg)!;
    algStat.total++;
    if (esPract) algStat.practicadas++;
    if (esDev) algStat.devueltas++;

    // Artículos COPP
    const art = b.articuloCOPP === 'S_165' ? 'S 165' : (b.articuloCOPP || '');
    if (art && articulosMap[art] !== undefined) {
      articulosMap[art]++;
    }
    if (b.articulosCOPP && Array.isArray(b.articulosCOPP)) {
      b.articulosCOPP.forEach(a => {
        const cleanA = a === 'S_165' ? 'S 165' : a;
        if (cleanA && articulosMap[cleanA] !== undefined && cleanA !== art) {
          articulosMap[cleanA]++;
        }
      });
    }
  });

  // Calcular porcentajes por tribunal
  const desglosePorTribunal = Array.from(tribunalMap.values()).map(t => {
    t.porcentajeEfectividad = t.total > 0 ? Math.round((t.practicadas / t.total) * 100) : 0;
    return t;
  }).sort((a, b) => b.total - a.total);

  // Desglose por alguacil
  const desglosePorAlguacil = Array.from(alguacilMap.entries()).map(([alguacil, data]) => ({
    alguacil,
    total: data.total,
    practicadas: data.practicadas,
    devueltas: data.devueltas,
    porcentaje: data.total > 0 ? Math.round((data.practicadas / data.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  const pendientesDevuelta = totalBoletas - devueltas;
  const pendientesAcuse = totalBoletas - conAcuse;
  const porcentajeEfectividad = totalBoletas > 0 ? Math.round((practicadas / totalBoletas) * 100) : 0;
  const porcentajeDevueltas = totalBoletas > 0 ? Math.round((devueltas / totalBoletas) * 100) : 0;

  return {
    totalBoletas,
    practicadas,
    noPracticadas,
    enRuta,
    devueltas,
    pendientesDevuelta,
    conAcuse,
    pendientesAcuse,
    porcentajeEfectividad,
    porcentajeDevueltas,
    desglosePorTribunal,
    desglosePorAlguacil,
    desgloseArticulos: articulosMap,
  };
}
