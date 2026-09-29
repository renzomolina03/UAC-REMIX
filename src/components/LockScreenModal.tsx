import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  LogOut, 
  ShieldCheck, 
  AlertTriangle,
  Clock,
  UserCheck
} from 'lucide-react';
import { SesionActiva } from '../types/auth';
import { desbloquearEstacion, cerrarSesionSegura } from '../utils/securityAuth';

interface LockScreenModalProps {
  sesion: SesionActiva;
  onDesbloqueada: () => void;
  onCerrarSesion: () => void;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  sesion,
  onDesbloqueada,
  onCerrarSesion
}) => {
  const [codigoInput, setCodigoInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [horaActual, setHoraActual] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!codigoInput.trim()) {
      setErrorMsg('Ingrese su PIN rápido de 6 dígitos o su contraseña.');
      return;
    }

    setVerificando(true);
    setErrorMsg(null);

    try {
      const ok = await desbloquearEstacion(codigoInput);
      if (ok) {
        onDesbloqueada();
      } else {
        setErrorMsg('PIN o contraseña incorrectos.');
      }
    } catch {
      setErrorMsg('Error al validar credencial.');
    } finally {
      setVerificando(false);
    }
  };

  const iniciales = sesion.nombreCompleto
    ? sesion.nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('')
    : 'TSJ';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050D1A]/95 backdrop-blur-xl text-white select-none">
      
      {/* Elementos decorativos */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="w-full max-w-md bg-gradient-to-b from-[#0053D5] to-[#002773] border-2 border-blue-400/50 rounded-3xl p-7 shadow-2xl shadow-black/80 text-center relative overflow-hidden">
        
        {/* Marca de agua de seguridad */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Hora y estado en vivo */}
        <div className="flex items-center justify-between text-xs text-blue-200 mb-6 pb-3 border-b border-white/20">
          <div className="flex items-center gap-1.5 font-mono text-emerald-300 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {horaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-200 bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 rounded-full font-bold">
            <Lock className="w-3 h-3" />
            Estación Bloqueada
          </span>
        </div>

        {/* Avatar del usuario con iniciales */}
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 rounded-2xl bg-white/15 border-2 border-white/40 shadow-xl flex items-center justify-center text-white font-black text-2xl tracking-wider">
            {iniciales}
          </div>
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-amber-500 border-2 border-[#003EA7] flex items-center justify-center text-slate-950 shadow">
            <Lock className="w-4 h-4 font-black" />
          </div>
        </div>

        {/* Datos del Funcionario */}
        <h3 className="text-lg font-black text-white">
          {sesion.nombreCompleto}
        </h3>
        <p className="text-xs text-blue-300 font-medium mt-0.5">
          {sesion.cargo}
        </p>
        <div className="mt-2 inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-200 border border-blue-400/30">
          {sesion.rol} • Usuario: {sesion.username}
        </div>

        <p className="text-xs text-slate-300 mt-5 leading-relaxed">
          Su sesión se encuentra protegida. Ingrese su <strong>PIN rápido (123456)</strong> o contraseña para reanudar el trabajo sin perder ningún dato:
        </p>

        {/* Formulario de Desbloqueo */}
        <form onSubmit={handleUnlock} className="mt-5 space-y-3.5">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type="password"
              autoFocus
              value={codigoInput}
              onChange={(e) => {
                setCodigoInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ingrese PIN rápido o contraseña..."
              className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-blue-700/60 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-center text-white placeholder-slate-500 text-sm font-semibold tracking-wider transition-all"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-center gap-2 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verificando}
            className="w-full py-2.5 px-4 rounded-xl font-black text-sm tracking-wide bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {verificando ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>DESBLOQUEAR ESTACIÓN</span>
              </>
            )}
          </button>
        </form>

        {/* Acciones Secundarias */}
        <div className="mt-6 pt-4 border-t border-blue-900/50 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={() => {
              setCodigoInput('123456');
              setTimeout(() => handleUnlock(), 100);
            }}
            className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
            title="Autoingresar PIN demo 123456"
          >
            Usar PIN Demo (123456)
          </button>

          <button
            type="button"
            onClick={() => {
              cerrarSesionSegura();
              onCerrarSesion();
            }}
            className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

      </div>
    </div>
  );
};
