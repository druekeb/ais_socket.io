$(document).ready(function(){
    
    /* Array that defines for every zoomlevel the minimun speed of a displayed vessel:
                Zoomlevel 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18 */
    var ZOOM_SPEED_ARRAY = [20,20,20,20,20,20,16,12,8,4,2,1,0.1,-1,-1,-1,-1,-1,-1];
    
    var vessels = {};

    var initalZoom = getParam('zoom');
    initalZoom = initalZoom.length >0? initalZoom : 17;
    var initalLon = getParam('lon');
    initalLon = initalLon.length > 0? initalLon : 9.947;
    var initalLat = getParam('lat');
    initalLat = initalLat.length > 0? initalLat : 53.518;

    /* create the Websocket-Connection */
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
        zoom: initalZoom,
        center: [initalLat, initalLon],
        boundsTimeout:300
    });

    socket.on('vesselsInBoundsEvent', function (data) {
        var jsonArray = JSON.parse(data);
        for (var v in vessels){
          LM.clearFeature(vessels[v]);
        } 
        vessels = {};
        /* create new Vessel with Objects (Polygons, Circles) and paint to Map */
        for (var x in jsonArray)
        {
          var jsonObject = jsonArray[x];
          var vessel = new Vessel(jsonArray[x]);
          vessel.paintToMap(LM.getZoom(), function(){
              vessels[vessel.mmsi] = vessel;
          });
        }
        /* show Infobox with the current minimum speed a vessel must have to be displayed */
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
        vessel.paintToMap(LM.getZoom(), function(){
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

    function getFirstNegative(sZA){
      for (var x = 0; x < sZA.length;x++)
      { 
        if (sZA[x] < 0)
        return x;
      }
    }
});