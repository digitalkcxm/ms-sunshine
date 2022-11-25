import moment from 'moment'
import CoreService from '../services/CoreService.js'
import SettingsModel from '../models/SettingsModel.js'
import ContactsModel from '../models/ContactsModel.js'
import MessagesController from './MessagesController.js'
import ProtocolsModel from '../models/ProtocolsModel.js'
import CompaniesModel from '../models/CompaniesModel.js'
import SunshineService from '../services/SunshineService.js'
import MSCompanyService from '../services/MSCompanyService.js'
import SwitchboardsModel from '../models/SwitchboardsModel.js'

export default class ProtocolsController {
  constructor(database) {
    this.coreService = new CoreService()
    this.sunshineService = new SunshineService()
    this.msCompanyService = new MSCompanyService()
    this.settingsModel = new SettingsModel(database)
    this.contactsModel = new ContactsModel(database)
    this.protocolsModel = new ProtocolsModel(database)
    this.companiesModel = new CompaniesModel(database)
    this.messagesController = new MessagesController(database)
    this.switchboardsModel = new SwitchboardsModel(database)
  }

  async create(settings, obj) {
    console.log('🚀 ~ file: ProtocolsController.js ~ line 26 ~ ProtocolsController ~ create ~ obj', obj.events[0].payload)
    try {
      if (obj.events[0].type === 'switchboard:passControl') {
        if (
          (
            await this.switchboardsModel.getBySwitchboardID(settings.id, obj.events[0].payload.conversation.activeSwitchboardIntegration.id)
          )[0].source === 'bot'
        ) {
          return true
        }
      }

      let protocol = await this.protocolsModel.getByConversationID(obj.events[0].payload.conversation.id)
      console.log('====================GET PROTOCOL ID====================')
      console.log('🚀 ~ file: ProtocolsController.js ~ line 40 ~ ProtocolsController ~ create ~ protocol', protocol)

      if (protocol.length <= 0 || (protocol.length > 0 && protocol[0].closed === true)) {
        let messages = await this.sunshineService.listConversations(settings, obj.events[0].payload.conversation.id)

        let user = await this.contactsModel.getByUserID(
          settings,
          messages.data.messages.filter((obj) => obj.author.userId)[0].author.userId
        )
        console.log('🚀 ~ file: ProtocolsController.js ~ line 46 ~ ProtocolsController ~ create ~ user', user)

        if (user.length <= 0) {
          user = (await this.sunshineService.getUser(settings, messages.data.messages[0].author.userId)).data.user
          console.log('🚀 ~ file: ProtocolsController.js ~ line 50 ~ ProtocolsController ~ create ~ user', user)
          user = await this.contactsModel.create({
            settings_id: settings.id,
            user_id: user.id,
            name: user.profile.givenName ? user.profile.givenName : 'Cliente',
            email: user.profile.email ? user.profile.email : '',
            locale: user.profile.locale ? user.profile.locale : '',
            customer: user.metadata.customer ? user.metadata.customer : '',
            cpf_cnpj: user.metadata.CpfCnpj ? user.metadata.CpfCnpj : '',
            phone: user.metadata.phoneNumber ? user.metadata.phoneNumber : '',
            client: user.metadata.client ? user.metadata.client : '',
            authentications: user.metadata.authentications ? moment(user.metadata.authentications).format() : moment().format(),
            count_security: user.metadata.CountSecurity ? user.metadata.CountSecurity : 0,
            client_authentication: user.metadata.ClientAuthentication ? user.metadata.ClientAuthentication : false,
            has_payment_info: user.metadata.hasPaymentInfo ? user.metadata.hasPaymentInfo : false,
            signed_up_at: user.metadata.signedUpAt ? moment(user.metadata.signedUpAt).format() : moment().format()
          })
          console.log('🚀 ~ file: ProtocolsController.js ~ line 67 ~ ProtocolsController ~ create ~ user', user)
        }
        console.log('🚀 ~ file: ProtocolsController.js ~ line 75 ~ ProtocolsController ~ create ~ user', user)
        protocol = await this.protocolsModel.create({
          settings_id: settings.id,
          conversation_id: obj.events[0].payload.conversation.id,
          contact_id: user[0].id,
          priority:
            obj.events[0].payload.metadata['dataCapture.ticketField.department'] != ''
              ? obj.events[0].payload.metadata['dataCapture.ticketField.department']
              : null,
          session_id: obj.events[0].payload.metadata.sessionId
        })

        let saveMessages = []
        for (const message of messages.data.messages) {
          if (message.content.type !== 'text')
            message.content.text = JSON.stringify([
              { url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }
            ])
          let msg = (await this.messagesController._saveMessage(protocol[0].id, message))[0]
          if (msg !== undefined) {
            msg.type !== 'text' ? (msg.content = JSON.parse(msg.content)) : ''
            saveMessages.push(msg)
          }
        }

        const company = await this.msCompanyService.getByID((await this.companiesModel.getByID(settings.company_id))[0].ms_company_id)

        if (obj.events[0].payload.conversation.metadata && obj.events[0].payload.conversation.metadata.status)
          obj.events[0].payload.conversation.metadata.mensagemErro = obj.events[0].payload.metadata.mensagemErro

        this.coreService.createProtocol(
          company.data.url_api,
          protocol,
          saveMessages,
          user,
          obj.events[0].payload.conversation.metadata ? obj.events[0].payload.conversation.metadata : '',
          obj.events[0].payload.metadata['dataCapture.ticketField.department'] == '230147' ? true : false,
          obj.events[0].payload.metadata.sessionId
        )
        console.log('====================CRIOU UM NOVO PROTOCOLO====================')
        return true
      } else {
        if (
          obj.events[0].payload.message &&
          obj.events[0].payload.message.author &&
          obj.events[0].payload.message.author.type !== 'business'
        )
          this.messagesController.incomingFromSunshine(settings, protocol, obj.events[0].payload.message)
      }
      return { message: 'Protocolo criado com sucesso!' }
    } catch (err) {
      console.error('🚀 ~ file: ProtocolsController.js ~ line 65 ~ ProtocolsController ~ create ~ err', err)
      return err
    }
  }

