import { EventParticipations, type Participation } from '../ports/event-participations.js'

/** Participations arranged per User id; a User with none arranged goes to no Event. */
export class FakeEventParticipations extends EventParticipations {
  private readonly byUser = new Map<number, Participation[]>()

  set(userId: number, participations: Participation[]): void {
    this.byUser.set(userId, participations)
  }

  async ofUser(userId: number): Promise<Participation[]> {
    return this.byUser.get(userId) ?? []
  }
}
