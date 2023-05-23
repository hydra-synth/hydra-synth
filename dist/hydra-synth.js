var Output = function({ regl: o, precision: c, label: m = "", width: E, height: D }) {
  this.regl = o, this.precision = c, this.label = m, this.positionBuffer = this.regl.buffer([
    [-2, 0],
    [0, -2],
    [2, 2]
  ]), this.draw = () => {
  }, this.init(), this.pingPongIndex = 0, this.fbos = Array(2).fill().map(() => this.regl.framebuffer({
    color: this.regl.texture({
      mag: "nearest",
      width: E,
      height: D,
      format: "rgba"
    }),
    depthStencil: !1
  }));
};
Output.prototype.resize = function(o, c) {
  this.fbos.forEach((m) => {
    m.resize(o, c);
  });
};
Output.prototype.getCurrent = function() {
  return this.fbos[this.pingPongIndex];
};
Output.prototype.getTexture = function() {
  var o = this.pingPongIndex ? 0 : 1;
  return this.fbos[o];
};
Output.prototype.init = function() {
  return this.transformIndex = 0, this.fragHeader = `
  precision ${this.precision} float;

  uniform float time;
  varying vec2 uv;
  `, this.fragBody = "", this.vert = `
  precision ${this.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`, this.attributes = {
    position: this.positionBuffer
  }, this.uniforms = {
    time: this.regl.prop("time"),
    resolution: this.regl.prop("resolution")
  }, this.frag = `
       ${this.fragHeader}

      void main () {
        vec4 c = vec4(0, 0, 0, 0);
        vec2 st = uv;
        ${this.fragBody}
        gl_FragColor = c;
      }
  `, this;
};
Output.prototype.render = function(o) {
  let c = o[0];
  var m = this, E = Object.assign(c.uniforms, {
    prevBuffer: () => m.fbos[m.pingPongIndex]
  });
  m.draw = m.regl({
    frag: c.frag,
    vert: m.vert,
    attributes: m.attributes,
    uniforms: E,
    count: 3,
    framebuffer: () => (m.pingPongIndex = m.pingPongIndex ? 0 : 1, m.fbos[m.pingPongIndex])
  });
};
Output.prototype.tick = function(o) {
  this.draw(o);
};
var commonjsGlobal = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function getDefaultExportFromCjs(o) {
  return o && o.__esModule && Object.prototype.hasOwnProperty.call(o, "default") ? o.default : o;
}
var inherits_browser = { exports: {} };
typeof Object.create == "function" ? inherits_browser.exports = function(c, m) {
  m && (c.super_ = m, c.prototype = Object.create(m.prototype, {
    constructor: {
      value: c,
      enumerable: !1,
      writable: !0,
      configurable: !0
    }
  }));
} : inherits_browser.exports = function(c, m) {
  if (m) {
    c.super_ = m;
    var E = function() {
    };
    E.prototype = m.prototype, c.prototype = new E(), c.prototype.constructor = c;
  }
};
var inherits_browserExports = inherits_browser.exports;
function EventEmitter$1() {
  this._events = this._events || {}, this._maxListeners = this._maxListeners || void 0;
}
var events = EventEmitter$1;
EventEmitter$1.EventEmitter = EventEmitter$1;
EventEmitter$1.prototype._events = void 0;
EventEmitter$1.prototype._maxListeners = void 0;
EventEmitter$1.defaultMaxListeners = 10;
EventEmitter$1.prototype.setMaxListeners = function(o) {
  if (!isNumber(o) || o < 0 || isNaN(o))
    throw TypeError("n must be a positive number");
  return this._maxListeners = o, this;
};
EventEmitter$1.prototype.emit = function(o) {
  var c, m, E, D, J, Se;
  if (this._events || (this._events = {}), o === "error" && (!this._events.error || isObject(this._events.error) && !this._events.error.length)) {
    if (c = arguments[1], c instanceof Error)
      throw c;
    var he = new Error('Uncaught, unspecified "error" event. (' + c + ")");
    throw he.context = c, he;
  }
  if (m = this._events[o], isUndefined(m))
    return !1;
  if (isFunction(m))
    switch (arguments.length) {
      case 1:
        m.call(this);
        break;
      case 2:
        m.call(this, arguments[1]);
        break;
      case 3:
        m.call(this, arguments[1], arguments[2]);
        break;
      default:
        D = Array.prototype.slice.call(arguments, 1), m.apply(this, D);
    }
  else if (isObject(m))
    for (D = Array.prototype.slice.call(arguments, 1), Se = m.slice(), E = Se.length, J = 0; J < E; J++)
      Se[J].apply(this, D);
  return !0;
};
EventEmitter$1.prototype.addListener = function(o, c) {
  var m;
  if (!isFunction(c))
    throw TypeError("listener must be a function");
  return this._events || (this._events = {}), this._events.newListener && this.emit(
    "newListener",
    o,
    isFunction(c.listener) ? c.listener : c
  ), this._events[o] ? isObject(this._events[o]) ? this._events[o].push(c) : this._events[o] = [this._events[o], c] : this._events[o] = c, isObject(this._events[o]) && !this._events[o].warned && (isUndefined(this._maxListeners) ? m = EventEmitter$1.defaultMaxListeners : m = this._maxListeners, m && m > 0 && this._events[o].length > m && (this._events[o].warned = !0, console.error(
    "(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.",
    this._events[o].length
  ), typeof console.trace == "function" && console.trace())), this;
};
EventEmitter$1.prototype.on = EventEmitter$1.prototype.addListener;
EventEmitter$1.prototype.once = function(o, c) {
  if (!isFunction(c))
    throw TypeError("listener must be a function");
  var m = !1;
  function E() {
    this.removeListener(o, E), m || (m = !0, c.apply(this, arguments));
  }
  return E.listener = c, this.on(o, E), this;
};
EventEmitter$1.prototype.removeListener = function(o, c) {
  var m, E, D, J;
  if (!isFunction(c))
    throw TypeError("listener must be a function");
  if (!this._events || !this._events[o])
    return this;
  if (m = this._events[o], D = m.length, E = -1, m === c || isFunction(m.listener) && m.listener === c)
    delete this._events[o], this._events.removeListener && this.emit("removeListener", o, c);
  else if (isObject(m)) {
    for (J = D; J-- > 0; )
      if (m[J] === c || m[J].listener && m[J].listener === c) {
        E = J;
        break;
      }
    if (E < 0)
      return this;
    m.length === 1 ? (m.length = 0, delete this._events[o]) : m.splice(E, 1), this._events.removeListener && this.emit("removeListener", o, c);
  }
  return this;
};
EventEmitter$1.prototype.removeAllListeners = function(o) {
  var c, m;
  if (!this._events)
    return this;
  if (!this._events.removeListener)
    return arguments.length === 0 ? this._events = {} : this._events[o] && delete this._events[o], this;
  if (arguments.length === 0) {
    for (c in this._events)
      c !== "removeListener" && this.removeAllListeners(c);
    return this.removeAllListeners("removeListener"), this._events = {}, this;
  }
  if (m = this._events[o], isFunction(m))
    this.removeListener(o, m);
  else if (m)
    for (; m.length; )
      this.removeListener(o, m[m.length - 1]);
  return delete this._events[o], this;
};
EventEmitter$1.prototype.listeners = function(o) {
  var c;
  return !this._events || !this._events[o] ? c = [] : isFunction(this._events[o]) ? c = [this._events[o]] : c = this._events[o].slice(), c;
};
EventEmitter$1.prototype.listenerCount = function(o) {
  if (this._events) {
    var c = this._events[o];
    if (isFunction(c))
      return 1;
    if (c)
      return c.length;
  }
  return 0;
};
EventEmitter$1.listenerCount = function(o, c) {
  return o.listenerCount(c);
};
function isFunction(o) {
  return typeof o == "function";
}
function isNumber(o) {
  return typeof o == "number";
}
function isObject(o) {
  return typeof o == "object" && o !== null;
}
function isUndefined(o) {
  return o === void 0;
}
var browser = commonjsGlobal.performance && commonjsGlobal.performance.now ? function() {
  return performance.now();
} : Date.now || function() {
  return +/* @__PURE__ */ new Date();
}, raf$2 = { exports: {} }, performanceNow = { exports: {} };
(function() {
  var o, c, m, E, D, J;
  typeof performance < "u" && performance !== null && performance.now ? performanceNow.exports = function() {
    return performance.now();
  } : typeof process < "u" && process !== null && process.hrtime ? (performanceNow.exports = function() {
    return (o() - D) / 1e6;
  }, c = process.hrtime, o = function() {
    var Se;
    return Se = c(), Se[0] * 1e9 + Se[1];
  }, E = o(), J = process.uptime() * 1e9, D = E - J) : Date.now ? (performanceNow.exports = function() {
    return Date.now() - m;
  }, m = Date.now()) : (performanceNow.exports = function() {
    return (/* @__PURE__ */ new Date()).getTime() - m;
  }, m = (/* @__PURE__ */ new Date()).getTime());
}).call(commonjsGlobal);
var performanceNowExports = performanceNow.exports, now$1 = performanceNowExports, root = typeof window > "u" ? commonjsGlobal : window, vendors = ["moz", "webkit"], suffix = "AnimationFrame", raf$1 = root["request" + suffix], caf = root["cancel" + suffix] || root["cancelRequest" + suffix];
for (var i = 0; !raf$1 && i < vendors.length; i++)
  raf$1 = root[vendors[i] + "Request" + suffix], caf = root[vendors[i] + "Cancel" + suffix] || root[vendors[i] + "CancelRequest" + suffix];
