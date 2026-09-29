import React, { useState, useEffect } from 'react';
import { 
  X, 
  FolderPlus, 
  FolderEdit,
  Sparkles, 
  Tag, 
  FileText, 
  Palette, 
  Layers, 
  CheckCircle2,
  Building2,
  Trash2
} from 'lucide-react';
import { SeccionTrabajoInfo } from '../types/judicial';

interface ModalCrearSeccionTrabajoProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSeccion?: (nuevaSeccion: SeccionTrabajoInfo) => void;
  onGuardar?: (nuevaSeccion: SeccionTrabajoInfo) => void;
  seccionesExistentes?: SeccionTrabajoInfo[];
  seccionAEditar?: SeccionTrabajoInfo | null;
  onEliminarSeccion?: (codigo: string) => void;
}

const PALETA_COLORES = [
  {
    id: 'azul',
    nombre: 'Azul Institucional',
    color: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
    tabBgActive: 'bg-blue-700 text-white',
    tabBgInactive: 'bg-blue-50 text-blue-900 hover:bg-blue-100',
    previewDot: 'bg-blue-600',
  },
  {
    id: 'esmeralda',
    nombre: 'Verde Esmeralda',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    tabBgActive: 'bg-emerald-700 text-white',
    tabBgInactive: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    previewDot: 'bg-emerald-600',
  },
  {
    id: 'ambar',
    nombre: 'Ámbar Judicial',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    tabBgActive: 'bg-amber-700 text-white',
    tabBgInactive: 'bg-amber-50 text-amber-900 hover:bg-amber-100',
    previewDot: 'bg-amber-600',
  },
  {
    id: 'purpura',
    nombre: 'Púrpura Protocolar',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    tabBgActive: 'bg-purple-700 text-white',
    tabBgInactive: 'bg-purple-50 text-purple-900 hover:bg-purple-100',
    previewDot: 'bg-purple-600',
  },
  {
    id: 'cian',
    nombre: 'Cian / Marítimo',
    color: 'text-cyan-700',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    tabBgActive: 'bg-cyan-700 text-white',
    tabBgInactive: 'bg-cyan-50 text-cyan-900 hover:bg-cyan-100',
    previewDot: 'bg-cyan-600',
  },
  {
    id: 'pizarra',
    nombre: 'Pizarra Formal',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
    tabBgActive: 'bg-slate-800 text-white',
    tabBgInactive: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    previewDot: 'bg-slate-700',
  },
];

