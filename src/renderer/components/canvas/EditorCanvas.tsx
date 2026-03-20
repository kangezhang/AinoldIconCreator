import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { flattenLayers } from '../../utils/layerUtils';
import CanvasOverlay from './CanvasOverlay';
import type { BuiltinChannelId } from '../../types';

interface EditorCanvasProps {
  /** Container dimensions so we can compute fit-zoom */
  containerWidth: number;
  containerHeight: number;
}

/**
 * Main canvas area.
 * Renders the composited document to a visible canvas, handles zoom/pan,
 * and forwards tool interactions to CanvasOverlay.
 */
const EditorCanvas: React.FC<EditorCanvasProps> = ({ containerWidth, containerHeight }) => {
  const doc = useEditorStore(s => s.document);
  const zoom = useEditorStore(s => s.zoom);
  const panOffset = useEditorStore(s => s.panOffset);
  const setPanOffset = useEditorStore(s => s.setPanOffset);
  const setZoom = useEditorStore(s => s.setZoom);
  const zoomIn = useEditorStore(s => s.zoomIn);
  const zoomOut = useEditorStore(s => s.zoomOut);
  const setCursorPos = useEditorStore(s => s.setCursorPos);
  const activeTool = useEditorStore(s => s.activeTool);
  const temporaryTool = useEditorStore(s => s.temporaryTool);
  const restoreTool = useEditorStore(s => s.restoreTool);
  const channelState = useEditorStore(s => s.channelState);

  const compositeRef = useRef<HTMLCanvasElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  // ── Composite render ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = compositeRef.current;
    if (!canvas || !doc) return;
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const activeId = channelState.activeChannelId;
    const builtinIds: BuiltinChannelId[] = ['composite', 'red', 'green', 'blue', 'alpha'];

    if (activeId === 'composite') {
      // Normal full-colour composite
      flattenLayers(doc.layers, doc.width, doc.height, canvas);
      return;
    }

    if (builtinIds.includes(activeId as BuiltinChannelId)) {
      // Flatten to get pixel data, then extract single channel as grayscale
      const tmp = document.createElement('canvas');
      tmp.width = doc.width; tmp.height = doc.height;
      flattenLayers(doc.layers, doc.width, doc.height, tmp);
      const srcCtx = tmp.getContext('2d', { willReadFrequently: true })!;
      const src = srcCtx.getImageData(0, 0, doc.width, doc.height);
      const dst = ctx.createImageData(doc.width, doc.height);
      const channelIndex = activeId === 'red' ? 0 : activeId === 'green' ? 1 : activeId === 'blue' ? 2 : 3;
      for (let i = 0; i < doc.width * doc.height; i++) {
        const v = src.data[i * 4 + channelIndex];
        dst.data[i * 4 + 0] = v;
        dst.data[i * 4 + 1] = v;
        dst.data[i * 4 + 2] = v;
        dst.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(dst, 0, 0);
      return;
    }

    // Custom channel
    const ch = channelState.customChannels.find(c => c.id === activeId);
    if (ch) {
      ctx.clearRect(0, 0, doc.width, doc.height);
      ctx.drawImage(ch.canvas, 0, 0);
    } else {
      // Fallback to composite if channel not found
      flattenLayers(doc.layers, doc.width, doc.height, canvas);
    }
  });

  // ── Space key for temporary hand tool ─────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !spaceDown) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setSpaceDown(true);
        temporaryTool('hand');
      }
      if (e.ctrlKey && e.key === '=') { e.preventDefault(); zoomIn(); }
      if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); setZoom(1); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(false);
        restoreTool();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [spaceDown, temporaryTool, restoreTool, zoomIn, zoomOut, setZoom]);

  // ── Wheel zoom ──────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(zoom * delta);
  }, [zoom, setZoom]);

  // ── Pan (hand tool) ────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'hand') return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  }, [activeTool, panOffset]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) {
      setPanOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
    // Update cursor position in document coordinates
    if (compositeRef.current && doc) {
      const rect = compositeRef.current.getBoundingClientRect();
      const docX = Math.round((e.clientX - rect.left) / zoom);
      const docY = Math.round((e.clientY - rect.top) / zoom);
      setCursorPos({ x: docX, y: docY });
    }
  }, [doc, zoom, setPanOffset, setCursorPos]);

  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  if (!doc) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: '#1e1e1e' }}
      >
        <div className="text-center" style={{ color: '#555' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✦</div>
          <p style={{ fontSize: 14 }}>File → Open Image  or  drag an image here</p>
        </div>
      </div>
    );
  }

  const canvasW = doc.width * zoom;
  const canvasH = doc.height * zoom;

  // Centre the canvas inside the container, then apply pan offset
  const centreX = (containerWidth - canvasW) / 2;
  const centreY = (containerHeight - canvasH) / 2;
  const translateX = centreX + panOffset.x;
  const translateY = centreY + panOffset.y;

  const cursor = activeTool === 'hand' ? 'grab' : 'default';

  return (
    <div
      className="flex-1 overflow-hidden relative select-none"
      style={{ background: '#1e1e1e', cursor, width: containerWidth, height: containerHeight }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* Checkerboard + document canvas */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${translateX}px, ${translateY}px)`,
          width: canvasW,
          height: canvasH,
        }}
      >
        {/* Transparent checkerboard background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(45deg, #3a3a3a 25%, transparent 25%),' +
              'linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),' +
              'linear-gradient(45deg, transparent 75%, #3a3a3a 75%),' +
              'linear-gradient(-45deg, transparent 75%, #3a3a3a 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            backgroundColor: '#2a2a2a',
          }}
        />

        {/* Composite canvas */}
        <canvas
          ref={compositeRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: canvasW,
            height: canvasH,
            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
          }}
        />

        {/* Tool interaction overlay */}
        <CanvasOverlay
          docWidth={doc.width}
          docHeight={doc.height}
          zoom={zoom}
        />
      </div>
    </div>
  );
};

export default EditorCanvas;
