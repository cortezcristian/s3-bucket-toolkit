var assert = require('assert');
var AWSBucket = require('../lib/bucket.js');
var bucket, versions;
// Config
var AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
var AWS_ACCESS_KEY_SECRET = process.env.AWS_ACCESS_KEY_SECRET || '';
var AWS_BUCKET_REGION = process.env.AWS_BUCKET_REGION || '';
var AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME || '';
var AWS_BUCKET_ACL = process.env.AWS_BUCKET_ACL || 'public-read';

describe('AWS Bucket', function() {
  it('fail to create new bucket instance if no params', function() {
    assert.throws(function() {
      bucket = new AWSBucket();
    }, /.*Parameters are required.*/);
  });

  it('fail to create new bucket instance if missing params', function() {
    assert.throws(function() {
      bucket = new AWSBucket({});
    }, /.*Unable to create bucket instance due parameters missing.*/);
  });

  it('create new bucket instance', function() {
    bucket = new AWSBucket({
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_ACCESS_KEY_SECRET,
      region: AWS_BUCKET_REGION,
      bucketACL: AWS_BUCKET_ACL,
      bucketName: AWS_BUCKET_NAME
    });

    assert.ok(typeof bucket.S3 !== 'undefined', 'S3 instance was expected');
    assert.equal(bucket.bucketACL, AWS_BUCKET_ACL, 'ACL should match specified');
  });

  it('list all buckets', function(done) {
    bucket.getAllBuckets().then(function(res){
      assert.ok(typeof res.Buckets !== 'undefined', 'S3 Buckets array was expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('get upload url', function(done) {
    bucket.getUploadUrl({
      ContentType: 'application/javascript',
      Key: 'your-dir/test.js'
    }).then(function(res){
      assert.ok(typeof res.signedUrl === 'string', 'S3 signed url was expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('upload file', function(done) {
    bucket.uploadFile({
      filePath: './test/upload-test.txt',
      Key: 'upload-test.txt'
    }).then(function(res){
      assert.ok(typeof res.url === 'string', 'S3 upload url was expected');
      assert.ok(typeof res.response !== 'undefined', 'S3 upload response was expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('list file versions', function(done) {
    bucket.listFileVersions({
      Key: 'upload-test.txt'
    }).then(function(res){
      assert.ok(typeof res.Versions !== 'undefined', 'File Versions were expected');
      // reuse when deleting file versions
      versions = res.Versions;
      // console.log(versions);
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('list files', function(done) {
    bucket.listFiles().then(function(res){
      assert.ok(typeof res.Contents !== 'undefined', 'Bucket contents were expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('delete all versions for file', function(done) {
    // console.log('vers', versions);
    bucket.deleteAllVersions({
      Key: 'upload-test.txt',
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Deleted !== 'undefined', 'Deleted versions were expected');
      done();
    }).catch(function(err){
      done(err);
    });

  });

  it.skip('delete file versions', function(done) {
    // console.log('vers', versions);
    bucket.deleteFilesVersioned({
      files: [{
        Key: 'upload-test.txt',
        // 'null' means latest version
        VersionId: 'null'
      }]
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Deleted !== 'undefined', 'Deleted versions were expected');
      done();
    }).catch(function(err){
      done(err);
    });

  });

  it.skip('delete file', function(done) {
    bucket.deleteFiles({
        files: ['upload-test.txt']
      }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Deleted !== 'undefined', 'Deleted contents were expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

});
