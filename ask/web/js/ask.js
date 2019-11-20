var Ask = (function() {

  var init = function() {
    var $replyForm  = $('#replyForm')
    var $id         = $('[name=id]')
    var $text       = $('[name=text]')
    var $tmpl       = $('.comment-tmpl')

    var textEditor

    tinymce.init({
        selector            : '[name=text]'
      , content_css         : '/css/bootstrap.min.css'
      , language            : (FE_LOCAL.language || '').replace('-', '_')
      , menubar             : 'edit insert format table'
      , relative_urls       : false
      , remove_script_host  : false
      , convert_urls        : true
      , plugins             : [
            "advlist autolink lists link image charmap print preview anchor"
          , "searchreplace visualblocks code fullscreen"
          , "insertdatetime media table paste textcolor colorpicker contextmenu"
        ]
      , image_dimensions    : false
      , toolbar: "insertfile undo redo | styleselect | bold italic underline strikethrough | fontselect fontsizeselect | "
          + "forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | "
          + "link image code codeSC print"
      , setup: function(editor) {
          textEditor = editor

          editor.addButton('codeSC', {
            text: '<pre>',
            icon: false,
            onclick: function () {
              editor.insertContent('<pre>\r\n</pre>');
            }
          })

          editor.on('init', function(e) {

          })

          /*
          https://stackoverflow.com/questions/33185657/why-i-cant-get-a-value-of-textarea-from-tinymce-editor-using-formdata-in-jquery
          */
          editor.on('change', function(e) {
              //editor.getContent()
              editor.save()
          })

          editor.on('keyup', function(e) {
              //editor.getContent()
              editor.save()
          })
        }
    })


    $replyForm.on('submit', function(e) {
      e.preventDefault()
      $.post('/ask/json/reply/add?id=' + $id.val(), $text.val(), function(json) {
        OnceDoc.Common.onAjaxMsg(json)
        if (json.user) {
          json.text = $text.val()

          var $reply = $tmpl.clone()
          $reply.removeClass('hide')
          $reply.view(json)

          textEditor.setContent('')

          $('#comments_list').append($reply)
        }
      })
    })

    $('.cmd-confirm').on('click', function(e) {
      e.preventDefault()
      var $this = $(this)

      $.messager.confirm(FE_LOCAL.ARE_YOU_SURE_YOU_WANT_TO_XX.format($this.text()), function() {
        $.get($this.attr('href'), function(result) {
          try {
            result = JSON.parse(result)
          } catch(e) {
            $.messager.popup(result)
            return            
          }

          if (result.error) {
            $.messager.popup(result.error)
            return
          }

          if (result.message) {
            $.messager.popup(result.message)
            return
          }

          $.messager.popup(FE_LOCAL.ACTION_SUCCESS_NEED_REFRESH)
        })
      })
    })
  }

  init()


})();