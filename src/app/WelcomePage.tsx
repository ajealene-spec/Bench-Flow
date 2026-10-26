import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { putSettings, getSettings } from '../db/settings';
import { seedStarterContent } from '../content/seed';
import { STARTER_SPECS } from '../content/protocols';
import type { ExperienceMode, ResearchField } from '../types';
import { FIELD_OPTIONS, TECHNIQUE_OPTIONS } from './welcomeOptions';
import {
  DEFAULT_ANSWERS,
  DEVICE_OPTIONS,
  answersFromSettings,
  settingsChanges,
  starterTitlesFor,
  type DeviceId,
  type StarterChoice,
  type SurveyAnswers,
} from './personalization';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium disabled:opacity-50';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY = `${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;
const OPTION =
  'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface shadow-card px-3 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent/5';
const INPUT = 'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';

const STEPS = ['name', 'field', 'experience', 'techniques', 'devices', 'starters'] as const;
type StepId = (typeof STEPS)[number];

const DEVICE_KEY = 'bench-flow.devices';

/** Devices are not part of the saved settings, so they live in this browser only. Storage can be blocked, so every access is guarded. */
function readDevices(): DeviceId[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DEVICE_KEY) ?? '[]');
    const valid = new Set<string>(DEVICE_OPTIONS.map((d) => d.value));
    return Array.isArray(parsed) ? (parsed.filter((d): d is DeviceId => typeof d === 'string' && valid.has(d))) : [];
  } catch {
    return [];
  }
}

function writeDevices(devices: DeviceId[]): void {
  try {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(devices));
  } catch {
    // Not saved: the answer only pre-fills this survey next time.
  }
}

/**
 * The personalization survey, one question per screen. Opened from the Command Center card or from Settings.
 * Answers are saved when the user finishes. "Skip survey" only marks the survey as done and keeps the current settings.
 */
