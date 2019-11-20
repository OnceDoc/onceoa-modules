/*!@preserve
* OurJS for OnceDoc
*/

//加载各种模块
var fs        = require('fs')
var path      = require('path')

var CRYPTOKEY = '*IK<7ujmDFGHJ'

var setUsers  = function() {
  var userDir = path.join(__dirname, '../data/models/user')

  fs.readdir(userDir, function(err, users) {
    if (err) {
      console.log(err)
      return
    }

    var curIdx = 0
    var nextData = function() {
      var userFile = users[curIdx++]
      if (!userFile) {
        console.log('end')
        return
      }

      fs.readFile(path.join(userDir, userFile), function(err, data) {
        if(err) {
          nextData()
          return
        }

        try {
          var json = JSON.parse(data.toString())
        } catch(e) {
          console.log(e)
          nextData()
          return
        }

        json.password = OnceDoc.getDecryption(json.password, CRYPTOKEY)

        if (json.username.length == 7 && json.email.endsWith('@163.com')) {
          console.log('skip user', json.username)
          nextData()
          return
        }

        console.log('user inserted', json.username)

        OnceDoc.User.signup(json, function(err) {
        //oncedb.insert('user', json, function(err) {
          if (err) {
            console.log(err.toString())
          }

          nextData()
        })
      })
    }

    nextData()
  })

}

var setArticle = function() {
  var dataDir   = path.join(__dirname, '../data/models/article')
  var counts    = fs.readFileSync(path.join(__dirname, '../data/counts/articles-2019-11')).toString()
  var countInfo = JSON.parse(counts)

  fs.readdir(dataDir, function(err, files) {
    if (err) {
      console.log(err)
      return
    }

    var curIdx = 0
    var nextData = function() {
      var dataFile = files[curIdx++]
      if (!dataFile) {
        console.log('end')
        return
      }

      fs.readFile(path.join(dataDir, dataFile), function(err, data) {
        if(err) {
          nextData()
          return
        }

        try {
          var json = JSON.parse(data.toString())
        } catch(e) {
          console.log(e)
          nextData()
          return
        }

        var article = {
            id          : json._id
          , title       : json.title
          // , urlSlug     : json.urlSlug
          , url         : json.url
          , isPublic    : json.verify
          , keyword     : [ json.category, json.keyword ].filter(function(obj) { return obj }).join(',')
          , summary     : json.summary
          , content     : json.content
          , description : json.description
          , hottest     : json.hottest
          , similar     : json.similar
          , replies     : json.replies
          , replyNum    : (json.replies || []).length || ''
          , postTime    : json.postdate
          , poster      : json.poster || 'ourjs'
          , mtime       : json.replyTime || json.publishTime || json.postdate
          , visitNum    : countInfo[json._id]
          , private     : 0
        }

        if (article.isPublic == '1') {
          article.pubTime = json.postdate
        }

        if (!article.similar || !Array.isArray(article.similar) || !article.similar.length ) {
          delete article.similar
        } else {
          article.similar = article.similar.map(function(urlInfo) {
            return {
                id    : urlInfo._id
              , title : urlInfo.title
            }
          })
        }

        if (!article.hottest || !Array.isArray(article.hottest) || !article.hottest.length) {
          delete article.hottest
        } else {
          article.hottest = article.hottest.map(function(urlInfo) {
            return {
                id    : urlInfo._id
              , title : urlInfo.title
            }
          })
        }

        if (!article.replies || !Array.isArray(article.replies) || !article.replies.length) {
          delete article.replies
        } else {
          article.replies = article.replies.map(function(replyInfo) {
            return {
                user : replyInfo.poster || replyInfo.nickname
              , text : replyInfo.reply
              , time : replyInfo.postdate
            }
          })
        }

        console.log('insert', article.id)

        if (json.category) {
          oncedb.client.zadd('keys', Date.now(), json.category)
        }

        if (json.keyword) {
          oncedb.client.zadd('keys', Date.now(), json.keyword)
        }

        //oncedb 添加 formatter 功能？？？
        //(article.title || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        if (json.title) {

        }

        oncedb.insert('article', article, function(err) {
          if (err) {
            console.log(err.toString())
          }
          nextData()
        })
      })
    }

    nextData()
  })

}

app.get('/ourjs/migrate', function(req, res) {
  setUsers()
  setArticle()

  res.send('Start migration')
})