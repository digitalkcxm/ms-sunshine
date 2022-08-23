import moment from 'moment'
import SettingsModel from '../models/SettingsModel.js'
import CompaniesModel from '../models/CompaniesModel.js'
import MSCompanyService from '../services/MSCompanyService.js'

export default class SettingsController {
  constructor(database) {
    this.msCompanyService = new MSCompanyService()
    this.settingsModel = new SettingsModel(database)
    this.companiesModel = new CompaniesModel(database)
  }
  async create(req, res) {
    try {
      let company = await this.companiesModel.getByCompanyID(req.headers.authorization)

      if (company.length === 0) {
        if ((await this.msCompanyService.getByID(req.headers.authorization)).data !== undefined)
          company = await this.companiesModel.create({ ms_company_id: req.headers.authorization })
      }

      const result = await this.settingsModel.create({
        company_id: company[0].id,
        name: req.body.name,
        appID: req.body.appID,
        username: req.body.username,
        password: req.body.password
      })

      if (result && result.code && result.code === '23505')
        return res.status(400).send({ Error: `O nome '${req.body.name}' já existe na base.` })

      return res.status(200).send(result[0])
    } catch (err) {
      console.log('🚀 ~ file: SettingsController.js ~ line 34 ~ SettingsController ~ create ~ err', err)
      return res.status(500).send(err)
    }
  }

  async getAll(req, res) {
    try {
      if (!req.headers.authorization) return res.status(400).send({ error: 'Campo "authorization" não encontrado.' })

      const company = await this.companiesModel.getByCompanyID(req.headers.authorization)
      if (company.length < 1 || company.code === '22P02') return res.status(400).send({ error: 'Company inválida.' })

      return res.status(200).send(await this.settingsModel.getAll(company[0].id))
    } catch (err) {
      return res.status(500).send(err)
    }
  }

  async getByID(req, res) {
    try {
      if (!req.headers.authorization) return res.status(400).send({ error: 'Campo "authorization" não encontrado.' })

      const company = await this.companiesModel.getByCompanyID(req.headers.authorization)
      if (company.length < 1 || company.code === '22P02') return res.status(400).send({ error: 'Company inválida.' })

      return res.status(200).send((await this.settingsModel.getByID(company[0].id, req.params.id))[0])
    } catch (err) {
      return res.status(500).send(err)
    }
  }

  async update(req, res) {
    try {
      if (!req.headers.authorization) return res.status(400).send({ error: 'Campo "authorization" não encontrado.' })

      const company = await this.companiesModel.getByCompanyID(req.headers.authorization)
      if (company.length < 1 || company.code === '22P02') return res.status(400).send({ error: 'Company inválida.' })

      let obj = { updated_at: moment() }

      req.body.name ? (obj.name = req.body.name) : ''
      req.body.url ? (obj.url = req.body.url) : ''
      req.body.token ? (obj.token = req.body.token) : ''
      req.body.activated ? (obj.activated = req.body.activated) : ''

      const result = await this.settingsModel.update(req.params.id, obj)
      if (result && result.code && result.code === '22P02')
        return res.status(400).send({ error: 'Não foi possivel atualizar a configuração.' })

      if (result.length === 0) return res.status(400).send({ error: 'Configuração não encontrada.' })

      return res.status(200).send(result[0])
    } catch (err) {
      return res.status(500).send(err)
    }
  }
}
