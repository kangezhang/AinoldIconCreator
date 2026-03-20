import React from 'react';
import { useEditorStore } from '../../store/editorStore';

export const StatusBar: React.FC = () => {
  const doc = useEditorStore(s => s.document);
  const zoom = useEditorStore(s => s.zoom);
  const cursorPos = useEditorStore(s => s.cursorPos);
  const activeTool = useEditorStore(s => s.activeTool);

  const zoomPct = Math.round(zoom * 100);

  return (
    <div style={{
      height: 22, background: '#252525', borderTop: '1px solid #3d3d3d',
      display: 'flex', alignItems: 'center', gap: 16,
      paddingLeft: 12, paddingRight: 12, flexShrink: 0,
    }}>
      {doc ? (
        <>
          <span style={{ fontSize: 11, color: '#666' }}>
            {doc.name}
          </span>
          <span style={{ fontSize: 11, color: '#555' }}>|</span>
          <span style={{ fontSize: 11, color: '#666' }}>
            {doc.width} × {doc.height}px
          </span>
          <span style={{ fontSize: 11, color: '#555' }}>|</span>
          <span style={{ fontSize: 11, color: '#888' }}>
            {zoomPct}%
          </span>
          <span style={{ fontSize: 11, color: '#555' }}>|</span>
          <span style={{ fontSize: 11, color: '#666' }}>
            {cursorPos.x}, {cursorPos.y}
          </span>
        </>
      ) : (
        <span style={{ fontSize: 11, color: '#444' }}>No document</span>
      )}
      <div style={{ flex: 1 }} />
      {activeTool !== 'none' && (
        <span style={{ fontSize: 11, color: '#555', textTransform: 'capitalize' }}>
          {activeTool}
        </span>
      )}
    </div>
  );
};
