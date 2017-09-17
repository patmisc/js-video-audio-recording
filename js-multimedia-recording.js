/******************************************************************************
 * ZADS MULTIMEDIA JAVASCRIPT RECORDER
 * @category   function
 * @package    ZADS
 * @copyright  2017 PATMISC-WEBDESIGN  http://www.zads.fr/
 * @version    0.9.0
 ******************************************************************************/
/**-----------------------------------------------------------------------------
* HOW TO USE IT ? 
* simply call the init_webrtc(media, srctype) 
*   media : can be  : picture_snap | audio_recording | video_recording 
*   srctype  : if the source element name calling this function -  (used when saving the video on PHP side ) 
*-----------------------------------------------------------------------------*/


// ----------------------------------------------------------------------------
// multimedia recorder
// ----------------------------------------------------------------------------
var is_webrtc_capable=false; 
var is_live_stream_open=false; // indicate whether a live strem is open or not
var recorderNode ; // DO NOT CHANGE !!!  very important to make it global variable otherwise, this does not work !  
var globalMediaStream; // variable to stode the media stream 

// normalize the access and check if capable 
if (!navigator.getUserMedia) navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
is_webrtc_capable = navigator.getUserMedia ; 

var pid=0; 
var prev_media_opts=''; 

// init the system sounds tracks
var sys_sound_collection = init_sys_sounds(); 

