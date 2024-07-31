import dotenv from 'dotenv'
import server from './config/server.js'
import MessagesController from './controllers/MessagesController.js'
import { closeConnection } from './config/rabbitMQ.js'

dotenv.config()

let messagesController;

async function initializeApp() {
  try {
    messagesController = new MessagesController(server.database)
    await messagesController.initialize()
    console.log('MessageController inicializado com sucesso')
    console.log('Estado de global.amqpConn:', global.amqpConn ? 'Definido' : 'Não definido')
    console.log('Monitoramento ativo:', messagesController.monitorInterval ? 'Sim' : 'Não')
  } catch (error) {
    console.error('Erro ao inicializar MessageController:', error)
    console.log('Estado de global.amqpConn:', global.amqpConn ? 'Definido' : 'Não definido')
    console.log('Tentando reiniciar em 5 segundos...')
    setTimeout(initializeApp, 5000)
  }
}

initializeApp()

server.server

process.on('SIGINT', async () => {
  console.log('Encerrando aplicação...')
  if (messagesController) {
    messagesController.stopMonitoring()
  }
  await closeConnection()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promessa rejeitada não tratada:', reason);
});