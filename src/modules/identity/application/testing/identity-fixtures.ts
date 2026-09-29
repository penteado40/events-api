import type { Stamp } from '../../../../shared/domain/stamp.js'

/** A write with no Author (a platform script), for arranging state where the Author does not matter. */
export const SCRIPT_STAMP: Stamp = { by: null, at: new Date('2026-09-01T12:00:00.000Z') }