/**-----------------------------------------------------------------------------
* This function initialize the webrtc session and display dynamics
* media_options defines what we want to do with the multitemdia interface 
*   can be  : picture_snap | audio_recording | video_recording 
* src type if the source element name calling this function -  (used when saving on server side) 
*-----------------------------------------------------------------------------*/
function init_webrtc(media_options, srctype) {

  console.log('__in init_webrtc'); 
  if (typeof media_options === 'undefined') var media_opts="all"; else var media_opts = media_options;
    
  // check if settings enable this feature
  if (   (media_opts=="audio_recording" && !display_settings.audio.audio_rec_online) 
      || (media_opts=="video_recording" && !display_settings.video.video_rec_online) 
      || (media_opts=="picture_snap" && !display_settings.picture_rec_online) 
      ) {
    message = 'If you reject access to your local media, this feature cannot be used. Bye.';
    displayMessage(message,false);
    return false; //exit the function 
  }


  // create Oscillator node DEBUG 
  // var oscillator = audioCtx.createOscillator();
  // oscillator.type = 'sine';
  // oscillator.frequency.value = 400; // value in hertz
  // oscillator.start();

  var display_analysers=true; 
  // Audio format options   
  var wav_channels=2; // set to 1 for Mono_ 2 for 2 channels 
  var wav_sampleRate=16000; // forced sample resolution on kHz  can be 8000, 16000, set to FALSE to use default 

  function process_webrtc(localMediaStream){
      // init the display zones 
        display_booth(media_opts);

        // CLOSEEVENT  all media stram collection. 
        $('#my_booth .close').click(function(e){ 
          // localMediaStream.stop(); is_live_stream_open=false;
          $('#my_booth_mask').hide(); $('#my_booth').hide(); 

          if (localMediaStream.getAudioTracks().length) {
            // disconnect all audio nodes: 
            microphoneNode.disconnect(gainNode);
            analyserInNode.disconnect(recorderNode);
            recorderNode.disconnect(audioCtx.destination);
            audioCtx.close(); // close the audio context   
          }
          recording=false; 
          
          // stop the media streams (audio or video) 
          is_live_stream_open=false; 
          globalMediaStream.getTracks().forEach(track => track.stop());

        }); 

        //connect video stream to video booth
        if (localMediaStream.getVideoTracks().length) {

          // for video recording 
          var mediaRecorder;
          var chunks = [];
          var count = 0;

          var _video = $('#my_booth #my_main_video')[0];
          _video.src = window.URL.createObjectURL(localMediaStream);

          // Note: onloadedmetadata doesn't fire in Chrome when using it with getUserMedia.
          // See crbug.com/110938.
          // onloadedmetadata --> replaced with Canplay to be compatible with firefox
          // oncanplay -> called each timeanew stream arrives 
          _video.onloadedmetadata = function(e) {

            ratio = _video.videoWidth  / _video.videoHeight;
            if (_video.videoWidth==0) ratio = 1.34; // FIREFOX bug whenre  videoWidth is not defined at that time ! 

            if (_video.videoWidth>0) w=_video.videoWidth ; 
            else w = _video.offsetWidth;
            h = parseInt(w / ratio, 10);

            // set to snap canvas
            _snap_canvas=$('#my_booth #snap_canvas')[0];
            if (_snap_canvas) {
              _snap_canvasCtx = _snap_canvas.getContext('2d'); 
              _snap_canvas.width = w;
              _snap_canvas.height = h;
            }

            var record_name ="no name yet";
            var genuine_snap_imageData=[]; // to store genuine image datas
            var genuine_dataCopy=[];

            $('.video_snap_btn').click(function(e){
              e.preventDefault();
              var vc =$("#video-countdown"); 
              

              _what = $(this).data('what');  
              _recordBtn = $(this); 
              // _playStopBtn=$('#my_booth .video_playstop_btn');
              _downloadBtn=$('#my_booth .video_download_btn');
              _saveBtn=$('#my_booth .video_save_btn');
              _btns=$('#my_booth .actions-btns .btn');
              _videoPlayer =$('#my_booth #my_record_video');
              _videoTitle=$('#my_booth .video_title'); // the display zone 
              _recCounter=$('#my_booth .record-counter .record_duration'); // the recording counter
              _recSize = $('#my_booth .record-size .record-cur-size');

              // reset the download button 
              $('.video_download_hidden').attr('href', '').attr('download', ''); 

              // launch the count down 
              var counter = 3;
              vc.css({visibility: "visible"}).html("<p>" + counter + "</p>").show(); 
              vc.delay(400).fadeOut(100);
              play_track(sys_sound_collection, 'countdown' );
              setTimeout(ct_action, 700); 

              function ct_action(){
                  counter--; 
                  is_recording=false; 
                  if (counter == 0) {

                    // ============ case of VIDEO recording  ============================
                    if (_what=="video"){

                      // hide the countdown  and  play sound 
                      vc.css({visibility: "hidden"}).html("<p>" + counter + "</p>").hide();
                      play_track(sys_sound_collection, 'capture' );
                      console.log('in recording video'); 

                      // check media recorder exists
                      if (typeof MediaRecorder === 'undefined') {
                        console.log('MediaRecorder not supported on your browser, use Firefox >30 or Chrome >49 instead.');
                      }

                      console.log('Start recording...');
                      if (typeof MediaRecorder.isTypeSupported == 'function'){
                        /*
                          MediaRecorder.isTypeSupported is a function announced 
                          in https://developers.google.com/web/updates/2016/01/mediarecorder and later 
                          introduced in the MediaRecorder API spec http://www.w3.org/TR/mediastream-recording/
                        */
                        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                          var options = {mimeType: 'video/webm;codecs=vp9'};
                        } else 
                        if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                          var options = {mimeType: 'video/webm;codecs=h264'};
                        } else  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                          var options = {mimeType: 'video/webm;codecs=vp8'};
                        }
                        console.log('Using '+options.mimeType);
                        mediaRecorder = new MediaRecorder(localMediaStream, options);
                      }else{
                        console.log('isTypeSupported is not supported, using default codecs for browser');
                        mediaRecorder = new MediaRecorder(localMediaStream);
                      }

                      _recordBtn.html('<i class="icon-fa-stop"></i>'+$.i18n._("Stop")).addClass('recording');

                      chunks = []; // reset chunk
                      mediaRecorder.start(10);
                      _videoTitle.html('<i class="icon-fa-circle mr6"></i>'+$.i18n._('video recording ...')).addClass('recording');; 

                      // at the same time, display the video flow beeing recorded
                      var url = window.URL || window.webkitURL;
                      var videoOut=_videoPlayer[0];
                      videoOut.controls = false;
                      videoOut.src = url ? url.createObjectURL(localMediaStream) : localMediaStream;
                      videoOut.play();

                      // === events  handlers on player 
                      // videoOut.addEventListener('timeupdate',function (){
                      //       console.log('videoOut timeupdate'); 
                      // });

                      videoOut.addEventListener('play',function (){
                        if (!is_recording) _videoTitle.html($.i18n._('playing the recorded video ...')).removeClass('playing recording').addClass('playing'); 
                      });

                      videoOut.addEventListener('ended',function (){
                            _videoTitle.html($.i18n._('the recorded video')).removeClass('playing recording'); 
                      });

                      videoOut.addEventListener('pause',function (){
                            _videoTitle.html($.i18n._('paused the recorded video')).removeClass('playing recording'); 
                      });

                      var firstTimer=true; 
                      var cumulSize = 0; 
                      mediaRecorder.ondataavailable = function(e) {
                        if (e.data && e.data.size > 0) {
                          chunks.push(e.data);
                        }

                        // display timecode to get duration
                        if (firstTimer===true)firstTimer=e.timecode;
                        t1= e.timecode - firstTimer; 
                        _recCounter.html(format("# ##0.0", t1/1000));



                        // display size
                        cumulSize += e.data.size; 
                        _recSize.html(format("# ##0.0", bytesToSize(cumulSize))); 

                        // protection to stop the recording 
                        if (
                               t1 >= parseInt(display_settings.video.video_rec_max_duration)*1000
                            || cumulSize >= parseInt(display_settings.video.video_file_max_size)
                          ){
                          if (mediaRecorder.state !="inactive")  mediaRecorder.stop();
                          
                        }

                      };


                      mediaRecorder.onerror = function(e){
                        console.log('Error: ', e);
                        is_recording=false;
                      };


                      mediaRecorder.onstart = function(){
                        console.log('Started & state = ' + mediaRecorder.state);
                        is_recording=true;
                      };

                      mediaRecorder.onstop = function(){
                        console.log('Stopped  & state = ' + mediaRecorder.state);

                        $(this).html('<i class="icon-fa-circle mr6"></i>'+ $.i18n._("record again")).removeClass('recording');
                        is_recording=false;

                        // activate action buttons
                        _btns.removeClass('disabled');

                        // displaythe video with controls 
                        var superBuffer = new Blob(chunks, {type: 'video/webm'});
                        console.log('Blob  : type='+ superBuffer.type + '->'+ bytesToSize(superBuffer.size));

                        videoOut.src = window.URL.createObjectURL(superBuffer);
                        videoOut.controls = true;

                        _videoTitle.html($.i18n._('the recorded video')); 
              
                      };

                      mediaRecorder.onpause = function(){
                        console.log('Paused & state = ' + mediaRecorder.state);
                        _videoTitle.html($.i18n._('paused ...')); 
                        is_recording=false;
                      }

                      mediaRecorder.onresume = function(){
                        console.log('Resumed  & state = ' + mediaRecorder.state);
                        _videoTitle.html($.i18n._('video recording ...'));
                        is_recording=true; 
                      }

                      mediaRecorder.onwarning = function(e){
                        console.log('Warning: ' + e);
                        is_recording=false;
                      };


                      // handler on record/pause button 
                      _recordBtn.off('click').on('click', function(e){
                        e.preventDefault();                         
                        if ($(this).hasClass('recording')){
                          // stop a recording
                          if (mediaRecorder.state !="inactive") mediaRecorder.stop();

                        } else {
                          // restart a recording 
                          counter = 3;
                          vc.css({visibility: "visible"}).html("<p>" + counter + "</p>").show(); 
                          vc.delay(400).fadeOut(100);
                          play_track(sys_sound_collection, 'countdown' );
                          setTimeout(ct_action, 700); 
                        }

                      }); 



                      // -- downloading the recorder video to local pc
                      _downloadBtn.off('click').on('click', function (e){
                        e.preventDefault();
                        var rec_url = window.URL.createObjectURL(new Blob(chunks, {type: 'video/webm'}));
                        var record_name =  'video_' + new Date().getTime() + '.webm'; 
                        $('.video_download_hidden').attr('href', rec_url).attr('download', record_name); 
                        $('.video_download_hidden')[0].click();
                      });


                      // -- saving the recorded video to PHP server for storage via AJAX command 
                      _saveBtn.off('click').on('click', function (e){
                        e.preventDefault();
                        console.log('__ in _saveBtn.click ');

                        if ($(this).hasClass('disabled')) return false ; // quit 
                        var record_name =  'video_' + new Date().getTime() + '.webm'; 
                        var reader = new FileReader(); 
                        reader.readAsDataURL(new Blob(chunks, {type: 'video/webm'}));
                        reader.onload = function () {
                          datauri = reader.result; 

                          // if (datauri) {
                          payload= "action=save&type=videoblob&subtype="+srctype+"&name="+record_name+"&datauri="+datauri;

                          //hide the button and display the loading
                          var rel_progress=$('#my_booth .booth_progress'); 
                          rel_progress.show();
                          var _actions_btns = $('#my_booth .actions-btns');
                          _actions_btns.hide(); 

                          $.ajax({
                            type: 'POST', url: "phpsvr/tmp2.php",
                            data: payload,
                            // cache: false,contentType: false, processData: false,
                            dataType: "json", // important to indicate the returned format 
                            xhr: function() {
                               var req = $.ajaxSettings.xhr();
                                if (req) {
                                    req.upload.addEventListener('progress', function(e) {
                                      if (e.lengthComputable) {
                                        var percentVal = Math.round(e.loaded / e.total * 100)  + '%';
                                        // console.log(percentVal); 
                                        rel_progress.find('.bar').width(percentVal) ; 
                                        rel_progress.find('.percent').html(percentVal);
                                      }
                                    }, false);
                                }
                                return req;
                            },
                            success: function (response) {
                              var t3='';
                              if (response.success){

                                var thisbaseidx = (response.sftype) ? (response.sftype) : "filename" ; 
                                var imgid = findFreeImgPreviewId(thisbaseidx); 
                                if (!imgid) displayMessage("no more space left to save the recorded element", false); 
                                else {

                                  var wherepreview = $('#uploadbtn_'+thisbaseidx+'_'+imgid); 
                                  add_media_preview(wherepreview, response.data);

                                  $('#my_booth .close').click(); // exit the window
                                }

                              } else {
                                displayMessage(response.message, false); 
                              }
                            } // end success
                          });// end Ajax call 
                        } // end READER onload 
                      }); 

                    } else {

                      // hide counter
                      vc.css({visibility: "hidden"}).html("<p>" + counter + "</p>").hide();
                      play_track(sys_sound_collection, 'capture' );
                       $("#video-flash").show();  // fhow the flash 
                       setTimeout(function() {
                          $("#video-flash").fadeOut(250);
                          // finished and take the picture
                          // _snap_canvasCtx.fillStyle = "black"; // this is for the background not beeing black 
                          _snap_canvasCtx.fillRect(0,0,w,h); 
                          _snap_canvasCtx.drawImage(_video, 0,0,w,h);

                          genuine_snap_imageData = _snap_canvasCtx.getImageData(0, 0, w, h);
                          genuine_dataCopy = new Uint8ClampedArray(genuine_snap_imageData.data);

                          // reset the effect button 
                          $('.snap_effect_btn').removeClass('disabled').attr('z-id', '0'); // set to normal
                          $('.snap_download_btn').removeClass('disabled'); // set to normal 
                          $('.snap_save_btn ').removeClass('disabled'); // set to normal 
   
                          $(".video_effect").text($.i18n._("effect_"+effectsList[0])).show(); 
                          $('.video_effect_range_wrapper').hide();


                       }, 250); 
                    }
                      
                  } else {
                      vc.html("<p>" + counter + "</p>").show().delay(400).fadeOut(100);
                      setTimeout(ct_action, 700); 
                      play_track(sys_sound_collection, 'countdown' );

                  }
              }
            });

            var effectsList = Array('nornal', 'sepia', 'brightness', 'contrast', 'desaturate','grayscale', 'threshold', 'noise', 'invert');
            // to apply effects  
            $('.snap_effect_btn').click(function(e){
              e.preventDefault(); 
              // var rneffect=effectsList[Math.floor(Math.random()*effectsList.length)];
              
              var cur_effectid = parseInt($(this).attr('z-id'))+1; 
              var rneffect = effectsList[cur_effectid];

              if (cur_effectid >= effectsList.length-1) $(this).attr('z-id','-1'); 
              else $(this).attr('z-id',cur_effectid);

              // console.log(rneffect);
              $(".video_effect").text($.i18n._("effect_"+rneffect)).show(); 

              // display ofnot the range slider to tune effects 
              if (in_array(rneffect, ['threshold','brightness', 'noise', 'contrast', 'desaturate'])){
                $('.video_effect_range_wrapper').show(); $('#video_effect_range').val(25);$('.video_effect_range_value').text("25");
              } else $('.video_effect_range_wrapper').hide();

              var imagex = genuine_snap_imageData;
              imageDatax = imagex.data
              imageDatax.set(genuine_dataCopy); // restaure the original datas before processing it

              if (rneffect!="normal") imagex.data = addEffects(imageDatax,rneffect);               
              _snap_canvasCtx.putImageData(imagex, 0, 0);

            }); 

            // effect on slider 
            $('#video_effect_range').change(function(){
              var var1 = $(this).val();
              var cur_effect = effectsList[$('.snap_effect_btn').attr('z-id')]; 
              $('.video_effect_range_value').html(var1);
              if (in_array(cur_effect, ['threshold','brightness', 'noise', 'contrast','desaturate'])){
                var imagex = genuine_snap_imageData;
                imageDatax = imagex.data
                imageDatax.set(genuine_dataCopy); // restaure the original datas before processing it
                imagex.data = addEffects(imageDatax,cur_effect, var1);               
                _snap_canvasCtx.putImageData(imagex, 0, 0);

              } 
            }); 

        
            $('.snap_download_btn').click(function(e){
                e.preventDefault();  
                record_name =  'my_snap_' + new Date().getTime() + '.png'; 
                snap_url=_snap_canvas.toDataURL('image/png'); 
                $('.snap_download_hidden').attr('href', snap_url).attr('download', record_name); 
                $('.snap_download_hidden')[0].click(); 
                // window.open(snap_url);
            });

            $('.snap_save_btn').click(function(e){
              console.log('__ in snap_save_btn.click ');

                if ($(this).hasClass('disabled')) return false ; // quit 

                var datauri =  _snap_canvas.toDataURL('image/png'); 

                if (datauri) {
                  payload= "action=save&type=pictureblob&subtype="+srctype+"&name=mysnap.png&datauri="+datauri;

                  //hide the button and display the loading
                  var rel_progress=$('#my_booth .booth_progress'); 
                  rel_progress.show();
                  var _actions_btns = $('#my_booth .actions-btns');
                  _actions_btns.hide(); 

                  $.ajax({
                    type: 'POST', url: "phpsvr/tmp2.php",
                    data: payload,
                    // cache: false,contentType: false, processData: false,
                    dataType: "json", // important to indicate the returned format 
                    xhr: function() {
                       var req = $.ajaxSettings.xhr();
                        if (req) {
                            req.upload.addEventListener('progress', function(e) {
                              if (e.lengthComputable) {
                                var percentVal = Math.round(e.loaded / e.total * 100)  + '%';
                                // console.log(percentVal); 
                                rel_progress.find('.bar').width(percentVal) ; 
                                rel_progress.find('.percent').html(percentVal);
                              }
                            }, false);
                        }
                        return req;
                    },
                    success: function (response) {
                      var t3='';
                      if (response.success){

                        var thisbaseidx = (response.sftype) ? (response.sftype) : "filename" ; 
                        var imgid = findFreeImgPreviewId(thisbaseidx); 
                        if (!imgid) displayMessage("no more space left to save the recorded element", false); 
                        else {

                          var wherepreview = $('#uploadbtn_'+thisbaseidx+'_'+imgid); 
                          add_media_preview(wherepreview, response.data);

                          $('#my_booth .close').click(); // exit the window
                        }

                      } else {
                        displayMessage(response.message, false); 
                      }
                    } // end success
                  });// end Ajax call 
                }
              });
          };
        }

        // process the audio files - create aa Source audio NODE which can then be connected 
        // microphone -> processing -> destination ; 
        if (localMediaStream.getAudioTracks().length) {


          // audio context = graph representing connection between audio nodes 
          window.AudioContext = window.AudioContext || window.webkitAudioContext;
          var audioCtx = new AudioContext();
          var real_sample_rate = audioCtx.sampleRate; // get the sample rate capabilities of the device
          var gainNode = audioCtx.createGain();
          var analyserInNode = audioCtx.createAnalyser();
          var analyserOutNode = audioCtx.createAnalyser();
          var bufferSize = 2048;

          var microphoneNode = audioCtx.createMediaStreamSource(localMediaStream);
        
          // var microphoneNode=oscillator; // DEBUG
          recorderNode = audioCtx.createScriptProcessor(bufferSize, 2, 2);

          // connect all that
          microphoneNode.connect(gainNode);

          
          if (display_analysers){
            gainNode.connect(analyserInNode);
            analyserInNode.connect(recorderNode);
            // recorderNode.connect(analyserOutNode);
            // analyserInNode.connect(analyserOutNode);
            // analyserOutNode.connect(audioCtx.destination);
            recorderNode.connect(audioCtx.destination);
            
          } else {
            gainNode.connect(recorderNode);
            recorderNode.connect(audioCtx.destination);
          }


          // functions for the analyzers 
          if (display_analysers){
            var canvas_in = document.querySelector('#in-visu');
            visualize(analyserInNode,canvas_in);
          }

          var leftchannel = [];
          var rightchannel = [];
          var recorder = null;
          var recording = false;
          var recordingLength = 0;

          // event handlers for the mute button 
          $('#my_booth .mute_btn').click(function(e){
            $(this).toggleClass('muted'); 
            if ($(this).hasClass('muted')) gainNode.gain.value=0 ; // 1 for unmute  
            else gainNode.gain.value=1 ;
          }); 

          $('#my_booth .record_btn').click(function(e){

            $('.visu_timeline').hide(); 

            if ($(this).hasClass('recording')) { 
              $(this).removeClass('recording') .find('label').text($.i18n._($(this).attr('z-label')));
              recording=false;
              if (recordingLength) {
                $('.wav_playstop_btn').removeClass('disabled'); // set to normal
                $('.wav_download_btn').removeClass('disabled'); // set to normal 
                $('.wav_save_btn ').removeClass('disabled'); // set to normal 
                // console.log("recording length="+recordingLength); 
                // console.log("recording time ("+real_sample_rate+") ="+recordingLength/(real_sample_rate)+"s"); 
                create_wav(); 
              }
              else console.log("ERROR - no file recorded");
            } 
            else  {
              $(this).addClass('recording').find('label').text($.i18n._($(this).attr('z-label-alt')));
              recording=true;
              // leftchannel.length = rightchannel.length = 0;
              leftchannel=[]; rightchannel=[]; 
              recordingLength = 0;
              // console.log(recorderNode); 
            } 
          }); 

          // this is called every 48 000 sample per seonds and buffer of 2048
          //= 48000/2048 =  0,042s = 42ms
          var rec_time=0; 
          var it=0;  
          var forcedstop=false; 
          var max_recording_seconds= (display_settings.audio.audio_rec_max_duration ) ? parseInt(display_settings.audio.audio_rec_max_duration) : 600 ; 
          recorderNode.onaudioprocess = function(e){
            // console.log("on audio process for process");
            if (!recording) { rec_time=0;it=0;forcedstop=false;return;} // exit 
            var left = e.inputBuffer.getChannelData(0);
            var right = e.inputBuffer.getChannelData(1);

            // we clone the samples
            leftchannel.push (new Float32Array (left));
            rightchannel.push (new Float32Array (right));
            recordingLength += bufferSize;

            rec_time= (recordingLength/real_sample_rate);
            it++ ; 

            if (rec_time>=max_recording_seconds) {
              recording=false;  it=3; rec_time=max_recording_seconds;forcedstop=true;
            } // stop the rcecording and force a display 
            
            
            if (it==3){ 
              $('.record_duration').html(format("# ##0.000", rec_time) + '/' + max_recording_seconds+'s');
              it=0; 
              if (forcedstop)  
                $('#my_booth .record_btn').click(); // force aclick
            }

            // live display the wav form
            if (!forcedstop){
              var canvaswav = document.getElementById( "wavedisplay" );
              drawBuffer(canvaswav, left );
            }

          }

        } // end if has audio track ! 


        // create the wav file from input buffer 
        function create_wav(){
            // we flat the left and right channels down
            var leftBuffer = mergeBuffers ( leftchannel, recordingLength );
            var rightBuffer = mergeBuffers ( rightchannel, recordingLength );

            // display them into visualization screen
            var canvaswav = document.getElementById( "wavedisplay" );
            drawBuffer(canvaswav, leftBuffer );

            // we interleave both channels together
            var interleaved = interleave ( leftBuffer, rightBuffer );
            var view  = encodeWAV(interleaved) ;    


            // our final binary blob
            var blob = new Blob ( [ view ], { type : 'audio/wav' } );
            var record_name =  'my_recording_' + new Date().getTime() + '.wav'; 
            
            // let's save it locally
            var url = (window.URL || window.webkitURL).createObjectURL(blob);

            // saveit temporaty in an audio player
            _audioPlayer=$("#wav_audio_player")[0];
            _audioPlayer.src = url ;
            _audioPlayer.play(); // play by default

            $('.wav_playstop_btn').click(function (e){
              e.preventDefault();
              if(_audioPlayer.paused) { _audioPlayer.play(); $(this).find('label').text($.i18n._($(this).attr('z-label-alt')));  }
              else {_audioPlayer.pause(); _audioPlayer.currentTime = 0; $(this).find('label').text($.i18n._($(this).attr('z-label'))); }// force a stop !
            }); 

            _audioPlayer.addEventListener('timeupdate',function (){
                var duration = _audioPlayer.duration;    // Durée totale
                var time     = _audioPlayer.currentTime; // Temps écoulé
                var fraction = time / duration;
                var percent  = Math.ceil(fraction * 100);

                $('.visu_timeline').css('width', 100*fraction+'%').show(); 

                // end of file 
                play_stop_ctrl = $('.wav_playstop_btn'); 
                if (fraction==1)
                  play_stop_ctrl.find('label').text($.i18n._(play_stop_ctrl.attr('z-label'))); // play 
                else {
                 if(!_audioPlayer.paused) play_stop_ctrl.find('label').text($.i18n._(play_stop_ctrl.attr('z-label-alt'))); // pause display
                }

            });


            $('.wav_download_btn').attr('href', url).attr('download', record_name).click(function(e){
              donothing=1;
            }); 

            // save it on server side 
             $('.wav_save_btn').click(function (e){

              console.log('__ in wav_save_btn.click ');
              
              e.preventDefault();

              var payload=new FormData();
              payload.append("uploadedfile",blob, record_name);
              payload.append( 'type', 'audioblob' );
              payload.append( 'lid', 0);
              payload.append( 'what', 'ad' );

              //hide the button and display the loading
              var rel_progress=$('#my_booth .booth_progress'); 
              rel_progress.show();
              var _actions_btns = $('#my_booth .actions-btns');
              _actions_btns.hide(); 


              // make the ajax call
              $.ajax({
                type: 'POST',
                url: "phpsvr/tmp2.php",
                data: payload,
                cache: false,contentType: false,processData: false,
                dataType: "json", // important to indicate the returned format 
                xhr: function() {
                    var req = $.ajaxSettings.xhr();
                    if (req) {
                        req.upload.addEventListener('progress', function(e) {
                          if (e.lengthComputable) {
                            var percentVal = Math.round(e.loaded / e.total * 100)  + '%';
                            //console.log(percentVal); 
                            rel_progress.find('.bar').width(percentVal) ; 
                            rel_progress.find('.percent').html(percentVal);
                          }
                        }, false);
                    }
                    return req;
                },
                
                success: function (response) {
                  var t3='';

                  if (response.success){

                    var thisbaseidx = (response.type=="audioblob") ? "audiourl" : "videourl" ; // for audio or video 
                    var imgid = findFreeImgPreviewId(thisbaseidx); 
                    if (!imgid) displayMessage("no more space left to save the recorded element", false); 
                    else {
                      var wherepreview = $('#uploadbtn_'+thisbaseidx+'_'+imgid); 
                      add_media_preview(wherepreview, response.data);
                      $('#my_booth .close').click(); // exit the window
                    }
                  } else {
                    displayMessage(response.message, false); 
                  }
                  
                } // end success
              });




            }); 

        }


        // audio processig elements
        function interleave(inputL, inputR){

          var  mono_channel= (wav_channels==1)? true: false; 
          var resamplingratio=false; 

          if (mono_channel) var length = inputL.length ;
          else var length = inputL.length + inputR.length;

          //applying the resampling
          if (wav_sampleRate){
             resamplingratio =   real_sample_rate/wav_sampleRate ; 
             // console.log(resamplingratio) ; 
             length=length/resamplingratio ; // reduce the length
          }

          var result = new Float32Array(length);

          var index = 0,inputIndex = 0;
          while (index < length){
            if (mono_channel){
              result[index++] =0.5 * (inputL[inputIndex] + inputR[inputIndex]);
            }
            else {
              result[index++] = inputL[inputIndex];
              result[index++] = inputR[inputIndex];
            }
            // make the resampling 
            if (resamplingratio>1) inputIndex += resamplingratio;
            else inputIndex++
          }
          return result;
        }


        function mergeBuffers(recBuffers, recLength){
          var result = new Float32Array(recLength);
          var offset = 0;
          for (var i = 0; i < recBuffers.length; i++){
            result.set(recBuffers[i], offset);
            offset += recBuffers[i].length;
          }
          return result;
        }

        function writeUTFBytes(view, offset, string){ 
          var lng = string.length;
          for (var i = 0; i < lng; i++){
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        }

        function encodeWAV(samples){
          var buffer = new ArrayBuffer(44 + samples.length * 2);
          var view = new DataView(buffer);
          var sampleRate = 44100;
          if (wav_sampleRate) sampleRate = wav_sampleRate ; // modify the sample resolution 

          // .WAV - STANDARD 
          // 44.1 kHz
          // 16 bit 
          // stereo
          // = 176kB/sec  -> 30 sec = 5,2MB ! 

          // .WAV - LOW RESOLUTION  
          // 8 kHz
          // 16 bit 
          // stereo
          // = 32kB/sec  -> 30 sec = 0,96MB ! 

          // .WAV - MEDIUM RESOLUTION  
          // 16 kHz
          // 16 bit 
          // stereo
          // = 64kB/sec  -> 30 sec = 2MB ! 

          // write the WAV container, check spec at: https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
          /* RIFF identifier */
          writeString(view, 0, 'RIFF');
          /* file length = 32 + Subchunk2Size*/
          view.setUint32(4, 32 + samples.length * 2, true);
          /* RIFF type */
          writeString(view, 8, 'WAVE');
          /* format chunk identifier */
          writeString(view, 12, 'fmt ');
          /* format chunk length */
          view.setUint32(16, 16, true);
          /* sample format (raw 1=PCM) */
          view.setUint16(20, 1, true);
          /* channel count 2 for stereo */
          view.setUint16(22, wav_channels, true);
          /* sample rate */
          view.setUint32(24, sampleRate, true);
          /* byte rate (sample rate * block align) SampleRate * NumChannels * bytes per sample */
          view.setUint32(28, sampleRate * wav_channels * 2, true);
          /* block align (channel count * bytes per sample) */
          view.setUint16(32, wav_channels*2, true);
          /* bits per sample here it's 16 */
          view.setUint16(34, 16, true);
          /* data chunk identifier */
          writeString(view, 36, 'data');
          /* data chunk length  Subchunk2Size     = NumSamples * NumChannels * BitsPerSample/8 */
          view.setUint32(40, samples.length * 2, true);

          floatTo16BitPCM(view, 44, samples);

          return view;
        }

        function floatTo16BitPCM(output, offset, input){
          for (var i = 0; i < input.length; i++, offset+=2){
            var s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            // output.setInt16(offset,  input[i] * 0x7FFF, true);
          }
        }

        function writeString(view, offset, string){
          for (var i = 0; i < string.length; i++){
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        }
      }

  if (is_webrtc_capable)
  {


    display_LOADING_message(_c($.i18n._('booth loading in progress'))); 


    if (media_opts=="audio_recording") web_rtc_context =   {video: false, audio: true}; 
    else if (media_opts=="picture_snap") web_rtc_context =   {video: true, audio: false};
    else  web_rtc_context =   {video: true, audio: true};

    // specila patch to check if we need to re-create the stream 
    if (prev_media_opts!='' && prev_media_opts!=media_opts) { is_live_stream_open=false; globalMediaStream.getTracks().forEach(track => track.stop());}

    // Not showing vendor prefixes.
    if (!is_live_stream_open){
      navigator.getUserMedia(web_rtc_context, 

        // IF SUCCESS  -> function call for success 
        function(localMediaStream) {
          // get the streams 
          console.log('== Creating a new MEDIASTREAM ', localMediaStream) ;
          console.log('-- mediatream tracks =',localMediaStream.getTracks());
          globalMediaStream = localMediaStream ; 
          is_live_stream_open=true;
          prev_media_opts=media_opts; 
          process_webrtc(localMediaStream);
        }, 

        // if ERROR function call for error 
        function(e) {
          message = 'If you reject access to your local media, this feature cannot be used. Bye.';
          displayMessage(message,false);
         
        }
      ); // end call getUserMedia
    } else {
      localMediaStream = globalMediaStream ; 
      process_webrtc(localMediaStream);
      console.log('== Reusing existing open MEDIASTREAM .... ');
    } // end of when active functions

  } // end is webrtc 
  else {
    message = 'This capability (getUserMedia) is not supported in your browser';
    displayMessage(message,false);
  }
}

