import { useState } from 'react';
import { FIELD_INPUT } from '../data/fieldStyles';
import { formatValue, solveDilution, molarityToMass, CalcError, type ConcUnit, type MassUnit, type MolarUnit, type VolumeUnit } from '../assist/calcMath';
import { ACSF_RECIPE, checkOsmolarity, estimateOsmolarity, scaleRecipe, SolutionError } from './solutions';
import { PERFUSION_PRESETS, perfusionPlan, PerfusionError, type PerfusionRates } from './perfusion';
import { dilutionPlan, injectionVolumeUl, VirusError } from './virus';
import { StereotaxTool } from './StereotaxTool';
import { NumField, readNum } from './NumField';
import type { ToolId } from './toolHints';

/** Tool tiles on /tools. Each tile opens its tool below. */
export const TOOL_TILES: Array<{ id: ToolId | 'osmolarity'; title: string; blurb: string }> = [
  { id: 'stereotax', title: 'Stereotaxic helper', blurb: 'Scale AP to the skull, angled approach, saved targets, target card.' },
  { id: 'perfusion', title: 'Perfusion volumes', blurb: 'Saline and fixative volumes and pump times by body weight.' },
  { id: 'acsf', title: 'ACSF recipe', blurb: 'Grams for any volume of ACSF or cutting solution.' },
  { id: 'osmolarity', title: 'Osmolarity estimate', blurb: 'Estimate mOsm from a recipe and check it against a target.' },
  { id: 'virus', title: 'Virus titer and dilution', blurb: 'Injection volume, dilution and diluent for a target dose.' },
  { id: 'molarity', title: 'Molarity and C1V1', blurb: 'Mass for a molarity, and C1 × V1 = C2 × V2.' },
];

