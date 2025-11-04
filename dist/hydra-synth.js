(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hydra = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],3:[function(require,module,exports){
!function(r,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(r="undefined"!=typeof globalThis?globalThis:r||self).Meyda=t()}(this,(function(){"use strict";function r(r,t,e){if(e||2===arguments.length)for(var a,n=0,o=t.length;n<o;n++)!a&&n in t||(a||(a=Array.prototype.slice.call(t,0,n)),a[n]=t[n]);return r.concat(a||Array.prototype.slice.call(t))}var t=Object.freeze({__proto__:null,blackman:function(r){for(var t=new Float32Array(r),e=2*Math.PI/(r-1),a=2*e,n=0;n<r/2;n++)t[n]=.42-.5*Math.cos(n*e)+.08*Math.cos(n*a);for(n=Math.ceil(r/2);n>0;n--)t[r-n]=t[n-1];return t},hamming:function(r){for(var t=new Float32Array(r),e=0;e<r;e++)t[e]=.54-.46*Math.cos(2*Math.PI*(e/r-1));return t},hanning:function(r){for(var t=new Float32Array(r),e=0;e<r;e++)t[e]=.5-.5*Math.cos(2*Math.PI*e/(r-1));return t},sine:function(r){for(var t=Math.PI/(r-1),e=new Float32Array(r),a=0;a<r;a++)e[a]=Math.sin(t*a);return e}}),e={};function a(r){for(;r%2==0&&r>1;)r/=2;return 1===r}function n(r,a){if("rect"!==a){if(""!==a&&a||(a="hanning"),e[a]||(e[a]={}),!e[a][r.length])try{e[a][r.length]=t[a](r.length)}catch(r){throw new Error("Invalid windowing function")}r=function(r,t){for(var e=[],a=0;a<Math.min(r.length,t.length);a++)e[a]=r[a]*t[a];return e}(r,e[a][r.length])}return r}function o(r,t,e){for(var a=new Float32Array(r),n=0;n<a.length;n++)a[n]=n*t/e,a[n]=13*Math.atan(a[n]/1315.8)+3.5*Math.atan(Math.pow(a[n]/7518,2));return a}function i(r){return Float32Array.from(r)}function u(r){return 1125*Math.log(1+r/700)}function f(r,t,e){for(var a,n=new Float32Array(r+2),o=new Float32Array(r+2),i=t/2,f=u(0),c=(u(i)-f)/(r+1),l=new Array(r+2),s=0;s<n.length;s++)n[s]=s*c,o[s]=(a=n[s],700*(Math.exp(a/1125)-1)),l[s]=Math.floor((e+1)*o[s]/t);for(var m=new Array(r),p=0;p<m.length;p++){m[p]=new Array(e/2+1).fill(0);for(s=l[p];s<l[p+1];s++)m[p][s]=(s-l[p])/(l[p+1]-l[p]);for(s=l[p+1];s<l[p+2];s++)m[p][s]=(l[p+2]-s)/(l[p+2]-l[p+1])}return m}function c(t,e,a,n,o,i,u){void 0===n&&(n=5),void 0===o&&(o=2),void 0===i&&(i=!0),void 0===u&&(u=440);var f=Math.floor(a/2)+1,c=new Array(a).fill(0).map((function(r,n){return t*function(r,t){return Math.log2(16*r/t)}(e*n/a,u)}));c[0]=c[1]-1.5*t;var l,s,m,p=c.slice(1).map((function(r,t){return Math.max(r-c[t])}),1).concat([1]),h=Math.round(t/2),g=new Array(t).fill(0).map((function(r,e){return c.map((function(r){return(10*t+h+r-e)%t-h}))})),w=g.map((function(r,t){return r.map((function(r,e){return Math.exp(-.5*Math.pow(2*g[t][e]/p[e],2))}))}));if(s=(l=w)[0].map((function(){return 0})),m=l.reduce((function(r,t){return t.forEach((function(t,e){r[e]+=Math.pow(t,2)})),r}),s).map(Math.sqrt),w=l.map((function(r,t){return r.map((function(r,t){return r/(m[t]||1)}))})),o){var v=c.map((function(r){return Math.exp(-.5*Math.pow((r/t-n)/o,2))}));w=w.map((function(r){return r.map((function(r,t){return r*v[t]}))}))}return i&&(w=r(r([],w.slice(3),!0),w.slice(0,3),!0)),w.map((function(r){return r.slice(0,f)}))}function l(r,t){for(var e=0,a=0,n=0;n<t.length;n++)e+=Math.pow(n,r)*Math.abs(t[n]),a+=t[n];return e/a}function s(r){var t=r.ampSpectrum,e=r.barkScale,a=r.numberOfBarkBands,n=void 0===a?24:a;if("object"!=typeof t||"object"!=typeof e)throw new TypeError;var o=n,i=new Float32Array(o),u=0,f=t,c=new Int32Array(o+1);c[0]=0;for(var l=e[f.length-1]/o,s=1,m=0;m<f.length;m++)for(;e[m]>l;)c[s++]=m,l=s*e[f.length-1]/o;c[o]=f.length-1;for(m=0;m<o;m++){for(var p=0,h=c[m];h<c[m+1];h++)p+=f[h];i[m]=Math.pow(p,.23)}for(m=0;m<i.length;m++)u+=i[m];return{specific:i,total:u}}function m(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;for(var e=new Float32Array(t.length),a=0;a<e.length;a++)e[a]=Math.pow(t[a],2);return e}function p(r){var t=r.ampSpectrum,e=r.melFilterBank,a=r.bufferSize;if("object"!=typeof t)throw new TypeError("Valid ampSpectrum is required to generate melBands");if("object"!=typeof e)throw new TypeError("Valid melFilterBank is required to generate melBands");for(var n=m({ampSpectrum:t}),o=e.length,i=Array(o),u=new Float32Array(o),f=0;f<u.length;f++){i[f]=new Float32Array(a/2),u[f]=0;for(var c=0;c<a/2;c++)i[f][c]=e[f][c]*n[c],u[f]+=i[f][c];u[f]=Math.log(u[f]+1)}return Array.prototype.slice.call(u)}function h(r){return r&&r.__esModule&&Object.prototype.hasOwnProperty.call(r,"default")?r.default:r}var g=null;var w=h((function(r,t){var e=r.length;return t=t||2,g&&g[e]||function(r){(g=g||{})[r]=new Array(r*r);for(var t=Math.PI/r,e=0;e<r;e++)for(var a=0;a<r;a++)g[r][a+e*r]=Math.cos(t*(a+.5)*e)}(e),r.map((function(){return 0})).map((function(a,n){return t*r.reduce((function(r,t,a,o){return r+t*g[e][a+n*e]}),0)}))}));var v=Object.freeze({__proto__:null,amplitudeSpectrum:function(r){return r.ampSpectrum},buffer:function(r){return r.signal},chroma:function(r){var t=r.ampSpectrum,e=r.chromaFilterBank;if("object"!=typeof t)throw new TypeError("Valid ampSpectrum is required to generate chroma");if("object"!=typeof e)throw new TypeError("Valid chromaFilterBank is required to generate chroma");var a=e.map((function(r,e){return t.reduce((function(t,e,a){return t+e*r[a]}),0)})),n=Math.max.apply(Math,a);return n?a.map((function(r){return r/n})):a},complexSpectrum:function(r){return r.complexSpectrum},energy:function(r){var t=r.signal;if("object"!=typeof t)throw new TypeError;for(var e=0,a=0;a<t.length;a++)e+=Math.pow(Math.abs(t[a]),2);return e},loudness:s,melBands:p,mfcc:function(r){var t=r.ampSpectrum,e=r.melFilterBank,a=r.numberOfMFCCCoefficients,n=r.bufferSize,o=Math.min(40,Math.max(1,a||13));if(e.length<o)throw new Error("Insufficient filter bank for requested number of coefficients");var i=p({ampSpectrum:t,melFilterBank:e,bufferSize:n});return w(i).slice(0,o)},perceptualSharpness:function(r){for(var t=s({ampSpectrum:r.ampSpectrum,barkScale:r.barkScale}),e=t.specific,a=0,n=0;n<e.length;n++)a+=n<15?(n+1)*e[n+1]:.066*Math.exp(.171*(n+1));return a*=.11/t.total},perceptualSpread:function(r){for(var t=s({ampSpectrum:r.ampSpectrum,barkScale:r.barkScale}),e=0,a=0;a<t.specific.length;a++)t.specific[a]>e&&(e=t.specific[a]);return Math.pow((t.total-e)/t.total,2)},powerSpectrum:m,rms:function(r){var t=r.signal;if("object"!=typeof t)throw new TypeError;for(var e=0,a=0;a<t.length;a++)e+=Math.pow(t[a],2);return e/=t.length,e=Math.sqrt(e)},spectralCentroid:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;return l(1,t)},spectralCrest:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;var e=0,a=-1/0;return t.forEach((function(r){e+=Math.pow(r,2),a=r>a?r:a})),e/=t.length,e=Math.sqrt(e),a/e},spectralFlatness:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;for(var e=0,a=0,n=0;n<t.length;n++)e+=Math.log(t[n]),a+=t[n];return Math.exp(e/t.length)*t.length/a},spectralFlux:function(r){var t=r.signal,e=r.previousSignal,a=r.bufferSize;if("object"!=typeof t||"object"!=typeof e)throw new TypeError;for(var n=0,o=-a/2;o<t.length/2-1;o++)x=Math.abs(t[o])-Math.abs(e[o]),n+=(x+Math.abs(x))/2;return n},spectralKurtosis:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;var e=t,a=l(1,e),n=l(2,e),o=l(3,e),i=l(4,e);return(-3*Math.pow(a,4)+6*a*n-4*a*o+i)/Math.pow(Math.sqrt(n-Math.pow(a,2)),4)},spectralRolloff:function(r){var t=r.ampSpectrum,e=r.sampleRate;if("object"!=typeof t)throw new TypeError;for(var a=t,n=e/(2*(a.length-1)),o=0,i=0;i<a.length;i++)o+=a[i];for(var u=.99*o,f=a.length-1;o>u&&f>=0;)o-=a[f],--f;return(f+1)*n},spectralSkewness:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;var e=l(1,t),a=l(2,t),n=l(3,t);return(2*Math.pow(e,3)-3*e*a+n)/Math.pow(Math.sqrt(a-Math.pow(e,2)),3)},spectralSlope:function(r){var t=r.ampSpectrum,e=r.sampleRate,a=r.bufferSize;if("object"!=typeof t)throw new TypeError;for(var n=0,o=0,i=new Float32Array(t.length),u=0,f=0,c=0;c<t.length;c++){n+=t[c];var l=c*e/a;i[c]=l,u+=l*l,o+=l,f+=l*t[c]}return(t.length*f-o*n)/(n*(u-Math.pow(o,2)))},spectralSpread:function(r){var t=r.ampSpectrum;if("object"!=typeof t)throw new TypeError;return Math.sqrt(l(2,t)-Math.pow(l(1,t),2))},zcr:function(r){var t=r.signal;if("object"!=typeof t)throw new TypeError;for(var e=0,a=1;a<t.length;a++)(t[a-1]>=0&&t[a]<0||t[a-1]<0&&t[a]>=0)&&e++;return e}});function d(r){if(Array.isArray(r)){for(var t=0,e=Array(r.length);t<r.length;t++)e[t]=r[t];return e}return Array.from(r)}var y={},S={},_={bitReverseArray:function(r){if(void 0===y[r]){for(var t=(r-1).toString(2).length,e="0".repeat(t),a={},n=0;n<r;n++){var o=n.toString(2);o=e.substr(o.length)+o,o=[].concat(d(o)).reverse().join(""),a[n]=parseInt(o,2)}y[r]=a}return y[r]},multiply:function(r,t){return{real:r.real*t.real-r.imag*t.imag,imag:r.real*t.imag+r.imag*t.real}},add:function(r,t){return{real:r.real+t.real,imag:r.imag+t.imag}},subtract:function(r,t){return{real:r.real-t.real,imag:r.imag-t.imag}},euler:function(r,t){var e=-2*Math.PI*r/t;return{real:Math.cos(e),imag:Math.sin(e)}},conj:function(r){return r.imag*=-1,r},constructComplexArray:function(r){var t={};t.real=void 0===r.real?r.slice():r.real.slice();var e=t.real.length;return void 0===S[e]&&(S[e]=Array.apply(null,Array(e)).map(Number.prototype.valueOf,0)),t.imag=S[e].slice(),t}},b=function(r){var t={};void 0===r.real||void 0===r.imag?t=_.constructComplexArray(r):(t.real=r.real.slice(),t.imag=r.imag.slice());var e=t.real.length,a=Math.log2(e);if(Math.round(a)!=a)throw new Error("Input size must be a power of 2.");if(t.real.length!=t.imag.length)throw new Error("Real and imaginary components must have the same length.");for(var n=_.bitReverseArray(e),o={real:[],imag:[]},i=0;i<e;i++)o.real[n[i]]=t.real[i],o.imag[n[i]]=t.imag[i];for(var u=0;u<e;u++)t.real[u]=o.real[u],t.imag[u]=o.imag[u];for(var f=1;f<=a;f++)for(var c=Math.pow(2,f),l=0;l<c/2;l++)for(var s=_.euler(l,c),m=0;m<e/c;m++){var p=c*m+l,h=c*m+l+c/2,g={real:t.real[p],imag:t.imag[p]},w={real:t.real[h],imag:t.imag[h]},v=_.multiply(s,w),d=_.subtract(g,v);t.real[h]=d.real,t.imag[h]=d.imag;var y=_.add(v,g);t.real[p]=y.real,t.imag[p]=y.imag}return t},M=b,F=function(){function r(r,t){var e=this;if(this._m=t,!r.audioContext)throw this._m.errors.noAC;if(r.bufferSize&&!a(r.bufferSize))throw this._m._errors.notPow2;if(!r.source)throw this._m._errors.noSource;this._m.audioContext=r.audioContext,this._m.bufferSize=r.bufferSize||this._m.bufferSize||256,this._m.hopSize=r.hopSize||this._m.hopSize||this._m.bufferSize,this._m.sampleRate=r.sampleRate||this._m.audioContext.sampleRate||44100,this._m.callback=r.callback,this._m.windowingFunction=r.windowingFunction||"hanning",this._m.featureExtractors=v,this._m.EXTRACTION_STARTED=r.startImmediately||!1,this._m.channel="number"==typeof r.channel?r.channel:0,this._m.inputs=r.inputs||1,this._m.outputs=r.outputs||1,this._m.numberOfMFCCCoefficients=r.numberOfMFCCCoefficients||this._m.numberOfMFCCCoefficients||13,this._m.numberOfBarkBands=r.numberOfBarkBands||this._m.numberOfBarkBands||24,this._m.spn=this._m.audioContext.createScriptProcessor(this._m.bufferSize,this._m.inputs,this._m.outputs),this._m.spn.connect(this._m.audioContext.destination),this._m._featuresToExtract=r.featureExtractors||[],this._m.barkScale=o(this._m.bufferSize,this._m.sampleRate,this._m.bufferSize),this._m.melFilterBank=f(Math.max(this._m.melBands,this._m.numberOfMFCCCoefficients),this._m.sampleRate,this._m.bufferSize),this._m.inputData=null,this._m.previousInputData=null,this._m.frame=null,this._m.previousFrame=null,this.setSource(r.source),this._m.spn.onaudioprocess=function(r){var t;null!==e._m.inputData&&(e._m.previousInputData=e._m.inputData),e._m.inputData=r.inputBuffer.getChannelData(e._m.channel),e._m.previousInputData?((t=new Float32Array(e._m.previousInputData.length+e._m.inputData.length-e._m.hopSize)).set(e._m.previousInputData.slice(e._m.hopSize)),t.set(e._m.inputData,e._m.previousInputData.length-e._m.hopSize)):t=e._m.inputData;var a=function(r,t,e){if(r.length<t)throw new Error("Buffer is too short for frame length");if(e<1)throw new Error("Hop length cannot be less that 1");if(t<1)throw new Error("Frame length cannot be less that 1");var a=1+Math.floor((r.length-t)/e);return new Array(a).fill(0).map((function(a,n){return r.slice(n*e,n*e+t)}))}(t,e._m.bufferSize,e._m.hopSize);a.forEach((function(r){e._m.frame=r;var t=e._m.extract(e._m._featuresToExtract,e._m.frame,e._m.previousFrame);"function"==typeof e._m.callback&&e._m.EXTRACTION_STARTED&&e._m.callback(t),e._m.previousFrame=e._m.frame}))}}return r.prototype.start=function(r){this._m._featuresToExtract=r||this._m._featuresToExtract,this._m.EXTRACTION_STARTED=!0},r.prototype.stop=function(){this._m.EXTRACTION_STARTED=!1},r.prototype.setSource=function(r){this._m.source&&this._m.source.disconnect(this._m.spn),this._m.source=r,this._m.source.connect(this._m.spn)},r.prototype.setChannel=function(r){r<=this._m.inputs?this._m.channel=r:console.error("Channel ".concat(r," does not exist. Make sure you've provided a value for 'inputs' that is greater than ").concat(r," when instantiating the MeydaAnalyzer"))},r.prototype.get=function(r){return this._m.inputData?this._m.extract(r||this._m._featuresToExtract,this._m.inputData,this._m.previousInputData):null},r}(),A={audioContext:null,spn:null,bufferSize:512,sampleRate:44100,melBands:26,chromaBands:12,callback:null,windowingFunction:"hanning",featureExtractors:v,EXTRACTION_STARTED:!1,numberOfMFCCCoefficients:13,numberOfBarkBands:24,_featuresToExtract:[],windowing:n,_errors:{notPow2:new Error("Meyda: Buffer size must be a power of 2, e.g. 64 or 512"),featureUndef:new Error("Meyda: No features defined."),invalidFeatureFmt:new Error("Meyda: Invalid feature format"),invalidInput:new Error("Meyda: Invalid input."),noAC:new Error("Meyda: No AudioContext specified."),noSource:new Error("Meyda: No source node specified.")},createMeydaAnalyzer:function(r){return new F(r,Object.assign({},A))},listAvailableFeatureExtractors:function(){return Object.keys(this.featureExtractors)},extract:function(r,t,e){var n=this;if(!t)throw this._errors.invalidInput;if("object"!=typeof t)throw this._errors.invalidInput;if(!r)throw this._errors.featureUndef;if(!a(t.length))throw this._errors.notPow2;void 0!==this.barkScale&&this.barkScale.length==this.bufferSize||(this.barkScale=o(this.bufferSize,this.sampleRate,this.bufferSize)),void 0!==this.melFilterBank&&this.barkScale.length==this.bufferSize&&this.melFilterBank.length==this.melBands||(this.melFilterBank=f(Math.max(this.melBands,this.numberOfMFCCCoefficients),this.sampleRate,this.bufferSize)),void 0!==this.chromaFilterBank&&this.chromaFilterBank.length==this.chromaBands||(this.chromaFilterBank=c(this.chromaBands,this.sampleRate,this.bufferSize)),"buffer"in t&&void 0===t.buffer?this.signal=i(t):this.signal=t;var u=E(t,this.windowingFunction,this.bufferSize);if(this.signal=u.windowedSignal,this.complexSpectrum=u.complexSpectrum,this.ampSpectrum=u.ampSpectrum,e){var l=E(e,this.windowingFunction,this.bufferSize);this.previousSignal=l.windowedSignal,this.previousComplexSpectrum=l.complexSpectrum,this.previousAmpSpectrum=l.ampSpectrum}var s=function(r){return n.featureExtractors[r]({ampSpectrum:n.ampSpectrum,chromaFilterBank:n.chromaFilterBank,complexSpectrum:n.complexSpectrum,signal:n.signal,bufferSize:n.bufferSize,sampleRate:n.sampleRate,barkScale:n.barkScale,melFilterBank:n.melFilterBank,previousSignal:n.previousSignal,previousAmpSpectrum:n.previousAmpSpectrum,previousComplexSpectrum:n.previousComplexSpectrum,numberOfMFCCCoefficients:n.numberOfMFCCCoefficients,numberOfBarkBands:n.numberOfBarkBands})};if("object"==typeof r)return r.reduce((function(r,t){var e;return Object.assign({},r,((e={})[t]=s(t),e))}),{});if("string"==typeof r)return s(r);throw this._errors.invalidFeatureFmt}},E=function(r,t,e){var a={};void 0===r.buffer?a.signal=i(r):a.signal=r,a.windowedSignal=n(a.signal,t),a.complexSpectrum=M(a.windowedSignal),a.ampSpectrum=new Float32Array(e/2);for(var o=0;o<e/2;o++)a.ampSpectrum[o]=Math.sqrt(Math.pow(a.complexSpectrum.real[o],2)+Math.pow(a.complexSpectrum.imag[o],2));return a};return"undefined"!=typeof window&&(window.Meyda=A),A}));


},{}],4:[function(require,module,exports){
(function (process){(function (){
// Generated by CoffeeScript 1.12.2
(function() {
  var getNanoSeconds, hrtime, loadTime, moduleLoadTime, nodeLoadTime, upTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - nodeLoadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    moduleLoadTime = getNanoSeconds();
    upTime = process.uptime() * 1e9;
    nodeLoadTime = moduleLoadTime - upTime;
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);



}).call(this)}).call(this,require('_process'))
},{"_process":5}],5:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var now = require('right-now')
var raf = require('raf')

module.exports = Engine
function Engine(fn) {
    if (!(this instanceof Engine)) 
        return new Engine(fn)
    this.running = false
    this.last = now()
    this._frame = 0
    this._tick = this.tick.bind(this)

    if (fn)
        this.on('tick', fn)
}

inherits(Engine, EventEmitter)

Engine.prototype.start = function() {
    if (this.running) 
        return
    this.running = true
    this.last = now()
    this._frame = raf(this._tick)
    return this
}

Engine.prototype.stop = function() {
    this.running = false
    if (this._frame !== 0)
        raf.cancel(this._frame)
    this._frame = 0
    return this
}

Engine.prototype.tick = function() {
    this._frame = raf(this._tick)
    var time = now()
    var dt = time - this.last
    this.emit('tick', dt)
    this.last = time
}
},{"events":1,"inherits":2,"raf":7,"right-now":8}],7:[function(require,module,exports){
(function (global){(function (){
var now = require('performance-now')
  , root = typeof window === 'undefined' ? global : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = root['request' + suffix]
  , caf = root['cancel' + suffix] || root['cancelRequest' + suffix]

for(var i = 0; !raf && i < vendors.length; i++) {
  raf = root[vendors[i] + 'Request' + suffix]
  caf = root[vendors[i] + 'Cancel' + suffix]
      || root[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.call(root, fn)
}
module.exports.cancel = function() {
  caf.apply(root, arguments)
}
module.exports.polyfill = function(object) {
  if (!object) {
    object = root;
  }
  object.requestAnimationFrame = raf
  object.cancelAnimationFrame = caf
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"performance-now":4}],8:[function(require,module,exports){
(function (global){(function (){
module.exports =
  global.performance &&
  global.performance.now ? function now() {
    return performance.now()
  } : Date.now || function now() {
    return +new Date
  }

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _sandbox = _interopRequireDefault(require("./lib/sandbox.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// handles code evaluation and attaching relevant objects to global and evaluation contexts

class EvalSandbox {
  constructor(parent, makeGlobal, userProps = []) {
    this.makeGlobal = makeGlobal;
    this.sandbox = (0, _sandbox.default)(parent);
    this.parent = parent;
    var properties = Object.keys(parent);
    properties.forEach(property => this.add(property));
    this.userProps = userProps;
  }
  add(name) {
    if (this.makeGlobal) window[name] = this.parent[name];
    // this.sandbox.addToContext(name, `parent.${name}`)
  }

  // sets on window as well as synth object if global (not needed for objects, which can be set directly)

  set(property, value) {
    if (this.makeGlobal) {
      window[property] = value;
    }
    this.parent[property] = value;
  }
  tick() {
    if (this.makeGlobal) {
      this.userProps.forEach(property => {
        this.parent[property] = window[property];
      });
      //  this.parent.speed = window.speed
    } else {}
  }
  eval(code) {
    this.sandbox.eval(code);
  }
}
var _default = exports.default = EvalSandbox;

},{"./lib/array-utils.js":19,"./lib/sandbox.js":24}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = formatArguments;
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// [WIP] how to treat different dimensions (?)
const DEFAULT_CONVERSIONS = {
  float: {
    'vec4': {
      name: 'sum',
      args: [[1, 1, 1, 1]]
    },
    'vec2': {
      name: 'sum',
      args: [[1, 1]]
    }
  }
};
function fillArrayWithDefaults(arr, len) {
  // fill the array with default values if it's too short
  while (arr.length < len) {
    if (arr.length === 3) {
      // push a 1 as the default for .a in vec4
      arr.push(1.0);
    } else {
      arr.push(0.0);
    }
  }
  return arr.slice(0, len);
}
const ensure_decimal_dot = val => {
  val = val.toString();
  if (val.indexOf('.') < 0) {
    val += '.';
  }
  return val;
};
function formatArguments(transform, startIndex, synthContext) {
  const defaultArgs = transform.transform.inputs;
  const userArgs = transform.userArgs;
  const {
    generators
  } = transform.synth;
  const {
    src
  } = generators; // depends on synth having src() function
  return defaultArgs.map((input, index) => {
    const typedArg = {
      value: input.default,
      type: input.type,
      //
      isUniform: false,
      name: input.name,
      vecLen: 0
      //  generateGlsl: null // function for creating glsl
    };
    if (typedArg.type === 'float') typedArg.value = ensure_decimal_dot(input.default);
    if (input.type.startsWith('vec')) {
      try {
        typedArg.vecLen = Number.parseInt(input.type.substr(3));
      } catch (e) {
        console.log(`Error determining length of vector input type ${input.type} (${input.name})`);
      }
    }

    // if user has input something for this argument
    if (userArgs.length > index) {
      typedArg.value = userArgs[index];
      if (typedArg.type === 'vec4') {
        if (!(typedArg.value.type === "GlslSource" || typedArg.value.getTexture)) {
          throw new Error("Arguments must be a texture or GlslSource");
        }
      }
      // do something if a composite or transform

      if (typeof userArgs[index] === 'function') {
        // if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
        //    typedArg.value = (context, props, batchId) => (fillArrayWithDefaults(userArgs[index](props), typedArg.vecLen))
        // } else {
        typedArg.value = (context, props, batchId) => {
          try {
            const val = userArgs[index](props);
            if (typeof val === 'number') {
              return val;
            } else {
              console.warn('function does not return a number', userArgs[index]);
            }
            return input.default;
          } catch (e) {
            console.warn('ERROR', e);
            return input.default;
          }
        };
        //  }

        typedArg.isUniform = true;
      } else if (userArgs[index].constructor === Array) {
        //   if (typedArg.vecLen > 0) { // expected input is a vector, not a scalar
        //     typedArg.isUniform = true
        //     typedArg.value = fillArrayWithDefaults(typedArg.value, typedArg.vecLen)
        //  } else {
        //  console.log("is Array")
        // filter out values that are not a number
        // const filteredArray = userArgs[index].filter((val) => typeof val === 'number')
        // typedArg.value = (context, props, batchId) => arrayUtils.getValue(filteredArray)(props)
        typedArg.value = (context, props, batchId) => _arrayUtils.default.getValue(userArgs[index])(props);
        typedArg.isUniform = true;
        // }
      }
    }
    if (startIndex < 0) {} else {
      if (typedArg.value && typedArg.value.transforms) {
        const final_transform = typedArg.value.transforms[typedArg.value.transforms.length - 1];
        if (final_transform.transform.glsl_return_type !== input.type) {
          const defaults = DEFAULT_CONVERSIONS[input.type];
          if (typeof defaults !== 'undefined') {
            const default_def = defaults[final_transform.transform.glsl_return_type];
            if (typeof default_def !== 'undefined') {
              const {
                name,
                args
              } = default_def;
              typedArg.value = typedArg.value[name](...args);
            }
          }
        }
        typedArg.isUniform = false;
      } else if (typedArg.type === 'float' && typeof typedArg.value === 'number') {
        typedArg.value = ensure_decimal_dot(typedArg.value);
      } else if (typedArg.type.startsWith('vec') && typeof typedArg.value === 'object' && Array.isArray(typedArg.value)) {
        typedArg.isUniform = false;
        typedArg.value = `${typedArg.type}(${typedArg.value.map(ensure_decimal_dot).join(', ')})`;
      } else if (input.type === 'sampler2D') {
        // typedArg.tex = typedArg.value
        var x = typedArg.value;
        typedArg.value = () => x.getTexture();
        typedArg.isUniform = true;
      } else {
        // if passing in a texture reference, when function asks for vec4, convert to vec4
        if (typedArg.value.getTexture && input.type === 'vec4') {
          var x1 = typedArg.value;
          typedArg.value = src(x1);
          typedArg.isUniform = false;
        }
      }

      // add tp uniform array if is a function that will pass in a different value on each render frame,
      // or a texture/ external source

      if (typedArg.isUniform) {
        typedArg.name += startIndex;
        //  shaderParams.uniforms.push(typedArg)
      }
    }
    return typedArg;
  });
}

},{"./lib/array-utils.js":19}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
var _formatArguments = _interopRequireDefault(require("./format-arguments.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Add extra functionality to Array.prototype for generating sequences in time

// converts a tree of javascript functions to a shader
function _default(transforms) {
  var shaderParams = {
    uniforms: [],
    // list of uniforms used in shader
    glslFunctions: [],
    // list of functions used in shader
    fragColor: ''
  };
  var gen = generateGlsl(transforms, shaderParams)('c', 'st');
  // console.log(gen)

  shaderParams.fragColor = gen;
  // remove uniforms with duplicate names
  let uniforms = {};
  shaderParams.uniforms.forEach(uniform => uniforms[uniform.name] = uniform);
  shaderParams.uniforms = Object.values(uniforms);
  return shaderParams;
}
function generateInputName(v, index) {
  return `${v}_i${index}`;
}
function generateGlsl(transforms, shaderParams) {
  var generator = (c, uv) => '';
  transforms.forEach((transform, i) => {
    // Accumulate uniforms to lazily add them to the output shader
    let inputs = (0, _formatArguments.default)(transform, shaderParams.uniforms.length);
    inputs.forEach(input => {
      if (input.isUniform) shaderParams.uniforms.push(input);
    });

    // Lazily generate glsl function definition
    if (!contains(transform, shaderParams.glslFunctions)) shaderParams.glslFunctions.push(transform);
    var prev = generator;
    if (transform.transform.type === 'src') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         vec4 ${c} = ${shaderString(`${c}${i}`, uv, transform.name, inputs)};`;
    } else if (transform.transform.type === 'color') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${prev(c, uv)}
         ${c} = ${shaderString(`${c}${i}`, `${c}`, transform.name, inputs)};`;
    } else if (transform.transform.type === 'coord') {
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${uv} = ${shaderString(`${c}${i}`, `${uv}`, transform.name, inputs)};
         ${prev(c, uv)}`;
    } else if (transform.transform.type === 'combine') {
      generator = (c, uv) =>
      // combining two generated shader strings (i.e. for blend, mult, add funtions)
      `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${prev(c, uv)}
         ${c} = ${shaderString(`${c}${i}`, `${c}`, transform.name, inputs)};`;
    } else if (transform.transform.type === 'combineCoord') {
      // combining two generated shader strings (i.e. for modulate functions)
      generator = (c, uv) => `${generateInputs(inputs, shaderParams)(`${c}${i}`, uv)}
         ${uv} = ${shaderString(`${c}${i}`, `${uv}`, transform.name, inputs)};
         ${prev(c, uv)}`;
    }
  });
  return generator;
}
function generateInputs(inputs, shaderParams) {
  let generator = (c, uv) => '';
  var prev = generator;
  inputs.forEach((input, i) => {
    if (input.value.transforms) {
      prev = generator;
      generator = (c, uv) => {
        let ci = generateInputName(c, i);
        let uvi = generateInputName(`${uv}_${c}`, i);
        return `vec2 ${uvi} = ${uv};${prev(c, uv)}
         ${generateGlsl(input.value.transforms, shaderParams)(ci, uvi)}`;
      };
    }
  });
  return generator;
}

// assembles a shader string containing the arguments and the function name, i.e. 'osc(uv, frequency)'
function shaderString(c, uv, method, inputs) {
  const str = inputs.map((input, i) => {
    if (input.isUniform) {
      return input.name;
    } else if (input.value && input.value.transforms) {
      // this by definition needs to be a generator
      // use the variable created for generator inputs in `generateInputs`
      return generateInputName(c, i);
    }
    return input.value;
  }).reduce((p, c) => `${p}, ${c}`, '');
  return `${method}(${uv}${str})`;
}

// merge two arrays and remove duplicates
function mergeArrays(a, b) {
  return a.concat(b.filter(function (item) {
    return a.indexOf(item) < 0;
  }));
}

// check whether array
function contains(object, arr) {
  for (var i = 0; i < arr.length; i++) {
    if (object.name == arr[i].name) return true;
  }
  return false;
}

},{"./format-arguments.js":10,"./lib/array-utils.js":19}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _glslSource = _interopRequireDefault(require("./glsl-source.js"));
var _glslFunctions = _interopRequireDefault(require("./glsl/glsl-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class GeneratorFactory {
  constructor({
    defaultUniforms,
    defaultOutput,
    extendTransforms = [],
    changeListener = () => {}
  } = {}) {
    this.defaultOutput = defaultOutput;
    this.defaultUniforms = defaultUniforms;
    this.changeListener = changeListener;
    this.extendTransforms = extendTransforms;
    this.generators = {};
    this.init();
  }
  init() {
    const functions = (0, _glslFunctions.default)();
    this.glslTransforms = {};
    this.generators = Object.entries(this.generators).reduce((prev, [method, transform]) => {
      this.changeListener({
        type: 'remove',
        synth: this,
        method
      });
      return prev;
    }, {});
    this.sourceClass = (() => {
      return class extends _glslSource.default {};
    })();

    // add user definied transforms
    if (Array.isArray(this.extendTransforms)) {
      functions.concat(this.extendTransforms);
    } else if (typeof this.extendTransforms === 'object' && this.extendTransforms.type) {
      functions.push(this.extendTransforms);
    }
    return functions.map(transform => this.setFunction(transform));
  }
  _addMethod(method, transform) {
    const self = this;
    this.glslTransforms[method] = transform;
    if (transform.type === 'src') {
      const func = (...args) => new this.sourceClass({
        name: method,
        transform: transform,
        userArgs: args,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: self
      });
      this.generators[method] = func;
      this.changeListener({
        type: 'add',
        synth: this,
        method
      });
      return func;
    } else {
      this.sourceClass.prototype[method] = function (...args) {
        this.transforms.push({
          name: method,
          transform: transform,
          userArgs: args,
          synth: self
        });
        return this;
      };
    }
    return undefined;
  }
  setFunction(obj) {
    var processedGlsl = processGlsl(obj);
    if (processedGlsl) this._addMethod(obj.name, processedGlsl);
  }
}
const typeLookup = {
  'src': {
    returnType: 'vec4',
    args: [{
      type: 'vec2',
      name: '_st'
    }]
  },
  'coord': {
    returnType: 'vec2',
    args: [{
      type: 'vec2',
      name: '_st'
    }]
  },
  'color': {
    returnType: 'vec4',
    args: [{
      type: 'vec4',
      name: '_c0'
    }]
  },
  'combine': {
    returnType: 'vec4',
    args: [{
      type: 'vec4',
      name: '_c0'
    }, {
      type: 'vec4',
      name: '_c1'
    }]
  },
  'combineCoord': {
    returnType: 'vec2',
    args: [{
      type: 'vec2',
      name: '_st'
    }, {
      type: 'vec4',
      name: '_c0'
    }]
  }
};
// expects glsl of format
// {
//   name: 'osc', // name that will be used to access function as well as within glsl
//   type: 'src', // can be src: vec4(vec2 _st), coord: vec2(vec2 _st), color: vec4(vec4 _c0), combine: vec4(vec4 _c0, vec4 _c1), combineCoord: vec2(vec2 _st, vec4 _c0)
//   inputs: [
//     {
//       name: 'freq',
//       type: 'float', // 'float'   //, 'texture', 'vec4'
//       default: 0.2
//     },
//     {
//           name: 'sync',
//           type: 'float',
//           default: 0.1
//         },
//         {
//           name: 'offset',
//           type: 'float',
//           default: 0.0
//         }
//   ],
//  glsl: `
//    vec2 st = _st;
//    float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//    float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//    float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//    return vec4(r, g, b, 1.0);
// `
// }

// // generates glsl function:
// `vec4 osc(vec2 _st, float freq, float sync, float offset){
//  vec2 st = _st;
//  float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
//  float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
//  float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
//  return vec4(r, g, b, 1.0);
// }`

function processGlsl(obj) {
  let t = typeLookup[obj.type];
  if (t) {
    let inputs = t.args.concat(obj.inputs);
    let args = inputs.map(input => `${input.type} ${input.name}`).join(', ');
    // console.log('args are ', args)

    let glslFunction = `
  ${t.returnType} ${obj.name}(${args}) {
      ${obj.glsl}
  }
`;
    // First input gets handled specially by generator
    obj.inputs = inputs.slice(1);
    return Object.assign({}, obj, {
      glsl: glslFunction
    });
  } else {
    console.warn(`type ${obj.type} not recognized`, obj, typeLookup);
  }
}
var _default = exports.default = GeneratorFactory;

},{"./glsl-source.js":13,"./glsl/glsl-functions.js":14}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _generateGlsl = _interopRequireDefault(require("./generate-glsl.js"));
var _utilityFunctions = _interopRequireDefault(require("./glsl/utility-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// const formatArguments = require('./glsl-utils.js').formatArguments

// const glslTransforms = require('./glsl/composable-glsl-functions.js')

var GlslSource = function (obj) {
  this.transforms = [];
  this.transforms.push(obj);
  this.defaultOutput = obj.defaultOutput;
  this.synth = obj.synth;
  this.type = 'GlslSource';
  this.defaultUniforms = obj.defaultUniforms;
  return this;
};
GlslSource.prototype.addTransform = function (obj) {
  this.transforms.push(obj);
};
GlslSource.prototype.out = function (_output) {
  var output = _output || this.defaultOutput;

  // output.renderPasses(glsl)
  if (output) try {
    var glsl = this.glsl(output);
    this.synth.currentFunctions = [];
    output.render(glsl);
  } catch (error) {
    console.warn('shader could not compile', error);
  }
};
GlslSource.prototype.glsl = function () {
  //var output = _output || this.defaultOutput
  var self = this;
  // uniforms included in all shaders
  //  this.defaultUniforms = output.uniforms
  var passes = [];
  var transforms = [];
  //  console.log('output', output)
  this.transforms.forEach(transform => {
    if (transform.transform.type === 'renderpass') {
      // if (transforms.length > 0) passes.push(this.compile(transforms, output))
      // transforms = []
      // var uniforms = {}
      // const inputs = formatArguments(transform, -1)
      // inputs.forEach((uniform) => { uniforms[uniform.name] = uniform.value })
      //
      // passes.push({
      //   frag: transform.transform.frag,
      //   uniforms: Object.assign({}, self.defaultUniforms, uniforms)
      // })
      // transforms.push({name: 'prev', transform:  glslTransforms['prev'], synth: this.synth})
      console.warn('no support for renderpass');
    } else {
      transforms.push(transform);
    }
  });
  if (transforms.length > 0) passes.push(this.compile(transforms));
  return passes;
};
GlslSource.prototype.compile = function (transforms) {
  var shaderInfo = (0, _generateGlsl.default)(transforms, this.synth);
  var uniforms = {};
  shaderInfo.uniforms.forEach(uniform => {
    uniforms[uniform.name] = uniform.value;
  });
  var frag = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(shaderInfo.uniforms).map(uniform => {
    let type = uniform.type;
    switch (uniform.type) {
      case 'texture':
        type = 'sampler2D';
        break;
    }
    return `
      uniform ${type} ${uniform.name};`;
  }).join('')}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(_utilityFunctions.default).map(transform => {
    //  console.log(transform.glsl)
    return `
            ${transform.glsl}
          `;
  }).join('')}

  ${shaderInfo.glslFunctions.map(transform => {
    return `
            ${transform.transform.glsl}
          `;
  }).join('')}

  void main () {
    vec2 st = gl_FragCoord.xy/resolution.xy;

    ${shaderInfo.fragColor}
    gl_FragColor = c;
  }
  `;
  return {
    frag: frag,
    uniforms: Object.assign({}, this.defaultUniforms, uniforms)
  };
};
var _default = exports.default = GlslSource;

},{"./generate-glsl.js":11,"./glsl/utility-functions.js":15}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
/*
Format for adding functions to hydra. For each entry in this file, hydra automatically generates a glsl function and javascript function with the same name. You can also ass functions dynamically using setFunction(object).

{
  name: 'osc', // name that will be used to access function in js as well as in glsl
  type: 'src', // can be 'src', 'color', 'combine', 'combineCoord'. see below for more info
  inputs: [
    {
      name: 'freq',
      type: 'float',
      default: 0.2
    },
    {
      name: 'sync',
      type: 'float',
      default: 0.1
    },
    {
      name: 'offset',
      type: 'float',
      default: 0.0
    }
  ],
    glsl: `
      vec2 st = _st;
      float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
      float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
      float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
      return vec4(r, g, b, 1.0);
   `
}

// The above code generates the glsl function:
`vec4 osc(vec2 _st, float freq, float sync, float offset){
 vec2 st = _st;
 float r = sin((st.x-offset*2/freq+time*sync)*freq)*0.5  + 0.5;
 float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
 float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
 return vec4(r, g, b, 1.0);
}`


Types and default arguments for hydra functions.
The value in the 'type' field lets the parser know which type the function will be returned as well as default arguments.

const types = {
  'src': {
    returnType: 'vec4',
    args: [{ type: 'vec2', name: '_st' }]
  },
  'coord': {
    returnType: 'vec2',
    args: [{ type: 'vec2', name: '_st'}]
  },
  'color': {
    returnType: 'vec4',
    args: [{ type: 'vec4', name: '_c0'}]
  },
  'combine': {
    returnType: 'vec4',
    args: [
      { type: 'vec4', name: '_c0'},
      { type: 'vec4', name: '_c1'}
    ]
  },
  'combineCoord': {
    returnType: 'vec2',
    args: [
      { type: 'vec2', name: '_st'},
      { type: 'vec4', name: '_c0'},
    ]
  }
}

*/
var _default = () => [{
  name: 'noise',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 10
  }, {
    type: 'float',
    name: 'offset',
    default: 0.1
  }],
  glsl: `   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);`
}, {
  name: 'voronoi',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 5
  }, {
    type: 'float',
    name: 'speed',
    default: 0.3
  }, {
    type: 'float',
    name: 'blending',
    default: 0.3
  }],
  glsl: `   vec3 color = vec3(.0);
   // Scale
   _st *= scale;
   // Tile the space
   vec2 i_st = floor(_st);
   vec2 f_st = fract(_st);
   float m_dist = 10.;  // minimun distance
   vec2 m_point;        // minimum point
   for (int j=-1; j<=1; j++ ) {
   for (int i=-1; i<=1; i++ ) {
   vec2 neighbor = vec2(float(i),float(j));
   vec2 p = i_st + neighbor;
   vec2 point = fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
   point = 0.5 + 0.5*sin(time*speed + 6.2831*point);
   vec2 diff = neighbor + point - f_st;
   float dist = length(diff);
   if( dist < m_dist ) {
   m_dist = dist;
   m_point = point;
   }
   }
   }
   // Assign a color using the closest point position
   color += dot(m_point,vec2(.3,.6));
   color *= 1.0 - blending*m_dist;
   return vec4(color, 1.0);`
}, {
  name: 'osc',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'frequency',
    default: 60
  }, {
    type: 'float',
    name: 'sync',
    default: 0.1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`
}, {
  name: 'shape',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'sides',
    default: 3
  }, {
    type: 'float',
    name: 'radius',
    default: 0.3
  }, {
    type: 'float',
    name: 'smoothing',
    default: 0.01
  }],
  glsl: `   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing + 0.0000001,d)), 1.0);`
}, {
  name: 'gradient',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   return vec4(_st, sin(time*speed), 1.0);`
}, {
  name: 'src',
  type: 'src',
  inputs: [{
    type: 'sampler2D',
    name: 'tex',
    default: NaN
  }],
  glsl: `   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`
}, {
  name: 'solid',
  type: 'src',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 0
  }, {
    type: 'float',
    name: 'g',
    default: 0
  }, {
    type: 'float',
    name: 'b',
    default: 0
  }, {
    type: 'float',
    name: 'a',
    default: 1
  }],
  glsl: `   return vec4(r, g, b, a);`
}, {
  name: 'rotate',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'angle',
    default: 10
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`
}, {
  name: 'scale',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1.5
  }, {
    type: 'float',
    name: 'xMult',
    default: 1
  }, {
    type: 'float',
    name: 'yMult',
    default: 1
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0.5
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0.5
  }],
  glsl: `   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `
}, {
  name: 'pixelate',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'pixelX',
    default: 20
  }, {
    type: 'float',
    name: 'pixelY',
    default: 20
  }],
  glsl: `   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
}, {
  name: 'posterize',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'bins',
    default: 3
  }, {
    type: 'float',
    name: 'gamma',
    default: 0.6
  }],
  glsl: `   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`
}, {
  name: 'shift',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 0.5
  }, {
    type: 'float',
    name: 'g',
    default: 0
  }, {
    type: 'float',
    name: 'b',
    default: 0
  }, {
    type: 'float',
    name: 'a',
    default: 0
  }],
  glsl: `   vec4 c2 = vec4(_c0);
   c2.r += fract(r);
   c2.g += fract(g);
   c2.b += fract(b);
   c2.a += fract(a);
   return vec4(c2.rgba);`
}, {
  name: 'repeat',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'repeatX',
    default: 3
  }, {
    type: 'float',
    name: 'repeatY',
    default: 3
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`
}, {
  name: 'modulateRepeat',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'repeatX',
    default: 3
  }, {
    type: 'float',
    name: 'repeatY',
    default: 3
  }, {
    type: 'float',
    name: 'offsetX',
    default: 0.5
  }, {
    type: 'float',
    name: 'offsetY',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`
}, {
  name: 'repeatX',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`
}, {
  name: 'modulateRepeatX',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`
}, {
  name: 'repeatY',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`
}, {
  name: 'modulateRepeatY',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'reps',
    default: 3
  }, {
    type: 'float',
    name: 'offset',
    default: 0.5
  }],
  glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`
}, {
  name: 'kaleid',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'nSides',
    default: 4
  }],
  glsl: `   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`
}, {
  name: 'modulateKaleid',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'nSides',
    default: 4
  }],
  glsl: `   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`
}, {
  name: 'scroll',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speedX',
    default: 0
  }, {
    type: 'float',
    name: 'speedY',
    default: 0
  }],
  glsl: `
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return fract(_st);`
}, {
  name: 'scrollX',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.x += scrollX + time*speed;
   return fract(_st);`
}, {
  name: 'modulateScrollX',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'scrollX',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.x += _c0.r*scrollX + time*speed;
   return fract(_st);`
}, {
  name: 'scrollY',
  type: 'coord',
  inputs: [{
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.y += scrollY + time*speed;
   return fract(_st);`
}, {
  name: 'modulateScrollY',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'scrollY',
    default: 0.5
  }, {
    type: 'float',
    name: 'speed',
    default: 0
  }],
  glsl: `   _st.y += _c0.r*scrollY + time*speed;
   return fract(_st);`
}, {
  name: 'add',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return (_c0+_c1)*amount + _c0*(1.0-amount);`
}, {
  name: 'sub',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return (_c0-_c1)*amount + _c0*(1.0-amount);`
}, {
  name: 'layer',
  type: 'combine',
  inputs: [],
  glsl: `   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), clamp(_c0.a + _c1.a, 0.0, 1.0));`
}, {
  name: 'blend',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.5
  }],
  glsl: `   return _c0*(1.0-amount)+_c1*amount;`
}, {
  name: 'mult',
  type: 'combine',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return _c0*(1.0-amount)+(_c0*_c1)*amount;`
}, {
  name: 'diff',
  type: 'combine',
  inputs: [],
  glsl: `   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));`
}, {
  name: 'modulate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.1
  }],
  glsl: `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
}, {
  name: 'modulateScale',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 1
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`
}, {
  name: 'modulatePixelate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 10
  }, {
    type: 'float',
    name: 'offset',
    default: 3
  }],
  glsl: `   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
}, {
  name: 'modulateRotate',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'multiple',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`
}, {
  name: 'modulateHue',
  type: 'combineCoord',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);`
}, {
  name: 'invert',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1
  }],
  glsl: `   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);`
}, {
  name: 'contrast',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 1.6
  }],
  glsl: `   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`
}, {
  name: 'brightness',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.4
  }],
  glsl: `   return vec4(_c0.rgb + vec3(amount), _c0.a);`
}, {
  name: 'mask',
  type: 'combine',
  inputs: [],
  glsl: `   float a = _luminance(_c1.rgb);
  return vec4(_c0.rgb*a, a*_c0.a);`
}, {
  name: 'luma',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'threshold',
    default: 0.5
  }, {
    type: 'float',
    name: 'tolerance',
    default: 0.1
  }],
  glsl: `   float a = smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`
}, {
  name: 'thresh',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'threshold',
    default: 0.5
  }, {
    type: 'float',
    name: 'tolerance',
    default: 0.04
  }],
  glsl: `   return vec4(vec3(smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb))), _c0.a);`
}, {
  name: 'color',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'r',
    default: 1
  }, {
    type: 'float',
    name: 'g',
    default: 1
  }, {
    type: 'float',
    name: 'b',
    default: 1
  }, {
    type: 'float',
    name: 'a',
    default: 1
  }],
  glsl: `   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`
}, {
  name: 'saturate',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 2
  }],
  glsl: `   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`
}, {
  name: 'hue',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'hue',
    default: 0.4
  }],
  glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`
}, {
  name: 'colorama',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'amount',
    default: 0.005
  }],
  glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`
}, {
  name: 'prev',
  type: 'src',
  inputs: [],
  glsl: `   return texture2D(prevBuffer, fract(_st));`
}, {
  name: 'sum',
  type: 'color',
  inputs: [{
    type: 'vec4',
    name: 'scale',
    default: 1
  }],
  glsl: `   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`
}, {
  name: 'r',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.r * scale + offset);`
}, {
  name: 'g',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.g * scale + offset);`
}, {
  name: 'b',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.b * scale + offset);`
}, {
  name: 'a',
  type: 'color',
  inputs: [{
    type: 'float',
    name: 'scale',
    default: 1
  }, {
    type: 'float',
    name: 'offset',
    default: 0
  }],
  glsl: `   return vec4(_c0.a * scale + offset);`
}];
exports.default = _default;

},{}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// functions that are only used within other functions
var _default = exports.default = {
  _luminance: {
    type: 'util',
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: 'util',
    glsl: `
    //	Simplex 3D Noise
    //	by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float _noise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }
    `
  },
  _rgbToHsv: {
    type: 'util',
    glsl: `vec3 _rgbToHsv(vec3 c){
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
  _hsvToRgb: {
    type: 'util',
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  }
};

},{}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _webcam = _interopRequireDefault(require("./lib/webcam.js"));
var _screenmedia = _interopRequireDefault(require("./lib/screenmedia.js"));
var _index = require("./webgl/index.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class HydraSource {
  constructor({
    gl,
    width,
    height,
    pb,
    label = ""
  }) {
    this.label = label;
    this.gl = gl;
    this.src = null;
    this.dynamic = true;
    this.width = width;
    this.height = height;
    this.tex = new _index.Texture(gl, {
      width: 1,
      height: 1,
      format: 'rgba',
      mag: 'nearest',
      min: 'nearest'
    });
    this.pb = pb;
  }
  init(opts, params) {
    if ('src' in opts) {
      this.src = opts.src;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
    }
    if ('dynamic' in opts) this.dynamic = opts.dynamic;
  }
  initCam(index, params) {
    const self = this;
    (0, _webcam.default)(index).then(response => {
      self.src = response.video;
      self.dynamic = true;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      self.tex = new _index.Texture(self.gl, {
        ...texParams,
        data: self.src
      });
    }).catch(err => console.log('could not get camera', err));
  }
  initVideo(url = '', params) {
    // const self = this
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.autoplay = true;
    vid.loop = true;
    vid.muted = true; // mute in order to load without user interaction
    const onload = vid.addEventListener('loadeddata', () => {
      this.src = vid;
      vid.play();
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
      this.dynamic = true;
    });
    vid.src = url;
  }
  initImage(url = '', params) {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      this.src = img;
      this.dynamic = false;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      this.tex = new _index.Texture(this.gl, {
        ...texParams,
        data: this.src
      });
    };
  }
  initStream(streamName, params) {
    //  console.log("initing stream!", streamName)
    let self = this;
    if (streamName && this.pb) {
      this.pb.initSource(streamName);
      this.pb.on('got video', function (nick, video) {
        if (nick === streamName) {
          self.src = video;
          self.dynamic = true;
          const texParams = {
            format: 'rgba',
            mag: 'nearest',
            min: 'nearest',
            ...params
          };
          self.tex = new _index.Texture(self.gl, {
            ...texParams,
            data: self.src
          });
        }
      });
    }
  }

  // index only relevant in atom-hydra + desktop apps
  initScreen(index = 0, params) {
    const self = this;
    (0, _screenmedia.default)().then(function (response) {
      self.src = response.video;
      const texParams = {
        format: 'rgba',
        mag: 'nearest',
        min: 'nearest',
        ...params
      };
      self.tex = new _index.Texture(self.gl, {
        ...texParams,
        data: self.src
      });
      self.dynamic = true;
      //  console.log("received screen input")
    }).catch(err => console.log('could not get screen', err));
  }

  // cache for the canvases, so we don't create them every time
  canvases = {};

  // Creates a canvas and returns the 2d context
  initCanvas(width = 1000, height = 1000) {
    if (this.canvases[this.label] == undefined) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext('2d');
      if (ctx != null) this.canvases[this.label] = ctx;
    }
    const ctx = this.canvases[this.label];
    const canvas = ctx.canvas;
    if (canvas.width !== width && canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    this.init({
      src: canvas
    });
    this.dynamic = true;
    return ctx;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  clear() {
    if (this.src && this.src.srcObject) {
      if (this.src.srcObject.getTracks) {
        this.src.srcObject.getTracks().forEach(track => track.stop());
      }
    }
    this.src = null;
    this.tex = new _index.Texture(this.gl, {
      width: 1,
      height: 1,
      format: 'rgba',
      mag: 'nearest',
      min: 'nearest'
    });
  }
  tick(time) {
    //  console.log(this.src, this.tex.width, this.tex.height)
    if (this.src && this.dynamic === true) {
      if (this.src.videoWidth && this.src.videoWidth !== this.tex.width) {
        console.log(this.src.videoWidth, this.src.videoHeight, this.tex.width, this.tex.height);
        this.tex.resize(this.src.videoWidth, this.src.videoHeight);
      }
      if (this.src.width && this.src.width !== this.tex.width) {
        this.tex.resize(this.src.width, this.src.height);
      }
      this.tex.subimage(this.src);
    }
  }
  getTexture() {
    return this.tex;
  }
}
var _default = exports.default = HydraSource;

},{"./lib/screenmedia.js":25,"./lib/webcam.js":27,"./webgl/index.js":33}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _output = _interopRequireDefault(require("./output.js"));
var _rafLoop = _interopRequireDefault(require("raf-loop"));
var _hydraSource = _interopRequireDefault(require("./hydra-source.js"));
var _mouse = _interopRequireDefault(require("./lib/mouse.js"));
var _audio = _interopRequireDefault(require("./lib/audio.js"));
var _videoRecorder = _interopRequireDefault(require("./lib/video-recorder.js"));
var _arrayUtils = _interopRequireDefault(require("./lib/array-utils.js"));
var _evalSandbox = _interopRequireDefault(require("./eval-sandbox.js"));
var _generatorFactory = _interopRequireDefault(require("./generator-factory.js"));
var _index = require("./webgl/index.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// import strudel from './lib/strudel.js'

// const window = global.window

const Mouse = (0, _mouse.default)();
// to do: add ability to pass in certain uniforms and transforms
class HydraRenderer {
  constructor({
    pb = null,
    width = 1280,
    height = 720,
    numSources = 4,
    numOutputs = 4,
    makeGlobal = true,
    autoLoop = true,
    detectAudio = true,
    enableStreamCapture = true,
    canvas,
    precision,
    extendTransforms = {} // add your own functions on init
  } = {}) {
    _arrayUtils.default.init();
    this.pb = pb;
    this.width = width;
    this.height = height;
    this.renderAll = false;
    this.detectAudio = detectAudio;
    this._initCanvas(canvas);

    //global.window.test = 'hi'
    // object that contains all properties that will be made available on the global context and during local evaluation
    this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: undefined,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      setResolution: this.setResolution.bind(this),
      update: dt => {},
      // user defined update function
      afterUpdate: dt => {},
      // user defined function run after update
      hush: this.hush.bind(this),
      tick: this.tick.bind(this)
    };
    if (makeGlobal) window.loadScript = this.loadScript;
    this.timeSinceLastUpdate = 0;
    this._time = 0; // for internal use, only to use for deciding when to render frames

    // only allow valid precision options
    let precisionOptions = ['lowp', 'mediump', 'highp'];
    if (precision && precisionOptions.includes(precision.toLowerCase())) {
      this.precision = precision.toLowerCase();
      //
      // if(!precisionValid){
      //   console.warn('[hydra-synth warning]\nConstructor was provided an invalid floating point precision value of "' + precision + '". Using default value of "mediump" instead.')
      // }
    } else {
      let isIOS = (/iPad|iPhone|iPod/.test(navigator.platform) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) && !window.MSStream;
      this.precision = isIOS ? 'highp' : 'mediump';
    }
    this.extendTransforms = extendTransforms;

    // boolean to store when to save screenshot
    this.saveFrame = false;

    // if stream capture is enabled, this object contains the capture stream
    this.captureStream = null;
    this.generator = undefined;
    this._initWebGL();
    this._initOutputs(numOutputs);
    this._initSources(numSources);
    this._generateGlslTransforms();
    this.synth.screencap = () => {
      this.saveFrame = true;
    };
    if (enableStreamCapture) {
      try {
        this.captureStream = this.canvas.captureStream(25);
        // to do: enable capture stream of specific sources and outputs
        this.synth.vidRecorder = new _videoRecorder.default(this.captureStream);
      } catch (e) {
        console.warn('[hydra-synth warning]\nnew MediaSource() is not currently supported on iOS.');
        console.error(e);
      }
    }
    if (detectAudio) this._initAudio();
    if (autoLoop) (0, _rafLoop.default)(this.tick.bind(this)).start();

    // final argument is properties that the user can set, all others are treated as read-only
    this.sandbox = new _evalSandbox.default(this.synth, makeGlobal, ['speed', 'update', 'afterUpdate', 'bpm', 'fps']);
  }
  eval(code) {
    this.sandbox.eval(code);
  }
  getScreenImage(callback) {
    this.imageCallback = callback;
    this.saveFrame = true;
  }
  hush() {
    this.s.forEach(source => {
      source.clear();
    });
    this.o.forEach(output => {
      this.synth.solid(0, 0, 0, 0).out(output);
    });
    this.synth.render(this.o[0]);
    // this.synth.update = (dt) => {}
    this.sandbox.set('update', dt => {});
    this.sandbox.set('afterUpdate', dt => {});
  }
  loadScript(url = "") {
    const p = new Promise((res, rej) => {
      var script = document.createElement("script");
      script.onload = function () {
        console.log(`loaded script ${url}`);
        res();
      };
      script.onerror = err => {
        console.log(`error loading script ${url}`, "log-error");
        res();
      };
      script.src = url;
      document.head.appendChild(script);
    });
    return p;
  }
  setResolution(width, height) {
    //  console.log(width, height)
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width; // is this necessary?
    this.height = height; // ?
    this.sandbox.set('width', width);
    this.sandbox.set('height', height);
    console.log(this.width);
    this.o.forEach(output => {
      output.resize(width, height);
    });
    this.s.forEach(source => {
      source.resize(width, height);
    });
    this.glContext.refresh();
    console.log(this.canvas.width);
  }
  canvasToImage(callback) {
    const a = document.createElement('a');
    a.style.display = 'none';
    let d = new Date();
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.png`;
    document.body.appendChild(a);
    var self = this;
    this.canvas.toBlob(blob => {
      if (self.imageCallback) {
        self.imageCallback(blob);
        delete self.imageCallback;
      } else {
        a.href = URL.createObjectURL(blob);
        console.log(a.href);
        a.click();
      }
    }, 'image/png');
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
    }, 300);
  }
  _initAudio() {
    const that = this;
    this.synth.a = new _audio.default({
      numBins: 4,
      parentEl: this.canvas.parentNode
      // changeListener: ({audio}) => {
      //   that.a = audio.bins.map((_, index) =>
      //     (scale = 1, offset = 0) => () => (audio.fft[index] * scale + offset)
      //   )
      //
      //   if (that.makeGlobal) {
      //     that.a.forEach((a, index) => {
      //       const aname = `a${index}`
      //       window[aname] = a
      //     })
      //   }
      // }
    });
  }

  // create main output canvas and add to screen
  _initCanvas(canvas) {
    if (canvas) {
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.imageRendering = 'pixelated';
      document.body.appendChild(this.canvas);
    }
  }
  _initWebGL() {
    // Initialize WebGL context
    this.glContext = new _index.WebGLContext(this.canvas, {
      pixelRatio: 1
    });
    this.gl = this.glContext.gl;

    // This clears the color buffer to black and the depth buffer to 1
    this.glContext.clear([0, 0, 0, 1]);

    // Create position buffer for fullscreen triangle
    this.positionBuffer = new _index.Buffer(this.gl, [[-2, 0], [0, -2], [2, 2]]);

    // Create renderAll command for rendering all 4 outputs in quad layout
    this.renderAll = new _index.Command(this.gl, {
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform sampler2D tex0;
      uniform sampler2D tex1;
      uniform sampler2D tex2;
      uniform sampler2D tex3;

      void main () {
        vec2 st = vec2(1.0 - uv.x, uv.y);
        st*= vec2(2);
        vec2 q = floor(st).xy*(vec2(2.0, 1.0));
        int quad = int(q.x) + int(q.y);
        st.x += step(1., mod(st.y,2.0));
        st.y += step(1., mod(st.x,2.0));
        st = fract(st);
        if(quad==0){
          gl_FragColor = texture2D(tex0, st);
        } else if(quad==1){
          gl_FragColor = texture2D(tex1, st);
        } else if (quad==2){
          gl_FragColor = texture2D(tex2, st);
        } else {
          gl_FragColor = texture2D(tex3, st);
        }

      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: this.positionBuffer
      },
      uniforms: {
        tex0: (0, _index.prop)('tex0'),
        tex1: (0, _index.prop)('tex1'),
        tex2: (0, _index.prop)('tex2'),
        tex3: (0, _index.prop)('tex3')
      },
      count: 3
    });

    // Create renderFbo command for rendering a single framebuffer to screen
    this.renderFbo = new _index.Command(this.gl, {
      frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${this.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: this.positionBuffer
      },
      uniforms: {
        tex0: (0, _index.prop)('tex0'),
        resolution: (0, _index.prop)('resolution')
      },
      count: 3
    });
  }
  _initOutputs(numOutputs) {
    const self = this;
    this.o = Array(numOutputs).fill().map((el, index) => {
      var o = new _output.default({
        gl: this.gl,
        width: this.width,
        height: this.height,
        precision: this.precision,
        label: `o${index}`
      });
      //  o.render()
      o.id = index;
      self.synth['o' + index] = o;
      return o;
    });

    // set default output
    this.output = this.o[0];
  }
  _initSources(numSources) {
    this.s = [];
    for (var i = 0; i < numSources; i++) {
      this.createSource(i);
    }
  }
  createSource(i) {
    let s = new _hydraSource.default({
      gl: this.gl,
      pb: this.pb,
      width: this.width,
      height: this.height,
      label: `s${i}`
    });
    this.synth['s' + this.s.length] = s;
    this.s.push(s);
    return s;
  }
  _generateGlslTransforms() {
    var self = this;
    this.generator = new _generatorFactory.default({
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({
        type,
        method,
        synth
      }) => {
        if (type === 'add') {
          self.synth[method] = synth.generators[method];
          if (self.sandbox) self.sandbox.add(method);
        } else if (type === 'remove') {
          // what to do here? dangerously deleting window methods
          //delete window[method]
        }
        //  }
      }
    });
    this.synth.setFunction = this.generator.setFunction.bind(this.generator);
  }
  _render(output) {
    if (output) {
      this.output = output;
      this.isRenderingAll = false;
    } else {
      this.isRenderingAll = true;
    }
  }

  // dt in ms
  tick(dt, uniforms) {
    try {
      this.sandbox.tick();
      if (this.detectAudio === true) this.synth.a.tick();
      //  let updateInterval = 1000/this.synth.fps // ms
      this.sandbox.set('time', this.synth.time += dt * 0.001 * this.synth.speed);
      this.timeSinceLastUpdate += dt;
      if (!this.synth.fps || this.timeSinceLastUpdate >= 1000 / this.synth.fps) {
        //  console.log(1000/this.timeSinceLastUpdate)
        this.synth.stats.fps = Math.ceil(1000 / this.timeSinceLastUpdate);
        if (this.synth.update) {
          try {
            this.synth.update(this.timeSinceLastUpdate);
          } catch (e) {
            console.log(e);
          }
        }
        //  console.log(this.synth.speed, this.synth.time)
        for (let i = 0; i < this.s.length; i++) {
          this.s[i].tick(this.synth.time);
        }
        //  console.log(this.canvas.width, this.canvas.height)
        const currentTime = this.synth.time;
        for (let i = 0; i < this.o.length; i++) {
          this.o[i].tick({
            time: currentTime,
            mouse: this.synth.mouse,
            bpm: this.synth.bpm,
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        if (this.isRenderingAll) {
          this.renderAll.execute({
            tex0: this.o[0].getCurrent(),
            tex1: this.o[1].getCurrent(),
            tex2: this.o[2].getCurrent(),
            tex3: this.o[3].getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        } else {
          this.renderFbo.execute({
            tex0: this.output.getCurrent(),
            resolution: [this.canvas.width, this.canvas.height]
          });
        }
        if (this.synth.afterUpdate) {
          try {
            this.synth.afterUpdate(this.timeSinceLastUpdate);
          } catch (e) {
            console.log(e);
          }
        }
        this.timeSinceLastUpdate = 0;
      }
      if (this.saveFrame === true) {
        this.canvasToImage();
        this.saveFrame = false;
      }
    } catch (e) {
      console.warn('Error during tick():', e);
    }
  }
}
var _default = exports.default = HydraRenderer;

},{"./eval-sandbox.js":9,"./generator-factory.js":12,"./hydra-source.js":16,"./lib/array-utils.js":19,"./lib/audio.js":20,"./lib/mouse.js":23,"./lib/video-recorder.js":26,"./output.js":28,"./webgl/index.js":33,"raf-loop":6}],18:[function(require,module,exports){
"use strict";

var _hydraSynth = _interopRequireDefault(require("./hydra-synth.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
//import ShaderGenerator = require('./shader-generator.js')
// alert('hi')
// export default Synth
module.exports = _hydraSynth.default;

},{"./hydra-synth.js":17}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _easingFunctions = _interopRequireDefault(require("./easing-functions.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// WIP utils for working with arrays
// Possibly should be integrated with lfo extension, etc.
// to do: transform time rather than array values, similar to working with coordinates in hydra

var map = (num, in_min, in_max, out_min, out_max) => {
  return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

// The '%' operator is a remainder operator, and Javascript lacks a dedicated
// modulo operator. This function is an implementation of the operation
// copied-n-pasted from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder#description
var modulo = (n, d) => {
  return (n % d + d) % d;
};
var _default = exports.default = {
  init: () => {
    Array.prototype.fast = function (speed = 1) {
      this._speed = speed;
      return this;
    };
    Array.prototype.smooth = function (smooth = 1) {
      this._smooth = smooth;
      return this;
    };
    Array.prototype.ease = function (ease = 'linear') {
      if (typeof ease == 'function') {
        this._smooth = 1;
        this._ease = ease;
      } else if (_easingFunctions.default[ease]) {
        this._smooth = 1;
        this._ease = _easingFunctions.default[ease];
      }
      return this;
    };
    Array.prototype.offset = function (offset = 0.5) {
      this._offset = offset % 1.0;
      return this;
    };

    // Array.prototype.bounce = function() {
    //   this.modifiers.bounce = true
    //   return this
    // }

    Array.prototype.fit = function (low = 0, high = 1) {
      let lowest = Math.min(...this);
      let highest = Math.max(...this);
      var newArr = this.map(num => map(num, lowest, highest, low, high));
      newArr._speed = this._speed;
      newArr._smooth = this._smooth;
      newArr._ease = this._ease;
      return newArr;
    };
  },
  getValue: (arr = []) => ({
    time,
    bpm
  }) => {
    let speed = arr._speed ? arr._speed : 1;
    let smooth = arr._smooth ? arr._smooth : 0;
    let index = time * speed * (bpm / 60) + (arr._offset || 0);
    if (smooth !== 0) {
      let ease = arr._ease ? arr._ease : _easingFunctions.default['linear'];
      let _index = index - smooth / 2;
      // Compute the first value used for the interpolation: wrap _index inside the range [0, arr.length), then round the resulting value towards 0.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // If we wrapped _index inside the range [0, arr.length) using the regular remainder operator, the result would be negative.
      // Passing a negative index to an array returns undefined, which ultimately causes a number of graphical glitches.
      // We need to use the modulo operation to prevent this.
      let currValue = arr[Math.floor(modulo(_index, arr.length))];
      // Compute the second value used for the interpolation, in a similar fashion to 'currValue'.
      // The above reasoning about the choice of the modulo operation applies for 'nextValue', too.
      let nextValue = arr[Math.floor(modulo(_index + 1, arr.length))];
      // Compute the time parameter for the interpolation.
      // Note that, during the first seconds Hydra is running, _index may assume a negative value.
      // Assuming 'smooth' is positive, if we wrapped _index in the range [0, 1) using the regular remainder operator, t would become negative as a result.
      // This would cause the final interpolation to assume values inconsistent with the later ones.
      // E.g. [0, 1].smooth() should always generate values between 0 and 1, but the initial values would be negative.
      // We need to use the modulo operation to prevent this.
      let t = Math.min(modulo(_index, 1) / smooth, 1);
      return ease(t) * (nextValue - currValue) + currValue;
    } else {
      const val = arr[Math.floor(index % arr.length)];
      return arr[Math.floor(index % arr.length)];
    }
  }
};

},{"./easing-functions.js":21}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _meyda = _interopRequireDefault(require("meyda"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class Audio {
  constructor({
    numBins = 4,
    cutoff = 2,
    smooth = 0.4,
    max = 15,
    scale = 10,
    isDrawing = false,
    parentEl = document.body
  }) {
    this.vol = 0;
    this.scale = scale;
    this.max = max;
    this.cutoff = cutoff;
    this.smooth = smooth;
    this.setBins(numBins);

    // beat detection from: https://github.com/therewasaguy/p5-music-viz/blob/gh-pages/demos/01d_beat_detect_amplitude/sketch.js
    this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0,
      // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0 // keeps track of frames
    };
    this.onBeat = () => {
      //  console.log("beat")
    };
    this.canvas = document.createElement('canvas');
    this.canvas.width = 100;
    this.canvas.height = 80;
    this.canvas.style.width = "100px";
    this.canvas.style.height = "80px";
    this.canvas.style.position = 'absolute';
    this.canvas.style.right = '0px';
    this.canvas.style.bottom = '0px';
    parentEl.appendChild(this.canvas);
    this.isDrawing = isDrawing;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = "#DFFFFF";
    this.ctx.strokeStyle = "#0ff";
    this.ctx.lineWidth = 0.5;
    if (window.navigator.mediaDevices) {
      window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      }).then(stream => {
        //  console.log('got mic stream', stream)
        this.stream = stream;
        this.context = new AudioContext();
        //  this.context = new AudioContext()
        let audio_stream = this.context.createMediaStreamSource(stream);

        //  console.log(this.context)
        this.meyda = _meyda.default.createMeydaAnalyzer({
          audioContext: this.context,
          source: audio_stream,
          featureExtractors: ['loudness'
          //  'perceptualSpread',
          //  'perceptualSharpness',
          //  'spectralCentroid'
          ]
        });
      }).catch(err => console.log('ERROR', err));
    }
  }
  detectBeat(level) {
    //console.log(level,   this.beat._cutoff)
    if (level > this.beat._cutoff && level > this.beat.threshold) {
      this.onBeat();
      this.beat._cutoff = level * 1.2;
      this.beat._framesSinceBeat = 0;
    } else {
      if (this.beat._framesSinceBeat <= this.beat.holdFrames) {
        this.beat._framesSinceBeat++;
      } else {
        this.beat._cutoff *= this.beat.decay;
        this.beat._cutoff = Math.max(this.beat._cutoff, this.beat.threshold);
      }
    }
  }
  tick() {
    if (this.meyda) {
      var features = this.meyda.get();
      if (features && features !== null) {
        this.vol = features.loudness.total;
        this.detectBeat(this.vol);
        // reduce loudness array to number of bins
        const reducer = (accumulator, currentValue) => accumulator + currentValue;
        let spacing = Math.floor(features.loudness.specific.length / this.bins.length);
        this.prevBins = this.bins.slice(0);
        this.bins = this.bins.map((bin, index) => {
          return features.loudness.specific.slice(index * spacing, (index + 1) * spacing).reduce(reducer);
        }).map((bin, index) => {
          // map to specified range

          // return (bin * (1.0 - this.smooth) + this.prevBins[index] * this.smooth)
          return bin * (1.0 - this.settings[index].smooth) + this.prevBins[index] * this.settings[index].smooth;
        });
        // var y = this.canvas.height - scale*this.settings[index].cutoff
        // this.ctx.beginPath()
        // this.ctx.moveTo(index*spacing, y)
        // this.ctx.lineTo((index+1)*spacing, y)
        // this.ctx.stroke()
        //
        // var yMax = this.canvas.height - scale*(this.settings[index].scale + this.settings[index].cutoff)
        this.fft = this.bins.map((bin, index) =>
        // Math.max(0, (bin - this.cutoff) / (this.max - this.cutoff))
        Math.max(0, (bin - this.settings[index].cutoff) / this.settings[index].scale));
        if (this.isDrawing) this.draw();
      }
    }
  }
  setCutoff(cutoff) {
    this.cutoff = cutoff;
    this.settings = this.settings.map(el => {
      el.cutoff = cutoff;
      return el;
    });
  }
  setSmooth(smooth) {
    this.smooth = smooth;
    this.settings = this.settings.map(el => {
      el.smooth = smooth;
      return el;
    });
  }
  setBins(numBins) {
    this.bins = Array(numBins).fill(0);
    this.prevBins = Array(numBins).fill(0);
    this.fft = Array(numBins).fill(0);
    this.settings = Array(numBins).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    }));
    // to do: what to do in non-global mode?
    this.bins.forEach((bin, index) => {
      window['a' + index] = (scale = 1, offset = 0) => () => a.fft[index] * scale + offset;
    });
    //  console.log(this.settings)
  }
  setScale(scale) {
    this.scale = scale;
    this.settings = this.settings.map(el => {
      el.scale = scale;
      return el;
    });
  }
  setMax(max) {
    this.max = max;
    console.log('set max is deprecated');
  }
  hide() {
    this.isDrawing = false;
    this.canvas.style.display = 'none';
  }
  show() {
    this.isDrawing = true;
    this.canvas.style.display = 'block';
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var spacing = this.canvas.width / this.bins.length;
    var scale = this.canvas.height / (this.max * 2);
    //  console.log(this.bins)
    this.bins.forEach((bin, index) => {
      var height = bin * scale;
      this.ctx.fillRect(index * spacing, this.canvas.height - height, spacing, height);

      //   console.log(this.settings[index])
      var y = this.canvas.height - scale * this.settings[index].cutoff;
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, y);
      this.ctx.lineTo((index + 1) * spacing, y);
      this.ctx.stroke();
      var yMax = this.canvas.height - scale * (this.settings[index].scale + this.settings[index].cutoff);
      this.ctx.beginPath();
      this.ctx.moveTo(index * spacing, yMax);
      this.ctx.lineTo((index + 1) * spacing, yMax);
      this.ctx.stroke();
    });

    /*var y = this.canvas.height - scale*this.cutoff
    this.ctx.beginPath()
    this.ctx.moveTo(0, y)
    this.ctx.lineTo(this.canvas.width, y)
    this.ctx.stroke()
    var yMax = this.canvas.height - scale*this.max
    this.ctx.beginPath()
    this.ctx.moveTo(0, yMax)
    this.ctx.lineTo(this.canvas.width, yMax)
    this.ctx.stroke()*/
  }
}
var _default = exports.default = Audio;

},{"meyda":3}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// from https://gist.github.com/gre/1650294
var _default = exports.default = {
  // no easing, no acceleration
  linear: function (t) {
    return t;
  },
  // accelerating from zero velocity
  easeInQuad: function (t) {
    return t * t;
  },
  // decelerating to zero velocity
  easeOutQuad: function (t) {
    return t * (2 - t);
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function (t) {
    return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  // accelerating from zero velocity
  easeInCubic: function (t) {
    return t * t * t;
  },
  // decelerating to zero velocity
  easeOutCubic: function (t) {
    return --t * t * t + 1;
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function (t) {
    return t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  // accelerating from zero velocity
  easeInQuart: function (t) {
    return t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuart: function (t) {
    return 1 - --t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function (t) {
    return t < .5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  },
  // accelerating from zero velocity
  easeInQuint: function (t) {
    return t * t * t * t * t;
  },
  // decelerating to zero velocity
  easeOutQuint: function (t) {
    return 1 + --t * t * t * t * t;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function (t) {
    return t < .5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
  },
  // sin shape
  sin: function (t) {
    return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2;
  }
};

},{}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// https://github.com/mikolalysenko/mouse-event

const mouse = {};
function mouseButtons(ev) {
  if (typeof ev === 'object') {
    if ('buttons' in ev) {
      return ev.buttons;
    } else if ('which' in ev) {
      var b = ev.which;
      if (b === 2) {
        return 4;
      } else if (b === 3) {
        return 2;
      } else if (b > 0) {
        return 1 << b - 1;
      }
    } else if ('button' in ev) {
      var b = ev.button;
      if (b === 1) {
        return 4;
      } else if (b === 2) {
        return 2;
      } else if (b >= 0) {
        return 1 << b;
      }
    }
  }
  return 0;
}
mouse.buttons = mouseButtons;
function mouseElement(ev) {
  return ev.target || ev.srcElement || window;
}
mouse.element = mouseElement;
function mouseRelativeX(ev) {
  if (typeof ev === 'object') {
    if ('pageX' in ev) {
      return ev.pageX;
    }
  }
  return 0;
}
mouse.x = mouseRelativeX;
function mouseRelativeY(ev) {
  if (typeof ev === 'object') {
    if ('pageY' in ev) {
      return ev.pageY;
    }
  }
  return 0;
}
mouse.y = mouseRelativeY;
var _default = exports.default = mouse;

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mouseEvent = _interopRequireDefault(require("./mouse-event.js"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// based on https://github.com/mikolalysenko/mouse-change
var _default = exports.default = mouseListen;
function mouseListen(element, callback) {
  if (!callback) {
    callback = element;
    element = window;
  }
  var buttonState = 0;
  var x = 0;
  var y = 0;
  var mods = {
    shift: false,
    alt: false,
    control: false,
    meta: false
  };
  var attached = false;
  function updateMods(ev) {
    var changed = false;
    if ('altKey' in ev) {
      changed = changed || ev.altKey !== mods.alt;
      mods.alt = !!ev.altKey;
    }
    if ('shiftKey' in ev) {
      changed = changed || ev.shiftKey !== mods.shift;
      mods.shift = !!ev.shiftKey;
    }
    if ('ctrlKey' in ev) {
      changed = changed || ev.ctrlKey !== mods.control;
      mods.control = !!ev.ctrlKey;
    }
    if ('metaKey' in ev) {
      changed = changed || ev.metaKey !== mods.meta;
      mods.meta = !!ev.metaKey;
    }
    return changed;
  }
  function handleEvent(nextButtons, ev) {
    var nextX = _mouseEvent.default.x(ev);
    var nextY = _mouseEvent.default.y(ev);
    if ('buttons' in ev) {
      nextButtons = ev.buttons | 0;
    }
    if (nextButtons !== buttonState || nextX !== x || nextY !== y || updateMods(ev)) {
      buttonState = nextButtons | 0;
      x = nextX || 0;
      y = nextY || 0;
      callback && callback(buttonState, x, y, mods);
    }
  }
  function clearState(ev) {
    handleEvent(0, ev);
  }
  function handleBlur() {
    if (buttonState || x || y || mods.shift || mods.alt || mods.meta || mods.control) {
      x = y = 0;
      buttonState = 0;
      mods.shift = mods.alt = mods.control = mods.meta = false;
      callback && callback(0, 0, 0, mods);
    }
  }
  function handleMods(ev) {
    if (updateMods(ev)) {
      callback && callback(buttonState, x, y, mods);
    }
  }
  function handleMouseMove(ev) {
    if (_mouseEvent.default.buttons(ev) === 0) {
      handleEvent(0, ev);
    } else {
      handleEvent(buttonState, ev);
    }
  }
  function handleMouseDown(ev) {
    handleEvent(buttonState | _mouseEvent.default.buttons(ev), ev);
  }
  function handleMouseUp(ev) {
    handleEvent(buttonState & ~_mouseEvent.default.buttons(ev), ev);
  }
  function attachListeners() {
    if (attached) {
      return;
    }
    attached = true;
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', clearState);
    element.addEventListener('mouseenter', clearState);
    element.addEventListener('mouseout', clearState);
    element.addEventListener('mouseover', clearState);
    element.addEventListener('blur', handleBlur);
    element.addEventListener('keyup', handleMods);
    element.addEventListener('keydown', handleMods);
    element.addEventListener('keypress', handleMods);
    if (element !== window) {
      window.addEventListener('blur', handleBlur);
      window.addEventListener('keyup', handleMods);
      window.addEventListener('keydown', handleMods);
      window.addEventListener('keypress', handleMods);
    }
  }
  function detachListeners() {
    if (!attached) {
      return;
    }
    attached = false;
    element.removeEventListener('mousemove', handleMouseMove);
    element.removeEventListener('mousedown', handleMouseDown);
    element.removeEventListener('mouseup', handleMouseUp);
    element.removeEventListener('mouseleave', clearState);
    element.removeEventListener('mouseenter', clearState);
    element.removeEventListener('mouseout', clearState);
    element.removeEventListener('mouseover', clearState);
    element.removeEventListener('blur', handleBlur);
    element.removeEventListener('keyup', handleMods);
    element.removeEventListener('keydown', handleMods);
    element.removeEventListener('keypress', handleMods);
    if (element !== window) {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keyup', handleMods);
      window.removeEventListener('keydown', handleMods);
      window.removeEventListener('keypress', handleMods);
    }
  }

  // Attach listeners
  attachListeners();
  var result = {
    element: element
  };
  Object.defineProperties(result, {
    enabled: {
      get: function () {
        return attached;
      },
      set: function (f) {
        if (f) {
          attachListeners();
        } else {
          detachListeners();
        }
      },
      enumerable: true
    },
    buttons: {
      get: function () {
        return buttonState;
      },
      enumerable: true
    },
    x: {
      get: function () {
        return x;
      },
      enumerable: true
    },
    y: {
      get: function () {
        return y;
      },
      enumerable: true
    },
    mods: {
      get: function () {
        return mods;
      },
      enumerable: true
    }
  });
  return result;
}

},{"./mouse-event.js":22}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
// attempt custom evaluation sandbox for hydra functions
// for now, just avoids polluting the global namespace
// should probably be replaced with an abstract syntax tree
var _default = parent => {
  var initialCode = ``;
  var sandbox = createSandbox(initialCode);
  var addToContext = (name, object) => {
    initialCode += `
      var ${name} = ${object}
    `;
    sandbox = createSandbox(initialCode);
  };
  return {
    addToContext: addToContext,
    eval: code => sandbox.eval(code)
  };
  function createSandbox(initial) {
    globalThis.eval(initial);
    // optional params
    var localEval = function (code) {
      globalThis.eval(code);
    };

    // API/data for end-user
    return {
      eval: localEval
    };
  }
};
exports.default = _default;

},{}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
function _default(options) {
  return new Promise(function (resolve, reject) {
    //  async function startCapture(displayMediaOptions) {
    navigator.mediaDevices.getDisplayMedia(options).then(stream => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.addEventListener('loadedmetadata', () => {
        video.play();
        resolve({
          video: video
        });
      });
    }).catch(err => reject(err));
  });
}

},{}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class VideoRecorder {
  constructor(stream) {
    this.mediaSource = new MediaSource();
    this.stream = stream;

    // testing using a recording as input
    this.output = document.createElement('video');
    this.output.autoplay = true;
    this.output.loop = true;
    let self = this;
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource opened');
      self.sourceBuffer = self.mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
      console.log('Source buffer: ', sourceBuffer);
    });
  }
  start() {
    //  let options = {mimeType: 'video/webm'};

    //   let options = {mimeType: 'video/webm;codecs=h264'};
    let options = {
      mimeType: 'video/webm;codecs=vp9'
    };
    this.recordedBlobs = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e0) {
      console.log('Unable to create MediaRecorder with options Object: ', e0);
      try {
        options = {
          mimeType: 'video/webm,codecs=vp9'
        };
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (e1) {
        console.log('Unable to create MediaRecorder with options Object: ', e1);
        try {
          options = 'video/vp8'; // Chrome 47
          this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e2) {
          alert('MediaRecorder is not supported by this browser.\n\n' + 'Try Firefox 29 or later, or Chrome 47 or later, ' + 'with Enable experimental Web Platform features enabled from chrome://flags.');
          console.error('Exception while creating MediaRecorder:', e2);
          return;
        }
      }
    }
    console.log('Created MediaRecorder', this.mediaRecorder, 'with options', options);
    this.mediaRecorder.onstop = this._handleStop.bind(this);
    this.mediaRecorder.ondataavailable = this._handleDataAvailable.bind(this);
    this.mediaRecorder.start(100); // collect 100ms of data
    console.log('MediaRecorder started', this.mediaRecorder);
  }
  stop() {
    this.mediaRecorder.stop();
  }
  _handleStop() {
    //const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'})
    // const blob = new Blob(this.recordedBlobs, {type: 'video/webm;codecs=h264'})
    const blob = new Blob(this.recordedBlobs, {
      type: this.mediaRecorder.mimeType
    });
    const url = window.URL.createObjectURL(blob);
    this.output.src = url;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    let d = new Date();
    a.download = `hydra-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}.${d.getMinutes()}.${d.getSeconds()}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 300);
  }
  _handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }
}
var _default = exports.default = VideoRecorder;

},{}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
//const enumerateDevices = require('enumerate-devices')

