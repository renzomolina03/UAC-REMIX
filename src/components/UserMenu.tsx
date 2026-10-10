import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Lock, 
  KeyRound, 
  LogOut, 
  ShieldCheck, 
  ChevronDown, 
  FileSearch,
  Clock,
  Users
} from 'lucide-react';
import { SesionActiva } from '../types/auth';

interface UserMenuProps {
  sesion: SesionActiva;
  onBloquearEstacion: () => void;
  onAbrirCambioPassword: () => void;
  onAbrirAuditoria: () => void;
  onAbrirCredencialesUsuarios?: () => void;
  onCerrarSesion: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  sesion,
  onBloquearEstacion,
  onAbrirCambioPassword,
  onAbrirAuditoria,
  onAbrirCredencialesUsuarios,
  onCerrarSesion
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const iniciales = sesion.nombreCompleto
    ? sesion.nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('')
    : 'TSJ';

  const isSuper = sesion.rol === 'SUPER_ADMIN';
  const isSupervisor = sesion.rol === 'SUPERVISOR' || sesion.rol === 'SUPER_ADMIN';
  const isCoord = sesion.rol === 'COORDINADOR';
  const isAlguacil = sesion.rol === 'ALGUACIL';

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón de Perfil en la barra */}
      <button
        type="button"
        id="btn-user-profile"
        onClick={() => setMenuAbierto(!menuAbierto)}
        className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-all cursor-pointer text-left shadow-sm"
        title="Perfil de Funcionario Judicial y Opciones de Seguridad"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 border border-white/40 flex items-center justify-center text-white font-black text-xs shadow shrink-0">
          {iniciales}
        </div>

        <div className="hidden sm:block text-left leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black text-white truncate max-w-[130px]">
              {sesion.nombreCompleto.split(' ')[0]} {sesion.nombreCompleto.split(' ')[1] || ''}
            </span>
            <span
              className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                isSuper
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isCoord
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : isAlguacil
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              }`}
            >
              {sesion.rol}
            </span>
          </div>
          <span className="text-[10px] text-blue-100 font-mono">@{sesion.username}</span>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-blue-200 hidden sm:block" />
      </button>

      {/* Menú Desplegable */}
      {menuAbierto && (
        <div className="absolute right-0 mt-2 w-72 bg-gradient-to-b from-[#003EA7] to-[#002773] border border-blue-400/40 rounded-2xl shadow-2xl shadow-black/80 py-2 z-50 text-white">
          
          {/* Cabecera del usuario */}
          <div className="px-4 py-3 border-b border-blue-400/30 bg-white/10">
            <p className="text-xs font-black text-white">
              {sesion.nombreCompleto}
            </p>
            <p className="text-[11px] text-blue-200 font-medium">
              {sesion.cargo}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-blue-200 font-mono">
              <span>Rol: <strong className="text-white">{sesion.rol}</strong></span>
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Conexión Segura
              </span>
            </div>
          </div>

          {/* Opciones */}
          <div className="py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onBloquearEstacion();
              }}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-blue-100 hover:text-white hover:bg-white/15 transition-colors text-left cursor-pointer"
            >
              <Lock className="w-4 h-4 text-amber-300" />
              <span>Bloquear Estación de Trabajo</span>
            </button>

            {isSupervisor && onAbrirCredencialesUsuarios && (
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  onAbrirCredencialesUsuarios();
                }}
                className="w-full px-4 py-2 flex items-center gap-2.5 text-blue-100 hover:text-white hover:bg-white/15 transition-colors text-left cursor-pointer"
              >
                <Users className="w-4 h-4 text-amber-300" />
                <div className="flex flex-col">
                  <span className="font-bold flex items-center gap-1.5">
                    <span>Credenciales y Usuarios</span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/40 font-semibold">Supervisor</span>
                  </span>
                  <span className="text-[10px] text-blue-200">Crear, editar, eliminar y contraseñas</span>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onAbrirCambioPassword();
              }}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-blue-100 hover:text-white hover:bg-white/15 transition-colors text-left cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-blue-200" />
              <span>Cambiar Mi Contraseña</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onAbrirAuditoria();
              }}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-blue-100 hover:text-white hover:bg-white/15 transition-colors text-left cursor-pointer"
            >
              <FileSearch className="w-4 h-4 text-purple-300" />
              <span>Bitácora y Auditoría de Seguridad</span>
            </button>
          </div>

          {/* Cerrar Sesión */}
          <div className="pt-1 mt-1 border-t border-blue-400/30">
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onCerrarSesion();
              }}
              className="w-full px-4 py-2 flex items-center gap-2.5 text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 transition-colors text-left text-xs font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Cerrar Sesión Segura</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
