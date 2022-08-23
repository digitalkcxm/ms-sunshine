import got from 'got'
import FileType from 'file-type'

async function getFileTypeRemote(url) {
  const type = await new Promise(async (resolve, reject) => {
    const stream = got.stream(url)
    const extension = await FileType.fromStream(stream)
    resolve(extension)
  })

  return type
}

export default getFileTypeRemote
