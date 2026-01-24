const multerS3 = require('multer-s3')
const config = require('../../config');

const { S3Client } = require("@aws-sdk/client-s3");

const uuid = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

let s3 = null;
let s3Storage = null;

if (config.s3Bucket) {
  s3 = new S3Client(config.s3);
  s3Storage = multerS3({
    s3: s3, // s3 instance
    bucket: config.s3Bucket, // change it as per your project requirement
    metadata: (req, file, cb) => {
      cb(null, {fieldname: file.fieldname})
    },
    key: (req, file, cb) => {
      const fileName = uuid.v4() + '_' + Date.now() + "_" + file.originalname;
      cb(null, fileName);
    }
  });
} else {
  // fallback to local disk storage for development
  const uploadDir = path.join(__dirname, '../../uploads');
  if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  s3Storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const fileName = uuid.v4() + '_' + Date.now() + "_" + file.originalname;
      cb(null, fileName);
    }
  });
}

module.exports = {
  s3,
  s3Storage
};