import { buildStarter, type StarterSpec } from './build';
import { westernBlotSpec } from './western-blot';
import { ifFreeFloatingSpec } from './if-free-floating';
import { perfusionPfaSpec } from './perfusion-pfa';
import { cryosectioningSpec } from './cryosectioning';
import { nisslSpec } from './nissl-cresyl-violet';
import { dapiSpec } from './dapi-counterstain';
import { pcrSpec } from './pcr-amplification';
import { rtQpcrSpec } from './rt-qpcr-sybr';
import { tailGenotypingSpec } from './mouse-tail-genotyping';
import { cellPassagingSpec } from './cell-passaging';
import { primaryNeuronSpec } from './primary-neuron-culture';
import { stereotaxicSpec } from './stereotaxic-viral-injection';
import { slicePhysSpec } from './slice-electrophysiology';
import { golgiSpec } from './golgi-cox';
import { bcaSpec } from './bca-protein-assay';
import { calciumFluo4Spec } from './calcium-fluo4';

/** Starter protocol specs in library order. */
export const STARTER_SPECS: StarterSpec[] = [
  westernBlotSpec,
  ifFreeFloatingSpec,
  perfusionPfaSpec,
  cryosectioningSpec,
  nisslSpec,
  dapiSpec,
  pcrSpec,
  rtQpcrSpec,
  tailGenotypingSpec,
  cellPassagingSpec,
  primaryNeuronSpec,
  stereotaxicSpec,
  slicePhysSpec,
  golgiSpec,
  bcaSpec,
  calciumFluo4Spec,
];

/** Full starter templates, built once. Each has isStarter, CC BY 4.0 and the shared author. */
export const STARTER_TEMPLATES = STARTER_SPECS.map(buildStarter);
