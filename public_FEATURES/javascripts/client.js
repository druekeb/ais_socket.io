$(document).ready(function() {
    
     var vessels = {};
     
      // Zoom 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18
      var zoomSpeedArray = [20,20,20,20,20,20,16,12,8,4,2,1,0,-1,-1,-1,-1,-1,-1];

     // Websocket
    var socket = io.connect('http://localhost:8090');
      //var socket = io.connect('http://app02.vesseltracker.com');

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
        paintToMap(vessel, function(vesselWithMapObjects){
          vessels[json.mmsi] = vesselWithMapObjects;
          if (typeof vesselWithMapObjects.marker.start ==='function')
          {
            vesselWithMapObjects.marker.start();
          }
          if(vesselWithMapObjects.polygon && typeof vesselWithMapObjects.polygon.start ==='function')
          {
            vesselWithMapObjects.polygon.start();
          }
        });
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
          paintToMap(jsonArray[x], function(vesselWithMapObjects){
          vessels[jsonArray[x].mmsi] = vesselWithMapObjects;
          if (typeof vesselWithMapObjects.marker.start ==='function')
          {
            vesselWithMapObjects.marker.start();
          }
          if(vesselWithMapObjects.polygon && typeof vesselWithMapObjects.polygon.start ==='function')
          {
            vesselWithMapObjects.polygon.start();
          }
        });
        }
        // zeige eine Infobox über die aktuelle minimal-Geschwindigkeit angezeigter Schiffe
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

    function paintToMap(v, callback){
      if(v.pos != null)
      {
        var markerIcon = chooseIcon(v);
        var moving = v.sog && v.sog > 10 && v.sog!=1023; //nur Schiffe, die sich mit mind. 3 Knoten bewegen
        var shipStatics = (map.getZoom() > 11) &&  (v.cog ||(v.true_heading && v.true_heading!=0.0 && v.true_heading !=511)) && (v.dim_port && v.dim_stern) ;
        if(v.msgid == 4 ||v.msgid == 6||v.msgid == 9 ||v.msgid == 12 ||v.msgid == 14||v.msgid == 21 )
        {
          v.marker = L.marker([v.pos[1], v.pos[0]], {icon:markerIcon});
        }
        else
        {
          v.angle = calcAngle(v);
          var cos_angle=Math.cos(v.angle);
          var sin_angle=Math.sin(v.angle);

          if (moving && map.getZoom() > 9) //nur Schiffe, die sich mit mind. 1 Knoten bewegen
          {
            var vectorPoints = [];
            var shipPoint = new L.LatLng(v.pos[1],v.pos[0]);
            vectorPoints.push(shipPoint);
            vectorPoints.push(shipPoint);
            vectorPoints.push(shipPoint);
            var vectorLength = v.sog >300?v.sog/100:v.sog/10;
            var targetPoint = calcVector(v.pos[0],v.pos[1], vectorLength, sin_angle, cos_angle);
            vectorPoints.push(targetPoint);
            var vectorWidth = (v.sog > 300?5:2); 
            v.vector = L.polyline(vectorPoints, {color: 'red', weight: vectorWidth });
            v.vector.addTo(featureLayer);
            v.marker = L.animatedMarker(vectorPoints,{
                                                  autoStart:false,
                                                  icon:markerIcon,
                                                  distance: vectorLength/10,
                                                  interval: 200
                                                });
            if (shipStatics)
            {
              v.polygon = new L.animatedPolygon(vectorPoints,{
                                                     autoStart:false,
                                                     distance: vectorLength/10,
                                                     interval: 200,
                                                     dim_stern:v.dim_stern,
                                                     dim_port: v.dim_port,
                                                     dim_bow:v.dim_bow,
                                                     dim_starboard: v.dim_starboard,
                                                     angle: v.angle
              });
              v.polygon.addTo(featureLayer); 
            }
          }
          else
          {
            v.marker = L.marker([v.pos[1], v.pos[0]], {icon:markerIcon});
            if(shipStatics)
            {
              v.polygon = L.polygon(createShipPoints(v));
              v.polygon.addTo(featureLayer); 
            }
          }
          v.marker.bindPopup(createMouseOverPopup(v),{closeButton:false,autoPan:false});
          v.marker.on('mouseover',function(e){this.openPopup();});
          v.marker.on('mouseout',function(e){this.closePopup();});
          featureLayer.addLayer(v.marker);
        }
        callback(v);
      }
    }

    function createShipPoints(vessel) {
      //benötigte Daten
      var left = vessel.dim_starboard;
      var front = vessel.dim_bow;
      var len = (vessel.dim_bow + vessel.dim_stern);
      var lon = vessel.pos[0];
      var lat = vessel.pos[1];
      var wid = (vessel.dim_port +vessel.dim_starboard);
      var cos_angle=Math.cos(vessel.angle);
      var sin_angle=Math.sin(vessel.angle);
      //ermittle aud den Daten die 5 Punkte des Polygons
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
      return shippoints;
     }

   function calcAngle(vessel) {
       //benötigte Daten
       var hdg = vessel.true_heading;
       var cog = vessel.cog/10;
       var lon = vessel.pos[0];
       var lat = vessel.pos[1];
       var sog = vessel.sog/10;
       var direction = 0;
       if ( hdg >0.0 && hdg !=511 &&hdg < 360)
       {
          direction = hdg;
       }
       else
       {
        if (sog && sog > 0.1 && cog < 360)
        direction = cog;
       }
       return (-direction *(Math.PI / 180.0));
   }

  function calcVector(lon, lat, sog, sin, cos){
    var dy_deg = -(sog * cos)/10000;
    var dx_deg = -(- sog * sin)/Math.cos((lat)*(Math.PI/180.0))/10000;
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }

    function calcPoint(lon, lat, dx, dy, sin_angle, cos_angle){
    var dy_deg = -((dx*sin_angle + dy*cos_angle)/(1852.0))/60.0;
    var dx_deg = -(((dx*cos_angle - dy*sin_angle)/(1852.0))/60.0)/Math.cos(lat * (Math.PI /180.0));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }

   function createMouseOverPopup(vessel){
      var timeNow = new Date();
      mouseOverPopup ="<div><table>";
      if(vessel.msgid == 21)
      {
        if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
        if(vessel.aton_type)mouseOverPopup+="<tr><td colspan='2'><b>"+aton_types[vessel.aton_type]+"</b></nobr></td></tr>";
      }
      else if(vessel.msgid == 4)
      {
        mouseOverPopup += "<tr><td colspan='2'><b>AIS Base Station</b></nobr></td></tr>";
        if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
      }
      else if(vessel.msgid == 9)
      {
        mouseOverPopup += "<tr><td colspan='2'><b>Helicopter SAR</b></nobr></td></tr>";
        if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
         if(vessel.altitude)mouseOverPopup+="<tr><td>Altitude: &nbsp;</td><td><nobr>"+(vessel.altitude)+"</nobr></td></tr>";
      }
      else
      {
        if(vessel.name)mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
        if(vessel.imo)mouseOverPopup+="<tr><td>IMO</td><td>"+(vessel.imo)+"</b></nobr></td></tr>  ";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
        if(vessel.nav_status && vessel.nav_status < 15 && vessel.nav_status > -1)
        {
          mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+ nav_stati[(vessel.nav_status)]+"</nobr></td></tr>";
        }
        if(vessel.sog)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+(vessel.sog/10)+"</nobr></td></tr>";
        if(vessel.true_heading && vessel.true_heading != 511)
        {
           mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading)+"</nobr></td></tr>";
        }
        if(vessel.cog)mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog/10)+"</nobr></td></tr>";
        if(vessel.rot && vessel.rot > 0 && vessel.rot < 127)
        {
          mouseOverPopup+="<tr><td>Rotation: &nbsp;</td><td><nobr>"+(vessel.rot)+"</nobr></td></tr>";
        }
        mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+createDate(vessel.time_received)+"</nobr></td></tr>";
        if(vessel.dest)mouseOverPopup+="<tr><td>Dest</td><td>"+(vessel.dest)+"</b></nobr></td></tr>";
        if(vessel.draught)mouseOverPopup+="<tr><td>draught</td><td>"+(vessel.draught)+"</b></nobr></td></tr>";
        if(vessel.dim_bow && vessel.dim_port)mouseOverPopup+="<tr><td>width, length</td><td>"+(vessel.dim_starboard +vessel.dim_port)+", "+(vessel.dim_stern + vessel.dim_bow )+"</b></nobr></td></tr>";
        if(vessel.ship_type > 5 && vessel.ship_type < 60)
        {
          mouseOverPopup+="<tr><td>ship_type</td><td>"+ shipTypes[(vessel.ship_type)]+"</b></nobr></td></tr>";
        }
      }
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
       var size;
       var popupAnchor;

        if(obj.msgid == 21)
        {
         iconUrl =  "../images/atons/aton_"+obj.aton_type+".png";
         size = [zoom,zoom]; 
         popupAnchor =  [-(size[0]/2), -(size[1]*5)] ; // point from which the popup should open relative to the iconAnchor
         return new L.Icon({iconUrl: iconUrl, iconSize: size, popupAnchor: popupAnchor});
       }
       else if(obj.msgid == 4)
       {
         iconUrl =   "../images/baseStation.png";
         size = [zoom-1,zoom-1];
         popupAnchor =  [-(size[0]/2), -(size[1]*5)] ; // point from which the popup should open relative to the iconAnchor
         return new L.Icon({iconUrl: iconUrl, iconSize: size, popupAnchor: popupAnchor}); 
       }
       else if (obj.msgid == 6)
       {
          iconUrl =   "../images/helicopter.png";
          size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
          popupAnchor = [-(size[0]/2), -(size[1]*5)] ; // point from which the popup should open relative to the iconAnchor
         return new L.Icon({iconUrl: iconUrl, iconSize: size, popupAnchor: popupAnchor});
       }
       else
       {
          if (obj.sog >  10)
          {
            svgDiv = '<object id="polygon'+obj.mmsi+'" type="image/svg+xml" data="../images/polygon.svg?rotation=rotate(124 5 5)"></object>';
            return new L.DivIcon({html:svgDiv});

        //     if (obj.cog > 3150 || obj.cog <= 450) triangleHtml += '<div class="arrow-up"></div>';
        //     if (obj.cog > 450 && obj.cog <=1350)  triangleHtml += '<div class="arrow-right"></div>';
        //     if (obj.cog > 1350 && obj.cog <= 2250) triangleHtml += '<div class="arrow-down"></div>';
        //     if (obj.cog > 2250 && obj.cog <= 3150) triangleHtml += '<div class="arrow-left"></div>';

        //   return  new L.DivIcon({
        //         className: 'arrow-div-icon',
        //         html: triangleHtml
        //         });
        
          }
          else
          {
            iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos.png";
            size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
            popupAnchor = [-(size[0]/2), -(size[1]*5)] ; // point from which the popup should open relative to the iconAnchor
            return new L.Icon({iconUrl: iconUrl, iconSize: size, popupAnchor: popupAnchor});
          }

      }
    }

});

