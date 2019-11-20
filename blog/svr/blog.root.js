/*!@preserve
* OnceDoc
*/

//import namespace
var qs        = require("querystring")
var utility   = require("./blog.utility")
var Article   = require('./blog.article')
var path      = require('path')


/*
/root 为维护文章功能，未登录，不可用
*/
app.use('/blog/root', function(req, res) {
  var user = req.session.user

  if (!user || !user.username) {
    res.send(401, LOCAL.NO_PERMISSIONS)
  } else {
    req.filter.next()
  }

/*
root的middleware可能比其它的middleware执行要早，
所以session此时未定义； 添加解析session的参数
*/
}, { session: true })


var editHandler = function(req, res) {
  var user    = req.session.user || {}
  var id      = req.params.id
  var article = req.body || {}

  oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
    if (id == "add") {
      res.render('/blog/blog.edit.tmpl', {
          article     : Buffer.from('{}').toString('base64')
        , articleInfo : {}
        , keywords    : keywords
      })
    } else {
      oncedb.select('article', { id: id }, function(err, articles) {
        var article = articles[0]

        /*
        keyword为关键词索引，oncedb会自动将所有关词诩都保存到 key 集合中
        提取出来为自动补全控件使用
        */
        if (article && (article.poster === user.username || user.isAdmin)) {
          var articleCodes = Buffer.from(JSON.stringify(article)).toString('base64')

          res.render('/blog/blog.edit.tmpl', {
              article     : articleCodes
            , articleInfo : article
            , keywords    : keywords
          })
        } else {
          res.end(LOCAL.NO_PERMISSIONS)
        }
      })
    }
  })
}

app.get('/blog/root/edit/:id', editHandler)
app.post('/blog/root/edit/:id', editHandler)


app.file("/blog/root/edit.post", function(req, res) {
  var article   = req.body
  var user      = req.session.user || {}

  if (!user.username) {
    res.send({ error: LOCAL.SESSION_EXPIRED })
    return
  }

  oncedb.format('article', article)

  if (!article.title || (article.poster && article.poster != user.username && !user.isAdmin)) {
    res.send({ error: LOCAL.INCOMPLETE_PARAMETER })
    return
  }

  if (!article.keyword || !article.keyword.length) {
    res.send({ error: LOCAL.MISSING_XX.format(LOCAL.KEYWORDS) })
    return
  }

  var onResponse = function(err) {
    if (err) {
      return res.send({ error: err.toString() })
    }

    OnceDoc.emit('blog.edit', article)
    OnceDoc.Search.set('article:' + article.id)
    //res.redirect('/blog/home')
    res.send({ url: '/blog/view/' + article.id })
  }

  article.description = OnceDoc.html2text(article.summary || '').substr(0, 180)

  var saveArticle = function() {
    if ( article.id ) {
      oncedb.client.hget('article:' + article.id, 'poster', function(err, poster) {
        if (user.username == poster || user.isAdmin) {
          if (user.username == poster && user.avatar) {
            article.avatar = user.avatar
          }

          oncedb.update('article', article, onResponse)
        } else {
          res.send({ error: LOCAL.NO_PERMISSIONS })
        }
      })
    } else {
      article.id        = app.newID(4)
      article.poster    = user.username

      if (user.avatar) {
        article.avatar    = user.avatar
      }

      article.postTime  = +new Date()
      article.visitNum  = 0
      //新增的文章都需要管理员重新审核
      article.isPublic  = 0

      oncedb.insert('article', article, onResponse)
    }
  }

  if (!article.file) {
    saveArticle()
    return
  }

  OnceDoc.readFile(req, article.file, function(err, data) {
    if (err) {
      res.send({ error: err.toString() })
      return
    }

    if (path.extname(article.file).toLowerCase() == '.md') {
      article.content = OnceDoc.markdown.render(data.toString())
    } else {
      article.content = data.toString()
    }

    saveArticle()
  })
})


app.get('/blog/root/delete/:id', function(req, res) {
  var id        = req.params.id
    , user      = req.session.user
    , key       = 'article:' + id

  oncedb.client.hmget(key, 'poster', 'isPublic', function(err, result) {
    result = result || []

    var poster    = result[0]
    var isPublic  = result[1]

    if (poster != user.username && !user.isAdmin) {
      return res.send(LOCAL.NO_PERMISSIONS)
    }

    if (isPublic == 1) {
      return res.send(LOCAL.UNPUBLISH_AND_DELETE_TO_PREVENT_MISOPERATION)
    }

    //使用remove删除文章和相关索引
    oncedb.remove('article', { id: id }, function(err, result) {
      OnceDoc.emit('blog.del', id)
      OnceDoc.Search.del('article:' + id)
      res.send(LOCAL.DELETE + (result ? LOCAL.SUCCEEDED : LOCAL.FAILED))
    })
  })
})


var formatID = function(id) {
  return 'article:' + id
}

var formatArticle = function(article) {
  return {
      id    : (article._key || '').replace('article:', '')
    , title : article.title || ''
  }
}

var mergeList = function(tarList, srcList, count) {
  count = count || 10

  if (tarList.length < count) {
    var hottest = []
    var keys    = tarList.map(function(article) { return article.id })
    var idx     = 0
    while (tarList.length < count) {
      var article = srcList[idx++]
      if (!article) {
        break
      }

      if (keys.indexOf(article.id) < 0) {
        tarList.push(article)
      }
    }
  }
}

/*
1. 文章自动加载
2. 显示最近文章列表
3. 显示近期最热文章
4. 显示近期相关文章
*/
var HOTTEST = []

var getHottest = function() {
  return HOTTEST
}

var hottestTimer

