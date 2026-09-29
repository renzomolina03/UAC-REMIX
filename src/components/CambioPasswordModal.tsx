import React, { useState } from 'react';
import { 
  KeyRound, 
  Lock, 
  X, 
  Check, 
  AlertTriangle, 
  ShieldCheck, 
  Eye, 
  EyeOff 
} from 'lucide-react';
import { cambiarPasswordUsuario, evaluarFortalezaPassword } from '../utils/securityAuth';
import { SesionActiva } from '../types/auth';

interface CambioPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  sesion: SesionActiva;
  onShowToast: (msg: string) => void;
}

export const CambioPasswordModal: React.FC<CambioPasswordModalProps> = ({
  isOpen,
  onClose,
  sesion,
  onShowToast
}) => {
  const [actualPass, setActualPass] = useState('');
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const evaluacion = evaluarFortalezaPassword(nuevaPass);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!actualPass) {
      setErrorMsg('Debe ingresar su contraseña actual.');
      return;
    }

    if (nuevaPass !== confirmPass) {
      setErrorMsg('La confirmación de la nueva contraseña no coincide.');
      return;
    }

    if (evaluacion.score < 3) {
      setErrorMsg('La nueva contraseña no cumple con los requisitos de seguridad mínimos.');
      return;
    }

    setGuardando(true);
    try {
      const res = await cambiarPasswordUsuario(sesion.usuarioId, actualPass, nuevaPass);
      if (res.exito) {
        onShowToast('✓ Contraseña actualizada y cifrada criptográficamente con éxito.');
        onClose();
      } else {
        setErrorMsg(res.mensaje);
      }
    } catch {
      setErrorMsg('Error al actualizar contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gradient-to-b from-[#0053D5] to-[#002773] border border-blue-400/50 rounded-2xl p-6 shadow-2xl shadow-black/80 text-white space-y-4">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-white/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center text-white">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-white">
                Cambio Seguro de Contraseña
              </h3>
              <p className="text-xs text-blue-100">
                Funcionario: <strong>{sesion.nombreCompleto}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Contraseña Actual */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Contraseña Actual
            </label>
            <input
              type={mostrarPass ? 'text' : 'password'}
              required
              value={actualPass}
              onChange={(e) => setActualPass(e.target.value)}
              placeholder="Ingrese su contraseña actual..."
              className="w-full px-3 py-2 bg-black/30 border border-blue-800/60 rounded-xl text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>

          {/* Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={mostrarPass ? 'text' : 'password'}
                required
                value={nuevaPass}
                onChange={(e) => setNuevaPass(e.target.value)}
                placeholder="Mínimo 8 caracteres, números y símbolos..."
                className="w-full px-3 py-2 pr-10 bg-black/30 border border-blue-800/60 rounded-xl text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMostrarPass(!mostrarPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {mostrarPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Medidor de Fortaleza */}
          {nuevaPass && (
            <div className="space-y-1.5 p-3 rounded-xl bg-black/30 border border-blue-900/40 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">Fortaleza:</span>
                <span className={evaluacion.color}>{evaluacion.texto}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    evaluacion.score <= 2
                      ? 'bg-rose-500'
                      : evaluacion.score === 3
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${evaluacion.porcentaje}%` }}
                />
              </div>

              {/* Lista de Requisitos */}
              <div className="grid grid-cols-2 gap-1 pt-1.5 text-[11px]">
                <div className={`flex items-center gap-1 ${evaluacion.requisitos.longitudMinima ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> 8+ caracteres
                </div>
                <div className={`flex items-center gap-1 ${evaluacion.requisitos.tieneMayuscula ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Mayúscula (A-Z)
                </div>
                <div className={`flex items-center gap-1 ${evaluacion.requisitos.tieneMinuscula ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Minúscula (a-z)
                </div>
                <div className={`flex items-center gap-1 ${evaluacion.requisitos.tieneNumero ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Número (0-9)
                </div>
                <div className={`flex items-center gap-1 ${evaluacion.requisitos.tieneEspecial ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <Check className="w-3 h-3" /> Símbolo (@,!,#)
                </div>
              </div>
            </div>
          )}

          {/* Confirmar Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <input
              type={mostrarPass ? 'text' : 'password'}
              required
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Reescriba la nueva contraseña..."
              className="w-full px-3 py-2 bg-black/30 border border-blue-800/60 rounded-xl text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-blue-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {guardando ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Guardar y Cifrar Contraseña</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
