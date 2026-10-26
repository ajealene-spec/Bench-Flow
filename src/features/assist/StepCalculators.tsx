import { useMemo, useState, type ReactNode } from 'react';
import { addStepRecord } from '../../db/helpers';
import type { Step } from '../../types';
import {
  CalcError,
  MASS_CONC_UNITS,
  MASS_UNITS,
  MOLAR_UNITS,
  VOLUME_UNITS,
  antibodyDilution,
  formatValue,
  masterMix,
  massToMolarity,
  molarityToMass,
  parseAmount,
  percentSolute,
  proteinLoad,
  serialDilution,
  solveDilution,
  type ConcUnit,
  type DilutionField,
  type MassConcUnit,
  type MassUnit,
  type VolumeUnit,
  type MolarUnit,
} from './calcMath';
import { CALC_LABELS, detectCalcs, type CalcKind, type DetectedCalc } from './detectCalcs';

/*
 * "Calculator" cards for one step. Detected calculators are prefilled from the step text; any
 * calculator can also be added by hand from the "+ Calculator" menu. "Save to step" stores the
 * main result as a number record on the experiment, so it appears in the run's data summary.
 *
 * Mount with the step id as a key (done here) so inputs reset when the user moves to another step.
 */

type Prefill<K extends CalcKind> = Extract<DetectedCalc, { kind: K }>['prefill'];

const ALL_CONC_UNITS: ConcUnit[] = ['X', '%', ...MOLAR_UNITS, ...MASS_CONC_UNITS];

const FIELD_INPUT =
  'min-h-12 w-full min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const UNIT_SELECT =
  'min-h-12 rounded-xl border border-slate-300 bg-white px-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';
const BUTTON =
  'inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-900 active:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const BUTTON_PRIMARY =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-4 text-base font-medium text-white active:bg-teal-800 disabled:opacity-40 dark:bg-teal-500 dark:text-slate-950';

// ---------- Shared pieces ----------

interface Saveable {
  label: string;
  value: number;
  unit: string;
  note: string;
}

interface Computed<T> {
  result?: T;
  error?: string;
}

function compute<T>(fn: () => T): Computed<T> {
  try {
    return { result: fn() };
  } catch (err) {
    return { error: err instanceof CalcError ? err.message : 'Check the numbers in this calculator.' };
  }
}

/** Reads a required number from a text input. Throws CalcError with the field name when it is empty. */
function need(name: string, text: string): number {
  const n = parseAmount(text);
  if (n === undefined) throw new CalcError(`Enter ${name}`);
  return n;
}

/** Like need, but returns null for an empty field, which the solver treats as the unknown. */
function optional(text: string): number | null {
  return parseAmount(text) ?? null;
}

