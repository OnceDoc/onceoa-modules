/*!@preserve
* OurJS for OnceDoc
*/

//加载各种模块
var fs          = require('fs')
var path        = require('path')

var MAIN_CONFIG = CONFIG.MAIN_CONFIG

require('./ourjs.migrate')

app.mod('ourjs', '../web')
app.pre('ourjs', '.part')
app.pre('ourjs', '.tmpl')
  
global.ONCEOS_DESKTOP_MENU.push({
  text    : 'OurJS',
  icon    : '/ourjs/img/js.png',
  href    : '/blog/home',
  target  : '_blank'
})

var hottest

OnceDoc.on('ready', function() {
  OnceDoc.Blog.Root.getHottest(function(hottestArticles) {
    hottest = hottestArticles.reverse()
  })

  oncedb.extend('user', {
      company : ''
  })

  oncedb.extend('article', {
      //已知问题，注意反斜杠，因为在字符串里面所有需要2个转义：  var slug = (article.title || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      title   : 'unique("article_url_slug", (this.title || "").toLowerCase().replace(/[^\\w\\u4e00-\\u9fa5]+/g, "-"))'
  })

  LOCAL.BRAND             = 'Our<b>JS</b>'
  LOCAL.SITE_BRIEF_TITLE  = 'OurJS'
  LOCAL.ASK_TITLE         = 'OurJS 爱我技术 我们的技术-IT文摘 JavaScript社区 Node.JS社区 前端社区 全端论坛 MongoDB html5 CSS3 开源社区'
  LOCAL.BLOG_TITLE        = LOCAL.ASK_TITLE

  LOCAL.FOLLOW_US_NAME    = 'OnceJS'
  LOCAL.FOLLOW_US_HTML    = '<img src="http://onceoa.com/ask/img/oncedoc.jpg" alt="OnceOA" width="160" height="160" style="border: solid 1px #666;">'

  MAIN_CONFIG.defaultUrl      = '/home'
  MAIN_CONFIG.afterLoginUrl   = '/home'


  app.map({
      '/blog/home/:keyword'   : '/home/:keyword'
    // , '/blog/view/:id'        : '/detail/:id'
    , '/blog/rss/:keyword'    : '/rss/:keyword'
    , '/ask/key/:key'         : '/bbs/:key/:pager'
    , '/blog/user/:poster'    : '/userinfo/:poster'
  })

  //由于历史问题，让 /bbs/，/bbs//，/bbs/nodejs/1 均可用
  app.map('/ask/key/:key', '/bbs/:key')
})

app.use('/', function(req, res) {
  res.template({
      // '/ask/ask.nav.part'         : '/ourjs/ourjs.nav.part'
    //, '/ask/ask.list.tmpl'        : '/ourjs/ourjs.list.tmpl'
      'ask.list.tmpl'             : '/ourjs/ourjs.list.tmpl'
    , '/pay/pay.header.part'      : '/ourjs/ourjs.nav.part'
    , '/site.header.part'         : '/ourjs/ourjs.nav.part'
    , '/site.footer.part'         : '/ourjs/ourjs.footer.part'
    , '/blog/blog.navbar.part'    : '/ourjs/ourjs.nav.part'
    , '/blog/blog.header.part'    : '/ourjs/ourjs.header.part'
    , '/blog/blog.footer.part'    : '/ourjs/ourjs.footer.part'
    , '/blog/blog.home.tmpl'      : '/ourjs/ourjs.home.tmpl'
    , '/blog/blog.rss.tmpl'       : '/ourjs/ourjs.rss.tmpl'
    , '/blog/blog.view.tmpl'      : '/ourjs/ourjs.view.tmpl'
    , '/analytics.tmpl'           : '/ourjs/ourjs.analytics.tmpl'
    , '/site.script.tmpl'         : '/ourjs/ourjs.script.tmpl'
  })

  //判断是否为微信，模板文件可通过 it.isWechat 来判断
  if ((req.headers['user-agent'] || '').indexOf('MicroMessenger') > 0) {
    res.model('isWechat', true)
  }

  req.filter.next()

})


app.get('/detail/:idOrTitle/:title', function(req, res) {
  var idOrTitle = req.params.idOrTitle
  var user      = req.session.user || {}
  var tmpl      = req.url.split('/')[2]
  var id        = idOrTitle

  var render    = function() {
    if (id) {
      //Does it existing in the Articles?
      oncedb.select('article', { id: id }, function(err, articles) {
        var article = articles[0]
        if (article) {
          oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
            oncedb.update('article', { id: id, 'visitNum': (parseInt(article.visitNum) || 0) + 1})
            oncedb.client.hgetall('user:' + article.poster, function(err, posterInfo) {
              res.render('/ourjs/ourjs.view.tmpl', {
                  article   : article
                , poster    : posterInfo || {}
                , user      : user
                , keywords  : keywords || []
              })
            })
          })
        } else {
          res.send(LOCAL.POST_NOT_FOUND)
        }
      })
    } else {
      res.send(LOCAL.INCOMPLETE_PARAMETER)
    }
  }

  oncedb.client.hget('article_url_slug', idOrTitle, function(err, _id) {
    if (err) {
      res.send(err.toString())
      return
    }

    console.log('idOrTitle', idOrTitle, _id)

    if (_id) {
      id = _id
    }

    render()
  })
})

OnceDoc.on('wechat.signin', function(userInfo) {
  OnceDoc.emit('wechat.reply', userInfo, '{0}, 欢迎您登录 http://ourjs.com'.format(userInfo.nickname))
})

OnceDoc.on('wechat.signup', function(userInfo) {
  OnceDoc.emit('wechat.reply', userInfo, '{0}, 欢迎您注册 http://ourjs.com'.format(userInfo.nickname))
})