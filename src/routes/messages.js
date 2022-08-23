import express from 'express'
import MessagesController from '../controllers/MessagesController.js'

export default (database) => {
  const router = express.Router()

  const messagesController = new MessagesController(database)

  router.post('/send', (req, res) => messagesController.send(req, res))

  return router
}