var setHottest = function(cb, count) {
  oncedb.client.zrevrangehmget('article_visit', 0, 10, 'article: id title', function(err, hottestArticles) {
    if (hottestTimer) {
      clearTimeout(hottestTimer)
    }
    hottestTimer = setTimeout(setHottest, 4 * 3600 * 1000)

    hottestArticles = hottestArticles || []
    HOTTEST         = hottestArticles.map(formatArticle)

    cb && cb(err, HOTTEST)
  })
}

setHottest()

/*
当最近热门文章太少时，从最新发布中合并一些文章，所以在 setRecentPublic 中并入
*/
var RECENT_HOTTEST   = []

var getRecentHottest = function() {
  return RECENT_HOTTEST
}

var setRecentHottest = function(cb, timestamp) {
  //查找1个月内的最热文章
  if (!timestamp) {
    timestamp = Date.now() - 30 * 24 * 3600 * 1000
  }

  oncedb.client.zrevrangehmgetbyscore('article_pub', Date.now(), timestamp, 'article: id title visitNum', function(err, articles) {
    if (err) {
      console.log(err)
      cb && cb(err)
      return
    }

    articles.forEach(function(article) {
      article.visitNum = parseInt(article.visitNum) || 0
    })

    articles.sort(function(a, b) {
      return b.visitNum - a.visitNum
    })

    RECENT_HOTTEST = articles.map(formatArticle)

    mergeList(RECENT_HOTTEST, RECENT_PUBLIC)

    cb && cb(null, RECENT_HOTTEST)
  })
}

/*

*/
var RECENT_PUBLIC   = []

var recentPublicTimer

var getRecentPublic = function() {
  return RECENT_PUBLIC
}

var setRecentPublic = function(cb) {
  oncedb.client.zrevrangehmget('public:1', 0, 20, 'article: id title', function(err, articles) {
    if (recentPublicTimer) {
      clearTimeout(recentPublicTimer)
    }
    recentPublicTimer = setTimeout(setRecentPublic, 4 * 3600 * 1000)

    if (err) {
      console.log(err)
      cb && cb(err)
      return
    }

    articles      = articles || []
    RECENT_PUBLIC = articles.map(formatArticle)

    //
    setRecentHottest()

    cb && cb(null, RECENT_PUBLIC)
  })
}

setRecentPublic()

/*

*/
var RECENT = []

var getRecent = function() {
  return RECENT
}

var setRecent = function(cb) {
  oncedb.client.zrevrangehmget('article_mtime', 0, 20, 'article: id title', function(err, articles) {
    if (err) {
      console.log(err)
      cb && cb(err)
      return
    }

    RECENT   = articles.map(formatArticle)

    cb && cb(null, RECENT)
  })
}

setRecent()


/*
用法：
不发布 /blog/root/publish/:id/0
发布   /blog/root/publish/:id/1
置顶   /blog/root/publish/:id/2
更新最热和相关文章 /blog/root/publish/:id/-1
*/
app.get('/blog/root/publish/:id/:state', function(req, res) {
  var id        = req.params.id
  var user      = req.session.user
  var state     = parseInt(req.params.state) || 0
  var key       = 'article:' + id

  if (!user.isAdmin) {
    res.send(LOCAL.NO_PERMISSIONS)
    return
  }

  var updateState = function(updates) {
    var updateObject = { id: id }
    if (state != -1) {
      OnceDoc.extend(updateObject, { isPublic: state, pubTime: +new Date() })
    }
    updates && OnceDoc.extend(updateObject, updates)

    console.log(updateObject)

    oncedb.update('article', updateObject, function(err) {
      if (err) {
        res.send(LOCAL.FAILED + ': ' + err.toString())
        return
      }

      res.send(LOCAL.ACTION_SUCCESS_NEED_REFRESH)
    })
  }

  /*
  根据schema中的定义: { "isPublic" : "index('public', return this.pubTime)" }
  使用update, 更新article 同时会自动添加id到 public:1 的集合，权重为当前的时间(pubTime整型)
  */
  oncedb.client.hgetall('article:' + id, function(err, article) {
    if (err || !article) {
      res.send((err || '').toString())
      return
    }

    //在第一次发布时指定最热和相似文章
    if (!article.hottest || state == -1) {
      //找到与第一个关健字相同的文章
      var keyword = (article.keyword || '').split(',')[0] || '' 
      var similarKey = keyword ? ('key:' + keyword) : 'public:1'

      oncedb.select('article', { keyword: keyword, isPublic: 1 }, function(err, articles) {
        if (err) {
          console.log(err)
          return
        }

        var hotIDs  = RECENT_HOTTEST.map(function(article) { return article.id });
        var similar = [];

        (articles || []).forEach(function(article) {
          if (article.id != id && hotIDs.indexOf(article.id) < 0 && similar.length < 10) {
            similar.push({
                id    : article.id
              , title : article.title
            })
          }
        });

        updateState({ hottest: RECENT_HOTTEST, similar: similar })

      }, { from: 0, to: 20, desc: true })
    } else {
      updateState()
    }
  })
})


var refresh = function() {
  setRecent()
  setRecentHottest()
}

OnceDoc.on('blog.edit', refresh)
OnceDoc.on('blog.del', refresh)
OnceDoc.on('blog.reply.edit', refresh)
OnceDoc.on('blog.reply.del', refresh)


module.exports = {
    getRecent         : getRecent
  , getHottest        : getHottest
  , getRecentHottest  : getRecentHottest
  , getRecentPublic   : getRecentPublic
  , setRecent         : setRecent
  , setHottest        : setHottest
  , setRecentHottest  : setRecentHottest
  , setRecentPublic   : setRecentPublic
}