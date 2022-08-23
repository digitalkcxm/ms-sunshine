const table = 'protocols'

export default class ProtocolsModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['id', 'settings_id', 'conversation_id', 'closed', 'created_at'])
    } catch (err) {
      console.log(err)
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

  async getByConversationID(conversationID) {
    try {
      return await this.database(table).select('*').where('conversation_id', conversationID)
    } catch (err) {
      return err
    }
  }

  async update(id, obj) {
    try {
      return await this.database(table)
        .update(obj)
        .where('id', id)
        .returning(['id', 'setting_id', 'ticket_id', 'contact_id', 'closed', 'created_at'])
    } catch (err) {
      return err
    }
  }
}
