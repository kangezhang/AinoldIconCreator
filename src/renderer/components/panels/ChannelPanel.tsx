import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { BuiltinChannelId } from '../../types';

/** Grayscale preview of a single channel extracted from the composite canvas */
function ChannelThumb({
  channelId,
  customCanvas,
  docWidth,
  docHeight,
}: {
  channelId: BuiltinChannelId | string;
  customCanvas?: HTMLCanvasElement;
  docWidth: number;
  docHeight: number;
}) {
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const store = useEditorStore();

  useEffect(() => {
    const out = thumbRef.current;
    if (!out) return;
    const ctx = out.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 32);

    if (customCanvas) {
      ctx.drawImage(customCanvas, 0, 0, 32, 32);
      return;
    }

    const doc = store.document;
    if (!doc) return;

    // Flatten all layers to get composite pixel data
    const tmp = document.createElement('canvas');
    tmp.width = docWidth; tmp.height = docHeight;
    const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      tctx.save();
      tctx.globalAlpha = layer.opacity / 100;
      tctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      tctx.drawImage(layer.canvas, layer.x, layer.y);
      tctx.restore();
    }

    const imgData = tctx.getImageData(0, 0, docWidth, docHeight);
    const gray = ctx.createImageData(32, 32);

    for (let ty = 0; ty < 32; ty++) {
      for (let tx = 0; tx < 32; tx++) {
        const sx = Math.floor(tx * docWidth / 32);
        const sy = Math.floor(ty * docHeight / 32);
        const si = (sy * docWidth + sx) * 4;
        let v = 0;
        if (channelId === 'red')        v = imgData.data[si];
        else if (channelId === 'green') v = imgData.data[si + 1];
        else if (channelId === 'blue')  v = imgData.data[si + 2];
        else if (channelId === 'alpha') v = imgData.data[si + 3];
        else v = Math.round(imgData.data[si] * 0.299 + imgData.data[si + 1] * 0.587 + imgData.data[si + 2] * 0.114);
        const di = (ty * 32 + tx) * 4;
        gray.data[di] = v; gray.data[di + 1] = v; gray.data[di + 2] = v; gray.data[di + 3] = 255;
      }
    }
    ctx.putImageData(gray, 0, 0);
  });

  return (
    <canvas
      ref={thumbRef}
      width={32}
      height={32}
      style={{
        width: 32, height: 32, flexShrink: 0,
        border: '1px solid #444',
        background: '#111',
      }}
    />
  );
}

const BUILTIN_CHANNELS: { id: BuiltinChannelId; label: string; color: string }[] = [
  { id: 'composite', label: 'RGB',   color: '#ffffff' },
  { id: 'red',       label: 'Red',   color: '#ff4444' },
  { id: 'green',     label: 'Green', color: '#44ff44' },
  { id: 'blue',      label: 'Blue',  color: '#4488ff' },
  { id: 'alpha',     label: 'Alpha', color: '#aaaaaa' },
];

