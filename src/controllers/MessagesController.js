import File from '../helpers/File.js'
import CoreService from '../services/CoreService.js'
import SunshineService from '../services/SunshineService.js'
import MessageModel from '../models/MessagesModel.js'
import ContactsModel from '../models/ContactsModel.js'
import SettingsModel from '../models/SettingsModel.js'
import ProtocolModel from '../models/ProtocolsModel.js'
import CompaniesModel from '../models/CompaniesModel.js'
import StorageService from '../services/StorageService.js'
import MSCompanyService from '../services/MSCompanyService.js'

export default class MessageController {
  constructor(database) {
    this.file = new File()
    this.coreService = new CoreService()
    this.sunshineService = new SunshineService()
    this.storageService = new StorageService()
    this.msCompanyService = new MSCompanyService()
    this.messageModel = new MessageModel(database)
    this.contactsModel = new ContactsModel(database)
    this.protocolModel = new ProtocolModel(database)
    this.settingsModel = new SettingsModel(database)
    this.companiesModel = new CompaniesModel(database)
  }

  async incomingFromSunshine(settings, protocol, message) {
    try {
      const infos = await this.companiesModel.getByID(settings.company_id)

      if (message.content.type !== 'text' && message.content.type !== 'location')
        message.content.text = JSON.stringify([
          { url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }
        ])

      if (message.content.type === 'location') message.content.type = 'text'

      let saveMessage = await this._saveMessage(protocol[0].id, message)
      if (message.content.type !== 'text') {
        global.amqpConn.sendToQueue(
          `mssunshine:${infos[0].ms_company_id}`,
          Buffer.from(
            JSON.stringify({
              id: saveMessage[0].protocol_id,
              message: JSON.parse(saveMessage[0].content),
              type: saveMessage[0].type,
              token: settings.id
            })
          )
        )
      } else {
        global.amqpConn.sendToQueue(
          `mssunshine:${infos[0].ms_company_id}`,
          Buffer.from(
            JSON.stringify({
              id: saveMessage[0].protocol_id,
              message: saveMessage[0].content,
              type: saveMessage[0].type,
              token: settings.id
            })
          )
        )
      }
      return true
    } catch (err) {
      console.log('🚀 ~ file: MessagesController.js ~ line 69 ~ MessageController ~ incomingFromBlip ~ err', err)
      return false
    }
  }

  async incomingFromCore() {
    try {
      const queueName = 'mssunshine_input'
      global.amqpConn.assertQueue(queueName, { durable: true })
      global.amqpConn.prefetch(1)
      global.amqpConn.consume(
        queueName,
        (msg) => {
          this.send(JSON.parse(msg.content.toString()))
        },
        { noAck: true }
      )
    } catch (err) {
      return err
    }
  }

  async send(msg) {
    try {
      const company = await this.companiesModel.getByCompanyID(msg.token)
      if (company.length < 1 || company.code === '22P02') return { error: 'Company inválida' }

      const infos = await Promise.all([this.settingsModel.getByCompanyID(company[0].id), this.protocolModel.getByID(msg.protocol_id)])

      let obj = {}

      if (msg.message.type === 'text') {
        obj.type = 'text'
        obj.content = msg.message.message
      } else {
        const bucket = msg.message.file[0].url.indexOf('prod') === -1 ? 'apis-storage-homol' : 'apis-storage-prod'

        obj.type = await this._setContentType(msg.message.file[0].type)

        obj.type = obj.type.substring(0, obj.type.indexOf('/'))
        obj.content = {
          altText: msg.message.file[0].name,
          type: obj.type,
          mediaUrl: await this.storageService.getSignedUrl(
            bucket,
            msg.message.file[0].url.replace(`https://s3.sa-east-1.amazonaws.com/${bucket}/`, '')
          )
        }
      }

      const result = await this.sunshineService.sendMessage(infos[0][0], infos[1][0].conversation_id, obj)
      if (result.status !== 201) return { error: 'Não foi possível enviar mensagem.' }

      this._saveMessage(infos[1][0].id, result.data.messages[0], 'operator')

      return { message: 'Mensagem enviada com sucesso!' }
    } catch (err) {
      console.log('🚀 ~ file: MessagesController.js ~ line 128 ~ MessageController ~ send ~ err', err)
      return err
    }
  }

  async _saveMessage(protocol, message, source = false) {
    try {
      return await this.messageModel.create({
        protocol_id: protocol,
        message_id: message.id,
        content:
          message.content.type === 'text'
            ? message.content.text
            : JSON.stringify([{ url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }]),
        type: message.content.type,
        source: !source ? message.source.type : source
        // received: moment(message.received).format()
      })
    } catch (err) {
      console.log('🚀 ~ file: MessagesController.js ~ line 145 ~ MessageController ~ _saveMessage ~ err', err)
      return err
    }
  }

  async _setContentType(type) {
    switch (type) {
      case 'jpg':
        return 'image/jpg'

      case 'jpeg':
        return 'image/jpeg'

      case 'png':
        return 'image/png'

      case 'mp4':
        return 'video/mp4'

      case 'mpeg':
        return 'audio/mpeg'

      case 'ogg':
        return 'audio/ogg'

      case 'plain':
        return 'text/plain'

      case 'html':
        return 'text/html'
      default:
        return 'file/'
    }
  }
}
