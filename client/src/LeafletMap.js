var LMap = function(){

  var map, featureLayer, tileLayer, zoom, socket, boundsTimeout, boundsTimeoutTimer;
  
  function init(elementid, initOptions, mapOptions, tileLayerOptions){
    map =  L.map(elementid,mapOptions);

    var tileLayer =  new L.tileLayer(tileLayerOptions.tileURL, tileLayerOptions);
    tileLayer.addTo(map);

    featureLayer = L.layerGroup().addTo(map);
    if (initOptions.mousePosition)
    {
      L.control.mousePosition().addTo(map);
    }
    socket = initOptions.onMoveend;
    map.on('moveend', changeRegistration);
    boundsTimeout = initOptions.boundsTimeout *1000;
    map.setView(new L.LatLng(initOptions.lat,initOptions.lon), initOptions.zoom);
    changeRegistration();
  }


  function changeRegistration(){
      var zoom = map.getZoom();
      socket.emit('unregister');
      console.debug("zoomLevel="+map.getZoom());
      var bounds = map.getBounds();
      socket.timeQuery = new Date().getTime();
      socket.emit("register", bounds, map.getZoom());
      if (boundsTimeoutTimer) clearTimeout(boundsTimeoutTimer);
      boundsTimeoutTimer = setTimeout(changeRegistration, boundsTimeout);
  } 
	   
  function getMap(){
    return map;
  }

  function getZoom(){
  	return map.getZoom();
  }

  function addToMap(feature, animation, popupContent){
    if(popupContent.length > 0)
    { 
      function onMouseover(e) {
        var popupOptions, latlng;
        popupOptions = {closeButton:false ,autoPan:false , maxWidth: 150, offset:new L.Point(50,-50)};
        L.popup(popupOptions).setLatLng(e.latlng).setContent(popupContent).openOn(map);
      }

      function onMouseout(e) {
        LMap.getMap().closePopup();
      }     

      feature.on('mouseover',onMouseover);
      feature.on('mouseout', onMouseout);
    }
    featureLayer.addLayer(feature);
    if (animation == true)
    {
      feature.start();
    }
  }
  	
  function removeFeatures(vessel){
    if (typeof vessel.vector !="undefined")
    {
       featureLayer.removeLayer(vessel.vector);
    }
    if (typeof vessel.polygon !="undefined")
    {
       if (typeof vessel.polygon.stop ==='function')
       {
           vessel.polygon.stop();
       }
       featureLayer.removeLayer(vessel.polygon);
    }
    if (typeof vessel.feature !="undefined")
    {
      if (typeof vessel.feature.stop ==='function')
      {
         vessel.feature.stop();
      }
      featureLayer.removeLayer(vessel.feature);
    }
  }

	return {
		init: init,
		getMap: getMap,
    getZoom: getZoom,
    addToMap: addToMap,
    removeFeatures: removeFeatures
	}
}();

	