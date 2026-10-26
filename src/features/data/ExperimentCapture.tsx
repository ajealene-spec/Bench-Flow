import type { ReactNode } from 'react';
import { PlateMap } from '../samples/PlateMap';
import { EphysTable } from './EphysPanels';
import { ImagingLog } from './ImagingLog';
import { PhotoCapture } from './photos/PhotoCapture';
import { PhotoGallery } from './photos/PhotoGallery';

/**
 * Data-capture panels for a whole run: patch-clamp table, imaging log, photos and plate map.
 * Mounted once on the experiment page. Per-step entry lives in StepCapture, inside each step's data panel.
 */
export function ExperimentCapture({ experimentId, experimentName }: { experimentId: string; experimentName: string }) {
  return (
    <section aria-label="Data capture" className="flex flex-col gap-8">
      <Block title="Patch clamp">
        <EphysTable experimentId={experimentId} experimentName={experimentName} />
      </Block>
      <Block title="Imaging">
        <ImagingLog experimentId={experimentId} experimentName={experimentName} />
      </Block>
      <Block title="Photos">
        <PhotoCapture experimentId={experimentId} />
        <PhotoGallery experimentId={experimentId} />
      </Block>
      <Block title="Plate map">
        <PlateMap experimentId={experimentId} experimentName={experimentName} />
      </Block>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4  sm:p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}