export const ChannelPanel: React.FC = () => {
  const store = useEditorStore();
  const doc = store.document;
  const { channelState } = store;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  if (!doc) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: '#444' }}>No document</span>
      </div>
    );
  }

  const activeId = channelState.activeChannelId;

  const commitRename = (id: string) => {
    if (renameVal.trim()) store.renameCustomChannel(id, renameVal.trim());
    setRenamingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #3d3d3d',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}>Channels</span>
        <button
          title="New channel from selection"
          onClick={() => store.selectionToChannel()}
          disabled={!store.selectionMask}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2, opacity: !store.selectionMask ? 0.3 : 1 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Built-in channels */}
        {BUILTIN_CHANNELS.map(ch => (
          <ChannelRow
            key={ch.id}
            isActive={activeId === ch.id}
            onClick={() => store.setActiveChannel(ch.id)}
            onDoubleClick={() => store.channelToSelection(ch.id)}
            label={ch.label}
            color={ch.color}
            visible={true}
            onVisibilityToggle={undefined}
          >
            <ChannelThumb channelId={ch.id} docWidth={doc.width} docHeight={doc.height} />
          </ChannelRow>
        ))}

        {/* Divider if custom channels exist */}
        {channelState.customChannels.length > 0 && (
          <div style={{ height: 1, background: '#3d3d3d', margin: '2px 0' }} />
        )}

        {/* Custom channels */}
        {channelState.customChannels.map(ch => (
          <ChannelRow
            key={ch.id}
            isActive={activeId === ch.id}
            onClick={() => store.setActiveChannel(ch.id)}
            onDoubleClick={() => store.channelToSelection(ch.id)}
            label={
              renamingId === ch.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(ch.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(ch.id);
                    if (e.key === 'Escape') setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: '#1a1a1a', border: '1px solid #4a9eff',
                    color: '#ccc', borderRadius: 3, padding: '1px 4px',
                    fontSize: 12, width: 80,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setRenamingId(ch.id);
                    setRenameVal(ch.name);
                  }}
                >
                  {ch.name}
                </span>
              )
            }
            color={ch.color}
            visible={ch.visible}
            onVisibilityToggle={() => store.setCustomChannelVisibility(ch.id, !ch.visible)}
            onDelete={() => store.deleteCustomChannel(ch.id)}
          >
            <ChannelThumb channelId={ch.id} customCanvas={ch.canvas} docWidth={doc.width} docHeight={doc.height} />
          </ChannelRow>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '4px 8px', borderTop: '1px solid #3d3d3d', flexShrink: 0,
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        <button
          title="Load channel as selection (double-click channel)"
          onClick={() => store.channelToSelection(activeId)}
          style={{
            flex: 1, background: '#3a3a3a', border: '1px solid #444',
            color: '#aaa', borderRadius: 3, padding: '3px 6px',
            cursor: 'pointer', fontSize: 10,
          }}
        >
          Channel → Selection
        </button>
        <button
          title="Save selection as new channel"
          onClick={() => store.selectionToChannel()}
          disabled={!store.selectionMask}
          style={{
            flex: 1, background: '#3a3a3a', border: '1px solid #444',
            color: '#aaa', borderRadius: 3, padding: '3px 6px',
            cursor: 'pointer', fontSize: 10,
            opacity: !store.selectionMask ? 0.3 : 1,
          }}
        >
          Selection → Channel
        </button>
      </div>
    </div>
  );
};

// ── Row helper ────────────────────────────────────────────────────────────────

interface ChannelRowProps {
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  label: React.ReactNode;
  color: string;
  visible: boolean;
  onVisibilityToggle?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}

const ChannelRow: React.FC<ChannelRowProps> = ({
  isActive, onClick, onDoubleClick, label, color, visible,
  onVisibilityToggle, onDelete, children,
}) => (
  <div
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    title="Click to select · Double-click to load as selection"
    style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 8px',
      background: isActive ? '#4a9eff18' : 'transparent',
      borderLeft: isActive ? `2px solid ${color}` : '2px solid transparent',
      cursor: 'pointer', userSelect: 'none', minHeight: 40,
    }}
    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#3a3a3a'; }}
    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
  >
    {/* Visibility */}
    {onVisibilityToggle ? (
      <button
        onClick={e => { e.stopPropagation(); onVisibilityToggle(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888', flexShrink: 0 }}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
    ) : (
      <span style={{ width: 13, flexShrink: 0 }} />
    )}

    {/* Thumbnail */}
    {children}

    {/* Color dot + label */}
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0, display: 'inline-block',
      }} />
      <span style={{
        fontSize: 12, color: isActive ? '#e0e0e0' : '#aaa',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>

    {/* Delete (custom channels only) */}
    {onDelete && (
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete channel"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#555', flexShrink: 0 }}
      >
        <Trash2 size={11} />
      </button>
    )}
  </div>
);
