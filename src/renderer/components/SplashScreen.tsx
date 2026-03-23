import React, { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onEnter: () => void;
}

export default function SplashScreen({ onEnter }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState('/video-currency.mp4');

  useEffect(() => {
    // In packaged app, resolve splash video from extraResources
    window.mint?.getSplashVideo?.().then((path: string) => {
      if (path) setVideoSrc(`mint-media://media?path=${encodeURIComponent(path)}`);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, [videoSrc]);

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
        src={videoSrc}
        muted
        loop
        playsInline
        autoPlay
      />
      <div className="splash-overlay" />
      <div className="splash-content">
        <div className="splash-badge">THE BITCOIN CORPORATION</div>
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
