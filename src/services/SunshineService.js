import axios from 'axios'

export default class SunshineService {
  _instance(settings) {
    return axios.create({
      baseURL: process.env.URL,
      headers: {
        Authorization: `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString('base64')}`
      }
    })
  }

  async listSwitchboardIntegrations(settings, switchboardID) {
    try {
      return await this._instance(settings).get(`/v2/apps/${settings.appID}/switchboards/${switchboardID}/switchboardIntegrations`)
    } catch (err) {
      return err
    }
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

  async closedConversation(settings, conversationID, switchboardIntegrationsID, avoidPSATBot = true, session_id, details_tab, protocol) {
    try {      
      const result = await this._instance(settings).post(`/v2/apps/${settings.appID}/conversations/${conversationID}/passControl`, {
        switchboardIntegration: switchboardIntegrationsID,
        protocol: protocol,
        avoidPSATBot: avoidPSATBot,
        session_id: session_id,
        details_tab: details_tab
      })

      console.log('RETORNO DO FINALIZAR O CHAT E ENVIAR AS INFOMAÇÕES DO BYPASS', result)
      
      return result
    } catch (err) {
      return err
    }
  }
}
