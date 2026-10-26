import { Link } from 'react-router-dom';

/** Public privacy policy. Reachable without onboarding and not behind the first-visit redirect. */
export const PRIVACY_ISSUES_URL = 'https://github.com/ajealene-spec/Bench-Flow/issues';

const CARD = 'flex flex-col gap-3 rounded-2xl border border-border bg-surface shadow-card p-4 sm:p-6';

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-4 pb-12 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text">Privacy</h1>
        <p className="text-text-muted">Last updated 26 October 2026. Written in plain language.</p>
      </header>

      <section aria-labelledby="privacy-device" className={CARD}>
        <h2 id="privacy-device" className="text-lg font-semibold text-text">Your data stays on your device</h2>
        <p className="text-text">
          Bench Flow saves your protocols, experiments, notes, photos and settings in the device's local database
          (IndexedDB). There is no account to create or sign in to, and we do not copy your lab records to a server.
        </p>
      </section>

      <section aria-labelledby="privacy-tracking" className={CARD}>
        <h2 id="privacy-tracking" className="text-lg font-semibold text-text">No tracking or analytics</h2>
        <p className="text-text">
          Bench Flow has no advertising, analytics or tracking code. It does not follow you between apps or sites.
        </p>
      </section>

      <section aria-labelledby="privacy-ai" className={CARD}>
        <h2 id="privacy-ai" className="text-lg font-semibold text-text">Optional AI features</h2>
        <p className="text-text">
          The AI features are optional. If you add your own Anthropic API key, the protocol text you ask about is sent
          to Anthropic so it can answer. The request goes through the Bench Flow server, which passes it on and does
          not store your text or your key. Anthropic handles the request under its own terms. Without a key, these
          features stay off and the app works without them.
        </p>
      </section>

      <section aria-labelledby="privacy-protocols" className={CARD}>
        <h2 id="privacy-protocols" className="text-lg font-semibold text-text">Optional protocols.io imports</h2>
        <p className="text-text">
          The app contacts protocols.io only when you ask it to import a protocol, and only for the protocol you
          name.
        </p>
      </section>

      <section aria-labelledby="privacy-device-features" className={CARD}>
        <h2 id="privacy-device-features" className="text-lg font-semibold text-text">Notifications, microphone and camera</h2>
        <p className="text-text">
          Timer alerts are notifications created on your device. The app asks for permission before it sends them.
          The microphone and camera are used only when you use the feature that needs them.
        </p>
      </section>

      <section aria-labelledby="privacy-contact" className={CARD}>
        <h2 id="privacy-contact" className="text-lg font-semibold text-text">Questions</h2>
        <p className="text-text">
          Open an issue on the{' '}
          <a className="text-accent-text underline" href={PRIVACY_ISSUES_URL} target="_blank" rel="noreferrer">
            GitHub issues page
          </a>
          . You can also read this policy in the project's <code>docs/PRIVACY.md</code>.
        </p>
      </section>

      <p>
        <Link to="/" className="text-accent-text underline">Back to Home</Link>
      </p>
    </main>
  );
}
