var fs            = require('fs')
var path          = require('path')
var EventEmitter  = require('events').EventEmitter
var util          = require('util')

var MAIN_CONFIG         = CONFIG.MAIN_CONFIG
var ONCEDOC_CONFIG      = CONFIG.ONCEDOC_CONFIG
var SOCIAL_SIGN         = CONFIG.SOCIAL_SIGN


OnceDoc.on('ready', function() {

  oncedb.extend('user', {
      avatar    : ''
    , city      : ''
    , nickname  : ''
  })

  OnceDoc.Sign.SUB_LINKS.push('<a href="/social-sign/scan"><i class="fa fa-wechat"></i> {0}</a>'.format(LOCAL.WECHAT_SIGN))
})

app.mod('social-sign', '../web')

app.get('/social-sign/scan', function(req, res) {
  //github linkedin facebook 至少配置一个
  if (!SOCIAL_SIGN || (SOCIAL_SIGN.github && SOCIAL_SIGN.linkedin && SOCIAL_SIGN.facebook)) {
    res.send('SOCIAL_SIGN github/linkedin/facebook is not configuraed')
    return
  }

  OnceDoc.User.getAutoSignin(req.cookies, function(userInfo) {
    console.log('autoSign', userInfo)
    if (userInfo) {
      req.session.user = userInfo
      res.model('user', userInfo)
      res.render('social.sign.tmpl')
      return
    }

    var model = {}

    if (SOCIAL_SIGN.github) {
      model.githubUrl = 'https://github.com/login/oauth/authorize?client_id={0}&redirect_uri={1}'.format(
          SOCIAL_SIGN.github.client_id
        , SOCIAL_SIGN.github.redirect_uri
      )
    }

    if (SOCIAL_SIGN.linkedin) {
      model.linkedinUrl = 'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={0}&redirect_uri={1}&state={2}&scope=r_liteprofile r_emailaddress'.format(
          SOCIAL_SIGN.linkedin.client_id
        , SOCIAL_SIGN.linkedin.redirect_uri
        , app.id(12)
      )
    }

    if (SOCIAL_SIGN.facebook) {
      model.facebook = ''.format(
          SOCIAL_SIGN.facebook.client_id
        , SOCIAL_SIGN.facebook.redirect_uri
      )
    }

    res.render('social.sign.tmpl', model)
  })
})

app.get('/social-sign/oauth/github/callback', function(req, res) {
  // 第一步：检查 code 用来交互 access_token
  var code  = req.query.code
  if (!code) {
    res.send('no code')
    return
  }

  // 第二步：获取 access_token
  OnceDoc.request({
      url: 'https://github.com/login/oauth/access_token'
    , headers: {
          Accept: "application/json"
      }
    , data: {
          client_id     : SOCIAL_SIGN.github.client_id
        , client_secret : SOCIAL_SIGN.github.client_secret
        , code          : code
      }
    , type: 'qs'
  }, function(err, response, data) {
    //https://api.github.com/user
    var access_token  = data.access_token
    if (!access_token) {
      res.send('no access_token')
      return
    }

    // 第三步：获取用户信息，注册必须包含， User-Agent 建议是github用户名或者APP名
    OnceDoc.request({
        url: 'https://api.github.com/user'
      , headers: {
          'User-Agent'    : 'OnceDB',
          'Authorization' : 'token ' + access_token
        }
    }, function(err, response, data) {
      if (!data.id) {
        res.send('get user info error')
        return
      }

      console.log(data)

      // 第四步：注册并写入session
      var userInfo = {
          username  : 'gh_' + data.login
        , password  : app.id(12)
        , email     : data.email
        , nickname  : data.name
        , avatar    : data.avatar_url
        , city      : data.location
      }

      OnceDoc.User.signup(userInfo, function(err) {
        //之前注册过？手动更新用户信息
        if (err) {
          console.log(err)

          oncedb.update('user', userInfo, function() {
            console.log(arguments)
          })
        }

        delete userInfo.password
        req.session.user = userInfo

        //完成，返回主页
        res.redirect('/social-sign/scan')
      })
    })
  })
})

app.get('/social-sign/oauth/linkedin/callback', function(req, res) {
  // 第一步：检查 code 用来交互 access_token; 检查 state 用来写入登录 session
  var code  = req.query.code
  if (!code) {
    res.send('no code')
    return
  }

  // 第二步：获取 access_token
  OnceDoc.request({
      url: 'https://www.linkedin.com/oauth/v2/accessToken'
    , headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    , data: {
          client_id     : SOCIAL_SIGN.linkedin.client_id
        , client_secret : SOCIAL_SIGN.linkedin.client_secret
        , redirect_uri  : SOCIAL_SIGN.linkedin.redirect_uri
        , code          : code
        , grant_type    : 'authorization_code'
      }
    , type: 'qs'
  }, function(err, response, data) {
    console.trace(data)

    //https://api.github.com/user
    var access_token  = data.access_token
    if (!access_token) {
      res.send('no access_token')
      return
    }

    // 第三步：获取用户信息，注册必须包含， User-Agent 建议是github用户名或者APP名
    OnceDoc.request({
        url: 'https://api.linkedin.com/v2/me'
      , headers: {
          'Authorization' : 'Bearer ' + access_token
        }
    }, function(err, response, data) {
      console.log(data)

      if (!data.id) {
        res.send('get user info error')
        return
      }

      // 第四步：注册并写入session
      var userInfo = {
          username  : 'in_' + data.id.replace(/[^\w]+/g, '')
        , password  : app.id(12)
        , email     : data.id + '@oncedb.com'
        , nickname  : data.localizedFirstName + ' ' + data.localizedLastName
        // , avatar    : data.avatar_url
        // , city      : data.location
      }

      OnceDoc.User.signup(userInfo, function(err) {
        //之前注册过？手动更新用户信息
        if (err) {
          console.log(err)

          oncedb.update('user', userInfo, function() {
            console.log(arguments)
          })
        }

        delete userInfo.password
        req.session.user = userInfo

        //完成，返回主页
        res.redirect('/social-sign/scan')
      })
    })
  })
})
