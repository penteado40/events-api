import { describe, expect, it } from 'vitest'
import type { EventItemSnapshot } from './event-item.entity.js'
import { assembleSchedule } from './schedule.js'

const NO_NAMES = new Map<number, string>()

/**
 * A published Event item with no date and no place, to be overridden. Its
 * position is its id unless given: the order of creation, the default order
 * of the production.
 */
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

// The Manaus trip, 2026-11-13 to 2026-11-16 in America/Manaus, items in the
// order the production created them.
const MANAUS_ITEMS: EventItemSnapshot[] = [
  item(1, 'O que levar'),
  item(2, 'Show no Teatro Amazonas', { date: '2026-11-14', time: '19:00' }),
  item(3, 'Translado para o hotel', { date: '2026-11-15', time: '00:40' }),
  item(4, 'Passagem de som', { date: '2026-11-14', time: '15:00' }),
  item(5, 'Almoço (horário a confirmar)', { date: '2026-11-14' }),
  item(6, 'Técnica viaja para Manaus', {
    date: '2026-11-12',
    time: '08:00',
    place: { name: 'Aeroporto de Guarulhos', address: null, timezone: 'America/Sao_Paulo' },
  }),
  item(7, 'Contatos da produção'),
  item(8, 'Dia livre', { date: '2026-11-15' }),
]

