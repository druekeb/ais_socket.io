function Vessel(jsonObject){
  this.mmsi = jsonObject.userid? jsonObject.userid:jsonObject.mmsi; //notwendig, weil posEvents userid statt mmsi haben
  this.msgid = jsonObject.msgid;
  this.name = jsonObject.name;
  this.time_received = jsonObject.time_received;
  this.cog = jsonObject.cog;
  this.sog = jsonObject.sog;
  this.pos = jsonObject.pos;
  this.imo = jsonObject.imo;
  this.true_heading = jsonObject.true_heading;
  this.dim_port = jsonObject.dim_port;
  this.dim_stern = jsonObject.dim_stern;
  this.dim_bow = jsonObject.dim_bow;
  this.dim_starboard = jsonObject.dim_starboard;
  this.ship_type = jsonObject.ship_type;
  this.nav_status = jsonObject.nav_status;
  this.dest = jsonObject.dest;
  this.draught = jsonObject.draught;
  this.time_captured = jsonObject.time_captured;
  if (this.mmsi == 211855000) //Cap San Diego
  {
    this.true_heading = 299;
  }
  
  this.updatePosition = function(jsonObject){
    this.pos = jsonObject.pos;
    this.msgid = jsonObject.msgid;
    this.time_received = jsonObject.time_received;
    this.cog = jsonObject.cog;
    this.sog = jsonObject.sog;
    this.true_heading = jsonObject.true_heading;
    this.time_captured = jsonObject.time_captured;
  }

  this.paintToMap = function(zoom, callback){
    if(this.pos != null)
    {
      /* does the vessel move with a speed over 0.4 knots? */
      var moving = (this.sog && this.sog > 0.4 && this.sog!=102.3) ; 
      /* do we have all the information, that's needed for painting a ship-polygon?*/ 
      var shipStatics = (this.cog ||(this.true_heading &&  this.true_heading!=0.0 &&  this.true_heading !=511)) 
                        && (this.dim_port && this.dim_stern)
                        && zoom > 11 ;
      var brng = calcAngle(this.sog, this.cog, this.true_heading);
      var vectorPoints = [];
      var shipPoint = new L.LatLng(this.pos[1],this.pos[0]);
      vectorPoints.push(shipPoint);
      /* for moving vessels paint a speedvector, a triangle and a ship-Polygon */
      if (moving)
      {
        var meterProSekunde = this.sog *0.51444;
        var vectorLength = meterProSekunde * 30; //meters, which are covered in 30 sec
        var targetPoint = destinationPoint(this.pos, this.cog, vectorLength);
        vectorPoints.push(targetPoint);
        var vectorWidth = (this.sog > 30?5:2); 
        this.vector = L.polyline(vectorPoints, {color: 'red', weight: vectorWidth }).addTo(LMap.getMap());
        var animationPartsSize = vectorLength/(zoom*10) ; //how long are the chunks of the vector
        var animationInterval = 400; //how long is the interval between two animation steps
        if (shipStatics)
        {
          this.polygon = new L.AnimatedPolygon(vectorPoints,{
                                                 autoStart:false,
                                                 distance: animationPartsSize,
                                                 interval: animationInterval,
                                                 dim_stern: this.dim_stern,
                                                 dim_port: this.dim_port,
                                                 dim_bow: this.dim_bow,
                                                 dim_starboard: this.dim_starboard,
                                                 brng:brng,
                                                 color: "blue",
                                                 weight: 3,
                                                 fill:true,
                                                 fillColor:shipTypeColors[this.ship_type],
                                                 fillOpacity:0.6,
                                                 clickable:false
          });
        }
        this.feature = new L.AnimatedPolygon(vectorPoints,{
                                                autoStart: false,
                                                distance: animationPartsSize,
                                                interval:animationInterval,
                                                brng:brng,
                                                zoom: zoom,
                                                color: "black",
                                                weight: 1,
                                                fill:true,
                                                fillColor:shipTypeColors[this.ship_type],
                                                fillOpacity:0.8,
                                                clickable:true
        });
      }
      else /* for non moving vessels paint a ship-polygon and a Circlemarker */
      {
        if(shipStatics)
        {
          this.polygon = new L.AnimatedPolygon( vectorPoints,{
                                                 dim_stern: this.dim_stern,
                                                 dim_port: this.dim_port,
                                                 dim_bow: this.dim_bow,
                                                 dim_starboard: this.dim_starboard,
                                                 brng:brng,
                                                 color: "blue",
                                                 weight: 3,
                                                 fill:true,
                                                 fillColor:shipTypeColors[this.ship_type],
                                                 fillOpacity:0.6,
                                                 clickable:false
          });
        }
        this.feature = L.circleMarker(vectorPoints[0], {
                                              radius:5,
                                              fill:true,
                                              fillColor:shipTypeColors[this.ship_type],
                                              fillOpacity:0.8,
                                              color:"#000000",
                                              opacity:0.4,
                                              weight:2.5
        });
      }
      if(this.polygon)
      {
        LMap.addToMap(this.polygon, (moving >0), "");
      }
      LMap.addToMap(this.feature, (moving >0), createPopupContent(this));
    }
    callback();
  }
}

