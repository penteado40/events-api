import type { Schedule, ScheduleItem } from './schedule.js'

/**
 * A card of the Summary: an Event item as the schedule shows it, with only
 * its Fields in Highlight, in the order of the production.
 */
export type SummaryCard = ScheduleItem

/**
 * The Summary of an Event for a person (CONTEXT.md, Summary): one card per
 * Event item of their schedule that has a Field in Highlight, showing only
 * those Fields; first the cards of the General info, then those of the
 * Timeline, in the same order as there. It is assembled from the schedule
 * already passed through the reach rule, so an item that does not reach the
 * person never makes a card. The Highlight does not depend on the time of the
 * item. Pure (ADR-0019).
 */
export function assembleSummary(
  schedule: Pick<Schedule, 'generalInfo' | 'timeline'>,
): SummaryCard[] {
  const items = [...schedule.generalInfo, ...schedule.timeline.flatMap((day) => day.items)]
  return items.flatMap((item) => {
    const fields = item.fields.filter((field) => field.highlight)
    return fields.length === 0 ? [] : [{ ...item, fields }]
  })
}
