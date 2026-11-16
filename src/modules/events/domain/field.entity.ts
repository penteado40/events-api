import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'

/**
 * The types of a Field (CONTEXT.md, Field): text, which covers a list, a
 * phone and a link too, and people. Photos come later, with their own value,
 * so a new type never touches the Fields there are.
 */
export const FIELD_KINDS = ['TEXT', 'PEOPLE'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

export const FIELD_NAME_MAX_LENGTH = 100
export const FIELD_TEXT_MAX_LENGTH = 5000
export const FIELD_PEOPLE_MAX = 100

/** The name of a Field ("Obs", "Voo"), trimmed, from 1 to 100 characters. */
export class FieldName {
  private constructor(readonly value: string) {}

  static create(raw: string): FieldName {
    const value = raw.trim()
    if (value.length === 0 || value.length > FIELD_NAME_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new FieldName(value)
  }
}

/**
 * The value of a text Field, as written, up to 5000 characters. It may be
 * empty: an Item template brings Fields with or without a value.
 */
export class FieldText {
  private constructor(readonly value: string) {}

  static create(raw: string): FieldText {
    if (raw.length > FIELD_TEXT_MAX_LENGTH) throw new AppError('VALIDATION_ERROR')
    return new FieldText(raw)
  }
}

/**
 * The people of a people Field ("Carro 1 - EC: Matias, Jacque"), their User
 * ids in the order the production gives, each once, up to 100. It may be
 * empty: an Item template brings Fields with or without a value. Only
 * Participants of the Event go in (assertWithin), checked by who writes
 * them, under the Event's lock.
 */
export class FieldPeople {
  private constructor(readonly userIds: readonly number[]) {}

  static create(userIds: readonly number[]): FieldPeople {
    if (userIds.length > FIELD_PEOPLE_MAX || new Set(userIds).size !== userIds.length) {
      throw new AppError('VALIDATION_ERROR')
    }
    if (userIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new FieldPeople([...userIds])
  }

  /**
   * Refuses anyone put in who is not a Participant of the Event
   * (NOT_A_PARTICIPANT). Who was already in the Field stays even after
   * leaving the Event, until the production reorganizes it (CONTEXT.md,
   * Participant), so only the people coming in are checked.
   */
  assertWithin(participants: readonly number[], alreadyIn: readonly number[]): void {
    const comingIn = this.userIds.filter((id) => !alreadyIn.includes(id))
    if (comingIn.some((id) => !participants.includes(id))) {
      throw new AppError('NOT_A_PARTICIPANT')
    }
  }
}

/** The value of a Field, by its type; a new type adds its own here. */
export type FieldValue = { kind: 'TEXT'; text: string } | { kind: 'PEOPLE'; userIds: number[] }

/** The value of a new text Field. */
export function textValue(text: FieldText): FieldValue {
  return { kind: 'TEXT', text: text.value }
}

/** The value of a new people Field. */
export function peopleValue(people: FieldPeople): FieldValue {
  return { kind: 'PEOPLE', userIds: [...people.userIds] }
}

/**
 * Who is in the people Fields given, once each, in the order they first
 * appear: whom the reach rule adds to the Audience of their item.
 */
export function peopleInFields(fields: readonly { value: FieldValue }[]): number[] {
  const people = new Set<number>()
  for (const field of fields) {
    if (field.value.kind === 'PEOPLE') for (const id of field.value.userIds) people.add(id)
  }
  return [...people]
}

function copyOf(value: FieldValue): FieldValue {
  return value.kind === 'TEXT' ? { ...value } : { kind: 'PEOPLE', userIds: [...value.userIds] }
}

function sameValue(a: FieldValue, b: FieldValue): boolean {
  if (a.kind === 'TEXT' || b.kind === 'TEXT') {
    return a.kind === 'TEXT' && b.kind === 'TEXT' && a.text === b.text
  }
  return a.userIds.length === b.userIds.length && a.userIds.every((id, i) => id === b.userIds[i])
}

export interface FieldProps {
  id: number
  eventItemId: number
  name: string
  value: FieldValue
  /** Its place in the order of the production among the Fields of the item. */
  position: number
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewFieldProps {
  eventItemId: number
  name: FieldName
  value: FieldValue
  /** Last among the Fields of the item (positionAfter). */
  position: number
}

/**
 * What an edit of a Field may change: the name, and the value of its own
 * type, the text of a text Field or the people of a people Field (a new list,
 * in its order); what is left out stays as it is.
 */
export interface FieldEdit {
  name?: FieldName
  text?: FieldText
  people?: FieldPeople
}

/** A Field as plain data (ADR-0019): what the schedule shows and the Changes keep. */
export interface FieldSnapshot {
  id: number
  eventItemId: number
  name: string
  value: FieldValue
  position: number
}

/**
 * A free piece of information inside an Event item (CONTEXT.md, Field), with
 * a name and a value of one type only. The item it is in guards it: a write
 * on a Field of a Cancelled item or Event is refused before it gets here.
 */
export class Field {
  private constructor(private readonly props: FieldProps) {}

  static restore(props: FieldProps): Field {
    return new Field({ ...props, value: copyOf(props.value) })
  }

  get id(): number {
    return this.props.id
  }
  get eventItemId(): number {
    return this.props.eventItemId
  }
  get name(): string {
    return this.props.name
  }
  get value(): FieldValue {
    return this.props.value
  }
  get position(): number {
    return this.props.position
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }
  get createdById(): number | null {
    return this.props.createdById
  }
  get updatedById(): number | null {
    return this.props.updatedById
  }

  /**
   * Changes the name or the value. The type never changes: a Field never
   * mixes types, so a value of the other type is VALIDATION_ERROR, before
   * anything changes. Answers whether anything changed: an edit that changes
   * nothing keeps the last Author and is no write.
   */
  edit(edit: FieldEdit, stamp: Stamp): boolean {
    const name = edit.name?.value ?? this.props.name
    const value = this.valueAfter(edit)
    if (name === this.props.name && sameValue(value, this.props.value)) return false
    this.props.name = name
    this.props.value = value
    this.touch(stamp)
    return true
  }

  /** The value an edit leaves, of the Field's own type. */
  private valueAfter(edit: FieldEdit): FieldValue {
    const current = this.props.value
    if (current.kind === 'TEXT') {
      if (edit.people) throw new AppError('VALIDATION_ERROR')
      return edit.text ? textValue(edit.text) : copyOf(current)
    }
    if (edit.text) throw new AppError('VALIDATION_ERROR')
    return edit.people ? peopleValue(edit.people) : copyOf(current)
  }

  /** Takes a new place among the Fields of the item; its Author is who reordered (ADR-0013). */
  moveTo(position: number, stamp: Stamp): void {
    if (position === this.props.position) return
    this.props.position = position
    this.touch(stamp)
  }

  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }

  snapshot(): FieldSnapshot {
    return {
      id: this.props.id,
      eventItemId: this.props.eventItemId,
      name: this.props.name,
      value: copyOf(this.props.value),
      position: this.props.position,
    }
  }
}
