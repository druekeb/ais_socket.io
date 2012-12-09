/*
* L.AnimatedPolygon is used to display animated polygons on the map.
*/

L.AnimatedPolygon = L.Polygon.extend({
  options: {
    zoom: 12,
    angle:0,
    sog:20,
    distance: 200,    // [m]
    interval: 1000,   //[ms]
    autoStart: true,  //animate onAdd
    onEnd: function(){},
    clickable: true   // callback onend
  },

  initialize: function (shipPoints, options) {
     if (L.DomUtil.TRANSITION) {
     // No need to  chunk up the line if we can animate using CSS3
       this.vectorPoints = [];
       this.vectorPoints[0] = this.calcVector(shipPoints[0].lng, shipPoints[0].lat, this.options.sog, Math.sin(this.options.angle), Math.cos(this.options.angle));
    // } else {
    //   // Chunk up the lines into options.distance bits
    //   this._latlngs = this._chunk(latlngs);
    //   this.options.distance = 10;
    //   this.options.interval = 30;
    // }

    L.Polygon.prototype.initialize.call(this, shipPoints, options);
  }
},
calcVector: function (lon, lat, sog, sin, cos){
    var dy_deg = -(sog * cos)/Math.pow(1.98 ,this.options.zoom);
    var dx_deg = -(- sog * sin)/(Math.cos((lat)*(Math.PI/180.0))*Math.pow(1.98,this.options.zoom));
    return new L.LatLng(lat - dy_deg, lon - dx_deg);
    }
  

  // // Breaks the line up into tiny chunks (see options) ONLY if CSS3 animations
  // // are not supported.
  // _chunk: function(latlngs) {
  //   var i,
  //       len = latlngs.length,
  //       chunkedLatLngs = [];

  //   for (i=1;i<len;i++) {
  //     var cur = latlngs[i-1],
  //         next = latlngs[i],
  //         dist = cur.distanceTo(next),
  //         factor = this.options.distance / dist,
  //         dLat = factor * (next.lat - cur.lat),
  //         dLng = factor * (next.lng - cur.lng);

  //     if (dist > this.options.distance) {
  //       while (dist > this.options.distance) {
  //         cur = new L.LatLng(cur.lat + dLat, cur.lng + dLng);
  //         dist = cur.distanceTo(next);
  //         chunkedLatLngs.push(cur);
  //       }
  //     } else {
  //       chunkedLatLngs.push(cur);
  //     }
  //   }

  //   return chunkedLatLngs;
  // },

  // onAdd: function (map) {
  //   L.Marker.prototype.onAdd.call(this, map);

  //   // Start animating when added to the map
  //   if (this.options.autoStart) {
  //     this.start();
  //   }
  // },

  // animate: function() {
  //   var self = this,
  //       len = this._latlngs.length,
  //       speed = this.options.interval;

  //   // Normalize the transition speed from vertex to vertex
  //   if (this._i < len) {
  //     speed = this._latlngs[this._i-1].distanceTo(this._latlngs[this._i]) / this.options.distance * this.options.interval;
  //   }

  //   // Only if CSS3 transitions are supported
  //   if (L.DomUtil.TRANSITION) {
  //     if (this._icon) { this._icon.style[L.DomUtil.TRANSITION] = ('all ' + speed + 'ms linear'); }
  //     if (this._shadow) { this._shadow.style[L.DomUtil.TRANSITION] = 'all ' + speed + 'ms linear'; }
  //   }

  //   // Move to the next vertex
  //   this.setLatLng(this._latlngs[this._i]);
  //   this._i++;

  //   // Queue up the animation ot the next next vertex
  //   this._tid = setTimeout(function(){
  //     if (self._i === len) {
  //       self.options.onEnd.apply(self, Array.prototype.slice.call(arguments));
  //     } else {
  //       self.animate();
  //     }
  //   }, speed);
  // },

  // // Start the animation
  // start: function() {
  //   if (!this._i) {
  //     this._i = 1;
  //   }

  //   this.animate();
  // },

  // // Stop the animation in place
  // stop: function() {
  //   if (this._tid) {
  //     clearTimeout(this._tid);
  //   }
  // }
});

L.animatedPolygon = function (shipPoints, options) {
  return new L.AnimatedPolygon(shipPoints, options);
};