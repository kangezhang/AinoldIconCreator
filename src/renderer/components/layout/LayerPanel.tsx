import React, { useState } from 'react';
import { Plus, Trash2, Copy, Layers, ArrowDown } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { LayerItem } from '../panels/LayerItem';
import { ChannelPanel } from '../panels/ChannelPanel';
import type { Layer } from '../../types';

const BLEND_MODES: Array<{ value: Layer['blendMode']; label: string }> = [
  { value: 'normal',      label: 'Normal' },
  { value: 'multiply',    label: 'Multiply' },
  { value: 'screen',      label: 'Screen' },
  { value: 'overlay',     label: 'Overlay' },
  { value: 'darken',      label: 'Darken' },
  { value: 'lighten',     label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn',  label: 'Color Burn' },
  { value: 'hard-light',  label: 'Hard Light' },
  { value: 'soft-light',  label: 'Soft Light' },
  { value: 'difference',  label: 'Difference' },
  { value: 'exclusion',   label: 'Exclusion' },
  { value: 'hue',         label: 'Hue' },
  { value: 'saturation',  label: 'Saturation' },
  { value: 'color',       label: 'Color' },
  { value: 'luminosity',  label: 'Luminosity' },
];

export const LayerPanel: React.FC = () => {
  const doc = useEditorStore(s => s.document);
  const store = useEditorStore();
  const [activeTab, setActiveTab] = useState<'layers' | 'channels'>('layers');

  const activeLayer = doc?.layers.find(l => l.id === doc.activeLayerId) ?? null;

  const tabStyle = (tab: 'layers' | 'channels') => ({
    flex: 1, padding: '5px 0', fontSize: 11, border: 'none', cursor: 'pointer',
    background: activeTab === tab ? '#2b2b2b' : '#222',
    color: activeTab === tab ? '#ccc' : '#666',
    borderBottom: activeTab === tab ? '2px solid #4a9eff' : '2px solid transparent',
  });

  if (!doc) {
    return (
      <div style={{
        width: 220, background: '#2b2b2b', borderLeft: '1px solid #3d3d3d',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #3d3d3d', flexShrink: 0 }}>
          <button style={tabStyle('layers')} onClick={() => setActiveTab('layers')}>Layers</button>
          <button style={tabStyle('channels')} onClick={() => setActiveTab('channels')}>Channels</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: '#444' }}>No document open</span>
        </div>
      </div>
    );
  }

  const reversedLayers = [...doc.layers].reverse();

  return (
    <div style={{
      width: 220, background: '#2b2b2b', borderLeft: '1px solid #3d3d3d',
      display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: 0,
    }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3d3d3d', flexShrink: 0 }}>
        <button style={tabStyle('layers')} onClick={() => setActiveTab('layers')}>Layers</button>
        <button style={tabStyle('channels')} onClick={() => setActiveTab('channels')}>Channels</button>
      </div>

      {/* ── Channels tab ── */}
      {activeTab === 'channels' && <ChannelPanel />}

      {/* ── Layers tab ── */}
      {activeTab === 'layers' && <>
        {/* Layer action buttons */}
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid #3d3d3d',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <Layers size={13} style={{ color: '#888' }} />
          <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}>Layers</span>
          <button title="Add layer" onClick={() => store.addLayer()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2, lineHeight: 0 }}>
            <Plus size={14} />
          </button>
          <button title="Duplicate layer" onClick={() => activeLayer && store.duplicateLayer(activeLayer.id)}
            disabled={!activeLayer}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2, lineHeight: 0, opacity: !activeLayer ? 0.3 : 1 }}>
            <Copy size={14} />
          </button>
          <button title="Delete layer" onClick={() => activeLayer && store.deleteLayer(activeLayer.id)}
            disabled={!activeLayer || doc.layers.length <= 1}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 2, lineHeight: 0, opacity: (!activeLayer || doc.layers.length <= 1) ? 0.3 : 1 }}>
            <Trash2 size={14} />
          </button>
        </div>

        {/* Active layer controls */}
        {activeLayer && (
          <div style={{
            padding: '6px 8px', borderBottom: '1px solid #3d3d3d', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={activeLayer.blendMode}
                onChange={e => store.setLayerBlendMode(activeLayer.id, e.target.value as Layer['blendMode'])}
                style={{
                  flex: 1, background: '#1a1a1a', border: '1px solid #3d3d3d',
                  color: '#ccc', borderRadius: 3, padding: '2px 4px', fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {BLEND_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#777', width: 40 }}>Opacity</span>
              <input type="range" min={0} max={100} value={activeLayer.opacity}
                onChange={e => store.setLayerOpacity(activeLayer.id, Number(e.target.value))}
                style={{ flex: 1, height: 3, accentColor: '#4a9eff' }} />
              <input type="number" min={0} max={100} value={activeLayer.opacity}
                onChange={e => store.setLayerOpacity(activeLayer.id, Math.max(0, Math.min(100, Number(e.target.value))))}
                style={{ width: 36, fontSize: 11 }} />
            </div>
          </div>
        )}

        {/* Layer list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {reversedLayers.map((layer, displayIdx) => {
            const realIndex = doc.layers.length - 1 - displayIdx;
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                index={realIndex}
                isActive={layer.id === doc.activeLayerId}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '4px 8px', borderTop: '1px solid #3d3d3d', flexShrink: 0,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          <button
            title="Merge down"
            onClick={() => activeLayer && store.mergeDown(activeLayer.id)}
            disabled={!activeLayer || doc.layers.length <= 1}
            style={{
              flex: 1, background: '#3a3a3a', border: '1px solid #444',
              color: '#aaa', borderRadius: 3, padding: '3px 6px',
              cursor: 'pointer', fontSize: 10,
              opacity: (!activeLayer || doc.layers.length <= 1) ? 0.3 : 1,
            }}
          >
            <ArrowDown size={11} style={{ display: 'inline', marginRight: 3 }} />
            Merge Down
          </button>
          <button
            title="Flatten image"
            onClick={() => store.flattenAll()}
            disabled={doc.layers.length <= 1}
            style={{
              flex: 1, background: '#3a3a3a', border: '1px solid #444',
              color: '#aaa', borderRadius: 3, padding: '3px 6px',
              cursor: 'pointer', fontSize: 10,
              opacity: doc.layers.length <= 1 ? 0.3 : 1,
            }}
          >
            Flatten
          </button>
        </div>
      </>}
    </div>
  );
};
