import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { getExperiment } from '../db/helpers';

/**
 * Old import route for an experiment. Procedures now belong to templates, so "re-import" means
 * editing the experiment's template. An experiment without a template goes to the new-protocol page.
 */
export default function ExperimentImportRedirect() {
  const { id = '' } = useParams();
  const experiment = useLiveQuery(() => getExperiment(id, db), [id]);

  if (experiment === undefined) return <main className="p-6 text-slate-500">Loading…</main>;
  if (experiment === null) return <Navigate to="/" replace />;
  if (experiment.templateId) return <Navigate to={`/library/${experiment.templateId}`} replace />;
  return <Navigate to="/library/new" replace />;
}
