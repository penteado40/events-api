import { describe, expect, it } from 'vitest'
import type { EventItemSnapshot } from './event-item.entity.js'
import type { FieldSnapshot } from './field.entity.js'
import { assembleSchedule } from './schedule.js'
import { assembleSummary } from './summary.js'

const NO_NAMES = new Map<number, string>()

/** A published Event item with no date, to be overridden; its position is its id. */
function item(id: number, name: string, over: Partial<EventItemSnapshot> = {}): EventItemSnapshot {
  return {
    id,
    name,
    date: null,
    time: null,
    place: null,
    state: 'PUBLISHED',
    position: id,
    audience: { kind: 'ALL' },
    ...over,
  }
}

/** A text Field of the item, without Highlight unless given; its position is its id. */
function field(
  id: number,
  eventItemId: number,
  name: string,
  highlight = false,
  over: Partial<FieldSnapshot> = {},
): FieldSnapshot {
  return {
    id,
    eventItemId,
    name,
    value: { kind: 'TEXT', text: `${name}!` },
    position: id,
    highlight,
    ...over,
  }
}

function summaryOf(items: EventItemSnapshot[], fields: FieldSnapshot[]) {
  return assembleSummary(
    assembleSchedule({ timezone: 'America/Manaus', items, fields, names: NO_NAMES }),
  )
}

describe('assembleSummary', () => {
  it('gives one card per item with a Field in Highlight, with only those Fields', () => {
    const summary = summaryOf(
      [item(1, 'Contatos da produção')],
      [field(1, 1, 'Produtora', true), field(2, 1, 'Obs'), field(3, 1, 'Técnico', true)],
    )

    expect(summary).toEqual([
      {
        id: 1,
        name: 'Contatos da produção',
        when: null,
        place: null,
        state: 'PUBLISHED',
        fields: [
          { id: 1, name: 'Produtora', kind: 'TEXT', value: 'Produtora!', highlight: true },
          { id: 3, name: 'Técnico', kind: 'TEXT', value: 'Técnico!', highlight: true },
        ],
      },
    ])
  })

  it('leaves out the items with no Field in Highlight, and those with no Fields', () => {
    const summary = summaryOf(
      [item(1, 'O que levar'), item(2, 'Contatos'), item(3, 'Vazio')],
      [field(1, 1, 'Lista'), field(2, 2, 'Produtora', true)],
    )

    expect(summary.map((card) => card.name)).toEqual(['Contatos'])
  })

  it('keeps the Fields in Highlight in the order of the production', () => {
    const summary = summaryOf(
      [item(1, 'Saída terrestre')],
      [
        field(1, 1, 'Local', true, { position: 3 }),
        field(2, 1, 'Carro 1', true, { position: 1 }),
        field(3, 1, 'Obs', false, { position: 2 }),
      ],
    )

    expect(summary[0]?.fields.map((f) => f.name)).toEqual(['Carro 1', 'Local'])
  })

  it('puts the cards of the General info first, then those of the Timeline, in the same order', () => {
    const summary = summaryOf(
      [
        item(1, 'Show', { date: '2026-11-14', time: '19:00' }),
        item(2, 'Passagem de som', { date: '2026-11-14', time: '15:00' }),
        item(3, 'Técnica viaja', { date: '2026-11-12', time: '08:00' }),
        item(4, 'Contatos'),
        item(5, 'O que levar', { position: 0 }),
      ],
      [1, 2, 3, 4, 5].map((id) => field(id, id, 'Obs', true)),
    )

    expect(summary.map((card) => card.name)).toEqual([
      'O que levar',
      'Contatos',
      'Técnica viaja',
      'Passagem de som',
      'Show',
    ])
  })

  it('gives the card the when, the place and the state of its item, a Cancelled one included', () => {
    const summary = summaryOf(
      [item(1, 'Show', { date: '2026-11-14', time: '19:00', state: 'CANCELLED' })],
      [field(1, 1, 'Local', true)],
    )

    expect(summary[0]).toMatchObject({
      when: { date: '2026-11-14', time: '19:00', timezone: 'America/Manaus' },
      place: null,
      state: 'CANCELLED',
    })
  })

  it('is empty for a schedule with no Field in Highlight', () => {
    expect(summaryOf([item(1, 'O que levar')], [field(1, 1, 'Lista')])).toEqual([])
  })
})