function _default(deviceId) {
  return navigator.mediaDevices.enumerateDevices().then(devices => devices.filter(devices => devices.kind === 'videoinput')).then(cameras => {
    let constraints = {
      audio: false,
      video: true
    };
    if (cameras[deviceId]) {
      constraints['video'] = {
        deviceId: {
          exact: cameras[deviceId].deviceId
        }
      };
    }
    //  console.log(cameras)
    return window.navigator.mediaDevices.getUserMedia(constraints);
  }).then(stream => {
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    //  video.src = window.URL.createObjectURL(stream)
    video.srcObject = stream;
    return new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => resolve({
          video: video
        }));
      });
    });
  }).catch(console.log.bind(console));
}

},{}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _index = require("./webgl/index.js");
//const transforms = require('./glsl-transforms.js')

var Output = function ({
  gl,
  precision,
  label = "",
  width,
  height
}) {
  this.gl = gl;
  this.precision = precision;
  this.label = label;
  this.positionBuffer = new _index.Buffer(gl, [[-2, 0], [0, -2], [2, 2]]);
  this.draw = () => {};
  this.init();
  this.pingPongIndex = 0;

  // for each output, create two fbos for pingponging
  this.fbos = Array(2).fill().map(() => new _index.Framebuffer(gl, {
    width: width,
    height: height,
    format: 'rgba',
    mag: 'nearest'
  }));

  // array containing render passes
  //  this.passes = []
};
Output.prototype.resize = function (width, height) {
  this.fbos.forEach(fbo => {
    fbo.resize(width, height);
  });
  //  console.log(this)
};
Output.prototype.getCurrent = function () {
  return this.fbos[this.pingPongIndex];
};
Output.prototype.getTexture = function () {
  var index = this.pingPongIndex ? 0 : 1;
  return this.fbos[index];
};
Output.prototype.init = function () {
  //  console.log('clearing')
  this.transformIndex = 0;
  this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `;
  this.fragBody = ``;
  this.vert = `
  precision ${this.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`;
  this.attributes = {
    position: this.positionBuffer
  };
  this.uniforms = {
    time: (0, _index.prop)('time'),
    resolution: (0, _index.prop)('resolution')
  };
  this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `;
  return this;
};
Output.prototype.render = function (passes) {
  let pass = passes[0];
  //console.log('pass', pass, this.pingPongIndex)
  var self = this;
  var uniforms = Object.assign(pass.uniforms, {
    prevBuffer: () => {
      //var index = this.pingPongIndex ? 0 : 1
      //   var index = self.pingPong[(passIndex+1)%2]
      //  console.log('ping pong', self.pingPongIndex)
      return self.fbos[self.pingPongIndex];
    }
  });
  self.draw = new _index.Command(self.gl, {
    frag: pass.frag,
    vert: self.vert,
    attributes: self.attributes,
    uniforms: uniforms,
    count: 3,
    framebuffer: () => {
      self.pingPongIndex = self.pingPongIndex ? 0 : 1;
      return self.fbos[self.pingPongIndex];
    }
  });
};
Output.prototype.tick = function (props) {
  //  console.log(props)
  if (this.draw && this.draw.execute) {
    this.draw.execute(props);
  }
};
var _default = exports.default = Output;

},{"./webgl/index.js":33}],29:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Buffer = void 0;
// Vertex buffer management
class Buffer {
  constructor(gl, data, usage = null) {
    this.gl = gl;
    this.buffer = gl.createBuffer();
    this.usage = usage || gl.STATIC_DRAW;
    if (data) {
      this.setData(data);
    }
  }
  setData(data) {
    const gl = this.gl;

    // Convert data to Float32Array if needed
    let bufferData = data;
    if (Array.isArray(data)) {
      // Flatten nested arrays if needed
      const flattened = this.flattenArray(data);
      bufferData = new Float32Array(flattened);
    } else if (!(data instanceof Float32Array)) {
      bufferData = new Float32Array(data);
    }
    this.bind();
    gl.bufferData(gl.ARRAY_BUFFER, bufferData, this.usage);
    this.length = bufferData.length;
  }
  flattenArray(arr) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (Array.isArray(arr[i])) {
        result.push(...arr[i]);
      } else {
        result.push(arr[i]);
      }
    }
    return result;
  }
  bind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
  }
  unbind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }
  destroy() {
    if (this.buffer) {
      this.gl.deleteBuffer(this.buffer);
      this.buffer = null;
    }
  }
}
exports.Buffer = Buffer;

},{}],30:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Command = void 0;
exports.prop = prop;
var _shader = require("./shader.js");
// Draw command abstraction (regl-like interface)