  async closedProtocol(req, res) {
    try {
      if (!req.headers.authorization) return res.status(400).send({ error: 'Campo "authorization" não encontrado.' })

      const infos = await Promise.all([
        this.companiesModel.getByCompanyID(req.headers.authorization),
        this.protocolsModel.update(req.body.protocol_id, { closed: true })
      ])

      if (infos[0].length < 1 || infos[0].code === '22P02') return res.status(400).send({ error: 'Company inválida.' })

      const settings = await this.settingsModel.getByID(infos[0][0].id, infos[1][0].settings_id)
      if (settings) {
        const switchboard = await this.switchboardsModel.getBySwitchboardBySource(settings[0].id, 'bot')
        this.sunshineService.closedConversation(settings[0], infos[1][0].conversation_id, switchboard[0].switchboardIntegrationsID)
      }
      return res.status(200).send({ message: 'Protocolo finalizado.' })
    } catch (err) {
      return res.status(500).send(err)
    }
  }

  async getNPS(req, res) {
    try {
      if (!req.headers.authorization) return res.status(400).send({ error: 'Campo "authorization" não encontrado.' })

      const infos = await Promise.all([
        this.companiesModel.getByCompanyID(req.headers.authorization),
        this.protocolsModel.getByID(req.params.id)
      ])

      if (infos[0].length < 1 || infos[0].code === '22P02') return res.status(400).send({ error: 'Company inválida.' })

      const settings = await this.settingsModel.getByID(infos[0][0].id, infos[1][0].settings_id)

      let messages = await this.sunshineService.listConversations(settings[0], infos[1][0].conversation_id)
      console.log('🚀 ~ file: ProtocolsController.js ~ line 155 ~ ProtocolsController ~ getNPS ~ messages', messages.data.messages)

      let saveMessages = []
      for (const message of messages.data.messages) {
        if (message.content.type !== 'text')
          message.content.text = JSON.stringify([
            { url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }
          ])
        let msg = (await this.messagesController._saveMessage(infos[1][0].id, message))[0]
        if (msg !== undefined) {
          msg.type !== 'text' ? (msg.content = JSON.parse(msg.content)) : ''
          saveMessages.push(msg)
          if (message.content.text === 'A Comgás agradece o seu contato! 🙂') break
        }
      }

      return res.status(200).send(saveMessages)
    } catch (err) {
      console.log('🚀 ~ file: ProtocolsController.js ~ line 151 ~ ProtocolsController ~ getNPS ~ err', err)
      return res.status(500).send(err)
    }
  }
}
