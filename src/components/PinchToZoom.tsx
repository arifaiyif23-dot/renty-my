import { useState, useRef, TouchEvent } from 'react';
import { cn } from '@/lib/utils';

interface PinchToZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export function PinchToZoom({ src, alt, className }: PinchToZoomProps) {
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
      initialScale.current = scale;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const newScale = initialScale.current * (currentDistance / initialDistance.current);
      setScale(Math.min(Math.max(newScale, 1), 4)); // Limit scale between 1x and 4x
    }
  };

  const handleTouchEnd = () => {
    setIsPinching(false);
    // Reset to original size if zoomed out
    if (scale < 1.1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  return (
    <div className={cn("relative overflow-hidden touch-none", className)}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-200"
        style={{
          transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      />
      
      {scale > 1 && (
        <div className="absolute top-2 right-2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
          {scale.toFixed(1)}x
        </div>
      )}
    </div>
  );
}
