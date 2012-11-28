$(document).ready(function() {
    
      var shownPopup = 0;
      var navigationalObjects = new Object();
     
      // Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
      var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0,-1,-1,-1,-1,-1,-1];

     // Websocket
      var socket = io.connect('http://localhost:8090');
      var map = L.map('map').setView([53.54,9.95], 13);

      L.tileLayer('http://{s}.tiles.vesseltracker.com/vesseltracker/{z}/{x}/{y}.png', {
            attribution:  'Map-Data <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-By-SA</a> by <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors',
            maxZoom: 18,
            minZoom:3
          }).addTo(map);
      var markerLayer = L.layerGroup().addTo(map);
      var featureLayer = L.layerGroup().addTo(map);
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
        featureLayer.clearLayers();

       // male vessel-Marker, Polygone und speedVectoren in die karte
       if (vesselData != null)
       {
          paintToMap(vesselData);
       }
       // male navigationalAid-Marker in die karte
       if (navigationalAidsData != null)
       {
          paintToMap(navigationalAidsData);
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

    function paintToMap(objArray){
      for (var i = 0; i < objArray.length; i++)
      {
        v = objArray[i];
        if(v.pos != null)
        {
          v.marker = createMarker(v);
          v.marker.addTo(markerLayer);
          if (v.sog && v.sog > 0 && v.sog!=102.3)
          {
              featureLayer.addLayer(createVectorFeature(v));
          }
          if ((map.getZoom() > 11) && (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width) )
          {
            featureLayer.addLayer(createPolygonFeature(v)); 
          } 
        }
        navigationalObjects[""+objArray[i].mmsi] = v;
      }
    }

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
      var marker = L.marker([v.pos[1], v.pos[0]], {icon:icon});
      marker.bindPopup(createMouseOverPopup(v),{closeButton:false,autopan:false});
      marker.on('mouseover',function(e){this.openPopup();});
      marker.on('mouseout',function(e){this.closePopup();});
      return marker;
   }

    function createMouseOverPopup(vessel){
      var timeNow = new Date();
      mouseOverPopup ="<div><table>";
      if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
      if(vessel.imo)mouseOverPopup+="<tr><td>IMO</td><td>"+(vessel.imo)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
      if(vessel.nav_status)mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(vessel.nav_status)+"</nobr></td></tr>";
      if(vessel.sog)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog)+"</nobr></td></tr>";
      if(vessel.true_heading)mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading)+"</nobr></td></tr>";
      if(vessel.cog)mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+createDate(vessel.time_received)+"</nobr></td></tr>";
      if(vessel.dest)mouseOverPopup+="<tr><td>Dest</td><td>"+(vessel.dest)+"</b></nobr></td></tr>";
      if(vessel.draught)mouseOverPopup+="<tr><td>draught</td><td>"+(vessel.draught)+"</b></nobr></td></tr>";
      if(vessel.ship_type)mouseOverPopup+="<tr><td>ship_type</td><td>"+(vessel.ship_type)+"</b></nobr></td></tr>";
      if(vessel.left && vessel.front)mouseOverPopup+="<tr><td>left, front</td><td>"+vessel.left+", "+vessel.front+"</b></nobr></td></tr>";
      if(vessel.length && vessel.width)mouseOverPopup+="<tr><td>width, length</td><td>"+vessel.width+", "+vessel.length+"</b></nobr></td></tr>";
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
            //iconAnchor:   [2,2], // point of the icon which will correspond to marker's location
            popupAnchor:  [-(size.w/2), -(size.h -1)] // point from which the popup should open relative to the iconAnchor
        });
      return icon;
    }

    function createPolygonFeature(vessel) {
      //benötigte Daten
      var hdg = vessel.true_heading;
      var cog = vessel.cog;
      var left = vessel.left;
      var front = vessel.front;
      var len = vessel.length;
      var lon = vessel.pos[0];
      var lat = vessel.pos[1];
      var wid = vessel.width;
      var angle_rad;

       if(!hdg || hdg==0.0||hdg ==511)
       {
         if (!vessel.cog)
         {
           cog = 0.0;
         }
         angle_rad = -cog * (Math.PI /180.0);
       }
       else
       {
         angle_rad = -hdg * (Math.PI /180.0);
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
    
       var polygon = new L.Polygon(shippoints);
       return polygon;
     }

     function createVectorFeature(vessel) {
       //benötigte Daten
       var hdg = vessel.true_heading;
       var cog = vessel.cog;
       var lon = vessel.pos[0];
       var lat = vessel.pos[1];
       var sog = vessel.sog;
       if(!hdg || hdg==0.0||hdg ==511)
       {
         if (!vessel.cog)
         {
           cog = 0.0;
         }
         angle_rad =-cog *(Math.PI / 180.0);
       }
       else
       {
         angle_rad = -hdg * (Math.PI/180.0);
       }
       var cos_angle=Math.cos(angle_rad);
       var sin_angle=Math.sin(angle_rad);

       var vectorPoints = [];
       var shipPoint = new L.LatLng(lat, lon);
       vectorPoints.push(shipPoint);
       if(sog > 30) sog /=10; 
       var targetPoint = calcVector(lon, lat, sog , sin_angle, cos_angle);
       vectorPoints.push(targetPoint);
       var speedVector = L.polyline(vectorPoints, {color: 'red', weight: (sog > 30?5:2)});
       return speedVector;
   }

  function calcVector(lon, lat, sog, sin, cos){
    var dy_deg = -(sog * cos)/Math.pow(1.95 ,map.getZoom());
    var dx_deg = -(- sog * sin)/(Math.cos((lat)*(Math.PI/180.0))*Math.pow(1.95,map.getZoom()));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }

    function calcPoint(lon, lat, dx, dy, sin_angle, cos_angle){
    var dy_deg = -((dx*sin_angle + dy*cos_angle)/(1852.0))/60.0;
    var dx_deg = -(((dx*cos_angle - dy*sin_angle)/(1852.0))/60.0)/Math.cos(lat * (Math.PI /180.0));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }
});
 