const table = 'companies'

export default class CompaniesModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['id', 'ms_company_id', 'created_at'])
    } catch (err) {
      return err
    }
  }

  async getAll() {
    try {
      return await this.database(table).select('*')
    } catch (err) {
      return err
    }
  }

  async getByID(id) {
    try {
      return await this.database(table).select('*').where('id', id)
    } catch (err) {
      return err
    }
  }

  async getByCompanyID(id) {
    try {
      return await this.database(table).select('*').where('ms_company_id', id)
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async getByPageID(id) {
    try {
      return await this.database(table).select('*').where('page_id', id)
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async update(id, obj) {
    try {
      return await this.database(table)
        .update(obj)
        .returning(['id', 'name', 'callback', 'token', 'activated', 'created_at'])
        .where('id', id)
    } catch (err) {
      console.log(err)
      return err
    }
  }

  async getByToken(token) {
    try {
      return await this.database(table).select('id', 'page_token').where(token)
    } catch (err) {
      return err
    }
  }
}
