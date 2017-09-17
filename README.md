# js-video-audio-recording
Javascript multimedia booth to record Audio and Video and Picture  from GetUserMedia and MediaRecorder APIs 

> When dealing with recording on Javascript side, this can rapidly
> become a nightmare (lots of unfinished ressources and APIs changing
> rapidely). I made this single FUNCTIONS SET to share my implementation
> of a Booth which can take Photo, Record Videos or Record Audio file
> natively from your browser and webcam.
> Enjoy it.

### Screen shots

 
### How to use it 
    init_webrtc(mediaoption, srctype) 

- *mediaoption* : STRING :  can be  : **picture_snap** | **audio_recording** | **video_recording** 
- *srctype* : STRING  :  if the source element name calling this function -  (used when saving the video on PHP side ) 
