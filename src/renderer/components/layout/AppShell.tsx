import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Upload, Download, Undo2, Redo2, Loader2,
  Scissors, X, Check,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { Toolbar } from './Toolbar';
import { OptionsBar } from './OptionsBar';
import { LayerPanel } from './LayerPanel';
import { StatusBar } from './StatusBar';
import EditorCanvas from '../canvas/EditorCanvas';
import { isMaskEmpty } from '../../utils/maskUtils';
import { flattenLayers, createLayerCanvas } from '../../utils/layerUtils';

/**
 * Top-level application shell.
 * Renders the PS-style layout: titlebar → menubar → optionsbar →
 *   [toolbar | canvas | layer-panel] → statusbar
 */
export const AppShell: React.FC = () => {
  const store = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Measure canvas container ─────────────────────────────────────────────
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── File open ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      store.openImage(ev.target?.result as string, file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [store]);

  // ── Export icons ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    const doc = store.document;
    if (!doc || !window.electronAPI?.generateIcons) {
      alert('Export is unavailable. Run the desktop app build.');
      return;
    }
    setIsExporting(true);
    try {
      // Flatten all layers to a single PNG
      const flat = flattenLayers(doc.layers, doc.width, doc.height, createLayerCanvas(doc.width, doc.height));
      const base64 = flat.toDataURL('image/png').split(',')[1];
      const result = await window.electronAPI.generateIcons(base64, 'icon');
      if (result.success) alert(`Icons saved to: ${result.path}`);
      else alert(`Export failed: ${result.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [store]);

  // ── Apply selection (delete selected area on active layer) ───────────────
  const handleApplySelection = useCallback(async () => {
    const doc = store.document;
    const layer = store.activeLayer();
    const mask = store.selectionMask;
    if (!doc || !layer || !mask || isMaskEmpty(mask)) return;
    if (!window.electronAPI?.applySelection) return;

    setIsProcessing(true);
    try {
      const base64 = layer.canvas.toDataURL('image/png').split(',')[1];
      const result = await window.electronAPI.applySelection(
        base64,
        Array.from(mask.data),
        mask.width,
        mask.height
      );
      if (result.success && result.imageBase64) {
        const img = new Image();
        img.onload = () => {
          const ctx = layer.canvas.getContext('2d')!;
          ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
          ctx.drawImage(img, 0, 0);
          store.commitLayerPixels(layer.id, layer.canvas);
          store.clearSelection();
        };
        img.src = `data:image/png;base64,${result.imageBase64}`;
      }
    } finally {
      setIsProcessing(false);
    }
  }, [store]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editable = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (editable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') { e.preventDefault(); store.undo(); }
      if (ctrl && e.key === 'y') { e.preventDefault(); store.redo(); }
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        const doc = store.document;
        if (doc) store.selectAll();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectionMask && !isMaskEmpty(store.selectionMask)) {
        e.preventDefault();
        handleApplySelection();
      }
      // Tool shortcuts
      if (!ctrl) {
        const toolMap: Record<string, string> = {
          'b': 'brush', 'e': 'eraser', 'g': 'fill',
          'v': 'move', 'h': 'hand', 'z': 'zoom',
          'c': 'crop', 'i': 'colorPick',
          'm': 'rectSelect',
        };
        const t = toolMap[e.key.toLowerCase()];
        if (t) store.setActiveTool(t as any);
      }
      if (e.key === 'x') store.swapColors();
      if (e.key === 'd') store.resetColors();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store, handleApplySelection]);

  const hasDoc = store.document !== null;
  const hasSelection = store.selectionMask !== null && !isMaskEmpty(store.selectionMask);
  const canUndo = store.canUndo();
  const canRedo = store.canRedo();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', overflow: 'hidden' }}>

      {/* ── Menu bar ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 32, background: '#252525', borderBottom: '1px solid #3d3d3d',
        display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12,
        gap: 4, flexShrink: 0, userSelect: 'none',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#4a9eff', marginRight: 12 }}>
          Ainold Editor
        </span>

        {/* File actions */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        <MenuBtn onClick={() => fileInputRef.current?.click()} title="Open image (Ctrl+O)">
          <Upload size={14} /> <span>Open</span>
        </MenuBtn>
        <MenuBtn onClick={handleExport} disabled={!hasDoc || isExporting} title="Export icons">
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span>Export</span>
        </MenuBtn>

        <div style={{ width: 1, height: 16, background: '#3d3d3d', margin: '0 4px' }} />

        {/* History */}
        <MenuBtn onClick={() => store.undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </MenuBtn>
        <MenuBtn onClick={() => store.redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={14} />
        </MenuBtn>

        <div style={{ width: 1, height: 16, background: '#3d3d3d', margin: '0 4px' }} />

        {/* Selection actions */}
        <MenuBtn
          onClick={handleApplySelection}
          disabled={!hasSelection || isProcessing}
          title="Delete selected area (Delete)"
        >
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
          <span>Apply</span>
        </MenuBtn>
        <MenuBtn onClick={() => store.clearSelection()} disabled={!hasSelection} title="Deselect (Esc)">
          <X size={14} /> <span>Deselect</span>
        </MenuBtn>

        <div style={{ flex: 1 }} />

        {/* Doc name */}
        {store.document && (
          <span style={{ fontSize: 11, color: '#555' }}>
            {store.document.name} — {store.document.width}×{store.document.height}
          </span>
        )}
      </div>

      {/* ── Options bar ───────────────────────────────────────────────────── */}
      <OptionsBar />

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left toolbar */}
        <Toolbar />

        {/* Canvas */}
        <div ref={canvasContainerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <EditorCanvas containerWidth={containerSize.w} containerHeight={containerSize.h} />
        </div>

        {/* Right panel */}
        <LayerPanel />
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <StatusBar />
    </div>
  );
};

// ── Tiny helper ──────────────────────────────────────────────────────────────

interface MenuBtnProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

const MenuBtn: React.FC<MenuBtnProps> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 3, border: 'none',
      background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? '#444' : '#aaa', fontSize: 12,
      transition: 'background 0.1s, color 0.1s',
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#3a3a3a'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
  >
    {children}
  </button>
);
