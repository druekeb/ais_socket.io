var LM = function(){

	var map, featureLayer, tileLayer, zoom, socket, boundsTimeout, boundsTimeoutTimer;
	
  function init(divName, options){
     map =  L.map(divName,options.mapOptions);
     map.setView(options.center, options.zoom);
    if (options.tileLayer )
    {
      addOSMLayerToMap();
    }
    if (options.featureLayer)
    {
      featureLayer = L.layerGroup().addTo(map);
    }
    if (options.mousePositionControl)
    {
      L.control.mousePosition().addTo(map);
    }
    if (options.onClick != undefined)
    {
      map.on('click', removePopups);
    }
    if (options.onMoveend)
    {
      socket = options.onMoveend;
      map.on('moveend', changeRegistration);
    }
     if (options.boundsTimeout)
    {
      boundsTimeout = options.boundsTimeout *1000;
    }
    changeRegistration();
  }

  function addOSMLayerToMap(){
      var osmAttribution = 'Map-Data <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-By-SA</a> by <a href="http://openstreetmap.org/">OpenStreetMap</a> contributors';
      var osmUrl = 'http://{s}.tiles.vesseltracker.com/vesseltracker/{z}/{x}/{y}.png';
      var osmLayer =  new L.tileLayer(osmUrl, {attribution: osmAttribution});
      osmLayer.addTo(map);
  }

  function changeRegistration(){
      var zoom = map.getZoom();
      socket.emit('unregister');
      console.debug("zoomLevel="+map.getZoom());
      var bounds = map.getBounds();
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

  function addToMap(feature){
    // if (vessel.polygon != undefined)
    // {
    // featureLayer.addLayer(feature);
    
    // }
    // if (vessel.vector != undefined)
    // {
    //   featureLayer.addLayer(vessel.vector);
    // }
    // if (vessel.feature != undefined)
    // {
      /* eventHandlers for mouseEvents on vessel.feature (circle oder triangle) */
    if(feature.options.popupContent){ 
      function onMouseover(e) {
        var popupOptions, latlng;
        if(e.latlng)
        {
          popupOptions = {closeButton:false ,autoPan:false , maxWidth: 180, offset:new L.Point(100,120)};
          latlng = e.latlng;            
        }
        else
        {
          popupOptions = {closeButton:false ,autoPan:false , maxWidth: 180, offset:new L.Point(100,120)};
          latlng = e.target._latlng;
        }
        L.popup(popupOptions).setLatLng(latlng).setContent(feature.options.popupContent).openOn(map);
      } 

      function onMouseout(e) {
        LM.getMap().closePopup();
      }      
      feature.on('mouseover',onMouseover);
      feature.on('mouseout', onMouseout);
    }
    featureLayer.addLayer(feature);
    if (typeof feature.start === 'function')
    {
      feature.start();
    }
  }

  function removePopups(){
      $('.mouseOverPopup').parentsUntil(".leaflet-popup-pane").remove();
      $('.mouseOverPopup').remove();
      $('.clickPopup').parentsUntil(".leaflet-popup-pane").remove();
      $('.clickPopup').remove();
  }
	
  function clearFeature(vessel){
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
    clearFeature: clearFeature
	}
}();

	