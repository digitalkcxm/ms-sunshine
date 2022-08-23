import axios from 'axios'

export default class MSCompanyService {
  _instance(token) {
    return axios.create({
      baseURL: process.env.MSCOMPANY,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      }
    })
  }

  async getByID(id) {
    try {
      return await this._instance(id).get(`/company/token/${id}`)
    } catch (err) {
      return err
    }
  }
}
