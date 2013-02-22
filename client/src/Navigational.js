 //Seezeichen, Helicopter und AIS Base Stations
    
    function Navigational(jsonObject){

  		this.mmsi = jsonObject.mmsi;
  		this.msgid = jsonObject.msgid;
      this.lat = jsonObject.pos[1];
      this.lng = jsonObject.pos[0];
      this.name = jsonObject.name;
      this.aton_type = jsonObject.aton_type;
  		this.altitude = jsonObject.altitude;


		this.createMapObjects = function(zoom, callback){
		  var markerIcon = chooseIcon(this, zoom); 
	    this.marker = L.marker([this.lat, this.lng], {icon:markerIcon});
      this.popupContent = getPopupContent(this);
	    callback();
		}

    function getPopupContent(obj)
    {
      var mouseOverPopup ="<div><table>";
      if(obj.msgid == 21)
      {
        if(obj.name)mouseOverPopup+="<tr><td colspan='2'><b>"+obj.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(obj.mmsi)+"</nobr></td></tr>";
        if(obj.aton_type)mouseOverPopup+="<tr><td colspan='2'><b>"+aton_types[obj.aton_type]+"</b></nobr></td></tr>";
      }
      else if(obj.msgid == 4)
      {
        mouseOverPopup += "<tr><td colspan='2'><b>AIS Base Station</b></nobr></td></tr>";
        if(obj.name)mouseOverPopup+="<tr><td colspan='2'><b>"+obj.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(obj.mmsi)+"</nobr></td></tr>";
      }
      else if(obj.msgid == 9)
      {
        mouseOverPopup += "<tr><td colspan='2'><b>Helicopter SAR</b></nobr></td></tr>";
        if(name)mouseOverPopup+="<tr><td colspan='2'><b>"+obj.name+"</b></nobr></td></tr>";
        mouseOverPopup+="<tr><td>MMSI: &nbsp;</td><td><nobr>"+(obj.mmsi)+"</nobr></td></tr>";
         if(obj.altitude)mouseOverPopup+="<tr><td>Altitude: &nbsp;</td><td><nobr>"+(obj.altitude)+"</nobr></td></tr>";
      }
      else
      {
        mouseOverPopup+="<tr><td colspan='2'><b>"+(obj.name != undefined?obj.name:obj.mmsi)+"</b></nobr></td></tr>";
      }
      mouseOverPopup+="</table></div>";
      return mouseOverPopup;
   }



	function chooseIcon(obj, zoom){
       var iconUrl, size, popupAnchor, iconAnchor;

        if(obj.msgid == 21)
        {
         iconUrl =  "../images/atons/aton_"+obj.aton_type+".png";
         size = [zoom,zoom];
         return new L.Icon({iconUrl: iconUrl, iconSize: size});
       }
       else if(obj.msgid == 4)
       {
         iconUrl =   "../images/baseStation.png";
         size = [zoom-1,zoom-1];
         return new L.Icon({iconUrl: iconUrl, iconSize: size});
       }
       else if (obj.msgid ==9)
       {
          iconUrl =   "../images/helicopter.png";
          size = [3*zoom,3*zoom];
          return new L.Icon({iconUrl: iconUrl, iconSize: size});
       }
       else
       {
          iconUrl =  "http://images.vesseltracker.com/images/googlemaps/icon_lastpos.png";
          size = [6+2*Math.log(zoom),6+2*Math.log(zoom)];
          return new L.Icon({iconUrl: iconUrl, iconSize: size});
        }
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

}