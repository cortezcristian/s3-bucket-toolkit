var assert = require('assert');
var Promise = require('bluebird');
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

  it('delete file', function(done) {
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

  it('upload file again', function(done) {
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


  it('list paged files', function(done) {
    bucket.listPagedFiles({
      limit: 2, // by default 1000
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Contents !== 'undefined', 'Bucket contents were expected');
      assert.ok(res.Contents.length >= 1, 'Bucket should have at least one file');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('list file versions and markers', function(done) {
    bucket.listFileVersions({
      Key: 'upload-test.txt'
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Versions !== 'undefined', 'File Versions were expected');
      assert.ok(typeof res.DeleteMarkers !== 'undefined', 'File DeleteMarkers were expected');
      assert.equal(res.Versions.length, 2, 'Two Versions were expected');
      assert.equal(res.DeleteMarkers.length, 1, 'One Delete Marker was expected');
      // reuse when deleting file versions
      versions = res.Versions;
      // console.log(versions);
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
      assert.equal(res.Deleted.length, 2, 'Two deleted Versions were expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('delete all markers for file', function(done) {
    // console.log('vers', versions);
    bucket.deleteAllMarkers({
      Key: 'upload-test.txt',
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Deleted !== 'undefined', 'Deleted versions were expected');
      assert.equal(res.Deleted.length, 1, 'One deleted marker was expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('delete all markers and versions for file', function(done) {
    // console.log('vers', versions);
    bucket.deleteAllVersionsAndMarkers({
      Key: 'upload-test.txt',
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Deleted !== 'undefined', 'Deleted versions were expected');
      // There shuold not be deletions as previous test cases
      assert.equal(res.Deleted.length, 0, 'No deleted versions or markers were expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('upload multiple files', function(done) {
    var files = [], totalFiles = 9, i;
    for (i = 1; i <= totalFiles; i++) {
      files.push({
        filePath: './test/upload-test.txt',
        Key: `upload-test-${i}.txt`
      });
    }
    // console.log(files);
    bucket.uploadMultipleFiles({
      files: files
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res !== 'undefined', 'Response was expected');
      assert.equal(res.length, totalFiles, `${totalFiles} were expected`);
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it('list all files', function(done) {
    bucket.listFiles({
      limit: 2, // items per page by default 1000
      delay: 10, // delay between pages by default 500
    }).then(function(files){
      // console.log(files);
      assert.ok(typeof files !== 'undefined', 'Files were expected');
      assert.ok(files.length >= 9, 'Bucket should have at least one file');
      done();
    }).catch(function(err){
      done(err);
    });
  });

  it.skip('delete specific files and versions combinations', function(done) {
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

  it('upload multiple versions of the same file', function(done) {
    var uploadsQueue = [], totalVersions = 5, i;
    for (i = 1; i <= totalVersions; i++) {
      uploadsQueue.push(function() {
        return bucket.uploadFile({
          filePath: './test/upload-test.txt',
          Key: 'upload-test-versioned.txt'
        });
      });
    }

    Promise.resolve(uploadsQueue).mapSeries(f => f()).then(function(res) {
      assert.ok(typeof res !== 'undefined', 'Response was expected');
      assert.equal(res.length, totalVersions, `${totalVersions} upload operations were expected`);
      done();
    }).catch(done);
  });

  it('list paged versions for a single file', function(done) {
    bucket.listFileVersions({
      Key: 'upload-test-versioned.txt', // file versioned key or prefix (mandatory)
      limit: 2, // items per page by default 1000 (optional)
      delay: 10, // delay between pages by default 500 (optional)
    }).then(function(res){
      // console.log(res);
      assert.ok(typeof res.Versions !== 'undefined', 'File Versions were expected');
      assert.ok(typeof res.DeleteMarkers !== 'undefined', 'File DeleteMarkers were expected');
      assert.ok(res.Versions.length > 5, 'More than 5 Versions were expected');
      assert.equal(res.DeleteMarkers.length, 0, 'No Delete Marker was expected');
      done();
    }).catch(function(err){
      done(err);
    });
  });

});
