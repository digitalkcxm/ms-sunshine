import express from 'express'
import WebhookController from '../controllers/WebhookController.js'

export default (database) => {
  const router = express.Router()

  const webhookController = new WebhookController(database)

  router.post('/', (req, res) => webhookController.webhook(req, res))

  return router
}
