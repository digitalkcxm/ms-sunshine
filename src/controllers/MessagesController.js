import moment from 'moment'
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

      // if (message.content.type === 'image')
      //   message.content.mediaUrl = await this.file._downloadMedia(
      //     message.content.mediaUrl,
      //     message.content.mediaType,
      //     message.id,
      //     infos[0].ms_company_id
      //   )

      if (message.content.type !== 'text')
        message.content.text = JSON.stringify([
          { url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }
        ])

      let saveMessage = await this._saveMessage(protocol[0].id, message)

      if (message.type !== 'text') {
        global.amqpConn.sendToQueue(
          `mssunshine:${infos[0][0].ms_company_id}`,
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
        ;(obj.type = 'application/vnd.lime.media-link+json'),
          (obj.content = {
            title: msg.message.file[0].name,
            type: await this._setContentType(msg.message.file[0].type),
            uri: await this.storageService.getSignedUrl(
              bucket,
              msg.message.file[0].url.replace(`https://s3.sa-east-1.amazonaws.com/${bucket}/`, '')
            )
          })
      }

      const result = await this.sunshineService.sendMessage(infos[0][0], infos[1][0].conversation_id, obj)
      console.log('🚀 ~ file: MessagesController.js ~ line 121 ~ MessageController ~ send ~ result', result)
      if (result.status !== 202 && result.status !== 200) return { error: 'Não foi possível enviar mensagem.' }

      let messageInfos = JSON.parse(result.config.data)
      messageInfos.uri = msg.message.file !== null ? msg.message.file[0].url : msg.message.file

      this._saveMessage(infos[1], messageInfos, 'operator')

      return { message: 'Mensagem enviada com sucesso!' }
    } catch (err) {
      console.log('🚀 ~ file: MessagesController.js ~ line 128 ~ MessageController ~ send ~ err', err)
      return err
    }
  }

  async _saveMessage(protocol, message) {
    try {
      return await this.messageModel.create({
        protocol_id: protocol,
        message_id: message.id,
        content: message.content.text,
        type: message.content.type,
        source: message.source.type
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
        return 'application/octet-stream'
    }
  }
}
