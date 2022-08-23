const table = 'contacts'

export default class ContactsModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['id'])
    } catch (err) {
      console.log('🚀 ~ file: ContactsModel.js ~ line 12 ~ ContactsModel ~ create ~ err', err)
      return err
    }
  }

  async getByUserID(settings, userID) {
    try {
      return await this.database(table).select('*').where('settings_id', settings.id).where('user_id', userID)
    } catch (err) {
      return err
    }
  }

  async getByID(settings, id) {
    try {
      return await this.database(table).select('*').where('settings_id', settings.id).where('id', id)
    } catch (err) {
      return err
    }
  }
}