/**-----------------------------------------------------------------------------
* This function draw a Buffer 
*-----------------------------------------------------------------------------*/
function drawBuffer(canvaswav, data ) {
    var width = canvaswav.width, height = canvaswav.height, context = canvaswav.getContext('2d') ; 
    var step = Math.ceil( data.length / width );
    var amp = height / 2;
    // context.fillStyle = "silver";
    context.fillStyle ='rgb(255, 255, 255)';
    context.fillRect(0,0,width,height);
    for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (j=0; j<step; j++) {
            var datum = data[(i*step)+j]; 
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
        context.fillStyle = 'rgb(200, 50, 50)';
        // context.fillRect(x,y,width,height);
        context.fillRect(   i,  (1+min)*amp,        2,        Math.max(1,(max-min)*amp));
        // context.fillRect(   i,  (1+min)*amp,        2,  2);
    }
}

/**-----------------------------------------------------------------------------
* This function display bar grapph
*-----------------------------------------------------------------------------*/
function visualize(analyser, canvas){

    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    var canvasCtx = canvas.getContext("2d"); // get an object to be able to draw on it  ! 

    analyser.fftSize = 256; 
    //Is an unsigned long value representing the size of the FFT (Fast Fourier Transform) to be used to determine the frequency domain.   
    
    var bufferLength = analyser.frequencyBinCount;
    //Is an unsigned long value half that of the FFT size. This generally equates to the number of data values you will have to play with for the visualization
    
    var dataArray = new Uint8Array(bufferLength);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    function draw() {
      drawVisual = requestAnimationFrame(draw);
      // call the animation toredraw this object 

      analyser.getByteFrequencyData(dataArray);
      //Copies the current frequency data into a Uint8Array (unsigned byte array) passed into it.

      canvasCtx.fillStyle = 'rgb(255, 255, 255)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      var barWidth = (WIDTH / bufferLength) * 2.5;
      var barHeight;
      var x = 0;

      for(var i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
        canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);

        x += barWidth + 1;
      }
    };

    draw();
}

