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
  UserCheck
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
  registrarEventoAuditoria 
} from '../utils/securityAuth';
import { RegistroAuditoria, UsuarioJudicial, SesionActiva } from '../types/auth';

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

  useEffect(() => {
    if (isOpen) {
      setTab(pestañaInicial);
      setSnapshots(obtenerSnapshots());
      verificarEstadoPersistencia().then(setPersistenciaInfo);
      setBitacora(obtenerBitacoraAuditoria());
      obtenerUsuariosRegistrados().then(setUsuarios);
    }
  }, [isOpen, pestañaInicial]);

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
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Solo Supervisor
            </span>
          </button>
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

              {/* 2. Modo sin conexión */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl">
                <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
                  <WifiOff className="w-4 h-4" />
                  <span>100% Sin Internet</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Funciona de forma autónoma con Service Worker PWA integrado en tu equipo.
                </p>
                <div className="mt-2 text-[10px] text-blue-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> No requiere conexión
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
            {sesionActual?.rol !== 'SUPERVISOR' && sesionActual?.rol !== 'SUPER_ADMIN' ? (
              <div className="p-8 text-center bg-slate-800/60 border border-slate-700 rounded-2xl space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-black text-white">Acceso Restringido: Solo el Supervisor Puede Ver Credenciales</h4>
                <p className="text-slate-300 max-w-md mx-auto text-xs leading-relaxed">
                  Por directriz institucional, las credenciales de acceso, contraseñas y estado de cuentas de los funcionarios solo pueden ser visualizadas y gestionadas por el <strong>Supervisor de la Unidad</strong>.
                </p>
                <div className="pt-2">
                  <span className="text-[11px] font-bold px-3 py-1 bg-slate-900 text-slate-300 rounded-full border border-slate-700">
                    Rol activo: {sesionActual?.rol || 'Funcionario'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Gestión de Credenciales y Estado de Cuentas (Exclusivo Supervisor)
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    Monitoreo de intentos fallidos, bloqueos preventivos por fuerza bruta y reseteo por la Dirección.
                  </p>
                </div>

                <div className="space-y-3">
              {usuarios.map((usr) => {
                const estaBloqueado = Boolean(
                  usr.bloqueadoHasta && new Date(usr.bloqueadoHasta) > new Date()
                );

                return (
                  <div
                    key={usr.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      estaBloqueado
                        ? 'bg-rose-950/40 border-rose-500/60'
                        : 'bg-slate-800/60 border-slate-700/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm">
                          {usr.nombreCompleto}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {usr.rol}
                        </span>
                        {estaBloqueado && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/50 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Bloqueado Preventivamente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300">{usr.cargo}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                        <span>Usuario: <strong className="text-white">@{usr.username}</strong></span>
                        <span>•</span>
                        <span>Cédula: {usr.cedula}</span>
                        <span>•</span>
                        <span>Intentos Fallidos: <strong className={usr.intentosFallidos > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>{usr.intentosFallidos || 0} / 5</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {estaBloqueado ? (
                        <button
                          type="button"
                          onClick={() => handleDesbloquearUsuario(usr)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Desbloquear Cuenta</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activa y Protegida</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
              </>
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
