import React, { useState, useRef, useCallback, useEffect } from 'react';

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
}

const LONG_PRESS_MS = 400;

/**
 * PS-style tool group button: click to activate the current tool,
 * long-press (or hold) to open a flyout with all sub-tools.
 */
export function ToolGroup({ items, activeId, onSelect, disabled }: ToolGroupProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The "current" item shown on the main button: prefer the active one, else first
  const currentItem = items.find(i => i.id === activeId) ?? items[0];

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
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearTimer();
    if (!longPressedRef.current && !open) {
      // Short click: toggle current item
      onSelect(currentItem.id === activeId ? 'none' : currentItem.id);
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

  // Close flyout on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isGroupActive = items.some(i => i.id === activeId);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      {/* Main button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        disabled={disabled}
        title={`${currentItem.title} (long-press for more)`}
        className={`tool-btn select-none disabled:opacity-50 disabled:cursor-not-allowed ${isGroupActive ? 'ring-2 ring-blue-400' : ''}`}
      >
        {currentItem.icon}
        {/* Small triangle indicator (more tools available) */}
        <span className="absolute bottom-0.5 right-0.5 w-0 h-0 border-l-[4px] border-l-transparent border-b-[4px] border-b-gray-400 pointer-events-none" />
      </button>

      {/* Flyout */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-1 bg-white border border-gray-200 rounded-lg shadow-xl p-1 z-50 min-w-[40px]">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => handleSubSelect(item.id)}
              disabled={item.disabled}
              title={item.title}
              className={`tool-btn w-full disabled:opacity-50 disabled:cursor-not-allowed ${item.id === activeId ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
