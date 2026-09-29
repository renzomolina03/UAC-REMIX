import React, { useState, useEffect, useMemo } from 'react';
import { 
  Header 
} from './components/Header';
import { 
  AlertsBanner 
} from './components/AlertsBanner';
import { 
  BoletaTable 
} from './components/BoletaTable';
import { 
  EnrutamientoAlguacilesView 
} from './components/EnrutamientoAlguacilesView';
import { 
  AcusesTribunalView 
} from './components/AcusesTribunalView';
import { 
  MonthlyStatsView 
} from './components/MonthlyStatsView';
import { 
  MeridaOtrosView 
} from './components/MeridaOtrosView';
import { 
  BoletaFormModal 
} from './components/BoletaFormModal';
import { 
  BoletaQuickBatchModal 
} from './components/BoletaQuickBatchModal';
import { 
  BoletaDetailModal 
} from './components/BoletaDetailModal';
import { 
  ExportModal 
} from './components/ExportModal';
import { 
  ConfigModal 
} from './components/ConfigModal';
import { 
  NuevaListaModal 
} from './components/NuevaListaModal';
import { 
  ModalConfirmarEliminar 
} from './components/ModalConfirmarEliminar';
import { 
  CentroSeguridadModal 
} from './components/CentroSeguridadModal';
import { 
  ValidacionQRModal 
} from './components/ValidacionQRModal';
import { 
  LoginView 
} from './components/LoginView';
import { 
  LockScreenModal 
} from './components/LockScreenModal';
import { 
  CambioPasswordModal 
} from './components/CambioPasswordModal';
import { 
  ModalSeleccionDependenciaSupervisor 
} from './components/ModalSeleccionDependenciaSupervisor';
import { 
  obtenerSesionActiva, 
  cerrarSesionSegura, 
  bloquearEstacionTrabajo 
} from './utils/securityAuth';
import { 
  SesionActiva 
} from './types/auth';
import { 
  decodeTribunalQRUrl,
  DecodedQRData 
} from './utils/qrPayloadHelper';
import { 
  OfflineIndicator 
} from './components/OfflineIndicator';
import { 
  VisorImpresionModal 
} from './components/VisorImpresionModal';
import { 
  fetchBoletasFromServer,
  saveBoletasToServer 
} from './utils/syncApi';

import { 
  cargarBoletasSeguro,
  guardarBoletasSeguro,
  guardarConfigSeguro,
  guardarAlguacilesSeguro,
  solicitarAlmacenamientoPersistente,
  STORAGE_KEY_CONFIG,
  STORAGE_KEY_ALGUACILES
} from './utils/persistentStorage';

import { 
  BoletaJudicial, 
  TribunalInfo, 
  Alguacil, 
  ConfiguracionDespacho,
  ArticuloCOPP,
  TipoCitado,
  SeccionRuta,
  SeccionTrabajoInfo,
  DependenciaJudicial,
  validarRequisitosDevuelta
} from './types/judicial';

import { 
  BOLETAS_INICIALES, 
  TRIBUNALES_REGISTRADOS, 
  ALGUACILES_INICIALES, 
  CONFIG_INICIAL 
} from './data/mockBoletas';