/**-----------------------------------------------------------------------------
* This function initialize the audio sound collection list
* get sound here for example : https://notificationsounds.com/wake-up-tones/solemn-522
*-----------------------------------------------------------------------------*/
function init_sys_sounds(){
    var  e = ["countdown", "capture", "message"];
    var b = {}, audio_collection = {};

    // load all songs
     if (!!window.Audio) {
        for (var f = e.length; f--; ) {
            var g = new window.Audio();
            g.src = "./audio/" + e[f] + ".ogg";
            audio_collection[e[f]] = g ; 
        }
    }
    return audio_collection; 
}


/**-----------------------------------------------------------------------------
* This function play a given track for a given duration from preloaded sound collection 
*-----------------------------------------------------------------------------*/
function play_track(collection, track, duration){
    if (!!window.Audio) {
        setTimeout(function() {
            if (collection[track]) {
                collection[track].play(); 

            }
        }, duration || 0)
    }
}

/**-----------------------------------------------------------------------------
* This function add effects on RDB datas
*-----------------------------------------------------------------------------*/
function addEffects(dRDBA, effect, var1){
    // storead as RGBA
    //Red, Green, Blue and Alpha can be any integer value from 0 to 255, with the Alpha values representing 0 as transparent and 255 as visible.
    var d= dRDBA; 

    for (var i = 0, l = d.length; i < l; i += 4) {
        if (effect=="red"){
            d[i + 1] = 0; // green
            d[i + 2] = 0; // blue
        }

         if (effect=="invert"){
            d[i] = 255 - d[i]; // r
            d[i + 1] = 255 - d[i + 1]; // g
            d[i + 2] = 255 - d[i + 2]; // b
        }
        if (effect=="special"){
           if (d[i] > 127) {
            d[i + 3] = 127;
            }
        }

        if (effect=="grayscale"){
           var v = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
           d[i] = d[i+1] = d[i+2] = v ; 
        }

        if (effect=="threshold"){
           var threshold=128; 
           if (var1) threshold = (256*var1/50) ; // patch when variable is defined
           realvar=threshold; 

           var v = ((0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) >= threshold) ? 255:0;
           d[i] = d[i+1] = d[i+2] = v ; 
        }

        if (effect=="brightness"){
          adjustment=40; 
          if (var1) adjustment = (100*var1/50) ;
          realvar=adjustment; 

          d[i] += adjustment;
          d[i+1] += adjustment;
          d[i+2] += adjustment;
         }

              
        if (effect=="sepia"){
          r = d[i];g = d[i+1]; b = d[i+2];
          d[i] = r * 0.393 + g * 0.769 + b * 0.189;
          d[i+1] = r * 0.349 + g * 0.686 + b * 0.168;
          d[i+2] = r * 0.272 + g * 0.534 + b * 0.131;
        }

        if (effect=="contrast"){
          contrastFactor=1; // var1 must be between -255 and 255 
          if (var1) contrastFactor = (259 * ( ((var1-25)*(255/25)) + 255)) / (255 * (259 - ((var1-25)*(255/25)) ));
          realvar=contrastFactor; 

          d[i] = contrastFactor * (d[i] - 128) + 128;
          d[i+1] = contrastFactor * (d[i+1] - 128) + 128;
          d[i+2] = contrastFactor * (d[i+2] - 128) + 128;
        }

        // noise
         if (effect=="noise"){
          noise= 10 ; 
          if (var1) noise = var1 - Math.random() * var1 / 2;
          realvar=noise;
          d[i] += noise;
          d[i+1] += noise;
          d[i+2] += noise;
        }

        // desaturate
        if (effect=="desaturate"){
          desaturate= 0 ; // must be from 0 to 1  max 
          if (var1) desaturate = var1 / 50;
          realvar=desaturate;
          average = ( d[i] + d[i+1] + d[i+2] ) / 3;
          d[i] += ((average - d[i]) * desaturate);
          d[i+1] += ((average - d[i+1]) * desaturate);
          d[i+2] += ((average - d[i+2]) * desaturate);
      }

    } 

    console.log('realvar='+realvar);          
    return d;
}


