import express from 'express'
import ProtocolsController from '../controllers/ProtocolsController.js'

export default (database) => {
  const router = express.Router()

  const protocolsController = new ProtocolsController(database)

  router.put('/closed', (req, res) => protocolsController.closedProtocol(req, res))
  router.get('/nps/:id', (req, res) => protocolsController.getNPS(req, res))

  return router
}