export const ModalCrearSeccionTrabajo: React.FC<ModalCrearSeccionTrabajoProps> = ({
  isOpen,
  onClose,
  onSaveSeccion,
  onGuardar,
  seccionesExistentes = [],
  seccionAEditar = null,
  onEliminarSeccion,
}) => {
  const [nombre, setNombre] = useState('');
  const [corto, setCorto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [colorId, setColorId] = useState('azul');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (seccionAEditar) {
        setNombre(seccionAEditar.nombre || '');
        setCorto(seccionAEditar.corto || '');
        setDescripcion(seccionAEditar.descripcion || '');
        const matchingColor = PALETA_COLORES.find(c => c.tabBgActive === seccionAEditar.tabBgActive);
        setColorId(matchingColor ? matchingColor.id : 'azul');
      } else {
        setNombre('');
        setCorto('');
        setDescripcion('');
        setColorId('azul');
      }
      setError(null);
    }
  }, [isOpen, seccionAEditar]);

  if (!isOpen) return null;

  const colorConfig = PALETA_COLORES.find(c => c.id === colorId) || PALETA_COLORES[0];

  const handleNombreChange = (val: string) => {
    setNombre(val);
    setError(null);
    if (!corto || corto === nombre.slice(0, 16).toUpperCase()) {
      setCorto(val.slice(0, 16).toUpperCase());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = nombre.trim();
    if (!cleanNombre) {
      setError('Por favor ingresa el nombre de la sección de trabajo.');
      return;
    }

    const codigoGenerado = seccionAEditar
      ? seccionAEditar.codigo
      : 'SEC_' + cleanNombre
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .slice(0, 24);

    const listaExistentes = Array.isArray(seccionesExistentes) ? seccionesExistentes : [];
    if (!seccionAEditar) {
      const yaExiste = listaExistentes.some(
        s => s?.codigo === codigoGenerado || (s?.nombre || '').toUpperCase() === cleanNombre.toUpperCase()
      );

      if (yaExiste) {
        setError('Ya existe una sección de trabajo con ese nombre o identificador.');
        return;
      }
    }

    const nueva: SeccionTrabajoInfo = {
      codigo: codigoGenerado,
      nombre: cleanNombre.toUpperCase(),
      corto: (corto.trim() || cleanNombre.slice(0, 16)).toUpperCase(),
      descripcion: descripcion.trim() || `Sección de trabajo judicial: ${cleanNombre}`,
      color: colorConfig.color,
      badgeBg: colorConfig.badgeBg,
      tabBgActive: colorConfig.tabBgActive,
      tabBgInactive: colorConfig.tabBgInactive,
      colorHex: colorConfig.previewDot === 'bg-blue-600' ? '#2563EB' : undefined,
      esPersonalizada: true,
    };

    if (onSaveSeccion) {
      onSaveSeccion(nueva);
    } else if (onGuardar) {
      onGuardar(nueva);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Cabecera Distinguida */}
        <div className="bg-gradient-to-r from-[#006DEB] via-[#0053D5] to-[#003EA7] text-white p-4.5 flex items-center justify-between border-b border-blue-400/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-sm">
              {seccionAEditar ? <FolderEdit className="w-5 h-5 text-blue-100" /> : <FolderPlus className="w-5 h-5 text-blue-100" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
                {seccionAEditar ? 'Modificar / Renombrar Sección' : 'Nueva Sección de Trabajo'}
              </h2>
              <p className="text-xs text-blue-100">
                Cada usuario puede organizar o cambiar el nombre de sus secciones de trabajo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 animate-in fade-in">
              {error}
            </div>
          )}

          {/* Nombre Oficial */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">
              Nombre de la Sección de Trabajo: *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
              placeholder="Ej: RUTA ZONA SUR / TRIBUNALES DE MUNICIPIO"
              className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none uppercase"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nombre descriptivo que identificará esta categoría de diligencias.
            </p>
          </div>

          {/* Nombre Corto para Pestañas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">
                Etiqueta Corta (Botón):
              </label>
              <input
                type="text"
                value={corto}
                onChange={(e) => setCorto(e.target.value)}
                placeholder="Ej: ZONA SUR"
                maxLength={20}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none uppercase"
              />
            </div>

            {/* Esquema de Color Institucional */}
            <div>
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">
                Distintivo Visual:
              </label>
              <select
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none cursor-pointer"
              >
                {PALETA_COLORES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-1">
              Ámbito o Descripción de la Sección:
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Diligencias, comisiones y citaciones en parroquias rurales y foráneas..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Vista Previa del Botón de la Sección */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[11px] font-black uppercase text-slate-500 block">
              Vista previa en la barra de secciones:
            </span>
            <div className="flex items-center gap-2">
              <div className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between gap-3 shadow-xs ${colorConfig.tabBgActive}`}>
                <span>{corto || 'SECCIÓN'}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-white/20 font-black">0</span>
              </div>
              <span className="text-xs text-slate-500">← Pestaña visible en su entorno de trabajo</span>
            </div>
          </div>

          {/* Pie con botones */}
          <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-slate-100">
            {seccionAEditar && onEliminarSeccion && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Deseas eliminar la sección "${seccionAEditar.nombre}"? Las boletas no se borrarán.`)) {
                    onEliminarSeccion(seccionAEditar.codigo);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Sección</span>
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#0062D2] to-[#004BB4] hover:from-[#0052B3] hover:to-[#003C94] text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{seccionAEditar ? 'Guardar Cambios' : 'Guardar y Activar Sección'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
