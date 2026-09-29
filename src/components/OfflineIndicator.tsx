import React from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:right-auto md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="bg-amber-900/95 text-amber-50 border-2 border-amber-500/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3">
        <div className="p-2 bg-amber-800/80 rounded-lg text-amber-300 shrink-0 mt-0.5">
          <WifiOff className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-200 text-sm">
            <span>Modo Sin Conexión Activo</span>
            <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40">
              100% Operativo
            </span>
          </div>
          <p className="mt-1 text-amber-100/90 leading-relaxed">
            Se ha interrumpido la conexión a internet. El sistema sigue funcionando con total normalidad: puedes registrar boletas, generar PDF, imprimir y editar.
          </p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tus datos se están guardando de forma segura en este equipo.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
