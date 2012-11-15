$(document).ready(function() {
    
    var rTMap = new realTimeMap();
    function realTimeMap(){
      var shownPopup = 0;
      var vessels = new Object();
      var zoomSpeedArray;

      var wgsProjection = new OpenLayers.Projection("EPSG:4326"); // WGS 1984
      var mercatorProjection = new OpenLayers.Projection("EPSG:900913"); // Spherical Mercator

      var map = new OpenLayers.Map({
        div: "map",
        units: "m",
        maxExtent : new OpenLayers.Bounds(-20037508.34, -20037508.34,20037508.34, 20037508.34),
        numZoomLevels : 19,
        maxResolution : 156543,
        projection : mercatorProjection,
        displayProjection : wgsProjection
      });
      var osmLayer  = new OpenLayers.Layer.OSM();

      var speedVectorLayer  = new OpenLayers.Layer.Vector("speedVectorLayer");
      var polygonLayer = new OpenLayers.Layer.Vector("polygonLayer");
      var markersLayer = new OpenLayers.Layer.Markers("Markers");

      map.addLayers([osmLayer, polygonLayer, speedVectorLayer, markersLayer]);
      var position = new OpenLayers.LonLat(9.95,53.54).transform(wgsProjection, mercatorProjection);
      var zoom = 14; 
      

      // Websocket
      var socket = io.connect('http://localhost:8090');
      map.events.on({"moveend":changeRegistration});
      map.setCenter(position, zoom); 

      function changeRegistration()
      {
        socket.emit('unregister');
        console.debug("zoomLevel="+map.getZoom());
        var bounds = map.calculateBounds().transform(mercatorProjection,wgsProjection);
        socket.emit("register", bounds, map.getZoom());
      } 
      socket.on('zoomSpeedEvent', function(zSA){
        zoomSpeedArray = JSON.parse(zSA);
      });
      // Listen for vesselPosEvent
      socket.on('vesselPosEvent', function (data) {
         var json = JSON.parse(data);
         var v = vessels[""+json.mmsi];
        // If we have a new vessel (not yet in vessels)
        if (typeof v == "undefined") 
        {
           v = new Object();
        }
        else
        { 
          if(v.marker != null)
          {
            //checkForDoubles(v, json);
            if (v.marker.events != null )
            {
               v.marker.events.unregister('mouseover');
               v.marker.events.unregister('mouseout');
            }
            markersLayer.removeMarker(v.marker);
            v.marker.destroy();
          }
        }
        v = parseVesselPos(v,json);
        if(typeof v.lon != "undefined")
        {
         v.marker = addVesselMarker(v);
          moveOrCreateSpeedVector(v);
         if (map.getZoom() > 11)
        {
           if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  moveOrCreatePolygon(v);
         }
       }
       vessels[""+json.mmsi] = v;
      });

      // Listen for vesselStatusEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        console.debug("boundsEvent");
         var jsonArray = JSON.parse(data);
         speedVectorLayer.destroyFeatures();
         for (var x  in vessels)
         {
          var marker = vessels[x].marker;
          if (marker!= null)
          {
            markersLayer.removeMarker(marker);
            if ( marker.events != null )
            {
               marker.events.unregister('mouseover');
               marker.events.unregister('mouseout');
            }
            marker.destroy;
          }
          delete vessels[x];
         }
         for (var i = 0; i < jsonArray.length; i++)
         {
            var v = vessels[""+jsonArray[i].mmsi];
             if (v == null) 
            {
               v = new Object();
            }
            v =  parseVesselStatus(v ,jsonArray[i]);
            if(v.lon != null)
            {
              v.marker = addVesselMarker(v);
              moveOrCreateSpeedVector(v);
              if (map.getZoom() > 11)
              {
                  if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  moveOrCreatePolygon(v);
              }
            }
            vessels[""+jsonArray[i].mmsi] = v;
         }
         if (map.getZoom() < 13)
         {
          $('#zoomSpeed').html("vessels reporting > "+(zoomSpeedArray[map.getZoom()])+" knots");
          $('#zoomSpeed').css('display', 'block');
         }
         else 
         {
          $('#zoomSpeed').css('display', 'none');
         }
      });
      
    //paint the polygon on the map
    function moveOrCreatePolygon(v) {   
    // find polygon and delete it
      var existingFeature = polygonLayer.getFeatureByFid(v.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Polygon
      var polygonFeature = createPolygonFeature(v); 
      polygonLayer.addFeatures([polygonFeature]);
    }

   
    //paint the speedvector on the map
    function moveOrCreateSpeedVector(v) {   
    // find Vector and delete
      var existingFeature = speedVectorLayer.getFeatureByFid(v.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Vector
      if (typeof v.sog !='undefined' && v.sog > 0 && v.sog!=102.3) createVectorFeature(v); 
    }

    //zu testzwecken
    function checkForDoubles(v, json){
      if (json.pos[0] == v.lon && json.pos[1] == v.lat)
      {
        console.debug(v.mmsi+",  Antennen: "+v.aisclient_id+"/ "+ json.aisclient_id+" , Abstand "+((json.time_received - v.time_received)) +"  msec");
        //vorher property sentences (NMEA-Messagetext) in node server und client einkommentieren
        console.debug(json.sentences +"/ "+v.sentences);
      }
    }

    // parse TYPE 1 message
    function parseVesselPos(v,json){
     v.aisclient_id = json.aisclient_id;
     v.last_msgid = json.msgid;
     v.time_received = json.time_received;
     v.mmsi = json.mmsi;
     v.cog = json.cog;
     v.sog = json.sog;
     v.lon = json.pos[0];
     v.lat = json.pos[1];
     v.true_heading = json.true_heading;
     return v;
   }

   //parse TYPE 5 message
   function parseVesselStatus(v,json){
      v.aisclient_id = json.aisclient_id;
      v.last_msgid = json.msgid;
      v.time_received = json.time_received;
      v.mmsi = json.mmsi;
      v.imo = json.imo;
      v.callsign = json.callsign;
      v.left = json.left;
      v.front = json.front;
      v.width = json.width;
      v.length = json.length;
      v.name = json.name;
      if(json.pos)
      {
        v.lon = json.pos[0];
        v.lat = json.pos[1];
      }
      if(json.cog)
      {
        v.cog = json.cog;
      }
      if(json.sog)
      {
        v.sog = json.sog;
      }
      if (json.true_heading)
      {
        v.true_heading = json.true_heading;
      }
      if(json.nav_status)
      {
        v.nav_status = json.nav_status;
      }
      v.dest = json.dest;
      v.draught = json.draught;
      v.ship_type = json.ship_type;
      return v;
   }
    
    function addVesselMarker(v) {
      var lonlat = new OpenLayers.LonLat(v.lon,v.lat).transform(wgsProjection,mercatorProjection);
      var icon = getVesselIcon(v);
      var marker = new OpenLayers.Marker(lonlat,icon);
      if (map.getZoom() < 12)
      {
         var existingFeature = polygonLayer.getFeatureByFid(v.mmsi);
          if (existingFeature != null )
          {
             existingFeature.destroy();
          }
      }
      marker.id = v.mmsi;
      marker.events.register("mouseover", marker, function(e) 
      {
        if(shownPopup != this.id)
        {
            $("#"+shownPopup).remove();
            $("#map").append(createMouseOverPopup(vessels[""+this.id],e.clientX, e.clientY));
            shownPopup = this.id;
        }
      });
      marker.events.register("mouseout", marker, function(e) 
      {
         if(shownPopup == this.id)
        {
          $("#"+shownPopup).remove();
          shownPopup = undefined;
        }
       });
      markersLayer.addMarker(marker);
      return marker;
    }

    function createMouseOverPopup(vessel, x,y){
      var timeNow = new Date();
      var mouseOverPopup= "<div id='"+vessel.mmsi+"' class='mouseOverPopup' style='top:"+(y-20)+"px;left:"+(x+20)+"px;' >";
      mouseOverPopup +="<table><tr><td colspan='2'><b>"+(vessel.name==undefined?"":vessel.name)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>aisclient_id</td><td>"+(vessel.aisclient_id==undefined?"":vessel.aisclient_id)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi==undefined?"":vessel.mmsi)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(vessel.nav_status==undefined?"":vessel.nav_status)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog==undefined?"":vessel.sog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading==undefined?"":vessel.true_heading)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog==undefined?"":vessel.cog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+(vessel.time_received==undefined?"":createDate(vessel.time_received))+"</nobr></td></tr>";
      mouseOverPopup+="</table></div>";
      return mouseOverPopup;
    }

    function createDate(ts){
      var date= new Date();
      date.setTime(ts);
      var month = date.getMonth()+1;
      var day = date.getDate();
      var hour = date.getHours();
      var min= date.getMinutes();
      var second = date.getSeconds();
      return day +"."+month+".&nbsp;"+addDigi(hour)+":"+addDigi(min);
    }

    function addDigi(curr_min){
    curr_min = curr_min + "";
      if (curr_min.length == 1)
      {
        curr_min = "0" + curr_min;
    }
      return curr_min;
  }

    function createPolygonFeature(vessel) {
      //benötigte Daten
      var hdg = vessel.true_heading;
      var cog = vessel.cog;
      var left = vessel.left;
      var front = vessel.front;
      var len = vessel.length;
      var lon = vessel.lon;
      var lat = vessel.lat;
      var wid = vessel.width;
      var angle_rad;
      if(!hdg || hdg==0.0||hdg ==511)
      {
        if (!vessel.cog)
        {
          cog = 0.0;
        }
        angle_rad = deg2rad(-cog);
      }
      else
      {
        angle_rad = deg2rad(-hdg);
      }
      var cos_angle=Math.cos(angle_rad);
      var sin_angle=Math.sin(angle_rad);
      var shippoints = [];
    
      //front left
      var dx = -left;
      var dy = front-(len/10.0);  
        shippoints.push(calcPoint(lon,lat, dx, dy,sin_angle,cos_angle));
        
        //rear left
        dx = -left;
        dy = -(len-front);
      shippoints.push(calcPoint(lon,lat, dx,dy,sin_angle,cos_angle));
      
      //rear right
        dx =  wid - left;
        dy = -(len-front);
      shippoints.push(calcPoint(lon,lat, dx,dy,sin_angle,cos_angle));
      
      //front right
      dx = wid - left;
      dy = front-(len/10.0);
      shippoints.push(calcPoint(lon,lat,dx,dy,sin_angle,cos_angle));  
        
        //front center
      dx = wid/2.0-left;
      dy = front;
      shippoints.push(calcPoint(lon,lat,dx,dy,sin_angle,cos_angle));
      
      shippoints.push(shippoints[0]);   
      
      var linering = new OpenLayers.Geometry.LinearRing(shippoints);
      var polygon = new OpenLayers.Geometry.Polygon([linering]);
      var polystyle = {
               strokeColor: "#FF0000",
               strokeOpacity: 0.8,
               strokeWidth: 3,
               fillColor: "#00ff00",
               fillOpacity: 0.6};
      
      var polygonVector = new OpenLayers.Feature.Vector(polygon, null, polystyle);
      polygonVector.fid = vessel.mmsi;
      return polygonVector;
    }

     function createVectorFeature(vessel) {
       //benötigte Daten
       var hdg = vessel.true_heading;
       var cog = vessel.cog;
       var lon = vessel.lon;
       var lat = vessel.lat;
       var sog = vessel.sog;
       if(!hdg || hdg==0.0||hdg ==511)
      {
        if (!vessel.cog)
        {
          cog = 0.0;
        }
        angle_rad = deg2rad(-cog);
      }
      else
      {
        angle_rad = deg2rad(-hdg);
      }
      var cos_angle=Math.cos(angle_rad);
      var sin_angle=Math.sin(angle_rad);

      var vectorPoints = [];
      var vectorLineStyle =  
        {
          strokeDashstyle: 'solid',
            strokeColor: '#FFFFFF',
            strokeWidth:(sog > 30?3:1),
            strokeLinecap: 'round'
        }; 

       var shipPoint = new OpenLayers.Geometry.Point(lon, lat);
       shipPoint.transform(wgsProjection, mercatorProjection);
       vectorPoints.push(shipPoint);
       if(sog > 30) sog /=10; 
       var targetPoint = calcVector(lon, lat, sog , sin_angle, cos_angle);
       targetPoint.transform(wgsProjection, mercatorProjection);    
       vectorPoints.push(targetPoint);
   
       var vectorLine = new OpenLayers.Geometry.LineString(vectorPoints);
       var vectorLineFeature = new OpenLayers.Feature.Vector(vectorLine, null,vectorLineStyle);
       vectorLineFeature.fid = vessel.mmsi;
       speedVectorLayer.addFeatures([vectorLineFeature]);
       speedVectorLayer.drawFeature(vectorLineFeature);
  }

  function calcVector(lon, lat, d, sin, cos){
    var dy_deg = -(d*cos)/Math.pow(1.9 ,map.getZoom());
    var dx_deg = -(- d*sin)/(Math.cos(deg2rad(lat))*Math.pow(1.9,map.getZoom()));
    return new OpenLayers.Geometry.Point(lon - dx_deg, lat - dy_deg);
    }

    function calcPoint(lon, lat, dx, dy, sin_angle, cos_angle){
    var dy_deg = -((dx*sin_angle + dy*cos_angle)/(1852.0))/60.0;
    var dx_deg = -(((dx*cos_angle - dy*sin_angle)/(1852.0))/60.0)/Math.cos(deg2rad(lat));
    var lonlat = new OpenLayers.LonLat(lon - dx_deg, lat - dy_deg).transform(wgsProjection,mercatorProjection);
    return new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat);
    }

    function deg2rad(grad){
      return  grad * Math.PI/180.0;
    }

    function getVesselIcon(vessel){
      var iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos_sat.png";
      var size = new OpenLayers.Size(12,12);
      var icon = new OpenLayers.Icon(iconUrl,size);
      return icon;
    }
}
});
