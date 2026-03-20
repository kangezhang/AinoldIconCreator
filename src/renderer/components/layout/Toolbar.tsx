import React from 'react';
import {
  MousePointer2, Hand, ZoomIn,
  Crop, Pipette, Eraser,
  RectangleHorizontal, Circle, PenLine, Brush,
  Paintbrush, PaintBucket, Pencil,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { ColorSwatches } from '../tools/ColorPicker';
import { ToolGroup } from '../ToolGroup';
import type { ActiveTool } from '../../types';

interface ToolDef {
  id: ActiveTool;
  icon: React.ReactNode;
  title: string;
  shortcut?: string;
}

const TOOLS: (ToolDef | { group: ToolDef[] })[] = [
  { id: 'move',  icon: <MousePointer2 size={16} />, title: 'Move (V)', shortcut: 'V' },
  { id: 'hand',  icon: <Hand size={16} />,          title: 'Hand (H)', shortcut: 'H' },
  { id: 'zoom',  icon: <ZoomIn size={16} />,        title: 'Zoom (Z)', shortcut: 'Z' },
  '__divider__' as any,
  {
    group: [
      { id: 'rectSelect',    icon: <RectangleHorizontal size={16} />, title: 'Rectangle Select (M)' },
      { id: 'ellipseSelect', icon: <Circle size={16} />,              title: 'Ellipse Select' },
      { id: 'lassoSelect',   icon: <PenLine size={16} />,             title: 'Lasso Select' },
      { id: 'paintSelect',   icon: <Brush size={16} />,               title: 'Paint Select' },
    ]
  },
  '__divider__' as any,
  { id: 'crop',   icon: <Crop size={16} />,      title: 'Crop (C)', shortcut: 'C' },
  '__divider__' as any,
  { id: 'brush',  icon: <Paintbrush size={16} />, title: 'Brush (B)', shortcut: 'B' },
  { id: 'eraser', icon: <Eraser size={16} />,    title: 'Eraser (E)', shortcut: 'E' },
  { id: 'fill',   icon: <PaintBucket size={16} />, title: 'Fill (G)', shortcut: 'G' },
  '__divider__' as any,
  { id: 'colorPick', icon: <Pipette size={16} />, title: 'Eyedropper (I)', shortcut: 'I' },
  {
    group: [
      { id: 'pointErase', icon: <Pencil size={16} />, title: 'Click-Erase Region' },
    ]
  },
];

export const Toolbar: React.FC = () => {
  const activeTool = useEditorStore(s => s.activeTool);
  const setActiveTool = useEditorStore(s => s.setActiveTool);
  const hasDoc = useEditorStore(s => s.document !== null);

  const isActive = (id: ActiveTool) => activeTool === id;

  return (
    <div
      style={{
        width: 44,
        background: '#323232',
        borderRight: '1px solid #3d3d3d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 2,
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {TOOLS.map((entry, idx) => {
        if (entry === '__divider__') {
          return (
            <div
              key={`div-${idx}`}
              style={{ width: 28, height: 1, background: '#3d3d3d', margin: '4px 0', flexShrink: 0 }}
            />
          );
        }

        // Group item
        if ('group' in entry) {
          const group = entry.group;
          const activeId = group.find(t => isActive(t.id))?.id ?? null;
          return (
            <ToolGroup
              key={`group-${idx}`}
              disabled={!hasDoc}
              activeId={activeId}
              onSelect={id => setActiveTool(id as ActiveTool)}
              items={group.map(t => ({ id: t.id, icon: t.icon, title: t.title }))}
              vertical
            />
          );
        }

        // Single tool button
        const tool = entry as ToolDef;
        return (
          <button
            key={tool.id}
            title={tool.title}
            disabled={!hasDoc}
            onClick={() => setActiveTool(isActive(tool.id) ? 'none' : tool.id)}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: isActive(tool.id) ? '#4a9eff22' : 'transparent',
              color: isActive(tool.id) ? '#4a9eff' : '#aaa',
              opacity: !hasDoc ? 0.3 : 1,
              transition: 'background 0.12s, color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive(tool.id)) (e.currentTarget as HTMLButtonElement).style.background = '#3a3a3a';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = isActive(tool.id) ? '#4a9eff22' : 'transparent';
            }}
          >
            {tool.icon}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Foreground / Background colours */}
      <div style={{ marginBottom: 8 }}>
        <ColorSwatches />
      </div>
    </div>
  );
};
