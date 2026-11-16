import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'

/**
 * The types of a Field (CONTEXT.md, Field): for now only text, which covers a
 * list, a phone and a link too. People and photos come later, each with its
 * own value, so a new type never touches the Fields there are.
 */
export const FIELD_KINDS = ['TEXT'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]

export const FIELD_NAME_MAX_LENGTH = 100
export const FIELD_TEXT_MAX_LENGTH = 5000

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

/** The value of a Field, by its type; a new type adds its own here. */
export type FieldValue = { kind: 'TEXT'; text: string }

/** The value of a new text Field. */
export function textValue(text: FieldText): FieldValue {
  return { kind: 'TEXT', text: text.value }
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

/** What an edit of a text Field may change; what is left out stays as it is. */
export interface FieldEdit {
  name?: FieldName
  text?: FieldText
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
    return new Field({ ...props, value: { ...props.value } })
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
   * Changes the name or the text. The type never changes: a Field never mixes
   * types. Answers whether anything changed: an edit that changes nothing
   * keeps the last Author and is no write.
   */
  edit(edit: FieldEdit, stamp: Stamp): boolean {
    const name = edit.name?.value ?? this.props.name
    const text = edit.text?.value ?? this.props.value.text
    if (name === this.props.name && text === this.props.value.text) return false
    this.props.name = name
    this.props.value = { kind: 'TEXT', text }
    this.touch(stamp)
    return true
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
      value: { ...this.props.value },
      position: this.props.position,
    }
  }
}
