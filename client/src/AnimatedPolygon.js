/*
* L.AnimatedPolygon is used */

L.AnimatedPolygon = L.Polygon.extend({
  options: {
    // meters
     distance: 3,
    // ms
     interval: 50,
    // animate on add?
    autoStart: false,
    // callback onend
    onEnd: function(){},
    clickable: true,
    //zoom:14
    animation: true
  },

  initialize  : function (latlngs, options) {
    //TODO: find a way to use CSS3 animation for polygons as for markers
    if (false) {
      // No need to check up the line if we can animate using CSS3
      this._points = latlngs;
    } else {
      // Chunk up the lines into options.distance bits
      this._points = this._chunk(latlngs);
      //this.options.distance = 10;
      //this.options.interval = 30;
    }

    var initialPolygon;
    if (options.zoom)
    {
      initialPolygon = createTriangle(latlngs[0],options);
    }
    else  initialPolygon = createShipPoints(latlngs[0],options);
    L.Polygon.prototype.initialize.call(this,initialPolygon, options);
  },

  // Breaks the line up into tiny chunks (see options) ONLY if CSS3 animations
  // are not supported.
  _chunk: function(latlngs) {
    //console.debug("this.options.distance: "+this.options.distance);
    var i,
        len = latlngs.length,
        chunkedLatLngs = [];

    for (i=1;i<len;i++) {
      var cur = latlngs[i-1],
          next = latlngs[i],
          dist = cur.distanceTo(next),
          factor = this.options.distance / dist,
          dLat = factor * (next.lat - cur.lat),
          dLng = factor * (next.lng - cur.lng);

      if (dist > this.options.distance) {
        while (dist > this.options.distance) {
          cur = new L.LatLng(cur.lat + dLat, cur.lng + dLng);
          dist = cur.distanceTo(next);
          chunkedLatLngs.push(cur);
        }
      } else {
        chunkedLatLngs.push(cur);
      }
    }
    //console.debug("count chunkedLatLngs: "+chunkedLatLngs.length);
    return chunkedLatLngs;
  },

  onAdd: function (map) {
    L.Polygon.prototype.onAdd.call(this, map);

    // Start animating when added to the map
    if (this.options.autoStart) {
      this.start();
    }
  },

  animate: function() {
    if (!this.options.animation) return;
    var self = this,
        len = this._points.length,
        speed = this.options.interval;
        // console.debug("this.options.interval: "+this.options.interval);
        console.debug("this._points.length: ="+this._points.length);

    // Normalize the transition speed from vertex to vertex
    if (this._i < len) {
      speed = this._points[this._i-1].distanceTo(this._points[this._i]) / this.options.distance * this.options.interval;
    }
    //console.debug("Polygon speed = "+speed+ ", this.options.distance = "+this.options.distance+",this.options.interval "+this.options.interval);

    // Only if CSS3 transitions are supported
    if (L.DomUtil.TRANSITION) {
      if (this._container) { this._container.style[L.DomUtil.TRANSITION] = ('all ' + speed + 'ms linear'); }
      if (this._shadow) { this._shadow.style[L.DomUtil.TRANSITION] = 'all ' + speed + 'ms linear'; }
    }

    // Move to the next vertex
    if (this.options.zoom)
    {
      this.setLatLngs(createTriangle(this._points[this._i-1], this.options));
    }
    else
    {
      this.setLatLngs(createShipPoints(this._points[this._i-1], this.options));
    }
    this._i++;
    // Queue up the animation to the next vertex
    this._tid = setTimeout(function(){
      if (self._i === len) 
      {
        self.options.onEnd.apply(self, Array.prototype.slice.call(arguments));
      }
      else
      {
         self.animate();
      }
    }, speed);
  },

  // Start the animation
  start: function() {
    if (!this._i) {
      this._i = 1;
    }
     this.animate();
  },

  // Stop the animation in place
  stop: function() {
    if (this._tid) {
      clearTimeout(this._tid);
    }
  }
});

L.animatedPolygon = function (latlngs, options) {
  return new L.AnimatedPolygon(latlngs, options);
};

const METERS_PER_DEGREE = 111120;

function createTriangle(pos, options){
  var lon = pos.lng;
  var lat = pos.lat;
  var shippoints = [];
  var frontPoint = calcPoint(lon,lat, 0, 15,options.brng, options.zoom); 
  shippoints.push(frontPoint);
  var leftPoint = calcPoint(lon,lat, -5,-5,options.brng, options.zoom);
  shippoints.push(leftPoint);
  var rightPoint = calcPoint(lon,lat, 5,-5,options.brng, options.zoom);
  shippoints.push(rightPoint);
  return shippoints;
}

function createShipPoints(pos, options) {
    //benötigte Daten
    //1. die Abmessungen
    var lon = pos.lng;
    var lat = pos.lat;
    var left = options.dim_starboard;
    var front = options.dim_bow;
    var len = (options.dim_bow + options.dim_stern);
    var wid = (options.dim_port +options.dim_starboard);
    //ermittle aud den Daten die 5 Punkte des Polygons
    var shippoints = [];
    //front left
    var dx = -left;
    var dy = front-(len/10.0);  
    shippoints.push(calcPoint(lon,lat, dx, dy,options.brng));
    //rear left
    dx = -left;
    dy = -(len-front);
    shippoints.push(calcPoint(lon,lat, dx,dy,options.brng));
    //rear right
    dx =  wid - left;
    dy = -(len-front);
    shippoints.push(calcPoint(lon,lat, dx,dy,options.brng));
    //front right
    dx = wid - left;
    dy = front-(len/10.0);
    shippoints.push(calcPoint(lon,lat,dx,dy,options.brng));  
    //front center
    dx = wid/2.0-left;
    dy = front;
    shippoints.push(calcPoint(lon,lat,dx,dy,options.brng));
    return shippoints;
  }
   

  function calcPoint(lon, lat, dx, dy, brng, zoom){
    var divisor;
    if(zoom)
    {
      zoom = (zoom < 13?(zoom + 1):zoom);
      var divisor = Math.pow(2,zoom);
    }
    else
    {
      divisor = METERS_PER_DEGREE;
    }  
    var dy_deg = -(dx*Math.sin(brng) + dy*Math.cos(brng))/divisor;
    var dx_deg = -((dx*Math.cos(brng) - dy*Math.sin(brng))/divisor)/Math.cos(lat * (Math.PI /180.0));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
  }
