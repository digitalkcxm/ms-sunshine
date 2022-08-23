import http from 'http'
import cors from './cors.js'
import express from 'express'
import routes from './routes.js'
import queue from './rabbitMQ.js'
import bodyParser from 'body-parser'
import moment from 'moment-timezone'
import compression from 'compression'
import database from './database/database.js'

const app = express()
const server = http.createServer(app)

app.use(compression())
app.use(bodyParser.json({ limit: '256mb', extended: true }))
app.use(bodyParser.urlencoded({ extended: true, limit: '256mb' }))
cors(app)

routes(app, database)
queue()

moment.tz.setDefault('America/Sao_Paulo')

if (process.env.NODE_ENV !== 'testing') server.listen(process.env.PORT, () => console.log(`Server running in port ${process.env.PORT}`))

export default { server, app, database}
