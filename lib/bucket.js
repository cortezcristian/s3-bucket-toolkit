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
  // default paging delay in between calls
  this.pagingDelay = params.pagingDelay || 500;
};

/*
Get All buckets for this account
Result:
 {
  Buckets:
   [ { Name: 'your-bucket-name',
       CreationDate: 2018-03-19T17:49:05.000Z } ],
  Owner:
   { DisplayName: 'cris',
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

  var putObjectPromise = promisify(S3.upload).bind(S3);
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

/*

 Usage:

 Result:
{ response: { ETag: '"abc..."', CopySourceVersionId: 'def...', CopyObjectResult: { ... } },
  url: 'https://your-bucket-name.s3.amazonaws.com/upload-test-copied.txt' } }
 */

Bucket.prototype.copyFile = function(customParams) {
  var flags = ['CopySource', 'Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to copy files due parameters missing');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName || '';
  var bucketACL = this.bucketACL || '';

  var defaultParams = {
    ACL: bucketACL,
    Bucket: bucketName,
  };
  var params = Object.assign(defaultParams, customParams);

  // Params
  var Bucket = params.Bucket;
  var Key = params.Key;

  // console.log("AWS COPY==>", params);

  var copyObjectPromise = promisify(S3.copyObject).bind(S3);
  return new Promise(function (resolve, reject) {
    return copyObjectPromise(params)
      .then(function(response) {
        // console.log('cp => ', response);
        var url = `https://${Bucket}.s3.amazonaws.com/${Key}`;
        resolve(Object.assign({
          response: response,
          url: url
        }));
      })
      .catch(reject);
  });
};


Bucket.prototype.uploadMultipleFiles = function(customParams) {
  var self = this;
  var flags = ['files'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to upload multiple files due parameters missing');
  }

  // check files not empty
  if (typeof customParams.files !== 'object'
    || customParams.files.length < 1) {
    throw new Error('Files array should not be empty');
  }

  var uploadsQueue = [];

  // check files integrity
  customParams.files.forEach(function(file) {
    if (typeof file.Key !== 'string') {
      throw new Error('File name Key should be string');
    }
    if (typeof file.filePath === 'undefined') {
      throw new Error('File path should be provided');
    }

    uploadsQueue.push(function() {
      return self.uploadFile({
        filePath: file.filePath,
        Key: file.Key
      });
    });
  });

  return Promise.resolve(uploadsQueue).mapSeries(f => f());
};

Bucket.prototype.listPagedFileVersions = function(customParams) {
  /*
  var flags = ['Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to list file versions due parameters missing');
  }
  */
  // console.log('Executing...', customParams);

  var S3 = this.S3;
  var bucketName = this.bucketName || '';
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
  var defaultParams = {
    Bucket: bucketName
  };

  // Max limit of objects requested
  if (typeof customParams.limit !== 'undefined') {
    if (typeof customParams.limit !== 'number') {
      throw new Error('Number was expected for limit parameter');
      return;
    }
    defaultParams.MaxKeys = customParams.limit;
    delete customParams.limit;
  }

  // Key is only to maintain consistance with File Listing
  // the original s3 api uses prefix
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
  if (typeof customParams.Key !== 'undefined') {
    if (typeof customParams.Key !== 'string'
      || customParams.Key === '') {
      throw new Error('Key parameter was expected to be String');
      return;
    }
    defaultParams.Prefix = customParams.Key;
    delete customParams.Key;
  }

  var params = Object.assign(defaultParams, customParams);

  // console.log('Executing clean...', params);

  var listObjectVersionsPromise = promisify(S3.listObjectVersions).bind(S3);
  return new Promise(function (resolve, reject) {
    return listObjectVersionsPromise(params)
      .then(function(fileVersions) { resolve(fileVersions); })
      .catch(reject);
  });
};

