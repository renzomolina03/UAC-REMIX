import { BoletaJudicial, hasArticulo } from '../types/judicial';

export interface HojaLote {
  numeroHoja: number; // 1, 2, 3...
  idHoja: string; // ej: "uac1233", "uac1234"
  boletas: BoletaJudicial[];
  cantidad: number;
  capacidad: number;
  estaLlena: boolean;
  rangoItems: { desde: number; hasta: number };
  totalDevueltas: number;
  pendientes: number;
  porcentajeEfectividad: number;
  conteosArticulos: {
    '167': number;
    '168': number;
    '169': number;
    '170': number;
    '171': number;
    '165': number;
    'S_165': number;
  };
  tribunalesInvolucrados: string[];
  fechaAsignacion?: string;
  fechasAsignacionInvolucradas?: string[];
}

/**
 * Genera el identificador corto consecutivo para una hoja (ej: UAC: 0001, UAC: 0002).
 * Nomenclatura oficial UAC: 0001 con 4 dígitos consecutivos empezando en 0001.
 */
export function generarIdHoja(idInicial: string = 'UAC: 0001', indice: number = 0): string {
  let clean = (idInicial || '').trim();
  // Si venía el valor de prueba anterior 'uac1233' o está vacío, usar 'UAC: 0001'
  if (!clean || clean.toLowerCase() === 'uac1233' || clean.toLowerCase() === 'uac0001') {
    clean = 'UAC: 0001';
  }

  // Permite prefijos como 'UAC:', 'UAC: ', 'uac', 'uac-', etc.
  const match = clean.match(/^([a-zA-Z\-_:\s]*?)(\d+)$/);

  if (!match) {
    const num = indice + 1;
    return `UAC: ${String(num).padStart(4, '0')}`;
  }

  const numStr = match[2];
  const startNum = parseInt(numStr, 10);
  const nextNum = startNum + indice;
  
  // Nomenclatura reglamentaria oficial: UAC: 0001
  const padded = String(nextNum).padStart(4, '0');
  return `UAC: ${padded}`;
}

/**
 * Calcula la distribución por hojas (folios/páginas) del lote de boletas.
 * Cuando una hoja alcanza su capacidad (ej: 30 boletas) o el usuario marca
 * "finDePagina" (ej: terminar con 14 boletas), la hoja se cierra y comienza una nueva.
 */
export function calcularHojasLote(
  boletas: BoletaJudicial[],
  capacidadPorHoja: number = 30,
  idInicial: string = 'UAC: 0001'
): HojaLote[] {
  if (!boletas || boletas.length === 0) {
    return [];
  }

  const capacidadDefault = Math.max(5, capacidadPorHoja || 30);
  const hojas: HojaLote[] = [];
  let currentBoletas: BoletaJudicial[] = [];
  let currentStartIndex = 0;

  for (let i = 0; i < boletas.length; i++) {
    const b = boletas[i];
    currentBoletas.push(b);

    const nextB = i < boletas.length - 1 ? boletas[i + 1] : null;

    // Condición 1: Forzado fin de página manual (b.finDePagina)
    const esForzadoFin = !!b.finDePagina;

    // Condición 2: Capacidad alcanzada (30 boletas llenan la hoja)
    const esCapacidadAlcanzada = currentBoletas.length >= capacidadDefault;

    // Condición 3: Cambio de fecha de asignación entre boletas consecutivas
    // "Que no hallan confusión en la hoja por la fecha de asignacion,
    //  si son 40 bol una hoja debería estar llena con su 30 bol.
    //  Y continúa con la siguiente hoja de 10 bol. Termina la hoja y empieza una nueva si lo requiere para empezar la nueva hoja."
    const fechaActual = b.fechaAsignacion?.trim();
    const fechaSiguiente = nextB?.fechaAsignacion?.trim();
    const esCambioDeFecha = !!nextB && !!fechaActual && !!fechaSiguiente && fechaActual !== fechaSiguiente;

    // Condición 4: Última boleta del lote
    const esUltima = i === boletas.length - 1;

    if (esForzadoFin || esCapacidadAlcanzada || esCambioDeFecha || esUltima) {
      const cantidad = currentBoletas.length;
      const capacidadEfectiva = esCapacidadAlcanzada ? capacidadDefault : (esForzadoFin || esCambioDeFecha ? cantidad : capacidadDefault);
      const estaLlena = cantidad >= capacidadDefault;
      const idHoja = generarIdHoja(idInicial, hojas.length);
      const fin = currentStartIndex + cantidad;

      const totalDevueltas = currentBoletas.filter(item => item.devueltaAlTribunal).length;
      const pendientes = cantidad - totalDevueltas;
      const porcentajeEfectividad = cantidad > 0 ? Math.round((totalDevueltas / cantidad) * 100) : 0;

      const conteosArticulos = {
        '167': currentBoletas.filter(item => hasArticulo(item, '167')).length,
        '168': currentBoletas.filter(item => hasArticulo(item, '168')).length,
        '169': currentBoletas.filter(item => hasArticulo(item, '169')).length,
        '170': currentBoletas.filter(item => hasArticulo(item, '170')).length,
        '171': currentBoletas.filter(item => hasArticulo(item, '171')).length,
        '165': currentBoletas.filter(item => hasArticulo(item, '165')).length,
        'S_165': currentBoletas.filter(item => hasArticulo(item, 'S_165')).length,
      };

      const tribunalesSet = new Set<string>();
      const fechasSet = new Set<string>();
      currentBoletas.forEach(item => {
        if (item.tribunal) tribunalesSet.add(item.tribunal);
        if (item.fechaAsignacion) fechasSet.add(item.fechaAsignacion);
      });

      const fechasList = Array.from(fechasSet);
      const fechaAsignacionHoja = fechasList.length > 0 ? fechasList[0] : (b.fechaAsignacion || '');

      hojas.push({
        numeroHoja: hojas.length + 1,
        idHoja,
        boletas: [...currentBoletas],
        cantidad,
        capacidad: capacidadDefault,
        estaLlena,
        rangoItems: { desde: currentStartIndex + 1, hasta: fin },
        totalDevueltas,
        pendientes,
        porcentajeEfectividad,
        conteosArticulos,
        tribunalesInvolucrados: Array.from(tribunalesSet),
        fechaAsignacion: fechaAsignacionHoja,
        fechasAsignacionInvolucradas: fechasList,
      });

      currentStartIndex = fin;
      currentBoletas = [];
    }
  }

  return hojas;
}

/**
 * Mapa rápido de cada boleta.id a su respectivo idHoja (ej: "uac0001")
 */
export function mapearBoletasAHojas(
  boletas: BoletaJudicial[],
  capacidadPorHoja: number = 30,
  idInicial: string = 'uac0001'
): Map<string, { idHoja: string; numeroHoja: number; posicionEnHoja: number }> {
  const map = new Map<string, { idHoja: string; numeroHoja: number; posicionEnHoja: number }>();
  const hojas = calcularHojasLote(boletas, capacidadPorHoja, idInicial);

  hojas.forEach(h => {
    h.boletas.forEach((b, idx) => {
      map.set(b.id, {
        idHoja: h.idHoja,
        numeroHoja: h.numeroHoja,
        posicionEnHoja: idx + 1,
      });
    });
  });

  return map;
}
