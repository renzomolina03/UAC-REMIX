import React, { useEffect, useState, useRef } from 'react';
import { Printer, Download, X, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import { safeSavePDF, imprimirHtmlDirecto } from '../utils/exportPDF';

export interface EventoImpresionDirectaDetail {
  blobUrl: string;
  fileName: string;
  doc: jsPDF;
  titulo?: string;
  htmlContent?: string;
}

export const VisorImpresionModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [titulo, setTitulo] = useState<string>('');
  const [docInstance, setDocInstance] = useState<jsPDF | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [imprimiendo, setImprimiendo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleImpresionDirecta = (e: Event) => {
      const customEvent = e as CustomEvent<EventoImpresionDirectaDetail>;
      if (!customEvent.detail) return;

      const { blobUrl: url, fileName: name, doc, titulo: tit, htmlContent: html } = customEvent.detail;
      setBlobUrl(url);
      setFileName(name || 'documento.pdf');
      setTitulo(tit || name.replace(/\.pdf$/i, '').replace(/_/g, ' '));
      setDocInstance(doc);
      setHtmlContent(html || '');
      setIsOpen(true);
      setImprimiendo(false);
    };

    window.addEventListener('uac-impresion-directa', handleImpresionDirecta);
    return () => {
      window.removeEventListener('uac-impresion-directa', handleImpresionDirecta);
    };
  }, []);

  const ejecutarImpresion = () => {
    setImprimiendo(true);
    try {
      if (htmlContent) {
        imprimirHtmlDirecto(htmlContent);
        setTimeout(() => setImprimiendo(false), 1000);
        return;
      }

      // Si hay iframe con el PDF renderizado, intentar imprimir desde su ventana
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
          setTimeout(() => setImprimiendo(false), 1000);
          return;
        } catch (e) {
          console.warn('Fallo impresión por iframe directo:', e);
        }
      }

      // Si no hay HTML pero hay blobUrl, imprimir mediante iframe temporal dedicado
      if (blobUrl) {
        try {
          const tempFrame = document.createElement('iframe');
          tempFrame.style.position = 'fixed';
          tempFrame.style.top = '-10000px';
          tempFrame.style.left = '-10000px';
          tempFrame.style.width = '1000px';
          tempFrame.style.height = '1400px';
          tempFrame.src = blobUrl;
          document.body.appendChild(tempFrame);
          tempFrame.onload = () => {
            setTimeout(() => {
              try {
                tempFrame.contentWindow?.focus();
                tempFrame.contentWindow?.print();
              } catch (err) {
                console.warn('Error al invocar print en iframe de PDF:', err);
                if (docInstance) safeSavePDF(docInstance, fileName);
              }
            }, 300);
          };
          setTimeout(() => setImprimiendo(false), 1000);
          return;
        } catch (frameErr) {
          console.warn('Error al crear iframe temporal:', frameErr);
        }
      }

      if (docInstance) {
        safeSavePDF(docInstance, fileName);
      }
    } catch (err) {
      console.warn('Error al iniciar diálogo de impresión:', err);
      if (docInstance) {
        safeSavePDF(docInstance, fileName);
      }
    }
    setTimeout(() => setImprimiendo(false), 1000);
  };

  const handleAbrirPestana = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const handleDescargarOpcional = () => {
    if (docInstance) {
      safeSavePDF(docInstance, fileName);
    } else if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);
    }
  };

  const handleCerrar = () => {
    setIsOpen(false);
    if (blobUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {}
      }, 60000);
    }
  };

  if (!isOpen || !blobUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95">
        
        {/* Cabecera del Visor */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md flex items-center justify-center">
              <Printer className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Impresión Oficial - Hoja Oficio (Vertical)
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Formato Legal (216 × 356 mm)
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-md sm:max-w-xl">
                {titulo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCerrar}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra Informativa y de Acciones */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Documento preparado en <strong>Hoja Tipo Oficio Vertical</strong>. Listo para mandar a imprimir.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAbrirPestana}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Abrir en pestaña nueva con controles completos de PDF"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Abrir en Pestaña</span>
            </button>

            <button
              type="button"
              onClick={handleDescargarOpcional}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Descargar archivo PDF oficial a su computadora"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={ejecutarImpresion}
              disabled={imprimiendo}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Abrir cuadro de diálogo de la impresora para imprimir inmediatamente"
            >
              <Printer className="w-4 h-4" />
              <span>{imprimiendo ? 'Enviando a Impresora...' : '🖨️ Imprimir Ahora (Diálogo de Impresora)'}</span>
            </button>
          </div>
        </div>

        {/* Visor interactivo embebido */}
        <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden flex flex-col min-h-0">
          <iframe
            ref={iframeRef}
            src={`${blobUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full min-h-[55vh] rounded-xl border border-slate-300 bg-white shadow-inner"
            title="Vista previa de documento judicial para impresión directa"
          />
        </div>

        {/* Pie con Estado y Botón de Cierre */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500">
            Archivo oficial: <strong className="text-slate-700">{fileName}</strong> • Orientación Vertical (Oficio / Legal).
          </div>

          <button
            type="button"
            onClick={handleCerrar}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Finalizar / Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

