import React from 'react';
import { Square, Plus, Minus, Check, X } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { SelectionMode } from '../../types';

/**
 * Context-sensitive top options bar — shows different controls
 * depending on the active tool.
 */
export const OptionsBar: React.FC = () => {
  const store = useEditorStore();
  const { activeTool, brushOptions, eraserOptions, fillOptions, selectionMode } = store;

  return (
    <div style={{
      height: 36, background: '#2b2b2b', borderBottom: '1px solid #3d3d3d',
      display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 8,
      gap: 12, flexShrink: 0, overflowX: 'auto',
    }}>
      {(activeTool === 'brush') && <BrushOptions />}
      {(activeTool === 'eraser') && <EraserOptions />}
      {(activeTool === 'fill') && <FillOptions />}
      {(['rectSelect', 'ellipseSelect', 'lassoSelect', 'paintSelect'] as const).includes(activeTool as any) && (
        <SelectionOptions />
      )}
      {(activeTool === 'crop') && <CropOptions />}
      {activeTool === 'none' && (
        <span style={{ fontSize: 11, color: '#555' }}>Select a tool to see options</span>
      )}
    </div>
  );
};

// ── Individual option panels ──────────────────────────────────────────────────

const BrushOptions: React.FC = () => {
  const { brushOptions, setBrushOptions } = useEditorStore();
  return (
    <>
      <OptionSlider label="Size" value={brushOptions.size} min={1} max={500}
        onChange={v => setBrushOptions({ size: v })} unit="px" />
      <OptionSlider label="Hardness" value={brushOptions.hardness} min={0} max={100}
        onChange={v => setBrushOptions({ hardness: v })} unit="%" />
      <OptionSlider label="Opacity" value={brushOptions.opacity} min={1} max={100}
        onChange={v => setBrushOptions({ opacity: v })} unit="%" />
      <OptionSlider label="Flow" value={brushOptions.flow} min={1} max={100}
        onChange={v => setBrushOptions({ flow: v })} unit="%" />
    </>
  );
};

const EraserOptions: React.FC = () => {
  const { eraserOptions, setEraserOptions } = useEditorStore();
  return (
    <>
      <OptionSlider label="Size" value={eraserOptions.size} min={1} max={500}
        onChange={v => setEraserOptions({ size: v })} unit="px" />
      <OptionSlider label="Hardness" value={eraserOptions.hardness} min={0} max={100}
        onChange={v => setEraserOptions({ hardness: v })} unit="%" />
      <OptionSlider label="Opacity" value={eraserOptions.opacity} min={1} max={100}
        onChange={v => setEraserOptions({ opacity: v })} unit="%" />
    </>
  );
};

const FillOptions: React.FC = () => {
  const { fillOptions, setFillOptions } = useEditorStore();
  return (
    <>
      <OptionSlider label="Tolerance" value={fillOptions.tolerance} min={0} max={255}
        onChange={v => setFillOptions({ tolerance: v })} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#888' }}>Mode</span>
        {(['foreground', 'transparent'] as const).map(m => (
          <button key={m} onClick={() => setFillOptions({ mode: m })}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: '1px solid #444',
              background: fillOptions.mode === m ? '#4a9eff22' : '#1a1a1a',
              color: fillOptions.mode === m ? '#4a9eff' : '#aaa',
            }}>
            {m === 'foreground' ? 'Foreground' : 'Erase'}
          </button>
        ))}
      </div>
    </>
  );
};

const SelectionOptions: React.FC = () => {
  const { selectionMode, setSelectionMode, clearSelection, selectionMask } = useEditorStore();
  const hasSelection = selectionMask !== null;

  const modes: { mode: SelectionMode; icon: React.ReactNode; title: string }[] = [
    { mode: 'replace',  icon: <Square size={12} />, title: 'New selection' },
    { mode: 'add',      icon: <Plus size={12} />,   title: 'Add to selection' },
    { mode: 'subtract', icon: <Minus size={12} />,  title: 'Subtract from selection' },
  ];

  return (
    <>
      <div style={{ display: 'flex', border: '1px solid #444', borderRadius: 4, overflow: 'hidden' }}>
        {modes.map(({ mode, icon, title }) => (
          <button key={mode} title={title} onClick={() => setSelectionMode(mode)}
            style={{
              width: 28, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: 'none',
              background: selectionMode === mode ? '#4a9eff22' : '#1a1a1a',
              color: selectionMode === mode ? '#4a9eff' : '#888',
            }}>
            {icon}
          </button>
        ))}
      </div>
      {hasSelection && (
        <button onClick={clearSelection}
          style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
            border: '1px solid #444', background: '#1a1a1a', color: '#aaa',
          }}>
          Deselect
        </button>
      )}
    </>
  );
};

const CropOptions: React.FC = () => {
  const dispatch = (name: string) => window.dispatchEvent(new Event(name));
  return (
    <>
      <span style={{ fontSize: 11, color: '#888' }}>
        Drag to define crop · handles to resize · Enter to apply
      </span>
      <button
        onClick={() => dispatch('crop-apply')}
        title="Apply crop (Enter)"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 10px', borderRadius: 3, cursor: 'pointer',
          border: '1px solid #4a9eff55', background: '#4a9eff22', color: '#4a9eff', fontSize: 12,
        }}
      >
        <Check size={12} /> Apply
      </button>
      <button
        onClick={() => dispatch('crop-cancel')}
        title="Cancel crop (Esc)"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 10px', borderRadius: 3, cursor: 'pointer',
          border: '1px solid #444', background: '#1a1a1a', color: '#aaa', fontSize: 12,
        }}
      >
        <X size={12} /> Cancel
      </button>
    </>
  );
};

// ── Shared slider widget ──────────────────────────────────────────────────────

interface OptionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}

const OptionSlider: React.FC<OptionSliderProps> = ({ label, value, min, max, onChange, unit = '' }) => (
  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
    <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{label}</span>
    <input
      type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: 80, height: 3 }}
    />
    <input
      type="number" min={min} max={max} value={value}
      onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      style={{ width: 44, fontSize: 11 }}
    />
    {unit && <span style={{ fontSize: 10, color: '#555' }}>{unit}</span>}
  </div>
);