Bucket.prototype.listFileVersions = function(customParams) {
  var self = this;
  var versions = [];
  var markers = [];
  var pageDelay = self.pagingDelay;
  // Max limit of objects requested
  if (typeof customParams.limit !== 'undefined') {
    if (typeof customParams.limit !== 'number') {
      throw new Error('Number was expected for limit parameter');
      return;
    }
    customParams.MaxKeys = customParams.limit;
    delete customParams.limit;
    // console.log(customParams);
  }

  // Max pagedelay of objects requested
  if (typeof customParams.delay !== 'undefined') {
    if (typeof customParams.delay !== 'number') {
      throw new Error('Number was expected for delay parameter');
      return;
    }
    pageDelay = customParams.delay;
    delete customParams.delay;
  }

  // Key is only to maintain consistance with File Listing
  // the original s3 api uses prefix
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
  if (typeof customParams.Key !== 'undefined') {
    if (typeof customParams.Key !== 'string'
      || customParams.Key === '') {
      throw new Error('Key parameter was expected to be String');
      return;
    }
    customParams.Prefix = customParams.Key;
    delete customParams.Key;
  }

  return self._fetchVersionsAndMarkers(customParams, versions, markers, pageDelay);
};

Bucket.prototype._fetchVersionsAndMarkers = function (customParams, versions, markers, pageDelay) {
  var self = this;
  var delay = pageDelay || self.pagingDelay;

  // console.log(customParams);
  return self.listPagedFileVersions(customParams).then(function(res){
    // console.log(res);
    versions = versions.concat(res.Versions);
    markers = markers.concat(res.DeleteMarkers);
    if (!res.IsTruncated) {
      return {
        Versions: versions,
        DeleteMarkers: markers
      };
    }

    // console.log(delay);
    return Promise.delay(delay).then(function(){
      // console.log('--->', res);
      // console.log('custom params--->', customParams);
      customParams.VersionIdMarker = res.NextVersionIdMarker;
      // A version-id marker cannot be specified without a key marker.
      customParams.KeyMarker = res.NextKeyMarker;
      // return self.listPagedFiles(customParams);
      return self._fetchVersionsAndMarkers(customParams, versions, markers, delay);
    });

  })
};

Bucket.prototype.deleteAllVersions = function(customParams, deleteVersions, deleteMarkers) {
  var self = this;
  var deleteMarkers = deleteMarkers || false;
  var deleteVersions = deleteVersions || true;
  var flags = ['Key'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to delete all file versions due parameters missing');
  }

  var S3 = self.S3;
  var bucketName = self.bucketName || '';
  var fileKey = customParams.Key;
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
  var params = {
    Key: fileKey
  };

  return self.listFileVersions(params).then(function(fileVersions){
    // Create and array of files versions to remove
    var files = [];

    if (deleteVersions) {
      files = fileVersions.Versions.map(function(version) {
        var file = { Key: null, VersionId: null }
        if (typeof version.Key !== 'string') {
          throw new Error('File name Key should be string');
        }
        if (typeof version.VersionId === 'undefined') {
          throw new Error('File VersionId should be provided');
        }

        file.Key = version.Key;
        file.VersionId = version.VersionId;

        return file;
      });
    }

    if (deleteMarkers) {
      var markers = fileVersions.DeleteMarkers.map(function(version) {
        var file = { Key: null, VersionId: null }
        if (typeof version.Key !== 'string') {
          throw new Error('File name Key should be string');
        }
        if (typeof version.VersionId === 'undefined') {
          throw new Error('File VersionId should be provided');
        }

        file.Key = version.Key;
        file.VersionId = version.VersionId;

        return file;
      });
      // Apend files with VersionId to the operation
      files = files.concat(markers);
    }

    if (files.length === 0) {
      // No files to delete
      return { Deleted: [] };
    }
    // Delete All the Versions (and Markers) found for the same file Key
    return self.deleteFilesVersioned({ files: files });
  });
};

Bucket.prototype.deleteAllMarkers = function(customParams) {
  return this.deleteAllVersions(customParams, false, true);
};