function NumberField({
  label,
  value,
  onChange,
  units,
  unit,
  onUnit,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  units?: readonly string[];
  unit?: string;
  onUnit?: (unit: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <span className="flex items-stretch gap-2">
        <input
          className={FIELD_INPUT}
          inputMode="decimal"
          autoComplete="off"
          value={disabled ? '' : value}
          placeholder={disabled ? 'solved' : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {units && unit !== undefined && onUnit && (
          <select className={UNIT_SELECT} value={unit} onChange={(e) => onUnit(e.target.value)} aria-label={`${label} unit`}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </span>
    </label>
  );
}

function ResultLine({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-2 last:border-b-0 dark:border-slate-700">
      <span className="text-base text-slate-700 dark:text-slate-300">{label}</span>
      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {formatValue(value)} {unit}
      </span>
    </div>
  );
}

function Results({ children, error }: { children?: ReactNode; error?: string }) {
  return (
    <div aria-live="polite" className="rounded-xl bg-slate-50 px-3 py-1 dark:bg-slate-800">
      {error ? (
        <p className="py-2 text-base text-amber-700 dark:text-amber-300">{error}</p>
      ) : (
        children ?? <p className="py-2 text-base text-slate-500">Enter numbers to see the result.</p>
      )}
    </div>
  );
}

function SaveRow({ saveable, experimentId, stepId }: { saveable: Saveable | null; experimentId: string; stepId: string }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  async function save() {
    if (!saveable) return;
    setStatus('saving');
    try {
      await addStepRecord({
        experimentId,
        stepId,
        kind: 'number',
        label: saveable.label,
        value: saveable.value,
        unit: saveable.unit,
        note: saveable.note,
      });
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={BUTTON_PRIMARY} disabled={!saveable || status === 'saving'} onClick={save}>
        Save to step
      </button>
      <span role="status" className="text-sm text-slate-600 dark:text-slate-400">
        {status === 'saved' && 'Saved to this step.'}
        {status === 'failed' && 'Could not save. Try again.'}
      </span>
    </div>
  );
}

// ---------- Calculators ----------

function DilutionCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'dilution'>; stepId: string; experimentId: string }) {
  const [c1, setC1] = useState(prefill?.c1 !== undefined ? String(prefill.c1) : '');
  const [c1Unit, setC1Unit] = useState<ConcUnit>(prefill?.c1Unit ?? 'X');
  const [v1, setV1] = useState('');
  const [v1Unit, setV1Unit] = useState<VolumeUnit>('mL');
  const [c2, setC2] = useState(prefill?.c2 !== undefined ? String(prefill.c2) : '');
  const [c2Unit, setC2Unit] = useState<ConcUnit>(prefill?.c2Unit ?? 'X');
  const [v2, setV2] = useState(prefill?.v2 !== undefined ? String(prefill.v2) : '');
  const [v2Unit, setV2Unit] = useState<VolumeUnit>(prefill?.v2Unit ?? 'mL');
  const [solveFor, setSolveFor] = useState<DilutionField>('v1');

  const computed = compute(() =>
    solveDilution({
      c1: solveFor === 'c1' ? null : optional(c1),
      c1Unit,
      v1: solveFor === 'v1' ? null : optional(v1),
      v1Unit,
      c2: solveFor === 'c2' ? null : optional(c2),
      c2Unit,
      v2: solveFor === 'v2' ? null : optional(v2),
      v2Unit,
    }),
  );
  const r = computed.result;
  const fieldNames: Record<DilutionField, string> = {
    c1: 'stock concentration (C1)',
    v1: 'stock volume (V1)',
    c2: 'final concentration (C2)',
    v2: 'final volume (V2)',
  };
  const saveable: Saveable | null = r
    ? {
        label: `Dilution: ${fieldNames[r.field]}`,
        value: r.value,
        unit: r.unit,
        note: `C1V1 = C2V2, solved for ${r.field.toUpperCase()}. Inputs: C1 ${solveFor === 'c1' ? 'solved' : `${c1} ${c1Unit}`}, V1 ${solveFor === 'v1' ? 'solved' : `${v1} ${v1Unit}`}, C2 ${solveFor === 'c2' ? 'solved' : `${c2} ${c2Unit}`}, V2 ${solveFor === 'v2' ? 'solved' : `${v2} ${v2Unit}`}.`,
      }
    : null;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Solve for</span>
        <select className={`${FIELD_INPUT} flex-none`} value={solveFor} onChange={(e) => setSolveFor(e.target.value as DilutionField)}>
          <option value="v1">V1, volume of stock</option>
          <option value="c1">C1, stock concentration</option>
          <option value="c2">C2, final concentration</option>
          <option value="v2">V2, final volume</option>
        </select>
      </label>
      <NumberField label="C1 stock" value={c1} onChange={setC1} disabled={solveFor === 'c1'} units={ALL_CONC_UNITS} unit={c1Unit} onUnit={(u) => setC1Unit(u as ConcUnit)} />
      <NumberField label="V1 stock volume" value={v1} onChange={setV1} disabled={solveFor === 'v1'} units={VOLUME_UNITS} unit={v1Unit} onUnit={(u) => setV1Unit(u as VolumeUnit)} />
      <NumberField label="C2 final" value={c2} onChange={setC2} disabled={solveFor === 'c2'} units={ALL_CONC_UNITS} unit={c2Unit} onUnit={(u) => setC2Unit(u as ConcUnit)} />
      <NumberField label="V2 final volume" value={v2} onChange={setV2} disabled={solveFor === 'v2'} units={VOLUME_UNITS} unit={v2Unit} onUnit={(u) => setV2Unit(u as VolumeUnit)} />
      <Results error={computed.error}>
        {r && (
          <>
            <ResultLine label={`Solved: ${fieldNames[r.field]}`} value={r.value} unit={r.unit} />
            {r.warning && <p className="py-2 text-sm text-amber-700 dark:text-amber-300">{r.warning}</p>}
          </>
        )}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

function AntibodyCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'antibody'>; stepId: string; experimentId: string }) {
  const [ratio, setRatio] = useState(prefill ? String(prefill.ratio) : '1000');
  const [finalVolume, setFinalVolume] = useState(prefill ? String(prefill.finalVolume) : '10');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(prefill?.volumeUnit ?? 'mL');
  const [outUnit, setOutUnit] = useState<VolumeUnit>('µL');
  const label = prefill?.label ?? 'Antibody volume';

  const computed = compute(() =>
    antibodyDilution({ ratio: need('the dilution ratio N', ratio), finalVolume: need('a final volume', finalVolume), volumeUnit, outUnit }),
  );
  const r = computed.result;
  const saveable: Saveable | null = r
    ? {
        label,
        value: r.antibodyVolume,
        unit: outUnit,
        note: `1:${ratio} in ${finalVolume} ${volumeUnit}: antibody = final volume / N; diluent ${formatValue(r.diluentVolume)} ${outUnit}.`,
      }
    : null;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dilution 1:N</span>
        <span className="flex items-stretch gap-2">
          <span className="flex min-h-12 items-center text-base text-slate-600 dark:text-slate-300">1 :</span>
          <input className={FIELD_INPUT} inputMode="numeric" value={ratio} onChange={(e) => setRatio(e.target.value)} />
        </span>
      </label>
      <NumberField label="Final volume" value={finalVolume} onChange={setFinalVolume} units={VOLUME_UNITS} unit={volumeUnit} onUnit={(u) => setVolumeUnit(u as VolumeUnit)} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Show result in</span>
        <select className={`${FIELD_INPUT} flex-none`} value={outUnit} onChange={(e) => setOutUnit(e.target.value as VolumeUnit)}>
          {VOLUME_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <Results error={computed.error}>
        {r && (
          <>
            <ResultLine label={label} value={r.antibodyVolume} unit={outUnit} />
            <ResultLine label="Diluent (buffer)" value={r.diluentVolume} unit={outUnit} />
          </>
        )}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

function PercentCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'percent'>; stepId: string; experimentId: string }) {
  const [percent, setPercent] = useState(prefill ? String(prefill.percent) : '10');
  const [basis, setBasis] = useState<'w/v' | 'v/v'>(prefill?.basis ?? 'w/v');
  const [finalVolume, setFinalVolume] = useState(prefill ? String(prefill.finalVolume) : '10');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(prefill?.volumeUnit ?? 'mL');
  const [outUnit, setOutUnit] = useState<MassUnit | VolumeUnit>(basis === 'w/v' ? 'g' : 'mL');

  function changeBasis(next: 'w/v' | 'v/v') {
    setBasis(next);
    setOutUnit(next === 'w/v' ? 'g' : 'mL');
  }
  const outOptions: readonly string[] = basis === 'w/v' ? MASS_UNITS : VOLUME_UNITS;

  const computed = compute(() =>
    percentSolute({
      percent: need('a percent', percent),
      basis,
      finalVolume: need('a final volume', finalVolume),
      volumeUnit,
      outUnit,
    }),
  );
  const r = computed.result;
  const saveable: Saveable | null = r
    ? {
        label: `${percent}% ${basis} solution: solute`,
        value: r,
        unit: outUnit,
        note: `${percent}% ${basis} in ${finalVolume} ${volumeUnit}: ${basis === 'w/v' ? 'g per 100 mL' : 'mL per 100 mL'} × volume / 100.`,
      }
    : null;

  return (
    <div className="space-y-3">
      <NumberField label="Percent" value={percent} onChange={setPercent} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Basis</span>
        <select className={`${FIELD_INPUT} flex-none`} value={basis} onChange={(e) => changeBasis(e.target.value as 'w/v' | 'v/v')}>
          <option value="w/v">w/v (grams per 100 mL)</option>
          <option value="v/v">v/v (mL per 100 mL)</option>
        </select>
      </label>
      <NumberField label="Final volume" value={finalVolume} onChange={setFinalVolume} units={VOLUME_UNITS} unit={volumeUnit} onUnit={(u) => setVolumeUnit(u as VolumeUnit)} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Show solute in</span>
        <select className={`${FIELD_INPUT} flex-none`} value={outUnit} onChange={(e) => setOutUnit(e.target.value as MassUnit | VolumeUnit)}>
          {outOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      <Results error={computed.error}>{r !== undefined && <ResultLine label="Solute to add" value={r} unit={outUnit} />}</Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

function MolarityCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'molarity'>; stepId: string; experimentId: string }) {
  const [mode, setMode] = useState<'mass' | 'molarity'>('mass');
  const [molarity, setMolarity] = useState(prefill?.molarity !== undefined ? String(prefill.molarity) : '');
  const [molarityUnit, setMolarityUnit] = useState<MolarUnit>(prefill?.molarityUnit ?? 'mM');
  const [volume, setVolume] = useState(prefill ? String(prefill.volume) : '');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>(prefill?.volumeUnit ?? 'mL');
  const [mw, setMw] = useState(prefill?.mw !== undefined ? String(prefill.mw) : '');
  const [mass, setMass] = useState('');
  const [massUnit, setMassUnit] = useState<MassUnit>(prefill?.massUnit ?? 'mg');

  const computed = compute(() => {
    const molecularWeight = need('the molecular weight (g/mol)', mw);
    if (mode === 'mass') {
      return {
        mass: molarityToMass({
          molarity: need('a concentration', molarity),
          molarityUnit,
          volume: need('a volume', volume),
          volumeUnit,
          mw: molecularWeight,
          massUnit,
        }),
        molarity: undefined,
      };
    }
    return {
      mass: undefined,
      molarity: massToMolarity({
        mass: need('a mass', mass),
        massUnit,
        volume: need('a volume', volume),
        volumeUnit,
        mw: molecularWeight,
        molarityUnit,
      }),
    };
  });
  const r = computed.result;
  const saveable: Saveable | null = r
    ? r.mass !== undefined
      ? {
          label: `Mass to weigh for ${molarity} ${molarityUnit}`,
          value: r.mass,
          unit: massUnit,
          note: `M × V × MW: ${molarity} ${molarityUnit} × ${volume} ${volumeUnit} × ${mw} g/mol.`,
        }
      : r.molarity !== undefined
        ? {
            label: 'Resulting molarity',
            value: r.molarity,
            unit: molarityUnit,
            note: `mass / MW / V: ${mass} ${massUnit} / ${mw} g/mol / ${volume} ${volumeUnit}.`,
          }
        : null
    : null;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Calculate</span>
        <select className={`${FIELD_INPUT} flex-none`} value={mode} onChange={(e) => setMode(e.target.value as 'mass' | 'molarity')}>
          <option value="mass">Mass to weigh, from molarity</option>
          <option value="molarity">Molarity, from mass weighed</option>
        </select>
      </label>
      {mode === 'mass' ? (
        <NumberField label="Target concentration" value={molarity} onChange={setMolarity} units={MOLAR_UNITS} unit={molarityUnit} onUnit={(u) => setMolarityUnit(u as MolarUnit)} />
      ) : (
        <NumberField label="Mass weighed" value={mass} onChange={setMass} units={MASS_UNITS} unit={massUnit} onUnit={(u) => setMassUnit(u as MassUnit)} />
      )}
      <NumberField label="Final volume" value={volume} onChange={setVolume} units={VOLUME_UNITS} unit={volumeUnit} onUnit={(u) => setVolumeUnit(u as VolumeUnit)} />
      <NumberField label="Molecular weight (g/mol)" value={mw} onChange={setMw} />
      <Results error={computed.error}>
        {r?.mass !== undefined && <ResultLine label="Mass to weigh" value={r.mass} unit={massUnit} />}
        {r?.molarity !== undefined && <ResultLine label="Concentration" value={r.molarity} unit={molarityUnit} />}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

interface SerialState {
  startValue: string;
  unit: ConcUnit;
}

function SerialCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'serial'>; stepId: string; experimentId: string }) {
  const [start, setStart] = useState<SerialState>({
    startValue: prefill?.startConcentration !== undefined ? String(prefill.startConcentration) : '',
    unit: prefill?.unit ?? 'M',
  });
  const [factor, setFactor] = useState(prefill ? String(prefill.factor) : '10');
  const [steps, setSteps] = useState(prefill ? String(prefill.steps) : '5');
  const [transfer, setTransfer] = useState(prefill ? String(prefill.transferVolume) : '100');
  const [transferUnit, setTransferUnit] = useState<VolumeUnit>(prefill?.volumeUnit ?? 'µL');

  const computed = compute(() =>
    serialDilution({
      startConcentration: need('a starting concentration', start.startValue),
      unit: start.unit,
      factor: need('a dilution factor', factor),
      steps: need('the number of steps', steps),
      transferVolume: need('a transfer volume', transfer),
      volumeUnit: transferUnit,
    }),
  );
  const r = computed.result;
  const last = r?.tubes[r.tubes.length - 1];
  const saveable: Saveable | null =
    r && last
      ? {
          label: `Serial dilution: tube ${last.index} concentration`,
          value: last.concentration,
          unit: r.unit,
          note: `1:${factor} per step for ${steps} steps from ${start.startValue} ${start.unit}; ${formatValue(r.transferVolume)} ${r.transferUnit} transfer, ${formatValue(r.diluentVolume)} ${r.transferUnit} diluent per tube.`,
        }
      : null;

  return (
    <div className="space-y-3">
      <NumberField
        label="Starting concentration"
        value={start.startValue}
        onChange={(v) => setStart({ ...start, startValue: v })}
        units={ALL_CONC_UNITS}
        unit={start.unit}
        onUnit={(u) => setStart({ ...start, unit: u as ConcUnit })}
      />
      <NumberField label="Dilution factor per step (1:N)" value={factor} onChange={setFactor} />
      <NumberField label="Number of steps" value={steps} onChange={setSteps} />
      <NumberField label="Transfer volume" value={transfer} onChange={setTransfer} units={VOLUME_UNITS} unit={transferUnit} onUnit={(u) => setTransferUnit(u as VolumeUnit)} />
      <Results error={computed.error}>
        {r && (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {r.tubes.map((t) => (
              <li key={t.index} className="flex items-baseline justify-between gap-3 py-2 text-base">
                <span className="text-slate-700 dark:text-slate-300">{t.index === 0 ? 'Start' : `Tube ${t.index}`} (1:{formatValue(t.totalFactor)})</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatValue(t.concentration)} {r.unit}
                </span>
              </li>
            ))}
            <li className="py-2 text-sm text-slate-600 dark:text-slate-400">
              Add {formatValue(r.diluentVolume)} {r.transferUnit} diluent, then transfer {formatValue(r.transferVolume)} {r.transferUnit} to each next tube.
            </li>
          </ul>
        )}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

interface ComponentRow {
  id: number;
  name: string;
  perReaction: string;
  unit: VolumeUnit;
}

function MasterMixCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'masterMix'>; stepId: string; experimentId: string }) {
  const [reactions, setReactions] = useState(prefill ? String(prefill.reactions) : '10');
  const [overage, setOverage] = useState('10');
  const [rows, setRows] = useState<ComponentRow[]>(() =>
    (prefill?.components ?? []).map((c, i) => ({ id: i + 1, name: c.name, perReaction: String(c.perReaction), unit: c.unit })),
  );
  const [nextId, setNextId] = useState(rows.length + 1);

  function update(id: number, changes: Partial<ComponentRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  }

  const computed = compute(() => {
    if (rows.length === 0) throw new CalcError('Add at least one component');
    return masterMix({
      reactions: need('the number of reactions', reactions),
      overagePct: overage.trim() === '' ? 0 : need('an overage', overage),
      components: rows.map((row) => ({ name: row.name, perReaction: need(`${row.name || 'a component'} volume`, row.perReaction), unit: row.unit })),
    });
  });
  const r = computed.result;
  const saveable: Saveable | null = r
    ? {
        label: 'Master mix total volume',
        value: r.totalMicroliters,
        unit: 'µL',
        note: `${reactions} reactions + ${overage || '0'}% overage (${formatValue(r.reactionsWithOverage)} reactions). Components: ${rows.map((row) => `${row.name} ${row.perReaction} ${row.unit} per reaction`).join('; ')}.`,
      }
    : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Reactions (samples)" value={reactions} onChange={setReactions} />
        <NumberField label="Overage (%)" value={overage} onChange={setOverage} />
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Per reaction</span>
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-stretch gap-2">
            <input
              aria-label="Component name"
              className={`${FIELD_INPUT} basis-40`}
              placeholder="Component"
              value={row.name}
              onChange={(e) => update(row.id, { name: e.target.value })}
            />
            <input
              aria-label={`${row.name || 'Component'} volume per reaction`}
              className={`${FIELD_INPUT} w-24 flex-none`}
              inputMode="decimal"
              value={row.perReaction}
              onChange={(e) => update(row.id, { perReaction: e.target.value })}
            />
            <select aria-label={`${row.name || 'Component'} unit`} className={UNIT_SELECT} value={row.unit} onChange={(e) => update(row.id, { unit: e.target.value as VolumeUnit })}>
              {VOLUME_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button type="button" className={BUTTON} aria-label={`Remove ${row.name || 'component'}`} onClick={() => setRows((c) => c.filter((x) => x.id !== row.id))}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            setRows((c) => [...c, { id: nextId, name: '', perReaction: '', unit: 'µL' }]);
            setNextId(nextId + 1);
          }}
        >
          + Component
        </button>
      </div>
      <Results error={computed.error}>
        {r && (
          <>
            {r.rows.map((row, i) => (
              <ResultLine key={i} label={`${row.name || 'Component'} (total)`} value={row.total} unit={row.unit} />
            ))}
            <ResultLine label="Total volume" value={r.totalMicroliters} unit="µL" />
          </>
        )}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

function ProteinCalc({ prefill, stepId, experimentId }: { prefill?: Prefill<'protein'>; stepId: string; experimentId: string }) {
  const [concentration, setConcentration] = useState(prefill?.concentration !== undefined ? String(prefill.concentration) : '');
  const [concUnit, setConcUnit] = useState<MassConcUnit>(prefill?.concentrationUnit ?? 'µg/µL');
  const [target, setTarget] = useState(prefill ? String(prefill.targetUg) : '20');
  const [finalVolume, setFinalVolume] = useState(prefill ? String(prefill.finalVolume) : '20');
  const [fold, setFold] = useState('4');

  const computed = compute(() =>
    proteinLoad({
      concentration: need('the lysate concentration', concentration),
      concentrationUnit: concUnit,
      targetUg: need('the protein amount (µg)', target),
      finalVolume: need('a final volume (µL)', finalVolume),
      laemmliFold: need('the Laemmli strength', fold),
    }),
  );
  const r = computed.result;
  const saveable: Saveable | null = r
    ? {
        label: `Protein sample volume for ${target} µg`,
        value: r.sampleVolume,
        unit: 'µL',
        note: `${target} µg at ${concentration} ${concUnit}; final ${finalVolume} µL with ${fold}X Laemmli (${formatValue(r.laemmliVolume)} µL) and ${formatValue(r.bufferVolume)} µL buffer.`,
      }
    : null;

  return (
    <div className="space-y-3">
      <NumberField label="Lysate concentration" value={concentration} onChange={setConcentration} units={MASS_CONC_UNITS} unit={concUnit} onUnit={(u) => setConcUnit(u as MassConcUnit)} />
      <NumberField label="Protein to load (µg)" value={target} onChange={setTarget} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Final volume (µL)" value={finalVolume} onChange={setFinalVolume} />
        <NumberField label="Laemmli strength (X)" value={fold} onChange={setFold} />
      </div>
      <Results error={computed.error}>
        {r && (
          <>
            <ResultLine label="Lysate" value={r.sampleVolume} unit="µL" />
            <ResultLine label={`${fold}X Laemmli`} value={r.laemmliVolume} unit="µL" />
            <ResultLine label="Buffer to final volume" value={r.bufferVolume} unit="µL" />
          </>
        )}
      </Results>
      <SaveRow saveable={saveable} experimentId={experimentId} stepId={stepId} />
    </div>
  );
}

// ---------- Cards and the step-level component ----------

function CalcCard({ kind, reason, children }: { kind: CalcKind; reason?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section aria-label={`Calculator: ${CALC_LABELS[kind]}`} className="rounded-2xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900 dark:text-slate-100">Calculator: {CALC_LABELS[kind]}</span>
          {reason && <span className="block truncate text-sm text-slate-600 dark:text-slate-400">{reason}</span>}
        </span>
        <span aria-hidden="true" className="text-lg text-slate-600 dark:text-slate-300">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="space-y-3 border-t border-slate-200 px-4 py-4 dark:border-slate-700">{children}</div>}
    </section>
  );
}

