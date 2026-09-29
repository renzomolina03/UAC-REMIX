import React, { useState } from 'react';
import { 
  QrCode, 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Smartphone, 
  CheckCircle2, 
  ShieldCheck,
  Eye,
  Download
} from 'lucide-react';

interface ProbarQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo: string;
  qrDataUrl: string;
  qrUrl: string;
  onAbrirValidacion: () => void;
}

export const ProbarQRModal: React.FC<ProbarQRModalProps> = ({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  qrDataUrl,
  qrUrl,
  onAbrirValidacion,
}) => {
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const handleCopiarUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
        
        {/* Cabecera */}
        <div className="bg-[#0b1e3b] text-white p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-400/30 text-amber-300">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verificador Óptico de Código QR</span>
              </div>
              <h3 className="text-base font-black text-white">{titulo}</h3>
              <p className="text-xs text-blue-200/90 mt-0.5">{subtitulo}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Central: Código QR Ampliado y de Alta Resolución */}
        <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4 bg-slate-50/50">
          
          <div className="p-3 bg-white rounded-2xl shadow-md border-2 border-slate-300 flex flex-col items-center">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Código QR de Verificación Oficial" 
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                <span>Generando código QR...</span>
              </div>
            )}
            <div className="mt-2 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>Escanee directamente con la cámara de su teléfono</span>
            </div>
          </div>

          {/* Instrucciones de Escaneo */}
          <div className="w-full bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-left space-y-2">
            <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>¿Cómo probar el funcionamiento del QR?</span>
            </h4>
            <ol className="text-[11px] text-blue-900/90 space-y-1 pl-4 list-decimal leading-relaxed">
              <li>Abra la app de <strong>Cámara</strong> de su teléfono móvil (Android o iPhone).</li>
              <li>Apunte hacia el código QR mostrado arriba en su pantalla a <strong>15 - 25 cm</strong> de distancia.</li>
              <li>Toque la <strong>notificación o banner amarillo</strong> que aparecerá instantáneamente para ver la validación oficial y descargar el PDF con las resultas.</li>
            </ol>
          </div>

          {/* Enlace de Validación */}
          <div className="w-full space-y-1.5 text-left">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Enlace Web de Validación Codificado en el QR:</span>
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-lg p-1.5 pr-2">
              <input 
                type="text" 
                readOnly 
                value={qrUrl} 
                className="text-[11px] font-mono text-slate-700 bg-transparent flex-1 outline-none px-1 select-all truncate"
              />
              <button
                type="button"
                onClick={handleCopiarUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                title="Copiar enlace al portapapeles"
              >
                {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiado ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Pie con Botones de Acción */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onAbrirValidacion}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Abrir Validación en Pantalla</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
