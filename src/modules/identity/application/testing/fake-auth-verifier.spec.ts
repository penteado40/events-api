import { describeAuthVerifierContract } from './auth-verifier.contract.js'
import { FakeAuthVerifier } from './fake-auth-verifier.js'

describeAuthVerifierContract('fake', () => ({
  verifier: new FakeAuthVerifier(),
  async issueValidToken() {
    const identity = { externalId: 'user_ana', email: 'ana@example.com' }
    return { token: FakeAuthVerifier.tokenFor(identity), identity }
  },
}))
