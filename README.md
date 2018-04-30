# s3-bucket-version

S3 Bucket Version made easy

## Install

```bash
$ npm i s3-bucket-version --save
```

## Configure

```js
const AWSBucket = require('s3-bucket-version');

const bucket = new AWSBucket({
  accessKeyId: 'your-access-key-here',
  secretAccessKey: 'your-secret-here',
  region: 'us-east-1',
  bucketName: 'my-bucket'
});

```
