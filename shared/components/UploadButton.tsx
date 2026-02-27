'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  onSelectFiles: () => void;
  onSelectDocuments: () => void;
  onSelectAnyFiles: () => void;
  onSelectFolder?: () => void;
  showFolderOption: boolean;
};

export default function UploadButton({
  onSelectFiles,
  onSelectDocuments,
  onSelectAnyFiles,
  onSelectFolder,
  showFolderOption,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const select = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="upload-btn-wrap" ref={ref}>
      <button className="secondary" onClick={() => setOpen((p) => !p)}>
        Upload {open ? '\u25B4' : '\u25BE'}
      </button>
      {open && (
        <div className="upload-dropdown">
          <button onClick={() => select(onSelectFiles)}>Images &amp; Media</button>
          <button onClick={() => select(onSelectDocuments)}>Documents</button>
          <button onClick={() => select(onSelectAnyFiles)}>Any Files</button>
          {showFolderOption && onSelectFolder && (
            <button onClick={() => select(onSelectFolder)}>Load Folder</button>
          )}
        </div>
      )}
    </div>
  );
}
