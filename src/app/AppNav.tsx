import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { featureRoutes, NAV_GROUP_LABELS, type NavGroup } from './featureRoutes';

const NAV_LINK = 'inline-flex min-h-12 items-center rounded-xl border px-4 font-medium';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${NAV_LINK} border-accent bg-accent text-white`
    : `${NAV_LINK} border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
}

const MORE_GROUPS: Array<Exclude<NavGroup, 'primary'>> = ['records', 'app'];

/** Top navigation. Primary links stay visible; everything else sits behind "More" so phones do not overflow. */
export function AppNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const primary = featureRoutes.filter((r) => r.nav?.group === 'primary');
  const moreItems = featureRoutes.filter((r) => r.nav && r.nav.group !== 'primary');
  const moreActive = moreItems.some((r) => pathname === r.path || pathname.startsWith(`${r.path}/`));

  return (
    <nav aria-label="Main" className="mx-auto flex w-full max-w-3xl flex-wrap items-start gap-2 px-4 pt-4">
      {primary.map((r) => (
        <NavLink key={r.path} to={r.path} end={r.path === '/'} className={navClass}>
          {r.nav?.label}
        </NavLink>
      ))}

      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="more-menu"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          className={`${NAV_LINK} ${moreActive ? 'border-accent bg-accent text-white' : 'border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}`}
        >
          More
        </button>
        {open && (
          <div
            id="more-menu"
            className="absolute left-0 z-30 mt-2 flex w-64 flex-col gap-1 rounded-2xl border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          >
            {MORE_GROUPS.map((group) => {
              const items = moreItems.filter((r) => r.nav?.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="flex flex-col gap-1">
                  <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {NAV_GROUP_LABELS[group]}
                  </p>
                  {items.map((r) => (
                    <NavLink
                      key={r.path}
                      to={r.path}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex min-h-12 items-center rounded-xl px-3 font-medium ${isActive ? 'bg-accent text-white' : 'text-slate-900 active:bg-slate-100 dark:text-slate-100'}`
                      }
                    >
                      {r.nav?.label}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
