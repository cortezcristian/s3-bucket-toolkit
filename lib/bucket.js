var fs = require('fs');
var AWS = require('aws-sdk');
var Promise = require('bluebird');
var promisify = Promise.promisify;

// FS
var getFilesizeInBytes = function(filename) {
  if (typeof filename === 'undefined') {
    throw new Error('File path was expected');
  }
  var stats = fs.statSync(filename);
  // console.log(filename);
  // console.log(stats);
  // TODO: double check size != 0

  var fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};

// Params check
var checkParams = function(params, mandatory) {
  if (typeof params === 'undefined') {
    throw new Error('Parameters are required');
  }
  if (typeof mandatory === 'undefined') {
    throw new Error('Mandatory flags are required');
  }
  // https://stackoverflow.com/a/41981796/467034
  return mandatory.every(function(prop) {
    return typeof params[prop] !== 'undefined';
  });
}

// AWS Config
var AWSConfig = {
  accessKeyId: null,
  secretAccessKey: null,
  region: null
};

// Bucket class
var Bucket = function (params) {
  var flags = ['accessKeyId', 'secretAccessKey', 'region', 'bucketName'];
  var hasAllFlags = checkParams(params, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to create bucket instance due parameters missing');
  }
  // Setup S3
  AWSConfig.accessKeyId = params.accessKeyId;
  AWSConfig.secretAccessKey = params.secretAccessKey;
  AWSConfig.region = params.region;

  // AWS S3 Docs
  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
  this.S3 = new AWS.S3(AWSConfig);
  this.bucketName = params.bucketName;
  this.bucketACL = params.bucketACL || 'public-read';
};

/*
Get All buckets for this account
Result:
 {
  Buckets:
   [ { Name: 'your-bucket-name',
       CreationDate: 2018-03-19T17:49:05.000Z } ],
  Owner:
   { DisplayName: 'ann',
     ID: '...' }
 }
*/
Bucket.prototype.getAllBuckets = function() {
  var S3 = this.S3;
  var listBuckets = promisify(S3.listBuckets).bind(S3);
  return listBuckets();
};

/*
Usage:

Result:
{ signedUrl: 'https://your-bucket-name.s3.amazonaws.com/your-dir/test.js?AWSAccessKeyId=...' }
*/
Bucket.prototype.getUploadUrl = function (customParams) {
  var flags = ['ContentType', 'Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to get upload url instance due parameters missing');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName || '';
  var bucketACL = this.bucketACL || '';

  var defaultParams = {
    Expires: 60,
    ACL: bucketACL,
    Bucket: bucketName
  };
  var params = Object.assign(defaultParams, customParams);

  var getSignedUrlPromise = promisify(S3.getSignedUrl).bind(S3);

  return new Promise(function(resolve, reject) {
    getSignedUrlPromise('putObject', params)
      .then(function(signedUrl) { return resolve({signedUrl: signedUrl}); })
      .catch(reject);
  });
};

/*
 Usage:

 Result:
{ response: { ETag: '"abc..."' },
  url: 'https://your-bucket-name.s3.amazonaws.com/upload-test.txt' }
*/
Bucket.prototype.uploadFile = function(customParams) {
  var flags = ['filePath', 'Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to upload files due parameters missing');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName || '';
  var bucketACL = this.bucketACL || '';

  var filePath = customParams.filePath;
  var defaultParams = {
    ACL: bucketACL,
    Bucket: bucketName,
    ContentLength: getFilesizeInBytes(filePath),
    Body: fs.createReadStream(filePath)
  };
  var params = Object.assign(defaultParams, customParams);
  delete params.filePath;

  // Params
  var Bucket = params.Bucket;
  var Key = params.Key;

 //  console.log("AWS UPLOAD==>", params);

  var putObjectPromise = promisify(S3.putObject).bind(S3);
  return new Promise(function (resolve, reject) {
    return putObjectPromise(params)
      .then(function(response) {
        var url = `https://${Bucket}.s3.amazonaws.com/${Key}`;
        resolve(Object.assign({
          response: response,
          url: url
        }));
      })
      .catch(reject);
  });
};

Bucket.prototype.listFileVersions = function(customParams) {
  var flags = ['Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to list file versions due parameters missing');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName || '';
  var filePrefix = customParams.Key;
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
  var params = {
    Bucket: bucketName,
    Prefix: filePrefix
  };

  var listObjectVersionsPromise = promisify(S3.listObjectVersions).bind(S3);
  return new Promise(function (resolve, reject) {
    return listObjectVersionsPromise(params)
      .then(function(fileVersions) { resolve(fileVersions); })
      .catch(reject);
  });
};


/*

Usage:


Result:
{ IsTruncated: false,
  Contents:
   [ { Key: 'upload-test.txt',
       LastModified: 2018-04-15T22:48:27.000Z,
       ETag: '"abc..."',
       Size: 26,
       StorageClass: 'STANDARD' } ],
  Name: 'your-bucket-name',
  Prefix: '',
  MaxKeys: 1000,
  CommonPrefixes: [],
  KeyCount: 1 }
*/
Bucket.prototype.listFiles = function (customParams) {
  var customBucketName = false;
  if (typeof customParams !== 'undefined'
    && typeof customParams.bucketName === 'string') {
    customBucketName = customParams.bucketName;
  }

  var S3 = this.S3;
  var bucketName = customBucketName || this.bucketName;

  var defaultParams = {
    Bucket: bucketName
  };
  var params = Object.assign(defaultParams, customParams);

  var listObjectsPromise = promisify(S3.listObjectsV2).bind(S3);
  return new Promise(function (resolve, reject) {
    listObjectsPromise(params)
      .then(function(files) { resolve(files); })
      .catch(reject);
  });
};

/*
Usage:

Result:
{ Deleted: [ { Key: 'upload-test.txt' } ], Errors: [] }
*/
Bucket.prototype.deleteFiles = function (customParams) {
  var flags = ['files'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to upload files due parameters missing');
  }
  if (typeof customParams.files !== 'object'
    || typeof customParams.files.length < 1) {
    throw new Error('Files array should not be empty');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName;

  var files = customParams.files.map(file => ({Key: file}));
  var params = {
    Bucket: bucketName,
    Delete: {
      Objects: files
    }
  };
  var deleteObjectsPromise = promisify(S3.deleteObjects).bind(S3);
  return new Promise(function (resolve, reject) {
    deleteObjectsPromise(params)
      .then(function (response) { resolve(response); })
      .catch(reject);
  });
};

Bucket.prototype.updateCredentials = function(credentials) {
  if (typeof credentials === 'undefined') {
    throw new Error('Credentials parameter is mandatory');
  }
  this.S3.config.update({
    credentials: new AWS.Credentials(credentials)
  });
};

Bucket.prototype.updateRegion = function(region) {
  if (typeof region === 'undefined') {
    throw new Error('Region parameter is mandatory');
  }
  this.S3.config.update({region: region})
};

Bucket.prototype.updateBucketName = function(name) {
  if (typeof name === 'undefined') {
    throw new Error('Name parameter is mandatory');
  }
  this.bucketName = name;
};

module.exports = Bucket;
