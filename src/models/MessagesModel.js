const table = 'messages'

export default class MessagesModel {
  constructor(database) {
    this.database = database
  }

  async create(obj) {
    try {
      return await this.database(table).insert(obj).returning(['id', 'protocol_id', 'type', 'content', 'source', 'created_at'])
    } catch (err) {
      return err
    }
  }

  async getByMID(mid) {
    try {
      return await this.database(table).select('*').where('mid', mid)
    } catch (err) {
      console.log('🚀 ~ file: MessageModel.js ~ line 17 ~ MessageModel ~ getByMID ~ err', err)
      return err
    }
  }
}
