import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { Layer } from '../../types';

interface LayerItemProps {
  layer: Layer;
  index: number;
  isActive: boolean;
}

export const LayerItem: React.FC<LayerItemProps> = ({ layer, index, isActive }) => {
  const store = useEditorStore();
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = () => {
    if (nameVal.trim()) store.renameLayer(layer.id, nameVal.trim());
    else setNameVal(layer.name);
    setRenaming(false);
  };

  // Thumbnail: draw layer canvas scaled down
  const thumbRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = thumbRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(layer.canvas, 0, 0, 32, 32);
  }, [layer.canvas]);

  return (
    <div
      onClick={() => store.setActiveLayer(layer.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: isActive ? '#4a9eff18' : 'transparent',
        borderLeft: isActive ? '2px solid #4a9eff' : '2px solid transparent',
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: 40,
      }}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#3a3a3a';
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Visibility toggle */}
      <button
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={e => { e.stopPropagation(); store.setLayerVisibility(layer.id, !layer.visible); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888', flexShrink: 0 }}
      >
        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>

      {/* Thumbnail */}
      <div style={{
        width: 32, height: 32, flexShrink: 0, position: 'relative',
        background: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 0 0 / 8px 8px',
        border: '1px solid #444',
      }}>
        <canvas ref={thumbRef} width={32} height={32} style={{ position: 'absolute', inset: 0, width: 32, height: 32 }} />
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setNameVal(layer.name); setRenaming(false); } }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1a1a', border: '1px solid #4a9eff', color: '#ccc',
              borderRadius: 3, padding: '1px 4px', fontSize: 12, width: '100%',
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setRenaming(true); }}
            style={{
              fontSize: 12, color: isActive ? '#e0e0e0' : '#aaa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'block',
            }}
          >
            {layer.name}
          </span>
        )}
        <span style={{ fontSize: 10, color: '#555' }}>{layer.opacity}%</span>
      </div>

      {/* Lock / action buttons (shown on hover via CSS-in-JS workaround) */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={e => { e.stopPropagation(); store.setLayerLocked(layer.id, !layer.locked); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: layer.locked ? '#4a9eff' : '#555' }}
        >
          {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
      </div>
    </div>
  );
};
