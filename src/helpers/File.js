import fs from 'fs'
import axios from 'axios'
import getFileTypeRemote from '../services/FileService.js'
import StorageService from '../services/StorageService.js'

const storageService = new StorageService()

export default class File {
  async _uploadDigitalk(buff, name, tokenCompany, contentType) {
    const bucketDir = process.env.APP_NAME || 'mssunshine'
    const resultLinkFile = await storageService.upload(bucketDir, buff, name, contentType, process.env.BUCKET, true, tokenCompany)
    return resultLinkFile
  }

  async _downloadMedia(link, contentType,  id, tokenCompany) {
    try {
      const getFileFromUrl = await axios({
        method: 'GET',
        url: link,
        responseType: 'arraybuffer'
      })
      const ext = await getFileTypeRemote(link)
      let name = id + '.' + ext.ext

      const bufferData = Buffer.from(getFileFromUrl.data, 'base64')

      const upload = await this._uploadDigitalk(bufferData, name, tokenCompany, contentType)
      console.log("🚀 ~ file: File.js ~ line 28 ~ File ~ _downloadMedia ~ upload", upload)

      return upload
    } catch (err) {
      console.log('ERROR DOWNLOAD MEDIA==>>', err)
    }
  }

  async _sanitizeFileType(url) {
    let type = 'text'
    const fileType = await getFileTypeRemote(url)
    if (typeof fileType === 'object' && Object.keys(fileType).includes('ext')) {
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(fileType.ext)) {
        type = 'image'
      } else if (['mp3', 'ogg'].includes(fileType.ext)) {
        type = 'audio'
      } else if (['mp4', 'mpeg', 'avi'].includes(fileType.ext)) {
        type = 'video'
      } else {
        type = 'document'
      }
    }

    return type
  }

  async removeFile(name) {
    fs.unlinkSync(`/tmp/${name}`)
  }
}
