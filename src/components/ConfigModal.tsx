import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  Building2, 
  Users, 
  Save, 
  Download, 
  Upload, 
  RotateCcw,
  CheckCircle,
  Plus,
  Trash2,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { ConfiguracionDespacho, Alguacil, BoletaJudicial } from '../types/judicial';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfiguracionDespacho;
  onSaveConfig: (newConfig: ConfiguracionDespacho) => void;
  alguaciles: Alguacil[];
  onSaveAlguaciles: (list: Alguacil[]) => void;
  boletas: BoletaJudicial[];
  onRestoreBoletas: (boletas: BoletaJudicial[]) => void;
  onResetToDemoData: () => void;
  onOpenSeguridadModal?: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  alguaciles,
  onSaveAlguaciles,
  boletas,
  onRestoreBoletas,
  onResetToDemoData,
  onOpenSeguridadModal,
}) => {
  const [entePrincipal, setEntePrincipal] = useState(config.entePrincipal);
  const [circuitoJudicial, setCircuitoJudicial] = useState(config.circuitoJudicial);
  const [unidad, setUnidad] = useState(config.unidad);
  const [alguacilesRuta, setAlguacilesRuta] = useState(config.alguacilesRuta);
  const [jefeAlguacilazgo, setJefeAlguacilazgo] = useState(config.jefeAlguacilazgo);
  const [mostrarTabAlguaciles, setMostrarTabAlguaciles] = useState(config.mostrarTabAlguaciles ?? false);
  
  // Alguaciles list
  const [alguacilesList, setAlguacilesList] = useState<Alguacil[]>(alguaciles);
  const [newAlguacilName, setNewAlguacilName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      entePrincipal,
      circuitoJudicial,
      unidad,
      alguacilesRuta,
      jefeAlguacilazgo,
      mostrarTabAlguaciles,
    });
    onSaveAlguaciles(alguacilesList);
    setSuccessMsg('¡Configuración de Despacho guardada correctamente!');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1500);
  };

  const handleAddAlguacil = () => {
    if (!newAlguacilName.trim()) return;
    const newAlg: Alguacil = {
      id: String(Date.now()),
      nombre: newAlguacilName.trim().toUpperCase(),
      activo: true,
    };
    setAlguacilesList([...alguacilesList, newAlg]);
    setNewAlguacilName('');
  };

  const handleRemoveAlguacil = (id: string) => {
    setAlguacilesList(alguacilesList.filter(a => a.id !== id));
  };

  // Exportar Backup JSON
  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      fecha: new Date().toISOString(),
      config,
      alguaciles: alguacilesList,
      boletas,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Control_Boletas_${config.mesRutaActual}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.boletas && Array.isArray(json.boletas)) {
          onRestoreBoletas(json.boletas);
          if (json.config) onSaveConfig(json.config);
          if (json.alguaciles) onSaveAlguaciles(json.alguaciles);
          setSuccessMsg(`¡Respaldo restaurado con éxito! Se cargaron ${json.boletas.length} boletas.`);
          setTimeout(() => setSuccessMsg(''), 4000);
        } else {
          alert('El archivo no contiene un formato de boletas válido.');
        }
      } catch (err) {
        alert('Error al leer el archivo de respaldo JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col text-xs">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white flex items-center justify-between flex-shrink-0 border-b border-blue-400/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 text-white font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white">Configuración de Despacho y Alguacilazgo</h3>
              <p className="text-[11px] text-blue-100">Encabezados oficiales, funcionarios y respaldos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2 font-semibold">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Bloque Membrete */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              Membrete e Institución Judicial
            </h4>

            <div className="space-y-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ente Superior:
                </label>
                <input
                  type="text"
                  required
                  value={entePrincipal}
                  onChange={(e) => setEntePrincipal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Circuito Judicial y Jurisdicción:
                </label>
                <input
                  type="text"
                  required
                  value={circuitoJudicial}
                  onChange={(e) => setCircuitoJudicial(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Unidad / Departamento:
                </label>
                <input
                  type="text"
                  required
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nombre de la Ruta de Alguaciles (Encabezado):
                </label>
                <input
                  type="text"
                  required
                  value={alguacilesRuta}
                  onChange={(e) => setAlguacilesRuta(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ENCARGADO (Firma en Acuses y Oficios):
                </label>
                <input
                  type="text"
                  placeholder="ej. RENZO M. (o dejar en blanco para que figure solo ENCARGADO:)"
                  value={jefeAlguacilazgo}
                  onChange={(e) => setJefeAlguacilazgo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  En los acuses de entrega y oficios se imprimirá como <strong>ENCARGADO: {jefeAlguacilazgo || '________________'}</strong>
                </p>
              </div>

              {/* Preferencias de pestañas */}
              <div className="pt-2 border-t border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mostrarTabAlguaciles}
                    onChange={(e) => setMostrarTabAlguaciles(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Mostrar pestaña "2. Listados por Alguacil" en el menú principal
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Si tu despacho no entrega hojas de ruta individualizadas por alguacil, déjala desactivada para mantener el menú simple y ordenado.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Bloque Alguaciles Activos */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Nómina de Alguaciles de Citación
            </h4>

            {/* Agregar nuevo */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre del Alguacil (Ej: ELISET, PABLO F.)"
                value={newAlguacilName}
                onChange={(e) => setNewAlguacilName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs uppercase"
              />
              <button
                type="button"
                onClick={handleAddAlguacil}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            {/* Lista de chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {alguacilesList.map((alg) => (
                <div
                  key={alg.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                >
                  <span>{alg.nombre}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAlguacil(alg.id)}
                    className="text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bloque Blindado Anti-Apagón y Persistencia Local */}
          <div className="p-4 bg-emerald-950/20 rounded-xl border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-emerald-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Blindado Anti-Apagón y Persistencia de Despacho</span>
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-600 text-white shadow-xs">
                ✓ 100% ACTIVO
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Protección continua ante interrupciones de fluido eléctrico, caídas de red o cierres involuntarios del navegador. Toda actuación, causa y boleta judicial se resguarda en almacenamiento indexado persistente del equipo.
            </p>

            {onOpenSeguridadModal && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSeguridadModal();
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Abrir Centro de Blindaje y Puntos de Control</span>
                </button>
              </div>
            )}
          </div>

          {/* Bloque Respaldo y Restauración */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Respaldo de Datos y Seguridad
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Exportar Copia de Seguridad (JSON)</span>
              </button>

              <label className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Restaurar Copia</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Deseas restaurar los datos de ejemplo basados en el formato del Tribunal?')) {
                    onResetToDemoData();
                    setSuccessMsg('¡Datos de prueba restaurados exitosamente!');
                  }
                }}
                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ml-auto"
                title="Restaurar datos iniciales"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Datos Iniciales</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
