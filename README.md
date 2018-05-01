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

## Usage


### Get All buckets

Get All buckets for this account

```js
bucket.getAllBuckets().then(function(res) {
  /* Buckets => res.Buckets */
}).catch(function(err) {
  /* err */
});

/*
Result:
{
  Buckets:
   [ { Name: 'my-bucket',
       CreationDate: 2018-03-19T17:49:05.000Z } ],
  Owner:
   { DisplayName: 'cris',
     ID: '...' }
}
*/

```

### Get Upload URL

Get upload URL

```js
bucket.getUploadUrl({
  ContentType: 'application/javascript',
  Key: 'your-dir/test.js'
}).then(function(res){
  /* Signed URL => res.signedUrl */
}).catch(function(err){
  /* err */
});

/*
Result:
{
  signedUrl: 'https://your-bucket.s3.amazonaws.com/your-dir/test.js?AWSAccessKeyId=...'
}
*/
```

### Upload File 

```js
bucket.uploadFile({
  filePath: './test/upload-test.txt',
  Key: 'upload-test.txt'
}).then(function(res){
  /* res.url => S3 upload url */
}).catch(function(err){
  /* err */
});

/*
 Result:
{ response: { ETag: '"abc.."' },
  url: 'https://my-bucket.s3.amazonaws.com/upload-test.txt' }
*/
```

### List Files

```js
bucket.listFiles().then(function(res){
  /* res.contents => bucket contents */
}).catch(function(err){
  /* err */
});

/*
Result:
{ IsTruncated: false,
  Contents:
   [ { Key: 'upload-test.txt',
       LastModified: 2018-04-15T22:48:27.000Z,
       ETag: '"abc..."',
       Size: 26,
       StorageClass: 'STANDARD' } ],
  Name: 'my-bucket',
  Prefix: '',
  MaxKeys: 1000,
  CommonPrefixes: [],
  KeyCount: 1 }
*/
```


### Delete Files 

```js
bucket.deleteFiles({
    files: ['upload-test.txt']
  }).then(function(res){
  /* res.Deleted => Deleted contents */
  done();
}).catch(function(err){
  /* err */
});

/*
Result:
{ Deleted: [ { Key: 'upload-test.txt' } ], Errors: [] }
*/
```