if (!raf$1 || !caf) {
  var last = 0, id = 0, queue = [], frameDuration = 1e3 / 60;
  raf$1 = function(o) {
    if (queue.length === 0) {
      var c = now$1(), m = Math.max(0, frameDuration - (c - last));
      last = m + c, setTimeout(function() {
        var E = queue.slice(0);
        queue.length = 0;
        for (var D = 0; D < E.length; D++)
          if (!E[D].cancelled)
            try {
              E[D].callback(last);
            } catch (J) {
              setTimeout(function() {
                throw J;
              }, 0);
            }
      }, Math.round(m));
    }
    return queue.push({
      handle: ++id,
      callback: o,
      cancelled: !1
    }), id;
  }, caf = function(o) {
    for (var c = 0; c < queue.length; c++)
      queue[c].handle === o && (queue[c].cancelled = !0);
  };
}
raf$2.exports = function(o) {
  return raf$1.call(root, o);
};
raf$2.exports.cancel = function() {
  caf.apply(root, arguments);
};
raf$2.exports.polyfill = function(o) {
  o || (o = root), o.requestAnimationFrame = raf$1, o.cancelAnimationFrame = caf;
};
var rafExports = raf$2.exports, inherits = inherits_browserExports, EventEmitter = events.EventEmitter, now = browser, raf = rafExports, rafLoop = Engine;
function Engine(o) {
  if (!(this instanceof Engine))
    return new Engine(o);
  this.running = !1, this.last = now(), this._frame = 0, this._tick = this.tick.bind(this), o && this.on("tick", o);
}
inherits(Engine, EventEmitter);
Engine.prototype.start = function() {
  if (!this.running)
    return this.running = !0, this.last = now(), this._frame = raf(this._tick), this;
};
Engine.prototype.stop = function() {
  return this.running = !1, this._frame !== 0 && raf.cancel(this._frame), this._frame = 0, this;
};
Engine.prototype.tick = function() {
  this._frame = raf(this._tick);
  var o = now(), c = o - this.last;
  this.emit("tick", c), this.last = o;
};
const loop = /* @__PURE__ */ getDefaultExportFromCjs(rafLoop);
function Webcam(o) {
  return navigator.mediaDevices.enumerateDevices().then((c) => c.filter((m) => m.kind === "videoinput")).then((c) => {
    let m = { audio: !1, video: !0 };
    return c[o] && (m.video = {
      deviceId: { exact: c[o].deviceId }
    }), window.navigator.mediaDevices.getUserMedia(m);
  }).then((c) => {
    const m = document.createElement("video");
    return m.setAttribute("autoplay", ""), m.setAttribute("muted", ""), m.setAttribute("playsinline", ""), m.srcObject = c, new Promise((E, D) => {
      m.addEventListener("loadedmetadata", () => {
        m.play().then(() => E({ video: m }));
      });
    });
  }).catch(console.log.bind(console));
}
function Screen(o) {
  return new Promise(function(c, m) {
    navigator.mediaDevices.getDisplayMedia(o).then((E) => {
      const D = document.createElement("video");
      D.srcObject = E, D.addEventListener("loadedmetadata", () => {
        D.play(), c({ video: D });
      });
    }).catch((E) => m(E));
  });
}
class HydraSource {
  constructor({ regl: c, width: m, height: E, pb: D, label: J = "" }) {
    this.label = J, this.regl = c, this.src = null, this.dynamic = !0, this.width = m, this.height = E, this.tex = this.regl.texture({
      //  shape: [width, height]
      shape: [1, 1]
    }), this.pb = D;
  }
  init(c, m) {
    "src" in c && (this.src = c.src, this.tex = this.regl.texture({ data: this.src, ...m })), "dynamic" in c && (this.dynamic = c.dynamic);
  }
  initCam(c, m) {
    const E = this;
    Webcam(c).then((D) => {
      E.src = D.video, E.dynamic = !0, E.tex = E.regl.texture({ data: E.src, ...m });
    }).catch((D) => console.log("could not get camera", D));
  }
  initVideo(c = "", m) {
    const E = document.createElement("video");
    E.crossOrigin = "anonymous", E.autoplay = !0, E.loop = !0, E.muted = !0, E.addEventListener("loadeddata", () => {
      this.src = E, E.play(), this.tex = this.regl.texture({ data: this.src, ...m }), this.dynamic = !0;
    }), E.src = c;
  }
  initImage(c = "", m) {
    const E = document.createElement("img");
    E.crossOrigin = "anonymous", E.src = c, E.onload = () => {
      this.src = E, this.dynamic = !1, this.tex = this.regl.texture({ data: this.src, ...m });
    };
  }
  initStream(c, m) {
    let E = this;
    c && this.pb && (this.pb.initSource(c), this.pb.on("got video", function(D, J) {
      D === c && (E.src = J, E.dynamic = !0, E.tex = E.regl.texture({ data: E.src, ...m }));
    }));
  }
  // index only relevant in atom-hydra + desktop apps
  initScreen(c = 0, m) {
    const E = this;
    Screen().then(function(D) {
      E.src = D.video, E.tex = E.regl.texture({ data: E.src, ...m }), E.dynamic = !0;
    }).catch((D) => console.log("could not get screen", D));
  }
  resize(c, m) {
    this.width = c, this.height = m;
  }
  clear() {
    this.src && this.src.srcObject && this.src.srcObject.getTracks && this.src.srcObject.getTracks().forEach((c) => c.stop()), this.src = null, this.tex = this.regl.texture({ shape: [1, 1] });
  }
  tick(c) {
    this.src !== null && this.dynamic === !0 && (this.src.videoWidth && this.src.videoWidth !== this.tex.width && (console.log(
      this.src.videoWidth,
      this.src.videoHeight,
      this.tex.width,
      this.tex.height
    ), this.tex.resize(this.src.videoWidth, this.src.videoHeight)), this.src.width && this.src.width !== this.tex.width && this.tex.resize(this.src.width, this.src.height), this.tex.subimage(this.src));
  }
  getTexture() {
    return this.tex;
  }
}
const mouse = {};
function mouseButtons(o) {
  if (typeof o == "object") {
    if ("buttons" in o)
      return o.buttons;
    if ("which" in o) {
      var c = o.which;
      if (c === 2)
        return 4;
      if (c === 3)
        return 2;
      if (c > 0)
        return 1 << c - 1;
    } else if ("button" in o) {
      var c = o.button;
      if (c === 1)
        return 4;
      if (c === 2)
        return 2;
      if (c >= 0)
        return 1 << c;
    }
  }
  return 0;
}
mouse.buttons = mouseButtons;
function mouseElement(o) {
  return o.target || o.srcElement || window;
}
mouse.element = mouseElement;
function mouseRelativeX(o) {
  return typeof o == "object" && "pageX" in o ? o.pageX : 0;
}
mouse.x = mouseRelativeX;
function mouseRelativeY(o) {
  return typeof o == "object" && "pageY" in o ? o.pageY : 0;
}
mouse.y = mouseRelativeY;
function mouseListen(o, c) {
  c || (c = o, o = window);
  var m = 0, E = 0, D = 0, J = {
    shift: !1,
    alt: !1,
    control: !1,
    meta: !1
  }, Se = !1;
  function he(Be) {
    var it = !1;
    return "altKey" in Be && (it = it || Be.altKey !== J.alt, J.alt = !!Be.altKey), "shiftKey" in Be && (it = it || Be.shiftKey !== J.shift, J.shift = !!Be.shiftKey), "ctrlKey" in Be && (it = it || Be.ctrlKey !== J.control, J.control = !!Be.ctrlKey), "metaKey" in Be && (it = it || Be.metaKey !== J.meta, J.meta = !!Be.metaKey), it;
  }
  function Ie(Be, it) {
    var Yt = mouse.x(it), At = mouse.y(it);
    "buttons" in it && (Be = it.buttons | 0), (Be !== m || Yt !== E || At !== D || he(it)) && (m = Be | 0, E = Yt || 0, D = At || 0, c && c(m, E, D, J));
  }
  function be(Be) {
    Ie(0, Be);
  }
  function vt() {
    (m || E || D || J.shift || J.alt || J.meta || J.control) && (E = D = 0, m = 0, J.shift = J.alt = J.control = J.meta = !1, c && c(0, 0, 0, J));
  }
  function He(Be) {
    he(Be) && c && c(m, E, D, J);
  }
  function We(Be) {
    mouse.buttons(Be) === 0 ? Ie(0, Be) : Ie(m, Be);
  }
  function mt(Be) {
    Ie(m | mouse.buttons(Be), Be);
  }
  function st(Be) {
    Ie(m & ~mouse.buttons(Be), Be);
  }
  function yt() {
    Se || (Se = !0, o.addEventListener("mousemove", We), o.addEventListener("mousedown", mt), o.addEventListener("mouseup", st), o.addEventListener("mouseleave", be), o.addEventListener("mouseenter", be), o.addEventListener("mouseout", be), o.addEventListener("mouseover", be), o.addEventListener("blur", vt), o.addEventListener("keyup", He), o.addEventListener("keydown", He), o.addEventListener("keypress", He), o !== window && (window.addEventListener("blur", vt), window.addEventListener("keyup", He), window.addEventListener("keydown", He), window.addEventListener("keypress", He)));
  }
  function Wt() {
    Se && (Se = !1, o.removeEventListener("mousemove", We), o.removeEventListener("mousedown", mt), o.removeEventListener("mouseup", st), o.removeEventListener("mouseleave", be), o.removeEventListener("mouseenter", be), o.removeEventListener("mouseout", be), o.removeEventListener("mouseover", be), o.removeEventListener("blur", vt), o.removeEventListener("keyup", He), o.removeEventListener("keydown", He), o.removeEventListener("keypress", He), o !== window && (window.removeEventListener("blur", vt), window.removeEventListener("keyup", He), window.removeEventListener("keydown", He), window.removeEventListener("keypress", He)));
  }
  yt();
  var Et = {
    element: o
  };
  return Object.defineProperties(Et, {
    enabled: {
      get: function() {
        return Se;
      },
      set: function(Be) {
        Be ? yt() : Wt();
      },
      enumerable: !0
    },
    buttons: {
      get: function() {
        return m;
      },
      enumerable: !0
    },
    x: {
      get: function() {
        return E;
      },
      enumerable: !0
    },
    y: {
      get: function() {
        return D;
      },
      enumerable: !0
    },
    mods: {
      get: function() {
        return J;
      },
      enumerable: !0
    }
  }), Et;
}
var meyda_min = { exports: {} };
(function(o, c) {
  (function(m, E) {
    o.exports = E();
  })(commonjsGlobal, function() {
    function m(T, _, $) {
      if ($ || arguments.length === 2)
        for (var C, ee = 0, ce = _.length; ee < ce; ee++)
          !C && ee in _ || (C || (C = Array.prototype.slice.call(_, 0, ee)), C[ee] = _[ee]);
      return T.concat(C || Array.prototype.slice.call(_));
    }
    var E = Object.freeze({ __proto__: null, blackman: function(T) {
      for (var _ = new Float32Array(T), $ = 2 * Math.PI / (T - 1), C = 2 * $, ee = 0; ee < T / 2; ee++)
        _[ee] = 0.42 - 0.5 * Math.cos(ee * $) + 0.08 * Math.cos(ee * C);
      for (ee = Math.ceil(T / 2); ee > 0; ee--)
        _[T - ee] = _[ee - 1];
      return _;
    }, sine: function(T) {
      for (var _ = Math.PI / (T - 1), $ = new Float32Array(T), C = 0; C < T; C++)
        $[C] = Math.sin(_ * C);
      return $;
    }, hanning: function(T) {
      for (var _ = new Float32Array(T), $ = 0; $ < T; $++)
        _[$] = 0.5 - 0.5 * Math.cos(2 * Math.PI * $ / (T - 1));
      return _;
    }, hamming: function(T) {
      for (var _ = new Float32Array(T), $ = 0; $ < T; $++)
        _[$] = 0.54 - 0.46 * Math.cos(2 * Math.PI * ($ / T - 1));
      return _;
    } }), D = {};
    function J(T) {
      for (; T % 2 == 0 && T > 1; )
        T /= 2;
      return T === 1;
    }
    function Se(T, _) {
      if (_ !== "rect") {
        if (_ !== "" && _ || (_ = "hanning"), D[_] || (D[_] = {}), !D[_][T.length])
          try {
            D[_][T.length] = E[_](T.length);
          } catch {
            throw new Error("Invalid windowing function");
          }
        T = function($, C) {
          for (var ee = [], ce = 0; ce < Math.min($.length, C.length); ce++)
            ee[ce] = $[ce] * C[ce];
          return ee;
        }(T, D[_][T.length]);
      }
      return T;
    }
    function he(T, _, $) {
      for (var C = new Float32Array(T), ee = 0; ee < C.length; ee++)
        C[ee] = ee * _ / $, C[ee] = 13 * Math.atan(C[ee] / 1315.8) + 3.5 * Math.atan(Math.pow(C[ee] / 7518, 2));
      return C;
    }
    function Ie(T) {
      return Float32Array.from(T);
    }
    function be(T) {
      return 1125 * Math.log(1 + T / 700);
    }
    function vt(T, _, $) {
      for (var C, ee = new Float32Array(T + 2), ce = new Float32Array(T + 2), Ae = _ / 2, ke = be(0), Te = (be(Ae) - ke) / (T + 1), we = new Array(T + 2), Pe = 0; Pe < ee.length; Pe++)
        ee[Pe] = Pe * Te, ce[Pe] = (C = ee[Pe], 700 * (Math.exp(C / 1125) - 1)), we[Pe] = Math.floor(($ + 1) * ce[Pe] / _);
      for (var ut = new Array(T), Ue = 0; Ue < ut.length; Ue++) {
        for (ut[Ue] = new Array($ / 2 + 1).fill(0), Pe = we[Ue]; Pe < we[Ue + 1]; Pe++)
          ut[Ue][Pe] = (Pe - we[Ue]) / (we[Ue + 1] - we[Ue]);
        for (Pe = we[Ue + 1]; Pe < we[Ue + 2]; Pe++)
          ut[Ue][Pe] = (we[Ue + 2] - Pe) / (we[Ue + 2] - we[Ue + 1]);
      }
      return ut;
    }
    function He(T, _, $, C, ee, ce, Ae) {
      C === void 0 && (C = 5), ee === void 0 && (ee = 2), ce === void 0 && (ce = !0), Ae === void 0 && (Ae = 440);
      var ke = Math.floor($ / 2) + 1, Te = new Array($).fill(0).map(function(Qe, ct) {
        return T * function(pt, Gt) {
          return Math.log2(16 * pt / Gt);
        }(_ * ct / $, Ae);
      });
      Te[0] = Te[1] - 1.5 * T;
      var we, Pe, ut, Ue = Te.slice(1).map(function(Qe, ct) {
        return Math.max(Qe - Te[ct]);
      }, 1).concat([1]), Ct = Math.round(T / 2), wt = new Array(T).fill(0).map(function(Qe, ct) {
        return Te.map(function(pt) {
          return (10 * T + Ct + pt - ct) % T - Ct;
        });
      }), St = wt.map(function(Qe, ct) {
        return Qe.map(function(pt, Gt) {
          return Math.exp(-0.5 * Math.pow(2 * wt[ct][Gt] / Ue[Gt], 2));
        });
      });
      if (Pe = (we = St)[0].map(function() {
        return 0;
      }), ut = we.reduce(function(Qe, ct) {
        return ct.forEach(function(pt, Gt) {
          Qe[Gt] += Math.pow(pt, 2);
        }), Qe;
      }, Pe).map(Math.sqrt), St = we.map(function(Qe, ct) {
        return Qe.map(function(pt, Gt) {
          return pt / (ut[Gt] || 1);
        });
      }), ee) {
        var Lr = Te.map(function(Qe) {
          return Math.exp(-0.5 * Math.pow((Qe / T - C) / ee, 2));
        });
        St = St.map(function(Qe) {
          return Qe.map(function(ct, pt) {
            return ct * Lr[pt];
          });
        });
      }
      return ce && (St = m(m([], St.slice(3), !0), St.slice(0, 3), !0)), St.map(function(Qe) {
        return Qe.slice(0, ke);
      });
    }
    function We(T, _) {
      for (var $ = 0, C = 0, ee = 0; ee < _.length; ee++)
        $ += Math.pow(ee, T) * Math.abs(_[ee]), C += _[ee];
      return $ / C;
    }
    function mt(T) {
      var _ = T.ampSpectrum, $ = T.barkScale, C = T.numberOfBarkBands, ee = C === void 0 ? 24 : C;
      if (typeof _ != "object" || typeof $ != "object")
        throw new TypeError();
      var ce = ee, Ae = new Float32Array(ce), ke = 0, Te = _, we = new Int32Array(ce + 1);
      we[0] = 0;
      for (var Pe = $[Te.length - 1] / ce, ut = 1, Ue = 0; Ue < Te.length; Ue++)
        for (; $[Ue] > Pe; )
          we[ut++] = Ue, Pe = ut * $[Te.length - 1] / ce;
      for (we[ce] = Te.length - 1, Ue = 0; Ue < ce; Ue++) {
        for (var Ct = 0, wt = we[Ue]; wt < we[Ue + 1]; wt++)
          Ct += Te[wt];
        Ae[Ue] = Math.pow(Ct, 0.23);
      }
      for (Ue = 0; Ue < Ae.length; Ue++)
        ke += Ae[Ue];
      return { specific: Ae, total: ke };
    }
    function st(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      for (var $ = new Float32Array(_.length), C = 0; C < $.length; C++)
        $[C] = Math.pow(_[C], 2);
      return $;
    }
    function yt(T) {
      var _ = T.ampSpectrum, $ = T.melFilterBank, C = T.bufferSize;
      if (typeof _ != "object")
        throw new TypeError("Valid ampSpectrum is required to generate melBands");
      if (typeof $ != "object")
        throw new TypeError("Valid melFilterBank is required to generate melBands");
      for (var ee = st({ ampSpectrum: _ }), ce = $.length, Ae = Array(ce), ke = new Float32Array(ce), Te = 0; Te < ke.length; Te++) {
        Ae[Te] = new Float32Array(C / 2), ke[Te] = 0;
        for (var we = 0; we < C / 2; we++)
          Ae[Te][we] = $[Te][we] * ee[we], ke[Te] += Ae[Te][we];
        ke[Te] = Math.log(ke[Te] + 1);
      }
      return Array.prototype.slice.call(ke);
    }
    function Wt(T) {
      return T && T.__esModule && Object.prototype.hasOwnProperty.call(T, "default") ? T.default : T;
    }
    var Et = {}, Be = null, it = function(T, _) {
      var $ = T.length;
      return _ = _ || 2, Be && Be[$] || function(C) {
        (Be = Be || {})[C] = new Array(C * C);
        for (var ee = Math.PI / C, ce = 0; ce < C; ce++)
          for (var Ae = 0; Ae < C; Ae++)
            Be[C][Ae + ce * C] = Math.cos(ee * (Ae + 0.5) * ce);
      }($), T.map(function() {
        return 0;
      }).map(function(C, ee) {
        return _ * T.reduce(function(ce, Ae, ke, Te) {
          return ce + Ae * Be[$][ke + ee * $];
        }, 0);
      });
    };
    (function(T) {
      T.exports = it;
    })({ get exports() {
      return Et;
    }, set exports(T) {
      Et = T;
    } });
    var Yt = Wt(Et), At = Object.freeze({ __proto__: null, buffer: function(T) {
      return T.signal;
    }, rms: function(T) {
      var _ = T.signal;
      if (typeof _ != "object")
        throw new TypeError();
      for (var $ = 0, C = 0; C < _.length; C++)
        $ += Math.pow(_[C], 2);
      return $ /= _.length, $ = Math.sqrt($);
    }, energy: function(T) {
      var _ = T.signal;
      if (typeof _ != "object")
        throw new TypeError();
      for (var $ = 0, C = 0; C < _.length; C++)
        $ += Math.pow(Math.abs(_[C]), 2);
      return $;
    }, complexSpectrum: function(T) {
      return T.complexSpectrum;
    }, spectralSlope: function(T) {
      var _ = T.ampSpectrum, $ = T.sampleRate, C = T.bufferSize;
      if (typeof _ != "object")
        throw new TypeError();
      for (var ee = 0, ce = 0, Ae = new Float32Array(_.length), ke = 0, Te = 0, we = 0; we < _.length; we++) {
        ee += _[we];
        var Pe = we * $ / C;
        Ae[we] = Pe, ke += Pe * Pe, ce += Pe, Te += Pe * _[we];
      }
      return (_.length * Te - ce * ee) / (ee * (ke - Math.pow(ce, 2)));
    }, spectralCentroid: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      return We(1, _);
    }, spectralRolloff: function(T) {
      var _ = T.ampSpectrum, $ = T.sampleRate;
      if (typeof _ != "object")
        throw new TypeError();
      for (var C = _, ee = $ / (2 * (C.length - 1)), ce = 0, Ae = 0; Ae < C.length; Ae++)
        ce += C[Ae];
      for (var ke = 0.99 * ce, Te = C.length - 1; ce > ke && Te >= 0; )
        ce -= C[Te], --Te;
      return (Te + 1) * ee;
    }, spectralFlatness: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      for (var $ = 0, C = 0, ee = 0; ee < _.length; ee++)
        $ += Math.log(_[ee]), C += _[ee];
      return Math.exp($ / _.length) * _.length / C;
    }, spectralSpread: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      return Math.sqrt(We(2, _) - Math.pow(We(1, _), 2));
    }, spectralSkewness: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      var $ = We(1, _), C = We(2, _), ee = We(3, _);
      return (2 * Math.pow($, 3) - 3 * $ * C + ee) / Math.pow(Math.sqrt(C - Math.pow($, 2)), 3);
    }, spectralKurtosis: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      var $ = _, C = We(1, $), ee = We(2, $), ce = We(3, $), Ae = We(4, $);
      return (-3 * Math.pow(C, 4) + 6 * C * ee - 4 * C * ce + Ae) / Math.pow(Math.sqrt(ee - Math.pow(C, 2)), 4);
    }, amplitudeSpectrum: function(T) {
      return T.ampSpectrum;
    }, zcr: function(T) {
      var _ = T.signal;
      if (typeof _ != "object")
        throw new TypeError();
      for (var $ = 0, C = 1; C < _.length; C++)
        (_[C - 1] >= 0 && _[C] < 0 || _[C - 1] < 0 && _[C] >= 0) && $++;
      return $;
    }, loudness: mt, perceptualSpread: function(T) {
      for (var _ = mt({ ampSpectrum: T.ampSpectrum, barkScale: T.barkScale }), $ = 0, C = 0; C < _.specific.length; C++)
        _.specific[C] > $ && ($ = _.specific[C]);
      return Math.pow((_.total - $) / _.total, 2);
    }, perceptualSharpness: function(T) {
      for (var _ = mt({ ampSpectrum: T.ampSpectrum, barkScale: T.barkScale }), $ = _.specific, C = 0, ee = 0; ee < $.length; ee++)
        C += ee < 15 ? (ee + 1) * $[ee + 1] : 0.066 * Math.exp(0.171 * (ee + 1));
      return C *= 0.11 / _.total;
    }, powerSpectrum: st, mfcc: function(T) {
      var _ = T.ampSpectrum, $ = T.melFilterBank, C = T.numberOfMFCCCoefficients, ee = T.bufferSize, ce = Math.min(40, Math.max(1, C || 13));
      if ($.length < ce)
        throw new Error("Insufficient filter bank for requested number of coefficients");
      var Ae = yt({ ampSpectrum: _, melFilterBank: $, bufferSize: ee });
      return Yt(Ae).slice(0, ce);
    }, chroma: function(T) {
      var _ = T.ampSpectrum, $ = T.chromaFilterBank;
      if (typeof _ != "object")
        throw new TypeError("Valid ampSpectrum is required to generate chroma");
      if (typeof $ != "object")
        throw new TypeError("Valid chromaFilterBank is required to generate chroma");
      var C = $.map(function(ce, Ae) {
        return _.reduce(function(ke, Te, we) {
          return ke + Te * ce[we];
        }, 0);
      }), ee = Math.max.apply(Math, C);
      return ee ? C.map(function(ce) {
        return ce / ee;
      }) : C;
    }, spectralFlux: function(T) {
      var _ = T.signal, $ = T.previousSignal, C = T.bufferSize;
      if (typeof _ != "object" || typeof $ != "object")
        throw new TypeError();
      for (var ee = 0, ce = -C / 2; ce < _.length / 2 - 1; ce++)
        x = Math.abs(_[ce]) - Math.abs($[ce]), ee += (x + Math.abs(x)) / 2;
      return ee;
    }, spectralCrest: function(T) {
      var _ = T.ampSpectrum;
      if (typeof _ != "object")
        throw new TypeError();
      var $ = 0, C = -1 / 0;
      return _.forEach(function(ee) {
        $ += Math.pow(ee, 2), C = ee > C ? ee : C;
      }), $ /= _.length, $ = Math.sqrt($), C / $;
    }, melBands: yt });
    function Hr(T) {
      if (Array.isArray(T)) {
        for (var _ = 0, $ = Array(T.length); _ < T.length; _++)
          $[_] = T[_];
        return $;
      }
      return Array.from(T);
    }
    var qt = {}, Sr = {}, $t = { bitReverseArray: function(T) {
      if (qt[T] === void 0) {
        for (var _ = (T - 1).toString(2).length, $ = "0".repeat(_), C = {}, ee = 0; ee < T; ee++) {
          var ce = ee.toString(2);
          ce = $.substr(ce.length) + ce, ce = [].concat(Hr(ce)).reverse().join(""), C[ee] = parseInt(ce, 2);
        }
        qt[T] = C;
      }
      return qt[T];
    }, multiply: function(T, _) {
      return { real: T.real * _.real - T.imag * _.imag, imag: T.real * _.imag + T.imag * _.real };
    }, add: function(T, _) {
      return { real: T.real + _.real, imag: T.imag + _.imag };
    }, subtract: function(T, _) {
      return { real: T.real - _.real, imag: T.imag - _.imag };
    }, euler: function(T, _) {
      var $ = -2 * Math.PI * T / _;
      return { real: Math.cos($), imag: Math.sin($) };
    }, conj: function(T) {
      return T.imag *= -1, T;
    }, constructComplexArray: function(T) {
      var _ = {};
      _.real = T.real === void 0 ? T.slice() : T.real.slice();
      var $ = _.real.length;
      return Sr[$] === void 0 && (Sr[$] = Array.apply(null, Array($)).map(Number.prototype.valueOf, 0)), _.imag = Sr[$].slice(), _;
    } }, Sn = function(T) {
      var _ = {};
      T.real === void 0 || T.imag === void 0 ? _ = $t.constructComplexArray(T) : (_.real = T.real.slice(), _.imag = T.imag.slice());
      var $ = _.real.length, C = Math.log2($);
      if (Math.round(C) != C)
        throw new Error("Input size must be a power of 2.");
      if (_.real.length != _.imag.length)
        throw new Error("Real and imaginary components must have the same length.");
      for (var ee = $t.bitReverseArray($), ce = { real: [], imag: [] }, Ae = 0; Ae < $; Ae++)
        ce.real[ee[Ae]] = _.real[Ae], ce.imag[ee[Ae]] = _.imag[Ae];
      for (var ke = 0; ke < $; ke++)
        _.real[ke] = ce.real[ke], _.imag[ke] = ce.imag[ke];
      for (var Te = 1; Te <= C; Te++)
        for (var we = Math.pow(2, Te), Pe = 0; Pe < we / 2; Pe++)
          for (var ut = $t.euler(Pe, we), Ue = 0; Ue < $ / we; Ue++) {
            var Ct = we * Ue + Pe, wt = we * Ue + Pe + we / 2, St = { real: _.real[Ct], imag: _.imag[Ct] }, Lr = { real: _.real[wt], imag: _.imag[wt] }, Qe = $t.multiply(ut, Lr), ct = $t.subtract(St, Qe);
            _.real[wt] = ct.real, _.imag[wt] = ct.imag;
            var pt = $t.add(Qe, St);
            _.real[Ct] = pt.real, _.imag[Ct] = pt.imag;
          }
      return _;
    }, Tn = Sn, Wr = function() {
      function T(_, $) {
        var C = this;
        if (this._m = $, !_.audioContext)
          throw this._m.errors.noAC;
        if (_.bufferSize && !J(_.bufferSize))
          throw this._m._errors.notPow2;
        if (!_.source)
          throw this._m._errors.noSource;
        this._m.audioContext = _.audioContext, this._m.bufferSize = _.bufferSize || this._m.bufferSize || 256, this._m.hopSize = _.hopSize || this._m.hopSize || this._m.bufferSize, this._m.sampleRate = _.sampleRate || this._m.audioContext.sampleRate || 44100, this._m.callback = _.callback, this._m.windowingFunction = _.windowingFunction || "hanning", this._m.featureExtractors = At, this._m.EXTRACTION_STARTED = _.startImmediately || !1, this._m.channel = typeof _.channel == "number" ? _.channel : 0, this._m.inputs = _.inputs || 1, this._m.outputs = _.outputs || 1, this._m.numberOfMFCCCoefficients = _.numberOfMFCCCoefficients || this._m.numberOfMFCCCoefficients || 13, this._m.numberOfBarkBands = _.numberOfBarkBands || this._m.numberOfBarkBands || 24, this._m.spn = this._m.audioContext.createScriptProcessor(this._m.bufferSize, this._m.inputs, this._m.outputs), this._m.spn.connect(this._m.audioContext.destination), this._m._featuresToExtract = _.featureExtractors || [], this._m.barkScale = he(this._m.bufferSize, this._m.sampleRate, this._m.bufferSize), this._m.melFilterBank = vt(Math.max(this._m.melBands, this._m.numberOfMFCCCoefficients), this._m.sampleRate, this._m.bufferSize), this._m.inputData = null, this._m.previousInputData = null, this._m.frame = null, this._m.previousFrame = null, this.setSource(_.source), this._m.spn.onaudioprocess = function(ee) {
          var ce;
          C._m.inputData !== null && (C._m.previousInputData = C._m.inputData), C._m.inputData = ee.inputBuffer.getChannelData(C._m.channel), C._m.previousInputData ? ((ce = new Float32Array(C._m.previousInputData.length + C._m.inputData.length - C._m.hopSize)).set(C._m.previousInputData.slice(C._m.hopSize)), ce.set(C._m.inputData, C._m.previousInputData.length - C._m.hopSize)) : ce = C._m.inputData, function(Ae, ke, Te) {
            if (Ae.length < ke)
              throw new Error("Buffer is too short for frame length");
            if (Te < 1)
              throw new Error("Hop length cannot be less that 1");
            if (ke < 1)
              throw new Error("Frame length cannot be less that 1");
            var we = 1 + Math.floor((Ae.length - ke) / Te);
            return new Array(we).fill(0).map(function(Pe, ut) {
              return Ae.slice(ut * Te, ut * Te + ke);
            });
          }(ce, C._m.bufferSize, C._m.hopSize).forEach(function(Ae) {
            C._m.frame = Ae;
            var ke = C._m.extract(C._m._featuresToExtract, C._m.frame, C._m.previousFrame);
            typeof C._m.callback == "function" && C._m.EXTRACTION_STARTED && C._m.callback(ke), C._m.previousFrame = C._m.frame;
          });
        };
      }
      return T.prototype.start = function(_) {
        this._m._featuresToExtract = _ || this._m._featuresToExtract, this._m.EXTRACTION_STARTED = !0;
      }, T.prototype.stop = function() {
        this._m.EXTRACTION_STARTED = !1;
      }, T.prototype.setSource = function(_) {
        this._m.source && this._m.source.disconnect(this._m.spn), this._m.source = _, this._m.source.connect(this._m.spn);
      }, T.prototype.setChannel = function(_) {
        _ <= this._m.inputs ? this._m.channel = _ : console.error("Channel ".concat(_, " does not exist. Make sure you've provided a value for 'inputs' that is greater than ").concat(_, " when instantiating the MeydaAnalyzer"));
      }, T.prototype.get = function(_) {
        return this._m.inputData ? this._m.extract(_ || this._m._featuresToExtract, this._m.inputData, this._m.previousInputData) : null;
      }, T;
    }(), Tr = { audioContext: null, spn: null, bufferSize: 512, sampleRate: 44100, melBands: 26, chromaBands: 12, callback: null, windowingFunction: "hanning", featureExtractors: At, EXTRACTION_STARTED: !1, numberOfMFCCCoefficients: 13, numberOfBarkBands: 24, _featuresToExtract: [], windowing: Se, _errors: { notPow2: new Error("Meyda: Buffer size must be a power of 2, e.g. 64 or 512"), featureUndef: new Error("Meyda: No features defined."), invalidFeatureFmt: new Error("Meyda: Invalid feature format"), invalidInput: new Error("Meyda: Invalid input."), noAC: new Error("Meyda: No AudioContext specified."), noSource: new Error("Meyda: No source node specified.") }, createMeydaAnalyzer: function(T) {
      return new Wr(T, Object.assign({}, Tr));
    }, listAvailableFeatureExtractors: function() {
      return Object.keys(this.featureExtractors);
    }, extract: function(T, _, $) {
      var C = this;
      if (!_)
        throw this._errors.invalidInput;
      if (typeof _ != "object")
        throw this._errors.invalidInput;
      if (!T)
        throw this._errors.featureUndef;
      if (!J(_.length))
        throw this._errors.notPow2;
      this.barkScale !== void 0 && this.barkScale.length == this.bufferSize || (this.barkScale = he(this.bufferSize, this.sampleRate, this.bufferSize)), this.melFilterBank !== void 0 && this.barkScale.length == this.bufferSize && this.melFilterBank.length == this.melBands || (this.melFilterBank = vt(Math.max(this.melBands, this.numberOfMFCCCoefficients), this.sampleRate, this.bufferSize)), this.chromaFilterBank !== void 0 && this.chromaFilterBank.length == this.chromaBands || (this.chromaFilterBank = He(this.chromaBands, this.sampleRate, this.bufferSize)), "buffer" in _ && _.buffer === void 0 ? this.signal = Ie(_) : this.signal = _;
      var ee = Kt(_, this.windowingFunction, this.bufferSize);
      if (this.signal = ee.windowedSignal, this.complexSpectrum = ee.complexSpectrum, this.ampSpectrum = ee.ampSpectrum, $) {
        var ce = Kt($, this.windowingFunction, this.bufferSize);
        this.previousSignal = ce.windowedSignal, this.previousComplexSpectrum = ce.complexSpectrum, this.previousAmpSpectrum = ce.ampSpectrum;
      }
      var Ae = function(ke) {
        return C.featureExtractors[ke]({ ampSpectrum: C.ampSpectrum, chromaFilterBank: C.chromaFilterBank, complexSpectrum: C.complexSpectrum, signal: C.signal, bufferSize: C.bufferSize, sampleRate: C.sampleRate, barkScale: C.barkScale, melFilterBank: C.melFilterBank, previousSignal: C.previousSignal, previousAmpSpectrum: C.previousAmpSpectrum, previousComplexSpectrum: C.previousComplexSpectrum, numberOfMFCCCoefficients: C.numberOfMFCCCoefficients, numberOfBarkBands: C.numberOfBarkBands });
      };
      if (typeof T == "object")
        return T.reduce(function(ke, Te) {
          var we;
          return Object.assign({}, ke, ((we = {})[Te] = Ae(Te), we));
        }, {});
      if (typeof T == "string")
        return Ae(T);
      throw this._errors.invalidFeatureFmt;
    } }, Kt = function(T, _, $) {
      var C = {};
      T.buffer === void 0 ? C.signal = Ie(T) : C.signal = T, C.windowedSignal = Se(C.signal, _), C.complexSpectrum = Tn(C.windowedSignal), C.ampSpectrum = new Float32Array($ / 2);
      for (var ee = 0; ee < $ / 2; ee++)
        C.ampSpectrum[ee] = Math.sqrt(Math.pow(C.complexSpectrum.real[ee], 2) + Math.pow(C.complexSpectrum.imag[ee], 2));
      return C;
    };
    return typeof window < "u" && (window.Meyda = Tr), Tr;
  });
})(meyda_min);
var meyda_minExports = meyda_min.exports;
const Meyda = /* @__PURE__ */ getDefaultExportFromCjs(meyda_minExports);
class Audio {
  constructor({
    numBins: c = 4,
    cutoff: m = 2,
    smooth: E = 0.4,
    max: D = 15,
    scale: J = 10,
    isDrawing: Se = !1,
    parentEl: he = document.body
  }) {
    this.vol = 0, this.scale = J, this.max = D, this.cutoff = m, this.smooth = E, this.setBins(c), this.beat = {
      holdFrames: 20,
      threshold: 40,
      _cutoff: 0,
      // adaptive based on sound state
      decay: 0.98,
      _framesSinceBeat: 0
      // keeps track of frames
    }, this.onBeat = () => {
    }, this.canvas = document.createElement("canvas"), this.canvas.width = 100, this.canvas.height = 80, this.canvas.style.width = "100px", this.canvas.style.height = "80px", this.canvas.style.position = "absolute", this.canvas.style.right = "0px", this.canvas.style.bottom = "0px", he.appendChild(this.canvas), this.isDrawing = Se, this.ctx = this.canvas.getContext("2d"), this.ctx.fillStyle = "#DFFFFF", this.ctx.strokeStyle = "#0ff", this.ctx.lineWidth = 0.5, window.navigator.mediaDevices && window.navigator.mediaDevices.getUserMedia({ video: !1, audio: !0 }).then((Ie) => {
      this.stream = Ie, this.context = new AudioContext();
      let be = this.context.createMediaStreamSource(Ie);
      this.meyda = Meyda.createMeydaAnalyzer({
        audioContext: this.context,
        source: be,
        featureExtractors: [
          "loudness"
          //  'perceptualSpread',
          //  'perceptualSharpness',
          //  'spectralCentroid'
        ]
      });
    }).catch((Ie) => console.log("ERROR", Ie));
  }
  detectBeat(c) {
    c > this.beat._cutoff && c > this.beat.threshold ? (this.onBeat(), this.beat._cutoff = c * 1.2, this.beat._framesSinceBeat = 0) : this.beat._framesSinceBeat <= this.beat.holdFrames ? this.beat._framesSinceBeat++ : (this.beat._cutoff *= this.beat.decay, this.beat._cutoff = Math.max(this.beat._cutoff, this.beat.threshold));
  }
  tick() {
    if (this.meyda) {
      var c = this.meyda.get();
      if (c && c !== null) {
        this.vol = c.loudness.total, this.detectBeat(this.vol);
        const m = (D, J) => D + J;
        let E = Math.floor(c.loudness.specific.length / this.bins.length);
        this.prevBins = this.bins.slice(0), this.bins = this.bins.map((D, J) => c.loudness.specific.slice(J * E, (J + 1) * E).reduce(m)).map((D, J) => D * (1 - this.settings[J].smooth) + this.prevBins[J] * this.settings[J].smooth), this.fft = this.bins.map((D, J) => (
          // Math.max(0, (bin - this.cutoff) / (this.max - this.cutoff))
          Math.max(0, (D - this.settings[J].cutoff) / this.settings[J].scale)
        )), this.isDrawing && this.draw();
      }
    }
  }
  setCutoff(c) {
    this.cutoff = c, this.settings = this.settings.map((m) => (m.cutoff = c, m));
  }
  setSmooth(c) {
    this.smooth = c, this.settings = this.settings.map((m) => (m.smooth = c, m));
  }
  setBins(c) {
    this.bins = Array(c).fill(0), this.prevBins = Array(c).fill(0), this.fft = Array(c).fill(0), this.settings = Array(c).fill(0).map(() => ({
      cutoff: this.cutoff,
      scale: this.scale,
      smooth: this.smooth
    })), this.bins.forEach((m, E) => {
      window["a" + E] = (D = 1, J = 0) => () => a.fft[E] * D + J;
    });
  }
  setScale(c) {
    this.scale = c, this.settings = this.settings.map((m) => (m.scale = c, m));
  }
  setMax(c) {
    this.max = c, console.log("set max is deprecated");
  }
  hide() {
    this.isDrawing = !1, this.canvas.style.display = "none";
  }
  show() {
    this.isDrawing = !0, this.canvas.style.display = "block";
  }
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var c = this.canvas.width / this.bins.length, m = this.canvas.height / (this.max * 2);
    this.bins.forEach((E, D) => {
      var J = E * m;
      this.ctx.fillRect(D * c, this.canvas.height - J, c, J);
      var Se = this.canvas.height - m * this.settings[D].cutoff;
      this.ctx.beginPath(), this.ctx.moveTo(D * c, Se), this.ctx.lineTo((D + 1) * c, Se), this.ctx.stroke();
      var he = this.canvas.height - m * (this.settings[D].scale + this.settings[D].cutoff);
      this.ctx.beginPath(), this.ctx.moveTo(D * c, he), this.ctx.lineTo((D + 1) * c, he), this.ctx.stroke();
    });
  }
}
class VideoRecorder {
  constructor(c) {
    this.mediaSource = new MediaSource(), this.stream = c, this.output = document.createElement("video"), this.output.autoplay = !0, this.output.loop = !0;
    let m = this;
    this.mediaSource.addEventListener("sourceopen", () => {
      console.log("MediaSource opened"), m.sourceBuffer = m.mediaSource.addSourceBuffer('video/webm; codecs="vp8"'), console.log("Source buffer: ", sourceBuffer);
    });
  }
  start() {
    let c = { mimeType: "video/webm;codecs=vp9" };
    this.recordedBlobs = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, c);
    } catch (m) {
      console.log("Unable to create MediaRecorder with options Object: ", m);
      try {
        c = { mimeType: "video/webm,codecs=vp9" }, this.mediaRecorder = new MediaRecorder(this.stream, c);
      } catch (E) {
        console.log("Unable to create MediaRecorder with options Object: ", E);
        try {
          c = "video/vp8", this.mediaRecorder = new MediaRecorder(this.stream, c);
        } catch (D) {
          alert(`MediaRecorder is not supported by this browser.

Try Firefox 29 or later, or Chrome 47 or later, with Enable experimental Web Platform features enabled from chrome://flags.`), console.error("Exception while creating MediaRecorder:", D);
          return;
        }
      }
    }
    console.log("Created MediaRecorder", this.mediaRecorder, "with options", c), this.mediaRecorder.onstop = this._handleStop.bind(this), this.mediaRecorder.ondataavailable = this._handleDataAvailable.bind(this), this.mediaRecorder.start(100), console.log("MediaRecorder started", this.mediaRecorder);
  }
  stop() {
    this.mediaRecorder.stop();
  }
  _handleStop() {
    const c = new Blob(this.recordedBlobs, { type: this.mediaRecorder.mimeType }), m = window.URL.createObjectURL(c);
    this.output.src = m;
    const E = document.createElement("a");
    E.style.display = "none", E.href = m;
    let D = /* @__PURE__ */ new Date();
    E.download = `hydra-${D.getFullYear()}-${D.getMonth() + 1}-${D.getDate()}-${D.getHours()}.${D.getMinutes()}.${D.getSeconds()}.webm`, document.body.appendChild(E), E.click(), setTimeout(() => {
      document.body.removeChild(E), window.URL.revokeObjectURL(m);
    }, 300);
  }
  _handleDataAvailable(c) {
    c.data && c.data.size > 0 && this.recordedBlobs.push(c.data);
  }
}
const easing = {
  // no easing, no acceleration
  linear: function(o) {
    return o;
  },
  // accelerating from zero velocity
  easeInQuad: function(o) {
    return o * o;
  },
  // decelerating to zero velocity
  easeOutQuad: function(o) {
    return o * (2 - o);
  },
  // acceleration until halfway, then deceleration
  easeInOutQuad: function(o) {
    return o < 0.5 ? 2 * o * o : -1 + (4 - 2 * o) * o;
  },
  // accelerating from zero velocity
  easeInCubic: function(o) {
    return o * o * o;
  },
  // decelerating to zero velocity
  easeOutCubic: function(o) {
    return --o * o * o + 1;
  },
  // acceleration until halfway, then deceleration
  easeInOutCubic: function(o) {
    return o < 0.5 ? 4 * o * o * o : (o - 1) * (2 * o - 2) * (2 * o - 2) + 1;
  },
  // accelerating from zero velocity
  easeInQuart: function(o) {
    return o * o * o * o;
  },
  // decelerating to zero velocity
  easeOutQuart: function(o) {
    return 1 - --o * o * o * o;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuart: function(o) {
    return o < 0.5 ? 8 * o * o * o * o : 1 - 8 * --o * o * o * o;
  },
  // accelerating from zero velocity
  easeInQuint: function(o) {
    return o * o * o * o * o;
  },
  // decelerating to zero velocity
  easeOutQuint: function(o) {
    return 1 + --o * o * o * o * o;
  },
  // acceleration until halfway, then deceleration
  easeInOutQuint: function(o) {
    return o < 0.5 ? 16 * o * o * o * o * o : 1 + 16 * --o * o * o * o * o;
  },
  // sin shape
  sin: function(o) {
    return (1 + Math.sin(Math.PI * o - Math.PI / 2)) / 2;
  }
};
var map = (o, c, m, E, D) => (o - c) * (D - E) / (m - c) + E;
const ArrayUtils = {
  init: () => {
    Array.prototype.fast = function(o = 1) {
      return this._speed = o, this;
    }, Array.prototype.smooth = function(o = 1) {
      return this._smooth = o, this;
    }, Array.prototype.ease = function(o = "linear") {
      return typeof o == "function" ? (this._smooth = 1, this._ease = o) : easing[o] && (this._smooth = 1, this._ease = easing[o]), this;
    }, Array.prototype.offset = function(o = 0.5) {
      return this._offset = o % 1, this;
    }, Array.prototype.fit = function(o = 0, c = 1) {
      let m = Math.min(...this), E = Math.max(...this);
      var D = this.map((J) => map(J, m, E, o, c));
      return D._speed = this._speed, D._smooth = this._smooth, D._ease = this._ease, D;
    };
  },
  getValue: (o = []) => ({ time: c, bpm: m }) => {
    let E = o._speed ? o._speed : 1, D = o._smooth ? o._smooth : 0, J = c * E * (m / 60) + (o._offset || 0);
    if (D !== 0) {
      let Se = o._ease ? o._ease : easing.linear, he = J - D / 2, Ie = o[Math.floor(he % o.length)], be = o[Math.floor((he + 1) % o.length)], vt = Math.min(he % 1 / D, 1);
      return Se(vt) * (be - Ie) + Ie;
    } else
      return o[Math.floor(J % o.length)], o[Math.floor(J % o.length)];
  }
}, Sandbox = (parent) => {
  var initialCode = "", sandbox = createSandbox(initialCode), addToContext = (o, c) => {
    initialCode += `
      var ${o} = ${c}
    `, sandbox = createSandbox(initialCode);
  };
  return {
    addToContext,
    eval: (o) => sandbox.eval(o)
  };
  function createSandbox(initial) {
    eval(initial);
    var localEval = function(code) {
      eval(code);
    };
    return {
      eval: localEval
    };
  }
};
class EvalSandbox {
  constructor(c, m, E = []) {
    this.makeGlobal = m, this.sandbox = Sandbox(), this.parent = c;
    var D = Object.keys(c);
    D.forEach((J) => this.add(J)), this.userProps = E;
  }
  add(c) {
    this.makeGlobal && (window[c] = this.parent[c]), this.sandbox.addToContext(c, `parent.${c}`);
  }
  // sets on window as well as synth object if global (not needed for objects, which can be set directly)
  set(c, m) {
    this.makeGlobal && (window[c] = m), this.parent[c] = m;
  }
  tick() {
    this.makeGlobal && this.userProps.forEach((c) => {
      this.parent[c] = window[c];
    });
  }
  eval(c) {
    this.sandbox.eval(c);
  }
}
const DEFAULT_CONVERSIONS = {
  float: {
    vec4: { name: "sum", args: [[1, 1, 1, 1]] },
    vec2: { name: "sum", args: [[1, 1]] }
  }
}, ensure_decimal_dot = (o) => (o = o.toString(), o.indexOf(".") < 0 && (o += "."), o);
function formatArguments(o, c, m) {
  const E = o.transform.inputs, D = o.userArgs, { generators: J } = o.synth, { src: Se } = J;
  return E.map((he, Ie) => {
    const be = {
      value: he.default,
      type: he.type,
      //
      isUniform: !1,
      name: he.name,
      vecLen: 0
      //  generateGlsl: null // function for creating glsl
    };
    if (be.type === "float" && (be.value = ensure_decimal_dot(he.default)), he.type.startsWith("vec"))
      try {
        be.vecLen = Number.parseInt(he.type.substr(3));
      } catch {
        console.log(`Error determining length of vector input type ${he.type} (${he.name})`);
      }
    if (D.length > Ie && (be.value = D[Ie], typeof D[Ie] == "function" ? (be.value = (We, mt, st) => {
      try {
        const yt = D[Ie](mt);
        return typeof yt == "number" ? yt : (console.warn("function does not return a number", D[Ie]), he.default);
      } catch (yt) {
        return console.warn("ERROR", yt), he.default;
      }
    }, be.isUniform = !0) : D[Ie].constructor === Array && (be.value = (We, mt, st) => ArrayUtils.getValue(D[Ie])(mt), be.isUniform = !0)), !(c < 0)) {
      if (be.value && be.value.transforms) {
        const We = be.value.transforms[be.value.transforms.length - 1];
        if (We.transform.glsl_return_type !== he.type) {
          const mt = DEFAULT_CONVERSIONS[he.type];
          if (typeof mt < "u") {
            const st = mt[We.transform.glsl_return_type];
            if (typeof st < "u") {
              const { name: yt, args: Wt } = st;
              be.value = be.value[yt](...Wt);
            }
          }
        }
        be.isUniform = !1;
      } else if (be.type === "float" && typeof be.value == "number")
        be.value = ensure_decimal_dot(be.value);
      else if (be.type.startsWith("vec") && typeof be.value == "object" && Array.isArray(be.value))
        be.isUniform = !1, be.value = `${be.type}(${be.value.map(ensure_decimal_dot).join(", ")})`;
      else if (he.type === "sampler2D") {
        var vt = be.value;
        be.value = () => vt.getTexture(), be.isUniform = !0;
      } else if (be.value.getTexture && he.type === "vec4") {
        var He = be.value;
        be.value = Se(He), be.isUniform = !1;
      }
      be.isUniform && (be.name += c);
    }
    return be;
  });
}
function generateGlsl(o) {
  var c = {
    uniforms: [],
    // list of uniforms used in shader
    glslFunctions: [],
    // list of functions used in shader
    fragColor: ""
  }, m = generateGlsl$1(o, c)("st");
  c.fragColor = m;
  let E = {};
  return c.uniforms.forEach((D) => E[D.name] = D), c.uniforms = Object.values(E), c;
}
function generateGlsl$1(o, c) {
  var m = () => "";
  return o.forEach((E) => {
    var D = formatArguments(E, c.uniforms.length);
    D.forEach((he) => {
      he.isUniform && c.uniforms.push(he);
    }), contains(E, c.glslFunctions) || c.glslFunctions.push(E);
    var J = m;
    if (E.transform.type === "src")
      m = (he) => `${shaderString(he, E.name, D, c)}`;
    else if (E.transform.type === "coord")
      m = (he) => `${J(`${shaderString(he, E.name, D, c)}`)}`;
    else if (E.transform.type === "color")
      m = (he) => `${shaderString(`${J(he)}`, E.name, D, c)}`;
    else if (E.transform.type === "combine") {
      var Se = D[0].value && D[0].value.transforms ? (he) => `${generateGlsl$1(D[0].value.transforms, c)(he)}` : D[0].isUniform ? () => D[0].name : () => D[0].value;
      m = (he) => `${shaderString(`${J(he)}, ${Se(he)}`, E.name, D.slice(1), c)}`;
    } else if (E.transform.type === "combineCoord") {
      var Se = D[0].value && D[0].value.transforms ? (Ie) => `${generateGlsl$1(D[0].value.transforms, c)(Ie)}` : D[0].isUniform ? () => D[0].name : () => D[0].value;
      m = (Ie) => `${J(`${shaderString(`${Ie}, ${Se(Ie)}`, E.name, D.slice(1), c)}`)}`;
    }
  }), m;
}
function shaderString(o, c, m, E) {
  const D = m.map((J) => J.isUniform ? J.name : J.value && J.value.transforms ? `${generateGlsl$1(J.value.transforms, E)("st")}` : J.value).reduce((J, Se) => `${J}, ${Se}`, "");
  return `${c}(${o}${D})`;
}
function contains(o, c) {
  for (var m = 0; m < c.length; m++)
    if (o.name == c[m].name)
      return !0;
  return !1;
}
const utilityGlsl = {
  _luminance: {
    type: "util",
    glsl: `float _luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: "util",
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
    type: "util",
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
    type: "util",
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`
  }
};
var GlslSource = function(o) {
  return this.transforms = [], this.transforms.push(o), this.defaultOutput = o.defaultOutput, this.synth = o.synth, this.type = "GlslSource", this.defaultUniforms = o.defaultUniforms, this;
};
GlslSource.prototype.addTransform = function(o) {
  this.transforms.push(o);
};
GlslSource.prototype.out = function(o) {
  var c = o || this.defaultOutput, m = this.glsl(c);
  if (this.synth.currentFunctions = [], c)
    try {
      c.render(m);
    } catch (E) {
      console.log("shader could not compile", E);
    }
};
GlslSource.prototype.glsl = function() {
  var o = [], c = [];
  return this.transforms.forEach((m) => {
    m.transform.type === "renderpass" ? console.warn("no support for renderpass") : c.push(m);
  }), c.length > 0 && o.push(this.compile(c)), o;
};
GlslSource.prototype.compile = function(o) {
  var c = generateGlsl(o, this.synth), m = {};
  c.uniforms.forEach((D) => {
    m[D.name] = D.value;
  });
  var E = `
  precision ${this.defaultOutput.precision} float;
  ${Object.values(c.uniforms).map((D) => {
    let J = D.type;
    switch (D.type) {
      case "texture":
        J = "sampler2D";
        break;
    }
    return `
      uniform ${J} ${D.name};`;
  }).join("")}
  uniform float time;
  uniform vec2 resolution;
  varying vec2 uv;
  uniform sampler2D prevBuffer;

  ${Object.values(utilityGlsl).map((D) => `
            ${D.glsl}
          `).join("")}

  ${c.glslFunctions.map((D) => `
            ${D.transform.glsl}
          `).join("")}

  void main () {
    vec4 c = vec4(1, 0, 0, 1);
    vec2 st = gl_FragCoord.xy/resolution.xy;
    gl_FragColor = ${c.fragColor};
  }
  `;
  return {
    frag: E,
    uniforms: Object.assign({}, this.defaultUniforms, m)
  };
};
const glslFunctions = () => [
  {
    name: "noise",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 0.1
      }
    ],
    glsl: "   return vec4(vec3(_noise(vec3(_st*scale, offset*time))), 1.0);"
  },
  {
    name: "voronoi",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 5
      },
      {
        type: "float",
        name: "speed",
        default: 0.3
      },
      {
        type: "float",
        name: "blending",
        default: 0.3
      }
    ],
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
  },
  {
    name: "osc",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "frequency",
        default: 60
      },
      {
        type: "float",
        name: "sync",
        default: 0.1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st;
   float r = sin((st.x-offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   float g = sin((st.x+time*sync)*frequency)*0.5 + 0.5;
   float b = sin((st.x+offset/frequency+time*sync)*frequency)*0.5  + 0.5;
   return vec4(r, g, b, 1.0);`
  },
  {
    name: "shape",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "sides",
        default: 3
      },
      {
        type: "float",
        name: "radius",
        default: 0.3
      },
      {
        type: "float",
        name: "smoothing",
        default: 0.01
      }
    ],
    glsl: `   vec2 st = _st * 2. - 1.;
   // Angle and radius from the current pixel
   float a = atan(st.x,st.y)+3.1416;
   float r = (2.*3.1416)/sides;
   float d = cos(floor(.5+a/r)*r-a)*length(st);
   return vec4(vec3(1.0-smoothstep(radius,radius + smoothing + 0.0000001,d)), 1.0);`
  },
  {
    name: "gradient",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: "   return vec4(_st, sin(time*speed), 1.0);"
  },
  {
    name: "src",
    type: "src",
    inputs: [
      {
        type: "sampler2D",
        name: "tex",
        default: NaN
      }
    ],
    glsl: `   //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
   return texture2D(tex, fract(_st));`
  },
  {
    name: "solid",
    type: "src",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 0
      },
      {
        type: "float",
        name: "g",
        default: 0
      },
      {
        type: "float",
        name: "b",
        default: 0
      },
      {
        type: "float",
        name: "a",
        default: 1
      }
    ],
    glsl: "   return vec4(r, g, b, a);"
  },
  {
    name: "rotate",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "angle",
        default: 10
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   float ang = angle + speed *time;
   xy = mat2(cos(ang),-sin(ang), sin(ang),cos(ang))*xy;
   xy += 0.5;
   return xy;`
  },
  {
    name: "scale",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1.5
      },
      {
        type: "float",
        name: "xMult",
        default: 1
      },
      {
        type: "float",
        name: "yMult",
        default: 1
      },
      {
        type: "float",
        name: "offsetX",
        default: 0.5
      },
      {
        type: "float",
        name: "offsetY",
        default: 0.5
      }
    ],
    glsl: `   vec2 xy = _st - vec2(offsetX, offsetY);
   xy*=(1.0/vec2(amount*xMult, amount*yMult));
   xy+=vec2(offsetX, offsetY);
   return xy;
   `
  },
  {
    name: "pixelate",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "pixelX",
        default: 20
      },
      {
        type: "float",
        name: "pixelY",
        default: 20
      }
    ],
    glsl: `   vec2 xy = vec2(pixelX, pixelY);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: "posterize",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "bins",
        default: 3
      },
      {
        type: "float",
        name: "gamma",
        default: 0.6
      }
    ],
    glsl: `   vec4 c2 = pow(_c0, vec4(gamma));
   c2 *= vec4(bins);
   c2 = floor(c2);
   c2/= vec4(bins);
   c2 = pow(c2, vec4(1.0/gamma));
   return vec4(c2.xyz, _c0.a);`
  },
  {
    name: "shift",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 0.5
      },
      {
        type: "float",
        name: "g",
        default: 0
      },
      {
        type: "float",
        name: "b",
        default: 0
      },
      {
        type: "float",
        name: "a",
        default: 0
      }
    ],
    glsl: `   vec4 c2 = vec4(_c0);
   c2.r = fract(c2.r + r);
   c2.g = fract(c2.g + g);
   c2.b = fract(c2.b + b);
   c2.a = fract(c2.a + a);
   return vec4(c2.rgba);`
  },
  {
    name: "repeat",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "repeatX",
        default: 3
      },
      {
        type: "float",
        name: "repeatY",
        default: 3
      },
      {
        type: "float",
        name: "offsetX",
        default: 0
      },
      {
        type: "float",
        name: "offsetY",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) * offsetX;
   st.y += step(1., mod(st.x,2.0)) * offsetY;
   return fract(st);`
  },
  {
    name: "modulateRepeat",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "repeatX",
        default: 3
      },
      {
        type: "float",
        name: "repeatY",
        default: 3
      },
      {
        type: "float",
        name: "offsetX",
        default: 0.5
      },
      {
        type: "float",
        name: "offsetY",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(repeatX, repeatY);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offsetX;
   st.y += step(1., mod(st.x,2.0)) + _c0.g * offsetY;
   return fract(st);`
  },
  {
    name: "repeatX",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0))* offset;
   return fract(st);`
  },
  {
    name: "modulateRepeatX",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.y += step(1., mod(st.x,2.0)) + _c0.r * offset;
   return fract(st);`
  },
  {
    name: "repeatY",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 st = _st * vec2(1.0, reps);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0))* offset;
   return fract(st);`
  },
  {
    name: "modulateRepeatY",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "reps",
        default: 3
      },
      {
        type: "float",
        name: "offset",
        default: 0.5
      }
    ],
    glsl: `   vec2 st = _st * vec2(reps, 1.0);
   //  float f =  mod(_st.y,2.0);
   st.x += step(1., mod(st.y,2.0)) + _c0.r * offset;
   return fract(st);`
  },
  {
    name: "kaleid",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "nSides",
        default: 4
      }
    ],
    glsl: `   vec2 st = _st;
   st -= 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return r*vec2(cos(a), sin(a));`
  },
  {
    name: "modulateKaleid",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "nSides",
        default: 4
      }
    ],
    glsl: `   vec2 st = _st - 0.5;
   float r = length(st);
   float a = atan(st.y, st.x);
   float pi = 2.*3.1416;
   a = mod(a,pi/nSides);
   a = abs(a-pi/nSides/2.);
   return (_c0.r+r)*vec2(cos(a), sin(a));`
  },
  {
    name: "scroll",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speedX",
        default: 0
      },
      {
        type: "float",
        name: "speedY",
        default: 0
      }
    ],
    glsl: `
   _st.x += scrollX + time*speedX;
   _st.y += scrollY + time*speedY;
   return fract(_st);`
  },
  {
    name: "scrollX",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.x += scrollX + time*speed;
   return fract(_st);`
  },
  {
    name: "modulateScrollX",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "scrollX",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.x += _c0.r*scrollX + time*speed;
   return fract(_st);`
  },
  {
    name: "scrollY",
    type: "coord",
    inputs: [
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.y += scrollY + time*speed;
   return fract(_st);`
  },
  {
    name: "modulateScrollY",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "scrollY",
        default: 0.5
      },
      {
        type: "float",
        name: "speed",
        default: 0
      }
    ],
    glsl: `   _st.y += _c0.r*scrollY + time*speed;
   return fract(_st);`
  },
  {
    name: "add",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: "   return (_c0+_c1)*amount + _c0*(1.0-amount);"
  },
  {
    name: "sub",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: "   return (_c0-_c1)*amount + _c0*(1.0-amount);"
  },
  {
    name: "layer",
    type: "combine",
    inputs: [],
    glsl: "   return vec4(mix(_c0.rgb, _c1.rgb, _c1.a), clamp(_c0.a + _c1.a, 0.0, 1.0));"
  },
  {
    name: "blend",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.5
      }
    ],
    glsl: "   return _c0*(1.0-amount)+_c1*amount;"
  },
  {
    name: "mult",
    type: "combine",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: "   return _c0*(1.0-amount)+(_c0*_c1)*amount;"
  },
  {
    name: "diff",
    type: "combine",
    inputs: [],
    glsl: "   return vec4(abs(_c0.rgb-_c1.rgb), max(_c0.a, _c1.a));"
  },
  {
    name: "modulate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.1
      }
    ],
    glsl: `   //  return fract(st+(_c0.xy-0.5)*amount);
   return _st + _c0.xy*amount;`
  },
  {
    name: "modulateScale",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 1
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   xy*=(1.0/vec2(offset + multiple*_c0.r, offset + multiple*_c0.g));
   xy+=vec2(0.5);
   return xy;`
  },
  {
    name: "modulatePixelate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 10
      },
      {
        type: "float",
        name: "offset",
        default: 3
      }
    ],
    glsl: `   vec2 xy = vec2(offset + _c0.x*multiple, offset + _c0.y*multiple);
   return (floor(_st * xy) + 0.5)/xy;`
  },
  {
    name: "modulateRotate",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "multiple",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: `   vec2 xy = _st - vec2(0.5);
   float angle = offset + _c0.x * multiple;
   xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
   xy += 0.5;
   return xy;`
  },
  {
    name: "modulateHue",
    type: "combineCoord",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: "   return _st + (vec2(_c0.g - _c0.r, _c0.b - _c0.g) * amount * 1.0/resolution);"
  },
  {
    name: "invert",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1
      }
    ],
    glsl: "   return vec4((1.0-_c0.rgb)*amount + _c0.rgb*(1.0-amount), _c0.a);"
  },
  {
    name: "contrast",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 1.6
      }
    ],
    glsl: `   vec4 c = (_c0-vec4(0.5))*vec4(amount) + vec4(0.5);
   return vec4(c.rgb, _c0.a);`
  },
  {
    name: "brightness",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 0.4
      }
    ],
    glsl: "   return vec4(_c0.rgb + vec3(amount), _c0.a);"
  },
  {
    name: "mask",
    type: "combine",
    inputs: [],
    glsl: `   float a = _luminance(_c1.rgb);
  return vec4(_c0.rgb*a, a*_c0.a);`
  },
  {
    name: "luma",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "threshold",
        default: 0.5
      },
      {
        type: "float",
        name: "tolerance",
        default: 0.1
      }
    ],
    glsl: `   float a = smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb));
   return vec4(_c0.rgb*a, a);`
  },
  {
    name: "thresh",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "threshold",
        default: 0.5
      },
      {
        type: "float",
        name: "tolerance",
        default: 0.04
      }
    ],
    glsl: "   return vec4(vec3(smoothstep(threshold-(tolerance+0.0000001), threshold+(tolerance+0.0000001), _luminance(_c0.rgb))), _c0.a);"
  },
  {
    name: "color",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "r",
        default: 1
      },
      {
        type: "float",
        name: "g",
        default: 1
      },
      {
        type: "float",
        name: "b",
        default: 1
      },
      {
        type: "float",
        name: "a",
        default: 1
      }
    ],
    glsl: `   vec4 c = vec4(r, g, b, a);
   vec4 pos = step(0.0, c); // detect whether negative
   // if > 0, return r * _c0
   // if < 0 return (1.0-r) * _c0
   return vec4(mix((1.0-_c0)*abs(c), c*_c0, pos));`
  },
  {
    name: "saturate",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 2
      }
    ],
    glsl: `   const vec3 W = vec3(0.2125, 0.7154, 0.0721);
   vec3 intensity = vec3(dot(_c0.rgb, W));
   return vec4(mix(intensity, _c0.rgb, amount), _c0.a);`
  },
  {
    name: "hue",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "hue",
        default: 0.4
      }
    ],
    glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c.r += hue;
   //  c.r = fract(c.r);
   return vec4(_hsvToRgb(c), _c0.a);`
  },
  {
    name: "colorama",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "amount",
        default: 5e-3
      }
    ],
    glsl: `   vec3 c = _rgbToHsv(_c0.rgb);
   c += vec3(amount);
   c = _hsvToRgb(c);
   c = fract(c);
   return vec4(c, _c0.a);`
  },
  {
    name: "prev",
    type: "src",
    inputs: [],
    glsl: "   return texture2D(prevBuffer, fract(_st));"
  },
  {
    name: "sum",
    type: "color",
    inputs: [
      {
        type: "vec4",
        name: "scale",
        default: 1
      }
    ],
    glsl: `   vec4 v = _c0 * s;
   return v.r + v.g + v.b + v.a;
   }
   float sum(vec2 _st, vec4 s) { // vec4 is not a typo, because argument type is not overloaded
   vec2 v = _st.xy * s.xy;
   return v.x + v.y;`
  },
  {
    name: "r",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: "   return vec4(_c0.r * scale + offset);"
  },
  {
    name: "g",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: "   return vec4(_c0.g * scale + offset);"
  },
  {
    name: "b",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: "   return vec4(_c0.b * scale + offset);"
  },
  {
    name: "a",
    type: "color",
    inputs: [
      {
        type: "float",
        name: "scale",
        default: 1
      },
      {
        type: "float",
        name: "offset",
        default: 0
      }
    ],
    glsl: "   return vec4(_c0.a * scale + offset);"
  }
];
class GeneratorFactory {
  constructor({
    defaultUniforms: c,
    defaultOutput: m,
    extendTransforms: E = [],
    changeListener: D = () => {
    }
  } = {}) {
    this.defaultOutput = m, this.defaultUniforms = c, this.changeListener = D, this.extendTransforms = E, this.generators = {}, this.init();
  }
  init() {
    const c = glslFunctions();
    return this.glslTransforms = {}, this.generators = Object.entries(this.generators).reduce((m, [E, D]) => (this.changeListener({ type: "remove", synth: this, method: E }), m), {}), this.sourceClass = (() => class extends GlslSource {
    })(), Array.isArray(this.extendTransforms) ? c.concat(this.extendTransforms) : typeof this.extendTransforms == "object" && this.extendTransforms.type && c.push(this.extendTransforms), c.map((m) => this.setFunction(m));
  }
  _addMethod(c, m) {
    const E = this;
    if (this.glslTransforms[c] = m, m.type === "src") {
      const D = (...J) => new this.sourceClass({
        name: c,
        transform: m,
        userArgs: J,
        defaultOutput: this.defaultOutput,
        defaultUniforms: this.defaultUniforms,
        synth: E
      });
      return this.generators[c] = D, this.changeListener({ type: "add", synth: this, method: c }), D;
    } else
      this.sourceClass.prototype[c] = function(...D) {
        return this.transforms.push({ name: c, transform: m, userArgs: D, synth: E }), this;
      };
  }
  setFunction(c) {
    var m = processGlsl(c);
    m && this._addMethod(c.name, m);
  }
}
const typeLookup = {
  src: {
    returnType: "vec4",
    args: ["vec2 _st"]
  },
  coord: {
    returnType: "vec2",
    args: ["vec2 _st"]
  },
  color: {
    returnType: "vec4",
    args: ["vec4 _c0"]
  },
  combine: {
    returnType: "vec4",
    args: ["vec4 _c0", "vec4 _c1"]
  },
  combineCoord: {
    returnType: "vec2",
    args: ["vec2 _st", "vec4 _c0"]
  }
};
function processGlsl(o) {
  let c = typeLookup[o.type];
  if (c) {
    let m = c.args.map((Se) => Se).join(", "), E = o.inputs.map((Se) => `${Se.type} ${Se.name}`).join(", "), D = `${m}${E.length > 0 ? ", " + E : ""}`, J = `
  ${c.returnType} ${o.name}(${D}) {
      ${o.glsl}
  }
`;
    return (o.type === "combine" || o.type === "combineCoord") && o.inputs.unshift({
      name: "color",
      type: "vec4"
    }), Object.assign({}, o, { glsl: J });
  } else
    console.warn(`type ${o.type} not recognized`, o);
}
var regl$1 = { exports: {} };
(function(o, c) {
  (function(m, E) {
    o.exports = E();
  })(commonjsGlobal, function() {
    var m = function(e) {
      return e instanceof Uint8Array || e instanceof Uint16Array || e instanceof Uint32Array || e instanceof Int8Array || e instanceof Int16Array || e instanceof Int32Array || e instanceof Float32Array || e instanceof Float64Array || e instanceof Uint8ClampedArray;
    }, E = function(e, r) {
      for (var d = Object.keys(r), F = 0; F < d.length; ++F)
        e[d[F]] = r[d[F]];
      return e;
    }, D = `
`;
    function J(e) {
      return typeof atob < "u" ? atob(e) : "base64:" + e;
    }
    function Se(e) {
      var r = new Error("(regl) " + e);
      throw console.error(r), r;
    }
    function he(e, r) {
      e || Se(r);
    }
    function Ie(e) {
      return e ? ": " + e : "";
    }
    function be(e, r, d) {
      e in r || Se("unknown parameter (" + e + ")" + Ie(d) + ". possible values: " + Object.keys(r).join());
    }
    function vt(e, r) {
      m(e) || Se(
        "invalid parameter type" + Ie(r) + ". must be a typed array"
      );
    }
    function He(e, r) {
      switch (r) {
        case "number":
          return typeof e == "number";
        case "object":
          return typeof e == "object";
        case "string":
          return typeof e == "string";
        case "boolean":
          return typeof e == "boolean";
        case "function":
          return typeof e == "function";
        case "undefined":
          return typeof e > "u";
        case "symbol":
          return typeof e == "symbol";
      }
    }
    function We(e, r, d) {
      He(e, r) || Se(
        "invalid parameter type" + Ie(d) + ". expected " + r + ", got " + typeof e
      );
    }
    function mt(e, r) {
      e >= 0 && (e | 0) === e || Se("invalid parameter type, (" + e + ")" + Ie(r) + ". must be a nonnegative integer");
    }
    function st(e, r, d) {
      r.indexOf(e) < 0 && Se("invalid value" + Ie(d) + ". must be one of: " + r);
    }
    var yt = [
      "gl",
      "canvas",
      "container",
      "attributes",
      "pixelRatio",
      "extensions",
      "optionalExtensions",
      "profile",
      "onDone"
    ];
    function Wt(e) {
      Object.keys(e).forEach(function(r) {
        yt.indexOf(r) < 0 && Se('invalid regl constructor argument "' + r + '". must be one of ' + yt);
      });
    }
    function Et(e, r) {
      for (e = e + ""; e.length < r; )
        e = " " + e;
      return e;
    }
    function Be() {
      this.name = "unknown", this.lines = [], this.index = {}, this.hasErrors = !1;
    }
    function it(e, r) {
      this.number = e, this.line = r, this.errors = [];
    }
    function Yt(e, r, d) {
      this.file = e, this.line = r, this.message = d;
    }
    function At() {
      var e = new Error(), r = (e.stack || e).toString(), d = /compileProcedure.*\n\s*at.*\((.*)\)/.exec(r);
      if (d)
        return d[1];
      var F = /compileProcedure.*\n\s*at\s+(.*)(\n|$)/.exec(r);
      return F ? F[1] : "unknown";
    }
    function Hr() {
      var e = new Error(), r = (e.stack || e).toString(), d = /at REGLCommand.*\n\s+at.*\((.*)\)/.exec(r);
      if (d)
        return d[1];
      var F = /at REGLCommand.*\n\s+at\s+(.*)\n/.exec(r);
      return F ? F[1] : "unknown";
    }
    function qt(e, r) {
      var d = e.split(`
`), F = 1, N = 0, O = {
        unknown: new Be(),
        0: new Be()
      };
      O.unknown.name = O[0].name = r || At(), O.unknown.lines.push(new it(0, ""));
      for (var M = 0; M < d.length; ++M) {
        var X = d[M], W = /^\s*#\s*(\w+)\s+(.+)\s*$/.exec(X);
        if (W)
          switch (W[1]) {
            case "line":
              var Q = /(\d+)(\s+\d+)?/.exec(W[2]);
              Q && (F = Q[1] | 0, Q[2] && (N = Q[2] | 0, N in O || (O[N] = new Be())));
              break;
            case "define":
              var Y = /SHADER_NAME(_B64)?\s+(.*)$/.exec(W[2]);
              Y && (O[N].name = Y[1] ? J(Y[2]) : Y[2]);
              break;
          }
        O[N].lines.push(new it(F++, X));
      }
      return Object.keys(O).forEach(function(te) {
        var ie = O[te];
        ie.lines.forEach(function(H) {
          ie.index[H.number] = H;
        });
      }), O;
    }
    function Sr(e) {
      var r = [];
      return e.split(`
`).forEach(function(d) {
        if (!(d.length < 5)) {
          var F = /^ERROR:\s+(\d+):(\d+):\s*(.*)$/.exec(d);
          F ? r.push(new Yt(
            F[1] | 0,
            F[2] | 0,
            F[3].trim()
          )) : d.length > 0 && r.push(new Yt("unknown", 0, d));
        }
      }), r;
    }
    function $t(e, r) {
      r.forEach(function(d) {
        var F = e[d.file];
        if (F) {
          var N = F.index[d.line];
          if (N) {
            N.errors.push(d), F.hasErrors = !0;
            return;
          }
        }
        e.unknown.hasErrors = !0, e.unknown.lines[0].errors.push(d);
      });
    }
    function Sn(e, r, d, F, N) {
      if (!e.getShaderParameter(r, e.COMPILE_STATUS)) {
        var O = e.getShaderInfoLog(r), M = F === e.FRAGMENT_SHADER ? "fragment" : "vertex";
        $(d, "string", M + " shader source must be a string", N);
        var X = qt(d, N), W = Sr(O);
        $t(X, W), Object.keys(X).forEach(function(Q) {
          var Y = X[Q];
          if (!Y.hasErrors)
            return;
          var te = [""], ie = [""];
          function H(re, w) {
            te.push(re), ie.push(w || "");
          }
          H("file number " + Q + ": " + Y.name + `
`, "color:red;text-decoration:underline;font-weight:bold"), Y.lines.forEach(function(re) {
            if (re.errors.length > 0) {
              H(Et(re.number, 4) + "|  ", "background-color:yellow; font-weight:bold"), H(re.line + D, "color:red; background-color:yellow; font-weight:bold");
              var w = 0;
              re.errors.forEach(function(B) {
                var K = B.message, se = /^\s*'(.*)'\s*:\s*(.*)$/.exec(K);
                if (se) {
                  var z = se[1];
                  switch (K = se[2], z) {
                    case "assign":
                      z = "=";
                      break;
                  }
                  w = Math.max(re.line.indexOf(z, w), 0);
                } else
                  w = 0;
                H(Et("| ", 6)), H(Et("^^^", w + 3) + D, "font-weight:bold"), H(Et("| ", 6)), H(K + D, "font-weight:bold");
              }), H(Et("| ", 6) + D);
            } else
              H(Et(re.number, 4) + "|  "), H(re.line + D, "color:red");
          }), typeof document < "u" && !window.chrome ? (ie[0] = te.join("%c"), console.log.apply(console, ie)) : console.log(te.join(""));
        }), he.raise("Error compiling " + M + " shader, " + X[0].name);
      }
    }
    function Tn(e, r, d, F, N) {
      if (!e.getProgramParameter(r, e.LINK_STATUS)) {
        var O = e.getProgramInfoLog(r), M = qt(d, N), X = qt(F, N), W = 'Error linking program with vertex shader, "' + X[0].name + '", and fragment shader "' + M[0].name + '"';
        typeof document < "u" ? console.log(
          "%c" + W + D + "%c" + O,
          "color:red;text-decoration:underline;font-weight:bold",
          "color:red"
        ) : console.log(W + D + O), he.raise(W);
      }
    }
    function Wr(e) {
      e._commandRef = At();
    }
    function Tr(e, r, d, F) {
      Wr(e);
      function N(W) {
        return W ? F.id(W) : 0;
      }
      e._fragId = N(e.static.frag), e._vertId = N(e.static.vert);
      function O(W, Q) {
        Object.keys(Q).forEach(function(Y) {
          W[F.id(Y)] = !0;
        });
      }
      var M = e._uniformSet = {};
      O(M, r.static), O(M, r.dynamic);
      var X = e._attributeSet = {};
      O(X, d.static), O(X, d.dynamic), e._hasCount = "count" in e.static || "count" in e.dynamic || "elements" in e.static || "elements" in e.dynamic;
    }
    function Kt(e, r) {
      var d = Hr();
      Se(e + " in command " + (r || At()) + (d === "unknown" ? "" : " called from " + d));
    }
    function T(e, r, d) {
      e || Kt(r, d || At());
    }
    function _(e, r, d, F) {
      e in r || Kt(
        "unknown parameter (" + e + ")" + Ie(d) + ". possible values: " + Object.keys(r).join(),
        F || At()
      );
    }
    function $(e, r, d, F) {
      He(e, r) || Kt(
        "invalid parameter type" + Ie(d) + ". expected " + r + ", got " + typeof e,
        F || At()
      );
    }
    function C(e) {
      e();
    }
    function ee(e, r, d) {
      e.texture ? st(
        e.texture._texture.internalformat,
        r,
        "unsupported texture format for attachment"
      ) : st(
        e.renderbuffer._renderbuffer.format,
        d,
        "unsupported renderbuffer format for attachment"
      );
    }
    var ce = 33071, Ae = 9728, ke = 9984, Te = 9985, we = 9986, Pe = 9987, ut = 5120, Ue = 5121, Ct = 5122, wt = 5123, St = 5124, Lr = 5125, Qe = 5126, ct = 32819, pt = 32820, Gt = 33635, Aa = 34042, wo = 36193, Tt = {};
    Tt[ut] = Tt[Ue] = 1, Tt[Ct] = Tt[wt] = Tt[wo] = Tt[Gt] = Tt[ct] = Tt[pt] = 2, Tt[St] = Tt[Lr] = Tt[Qe] = Tt[Aa] = 4;
    function wa(e, r) {
      return e === pt || e === ct || e === Gt ? 2 : e === Aa ? 4 : Tt[e] * r;
    }
    function Yr(e) {
      return !(e & e - 1) && !!e;
    }
    function So(e, r, d) {
      var F, N = r.width, O = r.height, M = r.channels;
      he(
        N > 0 && N <= d.maxTextureSize && O > 0 && O <= d.maxTextureSize,
        "invalid texture shape"
      ), (e.wrapS !== ce || e.wrapT !== ce) && he(
        Yr(N) && Yr(O),
        "incompatible wrap mode for texture, both width and height must be power of 2"
      ), r.mipmask === 1 ? N !== 1 && O !== 1 && he(
        e.minFilter !== ke && e.minFilter !== we && e.minFilter !== Te && e.minFilter !== Pe,
        "min filter requires mipmap"
      ) : (he(
        Yr(N) && Yr(O),
        "texture must be a square power of 2 to support mipmapping"
      ), he(
        r.mipmask === (N << 1) - 1,
        "missing or incomplete mipmap data"
      )), r.type === Qe && (d.extensions.indexOf("oes_texture_float_linear") < 0 && he(
        e.minFilter === Ae && e.magFilter === Ae,
        "filter not supported, must enable oes_texture_float_linear"
      ), he(
        !e.genMipmaps,
        "mipmap generation not supported with float textures"
      ));
      var X = r.images;
      for (F = 0; F < 16; ++F)
        if (X[F]) {
          var W = N >> F, Q = O >> F;
          he(r.mipmask & 1 << F, "missing mipmap data");
          var Y = X[F];
          if (he(
            Y.width === W && Y.height === Q,
            "invalid shape for mip images"
          ), he(
            Y.format === r.format && Y.internalformat === r.internalformat && Y.type === r.type,
            "incompatible type for mip image"
          ), !Y.compressed)
            if (Y.data) {
              var te = Math.ceil(wa(Y.type, M) * W / Y.unpackAlignment) * Y.unpackAlignment;
              he(
                Y.data.byteLength === te * Q,
                "invalid data for image, buffer size is inconsistent with image format"
              );
            } else
              Y.element || Y.copy;
        } else
          e.genMipmaps || he((r.mipmask & 1 << F) === 0, "extra mipmap data");
      r.compressed && he(
        !e.genMipmaps,
        "mipmap generation for compressed images not supported"
      );
    }
    function To(e, r, d, F) {
      var N = e.width, O = e.height, M = e.channels;
      he(
        N > 0 && N <= F.maxTextureSize && O > 0 && O <= F.maxTextureSize,
        "invalid texture shape"
      ), he(
        N === O,
        "cube map must be square"
      ), he(
        r.wrapS === ce && r.wrapT === ce,
        "wrap mode not supported by cube map"
      );
      for (var X = 0; X < d.length; ++X) {
        var W = d[X];
        he(
          W.width === N && W.height === O,
          "inconsistent cube map face shape"
        ), r.genMipmaps && (he(
          !W.compressed,
          "can not generate mipmap for compressed textures"
        ), he(
          W.mipmask === 1,
          "can not specify mipmaps and generate mipmaps"
        ));
        for (var Q = W.images, Y = 0; Y < 16; ++Y) {
          var te = Q[Y];
          if (te) {
            var ie = N >> Y, H = O >> Y;
            he(W.mipmask & 1 << Y, "missing mipmap data"), he(
              te.width === ie && te.height === H,
              "invalid shape for mip images"
            ), he(
              te.format === e.format && te.internalformat === e.internalformat && te.type === e.type,
              "incompatible type for mip image"
            ), te.compressed || (te.data ? he(
              te.data.byteLength === ie * H * Math.max(wa(te.type, M), te.unpackAlignment),
              "invalid data for image, buffer size is inconsistent with image format"
            ) : te.element || te.copy);
          }
        }
      }
    }
    var u = E(he, {
      optional: C,
      raise: Se,
      commandRaise: Kt,
      command: T,
      parameter: be,
      commandParameter: _,
      constructor: Wt,
      type: We,
      commandType: $,
      isTypedArray: vt,
      nni: mt,
      oneOf: st,
      shaderError: Sn,
      linkError: Tn,
      callSite: Hr,
      saveCommandRef: Wr,
      saveDrawInfo: Tr,
      framebufferFormat: ee,
      guessCommand: At,
      texture2D: So,
      textureCube: To
    }), Lo = 0, Ro = 0, Co = 5, Oo = 6;
    function Qt(e, r) {
      this.id = Lo++, this.type = e, this.data = r;
    }
    function Sa(e) {
      return e.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
    function Rr(e) {
      if (e.length === 0)
        return [];
      var r = e.charAt(0), d = e.charAt(e.length - 1);
      if (e.length > 1 && r === d && (r === '"' || r === "'"))
        return ['"' + Sa(e.substr(1, e.length - 2)) + '"'];
      var F = /\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(e);
      if (F)
        return Rr(e.substr(0, F.index)).concat(Rr(F[1])).concat(Rr(e.substr(F.index + F[0].length)));
      var N = e.split(".");
      if (N.length === 1)
        return ['"' + Sa(e) + '"'];
      for (var O = [], M = 0; M < N.length; ++M)
        O = O.concat(Rr(N[M]));
      return O;
    }
    function Ta(e) {
      return "[" + Rr(e).join("][") + "]";
    }
    function Fo(e, r) {
      return new Qt(e, Ta(r + ""));
    }
    function Go(e) {
      return typeof e == "function" && !e._reglType || e instanceof Qt;
    }
    function La(e, r) {
      if (typeof e == "function")
        return new Qt(Ro, e);
      if (typeof e == "number" || typeof e == "boolean")
        return new Qt(Co, e);
      if (Array.isArray(e))
        return new Qt(Oo, e.map((d, F) => La(d, r + "[" + F + "]")));
      if (e instanceof Qt)
        return e;
      u(!1, "invalid option type in uniform " + r);
    }
    var Lt = {
      DynamicVariable: Qt,
      define: Fo,
      isDynamic: Go,
      unbox: La,
      accessor: Ta
    }, Ln = {
      next: typeof requestAnimationFrame == "function" ? function(e) {
        return requestAnimationFrame(e);
      } : function(e) {
        return setTimeout(e, 16);
      },
      cancel: typeof cancelAnimationFrame == "function" ? function(e) {
        return cancelAnimationFrame(e);
      } : clearTimeout
    }, Ra = typeof performance < "u" && performance.now ? function() {
      return performance.now();
    } : function() {
      return +/* @__PURE__ */ new Date();
    };
    function Do() {
      var e = { "": 0 }, r = [""];
      return {
        id: function(d) {
          var F = e[d];
          return F || (F = e[d] = r.length, r.push(d), F);
        },
        str: function(d) {
          return r[d];
        }
      };
    }
    function Mo(e, r, d) {
      var F = document.createElement("canvas");
      E(F.style, {
        border: 0,
        margin: 0,
        padding: 0,
        top: 0,
        left: 0
      }), e.appendChild(F), e === document.body && (F.style.position = "absolute", E(e.style, {
        margin: 0,
        padding: 0
      }));
      function N() {
        var X = window.innerWidth, W = window.innerHeight;
        if (e !== document.body) {
          var Q = e.getBoundingClientRect();
          X = Q.right - Q.left, W = Q.bottom - Q.top;
        }
        F.width = d * X, F.height = d * W, E(F.style, {
          width: X + "px",
          height: W + "px"
        });
      }
      var O;
      e !== document.body && typeof ResizeObserver == "function" ? (O = new ResizeObserver(function() {
        setTimeout(N);
      }), O.observe(e)) : window.addEventListener("resize", N, !1);
      function M() {
        O ? O.disconnect() : window.removeEventListener("resize", N), e.removeChild(F);
      }
      return N(), {
        canvas: F,
        onDestroy: M
      };
    }
    function Bo(e, r) {
      function d(F) {
        try {
          return e.getContext(F, r);
        } catch {
          return null;
        }
      }
      return d("webgl") || d("experimental-webgl") || d("webgl-experimental");
    }
    function ko(e) {
      return typeof e.nodeName == "string" && typeof e.appendChild == "function" && typeof e.getBoundingClientRect == "function";
    }
    function Io(e) {
      return typeof e.drawArrays == "function" || typeof e.drawElements == "function";
    }
    function Ca(e) {
      return typeof e == "string" ? e.split() : (u(Array.isArray(e), "invalid extension array"), e);
    }
    function Oa(e) {
      return typeof e == "string" ? (u(typeof document < "u", "not supported outside of DOM"), document.querySelector(e)) : e;
    }
    function No(e) {
      var r = e || {}, d, F, N, O, M = {}, X = [], W = [], Q = typeof window > "u" ? 1 : window.devicePixelRatio, Y = !1, te = function(re) {
        re && u.raise(re);
      }, ie = function() {
      };
      if (typeof r == "string" ? (u(
        typeof document < "u",
        "selector queries only supported in DOM enviroments"
      ), d = document.querySelector(r), u(d, "invalid query string for element")) : typeof r == "object" ? ko(r) ? d = r : Io(r) ? (O = r, N = O.canvas) : (u.constructor(r), "gl" in r ? O = r.gl : "canvas" in r ? N = Oa(r.canvas) : "container" in r && (F = Oa(r.container)), "attributes" in r && (M = r.attributes, u.type(M, "object", "invalid context attributes")), "extensions" in r && (X = Ca(r.extensions)), "optionalExtensions" in r && (W = Ca(r.optionalExtensions)), "onDone" in r && (u.type(
        r.onDone,
        "function",
        "invalid or missing onDone callback"
      ), te = r.onDone), "profile" in r && (Y = !!r.profile), "pixelRatio" in r && (Q = +r.pixelRatio, u(Q > 0, "invalid pixel ratio"))) : u.raise("invalid arguments to regl"), d && (d.nodeName.toLowerCase() === "canvas" ? N = d : F = d), !O) {
        if (!N) {
          u(
            typeof document < "u",
            "must manually specify webgl context outside of DOM environments"
          );
          var H = Mo(F || document.body, te, Q);
          if (!H)
            return null;
          N = H.canvas, ie = H.onDestroy;
        }
        M.premultipliedAlpha === void 0 && (M.premultipliedAlpha = !0), O = Bo(N, M);
      }
      return O ? {
        gl: O,
        canvas: N,
        container: F,
        extensions: X,
        optionalExtensions: W,
        pixelRatio: Q,
        profile: Y,
        onDone: te,
        onDestroy: ie
      } : (ie(), te("webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org"), null);
    }
    function Po(e, r) {
      var d = {};
      function F(M) {
        u.type(M, "string", "extension name must be string");
        var X = M.toLowerCase(), W;
        try {
          W = d[X] = e.getExtension(X);
        } catch {
        }
        return !!W;
      }
      for (var N = 0; N < r.extensions.length; ++N) {
        var O = r.extensions[N];
        if (!F(O))
          return r.onDestroy(), r.onDone('"' + O + '" extension is not supported by the current WebGL context, try upgrading your system or a different browser'), null;
      }
      return r.optionalExtensions.forEach(F), {
        extensions: d,
        restore: function() {
          Object.keys(d).forEach(function(M) {
            if (d[M] && !F(M))
              throw new Error("(regl): error restoring extension " + M);
          });
        }
      };
    }
    function gt(e, r) {
      for (var d = Array(e), F = 0; F < e; ++F)
        d[F] = r(F);
      return d;
    }
    var Uo = 5120, $o = 5121, zo = 5122, jo = 5123, Vo = 5124, Xo = 5125, Ho = 5126;
    function Wo(e) {
      for (var r = 16; r <= 1 << 28; r *= 16)
        if (e <= r)
          return r;
      return 0;
    }
    function Fa(e) {
      var r, d;
      return r = (e > 65535) << 4, e >>>= r, d = (e > 255) << 3, e >>>= d, r |= d, d = (e > 15) << 2, e >>>= d, r |= d, d = (e > 3) << 1, e >>>= d, r |= d, r | e >> 1;
    }
    function Ga() {
      var e = gt(8, function() {
        return [];
      });
      function r(O) {
        var M = Wo(O), X = e[Fa(M) >> 2];
        return X.length > 0 ? X.pop() : new ArrayBuffer(M);
      }
      function d(O) {
        e[Fa(O.byteLength) >> 2].push(O);
      }
      function F(O, M) {
        var X = null;
        switch (O) {
          case Uo:
            X = new Int8Array(r(M), 0, M);
            break;
          case $o:
            X = new Uint8Array(r(M), 0, M);
            break;
          case zo:
            X = new Int16Array(r(2 * M), 0, M);
            break;
          case jo:
            X = new Uint16Array(r(2 * M), 0, M);
            break;
          case Vo:
            X = new Int32Array(r(4 * M), 0, M);
            break;
          case Xo:
            X = new Uint32Array(r(4 * M), 0, M);
            break;
          case Ho:
            X = new Float32Array(r(4 * M), 0, M);
            break;
          default:
            return null;
        }
        return X.length !== M ? X.subarray(0, M) : X;
      }
      function N(O) {
        d(O.buffer);
      }
      return {
        alloc: r,
        free: d,
        allocType: F,
        freeType: N
      };
    }
    var Ze = Ga();
    Ze.zero = Ga();
    var Yo = 3408, qo = 3410, Ko = 3411, Qo = 3412, Zo = 3413, Jo = 3414, es = 3415, ts = 33901, rs = 33902, ns = 3379, as = 3386, is = 34921, os = 36347, ss = 36348, fs = 35661, us = 35660, cs = 34930, ls = 36349, ds = 34076, hs = 34024, ms = 7936, ps = 7937, vs = 7938, ys = 35724, _s = 34047, bs = 36063, gs = 34852, qr = 3553, Da = 34067, xs = 34069, Es = 33984, Cr = 6408, Rn = 5126, Ma = 5121, Cn = 36160, As = 36053, ws = 36064, Ss = 16384, Ts = function(e, r) {
      var d = 1;
      r.ext_texture_filter_anisotropic && (d = e.getParameter(_s));
      var F = 1, N = 1;
      r.webgl_draw_buffers && (F = e.getParameter(gs), N = e.getParameter(bs));
      var O = !!r.oes_texture_float;
      if (O) {
        var M = e.createTexture();
        e.bindTexture(qr, M), e.texImage2D(qr, 0, Cr, 1, 1, 0, Cr, Rn, null);
        var X = e.createFramebuffer();
        if (e.bindFramebuffer(Cn, X), e.framebufferTexture2D(Cn, ws, qr, M, 0), e.bindTexture(qr, null), e.checkFramebufferStatus(Cn) !== As)
          O = !1;
        else {
          e.viewport(0, 0, 1, 1), e.clearColor(1, 0, 0, 1), e.clear(Ss);
          var W = Ze.allocType(Rn, 4);
          e.readPixels(0, 0, 1, 1, Cr, Rn, W), e.getError() ? O = !1 : (e.deleteFramebuffer(X), e.deleteTexture(M), O = W[0] === 1), Ze.freeType(W);
        }
      }
      var Q = typeof navigator < "u" && (/MSIE/.test(navigator.userAgent) || /Trident\//.test(navigator.appVersion) || /Edge/.test(navigator.userAgent)), Y = !0;
      if (!Q) {
        var te = e.createTexture(), ie = Ze.allocType(Ma, 36);
        e.activeTexture(Es), e.bindTexture(Da, te), e.texImage2D(xs, 0, Cr, 3, 3, 0, Cr, Ma, ie), Ze.freeType(ie), e.bindTexture(Da, null), e.deleteTexture(te), Y = !e.getError();
      }
      return {
        // drawing buffer bit depth
        colorBits: [
          e.getParameter(qo),
          e.getParameter(Ko),
          e.getParameter(Qo),
          e.getParameter(Zo)
        ],
        depthBits: e.getParameter(Jo),
        stencilBits: e.getParameter(es),
        subpixelBits: e.getParameter(Yo),
        // supported extensions
        extensions: Object.keys(r).filter(function(H) {
          return !!r[H];
        }),
        // max aniso samples
        maxAnisotropic: d,
        // max draw buffers
        maxDrawbuffers: F,
        maxColorAttachments: N,
        // point and line size ranges
        pointSizeDims: e.getParameter(ts),
        lineWidthDims: e.getParameter(rs),
        maxViewportDims: e.getParameter(as),
        maxCombinedTextureUnits: e.getParameter(fs),
        maxCubeMapSize: e.getParameter(ds),
        maxRenderbufferSize: e.getParameter(hs),
        maxTextureUnits: e.getParameter(cs),
        maxTextureSize: e.getParameter(ns),
        maxAttributes: e.getParameter(is),
        maxVertexUniforms: e.getParameter(os),
        maxVertexTextureUnits: e.getParameter(us),
        maxVaryingVectors: e.getParameter(ss),
        maxFragmentUniforms: e.getParameter(ls),
        // vendor info
        glsl: e.getParameter(ys),
        renderer: e.getParameter(ps),
        vendor: e.getParameter(ms),
        version: e.getParameter(vs),
        // quirks
        readFloat: O,
        npotTextureCube: Y
      };
    };
    function Dt(e) {
      return !!e && typeof e == "object" && Array.isArray(e.shape) && Array.isArray(e.stride) && typeof e.offset == "number" && e.shape.length === e.stride.length && (Array.isArray(e.data) || m(e.data));
    }
    var Rt = function(e) {
      return Object.keys(e).map(function(r) {
        return e[r];
      });
    }, Kr = {
      shape: Os,
      flatten: Cs
    };
    function Ls(e, r, d) {
      for (var F = 0; F < r; ++F)
        d[F] = e[F];
    }
    function Rs(e, r, d, F) {
      for (var N = 0, O = 0; O < r; ++O)
        for (var M = e[O], X = 0; X < d; ++X)
          F[N++] = M[X];
    }
    function Ba(e, r, d, F, N, O) {
      for (var M = O, X = 0; X < r; ++X)
        for (var W = e[X], Q = 0; Q < d; ++Q)
          for (var Y = W[Q], te = 0; te < F; ++te)
            N[M++] = Y[te];
    }
    function ka(e, r, d, F, N) {
      for (var O = 1, M = d + 1; M < r.length; ++M)
        O *= r[M];
      var X = r[d];
      if (r.length - d === 4) {
        var W = r[d + 1], Q = r[d + 2], Y = r[d + 3];
        for (M = 0; M < X; ++M)
          Ba(e[M], W, Q, Y, F, N), N += O;
      } else
        for (M = 0; M < X; ++M)
          ka(e[M], r, d + 1, F, N), N += O;
    }
    function Cs(e, r, d, F) {
      var N = 1;
      if (r.length)
        for (var O = 0; O < r.length; ++O)
          N *= r[O];
      else
        N = 0;
      var M = F || Ze.allocType(d, N);
      switch (r.length) {
        case 0:
          break;
        case 1:
          Ls(e, r[0], M);
          break;
        case 2:
          Rs(e, r[0], r[1], M);
          break;
        case 3:
          Ba(e, r[0], r[1], r[2], M, 0);
          break;
        default:
          ka(e, r, 0, M, 0);
      }
      return M;
    }
    function Os(e) {
      for (var r = [], d = e; d.length; d = d[0])
        r.push(d.length);
      return r;
    }
    var On = {
      "[object Int8Array]": 5120,
      "[object Int16Array]": 5122,
      "[object Int32Array]": 5124,
      "[object Uint8Array]": 5121,
      "[object Uint8ClampedArray]": 5121,
      "[object Uint16Array]": 5123,
      "[object Uint32Array]": 5125,
      "[object Float32Array]": 5126,
      "[object Float64Array]": 5121,
      "[object ArrayBuffer]": 5121
    }, Fs = 5120, Gs = 5122, Ds = 5124, Ms = 5121, Bs = 5123, ks = 5125, Is = 5126, Ns = 5126, Zt = {
      int8: Fs,
      int16: Gs,
      int32: Ds,
      uint8: Ms,
      uint16: Bs,
      uint32: ks,
      float: Is,
      float32: Ns
    }, Ps = 35048, Us = 35040, Qr = {
      dynamic: Ps,
      stream: Us,
      static: 35044
    }, Fn = Kr.flatten, Ia = Kr.shape, Na = 35044, $s = 35040, Gn = 5121, Dn = 5126, zt = [];
    zt[5120] = 1, zt[5122] = 2, zt[5124] = 4, zt[5121] = 1, zt[5123] = 2, zt[5125] = 4, zt[5126] = 4;
    function Zr(e) {
      return On[Object.prototype.toString.call(e)] | 0;
    }
    function Pa(e, r) {
      for (var d = 0; d < r.length; ++d)
        e[d] = r[d];
    }
    function Ua(e, r, d, F, N, O, M) {
      for (var X = 0, W = 0; W < d; ++W)
        for (var Q = 0; Q < F; ++Q)
          e[X++] = r[N * W + O * Q + M];
    }
    function zs(e, r, d, F) {
      var N = 0, O = {};
      function M(w) {
        this.id = N++, this.buffer = e.createBuffer(), this.type = w, this.usage = Na, this.byteLength = 0, this.dimension = 1, this.dtype = Gn, this.persistentData = null, d.profile && (this.stats = { size: 0 });
      }
      M.prototype.bind = function() {
        e.bindBuffer(this.type, this.buffer);
      }, M.prototype.destroy = function() {
        ie(this);
      };
      var X = [];
      function W(w, B) {
        var K = X.pop();
        return K || (K = new M(w)), K.bind(), te(K, B, $s, 0, 1, !1), K;
      }
      function Q(w) {
        X.push(w);
      }
      function Y(w, B, K) {
        w.byteLength = B.byteLength, e.bufferData(w.type, B, K);
      }
      function te(w, B, K, se, z, fe) {
        var V;
        if (w.usage = K, Array.isArray(B)) {
          if (w.dtype = se || Dn, B.length > 0) {
            var ne;
            if (Array.isArray(B[0])) {
              V = Ia(B);
              for (var j = 1, ae = 1; ae < V.length; ++ae)
                j *= V[ae];
              w.dimension = j, ne = Fn(B, V, w.dtype), Y(w, ne, K), fe ? w.persistentData = ne : Ze.freeType(ne);
            } else if (typeof B[0] == "number") {
              w.dimension = z;
              var pe = Ze.allocType(w.dtype, B.length);
              Pa(pe, B), Y(w, pe, K), fe ? w.persistentData = pe : Ze.freeType(pe);
            } else
              m(B[0]) ? (w.dimension = B[0].length, w.dtype = se || Zr(B[0]) || Dn, ne = Fn(
                B,
                [B.length, B[0].length],
                w.dtype
              ), Y(w, ne, K), fe ? w.persistentData = ne : Ze.freeType(ne)) : u.raise("invalid buffer data");
          }
        } else if (m(B))
          w.dtype = se || Zr(B), w.dimension = z, Y(w, B, K), fe && (w.persistentData = new Uint8Array(new Uint8Array(B.buffer)));
        else if (Dt(B)) {
          V = B.shape;
          var ge = B.stride, oe = B.offset, Z = 0, U = 0, _e = 0, Le = 0;
          V.length === 1 ? (Z = V[0], U = 1, _e = ge[0], Le = 0) : V.length === 2 ? (Z = V[0], U = V[1], _e = ge[0], Le = ge[1]) : u.raise("invalid shape"), w.dtype = se || Zr(B.data) || Dn, w.dimension = U;
          var le = Ze.allocType(w.dtype, Z * U);
          Ua(
            le,
            B.data,
            Z,
            U,
            _e,
            Le,
            oe
          ), Y(w, le, K), fe ? w.persistentData = le : Ze.freeType(le);
        } else
          B instanceof ArrayBuffer ? (w.dtype = Gn, w.dimension = z, Y(w, B, K), fe && (w.persistentData = new Uint8Array(new Uint8Array(B)))) : u.raise("invalid buffer data");
      }
      function ie(w) {
        r.bufferCount--, F(w);
        var B = w.buffer;
        u(B, "buffer must not be deleted already"), e.deleteBuffer(B), w.buffer = null, delete O[w.id];
      }
      function H(w, B, K, se) {
        r.bufferCount++;
        var z = new M(B);
        O[z.id] = z;
        function fe(j) {
          var ae = Na, pe = null, ge = 0, oe = 0, Z = 1;
          return Array.isArray(j) || m(j) || Dt(j) || j instanceof ArrayBuffer ? pe = j : typeof j == "number" ? ge = j | 0 : j && (u.type(
            j,
            "object",
            "buffer arguments must be an object, a number or an array"
          ), "data" in j && (u(
            pe === null || Array.isArray(pe) || m(pe) || Dt(pe),
            "invalid data for buffer"
          ), pe = j.data), "usage" in j && (u.parameter(j.usage, Qr, "invalid buffer usage"), ae = Qr[j.usage]), "type" in j && (u.parameter(j.type, Zt, "invalid buffer type"), oe = Zt[j.type]), "dimension" in j && (u.type(j.dimension, "number", "invalid dimension"), Z = j.dimension | 0), "length" in j && (u.nni(ge, "buffer length must be a nonnegative integer"), ge = j.length | 0)), z.bind(), pe ? te(z, pe, ae, oe, Z, se) : (ge && e.bufferData(z.type, ge, ae), z.dtype = oe || Gn, z.usage = ae, z.dimension = Z, z.byteLength = ge), d.profile && (z.stats.size = z.byteLength * zt[z.dtype]), fe;
        }
        function V(j, ae) {
          u(
            ae + j.byteLength <= z.byteLength,
            "invalid buffer subdata call, buffer is too small.  Can't write data of size " + j.byteLength + " starting from offset " + ae + " to a buffer of size " + z.byteLength
          ), e.bufferSubData(z.type, ae, j);
        }
        function ne(j, ae) {
          var pe = (ae || 0) | 0, ge;
          if (z.bind(), m(j) || j instanceof ArrayBuffer)
            V(j, pe);
          else if (Array.isArray(j)) {
            if (j.length > 0)
              if (typeof j[0] == "number") {
                var oe = Ze.allocType(z.dtype, j.length);
                Pa(oe, j), V(oe, pe), Ze.freeType(oe);
              } else if (Array.isArray(j[0]) || m(j[0])) {
                ge = Ia(j);
                var Z = Fn(j, ge, z.dtype);
                V(Z, pe), Ze.freeType(Z);
              } else
                u.raise("invalid buffer data");
          } else if (Dt(j)) {
            ge = j.shape;
            var U = j.stride, _e = 0, Le = 0, le = 0, Fe = 0;
            ge.length === 1 ? (_e = ge[0], Le = 1, le = U[0], Fe = 0) : ge.length === 2 ? (_e = ge[0], Le = ge[1], le = U[0], Fe = U[1]) : u.raise("invalid shape");
            var xe = Array.isArray(j.data) ? z.dtype : Zr(j.data), Oe = Ze.allocType(xe, _e * Le);
            Ua(
              Oe,
              j.data,
              _e,
              Le,
              le,
              Fe,
              j.offset
            ), V(Oe, pe), Ze.freeType(Oe);
          } else
            u.raise("invalid data for buffer subdata");
          return fe;
        }
        return K || fe(w), fe._reglType = "buffer", fe._buffer = z, fe.subdata = ne, d.profile && (fe.stats = z.stats), fe.destroy = function() {
          ie(z);
        }, fe;
      }
      function re() {
        Rt(O).forEach(function(w) {
          w.buffer = e.createBuffer(), e.bindBuffer(w.type, w.buffer), e.bufferData(
            w.type,
            w.persistentData || w.byteLength,
            w.usage
          );
        });
      }
      return d.profile && (r.getTotalBufferSize = function() {
        var w = 0;
        return Object.keys(O).forEach(function(B) {
          w += O[B].stats.size;
        }), w;
      }), {
        create: H,
        createStream: W,
        destroyStream: Q,
        clear: function() {
          Rt(O).forEach(ie), X.forEach(ie);
        },
        getBuffer: function(w) {
          return w && w._buffer instanceof M ? w._buffer : null;
        },
        restore: re,
        _initBuffer: te
      };
    }
    var js = 0, Vs = 0, Xs = 1, Hs = 1, Ws = 4, Ys = 4, ur = {
      points: js,
      point: Vs,
      lines: Xs,
      line: Hs,
      triangles: Ws,
      triangle: Ys,
      "line loop": 2,
      "line strip": 3,
      "triangle strip": 5,
      "triangle fan": 6
    }, qs = 0, Ks = 1, Or = 4, Qs = 5120, cr = 5121, $a = 5122, lr = 5123, za = 5124, Jt = 5125, Mn = 34963, Zs = 35040, Js = 35044;
    function ef(e, r, d, F) {
      var N = {}, O = 0, M = {
        uint8: cr,
        uint16: lr
      };
      r.oes_element_index_uint && (M.uint32 = Jt);
      function X(re) {
        this.id = O++, N[this.id] = this, this.buffer = re, this.primType = Or, this.vertCount = 0, this.type = 0;
      }
      X.prototype.bind = function() {
        this.buffer.bind();
      };
      var W = [];
      function Q(re) {
        var w = W.pop();
        return w || (w = new X(d.create(
          null,
          Mn,
          !0,
          !1
        )._buffer)), te(w, re, Zs, -1, -1, 0, 0), w;
      }
      function Y(re) {
        W.push(re);
      }
      function te(re, w, B, K, se, z, fe) {
        re.buffer.bind();
        var V;
        if (w) {
          var ne = fe;
          !fe && (!m(w) || Dt(w) && !m(w.data)) && (ne = r.oes_element_index_uint ? Jt : lr), d._initBuffer(
            re.buffer,
            w,
            B,
            ne,
            3
          );
        } else
          e.bufferData(Mn, z, B), re.buffer.dtype = V || cr, re.buffer.usage = B, re.buffer.dimension = 3, re.buffer.byteLength = z;
        if (V = fe, !fe) {
          switch (re.buffer.dtype) {
            case cr:
            case Qs:
              V = cr;
              break;
            case lr:
            case $a:
              V = lr;
              break;
            case Jt:
            case za:
              V = Jt;
              break;
            default:
              u.raise("unsupported type for element array");
          }
          re.buffer.dtype = V;
        }
        re.type = V, u(
          V !== Jt || !!r.oes_element_index_uint,
          "32 bit element buffers not supported, enable oes_element_index_uint first"
        );
        var j = se;
        j < 0 && (j = re.buffer.byteLength, V === lr ? j >>= 1 : V === Jt && (j >>= 2)), re.vertCount = j;
        var ae = K;
        if (K < 0) {
          ae = Or;
          var pe = re.buffer.dimension;
          pe === 1 && (ae = qs), pe === 2 && (ae = Ks), pe === 3 && (ae = Or);
        }
        re.primType = ae;
      }
      function ie(re) {
        F.elementsCount--, u(re.buffer !== null, "must not double destroy elements"), delete N[re.id], re.buffer.destroy(), re.buffer = null;
      }
      function H(re, w) {
        var B = d.create(null, Mn, !0), K = new X(B._buffer);
        F.elementsCount++;
        function se(z) {
          if (!z)
            B(), K.primType = Or, K.vertCount = 0, K.type = cr;
          else if (typeof z == "number")
            B(z), K.primType = Or, K.vertCount = z | 0, K.type = cr;
          else {
            var fe = null, V = Js, ne = -1, j = -1, ae = 0, pe = 0;
            Array.isArray(z) || m(z) || Dt(z) ? fe = z : (u.type(z, "object", "invalid arguments for elements"), "data" in z && (fe = z.data, u(
              Array.isArray(fe) || m(fe) || Dt(fe),
              "invalid data for element buffer"
            )), "usage" in z && (u.parameter(
              z.usage,
              Qr,
              "invalid element buffer usage"
            ), V = Qr[z.usage]), "primitive" in z && (u.parameter(
              z.primitive,
              ur,
              "invalid element buffer primitive"
            ), ne = ur[z.primitive]), "count" in z && (u(
              typeof z.count == "number" && z.count >= 0,
              "invalid vertex count for elements"
            ), j = z.count | 0), "type" in z && (u.parameter(
              z.type,
              M,
              "invalid buffer type"
            ), pe = M[z.type]), "length" in z ? ae = z.length | 0 : (ae = j, pe === lr || pe === $a ? ae *= 2 : (pe === Jt || pe === za) && (ae *= 4))), te(
              K,
              fe,
              V,
              ne,
              j,
              ae,
              pe
            );
          }
          return se;
        }
        return se(re), se._reglType = "elements", se._elements = K, se.subdata = function(z, fe) {
          return B.subdata(z, fe), se;
        }, se.destroy = function() {
          ie(K);
        }, se;
      }
      return {
        create: H,
        createStream: Q,
        destroyStream: Y,
        getElements: function(re) {
          return typeof re == "function" && re._elements instanceof X ? re._elements : null;
        },
        clear: function() {
          Rt(N).forEach(ie);
        }
      };
    }
    var ja = new Float32Array(1), tf = new Uint32Array(ja.buffer), rf = 5123;
    function Va(e) {
      for (var r = Ze.allocType(rf, e.length), d = 0; d < e.length; ++d)
        if (isNaN(e[d]))
          r[d] = 65535;
        else if (e[d] === 1 / 0)
          r[d] = 31744;
        else if (e[d] === -1 / 0)
          r[d] = 64512;
        else {
          ja[0] = e[d];
          var F = tf[0], N = F >>> 31 << 15, O = (F << 1 >>> 24) - 127, M = F >> 13 & 1024 - 1;
          if (O < -24)
            r[d] = N;
          else if (O < -14) {
            var X = -14 - O;
            r[d] = N + (M + 1024 >> X);
          } else
            O > 15 ? r[d] = N + 31744 : r[d] = N + (O + 15 << 10) + M;
        }
      return r;
    }
    function Ye(e) {
      return Array.isArray(e) || m(e);
    }
    var Xa = function(e) {
      return !(e & e - 1) && !!e;
    }, nf = 34467, kt = 3553, Bn = 34067, Jr = 34069, er = 6408, kn = 6406, en = 6407, Fr = 6409, tn = 6410, Ha = 32854, In = 32855, Wa = 36194, af = 32819, of = 32820, sf = 33635, ff = 34042, Nn = 6402, rn = 34041, Pn = 35904, Un = 35906, dr = 36193, $n = 33776, zn = 33777, jn = 33778, Vn = 33779, Ya = 35986, qa = 35987, Ka = 34798, Qa = 35840, Za = 35841, Ja = 35842, ei = 35843, ti = 36196, hr = 5121, Xn = 5123, Hn = 5125, Gr = 5126, uf = 10242, cf = 10243, lf = 10497, Wn = 33071, df = 33648, hf = 10240, mf = 10241, Yn = 9728, pf = 9729, qn = 9984, ri = 9985, ni = 9986, Kn = 9987, vf = 33170, nn = 4352, yf = 4353, _f = 4354, bf = 34046, gf = 3317, xf = 37440, Ef = 37441, Af = 37443, ai = 37444, Dr = 33984, wf = [
      qn,
      ni,
      ri,
      Kn
    ], an = [
      0,
      Fr,
      tn,
      en,
      er
    ], Ot = {};
    Ot[Fr] = Ot[kn] = Ot[Nn] = 1, Ot[rn] = Ot[tn] = 2, Ot[en] = Ot[Pn] = 3, Ot[er] = Ot[Un] = 4;
    function mr(e) {
      return "[object " + e + "]";
    }
    var ii = mr("HTMLCanvasElement"), oi = mr("OffscreenCanvas"), si = mr("CanvasRenderingContext2D"), fi = mr("ImageBitmap"), ui = mr("HTMLImageElement"), ci = mr("HTMLVideoElement"), Sf = Object.keys(On).concat([
      ii,
      oi,
      si,
      fi,
      ui,
      ci
    ]), pr = [];
    pr[hr] = 1, pr[Gr] = 4, pr[dr] = 2, pr[Xn] = 2, pr[Hn] = 4;
    var lt = [];
    lt[Ha] = 2, lt[In] = 2, lt[Wa] = 2, lt[rn] = 4, lt[$n] = 0.5, lt[zn] = 0.5, lt[jn] = 1, lt[Vn] = 1, lt[Ya] = 0.5, lt[qa] = 1, lt[Ka] = 1, lt[Qa] = 0.5, lt[Za] = 0.25, lt[Ja] = 0.5, lt[ei] = 0.25, lt[ti] = 0.5;
    function li(e) {
      return Array.isArray(e) && (e.length === 0 || typeof e[0] == "number");
    }
    function di(e) {
      if (!Array.isArray(e))
        return !1;
      var r = e.length;
      return !(r === 0 || !Ye(e[0]));
    }
    function tr(e) {
      return Object.prototype.toString.call(e);
    }
    function hi(e) {
      return tr(e) === ii;
    }
    function mi(e) {
      return tr(e) === oi;
    }
    function Tf(e) {
      return tr(e) === si;
    }
    function Lf(e) {
      return tr(e) === fi;
    }
    function Rf(e) {
      return tr(e) === ui;
    }
    function Cf(e) {
      return tr(e) === ci;
    }
    function Qn(e) {
      if (!e)
        return !1;
      var r = tr(e);
      return Sf.indexOf(r) >= 0 ? !0 : li(e) || di(e) || Dt(e);
    }
    function pi(e) {
      return On[Object.prototype.toString.call(e)] | 0;
    }
    function Of(e, r) {
      var d = r.length;
      switch (e.type) {
        case hr:
        case Xn:
        case Hn:
        case Gr:
          var F = Ze.allocType(e.type, d);
          F.set(r), e.data = F;
          break;
        case dr:
          e.data = Va(r);
          break;
        default:
          u.raise("unsupported texture type, must specify a typed array");
      }
    }
    function vi(e, r) {
      return Ze.allocType(
        e.type === dr ? Gr : e.type,
        r
      );
    }
    function yi(e, r) {
      e.type === dr ? (e.data = Va(r), Ze.freeType(r)) : e.data = r;
    }
    function Ff(e, r, d, F, N, O) {
      for (var M = e.width, X = e.height, W = e.channels, Q = M * X * W, Y = vi(e, Q), te = 0, ie = 0; ie < X; ++ie)
        for (var H = 0; H < M; ++H)
          for (var re = 0; re < W; ++re)
            Y[te++] = r[d * H + F * ie + N * re + O];
      yi(e, Y);
    }
    function on(e, r, d, F, N, O) {
      var M;
      if (typeof lt[e] < "u" ? M = lt[e] : M = Ot[e] * pr[r], O && (M *= 6), N) {
        for (var X = 0, W = d; W >= 1; )
          X += M * W * W, W /= 2;
        return X;
      } else
        return M * d * F;
    }
    function Gf(e, r, d, F, N, O, M) {
      var X = {
        "don't care": nn,
        "dont care": nn,
        nice: _f,
        fast: yf
      }, W = {
        repeat: lf,
        clamp: Wn,
        mirror: df
      }, Q = {
        nearest: Yn,
        linear: pf
      }, Y = E({
        mipmap: Kn,
        "nearest mipmap nearest": qn,
        "linear mipmap nearest": ri,
        "nearest mipmap linear": ni,
        "linear mipmap linear": Kn
      }, Q), te = {
        none: 0,
        browser: ai
      }, ie = {
        uint8: hr,
        rgba4: af,
        rgb565: sf,
        "rgb5 a1": of
      }, H = {
        alpha: kn,
        luminance: Fr,
        "luminance alpha": tn,
        rgb: en,
        rgba: er,
        rgba4: Ha,
        "rgb5 a1": In,
        rgb565: Wa
      }, re = {};
      r.ext_srgb && (H.srgb = Pn, H.srgba = Un), r.oes_texture_float && (ie.float32 = ie.float = Gr), r.oes_texture_half_float && (ie.float16 = ie["half float"] = dr), r.webgl_depth_texture && (E(H, {
        depth: Nn,
        "depth stencil": rn
      }), E(ie, {
        uint16: Xn,
        uint32: Hn,
        "depth stencil": ff
      })), r.webgl_compressed_texture_s3tc && E(re, {
        "rgb s3tc dxt1": $n,
        "rgba s3tc dxt1": zn,
        "rgba s3tc dxt3": jn,
        "rgba s3tc dxt5": Vn
      }), r.webgl_compressed_texture_atc && E(re, {
        "rgb atc": Ya,
        "rgba atc explicit alpha": qa,
        "rgba atc interpolated alpha": Ka
      }), r.webgl_compressed_texture_pvrtc && E(re, {
        "rgb pvrtc 4bppv1": Qa,
        "rgb pvrtc 2bppv1": Za,
        "rgba pvrtc 4bppv1": Ja,
        "rgba pvrtc 2bppv1": ei
      }), r.webgl_compressed_texture_etc1 && (re["rgb etc1"] = ti);
      var w = Array.prototype.slice.call(
        e.getParameter(nf)
      );
      Object.keys(re).forEach(function(l) {
        var G = re[l];
        w.indexOf(G) >= 0 && (H[l] = G);
      });
      var B = Object.keys(H);
      d.textureFormats = B;
      var K = [];
      Object.keys(H).forEach(function(l) {
        var G = H[l];
        K[G] = l;
      });
      var se = [];
      Object.keys(ie).forEach(function(l) {
        var G = ie[l];
        se[G] = l;
      });
      var z = [];
      Object.keys(Q).forEach(function(l) {
        var G = Q[l];
        z[G] = l;
      });
      var fe = [];
      Object.keys(Y).forEach(function(l) {
        var G = Y[l];
        fe[G] = l;
      });
      var V = [];
      Object.keys(W).forEach(function(l) {
        var G = W[l];
        V[G] = l;
      });
      var ne = B.reduce(function(l, G) {
        var R = H[G];
        return R === Fr || R === kn || R === Fr || R === tn || R === Nn || R === rn || r.ext_srgb && (R === Pn || R === Un) ? l[R] = R : R === In || G.indexOf("rgba") >= 0 ? l[R] = er : l[R] = en, l;
      }, {});
      function j() {
        this.internalformat = er, this.format = er, this.type = hr, this.compressed = !1, this.premultiplyAlpha = !1, this.flipY = !1, this.unpackAlignment = 1, this.colorSpace = ai, this.width = 0, this.height = 0, this.channels = 0;
      }
      function ae(l, G) {
        l.internalformat = G.internalformat, l.format = G.format, l.type = G.type, l.compressed = G.compressed, l.premultiplyAlpha = G.premultiplyAlpha, l.flipY = G.flipY, l.unpackAlignment = G.unpackAlignment, l.colorSpace = G.colorSpace, l.width = G.width, l.height = G.height, l.channels = G.channels;
      }
      function pe(l, G) {
        if (!(typeof G != "object" || !G)) {
          if ("premultiplyAlpha" in G && (u.type(
            G.premultiplyAlpha,
            "boolean",
            "invalid premultiplyAlpha"
          ), l.premultiplyAlpha = G.premultiplyAlpha), "flipY" in G && (u.type(
            G.flipY,
            "boolean",
            "invalid texture flip"
          ), l.flipY = G.flipY), "alignment" in G && (u.oneOf(
            G.alignment,
            [1, 2, 4, 8],
            "invalid texture unpack alignment"
          ), l.unpackAlignment = G.alignment), "colorSpace" in G && (u.parameter(
            G.colorSpace,
            te,
            "invalid colorSpace"
          ), l.colorSpace = te[G.colorSpace]), "type" in G) {
            var R = G.type;
            u(
              r.oes_texture_float || !(R === "float" || R === "float32"),
              "you must enable the OES_texture_float extension in order to use floating point textures."
            ), u(
              r.oes_texture_half_float || !(R === "half float" || R === "float16"),
              "you must enable the OES_texture_half_float extension in order to use 16-bit floating point textures."
            ), u(
              r.webgl_depth_texture || !(R === "uint16" || R === "uint32" || R === "depth stencil"),
              "you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures."
            ), u.parameter(
              R,
              ie,
              "invalid texture type"
            ), l.type = ie[R];
          }
          var ue = l.width, Ge = l.height, s = l.channels, t = !1;
          "shape" in G ? (u(
            Array.isArray(G.shape) && G.shape.length >= 2,
            "shape must be an array"
          ), ue = G.shape[0], Ge = G.shape[1], G.shape.length === 3 && (s = G.shape[2], u(s > 0 && s <= 4, "invalid number of channels"), t = !0), u(ue >= 0 && ue <= d.maxTextureSize, "invalid width"), u(Ge >= 0 && Ge <= d.maxTextureSize, "invalid height")) : ("radius" in G && (ue = Ge = G.radius, u(ue >= 0 && ue <= d.maxTextureSize, "invalid radius")), "width" in G && (ue = G.width, u(ue >= 0 && ue <= d.maxTextureSize, "invalid width")), "height" in G && (Ge = G.height, u(Ge >= 0 && Ge <= d.maxTextureSize, "invalid height")), "channels" in G && (s = G.channels, u(s > 0 && s <= 4, "invalid number of channels"), t = !0)), l.width = ue | 0, l.height = Ge | 0, l.channels = s | 0;
          var p = !1;
          if ("format" in G) {
            var A = G.format;
            u(
              r.webgl_depth_texture || !(A === "depth" || A === "depth stencil"),
              "you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures."
            ), u.parameter(
              A,
              H,
              "invalid texture format"
            );
            var S = l.internalformat = H[A];
            l.format = ne[S], A in ie && ("type" in G || (l.type = ie[A])), A in re && (l.compressed = !0), p = !0;
          }
          !t && p ? l.channels = Ot[l.format] : t && !p ? l.channels !== an[l.format] && (l.format = l.internalformat = an[l.channels]) : p && t && u(
            l.channels === Ot[l.format],
            "number of channels inconsistent with specified format"
          );
        }
      }
      function ge(l) {
        e.pixelStorei(xf, l.flipY), e.pixelStorei(Ef, l.premultiplyAlpha), e.pixelStorei(Af, l.colorSpace), e.pixelStorei(gf, l.unpackAlignment);
      }
      function oe() {
        j.call(this), this.xOffset = 0, this.yOffset = 0, this.data = null, this.needsFree = !1, this.element = null, this.needsCopy = !1;
      }
      function Z(l, G) {
        var R = null;
        if (Qn(G) ? R = G : G && (u.type(G, "object", "invalid pixel data type"), pe(l, G), "x" in G && (l.xOffset = G.x | 0), "y" in G && (l.yOffset = G.y | 0), Qn(G.data) && (R = G.data)), u(
          !l.compressed || R instanceof Uint8Array,
          "compressed texture data must be stored in a uint8array"
        ), G.copy) {
          u(!R, "can not specify copy and data field for the same texture");
          var ue = N.viewportWidth, Ge = N.viewportHeight;
          l.width = l.width || ue - l.xOffset, l.height = l.height || Ge - l.yOffset, l.needsCopy = !0, u(
            l.xOffset >= 0 && l.xOffset < ue && l.yOffset >= 0 && l.yOffset < Ge && l.width > 0 && l.width <= ue && l.height > 0 && l.height <= Ge,
            "copy texture read out of bounds"
          );
        } else if (!R)
          l.width = l.width || 1, l.height = l.height || 1, l.channels = l.channels || 4;
        else if (m(R))
          l.channels = l.channels || 4, l.data = R, !("type" in G) && l.type === hr && (l.type = pi(R));
        else if (li(R))
          l.channels = l.channels || 4, Of(l, R), l.alignment = 1, l.needsFree = !0;
        else if (Dt(R)) {
          var s = R.data;
          !Array.isArray(s) && l.type === hr && (l.type = pi(s));
          var t = R.shape, p = R.stride, A, S, y, v, b, f;
          t.length === 3 ? (y = t[2], f = p[2]) : (u(t.length === 2, "invalid ndarray pixel data, must be 2 or 3D"), y = 1, f = 1), A = t[0], S = t[1], v = p[0], b = p[1], l.alignment = 1, l.width = A, l.height = S, l.channels = y, l.format = l.internalformat = an[y], l.needsFree = !0, Ff(l, s, v, b, f, R.offset);
        } else if (hi(R) || mi(R) || Tf(R))
          hi(R) || mi(R) ? l.element = R : l.element = R.canvas, l.width = l.element.width, l.height = l.element.height, l.channels = 4;
        else if (Lf(R))
          l.element = R, l.width = R.width, l.height = R.height, l.channels = 4;
        else if (Rf(R))
          l.element = R, l.width = R.naturalWidth, l.height = R.naturalHeight, l.channels = 4;
        else if (Cf(R))
          l.element = R, l.width = R.videoWidth, l.height = R.videoHeight, l.channels = 4;
        else if (di(R)) {
          var h = l.width || R[0].length, n = l.height || R.length, g = l.channels;
          Ye(R[0][0]) ? g = g || R[0][0].length : g = g || 1;
          for (var L = Kr.shape(R), I = 1, P = 0; P < L.length; ++P)
            I *= L[P];
          var k = vi(l, I);
          Kr.flatten(R, L, "", k), yi(l, k), l.alignment = 1, l.width = h, l.height = n, l.channels = g, l.format = l.internalformat = an[g], l.needsFree = !0;
        }
        l.type === Gr ? u(
          d.extensions.indexOf("oes_texture_float") >= 0,
          "oes_texture_float extension not enabled"
        ) : l.type === dr && u(
          d.extensions.indexOf("oes_texture_half_float") >= 0,
          "oes_texture_half_float extension not enabled"
        );
      }
      function U(l, G, R) {
        var ue = l.element, Ge = l.data, s = l.internalformat, t = l.format, p = l.type, A = l.width, S = l.height;
        ge(l), ue ? e.texImage2D(G, R, t, t, p, ue) : l.compressed ? e.compressedTexImage2D(G, R, s, A, S, 0, Ge) : l.needsCopy ? (F(), e.copyTexImage2D(
          G,
          R,
          t,
          l.xOffset,
          l.yOffset,
          A,
          S,
          0
        )) : e.texImage2D(G, R, t, A, S, 0, t, p, Ge || null);
      }
      function _e(l, G, R, ue, Ge) {
        var s = l.element, t = l.data, p = l.internalformat, A = l.format, S = l.type, y = l.width, v = l.height;
        ge(l), s ? e.texSubImage2D(
          G,
          Ge,
          R,
          ue,
          A,
          S,
          s
        ) : l.compressed ? e.compressedTexSubImage2D(
          G,
          Ge,
          R,
          ue,
          p,
          y,
          v,
          t
        ) : l.needsCopy ? (F(), e.copyTexSubImage2D(
          G,
          Ge,
          R,
          ue,
          l.xOffset,
          l.yOffset,
          y,
          v
        )) : e.texSubImage2D(
          G,
          Ge,
          R,
          ue,
          y,
          v,
          A,
          S,
          t
        );
      }
      var Le = [];
      function le() {
        return Le.pop() || new oe();
      }
      function Fe(l) {
        l.needsFree && Ze.freeType(l.data), oe.call(l), Le.push(l);
      }
      function xe() {
        j.call(this), this.genMipmaps = !1, this.mipmapHint = nn, this.mipmask = 0, this.images = Array(16);
      }
      function Oe(l, G, R) {
        var ue = l.images[0] = le();
        l.mipmask = 1, ue.width = l.width = G, ue.height = l.height = R, ue.channels = l.channels = 4;
      }
      function $e(l, G) {
        var R = null;
        if (Qn(G))
          R = l.images[0] = le(), ae(R, l), Z(R, G), l.mipmask = 1;
        else if (pe(l, G), Array.isArray(G.mipmap))
          for (var ue = G.mipmap, Ge = 0; Ge < ue.length; ++Ge)
            R = l.images[Ge] = le(), ae(R, l), R.width >>= Ge, R.height >>= Ge, Z(R, ue[Ge]), l.mipmask |= 1 << Ge;
        else
          R = l.images[0] = le(), ae(R, l), Z(R, G), l.mipmask = 1;
        ae(l, l.images[0]), l.compressed && (l.internalformat === $n || l.internalformat === zn || l.internalformat === jn || l.internalformat === Vn) && u(
          l.width % 4 === 0 && l.height % 4 === 0,
          "for compressed texture formats, mipmap level 0 must have width and height that are a multiple of 4"
        );
      }
      function et(l, G) {
        for (var R = l.images, ue = 0; ue < R.length; ++ue) {
          if (!R[ue])
            return;
          U(R[ue], G, ue);
        }
      }
      var ot = [];
      function Me() {
        var l = ot.pop() || new xe();
        j.call(l), l.mipmask = 0;
        for (var G = 0; G < 16; ++G)
          l.images[G] = null;
        return l;
      }
      function rt(l) {
        for (var G = l.images, R = 0; R < G.length; ++R)
          G[R] && Fe(G[R]), G[R] = null;
        ot.push(l);
      }
      function Ve() {
        this.minFilter = Yn, this.magFilter = Yn, this.wrapS = Wn, this.wrapT = Wn, this.anisotropic = 1, this.genMipmaps = !1, this.mipmapHint = nn;
      }
      function tt(l, G) {
        if ("min" in G) {
          var R = G.min;
          u.parameter(R, Y), l.minFilter = Y[R], wf.indexOf(l.minFilter) >= 0 && !("faces" in G) && (l.genMipmaps = !0);
        }
        if ("mag" in G) {
          var ue = G.mag;
          u.parameter(ue, Q), l.magFilter = Q[ue];
        }
        var Ge = l.wrapS, s = l.wrapT;
        if ("wrap" in G) {
          var t = G.wrap;
          typeof t == "string" ? (u.parameter(t, W), Ge = s = W[t]) : Array.isArray(t) && (u.parameter(t[0], W), u.parameter(t[1], W), Ge = W[t[0]], s = W[t[1]]);
        } else {
          if ("wrapS" in G) {
            var p = G.wrapS;
            u.parameter(p, W), Ge = W[p];
          }
          if ("wrapT" in G) {
            var A = G.wrapT;
            u.parameter(A, W), s = W[A];
          }
        }
        if (l.wrapS = Ge, l.wrapT = s, "anisotropic" in G) {
          var S = G.anisotropic;
          u(
            typeof S == "number" && S >= 1 && S <= d.maxAnisotropic,
            "aniso samples must be between 1 and "
          ), l.anisotropic = G.anisotropic;
        }
        if ("mipmap" in G) {
          var y = !1;
          switch (typeof G.mipmap) {
            case "string":
              u.parameter(
                G.mipmap,
                X,
                "invalid mipmap hint"
              ), l.mipmapHint = X[G.mipmap], l.genMipmaps = !0, y = !0;
              break;
            case "boolean":
              y = l.genMipmaps = G.mipmap;
              break;
            case "object":
              u(Array.isArray(G.mipmap), "invalid mipmap type"), l.genMipmaps = !1, y = !0;
              break;
            default:
              u.raise("invalid mipmap type");
          }
          y && !("min" in G) && (l.minFilter = qn);
        }
      }
      function nt(l, G) {
        e.texParameteri(G, mf, l.minFilter), e.texParameteri(G, hf, l.magFilter), e.texParameteri(G, uf, l.wrapS), e.texParameteri(G, cf, l.wrapT), r.ext_texture_filter_anisotropic && e.texParameteri(G, bf, l.anisotropic), l.genMipmaps && (e.hint(vf, l.mipmapHint), e.generateMipmap(G));
      }
      var at = 0, ft = {}, dt = d.maxTextureUnits, qe = Array(dt).map(function() {
        return null;
      });
      function Re(l) {
        j.call(this), this.mipmask = 0, this.internalformat = er, this.id = at++, this.refCount = 1, this.target = l, this.texture = e.createTexture(), this.unit = -1, this.bindCount = 0, this.texInfo = new Ve(), M.profile && (this.stats = { size: 0 });
      }
      function ht(l) {
        e.activeTexture(Dr), e.bindTexture(l.target, l.texture);
      }
      function je() {
        var l = qe[0];
        l ? e.bindTexture(l.target, l.texture) : e.bindTexture(kt, null);
      }
      function ve(l) {
        var G = l.texture;
        u(G, "must not double destroy texture");
        var R = l.unit, ue = l.target;
        R >= 0 && (e.activeTexture(Dr + R), e.bindTexture(ue, null), qe[R] = null), e.deleteTexture(G), l.texture = null, l.params = null, l.pixels = null, l.refCount = 0, delete ft[l.id], O.textureCount--;
      }
      E(Re.prototype, {
        bind: function() {
          var l = this;
          l.bindCount += 1;
          var G = l.unit;
          if (G < 0) {
            for (var R = 0; R < dt; ++R) {
              var ue = qe[R];
              if (ue) {
                if (ue.bindCount > 0)
                  continue;
                ue.unit = -1;
              }
              qe[R] = l, G = R;
              break;
            }
            G >= dt && u.raise("insufficient number of texture units"), M.profile && O.maxTextureUnits < G + 1 && (O.maxTextureUnits = G + 1), l.unit = G, e.activeTexture(Dr + G), e.bindTexture(l.target, l.texture);
          }
          return G;
        },
        unbind: function() {
          this.bindCount -= 1;
        },
        decRef: function() {
          --this.refCount <= 0 && ve(this);
        }
      });
      function De(l, G) {
        var R = new Re(kt);
        ft[R.id] = R, O.textureCount++;
        function ue(t, p) {
          var A = R.texInfo;
          Ve.call(A);
          var S = Me();
          return typeof t == "number" ? typeof p == "number" ? Oe(S, t | 0, p | 0) : Oe(S, t | 0, t | 0) : t ? (u.type(t, "object", "invalid arguments to regl.texture"), tt(A, t), $e(S, t)) : Oe(S, 1, 1), A.genMipmaps && (S.mipmask = (S.width << 1) - 1), R.mipmask = S.mipmask, ae(R, S), u.texture2D(A, S, d), R.internalformat = S.internalformat, ue.width = S.width, ue.height = S.height, ht(R), et(S, kt), nt(A, kt), je(), rt(S), M.profile && (R.stats.size = on(
            R.internalformat,
            R.type,
            S.width,
            S.height,
            A.genMipmaps,
            !1
          )), ue.format = K[R.internalformat], ue.type = se[R.type], ue.mag = z[A.magFilter], ue.min = fe[A.minFilter], ue.wrapS = V[A.wrapS], ue.wrapT = V[A.wrapT], ue;
        }
        function Ge(t, p, A, S) {
          u(!!t, "must specify image data");
          var y = p | 0, v = A | 0, b = S | 0, f = le();
          return ae(f, R), f.width = 0, f.height = 0, Z(f, t), f.width = f.width || (R.width >> b) - y, f.height = f.height || (R.height >> b) - v, u(
            R.type === f.type && R.format === f.format && R.internalformat === f.internalformat,
            "incompatible format for texture.subimage"
          ), u(
            y >= 0 && v >= 0 && y + f.width <= R.width && v + f.height <= R.height,
            "texture.subimage write out of bounds"
          ), u(
            R.mipmask & 1 << b,
            "missing mipmap data"
          ), u(
            f.data || f.element || f.needsCopy,
            "missing image data"
          ), ht(R), _e(f, kt, y, v, b), je(), Fe(f), ue;
        }
        function s(t, p) {
          var A = t | 0, S = p | 0 || A;
          if (A === R.width && S === R.height)
            return ue;
          ue.width = R.width = A, ue.height = R.height = S, ht(R);
          for (var y = 0; R.mipmask >> y; ++y) {
            var v = A >> y, b = S >> y;
            if (!v || !b)
              break;
            e.texImage2D(
              kt,
              y,
              R.format,
              v,
              b,
              0,
              R.format,
              R.type,
              null
            );
          }
          return je(), M.profile && (R.stats.size = on(
            R.internalformat,
            R.type,
            A,
            S,
            !1,
            !1
          )), ue;
        }
        return ue(l, G), ue.subimage = Ge, ue.resize = s, ue._reglType = "texture2d", ue._texture = R, M.profile && (ue.stats = R.stats), ue.destroy = function() {
          R.decRef();
        }, ue;
      }
      function Ne(l, G, R, ue, Ge, s) {
        var t = new Re(Bn);
        ft[t.id] = t, O.cubeCount++;
        var p = new Array(6);
        function A(v, b, f, h, n, g) {
          var L, I = t.texInfo;
          for (Ve.call(I), L = 0; L < 6; ++L)
            p[L] = Me();
          if (typeof v == "number" || !v) {
            var P = v | 0 || 1;
            for (L = 0; L < 6; ++L)
              Oe(p[L], P, P);
          } else if (typeof v == "object")
            if (b)
              $e(p[0], v), $e(p[1], b), $e(p[2], f), $e(p[3], h), $e(p[4], n), $e(p[5], g);
            else if (tt(I, v), pe(t, v), "faces" in v) {
              var k = v.faces;
              for (u(
                Array.isArray(k) && k.length === 6,
                "cube faces must be a length 6 array"
              ), L = 0; L < 6; ++L)
                u(
                  typeof k[L] == "object" && !!k[L],
                  "invalid input for cube map face"
                ), ae(p[L], t), $e(p[L], k[L]);
            } else
              for (L = 0; L < 6; ++L)
                $e(p[L], v);
          else
            u.raise("invalid arguments to cube map");
          for (ae(t, p[0]), d.npotTextureCube || u(Xa(t.width) && Xa(t.height), "your browser does not support non power or two texture dimensions"), I.genMipmaps ? t.mipmask = (p[0].width << 1) - 1 : t.mipmask = p[0].mipmask, u.textureCube(t, I, p, d), t.internalformat = p[0].internalformat, A.width = p[0].width, A.height = p[0].height, ht(t), L = 0; L < 6; ++L)
            et(p[L], Jr + L);
          for (nt(I, Bn), je(), M.profile && (t.stats.size = on(
            t.internalformat,
            t.type,
            A.width,
            A.height,
            I.genMipmaps,
            !0
          )), A.format = K[t.internalformat], A.type = se[t.type], A.mag = z[I.magFilter], A.min = fe[I.minFilter], A.wrapS = V[I.wrapS], A.wrapT = V[I.wrapT], L = 0; L < 6; ++L)
            rt(p[L]);
          return A;
        }
        function S(v, b, f, h, n) {
          u(!!b, "must specify image data"), u(typeof v == "number" && v === (v | 0) && v >= 0 && v < 6, "invalid face");
          var g = f | 0, L = h | 0, I = n | 0, P = le();
          return ae(P, t), P.width = 0, P.height = 0, Z(P, b), P.width = P.width || (t.width >> I) - g, P.height = P.height || (t.height >> I) - L, u(
            t.type === P.type && t.format === P.format && t.internalformat === P.internalformat,
            "incompatible format for texture.subimage"
          ), u(
            g >= 0 && L >= 0 && g + P.width <= t.width && L + P.height <= t.height,
            "texture.subimage write out of bounds"
          ), u(
            t.mipmask & 1 << I,
            "missing mipmap data"
          ), u(
            P.data || P.element || P.needsCopy,
            "missing image data"
          ), ht(t), _e(P, Jr + v, g, L, I), je(), Fe(P), A;
        }
        function y(v) {
          var b = v | 0;
          if (b !== t.width) {
            A.width = t.width = b, A.height = t.height = b, ht(t);
            for (var f = 0; f < 6; ++f)
              for (var h = 0; t.mipmask >> h; ++h)
                e.texImage2D(
                  Jr + f,
                  h,
                  t.format,
                  b >> h,
                  b >> h,
                  0,
                  t.format,
                  t.type,
                  null
                );
            return je(), M.profile && (t.stats.size = on(
              t.internalformat,
              t.type,
              A.width,
              A.height,
              !1,
              !0
            )), A;
          }
        }
        return A(l, G, R, ue, Ge, s), A.subimage = S, A.resize = y, A._reglType = "textureCube", A._texture = t, M.profile && (A.stats = t.stats), A.destroy = function() {
          t.decRef();
        }, A;
      }
      function Ke() {
        for (var l = 0; l < dt; ++l)
          e.activeTexture(Dr + l), e.bindTexture(kt, null), qe[l] = null;
        Rt(ft).forEach(ve), O.cubeCount = 0, O.textureCount = 0;
      }
      M.profile && (O.getTotalTextureSize = function() {
        var l = 0;
        return Object.keys(ft).forEach(function(G) {
          l += ft[G].stats.size;
        }), l;
      });
      function Nt() {
        for (var l = 0; l < dt; ++l) {
          var G = qe[l];
          G && (G.bindCount = 0, G.unit = -1, qe[l] = null);
        }
        Rt(ft).forEach(function(R) {
          R.texture = e.createTexture(), e.bindTexture(R.target, R.texture);
          for (var ue = 0; ue < 32; ++ue)
            if (R.mipmask & 1 << ue)
              if (R.target === kt)
                e.texImage2D(
                  kt,
                  ue,
                  R.internalformat,
                  R.width >> ue,
                  R.height >> ue,
                  0,
                  R.internalformat,
                  R.type,
                  null
                );
              else
                for (var Ge = 0; Ge < 6; ++Ge)
                  e.texImage2D(
                    Jr + Ge,
                    ue,
                    R.internalformat,
                    R.width >> ue,
                    R.height >> ue,
                    0,
                    R.internalformat,
                    R.type,
                    null
                  );
          nt(R.texInfo, R.target);
        });
      }
      function fr() {
        for (var l = 0; l < dt; ++l) {
          var G = qe[l];
          G && (G.bindCount = 0, G.unit = -1, qe[l] = null), e.activeTexture(Dr + l), e.bindTexture(kt, null), e.bindTexture(Bn, null);
        }
      }
      return {
        create2D: De,
        createCube: Ne,
        clear: Ke,
        getTexture: function(l) {
          return null;
        },
        restore: Nt,
        refresh: fr
      };
    }
    var jt = 36161, sn = 32854, _i = 32855, bi = 36194, gi = 33189, xi = 36168, Ei = 34041, Ai = 35907, wi = 34836, Si = 34842, Ti = 34843, Mt = [];
    Mt[sn] = 2, Mt[_i] = 2, Mt[bi] = 2, Mt[gi] = 2, Mt[xi] = 1, Mt[Ei] = 4, Mt[Ai] = 4, Mt[wi] = 16, Mt[Si] = 8, Mt[Ti] = 6;
    function Li(e, r, d) {
      return Mt[e] * r * d;
    }
    var Df = function(e, r, d, F, N) {
      var O = {
        rgba4: sn,
        rgb565: bi,
        "rgb5 a1": _i,
        depth: gi,
        stencil: xi,
        "depth stencil": Ei
      };
      r.ext_srgb && (O.srgba = Ai), r.ext_color_buffer_half_float && (O.rgba16f = Si, O.rgb16f = Ti), r.webgl_color_buffer_float && (O.rgba32f = wi);
      var M = [];
      Object.keys(O).forEach(function(H) {
        var re = O[H];
        M[re] = H;
      });
      var X = 0, W = {};
      function Q(H) {
        this.id = X++, this.refCount = 1, this.renderbuffer = H, this.format = sn, this.width = 0, this.height = 0, N.profile && (this.stats = { size: 0 });
      }
      Q.prototype.decRef = function() {
        --this.refCount <= 0 && Y(this);
      };
      function Y(H) {
        var re = H.renderbuffer;
        u(re, "must not double destroy renderbuffer"), e.bindRenderbuffer(jt, null), e.deleteRenderbuffer(re), H.renderbuffer = null, H.refCount = 0, delete W[H.id], F.renderbufferCount--;
      }
      function te(H, re) {
        var w = new Q(e.createRenderbuffer());
        W[w.id] = w, F.renderbufferCount++;
        function B(se, z) {
          var fe = 0, V = 0, ne = sn;
          if (typeof se == "object" && se) {
            var j = se;
            if ("shape" in j) {
              var ae = j.shape;
              u(
                Array.isArray(ae) && ae.length >= 2,
                "invalid renderbuffer shape"
              ), fe = ae[0] | 0, V = ae[1] | 0;
            } else
              "radius" in j && (fe = V = j.radius | 0), "width" in j && (fe = j.width | 0), "height" in j && (V = j.height | 0);
            "format" in j && (u.parameter(
              j.format,
              O,
              "invalid renderbuffer format"
            ), ne = O[j.format]);
          } else
            typeof se == "number" ? (fe = se | 0, typeof z == "number" ? V = z | 0 : V = fe) : se ? u.raise("invalid arguments to renderbuffer constructor") : fe = V = 1;
          if (u(
            fe > 0 && V > 0 && fe <= d.maxRenderbufferSize && V <= d.maxRenderbufferSize,
            "invalid renderbuffer size"
          ), !(fe === w.width && V === w.height && ne === w.format))
            return B.width = w.width = fe, B.height = w.height = V, w.format = ne, e.bindRenderbuffer(jt, w.renderbuffer), e.renderbufferStorage(jt, ne, fe, V), u(
              e.getError() === 0,
              "invalid render buffer format"
            ), N.profile && (w.stats.size = Li(w.format, w.width, w.height)), B.format = M[w.format], B;
        }
        function K(se, z) {
          var fe = se | 0, V = z | 0 || fe;
          return fe === w.width && V === w.height || (u(
            fe > 0 && V > 0 && fe <= d.maxRenderbufferSize && V <= d.maxRenderbufferSize,
            "invalid renderbuffer size"
          ), B.width = w.width = fe, B.height = w.height = V, e.bindRenderbuffer(jt, w.renderbuffer), e.renderbufferStorage(jt, w.format, fe, V), u(
            e.getError() === 0,
            "invalid render buffer format"
          ), N.profile && (w.stats.size = Li(
            w.format,
            w.width,
            w.height
          ))), B;
        }
        return B(H, re), B.resize = K, B._reglType = "renderbuffer", B._renderbuffer = w, N.profile && (B.stats = w.stats), B.destroy = function() {
          w.decRef();
        }, B;
      }
      N.profile && (F.getTotalRenderbufferSize = function() {
        var H = 0;
        return Object.keys(W).forEach(function(re) {
          H += W[re].stats.size;
        }), H;
      });
      function ie() {
        Rt(W).forEach(function(H) {
          H.renderbuffer = e.createRenderbuffer(), e.bindRenderbuffer(jt, H.renderbuffer), e.renderbufferStorage(jt, H.format, H.width, H.height);
        }), e.bindRenderbuffer(jt, null);
      }
      return {
        create: te,
        clear: function() {
          Rt(W).forEach(Y);
        },
        restore: ie
      };
    }, Pt = 36160, Zn = 36161, rr = 3553, fn = 34069, Ri = 36064, Ci = 36096, Oi = 36128, Fi = 33306, Gi = 36053, Mf = 36054, Bf = 36055, kf = 36057, If = 36061, Nf = 36193, Pf = 5121, Uf = 5126, Di = 6407, Mi = 6408, $f = 6402, zf = [
      Di,
      Mi
    ], Jn = [];
    Jn[Mi] = 4, Jn[Di] = 3;
    var un = [];
    un[Pf] = 1, un[Uf] = 4, un[Nf] = 2;
    var jf = 32854, Vf = 32855, Xf = 36194, Hf = 33189, Wf = 36168, Bi = 34041, Yf = 35907, qf = 34836, Kf = 34842, Qf = 34843, Zf = [
      jf,
      Vf,
      Xf,
      Yf,
      Kf,
      Qf,
      qf
    ], vr = {};
    vr[Gi] = "complete", vr[Mf] = "incomplete attachment", vr[kf] = "incomplete dimensions", vr[Bf] = "incomplete, missing attachment", vr[If] = "unsupported";
    function Jf(e, r, d, F, N, O) {
      var M = {
        cur: null,
        next: null,
        dirty: !1,
        setFBO: null
      }, X = ["rgba"], W = ["rgba4", "rgb565", "rgb5 a1"];
      r.ext_srgb && W.push("srgba"), r.ext_color_buffer_half_float && W.push("rgba16f", "rgb16f"), r.webgl_color_buffer_float && W.push("rgba32f");
      var Q = ["uint8"];
      r.oes_texture_half_float && Q.push("half float", "float16"), r.oes_texture_float && Q.push("float", "float32");
      function Y(oe, Z, U) {
        this.target = oe, this.texture = Z, this.renderbuffer = U;
        var _e = 0, Le = 0;
        Z ? (_e = Z.width, Le = Z.height) : U && (_e = U.width, Le = U.height), this.width = _e, this.height = Le;
      }
      function te(oe) {
        oe && (oe.texture && oe.texture._texture.decRef(), oe.renderbuffer && oe.renderbuffer._renderbuffer.decRef());
      }
      function ie(oe, Z, U) {
        if (oe)
          if (oe.texture) {
            var _e = oe.texture._texture, Le = Math.max(1, _e.width), le = Math.max(1, _e.height);
            u(
              Le === Z && le === U,
              "inconsistent width/height for supplied texture"
            ), _e.refCount += 1;
          } else {
            var Fe = oe.renderbuffer._renderbuffer;
            u(
              Fe.width === Z && Fe.height === U,
              "inconsistent width/height for renderbuffer"
            ), Fe.refCount += 1;
          }
      }
      function H(oe, Z) {
        Z && (Z.texture ? e.framebufferTexture2D(
          Pt,
          oe,
          Z.target,
          Z.texture._texture.texture,
          0
        ) : e.framebufferRenderbuffer(
          Pt,
          oe,
          Zn,
          Z.renderbuffer._renderbuffer.renderbuffer
        ));
      }
      function re(oe) {
        var Z = rr, U = null, _e = null, Le = oe;
        typeof oe == "object" && (Le = oe.data, "target" in oe && (Z = oe.target | 0)), u.type(Le, "function", "invalid attachment data");
        var le = Le._reglType;
        return le === "texture2d" ? (U = Le, u(Z === rr)) : le === "textureCube" ? (U = Le, u(
          Z >= fn && Z < fn + 6,
          "invalid cube map target"
        )) : le === "renderbuffer" ? (_e = Le, Z = Zn) : u.raise("invalid regl object for attachment"), new Y(Z, U, _e);
      }
      function w(oe, Z, U, _e, Le) {
        if (U) {
          var le = F.create2D({
            width: oe,
            height: Z,
            format: _e,
            type: Le
          });
          return le._texture.refCount = 0, new Y(rr, le, null);
        } else {
          var Fe = N.create({
            width: oe,
            height: Z,
            format: _e
          });
          return Fe._renderbuffer.refCount = 0, new Y(Zn, null, Fe);
        }
      }
      function B(oe) {
        return oe && (oe.texture || oe.renderbuffer);
      }
      function K(oe, Z, U) {
        oe && (oe.texture ? oe.texture.resize(Z, U) : oe.renderbuffer && oe.renderbuffer.resize(Z, U), oe.width = Z, oe.height = U);
      }
      var se = 0, z = {};
      function fe() {
        this.id = se++, z[this.id] = this, this.framebuffer = e.createFramebuffer(), this.width = 0, this.height = 0, this.colorAttachments = [], this.depthAttachment = null, this.stencilAttachment = null, this.depthStencilAttachment = null;
      }
      function V(oe) {
        oe.colorAttachments.forEach(te), te(oe.depthAttachment), te(oe.stencilAttachment), te(oe.depthStencilAttachment);
      }
      function ne(oe) {
        var Z = oe.framebuffer;
        u(Z, "must not double destroy framebuffer"), e.deleteFramebuffer(Z), oe.framebuffer = null, O.framebufferCount--, delete z[oe.id];
      }
      function j(oe) {
        var Z;
        e.bindFramebuffer(Pt, oe.framebuffer);
        var U = oe.colorAttachments;
        for (Z = 0; Z < U.length; ++Z)
          H(Ri + Z, U[Z]);
        for (Z = U.length; Z < d.maxColorAttachments; ++Z)
          e.framebufferTexture2D(
            Pt,
            Ri + Z,
            rr,
            null,
            0
          );
        e.framebufferTexture2D(
          Pt,
          Fi,
          rr,
          null,
          0
        ), e.framebufferTexture2D(
          Pt,
          Ci,
          rr,
          null,
          0
        ), e.framebufferTexture2D(
          Pt,
          Oi,
          rr,
          null,
          0
        ), H(Ci, oe.depthAttachment), H(Oi, oe.stencilAttachment), H(Fi, oe.depthStencilAttachment);
        var _e = e.checkFramebufferStatus(Pt);
        !e.isContextLost() && _e !== Gi && u.raise("framebuffer configuration not supported, status = " + vr[_e]), e.bindFramebuffer(Pt, M.next ? M.next.framebuffer : null), M.cur = M.next, e.getError();
      }
      function ae(oe, Z) {
        var U = new fe();
        O.framebufferCount++;
        function _e(le, Fe) {
          var xe;
          u(
            M.next !== U,
            "can not update framebuffer which is currently in use"
          );
          var Oe = 0, $e = 0, et = !0, ot = !0, Me = null, rt = !0, Ve = "rgba", tt = "uint8", nt = 1, at = null, ft = null, dt = null, qe = !1;
          if (typeof le == "number")
            Oe = le | 0, $e = Fe | 0 || Oe;
          else if (!le)
            Oe = $e = 1;
          else {
            u.type(le, "object", "invalid arguments for framebuffer");
            var Re = le;
            if ("shape" in Re) {
              var ht = Re.shape;
              u(
                Array.isArray(ht) && ht.length >= 2,
                "invalid shape for framebuffer"
              ), Oe = ht[0], $e = ht[1];
            } else
              "radius" in Re && (Oe = $e = Re.radius), "width" in Re && (Oe = Re.width), "height" in Re && ($e = Re.height);
            ("color" in Re || "colors" in Re) && (Me = Re.color || Re.colors, Array.isArray(Me) && u(
              Me.length === 1 || r.webgl_draw_buffers,
              "multiple render targets not supported"
            )), Me || ("colorCount" in Re && (nt = Re.colorCount | 0, u(nt > 0, "invalid color buffer count")), "colorTexture" in Re && (rt = !!Re.colorTexture, Ve = "rgba4"), "colorType" in Re && (tt = Re.colorType, rt ? (u(
              r.oes_texture_float || !(tt === "float" || tt === "float32"),
              "you must enable OES_texture_float in order to use floating point framebuffer objects"
            ), u(
              r.oes_texture_half_float || !(tt === "half float" || tt === "float16"),
              "you must enable OES_texture_half_float in order to use 16-bit floating point framebuffer objects"
            )) : tt === "half float" || tt === "float16" ? (u(
              r.ext_color_buffer_half_float,
              "you must enable EXT_color_buffer_half_float to use 16-bit render buffers"
            ), Ve = "rgba16f") : (tt === "float" || tt === "float32") && (u(
              r.webgl_color_buffer_float,
              "you must enable WEBGL_color_buffer_float in order to use 32-bit floating point renderbuffers"
            ), Ve = "rgba32f"), u.oneOf(tt, Q, "invalid color type")), "colorFormat" in Re && (Ve = Re.colorFormat, X.indexOf(Ve) >= 0 ? rt = !0 : W.indexOf(Ve) >= 0 ? rt = !1 : rt ? u.oneOf(
              Re.colorFormat,
              X,
              "invalid color format for texture"
            ) : u.oneOf(
              Re.colorFormat,
              W,
              "invalid color format for renderbuffer"
            ))), ("depthTexture" in Re || "depthStencilTexture" in Re) && (qe = !!(Re.depthTexture || Re.depthStencilTexture), u(
              !qe || r.webgl_depth_texture,
              "webgl_depth_texture extension not supported"
            )), "depth" in Re && (typeof Re.depth == "boolean" ? et = Re.depth : (at = Re.depth, ot = !1)), "stencil" in Re && (typeof Re.stencil == "boolean" ? ot = Re.stencil : (ft = Re.stencil, et = !1)), "depthStencil" in Re && (typeof Re.depthStencil == "boolean" ? et = ot = Re.depthStencil : (dt = Re.depthStencil, et = !1, ot = !1));
          }
          var je = null, ve = null, De = null, Ne = null;
          if (Array.isArray(Me))
            je = Me.map(re);
          else if (Me)
            je = [re(Me)];
          else
            for (je = new Array(nt), xe = 0; xe < nt; ++xe)
              je[xe] = w(
                Oe,
                $e,
                rt,
                Ve,
                tt
              );
          u(
            r.webgl_draw_buffers || je.length <= 1,
            "you must enable the WEBGL_draw_buffers extension in order to use multiple color buffers."
          ), u(
            je.length <= d.maxColorAttachments,
            "too many color attachments, not supported"
          ), Oe = Oe || je[0].width, $e = $e || je[0].height, at ? ve = re(at) : et && !ot && (ve = w(
            Oe,
            $e,
            qe,
            "depth",
            "uint32"
          )), ft ? De = re(ft) : ot && !et && (De = w(
            Oe,
            $e,
            !1,
            "stencil",
            "uint8"
          )), dt ? Ne = re(dt) : !at && !ft && ot && et && (Ne = w(
            Oe,
            $e,
            qe,
            "depth stencil",
            "depth stencil"
          )), u(
            !!at + !!ft + !!dt <= 1,
            "invalid framebuffer configuration, can specify exactly one depth/stencil attachment"
          );
          var Ke = null;
          for (xe = 0; xe < je.length; ++xe)
            if (ie(je[xe], Oe, $e), u(
              !je[xe] || je[xe].texture && zf.indexOf(je[xe].texture._texture.format) >= 0 || je[xe].renderbuffer && Zf.indexOf(je[xe].renderbuffer._renderbuffer.format) >= 0,
              "framebuffer color attachment " + xe + " is invalid"
            ), je[xe] && je[xe].texture) {
              var Nt = Jn[je[xe].texture._texture.format] * un[je[xe].texture._texture.type];
              Ke === null ? Ke = Nt : u(
                Ke === Nt,
                "all color attachments much have the same number of bits per pixel."
              );
            }
          return ie(ve, Oe, $e), u(
            !ve || ve.texture && ve.texture._texture.format === $f || ve.renderbuffer && ve.renderbuffer._renderbuffer.format === Hf,
            "invalid depth attachment for framebuffer object"
          ), ie(De, Oe, $e), u(
            !De || De.renderbuffer && De.renderbuffer._renderbuffer.format === Wf,
            "invalid stencil attachment for framebuffer object"
          ), ie(Ne, Oe, $e), u(
            !Ne || Ne.texture && Ne.texture._texture.format === Bi || Ne.renderbuffer && Ne.renderbuffer._renderbuffer.format === Bi,
            "invalid depth-stencil attachment for framebuffer object"
          ), V(U), U.width = Oe, U.height = $e, U.colorAttachments = je, U.depthAttachment = ve, U.stencilAttachment = De, U.depthStencilAttachment = Ne, _e.color = je.map(B), _e.depth = B(ve), _e.stencil = B(De), _e.depthStencil = B(Ne), _e.width = U.width, _e.height = U.height, j(U), _e;
        }
        function Le(le, Fe) {
          u(
            M.next !== U,
            "can not resize a framebuffer which is currently in use"
          );
          var xe = Math.max(le | 0, 1), Oe = Math.max(Fe | 0 || xe, 1);
          if (xe === U.width && Oe === U.height)
            return _e;
          for (var $e = U.colorAttachments, et = 0; et < $e.length; ++et)
            K($e[et], xe, Oe);
          return K(U.depthAttachment, xe, Oe), K(U.stencilAttachment, xe, Oe), K(U.depthStencilAttachment, xe, Oe), U.width = _e.width = xe, U.height = _e.height = Oe, j(U), _e;
        }
        return _e(oe, Z), E(_e, {
          resize: Le,
          _reglType: "framebuffer",
          _framebuffer: U,
          destroy: function() {
            ne(U), V(U);
          },
          use: function(le) {
            M.setFBO({
              framebuffer: _e
            }, le);
          }
        });
      }
      function pe(oe) {
        var Z = Array(6);
        function U(Le) {
          var le;
          u(
            Z.indexOf(M.next) < 0,
            "can not update framebuffer which is currently in use"
          );
          var Fe = {
            color: null
          }, xe = 0, Oe = null, $e = "rgba", et = "uint8", ot = 1;
          if (typeof Le == "number")
            xe = Le | 0;
          else if (!Le)
            xe = 1;
          else {
            u.type(Le, "object", "invalid arguments for framebuffer");
            var Me = Le;
            if ("shape" in Me) {
              var rt = Me.shape;
              u(
                Array.isArray(rt) && rt.length >= 2,
                "invalid shape for framebuffer"
              ), u(
                rt[0] === rt[1],
                "cube framebuffer must be square"
              ), xe = rt[0];
            } else
              "radius" in Me && (xe = Me.radius | 0), "width" in Me ? (xe = Me.width | 0, "height" in Me && u(Me.height === xe, "must be square")) : "height" in Me && (xe = Me.height | 0);
            ("color" in Me || "colors" in Me) && (Oe = Me.color || Me.colors, Array.isArray(Oe) && u(
              Oe.length === 1 || r.webgl_draw_buffers,
              "multiple render targets not supported"
            )), Oe || ("colorCount" in Me && (ot = Me.colorCount | 0, u(ot > 0, "invalid color buffer count")), "colorType" in Me && (u.oneOf(
              Me.colorType,
              Q,
              "invalid color type"
            ), et = Me.colorType), "colorFormat" in Me && ($e = Me.colorFormat, u.oneOf(
              Me.colorFormat,
              X,
              "invalid color format for texture"
            ))), "depth" in Me && (Fe.depth = Me.depth), "stencil" in Me && (Fe.stencil = Me.stencil), "depthStencil" in Me && (Fe.depthStencil = Me.depthStencil);
          }
          var Ve;
          if (Oe)
            if (Array.isArray(Oe))
              for (Ve = [], le = 0; le < Oe.length; ++le)
                Ve[le] = Oe[le];
            else
              Ve = [Oe];
          else {
            Ve = Array(ot);
            var tt = {
              radius: xe,
              format: $e,
              type: et
            };
            for (le = 0; le < ot; ++le)
              Ve[le] = F.createCube(tt);
          }
          for (Fe.color = Array(Ve.length), le = 0; le < Ve.length; ++le) {
            var nt = Ve[le];
            u(
              typeof nt == "function" && nt._reglType === "textureCube",
              "invalid cube map"
            ), xe = xe || nt.width, u(
              nt.width === xe && nt.height === xe,
              "invalid cube map shape"
            ), Fe.color[le] = {
              target: fn,
              data: Ve[le]
            };
          }
          for (le = 0; le < 6; ++le) {
            for (var at = 0; at < Ve.length; ++at)
              Fe.color[at].target = fn + le;
            le > 0 && (Fe.depth = Z[0].depth, Fe.stencil = Z[0].stencil, Fe.depthStencil = Z[0].depthStencil), Z[le] ? Z[le](Fe) : Z[le] = ae(Fe);
          }
          return E(U, {
            width: xe,
            height: xe,
            color: Ve
          });
        }
        function _e(Le) {
          var le, Fe = Le | 0;
          if (u(
            Fe > 0 && Fe <= d.maxCubeMapSize,
            "invalid radius for cube fbo"
          ), Fe === U.width)
            return U;
          var xe = U.color;
          for (le = 0; le < xe.length; ++le)
            xe[le].resize(Fe);
          for (le = 0; le < 6; ++le)
            Z[le].resize(Fe);
          return U.width = U.height = Fe, U;
        }
        return U(oe), E(U, {
          faces: Z,
          resize: _e,
          _reglType: "framebufferCube",
          destroy: function() {
            Z.forEach(function(Le) {
              Le.destroy();
            });
          }
        });
      }
      function ge() {
        M.cur = null, M.next = null, M.dirty = !0, Rt(z).forEach(function(oe) {
          oe.framebuffer = e.createFramebuffer(), j(oe);
        });
      }
      return E(M, {
        getFramebuffer: function(oe) {
          if (typeof oe == "function" && oe._reglType === "framebuffer") {
            var Z = oe._framebuffer;
            if (Z instanceof fe)
              return Z;
          }
          return null;
        },
        create: ae,
        createCube: pe,
        clear: function() {
          Rt(z).forEach(ne);
        },
        restore: ge
      });
    }
    var eu = 5126, ki = 34962;
    function ea() {
      this.state = 0, this.x = 0, this.y = 0, this.z = 0, this.w = 0, this.buffer = null, this.size = 0, this.normalized = !1, this.type = eu, this.offset = 0, this.stride = 0, this.divisor = 0;
    }
    function tu(e, r, d, F, N) {
      for (var O = d.maxAttributes, M = new Array(O), X = 0; X < O; ++X)
        M[X] = new ea();
      var W = 0, Q = {}, Y = {
        Record: ea,
        scope: {},
        state: M,
        currentVAO: null,
        targetVAO: null,
        restore: ie() ? z : function() {
        },
        createVAO: fe,
        getVAO: re,
        destroyBuffer: te,
        setVAO: ie() ? w : B,
        clear: ie() ? K : function() {
        }
      };
      function te(V) {
        for (var ne = 0; ne < M.length; ++ne) {
          var j = M[ne];
          j.buffer === V && (e.disableVertexAttribArray(ne), j.buffer = null);
        }
      }
      function ie() {
        return r.oes_vertex_array_object;
      }
      function H() {
        return r.angle_instanced_arrays;
      }
      function re(V) {
        return typeof V == "function" && V._vao ? V._vao : null;
      }
      function w(V) {
        if (V !== Y.currentVAO) {
          var ne = ie();
          V ? ne.bindVertexArrayOES(V.vao) : ne.bindVertexArrayOES(null), Y.currentVAO = V;
        }
      }
      function B(V) {
        if (V !== Y.currentVAO) {
          if (V)
            V.bindAttrs();
          else
            for (var ne = H(), j = 0; j < M.length; ++j) {
              var ae = M[j];
              ae.buffer ? (e.enableVertexAttribArray(j), e.vertexAttribPointer(j, ae.size, ae.type, ae.normalized, ae.stride, ae.offfset), ne && ae.divisor && ne.vertexAttribDivisorANGLE(j, ae.divisor)) : (e.disableVertexAttribArray(j), e.vertexAttrib4f(j, ae.x, ae.y, ae.z, ae.w));
            }
          Y.currentVAO = V;
        }
      }
      function K() {
        Rt(Q).forEach(function(V) {
          V.destroy();
        });
      }
      function se() {
        this.id = ++W, this.attributes = [];
        var V = ie();
        V ? this.vao = V.createVertexArrayOES() : this.vao = null, Q[this.id] = this, this.buffers = [];
      }
      se.prototype.bindAttrs = function() {
        for (var V = H(), ne = this.attributes, j = 0; j < ne.length; ++j) {
          var ae = ne[j];
          ae.buffer ? (e.enableVertexAttribArray(j), e.bindBuffer(ki, ae.buffer.buffer), e.vertexAttribPointer(j, ae.size, ae.type, ae.normalized, ae.stride, ae.offset), V && ae.divisor && V.vertexAttribDivisorANGLE(j, ae.divisor)) : (e.disableVertexAttribArray(j), e.vertexAttrib4f(j, ae.x, ae.y, ae.z, ae.w));
        }
        for (var pe = ne.length; pe < O; ++pe)
          e.disableVertexAttribArray(pe);
      }, se.prototype.refresh = function() {
        var V = ie();
        V && (V.bindVertexArrayOES(this.vao), this.bindAttrs(), Y.currentVAO = this);
      }, se.prototype.destroy = function() {
        if (this.vao) {
          var V = ie();
          this === Y.currentVAO && (Y.currentVAO = null, V.bindVertexArrayOES(null)), V.deleteVertexArrayOES(this.vao), this.vao = null;
        }
        Q[this.id] && (delete Q[this.id], F.vaoCount -= 1);
      };
      function z() {
        var V = ie();
        V && Rt(Q).forEach(function(ne) {
          ne.refresh();
        });
      }
      function fe(V) {
        var ne = new se();
        F.vaoCount += 1;
        function j(ae) {
          u(Array.isArray(ae), "arguments to vertex array constructor must be an array"), u(ae.length < O, "too many attributes"), u(ae.length > 0, "must specify at least one attribute");
          var pe = {}, ge = ne.attributes;
          ge.length = ae.length;
          for (var oe = 0; oe < ae.length; ++oe) {
            var Z = ae[oe], U = ge[oe] = new ea(), _e = Z.data || Z;
            if (Array.isArray(_e) || m(_e) || Dt(_e)) {
              var Le;
              ne.buffers[oe] && (Le = ne.buffers[oe], m(_e) && Le._buffer.byteLength >= _e.byteLength ? Le.subdata(_e) : (Le.destroy(), ne.buffers[oe] = null)), ne.buffers[oe] || (Le = ne.buffers[oe] = N.create(Z, ki, !1, !0)), U.buffer = N.getBuffer(Le), U.size = U.buffer.dimension | 0, U.normalized = !1, U.type = U.buffer.dtype, U.offset = 0, U.stride = 0, U.divisor = 0, U.state = 1, pe[oe] = 1;
            } else
              N.getBuffer(Z) ? (U.buffer = N.getBuffer(Z), U.size = U.buffer.dimension | 0, U.normalized = !1, U.type = U.buffer.dtype, U.offset = 0, U.stride = 0, U.divisor = 0, U.state = 1) : N.getBuffer(Z.buffer) ? (U.buffer = N.getBuffer(Z.buffer), U.size = (+Z.size || U.buffer.dimension) | 0, U.normalized = !!Z.normalized || !1, "type" in Z ? (u.parameter(Z.type, Zt, "invalid buffer type"), U.type = Zt[Z.type]) : U.type = U.buffer.dtype, U.offset = (Z.offset || 0) | 0, U.stride = (Z.stride || 0) | 0, U.divisor = (Z.divisor || 0) | 0, U.state = 1, u(U.size >= 1 && U.size <= 4, "size must be between 1 and 4"), u(U.offset >= 0, "invalid offset"), u(U.stride >= 0 && U.stride <= 255, "stride must be between 0 and 255"), u(U.divisor >= 0, "divisor must be positive"), u(!U.divisor || !!r.angle_instanced_arrays, "ANGLE_instanced_arrays must be enabled to use divisor")) : "x" in Z ? (u(oe > 0, "first attribute must not be a constant"), U.x = +Z.x || 0, U.y = +Z.y || 0, U.z = +Z.z || 0, U.w = +Z.w || 0, U.state = 2) : u(!1, "invalid attribute spec for location " + oe);
          }
          for (var le = 0; le < ne.buffers.length; ++le)
            !pe[le] && ne.buffers[le] && (ne.buffers[le].destroy(), ne.buffers[le] = null);
          return ne.refresh(), j;
        }
        return j.destroy = function() {
          for (var ae = 0; ae < ne.buffers.length; ++ae)
            ne.buffers[ae] && ne.buffers[ae].destroy();
          ne.buffers.length = 0, ne.destroy();
        }, j._vao = ne, j._reglType = "vao", j(V);
      }
      return Y;
    }
    var Ii = 35632, ru = 35633, nu = 35718, au = 35721;
    function iu(e, r, d, F) {
      var N = {}, O = {};
      function M(w, B, K, se) {
        this.name = w, this.id = B, this.location = K, this.info = se;
      }
      function X(w, B) {
        for (var K = 0; K < w.length; ++K)
          if (w[K].id === B.id) {
            w[K].location = B.location;
            return;
          }
        w.push(B);
      }
      function W(w, B, K) {
        var se = w === Ii ? N : O, z = se[B];
        if (!z) {
          var fe = r.str(B);
          z = e.createShader(w), e.shaderSource(z, fe), e.compileShader(z), u.shaderError(e, z, fe, w, K), se[B] = z;
        }
        return z;
      }
      var Q = {}, Y = [], te = 0;
      function ie(w, B) {
        this.id = te++, this.fragId = w, this.vertId = B, this.program = null, this.uniforms = [], this.attributes = [], this.refCount = 1, F.profile && (this.stats = {
          uniformsCount: 0,
          attributesCount: 0
        });
      }
      function H(w, B, K) {
        var se, z, fe = W(Ii, w.fragId), V = W(ru, w.vertId), ne = w.program = e.createProgram();
        if (e.attachShader(ne, fe), e.attachShader(ne, V), K)
          for (se = 0; se < K.length; ++se) {
            var j = K[se];
            e.bindAttribLocation(ne, j[0], j[1]);
          }
        e.linkProgram(ne), u.linkError(
          e,
          ne,
          r.str(w.fragId),
          r.str(w.vertId),
          B
        );
        var ae = e.getProgramParameter(ne, nu);
        F.profile && (w.stats.uniformsCount = ae);
        var pe = w.uniforms;
        for (se = 0; se < ae; ++se)
          if (z = e.getActiveUniform(ne, se), z)
            if (z.size > 1)
              for (var ge = 0; ge < z.size; ++ge) {
                var oe = z.name.replace("[0]", "[" + ge + "]");
                X(pe, new M(
                  oe,
                  r.id(oe),
                  e.getUniformLocation(ne, oe),
                  z
                ));
              }
            else
              X(pe, new M(
                z.name,
                r.id(z.name),
                e.getUniformLocation(ne, z.name),
                z
              ));
        var Z = e.getProgramParameter(ne, au);
        F.profile && (w.stats.attributesCount = Z);
        var U = w.attributes;
        for (se = 0; se < Z; ++se)
          z = e.getActiveAttrib(ne, se), z && X(U, new M(
            z.name,
            r.id(z.name),
            e.getAttribLocation(ne, z.name),
            z
          ));
      }
      F.profile && (d.getMaxUniformsCount = function() {
        var w = 0;
        return Y.forEach(function(B) {
          B.stats.uniformsCount > w && (w = B.stats.uniformsCount);
        }), w;
      }, d.getMaxAttributesCount = function() {
        var w = 0;
        return Y.forEach(function(B) {
          B.stats.attributesCount > w && (w = B.stats.attributesCount);
        }), w;
      });
      function re() {
        N = {}, O = {};
        for (var w = 0; w < Y.length; ++w)
          H(Y[w], null, Y[w].attributes.map(function(B) {
            return [B.location, B.name];
          }));
      }
      return {
        clear: function() {
          var w = e.deleteShader.bind(e);
          Rt(N).forEach(w), N = {}, Rt(O).forEach(w), O = {}, Y.forEach(function(B) {
            e.deleteProgram(B.program);
          }), Y.length = 0, Q = {}, d.shaderCount = 0;
        },
        program: function(w, B, K, se) {
          u.command(w >= 0, "missing vertex shader", K), u.command(B >= 0, "missing fragment shader", K);
          var z = Q[B];
          z || (z = Q[B] = {});
          var fe = z[w];
          if (fe && (fe.refCount++, !se))
            return fe;
          var V = new ie(B, w);
          return d.shaderCount++, H(V, K, se), fe || (z[w] = V), Y.push(V), E(V, {
            destroy: function() {
              if (V.refCount--, V.refCount <= 0) {
                e.deleteProgram(V.program);
                var ne = Y.indexOf(V);
                Y.splice(ne, 1), d.shaderCount--;
              }
              z[V.vertId].refCount <= 0 && (e.deleteShader(O[V.vertId]), delete O[V.vertId], delete Q[V.fragId][V.vertId]), Object.keys(Q[V.fragId]).length || (e.deleteShader(N[V.fragId]), delete N[V.fragId], delete Q[V.fragId]);
            }
          });
        },
        restore: re,
        shader: W,
        frag: -1,
        vert: -1
      };
    }
    var ou = 6408, Mr = 5121, su = 3333, cn = 5126;
    function fu(e, r, d, F, N, O, M) {
      function X(Y) {
        var te;
        r.next === null ? (u(
          N.preserveDrawingBuffer,
          'you must create a webgl context with "preserveDrawingBuffer":true in order to read pixels from the drawing buffer'
        ), te = Mr) : (u(
          r.next.colorAttachments[0].texture !== null,
          "You cannot read from a renderbuffer"
        ), te = r.next.colorAttachments[0].texture._texture.type, O.oes_texture_float ? (u(
          te === Mr || te === cn,
          "Reading from a framebuffer is only allowed for the types 'uint8' and 'float'"
        ), te === cn && u(M.readFloat, "Reading 'float' values is not permitted in your browser. For a fallback, please see: https://www.npmjs.com/package/glsl-read-float")) : u(
          te === Mr,
          "Reading from a framebuffer is only allowed for the type 'uint8'"
        ));
        var ie = 0, H = 0, re = F.framebufferWidth, w = F.framebufferHeight, B = null;
        m(Y) ? B = Y : Y && (u.type(Y, "object", "invalid arguments to regl.read()"), ie = Y.x | 0, H = Y.y | 0, u(
          ie >= 0 && ie < F.framebufferWidth,
          "invalid x offset for regl.read"
        ), u(
          H >= 0 && H < F.framebufferHeight,
          "invalid y offset for regl.read"
        ), re = (Y.width || F.framebufferWidth - ie) | 0, w = (Y.height || F.framebufferHeight - H) | 0, B = Y.data || null), B && (te === Mr ? u(
          B instanceof Uint8Array,
          "buffer must be 'Uint8Array' when reading from a framebuffer of type 'uint8'"
        ) : te === cn && u(
          B instanceof Float32Array,
          "buffer must be 'Float32Array' when reading from a framebuffer of type 'float'"
        )), u(
          re > 0 && re + ie <= F.framebufferWidth,
          "invalid width for read pixels"
        ), u(
          w > 0 && w + H <= F.framebufferHeight,
          "invalid height for read pixels"
        ), d();
        var K = re * w * 4;
        return B || (te === Mr ? B = new Uint8Array(K) : te === cn && (B = B || new Float32Array(K))), u.isTypedArray(B, "data buffer for regl.read() must be a typedarray"), u(B.byteLength >= K, "data buffer for regl.read() too small"), e.pixelStorei(su, 4), e.readPixels(
          ie,
          H,
          re,
          w,
          ou,
          te,
          B
        ), B;
      }
      function W(Y) {
        var te;
        return r.setFBO({
          framebuffer: Y.framebuffer
        }, function() {
          te = X(Y);
        }), te;
      }
      function Q(Y) {
        return !Y || !("framebuffer" in Y) ? X(Y) : W(Y);
      }
      return Q;
    }
    function yr(e) {
      return Array.prototype.slice.call(e);
    }
    function _r(e) {
      return yr(e).join("");
    }
    function uu() {
      var e = 0, r = [], d = [];
      function F(te) {
        for (var ie = 0; ie < d.length; ++ie)
          if (d[ie] === te)
            return r[ie];
        var H = "g" + e++;
        return r.push(H), d.push(te), H;
      }
      function N() {
        var te = [];
        function ie() {
          te.push.apply(te, yr(arguments));
        }
        var H = [];
        function re() {
          var w = "v" + e++;
          return H.push(w), arguments.length > 0 && (te.push(w, "="), te.push.apply(te, yr(arguments)), te.push(";")), w;
        }
        return E(ie, {
          def: re,
          toString: function() {
            return _r([
              H.length > 0 ? "var " + H.join(",") + ";" : "",
              _r(te)
            ]);
          }
        });
      }
      function O() {
        var te = N(), ie = N(), H = te.toString, re = ie.toString;
        function w(B, K) {
          ie(B, K, "=", te.def(B, K), ";");
        }
        return E(function() {
          te.apply(te, yr(arguments));
        }, {
          def: te.def,
          entry: te,
          exit: ie,
          save: w,
          set: function(B, K, se) {
            w(B, K), te(B, K, "=", se, ";");
          },
          toString: function() {
            return H() + re();
          }
        });
      }
      function M() {
        var te = _r(arguments), ie = O(), H = O(), re = ie.toString, w = H.toString;
        return E(ie, {
          then: function() {
            return ie.apply(ie, yr(arguments)), this;
          },
          else: function() {
            return H.apply(H, yr(arguments)), this;
          },
          toString: function() {
            var B = w();
            return B && (B = "else{" + B + "}"), _r([
              "if(",
              te,
              "){",
              re(),
              "}",
              B
            ]);
          }
        });
      }
      var X = N(), W = {};
      function Q(te, ie) {
        var H = [];
        function re() {
          var z = "a" + H.length;
          return H.push(z), z;
        }
        ie = ie || 0;
        for (var w = 0; w < ie; ++w)
          re();
        var B = O(), K = B.toString, se = W[te] = E(B, {
          arg: re,
          toString: function() {
            return _r([
              "function(",
              H.join(),
              "){",
              K(),
              "}"
            ]);
          }
        });
        return se;
      }
      function Y() {
        var te = [
          '"use strict";',
          X,
          "return {"
        ];
        Object.keys(W).forEach(function(re) {
          te.push('"', re, '":', W[re].toString(), ",");
        }), te.push("}");
        var ie = _r(te).replace(/;/g, `;
`).replace(/}/g, `}
`).replace(/{/g, `{
`), H = Function.apply(null, r.concat(ie));
        return H.apply(null, d);
      }
      return {
        global: X,
        link: F,
        block: N,
        proc: Q,
        scope: O,
        cond: M,
        compile: Y
      };
    }
    var br = "xyzw".split(""), Ni = 5121, gr = 1, ta = 2, ra = 0, na = 1, aa = 2, ia = 3, ln = 4, Pi = 5, Ui = 6, $i = "dither", zi = "blend.enable", ji = "blend.color", oa = "blend.equation", sa = "blend.func", Vi = "depth.enable", Xi = "depth.func", Hi = "depth.range", Wi = "depth.mask", fa = "colorMask", Yi = "cull.enable", qi = "cull.face", ua = "frontFace", ca = "lineWidth", Ki = "polygonOffset.enable", la = "polygonOffset.offset", Qi = "sample.alpha", Zi = "sample.enable", da = "sample.coverage", Ji = "stencil.enable", eo = "stencil.mask", ha = "stencil.func", ma = "stencil.opFront", Br = "stencil.opBack", to = "scissor.enable", dn = "scissor.box", Ut = "viewport", kr = "profile", nr = "framebuffer", Ir = "vert", Nr = "frag", ar = "elements", ir = "primitive", or = "count", hn = "offset", mn = "instances", Pr = "vao", pa = "Width", va = "Height", xr = nr + pa, Er = nr + va, cu = Ut + pa, lu = Ut + va, ro = "drawingBuffer", no = ro + pa, ao = ro + va, du = [
      sa,
      oa,
      ha,
      ma,
      Br,
      da,
      Ut,
      dn,
      la
    ], Ar = 34962, hu = 34963, mu = 35632, pu = 35633, io = 3553, vu = 34067, yu = 2884, _u = 3042, bu = 3024, gu = 2960, xu = 2929, Eu = 3089, Au = 32823, wu = 32926, Su = 32928, ya = 5126, pn = 35664, vn = 35665, yn = 35666, _a = 5124, _n = 35667, bn = 35668, gn = 35669, ba = 35670, xn = 35671, En = 35672, An = 35673, Ur = 35674, $r = 35675, zr = 35676, jr = 35678, Vr = 35680, oo = 4, Xr = 1028, sr = 1029, so = 2304, ga = 2305, Tu = 32775, Lu = 32776, Ru = 519, Vt = 7680, fo = 0, uo = 1, co = 32774, Cu = 513, lo = 36160, Ou = 36064, It = {
      0: 0,
      1: 1,
      zero: 0,
      one: 1,
      "src color": 768,
      "one minus src color": 769,
      "src alpha": 770,
      "one minus src alpha": 771,
      "dst color": 774,
      "one minus dst color": 775,
      "dst alpha": 772,
      "one minus dst alpha": 773,
      "constant color": 32769,
      "one minus constant color": 32770,
      "constant alpha": 32771,
      "one minus constant alpha": 32772,
      "src alpha saturate": 776
    }, ho = [
      "constant color, constant alpha",
      "one minus constant color, constant alpha",
      "constant color, one minus constant alpha",
      "one minus constant color, one minus constant alpha",
      "constant alpha, constant color",
      "constant alpha, one minus constant color",
      "one minus constant alpha, constant color",
      "one minus constant alpha, one minus constant color"
    ], wr = {
      never: 512,
      less: 513,
      "<": 513,
      equal: 514,
      "=": 514,
      "==": 514,
      "===": 514,
      lequal: 515,
      "<=": 515,
      greater: 516,
      ">": 516,
      notequal: 517,
      "!=": 517,
      "!==": 517,
      gequal: 518,
      ">=": 518,
      always: 519
    }, Xt = {
      0: 0,
      zero: 0,
      keep: 7680,
      replace: 7681,
      increment: 7682,
      decrement: 7683,
      "increment wrap": 34055,
      "decrement wrap": 34056,
      invert: 5386
    }, mo = {
      frag: mu,
      vert: pu
    }, xa = {
      cw: so,
      ccw: ga
    };
    function wn(e) {
      return Array.isArray(e) || m(e) || Dt(e);
    }
    function po(e) {
      return e.sort(function(r, d) {
        return r === Ut ? -1 : d === Ut ? 1 : r < d ? -1 : 1;
      });
    }
    function _t(e, r, d, F) {
      this.thisDep = e, this.contextDep = r, this.propDep = d, this.append = F;
    }
    function Ht(e) {
      return e && !(e.thisDep || e.contextDep || e.propDep);
    }
    function Je(e) {
      return new _t(!1, !1, !1, e);
    }
    function xt(e, r) {
      var d = e.type;
      if (d === ra) {
        var F = e.data.length;
        return new _t(
          !0,
          F >= 1,
          F >= 2,
          r
        );
      } else if (d === ln) {
        var N = e.data;
        return new _t(
          N.thisDep,
          N.contextDep,
          N.propDep,
          r
        );
      } else {
        if (d === Pi)
          return new _t(
            !1,
            !1,
            !1,
            r
          );
        if (d === Ui) {
          for (var O = !1, M = !1, X = !1, W = 0; W < e.data.length; ++W) {
            var Q = e.data[W];
            if (Q.type === na)
              X = !0;
            else if (Q.type === aa)
              M = !0;
            else if (Q.type === ia)
              O = !0;
            else if (Q.type === ra) {
              O = !0;
              var Y = Q.data;
              Y >= 1 && (M = !0), Y >= 2 && (X = !0);
            } else
              Q.type === ln && (O = O || Q.data.thisDep, M = M || Q.data.contextDep, X = X || Q.data.propDep);
          }
          return new _t(
            O,
            M,
            X,
            r
          );
        } else
          return new _t(
            d === ia,
            d === aa,
            d === na,
            r
          );
      }
    }
    var vo = new _t(!1, !1, !1, function() {
    });
    function Fu(e, r, d, F, N, O, M, X, W, Q, Y, te, ie, H, re) {
      var w = Q.Record, B = {
        add: 32774,
        subtract: 32778,
        "reverse subtract": 32779
      };
      d.ext_blend_minmax && (B.min = Tu, B.max = Lu);
      var K = d.angle_instanced_arrays, se = d.webgl_draw_buffers, z = {
        dirty: !0,
        profile: re.profile
      }, fe = {}, V = [], ne = {}, j = {};
      function ae(s) {
        return s.replace(".", "_");
      }
      function pe(s, t, p) {
        var A = ae(s);
        V.push(s), fe[A] = z[A] = !!p, ne[A] = t;
      }
      function ge(s, t, p) {
        var A = ae(s);
        V.push(s), Array.isArray(p) ? (z[A] = p.slice(), fe[A] = p.slice()) : z[A] = fe[A] = p, j[A] = t;
      }
      pe($i, bu), pe(zi, _u), ge(ji, "blendColor", [0, 0, 0, 0]), ge(
        oa,
        "blendEquationSeparate",
        [co, co]
      ), ge(
        sa,
        "blendFuncSeparate",
        [uo, fo, uo, fo]
      ), pe(Vi, xu, !0), ge(Xi, "depthFunc", Cu), ge(Hi, "depthRange", [0, 1]), ge(Wi, "depthMask", !0), ge(fa, fa, [!0, !0, !0, !0]), pe(Yi, yu), ge(qi, "cullFace", sr), ge(ua, ua, ga), ge(ca, ca, 1), pe(Ki, Au), ge(la, "polygonOffset", [0, 0]), pe(Qi, wu), pe(Zi, Su), ge(da, "sampleCoverage", [1, !1]), pe(Ji, gu), ge(eo, "stencilMask", -1), ge(ha, "stencilFunc", [Ru, 0, -1]), ge(
        ma,
        "stencilOpSeparate",
        [Xr, Vt, Vt, Vt]
      ), ge(
        Br,
        "stencilOpSeparate",
        [sr, Vt, Vt, Vt]
      ), pe(to, Eu), ge(
        dn,
        "scissor",
        [0, 0, e.drawingBufferWidth, e.drawingBufferHeight]
      ), ge(
        Ut,
        Ut,
        [0, 0, e.drawingBufferWidth, e.drawingBufferHeight]
      );
      var oe = {
        gl: e,
        context: ie,
        strings: r,
        next: fe,
        current: z,
        draw: te,
        elements: O,
        buffer: N,
        shader: Y,
        attributes: Q.state,
        vao: Q,
        uniforms: W,
        framebuffer: X,
        extensions: d,
        timer: H,
        isBufferArgs: wn
      }, Z = {
        primTypes: ur,
        compareFuncs: wr,
        blendFuncs: It,
        blendEquations: B,
        stencilOps: Xt,
        glTypes: Zt,
        orientationType: xa
      };
      u.optional(function() {
        oe.isArrayLike = Ye;
      }), se && (Z.backBuffer = [sr], Z.drawBuffer = gt(F.maxDrawbuffers, function(s) {
        return s === 0 ? [0] : gt(s, function(t) {
          return Ou + t;
        });
      }));
      var U = 0;
      function _e() {
        var s = uu(), t = s.link, p = s.global;
        s.id = U++, s.batchId = "0";
        var A = t(oe), S = s.shared = {
          props: "a0"
        };
        Object.keys(oe).forEach(function(h) {
          S[h] = p.def(A, ".", h);
        }), u.optional(function() {
          s.CHECK = t(u), s.commandStr = u.guessCommand(), s.command = t(s.commandStr), s.assert = function(h, n, g) {
            h(
              "if(!(",
              n,
              "))",
              this.CHECK,
              ".commandRaise(",
              t(g),
              ",",
              this.command,
              ");"
            );
          }, Z.invalidBlendCombinations = ho;
        });
        var y = s.next = {}, v = s.current = {};
        Object.keys(j).forEach(function(h) {
          Array.isArray(z[h]) && (y[h] = p.def(S.next, ".", h), v[h] = p.def(S.current, ".", h));
        });
        var b = s.constants = {};
        Object.keys(Z).forEach(function(h) {
          b[h] = p.def(JSON.stringify(Z[h]));
        }), s.invoke = function(h, n) {
          switch (n.type) {
            case ra:
              var g = [
                "this",
                S.context,
                S.props,
                s.batchId
              ];
              return h.def(
                t(n.data),
                ".call(",
                g.slice(0, Math.max(n.data.length + 1, 4)),
                ")"
              );
            case na:
              return h.def(S.props, n.data);
            case aa:
              return h.def(S.context, n.data);
            case ia:
              return h.def("this", n.data);
            case ln:
              return n.data.append(s, h), n.data.ref;
            case Pi:
              return n.data.toString();
            case Ui:
              return n.data.map(function(L) {
                return s.invoke(h, L);
              });
          }
        }, s.attribCache = {};
        var f = {};
        return s.scopeAttrib = function(h) {
          var n = r.id(h);
          if (n in f)
            return f[n];
          var g = Q.scope[n];
          g || (g = Q.scope[n] = new w());
          var L = f[n] = t(g);
          return L;
        }, s;
      }
      function Le(s) {
        var t = s.static, p = s.dynamic, A;
        if (kr in t) {
          var S = !!t[kr];
          A = Je(function(v, b) {
            return S;
          }), A.enable = S;
        } else if (kr in p) {
          var y = p[kr];
          A = xt(y, function(v, b) {
            return v.invoke(b, y);
          });
        }
        return A;
      }
      function le(s, t) {
        var p = s.static, A = s.dynamic;
        if (nr in p) {
          var S = p[nr];
          return S ? (S = X.getFramebuffer(S), u.command(S, "invalid framebuffer object"), Je(function(v, b) {
            var f = v.link(S), h = v.shared;
            b.set(
              h.framebuffer,
              ".next",
              f
            );
            var n = h.context;
            return b.set(
              n,
              "." + xr,
              f + ".width"
            ), b.set(
              n,
              "." + Er,
              f + ".height"
            ), f;
          })) : Je(function(v, b) {
            var f = v.shared;
            b.set(
              f.framebuffer,
              ".next",
              "null"
            );
            var h = f.context;
            return b.set(
              h,
              "." + xr,
              h + "." + no
            ), b.set(
              h,
              "." + Er,
              h + "." + ao
            ), "null";
          });
        } else if (nr in A) {
          var y = A[nr];
          return xt(y, function(v, b) {
            var f = v.invoke(b, y), h = v.shared, n = h.framebuffer, g = b.def(
              n,
              ".getFramebuffer(",
              f,
              ")"
            );
            u.optional(function() {
              v.assert(
                b,
                "!" + f + "||" + g,
                "invalid framebuffer object"
              );
            }), b.set(
              n,
              ".next",
              g
            );
            var L = h.context;
            return b.set(
              L,
              "." + xr,
              g + "?" + g + ".width:" + L + "." + no
            ), b.set(
              L,
              "." + Er,
              g + "?" + g + ".height:" + L + "." + ao
            ), g;
          });
        } else
          return null;
      }
      function Fe(s, t, p) {
        var A = s.static, S = s.dynamic;
        function y(f) {
          if (f in A) {
            var h = A[f];
            u.commandType(h, "object", "invalid " + f, p.commandStr);
            var n = !0, g = h.x | 0, L = h.y | 0, I, P;
            return "width" in h ? (I = h.width | 0, u.command(I >= 0, "invalid " + f, p.commandStr)) : n = !1, "height" in h ? (P = h.height | 0, u.command(P >= 0, "invalid " + f, p.commandStr)) : n = !1, new _t(
              !n && t && t.thisDep,
              !n && t && t.contextDep,
              !n && t && t.propDep,
              function(me, Ce) {
                var de = me.shared.context, ye = I;
                "width" in h || (ye = Ce.def(de, ".", xr, "-", g));
                var Ee = P;
                return "height" in h || (Ee = Ce.def(de, ".", Er, "-", L)), [g, L, ye, Ee];
              }
            );
          } else if (f in S) {
            var k = S[f], q = xt(k, function(me, Ce) {
              var de = me.invoke(Ce, k);
              u.optional(function() {
                me.assert(
                  Ce,
                  de + "&&typeof " + de + '==="object"',
                  "invalid " + f
                );
              });
              var ye = me.shared.context, Ee = Ce.def(de, ".x|0"), ze = Ce.def(de, ".y|0"), Xe = Ce.def(
                '"width" in ',
                de,
                "?",
                de,
                ".width|0:",
                "(",
                ye,
                ".",
                xr,
                "-",
                Ee,
                ")"
              ), bt = Ce.def(
                '"height" in ',
                de,
                "?",
                de,
                ".height|0:",
                "(",
                ye,
                ".",
                Er,
                "-",
                ze,
                ")"
              );
              return u.optional(function() {
                me.assert(
                  Ce,
                  Xe + ">=0&&" + bt + ">=0",
                  "invalid " + f
                );
              }), [Ee, ze, Xe, bt];
            });
            return t && (q.thisDep = q.thisDep || t.thisDep, q.contextDep = q.contextDep || t.contextDep, q.propDep = q.propDep || t.propDep), q;
          } else
            return t ? new _t(
              t.thisDep,
              t.contextDep,
              t.propDep,
              function(me, Ce) {
                var de = me.shared.context;
                return [
                  0,
                  0,
                  Ce.def(de, ".", xr),
                  Ce.def(de, ".", Er)
                ];
              }
            ) : null;
        }
        var v = y(Ut);
        if (v) {
          var b = v;
          v = new _t(
            v.thisDep,
            v.contextDep,
            v.propDep,
            function(f, h) {
              var n = b.append(f, h), g = f.shared.context;
              return h.set(
                g,
                "." + cu,
                n[2]
              ), h.set(
                g,
                "." + lu,
                n[3]
              ), n;
            }
          );
        }
        return {
          viewport: v,
          scissor_box: y(dn)
        };
      }
      function xe(s, t) {
        var p = s.static, A = typeof p[Nr] == "string" && typeof p[Ir] == "string";
        if (A) {
          if (Object.keys(t.dynamic).length > 0)
            return null;
          var S = t.static, y = Object.keys(S);
          if (y.length > 0 && typeof S[y[0]] == "number") {
            for (var v = [], b = 0; b < y.length; ++b)
              u(typeof S[y[b]] == "number", "must specify all vertex attribute locations when using vaos"), v.push([S[y[b]] | 0, y[b]]);
            return v;
          }
        }
        return null;
      }
      function Oe(s, t, p) {
        var A = s.static, S = s.dynamic;
        function y(n) {
          if (n in A) {
            var g = r.id(A[n]);
            u.optional(function() {
              Y.shader(mo[n], g, u.guessCommand());
            });
            var L = Je(function() {
              return g;
            });
            return L.id = g, L;
          } else if (n in S) {
            var I = S[n];
            return xt(I, function(P, k) {
              var q = P.invoke(k, I), me = k.def(P.shared.strings, ".id(", q, ")");
              return u.optional(function() {
                k(
                  P.shared.shader,
                  ".shader(",
                  mo[n],
                  ",",
                  me,
                  ",",
                  P.command,
                  ");"
                );
              }), me;
            });
          }
          return null;
        }
        var v = y(Nr), b = y(Ir), f = null, h;
        return Ht(v) && Ht(b) ? (f = Y.program(b.id, v.id, null, p), h = Je(function(n, g) {
          return n.link(f);
        })) : h = new _t(
          v && v.thisDep || b && b.thisDep,
          v && v.contextDep || b && b.contextDep,
          v && v.propDep || b && b.propDep,
          function(n, g) {
            var L = n.shared.shader, I;
            v ? I = v.append(n, g) : I = g.def(L, ".", Nr);
            var P;
            b ? P = b.append(n, g) : P = g.def(L, ".", Ir);
            var k = L + ".program(" + P + "," + I;
            return u.optional(function() {
              k += "," + n.command;
            }), g.def(k + ")");
          }
        ), {
          frag: v,
          vert: b,
          progVar: h,
          program: f
        };
      }
      function $e(s, t) {
        var p = s.static, A = s.dynamic;
        function S() {
          if (ar in p) {
            var n = p[ar];
            wn(n) ? n = O.getElements(O.create(n, !0)) : n && (n = O.getElements(n), u.command(n, "invalid elements", t.commandStr));
            var g = Je(function(I, P) {
              if (n) {
                var k = I.link(n);
                return I.ELEMENTS = k, k;
              }
              return I.ELEMENTS = null, null;
            });
            return g.value = n, g;
          } else if (ar in A) {
            var L = A[ar];
            return xt(L, function(I, P) {
              var k = I.shared, q = k.isBufferArgs, me = k.elements, Ce = I.invoke(P, L), de = P.def("null"), ye = P.def(q, "(", Ce, ")"), Ee = I.cond(ye).then(de, "=", me, ".createStream(", Ce, ");").else(de, "=", me, ".getElements(", Ce, ");");
              return u.optional(function() {
                I.assert(
                  Ee.else,
                  "!" + Ce + "||" + de,
                  "invalid elements"
                );
              }), P.entry(Ee), P.exit(
                I.cond(ye).then(me, ".destroyStream(", de, ");")
              ), I.ELEMENTS = de, de;
            });
          }
          return null;
        }
        var y = S();
        function v() {
          if (ir in p) {
            var n = p[ir];
            return u.commandParameter(n, ur, "invalid primitve", t.commandStr), Je(function(L, I) {
              return ur[n];
            });
          } else if (ir in A) {
            var g = A[ir];
            return xt(g, function(L, I) {
              var P = L.constants.primTypes, k = L.invoke(I, g);
              return u.optional(function() {
                L.assert(
                  I,
                  k + " in " + P,
                  "invalid primitive, must be one of " + Object.keys(ur)
                );
              }), I.def(P, "[", k, "]");
            });
          } else if (y)
            return Ht(y) ? y.value ? Je(function(L, I) {
              return I.def(L.ELEMENTS, ".primType");
            }) : Je(function() {
              return oo;
            }) : new _t(
              y.thisDep,
              y.contextDep,
              y.propDep,
              function(L, I) {
                var P = L.ELEMENTS;
                return I.def(P, "?", P, ".primType:", oo);
              }
            );
          return null;
        }
        function b(n, g) {
          if (n in p) {
            var L = p[n] | 0;
            return u.command(!g || L >= 0, "invalid " + n, t.commandStr), Je(function(P, k) {
              return g && (P.OFFSET = L), L;
            });
          } else if (n in A) {
            var I = A[n];
            return xt(I, function(P, k) {
              var q = P.invoke(k, I);
              return g && (P.OFFSET = q, u.optional(function() {
                P.assert(
                  k,
                  q + ">=0",
                  "invalid " + n
                );
              })), q;
            });
          } else if (g && y)
            return Je(function(P, k) {
              return P.OFFSET = "0", 0;
            });
          return null;
        }
        var f = b(hn, !0);
        function h() {
          if (or in p) {
            var n = p[or] | 0;
            return u.command(
              typeof n == "number" && n >= 0,
              "invalid vertex count",
              t.commandStr
            ), Je(function() {
              return n;
            });
          } else if (or in A) {
            var g = A[or];
            return xt(g, function(P, k) {
              var q = P.invoke(k, g);
              return u.optional(function() {
                P.assert(
                  k,
                  "typeof " + q + '==="number"&&' + q + ">=0&&" + q + "===(" + q + "|0)",
                  "invalid vertex count"
                );
              }), q;
            });
          } else if (y)
            if (Ht(y)) {
              if (y)
                return f ? new _t(
                  f.thisDep,
                  f.contextDep,
                  f.propDep,
                  function(P, k) {
                    var q = k.def(
                      P.ELEMENTS,
                      ".vertCount-",
                      P.OFFSET
                    );
                    return u.optional(function() {
                      P.assert(
                        k,
                        q + ">=0",
                        "invalid vertex offset/element buffer too small"
                      );
                    }), q;
                  }
                ) : Je(function(P, k) {
                  return k.def(P.ELEMENTS, ".vertCount");
                });
              var L = Je(function() {
                return -1;
              });
              return u.optional(function() {
                L.MISSING = !0;
              }), L;
            } else {
              var I = new _t(
                y.thisDep || f.thisDep,
                y.contextDep || f.contextDep,
                y.propDep || f.propDep,
                function(P, k) {
                  var q = P.ELEMENTS;
                  return P.OFFSET ? k.def(
                    q,
                    "?",
                    q,
                    ".vertCount-",
                    P.OFFSET,
                    ":-1"
                  ) : k.def(q, "?", q, ".vertCount:-1");
                }
              );
              return u.optional(function() {
                I.DYNAMIC = !0;
              }), I;
            }
          return null;
        }
        return {
          elements: y,
          primitive: v(),
          count: h(),
          instances: b(mn, !1),
          offset: f
        };
      }
      function et(s, t) {
        var p = s.static, A = s.dynamic, S = {};
        return V.forEach(function(y) {
          var v = ae(y);
          function b(f, h) {
            if (y in p) {
              var n = f(p[y]);
              S[v] = Je(function() {
                return n;
              });
            } else if (y in A) {
              var g = A[y];
              S[v] = xt(g, function(L, I) {
                return h(L, I, L.invoke(I, g));
              });
            }
          }
          switch (y) {
            case Yi:
            case zi:
            case $i:
            case Ji:
            case Vi:
            case to:
            case Ki:
            case Qi:
            case Zi:
            case Wi:
              return b(
                function(f) {
                  return u.commandType(f, "boolean", y, t.commandStr), f;
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      "typeof " + n + '==="boolean"',
                      "invalid flag " + y,
                      f.commandStr
                    );
                  }), n;
                }
              );
            case Xi:
              return b(
                function(f) {
                  return u.commandParameter(f, wr, "invalid " + y, t.commandStr), wr[f];
                },
                function(f, h, n) {
                  var g = f.constants.compareFuncs;
                  return u.optional(function() {
                    f.assert(
                      h,
                      n + " in " + g,
                      "invalid " + y + ", must be one of " + Object.keys(wr)
                    );
                  }), h.def(g, "[", n, "]");
                }
              );
            case Hi:
              return b(
                function(f) {
                  return u.command(
                    Ye(f) && f.length === 2 && typeof f[0] == "number" && typeof f[1] == "number" && f[0] <= f[1],
                    "depth range is 2d array",
                    t.commandStr
                  ), f;
                },
                function(f, h, n) {
                  u.optional(function() {
                    f.assert(
                      h,
                      f.shared.isArrayLike + "(" + n + ")&&" + n + ".length===2&&typeof " + n + '[0]==="number"&&typeof ' + n + '[1]==="number"&&' + n + "[0]<=" + n + "[1]",
                      "depth range must be a 2d array"
                    );
                  });
                  var g = h.def("+", n, "[0]"), L = h.def("+", n, "[1]");
                  return [g, L];
                }
              );
            case sa:
              return b(
                function(f) {
                  u.commandType(f, "object", "blend.func", t.commandStr);
                  var h = "srcRGB" in f ? f.srcRGB : f.src, n = "srcAlpha" in f ? f.srcAlpha : f.src, g = "dstRGB" in f ? f.dstRGB : f.dst, L = "dstAlpha" in f ? f.dstAlpha : f.dst;
                  return u.commandParameter(h, It, v + ".srcRGB", t.commandStr), u.commandParameter(n, It, v + ".srcAlpha", t.commandStr), u.commandParameter(g, It, v + ".dstRGB", t.commandStr), u.commandParameter(L, It, v + ".dstAlpha", t.commandStr), u.command(
                    ho.indexOf(h + ", " + g) === -1,
                    "unallowed blending combination (srcRGB, dstRGB) = (" + h + ", " + g + ")",
                    t.commandStr
                  ), [
                    It[h],
                    It[g],
                    It[n],
                    It[L]
                  ];
                },
                function(f, h, n) {
                  var g = f.constants.blendFuncs;
                  u.optional(function() {
                    f.assert(
                      h,
                      n + "&&typeof " + n + '==="object"',
                      "invalid blend func, must be an object"
                    );
                  });
                  function L(de, ye) {
                    var Ee = h.def(
                      '"',
                      de,
                      ye,
                      '" in ',
                      n,
                      "?",
                      n,
                      ".",
                      de,
                      ye,
                      ":",
                      n,
                      ".",
                      de
                    );
                    return u.optional(function() {
                      f.assert(
                        h,
                        Ee + " in " + g,
                        "invalid " + y + "." + de + ye + ", must be one of " + Object.keys(It)
                      );
                    }), Ee;
                  }
                  var I = L("src", "RGB"), P = L("dst", "RGB");
                  u.optional(function() {
                    var de = f.constants.invalidBlendCombinations;
                    f.assert(
                      h,
                      de + ".indexOf(" + I + '+", "+' + P + ") === -1 ",
                      "unallowed blending combination for (srcRGB, dstRGB)"
                    );
                  });
                  var k = h.def(g, "[", I, "]"), q = h.def(g, "[", L("src", "Alpha"), "]"), me = h.def(g, "[", P, "]"), Ce = h.def(g, "[", L("dst", "Alpha"), "]");
                  return [k, me, q, Ce];
                }
              );
            case oa:
              return b(
                function(f) {
                  if (typeof f == "string")
                    return u.commandParameter(f, B, "invalid " + y, t.commandStr), [
                      B[f],
                      B[f]
                    ];
                  if (typeof f == "object")
                    return u.commandParameter(
                      f.rgb,
                      B,
                      y + ".rgb",
                      t.commandStr
                    ), u.commandParameter(
                      f.alpha,
                      B,
                      y + ".alpha",
                      t.commandStr
                    ), [
                      B[f.rgb],
                      B[f.alpha]
                    ];
                  u.commandRaise("invalid blend.equation", t.commandStr);
                },
                function(f, h, n) {
                  var g = f.constants.blendEquations, L = h.def(), I = h.def(), P = f.cond("typeof ", n, '==="string"');
                  return u.optional(function() {
                    function k(q, me, Ce) {
                      f.assert(
                        q,
                        Ce + " in " + g,
                        "invalid " + me + ", must be one of " + Object.keys(B)
                      );
                    }
                    k(P.then, y, n), f.assert(
                      P.else,
                      n + "&&typeof " + n + '==="object"',
                      "invalid " + y
                    ), k(P.else, y + ".rgb", n + ".rgb"), k(P.else, y + ".alpha", n + ".alpha");
                  }), P.then(
                    L,
                    "=",
                    I,
                    "=",
                    g,
                    "[",
                    n,
                    "];"
                  ), P.else(
                    L,
                    "=",
                    g,
                    "[",
                    n,
                    ".rgb];",
                    I,
                    "=",
                    g,
                    "[",
                    n,
                    ".alpha];"
                  ), h(P), [L, I];
                }
              );
            case ji:
              return b(
                function(f) {
                  return u.command(
                    Ye(f) && f.length === 4,
                    "blend.color must be a 4d array",
                    t.commandStr
                  ), gt(4, function(h) {
                    return +f[h];
                  });
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      f.shared.isArrayLike + "(" + n + ")&&" + n + ".length===4",
                      "blend.color must be a 4d array"
                    );
                  }), gt(4, function(g) {
                    return h.def("+", n, "[", g, "]");
                  });
                }
              );
            case eo:
              return b(
                function(f) {
                  return u.commandType(f, "number", v, t.commandStr), f | 0;
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      "typeof " + n + '==="number"',
                      "invalid stencil.mask"
                    );
                  }), h.def(n, "|0");
                }
              );
            case ha:
              return b(
                function(f) {
                  u.commandType(f, "object", v, t.commandStr);
                  var h = f.cmp || "keep", n = f.ref || 0, g = "mask" in f ? f.mask : -1;
                  return u.commandParameter(h, wr, y + ".cmp", t.commandStr), u.commandType(n, "number", y + ".ref", t.commandStr), u.commandType(g, "number", y + ".mask", t.commandStr), [
                    wr[h],
                    n,
                    g
                  ];
                },
                function(f, h, n) {
                  var g = f.constants.compareFuncs;
                  u.optional(function() {
                    function k() {
                      f.assert(
                        h,
                        Array.prototype.join.call(arguments, ""),
                        "invalid stencil.func"
                      );
                    }
                    k(n + "&&typeof ", n, '==="object"'), k(
                      '!("cmp" in ',
                      n,
                      ")||(",
                      n,
                      ".cmp in ",
                      g,
                      ")"
                    );
                  });
                  var L = h.def(
                    '"cmp" in ',
                    n,
                    "?",
                    g,
                    "[",
                    n,
                    ".cmp]",
                    ":",
                    Vt
                  ), I = h.def(n, ".ref|0"), P = h.def(
                    '"mask" in ',
                    n,
                    "?",
                    n,
                    ".mask|0:-1"
                  );
                  return [L, I, P];
                }
              );
            case ma:
            case Br:
              return b(
                function(f) {
                  u.commandType(f, "object", v, t.commandStr);
                  var h = f.fail || "keep", n = f.zfail || "keep", g = f.zpass || "keep";
                  return u.commandParameter(h, Xt, y + ".fail", t.commandStr), u.commandParameter(n, Xt, y + ".zfail", t.commandStr), u.commandParameter(g, Xt, y + ".zpass", t.commandStr), [
                    y === Br ? sr : Xr,
                    Xt[h],
                    Xt[n],
                    Xt[g]
                  ];
                },
                function(f, h, n) {
                  var g = f.constants.stencilOps;
                  u.optional(function() {
                    f.assert(
                      h,
                      n + "&&typeof " + n + '==="object"',
                      "invalid " + y
                    );
                  });
                  function L(I) {
                    return u.optional(function() {
                      f.assert(
                        h,
                        '!("' + I + '" in ' + n + ")||(" + n + "." + I + " in " + g + ")",
                        "invalid " + y + "." + I + ", must be one of " + Object.keys(Xt)
                      );
                    }), h.def(
                      '"',
                      I,
                      '" in ',
                      n,
                      "?",
                      g,
                      "[",
                      n,
                      ".",
                      I,
                      "]:",
                      Vt
                    );
                  }
                  return [
                    y === Br ? sr : Xr,
                    L("fail"),
                    L("zfail"),
                    L("zpass")
                  ];
                }
              );
            case la:
              return b(
                function(f) {
                  u.commandType(f, "object", v, t.commandStr);
                  var h = f.factor | 0, n = f.units | 0;
                  return u.commandType(h, "number", v + ".factor", t.commandStr), u.commandType(n, "number", v + ".units", t.commandStr), [h, n];
                },
                function(f, h, n) {
                  u.optional(function() {
                    f.assert(
                      h,
                      n + "&&typeof " + n + '==="object"',
                      "invalid " + y
                    );
                  });
                  var g = h.def(n, ".factor|0"), L = h.def(n, ".units|0");
                  return [g, L];
                }
              );
            case qi:
              return b(
                function(f) {
                  var h = 0;
                  return f === "front" ? h = Xr : f === "back" && (h = sr), u.command(!!h, v, t.commandStr), h;
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      n + '==="front"||' + n + '==="back"',
                      "invalid cull.face"
                    );
                  }), h.def(n, '==="front"?', Xr, ":", sr);
                }
              );
            case ca:
              return b(
                function(f) {
                  return u.command(
                    typeof f == "number" && f >= F.lineWidthDims[0] && f <= F.lineWidthDims[1],
                    "invalid line width, must be a positive number between " + F.lineWidthDims[0] + " and " + F.lineWidthDims[1],
                    t.commandStr
                  ), f;
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      "typeof " + n + '==="number"&&' + n + ">=" + F.lineWidthDims[0] + "&&" + n + "<=" + F.lineWidthDims[1],
                      "invalid line width"
                    );
                  }), n;
                }
              );
            case ua:
              return b(
                function(f) {
                  return u.commandParameter(f, xa, v, t.commandStr), xa[f];
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      n + '==="cw"||' + n + '==="ccw"',
                      "invalid frontFace, must be one of cw,ccw"
                    );
                  }), h.def(n + '==="cw"?' + so + ":" + ga);
                }
              );
            case fa:
              return b(
                function(f) {
                  return u.command(
                    Ye(f) && f.length === 4,
                    "color.mask must be length 4 array",
                    t.commandStr
                  ), f.map(function(h) {
                    return !!h;
                  });
                },
                function(f, h, n) {
                  return u.optional(function() {
                    f.assert(
                      h,
                      f.shared.isArrayLike + "(" + n + ")&&" + n + ".length===4",
                      "invalid color.mask"
                    );
                  }), gt(4, function(g) {
                    return "!!" + n + "[" + g + "]";
                  });
                }
              );
            case da:
              return b(
                function(f) {
                  u.command(typeof f == "object" && f, v, t.commandStr);
                  var h = "value" in f ? f.value : 1, n = !!f.invert;
                  return u.command(
                    typeof h == "number" && h >= 0 && h <= 1,
                    "sample.coverage.value must be a number between 0 and 1",
                    t.commandStr
                  ), [h, n];
                },
                function(f, h, n) {
                  u.optional(function() {
                    f.assert(
                      h,
                      n + "&&typeof " + n + '==="object"',
                      "invalid sample.coverage"
                    );
                  });
                  var g = h.def(
                    '"value" in ',
                    n,
                    "?+",
                    n,
                    ".value:1"
                  ), L = h.def("!!", n, ".invert");
                  return [g, L];
                }
              );
          }
        }), S;
      }
      function ot(s, t) {
        var p = s.static, A = s.dynamic, S = {};
        return Object.keys(p).forEach(function(y) {
          var v = p[y], b;
          if (typeof v == "number" || typeof v == "boolean")
            b = Je(function() {
              return v;
            });
          else if (typeof v == "function") {
            var f = v._reglType;
            f === "texture2d" || f === "textureCube" ? b = Je(function(h) {
              return h.link(v);
            }) : f === "framebuffer" || f === "framebufferCube" ? (u.command(
              v.color.length > 0,
              'missing color attachment for framebuffer sent to uniform "' + y + '"',
              t.commandStr
            ), b = Je(function(h) {
              return h.link(v.color[0]);
            })) : u.commandRaise('invalid data for uniform "' + y + '"', t.commandStr);
          } else
            Ye(v) ? b = Je(function(h) {
              var n = h.global.def(
                "[",
                gt(v.length, function(g) {
                  return u.command(
                    typeof v[g] == "number" || typeof v[g] == "boolean",
                    "invalid uniform " + y,
                    h.commandStr
                  ), v[g];
                }),
                "]"
              );
              return n;
            }) : u.commandRaise('invalid or missing data for uniform "' + y + '"', t.commandStr);
          b.value = v, S[y] = b;
        }), Object.keys(A).forEach(function(y) {
          var v = A[y];
          S[y] = xt(v, function(b, f) {
            return b.invoke(f, v);
          });
        }), S;
      }
      function Me(s, t) {
        var p = s.static, A = s.dynamic, S = {};
        return Object.keys(p).forEach(function(y) {
          var v = p[y], b = r.id(y), f = new w();
          if (wn(v))
            f.state = gr, f.buffer = N.getBuffer(
              N.create(v, Ar, !1, !0)
            ), f.type = 0;
          else {
            var h = N.getBuffer(v);
            if (h)
              f.state = gr, f.buffer = h, f.type = 0;
            else if (u.command(
              typeof v == "object" && v,
              "invalid data for attribute " + y,
              t.commandStr
            ), "constant" in v) {
              var n = v.constant;
              f.buffer = "null", f.state = ta, typeof n == "number" ? f.x = n : (u.command(
                Ye(n) && n.length > 0 && n.length <= 4,
                "invalid constant for attribute " + y,
                t.commandStr
              ), br.forEach(function(me, Ce) {
                Ce < n.length && (f[me] = n[Ce]);
              }));
            } else {
              wn(v.buffer) ? h = N.getBuffer(
                N.create(v.buffer, Ar, !1, !0)
              ) : h = N.getBuffer(v.buffer), u.command(!!h, 'missing buffer for attribute "' + y + '"', t.commandStr);
              var g = v.offset | 0;
              u.command(
                g >= 0,
                'invalid offset for attribute "' + y + '"',
                t.commandStr
              );
              var L = v.stride | 0;
              u.command(
                L >= 0 && L < 256,
                'invalid stride for attribute "' + y + '", must be integer betweeen [0, 255]',
                t.commandStr
              );
              var I = v.size | 0;
              u.command(
                !("size" in v) || I > 0 && I <= 4,
                'invalid size for attribute "' + y + '", must be 1,2,3,4',
                t.commandStr
              );
              var P = !!v.normalized, k = 0;
              "type" in v && (u.commandParameter(
                v.type,
                Zt,
                "invalid type for attribute " + y,
                t.commandStr
              ), k = Zt[v.type]);
              var q = v.divisor | 0;
              "divisor" in v && (u.command(
                q === 0 || K,
                'cannot specify divisor for attribute "' + y + '", instancing not supported',
                t.commandStr
              ), u.command(
                q >= 0,
                'invalid divisor for attribute "' + y + '"',
                t.commandStr
              )), u.optional(function() {
                var me = t.commandStr, Ce = [
                  "buffer",
                  "offset",
                  "divisor",
                  "normalized",
                  "type",
                  "size",
                  "stride"
                ];
                Object.keys(v).forEach(function(de) {
                  u.command(
                    Ce.indexOf(de) >= 0,
                    'unknown parameter "' + de + '" for attribute pointer "' + y + '" (valid parameters are ' + Ce + ")",
                    me
                  );
                });
              }), f.buffer = h, f.state = gr, f.size = I, f.normalized = P, f.type = k || h.dtype, f.offset = g, f.stride = L, f.divisor = q;
            }
          }
          S[y] = Je(function(me, Ce) {
            var de = me.attribCache;
            if (b in de)
              return de[b];
            var ye = {
              isStream: !1
            };
            return Object.keys(f).forEach(function(Ee) {
              ye[Ee] = f[Ee];
            }), f.buffer && (ye.buffer = me.link(f.buffer), ye.type = ye.type || ye.buffer + ".dtype"), de[b] = ye, ye;
          });
        }), Object.keys(A).forEach(function(y) {
          var v = A[y];
          function b(f, h) {
            var n = f.invoke(h, v), g = f.shared, L = f.constants, I = g.isBufferArgs, P = g.buffer;
            u.optional(function() {
              f.assert(
                h,
                n + "&&(typeof " + n + '==="object"||typeof ' + n + '==="function")&&(' + I + "(" + n + ")||" + P + ".getBuffer(" + n + ")||" + P + ".getBuffer(" + n + ".buffer)||" + I + "(" + n + '.buffer)||("constant" in ' + n + "&&(typeof " + n + '.constant==="number"||' + g.isArrayLike + "(" + n + ".constant))))",
                'invalid dynamic attribute "' + y + '"'
              );
            });
            var k = {
              isStream: h.def(!1)
            }, q = new w();
            q.state = gr, Object.keys(q).forEach(function(ye) {
              k[ye] = h.def("" + q[ye]);
            });
            var me = k.buffer, Ce = k.type;
            h(
              "if(",
              I,
              "(",
              n,
              ")){",
              k.isStream,
              "=true;",
              me,
              "=",
              P,
              ".createStream(",
              Ar,
              ",",
              n,
              ");",
              Ce,
              "=",
              me,
              ".dtype;",
              "}else{",
              me,
              "=",
              P,
              ".getBuffer(",
              n,
              ");",
              "if(",
              me,
              "){",
              Ce,
              "=",
              me,
              ".dtype;",
              '}else if("constant" in ',
              n,
              "){",
              k.state,
              "=",
              ta,
              ";",
              "if(typeof " + n + '.constant === "number"){',
              k[br[0]],
              "=",
              n,
              ".constant;",
              br.slice(1).map(function(ye) {
                return k[ye];
              }).join("="),
              "=0;",
              "}else{",
              br.map(function(ye, Ee) {
                return k[ye] + "=" + n + ".constant.length>" + Ee + "?" + n + ".constant[" + Ee + "]:0;";
              }).join(""),
              "}}else{",
              "if(",
              I,
              "(",
              n,
              ".buffer)){",
              me,
              "=",
              P,
              ".createStream(",
              Ar,
              ",",
              n,
              ".buffer);",
              "}else{",
              me,
              "=",
              P,
              ".getBuffer(",
              n,
              ".buffer);",
              "}",
              Ce,
              '="type" in ',
              n,
              "?",
              L.glTypes,
              "[",
              n,
              ".type]:",
              me,
              ".dtype;",
              k.normalized,
              "=!!",
              n,
              ".normalized;"
            );
            function de(ye) {
              h(k[ye], "=", n, ".", ye, "|0;");
            }
            return de("size"), de("offset"), de("stride"), de("divisor"), h("}}"), h.exit(
              "if(",
              k.isStream,
              "){",
              P,
              ".destroyStream(",
              me,
              ");",
              "}"
            ), k;
          }
          S[y] = xt(v, b);
        }), S;
      }
      function rt(s, t) {
        var p = s.static, A = s.dynamic;
        if (Pr in p) {
          var S = p[Pr];
          return S !== null && Q.getVAO(S) === null && (S = Q.createVAO(S)), Je(function(v) {
            return v.link(Q.getVAO(S));
          });
        } else if (Pr in A) {
          var y = A[Pr];
          return xt(y, function(v, b) {
            var f = v.invoke(b, y);
            return b.def(v.shared.vao + ".getVAO(" + f + ")");
          });
        }
        return null;
      }
      function Ve(s) {
        var t = s.static, p = s.dynamic, A = {};
        return Object.keys(t).forEach(function(S) {
          var y = t[S];
          A[S] = Je(function(v, b) {
            return typeof y == "number" || typeof y == "boolean" ? "" + y : v.link(y);
          });
        }), Object.keys(p).forEach(function(S) {
          var y = p[S];
          A[S] = xt(y, function(v, b) {
            return v.invoke(b, y);
          });
        }), A;
      }
      function tt(s, t, p, A, S) {
        var y = s.static, v = s.dynamic;
        u.optional(function() {
          var de = [
            nr,
            Ir,
            Nr,
            ar,
            ir,
            hn,
            or,
            mn,
            kr,
            Pr
          ].concat(V);
          function ye(Ee) {
            Object.keys(Ee).forEach(function(ze) {
              u.command(
                de.indexOf(ze) >= 0,
                'unknown parameter "' + ze + '"',
                S.commandStr
              );
            });
          }
          ye(y), ye(v);
        });
        var b = xe(s, t), f = le(s), h = Fe(s, f, S), n = $e(s, S), g = et(s, S), L = Oe(s, S, b);
        function I(de) {
          var ye = h[de];
          ye && (g[de] = ye);
        }
        I(Ut), I(ae(dn));
        var P = Object.keys(g).length > 0, k = {
          framebuffer: f,
          draw: n,
          shader: L,
          state: g,
          dirty: P,
          scopeVAO: null,
          drawVAO: null,
          useVAO: !1,
          attributes: {}
        };
        if (k.profile = Le(s), k.uniforms = ot(p, S), k.drawVAO = k.scopeVAO = rt(s), !k.drawVAO && L.program && !b && d.angle_instanced_arrays) {
          var q = !0, me = L.program.attributes.map(function(de) {
            var ye = t.static[de];
            return q = q && !!ye, ye;
          });
          if (q && me.length > 0) {
            var Ce = Q.getVAO(Q.createVAO(me));
            k.drawVAO = new _t(null, null, null, function(de, ye) {
              return de.link(Ce);
            }), k.useVAO = !0;
          }
        }
        return b ? k.useVAO = !0 : k.attributes = Me(t, S), k.context = Ve(A), k;
      }
      function nt(s, t, p) {
        var A = s.shared, S = A.context, y = s.scope();
        Object.keys(p).forEach(function(v) {
          t.save(S, "." + v);
          var b = p[v], f = b.append(s, t);
          Array.isArray(f) ? y(S, ".", v, "=[", f.join(), "];") : y(S, ".", v, "=", f, ";");
        }), t(y);
      }
      function at(s, t, p, A) {
        var S = s.shared, y = S.gl, v = S.framebuffer, b;
        se && (b = t.def(S.extensions, ".webgl_draw_buffers"));
        var f = s.constants, h = f.drawBuffer, n = f.backBuffer, g;
        p ? g = p.append(s, t) : g = t.def(v, ".next"), A || t("if(", g, "!==", v, ".cur){"), t(
          "if(",
          g,
          "){",
          y,
          ".bindFramebuffer(",
          lo,
          ",",
          g,
          ".framebuffer);"
        ), se && t(
          b,
          ".drawBuffersWEBGL(",
          h,
          "[",
          g,
          ".colorAttachments.length]);"
        ), t(
          "}else{",
          y,
          ".bindFramebuffer(",
          lo,
          ",null);"
        ), se && t(b, ".drawBuffersWEBGL(", n, ");"), t(
          "}",
          v,
          ".cur=",
          g,
          ";"
        ), A || t("}");
      }
      function ft(s, t, p) {
        var A = s.shared, S = A.gl, y = s.current, v = s.next, b = A.current, f = A.next, h = s.cond(b, ".dirty");
        V.forEach(function(n) {
          var g = ae(n);
          if (!(g in p.state)) {
            var L, I;
            if (g in v) {
              L = v[g], I = y[g];
              var P = gt(z[g].length, function(q) {
                return h.def(L, "[", q, "]");
              });
              h(s.cond(P.map(function(q, me) {
                return q + "!==" + I + "[" + me + "]";
              }).join("||")).then(
                S,
                ".",
                j[g],
                "(",
                P,
                ");",
                P.map(function(q, me) {
                  return I + "[" + me + "]=" + q;
                }).join(";"),
                ";"
              ));
            } else {
              L = h.def(f, ".", g);
              var k = s.cond(L, "!==", b, ".", g);
              h(k), g in ne ? k(
                s.cond(L).then(S, ".enable(", ne[g], ");").else(S, ".disable(", ne[g], ");"),
                b,
                ".",
                g,
                "=",
                L,
                ";"
              ) : k(
                S,
                ".",
                j[g],
                "(",
                L,
                ");",
                b,
                ".",
                g,
                "=",
                L,
                ";"
              );
            }
          }
        }), Object.keys(p.state).length === 0 && h(b, ".dirty=false;"), t(h);
      }
      function dt(s, t, p, A) {
        var S = s.shared, y = s.current, v = S.current, b = S.gl;
        po(Object.keys(p)).forEach(function(f) {
          var h = p[f];
          if (!(A && !A(h))) {
            var n = h.append(s, t);
            if (ne[f]) {
              var g = ne[f];
              Ht(h) ? n ? t(b, ".enable(", g, ");") : t(b, ".disable(", g, ");") : t(s.cond(n).then(b, ".enable(", g, ");").else(b, ".disable(", g, ");")), t(v, ".", f, "=", n, ";");
            } else if (Ye(n)) {
              var L = y[f];
              t(
                b,
                ".",
                j[f],
                "(",
                n,
                ");",
                n.map(function(I, P) {
                  return L + "[" + P + "]=" + I;
                }).join(";"),
                ";"
              );
            } else
              t(
                b,
                ".",
                j[f],
                "(",
                n,
                ");",
                v,
                ".",
                f,
                "=",
                n,
                ";"
              );
          }
        });
      }
      function qe(s, t) {
        K && (s.instancing = t.def(
          s.shared.extensions,
          ".angle_instanced_arrays"
        ));
      }
      function Re(s, t, p, A, S) {
        var y = s.shared, v = s.stats, b = y.current, f = y.timer, h = p.profile;
        function n() {
          return typeof performance > "u" ? "Date.now()" : "performance.now()";
        }
        var g, L;
        function I(de) {
          g = t.def(), de(g, "=", n(), ";"), typeof S == "string" ? de(v, ".count+=", S, ";") : de(v, ".count++;"), H && (A ? (L = t.def(), de(L, "=", f, ".getNumPendingQueries();")) : de(f, ".beginQuery(", v, ");"));
        }
        function P(de) {
          de(v, ".cpuTime+=", n(), "-", g, ";"), H && (A ? de(
            f,
            ".pushScopeStats(",
            L,
            ",",
            f,
            ".getNumPendingQueries(),",
            v,
            ");"
          ) : de(f, ".endQuery();"));
        }
        function k(de) {
          var ye = t.def(b, ".profile");
          t(b, ".profile=", de, ";"), t.exit(b, ".profile=", ye, ";");
        }
        var q;
        if (h) {
          if (Ht(h)) {
            h.enable ? (I(t), P(t.exit), k("true")) : k("false");
            return;
          }
          q = h.append(s, t), k(q);
        } else
          q = t.def(b, ".profile");
        var me = s.block();
        I(me), t("if(", q, "){", me, "}");
        var Ce = s.block();
        P(Ce), t.exit("if(", q, "){", Ce, "}");
      }
      function ht(s, t, p, A, S) {
        var y = s.shared;
        function v(f) {
          switch (f) {
            case pn:
            case _n:
            case xn:
              return 2;
            case vn:
            case bn:
            case En:
              return 3;
            case yn:
            case gn:
            case An:
              return 4;
            default:
              return 1;
          }
        }
        function b(f, h, n) {
          var g = y.gl, L = t.def(f, ".location"), I = t.def(y.attributes, "[", L, "]"), P = n.state, k = n.buffer, q = [
            n.x,
            n.y,
            n.z,
            n.w
          ], me = [
            "buffer",
            "normalized",
            "offset",
            "stride"
          ];
          function Ce() {
            t(
              "if(!",
              I,
              ".buffer){",
              g,
              ".enableVertexAttribArray(",
              L,
              ");}"
            );
            var ye = n.type, Ee;
            if (n.size ? Ee = t.def(n.size, "||", h) : Ee = h, t(
              "if(",
              I,
              ".type!==",
              ye,
              "||",
              I,
              ".size!==",
              Ee,
              "||",
              me.map(function(Xe) {
                return I + "." + Xe + "!==" + n[Xe];
              }).join("||"),
              "){",
              g,
              ".bindBuffer(",
              Ar,
              ",",
              k,
              ".buffer);",
              g,
              ".vertexAttribPointer(",
              [
                L,
                Ee,
                ye,
                n.normalized,
                n.stride,
                n.offset
              ],
              ");",
              I,
              ".type=",
              ye,
              ";",
              I,
              ".size=",
              Ee,
              ";",
              me.map(function(Xe) {
                return I + "." + Xe + "=" + n[Xe] + ";";
              }).join(""),
              "}"
            ), K) {
              var ze = n.divisor;
              t(
                "if(",
                I,
                ".divisor!==",
                ze,
                "){",
                s.instancing,
                ".vertexAttribDivisorANGLE(",
                [L, ze],
                ");",
                I,
                ".divisor=",
                ze,
                ";}"
              );
            }
          }
          function de() {
            t(
              "if(",
              I,
              ".buffer){",
              g,
              ".disableVertexAttribArray(",
              L,
              ");",
              I,
              ".buffer=null;",
              "}if(",
              br.map(function(ye, Ee) {
                return I + "." + ye + "!==" + q[Ee];
              }).join("||"),
              "){",
              g,
              ".vertexAttrib4f(",
              L,
              ",",
              q,
              ");",
              br.map(function(ye, Ee) {
                return I + "." + ye + "=" + q[Ee] + ";";
              }).join(""),
              "}"
            );
          }
          P === gr ? Ce() : P === ta ? de() : (t("if(", P, "===", gr, "){"), Ce(), t("}else{"), de(), t("}"));
        }
        A.forEach(function(f) {
          var h = f.name, n = p.attributes[h], g;
          if (n) {
            if (!S(n))
              return;
            g = n.append(s, t);
          } else {
            if (!S(vo))
              return;
            var L = s.scopeAttrib(h);
            u.optional(function() {
              s.assert(
                t,
                L + ".state",
                "missing attribute " + h
              );
            }), g = {}, Object.keys(new w()).forEach(function(I) {
              g[I] = t.def(L, ".", I);
            });
          }
          b(
            s.link(f),
            v(f.info.type),
            g
          );
        });
      }
      function je(s, t, p, A, S) {
        for (var y = s.shared, v = y.gl, b, f = 0; f < A.length; ++f) {
          var h = A[f], n = h.name, g = h.info.type, L = p.uniforms[n], I = s.link(h), P = I + ".location", k;
          if (L) {
            if (!S(L))
              continue;
            if (Ht(L)) {
              var q = L.value;
              if (u.command(
                q !== null && typeof q < "u",
                'missing uniform "' + n + '"',
                s.commandStr
              ), g === jr || g === Vr) {
                u.command(
                  typeof q == "function" && (g === jr && (q._reglType === "texture2d" || q._reglType === "framebuffer") || g === Vr && (q._reglType === "textureCube" || q._reglType === "framebufferCube")),
                  "invalid texture for uniform " + n,
                  s.commandStr
                );
                var me = s.link(q._texture || q.color[0]._texture);
                t(v, ".uniform1i(", P, ",", me + ".bind());"), t.exit(me, ".unbind();");
              } else if (g === Ur || g === $r || g === zr) {
                u.optional(function() {
                  u.command(
                    Ye(q),
                    "invalid matrix for uniform " + n,
                    s.commandStr
                  ), u.command(
                    g === Ur && q.length === 4 || g === $r && q.length === 9 || g === zr && q.length === 16,
                    "invalid length for matrix uniform " + n,
                    s.commandStr
                  );
                });
                var Ce = s.global.def("new Float32Array([" + Array.prototype.slice.call(q) + "])"), de = 2;
                g === $r ? de = 3 : g === zr && (de = 4), t(
                  v,
                  ".uniformMatrix",
                  de,
                  "fv(",
                  P,
                  ",false,",
                  Ce,
                  ");"
                );
              } else {
                switch (g) {
                  case ya:
                    u.commandType(q, "number", "uniform " + n, s.commandStr), b = "1f";
                    break;
                  case pn:
                    u.command(
                      Ye(q) && q.length === 2,
                      "uniform " + n,
                      s.commandStr
                    ), b = "2f";
                    break;
                  case vn:
                    u.command(
                      Ye(q) && q.length === 3,
                      "uniform " + n,
                      s.commandStr
                    ), b = "3f";
                    break;
                  case yn:
                    u.command(
                      Ye(q) && q.length === 4,
                      "uniform " + n,
                      s.commandStr
                    ), b = "4f";
                    break;
                  case ba:
                    u.commandType(q, "boolean", "uniform " + n, s.commandStr), b = "1i";
                    break;
                  case _a:
                    u.commandType(q, "number", "uniform " + n, s.commandStr), b = "1i";
                    break;
                  case xn:
                    u.command(
                      Ye(q) && q.length === 2,
                      "uniform " + n,
                      s.commandStr
                    ), b = "2i";
                    break;
                  case _n:
                    u.command(
                      Ye(q) && q.length === 2,
                      "uniform " + n,
                      s.commandStr
                    ), b = "2i";
                    break;
                  case En:
                    u.command(
                      Ye(q) && q.length === 3,
                      "uniform " + n,
                      s.commandStr
                    ), b = "3i";
                    break;
                  case bn:
                    u.command(
                      Ye(q) && q.length === 3,
                      "uniform " + n,
                      s.commandStr
                    ), b = "3i";
                    break;
                  case An:
                    u.command(
                      Ye(q) && q.length === 4,
                      "uniform " + n,
                      s.commandStr
                    ), b = "4i";
                    break;
                  case gn:
                    u.command(
                      Ye(q) && q.length === 4,
                      "uniform " + n,
                      s.commandStr
                    ), b = "4i";
                    break;
                }
                t(
                  v,
                  ".uniform",
                  b,
                  "(",
                  P,
                  ",",
                  Ye(q) ? Array.prototype.slice.call(q) : q,
                  ");"
                );
              }
              continue;
            } else
              k = L.append(s, t);
          } else {
            if (!S(vo))
              continue;
            k = t.def(y.uniforms, "[", r.id(n), "]");
          }
          g === jr ? (u(!Array.isArray(k), "must specify a scalar prop for textures"), t(
            "if(",
            k,
            "&&",
            k,
            '._reglType==="framebuffer"){',
            k,
            "=",
            k,
            ".color[0];",
            "}"
          )) : g === Vr && (u(!Array.isArray(k), "must specify a scalar prop for cube maps"), t(
            "if(",
            k,
            "&&",
            k,
            '._reglType==="framebufferCube"){',
            k,
            "=",
            k,
            ".color[0];",
            "}"
          )), u.optional(function() {
            function bt(Bt, Ao) {
              s.assert(
                t,
                Bt,
                'bad data or missing for uniform "' + n + '".  ' + Ao
              );
            }
            function Ea(Bt) {
              u(!Array.isArray(k), "must not specify an array type for uniform"), bt(
                "typeof " + k + '==="' + Bt + '"',
                "invalid type, expected " + Bt
              );
            }
            function Ft(Bt, Ao) {
              Array.isArray(k) ? u(k.length === Bt, "must have length " + Bt) : bt(
                y.isArrayLike + "(" + k + ")&&" + k + ".length===" + Bt,
                "invalid vector, should have length " + Bt,
                s.commandStr
              );
            }
            function Eo(Bt) {
              u(!Array.isArray(k), "must not specify a value type"), bt(
                "typeof " + k + '==="function"&&' + k + '._reglType==="texture' + (Bt === io ? "2d" : "Cube") + '"',
                "invalid texture type",
                s.commandStr
              );
            }
            switch (g) {
              case _a:
                Ea("number");
                break;
              case _n:
                Ft(2);
                break;
              case bn:
                Ft(3);
                break;
              case gn:
                Ft(4);
                break;
              case ya:
                Ea("number");
                break;
              case pn:
                Ft(2);
                break;
              case vn:
                Ft(3);
                break;
              case yn:
                Ft(4);
                break;
              case ba:
                Ea("boolean");
                break;
              case xn:
                Ft(2);
                break;
              case En:
                Ft(3);
                break;
              case An:
                Ft(4);
                break;
              case Ur:
                Ft(4);
                break;
              case $r:
                Ft(9);
                break;
              case zr:
                Ft(16);
                break;
              case jr:
                Eo(io);
                break;
              case Vr:
                Eo(vu);
                break;
            }
          });
          var ye = 1;
          switch (g) {
            case jr:
            case Vr:
              var Ee = t.def(k, "._texture");
              t(v, ".uniform1i(", P, ",", Ee, ".bind());"), t.exit(Ee, ".unbind();");
              continue;
            case _a:
            case ba:
              b = "1i";
              break;
            case _n:
            case xn:
              b = "2i", ye = 2;
              break;
            case bn:
            case En:
              b = "3i", ye = 3;
              break;
            case gn:
            case An:
              b = "4i", ye = 4;
              break;
            case ya:
              b = "1f";
              break;
            case pn:
              b = "2f", ye = 2;
              break;
            case vn:
              b = "3f", ye = 3;
              break;
            case yn:
              b = "4f", ye = 4;
              break;
            case Ur:
              b = "Matrix2fv";
              break;
            case $r:
              b = "Matrix3fv";
              break;
            case zr:
              b = "Matrix4fv";
              break;
          }
          if (t(v, ".uniform", b, "(", P, ","), b.charAt(0) === "M") {
            var ze = Math.pow(g - Ur + 2, 2), Xe = s.global.def("new Float32Array(", ze, ")");
            Array.isArray(k) ? t(
              "false,(",
              gt(ze, function(bt) {
                return Xe + "[" + bt + "]=" + k[bt];
              }),
              ",",
              Xe,
              ")"
            ) : t(
              "false,(Array.isArray(",
              k,
              ")||",
              k,
              " instanceof Float32Array)?",
              k,
              ":(",
              gt(ze, function(bt) {
                return Xe + "[" + bt + "]=" + k + "[" + bt + "]";
              }),
              ",",
              Xe,
              ")"
            );
          } else
            ye > 1 ? t(gt(ye, function(bt) {
              return Array.isArray(k) ? k[bt] : k + "[" + bt + "]";
            })) : (u(!Array.isArray(k), "uniform value must not be an array"), t(k));
          t(");");
        }
      }
      function ve(s, t, p, A) {
        var S = s.shared, y = S.gl, v = S.draw, b = A.draw;
        function f() {
          var Ee = b.elements, ze, Xe = t;
          return Ee ? ((Ee.contextDep && A.contextDynamic || Ee.propDep) && (Xe = p), ze = Ee.append(s, Xe)) : ze = Xe.def(v, ".", ar), ze && Xe(
            "if(" + ze + ")" + y + ".bindBuffer(" + hu + "," + ze + ".buffer.buffer);"
          ), ze;
        }
        function h() {
          var Ee = b.count, ze, Xe = t;
          return Ee ? ((Ee.contextDep && A.contextDynamic || Ee.propDep) && (Xe = p), ze = Ee.append(s, Xe), u.optional(function() {
            Ee.MISSING && s.assert(t, "false", "missing vertex count"), Ee.DYNAMIC && s.assert(Xe, ze + ">=0", "missing vertex count");
          })) : (ze = Xe.def(v, ".", or), u.optional(function() {
            s.assert(Xe, ze + ">=0", "missing vertex count");
          })), ze;
        }
        var n = f();
        function g(Ee) {
          var ze = b[Ee];
          return ze ? ze.contextDep && A.contextDynamic || ze.propDep ? ze.append(s, p) : ze.append(s, t) : t.def(v, ".", Ee);
        }
        var L = g(ir), I = g(hn), P = h();
        if (typeof P == "number") {
          if (P === 0)
            return;
        } else
          p("if(", P, "){"), p.exit("}");
        var k, q;
        K && (k = g(mn), q = s.instancing);
        var me = n + ".type", Ce = b.elements && Ht(b.elements);
        function de() {
          function Ee() {
            p(q, ".drawElementsInstancedANGLE(", [
              L,
              P,
              me,
              I + "<<((" + me + "-" + Ni + ")>>1)",
              k
            ], ");");
          }
          function ze() {
            p(
              q,
              ".drawArraysInstancedANGLE(",
              [L, I, P, k],
              ");"
            );
          }
          n ? Ce ? Ee() : (p("if(", n, "){"), Ee(), p("}else{"), ze(), p("}")) : ze();
        }
        function ye() {
          function Ee() {
            p(y + ".drawElements(" + [
              L,
              P,
              me,
              I + "<<((" + me + "-" + Ni + ")>>1)"
            ] + ");");
          }
          function ze() {
            p(y + ".drawArrays(" + [L, I, P] + ");");
          }
          n ? Ce ? Ee() : (p("if(", n, "){"), Ee(), p("}else{"), ze(), p("}")) : ze();
        }
        K && (typeof k != "number" || k >= 0) ? typeof k == "string" ? (p("if(", k, ">0){"), de(), p("}else if(", k, "<0){"), ye(), p("}")) : de() : ye();
      }
      function De(s, t, p, A, S) {
        var y = _e(), v = y.proc("body", S);
        return u.optional(function() {
          y.commandStr = t.commandStr, y.command = y.link(t.commandStr);
        }), K && (y.instancing = v.def(
          y.shared.extensions,
          ".angle_instanced_arrays"
        )), s(y, v, p, A), y.compile().body;
      }
      function Ne(s, t, p, A) {
        qe(s, t), p.useVAO ? p.drawVAO ? t(s.shared.vao, ".setVAO(", p.drawVAO.append(s, t), ");") : t(s.shared.vao, ".setVAO(", s.shared.vao, ".targetVAO);") : (t(s.shared.vao, ".setVAO(null);"), ht(s, t, p, A.attributes, function() {
          return !0;
        })), je(s, t, p, A.uniforms, function() {
          return !0;
        }), ve(s, t, t, p);
      }
      function Ke(s, t) {
        var p = s.proc("draw", 1);
        qe(s, p), nt(s, p, t.context), at(s, p, t.framebuffer), ft(s, p, t), dt(s, p, t.state), Re(s, p, t, !1, !0);
        var A = t.shader.progVar.append(s, p);
        if (p(s.shared.gl, ".useProgram(", A, ".program);"), t.shader.program)
          Ne(s, p, t, t.shader.program);
        else {
          p(s.shared.vao, ".setVAO(null);");
          var S = s.global.def("{}"), y = p.def(A, ".id"), v = p.def(S, "[", y, "]");
          p(
            s.cond(v).then(v, ".call(this,a0);").else(
              v,
              "=",
              S,
              "[",
              y,
              "]=",
              s.link(function(b) {
                return De(Ne, s, t, b, 1);
              }),
              "(",
              A,
              ");",
              v,
              ".call(this,a0);"
            )
          );
        }
        Object.keys(t.state).length > 0 && p(s.shared.current, ".dirty=true;");
      }
      function Nt(s, t, p, A) {
        s.batchId = "a1", qe(s, t);
        function S() {
          return !0;
        }
        ht(s, t, p, A.attributes, S), je(s, t, p, A.uniforms, S), ve(s, t, t, p);
      }
      function fr(s, t, p, A) {
        qe(s, t);
        var S = p.contextDep, y = t.def(), v = "a0", b = "a1", f = t.def();
        s.shared.props = f, s.batchId = y;
        var h = s.scope(), n = s.scope();
        t(
          h.entry,
          "for(",
          y,
          "=0;",
          y,
          "<",
          b,
          ";++",
          y,
          "){",
          f,
          "=",
          v,
          "[",
          y,
          "];",
          n,
          "}",
          h.exit
        );
        function g(me) {
          return me.contextDep && S || me.propDep;
        }
        function L(me) {
          return !g(me);
        }
        if (p.needsContext && nt(s, n, p.context), p.needsFramebuffer && at(s, n, p.framebuffer), dt(s, n, p.state, g), p.profile && g(p.profile) && Re(s, n, p, !1, !0), A)
          p.useVAO ? p.drawVAO ? g(p.drawVAO) ? n(s.shared.vao, ".setVAO(", p.drawVAO.append(s, n), ");") : h(s.shared.vao, ".setVAO(", p.drawVAO.append(s, h), ");") : h(s.shared.vao, ".setVAO(", s.shared.vao, ".targetVAO);") : (h(s.shared.vao, ".setVAO(null);"), ht(s, h, p, A.attributes, L), ht(s, n, p, A.attributes, g)), je(s, h, p, A.uniforms, L), je(s, n, p, A.uniforms, g), ve(s, h, n, p);
        else {
          var I = s.global.def("{}"), P = p.shader.progVar.append(s, n), k = n.def(P, ".id"), q = n.def(I, "[", k, "]");
          n(
            s.shared.gl,
            ".useProgram(",
            P,
            ".program);",
            "if(!",
            q,
            "){",
            q,
            "=",
            I,
            "[",
            k,
            "]=",
            s.link(function(me) {
              return De(
                Nt,
                s,
                p,
                me,
                2
              );
            }),
            "(",
            P,
            ");}",
            q,
            ".call(this,a0[",
            y,
            "],",
            y,
            ");"
          );
        }
      }
      function l(s, t) {
        var p = s.proc("batch", 2);
        s.batchId = "0", qe(s, p);
        var A = !1, S = !0;
        Object.keys(t.context).forEach(function(I) {
          A = A || t.context[I].propDep;
        }), A || (nt(s, p, t.context), S = !1);
        var y = t.framebuffer, v = !1;
        y ? (y.propDep ? A = v = !0 : y.contextDep && A && (v = !0), v || at(s, p, y)) : at(s, p, null), t.state.viewport && t.state.viewport.propDep && (A = !0);
        function b(I) {
          return I.contextDep && A || I.propDep;
        }
        ft(s, p, t), dt(s, p, t.state, function(I) {
          return !b(I);
        }), (!t.profile || !b(t.profile)) && Re(s, p, t, !1, "a1"), t.contextDep = A, t.needsContext = S, t.needsFramebuffer = v;
        var f = t.shader.progVar;
        if (f.contextDep && A || f.propDep)
          fr(
            s,
            p,
            t,
            null
          );
        else {
          var h = f.append(s, p);
          if (p(s.shared.gl, ".useProgram(", h, ".program);"), t.shader.program)
            fr(
              s,
              p,
              t,
              t.shader.program
            );
          else {
            p(s.shared.vao, ".setVAO(null);");
            var n = s.global.def("{}"), g = p.def(h, ".id"), L = p.def(n, "[", g, "]");
            p(
              s.cond(L).then(L, ".call(this,a0,a1);").else(
                L,
                "=",
                n,
                "[",
                g,
                "]=",
                s.link(function(I) {
                  return De(fr, s, t, I, 2);
                }),
                "(",
                h,
                ");",
                L,
                ".call(this,a0,a1);"
              )
            );
          }
        }
        Object.keys(t.state).length > 0 && p(s.shared.current, ".dirty=true;");
      }
      function G(s, t) {
        var p = s.proc("scope", 3);
        s.batchId = "a2";
        var A = s.shared, S = A.current;
        nt(s, p, t.context), t.framebuffer && t.framebuffer.append(s, p), po(Object.keys(t.state)).forEach(function(v) {
          var b = t.state[v], f = b.append(s, p);
          Ye(f) ? f.forEach(function(h, n) {
            p.set(s.next[v], "[" + n + "]", h);
          }) : p.set(A.next, "." + v, f);
        }), Re(s, p, t, !0, !0), [ar, hn, or, mn, ir].forEach(
          function(v) {
            var b = t.draw[v];
            b && p.set(A.draw, "." + v, "" + b.append(s, p));
          }
        ), Object.keys(t.uniforms).forEach(function(v) {
          var b = t.uniforms[v].append(s, p);
          Array.isArray(b) && (b = "[" + b.join() + "]"), p.set(
            A.uniforms,
            "[" + r.id(v) + "]",
            b
          );
        }), Object.keys(t.attributes).forEach(function(v) {
          var b = t.attributes[v].append(s, p), f = s.scopeAttrib(v);
          Object.keys(new w()).forEach(function(h) {
            p.set(f, "." + h, b[h]);
          });
        }), t.scopeVAO && p.set(A.vao, ".targetVAO", t.scopeVAO.append(s, p));
        function y(v) {
          var b = t.shader[v];
          b && p.set(A.shader, "." + v, b.append(s, p));
        }
        y(Ir), y(Nr), Object.keys(t.state).length > 0 && (p(S, ".dirty=true;"), p.exit(S, ".dirty=true;")), p("a1(", s.shared.context, ",a0,", s.batchId, ");");
      }
      function R(s) {
        if (!(typeof s != "object" || Ye(s))) {
          for (var t = Object.keys(s), p = 0; p < t.length; ++p)
            if (Lt.isDynamic(s[t[p]]))
              return !0;
          return !1;
        }
      }
      function ue(s, t, p) {
        var A = t.static[p];
        if (!A || !R(A))
          return;
        var S = s.global, y = Object.keys(A), v = !1, b = !1, f = !1, h = s.global.def("{}");
        y.forEach(function(g) {
          var L = A[g];
          if (Lt.isDynamic(L)) {
            typeof L == "function" && (L = A[g] = Lt.unbox(L));
            var I = xt(L, null);
            v = v || I.thisDep, f = f || I.propDep, b = b || I.contextDep;
          } else {
            switch (S(h, ".", g, "="), typeof L) {
              case "number":
                S(L);
                break;
              case "string":
                S('"', L, '"');
                break;
              case "object":
                Array.isArray(L) && S("[", L.join(), "]");
                break;
              default:
                S(s.link(L));
                break;
            }
            S(";");
          }
        });
        function n(g, L) {
          y.forEach(function(I) {
            var P = A[I];
            if (Lt.isDynamic(P)) {
              var k = g.invoke(L, P);
              L(h, ".", I, "=", k, ";");
            }
          });
        }
        t.dynamic[p] = new Lt.DynamicVariable(ln, {
          thisDep: v,
          contextDep: b,
          propDep: f,
          ref: h,
          append: n
        }), delete t.static[p];
      }
      function Ge(s, t, p, A, S) {
        var y = _e();
        y.stats = y.link(S), Object.keys(t.static).forEach(function(b) {
          ue(y, t, b);
        }), du.forEach(function(b) {
          ue(y, s, b);
        });
        var v = tt(s, t, p, A, y);
        return Ke(y, v), G(y, v), l(y, v), E(y.compile(), {
          destroy: function() {
            v.shader.program.destroy();
          }
        });
      }
      return {
        next: fe,
        current: z,
        procs: function() {
          var s = _e(), t = s.proc("poll"), p = s.proc("refresh"), A = s.block();
          t(A), p(A);
          var S = s.shared, y = S.gl, v = S.next, b = S.current;
          A(b, ".dirty=false;"), at(s, t), at(s, p, null, !0);
          var f;
          K && (f = s.link(K)), d.oes_vertex_array_object && p(s.link(d.oes_vertex_array_object), ".bindVertexArrayOES(null);");
          for (var h = 0; h < F.maxAttributes; ++h) {
            var n = p.def(S.attributes, "[", h, "]"), g = s.cond(n, ".buffer");
            g.then(
              y,
              ".enableVertexAttribArray(",
              h,
              ");",
              y,
              ".bindBuffer(",
              Ar,
              ",",
              n,
              ".buffer.buffer);",
              y,
              ".vertexAttribPointer(",
              h,
              ",",
              n,
              ".size,",
              n,
              ".type,",
              n,
              ".normalized,",
              n,
              ".stride,",
              n,
              ".offset);"
            ).else(
              y,
              ".disableVertexAttribArray(",
              h,
              ");",
              y,
              ".vertexAttrib4f(",
              h,
              ",",
              n,
              ".x,",
              n,
              ".y,",
              n,
              ".z,",
              n,
              ".w);",
              n,
              ".buffer=null;"
            ), p(g), K && p(
              f,
              ".vertexAttribDivisorANGLE(",
              h,
              ",",
              n,
              ".divisor);"
            );
          }
          return p(
            s.shared.vao,
            ".currentVAO=null;",
            s.shared.vao,
            ".setVAO(",
            s.shared.vao,
            ".targetVAO);"
          ), Object.keys(ne).forEach(function(L) {
            var I = ne[L], P = A.def(v, ".", L), k = s.block();
            k(
              "if(",
              P,
              "){",
              y,
              ".enable(",
              I,
              ")}else{",
              y,
              ".disable(",
              I,
              ")}",
              b,
              ".",
              L,
              "=",
              P,
              ";"
            ), p(k), t(
              "if(",
              P,
              "!==",
              b,
              ".",
              L,
              "){",
              k,
              "}"
            );
          }), Object.keys(j).forEach(function(L) {
            var I = j[L], P = z[L], k, q, me = s.block();
            if (me(y, ".", I, "("), Ye(P)) {
              var Ce = P.length;
              k = s.global.def(v, ".", L), q = s.global.def(b, ".", L), me(
                gt(Ce, function(de) {
                  return k + "[" + de + "]";
                }),
                ");",
                gt(Ce, function(de) {
                  return q + "[" + de + "]=" + k + "[" + de + "];";
                }).join("")
              ), t(
                "if(",
                gt(Ce, function(de) {
                  return k + "[" + de + "]!==" + q + "[" + de + "]";
                }).join("||"),
                "){",
                me,
                "}"
              );
            } else
              k = A.def(v, ".", L), q = A.def(b, ".", L), me(
                k,
                ");",
                b,
                ".",
                L,
                "=",
                k,
                ";"
              ), t(
                "if(",
                k,
                "!==",
                q,
                "){",
                me,
                "}"
              );
            p(me);
          }), s.compile();
        }(),
        compile: Ge
      };
    }
    function Gu() {
      return {
        vaoCount: 0,
        bufferCount: 0,
        elementsCount: 0,
        framebufferCount: 0,
        shaderCount: 0,
        textureCount: 0,
        cubeCount: 0,
        renderbufferCount: 0,
        maxTextureUnits: 0
      };
    }
    var Du = 34918, Mu = 34919, yo = 35007, Bu = function(e, r) {
      if (!r.ext_disjoint_timer_query)
        return null;
      var d = [];
      function F() {
        return d.pop() || r.ext_disjoint_timer_query.createQueryEXT();
      }
      function N(K) {
        d.push(K);
      }
      var O = [];
      function M(K) {
        var se = F();
        r.ext_disjoint_timer_query.beginQueryEXT(yo, se), O.push(se), H(O.length - 1, O.length, K);
      }
      function X() {
        r.ext_disjoint_timer_query.endQueryEXT(yo);
      }
      function W() {
        this.startQueryIndex = -1, this.endQueryIndex = -1, this.sum = 0, this.stats = null;
      }
      var Q = [];
      function Y() {
        return Q.pop() || new W();
      }
      function te(K) {
        Q.push(K);
      }
      var ie = [];
      function H(K, se, z) {
        var fe = Y();
        fe.startQueryIndex = K, fe.endQueryIndex = se, fe.sum = 0, fe.stats = z, ie.push(fe);
      }
      var re = [], w = [];
      function B() {
        var K, se, z = O.length;
        if (z !== 0) {
          w.length = Math.max(w.length, z + 1), re.length = Math.max(re.length, z + 1), re[0] = 0, w[0] = 0;
          var fe = 0;
          for (K = 0, se = 0; se < O.length; ++se) {
            var V = O[se];
            r.ext_disjoint_timer_query.getQueryObjectEXT(V, Mu) ? (fe += r.ext_disjoint_timer_query.getQueryObjectEXT(V, Du), N(V)) : O[K++] = V, re[se + 1] = fe, w[se + 1] = K;
          }
          for (O.length = K, K = 0, se = 0; se < ie.length; ++se) {
            var ne = ie[se], j = ne.startQueryIndex, ae = ne.endQueryIndex;
            ne.sum += re[ae] - re[j];
            var pe = w[j], ge = w[ae];
            ge === pe ? (ne.stats.gpuTime += ne.sum / 1e6, te(ne)) : (ne.startQueryIndex = pe, ne.endQueryIndex = ge, ie[K++] = ne);
          }
          ie.length = K;
        }
      }
      return {
        beginQuery: M,
        endQuery: X,
        pushScopeStats: H,
        update: B,
        getNumPendingQueries: function() {
          return O.length;
        },
        clear: function() {
          d.push.apply(d, O);
          for (var K = 0; K < d.length; K++)
            r.ext_disjoint_timer_query.deleteQueryEXT(d[K]);
          O.length = 0, d.length = 0;
        },
        restore: function() {
          O.length = 0, d.length = 0;
        }
      };
    }, ku = 16384, Iu = 256, Nu = 1024, Pu = 34962, _o = "webglcontextlost", bo = "webglcontextrestored", go = 1, Uu = 2, $u = 3;
    function xo(e, r) {
      for (var d = 0; d < e.length; ++d)
        if (e[d] === r)
          return d;
      return -1;
    }
    function zu(e) {
      var r = No(e);
      if (!r)
        return null;
      var d = r.gl, F = d.getContextAttributes(), N = d.isContextLost(), O = Po(d, r);
      if (!O)
        return null;
      var M = Do(), X = Gu(), W = O.extensions, Q = Bu(d, W), Y = Ra(), te = d.drawingBufferWidth, ie = d.drawingBufferHeight, H = {
        tick: 0,
        time: 0,
        viewportWidth: te,
        viewportHeight: ie,
        framebufferWidth: te,
        framebufferHeight: ie,
        drawingBufferWidth: te,
        drawingBufferHeight: ie,
        pixelRatio: r.pixelRatio
      }, re = {}, w = {
        elements: null,
        primitive: 4,
        // GL_TRIANGLES
        count: -1,
        offset: 0,
        instances: -1
      }, B = Ts(d, W), K = zs(
        d,
        X,
        r,
        z
      ), se = tu(
        d,
        W,
        B,
        X,
        K
      );
      function z(ve) {
        return se.destroyBuffer(ve);
      }
      var fe = ef(d, W, K, X), V = iu(d, M, X, r), ne = Gf(
        d,
        W,
        B,
        function() {
          pe.procs.poll();
        },
        H,
        X,
        r
      ), j = Df(d, W, B, X, r), ae = Jf(
        d,
        W,
        B,
        ne,
        j,
        X
      ), pe = Fu(
        d,
        M,
        W,
        B,
        K,
        fe,
        ne,
        ae,
        re,
        se,
        V,
        w,
        H,
        Q,
        r
      ), ge = fu(
        d,
        ae,
        pe.procs.poll,
        H,
        F,
        W,
        B
      ), oe = pe.next, Z = d.canvas, U = [], _e = [], Le = [], le = [r.onDestroy], Fe = null;
      function xe() {
        if (U.length === 0) {
          Q && Q.update(), Fe = null;
          return;
        }
        Fe = Ln.next(xe), dt();
        for (var ve = U.length - 1; ve >= 0; --ve) {
          var De = U[ve];
          De && De(H, null, 0);
        }
        d.flush(), Q && Q.update();
      }
      function Oe() {
        !Fe && U.length > 0 && (Fe = Ln.next(xe));
      }
      function $e() {
        Fe && (Ln.cancel(xe), Fe = null);
      }
      function et(ve) {
        ve.preventDefault(), N = !0, $e(), _e.forEach(function(De) {
          De();
        });
      }
      function ot(ve) {
        d.getError(), N = !1, O.restore(), V.restore(), K.restore(), ne.restore(), j.restore(), ae.restore(), se.restore(), Q && Q.restore(), pe.procs.refresh(), Oe(), Le.forEach(function(De) {
          De();
        });
      }
      Z && (Z.addEventListener(_o, et, !1), Z.addEventListener(bo, ot, !1));
      function Me() {
        U.length = 0, $e(), Z && (Z.removeEventListener(_o, et), Z.removeEventListener(bo, ot)), V.clear(), ae.clear(), j.clear(), ne.clear(), fe.clear(), K.clear(), se.clear(), Q && Q.clear(), le.forEach(function(ve) {
          ve();
        });
      }
      function rt(ve) {
        u(!!ve, "invalid args to regl({...})"), u.type(ve, "object", "invalid args to regl({...})");
        function De(S) {
          var y = E({}, S);
          delete y.uniforms, delete y.attributes, delete y.context, delete y.vao, "stencil" in y && y.stencil.op && (y.stencil.opBack = y.stencil.opFront = y.stencil.op, delete y.stencil.op);
          function v(b) {
            if (b in y) {
              var f = y[b];
              delete y[b], Object.keys(f).forEach(function(h) {
                y[b + "." + h] = f[h];
              });
            }
          }
          return v("blend"), v("depth"), v("cull"), v("stencil"), v("polygonOffset"), v("scissor"), v("sample"), "vao" in S && (y.vao = S.vao), y;
        }
        function Ne(S, y) {
          var v = {}, b = {};
          return Object.keys(S).forEach(function(f) {
            var h = S[f];
            if (Lt.isDynamic(h)) {
              b[f] = Lt.unbox(h, f);
              return;
            } else if (y && Array.isArray(h)) {
              for (var n = 0; n < h.length; ++n)
                if (Lt.isDynamic(h[n])) {
                  b[f] = Lt.unbox(h, f);
                  return;
                }
            }
            v[f] = h;
          }), {
            dynamic: b,
            static: v
          };
        }
        var Ke = Ne(ve.context || {}, !0), Nt = Ne(ve.uniforms || {}, !0), fr = Ne(ve.attributes || {}, !1), l = Ne(De(ve), !1), G = {
          gpuTime: 0,
          cpuTime: 0,
          count: 0
        }, R = pe.compile(l, fr, Nt, Ke, G), ue = R.draw, Ge = R.batch, s = R.scope, t = [];
        function p(S) {
          for (; t.length < S; )
            t.push(null);
          return t;
        }
        function A(S, y) {
          var v;
          if (N && u.raise("context lost"), typeof S == "function")
            return s.call(this, null, S, 0);
          if (typeof y == "function")
            if (typeof S == "number")
              for (v = 0; v < S; ++v)
                s.call(this, null, y, v);
            else if (Array.isArray(S))
              for (v = 0; v < S.length; ++v)
                s.call(this, S[v], y, v);
            else
              return s.call(this, S, y, 0);
          else if (typeof S == "number") {
            if (S > 0)
              return Ge.call(this, p(S | 0), S | 0);
          } else if (Array.isArray(S)) {
            if (S.length)
              return Ge.call(this, S, S.length);
          } else
            return ue.call(this, S);
        }
        return E(A, {
          stats: G,
          destroy: function() {
            R.destroy();
          }
        });
      }
      var Ve = ae.setFBO = rt({
        framebuffer: Lt.define.call(null, go, "framebuffer")
      });
      function tt(ve, De) {
        var Ne = 0;
        pe.procs.poll();
        var Ke = De.color;
        Ke && (d.clearColor(+Ke[0] || 0, +Ke[1] || 0, +Ke[2] || 0, +Ke[3] || 0), Ne |= ku), "depth" in De && (d.clearDepth(+De.depth), Ne |= Iu), "stencil" in De && (d.clearStencil(De.stencil | 0), Ne |= Nu), u(!!Ne, "called regl.clear with no buffer specified"), d.clear(Ne);
      }
      function nt(ve) {
        if (u(
          typeof ve == "object" && ve,
          "regl.clear() takes an object as input"
        ), "framebuffer" in ve)
          if (ve.framebuffer && ve.framebuffer_reglType === "framebufferCube")
            for (var De = 0; De < 6; ++De)
              Ve(E({
                framebuffer: ve.framebuffer.faces[De]
              }, ve), tt);
          else
            Ve(ve, tt);
        else
          tt(null, ve);
      }
      function at(ve) {
        u.type(ve, "function", "regl.frame() callback must be a function"), U.push(ve);
        function De() {
          var Ne = xo(U, ve);
          u(Ne >= 0, "cannot cancel a frame twice");
          function Ke() {
            var Nt = xo(U, Ke);
            U[Nt] = U[U.length - 1], U.length -= 1, U.length <= 0 && $e();
          }
          U[Ne] = Ke;
        }
        return Oe(), {
          cancel: De
        };
      }
      function ft() {
        var ve = oe.viewport, De = oe.scissor_box;
        ve[0] = ve[1] = De[0] = De[1] = 0, H.viewportWidth = H.framebufferWidth = H.drawingBufferWidth = ve[2] = De[2] = d.drawingBufferWidth, H.viewportHeight = H.framebufferHeight = H.drawingBufferHeight = ve[3] = De[3] = d.drawingBufferHeight;
      }
      function dt() {
        H.tick += 1, H.time = Re(), ft(), pe.procs.poll();
      }
      function qe() {
        ne.refresh(), ft(), pe.procs.refresh(), Q && Q.update();
      }
      function Re() {
        return (Ra() - Y) / 1e3;
      }
      qe();
      function ht(ve, De) {
        u.type(De, "function", "listener callback must be a function");
        var Ne;
        switch (ve) {
          case "frame":
            return at(De);
          case "lost":
            Ne = _e;
            break;
          case "restore":
            Ne = Le;
            break;
          case "destroy":
            Ne = le;
            break;
          default:
            u.raise("invalid event, must be one of frame,lost,restore,destroy");
        }
        return Ne.push(De), {
          cancel: function() {
            for (var Ke = 0; Ke < Ne.length; ++Ke)
              if (Ne[Ke] === De) {
                Ne[Ke] = Ne[Ne.length - 1], Ne.pop();
                return;
              }
          }
        };
      }
      var je = E(rt, {
        // Clear current FBO
        clear: nt,
        // Short cuts for dynamic variables
        prop: Lt.define.bind(null, go),
        context: Lt.define.bind(null, Uu),
        this: Lt.define.bind(null, $u),
        // executes an empty draw command
        draw: rt({}),
        // Resources
        buffer: function(ve) {
          return K.create(ve, Pu, !1, !1);
        },
        elements: function(ve) {
          return fe.create(ve, !1);
        },
        texture: ne.create2D,
        cube: ne.createCube,
        renderbuffer: j.create,
        framebuffer: ae.create,
        framebufferCube: ae.createCube,
        vao: se.createVAO,
        // Expose context attributes
        attributes: F,
        // Frame rendering
        frame: at,
        on: ht,
        // System limits
        limits: B,
        hasExtension: function(ve) {
          return B.extensions.indexOf(ve.toLowerCase()) >= 0;
        },
        // Read pixels
        read: ge,
        // Destroy regl and all associated resources
        destroy: Me,
        // Direct GL state manipulation
        _gl: d,
        _refresh: qe,
        poll: function() {
          dt(), Q && Q.update();
        },
        // Current time
        now: Re,
        // regl Statistics Information
        stats: X
      });
      return r.onDone(null, je), je;
    }
    return zu;
  });
})(regl$1);
var reglExports = regl$1.exports;
const regl = /* @__PURE__ */ getDefaultExportFromCjs(reglExports), Mouse = mouseListen();
class HydraRenderer {
  constructor({
    pb: c = null,
    width: m = 1280,
    height: E = 720,
    numSources: D = 4,
    numOutputs: J = 4,
    makeGlobal: Se = !0,
    autoLoop: he = !0,
    detectAudio: Ie = !0,
    enableStreamCapture: be = !0,
    canvas: vt,
    precision: He,
    extendTransforms: We = {}
    // add your own functions on init
  } = {}) {
    if (ArrayUtils.init(), this.pb = c, this.width = m, this.height = E, this.renderAll = !1, this.detectAudio = Ie, this._initCanvas(vt), global.window.test = "hi", this.synth = {
      time: 0,
      bpm: 30,
      width: this.width,
      height: this.height,
      fps: void 0,
      stats: {
        fps: 0
      },
      speed: 1,
      mouse: Mouse,
      render: this._render.bind(this),
      setResolution: this.setResolution.bind(this),
      update: (st) => {
      },
      // user defined update function
      hush: this.hush.bind(this),
      tick: this.tick.bind(this)
    }, Se && (window.loadScript = this.loadScript), this.timeSinceLastUpdate = 0, this._time = 0, He && ["lowp", "mediump", "highp"].includes(He.toLowerCase()))
      this.precision = He.toLowerCase();
    else {
      let st = (/iPad|iPhone|iPod/.test(navigator.platform) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) && !window.MSStream;
      this.precision = st ? "highp" : "mediump";
    }
    if (this.extendTransforms = We, this.saveFrame = !1, this.captureStream = null, this.generator = void 0, this._initRegl(), this._initOutputs(J), this._initSources(D), this._generateGlslTransforms(), this.synth.screencap = () => {
      this.saveFrame = !0;
    }, be)
      try {
        this.captureStream = this.canvas.captureStream(25), this.synth.vidRecorder = new VideoRecorder(this.captureStream);
      } catch (st) {
        console.warn(`[hydra-synth warning]
new MediaSource() is not currently supported on iOS.`), console.error(st);
      }
    Ie && this._initAudio(), he && loop(this.tick.bind(this)).start(), this.sandbox = new EvalSandbox(this.synth, Se, ["speed", "update", "bpm", "fps"]);
  }
  eval(c) {
    this.sandbox.eval(c);
  }
  getScreenImage(c) {
    this.imageCallback = c, this.saveFrame = !0;
  }
  hush() {
    this.s.forEach((c) => {
      c.clear();
    }), this.o.forEach((c) => {
      this.synth.solid(0, 0, 0, 0).out(c);
    }), this.synth.render(this.o[0]), this.sandbox.set("update", (c) => {
    });
  }
  loadScript(c = "") {
    return new Promise((E, D) => {
      var J = document.createElement("script");
      J.onload = function() {
        console.log(`loaded script ${c}`), E();
      }, J.onerror = (Se) => {
        console.log(`error loading script ${c}`, "log-error"), E();
      }, J.src = c, document.head.appendChild(J);
    });
  }
  setResolution(c, m) {
    this.canvas.width = c, this.canvas.height = m, this.width = c, this.height = m, this.sandbox.set("width", c), this.sandbox.set("height", m), console.log(this.width), this.o.forEach((E) => {
      E.resize(c, m);
    }), this.s.forEach((E) => {
      E.resize(c, m);
    }), this.regl._refresh(), console.log(this.canvas.width);
  }
  canvasToImage(c) {
    const m = document.createElement("a");
    m.style.display = "none";
    let E = /* @__PURE__ */ new Date();
    m.download = `hydra-${E.getFullYear()}-${E.getMonth() + 1}-${E.getDate()}-${E.getHours()}.${E.getMinutes()}.${E.getSeconds()}.png`, document.body.appendChild(m);
    var D = this;
    this.canvas.toBlob((J) => {
      D.imageCallback ? (D.imageCallback(J), delete D.imageCallback) : (m.href = URL.createObjectURL(J), console.log(m.href), m.click());
    }, "image/png"), setTimeout(() => {
      document.body.removeChild(m), window.URL.revokeObjectURL(m.href);
    }, 300);
  }
  _initAudio() {
    this.synth.a = new Audio({
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
  _initCanvas(c) {
    c ? (this.canvas = c, this.width = c.width, this.height = c.height) : (this.canvas = document.createElement("canvas"), this.canvas.width = this.width, this.canvas.height = this.height, this.canvas.style.width = "100%", this.canvas.style.height = "100%", this.canvas.style.imageRendering = "pixelated", document.body.appendChild(this.canvas));
  }
  _initRegl() {
    this.regl = regl({
      //  profile: true,
      canvas: this.canvas,
      pixelRatio: 1
      //,
      // extensions: [
      //   'oes_texture_half_float',
      //   'oes_texture_half_float_linear'
      // ],
      // optionalExtensions: [
      //   'oes_texture_float',
      //   'oes_texture_float_linear'
      //]
    }), this.regl.clear({
      color: [0, 0, 0, 1]
    }), this.renderAll = this.regl({
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
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop("tex0"),
        tex1: this.regl.prop("tex1"),
        tex2: this.regl.prop("tex2"),
        tex3: this.regl.prop("tex3")
      },
      count: 3,
      depth: { enable: !1 }
    }), this.renderFbo = this.regl({
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
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: this.regl.prop("tex0"),
        resolution: this.regl.prop("resolution")
      },
      count: 3,
      depth: { enable: !1 }
    });
  }
  _initOutputs(c) {
    const m = this;
    this.o = Array(c).fill().map((E, D) => {
      var J = new Output({
        regl: this.regl,
        width: this.width,
        height: this.height,
        precision: this.precision,
        label: `o${D}`
      });
      return J.id = D, m.synth["o" + D] = J, J;
    }), this.output = this.o[0];
  }
  _initSources(c) {
    this.s = [];
    for (var m = 0; m < c; m++)
      this.createSource(m);
  }
  createSource(c) {
    let m = new HydraSource({ regl: this.regl, pb: this.pb, width: this.width, height: this.height, label: `s${c}` });
    return this.synth["s" + this.s.length] = m, this.s.push(m), m;
  }
  _generateGlslTransforms() {
    var c = this;
    this.generator = new GeneratorFactory({
      defaultOutput: this.o[0],
      defaultUniforms: this.o[0].uniforms,
      extendTransforms: this.extendTransforms,
      changeListener: ({ type: m, method: E, synth: D }) => {
        m === "add" && (c.synth[E] = D.generators[E], c.sandbox && c.sandbox.add(E));
      }
    }), this.synth.setFunction = this.generator.setFunction.bind(this.generator);
  }
  _render(c) {
    c ? (this.output = c, this.isRenderingAll = !1) : this.isRenderingAll = !0;
  }
  // dt in ms
  tick(c, m) {
    if (this.sandbox.tick(), this.detectAudio === !0 && this.synth.a.tick(), this.sandbox.set("time", this.synth.time += c * 1e-3 * this.synth.speed), this.timeSinceLastUpdate += c, !this.synth.fps || this.timeSinceLastUpdate >= 1e3 / this.synth.fps) {
      if (this.synth.stats.fps = Math.ceil(1e3 / this.timeSinceLastUpdate), this.synth.update)
        try {
          this.synth.update(this.timeSinceLastUpdate);
        } catch (E) {
          console.log(E);
        }
      for (let E = 0; E < this.s.length; E++)
        this.s[E].tick(this.synth.time);
      for (let E = 0; E < this.o.length; E++)
        this.o[E].tick({
          time: this.synth.time,
          mouse: this.synth.mouse,
          bpm: this.synth.bpm,
          resolution: [this.canvas.width, this.canvas.height]
        });
      this.isRenderingAll ? this.renderAll({
        tex0: this.o[0].getCurrent(),
        tex1: this.o[1].getCurrent(),
        tex2: this.o[2].getCurrent(),
        tex3: this.o[3].getCurrent(),
        resolution: [this.canvas.width, this.canvas.height]
      }) : this.renderFbo({
        tex0: this.output.getCurrent(),
        resolution: [this.canvas.width, this.canvas.height]
      }), this.timeSinceLastUpdate = 0;
    }
    this.saveFrame === !0 && (this.canvasToImage(), this.saveFrame = !1);
  }
}
window.global || (window.global = window);
export {
  HydraRenderer as default
};
