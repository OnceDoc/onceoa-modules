var OurJS = window.OurJS = window.OurJS || {};

OurJS.Main = (function() {



})();

OurJS.Search = (function() {

  var $siteSearchForm = $('.site-search')
  var $inputQuery     = $siteSearchForm.find('input')
  var $realQuery      = $siteSearchForm.find('.realQuery')
  var $btnSubmit      = $siteSearchForm.find('.btn')


  var updateQuery = function(e) {
    var query = $inputQuery.val()

    $realQuery.val(query + ' site:ourjs.com')
  }

  $inputQuery.on('keyup', updateQuery)
  $btnSubmit.on('click', updateQuery)

  updateQuery()

})();