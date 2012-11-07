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

      var featuresLayer  = new OpenLayers.Layer.Vector("FeaturesLayer");
      var markersLayer = new OpenLayers.Layer.Markers("Markers");

      map.addLayers([osmLayer, featuresLayer, markersLayer]);
      var position = new OpenLayers.LonLat(9.95,53.54).transform(wgsProjection, mercatorProjection);
      var zoom = 13; 
      

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
          var marker = v.marker;
          if(marker != null)
          {
            //checkForDoubles(v, json);
            if (marker.events != null )
            {
               marker.events.unregister('mouseover');
               marker.events.unregister('mouseout');
            }
            markersLayer.removeMarker(marker);
            marker.destroy();
          }
        }
        v = parseVesselPos(v,json);
        if(typeof v.lon != "undefined")
        {
          v.marker = addVesselMarker(v);
          if (map.getZoom() > 13)
          {
              if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  moveOrCreatePolygon(v);
          }
        }
        vessels[""+json.mmsi] = v;
       });

      // Listen for vesselStatusEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        console.debug("vesselsInBoundsEvent!!!");
         var jsonArray = JSON.parse(data);
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
              if (map.getZoom() > 11)
              {
                  if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  moveOrCreatePolygon(v);
              }
            }
            vessels[""+jsonArray[i].mmsi] = v;
         }
         if (map.getZoom() < 13)
         {
          featuresLayer.destroyFeatures();
          $('#zoomSpeed').html("vessels moving with > "+(zoomSpeedArray[map.getZoom()])+" knots");
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
      var existingFeature = featuresLayer.getFeatureByFid(v.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Polygon
      var polygonFeature = createPolygonFeature(v); 
      featuresLayer.addFeatures([polygonFeature]);
    }

    //zu testzwecken
    function checkForDoubles(v, json){
      if (json.pos[0] == v.lon && json.pos[1] == v.lat)
      {
        console.debug(v.mmsi+",  Antennen: "+v.aisclient_id+"/ "+ json.aisclient_id+" , Abstand "+((json.time_captured - v.time_captured)) +"  msec");
        //vorher property sentences (NMEA-Messagetext) in node server und client einkommentieren
        console.debug(json.sentences +"/ "+v.sentences);
      }
    }

    // parse TYPE 1 message
    function parseVesselPos(v,json){
     v.aisclient_id = json.aisclient_id;
     v.last_msgid = json.msgid;
     v.time_captured = json.time_captured;
     v.mmsi = json.mmsi;
     v.cog = json.cog;
     v.sog = json.sog;
     v.true_heading = json.true_heading;
     v.nav_status = json.nav_status;
     v.sentences = json.sentences;
     return v;
   }

   //parse TYPE 5 message
   function parseVesselStatus(v,json){
      v.aisclient_id = json.aisclient_id;
      v.last_msgid = json.msgid;
      v.time_captured = json.time_captured;
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
      marker.id = v.mmsi;
      if(marker.events == null )console.debug("224");
      marker.events.register("mouseover", marker, function(e) {
          if(shownPopup != this.id)
          {
              $("#"+shownPopup).remove();
              $("#map").append(createMouseOverPopup(vessels[""+this.id],e.clientX, e.clientY));
              shownPopup = this.id;
          }
        });
      if(marker.events == null )console.debug("233");
      marker.events.register("mouseout", marker, function(e) {
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
      var mouseOverPopup= "<div id='"+vessel.mmsi+"' class='mouseOverPopup' style='top:"+(y-20)+"px;left:"+(x+20)+"px;' >";
      mouseOverPopup +="<table><tr><td colspan='2'><b>"+(vessel.name==undefined?"":trimAds(vessel.name))+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>aisclient_id</td><td>"+(vessel.aisclient_id==undefined?"":vessel.aisclient_id)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi==undefined?"":vessel.mmsi)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(vessel.nav_status==undefined?"":vessel.nav_status)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog==undefined?"":vessel.sog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading==undefined?"":vessel.true_heading)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog==undefined?"":vessel.cog)+"</nobr></td></tr>";
      mouseOverPopup+="</table></div>";
      return mouseOverPopup;
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
               strokeColor: "#ff0000",
               strokeOpacity: 0.8,
               strokeWidth: 3,
               fillColor: "#00ff00",
               fillOpacity: 0.6};
      
      var polygonVector = new OpenLayers.Feature.Vector(polygon, null, polystyle);
      polygonVector.fid = vessel.mmsi;
      return polygonVector;
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

    function trimAds(name){
        var l=0;
         var r = name.length -1;
        while(l < name.length && name[l] == ' ')
        {     l++; }
        while(r > l && name[r] == '@')
        {     r-=1;     }
        return name.substring(l, r+1);
    } 

}
});
