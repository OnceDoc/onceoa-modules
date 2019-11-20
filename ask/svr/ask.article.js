/*!@preserve
* OnceDoc
*/
var ONCEIO_CONFIG       = CONFIG.ONCEIO_CONFIG
var MAIN_CONFIG         = CONFIG.MAIN_CONFIG
var WEIXIN_CONFIG       = CONFIG.WEIXIN_CONFIG      || {}
var WEIXIN_AUTH_CONFIG  = CONFIG.WEIXIN_AUTH_CONFIG || {}

app.use('/ask', function(req, res) {
  res.template({
    '/blog/blog.view.tmpl': '/ask/ask.view.tmpl'
  })

  req.filter.next()
})

app.get(['/ask', '/ask/key/:key'], function(req, res) {
  var search      = req.query.search || ''
  //get template name
  var key         = req.params.key || ''
  var pageNumber  = parseInt(req.query.pager)  || 0
  var pageSize    = 20
  var user        = req.session.user || {}
  var username    = user.username

  var pager       = { from: pageNumber * pageSize, to: (pageNumber + 1) * pageSize - 1, order: 'mtime', desc: true }

  var privateRows = []

  var render = function(err, articles, count) {
    if (err) {
      res.send(err.toString())
      return
    }

    var title = key || LOCAL.ASK_TITLE || LOCAL.SITE_TITLE

    //限制只显示10个关键字，否则太多
    oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
      res.render('ask.list.tmpl', {
          articles    : privateRows.concat(articles)
        , title       : title
        , keyword     : key
        , keywords    : keywords
        , user        : user
        , search      : search
        , pagination  : OnceDoc.Blog.Article.getPagination({
              pageSize  : pageSize
            , pager     : pageNumber
            , count     : count
          }, '<li {1}><a href="' + req.router.replace(':key', key) + '?pager={0}">{2}</a></li>')
      })
    })
  }

  if (search) {
    // if (!user.avatar && !user.isAdmin) {
    //   res.send(LOCAL.NEED_BIND_WECHAT)
    //   return
    // }

    searchdb.client.horsearch('article:*', {
        content   : { '~': search }
      , title     : { '~':  search }
      , id        : '*'
      , avatar    : '*'
      , keyword   : '*'
      , poster    : '*'
      , postTime  : '*'
      // , private   : 0
    }, function(err, rows, count) {
      if (err) {
        res.send(err.toString())
        return
      }

      var articles = rows.map(function(article) {
        return oncedb.format('article', article)
      })

      render(err, articles, count)
    })

    return
  }

  if (key) {
    user.isAdmin
      ? oncedb.select('article', { keyword: key }, render, pager)
      : oncedb.select('article', { keyword: key, private: 0 }, render, pager)

    return
  }

  if (user.isAdmin) {
    oncedb.select('article', render, pager)
    return
  }

  if (pageNumber === 0 && username) {
    oncedb.select('article', { private: 1, poster: username }, function(err, rows) {
      if (err) {
        res.send(err.toString())
        return
      }

      privateRows = rows || []

      oncedb.select('article', { private: 0 }, render, pager)
    })
    return
  }

  oncedb.select('article', { private: 0 }, render, pager)
})

var sendWechatMessage = function (messageInfo, message) {
  oncedb.client.get('access_token:' + WEIXIN_AUTH_CONFIG.AppID, function(err, access_token) {
    if (err) {
      console.log(err)
      return
    }

    console.log('receive message inner wechat', access_token)

    var from    = messageInfo.from || (messageInfo.user || {}).username || ''
    var to      = messageInfo.to
    var title   = messageInfo.title
    var content = OnceDoc.html2text(messageInfo.content || '')
    var link    = messageInfo.link

    var sendMessage = function(wechat) {
      if (!wechat) {
        console.error('user not exist', to, wechat)
        return
      }

      /*
      提问状态变更通知
      {{first.DATA}}
      提问标题：{{keyword1.DATA}}
      提问时间：{{keyword2.DATA}}
      {{remark.DATA}}
      */
      var data = {
          touser        : wechat
        , template_id   : 'IifxnCdUisGa7RkuR4CNNWD3iwAltxNcgLXXEGXXZNU'
        , url           : link || ('http://' + MAIN_CONFIG.mainSvr + '/oncedoc')
        , data          : {
            first   : {
                value : message || '您收到一条新的回复'
              , color : '#173177'
            }
          , keyword1  : {
                value : title
              , color : '#173177'
            }
          , keyword2 : {
                value : OnceDoc.getShortDate(new Date())
              , color : '#173177'
            }
          , remark  : {
                value : content
              , color : '#173177'
            }
        }
      }

      var opts = {
          url     : 'https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' + access_token
        , data    : data
      }

      //{ errcode: 0, errmsg: 'ok', msgid: 687485336 }
      OnceDoc.request(opts, function (err, resp, json) {
        if (json.errcode) {
          console.error(err, json)
        }
      })
    }

    if (messageInfo.wechat) {
      if (Array.isArray(messageInfo.wechat)) {
        messageInfo.wechat.forEach(function(wechatName, index) {
          setTimeout(sendMessage, index * 100, wechatName)
        })

        return
      }

      sendMessage(messageInfo.wechat)
      return
    }

    oncedb.client.hget('user:' + to, 'wechat', function(err, wechat) {
      sendMessage(wechat)
    })
  })
}