var EARTH_RADIUS = 6371000;

function createPopupContent(vessel){
    var mouseOverPopup ="<div class='mouseOverPopup'><table>";
    if(vessel.name) mouseOverPopup+="<tr><td colspan='2'><b>"+vessel.name+"</b></nobr></td></tr>";
    if(vessel.imo && vessel.imo !="0")mouseOverPopup+="<tr><td>IMO</td><td>"+(vessel.imo)+"</b></nobr></td></tr>  ";
    mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(vessel.mmsi)+"</nobr></td></tr>";
    if(vessel.nav_status && vessel.nav_status < 15 && vessel.nav_status > -1)
    {
      mouseOverPopup+="<tr><td>NavStatus: &nbsp;</td><td><nobr>"+ nav_stati[( vessel.nav_status)]+"</nobr></td></tr>";
    }
    if( vessel.sog)mouseOverPopup+="<tr><td>Speed: &nbsp;</td><td><nobr>"+( vessel.sog)+" kn</nobr></td></tr>";
    if( vessel.true_heading &&  vessel.true_heading != 511)
    {
       mouseOverPopup+="<tr><td>Heading: &nbsp;</td><td><nobr>"+(vessel.true_heading)+" °</nobr></td></tr>";
    }
    else if(vessel.cog)mouseOverPopup+="<tr><td>Course: &nbsp;</td><td><nobr>"+(vessel.cog)+" °</nobr></td></tr>";
   
    mouseOverPopup+="<tr><td>TimeReceived: &nbsp;</td><td><nobr>"+createDate(vessel.time_received)+"</nobr></td></tr>";
    if(vessel.dest) mouseOverPopup+="<tr><td>Dest</td><td>"+(vessel.dest)+"</b></nobr></td></tr>";
    if(vessel.draught) mouseOverPopup+="<tr><td>draught</td><td>"+(vessel.draught/10)+" m</b></nobr></td></tr>";
    if(vessel.dim_bow && vessel.dim_port)mouseOverPopup+="<tr><td>length</td><td>"+(vessel.dim_stern + vessel.dim_bow )+" m</b></nobr></td></tr>";
    if(shipTypes[(vessel.ship_type)]) mouseOverPopup+="<tr><td>ship_type</td><td>"+ shipTypes[(vessel.ship_type)]+"</b></nobr></td></tr>";
    mouseOverPopup+="</table></div>";
    return mouseOverPopup;
}


function calcAngle (sog, cog, hdg) {
    var direction = 0;
    if (sog && sog > 0.4 && cog < 360)
    {
      direction = cog;
    }
    else if  ( hdg >0.0 && hdg !=511 && hdg < 360)
    {
      direction = hdg;
    }
    return (-direction *(Math.PI / 180.0));
}

function destinationPoint(pos, cog, dist) {
    dist = dist / EARTH_RADIUS;  
    var brng = cog.toRad();  
    var lat = pos[1].toRad();
    var lon = pos[0].toRad();
    var lat_dest = Math.asin(Math.sin(lat) * Math.cos(dist) + Math.cos(lat) * Math.sin(dist) * Math.cos(brng));
    var lon_dest = lon + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat), Math.cos(dist) - Math.sin(lat) * Math.sin(lat));
    if (isNaN(lat_dest) || isNaN(lon_dest)) return null;
    return new L.LatLng(lat_dest.toDeg(), lon_dest.toDeg());
}

