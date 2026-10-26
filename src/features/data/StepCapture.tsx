import type { Step } from '../../types';
import { EphysQuickForm } from './EphysPanels';
import { ImagingLog } from './ImagingLog';
import { PhotoCapture } from './photos/PhotoCapture';
import { PhotoGallery } from './photos/PhotoGallery';

/** Capture forms for one step of a run: patch-clamp cell, imaging settings and photos. */
export function StepCapture({ experimentId, step }: { experimentId: string; step: Step }) {
  return (
    <div className="flex flex-col gap-8">
      <EphysQuickForm experimentId={experimentId} stepId={step.id} />
      <ImagingLog experimentId={experimentId} stepId={step.id} />
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Photos</h3>
        <PhotoCapture experimentId={experimentId} stepId={step.id} />
        <PhotoGallery experimentId={experimentId} stepId={step.id} />
      </div>
    </div>
  );
}
