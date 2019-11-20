// Agency Theme JavaScript
(function($) {

  "use strict"; // Start of use strict

  // jQuery for page scrolling feature - requires jQuery Easing plugin
  $('a.page-scroll').bind('click', function(event) {
      var $anchor = $(this);
      $('html, body').stop().animate({
          scrollTop: ($($anchor.attr('href')).offset().top - 50)
      }, 1250, 'easeInOutExpo');
      event.preventDefault();
  });

  // Offset for Main Navigation
  $('#mainNav').affix({
      offset: {
          top: 100
      }
  })


  /*
  COMMANDS
  */
  $('.article-cmd').on('click', function(e) {
    var $link = $(this)
    var href  = $link.attr('href')

    e.preventDefault()

    $.get(href, function(data) {
      if (data) {
        $.messager.popup(data)
      }
    })
  })



})(jQuery);



/*编辑博客时*/
(function() {

  var $editArticleForm = $('#editArticleForm');

  if ($editArticleForm.size() < 1) {
    return
  }

  // var localStorage  = window.localStorage

  // if (!ARTICLE.content) {
  //   var oldModel = localStorage.getItem('blog.model')
  //   oldModel && $editArticleForm.view(oldModel)
  // }

  var confirmExit = false

  var $contentEditor  = $('.content-editor')
  var $filePath       = $('[name=file]')
  var $fileChoose     = $('.file-choose')
  var $fileClear      = $('.file-clear')

  var initContentFile = function() {
    $fileChoose.on('click', function() {
      OnceDoc.ChooseFile.chooseFile(function(chooseObj) {
        $filePath.val(chooseObj.path)
        $contentEditor.hide()
      }, { path: ARTICLE.file })
    })

    $fileClear.on('click', function() {
      $filePath.val('')
      $contentEditor.show()
    })

    ARTICLE.file
      ? $contentEditor.hide()
      : $contentEditor.show()
  }

  var init = function() {
    $editArticleForm.on('submit', function(e) {
      e.preventDefault();

      var model   = $editArticleForm.view()
      var editUrl = $editArticleForm.attr('action')

      // localStorage.setItem('blog.model', model)

      $.post(editUrl, model, function(json) {
        if (json && json.error) {
          $.messager.popup(json.error)
          return
        }

        var url = $.qs.get('url')

        if (url) {
          confirmExit   = true
          location.href = url
          return
        }

        url = json.url
        // localStorage.removeItem('blog.model')
        if (url) {
          confirmExit   = true
          location.href = url
          return
        }

        $.messager.popup(FE_LOCAL.SAVED_SUCCESSFULLY)
      })

      return false
    })

    window.onbeforeunload = function (e) {
      if (confirmExit) {
        return
      }

      e = e || window.event;
      if (e) {
        e.returnValue = FE_LOCAL.LEAVE_DOCUMENT_EDITING_WARNING_MESSAGE
      }

      return FE_LOCAL.LEAVE_DOCUMENT_EDITING_WARNING_MESSAGE
    };
  }

  init()
  initContentFile()

})();