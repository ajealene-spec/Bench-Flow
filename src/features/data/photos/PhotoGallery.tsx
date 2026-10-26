import { askConfirm } from '../../../app/feedback';
import { lazy, Suspense, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { deletePhoto, listPhotos, putPhoto } from '../../../db/photos';
import type { Photo } from '../../../types';
import { BUTTON_LINK, BUTTON_SECONDARY } from '../fieldStyles';
import { AnnotationOverlay } from './AnnotationOverlay';
// The photo editor is heavy and rarely opened, so it loads on first use.
const PhotoEditor = lazy(() => import('./PhotoEditor').then((m) => ({ default: m.PhotoEditor })));
import { useObjectUrl } from './objectUrl';

const TIME = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Photos for a run, or for one step when stepId is given. Annotations are drawn over each photo. */
export function PhotoGallery({ experimentId, stepId }: { experimentId: string; stepId?: string }) {
  const all = useLiveQuery(() => listPhotos(experimentId, db), [experimentId], []);
  const photos = stepId === undefined ? all : all.filter((p) => p.stepId === stepId);
  const [editing, setEditing] = useState<Photo | undefined>(undefined);

  if (photos.length === 0) {
    return <p className="text-base text-text-muted">No photos yet.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...photos].sort((a, b) => a.at - b.at).map((photo) => (
          <PhotoTile key={photo.id} photo={photo} onEdit={() => setEditing(photo)} />
        ))}
      </ul>
      {editing && (
        <Suspense fallback={null}>
          <PhotoEditor photo={editing} onClose={() => setEditing(undefined)} />
        </Suspense>
      )}
    </>
  );
}

function PhotoTile({ photo, onEdit }: { photo: Photo; onEdit: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border p-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2">
        {url && <img src={url} alt={photo.caption || 'Recorded photo'} className="h-full w-full object-cover" />}
        <AnnotationOverlay annotations={photo.annotations} />
      </div>
      <span className="text-sm text-text-muted">{TIME.format(photo.at)}</span>
      <CaptionField photo={photo} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_SECONDARY} onClick={onEdit}>
          Annotate
        </button>
        <button
          type="button"
          className={BUTTON_LINK}
          onClick={async () => {
            if (await askConfirm({ title: 'Delete this photo?', confirmLabel: 'Delete', danger: true })) void deletePhoto(photo.id, db);
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function CaptionField({ photo }: { photo: Photo }) {
  const [value, setValue] = useState(photo.caption);
  return (
    <input
      aria-label="Photo caption"
      className="min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base"
      value={value}
      placeholder="Caption"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== photo.caption) void putPhoto({ ...photo, caption: value.trim() }, db);
      }}
    />
  );
}
