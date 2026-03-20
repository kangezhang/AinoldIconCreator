import React, { useState, useRef, useEffect } from 'react';

export interface ToolGroupItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
}

interface ToolGroupProps {
  items: ToolGroupItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  /** When true, renders in toolbar vertical mode (dark theme) */
  vertical?: boolean;
}

const LONG_PRESS_MS = 400;

/**
 * PS-style tool group button: click to activate the current tool,
 * long-press (or hold) to open a flyout with all sub-tools.
 */
export function ToolGroup({ items, activeId, onSelect, disabled, vertical }: ToolGroupProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const currentItem = items.find(i => i.id === activeId) ?? items[0];
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    longPressedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      // Calculate position for fixed flyout (avoids overflow:hidden clipping)
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setFlyoutPos({ top: r.top, left: r.right + 4 });
      }
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearTimer();
    // Only treat as a normal click if the long-press timer never fired
    if (!longPressedRef.current) {
      setOpen(false);
      onSelect(currentItem.id);
    }
    longPressedRef.current = false;
  };

  const handlePointerCancel = () => {
    clearTimer();
    longPressedRef.current = false;
  };

  const handleSubSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node);
      const inFlyout = flyoutRef.current?.contains(e.target as Node);
      if (!inContainer && !inFlyout) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isGroupActive = items.some(i => i.id === activeId);

  if (vertical) {
    return (
      <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          disabled={disabled}
          title={`${currentItem.title} (long-press for more)`}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4, border: 'none', cursor: 'pointer',
            background: isGroupActive ? '#4a9eff22' : 'transparent',
            color: isGroupActive ? '#4a9eff' : '#aaa',
            opacity: disabled ? 0.3 : 1,
            position: 'relative', userSelect: 'none',
          }}
        >
          {currentItem.icon}
          {items.length > 1 && (
            <span style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 0, height: 0,
              borderLeft: '4px solid transparent',
              borderBottom: '4px solid #777',
              pointerEvents: 'none',
            }} />
          )}
        </button>

        {open && (
          <div ref={flyoutRef} style={{
            position: 'fixed', top: flyoutPos.top, left: flyoutPos.left,
            display: 'flex', flexDirection: 'column', gap: 2,
            background: '#2b2b2b', border: '1px solid #555',
            borderRadius: 6, padding: 4, zIndex: 9999, minWidth: 140,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => handleSubSelect(item.id)}
                disabled={item.disabled}
                title={item.title}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px',
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: item.id === activeId ? '#4a9eff22' : 'transparent',
                  color: item.id === activeId ? '#4a9eff' : '#ccc',
                  opacity: item.disabled ? 0.3 : 1,
                  fontSize: 12, whiteSpace: 'nowrap', textAlign: 'left',
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                {item.title}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Horizontal mode (original toolbar style, adapted to dark theme)
  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={disabled}
        title={`${currentItem.title} (long-press for more)`}
        className="tool-btn select-none disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          position: 'relative',
          background: isGroupActive ? '#4a9eff22' : undefined,
          color: isGroupActive ? '#4a9eff' : undefined,
        }}
      >
        {currentItem.icon}
        {items.length > 1 && (
          <span style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 0, height: 0,
            borderLeft: '4px solid transparent',
            borderBottom: '4px solid #777',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
          display: 'flex', flexDirection: 'column', gap: 2,
          background: '#2b2b2b', border: '1px solid #444',
          borderRadius: 6, padding: 4, zIndex: 100, minWidth: 36,
        }}>
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => handleSubSelect(item.id)}
              disabled={item.disabled}
              title={item.title}
              className="tool-btn"
              style={{
                background: item.id === activeId ? '#4a9eff22' : 'transparent',
                color: item.id === activeId ? '#4a9eff' : '#ccc',
                opacity: item.disabled ? 0.3 : 1,
              }}
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
