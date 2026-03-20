import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { rgbToHex, hexToRgb, rgbToHsv, hsvToRgb } from '../../utils/colorUtils';
import type { RgbColor } from '../../types';

/**
 * Photoshop-style foreground / background colour swatches.
 * Click either swatch to open the full colour picker dialog.
 */
export const ColorSwatches: React.FC = () => {
  const fg = useEditorStore(s => s.foregroundColor);
  const bg = useEditorStore(s => s.backgroundColor);
  const swapColors = useEditorStore(s => s.swapColors);
  const resetColors = useEditorStore(s => s.resetColors);
  const [pickerTarget, setPickerTarget] = useState<'fg' | 'bg' | null>(null);

  return (
    <div className="relative flex flex-col items-center" style={{ width: 40, height: 40 }}>
      {/* Reset icon (top-left) */}
      <button
        title="Reset to black/white (D)"
        onClick={resetColors}
        style={{
          position: 'absolute', top: 0, left: 0, zIndex: 3,
          width: 12, height: 12, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontSize: 10, color: '#aaa',
          lineHeight: 1,
        }}
      >⬛</button>

      {/* Background colour swatch */}
      <div
        title="Background colour"
        onClick={() => setPickerTarget('bg')}
        style={{
          position: 'absolute', bottom: 0, right: 0, zIndex: 1,
          width: 22, height: 22,
          background: rgbToHex(bg),
          border: '2px solid #555',
          cursor: 'pointer',
        }}
      />

      {/* Foreground colour swatch */}
      <div
        title="Foreground colour"
        onClick={() => setPickerTarget('fg')}
        style={{
          position: 'absolute', top: 0, left: 0, zIndex: 2,
          width: 22, height: 22,
          background: rgbToHex(fg),
          border: '2px solid #888',
          cursor: 'pointer',
          marginTop: 4, marginLeft: 4,
        }}
      />

      {/* Swap arrow */}
      <button
        title="Swap foreground/background (X)"
        onClick={swapColors}
        style={{
          position: 'absolute', top: 2, right: 2, zIndex: 4,
          width: 12, height: 12, background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontSize: 10, color: '#aaa',
          lineHeight: 1,
        }}
      >⇄</button>

      {pickerTarget && (
        <ColorPickerDialog
          color={pickerTarget === 'fg' ? fg : bg}
          onClose={() => setPickerTarget(null)}
          onChange={(c) => {
            if (pickerTarget === 'fg') useEditorStore.getState().setForegroundColor(c);
            else useEditorStore.getState().setBackgroundColor(c);
          }}
        />
      )}
    </div>
  );
};

// ── Full colour picker dialog ────────────────────────────────────────────────

interface ColorPickerDialogProps {
  color: RgbColor;
  onChange: (c: RgbColor) => void;
  onClose: () => void;
}

const ColorPickerDialog: React.FC<ColorPickerDialogProps> = ({ color, onChange, onClose }) => {
  const [hsv, setHsv] = useState(() => rgbToHsv(color));
  const [hexStr, setHexStr] = useState(() => rgbToHex(color).replace('#', ''));
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  // Sync hex when hsv changes
  useEffect(() => {
    const rgb = hsvToRgb(hsv);
    setHexStr(rgbToHex(rgb).replace('#', ''));
    onChange(rgb);
  }, [hsv]);

  // Draw SV picker
  useEffect(() => {
    const canvas = svRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;

    // Saturation gradient (white → hue)
    const satGrad = ctx.createLinearGradient(0, 0, w, 0);
    satGrad.addColorStop(0, 'rgba(255,255,255,1)');
    const { r, g, b } = hsvToRgb({ h: hsv.h, s: 100, v: 100 });
    satGrad.addColorStop(1, `rgba(${r},${g},${b},1)`);
    ctx.fillStyle = satGrad;
    ctx.fillRect(0, 0, w, h);

    // Value gradient (transparent → black)
    const valGrad = ctx.createLinearGradient(0, 0, 0, h);
    valGrad.addColorStop(0, 'rgba(0,0,0,0)');
    valGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = valGrad;
    ctx.fillRect(0, 0, w, h);

    // Cursor
    const cx = (hsv.s / 100) * w;
    const cy = (1 - hsv.v / 100) * h;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hsv.h, hsv.s, hsv.v]);

  // Draw hue strip
  useEffect(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    for (let i = 0; i <= 360; i += 30) {
      grad.addColorStop(i / 360, `hsl(${i},100%,50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cursor
    const cy = (hsv.h / 360) * canvas.height;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, cy - 2, canvas.width, 4);
  }, [hsv.h]);

  const handleSVClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = svRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100));
    setHsv(prev => ({ ...prev, s: Math.round(s), v: Math.round(v) }));
  }, []);

  const handleHueClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueRef.current!;
    const rect = canvas.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((e.clientY - rect.top) / rect.height) * 360));
    setHsv(prev => ({ ...prev, h: Math.round(h) }));
  }, []);

  const handleHexChange = (val: string) => {
    setHexStr(val);
    if (val.length === 6) {
      try {
        const rgb = hexToRgb('#' + val);
        setHsv(rgbToHsv(rgb));
      } catch {}
    }
  };

  const rgb = hsvToRgb(hsv);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#2b2b2b', border: '1px solid #444',
          borderRadius: 8, padding: 16, userSelect: 'none',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ color: '#ccc', fontSize: 13, marginBottom: 4 }}>Colour Picker</div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* SV picker */}
          <canvas
            ref={svRef}
            width={200} height={200}
            style={{ borderRadius: 4, cursor: 'crosshair', flexShrink: 0 }}
            onMouseDown={() => { draggingSV.current = true; }}
            onMouseMove={(e) => { if (draggingSV.current) handleSVClick(e); }}
            onMouseUp={() => { draggingSV.current = false; }}
            onClick={handleSVClick}
          />
          {/* Hue strip */}
          <canvas
            ref={hueRef}
            width={18} height={200}
            style={{ borderRadius: 4, cursor: 'ns-resize', flexShrink: 0 }}
            onMouseDown={() => { draggingHue.current = true; }}
            onMouseMove={(e) => { if (draggingHue.current) handleHueClick(e); }}
            onMouseUp={() => { draggingHue.current = false; }}
            onClick={handleHueClick}
          />
        </div>

        {/* Hex / RGB inputs */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              width: 32, height: 32,
              background: rgbToHex(rgb),
              border: '1px solid #555',
              borderRadius: 4, flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: 11, width: 14 }}>#</span>
              <input
                type="text" maxLength={6}
                value={hexStr}
                onChange={e => handleHexChange(e.target.value)}
                style={{
                  background: '#1a1a1a', border: '1px solid #3d3d3d',
                  color: '#ccc', borderRadius: 3, padding: '2px 6px',
                  fontSize: 12, width: 72, fontFamily: 'monospace',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['r', 'g', 'b'] as const).map(ch => (
                <div key={ch} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ color: '#888', fontSize: 10 }}>{ch.toUpperCase()}</span>
                  <input
                    type="number" min={0} max={255}
                    value={rgb[ch]}
                    onChange={e => {
                      const val = Math.max(0, Math.min(255, Number(e.target.value)));
                      const newRgb = { ...rgb, [ch]: val };
                      setHsv(rgbToHsv(newRgb));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: '#3a3a3a', color: '#ccc', border: '1px solid #555',
              borderRadius: 4, padding: '4px 14px', cursor: 'pointer', fontSize: 12,
            }}
          >OK</button>
        </div>
      </div>
    </div>
  );
};
