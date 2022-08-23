import express from 'express'
import SettingsController from '../controllers/SettingsController.js'

export default (database) => {
  const router = express.Router()
  
  const settingsController = new SettingsController(database)

  router.post('/', (req, res) => settingsController.create(req, res))
  router.get('/', (req, res) => settingsController.getAll(req, res))
  router.get('/:id', (req, res) => settingsController.getByID(req, res))
  router.get('/token/:token', (req, res) => settingsController.getByToken(req, res))
  router.put('/:id', (req, res) => settingsController.update(req, res))

  return router
}
