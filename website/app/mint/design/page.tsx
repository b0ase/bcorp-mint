'use client';

import { useState } from 'react';
import { useMintDesigner } from '@shared/hooks/useMintDesigner';
import MintCanvas from '@shared/components/MintCanvas';
import MintPanel from './MintPanel';
import LogoDesigner from '@shared/components/LogoDesigner';

export default function DesignPage() {
  const designer = useMintDesigner();
  const [showGrid, setShowGrid] = useState(false);
  const [animatePreview, setAnimatePreview] = useState(false);
  const [showLogoDesigner, setShowLogoDesigner] = useState(false);

  return (
    <div className="mint-design-layout">
      <div className="mint-canvas-area">
        <MintCanvas
          doc={designer.doc}
          selectedLayerId={designer.selectedLayerId}
          renderToCanvas={designer.renderToCanvas}
          onSelectLayer={designer.selectLayer}
          showGrid={showGrid}
          animatePreview={animatePreview}
        />
      </div>
      <MintPanel
        doc={designer.doc}
        selectedLayer={designer.selectedLayer}
        selectedLayerId={designer.selectedLayerId}
        canUndo={designer.canUndo}
        canRedo={designer.canRedo}
        uvMode={designer.uvMode}
        onAddLayer={designer.addLayer}
        onRemoveLayer={designer.removeLayer}
        onReorderLayer={designer.reorderLayer}
        onUpdateConfig={designer.updateLayerConfig}
        onUpdateMeta={designer.updateLayerMeta}
        onUpdateTransform={designer.updateLayerTransform}
        onDuplicateLayer={designer.duplicateLayer}
        onSelectLayer={designer.selectLayer}
        onSetCanvasSize={designer.setCanvasSize}
        onSetBackgroundColor={designer.setBackgroundColor}
        onSetDocMeta={designer.setDocMeta}
        onSetUvMode={designer.setUvMode}
        onUndo={designer.undo}
        onRedo={designer.redo}
        onLoadDocument={designer.loadDocument}
        onExportPng={designer.exportPng}
        onExportBatchPng={designer.exportBatchPng}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((g) => !g)}
        animatePreview={animatePreview}
        onToggleAnimate={() => setAnimatePreview((a) => !a)}
        getThumbnailSrc={designer.getLayerThumbnailSrc}
      />
      {showLogoDesigner && (
        <LogoDesigner
          onSave={(logo) => { setShowLogoDesigner(false); }}
          onClose={() => setShowLogoDesigner(false)}
        />
      )}
    </div>
  );
}
