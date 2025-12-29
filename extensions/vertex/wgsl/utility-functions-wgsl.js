// functions that are only used within other functions

export default {
_mod: {
    type: 'util',
    wgsl: `fn _mod(x : f32, y: f32) -> f32 {
				return x - y * floor(x / y);
    }`
  },
_luminance: {
    type: 'util',
    wgsl: `fn _luminance(rgb : vec3<f32>) -> f32 {
      const  W = vec3<f32>(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`
  },
  _noise: {
    type: 'util',
    wgsl: `
  fn mod4v(x : vec4<f32>, y : f32) -> vec4<f32> {
  		return x - y * floor (x / y); // exact match for glsl
  		// return x % y; // wgsl uses trunc instead of floor.
  }

// vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  fn permute(xp :vec4<f32>)->vec4<f32> {
  		return  mod4v(((xp*34.0)+1.0)*xp, 289.0);
  	}

  fn taylorInvSqrt(r: vec4<f32>)->vec4<f32>{return 1.79284291400159 - 0.85373472095314 * r;}

  fn _noise(v: vec3<f32>)-> f32 {
    const  C = vec2<f32>(1.0/6.0, 1.0/3.0) ;
    const  D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

  // First corner
    var i : vec3<f32> = floor(v + dot(v, C.yyy) );
    let x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min( g.xyz, l.zxy );
    let i2 = max( g.xyz, l.zxy );

    //  x0 = x0 - 0. + 0.0 * C
    let x1 = x0 - i1 + 1.0 * C.xxx;
    let x2 = x0 - i2 + 2.0 * C.xxx;
    let x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
    i.x = i.x % 289.0;
    i.y = i.y % 289.0;
    i.z = i.z % 289.0;
    let p = permute( permute( permute(
               i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0 ));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
    let n_ = 1.0/7.0; // N=7
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_ );    // mod(j,N)

    let x = x_ *ns.x + ns.yyyy;
    let y = y_ *ns.x + ns.yyyy;
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4<f32>( x.xy, y.xy );
    let b1 = vec4<f32>( x.zw, y.zw );

    let s0 = floor(b0)*2.0 + 1.0;
    let s1 = floor(b1)*2.0 + 1.0;
    let sh = -step(h, vec4<f32>(0.0));

    let a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    let a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    var p0 = vec3<f32>(a0.xy,h.x);
    var p1 = vec3<f32>(a0.zw,h.y);
    var p2 = vec3<f32>(a1.xy,h.z);
    var p3 = vec3<f32>(a1.zw,h.w);

  //Normalise gradients
    let norm = taylorInvSqrt(vec4<f32>(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    var m = max(0.6 - vec4<f32>(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), vec4<f32>(0.0));
    m = m * m;

    return 42.0 * dot( m*m, vec4<f32>( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
  }`
  },


 _rgbToHsv: {
    type: 'util',
    wgsl: `fn _rgbToHsv(c: vec3<f32>) -> vec3<f32> {
            let K = vec4<f32>(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            let p = mix(vec4<f32>(c.bg, K.wz), vec4<f32>(c.gb, K.xy), step(c.b, c.g));
            let q = mix(vec4<f32>(p.xyw, c.r), vec4<f32>(c.r, p.yzx), step(p.x, c.r));

            let d = q.x - min(q.w, q.y);
            let e = 1.0e-10;
            return vec3<f32>(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }`
  },
 _hsvToRgb: {
    type: 'util',
    wgsl: `fn _hsvToRgb(c: vec3<f32>) -> vec3<f32> {
        let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        let p : vec3<f32> = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        let cv : vec3<f32> = p - K.xxx;
        let cvmin =  vec3<f32>(0.0, 0.0, 0.0);
        let cvmax =  vec3<f32>(1.0, 1.0, 1.0);
        return  vec3<f32> (c.z * mix(K.xxx, clamp(cv, cvmin, cvmax), c.y));
    }`
  }
}
