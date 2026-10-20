import { PLACES } from '../../world/config';
import type { WorldDef } from '../types';

/** The whole town in one map, as it was before it was split into worlds. */
export const full: WorldDef = {
  key: 'full',
  name: 'Hoshi Town (full map)',
  jp: '星の町 全体',
  bounds: null,
  margin: 0,
  minDist: 10,
  maxDist: 520,
  start: PLACES[0],
  exits: [],
};