describe('assembleSchedule', () => {
  const schedule = assembleSchedule({
    timezone: 'America/Manaus',
    items: MANAUS_ITEMS,
    fields: [],
    names: NO_NAMES,
  })

  it('puts the undated Event items in the General info, in the order of the production', () => {
    expect(schedule.generalInfo.map((i) => i.name)).toEqual(['O que levar', 'Contatos da produção'])
    expect(schedule.generalInfo[0]).toEqual({
      id: 1,
      name: 'O que levar',
      when: null,
      place: null,
      state: 'PUBLISHED',
      fields: [],
    })
  })

  it('shows only the days that have items, in date order, the eve of the period included', () => {
    expect(schedule.timeline.map((day) => day.date)).toEqual([
      '2026-11-12',
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('puts the 00:40 transfer after the Saturday show on Sunday, its calendar day', () => {
    const sunday = schedule.timeline.find((day) => day.date === '2026-11-15')

    expect(sunday?.items.map((i) => i.name)).toContain('Translado para o hotel')
  })

  it('puts, on each day, the items with no time first, then the others by time', () => {
    expect(schedule.timeline.map((day) => day.items.map((i) => i.name))).toEqual([
      ['Técnica viaja para Manaus'],
      ['Almoço (horário a confirmar)', 'Passagem de som', 'Show no Teatro Amazonas'],
      ['Dia livre', 'Translado para o hotel'],
    ])
  })

  it('gives each dated item its when as written, in the zone of its place or else of the Event', () => {
    const [eve, saturday] = schedule.timeline

    expect(eve?.items[0]?.when).toEqual({
      date: '2026-11-12',
      time: '08:00',
      timezone: 'America/Sao_Paulo',
    })
    expect(saturday?.items[0]?.when).toEqual({
      date: '2026-11-14',
      time: null,
      timezone: 'America/Manaus',
    })
    expect(saturday?.items[2]?.when).toEqual({
      date: '2026-11-14',
      time: '19:00',
      timezone: 'America/Manaus',
    })
  })

  it('puts the General info in the order of the production, its manual position', () => {
    const { generalInfo } = assembleSchedule({
      timezone: 'America/Manaus',
      fields: [],
      names: NO_NAMES,
      items: [
        item(1, 'O que levar', { position: 3 }),
        item(2, 'Contatos da produção', { position: 1 }),
        item(3, 'Voltagem', { position: 2 }),
      ],
    })

    expect(generalInfo.map((i) => i.name)).toEqual([
      'Contatos da produção',
      'Voltagem',
      'O que levar',
    ])
  })

  it('puts the items of a day with no time in the order of the production', () => {
    const { timeline } = assembleSchedule({
      timezone: 'America/Manaus',
      fields: [],
      names: NO_NAMES,
      items: [
        item(1, 'Almoço', { date: '2026-11-14', position: 2 }),
        item(2, 'Show', { date: '2026-11-14', time: '19:00', position: 0 }),
        item(3, 'Dia de folga da Banda', { date: '2026-11-14', position: 1 }),
      ],
    })

    expect(timeline[0]?.items.map((i) => i.name)).toEqual([
      'Dia de folga da Banda',
      'Almoço',
      'Show',
    ])
  })

  it('puts two items at the same time in the order of the production', () => {
    const { timeline } = assembleSchedule({
      timezone: 'America/Manaus',
      fields: [],
      names: NO_NAMES,
      items: [
        item(1, 'Van 1', { date: '2026-11-13', time: '10:00', position: 5 }),
        item(2, 'Van 2', { date: '2026-11-13', time: '10:00', position: 4 }),
        item(3, 'Café', { date: '2026-11-13', time: '09:00', position: 9 }),
      ],
    })

    expect(timeline[0]?.items.map((i) => i.name)).toEqual(['Café', 'Van 2', 'Van 1'])
  })

  it('never lets the order of the production pass over the time: 9h comes before 10h', () => {
    const { timeline } = assembleSchedule({
      timezone: 'America/Manaus',
      fields: [],
      names: NO_NAMES,
      items: [
        item(1, 'Passagem de som', { date: '2026-11-14', time: '10:00', position: 1 }),
        item(2, 'Café da manhã', { date: '2026-11-14', time: '09:00', position: 2 }),
      ],
    })

    expect(timeline[0]?.items.map((i) => i.name)).toEqual(['Café da manhã', 'Passagem de som'])
  })

  it('breaks a tie of the same position by the order of creation', () => {
    const { generalInfo } = assembleSchedule({
      timezone: 'America/Manaus',
      fields: [],
      names: NO_NAMES,
      items: [item(7, 'Contatos', { position: 1 }), item(4, 'O que levar', { position: 1 })],
    })

    expect(generalInfo.map((i) => i.name)).toEqual(['O que levar', 'Contatos'])
  })

  it('gives an empty General info and Timeline for an Event with no items', () => {
    expect(
      assembleSchedule({ timezone: 'America/Manaus', items: [], fields: [], names: NO_NAMES }),
    ).toEqual({
      generalInfo: [],
      timeline: [],
      summary: [],
    })
  })

  it('brings the Fields of each item, in the order of the production, and only of the items given', () => {
    const field = (id: number, eventItemId: number, name: string, position: number) => ({
      id,
      eventItemId,
      name,
      value: { kind: 'TEXT' as const, text: `${name} do item ${eventItemId}` },
      position,
      highlight: false,
    })
    const { generalInfo } = assembleSchedule({
      timezone: 'America/Manaus',
      items: [item(1, 'O que levar'), item(2, 'Contatos da produção')],
      fields: [
        field(10, 1, 'Roupa', 2),
        field(11, 1, 'Documentos', 1),
        field(12, 2, 'Produção', 1),
        field(13, 99, 'De um item que a pessoa não vê', 1),
      ],
      names: NO_NAMES,
    })

    expect(generalInfo.map((i) => i.fields)).toEqual([
      [
        {
          id: 11,
          kind: 'TEXT',
          name: 'Documentos',
          value: 'Documentos do item 1',
          highlight: false,
        },
        { id: 10, kind: 'TEXT', name: 'Roupa', value: 'Roupa do item 1', highlight: false },
      ],
      [
        {
          id: 12,
          kind: 'TEXT',
          name: 'Produção',
          value: 'Produção do item 2',
          highlight: false,
        },
      ],
    ])
  })

  it('shows the people of a people Field by name, in their order, a loose name with its name only', () => {
    const { generalInfo } = assembleSchedule({
      timezone: 'America/Manaus',
      items: [item(1, 'Saída terrestre')],
      fields: [
        {
          id: 10,
          eventItemId: 1,
          name: 'Carro 1 - EC',
          value: {
            kind: 'PEOPLE',
            people: [{ userId: 7 }, { name: 'Seu Raimundo' }, { userId: 3 }],
          },
          position: 1,
          highlight: true,
        },
      ],
      names: new Map([
        [3, 'Jacque'],
        [7, 'Matias'],
      ]),
    })

    expect(generalInfo[0]?.fields).toEqual([
      {
        id: 10,
        kind: 'PEOPLE',
        name: 'Carro 1 - EC',
        highlight: true,
        value: [
          { userId: 7, name: 'Matias' },
          { name: 'Seu Raimundo' },
          { userId: 3, name: 'Jacque' },
        ],
      },
    ])
  })

  it('assembles the Summary from the same items, with only the Fields in Highlight', () => {
    const field = (id: number, eventItemId: number, highlight: boolean) => ({
      id,
      eventItemId,
      name: `Field ${id}`,
      value: { kind: 'TEXT' as const, text: '' },
      position: id,
      highlight,
    })
    const { summary } = assembleSchedule({
      timezone: 'America/Manaus',
      items: [
        item(1, 'Show', { date: '2026-11-14', time: '19:00' }),
        item(2, 'O que levar'),
        item(3, 'Passagem de som', { date: '2026-11-14', time: '15:00' }),
      ],
      fields: [field(10, 1, true), field(11, 2, true), field(12, 2, false), field(13, 3, false)],
      names: NO_NAMES,
    })

    expect(summary.map((card) => [card.name, card.fields.map((f) => f.id)])).toEqual([
      ['O que levar', [11]],
      ['Show', [10]],
    ])
  })
})