interface CalcItem {
  key: string;
  kind: CalcKind;
  reason?: string;
  detected?: DetectedCalc;
}

function CalcBody({ item, stepId, experimentId }: { item: CalcItem; stepId: string; experimentId: string }) {
  const d = item.detected;
  switch (item.kind) {
    case 'dilution':
      return <DilutionCalc prefill={d?.kind === 'dilution' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'antibody':
      return <AntibodyCalc prefill={d?.kind === 'antibody' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'percent':
      return <PercentCalc prefill={d?.kind === 'percent' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'molarity':
      return <MolarityCalc prefill={d?.kind === 'molarity' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'serial':
      return <SerialCalc prefill={d?.kind === 'serial' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'masterMix':
      return <MasterMixCalc prefill={d?.kind === 'masterMix' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
    case 'protein':
      return <ProteinCalc prefill={d?.kind === 'protein' ? d.prefill : undefined} stepId={stepId} experimentId={experimentId} />;
  }
}

function StepCalculatorsForStep({ step, experimentId }: { step: Step; experimentId: string }) {
  const detected = useMemo(() => detectCalcs(step), [step]);
  const [manual, setManual] = useState<CalcItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const items: CalcItem[] = [
    ...detected.map((d, i) => ({ key: `detected-${i}`, kind: d.kind, reason: d.reason, detected: d })),
    ...manual,
  ];

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CalcCard key={item.key} kind={item.kind} reason={item.reason}>
          <CalcBody item={item} stepId={step.id} experimentId={experimentId} />
        </CalcCard>
      ))}

      {items.length === 0 && <p className="text-base text-slate-500 dark:text-slate-400">No calculation detected for this step.</p>}

      <div className="flex flex-col items-start gap-2">
        <button type="button" className={BUTTON} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          + Calculator
        </button>
        {menuOpen && (
          <div role="menu" className="grid w-full grid-cols-1 gap-2 rounded-2xl border border-slate-300 bg-white p-2 sm:grid-cols-2 dark:border-slate-600 dark:bg-slate-900">
            {(Object.keys(CALC_LABELS) as CalcKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={`${BUTTON} justify-start`}
                onClick={() => {
                  setManual((m) => [...m, { key: `manual-${m.length}-${kind}-${Date.now()}`, kind }]);
                  setMenuOpen(false);
                }}
              >
                {CALC_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Calculators for one run step: detected ones (prefilled) plus any added by hand.
 * Saving writes a number record for this experiment and step.
 */
export function StepCalculators({ step, experimentId }: { step: Step; experimentId: string }) {
  return <StepCalculatorsForStep key={step.id} step={step} experimentId={experimentId} />;
}