/** Bench tools page: a grid of tiles, with the chosen tool shown below. */
export default function ToolsPage() {
  const [active, setActive] = useState<ToolId | 'osmolarity' | null>(null);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4">
      <h1 className="text-3xl font-bold">Bench tools</h1>
      <p className="text-lg text-text-muted">Calculators for neuro and molecular work. Check every number against your protocol.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {TOOL_TILES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              aria-pressed={active === t.id}
              onClick={() => setActive(active === t.id ? null : t.id)}
              className="flex min-h-12 w-full flex-col items-start gap-1 rounded-2xl border border-border p-4 text-left"
            >
              <span className="text-lg font-semibold">{t.title}</span>
              <span className="text-base text-text-muted">{t.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      {active && (
        <section aria-label={TOOL_TILES.find((t) => t.id === active)?.title} className="rounded-2xl border border-border p-4">
          <ToolPanel id={active} />
        </section>
      )}
    </main>
  );
}

/** One tool, for the tiles page or inline in a step. */
export function ToolPanel({ id }: { id: ToolId | 'osmolarity' }) {
  switch (id) {
    case 'stereotax':
      return <StereotaxTool />;
    case 'perfusion':
      return <PerfusionTool />;
    case 'acsf':
      return <AcsfTool />;
    case 'osmolarity':
      return <OsmolarityTool />;
    case 'virus':
      return <VirusTool />;
    case 'molarity':
      return <MolarityTool />;
  }
}

function Err({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-base text-red-700 dark:text-red-300">
      {message}
    </p>
  ) : null;
}

function Out({ label, lines }: { label: string; lines: string[] }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-1 rounded-xl border border-border p-4 text-lg">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

// ---------- Perfusion ----------

function PerfusionTool() {
  const [species, setSpecies] = useState<'mouse' | 'rat' | 'custom'>('mouse');
  const [weight, setWeight] = useState('25');
  const [rates, setRates] = useState({ saline: '1', fixative: '1', flow: '3' });
  const preset = species === 'custom' ? null : PERFUSION_PRESETS[species];
  const cfg: PerfusionRates = {
    salineMlPerG: preset?.salineMlPerG ?? readNum(rates.saline) ?? NaN,
    fixativeMlPerG: preset?.fixativeMlPerG ?? readNum(rates.fixative) ?? NaN,
    flowMlPerMin: readNum(rates.flow),
  };
  let lines: string[] = [];
  let error: string | null = null;
  try {
    const w = readNum(weight);
    if (w === undefined) throw new PerfusionError('Enter the body weight in grams');
    const p = perfusionPlan(w, cfg);
    lines = [`Saline or PBS: ${p.salineMl} mL${p.salineMin !== undefined ? ` (about ${p.salineMin} min)` : ''}`, `Fixative: ${p.fixativeMl} mL${p.fixativeMin !== undefined ? ` (about ${p.fixativeMin} min)` : ''}`, `Total: ${p.totalMl} mL`];
  } catch (e) {
    error = e instanceof PerfusionError ? e.message : 'Check the numbers.';
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">Perfusion volumes</h3>
      <label className="flex flex-col gap-1 text-base font-medium">
        Species
        <select className={FIELD_INPUT} value={species} onChange={(e) => setSpecies(e.target.value as 'mouse' | 'rat' | 'custom')}>
          <option value="mouse">Mouse</option>
          <option value="rat">Rat</option>
          <option value="custom">Custom rates</option>
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="pf-weight" label="Body weight" unit="g" value={weight} onChange={setWeight} />
        {species === 'custom' && (
          <>
            <NumField id="pf-saline" label="Saline rate" unit="mL/g" value={rates.saline} onChange={(v) => setRates({ ...rates, saline: v })} />
            <NumField id="pf-fix" label="Fixative rate" unit="mL/g" value={rates.fixative} onChange={(v) => setRates({ ...rates, fixative: v })} />
          </>
        )}
        <NumField id="pf-flow" label="Pump flow (optional)" unit="mL/min" value={rates.flow} onChange={(v) => setRates({ ...rates, flow: v })} />
      </div>
      <Err message={error} />
      {!error && <Out label="Perfusion volumes" lines={lines} />}
      <p className="text-sm text-text-muted">Starting values only. Use the volumes and flow in your approved protocol.</p>
    </div>
  );
}

// ---------- ACSF ----------

function AcsfTool() {
  const [volume, setVolume] = useState('1');
  const [scale, setScale] = useState('1');
  const [mM, setMM] = useState<Record<string, string>>(() => Object.fromEntries(ACSF_RECIPE.map((c) => [c.id, String(c.mM)])));
  let lines: string[] = [];
  let error: string | null = null;
  try {
    const v = readNum(volume);
    const s = readNum(scale) ?? 1;
    if (v === undefined) throw new SolutionError('Enter the volume in liters');
    const comps = ACSF_RECIPE.map((c) => ({ ...c, mM: readNum(mM[c.id]) ?? c.mM }));
    lines = scaleRecipe(comps, v, s).map((c) => `${c.name}: ${c.grams} g (${round(c.mM)} mM)`);
  } catch (e) {
    error = e instanceof SolutionError ? e.message : 'Check the numbers.';
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">ACSF recipe</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="ac-vol" label="Final volume" unit="L" value={volume} onChange={setVolume} />
        <NumField id="ac-scale" label="Scale all concentrations" unit="×" value={scale} onChange={setScale} />
      </div>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Components (mM, editable)</legend>
        {ACSF_RECIPE.map((c) => (
          <NumField key={c.id} id={`ac-${c.id}`} label={c.name} unit="mM" value={mM[c.id]} onChange={(v) => setMM({ ...mM, [c.id]: v })} />
        ))}
      </fieldset>
      <Err message={error} />
      {!error && <Out label="Grams to weigh" lines={lines} />}
      <p className="text-sm text-text-muted">Use the hydrate listed on your bottle. Add CaCl₂ and MgCl₂ last, from separate stocks if you use them.</p>
    </div>
  );
}

/** Three significant figures, so small masses such as 0.00042 g still show. */
function round(n: number): string {
  return formatValue(n);
}

// ---------- Osmolarity ----------

function OsmolarityTool() {
  const [mM, setMM] = useState<Record<string, string>>(() => Object.fromEntries(ACSF_RECIPE.map((c) => [c.id, String(c.mM)])));
  const [coef, setCoef] = useState('0.9');
  const [target, setTarget] = useState('300');
  const [measured, setMeasured] = useState('');
  let lines: string[] = [];
  let error: string | null = null;
  try {
    const comps = ACSF_RECIPE.map((c) => ({ ...c, mM: readNum(mM[c.id]) ?? 0 }));
    const est = estimateOsmolarity(comps, readNum(coef) ?? 1);
    const check = checkOsmolarity(est, readNum(target) ?? 300, 10);
    lines = [`Estimated: ${est} mOsm`, `Target ${check.target} ± ${check.tolerance}: ${check.inRange ? 'in range' : `out of range by ${check.difference > 0 ? '+' : ''}${check.difference}`}`];
    const m = readNum(measured);
    if (m !== undefined) lines.push(`Measured: ${m} mOsm (${m - check.target > 0 ? '+' : ''}${(m - check.target).toFixed(1)} from target)`);
  } catch (e) {
    error = e instanceof SolutionError ? e.message : 'Check the numbers.';
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">Osmolarity estimate</h3>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 text-base font-semibold">Components (mM)</legend>
        {ACSF_RECIPE.map((c) => (
          <NumField key={c.id} id={`os-${c.id}`} label={c.name} unit="mM" value={mM[c.id]} onChange={(v) => setMM({ ...mM, [c.id]: v })} />
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <NumField id="os-coef" label="Osmotic coefficient" value={coef} onChange={setCoef} />
        <NumField id="os-target" label="Target" unit="mOsm" value={target} onChange={setTarget} />
        <NumField id="os-measured" label="Measured (optional)" unit="mOsm" value={measured} onChange={setMeasured} />
      </div>
      <Err message={error} />
      {!error && <Out label="Osmolarity" lines={lines} />}
      <p className="text-sm text-text-muted">Sum of mM × particles, times an osmotic coefficient (about 0.9 for physiological salts). A rough estimate; measure to confirm.</p>
    </div>
  );
}

// ---------- Virus ----------

function VirusTool() {
  const [titer, setTiter] = useState('1e13');
  const [dose, setDose] = useState('1e9');
  const [inj, setInj] = useState('1');
  const [final, setFinal] = useState('');
  let lines: string[] = [];
  let warning: string | undefined;
  let error: string | null = null;
  try {
    const t = readNum(titer);
    const d = readNum(dose);
    const v = readNum(inj);
    if (t === undefined || d === undefined || v === undefined) throw new VirusError('Enter the titer, dose and injection volume');
    const f = readNum(final);
    const plan = dilutionPlan({ stockTiterVgPerMl: t, doseVg: d, injectionVolumeUl: v, finalVolumeUl: f });
    lines = [
      `Undiluted stock for this dose: ${round(injectionVolumeUl(t, d))} µL`,
      `Needed concentration: ${plan.neededVgPerMl.toExponential(2)} vg/mL`,
      `Dilution: ${plan.foldDilution}-fold`,
      `Take ${plan.stockUl} µL stock + ${plan.diluentUl} µL diluent (final ${plan.finalVolumeUl} µL)`,
    ];
    warning = plan.warning;
  } catch (e) {
    error = e instanceof VirusError ? e.message : 'Check the numbers. Use 1e13 for 1 × 10¹³.';
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">Virus titer and dilution</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="vi-titer" label="Stock titer" unit="vg/mL" value={titer} onChange={setTiter} />
        <NumField id="vi-dose" label="Target dose" unit="vg" value={dose} onChange={setDose} />
        <NumField id="vi-inj" label="Injection volume" unit="µL" value={inj} onChange={setInj} />
        <NumField id="vi-final" label="Final volume (optional)" unit="µL" value={final} onChange={setFinal} />
      </div>
      <Err message={error} />
      {warning && <p role="status" className="text-base">{warning}</p>}
      {!error && <Out label="Virus dilution plan" lines={lines} />}
    </div>
  );
}

// ---------- Molarity and C1V1 ----------

const CONC_UNITS: ConcUnit[] = ['M', 'mM', 'µM', 'nM'];
const VOL_UNITS: VolumeUnit[] = ['L', 'mL', 'µL'];
const MASS_UNITS: MassUnit[] = ['g', 'mg', 'µg', 'ng'];

function MolarityTool() {
  return (
    <div className="flex flex-col gap-8">
      <MassForm />
      <DilutionForm />
    </div>
  );
}

function MassForm() {
  const [conc, setConc] = useState('10');
  const [unit, setUnit] = useState<MolarUnit>('mM');
  const [vol, setVol] = useState('50');
  const [volUnit, setVolUnit] = useState<VolumeUnit>('mL');
  const [mw, setMw] = useState('180.16');
  const [massUnit, setMassUnit] = useState<MassUnit>('mg');
  let out: string | null = null;
  let error: string | null = null;
  try {
    const c = readNum(conc);
    const v = readNum(vol);
    const m = readNum(mw);
    if (c === undefined || v === undefined || m === undefined) throw new CalcError('Fill in concentration, volume and molecular weight');
    out = `${round(molarityToMass({ molarity: c, molarityUnit: unit, volume: v, volumeUnit: volUnit, mw: m, massUnit }))} ${massUnit} to weigh`;
  } catch (e) {
    error = e instanceof CalcError ? e.message : 'Check the numbers.';
  }
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">Mass for a molarity</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="mo-c" label="Concentration" value={conc} onChange={setConc} />
        <label className="flex flex-col gap-1 text-base font-medium">
          Unit
          <select className={FIELD_INPUT} value={unit} onChange={(e) => setUnit(e.target.value as MolarUnit)}>
            {CONC_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <NumField id="mo-v" label="Volume" value={vol} onChange={setVol} />
        <label className="flex flex-col gap-1 text-base font-medium">
          Volume unit
          <select className={FIELD_INPUT} value={volUnit} onChange={(e) => setVolUnit(e.target.value as VolumeUnit)}>
            {VOL_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <NumField id="mo-mw" label="Molecular weight" unit="g/mol" value={mw} onChange={setMw} />
        <label className="flex flex-col gap-1 text-base font-medium">
          Show mass in
          <select className={FIELD_INPUT} value={massUnit} onChange={(e) => setMassUnit(e.target.value as MassUnit)}>
            {MASS_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <Err message={error} />
      {out && <Out label="Mass result" lines={[out]} />}
    </div>
  );
}

function DilutionForm() {
  const [f, setF] = useState<{ c1: string; c1u: ConcUnit; v1: string; v1u: VolumeUnit; c2: string; c2u: ConcUnit; v2: string; v2u: VolumeUnit }>({ c1: '10', c1u: 'mM', v1: '', v1u: 'µL', c2: '100', c2u: 'µM', v2: '1', v2u: 'mL' });
  const [blank, setBlank] = useState<'c1' | 'v1' | 'c2' | 'v2'>('v1');
  const vals = { c1: f.c1, v1: f.v1, c2: f.c2, v2: f.v2 };
  let out: string | null = null;
  let error: string | null = null;
  try {
    const input = {
      c1: blank === 'c1' ? null : readNum(vals.c1 ?? '') ?? null,
      c1Unit: f.c1u,
      v1: blank === 'v1' ? null : readNum(vals.v1) ?? null,
      v1Unit: f.v1u,
      c2: blank === 'c2' ? null : readNum(vals.c2) ?? null,
      c2Unit: f.c2u,
      v2: blank === 'v2' ? null : readNum(vals.v2) ?? null,
      v2Unit: f.v2u,
    };
    const r = solveDilution(input);
    out = `${blank.toUpperCase()} = ${round(r.value)} ${r.unit}`;
    if (r.warning) out += ` (${r.warning})`;
  } catch (e) {
    error = e instanceof CalcError ? e.message : 'Check the numbers.';
  }
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">C1 × V1 = C2 × V2</h3>
      <p className="text-base text-text-muted">Leave one value empty (choose it below) and the rest are filled from the others.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <NumField id="dl-c1" label="C1 (stock)" value={f.c1} onChange={(v) => set('c1', v)} />
        <label className="flex flex-col gap-1 text-base font-medium">Unit<select className={FIELD_INPUT} value={f.c1u} onChange={(e) => set('c1u', e.target.value as ConcUnit)}>{CONC_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <NumField id="dl-v1" label="V1 (stock to take)" value={f.v1} onChange={(v) => set('v1', v)} />
        <label className="flex flex-col gap-1 text-base font-medium">Unit<select className={FIELD_INPUT} value={f.v1u} onChange={(e) => set('v1u', e.target.value as VolumeUnit)}>{VOL_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <NumField id="dl-c2" label="C2 (final)" value={f.c2} onChange={(v) => set('c2', v)} />
        <label className="flex flex-col gap-1 text-base font-medium">Unit<select className={FIELD_INPUT} value={f.c2u} onChange={(e) => set('c2u', e.target.value as ConcUnit)}>{CONC_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <NumField id="dl-v2" label="V2 (final volume)" value={f.v2} onChange={(v) => set('v2', v)} />
        <label className="flex flex-col gap-1 text-base font-medium">Unit<select className={FIELD_INPUT} value={f.v2u} onChange={(e) => set('v2u', e.target.value as VolumeUnit)}>{VOL_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
      </div>
      <label className="flex flex-col gap-1 text-base font-medium">
        Solve for
        <select className={FIELD_INPUT} value={blank} onChange={(e) => setBlank(e.target.value as typeof blank)}>
          <option value="c1">C1</option>
          <option value="v1">V1</option>
          <option value="c2">C2</option>
          <option value="v2">V2</option>
        </select>
      </label>
      <Err message={error} />
      {out && <Out label="Dilution result" lines={[out]} />}
    </div>
  );
}
