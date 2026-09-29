import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  KeyRound, 
  AlertTriangle, 
  ShieldAlert, 
  Building2, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Unlock, 
  AlertOctagon, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { 
  autenticarUsuario, 
  desbloquearCuentaConClaveMaestra, 
  CUENTAS_DEMO, 
  CLAVE_MAESTRA_EMERGENCIA,
  ResultadoLogin 
} from '../utils/securityAuth';
import { SesionActiva } from '../types/auth';

interface LoginViewProps {
  onLoginExitoso: (sesion: SesionActiva) => void;
  circuitoJudicial?: string;
  unidad?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginExitoso,
  circuitoJudicial = 'CIRCUITO JUDICIAL PENAL EXTENSIÓN EL VIGÍA ESTADO MÉRIDA',
  unidad = 'UNIDAD DE ACTOS Y COMUNICACIÓN - ALGUACILAZGO',
}) => {
  const [tabActiva, setTabActiva] = useState<'formulario' | 'cuentas'>('formulario');
  
  // Formulario
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [intentosRestantes, setIntentosRestantes] = useState<number | null>(null);
  const [capsLockActivo, setCapsLockActivo] = useState(false);

  // Estado de bloqueo
  const [cuentaBloqueada, setCuentaBloqueada] = useState(false);
  const [minutosRestantesBloqueo, setMinutosRestantesBloqueo] = useState<number>(0);
  const [modalClaveMaestraOpen, setModalClaveMaestraOpen] = useState(false);
  const [claveMaestraInput, setClaveMaestraInput] = useState('');
  const [mensajeClaveMaestra, setMensajeClaveMaestra] = useState<{ texto: string; tipo: 'error' | 'exito' } | null>(null);

  // Autorización de Supervisor para ver Credenciales
  const [supervisorAutorizado, setSupervisorAutorizado] = useState(false);
  const [supervisorKeyInput, setSupervisorKeyInput] = useState('');
  const [errorSupervisorKey, setErrorSupervisorKey] = useState<string | null>(null);

  // Reloj institucional en vivo
  const [horaActual, setHoraActual] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detectar Bloq Mayús (Caps Lock)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCaps = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLockActivo(isCaps);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isCaps = e.getModifierState && e.getModifierState('CapsLock');
    setCapsLockActivo(isCaps);
  };

  // Enviar Login
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setMensajeError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setCargando(true);
    setMensajeError(null);

    try {
      const res: ResultadoLogin = await autenticarUsuario(username, password, recordarme);
      if (res.exito && res.sesion) {
        onLoginExitoso(res.sesion);
      } else {
        setMensajeError(res.mensaje);
        if (res.cuentaBloqueada) {
          setCuentaBloqueada(true);
          setMinutosRestantesBloqueo(res.minutosRestantes || 15);
        } else if (res.intentosRestantes !== undefined) {
          setIntentosRestantes(res.intentosRestantes);
        }
      }
    } catch (err) {
      setMensajeError('Error en el protocolo de verificación criptográfica.');
    } finally {
      setCargando(false);
    }
  };

  // Carga rápida con cuenta de demostración
  const handleSeleccionarCuentaDemo = async (demo: typeof CUENTAS_DEMO[0], autoLogin = false) => {
    setUsername(demo.username);
    setPassword(demo.clavePlana);
    setMensajeError(null);
    setCuentaBloqueada(false);
    setIntentosRestantes(null);

    if (autoLogin) {
      setCargando(true);
      try {
        const res = await autenticarUsuario(demo.username, demo.clavePlana, recordarme);
        if (res.exito && res.sesion) {
          onLoginExitoso(res.sesion);
        }
      } finally {
        setCargando(false);
      }
    } else {
      setTabActiva('formulario');
    }
  };

  // Desbloqueo de Emergencia con Clave Maestra
  const handleDesbloquearConMaestra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claveMaestraInput.trim()) {
      setMensajeClaveMaestra({ texto: 'Ingrese la Clave Maestra Judicial.', tipo: 'error' });
      return;
    }
    const res = await desbloquearCuentaConClaveMaestra(username || 'admin', claveMaestraInput);
    if (res.exito) {
      setMensajeClaveMaestra({ texto: res.mensaje, tipo: 'exito' });
      setCuentaBloqueada(false);
      setIntentosRestantes(null);
      setMensajeError(null);
      setTimeout(() => {
        setModalClaveMaestraOpen(false);
        setClaveMaestraInput('');
        setMensajeClaveMaestra(null);
      }, 1500);
    } else {
      setMensajeClaveMaestra({ texto: res.mensaje, tipo: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-sans relative selection:bg-blue-600 selection:text-white">
      
      {/* Barra Superior Discreta */}
      <header className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-500 py-2 px-1">
        <div className="flex items-center gap-2">
          <span className="font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-[11px]">TSJ</span>
          <span className="font-semibold text-slate-600 hidden sm:inline">{circuitoJudicial}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            {horaActual.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </header>

      {/* Contenedor Principal: Diseño Banner idéntico a la imagen de referencia */}
      <main className="w-full max-w-5xl my-auto py-4">
        <div className="w-full bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] rounded-[28px] sm:rounded-[36px] shadow-2xl shadow-blue-600/25 p-6 sm:p-10 lg:p-12 relative overflow-hidden min-h-[460px] flex items-center">
          
          {/* Ondas / Círculos decorativos abstractos idénticos a la imagen */}
          {/* Círculo inferior izquierdo */}
          <div className="absolute -bottom-24 -left-16 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#0046B8]/50 pointer-events-none" />
          <div className="absolute -bottom-10 -left-6 w-64 h-64 rounded-full bg-[#005BEA]/40 pointer-events-none" />
          {/* Círculo superior izquierdo */}
          <div className="absolute -top-20 -left-12 w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-[#007AFE]/25 pointer-events-none" />
          {/* Círculo superior derecho */}
          <div className="absolute -top-16 -right-16 w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-[#003796]/40 pointer-events-none" />

          {/* Grid de 2 Columnas: Izquierda (Bienvenida) y Derecha (Tarjeta Blanca Sign in) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full relative z-10">
            
            {/* Columna Izquierda: WELCOME + Descripción */}
            <div className="lg:col-span-6 text-white space-y-3.5 pr-0 lg:pr-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-widest uppercase drop-shadow-xs">
                WELCOME
              </h1>
              
              <h2 className="text-xs sm:text-sm font-bold text-blue-100 tracking-wider uppercase">
                CONTROL DE BOLETAS JUDICIALES
              </h2>

              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-sm font-normal">
                Plataforma oficial de control, emisión y seguimiento de boletas y citaciones bajo estricto cumplimiento del Código Orgánico Procesal Penal (COPP).
              </p>

              {/* Insignias institucionales */}
              <div className="pt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium flex items-center gap-1.5 shadow-xs">
                  <Building2 className="w-3.5 h-3.5 text-blue-200" />
                  <span>El Vigía, Edo. Mérida</span>
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-blue-100 font-medium flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                  <span>Acceso Autorizado TSJ</span>
                </span>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta Blanca Flotante idéntica a la imagen */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end w-full">
              <div className="bg-white rounded-3xl p-6 sm:p-9 shadow-2xl w-full max-w-md text-slate-800 relative z-10 border border-white/80">
                
                {tabActiva === 'formulario' ? (
                  <>
                    {/* Encabezado del Formulario */}
                    <div className="mb-5">
                      <h3 className="text-2xl sm:text-3xl font-black text-[#0B1E3B] tracking-tight">
                        Sign in
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        Ingrese sus credenciales de despacho judicial
                      </p>
                    </div>

                    {/* Alerta de cuenta bloqueada */}
                    {cuentaBloqueada && (
                      <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-2 animate-shake">
                        <div className="flex items-center gap-2 font-bold text-rose-900">
                          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Bloqueo Preventivo: {minutosRestantesBloqueo} min</span>
                        </div>
                        <p className="text-[11px] text-rose-700 leading-tight">
                          Demasiados intentos fallidos. Puede usar la Clave Maestra Judicial para reanudar.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setModalClaveMaestraOpen(true);
                            setClaveMaestraInput('');
                            setMensajeClaveMaestra(null);
                          }}
                          className="text-[11px] font-black text-rose-700 hover:text-rose-900 underline cursor-pointer"
                        >
                          Desbloquear con Clave Maestra Judicial
                        </button>
                      </div>
                    )}

                    {/* Alerta de error estándar */}
                    {mensajeError && !cuentaBloqueada && (
                      <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{mensajeError}</span>
                      </div>
                    )}

                    {/* Formulario Sign in */}
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      {/* Campo User Name */}
                      <div>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (mensajeError) setMensajeError(null);
                          }}
                          placeholder="User Name"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Campo Password con botón SHOW / HIDE */}
                      <div>
                        <div className="relative">
                          <input
                            type={mostrarPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (mensajeError) setMensajeError(null);
                            }}
                            onKeyDown={handleKeyDown}
                            onKeyUp={handleKeyUp}
                            placeholder="Password"
                            className="w-full px-4 py-3 pr-16 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarPassword(!mostrarPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-black tracking-wider text-slate-500 hover:text-blue-600 cursor-pointer uppercase select-none transition-colors"
                            tabIndex={-1}
                          >
                            {mostrarPassword ? 'HIDE' : 'SHOW'}
                          </button>
                        </div>
                        {capsLockActivo && (
                          <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" /> Bloq Mayús Activado
                          </span>
                        )}
                      </div>

                      {/* Fila Remember me y Forgot Password? */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-800">
                          <input
                            type="checkbox"
                            checked={recordarme}
                            onChange={(e) => setRecordarme(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Remember me</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setModalClaveMaestraOpen(true);
                            setClaveMaestraInput('');
                            setMensajeClaveMaestra(null);
                          }}
                          className="text-slate-500 hover:text-blue-600 font-medium transition-colors cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>

                      {/* Botón Principal "Sing in" exactamente como en la imagen */}
                      <button
                        type="submit"
                        disabled={cargando || cuentaBloqueada}
                        className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white font-black text-sm rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                      >
                        {cargando ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>Sing in</span>
                        )}
                      </button>
                    </form>

                    {/* Enlace inferior "Don't have an account? Sign Up" */}
                    <div className="pt-4 text-center text-xs text-slate-500">
                      <span>Don't have an account? </span>
                      <button
                        type="button"
                        onClick={() => setTabActiva('cuentas')}
                        className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                      >
                        Sign Up
                      </button>
                    </div>

                    {/* Acceso Rápido Demo con 1 clic (Supervisor, Secretario, Notificador) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-medium text-[10px]">Demo:</span>
                      <button
                        type="button"
                        onClick={() => handleSeleccionarCuentaDemo(CUENTAS_DEMO[0], true)}
                        className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer transition-colors shadow-2xs"
                        title="Ingresar como Supervisor"
                      >
                        Supervisor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionarCuentaDemo(CUENTAS_DEMO[1], true)}
                        className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold cursor-pointer transition-colors shadow-2xs"
                        title="Ingresar como Secretario(a)"
                      >
                        Secretario
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSeleccionarCuentaDemo(CUENTAS_DEMO[2], true)}
                        className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold cursor-pointer transition-colors shadow-2xs"
                        title="Ingresar como Notificador"
                      >
                        Notificador
                      </button>
                    </div>
                  </>
                ) : (
                  /* Vista de Cuentas y Credenciales de Despacho */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="text-base font-black text-[#0B1E3B] flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <span>Cuentas Judiciales</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTabActiva('formulario')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Volver</span>
                      </button>
                    </div>

                    {!supervisorAutorizado ? (
                      <div className="space-y-3 text-center py-2">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Por seguridad judicial, la visualización de credenciales requiere el PIN del <strong>Supervisor</strong>:
                        </p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const key = supervisorKeyInput.trim();
                            if (key === '9900' || key === 'supervisor2026' || key === CLAVE_MAESTRA_EMERGENCIA || key.toLowerCase() === 'supervisor') {
                              setSupervisorAutorizado(true);
                              setErrorSupervisorKey(null);
                            } else {
                              setErrorSupervisorKey('PIN no válido (pruebe 9900).');
                            }
                          }}
                          className="space-y-2"
                        >
                          <input
                            type="password"
                            placeholder="PIN del Supervisor (ej: 9900)"
                            value={supervisorKeyInput}
                            onChange={(e) => setSupervisorKeyInput(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            autoFocus
                          />
                          {errorSupervisorKey && (
                            <p className="text-[11px] font-bold text-rose-600">{errorSupervisorKey}</p>
                          )}
                          <button
                            type="submit"
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Verificar Identidad
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {CUENTAS_DEMO.slice(0, 3).map((demo) => (
                          <div
                            key={demo.username}
                            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                          >
                            <div className="text-left leading-tight">
                              <span className="font-bold text-xs text-slate-900 block">{demo.nombreCompleto}</span>
                              <span className="text-[10px] text-slate-500 font-mono">@{demo.username} • Clave: {demo.clavePlana}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSeleccionarCuentaDemo(demo, true)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                            >
                              Entrar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal para Desbloqueo de Emergencia con Clave Maestra */}
      {modalClaveMaestraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0B1E3B]">
                  Desbloqueo de Emergencia Judicial
                </h3>
                <p className="text-xs text-slate-500">
                  Desbloqueo de cuenta: <strong className="text-slate-800">{username || 'admin'}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ingrese la Clave Maestra emitida por la Presidencia del Circuito Judicial o Coordinación del Alguacilazgo:
            </p>

            <form onSubmit={handleDesbloquearConMaestra} className="space-y-3">
              <input
                type="text"
                autoFocus
                value={claveMaestraInput}
                onChange={(e) => setClaveMaestraInput(e.target.value)}
                placeholder="Ej. TSJ-VIGIA-MASTER-2026"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs focus:border-blue-600 focus:outline-none"
              />

              {mensajeClaveMaestra && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-semibold ${
                    mensajeClaveMaestra.tipo === 'exito'
                      ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border border-rose-300 text-rose-800'
                  }`}
                >
                  {mensajeClaveMaestra.texto}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalClaveMaestraOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Aplicar Desbloqueo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pie de Página Oficial */}
      <footer className="w-full max-w-5xl py-3 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200">
        <span>© 2026 Poder Judicial de Venezuela • Circuito Judicial Penal Extensión El Vigía</span>
        <div className="flex items-center gap-3 text-slate-500 font-medium">
          <span>Unidad de Actos y Comunicación (UAC)</span>
          <span>•</span>
          <span className="text-blue-700 font-bold">Alguacilazgo Judicial</span>
        </div>
      </footer>
    </div>
  );
};
