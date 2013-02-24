$(document).ready(function() {
      var timeQuery;
    
      var vessels = {};
     
      // Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
      var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0.1,-1,-1,-1,-1,-1,-1];
     // Websocket
      //var socket = io.connect('http://127.0.0.1:8090');
      var socket = io.connect('http://192.168.1.112:8090');
      //var socket = io.connect('http://app02.vesseltracker.com');

      var zoom = getParam('zoom');
      zoom = zoom.length >0? zoom : 14;
      var lon = getParam('lon');
      lon = lon.length > 0? lon : 9.86;
      var lat = getParam('lat');
      lat = lat.length > 0? lat : 53.54;


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
        center: [lat, lon]
      });

      // Listen for safetyMessageEvent
      socket.on('safetyMessageEvent', function (data) {
         var json = JSON.parse(data);
         // console.debug(json);
      });

      // Listen for vesselsInBoundsEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        var timeMessage = new Date().getTime();
        var jsonArray = JSON.parse(data);
        LM.logBoundsEvent(jsonArray.length);
        for (var v in vessels){
          LM.clearFeature(vessels[v]);
        } 
       vessels = {};

       // male vessel-Marker, Polygone und speedVectoren in die karte
       for (var x in jsonArray)
        {
          var jsonObject = jsonArray[x];
          // var timeFlex  = new Date().getTime();
          if (jsonObject.msgid < 4 || jsonObject.msgid == 5)
          {
            var vessel = new Vessel(jsonArray[x]);
            vessel.createMapObjects(LM.getZoom(), function(){
              LM.paintVessel(vessel);
            });
            vessels[vessel.mmsi] = vessel;
            console.debug("Latency Bounds"+ (new Date().getTime() - vessel.time_captured) + " "+createDate(vessel.time_captured, true));
          }
          // else if (zoom > 6)
          // {
          //   var staticObject = new Navigational(jsonObject);
          //   staticObject.createMapObjects(LM.getZoom(),function(){
          //     LM.paintMarker(staticObject);
          //   });
          // }
        }
    // zeige eine Infobox über die aktuelle minimal-Geschwindigkeit angezeigter Schiffe
       if (LM.getZoom() < 13)
       {
          $('#zoomSpeed').html("vessels reporting > "+(zoomSpeedArray[LM.getZoom()])+" knots");
         $('#zoomSpeed').css('display', 'block');
       }
       else 
       {
         $('#zoomSpeed').css('display', 'none');
       }
       console.debug("painted " +Object.keys(vessels).length+ "  "+(new Date().getTime() -timeMessage));

    });


      // Listen for vesselPosEvent
      socket.on('vesselPosEvent', function (data) {
         var json = JSON.parse(data);
         // console.debug("PosEvent "+jsonVessel.userid + " "+jsonVessel.utc_sec +" "+ new Date().getTime());
         //update 
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
            console.debug("Latency Pos "+ (new Date().getTime() - vessel.time_captured) + " "+createDate(vessel.time_captured, true));
        });
    });
        

 
function getParam(name){ 

        if (name == 'auth')
        {
           var authString =  [getHash(137454), 137454]; // Zeile entfernen, sobald die Authentifizierung in der jeweiligen Anwendung (Vesseltracker, Wateropt, ..) erfolgt
          console.debug("authstring "+authString);
          return authString;
        }  
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
        returnString += ","+addDigi(milliseconds);
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
});