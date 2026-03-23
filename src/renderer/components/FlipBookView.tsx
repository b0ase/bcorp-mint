import React, { useCallback, useEffect, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import type { LogoAsset, Spread } from '../lib/types';

type FlipBookViewProps = {
  spreads: Spread[];
  logos: LogoAsset[];
  activeIndex: number;
  onPageChange: (index: number) => void;
};

const spreadImages = (spread: Spread) =>
  spread.type === 'portrait-pair' ? [spread.left, spread.right] : [spread.image];

const Page = React.forwardRef<HTMLDivElement, { src: string; alt: string }>(
  ({ src, alt }, ref) => (
    <div className="flipbook-page" ref={ref}>
      <img src={src} alt={alt} />
    </div>
  )
);

export default function FlipBookView({ spreads, logos, activeIndex, onPageChange }: FlipBookViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 400, height: 560 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const pageWidth = Math.floor(Math.min(width * 0.45, height * 0.65));
        const pageHeight = Math.floor(pageWidth * 1.4);
        setSize({ width: Math.max(100, pageWidth), height: Math.max(140, pageHeight) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sync external page changes to the flipbook
  useEffect(() => {
    const flipBook = bookRef.current;
    if (!flipBook) return;
    const pageFlip = flipBook.pageFlip();
    if (pageFlip && pageFlip.getCurrentPageIndex() !== activeIndex) {
      pageFlip.turnToPage(activeIndex);
    }
  }, [activeIndex]);

  const handleFlip = useCallback((e: any) => {
    onPageChange(e.data);
  }, [onPageChange]);

  // Build flat page list — each spread becomes one page
  const pages: { key: string; src: string; alt: string }[] = [];
  for (let i = 0; i < spreads.length; i++) {
    const imgs = spreadImages(spreads[i]);
    // Use first image of spread as the page image
    pages.push({
      key: `page-${i}`,
      src: imgs[0].url,
      alt: imgs[0].name,
    });
  }

  if (pages.length === 0) {
    return (
      <div className="flipbook-wrapper" ref={containerRef}>
        <div className="canvas-placeholder">
          <div className="pill">No pages to display</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flipbook-wrapper" ref={containerRef}>
      {/* @ts-ignore - react-pageflip typing issues */}
      <HTMLFlipBook
        ref={bookRef}
        width={size.width}
        height={size.height}
        size="fixed"
        minWidth={100}
        maxWidth={800}
        minHeight={140}
        maxHeight={1120}
        showCover={true}
        mobileScrollSupport={true}
        onFlip={handleFlip}
        flippingTime={600}
        useMouseEvents={true}
        startPage={activeIndex}
        drawShadow={true}
        maxShadowOpacity={0.4}
        className="flipbook-inner"
      >
        {pages.map((p) => (
          <Page key={p.key} src={p.src} alt={p.alt} />
        ))}
      </HTMLFlipBook>
    </div>
  );
}