//博客添加发送到微信通知
var notifyTeam = 'onceoa'

OnceDoc.on('blog.insert', function(articleInfo) {
  oncedb.client.hget('team:onceoa', 'admin', function(err, admin) {
    if (err) {
      return
    }

    var admins = (admin || '').split(',')
    if (admins.length < 1) {
      return
    }

    var userKeys = admins.map(function(admin) {
      return 'user:' + admin
    })

    oncedb.client.hselect(['wechat'], userKeys, function(err, userWechats) {
      if (!userWechats || userWechats.length < 1) {
        return
      }

      //删除重复不存在的wechat id
      var wechatNames = []
      userWechats.forEach(function(userWechat) {
        if (userWechat.wechat && wechatNames.indexOf(userWechat.wechat) < 0) {
          wechatNames.push(userWechat.wechat)
        }
      })

      console.log('wechatNames', wechatNames)

      sendWechatMessage({
          from      : articleInfo.poster
        , wechat    : wechatNames
        , title     : articleInfo.title
        , content   : articleInfo.content
        , link      : 'http://' + MAIN_CONFIG.mainSvr + '/ask/view/' + articleInfo.id
      }, '有新的提问')
    })
  })
})

app.post('/ask/json/reply/add', function(req, res) {
  var user  = req.session.user
  var id    = req.query.id
  var text  = req.body

  if (!id || !text) {
    res.send({ error: LOCAL.WRONG_PARAMETER })
    return
  }

  if (!user) {
    res.send({ error: LOCAL.SESSION_EXPIRED })
    return
  }

  if (!user.avatar) {
    res.send({ error: LOCAL.NEED_BIND_WECHAT })
    return
  }

  oncedb.client.hmget('article:' + id, 'replies', 'title', 'poster', function(err, result) {
    if (err) {
      res.send({ error: err.toString() })
      return
    }

    var comment = result[0]
    var title   = result[1]
    var poster  = result[2]

    try {
      var replies = JSON.parse(comment || '[]')
    } catch (e) {
      replies = []
    }

    var commentInfo = {
        user    : user.username
      , avatar  : user.avatar
      , text    : text
      , time    : Date.now()
    }

    replies.push(commentInfo)

    oncedb.update('article', {
        id        : id
      , mtime     : Date.now()
      , replies   : replies
      , replyNum  : replies.length
    }, function(err) {

    // oncedb.client.hmset('article:' + id, {
    //     replies   : JSON.stringify(replies)
    //   , replyNum  : replies.length
    // }, function(err) {
      if (err) {
        res.send({ error: err.toString() })
        return
      }

      console.log('poster', poster)

      if (user.username != poster) {
        sendWechatMessage({
            from      : user.username
          , to        : poster
          , title     : title
          , content   : text
          , link      : 'http://' + MAIN_CONFIG.mainSvr + '/ask/view/' + id
        })
      }

      OnceDoc.emit('blog.reply.edit', id)
      res.send({ message: LOCAL.OPERATION_SUCCESSED, user: user.username, avatar: user.avatar, mtime: Date.now() })
    })
  })
}, { post: 'raw' })

app.get('/ask/json/reply/del/:id/:index', function(req, res) {
  var id    = req.params.id
  var index = parseInt(req.params.index)
  var user  = req.session.user

  if (Number.isNaN(index) || index < 0) {
    res.send({ error: LOCAL.WRONG_PARAMETER })
    return
  }

  if (!user) {
    res.send({ error: LOCAL.SESSION_EXPIRED })
    return
  }

  if (!user.isAdmin) {
    res.send({ error: LOCAL.NO_PERMISSIONS })
    return
  }

  oncedb.client.hmget('article:' + id, 'replies', 'poster', function(err, results) {
    if (err) {
      res.send({ error: err.toString() })
      return
    }

    var comment = results[0]
    var poster  = results[1]

    if (!poster) {
      res.send({ error: LOCAL.XX_NOT_FOUND.format(LOCAL.ARTICLE) })
      return
    }

    try {
      var replies = JSON.parse(comment || '[]')
    } catch (e) {
      replies = []
    }

    replies.splice(index, 1)

    oncedb.client.hset('article:' + id, 'replies', JSON.stringify(replies), function(err) {
      if (err) {
        res.send({ error: err.toString() })
        return
      }

      OnceDoc.emit('blog.reply.del', id)
      res.end('{}')
    })
  })
})


/*
用法：
公开     /ask/json/private/:id/0
不公开   /ask/json/private/:id/1
*/
app.get('/ask/json/private/:id/:state', function(req, res) {
  var id        = req.params.id
  var user      = req.session.user
  var state     = parseInt(req.params.state) || 0
  var key       = 'article:' + id

  if (!user || !user.isAdmin) {
    res.send({ error: LOCAL.NO_PERMISSIONS })
    return
  }

  oncedb.update('article', { id: id, private: state }, function(err) {
    if (err) {
      res.send({ error: err.toString() })
      return
    }

    res.send({ error: LOCAL.ACTION_SUCCESS_NEED_REFRESH })
  })
})
