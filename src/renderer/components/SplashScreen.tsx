import React, { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onEnter: () => void;
}

export default function SplashScreen({ onEnter }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Try to play video on mount
    videoRef.current?.play().catch(() => {});
  }, []);

  const handleEnter = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      onEnter();
    }, 600);
  };

  // Also allow keyboard enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleEnter();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${fading ? 'fading' : ''}`} onClick={handleEnter}>
      <video
        ref={videoRef}
        className="splash-video"
        src="/video-rosette.mp4"
        muted
        loop
        playsInline
        autoPlay
      />
      <div className="splash-overlay" />
      <div className="splash-content">
        <div className="splash-badge">The Bitcoin Corporation</div>
        <h1 className="splash-title">Mint</h1>
        <div className="splash-tagline">Design. Print. Stamp. Mint.</div>
        <button className="splash-enter" onClick={handleEnter}>
          Enter
        </button>
      </div>
      <div className="splash-footer">
        <span>Press Enter or click anywhere</span>
      </div>
    </div>
  );
}
