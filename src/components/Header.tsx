import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Settings, 
  BarChart3, 
  Calendar,
  Clock,
  Users,
  ListOrdered,
  FileCheck,
  ShieldCheck,
  WifiOff,
  MapPin
} from 'lucide-react';
import { ConfiguracionDespacho } from '../types/judicial';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { UserMenu } from './UserMenu';
import { SesionActiva } from '../types/auth';

interface HeaderProps {
  config: ConfiguracionDespacho;
  currentTab: 'boletas' | 'merida_otros' | 'enrutamiento' | 'acuses' | 'stats';
  onTabChange: (tab: 'boletas' | 'merida_otros' | 'enrutamiento' | 'acuses' | 'stats') => void;
  onOpenConfigModal: () => void;
  onOpenSeguridadModal: () => void;
  onMonthChange: (newMonth: string) => void;
  conteoMerida?: number;
  sesionActual?: SesionActiva | null;
  dependenciaActiva?: 'NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS';
  onAbrirModalSupervisor?: () => void;
  onCambiarDependencia?: (dep: 'NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS') => void;
  onBloquearEstacion?: () => void;
  onAbrirCambioPassword?: () => void;
  onAbrirAuditoria?: () => void;
  onCerrarSesion?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  currentTab,
  onTabChange,
  onOpenConfigModal,
  onOpenSeguridadModal,
  onMonthChange,
  conteoMerida = 0,
  sesionActual,
  dependenciaActiva = 'NOTIFICACION_CITACION',
  onAbrirModalSupervisor,
  onCambiarDependencia,
  onBloquearEstacion,
  onAbrirCambioPassword,
  onAbrirAuditoria,
  onCerrarSesion,
}) => {
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const isOnline = useOnlineStatus();

  // Reloj en tiempo real con fecha y hora
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const meses = [
    { key: '2026-08', label: 'Agosto 2026' },
    { key: '2026-09', label: 'Septiembre 2026' },
    { key: '2026-10', label: 'Octubre 2026' },
    { key: '2026-11', label: 'Noviembre 2026' },
    { key: '2026-12', label: 'Diciembre 2026' },
    { key: '2027-01', label: 'Enero 2027' },
  ];

  // Formato completo en español de la fecha del día
  const fechaCompletaStr = currentDateTime.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Formato de hora con segundos y AM/PM
  const horaStr = currentDateTime.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Capitalizar día de la semana
  const fechaDisplay = fechaCompletaStr.charAt(0).toUpperCase() + fechaCompletaStr.slice(1);

  return (
    <header className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white shadow-xl border-b border-[#0046B8]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          
          {/* Logo y Título Institucional */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center text-white shadow-md shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                  Control de Boletas Judiciales
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/20 text-white font-black border border-white/30 tracking-wider">
                  EL VIGÍA
                </span>
              </div>
              <p className="text-xs text-blue-100/90 font-medium">
                {config.circuitoJudicial} • {config.unidad}
              </p>
            </div>
          </div>

          {/* Fecha del Día, Hora en vivo y Controles Institucionales */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 w-full lg:w-auto">
            
            {/* Widget Fecha del Día + Hora en vivo */}
            <div className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-xl px-3 py-1.5 shadow-sm text-xs backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-white font-semibold">
                <Calendar className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="hidden sm:inline capitalize">{fechaDisplay}</span>
                <span className="sm:hidden">{currentDateTime.toLocaleDateString('es-VE')}</span>
              </div>
              <span className="text-blue-200 font-bold">•</span>
              <div className="flex items-center gap-1 text-white font-mono font-bold tracking-wider">
                <Clock className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span>{horaStr}</span>
              </div>
            </div>

            {/* Selector de Mes de la Ruta */}
            <div className="flex items-center bg-white/15 rounded-xl px-2.5 py-1.5 border border-white/25 shadow-sm backdrop-blur-xs">
              <span className="text-[11px] font-bold text-blue-200 mr-1.5 uppercase tracking-wider hidden sm:inline">Mes:</span>
              <select
                id="header-select-mes-ruta"
                value={config.mesRutaActual}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                title="Seleccionar mes de trabajo"
              >
                {meses.map((m) => (
                  <option key={m.key} value={m.key} className="bg-[#003EA7] text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector / Indicador de Dependencia para Supervisor de la Unidad */}
            {sesionActual?.rol === 'SUPERVISOR' && onAbrirModalSupervisor && (
              <button
                type="button"
                id="header-btn-cambiar-dependencia"
                onClick={onAbrirModalSupervisor}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm border bg-white/20 hover:bg-white/30 border-white/30 text-white"
                title="Clic para cambiar dependencia a abrir (Notificación y Citación o Secretaría con Oficio)"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="hidden sm:inline text-blue-100">Dependencia:</span>
                <span className="font-black text-amber-200">
                  {dependenciaActiva === 'SECRETARIA' ? 'Secretaría (Oficio)' : dependenciaActiva === 'NOTIFICACION_CITACION' ? 'Notif. y Citación' : 'Ambas'}
                </span>
              </button>
            )}

            {/* Botón de Instalación PWA (si es instalable) */}
            <PWAInstallButton />

            {/* Estado de Red Sin Conexión (solo si está desconectado) */}
            {!isOnline && (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-amber-950/90 border-amber-500/70 text-amber-300 animate-pulse"
                title="Modo sin internet: 100% Operativo y guardado en disco"
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Sin Internet (Guardado Local)</span>
              </div>
            )}

            {/* Configuración de Despacho y Alguacilazgo */}
            <button
              id="header-btn-config"
              onClick={onOpenConfigModal}
              className="p-2 text-white hover:text-white bg-white/15 hover:bg-white/25 rounded-xl transition-colors cursor-pointer border border-white/25 shadow-sm"
              title="Configuración de Despacho y Alguacilazgo"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Menú de Usuario y Seguridad */}
            {sesionActual && onBloquearEstacion && onAbrirCambioPassword && onAbrirAuditoria && onCerrarSesion && (
              <UserMenu
                sesion={sesionActual}
                onBloquearEstacion={onBloquearEstacion}
                onAbrirCambioPassword={onAbrirCambioPassword}
                onAbrirAuditoria={onAbrirAuditoria}
                onCerrarSesion={onCerrarSesion}
              />
            )}
          </div>
        </div>

        {/* Pestañas de Navegación Principales */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-white/20">
          {/* Pestaña Principal: Lista de Boletas */}
          <button
            id="tab-btn-boletas"
            onClick={() => onTabChange('boletas')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTab === 'boletas'
                ? 'bg-white text-[#004BB4] shadow-md border border-white'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Lista Principal de Boletas</span>
          </button>

          {/* Listados por Alguacil: Solo si está habilitado en configuración */}
          {config.mostrarTabAlguaciles && (
            <button
              id="tab-btn-enrutamiento"
              onClick={() => onTabChange('enrutamiento')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                currentTab === 'enrutamiento'
                  ? 'bg-white text-[#004BB4] shadow-md border border-white'
                  : 'text-blue-100 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Listados por Alguacil</span>
            </button>
          )}

          <button
            id="tab-btn-acuses"
            onClick={() => onTabChange('acuses')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTab === 'acuses'
                ? 'bg-white text-[#004BB4] shadow-md border border-white'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>3. Acuses Locales El Vigía</span>
          </button>

          <button
            id="tab-btn-stats"
            onClick={() => onTabChange('stats')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              currentTab === 'stats'
                ? 'bg-white text-[#004BB4] shadow-md border border-white'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Estadísticas Locales</span>
          </button>
        </div>
      </div>
    </header>
  );
};
