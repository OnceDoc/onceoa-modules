/*!@preserve
* OnceDoc
*/

//加载各种模块
var Article = require('./blog.article')    // 文章列表，内容显示
var Root    = require('./blog.root')       // 文章编辑、保存管理

app.mod('blog', '../web')
app.pre('/blog', '.tmpl')

/*BLOG MENU*/
global.ONCEOS_DESKTOP_MENU.push({
    text   : LOCAL.BLOG
  , icon   : '/blog/img/blog.png'
  , href   : '/blog/home'
  , target : '_blank'
})

global.ONCEOS_SUB_MENU_APP.nodes.push({
    text   : LOCAL.BLOG
  , icon   : '/blog/img/blog.png'
  , href   : '/blog/home'
})

global.ONCEDOC_NAVS.push({
    text   : LOCAL.BLOG
  , href   : '/blog/home'
  , target : '_blank'
})

global.ONCEDOC_HOMEPAGE.push('/blog')

global.OnceDoc.Blog = {
    Article : Article
  , Root    : Root
}

oncedb.schema('article', {
    "id"          : "id"
  , "title"       : ""
  , "description" : ""
  , "url"         : "url"
  , "summary"     : ""
  , "slides"      : "object"
  , "file"        : ""
  , "content"     : ""
  , "keyword"     : "keywords('key', this.pubTime || +new Date())"
  , "poster"      : "index('user_article', this.pubTime || +new Date())"
  , "avatar"      : ""
  , "isPublic"    : "index('public', this.pubTime || +new Date())"
  , "pubTime"     : "int;order('article_pub')"
  , "visitNum"    : "int;order('article_visit');default(0)"
  , "postTime"    : "int;order('article_post')"
  , "mtime"       : "int;order('article_mtime');default(Date.now())"
  , "similar"     : "object"
  , "hottest"     : "object"
})






/*
sitemap for SEO
*/
var SITEMAPS = [
    ''
  , 'blog/home'
]

app.get('/sitemap.txt', function(req, res) {
  oncedb.client.zrevrange('public:1', 0, 50000, function(err, keys) {
    if (err) {
      res.render('/blog/sitemap.txt', { keys: SITEMAPS })
      return
    }

    var urls = keys.map(function(key) {
      return 'blog/view/' + key
    }).concat(SITEMAPS)

    res.render('/blog/sitemap.txt', { keys: urls })
  })
})