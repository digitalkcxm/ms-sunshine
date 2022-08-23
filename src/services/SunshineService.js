import axios from 'axios'
import { v4 } from 'uuid'

export default class SunshineService {
  _instance(settings) {
    return axios.create({
      baseURL: process.env.URL,
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
      }
    })
  }

  async listConversations(settings, conversationID) {
    try {
      return await this._instance(settings).get(`/v2/apps/${settings.appID}/conversations/${conversationID}/messages`)
    } catch (err) {
      return err
    }
  }

  async getUser(settings, userID) {
    try {
      return await this._instance(settings).get(`/v2/apps/${settings.appID}/users/${userID}`)
    } catch (err) {
      return err
    }
  }

  async sendMessage(settings, conversationID, message) {
    try {
      return await this._instance(settings).post(`/v2/apps/${settings.appID}/conversations/${conversationID}/messages`, {
        author: {
          type: 'business'
        },
        content: {
          type: message.type,
          text: message.content
        }
      })
    } catch (err) {
      console.log('🚀 ~ file: SunshineService.js ~ line 42 ~ SunshineService ~ sendMessage ~ err', err)
      return err
    }
  }
}