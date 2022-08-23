import health from '../routes/health.js'
import webhook from '../routes/webhook.js'
import protocols from '../routes/protocols.js'
import settings from '../routes/settings.js'
import messages from '../routes/messages.js'

export default (app, database) => {
  app.use('/api/v1/health', health())
  app.use('/api/v1', messages(database))
  app.use('/api/v1/closed', protocols(database))
  app.use('/api/v1/webhook', webhook(database))
  app.use('/api/v1/settings', settings(database))
}