class Command {
  constructor(gl, config) {
    this.gl = gl;
    this.config = config;
    this.warnedErrors = new Set(); // Track errors we've already logged

    // Create shader if vertex and fragment sources provided
    if (config.vert && config.frag) {
      this.shader = new _shader.Shader(gl, config.vert, config.frag);
    }

    // Store configuration
    this.attributes = config.attributes || {};
    this.uniforms = config.uniforms || {};
    this.count = config.count || 3;
    this.primitive = this.parsePrimitive(config.primitive || 'triangles');
    this.framebuffer = config.framebuffer || null;
    this.viewport = config.viewport || null;
  }
  parsePrimitive(primitive) {
    const gl = this.gl;
    const primitiveMap = {
      'points': gl.POINTS,
      'lines': gl.LINES,
      'line strip': gl.LINE_STRIP,
      'line loop': gl.LINE_LOOP,
      'triangles': gl.TRIANGLES,
      'triangle strip': gl.TRIANGLE_STRIP,
      'triangle fan': gl.TRIANGLE_FAN
    };
    return primitiveMap[primitive] || gl.TRIANGLES;
  }
  execute(props = {}) {
    const gl = this.gl;

    // Use shader
    if (this.shader) {
      this.shader.use();
    }

    // Bind framebuffer
    const fbo = this.resolveValue(this.framebuffer, props);
    if (fbo) {
      fbo.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Set viewport
    const viewport = this.resolveValue(this.viewport, props);
    if (viewport) {
      gl.viewport(viewport.x || 0, viewport.y || 0, viewport.width, viewport.height);
    }

    // Set attributes
    let textureUnit = 0;
    for (const name in this.attributes) {
      const attrConfig = this.attributes[name];
      const value = this.resolveValue(attrConfig, props);

      // Check if value is a Buffer object
      if (value && typeof value.bind === 'function' && !value.texture) {
        const size = attrConfig.size || 2;
        this.shader.setAttribute(name, value, size);
      }
    }

    // Set uniforms
    for (const name in this.uniforms) {
      const uniformConfig = this.uniforms[name];
      let value = this.resolveValue(uniformConfig, props);

      // Handle texture binding
      if (value && value.bind && value.texture) {
        // It's a Texture object
        value.bind(textureUnit);
        value = textureUnit;
        textureUnit++;
      } else if (value && value.color && value.color.bind) {
        // It's a Framebuffer object (use its color texture)
        value.color.bind(textureUnit);
        value = textureUnit;
        textureUnit++;
      }
      if (this.shader) {
        this.shader.setUniform(name, value);
      }
    }

    // Draw
    const count = this.resolveValue(this.count, props);
    gl.drawArrays(this.primitive, 0, count);

    // Unbind framebuffer
    if (fbo) {
      fbo.unbind();
    }
  }
  resolveValue(value, props) {
    if (typeof value === 'function') {
      try {
        // Uniform functions have signature (context, props, batchId)
        const context = {}; // Minimal context object
        const batchId = 0; // Batch ID for draw calls

        const result = value(context, props, batchId);

        // If the result is also a function, call it again with props
        // This handles getValue() which returns a function expecting {time, bpm}
        if (typeof result === 'function') {
          return result(props);
        }
        return result;
      } catch (e) {
        // Only warn once per error to avoid console spam
        const errorKey = e.message + value.toString().substring(0, 50);
        if (!this.warnedErrors.has(errorKey)) {
          console.warn('Error resolving uniform:', e.message);
          this.warnedErrors.add(errorKey);
        }
        // Return a safe default instead of throwing
        return 0;
      }
    } else if (value && value._isProp) {
      // Handle regl.prop() pattern
      return props[value.name];
    }
    return value;
  }
  destroy() {
    if (this.shader) {
      this.shader.destroy();
      this.shader = null;
    }
  }
}

// Helper to create regl.prop() equivalent
exports.Command = Command;
function prop(name) {
  return {
    _isProp: true,
    name: name
  };
}

},{"./shader.js":34}],31:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebGLContext = void 0;
// WebGL context management
class WebGLContext {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.pixelRatio = options.pixelRatio || 1;

