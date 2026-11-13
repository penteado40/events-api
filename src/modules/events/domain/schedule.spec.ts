import { describe, expect, it } from 'vitest'
import type { EventItemSnapshot } from './event-item.entity.js'
import { assembleSchedule } from './schedule.js'

/** A published Event item with no date and no place, to be overridden. */
function item(id: number, name: string, over: Partial<EventItemSnapshot> = {}): EventItemSnapshot {
  return { id, name, date: null, time: null, place: null, state: 'PUBLISHED', ...over }
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
  const schedule = assembleSchedule({ timezone: 'America/Manaus', items: MANAUS_ITEMS })

  it('puts the undated Event items in the General info, in the order of the production', () => {
    expect(schedule.generalInfo.map((i) => i.name)).toEqual(['O que levar', 'Contatos da produção'])
    expect(schedule.generalInfo[0]).toEqual({
      id: 1,
      name: 'O que levar',
      when: null,
      place: null,
      state: 'PUBLISHED',
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

  it('keeps the order of the production between items of the same day and the same time', () => {
    const { timeline } = assembleSchedule({
      timezone: 'America/Manaus',
      items: [
        item(9, 'Van 2', { date: '2026-11-13', time: '10:00' }),
        item(3, 'Van 1', { date: '2026-11-13', time: '10:00' }),
        item(5, 'Sem hora B', { date: '2026-11-13' }),
        item(4, 'Sem hora A', { date: '2026-11-13' }),
      ],
    })

    expect(timeline[0]?.items.map((i) => i.name)).toEqual([
      'Sem hora B',
      'Sem hora A',
      'Van 2',
      'Van 1',
    ])
  })

  it('gives an empty General info and Timeline for an Event with no items', () => {
    expect(assembleSchedule({ timezone: 'America/Manaus', items: [] })).toEqual({
      generalInfo: [],
      timeline: [],
    })
  })
})
