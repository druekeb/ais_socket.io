$(document).ready(function() {
    
      var shownPopup = 0;
      var vessels = {};
     
      // Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
      var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0,-1,-1,-1,-1,-1,-1];

     // Websocket
      var socket = io.connect('http://localhost:8090');
      var map = L.map('map').setView([53.54,9.95], 15);

      L.tileLayer('http://{s}.tiles.vesseltracker.com/vesseltracker/{z}/{x}/{y}.png', {
            attribution:  'Map-Data <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-By-SA</a> by <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors',
            maxZoom: 18,
            minZoom:3
          }).addTo(map);
      var markerLayer = L.layerGroup().addTo(map);
      var featureLayer = L.layerGroup().addTo(map);
      
      map.on('moveend', changeRegistration);
      changeRegistration();

      L.control.mousePosition().addTo(map);

      function changeRegistration()
      {
        var zoom = map.getZoom();
        if(zoom < 3)
        { 
          map.zoomTo(3);
          return;
        }
        socket.emit('unregister');
        console.debug("zoomLevel="+map.getZoom());
        var bounds = map.getBounds();
        socket.emit("register", bounds, map.getZoom());
      } 

      // Listen for vesselPosEvent
      socket.on('vesselPosEvent', function (data) {
         var json = JSON.parse(data);
         //update 
         var vessel = vessels[json.mmsi]?vessels[json.mmsi]:{};
         vessel.mmsi = json.mmsi;
         vessel.msgid = json.msgid;
         vessel.time_received = json.time_received;
         vessel.cog = json.cog;
         vessel.sog = json.sog;
         vessel.pos = json.pos;
         vessel.true_heading = json.true_heading;
        if (typeof vessel.marker !="undefined")
        {
           markerLayer.removeLayer(vessel.marker);
           delete vessel.marker;
        }
        if (typeof vessel.vector !="undefined")
        {
           featureLayer.removeLayer(vessel.vector);
           delete vessel.vector;
        }
        if (typeof vessel.polygon !="undefined")
        {
            featureLayer.removeLayer(vessel.polygon);
            delete vessel.polygon;
        }
        paintToMap(vessel);
      });

      // Listen for vesselsInBoundsEvent
      socket.on('vesselsInBoundsEvent', function (data) {
        console.debug("boundsEvent");
        var jsonArray = JSON.parse(data);

        markerLayer.clearLayers();
        featureLayer.clearLayers();
        vessels = {};

       // male vessel-Marker, Polygone und speedVectoren in die karte
       for (var x in jsonArray)
        {
           vessels[jsonArray[x].mmsi] = jsonArray[x];
           paintToMap(jsonArray[x]);
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

    function paintToMap(v){
      if(v.pos != null)
      {
        var markerIcon = chooseIcon(v);
        if (v.sog && v.sog > 30 && v.sog!=1023)
        {
          var vectorPoints =  createVectorPoints(v);
          var vectorWidth = (v.sog > 300?5:2); 
          v.vector = L.polyline(vectorPoints, {color: 'red', weight: vectorWidth });
          v.vector.addTo(featureLayer);

          var animationPoints = chunk(vectorPoints, 1);
          v.marker = L.animatedMarker(animationPoints,{
                                                autostart:false,
                                                icon:markerIcon,
                                                distance: 5,
                                                interval: 1000
                                              });
        }
        else
        {
          v.marker = L.marker([v.pos[1], v.pos[0]], {icon:markerIcon});
        }
        v.marker.bindPopup(createMouseOverPopup(v),{closeButton:false,autopan:false});
        v.marker.on('mouseover',function(e){this.openPopup();});
        v.marker.on('mouseout',function(e){this.closePopup();});
        markerLayer.addLayer(v.marker);

        if ((map.getZoom() > 11) && (((v.true_heading && v.true_heading!=0.0 && v.true_heading !=511) || v.cog ) && (v.dim_port +v.dim_starboard)) )
        {
          v.polygon = createPolygonFeature(v);
          v.polygon.addTo(featureLayer); 
        }
        vessels[v.mmsi] = v;
      }
    }

    function createMouseOverPopup(vessel){
      var timeNow = new Date();
      mouseOverPopup ="<div><table>";
      if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
      if(vessel.imo)mouseOverPopup+="<tr><td>IMO</td><td>"+(vessel.imo)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
      if(vessel.nav_status)mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(vessel.nav_status)+"</nobr></td></tr>";
      if(vessel.sog)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog/10)+"</nobr></td></tr>";
      if(vessel.true_heading)mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading)+"</nobr></td></tr>";
      if(vessel.cog)mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog/10)+"</nobr></td></tr>";
      mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+createDate(vessel.time_received)+"</nobr></td></tr>";
      if(vessel.dest)mouseOverPopup+="<tr><td>Dest</td><td>"+(vessel.dest)+"</b></nobr></td></tr>";
      if(vessel.draught)mouseOverPopup+="<tr><td>draught</td><td>"+(vessel.draught)+"</b></nobr></td></tr>";
      if(vessel.dim_bow && vessel.dim_port)mouseOverPopup+="<tr><td>width, length</td><td>"+(vessel.dim_starboard +vessel.dim_port)+", "+(vessel.dim_stern + vessel.dim_bow )+"</b></nobr></td></tr>";
      if(vessel.ship_type)mouseOverPopup+="<tr><td>ship_type</td><td>"+(vessel.ship_type)+"</b></nobr></td></tr>";
      mouseOverPopup+="</table></div>";
      return mouseOverPopup;
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
        returnString += " "+addDigi(seconds);
      }
      if (msec)
      {
        var milliseconds = date.getMilliseconds();
        returnString += " "+addDigi(milliseconds);
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
      else if (obj.sog >  30)
      {
        iconUrl = "http://images.vesseltracker.com/images/googlemaps/icon_lastpos_sat.png";
        size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
      }
      else 
      {
        iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos.png";
        size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
      }
      var icon = L.icon({
            iconUrl: iconUrl,
            iconSize:     size, // size of the icon
            popupAnchor:  [-(size.w/2), -(size.h*5)] // point from which the popup should open relative to the iconAnchor
        });
      return icon;
    }

   function createPolygonFeature(vessel) {
      //benötigte Daten
      var hdg = vessel.true_heading;
      var cog = vessel.cog/10;
      var left = vessel.dim_starboard;
      var front = vessel.dim_bow;
      var len = (vessel.dim_bow + vessel.dim_stern);
      var lon = vessel.pos[0];
      var lat = vessel.pos[1];
      var wid = (vessel.dim_port +vessel.dim_starboard);
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

     function createVectorPoints(vessel) {
       //benötigte Daten
       var hdg = vessel.true_heading;
       var cog = vessel.cog/10;
       var lon = vessel.pos[0];
       var lat = vessel.pos[1];
       var sog = vessel.sog/10;
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
       var vectorLength = (sog > 30? sog/10 : sog);
       var targetPoint = calcVector(lon, lat, vectorLength , sin_angle, cos_angle);
       vectorPoints.push(targetPoint);
       return vectorPoints;
   }

  function calcVector(lon, lat, sog, sin, cos){
    var dy_deg = -(sog * cos)/Math.pow(1.98 ,map.getZoom());
    var dx_deg = -(- sog * sin)/(Math.cos((lat)*(Math.PI/180.0))*Math.pow(1.98,map.getZoom()));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }

    function calcPoint(lon, lat, dx, dy, sin_angle, cos_angle){
    var dy_deg = -((dx*sin_angle + dy*cos_angle)/(1852.0))/60.0;
    var dx_deg = -(((dx*cos_angle - dy*sin_angle)/(1852.0))/60.0)/Math.cos(lat * (Math.PI /180.0));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }

    function chunk(latlngs, distance) {
    var i,
        len = latlngs.length,
        chunkedLatLngs = [];

    for (i=1;i<len;i++) {
      var cur = latlngs[i-1],
          next = latlngs[i],
          dist = cur.distanceTo(next),
          factor = distance / dist,
          dLat = factor * (next.lat - cur.lat),
          dLng = factor * (next.lng - cur.lng);

      if (dist > distance) {
        while (dist > distance) {
          cur = new L.LatLng(cur.lat + dLat, cur.lng + dLng);
          dist = cur.distanceTo(next);
          chunkedLatLngs.push(cur);
        }
      } else {
        chunkedLatLngs.push(cur);
      }
    }

    return chunkedLatLngs;
  }

});
