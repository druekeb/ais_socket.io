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
      var zoom = 16; 
      

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
          moveOrCreateVector(v);
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
              moveOrCreateVector(v);
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
      var existingFeature = featuresLayer.getFeatureByFid("poly_"+v.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Polygon
      var polygonFeature = createPolygonFeature(v); 
      featuresLayer.addFeatures([polygonFeature]);
    }

   
    //paint the speedvector on the map
    function moveOrCreateVector(v) {   
    // find Vector and delete
      var existingFeature = featuresLayer.getFeatureByFid("vector_"+v.mmsi);
      if (existingFeature != null )
      {
         existingFeature.destroy();
      }
      //create new Vector
      var vectorFeature = createVectorFeature(v); 
      //featuresLayer.addFeatures([vectorFeature]);
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
     v.lon = json.pos[0];
     v.lat = json.pos[1];
     v.true_heading = json.true_heading;
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
      polygonVector.fid = "poly_"+vessel.mmsi;
      return polygonVector;
    }

     function createVectorFeature(vessel) {
       //benötigte Daten
       var hdg = vessel.true_heading;
       var cog = vessel.cog;
       var lon = vessel.lon;
       var lat = vessel.lat;
       var sog = vessel.sog;
       console.debug("vessel, mmsi: "+vessel.mmsi+", sog: "+sog+", cog: "+cog+ ", true:_heading: "+hdg);
       if(!hdg || hdg==0.0||hdg ==511)
       {
         if (!vessel.cog)
         {
           cog = 0.0;
         }
         hdg = cog;
       }
       if (hdg != 0.0)
       {
         var vectorPoints = [];

         var cos=Math.cos(hdg);
         var sin=Math.sin(hdg);
         
         console.debug(vessel.mmsi +": cos: "+cos+", sin: "+sin);
         var lat2, lon2;
         lat2 = deg2rad(lat);
         lon2 = deg2rad(lon);
         var cd = direct(lat2, lon2, cog *(180*60/Math.PI), 0.05/(180*60/Math.PI));
         var shipPoint = new OpenLayers.Geometry.Point(lon, lat);
         shipPoint.transform(wgsProjection, mercatorProjection);
         vectorPoints.push(shipPoint);
   
         var targetPoint = new OpenLayers .Geometry.Point((cd.lon*(180/Math.PI)),(cd.lat*(180/Math.PI)));
         targetPoint.transform(wgsProjection, mercatorProjection);    
         vectorPoints.push(targetPoint);
     
         var vectorLineStyle =  
          {
              strokeColor: 'blue',
              strokeWidth: 1,
              strokeLinecap: 'round'
          }; 
      
          var vectorLine = new OpenLayers.Geometry.LineString(vectorPoints);

          var vectorLineFeature = new OpenLayers.Feature.Vector(vectorLine, null,vectorLineStyle);
          vectorLineFeature.fid = "vector_"+vessel.mmsi;
          featuresLayer.addFeatures([vectorLineFeature]);
          featuresLayer.drawFeature(vectorLineFeature);
       }
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

function direct(lat1,lon1,crs12,d12) {
  var EPS= 0.00000000005
  var dlon,lat,lon
// 5/16 changed to "long-range" algorithm
  if ((Math.abs(Math.cos(lat1))<EPS) && !(Math.abs(Math.sin(crs12))<EPS)){
    alert("Only N-S courses are meaningful, starting at a pole!")
  }

  lat=Math.asin(Math.sin(lat1)*Math.cos(d12)+
                Math.cos(lat1)*Math.sin(d12)*Math.cos(crs12))
  if (Math.abs(Math.cos(lat))<EPS){
    lon=0.; //endpoint a pole
  }else{
    dlon=Math.atan2(Math.sin(crs12)*Math.sin(d12)*Math.cos(lat1),
                  Math.cos(d12)-Math.sin(lat1)*Math.sin(lat))
    lon=mod( lon1-dlon+Math.PI,2*Math.PI )-Math.PI
  }
  // alert("lat1="+lat1+" lon1="+lon1+" crs12="+crs12+" d12="+d12+" lat="+lat+" lon="+lon);
  out=new MakeArray(0)
  out.lat=lat
  out.lon=lon
  return out
}


function atan2(y,x){
var out
  if (x <0)            { out= Math.atan(y/x)+Math.PI}
  if ((x >0) && (y>=0)){ out= Math.atan(y/x)}
  if ((x >0) && (y<0)) { out= Math.atan(y/x)+2*Math.PI}
  if ((x==0) && (y>0)) { out= Math.PI/2}
  if ((x==0) && (y<0)) { out= 3*Math.PI/2}  
  if ((x==0) && (y==0)) {
    alert("atan2(0,0) undefined")
    out= 0.
  }  
  return out
}

function mod(x,y){
  return x-y*Math.floor(x/y)
}

function modlon(x){
  return mod(x+Math.PI,2*Math.PI)-Math.PI
}

function modcrs(x){
  return mod(x,2*Math.PI)
}

function modlat(x){
  return mod(x+Math.PI/2,2*Math.PI)-Math.PI/2
}

function format(expr, decplaces){
  var str= "" +Math.round(eval(expr)*Math.pow(10,decplaces))
  while (str.length <=decplaces) 
  {
    str= "0" + str
  }
  var decpoint=str.length-decplaces
  return str.substring(0,decpoint)+"."+str.substring(decpoint,str.length)
}

function MakeArray(n){
   this.length=n
   for (var i=1;i<=n;i++){
     this[i]=0
   }
   return this
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
