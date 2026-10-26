import { Link, useParams } from 'react-router-dom';

export function Placeholder({ title }: { title: string }) {
  const { id } = useParams();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Link
        to="/"
        className="inline-flex min-h-12 items-center rounded-lg px-3 font-medium text-accent underline dark:text-slate-300"
      >
        Back to workspace
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-400">Experiment {id} — coming in a later phase.</p>
    </main>
  );
}
