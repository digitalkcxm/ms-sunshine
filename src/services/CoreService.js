import axios from 'axios'

export default class CoreService {
  _instance(url) {
    return axios.create({
      baseURL: url
    })
  }

  async createProtocol(url, protocol, messages, user, notify = '') {
    try {
      return await this._instance('http://localhost:5034').post('/api/v2/incoming/sunshine/protocol', { protocol, messages, user, notify })
    } catch (err) {
      console.log('🚀 ~ file: CoreService.js ~ line 14 ~ CoreService ~ createProtocol ~ err', err)
      return err
    }
  }

  async downloadFile(url) {
    try {
      return await this._instance(url).post('/api/v1/download_file', { url })
    } catch (err) {
      return err
    }
  }
}
