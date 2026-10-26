import { useRef, useState } from 'react';
import { db } from '../../../db';
import { putPhoto } from '../../../db/photos';
import { newId } from '../../../db/helpers';
import { BUTTON_PRIMARY } from '../fieldStyles';
import { thumbnailForFile } from './thumbnail';

/**
 * Camera or file picker for photos. On phones and tablets `capture="environment"` opens the back camera;
 * on a laptop it opens the file picker. Each photo is stored as a blob in IndexedDB, so it works offline.
 */
export function PhotoCapture({ experimentId, stepId }: { experimentId: string; stepId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSaving(true);
    setError(undefined);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setError('Only image files can be added.');
          continue;
        }
        // The thumbnail is best effort: a photo that cannot be decoded is still saved at full size.
        const thumbnail = await thumbnailForFile(file);
        await putPhoto(
          { id: newId(), experimentId, stepId, blob: file, ...(thumbnail ? { thumbnail } : {}), annotations: [], caption: '', at: Date.now() },
          db,
        );
      }
    } catch {
      setError('The photo could not be saved. Free some storage and try again.');
    } finally {
      setSaving(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={`${BUTTON_PRIMARY} w-full cursor-pointer sm:w-fit ${saving ? 'opacity-60' : ''}`}>
        {saving ? 'Saving…' : 'Take or choose photo'}
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          disabled={saving}
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      {error && <p role="alert" className="text-base text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}
