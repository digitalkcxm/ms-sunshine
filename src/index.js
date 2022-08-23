import dotenv from 'dotenv'
import server from './config/server.js'
import MessagesController from './controllers/MessagesController.js'

const messagesController = new MessagesController(server.database)

dotenv.config()

setTimeout(() => {
  messagesController.incomingFromCore()
}, 1000)

server.server
