import express from 'express'
import ProtocolsController from '../controllers/ProtocolsController.js'

export default (database) => {
  const router = express.Router()

  const protocolsController = new ProtocolsController(database)

  router.put('/', (req, res) => protocolsController.closedProtocol(req, res))

  return router
}
