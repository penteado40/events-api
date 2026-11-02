// Public API of the emails context. Other modules import only from here.
export { EmailsModule } from './emails.module.js'
export {
  AccountEmails,
  type AccountEmailRecipient,
  type ActivationLinkToSend,
} from './application/account-emails.js'
