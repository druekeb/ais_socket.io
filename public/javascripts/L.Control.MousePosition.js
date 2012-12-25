L.Control.MousePosition = L.Control.extend({

        options: {
          position: 'topright',
          separator: ' ',
          emptyString: '',
          lngFirst: false,
          numDigits: 5,
          lngFormatter: formatLon,
          latFormatter: formatLat
        },

        onAdd: function (map) {
          this._container = L.DomUtil.create('div', 'leaflet-control-mouseposition');
          L.DomEvent.disableClickPropagation(this._container);
          map.on('mousemove', this._onMouseMove, this);
          this._container.innerHTML=this.options.emptyString;
          return this._container;
        },

        onRemove: function (map) {
          map.off('mousemove', this._onMouseMove)
        },

        _onMouseMove: function (e) {
          var lng = L.Util.formatNum(e.latlng.lng, this.options.numDigits);
          var lat = L.Util.formatNum(e.latlng.lat, this.options.numDigits);
          if (this.options.lngFormatter) lng = this.options.lngFormatter(lng);
          if (this.options.latFormatter) lat = this.options.latFormatter(lat);
          var value = this.options.lngFirst ? lng + this.options.separator + lat : lat + this.options.separator + lng;
          this._container.innerHTML = value;
        }

      });

      L.control.mousePosition = function (options) {
        return new L.Control.MousePosition(options);
      };

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
