import { Link, useParams } from 'react-router-dom';

export function Placeholder({ title }: { title: string }) {
  const { id } = useParams();
  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <Link
        to="/"
        className="inline-flex min-h-12 items-center rounded-lg px-3 font-medium text-accent-text underline"
      >
        Back to workspace
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-text-muted">Experiment {id} — coming in a later phase.</p>
    </main>
  );
}