/**-----------------------------------------------------------------------------
* This function build the HTML booth
* return : HTML 
*-----------------------------------------------------------------------------*/
function build_booth(media_opts){
  console.log('__ in build_booth');
  var t=''; 

  var show_effects_options= display_settings.pics_rec_filters;
  var max_recording_seconds = 600; 
  if (media_opts=='audio_recording') max_recording_seconds= parseInt(display_settings.audio.audio_rec_max_duration); 
  if (media_opts=='video_recording') max_recording_seconds= parseInt(display_settings.video.video_rec_max_duration); 

  t+='  <!--     <select id="audioSource"></select> -->';
  t+='  <!--  <select id="videoSource"></select> -->';
  t+='    <div><i class=" close icon-fa-close "></i></div>';
  t+='    <h1 class="header-info">'+$.i18n._('media booth h1 - '+media_opts)+'</h1>';
  t+='    <p class="intro_p">'+$.i18n._('media booth into - '+media_opts)+'</p>';

  t+='    <div class="booth_error error" style="display:none"></div>';
  

  if (media_opts=="all" || media_opts=="audio_recording") {
    t+='<div class="panel-body">';

    t+='    <div class="audio_recording all wrapper" style="display:none;">';
    t+='      <div class="visu_wrapper">';
    t+='        <canvas id="in-visu" class="visualizer"></canvas>';
    t+='        <div class="visu_title hastext" z-label="visu in title">'+$.i18n._('visu in title')+'</div>';
    t+='        <div><i class="mute_btn icon-fa-microphone-slash"></i></div>';
    t+='      </div>';
    t+='      <div><a class="record_btn btn btn-primary fullwidth" z-label="record" z-label-alt="recording"><i class="icon-fa-circle"></i><label>'+$.i18n._('record')+'</label></a></div>';
          
    // t+='      <!-- <canvas id="out-visu" class="visualizer"></canvas> -->';

    t+='      <div class="wav_out_wrapper">';
    t+='        <div>';
    t+='          <span class="record_duration" data-max="'+max_recording_seconds+'">0.000</span>';
    t+='          <span class="record_duration_max">/'+max_recording_seconds+' s</span>';
    t+='        </div>';
    t+='        <div class="visu_wrapper">';
    t+='          <canvas id="wavedisplay" class="visualizer" ></canvas>';
    t+='          <div class="visu_title hastext" z-label="visu out title">'+$.i18n._('visu out title')+'</div>';
    t+='          <div class="visu_timeline"></div>';
    t+='       </div>';
    t+='        <audio id="wav_audio_player" class="" ></audio>';

    t+='<div class="actions-btns">';
    t+='        <div><a class="wav_playstop_btn btn btn-default fullwidth" z-label="rec play" z-label-alt="(rec playing) stop"><i class="icon-fa-play"></i><label>'+$.i18n._('rec play')+'</label></a></div>';
    t+='        <div><a class="wav_download_btn btn btn-default fullwidth" z-label="rec download"><i class="icon-fa-download"></i><label>'+$.i18n._('rec download')+'</label></a></div>';
    t+='        <div><a class="wav_save_btn btn btn-default fullwidth" z-label="rec save" z-label-alt="... saving"><i class="icon-fa-cloud-upload"></i><label>'+$.i18n._('rec save')+'</label></a></div>';
    t+='</div>';
    t+='        <div class="wav_save_progress booth_progress " style="display: none;" ><div class="bar" style="width: 0%;"></div><div class="percent">0%</div></div> ';

    
    t+='      </div>';
    t+='    </div>';

    t+='</div>';
  }

  if (media_opts=="all" || media_opts=="picture_snap" || media_opts=="video_recording") {
    t+='<div class="panel-body">';

    t+='    <div class="picture_snap all video_recording wrapper" style="display:none;">';
    t+='      <div class="video_wrapper">';
    t+='        <video autoplay id="my_main_video"></video>';
    t+='        <div id="video-countdown" class="video-countdown" style="display: none;"><p>1</p></div>';
    t+='        <div id="video-flash" class="video-flash" style="display: none;"></div>';
    t+='        <div class="video_in_title hastext" z-label="video in title">'+$.i18n._('video in title')+'</div>';
    t+='      </div>';
          
    if (media_opts=="video_recording"){
      t+='      <div><a class="video_snap_btn btn btn-primary fullwidth" data-what="video" z-label="record video" z-label-alt=""><i class="icon-fa-circle"></i><label>'+$.i18n._('record video')+'</label></a></div>';
    } else {
      t+='      <div><a class="video_snap_btn btn btn-primary fullwidth" data-what="picture" z-label="take screenshot" z-label-alt=""><i class="icon-fa-camera"></i><label>'+$.i18n._('take screenshot')+'</label></a></div>';
    }
    
    if ( media_opts=="video_recording"){
      t+='      <div class="clearfix">';
      t+='        <div class="record-counter left">';
       t+='          <span class="" >'+_c($.i18n._('rec seconds :'))+'</span>';
      t+='          <span class="record_duration" data-max="'+max_recording_seconds+'">0.0</span>';
      t+='          <span class="record_duration_max">/'+max_recording_seconds+' s</span>';
      t+='        </div>';


      t+='        <div class="record-size right">';
      t+='          <span class="record-cur-size">0</span>';
      t+='          <span class="record-max-size"></span>';
      t+='        </div>';
      t+='      </div>';
    }

    t+='      <div class="video_wrapper">';
    
    if (media_opts=="video_recording"){
       t+='        <video autoplay id="my_record_video"></video>';
       t+='       <div class="video_title hastext" z-label="video out title">'+$.i18n._('video out title')+'</div>';

    }
    else {
      t+='        <canvas id="snap_canvas" class="snap_canvas" ></canvas>';
      t+='       <div class="video_title hastext" z-label="picture out title">'+$.i18n._('picture out title')+'</div>';

    }

    if (show_effects_options){
      t+='        <div class="video_effect " z-label=""></div>';        
      t+='        <div class="video_effect_range_wrapper" style="display: none;" >';
      t+='          <input id="video_effect_range" type="range" min="0" max="50" value="25" step="1" class="vert">';
      t+='          <div class="video_effect_range_value " z-label="">25</div>';
      t+='        </div>';
    }
    t+='      </div>';

    // effect button
    t+='<div class="actions-btns">';
    if (show_effects_options) t+='      <div><a class="snap_effect_btn btn btn-default fullwidth disabled" z-id="0" z-label="snap effect"><i class="icon-fa-flask"></i><label>'+$.i18n._('snap effect')+'</label></a></div>';
    

    if (media_opts=="video_recording"){
      // t+='        <div><a class="video_playstop_btn btn btn-default fullwidth" z-label="rec play" z-label-alt="(rec playing) stop"><i class="icon-fa-play"></i><label></label></a></div>';
      // download 
      t+='      <div>';
      t+='        <a class="video_download_btn btn btn-default fullwidth disabled" z-label="snap download"><i class="icon-fa-download"></i><label>'+$.i18n._('snap download')+'</label></a>';
      t+='        <a class="video_download_hidden" style="display:none;"></a>';
      t+='      </div>';

      // save
      t+='      <div><a class="video_save_btn btn btn-default fullwidth disabled"  z-label="snap save" z-label-alt="... saving"><i class="icon-fa-cloud-upload"></i><label>'+$.i18n._('snap save')+'</label></a></div>';

    } else {
      // download 
      t+='      <div>';
      t+='        <a class="snap_download_btn btn btn-default fullwidth disabled" z-label="snap download"><i class="icon-fa-download"></i><label>'+$.i18n._('snap download')+'</label></a>';
      t+='        <a class="snap_download_hidden" style="display:none;"></a>';
      t+='      </div>';

      // save
      t+='      <div><a class="snap_save_btn btn btn-default fullwidth disabled"  z-label="snap save" z-label-alt="... saving"><i class="icon-fa-cloud-upload"></i><label>'+$.i18n._('snap save')+'</label></a></div>';
    }
    
    t+='    </div> '; // end actions buttons
    t+='    <div class="wav_save_progress booth_progress " style="display: none;" ><div class="bar" style="width: 0%;"></div><div class="percent">0%</div></div> ';



    t+='    </div> ';

    t+='</div>';

  }
  

      return t; 
}


