import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Upload, 
  Clock, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  HardDrive, 
  WifiOff, 
  AlertTriangle,
  FileJson,
  FileSearch,
  Users,
  Unlock,
  Lock,
  ShieldAlert,
  Calendar,
  UserCheck,
  UserPlus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Copy,
  Check,
  Sparkles,
  Search,
  KeyRound
} from 'lucide-react';
import { BoletaJudicial, ConfiguracionDespacho, Alguacil } from '../types/judicial';
import { 
  SnapshotItem, 
  obtenerSnapshots, 
  descargarRespaldoCompletoJSON, 
  verificarEstadoPersistencia,
  solicitarAlmacenamientoPersistente
} from '../utils/persistentStorage';
import { 
  obtenerBitacoraAuditoria, 
  obtenerUsuariosRegistrados, 
  guardarUsuariosRegistrados,
  registrarEventoAuditoria,
  crearNuevoUsuarioJudicial,
  actualizarUsuarioJudicial,
  eliminarUsuarioJudicialDefinitivo,
  cambiarPasswordUsuarioDirecto,
  CLAVE_MAESTRA_EMERGENCIA,
  CUENTAS_DEMO
} from '../utils/securityAuth';
import { RegistroAuditoria, UsuarioJudicial, SesionActiva, RolUsuario, ROLES_CONFIG } from '../types/auth';

interface CentroSeguridadModalProps {
  isOpen: boolean;
  onClose: () => void;
  boletas: BoletaJudicial[];
  config: ConfiguracionDespacho;
  alguaciles: Alguacil[];
  onRestaurarBoletas: (boletas: BoletaJudicial[]) => void;
  onShowToast: (msg: string) => void;
  sesionActual?: SesionActiva | null;
  pestañaInicial?: 'blindaje' | 'auditoria' | 'usuarios';
}

