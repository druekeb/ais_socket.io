$(document).ready(function() {
    
     /* Array that defines for every zoomlevel the minimun speed of a displayed vessel:
                  Zoomlevel 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18 */
      var ZOOM_SPEED_ARRAY = [20,20,20,20,20,20,16,12,8,4,2,1,0.1,-1,-1,-1,-1,-1,-1];
      
      var vessels = {};

      var zoom = getParam('zoom');
      zoom = zoom.length >0? zoom : 17;
      var lon = getParam('lon');
      lon = lon.length > 0? lon : 9.947;
      var lat = getParam('lat');
      lat = lat.length > 0? lat : 53.518;

     // Websocket
      var socket = io.connect('http://192.168.1.112:8090');

      
      LM.init('map',{
        mapOptions:{
          closePopupOnClick:false,
          markerZoomAnimation: false,
          zoomAnimation: false,
          worldCopyJump: true,
          maxZoom: 18,
          minZoom: 3
        },
        tileLayer: true,
        featureLayer: true,
        mousePositionControl: true,
        onClick: true,
        onMoveend: socket,
        zoom: zoom,
        center: [lat, lon],
        boundsTimeout:300
      });

      // Listen for vesselsInBoundsEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        console.log(data);
        var jsonArray = JSON.parse(data);
        for (var v in vessels){
          LM.clearFeature(vessels[v]);
        } 
       vessels = {};
       
       /* create new Vessel with Objects (Polygons, Circles) and paint to Map */
       for (var x in jsonArray)
        {
          var jsonObject = jsonArray[x];
          if (jsonObject.msgid < 4 || jsonObject.msgid == 5)
          {
            var vessel = new Vessel(jsonArray[x]);
            vessel.createMapObjects(LM.getZoom(), function(){
              LM.paintVessel(vessel);
              vessels[vessel.mmsi] = vessel;
            });
          }
        }
    // zeige eine Infobox über die aktuelle minimal-Geschwindigkeit angezeigter Schiffe
       if (LM.getZoom() < getFirstNegative(ZOOM_SPEED_ARRAY))
       {
          $('#zoomSpeed').html("vessels reporting > "+(ZOOM_SPEED_ARRAY[LM.getZoom()])+" knots");
         $('#zoomSpeed').css('display', 'block');
       }
       else 
       {
         $('#zoomSpeed').css('display', 'none');
       }
    });

      // Listen for vesselPosEvent
      socket.on('vesselPosEvent', function (data) {
         var json = JSON.parse(data);
         var vessel = vessels[json.userid];
        if(vessel != undefined)
        {
          LM.clearFeature(vessel);
          vessel.updatePosition(json);
        }
        else
        {
          vessel = new Vessel(json);
        }
        var timeFlex  = new Date().getTime();
        vessel.createMapObjects(LM.getZoom(), function(){
            LM.paintVessel(vessel);
            vessels[vessel.mmsi] = vessel;
        });
    });
     /* Help functions -------------------------------------------------------------------------------------*/   

     function getParam(name){ 
        name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
        var regexS = "[\\?&]"+name+"=([^&#]*)";
        var regex = new RegExp( regexS );
        var results = regex.exec (window.location.href);

        if (results == null)return "";
        else return results[1];  
      }

      function createDate(ts, sec, msec){
      var returnString;
      var date= new Date();
          date.setTime(ts);

      var month = date.getMonth()+1;
      var day = date.getDate();
      returnString = day +"."+month+" ";

      var hour = date.getHours();
      var min= date.getMinutes();
      returnString += addDigi(hour)+":"+addDigi(min);
       if (sec)
      {
        var seconds = date.getSeconds();
        returnString += ":"+addDigi(seconds);
      }
      if (msec)
      {
        var milliseconds = date.getMilliseconds();
        returnString += ","+addDigiMilli(milliseconds);
      }
      return returnString;
    }

    function addDigi(curr_min){
    curr_min = curr_min + "";
      if (curr_min.length == 1)
      {
        curr_min = "0" + curr_min;
      }
      return curr_min;
    }

    function addDigiMilli(curr_millisec){
    curr_millisec = curr_millisec + "";
      switch(curr_millisec.length)
      {
        case 1: curr_millisec = "00" + curr_millisec;
        break;
        case 2: curr_millisec = "0" + curr_millisec;
        break;
      }
      return curr_millisec;
    }

    function getFirstNegative(sZA){
      for (var x = 0; x < sZA.length;x++)
      { 
        if (sZA[x] < 0)
        return x;
      }
    }
});