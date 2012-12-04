$(document).ready(function() {
    
      var shownPopup = 0;
      var navigationalObjects = new Object();
      var zoomSpeedArray;
      var urlArray = [  "http://t1.tiles.vesseltracker.com/vesseltracker/",
                    "http://t2.tiles.vesseltracker.com/vesseltracker/",
                    "http://t3.tiles.vesseltracker.com/vesseltracker/"  ];
      var wgsProjection = new OpenLayers.Projection("EPSG:4326"); // WGS 1984
      var mercatorProjection = new OpenLayers.Projection("EPSG:900913"); // Spherical Mercator

      var map = new OpenLayers.Map({
        div: "map",
        units: "m",
        maxExtent : new OpenLayers.Bounds(-20037508.34, -20037508.34,20037508.34, 20037508.34),
        numZoomLevels : 18,
        maxResolution : 156543,
        projection : mercatorProjection,
        displayProjection : wgsProjection
      });
      var osmLayer = new OpenLayers.Layer.TMS(
        "OpenStreetMap",
        urlArray,
        {
          numZoomLevels : 18,
          transitionEffect : 'resize',
          type : 'png',
          getURL : getTileURL,
          attribution : 'Map-Data <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-By-SA</a> by <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors'
        });

      var speedVectorLayer  = new OpenLayers.Layer.Vector("speedVectorLayer");
      var polygonLayer = new OpenLayers.Layer.Vector("polygonLayer");
      var markersLayer = new OpenLayers.Layer.Markers("Markers");

      map.addLayers([osmLayer, polygonLayer, speedVectorLayer, markersLayer]);
      var position = new OpenLayers.LonLat(9.95,53.54).transform(wgsProjection, mercatorProjection);
      var zoom = 9; 
      
       map.addControl( new OpenLayers.Control.MousePosition({
                    formatOutput: function(lonLat) {
                     var lon = Math.round(lonLat.lon *100000) / 100000;
                     var lat = Math.round(lonLat.lat *100000) / 100000;
                     var markup = "<span text-align='right'>" +formatLat(lonLat.lat, false);
                         markup += "&nbsp;&nbsp;" + formatLon(lonLat.lon, false) +  "<br>" + lat + "&nbsp;&nbsp;" + lon +"&nbsp;</span>";
                    return markup
                    }
      }));

      // Websocket
      var socket = io.connect('http://localhost:8090');
      map.events.on({"moveend":changeRegistration});
      map.setCenter(position, zoom); 

      function changeRegistration()
      {
        var zoom = map.getZoom();
        if(zoom < 3)
        {
          map.zoomTo(3);
          return;
        }
        socket.emit('unregister');
        var bounds = map.calculateBounds().transform(mercatorProjection,wgsProjection);
        socket.emit("register", bounds,zoom);
      } 

      socket.on('safetyMessageEvent', function(safetyMsg){
        var safetyMessage = JSON.parse(safetyMsg);
        var destinationObject = navigationalObjects[""+safetyMessage.destination];
        if (destinationObject!=undefined && destinationObject.marker != undefined)
        {
              popup = new OpenLayers.Popup("Securtiy Message!",
                       new OpenLayers.LonLat(destinationObject.lon,destinationObject.lat),
                       new OpenLayers.Size(200,200),
                       safetyMessage.message,
                       true);
              map.addPopup(popup);
        }
      });

      socket.on('zoomSpeedEvent', function(zSA){
        zoomSpeedArray = JSON.parse(zSA);
      });
      // Listen for vesselPosEvent
      socket.on('vesselPosEvent', function (data) {
         var json = JSON.parse(data);
         var vessel = navigationalObjects[""+json.userid];
        // If don't yet have this vessel in navigationalObjects, save a new one)
        if (typeof vessel == "undefined") 
        {
           vessel = new Object();
        }
        else
        { 
          if(vessel.marker != null)
          {
            //checkForDoubles(v, json);
            if (vessel.marker.events != null )
            {
               vessel.marker.events.unregister('mouseover');
               vessel.marker.events.unregister('mouseout');
            }
            markersLayer.removeMarker(vessel.marker);
            vessel.marker.destroy();
          }
        }
        vessel = parseVesselPos(vessel,json);
        vessel.marker = addIconMarker(vessel);
        updateSpeedVector(vessel);
        if (map.getZoom() > 11)
        {
           if (((vessel.hdg && vessel.hdg!=0.0 && vessel.hdg !=511) || vessel.cog ) && vessel.width)  updatePolygon(vessel);
         }
         navigationalObjects[""+json.userid] = vessel;
      });

      // Listen for vesselsInBoundsEvent
      socket.on('vesselsInBoundsEvent', function (data) {
         console.debug("vesselBoundsEvent, zoom: "+map.getZoom());
         var jsonArray = JSON.parse(data);
         var vesselData = jsonArray.vesselData;
         var navigationalAidsData = jsonArray.navigationalAids;

         //leere vector- und markerLayer
         cleaningWoman();

        // male vessel-Marker in die karte
         for (var i = 0; i < vesselData.length; i++)
         {
            v = vesselData[i];
            if (v.msgid == 21) alert("halt");
            if(v.pos != null)
            {
              v.marker = addIconMarker(v);
              if (v.sog)
              {
                updateSpeedVector(v);
              }
              if (map.getZoom() > 11)
              {
                  if (((v.hdg && v.hdg!=0.0 && v.hdg !=511) || v.cog ) && v.width)  updatePolygon(v);
              }
            }
            navigationalObjects[""+vesselData[i].mmsi] = v;
         }
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
                n.marker = addIconMarker(n);
              }
              if (map.getZoom() > 11)
              {
                  if (n.width)  updatePolygon(n);
              }
              navigationalObjects[""+navigationalAidsData[i].mmsi] = n;
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
      
    function cleaningWoman()
    {
      speedVectorLayer.destroyFeatures();
      for (var x  in navigationalObjects)
      {
        var marker = navigationalObjects[x].marker;
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
        delete navigationalObjects[x];
      }
    }

    //paint the polygon on the map
    function updatePolygon(obj) {   
    // find polygon and delete it
      var existingFeature = polygonLayer.getFeatureByFid(obj.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Polygon
      var polygonFeature = createPolygonFeature(obj); 
      polygonLayer.addFeatures([polygonFeature]);
    }

   
    //paint the speedvector on the map
    function updateSpeedVector(v) {   
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
      if (json.pos == v.pos)
      {
        console.debug(v.mmsi+",  Antennen: "+v.aisclient_id+"/ "+ json.aisclient_id+" , Abstand "+((json.time_received - v.time_received)) +"  msec");
        //vorher property sentences (NMEA-Messagetext) in node server und client einkommentieren
        console.debug(json.sentences +"/ "+v.sentences);
      }
    }

    // parse TYPE 1 message
    function parseVesselPos(v,json){
     v.aisclient_id = json.aisclient_id;
     v.msgid = json.msgid;
     v.time_received = json.time_received;
     v.mmsi = json.userid;
     v.cog = json.cog/10;
     v.sog = json.sog/10;
     v.pos = json.pos;
     v.true_heading = json.true_heading;
     return v;
   }

    function addIconMarker(obj) {
      var lonlat = new OpenLayers.LonLat(obj.pos[0],obj.pos[1]).transform(wgsProjection,mercatorProjection);
      var icon = chooseIcon(obj);
      var marker = new OpenLayers.Marker(lonlat,icon);
      if (map.getZoom() < 12)
      {
         var existingFeature = polygonLayer.getFeatureByFid(obj.mmsi);
          if (existingFeature != null )
          {
             existingFeature.destroy();
          }
      }
      marker.id = obj.mmsi;
      marker.type = obj.msgid;
      marker.events.register("mouseover", marker, function(e) 
      {
        if(shownPopup != this.id)
        {
            $("#"+shownPopup).remove();
            $("#map").append(createMouseOverPopup(navigationalObjects[""+this.id],e.clientX, e.clientY));
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

     function chooseIcon(obj){
      var iconUrl;
      var zoom = map.getZoom();

      if(obj.msgid == 21)
      {
        iconUrl =  "../images/aton_"+obj.aton_type+".png";
        size = new OpenLayers.Size(zoom,zoom); 
      }
      else if(obj.msgid == 4)
      {
        iconUrl =   "../images/baseStation.png";
        size = new OpenLayers.Size(zoom-1,zoom-1); 
      }
      else if (obj.msgid == 6)
      {
         iconUrl =   "../images/helicopter.png";
         size = new OpenLayers.Size(6+2*Math.log(zoom),6+2*Math.log(zoom));
      }
      else
      {
        iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos_sat.png";
        size = new OpenLayers.Size(6+2*Math.log(zoom),6+2*Math.log(zoom));
      }
      var offset = new OpenLayers.Pixel(-(size.w/2), -(size.h -1));
      var icon = new OpenLayers.Icon(iconUrl,size, offset);
      return icon;
    }

    function createMouseOverPopup(obj, x,y){
      var timeNow = new Date();
      var mouseOverPopup= "<div id='"+obj.mmsi+"' class='mouseOverPopup' style='top:"+(y-20)+"px;left:"+(x+20)+"px;' >";
      mouseOverPopup +="<table><tr><td colspan='2'><b>"+(obj.name?obj.name:"")+"</b></nobr></td></tr>";
      if (obj.msgid == 4) mouseOverPopup +="<tr><td colspan = '2'><b>AIS Base Station</b></td></tr>";
      mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+obj.mmsi+"</nobr></td></tr>";
      if(obj.aton_type)
        {
          mouseOverPopup+="<tr><td>Type</td><td>";
          mouseOverPopup+=(obj.aton_type_desc?obj.aton_type_desc:"");
          mouseOverPopup+="</b></nobr></td></tr>";
        }
      if(obj.imo !=0 && obj.imo != null)mouseOverPopup+="<tr><td>IMO</td><td>"+(obj.imo==undefined?"":obj.imo)+"</b></nobr></td></tr>";
      if(obj.nav_status != null)mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+(obj.nav_status==undefined?"":obj.nav_status)+"</nobr></td></tr>";
      if(obj.sog != null)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(obj.sog==undefined?"":obj.sog)+"</nobr></td></tr>";
      if(obj.true_heading != null)mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(obj.true_heading==undefined?"":obj.true_heading)+"</nobr></td></tr>";
      if(obj.cog != null)mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(obj.cog==undefined?"":obj.cog)+"</nobr></td></tr>";
      if(obj.dest != null && obj.dest != "")mouseOverPopup+="<tr><td>Dest</td><td>"+(obj.dest==undefined?"":obj.dest)+"</b></nobr></td></tr>";
      if(obj.draught != null)mouseOverPopup+="<tr><td>draught</td><td>"+(obj.draught==undefined?"":obj.draught)+"</b></nobr></td></tr>";
      if(obj.ship_type != null)mouseOverPopup+="<tr><td>ship_type</td><td>"+(obj.ship_type==undefined?"":obj.ship_type)+"</b></nobr></td></tr>";
      if(obj.width &&obj.length)mouseOverPopup+="<tr><td>width, length</td><td>"+(obj.width==undefined?"":obj.width)+", "+(obj.length==undefined?"":obj.length)+"</b></nobr></td></tr>";
      mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+(obj.time_received==undefined?"":createDate(obj.time_received))+"</nobr></td></tr>";
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

    function createPolygonFeature(obj) {
      //benötigte Daten
      var hdg = obj.true_heading;
      var cog = obj.cog;
      var left = obj.left;
      var front = obj.front;
      var len = obj.length;
      var lon = obj.pos[0];
      var lat = obj.pos[1];
      var wid = obj.width;
      var angle_rad;
      if(!hdg || hdg==0.0||hdg ==511)
      {
        if (!cog)
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
      polygonVector.fid = obj.mmsi;
      return polygonVector;
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
            strokeColor: '#ff5533',
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

    function formatLat(lat, showSeconds)
  {
    var ret;
    if(lat<0)
    {
      lat = -lat;
      ret ='S ';
    }
    else
    {
      ret ='N ';
    }
    var deg = Math.floor(lat);
    ret += padDigits(deg,2)+"° ";
    var min = ((lat-deg)*60.0);
    var minF = Math.floor(min);
    
    var sec = ((min - minF) * 60.0).toFixed(2);
    if (sec == 60.00)
    {
      sec = 0.0;
      sec = sec.toFixed(2);
      minF += 1;
    }
    if (showSeconds)
    {
      ret += padDigits(minF, 2) + "' ";
      ret += padDigits(sec, 5) + "\" ";
    }
    else
    {
      ret += padDigits(min.toFixed(2), 5) + "' "; 
    }
    return ret;
  }


  function padDigits(n, totalDigits) 
  { 
    n = n.toString(); 
    var pd = '';
    if (totalDigits > n.length) 
    { 
      for (var i=0; i < (totalDigits-n.length); i++) 
      { 
          pd += '0'; 
      } 
    } 
    return pd + n;
  } 

  function formatLon(lon, showSeconds)
  {
    var ret;
    if(lon<0)
    {
      lon=-lon;
      ret='W ';
    }
    else
    {
      ret='E ';
    }
    
    var deg = Math.floor(lon);
    ret += padDigits(deg, 3) + "° ";
    var min = ((lon - deg) * 60.0);
    var minF = Math.floor(min);
    var sec = ((min - minF) * 60.0).toFixed(2);
    if (sec == 60.00)
    {
      sec = 0.0;
      sec = sec.toFixed(2);
      minF += 1;
    }
    if (showSeconds)
    {
      ret += padDigits(minF, 2) + "' " + padDigits(sec, 5) + "\"";
    }
    else
    {
      ret += padDigits(min.toFixed(2), 5) + "' "; 
    }
    return ret;
  }

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
