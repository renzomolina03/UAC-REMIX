import { BoletaJudicial, AlertaBoleta, NivelAlerta } from '../types/judicial';

export function parseISODate(dateStr: string): Date | null {
  if (!dateStr || dateStr.toUpperCase() === 'NOTIFICACION' || dateStr.trim() === '') {
    return null;
  }
  // Try YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  // Try DD/MM/YYYY
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10) - 1;
    const year = parseInt(slashParts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatFechaDisplay(dateStr: string): string {
  if (!dateStr) return '-';
  if (dateStr.toUpperCase() === 'NOTIFICACION') return 'NOTIFICACIÓN';
  
  const parsed = parseISODate(dateStr);
  if (!parsed) return dateStr;
  
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Determina si una boleta es "Bol. Urgente" según las reglas judiciales:
 * - Agregada el viernes con F. Audiencia para el lunes o martes
 * - Asignada de hoy para mañana (1 día de margen) o de hoy para hoy
 * - Asignada con fin de semana intermedio para lunes o martes
 * - Faltan 2 días o menos para la audiencia, o audiencia vencida sin acuse
 */
export function esBoletaUrgente(boleta: BoletaJudicial, baseDate: Date = new Date()): {
  esUrgente: boolean;
  motivo: string;
  diasRestantes?: number;
} {
  if (boleta.devueltaAlTribunal || boleta.esSoloNotificacion || !boleta.fechaAudiencia || boleta.fechaAudiencia === 'NOTIFICACION') {
    return { esUrgente: false, motivo: '' };
  }
  const audDate = parseISODate(boleta.fechaAudiencia);
  if (!audDate) return { esUrgente: false, motivo: '' };

  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const audCal = new Date(audDate.getFullYear(), audDate.getMonth(), audDate.getDate());
  const diasRestantes = Math.round((audCal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const asigDate = parseISODate(boleta.fechaAsignacion);
  let asigDayOfWeek = -1;
  const audDayOfWeek = audCal.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
  let diasEntreAsigYAud = 999;

  if (asigDate) {
    const asigCal = new Date(asigDate.getFullYear(), asigDate.getMonth(), asigDate.getDate());
    asigDayOfWeek = asigCal.getDay();
    diasEntreAsigYAud = Math.round((audCal.getTime() - asigCal.getTime()) / (1000 * 60 * 60 * 24));
  }

  // 1. Audiencia hoy
  if (diasRestantes === 0) {
    return { esUrgente: true, motivo: 'Audiencia es hoy', diasRestantes: 0 };
  }

  // 2. De hoy para mañana (1 día de margen)
  if (diasRestantes === 1) {
    return { esUrgente: true, motivo: 'Audiencia mañana (de hoy para mañana)', diasRestantes: 1 };
  }

  // 3. Agregada un viernes con F. Audiencia para lunes o martes
  if (asigDayOfWeek === 5 && (audDayOfWeek === 1 || audDayOfWeek === 2) && diasEntreAsigYAud <= 4) {
    return { 
      esUrgente: true, 
      motivo: `Agregada viernes para ${audDayOfWeek === 1 ? 'lunes' : 'martes'}`, 
      diasRestantes 
    };
  }

  // 4. Asignada jueves o fin de semana para lunes o martes
  if ((asigDayOfWeek === 4 || asigDayOfWeek === 6 || asigDayOfWeek === 0) && (audDayOfWeek === 1 || audDayOfWeek === 2) && diasEntreAsigYAud <= 5) {
    return { 
      esUrgente: true, 
      motivo: `Fin de semana intermedio para ${audDayOfWeek === 1 ? 'lunes' : 'martes'}`, 
      diasRestantes 
    };
  }

  // 5. Asignada de un día para otro
  if (diasEntreAsigYAud <= 1 && diasEntreAsigYAud >= 0) {
    return { esUrgente: true, motivo: 'Fijada de un día para otro', diasRestantes };
  }

  // 6. Faltan 2 días o menos desde hoy
  if (diasRestantes > 0 && diasRestantes <= 2) {
    return { esUrgente: true, motivo: `Audiencia en ${diasRestantes} día(s)`, diasRestantes };
  }

  // 7. Audiencia vencida sin devolver
  if (diasRestantes < 0) {
    return { esUrgente: true, motivo: `Audiencia vencida hace ${Math.abs(diasRestantes)} día(s)`, diasRestantes };
  }

  return { esUrgente: false, motivo: '', diasRestantes };
}

export function evaluarAlertaBoleta(boleta: BoletaJudicial, baseDate: Date = new Date()): AlertaBoleta {
  // Reset hours to compare pure calendar days
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  
  const asigDate = parseISODate(boleta.fechaAsignacion);
  let diasDesdeAsignacion = 0;
  if (asigDate) {
    const asigCal = new Date(asigDate.getFullYear(), asigDate.getMonth(), asigDate.getDate());
    diasDesdeAsignacion = Math.floor((today.getTime() - asigCal.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Si ya fue devuelta al tribunal
  if (boleta.devueltaAlTribunal) {
    return {
      boletaId: boleta.id,
      nivel: 'DEVUELTA',
      titulo: 'Boleta Entregada',
      mensaje: `Entregada al tribunal ${boleta.fechaDevueltaTribunal ? formatFechaDisplay(boleta.fechaDevueltaTribunal) : ''}`,
      diasDesdeAsignacion,
    };
  }

  // Si es solo notificación (sin audiencia fija)
  if (boleta.esSoloNotificacion || boleta.fechaAudiencia === 'NOTIFICACION') {
    if (diasDesdeAsignacion > 5) {
      return {
        boletaId: boleta.id,
        nivel: 'URGENTE',
        titulo: 'Notificación Pendiente',
        mensaje: `Lleva ${diasDesdeAsignacion} días desde su asignación sin reporte de acuse`,
        diasDesdeAsignacion,
      };
    }
    if (diasDesdeAsignacion > 2) {
      return {
        boletaId: boleta.id,
        nivel: 'PROXIMA',
        titulo: 'En Tramitación',
        mensaje: `Asignada hace ${diasDesdeAsignacion} días (${boleta.alguacilPractica})`,
        diasDesdeAsignacion,
      };
    }
    return {
      boletaId: boleta.id,
      nivel: 'NORMAL',
      titulo: 'Asignación Reciente',
      mensaje: `Ingresada hace ${diasDesdeAsignacion} día(s)`,
      diasDesdeAsignacion,
    };
  }

  // Tiene fecha de audiencia
  const audDate = parseISODate(boleta.fechaAudiencia);
  if (!audDate) {
    return {
      boletaId: boleta.id,
      nivel: 'NORMAL',
      titulo: 'Fecha no fijada',
      mensaje: 'Pendiente de gestión de audiencia',
      diasDesdeAsignacion,
    };
  }

  const audCal = new Date(audDate.getFullYear(), audDate.getMonth(), audDate.getDate());
  const diasRestantes = Math.round((audCal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return {
      boletaId: boleta.id,
      nivel: 'CRITICA',
      titulo: '¡Audiencia Vencida!',
      mensaje: `La audiencia fue hace ${Math.abs(diasRestantes)} día(s) y la boleta NO ha sido devuelta`,
      diasRestantes,
      diasDesdeAsignacion,
    };
  }

  if (diasRestantes === 0) {
    return {
      boletaId: boleta.id,
      nivel: 'CRITICA',
      titulo: '¡Audiencia es HOY!',
      mensaje: 'La audiencia se celebra el día de hoy. Devolución de boleta urgente.',
      diasRestantes: 0,
      diasDesdeAsignacion,
    };
  }

  if (diasRestantes === 1) {
    return {
      boletaId: boleta.id,
      nivel: 'URGENTE',
      titulo: '¡Audiencia Mañana (Día Siguiente)!',
      mensaje: `Audiencia fijada para el día siguiente (${formatFechaDisplay(boleta.fechaAudiencia)}). Diligencia urgente.`,
      diasRestantes: 1,
      diasDesdeAsignacion,
    };
  }

  // Detección de urgencia judicial por fin de semana:
  // Si fue enrutada/asignada un viernes o fin de semana y la audiencia es para el lunes o martes
  const asigDayOfWeek = asigDate ? asigDate.getDay() : -1; // 5 = viernes
  const audDayOfWeek = audCal.getDay(); // 1 = lunes, 2 = martes
  const todayDayOfWeek = today.getDay(); // 5 = viernes, 6 = sábado, 0 = domingo

  const esViernesLunesMartes = 
    (asigDayOfWeek === 5 || todayDayOfWeek === 5 || todayDayOfWeek === 6 || todayDayOfWeek === 0) &&
    (audDayOfWeek === 1 || audDayOfWeek === 2) &&
    diasRestantes <= 4;

  if (esViernesLunesMartes) {
    return {
      boletaId: boleta.id,
      nivel: 'URGENTE',
      titulo: `¡Audiencia el ${audDayOfWeek === 1 ? 'Lunes' : 'Martes'}!`,
      mensaje: `Enrutada con fin de semana intermedio. Audiencia fijada para ${audDayOfWeek === 1 ? 'Lunes' : 'Martes'} (${formatFechaDisplay(boleta.fechaAudiencia)}).`,
      diasRestantes,
      diasDesdeAsignacion,
    };
  }

  if (diasRestantes <= 2) {
    return {
      boletaId: boleta.id,
      nivel: 'URGENTE',
      titulo: 'Audiencia en 48 Horas',
      mensaje: `Faltan solo ${diasRestantes} día(s) para la audiencia (${formatFechaDisplay(boleta.fechaAudiencia)})`,
      diasRestantes,
      diasDesdeAsignacion,
    };
  }

  if (diasRestantes <= 6) {
    return {
      boletaId: boleta.id,
      nivel: 'PROXIMA',
      titulo: 'Audiencia Próxima',
      mensaje: `Faltan ${diasRestantes} días para la audiencia (${formatFechaDisplay(boleta.fechaAudiencia)})`,
      diasRestantes,
      diasDesdeAsignacion,
    };
  }

  return {
    boletaId: boleta.id,
    nivel: 'NORMAL',
    titulo: 'En Plazo',
    mensaje: `Faltan ${diasRestantes} días para la audiencia`,
    diasRestantes,
    diasDesdeAsignacion,
  };
}

export function getNivelAlertaBadge(nivel: NivelAlerta): {
  bg: string;
  text: string;
  border: string;
  label: string;
  iconColor: string;
} {
  switch (nivel) {
    case 'CRITICA':
      return {
        bg: 'bg-red-500',
        text: 'text-white',
        border: 'border-red-600',
        label: 'CRÍTICA',
        iconColor: 'text-red-500',
      };
    case 'URGENTE':
      return {
        bg: 'bg-amber-500',
        text: 'text-white',
        border: 'border-amber-600',
        label: 'URGENTE',
        iconColor: 'text-amber-500',
      };
    case 'PROXIMA':
      return {
        bg: 'bg-blue-500',
        text: 'text-white',
        border: 'border-blue-600',
        label: 'PRÓXIMA',
        iconColor: 'text-blue-500',
      };
    case 'NORMAL':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        label: 'A TIEMPO',
        iconColor: 'text-slate-500',
      };
    case 'DEVUELTA':
      return {
        bg: 'bg-emerald-500',
        text: 'text-white',
        border: 'border-emerald-600',
        label: 'DEVUELTA',
        iconColor: 'text-emerald-500',
      };
  }
}
