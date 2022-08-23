import SettingsModel from '../models/SettingsModel.js'
import MessagesController from './MessagesController.js'
import ProtocolsController from './ProtocolsController.js'

export default class WebhookController {
  constructor(database) {
    this.settingsModel = new SettingsModel(database)
    this.messagesController = new MessagesController(database)
    this.protocolsController = new ProtocolsController(database)
  }

  async webhook(req, res) {
    // console.log("🚀 ~ file: WebhookController.js ~ line 13 ~ WebhookController ~ webhook ~ req", req.body)
    // console.log("🚀 ~ file: WebhookController.js ~ line 13 ~ WebhookController ~ webhook ~ req", req.body.events)
    // console.log("🚀 ~ file: WebhookController.js ~ line 13 ~ WebhookController ~ webhook ~ req", req.body.events[0].payload)
    try {
      // const settings = await this.settingsModel.getByAppID(req.body.app.id)
      const settings = await this.settingsModel.getByAppID('5f7dcb6077ae66000cc7864f')
      if (settings.length <= 0) return res.status(400).send({ error: 'Token de Autenticação inválido' })

      await this.protocolsController.create(settings[0], req.body)
      
      return res.status(200).send('ok')
    } catch (err) {
      return res.status(500).send(err)
    }
  }
}
