import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { describeInvitationIssuerContract } from './invitation-issuer.contract.js'
import { FakeInvitationIssuer } from './fake-invitation-issuer.js'

let sequence = 0

describeInvitationIssuerContract('fake', () => ({
  issuer: new FakeInvitationIssuer(new FixedClock(new Date())),
  freshEmail: () => `contract${++sequence}@example.com`,
}))
