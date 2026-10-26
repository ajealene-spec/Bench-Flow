import { Link } from 'react-router-dom';

/** The Bench Flow icon and name. Links home so every page has one consistent way back. */
export function BrandWordmark() {
  return (
    <Link
      to="/"
      aria-label="Bench Flow home"
      className="inline-flex min-h-12 items-center gap-2 rounded-xl px-1 font-semibold tracking-tight text-text"
    >
      <img src="/icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className="text-lg">Bench Flow</span>
    </Link>
  );
}
