    /**
     * Vessels storage
     */
    var vessels = new Object();

    $(document).ready(function() {
      // Map
      map = new OpenLayers.Map('map');
      var osmLayer = new OpenLayers.Layer.OSM();
      map.setBaseLayer(osmLayer);
      var fromProjection = new OpenLayers.Projection("EPSG:4326"); // WGS 1984
      var toProjection = new OpenLayers.Projection("EPSG:900913"); // Spherical Mercator
      var position = new OpenLayers.LonLat(9.7,53.55).transform(fromProjection, toProjection);
      var zoom = 11; 
      map.setCenter(position, zoom);

      // MarkersLayer
      var markersLayer = new OpenLayers.Layer.Markers("MarkersLayer");
      map.addLayer(markersLayer);
      
      // Featureslayer
      
      var featuresLayer = new OpenLayers.Layer.Vector("FeaturesLayer");
      map.addLayers([osmLayer, featuresLayer, markersLayer]);
      
      // Websocket
      var server = io.connect('http://localhost:8000');
      
      // Listen for vesselPosEvent
       server.on('vesselPosEvent', function (data) {
//        Get Longitude and Latitude from AIS data stream
         var json = JSON.parse(data);
         var msgid = json.msgid;
         var mmsi = ""+json.userid;
         var lon = json.pos[0];
         var lat = json.pos[1];
         var cog = json.cog;
         var sog = json.sog;
         var true_heading = json.true_heading;
         var nav_status = json.nav_status;
         var time_captured = json.time_captured;
				
//      If we have a new vessel (not yet in "associative array")
         if (typeof vessels[mmsi] == "undefined")
         {
        	 
        	 var point = new OpenLayers.Geometry.Point(lon, lat);
       		var pointFeature = new OpenLayers.Feature.Vector(point);
       		featuresLayer.addFeature(pointFeature);
//            Create a new marker, draw it and store new vessel to vessels array
             vessels[mmsi] = {msgid: msgid, lon: lon, lat:lat, cog: cog,sog: sog,true_heading: true_heading,nav_status:nav_status, time_captured:time_captured};
           }
		           
         else //          If vessel is already known and marked on the map
 		 {
//         	Delete old markers
			if (msgid == 5)
			{
			   	console.log("msgid = "+msgid);
				console.log("time_diff = "+(time_captured -vessels[mmsi].time_captured)/1000 +" sec");
			}
//			override Vessel in Vessels array with new data          
            vessels[mmsi] = {msgid: msgid, lon: lon, lat:lat, cog: cog,sog: sog,true_heading: true_heading,nav_status:nav_status, time_captured:time_captured};
         }
       });
     });