export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [answers, setAnswers] = useState<SurveyAnswers>(DEFAULT_ANSWERS);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Pre-fill from saved settings. A failed read leaves the defaults in place.
  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) setAnswers(answersFromSettings(settings, readDevices()));
      })
      .catch(() => {
        if (!cancelled) setAnswers({ ...DEFAULT_ANSWERS, devices: readDevices() });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Move focus to the new question's heading, but not on the first render.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  const step: StepId = STEPS[index];
  const last = index === STEPS.length - 1;
  const update = (changes: Partial<SurveyAnswers>) => setAnswers((current) => ({ ...current, ...changes }));

  function leave() {
    navigate(from, { replace: true });
  }

  /** Marks the survey done and keeps every current setting. */
  async function skip() {
    setBusy(true);
    setError('');
    try {
      await putSettings({ onboardedAt: Date.now() });
      leave();
    } catch {
      setError('Could not save. Please try again.');
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      // Starters first: if they fail, the survey stays open so the user can retry or choose none.
      if (answers.starters !== 'none') {
        await seedStarterContent(undefined, { titles: starterTitlesFor(answers, STARTER_SPECS) });
      }
      await putSettings({ ...settingsChanges(answers), onboardedAt: Date.now() });
      writeDevices(answers.devices);
      leave();
    } catch {
      setError(
        answers.starters !== 'none'
          ? 'Could not load the starter content. Try again, or choose none.'
          : 'Could not save your choices. Please try again.',
      );
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 p-4 pt-10">
        <p className="text-text-muted">Loading your answers…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-2 pt-4">
        <span className="text-sm font-medium uppercase tracking-wide text-accent-text">Bench Flow</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Personalize Bench Flow</h1>
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex justify-between text-base text-text-muted">
            <span>
              Question {index + 1} of {STEPS.length}
            </span>
            <span>{Math.round(((index + 1) / STEPS.length) * 100)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Survey progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={index + 1}
            className="h-3 w-full overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <section aria-label="Survey question" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-6">
        <StepBody step={step} answers={answers} update={update} headingRef={headingRef} />
      </section>

      <nav aria-label="Survey navigation" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON_SECONDARY} disabled={busy || index === 0} onClick={() => setIndex((i) => i - 1)}>
            Back
          </button>
          {last ? (
            <button type="button" className={`${BUTTON_PRIMARY} flex-1 sm:flex-none`} disabled={busy} onClick={() => void finish()}>
              {busy ? 'Saving…' : 'Finish setup'}
            </button>
          ) : (
            <button type="button" className={`${BUTTON_PRIMARY} flex-1 sm:flex-none`} disabled={busy} onClick={() => setIndex((i) => i + 1)}>
              Next
            </button>
          )}
        </div>
        <button type="button" className="inline-flex min-h-12 items-center self-start px-1 text-base font-medium text-accent-text underline" disabled={busy} onClick={() => void skip()}>
          Skip survey (keep the defaults)
        </button>
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </nav>
    </main>
  );
}

function StepBody({
  step,
  answers,
  update,
  headingRef,
}: {
  step: StepId;
  answers: SurveyAnswers;
  update: (changes: Partial<SurveyAnswers>) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const heading = (text: string, hint?: string): ReactNode => (
    <div className="flex flex-col gap-1">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-text outline-none">
        {text}
      </h2>
      {hint && <p className="text-base leading-relaxed text-text-muted">{hint}</p>}
    </div>
  );

  switch (step) {
    case 'name':
      return (
        <>
          {heading('What should we call you?', 'Optional. Shown in the greeting and on comments and research packages.')}
          <label className="flex flex-col gap-1">
            <span className="sr-only">Your name</span>
            <input
              className={INPUT}
              value={answers.userName}
              maxLength={80}
              autoComplete="given-name"
              placeholder="For example Ana"
              onChange={(e) => update({ userName: e.target.value })}
            />
          </label>
        </>
      );

    case 'field':
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full">{heading('What is your field?', 'We put the most relevant protocols, tools and glossary terms first.')}</legend>
          {FIELD_OPTIONS.map((option) => (
            <label key={option.value} className={OPTION}>
              <input
                type="radio"
                name="field"
                value={option.value}
                checked={answers.field === option.value}
                onChange={() => update({ field: option.value as ResearchField })}
                className="size-5 accent-[var(--color-accent)]"
              />
              <span className="text-base text-text">{option.label}</span>
            </label>
          ))}
        </fieldset>
      );

    case 'experience':
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full">{heading('How experienced are you at the bench?', 'This sets how much guidance each step shows.')}</legend>
          {(
            [
              ['beginner', 'Beginner', 'Show more explanation and reminders with each step.'],
              ['advanced', 'Advanced', 'Keep the view lean. I know the techniques.'],
            ] as Array<[ExperienceMode, string, string]>
          ).map(([value, label, hint]) => (
            <label key={value} className={OPTION}>
              <input
                type="radio"
                name="experience"
                value={value}
                checked={answers.experience === value}
                onChange={() => update({ experience: value })}
                className="size-5 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col">
                <span className="text-base font-medium text-text">{label}</span>
                <span className="text-sm text-text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      );

    case 'techniques':
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full">{heading('Which techniques do you use?', 'Pick any. You can change this later.')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TECHNIQUE_OPTIONS.map((name) => (
              <label key={name} className={OPTION}>
                <input
                  type="checkbox"
                  checked={answers.techniques.includes(name)}
                  onChange={() =>
                    update({
                      techniques: answers.techniques.includes(name)
                        ? answers.techniques.filter((t) => t !== name)
                        : [...answers.techniques, name],
                    })
                  }
                  className="size-5 accent-[var(--color-accent)]"
                />
                <span className="text-base text-text">{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'devices':
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full">{heading('Which devices do you use?', 'Pick any. The app works on all of them.')}</legend>
          {DEVICE_OPTIONS.map((option) => (
            <label key={option.value} className={OPTION}>
              <input
                type="checkbox"
                checked={answers.devices.includes(option.value)}
                onChange={() =>
                  update({
                    devices: answers.devices.includes(option.value)
                      ? answers.devices.filter((d) => d !== option.value)
                      : [...answers.devices, option.value],
                  })
                }
                className="size-5 accent-[var(--color-accent)]"
              />
              <span className="text-base text-text">{option.label}</span>
            </label>
          ))}
        </fieldset>
      );

    case 'starters': {
      const count = (choice: StarterChoice) => starterTitlesFor({ ...answers, starters: choice }, STARTER_SPECS).length;
      const options: Array<[StarterChoice, string, string]> = [
        ['recommended', `Recommended set (${count('recommended')} protocols)`, 'The protocols that match your field and techniques, plus an example run.'],
        ['all', `All starters (${count('all')} protocols)`, 'Every starter protocol, most relevant first, plus an example run.'],
        ['none', 'None', 'Start with an empty library.'],
      ];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 w-full">{heading('Load starter protocols?', 'Starter steps are a starting point. Check them against your lab SOP.')}</legend>
          {options.map(([value, label, hint]) => (
            <label key={value} className={OPTION}>
              <input
                type="radio"
                name="starters"
                value={value}
                checked={answers.starters === value}
                onChange={() => update({ starters: value })}
                className="size-5 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col">
                <span className="text-base font-medium text-text">{label}</span>
                <span className="text-sm text-text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      );
    }
  }
}
