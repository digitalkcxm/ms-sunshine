import dotenv from 'dotenv'
import amqp from 'amqplib/callback_api.js'

dotenv.config()

let connection = null;
let channel = null; 

export default function queue() {
  return new Promise((resolve, reject) => {
    console.log('Iniciando conexão com RabbitMQ...')
    
    if (connection) {
      console.log('Fechando conexão existente...')
      connection.close((err) => {
        if (err) {
          console.error('Erro ao fechar conexão existente:', err)
        }
        console.log('Conexão existente fechada.')
        connection = null;
        channel = null;
        global.amqpConn = null;
        connectToRabbitMQ(resolve, reject);
      });
    } else {
      connectToRabbitMQ(resolve, reject);
    }
  })
}

function connectToRabbitMQ(resolve, reject) {
  amqp.connect(
    `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}?heartbeat=20`,
    (err, conn) => {
      if (err) {
        console.error('>> [AMQP] Erro de conexão:', err.message)
        reject(err)
        return
      }

      console.log('Conexão RabbitMQ estabelecida, criando canal...')
      connection = conn;

      conn.on('error', (err) => {
        if (err.message !== 'Connection closing') {
          console.error('[AMQP] Erro de conexão:', err.message)
        }
      })

      conn.on('close', () => {
        console.error('[AMQP] Conexão fechada, tentando reconectar...')
      })

      conn.createChannel((err, ch) => {
        if (err) {
          console.error('Erro ao criar canal RabbitMQ:', err)
          reject(err)
          return
        }

        console.log('Canal RabbitMQ criado com sucesso')
        channel = ch;
        global.amqpConn = ch
        resolve(ch)
      })
    }
  )
}

export function closeConnection() {
  return new Promise((resolve) => {
    if (connection) {
      console.log('Fechando conexão RabbitMQ...')
      connection.close(() => {
        console.log('Conexão RabbitMQ fechada.')
        connection = null;
        channel = null;
        global.amqpConn = null;
        resolve();
      });
    } else {
      console.log('Nenhuma conexão RabbitMQ para fechar.')
      resolve();
    }
  });
}