    // Create WebGL context
    const contextOptions = {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      antialias: false,
      ...options.contextAttributes
    };
    this.gl = canvas.getContext('webgl', contextOptions) || canvas.getContext('experimental-webgl', contextOptions);
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    // Handle context loss
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    // Set initial state
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }
  handleContextLost(event) {
    event.preventDefault();
    console.warn('WebGL context lost');
  }
  handleContextRestored() {
    console.log('WebGL context restored');
  }
  clear(color = [0, 0, 0, 1]) {
    const gl = this.gl;
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  viewport(x, y, width, height) {
    this.gl.viewport(x, y, width, height);
  }
  refresh() {
    // Force WebGL to refresh state
    this.gl.flush();
  }
  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }
}
exports.WebGLContext = WebGLContext;

},{}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Framebuffer = void 0;
var _texture = require("./texture.js");
// Framebuffer management

class Framebuffer {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.framebuffer = gl.createFramebuffer();
    this.width = options.width || 1;
    this.height = options.height || 1;

    // Create color attachment texture
    const textureOptions = {
      width: this.width,
      height: this.height,
      format: options.format || 'rgba',
      type: options.type || 'uint8',
      min: options.min || 'nearest',
      mag: options.mag || 'nearest',
      wrapS: options.wrapS || 'clamp',
      wrapT: options.wrapT || 'clamp'
    };
    this.color = new _texture.Texture(gl, textureOptions);

