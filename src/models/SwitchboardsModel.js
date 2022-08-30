const table = 'switchboards_integrations'

export default class SettingsModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['*'])
    } catch (err) {
      console.log("🚀 ~ file: SwitchboardsModel.js ~ line 12 ~ SettingsModel ~ create ~ err", err)
      return err
    }
  }

  async getAll(company_id) {
    try {
      return await this.database(table).select('*').where('company_id', company_id)
    } catch (err) {
      return err
    }
  }

  async getByID(company_id, id) {
    try {
      return await this.database(table).select('*').where('company_id', company_id).where('id', id)
    } catch (err) {
      return err
    }
  }

  async update(id, obj) {
    try {
      return await this.database(table)
        .update(obj)
        .returning(['id', 'company_id', 'name', 'appID', 'username', 'password', 'activated', 'created_at'])
        .where('id', id)
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async getByAppID(appID) {
    try {
      return await this.database(table).select('*').where({ appID })
    } catch (err) {
      return err
    }
  }

  async getByCompanyID(company_id) {
    try {
      return await this.database(table).select('*').where('company_id', company_id)
    } catch (err) {
      return err
    }
  }
}
