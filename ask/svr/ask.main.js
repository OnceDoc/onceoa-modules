/*!@preserve
* OnceDoc
*/
var config          = global.CONFIG
var ONCEIO_CONFIG   = config.ONCEIO_CONFIG
var MAIN_CONFIG     = config.MAIN_CONFIG

global.ONCEOS_DESKTOP_MENU.push({
    text   : LOCAL.ASK
  , icon   : '/ask/img/ask.png'
  , href   : '/ask'
  , target : '_blank'
})

global.ONCEOS_SUB_MENU_APP.nodes.push({
    text   : LOCAL.ASK
  , icon   : '/ask/img/ask.png'
  , href   : '/ask'
})

app.mod('ask', '../web')
app.pre('ask', '.tmpl')


OnceDoc.on('ready', function() {

  oncedb.extend('article', {
      replies     : 'array'
    , replyNum    : 'int'
    , private     : "int;index('article_private');default(1)"
  })

  OnceDB.addExtension({
    schema      : 'article',
    columns     : [{
      type      : 'select',
      field     : 'private',
      title     : LOCAL.PRIVATE,
      options   : [
        { title : LOCAL.NO, value : 0 },
        { title : LOCAL.YES, value : 1 }
      ]
    }]
  })

  app.map('/blog/view/:id', '/ask/view/:id')
})


require('./ask.article')