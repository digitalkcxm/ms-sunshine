const table = 'switchboards_integrations'

export default class SettingsModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['*'])
    } catch (err) {
      console.log('🚀 ~ file: SwitchboardsModel.js ~ line 12 ~ SettingsModel ~ create ~ err', err)
      return err
    }
  }

  async getAll(settingsID) {
    try {
      return await this.database(table).select('*').where('settings_id', settingsID)
    } catch (err) {
      return err
    }
  }

  async getBySwitchboardID(settingsID, id) {
    try {
      return await this.database(table).select('*').where('settings_id', settingsID).where('switchboardIntegrationsID', id)
    } catch (err) {
      return err
    }
  }

  async getBySwitchboardBySource(settingsID, source) {
    try {
      return await this.database(table).select('*').where('settings_id', settingsID).where('source', source)
    } catch (err) {
      return err
    }
  }
}
