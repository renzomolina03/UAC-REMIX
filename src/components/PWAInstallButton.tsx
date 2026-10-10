import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Si ya está instalada o abierta en modo aplicación nativa de escritorio
  if (isInstalled) {
    return (
      <div 
        className="flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-950/70 px-2.5 py-1 text-xs font-bold text-emerald-300 shadow-sm"
        title="Aplicación instalada y lista para uso directo en este equipo."
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="hidden sm:inline">App Instalada</span>
      </div>
    );
  }

  // Flujo directo para Chrome / Edge / Android cuando el navegador emite el evento de instalación
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer border border-blue-400/40 hover:scale-[1.02] active:scale-[0.98]"
        title="Instalar esta aplicación en tu computadora para abrirla directamente desde el escritorio"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App en la PC</span>
      </button>
    );
  }

  // Flujo para iOS Safari
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span>Instalar en iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  Instalar en Dispositivo iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-300 space-y-2">
                <p>Para usar la aplicación sin conexión desde tu pantalla de inicio:</p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-200">
                  <li>
                    Pulsa el botón de <strong>Compartir</strong> (ícono con flecha hacia arriba en Safari).
                  </li>
                  <li>
                    Desplázate hacia abajo y selecciona <strong>Agregar al inicio</strong>.
                  </li>
                  <li>Pulsa <strong>Agregar</strong> en la esquina superior derecha.</li>
                </ol>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2 text-xs font-bold text-white transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Si no está en estado instalable, no mostrar botón
  return null;
};
