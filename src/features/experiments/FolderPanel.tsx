import { useState } from 'react';
import { renameFolder } from '../../db/helpers';
import { db } from '../../db';
import type { Folder } from '../../types';
import { buildFolderRows, moveTargets, type FolderSelection } from './folderRows';
import { createSubfolder, deleteFolderReparent, moveFolderTo } from './experimentActions';
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from './styles';

interface Props {
  folders: Folder[];
  /** Number of experiments directly in each folder. null means Unfiled. */
  counts: Map<string | null, number>;
  selection: FolderSelection;
  onSelect: (selection: FolderSelection) => void;
  /** The drop target under a dragged experiment, if any. */
  dropKey: string | null;
  onMessage: (message: string) => void;
}

type Mode = null | 'new' | 'rename' | 'move';

const ROW =
  'flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 text-left font-medium text-text active:bg-surface-2';

/**
 * Folder tree on wide screens, a dropdown on phones. Experiments are dropped on a row (any element with
 * data-folder-drop) to file them. Renames, moves, new folders and deletes act on the selected folder.
 */
export function FolderPanel({ folders, counts, selection, onSelect, dropKey, onMessage }: Props) {
  const rows = buildFolderRows(folders);
  const selected = folders.find((f) => f.id === selection) ?? null;
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>('');

  const dropProps = (key: string) => ({ 'data-folder-drop': key });
  const highlight = (key: string) =>
    dropKey === key ? 'ring-2 ring-accent bg-surface-2' : '';

  async function run(action: () => Promise<void>, success?: string) {
    try {
      await action();
      if (success) onMessage(success);
      setMode(null);
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'That did not work. Please try again.');
    }
  }

  function startMode(next: Mode) {
    setMode(next === mode ? null : next);
    setText(next === 'rename' && selected ? selected.name : '');
    setTarget('');
  }

  return (
    <nav aria-label="Folders" className="flex flex-col gap-3">
      <label className={`${LABEL} md:hidden`}>
        Folder
        <select
          className={INPUT}
          value={selection}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="all">All experiments</option>
          <option value="unfiled">Unfiled ({counts.get(null) ?? 0})</option>
          {rows.map(({ folder, depth }) => (
            <option key={folder.id} value={folder.id}>
              {`${' '.repeat(depth)}${folder.name} (${counts.get(folder.id) ?? 0})`}
            </option>
          ))}
        </select>
      </label>

      <ul className="hidden flex-col gap-1 md:flex">
        <li>
          <button
            type="button"
            aria-current={selection === 'all' ? 'true' : undefined}
            className={`${ROW} ${selection === 'all' ? 'bg-accent text-on-accent' : ''} ${highlight('all')}`}
            onClick={() => onSelect('all')}
          >
            All experiments
          </button>
        </li>
        <li>
          <button
            type="button"
            {...dropProps('unfiled')}
            aria-current={selection === 'unfiled' ? 'true' : undefined}
            className={`${ROW} ${selection === 'unfiled' ? 'bg-accent text-on-accent' : ''} ${highlight('unfiled')}`}
            onClick={() => onSelect('unfiled')}
          >
            <span>Unfiled</span>
            <span className="text-sm tabular-nums opacity-80">{counts.get(null) ?? 0}</span>
          </button>
        </li>
        {rows.map(({ folder, depth }) => (
          <li key={folder.id}>
            <button
              type="button"
              {...dropProps(folder.id)}
              aria-current={selection === folder.id ? 'true' : undefined}
              style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
              className={`${ROW} ${selection === folder.id ? 'bg-accent text-on-accent' : ''} ${highlight(folder.id)}`}
              onClick={() => onSelect(folder.id)}
            >
              <span className="truncate">{folder.name}</span>
              <span className="shrink-0 text-sm tabular-nums opacity-80">{counts.get(folder.id) ?? 0}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_SECONDARY} onClick={() => startMode('new')}>
          {selected ? 'New subfolder' : 'New folder'}
        </button>
        {selected && (
          <>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => startMode('rename')}>
              Rename
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => startMode('move')}>
              Move to
            </button>
            <button
              type="button"
              className={BUTTON_DANGER}
              onClick={() => {
                const ok = window.confirm(
                  `Delete the folder “${selected.name}”? Its subfolders move up one level and its experiments move to Unfiled. No experiments are deleted.`,
                );
                if (!ok) return;
                void run(async () => {
                  await deleteFolderReparent(selected.id, db);
                  onSelect('all');
                }, 'Folder deleted.');
              }}
            >
              Delete folder
            </button>
          </>
        )}
      </div>

      {mode === 'new' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const folder = await createSubfolder(text, selected?.id ?? null, db);
              onSelect(folder.id);
            }, 'Folder created.');
          }}
        >
          <label className={LABEL}>
            {selected ? `Subfolder of ${selected.name}` : 'Folder name'}
            <input className={INPUT} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={BUTTON_PRIMARY}>
              Create
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'rename' && selected && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => renameFolder(selected.id, text, db), 'Folder renamed.');
          }}
        >
          <label className={LABEL}>
            Folder name
            <input className={INPUT} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={BUTTON_PRIMARY}>
              Save
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'move' && selected && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => moveFolderTo(selected.id, target || null, db), 'Folder moved.');
          }}
        >
          <label className={LABEL}>
            Move “{selected.name}” under
            <select className={INPUT} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Top level</option>
              {moveTargets(folders, selected.id).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className={BUTTON_PRIMARY}>
              Move
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </nav>
  );
}
