const multer = require('multer');
const { s3Storage } = require('./s3-storage');
const s3MediaConvert = require('./s3-media-convert');

function audioUpload(req, res, next) {
  const upload = multer({ storage: s3Storage }).single('file');

  upload(req, res, async function (err) {
      if (err) {
        console.log('Multer error:', err);
        // Handle multer errors properly
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({error: 'File too large'});
          } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({error: 'Too many files'});
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({error: 'Unexpected file field'});
          } else {
            return res.status(400).json({error: 'File upload error: ' + err.message});
          }
        } else {
          // Other errors
          return res.status(400).json({error: 'Upload error: ' + err.message});
        }
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({error: 'No file uploaded'});
      }
      
      try {
        const url = req.file?.path ?? req.file?.location;
        if (!url) {
          return res.status(400).json({error: 'File upload failed - no file location'});
        }
        const job = await s3MediaConvert.run(url);
        req.file.job = job;
        next();
      } catch (error) {
        console.log('Error processing file:', error);
        return res.status(500).json({error: 'Error processing file: ' + error.message});
      }
  })
}


function checkJob(jobId){
  return s3MediaConvert.checkJob(jobId);
}

module.exports = {
  audioUpload,
  checkJob
};