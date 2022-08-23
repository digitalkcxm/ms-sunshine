import moment from 'moment'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const region = process.env.BUCKETREGION || 'sa-east-1'
const bucketName = process.env.BUCKET
const s3 = new S3Client({
  region,
  createntials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
})

export default class StorageService {
  async upload(dirBucket, dirFile, fileName, contentType, bucket, publicAccess = false, tokenCompany = 'companyNaoIdentificada') {
    if (!bucket) bucket = bucketName
    try {
      const key = `${dirBucket}/${tokenCompany}/${moment().format('DD-MM-YYYY')}/${fileName}`

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: dirFile,
          ACL: publicAccess ? 'public-read' : 'private',
          ContentType: contentType
        })
      )

      if (region === 'us-east-1') {
        return {
          fileName,
          url: `https://${bucket}.s3.amazonaws.com/${dirBucket}/${key}`
        }
      }

      return {
        fileName,
        url: `https://${bucket}.s3-${region}.amazonaws.com/${key}`
      }
    } catch (err) {
      return err
    }
  }

  async getSignedUrl(bucket, key) {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Expires: 36000
      }),
      { expiresIn: 36000 }
    )
  }
}
