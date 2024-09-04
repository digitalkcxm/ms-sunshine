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
import queue, { closeConnection } from '../config/rabbitMQ.js';

export default class MessageController {
  static instance = null;
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
    this.monitorInterval = null
    this.connectionCheckInterval = null
    this.consumerConfigured = false
    this.consumerTag = null
    this.isReconnecting = false;
  }

  async initialize() {
    console.log('Iniciando inicialização do MessageController...')
    try {
      console.log('Aguardando conexão com RabbitMQ...')
      await queue() 
      if (!global.amqpConn) {
        throw new Error('global.amqpConn não foi definido após a conexão')
      }

      console.log('Conexão com RabbitMQ estabelecida com sucesso')

      await this.setupRetryQueue();

      this.connectionCheckInterval = setInterval(() => this.checkRabbitMQConnection(), 10)
      console.log('Intervalo de verificação de conexão configurado')

      console.log('Chamando incomingFromCore...')
      await this.incomingFromCore()
      console.log('Inicialização do MessageController concluída com sucesso')
    } catch (error) {
      console.error('Erro durante a inicialização do MessageController:', error)
      throw error
    }
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
      console.log(`Mensagem processada com sucesso para o protocolo: ${protocol[0].id}`)
      return true
    } catch (err) {
      console.error('Erro ao processar mensagem do Sunshine:', err)
      return false
    }
  }

  async incomingFromCore() {
    const queueName = 'mssunshine_input'
    console.log(`Iniciando configuração do consumidor para a fila ${queueName}`)
    try {
      if (!global.amqpConn) {
        console.error('global.amqpConn não está definido em incomingFromCore')
        throw new Error('Conexão RabbitMQ não disponível')
      }
      if (this.consumerConfigured) {
        console.log('Consumidor já configurado. Ignorando chamada adicional.')
        return
      }

      console.log('Afirmando a fila...')
      await new Promise((resolve, reject) => {
        global.amqpConn.assertQueue(queueName, { durable: true }, (err) => {
          if (err) {
            console.error('Erro ao afirmar a fila:', err)
            reject(err)
          } else {
            console.log('Fila afirmada com sucesso')
            resolve()
          }
        })
      })

      global.amqpConn.prefetch(1)
      console.log('Prefetch configurado para 1')

      console.log(`Configurando consumidor para a fila ${queueName}`)

      await new Promise((resolve, reject) => {
        global.amqpConn.consume(
          queueName,
          async (msg) => {
            if (msg !== null) {
              console.log(`Recebida mensagem: ${msg.content.toString()}`)
              try {
                const content = JSON.parse(msg.content.toString())
                await this.processMessageWithRetry(content, msg)
              } catch (error) {
                console.error('Erro ao processar mensagem:', error)
                this.handleMessageError(error, msg)
              }
            }
          },
          { noAck: false },
          (err, ok) => {
            if (err) {
              console.error('Erro ao configurar consumidor:', err)
              reject(err)
            } else {
              this.consumerTag = ok.consumerTag
              this.consumerConfigured = true
              console.log(`Consumidor configurado com sucesso. Tag: ${this.consumerTag}`)
              resolve()
            }
          }
        )
      })

      console.log('Consumidor configurado com sucesso')
      console.log('Iniciando monitoramento de consumidores...')
      this.monitorConsumers(queueName)
    } catch (err) {
      console.error('Erro ao configurar consumo de mensagens:', err)
      throw err
    }
  }

  async send(msg) {
      const company = await this.companiesModel.getByCompanyID(msg.token)
      if (company.length < 1 || company.code === '22P02') {
        console.error(`Company inválida para o token: ${msg.token}`)
        return { error: 'Company inválida' }
      }
      const [settings, protocol] = await Promise.all([
        this.settingsModel.getByCompanyID(company[0].id),
        this.protocolModel.getByID(msg.protocol_id)
      ])

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

      console.log(`Enviando mensagem para Sunshine: ${JSON.stringify(obj)}`)
      const result = await this.sunshineService.sendMessage(settings[0], protocol[0].conversation_id, obj)
      if (result.status !== 201) {
        console.error(`Erro ao enviar mensagem para Sunshine. Status: ${result.status}`)
        return { error: 'Não foi possível enviar mensagem.' }
      }

      await this._saveMessage(protocol[0].id, result.data.messages[0], 'operator')

      console.log(`Mensagem enviada com sucesso para o protocolo: ${protocol[0].id}`)
      return { message: 'Mensagem enviada com sucesso!' }

  }

  async _saveMessage(protocol, message, source = false) {
    try {
      const savedMessage = await this.messageModel.create({
        protocol_id: protocol,
        message_id: message.id,
        content:
          message.content.type === 'text'
            ? message.content.text
            : JSON.stringify([{ url: message.content.mediaUrl, type: message.content.mediaType, name: message.content.altText }]),
        type: message.content.type,
        source: !source ? message.source.type : source
      })
      console.log(`Mensagem salva com sucesso. ID: ${savedMessage[0].id}`)
      return savedMessage
    } catch (err) {
      console.error('Erro ao salvar mensagem:', err)
      throw err
    }
  }

  async _setContentType(type) {
    const contentTypes = {
      jpg: 'image/jpg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      mp4: 'video/mp4',
      mpeg: 'audio/mpeg',
      ogg: 'audio/ogg',
      plain: 'text/plain',
      html: 'text/html'
    }
    return contentTypes[type] || 'file/'
  }

  // ? RabbitMQ Functions

  monitorConsumers(queueName) {
    console.log(`Iniciando monitoramento de consumidores para a fila ${queueName}`)
    if (this.monitorInterval) {
      console.log('Monitoramento já está ativo. Ignorando chamada adicional.')
      return
    }
    this.monitorInterval = setInterval(() => {
      try {
        if (!global.amqpConn) {
          console.log('Conexão RabbitMQ não disponível. Tentando reconectar...')
          this.reconnectRabbitMQ()
          return
        }

        global.amqpConn.checkQueue(queueName, (err, ok) => {
          if (err) {
            console.error('Erro ao verificar a fila:', err)
            this.reconnectRabbitMQ()
            return
          }

          const consumerCount = ok.consumerCount

          if (consumerCount === 0) {
            console.warn(`Nenhum consumidor ativo para a fila ${queueName}. Reconectando...`)
            this.consumerConfigured = false
            this.reconnectRabbitMQ()
          }
        })
      } catch (error) {
        console.error('Erro ao verificar consumidores:', error)
        this.reconnectRabbitMQ()
      }
    }, 1000) // 60 seconds
    console.log(`Monitoramento de consumidores iniciado para a fila ${queueName}`)
  }

  cancelExtraConsumers(queueName, count) {
    if (!this.consumerTag) {
      console.error('Tag do consumidor não disponível. Não é possível cancelar consumidores extras.');
      return;
    }
    for (let i = 1; i < count; i++) {
      global.amqpConn.cancel(this.consumerTag, (err) => {
        if (err) {
          console.error(`Erro ao cancelar consumidor extra: ${err}`);
        } else {
          console.log(`Consumidor extra cancelado com sucesso.`);
        }
      });
    }
  }

  stopAllMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    console.log('Todos os monitoramentos foram interrompidos');
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
      console.log('Monitoramento de consumidores interrompido')
    }
  }

  async processMessage(msg) {
    console.log(`Processando mensagem: ${JSON.stringify(msg)}`)
    await this.send(msg)
  }

  isRecoverableError(error) {
    return !error.fatal
  }
  
  async setupRetryQueue() {
    const retryQueueName = 'mssunshine_input_retry';
    const mainQueueName = 'mssunshine_input';

    await global.amqpConn.assertQueue(retryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: mainQueueName,
      messageTtl: 10000 // 10 seg
    });

    console.log(`Fila de retry ${retryQueueName} configurada com sucesso`);
  }
  
  async processMessageWithRetry(content, msg) {
    const messageId = msg.properties.messageId || 'unknown';
    let retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;

    try {
      await this.processMessage(content)
      global.amqpConn.ack(msg)
      console.log('Mensagem processada e confirmada')
    } catch (error) {
      console.error('Erro ao processar mensagem:', error)
      console.log(`Tentativa ${retryCount} de 3. Enviando para fila de retry.`)
      retryCount++;

      if (retryCount <= 4) {
        global.amqpConn.sendToQueue('mssunshine_input_retry', msg.content, {
          headers: { 'x-retry-count': retryCount },
          messageId: messageId
        })
        global.amqpConn.ack(msg)
      } else {
        console.log('Dead Queue: Máximo de tentativas atingido')
        global.amqpConn.nack(msg, false, false)
      }
    }
  }

  handleMessageError(error, msg) {
    const messageId = msg.properties.messageId || 'unknown';
    let retryCount = (msg.properties.headers && msg.properties.headers['x-retry-count']) || 0;
    
    console.log(`Erro recuperável, tentativa ${retryCount} de 3. Recolocando mensagem na fila de retry`)
    retryCount++;
    if (this.isRecoverableError(error) && retryCount <= 4) {
      global.amqpConn.sendToQueue('mssunshine_input_retry', msg.content, {
        headers: { 'x-retry-count': retryCount },
        messageId: messageId
      })
      global.amqpConn.ack(msg)
    } else {
      if (retryCount >= 3) {
        console.log('Máximo de tentativas atingido, movendo para dead-letter queue')
      } else {
        console.log('Erro não recuperável, descartando mensagem')
      }
      global.amqpConn.nack(msg, false, false)
    }
  }

  async reconnectRabbitMQ() {
    if (this.isReconnecting) {
      console.log('Já existe uma tentativa de reconexão em andamento. Aguardando...');
      return;
    }

    this.isReconnecting = true;
    console.log('Tentando reconectar ao RabbitMQ...');

    try {
      await closeConnection();
      await queue();
      if (!global.amqpConn) {
        throw new Error('Falha ao reconectar: global.amqpConn não foi definido');
      }
      console.log('Reconexão bem-sucedida');
      this.consumerConfigured = false;
      await this.incomingFromCore();
    } catch (error) {
      console.error('Erro ao reconectar:', error);
      setTimeout(() => this.reconnectRabbitMQ(), 5000);
    } finally {
      this.isReconnecting = false;
    }
  }


  checkRabbitMQConnection() {
    if (!global.amqpConn) {
      console.log('Conexão RabbitMQ não disponível. Tentando reconectar...')
      this.reconnectRabbitMQ()
      return
    }
    
    global.amqpConn.checkQueue('mssunshine_input', (err) => {
      if (err) {
        console.error('Erro na conexão com RabbitMQ:', err)
        this.reconnectRabbitMQ()
      }
    })
  }
}



