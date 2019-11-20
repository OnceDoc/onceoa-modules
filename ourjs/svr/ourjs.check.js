var http  = require('http')
var url   = require('url')
var fs    = require('fs')

/*
检查完整网址是否可用
*/
var checkUrlExists = function (Url, cb) {
  var options = {
      //method: 'HEAD',
      host: url.parse(Url).host,
      port: 80,
      path: url.parse(Url).pathname
  };

  var req = http.request(options, function (r) {
      cb && cb( r.statusCode == 200);
  });

  req.end();
}

/*
检查相对网址是否可用，需修改服务器地址和端口
*/
var checkExists = function(urlPath, cb) {
  var options = { host: '192.168.2.101', port: 8064, path: encodeURI(urlPath)}
  var req = http.request(options, function(r) {
    cb && cb(r.statusCode == 200);
  })

  req.end()
}

var checkFile = function(filePath) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      console.log(err)
      return
    }

    var lines   = data.toString().split(/[\r\n]+/)
    var curr    = 0
    var urlPath

    var checkNext = function(exist) {
      if (curr > lines.length - 1) {
        console.log('end')
        return
      }

      //console.log(curr, 'exist', exist, urlPath)
      if (!exist) {
        console.log(curr, 'exist', exist, urlPath)
      }

      if (curr >= lines.lines) {
        console.log('end')
        return
      }

      urlPath = lines[curr++]
      checkExists(urlPath, checkNext)
    }

    checkNext()
  })
}

checkFile('./visit.csv')