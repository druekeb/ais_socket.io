$(document).ready(function() {
    
      var shownPopup = 0;
      var navigationalObjects = new Object();
     
      // Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
      var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0,-1,-1,-1,-1,-1,-1];

      var urlArray = [  "http://t1.tiles.vesseltracker.com/vesseltracker/",
                    "http://t2.tiles.vesseltracker.com/vesseltracker/",
                    "http://t3.tiles.vesseltracker.com/vesseltracker/"  ];


     // Websocket
      var socket = io.connect('http://localhost:8090');
      var map = L.map('map').setView([53.54,9.95], 13);

      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
            maxZoom: 18,
            minZoom:3
          }).addTo(map);
      var markerLayer = L.layerGroup().addTo(map);
      map.on('moveend', changeRegistration);
      changeRegistration();
        
      function changeRegistration()
      {
        socket.emit('unregister');
        console.debug("zoomLevel="+map.getZoom());
        var bounds = map.getBounds();
        socket.emit("register", bounds, map.getZoom());
      } 
      

      // // Listen for vesselPosEvent
      // socket.on('vesselPosEvent', function (data) {
      //    var json = JSON.parse(data);
      //    var v = vessels[""+json.mmsi];
      //   // If we have a new vessel (not yet in vessels)
      //   if (typeof v == "undefined") 
      //   {
      //      v = new Object();
      //   }
      //   else
      //   { 
      //     if(v.mmsi == 211484674)
      //       console.debug("jade");
      //     if(v.marker != null)
      //     {
      //       //checkForDoubles(v, json);
      //       if (v.marker.events != null )
      //       {
      //          v.marker.events.unregister('mouseover');
      //          v.marker.events.unregister('mouseout');
      //       }
      //       markersLayer.removeMarker(v.marker);
      //       v.marker.destroy();
      //     }
      //   }
      //   v = parseVesselPos(v,json);
      //   if(typeof v.lon != "undefined")
      //   {
      //    v.marker = addVesselMarker(v);
      //     moveOrCreateSpeedVector(v);
      //    if (map.getZoom() > 11)
      //   {
      //      if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  moveOrCreatePolygon(v);
      //    }
      //  }
      //  vessels[""+json.mmsi] = v;
      // });

      // Listen for vesselStatusEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        console.debug("boundsEvent");
         var jsonArray = JSON.parse(data);

         var vesselData = jsonArray.vesselData;
         var navigationalAidsData = jsonArray.navigationalAids;

         markerLayer.clearLayers();


       // male vessel-Marker in die karte
       if (vesselData != null)
       {
          for (var i = 0; i < vesselData.length; i++)
          {
            v = vesselData[i];
            if(v.pos != null)
            {
              v.marker = createMarker(v);
              v.marker.addTo(markerLayer);
              if (v.sog)
              {
//                updateSpeedVector(v);
              }
              if (map.getZoom() > 11)
              {
  //                if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  updatePolygon(v);
              }
            }
            navigationalObjects[""+vesselData[i].mmsi] = v;
          }
        }
        if (navigationalAidsData != null)
        {
           // male navigationalAid-Marker in die karte
           for (var i = 0; i < navigationalAidsData.length; i++)
           {
              var n = navigationalObjects[""+navigationalAidsData[i].mmsi];
              if (n == null) 
              {
                 n = new Object();
              }
              n =  navigationalAidsData[i];
              if(n.pos != null)
              {
                n.marker = createMarker(n);
                v.marker.addTo(markerLayer);
              }
              if (map.getZoom() > 11)
              {
          //        if (n.width)  updatePolygon(n);
              }
              navigationalObjects[""+navigationalAidsData[i].mmsi] = n;
            }
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
    
//     //paint the polygon on the map
//     function moveOrCreatePolygon(v) {   
//     // find polygon and delete it
//       var existingFeature = polygonLayer.getFeatureByFid(v.mmsi);
//       if (existingFeature != null )
//       {
//          existingFeature.destroy();
//       }
//       //create new Polygon
//       var polygonFeature = createPolygonFeature(v); 
//       polygonLayer.addFeatures([polygonFeature]);
//     }

   
//     //paint the speedvector on the map
//     function moveOrCreateSpeedVector(v) {   
//     // find Vector and delete
//       var existingFeature = speedVectorLayer.getFeatureByFid(v.mmsi);
//       if (existingFeature != null )
//       {
//          existingFeature.destroy();
//       }
//       //create new Vector
//       if (typeof v.sog !='undefined' && v.sog > 0 && v.sog!=102.3) createVectorFeature(v); 
//     }

//     //zu testzwecken
//     function checkForDoubles(v, json){
//       if (json.pos[0] == v.lon && json.pos[1] == v.lat)
//       {
//         console.debug(v.mmsi+",  Antennen: "+v.aisclient_id+"/ "+ json.aisclient_id+" , Abstand "+((json.time_received - v.time_received)) +"  msec");
//         //vorher property sentences (NMEA-Messagetext) in node server und client einkommentieren
//         console.debug(json.sentences +"/ "+v.sentences);
//       }
//     }

//     // parse TYPE 1 message
//     function parseVesselPos(v,json){
//      v.aisclient_id = json.aisclient_id;
//      v.last_msgid = json.msgid;
//      v.time_received = json.time_received;
//      v.mmsi = json.mmsi;
//      v.cog = json.cog;
//      v.sog = json.sog;
//      v.lon = json.pos[0];
//      v.lat = json.pos[1];
//      v.true_heading = json.true_heading;
//      return v;
//    }

   //parse TYPE 5 message
   function parseVesselStatus(json){
      var v = {};
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
    
    function createMarker(obj) {
      var icon = chooseIcon(obj);
        var marker = L.marker([v.pos[1], v.pos[0]], {icon:icon}).bindPopup(createMouseOverPopup(v),{autopan:false});
        return marker;
     }

    function createMouseOverPopup(vessel){
      var timeNow = new Date();
      mouseOverPopup ="<table><tr><td colspan='2'><b>"+(vessel.name==undefined?"":vessel.name)+"</b></nobr></td></tr>";
      if(vessel.imo !=0)mouseOverPopup+="<tr><td>IMO</td><td>"+(vessel.imo==undefined?"":vessel.imo)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi==undefined?"":vessel.mmsi)+"</nobr></td></tr>";
      if(vessel.nav_status != null)mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(vessel.nav_status==undefined?"":vessel.nav_status)+"</nobr></td></tr>";
      if(vessel.speed != null)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog==undefined?"":vessel.sog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading==undefined?"":vessel.true_heading)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog==undefined?"":vessel.cog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+(vessel.time_received==undefined?"":createDate(vessel.time_received))+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>Dest</td><td>"+(vessel.dest==undefined?"":vessel.dest)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>draught</td><td>"+(vessel.draught==undefined?"":vessel.draught)+"</b></nobr></td></tr>";
      if(vessel.ship_type != null)mouseOverPopup+="<tr><td>ship_type</td><td>"+(vessel.ship_type==undefined?"":vessel.ship_type)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>left, front</td><td>"+(vessel.left==undefined?"":vessel.left)+", "+(vessel.front==undefined?"":vessel.front)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>width, length</td><td>"+(vessel.width==undefined?"":vessel.width)+", "+(vessel.length==undefined?"":vessel.length)+"</b></nobr></td></tr>";
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
  function chooseIcon(obj){
      var iconUrl;
      var zoom = map.getZoom();
      if(obj.msgid == 21)
      {
        iconUrl =  "../images/aton_"+obj.aton_type+".png";
        size = [zoom,zoom]; 
      }
      else if(obj.msgid == 4)
      {
        iconUrl =   "../images/baseStation.png";
        size = [zoom-1,zoom-1]; 
      }
      else if (obj.msgid == 6)
      {
         iconUrl =   "../images/helicopter.png";
         size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
      }
      else
      {
        iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos_sat.png";
        size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
      }
      var icon = L.icon({
            iconUrl: iconUrl,
            iconSize:     size, // size of the icon
            iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
            popupAnchor:  [-(size.w/2), -(size.h -1)] // point from which the popup should open relative to the iconAnchor
        });
      return icon;
    }

//     function createPolygonFeature(vessel) {
//       //benötigte Daten
//       var hdg = vessel.true_heading;
//       var cog = vessel.cog;
//       var left = vessel.left;
//       var front = vessel.front;
//       var len = vessel.length;
//       var lon = vessel.lon;
//       var lat = vessel.lat;
//       var wid = vessel.width;
//       var angle_rad;
//       if(!hdg || hdg==0.0||hdg ==511)
//       {
//         if (!vessel.cog)
//         {
//           cog = 0.0;
//         }
//         angle_rad = deg2rad(-cog);
//       }
//       else
//       {
//         angle_rad = deg2rad(-hdg);
//       }
//       var cos_angle=Math.cos(angle_rad);
//       var sin_angle=Math.sin(angle_rad);
//       var shippoints = [];
    
//       //front left
//       var dx = -left;
//       var dy = front-(len/10.0);  
//         shippoints.push(calcPoint(lon,lat, dx, dy,sin_angle,cos_angle));
        
//         //rear left
//         dx = -left;
//         dy = -(len-front);
//       shippoints.push(calcPoint(lon,lat, dx,dy,sin_angle,cos_angle));
      
//       //rear right
//         dx =  wid - left;
//         dy = -(len-front);
//       shippoints.push(calcPoint(lon,lat, dx,dy,sin_angle,cos_angle));
      
//       //front right
//       dx = wid - left;
//       dy = front-(len/10.0);
//       shippoints.push(calcPoint(lon,lat,dx,dy,sin_angle,cos_angle));  
        
//         //front center
//       dx = wid/2.0-left;
//       dy = front;
//       shippoints.push(calcPoint(lon,lat,dx,dy,sin_angle,cos_angle));
      
//       shippoints.push(shippoints[0]);   
      
//       var linering = new OpenLayers.Geometry.LinearRing(shippoints);
//       var polygon = new OpenLayers.Geometry.Polygon([linering]);
//       var polystyle = {
//                strokeColor: "#FF0000",
//                strokeOpacity: 0.8,
//                strokeWidth: 3,
//                fillColor: "#00ff00",
//                fillOpacity: 0.6};
      
//       var polygonVector = new OpenLayers.Feature.Vector(polygon, null, polystyle);
//       polygonVector.fid = vessel.mmsi;
//       return polygonVector;
//     }

//      function createVectorFeature(vessel) {
//        //benötigte Daten
//        var hdg = vessel.true_heading;
//        var cog = vessel.cog;
//        var lon = vessel.lon;
//        var lat = vessel.lat;
//        var sog = vessel.sog;
//        if(!hdg || hdg==0.0||hdg ==511)
//       {
//         if (!vessel.cog)
//         {
//           cog = 0.0;
//         }
//         angle_rad = deg2rad(-cog);
//       }
//       else
//       {
//         angle_rad = deg2rad(-hdg);
//       }
//       var cos_angle=Math.cos(angle_rad);
//       var sin_angle=Math.sin(angle_rad);

//       var vectorPoints = [];
//       var vectorLineStyle =  
//         {
//           strokeDashstyle: 'solid',
//             strokeColor: '#FFFFFF',
//             strokeWidth:(sog > 30?3:1),
//             strokeLinecap: 'round'
//         }; 

//        var shipPoint = new OpenLayers.Geometry.Point(lon, lat);
//        shipPoint.transform(wgsProjection, mercatorProjection);
//        vectorPoints.push(shipPoint);
//        if(sog > 30) sog /=10; 
//        var targetPoint = calcVector(lon, lat, sog , sin_angle, cos_angle);
//        targetPoint.transform(wgsProjection, mercatorProjection);    
//        vectorPoints.push(targetPoint);
   
//        var vectorLine = new OpenLayers.Geometry.LineString(vectorPoints);
//        var vectorLineFeature = new OpenLayers.Feature.Vector(vectorLine, null,vectorLineStyle);
//        vectorLineFeature.fid = vessel.mmsi;
//        speedVectorLayer.addFeatures([vectorLineFeature]);
//        speedVectorLayer.drawFeature(vectorLineFeature);
//   }

//   function calcVector(lon, lat, d, sin, cos){
//     var dy_deg = -(d*cos)/Math.pow(1.9 ,map.getZoom());
//     var dx_deg = -(- d*sin)/(Math.cos(deg2rad(lat))*Math.pow(1.9,map.getZoom()));
//     return new OpenLayers.Geometry.Point(lon - dx_deg, lat - dy_deg);
//     }

//     function calcPoint(lon, lat, dx, dy, sin_angle, cos_angle){
//     var dy_deg = -((dx*sin_angle + dy*cos_angle)/(1852.0))/60.0;
//     var dx_deg = -(((dx*cos_angle - dy*sin_angle)/(1852.0))/60.0)/Math.cos(deg2rad(lat));
//     var lonlat = new OpenLayers.LonLat(lon - dx_deg, lat - dy_deg).transform(wgsProjection,mercatorProjection);
//     return new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat);
//     }

//     function deg2rad(grad){
//       return  grad * Math.PI/180.0;
//     }

// }  

  function getTileURL(bounds) 
  {
    var res = this.map.getResolution();
    var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
    var y = Math.round((this.maxExtent.top - bounds.top) / (res * this.tileSize.h));
    var z = this.map.getZoom();
    var limit = Math.pow(2, z);
    if (y < 0 || y >= limit) 
    {
      return null;
    }
    else 
    {
      x = ((x % limit) + limit) % limit;
      url = this.url;
      path= z + "/" + x + "/" + y + "." + this.type;
      if (url instanceof Array) 
      {
        url = this.selectUrl(path, url);
      }
      return url+path;
    }
  }
});
 