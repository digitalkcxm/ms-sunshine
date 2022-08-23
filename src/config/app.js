import cors from './cors.js'
import express from 'express'
import routes from './routes'
import bodyParser from 'body-parser'
import compression from 'compression'
import expressValidator from 'express-validator'

export default class App {
  constructor() {
    this.routes()
    this.middlewares()
    this.express = express()
  }

  middlewares() {
    this.express.use(compression())
    this.express.use(bodyParser.json({ limit: '256mb', extended: true }))
    this.express.use(bodyParser.urlencoded({ extended: true, limit: '256mb' }))
    this.express.use(expressValidator())
    cors(this.express)
  }

  routes() {
    this.express.use(routes)
  }
}
