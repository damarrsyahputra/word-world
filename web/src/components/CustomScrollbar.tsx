import type { useCustomScrollbar } from '../hooks/useCustomScrollbar';

interface CustomScrollbarProps {
  scrollbar: ReturnType<typeof useCustomScrollbar>;
}

export default function CustomScrollbar({ scrollbar }: CustomScrollbarProps) {
  const {
    trackRef,
    thumbH,
    thumbTop,
    scrollable,
    dragging,
    handleThumbPointerDown,
    handleThumbPointerMove,
    handleThumbPointerUp,
    handleTrackClick,
  } = scrollbar;

  return (
    <div className="w-2 shrink-0 relative">
      {/* Track — vertically inset by fadePx to stay within visible zone */}
      <div
        ref={trackRef}
        className="absolute inset-x-0"
        style={{ top: 48, bottom: 0 }}
        onClick={handleTrackClick}
      >
        {scrollable && (
          <div
            data-thumb="1"
            className={`absolute left-1/2 -translate-x-1/2 w-1 rounded-full transition-colors duration-150 select-none ${
              dragging
                ? 'bg-white/50 cursor-default'
                : 'bg-white/25 hover:bg-white/45 cursor-default'
            }`}
            style={{ top: thumbTop, height: thumbH }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        )}
      </div>
    </div>
  );
}