/**-----------------------------------------------------------------------------
* This function display the booth into a modal box and adapt labels and buttons to context 
* all, picture_snap, audio_recording
*-----------------------------------------------------------------------------*/
function display_booth(media_opts){

    var boothid='#my_booth';

    // reset environment , build HTML and set it to the DOM 
    hide_MODAL_box(); 
    $(boothid).html('');// reset 
    $(boothid).html(build_booth(media_opts)); 

   //Get the window height and width
    var winH = $(window).height();
    var winW = $(window).width();
    
    // var maskHeight =getPageHeight()+$(window).scrollTop(); // add the scroll 
    var maskHeight = Math.max(getFullPageHeight(),getPageHeight()+$(window).scrollTop()); // http://www.howtocreate.co.uk/tutorials/javascript/browserwindow
    var maskWidth = winW;
    
    //Set height and width to mask to fill up the whole screen and display it
    $('#my_booth_mask').css({'width':maskWidth,'height':maskHeight}).fadeTo("fast",0.5);

    // init default textes
    $(boothid+' .wrapper').hide(); // hide all eements =RESET

    // reset the record duration
    $(boothid+' .record_duration').html('0:0'); 

    // disable the ACTIONS buttons
    $('.actions-btns .btn').addClass('disabled'); 

    // show the booth
    $(boothid+' .' +media_opts).show(); 

    // position the booth
    tleft = Math.max(0,(winW/2-$(boothid).width()/2) + $(window).scrollLeft());
    ttop = Math.max(0,(winH/2-$(boothid).height()/2) + $(window).scrollTop());
    $(boothid).css('top', ttop);// auto adjust
    $(boothid).css('left', tleft);
    
    // display final  !! 
    $(boothid).show(); 

    // remove all events handlers from previous call 
    $(boothid).find('*').unbind() ; 

}