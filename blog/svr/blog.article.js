/*!@preserve
* OnceDoc
*/

var fs              = require('fs')
var path            = require('path')
var utility         = require('./blog.utility')
var config          = global.CONFIG


var getPagination = function(config, pagerFormat) {
  var interval = 5
    , curPager = config.pager || 0
    , maxPager = config.count / config.pageSize | 0
    , startPos = curPager - (interval / 2 | 0)


  maxPager - startPos < interval && (startPos = maxPager - interval)
  startPos < 1 && (startPos = 1)

  var pagination  = ''
  var paginations = []


  var addPage = function(pager) {
    paginations.push(
      pagerFormat.format(pager, curPager == pager ? 'class="active"' : '', (pager + 1))
    )
  }

  addPage(0)
  startPos > 1 && paginations.push('<li><a>…</a></li>')
  for (var i = 0; startPos < maxPager && i < 5; i++, startPos++) {
    addPage(startPos)
  }
  startPos < maxPager && paginations.push('<li><a>…</a></li>')
  maxPager > 0 && addPage(maxPager)

  pagination = '<ul class="len{0}" style="table-layout:fixed">{1}</ul>'.format(paginations.length, paginations.join(''))

  return pagination
}



//handle: /blog/templatename/category/pagenumber, etc: /blog/home/all?pagenumber=0, /blog/home, /blog/json/all?pagenumber=0
var showListHandler = function(req, res) {
  //get template name
  var tmpl        = 'home'
  var keyword     = req.params.keyword    || ''
  var pageNumber  = parseInt(req.query.pager)  || 0
  var pageSize    = 10
  var user        = req.session.user || {}

  if (req.url.indexOf('/rss') > -1) {
    tmpl = 'rss'
  }

  //已发布
  var conditions  = { isPublic: 1 }

  //带关键字的文章
  if (keyword) {
    conditions.keyword = keyword
  }

  var topArticles = []

  var render = function() {
    oncedb.select('article', conditions, function(err, articles, count) {
      if (err) {
        res.send(err.toString())
        return
      }

      tmpl == 'rss' && res.type('xml')

      oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
        res.render('/blog/blog.' + tmpl + ".tmpl", {
            articles    : topArticles.concat(articles)
          , keyword     : keyword
          , keywords    : keywords
          , pagination  : getPagination({
                pageSize  : pageSize
              , pager     : pageNumber
              , count     : count
            }, '<li {1}><a href="' + req.router.replace('/:keyword', keyword) + '?pager={0}">{2}</a></li>')
        })
      })
    }, { from: pageNumber * pageSize, to: (pageNumber + 1) * pageSize - 1, desc: true })
  }

  if (pageNumber === 0) {
    oncedb.select('article', { isPublic: 2 }, function(err, articles) {
      if (err) {
        res.send(err.toString())
        return
      }

      topArticles = articles || []
      render()
    })
  } else {
    render()
  }
}

//127.0.0.1/ or 127.0.0.1/home/category/pagenumber
app.url(['/blog/home/:keyword', '/blog/rss/:keyword'], showListHandler)


app.url('/blog/user/:poster', function(req, res) {
  var mapper      = this
  //get template name
  var poster      = req.params.poster  || ''
  var pageNumber  = parseInt(req.query.pager)  || 0
  var pageSize    = 10
  var user        = req.session.user || {}
  var where       = {}

  /*
  only public article for guest
  */
  // if (!user.isAdmin && user.username != poster) {
  //   where.isPublic  = 1
  // }

  /*
  有keyword同样放到where语句中
  */
  poster && (where.poster = poster)

  oncedb.select('user', { username: poster }, function(err, users) {
    if (err) {
      res.send(err.toString())
      return
    }

    // if (users.length < 1) {
    //   res.send(LOCAL.NOT_FOUND)
    //   return
    // }

    var posterInfo = users[0] || { 
        username: poster
      , showname: LOCAL.NOT_FOUND
    }

    /*
    没有条件时为什么会是0？
    */
    oncedb.select('article', where, function(err, articles, count) {
      if (err) {
        res.send(err.toString())
        return
      }

      res.render('/blog/blog.home.tmpl', {
          articles    : articles
        , user        : user
        , isUser      : true
        , poster      : poster
        , posterInfo  : posterInfo
        , pagination  : getPagination({
              pageSize  : pageSize
            , pager     : pageNumber
            , count     : count
          }, '<li {1}><a href="' + req.router.replace(':poster', poster) + '?pager={0}">{2}</a></li>')
      })

    }, { from: pageNumber * pageSize, to: (pageNumber + 1) * pageSize - 1, desc: true })

  })

})


//redirect /blog to /blog/home
app.get('/blog', function(req, res) {
  res.redirect('/blog/home')
})


//handle detail.tmpl: content of article
app.get(['/blog/view/:id', '/blog/view-html/:id', '/blog/view-nonav/:id' ], function(req, res) {
  var id    = req.params.id
  var user  = req.session.user || {}
  var tmpl  = req.url.split('/')[2]

  //remove navbar
  if (req.url.indexOf('/view-nonav/') > 0) {
    tmpl = 'view'
    res.template({ 'blog.navbar.part' : '' })
  }

  if (tmpl.indexOf('view') < 0) {
    tmpl = 'view'
  }

  if (id) {
    //Does it existing in the Articles?
    oncedb.select('article', { id: id }, function(err, articles) {
      var article = articles[0]
      if (article) {
        oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
          oncedb.update('article', { id: id, 'visitNum': (parseInt(article.visitNum) || 0) + 1})
          oncedb.client.hgetall('user:' + article.poster, function(err, posterInfo) {
            res.render('/blog/blog.' + tmpl + '.tmpl', {
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
})


app.get('/blog/keys', function(req, res) {
  oncedb.client.zrevrange('keys', 0, 1000, function(err, keywords) {
    res.send(keywords)
  })
})


module.exports = {
    showListHandler : showListHandler
  , getPagination   : getPagination
}