Bucket.prototype.deleteAllVersionsAndMarkers = function(customParams) {
  return this.deleteAllVersions(customParams, true, true);
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
Bucket.prototype.listPagedFiles = function (customParams) {
  var customBucketName = false;
  if (typeof customParams !== 'undefined'
    && typeof customParams.bucketName === 'string'
    && customParams.bucketName !== '') {
    customBucketName = customParams.bucketName;
  }

  var S3 = this.S3;
  var bucketName = customBucketName || this.bucketName;

  var defaultParams = {
    Bucket: bucketName
  };

  // Max limit of objects requested
  if (typeof customParams.limit !== 'undefined') {
    if (typeof customParams.limit !== 'number') {
      throw new Error('Number was expected for limit parameter');
      return;
    }
    defaultParams.MaxKeys = customParams.limit;
    delete customParams.limit;
  }

  /*
  // this was for listObjects v1 now we are using V2
  if (typeof customParams.startMarker !== 'undefined') {
    if (typeof customParams.startMarker !== 'string'
      || customParams.startMarker === '') {
      throw new Error('Marker parameter was expected to be String');
      return;
    }
    defaultParams.Marker = customParams.startMarker;
  }
  */

  var params = Object.assign(defaultParams, customParams);

  var listObjectsPromise = promisify(S3.listObjectsV2).bind(S3);
  return new Promise(function (resolve, reject) {
    listObjectsPromise(params)
      .then(function(files) {
        resolve(files);
      })
      .catch(reject);
  });
};

Bucket.prototype.listFiles = function (customParams) {
  var self = this;
  var files = [];
  var pageDelay = self.pagingDelay;
  // Max limit of objects requested
  if (typeof customParams.limit !== 'undefined') {
    if (typeof customParams.limit !== 'number') {
      throw new Error('Number was expected for limit parameter');
      return;
    }
    customParams.MaxKeys = customParams.limit;
    delete customParams.limit;
  }

  // Max pagedelay of objects requested
  if (typeof customParams.delay !== 'undefined') {
    if (typeof customParams.delay !== 'number') {
      throw new Error('Number was expected for delay parameter');
      return;
    }
    pageDelay = customParams.delay;
    delete customParams.delay;
  }

  return self._fetchFiles(customParams, files, pageDelay);
};

Bucket.prototype._fetchFiles = function (customParams, files, pageDelay) {
  var self = this;
  var delay = pageDelay || self.pagingDelay;

  return self.listPagedFiles(customParams).then(function(res){
    files = files.concat(res.Contents);
    if (!res.IsTruncated) {
      return files;
    }

    // console.log(delay);
    return Promise.delay(delay).then(function(){
      // console.log(res);
      customParams.ContinuationToken = res.NextContinuationToken;
      // return self.listPagedFiles(customParams);
      return self._fetchFiles(customParams, files, delay);
    });

  })
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

  var files = customParams.files.map(function(file) {
    if (typeof file !== 'string') {
      throw new Error('File name Key should be string');
    }
    return { Key: file };
  });
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

Bucket.prototype.deleteFilesVersioned = function (customParams) {
  var flags = ['files'];
  var hasAllFlags = checkParams(customParams, flags);
  if (!hasAllFlags) {
    throw new Error('Unable to upload files due parameters missing');
  }
  if (typeof customParams.files !== 'object'
    || customParams.files.length < 1) {
    throw new Error('Files array should not be empty');
  }

  var S3 = this.S3;
  var bucketName = this.bucketName;

  var files = customParams.files.map(function(file) {
    if (typeof file.Key !== 'string') {
      throw new Error('File name Key should be string');
    }
    if (typeof file.VersionId === 'undefined') {
      throw new Error('File VersionId should be provided');
    }
    return file;
  });
  var params = {
    Bucket: bucketName,
    Delete: {
      Objects: files
    }
    // Quiet: false
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