    // Attach texture to framebuffer
    this.bind();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color.texture, 0);

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete:', this.getStatusString(status));
    }
    this.unbind();
  }
  getStatusString(status) {
    const gl = this.gl;
    const statusMap = {
      [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
      [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
      [gl.FRAMEBUFFER_UNSUPPORTED]: 'FRAMEBUFFER_UNSUPPORTED'
    };
    return statusMap[status] || 'UNKNOWN_ERROR';
  }
  bind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }
  unbind() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }
  resize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.color.resize(width, height);

    // Re-attach texture to framebuffer
    this.bind();
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.color.texture, 0);
    this.unbind();
  }
  destroy() {
    if (this.color) {
      this.color.destroy();
      this.color = null;
    }
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }
  }
}
exports.Framebuffer = Framebuffer;

},{"./texture.js":35}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Buffer", {
  enumerable: true,
  get: function () {
    return _buffer.Buffer;
  }
});
Object.defineProperty(exports, "Command", {
  enumerable: true,
  get: function () {
    return _command.Command;
  }
});
Object.defineProperty(exports, "Framebuffer", {
  enumerable: true,
  get: function () {
    return _framebuffer.Framebuffer;
  }
});
Object.defineProperty(exports, "Shader", {
  enumerable: true,
  get: function () {
    return _shader.Shader;
  }
});
Object.defineProperty(exports, "Texture", {
  enumerable: true,
  get: function () {
    return _texture.Texture;
  }
});
Object.defineProperty(exports, "WebGLContext", {
  enumerable: true,
  get: function () {
    return _context.WebGLContext;
  }
});
Object.defineProperty(exports, "prop", {
  enumerable: true,
  get: function () {
    return _command.prop;
  }
});
var _context = require("./context.js");
var _shader = require("./shader.js");
var _buffer = require("./buffer.js");
var _texture = require("./texture.js");
var _framebuffer = require("./framebuffer.js");
var _command = require("./command.js");

},{"./buffer.js":29,"./command.js":30,"./context.js":31,"./framebuffer.js":32,"./shader.js":34,"./texture.js":35}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Shader = void 0;
// Shader compilation and program management
class Shader {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.program = null;
    this.uniforms = {};
    this.attributes = {};
    this.warnedAttributes = new Set(); // Track which attributes we've already warned about