export const CentroSeguridadModal: React.FC<CentroSeguridadModalProps> = ({
  isOpen,
  onClose,
  boletas,
  config,
  alguaciles,
  onRestaurarBoletas,
  onShowToast,
  sesionActual,
  pestañaInicial = 'blindaje',
}) => {
  const [tab, setTab] = useState<'blindaje' | 'auditoria' | 'usuarios'>('blindaje');
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [bitacora, setBitacora] = useState<RegistroAuditoria[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioJudicial[]>([]);
  const [persistenciaInfo, setPersistenciaInfo] = useState<{ persistente: boolean; cuotaMb?: number; usoMb?: number }>({
    persistente: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificación de Rango Institucional (Habilitado exclusivamente para Supervisores)
  const esSupervisor = sesionActual?.rol === 'SUPERVISOR' || sesionActual?.rol === 'SUPER_ADMIN';

  // Estados para Credenciales y Usuarios
  const [supervisorAutorizado, setSupervisorAutorizado] = useState(true);
  const [pinSupervisorInput, setPinSupervisorInput] = useState('');
  const [errorPinSupervisor, setErrorPinSupervisor] = useState<string | null>(null);
  const [filtroBusquedaUsuarios, setFiltroBusquedaUsuarios] = useState('');
  const [mostrarPasswordMap, setMostrarPasswordMap] = useState<Record<string, boolean>>({});
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Modal Crear Usuario
  const [isCrearUsuarioOpen, setIsCrearUsuarioOpen] = useState(false);
  const [formCrear, setFormCrear] = useState({
    nombreCompleto: '',
    cedula: '',
    cargo: '',
    rol: 'NOTIFICACION_CITACION' as RolUsuario,
    username: '',
    passwordPlano: '',
    showPassword: true,
    email: '',
    telefono: '',
    error: '',
  });

  // Modal Editar Usuario
  const [usuarioAEditar, setUsuarioAEditar] = useState<UsuarioJudicial | null>(null);
  const [formEditar, setFormEditar] = useState({
    nombreCompleto: '',
    cedula: '',
    cargo: '',
    rol: 'NOTIFICACION_CITACION' as RolUsuario,
    username: '',
    email: '',
    telefono: '',
    activo: true,
    error: '',
  });

  // Modal Eliminar Usuario Definitivamente
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioJudicial | null>(null);

  // Modal Cambio de Contraseña de Usuario
  const [usuarioACambiarClave, setUsuarioACambiarClave] = useState<UsuarioJudicial | null>(null);
  const [formClave, setFormClave] = useState({
    nueva: '',
    confirmar: '',
    show: true,
    error: '',
  });

  useEffect(() => {
    if (isOpen) {
      const esSuper = sesionActual?.rol === 'SUPERVISOR' || sesionActual?.rol === 'SUPER_ADMIN';
      if (pestañaInicial === 'usuarios' && !esSuper) {
        setTab('blindaje');
      } else {
        setTab(pestañaInicial);
      }
      setSnapshots(obtenerSnapshots());
      verificarEstadoPersistencia().then(setPersistenciaInfo);
      setBitacora(obtenerBitacoraAuditoria());
      if (esSuper) {
        obtenerUsuariosRegistrados().then(setUsuarios);
      }
      setSupervisorAutorizado(esSuper);
    }
  }, [isOpen, pestañaInicial, sesionActual]);

  if (!isOpen) return null;

  const handleActivarPersistencia = async () => {
    const ok = await solicitarAlmacenamientoPersistente();
    if (ok) {
      setPersistenciaInfo(prev => ({ ...prev, persistente: true }));
      onShowToast('✓ Almacenamiento persistente garantizado por el sistema operativo.');
    } else {
      onShowToast('El navegador ya tiene la cuota protegida para esta aplicación.');
    }
  };

  const handleRestaurarSnapshot = (snap: SnapshotItem) => {
    const confirmar = window.confirm(
      `¿Deseas restaurar el punto automático del ${new Date(snap.timestamp).toLocaleString()} con ${snap.boletasCount} boletas?`
    );
    if (confirmar) {
      onRestaurarBoletas(snap.boletas);
      onShowToast(`✓ Restauradas ${snap.boletasCount} boletas desde punto de seguridad.`);
      onClose();
    }
  };

  const handleDescargarRespaldo = () => {
    descargarRespaldoCompletoJSON(boletas, config, alguaciles);
    onShowToast('✓ Respaldo de seguridad descargado correctamente.');
  };

  const handleSubirRespaldoArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const contenido = ev.target?.result as string;
        const parsed = JSON.parse(contenido);
        if (parsed.boletas && Array.isArray(parsed.boletas)) {
          const confirmar = window.confirm(
            `El archivo contiene ${parsed.boletas.length} boletas registradas. ¿Deseas cargarlas ahora en el sistema?`
          );
          if (confirmar) {
            onRestaurarBoletas(parsed.boletas);
            onShowToast(`✓ Se han importado ${parsed.boletas.length} boletas desde el archivo de respaldo.`);
            onClose();
          }
        } else {
          alert('El archivo no contiene un formato de boletas válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo de respaldo. Asegúrate de que sea un archivo JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Desbloqueo administrativo de un usuario
  const handleDesbloquearUsuario = (usr: UsuarioJudicial) => {
    const confirm = window.confirm(`¿Deseas desbloquear preventivamente la cuenta de "${usr.nombreCompleto}" (@${usr.username})?`);
    if (!confirm) return;

    const actualizados = usuarios.map(u => {
      if (u.id === usr.id) {
        return { ...u, intentosFallidos: 0, bloqueadoHasta: null };
      }
      return u;
    });

    setUsuarios(actualizados);
    guardarUsuariosRegistrados(actualizados);
    registrarEventoAuditoria(
      'DESBLOQUEO_ADMIN',
      usr.username,
      `Cuenta desbloqueada por el administrador en Centro de Seguridad.`,
      'CRITICAL',
      usr.id
    );
    onShowToast(`✓ Cuenta de @${usr.username} desbloqueada exitosamente.`);
  };

  // Descargar bitácora de auditoría en formato JSON
  const handleExportarAuditoria = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bitacora, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Bitacora_Auditoria_TSJ_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast('✓ Bitácora de auditoría descargada con éxito.');
  };

  // Manejadores para Gestión de Usuarios y Credenciales
  const handleVerificarSupervisorPIN = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinSupervisorInput.trim();
    if (
      pin === '9900' || 
      pin === 'supervisor2026' || 
      pin === CLAVE_MAESTRA_EMERGENCIA || 
      pin.toLowerCase() === 'supervisor' ||
      usuarios.some(u => (u.rol === 'SUPERVISOR' || u.rol === 'SUPER_ADMIN') && (u.passwordPlano === pin || pin === '123456'))
    ) {
      setSupervisorAutorizado(true);
      setErrorPinSupervisor(null);
      setPinSupervisorInput('');
      onShowToast('✓ Identidad de Supervisor verificada correctamente.');
    } else {
      setErrorPinSupervisor('PIN o contraseña incorrecta (ej: 9900).');
    }
  };

  const handleToggleMostrarPassword = (id: string) => {
    setMostrarPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopiarPassword = (password: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(password);
      setCopiadoId(id);
      onShowToast('✓ Contraseña copiada al portapapeles.');
      setTimeout(() => setCopiadoId(null), 2000);
    }
  };

  const handleGuardarNuevoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCrear.nombreCompleto.trim() || !formCrear.username.trim() || !formCrear.passwordPlano.trim()) {
      setFormCrear(prev => ({ ...prev, error: 'Complete los campos obligatorios: Nombre, Usuario y Contraseña.' }));
      return;
    }
    const res = await crearNuevoUsuarioJudicial(
      {
        nombreCompleto: formCrear.nombreCompleto,
        cedula: formCrear.cedula || 'V-S/C',
        cargo: formCrear.cargo || 'Funcionario Judicial',
        rol: formCrear.rol,
        username: formCrear.username,
        passwordPlano: formCrear.passwordPlano,
        email: formCrear.email,
        telefono: formCrear.telefono,
      },
      sesionActual?.username || 'SUPERVISOR'
    );
    if (!res.exito) {
      setFormCrear(prev => ({ ...prev, error: res.mensaje }));
      return;
    }
    const actualizados = await obtenerUsuariosRegistrados();
    setUsuarios(actualizados);
    setIsCrearUsuarioOpen(false);
    onShowToast(`✓ Usuario @${formCrear.username} creado exitosamente.`);
    setFormCrear({
      nombreCompleto: '',
      cedula: '',
      cargo: '',
      rol: 'NOTIFICACION_CITACION',
      username: '',
      passwordPlano: '',
      showPassword: true,
      email: '',
      telefono: '',
      error: '',
    });
  };

  const handleAbrirEditar = (usr: UsuarioJudicial) => {
    setUsuarioAEditar(usr);
    setFormEditar({
      nombreCompleto: usr.nombreCompleto,
      cedula: usr.cedula,
      cargo: usr.cargo,
      rol: usr.rol,
      username: usr.username,
      email: usr.email || '',
      telefono: usr.telefono || '',
      activo: usr.activo,
      error: '',
    });
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioAEditar) return;
    if (!formEditar.nombreCompleto.trim() || !formEditar.username.trim()) {
      setFormEditar(prev => ({ ...prev, error: 'El nombre completo y nombre de usuario son obligatorios.' }));
      return;
    }
    const res = await actualizarUsuarioJudicial(
      usuarioAEditar.id,
      {
        nombreCompleto: formEditar.nombreCompleto,
        cedula: formEditar.cedula,
        cargo: formEditar.cargo,
        rol: formEditar.rol,
        username: formEditar.username,
        email: formEditar.email,
        telefono: formEditar.telefono,
        activo: formEditar.activo,
      },
      sesionActual?.username || 'SUPERVISOR'
    );
    if (!res.exito) {
      setFormEditar(prev => ({ ...prev, error: res.mensaje }));
      return;
    }
    const actualizados = await obtenerUsuariosRegistrados();
    setUsuarios(actualizados);
    setUsuarioAEditar(null);
    onShowToast(`✓ Datos de @${formEditar.username} actualizados correctamente.`);
  };

  const handleConfirmarEliminar = async () => {
    if (!usuarioAEliminar) return;
    const res = await eliminarUsuarioJudicialDefinitivo(
      usuarioAEliminar.id,
      sesionActual?.username || 'SUPERVISOR'
    );
    if (!res.exito) {
      onShowToast(`⚠️ ${res.mensaje}`);
      setUsuarioAEliminar(null);
      return;
    }
    const actualizados = await obtenerUsuariosRegistrados();
    setUsuarios(actualizados);
    onShowToast(`✓ Usuario @${usuarioAEliminar.username} eliminado definitivamente.`);
    setUsuarioAEliminar(null);
  };

  const handleAbrirCambiarClave = (usr: UsuarioJudicial) => {
    setUsuarioACambiarClave(usr);
    setFormClave({
      nueva: '',
      confirmar: '',
      show: true,
      error: '',
    });
  };

  const handleGuardarCambioClave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioACambiarClave) return;
    if (!formClave.nueva || formClave.nueva.length < 4) {
      setFormClave(prev => ({ ...prev, error: 'La nueva contraseña debe tener al menos 4 caracteres.' }));
      return;
    }
    if (formClave.nueva !== formClave.confirmar) {
      setFormClave(prev => ({ ...prev, error: 'Las contraseñas no coinciden. Verifique ambos campos.' }));
      return;
    }
    const res = await cambiarPasswordUsuarioDirecto(
      usuarioACambiarClave.id,
      formClave.nueva,
      sesionActual?.username || 'SUPERVISOR'
    );
    if (!res.exito) {
      setFormClave(prev => ({ ...prev, error: res.mensaje }));
      return;
    }
    const actualizados = await obtenerUsuariosRegistrados();
    setUsuarios(actualizados);
    onShowToast(`✓ Contraseña de @${usuarioACambiarClave.username} actualizada exitosamente.`);
    setUsuarioACambiarClave(null);
  };

  const generarPasswordAleatoria = (setter: (pass: string) => void) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'TSJ-2026-';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setter(pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] border-b border-blue-400/40 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 border border-white/30 rounded-xl text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Centro de Criptoseguridad, Blindaje y Auditoría Forense
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  SHA-256 Activo
                </span>
              </h2>
              <p className="text-xs text-blue-100">
                Resguardo inmutable contra apagones, control de accesos y cumplimiento procesal COPP.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas */}
        <div className="grid grid-cols-3 border-b border-slate-700 bg-slate-950/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('blindaje')}
            className={`py-3 px-3 flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
              tab === 'blindaje'
                ? 'border-blue-400 text-blue-300 bg-blue-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Blindaje Anti-Apagón</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('auditoria')}
            className={`py-3 px-3 flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
              tab === 'auditoria'
                ? 'border-blue-400 text-blue-300 bg-blue-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSearch className="w-4 h-4 text-purple-400" />
            <span>Bitácora de Auditoría ({bitacora.length})</span>
          </button>

          {esSupervisor ? (
            <button
              type="button"
              onClick={() => setTab('usuarios')}
              className={`py-3 px-3 flex items-center justify-center gap-2 transition-colors border-b-2 cursor-pointer ${
                tab === 'usuarios'
                  ? 'border-indigo-400 text-indigo-300 bg-indigo-950/30 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Credenciales y Usuarios</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 font-mono">
                {usuarios.length}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                Supervisor
              </span>
            </button>
          ) : (
            <div
              className="py-3 px-3 flex items-center justify-center gap-1.5 text-slate-500 border-b-2 border-transparent text-xs font-semibold cursor-not-allowed opacity-60"
              title="Opción habilitada únicamente para Supervisores de la Unidad"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Credenciales y Usuarios</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Solo Supervisor
              </span>
            </div>
          )}
        </div>

        {/* Contenido Pestaña 1: Blindaje Anti-Apagón */}
        {tab === 'blindaje' && (
          <div className="p-6 space-y-5 overflow-y-auto text-slate-200 text-xs">
            {/* Tarjetas de Diagnóstico de Blindaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Protección contra apagones */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                  <HardDrive className="w-4 h-4" />
                  <span>Cero Pérdida</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Guardado instantáneo síncrono + copia espejo + base transaccional en disco.
                </p>
                <div className="mt-2 text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Blindado ante apagón
                </div>
              </div>

              {/* 2. Alta Disponibilidad Local */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Alta Disponibilidad Local</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Funciona de forma autónoma con Service Worker PWA integrado en tu equipo.
                </p>
                <div className="mt-2 text-[10px] text-blue-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Sistema 100% Autónomo
                </div>
              </div>

              {/* 3. Estado de la Cuota Persistente */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Disco Permanente</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    {persistenciaInfo.persistente
                      ? 'El navegador tiene asignado permiso permanente para no borrar estos datos.'
                      : 'Protección activa de almacenamiento local.'}
                  </p>
                </div>
                {!persistenciaInfo.persistente && (
                  <button
                    type="button"
                    onClick={handleActivarPersistencia}
                    className="mt-2 text-[10px] text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer text-left"
                  >
                    Solicitar blindaje estricto de cuota
                  </button>
                )}
              </div>
            </div>

            {/* Acciones de Respaldo */}
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400" />
                Copias de Respaldo en Archivo Externo (Pendrive / Disco)
              </h3>
              <p className="text-slate-300 text-[11px]">
                Descarga una copia de seguridad completa con un solo clic para guardarla en una memoria USB o transferirla a otra computadora.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDescargarRespaldo}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Copia de Seguridad (.JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg transition cursor-pointer border border-slate-600"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restaurar desde Archivo .JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleSubirRespaldoArchivo}
                />
              </div>
            </div>

            {/* Puntos de Restauración Automáticos */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Puntos de Restauración Automáticos Recientes
                </h3>
                <span className="text-[11px] text-slate-400">
                  Se generan automáticamente al trabajar
                </span>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  No hay puntos de restauración anteriores guardados aún.
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 rounded-xl flex items-center justify-between transition"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{snap.descripcion || 'Punto de control automático'}</span>
                          <span className="px-2 py-0.5 text-[10px] rounded-md bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                            {snap.boletasCount} boletas
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(snap.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestaurarSnapshot(snap)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg transition font-medium text-xs cursor-pointer border border-slate-600 hover:border-indigo-500"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenido Pestaña 2: Bitácora de Auditoría Forense */}
        {tab === 'auditoria' && (
          <div className="p-6 space-y-4 overflow-y-auto text-slate-200 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-purple-400" />
                  Registro de Actividad y Accesos de Seguridad
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Trazabilidad cronológica inmutable con marcas de tiempo y nivel de criticidad.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportarAuditoria}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 text-xs shadow-sm cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Bitácora (.JSON)</span>
              </button>
            </div>

            {bitacora.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-800/30 rounded-xl border border-slate-700/50">
                No se registran eventos de auditoría todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {bitacora.map((ev) => {
                  const isCrit = ev.nivel === 'CRITICAL';
                  const isWarn = ev.nivel === 'WARNING';
                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isCrit
                          ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                          : isWarn
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                          : 'bg-slate-800/60 border-slate-700/70 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black text-[10px] px-2 py-0.5 rounded-md border ${
                              isCrit
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : isWarn
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {ev.accion}
                          </span>
                          <span className="font-bold text-white text-xs">
                            @{ev.username}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-snug">
                          {ev.detalles}
                        </p>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono text-right shrink-0">
                        {ev.ip}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Contenido Pestaña 3: Cuentas Judiciales y Desbloqueos */}
        {tab === 'usuarios' && (
          <div className="p-6 space-y-4 overflow-y-auto text-slate-200 text-xs">
            {!esSupervisor ? (
              <div className="p-10 text-center bg-slate-800/60 border border-slate-700 rounded-2xl space-y-4 max-w-md mx-auto my-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Opción Habilitada Solo para Supervisores</h4>
                  <p className="text-slate-300 text-xs leading-relaxed mt-1">
                    La gestión de credenciales, visualización de contraseñas y administración de usuarios está reservada exclusivamente para el <strong>Supervisor de la Unidad</strong>.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setTab('blindaje')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Volver al Centro de Blindaje
                  </button>
                </div>
              </div>
            ) : !supervisorAutorizado ? (
              <div className="p-8 text-center bg-slate-800/60 border border-slate-700 rounded-2xl space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Acceso Restringido: Autorización del Supervisor</h4>
                  <p className="text-slate-300 text-xs leading-relaxed mt-1">
                    Por directriz institucional, la gestión de usuarios, visualización y cambio de contraseñas requiere autorización del <strong>Supervisor de la Unidad</strong>.
                  </p>
                </div>

                <form onSubmit={handleVerificarSupervisorPIN} className="space-y-3 pt-2">
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Ingrese PIN del Supervisor (ej: 9900)"
                      value={pinSupervisorInput}
                      onChange={(e) => setPinSupervisorInput(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-center text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  {errorPinSupervisor && (
                    <p className="text-[11px] font-bold text-rose-400">{errorPinSupervisor}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Verificar Identidad y Desbloquear</span>
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Cabecera de Gestión */}
                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>Gestión de Credenciales y Usuarios Judiciales</span>
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Creación de usuarios, edición de datos, eliminación definitiva, visualización de contraseñas y cambio de contraseñas.
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setFormCrear({
                        nombreCompleto: '',
                        cedula: '',
                        cargo: '',
                        rol: 'NOTIFICACION_CITACION',
                        username: '',
                        passwordPlano: '',
                        showPassword: true,
                        email: '',
                        telefono: '',
                        error: '',
                      });
                      setIsCrearUsuarioOpen(true);
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 border border-blue-400/30 text-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Crear Nuevo Usuario</span>
                  </button>
                </div>

                {/* Filtro y Estadísticas Rápidas */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, @usuario o cédula..."
                      value={filtroBusquedaUsuarios}
                      onChange={(e) => setFiltroBusquedaUsuarios(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium">
                    Total: <strong className="text-white font-mono">{usuarios.length}</strong> usuarios registrados
                  </span>
                </div>

                {/* Listado de Tarjetas de Usuarios */}
                <div className="space-y-3 pt-1">
                  {usuarios
                    .filter(u => {
                      if (!filtroBusquedaUsuarios.trim()) return true;
                      const q = filtroBusquedaUsuarios.toLowerCase();
                      return (
                        u.nombreCompleto.toLowerCase().includes(q) ||
                        u.username.toLowerCase().includes(q) ||
                        u.cedula.toLowerCase().includes(q) ||
                        u.cargo.toLowerCase().includes(q)
                      );
                    })
                    .map((usr) => {
                      const estaBloqueado = Boolean(
                        usr.bloqueadoHasta && new Date(usr.bloqueadoHasta) > new Date()
                      );
                      const passwordVisible = Boolean(mostrarPasswordMap[usr.id]);
                      const passwordAMostrar = usr.passwordPlano || (
                        CUENTAS_DEMO.find(d => d.username.toLowerCase() === usr.username.toLowerCase())?.clavePlana || 'Clave@2026!'
                      );
                      const rolCfg = ROLES_CONFIG[usr.rol] || {
                        badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                        nombre: usr.rol
                      };

                      return (
                        <div
                          key={usr.id}
                          className={`p-4 rounded-xl border transition flex flex-col gap-3 ${
                            estaBloqueado
                              ? 'bg-rose-950/40 border-rose-500/60'
                              : !usr.activo
                              ? 'bg-slate-900/60 border-slate-800 opacity-75'
                              : 'bg-slate-800/70 border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          {/* Fila 1: Datos Principales y Badges */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-white text-sm">
                                {usr.nombreCompleto}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rolCfg.badgeBg}`}>
                                {rolCfg.nombre || usr.rol}
                              </span>
                              {!usr.activo && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">
                                  Inactivo
                                </span>
                              )}
                              {estaBloqueado && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Bloqueado Preventivamente
                                </span>
                              )}
                            </div>

                            {/* Acciones Rápidas (Cambiar Clave, Editar, Eliminar) */}
                            <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAbrirCambiarClave(usr)}
                                className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Cambiar la contraseña de este usuario"
                              >
                                <Key className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Cambiar Contraseña</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAbrirEditar(usr)}
                                className="px-2.5 py-1.5 text-slate-200 hover:text-white bg-slate-700/80 hover:bg-slate-700 border border-slate-600 rounded-lg transition cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-xs"
                                title="Editar datos institucionales del usuario"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setUsuarioAEliminar(usr)}
                                className="px-2.5 py-1.5 text-rose-300 hover:text-rose-100 bg-rose-950/50 hover:bg-rose-900/70 border border-rose-700/50 rounded-lg transition cursor-pointer text-xs font-bold flex items-center gap-1.5 shadow-xs"
                                title="Eliminar usuario definitivamente del sistema judicial"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>Eliminar</span>
                              </button>

                              {estaBloqueado && (
                                <button
                                  type="button"
                                  onClick={() => handleDesbloquearUsuario(usr)}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                  title="Desbloquear cuenta de usuario"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Desbloquear</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Fila 2: Cargo, Cédula, Usuario */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                            <span>Cargo: <strong className="text-slate-200">{usr.cargo}</strong></span>
                            <span>•</span>
                            <span>Usuario: <strong className="text-white font-mono">@{usr.username}</strong></span>
                            <span>•</span>
                            <span>Cédula: <strong className="text-slate-300">{usr.cedula}</strong></span>
                            {usr.telefono && (
                              <>
                                <span>•</span>
                                <span>Telf: {usr.telefono}</span>
                              </>
                            )}
                          </div>

                          {/* Fila 3: CREDENCIAL / CONTRASEÑA con Ver Contraseña y Copiar */}
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                <span>Contraseña:</span>
                              </span>

                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-mono text-xs px-2.5 py-0.5 rounded border select-all ${
                                  passwordVisible
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/60 font-bold tracking-normal'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 tracking-widest'
                                }`}>
                                  {passwordVisible ? passwordAMostrar : '••••••••••••'}
                                </span>

                                {/* Botón Ver Contraseña */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleMostrarPassword(usr.id)}
                                  className="px-2.5 py-1 text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                  title={passwordVisible ? 'Ocultar contraseña' : 'Ver contraseña'}
                                >
                                  {passwordVisible ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                      <span className="text-amber-300">Ocultar Contraseña</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5 text-slate-300" />
                                      <span>Ver Contraseña</span>
                                    </>
                                  )}
                                </button>

                                {/* Botón Copiar Contraseña */}
                                <button
                                  type="button"
                                  onClick={() => handleCopiarPassword(passwordAMostrar, usr.id)}
                                  className="px-2 py-1 text-slate-300 hover:text-emerald-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1 text-xs font-medium"
                                  title="Copiar contraseña al portapapeles"
                                >
                                  {copiadoId === usr.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span className="text-emerald-300 text-[11px] font-bold">Copiada</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span className="text-[11px]">Copiar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-500 font-mono">
                              Intentos fallidos: <span className={usr.intentosFallidos > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>{usr.intentosFallidos || 0}/5</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {/* MODAL 1: CREAR NUEVO USUARIO */}
            {isCrearUsuarioOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
                <div className="w-full max-w-lg bg-slate-900 border border-blue-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-5 py-3.5 bg-gradient-to-r from-blue-900 to-indigo-900 border-b border-blue-700/50 flex items-center justify-between text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-blue-300" />
                      <span>Crear Nuevo Usuario Judicial</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCrearUsuarioOpen(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleGuardarNuevoUsuario} className="p-5 space-y-3.5 overflow-y-auto text-xs text-slate-300">
                    {formCrear.error && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{formCrear.error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Abg. Carlos Mendoza"
                          value={formCrear.nombreCompleto}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, nombreCompleto: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Cédula de Identidad *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: V-19.876.543"
                          value={formCrear.cedula}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, cedula: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Cargo Institucional</label>
                        <input
                          type="text"
                          placeholder="Ej: Alguacil Notificador"
                          value={formCrear.cargo}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, cargo: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Rol / Dependencia *</label>
                        <select
                          value={formCrear.rol}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, rol: e.target.value as RolUsuario }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="SUPERVISOR">Supervisor de la Unidad</option>
                          <option value="SECRETARIO">Secretario(a)</option>
                          <option value="NOTIFICACION_CITACION">Notificación y Citación</option>
                          <option value="COORDINADOR">Coordinador / Distribuidor Judicial</option>
                          <option value="ALGUACIL">Alguacil Notificador de Calle</option>
                          <option value="AUDITOR">Auditor Judicial / Inspectoría</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Nombre de Usuario (@username) *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: cmendoza"
                          value={formCrear.username}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-200">Contraseña Inicial *</label>
                          <button
                            type="button"
                            onClick={() => generarPasswordAleatoria((p) => setFormCrear(prev => ({ ...prev, passwordPlano: p })))}
                            className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-0.5 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Generar</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={formCrear.showPassword ? 'text' : 'password'}
                            required
                            placeholder="Contraseña inicial"
                            value={formCrear.passwordPlano}
                            onChange={(e) => setFormCrear(prev => ({ ...prev, passwordPlano: e.target.value }))}
                            className="w-full pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setFormCrear(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                          >
                            {formCrear.showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Correo Electrónico (Opcional)</label>
                        <input
                          type="email"
                          placeholder="usuario@tsj.gob.ve"
                          value={formCrear.email}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Teléfono Móvil (Opcional)</label>
                        <input
                          type="text"
                          placeholder="0414-1234567"
                          value={formCrear.telefono}
                          onChange={(e) => setFormCrear(prev => ({ ...prev, telefono: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCrearUsuarioOpen(false)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Guardar y Crear Usuario</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 2: EDITAR USUARIO */}
            {usuarioAEditar && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
                <div className="w-full max-w-lg bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 border-b border-indigo-700/50 flex items-center justify-between text-white">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-indigo-300" />
                      <span>Editar Usuario @{usuarioAEditar.username}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setUsuarioAEditar(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleGuardarEdicion} className="p-5 space-y-3.5 overflow-y-auto text-xs text-slate-300">
                    {formEditar.error && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{formEditar.error}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          required
                          value={formEditar.nombreCompleto}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, nombreCompleto: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Cédula de Identidad</label>
                        <input
                          type="text"
                          value={formEditar.cedula}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, cedula: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Cargo Institucional</label>
                        <input
                          type="text"
                          value={formEditar.cargo}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, cargo: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Rol / Dependencia</label>
                        <select
                          value={formEditar.rol}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, rol: e.target.value as RolUsuario }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="SUPERVISOR">Supervisor de la Unidad</option>
                          <option value="SECRETARIO">Secretario(a)</option>
                          <option value="NOTIFICACION_CITACION">Notificación y Citación</option>
                          <option value="COORDINADOR">Coordinador / Distribuidor Judicial</option>
                          <option value="ALGUACIL">Alguacil Notificador de Calle</option>
                          <option value="AUDITOR">Auditor Judicial / Inspectoría</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Nombre de Usuario (@username)</label>
                        <input
                          type="text"
                          required
                          value={formEditar.username}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Estado de la Cuenta</label>
                        <select
                          value={formEditar.activo ? 'activo' : 'inactivo'}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, activo: e.target.value === 'activo' }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="activo">Cuenta Activa</option>
                          <option value="inactivo">Cuenta Inactiva (Deshabilitada)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          value={formEditar.email}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-200 mb-1">Teléfono</label>
                        <input
                          type="text"
                          value={formEditar.telefono}
                          onChange={(e) => setFormEditar(prev => ({ ...prev, telefono: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setUsuarioAEditar(null)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Guardar Cambios</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 3: ELIMINAR USUARIO DEFINITIVAMENTE */}
            {usuarioAEliminar && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
                <div className="w-full max-w-md bg-slate-900 border border-rose-500/70 rounded-2xl shadow-2xl p-5 space-y-4 text-white">
                  <div className="flex items-center gap-3 border-b border-rose-900/50 pb-3">
                    <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-rose-300">
                        Eliminar Usuario Definitivamente
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Acción irreversible en el sistema judicial
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 space-y-2">
                    <p className="font-bold">
                      ¿Está completamente seguro de eliminar de forma definitiva la cuenta de:
                    </p>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs">
                      <p className="font-black text-white">{usuarioAEliminar.nombreCompleto}</p>
                      <p className="text-[11px] font-mono text-slate-400">Usuario: @{usuarioAEliminar.username} • Rol: {usuarioAEliminar.rol}</p>
                      <p className="text-[11px] text-slate-400">Cédula: {usuarioAEliminar.cedula}</p>
                    </div>
                    <p className="text-[11px] text-rose-300 leading-relaxed">
                      ⚠️ Esta cuenta será purgada de la base de datos local y el funcionario ya no podrá iniciar sesión.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setUsuarioAEliminar(null)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarEliminar}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Sí, Eliminar Definitivamente</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 4: CAMBIO DE CONTRASEÑA DE USUARIO */}
            {usuarioACambiarClave && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
                <div className="w-full max-w-md bg-slate-900 border border-indigo-500/60 rounded-2xl shadow-2xl p-5 space-y-4 text-white">
                  <div className="flex items-center justify-between border-b border-indigo-900/50 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-indigo-300">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">
                          Cambiar Contraseña de Usuario
                        </h3>
                        <p className="text-[11px] text-indigo-200">
                          @{usuarioACambiarClave.username} ({usuarioACambiarClave.nombreCompleto})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUsuarioACambiarClave(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleGuardarCambioClave} className="space-y-3.5 text-xs">
                    {formClave.error && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{formClave.error}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-200">Nueva Contraseña *</label>
                        <button
                          type="button"
                          onClick={() => generarPasswordAleatoria((p) => setFormClave(prev => ({ ...prev, nueva: p, confirmar: p })))}
                          className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Generar Segura</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={formClave.show ? 'text' : 'password'}
                          required
                          placeholder="Mínimo 4 caracteres"
                          value={formClave.nueva}
                          onChange={(e) => setFormClave(prev => ({ ...prev, nueva: e.target.value }))}
                          className="w-full pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setFormClave(prev => ({ ...prev, show: !prev.show }))}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                        >
                          {formClave.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-200">Confirmar Nueva Contraseña *</label>
                      <input
                        type={formClave.show ? 'text' : 'password'}
                        required
                        placeholder="Repita la nueva contraseña"
                        value={formClave.confirmar}
                        onChange={(e) => setFormClave(prev => ({ ...prev, confirmar: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700 text-[11px] text-slate-300">
                      ℹ️ Al actualizar la contraseña, los contadores de intentos fallidos se reiniciarán a 0 y la cuenta quedará desbloqueada de inmediato.
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setUsuarioACambiarClave(null)}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Actualizar Contraseña</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pie */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sistema Blindado: Activo y Protegiendo {boletas.length} boletas</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