export default function App() {
  // Configuración
  const [config, setConfig] = useState<ConfiguracionDespacho>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      const conf = saved ? JSON.parse(saved) : CONFIG_INICIAL;
      if (conf?.alguacilesRuta && conf.alguacilesRuta.includes('RENZO M. - WUILMAR - ROXANA')) {
        conf.alguacilesRuta = '';
      }
      return conf;
    } catch {
      return CONFIG_INICIAL;
    }
  });

  // Alguaciles
  const [alguaciles, setAlguaciles] = useState<Alguacil[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALGUACILES);
      return saved ? JSON.parse(saved) : ALGUACILES_INICIALES;
    } catch {
      return ALGUACILES_INICIALES;
    }
  });

  // Tribunales
  const [tribunales] = useState<TribunalInfo[]>(TRIBUNALES_REGISTRADOS);

  // Boletas Judiciales con Carga a Prueba de Fallos y Apagones
  const [recuperadoDeApagon, setRecuperadoDeApagon] = useState(false);
  const [boletas, setBoletas] = useState<BoletaJudicial[]>(() => {
    const { boletas: cargadas, recuperadoDeBackup } = cargarBoletasSeguro(BOLETAS_INICIALES);
    if (recuperadoDeBackup) {
      // Registrar que se rescató información tras un corte
      setTimeout(() => setRecuperadoDeApagon(true), 500);
    }
    return cargadas;
  });

  // Secciones Personalizadas de Trabajo creadas por el usuario
  const [seccionesCustom, setSeccionesCustom] = useState<SeccionTrabajoInfo[]>(() => {
    try {
      const stored = localStorage.getItem('uac_secciones_personalizadas');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSaveNuevaSeccion = (nueva: SeccionTrabajoInfo) => {
    setSeccionesCustom(prev => {
      const exists = prev.some(s => s.codigo === nueva.codigo);
      const updated = exists ? prev.map(s => s.codigo === nueva.codigo ? nueva : s) : [...prev, nueva];
      try {
        localStorage.setItem('uac_secciones_personalizadas', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const [batchModalInitialSeccion, setBatchModalInitialSeccion] = useState<string | undefined>(undefined);

  // Referencias para volcado inmediato en caso de apagón / cierre brusco
  const boletasRef = React.useRef(boletas);
  const configRef = React.useRef(config);
  const alguacilesRef = React.useRef(alguaciles);

  useEffect(() => {
    boletasRef.current = boletas;
  }, [boletas]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    alguacilesRef.current = alguaciles;
  }, [alguaciles]);

  // Tab activa: 'boletas' | 'merida_otros' | 'enrutamiento' | 'acuses' | 'stats'
  const [currentTab, setCurrentTab] = useState<'boletas' | 'merida_otros' | 'enrutamiento' | 'acuses' | 'stats'>('boletas');
  const [targetTribunalCode, setTargetTribunalCode] = useState<string>(tribunales[0]?.codigo || 'C1');
  const [targetBoletaIdsForAcuses, setTargetBoletaIdsForAcuses] = useState<string[]>([]);

  // Conteo en tiempo real de causas de Mérida / Otros Estados
  const conteoMerida = useMemo(() => {
    return boletas.filter(b => b.seccionRuta === 'OTROS_ESTADOS_MERIDA').length;
  }, [boletas]);

  // Navegación dirigida hacia Acuses por Tribunal
  const handleNavigateToAcuses = (tribunalCode: string, boletaIds?: string[]) => {
    setTargetTribunalCode(tribunalCode);
    if (boletaIds && boletaIds.length > 0) {
      setTargetBoletaIdsForAcuses(boletaIds);
    }
    setCurrentTab('acuses');
    showToast(`Navegando a Acuses de ${tribunalCode}${boletaIds ? ` (${boletaIds.length} boletas seleccionadas)` : ''}`);
  };

  // Filtro de Alerta seleccionado en el banner
  const [filtroAlertaActivo, setFiltroAlertaActivo] = useState<string>('TODAS');

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBoleta, setEditingBoleta] = useState<BoletaJudicial | null>(null);
  const [viewingBoleta, setViewingBoleta] = useState<BoletaJudicial | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNuevaListaModalOpen, setIsNuevaListaModalOpen] = useState(false);
  const [isSeguridadModalOpen, setIsSeguridadModalOpen] = useState(false);
  const [boletaAEliminar, setBoletaAEliminar] = useState<BoletaJudicial | null>(null);
  const [bulkIdsAEliminar, setBulkIdsAEliminar] = useState<string[] | null>(null);

  // Estados para Validación Oficial por Código QR
  const [qrTribunalCodigo, setQrTribunalCodigo] = useState<string | null>(null);
  const [qrAutoDownload, setQrAutoDownload] = useState(false);
  const [qrBoletasEmbebidas, setQrBoletasEmbebidas] = useState<BoletaJudicial[]>([]);
  const [decodedQRData, setDecodedQRData] = useState<DecodedQRData | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Detección automática al escanear Código QR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const decoded = decodeTribunalQRUrl(window.location.search, window.location.hash);
      if (decoded && (decoded.tribunalCodigo || decoded.tipo === 'global')) {
        setDecodedQRData(decoded);
        setQrTribunalCodigo(decoded.tribunalCodigo);
        setQrAutoDownload(decoded.autodownload);
        if (decoded.boletasEmbebidas && decoded.boletasEmbebidas.length > 0) {
          setQrBoletasEmbebidas(decoded.boletasEmbebidas);
        }
        setIsQrModalOpen(true);
      }
    }
  }, []);

  // Toast Notificación
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Estados de Autenticación, Seguridad y Sesión Activa
  const [sesionActual, setSesionActual] = useState<SesionActiva | null>(() => {
    return obtenerSesionActiva();
  });

  // Dependencia Judicial de Trabajo ('NOTIFICACION_CITACION' | 'SECRETARIA' | 'TODAS')
  const [dependenciaActiva, setDependenciaActiva] = useState<DependenciaJudicial>(() => {
    const ses = obtenerSesionActiva();
    if (ses?.rol === 'SECRETARIO') return 'SECRETARIA';
    return 'NOTIFICACION_CITACION';
  });
  const [isModalSupervisorOpen, setIsModalSupervisorOpen] = useState(false);

  const [isLockScreenOpen, setIsLockScreenOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [seguridadPestañaInicial, setSeguridadPestañaInicial] = useState<'blindaje' | 'auditoria' | 'usuarios'>('blindaje');

  // Temporizador de Bloqueo Automático por Inactividad (20 minutos)
  useEffect(() => {
    if (!sesionActual) return;

    let timeoutId: any;
    const reiniciarInactividad = () => {
      clearTimeout(timeoutId);
      // 20 minutos de inactividad
      timeoutId = setTimeout(() => {
        bloquearEstacionTrabajo();
        setSesionActual(prev => (prev ? { ...prev, bloqueada: true } : null));
        setIsLockScreenOpen(true);
      }, 20 * 60 * 1000);
    };

    reiniciarInactividad();

    const eventos = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    eventos.forEach(ev => window.addEventListener(ev, reiniciarInactividad, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      eventos.forEach(ev => window.removeEventListener(ev, reiniciarInactividad));
    };
  }, [sesionActual]);

  // 1. Blindaje contra apagones y sincronización con servidor (Persistencia garantizada)
  useEffect(() => {
    fetchBoletasFromServer().then(remoteBoletas => {
      if (remoteBoletas && remoteBoletas.length > 0) {
        setBoletas(prev => {
          if (remoteBoletas.length >= prev.length) {
            return remoteBoletas;
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    guardarBoletasSeguro(boletas);
    saveBoletasToServer(boletas).catch(() => {});
  }, [boletas]);

  useEffect(() => {
    guardarConfigSeguro(config);
  }, [config]);

  useEffect(() => {
    guardarAlguacilesSeguro(alguaciles);
  }, [alguaciles]);

  // 2. Eventos de emergencia ante corte de energía o cierre repentino
  useEffect(() => {
    // Solicitar permiso de almacenamiento persistente inmutable al SO / navegador
    solicitarAlmacenamientoPersistente();

    const handleEmergencyFlush = () => {
      guardarBoletasSeguro(boletasRef.current, 'Guardado de emergencia por apagón o cierre');
      guardarConfigSeguro(configRef.current);
      guardarAlguacilesSeguro(alguacilesRef.current);
    };

    window.addEventListener('beforeunload', handleEmergencyFlush);
    window.addEventListener('visibilitychange', handleEmergencyFlush);
    window.addEventListener('pagehide', handleEmergencyFlush);

    return () => {
      window.removeEventListener('beforeunload', handleEmergencyFlush);
      window.removeEventListener('visibilitychange', handleEmergencyFlush);
      window.removeEventListener('pagehide', handleEmergencyFlush);
    };
  }, []);

  // Notificar si se recuperó información protegida tras corte
  useEffect(() => {
    if (recuperadoDeApagon) {
      showToast('🛡️ Sistema protegido: Se recuperó la información desde la copia de seguridad contra apagones.');
    }
  }, [recuperadoDeApagon]);

  // Manejador para Guardar / Actualizar Boleta Individual
  const handleSaveBoleta = (data: Partial<BoletaJudicial>, keepOpen?: boolean) => {
    let devueltaFinal = !!data.devueltaAlTribunal;
    if (devueltaFinal) {
      const mergedToCheck = {
        articuloCOPP: data.articuloCOPP ?? editingBoleta?.articuloCOPP,
        articulosCOPP: data.articulosCOPP ?? editingBoleta?.articulosCOPP,
        alguacilPractica: data.alguacilPractica ?? editingBoleta?.alguacilPractica,
      };
      const check = validarRequisitosDevuelta(mergedToCheck);
      if (!check.puedeSerDevuelta) {
        devueltaFinal = false;
        showToast('⚠️ No se puede marcar como Devuelta: Requiere Artículo COPP y Alguacil asignado.');
      }
    }

    const depPredeterminada: DependenciaJudicial = 
      sesionActual?.rol === 'SECRETARIO' 
        ? 'SECRETARIA' 
        : (dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION');
    const responsableActual = sesionActual?.nombreCompleto || config.directorAlguacilazgo || 'Funcionario Judicial';

    if (editingBoleta) {
      // Actualizar existente
      setBoletas(prev =>
        prev.map(b => {
          if (b.id !== editingBoleta.id) return b;

          const updated: BoletaJudicial = {
            ...b,
            ...data,
            numeroOficio: data.numeroOficio !== undefined ? data.numeroOficio : b.numeroOficio,
            dependencia: data.dependencia || b.dependencia || depPredeterminada,
            responsableRelacion: data.responsableRelacion || b.responsableRelacion || responsableActual,
            acuseRecibidoPor: data.acuseRecibidoPor !== undefined ? data.acuseRecibidoPor : b.acuseRecibidoPor,
            acuseFechaEntrega: data.acuseFechaEntrega !== undefined ? data.acuseFechaEntrega : b.acuseFechaEntrega,
            acuseHoraEntrega: data.acuseHoraEntrega !== undefined ? data.acuseHoraEntrega : b.acuseHoraEntrega,
            devueltaAlTribunal: devueltaFinal,
            estado: devueltaFinal ? 'DEVUELTA_TRIBUNAL' : (b.estado === 'DEVUELTA_TRIBUNAL' ? 'EN_RUTA' : (data.estado || b.estado)),
            updatedAt: new Date().toISOString(),
          };
          const check = validarRequisitosDevuelta(updated);
          if (!check.puedeSerDevuelta && updated.devueltaAlTribunal) {
            updated.devueltaAlTribunal = false;
            updated.estado = 'EN_RUTA';
          }
          return updated;
        })
      );
      showToast(`Boleta Nº ${data.boletaNumero || editingBoleta.boletaNumero} actualizada exitosamente.`);
      setEditingBoleta(null);
    } else {
      // Crear nueva
      const checkNew = validarRequisitosDevuelta({
        articuloCOPP: data.articuloCOPP,
        articulosCOPP: data.articulosCOPP,
        alguacilPractica: data.alguacilPractica,
      });
      const esDevuelta = !!data.devueltaAlTribunal && checkNew.puedeSerDevuelta;

      const newBoleta: BoletaJudicial = {
        id: `bol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        numeroItem: boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1,
        numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
        boletaNumero: data.boletaNumero || '0000',
        numeroOficio: data.numeroOficio || (depPredeterminada === 'SECRETARIA' ? 'OF-S/N' : undefined),
        dependencia: data.dependencia || depPredeterminada,
        responsableRelacion: data.responsableRelacion || responsableActual,
        notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
        tipoCitado: data.tipoCitado || 'IMPUTADO',
        esSoloNotificacion: !!data.esSoloNotificacion,
        fechaAudiencia: data.fechaAudiencia || 'NOTIFICACION',
        horaAudiencia: data.horaAudiencia,
        tipoAudiencia: data.tipoAudiencia,
        fechaAsignacion: data.fechaAsignacion || new Date().toISOString().slice(0, 10),
        tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
        tribunalOtro: data.tribunalOtro?.trim() || undefined,
        articuloCOPP: data.articuloCOPP || '',
        articulosCOPP: data.articulosCOPP,
        alguacilPractica: data.alguacilPractica || '',
        estado: esDevuelta ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
        devueltaAlTribunal: esDevuelta,
        fechaDevueltaTribunal: esDevuelta ? (data.fechaDevueltaTribunal || new Date().toISOString().slice(0, 10)) : undefined,
        fechaRecibidoUAC: data.fechaRecibidoUAC,
        acuseGenerado: !!data.acuseGenerado,
        acuseRecibidoPor: data.acuseRecibidoPor,
        acuseNumeroControl: data.acuseNumeroControl,
        observaciones: data.observaciones,
        direccionCitacion: data.direccionCitacion,
        mesRuta: config.mesRutaActual,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setBoletas(prev => [...prev, newBoleta]);
      showToast(`Boleta Nº ${newBoleta.boletaNumero} registrada exitosamente.`);
    }

    if (!keepOpen) {
      setIsFormModalOpen(false);
    }
  };

  // Manejador para Agregar Boleta Rápida Directa
  const handleQuickAddBoleta = (data: Partial<BoletaJudicial>) => {
    const nextItem = boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1;
    const depPredeterminada: DependenciaJudicial = 
      sesionActual?.rol === 'SECRETARIO' 
        ? 'SECRETARIA' 
        : (dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION');
    const responsableActual = sesionActual?.nombreCompleto || config.directorAlguacilazgo || 'Funcionario Judicial';

    const newBoleta: BoletaJudicial = {
      id: `bol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      numeroItem: nextItem,
      numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
      boletaNumero: data.boletaNumero || 'S/N',
      numeroOficio: data.numeroOficio || (depPredeterminada === 'SECRETARIA' ? 'OF-S/N' : undefined),
      dependencia: data.dependencia || depPredeterminada,
      responsableRelacion: data.responsableRelacion || responsableActual,
      notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
      tipoCitado: data.tipoCitado || 'IMPUTADO',
      esSoloNotificacion: !data.fechaAudiencia,
      fechaAudiencia: data.fechaAudiencia || 'NOTIFICACION',
      fechaAsignacion: new Date().toISOString().slice(0, 10),
      tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
      tribunalOtro: data.tribunalOtro?.trim() || undefined,
      seccionRuta: data.seccionRuta || 'RUTA_NOTIFICACION_CITACION',
      articuloCOPP: data.articuloCOPP || '',
      alguacilPractica: data.alguacilPractica || '',
      estado: data.devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
      devueltaAlTribunal: !!data.devueltaAlTribunal,
      acuseGenerado: false,
      mesRuta: config.mesRutaActual,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setBoletas(prev => [...prev, newBoleta]);
    showToast(`✓ Boleta Nº ${newBoleta.boletaNumero} agregada a la lista.`);
  };

  // Manejador para Guardar Lote de Boletas (Agregar a existente o nuevo lote)
  const handleSaveBatch = (newBoletas: Partial<BoletaJudicial>[], replaceExisting: boolean = false) => {
    if (newBoletas.length === 0) return;

    // 1. Detectar y registrar automáticamente en alguaciles cualquier alguacil que venga en las boletas y no esté registrado
    const nuevosAlguaciles = new Set<string>();
    newBoletas.forEach(b => {
      const nom = b.alguacilPractica?.trim();
      if (nom && !alguaciles.some(a => a.nombre.trim().toUpperCase() === nom.toUpperCase())) {
        nuevosAlguaciles.add(nom);
      }
    });

    if (nuevosAlguaciles.size > 0) {
      setAlguaciles(prev => {
        const updated = [...prev];
        nuevosAlguaciles.forEach(nom => {
          if (!updated.some(a => a.nombre.trim().toUpperCase() === nom.toUpperCase())) {
            updated.push({
              id: `alg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              nombre: nom,
              cargo: 'Alguacil',
              telefono: '',
              zonaAsignada: 'Circuito Judicial Penal',
              activo: true,
            });
          }
        });
        try {
          localStorage.setItem(STORAGE_KEY_ALGUACILES, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }

    const baseNextItem = boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1;
    const depPredeterminada: DependenciaJudicial = 
      sesionActual?.rol === 'SECRETARIO' 
        ? 'SECRETARIA' 
        : (dependenciaActiva === 'SECRETARIA' ? 'SECRETARIA' : 'NOTIFICACION_CITACION');
    const responsableActual = sesionActual?.nombreCompleto || config.directorAlguacilazgo || 'Funcionario Judicial';

    const formattedBoletas: BoletaJudicial[] = newBoletas.map((data, idx) => {
      const assignedItem = replaceExisting
        ? (idx + 1)
        : (data.numeroItem !== undefined ? data.numeroItem : (baseNextItem + idx));

      // Detección inequívoca de SOBRESEIMIENTO
      const esSobreseimiento = 
        data.seccionRuta === 'SOBRESEIMIENTO' ||
        data.notificadoCitado?.toUpperCase().includes('SOBRESE') ||
        (typeof data.fechaAudiencia === 'string' && data.fechaAudiencia.toUpperCase().includes('SOBRESE')) ||
        data.numeroCausa?.toUpperCase().includes('SOBRESE');

      const seccionFinal: SeccionRuta = esSobreseimiento
        ? 'SOBRESEIMIENTO'
        : (data.seccionRuta || 'RUTA_NOTIFICACION_CITACION');

      return {
        id: (data as any).id || `bol-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        numeroItem: assignedItem,
        numeroCausa: data.numeroCausa || 'LP11-P-2026-000',
        boletaNumero: data.boletaNumero || 'S/N',
        numeroOficio: data.numeroOficio || (depPredeterminada === 'SECRETARIA' ? 'OF-S/N' : undefined),
        dependencia: data.dependencia || depPredeterminada,
        responsableRelacion: data.responsableRelacion || responsableActual,
        notificadoCitado: data.notificadoCitado || 'PERSONA CITADA',
        tipoCitado: data.tipoCitado || 'IMPUTADO',
        esSoloNotificacion: esSobreseimiento ? true : (data.esSoloNotificacion ?? !data.fechaAudiencia),
        fechaAudiencia: esSobreseimiento ? 'NOTIFICACION' : (data.fechaAudiencia || 'NOTIFICACION'),
        fechaAsignacion: data.fechaAsignacion || new Date().toISOString().slice(0, 10),
        tribunal: data.tribunal || (tribunales[0]?.codigo || 'C1'),
        tribunalOtro: data.tribunalOtro?.trim() || undefined,
        seccionRuta: seccionFinal,
        articuloCOPP: data.articuloCOPP || '',
        articulosCOPP: data.articulosCOPP,
        alguacilPractica: data.alguacilPractica || '',
        estado: data.devueltaAlTribunal ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
        devueltaAlTribunal: !!data.devueltaAlTribunal,
        finDePagina: !!data.finDePagina,
        acuseGenerado: false,
        direccionCitacion: data.direccionCitacion,
        mesRuta: data.mesRuta || config.mesRutaActual,
        createdAt: (data as any).createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    if (replaceExisting) {
      setBoletas(formattedBoletas);
      showToast(`¡Nuevo lote de ${formattedBoletas.length} boletas iniciado desde el Ítem Nº 1!`);
    } else {
      setBoletas(prev => [...prev, ...formattedBoletas]);
      showToast(`¡${formattedBoletas.length} boletas agregadas exitosamente al lote existente!`);
    }
  };

  // Eliminar Boleta con confirmación obligatoria
  const handleDeleteBoleta = (id: string) => {
    const target = boletas.find(b => b.id === id);
    if (!target) return;
    setBoletaAEliminar(target);
  };

  const handleConfirmarEliminarIndividual = () => {
    if (!boletaAEliminar) return;
    const num = boletaAEliminar.boletaNumero;
    const id = boletaAEliminar.id;
    setBoletas(prev => prev.filter(b => b.id !== id));
    showToast(`✓ Boleta Nº ${num} eliminada.`);
    setBoletaAEliminar(null);
  };

  // Toggle rápido "Devuelta al Tribunal" con validación obligatoria de Artículo COPP y Alguacil
  const handleToggleDevuelta = (id: string, devuelta: boolean) => {
    const target = boletas.find(b => b.id === id);
    if (!target) return;

    if (devuelta) {
      const check = validarRequisitosDevuelta(target);
      if (!check.puedeSerDevuelta) {
        showToast(check.mensajeError.replace(/\n/g, ' '));
        return;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    setBoletas(prev =>
      prev.map(b => {
        if (b.id === id) {
          return {
            ...b,
            devueltaAlTribunal: devuelta,
            fechaDevueltaTribunal: devuelta ? (b.fechaDevueltaTribunal || todayStr) : undefined,
            estado: devuelta ? 'DEVUELTA_TRIBUNAL' : 'EN_RUTA',
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast(devuelta ? '✓ Boleta marcada como Devuelta al Tribunal.' : 'Boleta marcada como Pendiente.');
  };

  // Actualizar directamente quien recibió en tribunal con fecha y hora
  const handleUpdateReceptorTribunal = (
    boletaId: string, 
    datos: { acuseRecibidoPor: string; acuseFechaEntrega?: string; acuseHoraEntrega?: string }
  ) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const currentTimeStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    setBoletas(prev =>
      prev.map(b => {
        if (b.id === boletaId) {
          const nombreClean = datos.acuseRecibidoPor?.trim() || '';
          return {
            ...b,
            acuseRecibidoPor: nombreClean || undefined,
            acuseFechaEntrega: datos.acuseFechaEntrega || b.acuseFechaEntrega || todayStr,
            acuseHoraEntrega: datos.acuseHoraEntrega || b.acuseHoraEntrega || currentTimeStr,
            devueltaAlTribunal: !!nombreClean || b.devueltaAlTribunal,
            fechaDevueltaTribunal: nombreClean ? (b.fechaDevueltaTribunal || datos.acuseFechaEntrega || todayStr) : b.fechaDevueltaTribunal,
            estado: nombreClean ? 'DEVUELTA_TRIBUNAL' : b.estado,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast('✓ Datos de quien recibió actualizados.');
  };

  // Toggle salto de página manual para una boleta
  const handleToggleFinDePagina = (id: string) => {
    setBoletas(prev =>
      prev.map(b => (b.id === id ? { ...b, finDePagina: !b.finDePagina, updatedAt: new Date().toISOString() } : b))
    );
    showToast('Salto de página actualizado.');
  };

  // Bulk Devuelta al Tribunal con validación de Artículo y Alguacil
  const handleBulkDevuelta = (boletaIds: string[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Validar cuáles cumplen con Artículo y Alguacil
    const boletasValidasParaDevolver = boletas.filter(b => {
      if (!boletaIds.includes(b.id)) return false;
      return validarRequisitosDevuelta(b).puedeSerDevuelta;
    });

    const invalidasCount = boletaIds.length - boletasValidasParaDevolver.length;

    if (boletasValidasParaDevolver.length === 0) {
      showToast('⚠️ Ninguna de las boletas seleccionadas tiene Artículo COPP y Alguacil asignados.');
      return;
    }

    const validIds = boletasValidasParaDevolver.map(b => b.id);
    setBoletas(prev =>
      prev.map(b => {
        if (validIds.includes(b.id)) {
          return {
            ...b,
            devueltaAlTribunal: true,
            fechaDevueltaTribunal: b.fechaDevueltaTribunal || todayStr,
            estado: 'DEVUELTA_TRIBUNAL',
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );

    if (invalidasCount > 0) {
      showToast(`✓ ${validIds.length} boleta(s) devueltas. ⚠️ ${invalidasCount} boleta(s) omitidas por faltar Artículo o Alguacil.`);
    } else {
      showToast(`✓ ${validIds.length} boleta(s) marcadas como devueltas al Tribunal.`);
    }
  };

  // Bulk Practicada en UAC
  const handleBulkPracticada = (boletaIds: string[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setBoletas(prev =>
      prev.map(b => {
        if (boletaIds.includes(b.id)) {
          return {
            ...b,
            estado: 'PRACTICADA',
            fechaRecibidoUAC: b.fechaRecibidoUAC || todayStr,
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      })
    );
    showToast(`${boletaIds.length} boleta(s) marcadas como practicadas en UAC.`);
  };

  // Bulk Delete con confirmación
  const handleBulkDelete = (boletaIds: string[]) => {
    if (!boletaIds || boletaIds.length === 0) return;
    setBulkIdsAEliminar(boletaIds);
  };

  const handleConfirmarEliminarMasivo = () => {
    if (!bulkIdsAEliminar) return;
    const count = bulkIdsAEliminar.length;
    setBoletas(prev => prev.filter(b => !bulkIdsAEliminar.includes(b.id)));
    showToast(`✓ ${count} boleta(s) eliminadas exitosamente.`);
    setBulkIdsAEliminar(null);
  };

  // Actualizar artículo(s) COPP directamente (permite hasta 2 por boleta)
  const handleUpdateArticulo = (boletaId: string, articulo: ArticuloCOPP, articulos?: ArticuloCOPP[]) => {
    const finalList = articulos && articulos.length > 0 
      ? articulos 
      : (articulo ? articulo.split(',').map(s => s.trim() as ArticuloCOPP).filter(Boolean) : []);

    let fueRevertida = false;
    setBoletas(prev =>
      prev.map(b => {
        if (b.id !== boletaId) return b;
        const artStr = (finalList.join(', ') || '') as ArticuloCOPP;
        const check = validarRequisitosDevuelta({
          ...b,
          articuloCOPP: artStr,
          articulosCOPP: finalList,
        });
        const nuevaDevuelta = check.puedeSerDevuelta ? b.devueltaAlTribunal : false;
        if (b.devueltaAlTribunal && !nuevaDevuelta) {
          fueRevertida = true;
        }
        return { 
          ...b, 
          articuloCOPP: artStr, 
          articulosCOPP: finalList,
          devueltaAlTribunal: nuevaDevuelta,
          estado: nuevaDevuelta ? b.estado : (b.estado === 'DEVUELTA_TRIBUNAL' ? 'EN_RUTA' : b.estado),
          updatedAt: new Date().toISOString() 
        };
      })
    );
    const label = finalList.length > 1 ? finalList.join(' y ') : (finalList[0] || 'ninguno');
    if (fueRevertida) {
      showToast(`Artículo(s) COPP: ${label}. ⚠️ Cambiada a Pendiente por faltar Artículo para Devuelta.`);
    } else {
      showToast(finalList.length > 0 ? `Artículo(s) COPP asignado(s): ${label}.` : 'Artículo COPP desmarcado.');
    }
  };

  // Asignar artículo COPP en lote
  const handleBulkAssignArticulo = (boletaIds: string[], articulo: ArticuloCOPP) => {
    const list = articulo ? [articulo] : [];
    let revertidas = 0;
    setBoletas(prev =>
      prev.map(b => {
        if (!boletaIds.includes(b.id)) return b;
        const check = validarRequisitosDevuelta({
          ...b,
          articuloCOPP: articulo,
          articulosCOPP: list,
        });
        const nuevaDevuelta = check.puedeSerDevuelta ? b.devueltaAlTribunal : false;
        if (b.devueltaAlTribunal && !nuevaDevuelta) {
          revertidas++;
        }
        return { 
          ...b, 
          articuloCOPP: articulo, 
          articulosCOPP: list,
          devueltaAlTribunal: nuevaDevuelta,
          estado: nuevaDevuelta ? b.estado : (b.estado === 'DEVUELTA_TRIBUNAL' ? 'EN_RUTA' : b.estado),
          updatedAt: new Date().toISOString() 
        };
      })
    );
    if (revertidas > 0) {
      showToast(`Artículo COPP asignado. ⚠️ ${revertidas} boleta(s) pasaron a Pendiente por faltar Artículo requerido.`);
    } else {
      showToast(`Artículo COPP ${articulo || 'limpiado'} asignado a ${boletaIds.length} boleta(s).`);
    }
  };

  // Actualizar Alguacil que practicó directamente
  const handleUpdateAlguacil = (boletaId: string, alguacil: string) => {
    let fueRevertida = false;
    setBoletas(prev =>
      prev.map(b => {
        if (b.id !== boletaId) return b;
        const check = validarRequisitosDevuelta({
          ...b,
          alguacilPractica: alguacil,
        });
        const nuevaDevuelta = check.puedeSerDevuelta ? b.devueltaAlTribunal : false;
        if (b.devueltaAlTribunal && !nuevaDevuelta) {
          fueRevertida = true;
        }
        return { 
          ...b, 
          alguacilPractica: alguacil, 
          devueltaAlTribunal: nuevaDevuelta,
          estado: nuevaDevuelta ? b.estado : (b.estado === 'DEVUELTA_TRIBUNAL' ? 'EN_RUTA' : b.estado),
          updatedAt: new Date().toISOString() 
        };
      })
    );
    if (fueRevertida) {
      showToast(`Alguacil actualizado. ⚠️ Boleta cambiada a Pendiente por no tener Alguacil válido.`);
    } else {
      showToast(`Alguacil ${alguacil || 'removido'} asignado para practicar.`);
    }
  };

  // Asignar Alguacil en lote
  const handleBulkAssignAlguacil = (boletaIds: string[], alguacil: string) => {
    let revertidas = 0;
    setBoletas(prev =>
      prev.map(b => {
        if (!boletaIds.includes(b.id)) return b;
        const check = validarRequisitosDevuelta({
          ...b,
          alguacilPractica: alguacil,
        });
        const nuevaDevuelta = check.puedeSerDevuelta ? b.devueltaAlTribunal : false;
        if (b.devueltaAlTribunal && !nuevaDevuelta) {
          revertidas++;
        }
        return { 
          ...b, 
          alguacilPractica: alguacil, 
          devueltaAlTribunal: nuevaDevuelta,
          estado: nuevaDevuelta ? b.estado : (b.estado === 'DEVUELTA_TRIBUNAL' ? 'EN_RUTA' : b.estado),
          updatedAt: new Date().toISOString() 
        };
      })
    );
    if (revertidas > 0) {
      showToast(`Alguacil asignado. ⚠️ ${revertidas} boleta(s) pasaron a Pendiente por faltar Alguacil válido.`);
    } else {
      showToast(`Alguacil ${alguacil || 'limpiado'} asignado a ${boletaIds.length} boleta(s).`);
    }
  };

  // Actualizar Sección de Ruta
  const handleUpdateSeccion = (boletaId: string, seccion: SeccionRuta) => {
    setBoletas(prev =>
      prev.map(b => (b.id === boletaId ? { ...b, seccionRuta: seccion, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`Sección de ruta actualizada.`);
  };

  // Asignar Sección de Ruta en lote
  const handleBulkAssignSeccion = (boletaIds: string[], seccion: SeccionRuta) => {
    setBoletas(prev =>
      prev.map(b => (boletaIds.includes(b.id) ? { ...b, seccionRuta: seccion, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`${boletaIds.length} boleta(s) movidas a nueva sección.`);
  };

  // Asignar Carácter en lote a varias boletas
  const handleBulkAssignCaracter = (boletaIds: string[], caracter: TipoCitado) => {
    setBoletas(prev =>
      prev.map(b => (boletaIds.includes(b.id) ? { ...b, tipoCitado: caracter, updatedAt: new Date().toISOString() } : b))
    );
    showToast(`Carácter "${caracter}" asignado a ${boletaIds.length} boleta(s).`);
  };

  // Quick acuse trigger
  const handleQuickAcuse = (boleta: BoletaJudicial) => {
    setEditingBoleta(boleta);
    setIsFormModalOpen(true);
  };

  // Limpieza y Nueva Lista
  const handleClearAllBoletas = () => {
    setBoletas([]);
    showToast('✓ Lista vaciada exitosamente. Iniciando nuevo listado desde el Item Nº 1.');
  };

  const handleClearCompletedOnly = () => {
    const pendientes = boletas.filter(b => !b.devueltaAlTribunal && !b.acuseGenerado);
    const reenumeradas = pendientes.map((b, idx) => ({ ...b, numeroItem: idx + 1 }));
    setBoletas(reenumeradas);
    showToast(`✓ Se conservaron ${reenumeradas.length} boletas activas/pendientes. Lista reordenada.`);
  };

  // Reset a datos de prueba
  const handleResetToDemoData = () => {
    setBoletas(BOLETAS_INICIALES);
    setConfig(CONFIG_INICIAL);
    setAlguaciles(ALGUACILES_INICIALES);
    showToast('Datos de demostración restablecidos.');
  };

  // Verificación de Autenticación: Si no hay sesión activa, mostrar Login
  if (!sesionActual) {
    return (
      <>
        <LoginView
          onLoginExitoso={(nuevaSesion) => {
            setSesionActual(nuevaSesion);
            if (nuevaSesion.rol === 'SUPERVISOR') {
              setIsModalSupervisorOpen(true);
            } else if (nuevaSesion.rol === 'SECRETARIO') {
              setDependenciaActiva('SECRETARIA');
            } else {
              setDependenciaActiva('NOTIFICACION_CITACION');
            }
            showToast(`✓ Acceso concedido al Despacho: ${nuevaSesion.nombreCompleto} (${nuevaSesion.rol})`);
          }}
          circuitoJudicial={config.circuitoJudicial}
          unidad={config.unidad}
        />
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#1e293b] text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col selection:bg-blue-600 selection:text-white font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1e293b] text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado Principal */}
      <Header
        config={config}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenSeguridadModal={() => {
          setSeguridadPestañaInicial('blindaje');
          setIsSeguridadModalOpen(true);
        }}
        onMonthChange={(newMonth) => {
          setConfig(prev => ({ ...prev, mesRutaActual: newMonth }));
          showToast(`Mes de ruta cambiado a ${newMonth}`);
        }}
        conteoMerida={conteoMerida}
        sesionActual={sesionActual}
        dependenciaActiva={dependenciaActiva}
        onAbrirModalSupervisor={() => setIsModalSupervisorOpen(true)}
        onCambiarDependencia={setDependenciaActiva}
        onBloquearEstacion={() => {
          bloquearEstacionTrabajo();
          setSesionActual(prev => (prev ? { ...prev, bloqueada: true } : null));
          setIsLockScreenOpen(true);
        }}
        onAbrirCambioPassword={() => setIsPasswordModalOpen(true)}
        onAbrirAuditoria={() => {
          setSeguridadPestañaInicial('auditoria');
          setIsSeguridadModalOpen(true);
        }}
        onCerrarSesion={() => {
          cerrarSesionSegura();
          setSesionActual(null);
          showToast('Sesión judicial cerrada de forma segura.');
        }}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Pestaña 1: Control General de Boletas */}
        {currentTab === 'boletas' && (
          <div className="space-y-5">
            {/* Monitor de Alertas Automáticas */}
            <AlertsBanner
              boletas={boletas}
              activeFilter={filtroAlertaActivo}
              onSelectFilter={setFiltroAlertaActivo}
            />

            {/* Tabla de Control de Boletas */}
            <BoletaTable
              boletas={boletas}
              tribunales={tribunales}
              alguaciles={alguaciles}
              config={config}
              filtroAlertaActivo={filtroAlertaActivo}
              dependenciaActiva={dependenciaActiva}
              onCambiarDependencia={setDependenciaActiva}
              sesionActual={sesionActual}
              onEditBoleta={(boleta) => {
                setEditingBoleta(boleta);
                setIsFormModalOpen(true);
              }}
              onDeleteBoleta={handleDeleteBoleta}
              onViewBoleta={(boleta) => setViewingBoleta(boleta)}
              onToggleDevuelta={handleToggleDevuelta}
              onToggleFinDePagina={handleToggleFinDePagina}
              onQuickAcuse={handleQuickAcuse}
              onNavigateToAcuses={handleNavigateToAcuses}
              onBulkDevuelta={handleBulkDevuelta}
              onBulkPracticada={handleBulkPracticada}
              onBulkDelete={handleBulkDelete}
              onUpdateArticulo={handleUpdateArticulo}
              onBulkAssignArticulo={handleBulkAssignArticulo}
              onUpdateAlguacil={handleUpdateAlguacil}
              onBulkAssignAlguacil={handleBulkAssignAlguacil}
              onBulkAssignCaracter={handleBulkAssignCaracter}
              onUpdateSeccion={handleUpdateSeccion}
              onBulkAssignSeccion={handleBulkAssignSeccion}
              onUpdateReceptorTribunal={handleUpdateReceptorTribunal}
              onUpdateBoletasAsignadas={(actualizadas) => {
                setBoletas(prev => prev.map(b => {
                  const encontrada = actualizadas.find(act => act.id === b.id);
                  if (!encontrada) return b;
                  return {
                    ...b,
                    ...encontrada,
                  };
                }));
                showToast(`✓ Se actualizaron las asignaciones de ${actualizadas.length} boletas.`);
              }}
              onOpenNewBoleta={() => {
                setEditingBoleta(null);
                setIsFormModalOpen(true);
              }}
              seccionesCustom={seccionesCustom}
              onSaveNuevaSeccion={handleSaveNuevaSeccion}
              onOpenBatchModal={(seccion) => {
                setBatchModalInitialSeccion(seccion);
                setIsBatchModalOpen(true);
              }}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenNuevaListaModal={() => setIsNuevaListaModalOpen(true)}
              onQuickAddBoleta={handleQuickAddBoleta}
              onNavigateToMeridaOtros={() => setCurrentTab('merida_otros')}
            />
          </div>
        )}

        {/* Pestaña: Mérida y Otros Despachos (Acuses Unificados y Estadísticas Independientes) */}
        {currentTab === 'merida_otros' && (
          <MeridaOtrosView
            boletas={boletas}
            alguaciles={alguaciles}
            tribunales={tribunales}
            config={config}
            onUpdateBoleta={(updated) => {
              setBoletas(prev => prev.map(b => b.id === updated.id ? updated : b));
              showToast('Boleta foránea actualizada.');
            }}
            onAddBoleta={handleQuickAddBoleta}
            onDeleteBoleta={handleDeleteBoleta}
            onOpenBatchMode={() => setIsBatchModalOpen(true)}
            onVolverPrincipal={() => setCurrentTab('boletas')}
          />
        )}

        {/* Pestaña: Enrutamiento por Alguacil & Hojas de Ruta */}
        {currentTab === 'enrutamiento' && (
          <EnrutamientoAlguacilesView
            boletas={boletas}
            alguaciles={alguaciles}
            tribunales={tribunales}
            config={config}
            onNavigateToAcuses={handleNavigateToAcuses}
            onUpdateBoletas={(updated) => {
              setBoletas(updated);
              showToast('Enrutamiento de alguaciles actualizado.');
            }}
          />
        )}

        {/* Pestaña: Relación de Acuses por Tribunal */}
        {currentTab === 'acuses' && (
          <AcusesTribunalView
            boletas={boletas}
            tribunales={tribunales}
            config={config}
            initialTribunalCode={targetTribunalCode}
            initialSelectedBoletaIds={targetBoletaIdsForAcuses}
            onUpdateBoletas={(updated) => {
              setBoletas(prev => {
                const updatedMap = new Map(updated.map(u => [u.id, u]));
                return prev.map(b => updatedMap.get(b.id) || b);
              });
              showToast('Relación de acuses actualizada correctamente.');
            }}
          />
        )}

        {/* Pestaña: Estadísticas y Resumen Mensual */}
        {currentTab === 'stats' && (
          <MonthlyStatsView
            boletas={boletas}
            tribunales={tribunales}
            config={config}
          />
        )}
      </main>

      {/* Modal Carga Individual */}
      <BoletaFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingBoleta(null);
        }}
        onSave={handleSaveBoleta}
        onOpenBatchMode={() => {
          setIsBatchModalOpen(true);
        }}
        initialData={editingBoleta}
        tribunales={tribunales}
        alguaciles={alguaciles}
        proximoNumeroItem={boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1}
        mesRutaActual={config.mesRutaActual}
        seccionesCustom={seccionesCustom}
        dependenciaActiva={dependenciaActiva}
        responsableActual={sesionActual?.nombreCompleto || config.directorAlguacilazgo}
      />

      {/* Modal Carga Rápida en Lote (Multi-Boletas) */}
      <BoletaQuickBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => {
          setIsBatchModalOpen(false);
          setBatchModalInitialSeccion(undefined);
        }}
        onSaveBatch={handleSaveBatch}
        tribunales={tribunales}
        alguaciles={alguaciles}
        proximoNumeroItem={boletas.length > 0 ? Math.max(...boletas.map(b => b.numeroItem)) + 1 : 1}
        mesRutaActual={config.mesRutaActual}
        boletasExistentes={boletas}
        seccionesCustom={seccionesCustom}
        seccionActiva={batchModalInitialSeccion}
        onSaveNuevaSeccion={handleSaveNuevaSeccion}
        dependenciaActiva={dependenciaActiva}
        responsableActual={sesionActual?.nombreCompleto || config.directorAlguacilazgo}
      />

      {/* Modal Detalle de Boleta */}
      <BoletaDetailModal
        isOpen={!!viewingBoleta}
        onClose={() => setViewingBoleta(null)}
        boleta={viewingBoleta}
        tribunales={tribunales}
        onEdit={(b) => {
          setViewingBoleta(null);
          setEditingBoleta(b);
          setIsFormModalOpen(true);
        }}
        onToggleDevuelta={(id, dev) => {
          handleToggleDevuelta(id, dev);
          if (viewingBoleta && viewingBoleta.id === id) {
            setViewingBoleta(prev => prev ? { ...prev, devueltaAlTribunal: dev } : null);
          }
        }}
      />

      {/* Modal Exportación */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        boletas={boletas}
        tribunales={tribunales}
        alguaciles={alguaciles}
        config={config}
      />

      {/* Modal Configuración */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={setConfig}
        alguaciles={alguaciles}
        onSaveAlguaciles={setAlguaciles}
        boletas={boletas}
        onRestoreBoletas={setBoletas}
        onResetToDemoData={handleResetToDemoData}
        onOpenSeguridadModal={() => {
          setSeguridadPestañaInicial('blindaje');
          setIsSeguridadModalOpen(true);
        }}
      />

      {/* Modal Iniciar Nueva Lista / Cerrar Jornada */}
      <NuevaListaModal
        isOpen={isNuevaListaModalOpen}
        onClose={() => setIsNuevaListaModalOpen(false)}
        boletas={boletas}
        tribunales={tribunales}
        alguaciles={alguaciles}
        config={config}
        onClearAll={handleClearAllBoletas}
        onClearCompletedOnly={handleClearCompletedOnly}
        onResetDemoData={handleResetToDemoData}
        onOpenQuickBatch={() => {
          setIsBatchModalOpen(true);
        }}
      />

      {/* Modal Confirmar Eliminar Boleta Individual */}
      <ModalConfirmarEliminar
        isOpen={boletaAEliminar !== null}
        onClose={() => setBoletaAEliminar(null)}
        onConfirm={handleConfirmarEliminarIndividual}
        boleta={boletaAEliminar}
        cantidad={1}
      />

      {/* Modal Confirmar Eliminar Boletas Masivas */}
      <ModalConfirmarEliminar
        isOpen={bulkIdsAEliminar !== null}
        onClose={() => setBulkIdsAEliminar(null)}
        onConfirm={handleConfirmarEliminarMasivo}
        cantidad={bulkIdsAEliminar?.length || 0}
      />

      {/* Centro de Seguridad, Blindaje contra Apagones, Auditoría y Respaldos */}
      <CentroSeguridadModal
        isOpen={isSeguridadModalOpen}
        onClose={() => setIsSeguridadModalOpen(false)}
        boletas={boletas}
        config={config}
        alguaciles={alguaciles}
        onRestaurarBoletas={(nuevas) => {
          setBoletas(nuevas);
          showToast(`✓ Se han restaurado ${nuevas.length} boletas correctamente.`);
        }}
        onShowToast={showToast}
        sesionActual={sesionActual}
        pestañaInicial={seguridadPestañaInicial}
      />

      {/* Modal para Cambio Seguro de Contraseña */}
      {isPasswordModalOpen && sesionActual && (
        <CambioPasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          sesion={sesionActual}
          onShowToast={showToast}
        />
      )}

      {/* Pantalla de Bloqueo por Inactividad o a Solicitud del Funcionario */}
      {(isLockScreenOpen || sesionActual?.bloqueada) && sesionActual && (
        <LockScreenModal
          sesion={sesionActual}
          onDesbloqueada={() => {
            setSesionActual(prev => (prev ? { ...prev, bloqueada: false } : null));
            setIsLockScreenOpen(false);
            showToast('✓ Estación de trabajo desbloqueada con éxito.');
          }}
          onCerrarSesion={() => {
            cerrarSesionSegura();
            setSesionActual(null);
            setIsLockScreenOpen(false);
            showToast('Sesión judicial finalizada.');
          }}
        />
      )}

      {/* Modal de Validación Oficial y Descarga por Código QR */}
      {isQrModalOpen && (qrTribunalCodigo || decodedQRData) && (
        <ValidacionQRModal
          isOpen={isQrModalOpen}
          onClose={() => {
            setIsQrModalOpen(false);
            if (typeof window !== 'undefined' && window.history) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
          tribunalCodigo={qrTribunalCodigo || 'GLOBAL'}
          boletasDisponibles={boletas}
          boletasEmbebidas={qrBoletasEmbebidas}
          tribunales={tribunales}
          config={config}
          autoDownload={qrAutoDownload}
          qrDecodedData={decodedQRData}
        />
      )}

      {/* Modal de Selección de Dependencia para el Supervisor de la Unidad */}
      <ModalSeleccionDependenciaSupervisor
        isOpen={isModalSupervisorOpen}
        onClose={() => setIsModalSupervisorOpen(false)}
        onSeleccionarDependencia={(dep) => {
          setDependenciaActiva(dep);
          setIsModalSupervisorOpen(false);
          const nombreDep = dep === 'NOTIFICACION_CITACION' 
            ? 'Notificación y Citación' 
            : dep === 'SECRETARIA' 
              ? 'Secretaría (con N° de Oficio)' 
              : 'Supervisión Integral (Ambas Dependencias)';
          showToast(`✓ Dependencia seleccionada: ${nombreDep}`);
        }}
        dependenciaActual={dependenciaActiva}
        nombreSupervisor={sesionActual?.nombreCompleto || 'Supervisor de la Unidad'}
      />

      {/* Indicador Flotante de Modo Sin Conexión (Sin Internet) */}
      <OfflineIndicator />

      {/* Visor Interactivo y Controlador de Impresión Directa y Descarga */}
      <VisorImpresionModal />
    </div>
  );
}