    this.compile(vertexSource, fragmentSource);
  }
  compile(vertexSource, fragmentSource) {
    const gl = this.gl;

    // Compile vertex shader
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    if (!vertexShader) {
      throw new Error('Failed to compile vertex shader');
    }

    // Compile fragment shader
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) {
      gl.deleteShader(vertexShader);
      throw new Error('Failed to compile fragment shader');
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    // Check for link errors
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      gl.deleteProgram(this.program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error('Failed to link shader program: ' + info);
    }

    // Clean up shaders (no longer needed after linking)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Cache uniform and attribute locations
    this.cacheLocations();
  }
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
      console.error(`Failed to compile ${typeName} shader:`, info);
      console.error('Shader source:', source);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  cacheLocations() {
    const gl = this.gl;
    const program = this.program;

    // Cache uniform locations
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) {
        const location = gl.getUniformLocation(program, info.name);
        this.uniforms[info.name] = {
          location,
          type: info.type,
          size: info.size
        };
      }
    }

    // Cache attribute locations
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < numAttributes; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (info) {
        const location = gl.getAttribLocation(program, info.name);
        this.attributes[info.name] = {
          location,
          type: info.type,
          size: info.size
        };
      }
    }
  }
  use() {
    this.gl.useProgram(this.program);
  }
  setUniform(name, value) {
    const gl = this.gl;
    const uniform = this.uniforms[name];
    if (!uniform) {
      // Silently ignore missing uniforms (they may be optimized out)
      return;
    }
    const loc = uniform.location;

    // Handle different uniform types
    switch (uniform.type) {
      case gl.FLOAT:
        gl.uniform1f(loc, value);
        break;
      case gl.FLOAT_VEC2:
        gl.uniform2fv(loc, value);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(loc, value);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(loc, value);
        break;
      case gl.INT:
      case gl.BOOL:
        gl.uniform1i(loc, value);
        break;
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        gl.uniform2iv(loc, value);
        break;
      case gl.INT_VEC3:
      case gl.BOOL_VEC3:
        gl.uniform3iv(loc, value);
        break;
      case gl.INT_VEC4:
      case gl.BOOL_VEC4:
        gl.uniform4iv(loc, value);
        break;
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        gl.uniform1i(loc, value);
        break;
      case gl.FLOAT_MAT2:
        gl.uniformMatrix2fv(loc, false, value);
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(loc, false, value);
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(loc, false, value);
        break;
      default:
        console.warn(`Unsupported uniform type: ${uniform.type}`);
    }
  }
  setAttribute(name, buffer, size = 3, type = null, normalized = false, stride = 0, offset = 0) {
    const gl = this.gl;
    const attribute = this.attributes[name];
    if (!attribute) {
      // Only warn once per attribute name to avoid console spam
      if (!this.warnedAttributes.has(name)) {
        console.warn(`Attribute '${name}' not found in shader`);
        this.warnedAttributes.add(name);
      }
      return;
    }
    buffer.bind();
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(attribute.location, size, type || gl.FLOAT, normalized, stride, offset);
  }
  destroy() {
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}
exports.Shader = Shader;

},{}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Texture = void 0;
// Texture management
class Texture {
  constructor(gl, options = {}) {
    this.gl = gl;
    this.texture = gl.createTexture();
    this.width = options.width || 1;
    this.height = options.height || 1;
    this.format = options.format || 'rgba';
    this.type = options.type || 'uint8';

    // Texture parameters
    this.minFilter = this.parseFilter(options.min || 'nearest');
    this.magFilter = this.parseFilter(options.mag || 'nearest');
    this.wrapS = this.parseWrap(options.wrapS || 'clamp');
    this.wrapT = this.parseWrap(options.wrapT || 'clamp');
    this.bind();
    this.setupTexture(options.data);
    this.setParameters();
  }
  parseFilter(filter) {
    const gl = this.gl;
    const filterMap = {
      'nearest': gl.NEAREST,
      'linear': gl.LINEAR,
      'mipmap': gl.LINEAR_MIPMAP_LINEAR
    };
    return filterMap[filter] || gl.NEAREST;
  }
  parseWrap(wrap) {
    const gl = this.gl;
    const wrapMap = {
      'clamp': gl.CLAMP_TO_EDGE,
      'repeat': gl.REPEAT,
      'mirror': gl.MIRRORED_REPEAT
    };
    return wrapMap[wrap] || gl.CLAMP_TO_EDGE;
  }
  getGLFormat() {
    const gl = this.gl;
    const formatMap = {
      'alpha': gl.ALPHA,
      'luminance': gl.LUMINANCE,
      'luminance alpha': gl.LUMINANCE_ALPHA,
      'rgb': gl.RGB,
      'rgba': gl.RGBA
    };
    return formatMap[this.format] || gl.RGBA;
  }
  getGLType() {
    const gl = this.gl;
    const typeMap = {
      'uint8': gl.UNSIGNED_BYTE,
      'uint16': gl.UNSIGNED_SHORT,
      'float': gl.FLOAT
    };
    return typeMap[this.type] || gl.UNSIGNED_BYTE;
  }
  setupTexture(data = null) {
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    if (data) {
      // If data is provided (image, video, canvas, etc.)
      if (data instanceof HTMLImageElement || data instanceof HTMLVideoElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, glFormat, glType, data);
        this.width = data.width || data.videoWidth || 1;
        this.height = data.height || data.videoHeight || 1;
      } else if (ArrayBuffer.isView(data)) {
        // Typed array data
        gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, data);
      }
    } else {
      // Create empty texture
      gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, null);
    }
  }
  setParameters() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);
  }
  bind(unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }
  unbind() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }
  resize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.bind();
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    gl.texImage2D(gl.TEXTURE_2D, 0, glFormat, width, height, 0, glFormat, glType, null);
  }
  subimage(data, x = 0, y = 0) {
    this.bind();
    const gl = this.gl;
    const glFormat = this.getGLFormat();
    const glType = this.getGLType();
    if (data instanceof HTMLImageElement || data instanceof HTMLVideoElement || data instanceof HTMLCanvasElement || data instanceof ImageData) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, glFormat, glType, data);
    } else if (ArrayBuffer.isView(data)) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, this.width, this.height, glFormat, glType, data);
    }
  }
  destroy() {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}
exports.Texture = Texture;

},{}]},{},[18])(18)
});
