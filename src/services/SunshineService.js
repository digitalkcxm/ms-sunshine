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
    console.log('🚀 ~ file: SunshineService.js ~ line 31 ~ SunshineService ~ sendMessage ~ message', message)

    try {
      if (message.type !== 'text') {
        return await this._instance(settings).post(`/v2/apps/${settings.appID}/conversations/${conversationID}/messages`, {
          author: {
            type: 'business'
          },
          content: {
            type: message.content.type,
            mediaUrl: message.content.mediaUrl,
            altText: message.content.altText
          }
        })
      }
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

  async closedConversation(settings, conversationID) {
    console.log("🚀 ~ file: SunshineService.js ~ line 62 ~ SunshineService ~ closedConversation ~ settings, conversationID", settings, conversationID)
    try {
      return await this._instance(settings).post(`/v2/apps/${settings.appID}/conversations/${conversationID}/passControl`, {
        switchboardIntegration: '6012f685b35e43000c97ba1f'
      })
    } catch (err) {
      return err
    }
  }
}