function createDate(ts, sec, msec){
    var returnString;
    var date= new Date();
        date.setTime(ts);

    var month = date.getMonth()+1;
    var day = date.getDate();
    returnString = day +"."+month+". ";

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
      returnString += " "+addDigiMilli(milliseconds);
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

function addDigiMilli(curr_millisec){
    curr_millisec = curr_millisec + "";
    switch(curr_millisec.length)
    {
      case 1: curr_millisec = "00" + curr_millisec;
      break;
      case 2: curr_millisec = "0" + curr_millisec;
      break;
    }
    return curr_millisec;
}

Number.prototype.toRad = function() {
    return this * Math.PI / 180;
}

Number.prototype.toDeg = function() {
    return this * 180 / Math.PI;
}

var shipTypes = {
                  2:'Other Type', // eigene Zuweisung
                  20:'Wing in ground (WIG)',
                  29:'Wing in ground (WIG)',
                  207:'Other Type', //eigene Zuweisung
                  30:'Fishing',
                  31:'Towing',
                  32:'Towing',
                  33:'Dredger',
                  34:'diving operations',
                  35:'military operations',
                  36:'Sailing',
                  37:'Pleasure craft',
                  38:'Reserved',
                  39:'Reserved',
                  40:'High speed craft',
                  49:'High speed craft',
                  50:'Pilot vessel',
                  51:'Search & rescue vessels',
                  52:'Tugs',
                  53:'Port tenders',
                  54:'anti-pollution vessels',
                  55:'Law enforcement vessels',
                  56:'not classified',
                  57:'Spare for local vessels',
                  58:'Medical transports',
                  59:'Ships according to RR',
                  6:'Passenger Ships',
                  60:'Passenger Ships',
                  61:'Passenger Ships',
                  65:'Passenger Ships',
                  67:'Passenger Ships',
                  68:'Passenger Ships',
                  69:'Passenger Ships',
                  7: 'Cargo Ships',
                  70:'Cargo Ships',
                  71:'Cargo Ships',
                  72:'Cargo Ships',
                  73:'Cargo Ships',
                  74:'Cargo Ships',
                  77:'Cargo Ships',
                  79:'Cargo Ships',
                  8: 'Tanker',
                  80:'Tanker',
                  81:'Tanker',
                  82:'Tanker',
                  83:'Tanker',
                  84:'Tanker',
                  89:'Tanker',
                  9:'Other Type',
                  90:'Other Type',
                  91:'Other Type',
                  97:'Other Type',
                  99:'Other Type'
};

var shipTypeColors = {
                  2:'#f9f9f9',
                  20:'#f9f9f9',
                  29:'#f9f9f9',
                  207:'#f9f9f9',
                  30:'#f99d7b'/*brown, Fishing*/,
                  31:'#4dfffe'/*lightblue, Towing*/,
                  32:'#4dfffe'/*lightblue, Towing*/,
                  33:'#f9f9f9'/*gray, Dredger*/,
                  34:'white'/*Engaged in diving operations*/,
                  35:'white'/*Engaged in military operations*/,
                  36:'#f900fe'/*violett, Sailing*/,
                  37:'#f900fe'/*violett, Pleasure craft*/,
                  40:'#f9f9f9'/*Highspeed*/,
                  49:'#f9f9f9'/*Highspeed*/,  
                  50:'#4dfffe'/*lightblue, Pilot vessel*/,
                  51:'white' /*Search and rescue vessels*/,
                  52:'#4dfffe'/*lightblue, Tugs*/,
                  53:'#4dfffe'/*lightblue, Port tenders*/,
                  54:'white'/*anti-pollution vessels*/,
                  55:'white'/*Law enforcement vessels*/,
                  56:'#d2d2d2'/*not classified => used as default by vesseltracker*/,
                  57:'white'/*Spare for local vessels*/,
                  58:'white'/*Medical transports*/,
                  59:'white'/*Ships according to RR*/,
                  6:'#2d00fe'/*blue, Passenger Ships*/,
                  60:'#2d00fe'/*blue, Passenger Ships*/,
                  61:'#2d00fe'/*blue, Passenger Ships*/,
                  67:'#2d00fe'/*blue, Passenger Ships*/,
                  65:'#2d00fe'/*blue, Passenger Ships*/,
                  68:'#2d00fe'/*blue, Passenger Ships*/,
                  69:'#2d00fe'/*blue, Passenger Ships*/,
                  7: '#95f190'/*lightgreen, Cargo Ships*/,
                  70:'#95f190'/*lightgreen, Cargo Ships*/,
                  71:'#95f190'/*lightgreen, Cargo Ships*/,
                  72:'#95f190'/*lightgreen, Cargo Ships*/,
                  73:'#95f190'/*lightgreen, Cargo Ships*/,
                  74:'#95f190'/*lightgreen, Cargo Ships*/,
                  79:'#95f190'/*lightgreen, Cargo Ships*/,
                  8: '#f70016'/*red, Tankers*/,
                  80:'#f70016'/*Tanker*/,
                  81:'#f70016'/*Tanker*/,
                  82:'#f70016'/*Tanker*/,
                  83:'#f70016'/*Tanker*/,
                  84:'#f70016'/*Tanker*/,
                  89:'#f70016'/*red,Tankers*/,
                  9:'#d2d2d2'/*Other Type*/,
                  90:'#d2d2d2'/*Other Type*/,
                  91:'#d2d2d2'/*Other Type*/,
                  97:'#d2d2d2'/*Other Type*/,
                  99:'#d2d2d2'/*Other Type*/
}

var nav_stati = {
                  0:'under way us. engine',
                  1:'at anchor',
                  2: 'not under command',
                  3: 'restr. maneuverability',
                  4: 'constr. by draught',
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