var shipTypes = {
                  6:'Passenger Ships',
                  7: 'Cargo Ships',
                  8: 'Tankers',
                  30:'Fishing',
                  31:'Towing',
                  32:'Towing',
                  33:'Dredger',
                  34:'Engaged in diving operations',
                  35:'Engaged in military operations',
                  36: 'Sailing',
                  37: 'Pleasure craft',
                  50:'Pilot vessel',
                  51:'Search and rescue vessels',
                  52:'Tugs',53:'Port tenders',
                  54:'anti-pollution vessels',
                  55:'Law enforcement vessels',
                  56:'Spare for local vessels',
                  57:'Spare for local vessels',
                  58:'Medical transports',
                  59:'Ships according to RR'
                };

var nav_stati = {
                  0:'under way using engine',
                  1:'at anchor',
                  2: 'not under command',
                  3: 'restricted maneuverability',
                  4: 'constrained by her draught',
                  5: 'moored',
                  6: 'aground',
                  7: 'engaged in fishing',
                  8: 'under way sailing',
                  9: 'future use',
                  10: 'future use',
                  11: 'future use',
                  12: 'future use',
                  13: 'future use',
                  14: 'AIS-SART (active)',
                  15: 'not defined' 
                }
var aton_types = {
                  0:'notSpecified',
                  1:'ReferencePoint',
                  2: 'RACON',
                  3: 'off-shoreStructure',
                  4: 'futureUse',
                  5: 'LightWithoutSectors',
                  6: 'LightWithSectors',
                  7: 'LeadingLightFront',
                  8: 'LeadingLightRear',
                  9: 'BeaconCardinalN',
                  10: 'BeaconCardinalE',
                  11: 'BeaconCardinalS',
                  12: 'BeaconCardinalW',
                  13: 'BeaconPorthand', 
                  14: 'BeaconStarboardhand',
                  15: 'BeaconPreferredChannelPortHand',
                  16: 'BeaconPreferredChannelStarboardHand',
                  17: 'BeaconIsolatedDanger',
                  18: 'BeacoSafeWater',
                  19: 'BeaconSpecialMark',
                  20: 'CardinalMarkN',
                  21: 'CardinalMarkE',
                  22: 'CardinalMarkS',
                  23: 'CardinalMarkW',
                  24: 'PortHandMark',
                  25: 'StarboardHandMark',
                  26: 'PreferredChannelPortHand',
                  27: 'PreferredChannelStarboardHand',
                  28: 'IsolatedDanger',
                  29: 'SafeWater',
                  30: 'SpecialMark',
                  31: 'LightVessel/LANBY/Rigs'
                }
