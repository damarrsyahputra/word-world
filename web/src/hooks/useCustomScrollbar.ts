import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Custom scrollbar model for a scrollable element.
 *
 * Tracks the thumb size & position relative to a track element, keeps it in
 * sync with scroll/resize events, and exposes pointer handlers for the
 * thumb (drag) and track (click-to-jump).
 */
export function useCustomScrollbar(scrollRef: RefObject<HTMLDivElement | null>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    active: false,
    startY: 0,
    startScrollTop: 0,
    thumbH: 0,
  });

  const [thumbH, setThumbH] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const [dragging, setDragging] = useState(false);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const isScrollable = el.scrollHeight > el.clientHeight;
    setScrollable(isScrollable);
    if (!isScrollable) return;

    const trackH = track.clientHeight;
    const ratio = el.clientHeight / el.scrollHeight;
    const height = Math.max(32, ratio * trackH);
    const maxScroll = el.scrollHeight - el.clientHeight;
    const top = maxScroll > 0 ? (el.scrollTop / maxScroll) * (trackH - height) : 0;

    setThumbH(height);
    setThumbTop(top);
  }, [scrollRef]);

  // Recalculate on scroll and whenever content size changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateThumb();
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef, updateThumb]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef, updateThumb]);

  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      active: true,
      startY: e.clientY,
      startScrollTop: scrollRef.current?.scrollTop ?? 0,
      thumbH,
    };
    setDragging(true);
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const delta = e.clientY - dragState.current.startY;
    const trackH = track.clientHeight;
    const scrollRange = el.scrollHeight - el.clientHeight;
    const thumbRange = trackH - dragState.current.thumbH;
    if (thumbRange <= 0) return;
    el.scrollTop = dragState.current.startScrollTop + (delta / thumbRange) * scrollRange;
  };

  const handleThumbPointerUp = () => {
    dragState.current.active = false;
    setDragging(false);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    // Ignore clicks that originated from the thumb itself.
    if ((e.target as HTMLElement).dataset.thumb) return;

    const rect = track.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / track.clientHeight;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  return {
    trackRef,
    thumbH,
    thumbTop,
    scrollable,
    dragging,
    updateThumb,
    handleThumbPointerDown,
    handleThumbPointerMove,
    handleThumbPointerUp,
    handleTrackClick,
  };
}