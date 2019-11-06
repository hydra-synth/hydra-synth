// to add: ripple: https://www.shadertoy.com/view/4djGzz
// mask
// convolution
// basic sdf shapes
// repeat
// iq color palletes

module.exports = {

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
    }`
  },
  noise: {
    type: 'src',
    inputs: [
      { type: 'float', name: 'scale', default: 10 },
      { type: 'float', name: 'offset', default : 0.1 }
    ],
    description:
      'Generate [Perlin noise](https://en.wikipedia.org/wiki/Perlin_noise).',
    glsl: `vec4 noise(vec2 st, float scale, float offset){
      return vec4(vec3(_noise(vec3(st*scale, offset*time))), 1.0);
    }`,
    example: `
      // noise interpolating between different scales and offsets
      noise( ({time}) => Math.sin(time/10)*50 , ({time}) => Math.sin(time/2)/500 )
      .out(o0)`,
  },
  voronoi: {
    type: 'src',
    inputs: [
      { type: 'float', name: 'scale', default: 5 },
      { type: 'float', name: 'speed', default : 0.3 },
      { type: 'float', name: 'blending', default : 0.3 }
    ],
    description:
      'Generate [voronoi shapes](https://en.wikipedia.org/wiki/Voronoi_diagram).',
    notes: 'from https://thebookofshaders.com/edit.php#12/vorono-01.frag, https://www.shadertoy.com/view/ldB3zc',
    glsl: `vec4 voronoi(vec2 st, float scale, float speed, float blending) {
      vec3 color = vec3(.0);

      // Scale
      st *= scale;

      // Tile the space
      vec2 i_st = floor(st);
      vec2 f_st = fract(st);

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
       return vec4(color, 1.0);
    }`,
    example: `
      // default
      voronoi(5,0.3,0.3).out(o0)

      // fireflies
      voronoi(25,2,10).color(1,1,0).brightness(0.15).out(o0)`,
  },
  osc: {
    type: 'src',
    inputs: [
      { name: 'frequency', type: 'float', default: 60.0 },
      { name: 'sync', type: 'float', default: 0.1 },
      { name: 'offset', type: 'float', default: 0.0 }
    ],
    glsl: `vec4 osc(vec2 _st, float freq, float sync, float offset){
            vec2 st = _st;
            float r = sin((st.x-offset/freq+time*sync)*freq)*0.5  + 0.5;
            float g = sin((st.x+time*sync)*freq)*0.5 + 0.5;
            float b = sin((st.x+offset/freq+time*sync)*freq)*0.5  + 0.5;
            return vec4(r, g, b, 1.0);
          }`,
    example: `
      // frequency
      osc( [1,10,50,100,250,500].fast(2) ).out(o0)

      // frequency 2
      osc( ({time}) => Math.sin(time/10) * 100 ).out(o0)

      // sync
      osc( 10, [-10,-1,-0.1,0,0.1,1,10], 0 ).out(o0)

      // offset
      osc(10,0.1, ({time}) => Math.sin(time/10) * 100 ).out(o0)`,
  },
  shape: {
    type: 'src',
    inputs: [
      { name: 'sides', type: 'float', default: 3.0 },
      { name: 'radius', type: 'float', default: 0.3 },
      { name: 'smoothing', type: 'float', default: 0.01 }
    ],
    glsl: `vec4 shape(vec2 _st, float sides, float radius, float smoothing){
      vec2 st = _st * 2. - 1.;
      // Angle and radius from the current pixel
      float a = atan(st.x,st.y)+3.1416;
      float r = (2.*3.1416)/sides;
      float d = cos(floor(.5+a/r)*r-a)*length(st);
      return vec4(vec3(1.0-smoothstep(radius,radius + smoothing,d)), 1.0);
    }`,
    example: `
      // inverting blurry circle
      shape(100,0.01,1).invert(({time})=>Math.sin(time)*2).out(o0)

      // a... rainbow ball?
      shape(5,0.5,0.1).repeat(19,19)
        .mult(osc(10,1,2))
        .rotate( ({time}) => time%360 )
        .scrollX(1,-0.25)
        .mult(shape(15,0.3,0.01)
              .rotate( ({time}) => time%360 )
              .scrollX(1,-0.25))
        .out(o0)`,
  },
  gradient: {
    type: 'src',
    inputs: [
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    glsl: `vec4 gradient(vec2 _st, float speed) {
      return vec4(_st, sin(time*speed), 1.0);
    }`,
    example: `
      // gradient sequence at speeds of 1, 2 & 4
      gradient([1,2,4]).out(o0)`,
  },
  src: {
    type: 'src',
    inputs: [
      { name: 'tex', type: 'texture' }
    ],
    description:
      'See `hydra-examples` repository',
    glsl: `vec4 src(vec2 _st, sampler2D _tex){
      //  vec2 uv = gl_FragCoord.xy/vec2(1280., 720.);
      return texture2D(_tex, fract(_st));
    }`,
  },
  solid: {
    type: 'src',
    inputs: [
      { name: 'r', type: 'float', default: 0.0 },
      { name: 'g', type: 'float', default: 0.0 },
      { name: 'b', type: 'float', default: 0.0 },
      { name: 'a', type: 'float', default: 1.0 }
    ],
    notes: '',
    glsl: `vec4 solid(vec2 uv, float _r, float _g, float _b, float _a){
      return vec4(_r, _g, _b, _a);
    }`,
    example: `
      // cycling through red, green and blue
      solid([1,0,0],[0,1,0],[0,0,1],1).out(o0)`,
  },
  rotate: {
    type: 'coord',
    inputs: [
      { name: 'angle', type: 'float', default: 10.0 },
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    description:
      'Rotate texture.',
    glsl: `vec2 rotate(vec2 st, float _angle, float speed){
              vec2 xy = st - vec2(0.5);
              float angle = _angle + speed *time;
              xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
              xy += 0.5;
              return xy;
          }`,
    example: `
      osc(50).rotate( ({time}) => time%360 ).out(o0)

      osc(10,1,1)
        .rotate( ({time}) => time%360, ({time}) => Math.sin(time*0.1)*0.05 )
        .out(o0)`,
  },
  scale: {
    type: 'coord',
    inputs: [
      { name: 'amount', type: 'float', default: 1.5 },
      { name: 'xMult', type: 'float', default: 1.0 },
      { name: 'yMult', type: 'float', default: 1.0 },
      { name: 'offsetX', type: 'float', default: 0.5 },
      { name: 'offsetY', type: 'float', default: 0.5 }
    ],
    description:
      'Scale texture.',
    glsl: `vec2 scale(vec2 st, float amount, float xMult, float yMult, float offsetX, float offsetY){
      vec2 xy = st - vec2(offsetX, offsetY);
      xy*=(1.0/vec2(amount*xMult, amount*yMult));
      xy+=vec2(offsetX, offsetY);
      return xy;
    }`,
    example: `
      // default
      shape().scale(1.5,1,1).out()

      shape().scale(1.5,[0.25,0.5,0.75,1].fast(0.25),[3,2,1])
        .invert([0,1].fast(0.25))
        .kaleid(5)
        .kaleid(12)
        .scale( ({time})=>Math.sin(time/5)*0.5 )
        .rotate(1,1)
        .out(o0)`,
  },
  pixelate: {
    type: 'coord',
    inputs: [
      { name: 'pixelX', type: 'float', default: 20 },
      { name: 'pixelY', type: 'float', default: 20 }
    ],
    description:
      'Pixelate texture with `pixelX` segments and `pixelY` segments.',
    glsl: `vec2 pixelate(vec2 st, float pixelX, float pixelY){
      vec2 xy = vec2(pixelX, pixelY);
      return (floor(st * xy) + 0.5)/xy;
    }`,
    example: `
      // default
      noise().pixelate(20,20).out(o0)

      noise()
        .mult(osc(10,0.25,1))
        .scrollY(1,0.25)
        .pixelate([100,40,20,70].fast(0.25))
        .modulateRotate(src(o0).scale(0.5),0.125)
        .diff(src(o0).rotate([-0.05,0.05].fast(0.125)))
        .out(o0)`,
  },
  posterize: {
    type: 'color',
    inputs: [
      { name: 'bins', type: 'float', default: 3.0 },
      { name: 'gamma', type: 'float', default: 0.6 }
    ],
    glsl: `vec4 posterize(vec4 c, float bins, float gamma){
      vec4 c2 = pow(c, vec4(gamma));
      c2 *= vec4(bins);
      c2 = floor(c2);
      c2/= vec4(bins);
      c2 = pow(c2, vec4(1.0/gamma));
      return vec4(c2.xyz, c.a);
    }`,
    example: `
      // static gradient posterized, varying bins
      gradient(0).posterize( [1, 5, 15, 30] , 0.5 ).out(o0)

      // static gradient posterized, varying gamma
      gradient(0).posterize( 3, [0.1, 0.5, 1.0, 2.0] ).out(o0)`,
  },
  shift: {
    type: 'color',
    inputs: [
      { name: 'r', type: 'float', default: 0.5 },
      { name: 'g', type: 'float', default: 0.0 },
      { name: 'b', type: 'float', default: 0.0 },
      { name: 'a', type: 'float', default: 0.0 }
    ],
    glsl: `vec4 shift(vec4 c, float r, float g, float b, float a){
      vec4 c2 = vec4(c);
      c2.r = fract(c2.r + r);
      c2.g = fract(c2.g + g);
      c2.b = fract(c2.b + b);
      c2.a = fract(c2.a + a);
      return vec4(c2.rgba);
    }`,
  },
  repeat: {
    type: 'coord',
    inputs: [
      { name: 'repeatX', type: 'float', default: 3.0 },
      { name: 'repeatY', type: 'float', default: 3.0 },
      { name: 'offsetX', type: 'float', default: 0.0 },
      { name: 'offsetY', type: 'float', default: 0.0 }
    ],
    glsl: `vec2 repeat(vec2 _st, float repeatX, float repeatY, float offsetX, float offsetY){
        vec2 st = _st * vec2(repeatX, repeatY);
        st.x += step(1., mod(st.y,2.0)) * offsetX;
        st.y += step(1., mod(st.x,2.0)) * offsetY;
        return fract(st);
    }`,
    example: `
      // default
      shape().repeat(3.0, 3.0, 0.0, 0.0).out()

      // dogtooth factory
      shape(1.25,0.5,0.25)
        .repeat(3, 3)
        .scale(2)
        .repeat(5, 5, ({time}) => Math.sin(time), ({time}) => Math.sin(time/2))
        .out(o0)`,
  },
  modulateRepeat: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'repeatX', type: 'float', default: 3.0 },
      { name: 'repeatY', type: 'float', default: 3.0 },
      { name: 'offsetX', type: 'float', default: 0.5 },
      { name: 'offsetY', type: 'float', default: 0.5 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec2 modulateRepeat(vec2 _st, vec4 c1, float repeatX, float repeatY, float offsetX, float offsetY){
        vec2 st = _st * vec2(repeatX, repeatY);
        st.x += step(1., mod(st.y,2.0)) + c1.r * offsetX;
        st.y += step(1., mod(st.x,2.0)) + c1.g * offsetY;
        return fract(st);
    }`,
    example: `
      // default
      shape(4,0.9)
        .mult(osc(3,0.5,1))
        .modulateRepeat(osc(10), 3.0, 3.0, 0.5, 0.5)
        .out(o0)`,
  },
  repeatX: {
    type: 'coord',
    inputs: [
      { name: 'reps', type: 'float', default: 3.0 },
      { name: 'offset', type: 'float', default: 0.0 }
    ],
    glsl: `vec2 repeatX(vec2 _st, float reps, float offset){
      vec2 st = _st * vec2(reps, 1.0);
      //  float f =  mod(_st.y,2.0);

      st.y += step(1., mod(st.x,2.0))* offset;
      return fract(st);
    }`,
    example: `
      // default
      shape().repeatX(3.0, 0.0).out()

      osc(5,0,1)
        .rotate(1.57)
        .repeatX([1,2,5,10], ({time}) => Math.sin(time))
        .out()`,
  },
  modulateRepeatX: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'reps', type: 'float', default: 3.0 },
      { name: 'offset', type: 'float', default: 0.5 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec2 modulateRepeatX(vec2 _st, vec4 c1, float reps, float offset){
      vec2 st = _st * vec2(reps, 1.0);
      //  float f =  mod(_st.y,2.0);
      st.y += step(1., mod(st.x,2.0)) + c1.r * offset;

      return fract(st);
    }`,
    example: `
      // straight lines illusion
      shape(4,0.9)
        .mult(osc(4,0.25,1))
        .modulateRepeatX(osc(10), 5.0, ({time}) => Math.sin(time) * 5)
        .scale(1,0.5,0.05)
        .out(o0)`,
  },
  repeatY: {
    type: 'coord',
    inputs: [
      { name: 'reps', type: 'float', default: 3.0 },
      { name: 'offset', type: 'float', default: 0.0 }
    ],
    glsl: `vec2 repeatY(vec2 _st, float reps, float offset){
      vec2 st = _st * vec2(1.0, reps);
      //  float f =  mod(_st.y,2.0);
      st.x += step(1., mod(st.y,2.0))* offset;
      return fract(st);
    }`,
    example: `
      // default
      shape().repeatY(3.0, 0.0).out()

      osc(5,0,1)
        .repeatY([1,2,5,10], ({time}) => Math.sin(time))
        .out()`,
  },
  modulateRepeatY: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'reps', type: 'float', default: 3.0 },
      { name: 'offset', type: 'float', default: 0.5 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec2 modulateRepeatY(vec2 _st, vec4 c1, float reps, float offset){
      vec2 st = _st * vec2(reps, 1.0);
      //  float f =  mod(_st.y,2.0);
      st.x += step(1., mod(st.y,2.0)) + c1.r * offset;
      return fract(st);
    }`,
    example: `
      // morphing grid
      shape(4,0.9)
        .mult(osc(4,0.25,1))
        .modulateRepeatY(osc(10), 5.0, ({time}) => Math.sin(time) * 5)
        .scale(1,0.5,0.05)
        .out(o0)`,
  },
  kaleid: {
    type: 'coord',
    inputs: [
      { name: 'nSides', type: 'float', default: 4.0 }
    ],
    description:
      'Kaleidoscope effect with `nSides` repetition.',
    glsl: `vec2 kaleid(vec2 st, float nSides){
      st -= 0.5;
      float r = length(st);
      float a = atan(st.y, st.x);
      float pi = 2.*3.1416;
      a = mod(a,pi/nSides);
      a = abs(a-pi/nSides/2.);
      return r*vec2(cos(a), sin(a));
    }`,
    example: `osc(25,-0.1,0.5).kaleid(50).out(o0)`,
  },
  modulateKaleid: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'nSides', type: 'float', default: 4.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`kaleid\`](#kaleid).`,
    glsl: `vec2 modulateKaleid(vec2 st, vec4 c1, float nSides){
      st -= 0.5;
      float r = length(st);
      float a = atan(st.y, st.x);
      float pi = 2.*3.1416;
      a = mod(a,pi/nSides);
      a = abs(a-pi/nSides/2.);
      return (c1.r+r)*vec2(cos(a), sin(a));
    }`,
    example: `
      osc(9,-0.1,0.1)
        .modulateKaleid(osc(11,0.5,0),50)
        .scale(0.1,0.3)
        .modulate(noise(5,0.1))
        .mult(solid(1,1,0.3))
        .out(o0)`,
  },
  scrollX: {
    type: 'coord',
    inputs: [
      { name: 'scrollX', type: 'float', default: 0.5 },
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    glsl: `vec2 scrollX(vec2 st, float amount, float speed){
      st.x += amount + time*speed;
      return fract(st);
    }`,
    example: `
      // default
      osc(10,0,1).scrollX(0.5,0).out()

      // x position
      osc(10,0,1).scrollX([0,0.25,0.5,0.75,1].fast(4),0).out()

      // scroll speed
      gradient(1).scrollX(0, ({time}) => Math.sin(time*0.05)*0.05 ).out()

      gradient(0.125)
        .scrollX(0, ({time}) => Math.sin(time*0.05)*0.05 )
        .scrollY(0, ({time}) => Math.sin(time*0.01)*-0.07 )
        .pixelate([5,2,10],[15,8])
        .scale(0.15)
        .modulate(noise(1,0.25))
        .out()`,
  },
  modulateScrollX: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'scrollX', type: 'float', default: 0.5 },
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`scrollX\`](#scrollX)`,
    glsl: `vec2 modulateScrollX(vec2 st, vec4 c1, float amount, float speed){
      st.x += c1.r*amount + time*speed;
      return fract(st);
    }`,
    example: `
      // default
      voronoi(25,0,0)
        .modulateScrollX(osc(10),0.5,0)
        .out(o0)

      // different scroll and speed
      voronoi(25,0,0)
        .modulateScrollX(osc(10),0.5,0.25)
        .out(o0)`,
  },
  scrollY: {
    type: 'coord',
    inputs: [
      { name: 'scrollY', type: 'float', default: 0.5 },
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    glsl: `vec2 scrollY(vec2 st, float amount, float speed){
      st.y += amount + time*speed;
      return fract(st);
    }`,
    example: `
      // default
      osc(10,0,1).scrollY(0.5,0).out()

      // y position
      osc(10,0,1).scrollY([0,0.25,0.5,0.75,1].fast(4),0).out()

      // scroll speed
      gradient(1).scrollY(0, ({time}) => Math.sin(time*0.05)*0.05 ).out()

      gradient(0.125)
        .scrollX(0, ({time}) => Math.sin(time*0.05)*0.05 )
        .scrollY(0, ({time}) => Math.sin(time*0.01)*-0.07 )
        .pixelate([5,2,10],[15,8])
        .scale(0.15)
        .modulate(noise(1,0.25))
        .out()`,
  },
  modulateScrollY: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'scrollY', type: 'float', default: 0.5 },
      { name: 'speed', type: 'float', default: 0.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`scrollY\`](#scrollY)`,
    glsl: `vec2 modulateScrollY(vec2 st, vec4 c1, float amount, float speed){
      st.y += c1.r*amount + time*speed;
      return fract(st);
    }`,
    example: `
      // default
      voronoi(25,0,0)
        .modulateScrollY(osc(10),0.5,0)
        .out(o0)

      // different scroll and speed
      voronoi(25,0,0)
        .modulateScrollY(osc(10),0.5,0.25)
        .out(o0)`,
  },
  add: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'amount', type: 'float', default: 0.5 }
    ],
    description: `
      Add textures.

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec4 add(vec4 c0, vec4 c1, float amount){
            return (c0+c1)*amount + c0*(1.0-amount);
          }`,
    example: `
      shape().scale(0.5).add(shape(4),[0,0.25,0.5,0.75,1]).out()

      osc(9,0.1,1).add(osc(13,0.5,5)).out()`,
  },
  layer: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' }

    ],
    description:
      `Overlay texture based on alpha value.

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec4 layer(vec4 c0, vec4 c1){
        return vec4(mix(c0.rgb, c1.rgb, c1.a), c0.a+c1.a);
    }`,
    example: `solid(1,0,0,1).layer(shape(4).color(0,1,0,({time})=>Math.sin(time*2))).out()`,
  },
  blend: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'amount', type: 'float', default: 0.5 }
    ],
    description: `
      Blend textures.

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec4 blend(vec4 c0, vec4 c1, float amount){
      return c0*(1.0-amount)+c1*amount;
    }`,
    example: `
      shape().scale(0.5).blend(shape(4),[0,0.25,0.5,0.75,1]).out()

      osc(9,0.1,1).blend(osc(13,0.5,5)).out()`,
  },
  mult: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'amount', type: 'float', default: 1.0 }
    ],
    description: `
      Multiply images and blend with the texture by \`amount\`.

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec4 mult(vec4 c0, vec4 c1, float amount){
      return c0*(1.0-amount)+(c0*c1)*amount;
    }`,
    example: `osc(9,0.1,2).mult(osc(13,0.5,5)).out()`,
  },

  diff: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' }
    ],
    description: `
      Return difference of textures.

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec4 diff(vec4 c0, vec4 c1){
      return vec4(abs(c0.rgb-c1.rgb), max(c0.a, c1.a));
    }`,
    example: `
      osc(9,0.1,1).diff(osc(13,0.5,5)).out()

      osc(1,1,2)
        .diff(shape(6,1.1,0.01)
              .scale(({time})=>Math.sin(time)*0.05 + 0.9)
              .kaleid(15)
              .rotate(({time})=>time%360))
        .out()`,
  },

  modulate: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'amount', type: 'float', default: 0.1 }
    ],
    description: `
      Modulate texture.

      More about modulation at: <https://lumen-app.com/guide/modulation/>

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec2 modulate(vec2 st, vec4 c1, float amount){
          //  return fract(st+(c1.xy-0.5)*amount);
              return st + c1.xy*amount;
          }`,
    example: `
      // chocolate whirlpool
      voronoi()
        .color(0.9,0.25,0.15)
        .rotate(({time})=>(time%360)/2)
        .modulate(osc(25,0.1,0.5)
                    .kaleid(50)
                    .scale(({time})=>Math.sin(time*1)*0.5+1)
                    .modulate(noise(0.6,0.5)),
                    0.5)
        .out(o0)`,
  },
  modulateScale: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'multiple', type: 'float', default: 1.0 },
      { name: 'offset', type: 'float', default: 1.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`scale\`](#scale).`,
    glsl: `vec2 modulateScale(vec2 st, vec4 c1, float multiple, float offset){
      vec2 xy = st - vec2(0.5);
      xy*=(1.0/vec2(offset + multiple*c1.r, offset + multiple*c1.g));
      xy+=vec2(0.5);
      return xy;
    }`,
    example: `
      // cosmic radiation
      gradient(5).repeat(50,50).kaleid([3,5,7,9].fast(0.5))
        .modulateScale(osc(4,-0.5,0).kaleid(50).scale(0.5),15,0)
        .out(o0)`,
  },
  modulatePixelate: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'multiple', type: 'float', default: 10.0 },
      { name: 'offset', type: 'float', default: 3.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`pixelate\`](#pixelate)`,
    glsl: `vec2 modulatePixelate(vec2 st, vec4 c1, float multiple, float offset){
      vec2 xy = vec2(offset + c1.x*multiple, offset + c1.y*multiple);
      return (floor(st * xy) + 0.5)/xy;
    }`,
    example: `
      // what lies beneath
      voronoi(10,1,5).brightness(()=>Math.random()*0.15)
        .modulatePixelate(noise(25,0.5),100)
        .out(o0)`,
  },
  modulateRotate: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'multiple', type: 'float', default: 1.0 },
      { name: 'offset', type: 'float', default: 0.0 }
    ],
    description: `
      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).

      See also: [\`rotate\`](#rotate)`,
    glsl: `vec2 modulateRotate(vec2 st, vec4 c1, float multiple, float offset){
        vec2 xy = st - vec2(0.5);
        float angle = offset + c1.x * multiple;
        xy = mat2(cos(angle),-sin(angle), sin(angle),cos(angle))*xy;
        xy += 0.5;
        return xy;
    }`,
    example: `
      // wormhole
      voronoi(100,3,5)
        .modulateRotate(osc(1,0.5,0).kaleid(50).scale(0.5),15,0)
        .mult(osc(50,-0.1,8).kaleid(9))
        .out(o0)`,
  },
  modulateHue: {
    type: 'combineCoord',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'amount', type: 'float', default: 1.0 }
    ],
    description: `
      Changes coordinates based on hue of second input. Based on: https://www.shadertoy.com/view/XtcSWM

      The \`texture\` parameter can be any kind of [source](#sources), for
      example a [\`color\`](#color), [\`src\`](#src), or [\`shape\`](#shape).`,
    glsl: `vec2 modulateHue(vec2 st, vec4 c1, float amount){

            return st + (vec2(c1.g - c1.r, c1.b - c1.g) * amount * 1.0/resolution.xy);
          }`,
  },
  invert: {
    type: 'color',
    inputs: [
      { name: 'amount', type: 'float', default: 1.0 }
    ],
    description:
      'Invert color.',
    glsl: `vec4 invert(vec4 c0, float amount){
      return vec4((1.0-c0.rgb)*amount + c0.rgb*(1.0-amount), c0.a);
    }`,
    example: `solid(1,1,1).invert([0,1]).out(o0)`,
  },
  contrast: {
    type: 'color',
    inputs: [
      { name: 'amount', type: 'float', default: 1.6 }
    ],
    description:
      'Larger amount value makes higher contrast.',
    glsl: `vec4 contrast(vec4 c0, float amount) {
      vec4 c = (c0-vec4(0.5))*vec4(amount) + vec4(0.5);
      return vec4(c.rgb, c0.a);
    }`,
    example: `
      // 20Hz oscillator with contrast interpolating between 0.0-5.0
      osc(20).contrast( ({time}) => Math.sin(time) * 5 ).out(o0)`,
  },
  brightness: {
    type: 'color',
    inputs: [
      { name: 'amount', type: 'float', default: 0.4 }
    ],
    glsl: `vec4 brightness(vec4 c0, float amount){
      return vec4(c0.rgb + vec3(amount), c0.a);
    }`,
    example: `
      osc(20,0,2)
        .brightness( ({time}) => Math.sin(time) )
        .out(o0)`,
  },
  luminance: {
    type: 'util',
    glsl: `float luminance(vec3 rgb){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      return dot(rgb, W);
    }`,
  },
  mask: {
    type: 'combine',
    inputs: [
      { name: 'texture', type: 'vec4' },
      { name: 'reps', type: 'float', default: 3.0 },
      { name: 'offset', type: 'float', default: 0.5 },
    ],
    glsl: `vec4 mask(vec4 c0, vec4 c1){
      float a = luminance(c1.rgb);
      return vec4(c0.rgb*a, a);
    }`,
    example: `
      // default
      gradient(5).mask(voronoi(),3,0.5).invert([0,1]).out()

      // algae pulse
      osc(10,-0.25,1).color(0,0,1).saturate(2).kaleid(50)
        .mask(noise(25,2).modulateScale(noise(0.25,0.05)))
        .modulateScale(osc(6,-0.5,2).kaleid(50))
        .mult(osc(3,-0.25,2).kaleid(50))
        .scale(0.5,0.5,0.75)
        .out()`,
  },
  luma: {
    type: 'color',
    inputs: [
      { name: 'threshold', type: 'float', default: 0.5 },
      { name: 'tolerance', type: 'float', default: 0.1 }
    ],
    glsl: `vec4 luma(vec4 c0, float threshold, float tolerance){
      float a = smoothstep(threshold-tolerance, threshold+tolerance, luminance(c0.rgb));
      return vec4(c0.rgb*a, a);
    }`,
    example: `
      // default
      osc(10,0,1).luma(0.5,0.1).out(o0)

      osc(10,0,[0,0.5,1,2]).luma([0.1,0.25,0.75,1].fast(0.25),0.1).out(o0)`,
  },
  thresh: {
    type: 'color',
    inputs: [
      { name: 'threshold', type: 'float', default: 0.5 },
      { name: 'tolerance', type: 'float', default: 0.04 }
    ],
    glsl: `vec4 thresh(vec4 c0, float threshold, float tolerance){
      return vec4(vec3(smoothstep(threshold-tolerance, threshold+tolerance, luminance(c0.rgb))), c0.a);
    }`,
    example: `
      // default
      noise(3,0.1).thresh(0.5,0.04).out(o0)

      noise(3,0.1)
        .thresh( ({time})=>Math.sin(time/2) , [0.04,0.25,0.75,1].fast(0.25) )
        .out(o0)`,
  },
  color: {
    type: 'color',
    inputs: [
      { name: 'r', type: 'float', default: 1.0 },
      { name: 'g', type: 'float', default: 1.0 },
      { name: 'b', type: 'float', default: 1.0 },
      { name: 'a', type: 'float', default: 1.0 }
    ],
    notes: 'https://www.youtube.com/watch?v=FpOEtm9aX0M',
    glsl: `vec4 color(vec4 c0, float _r, float _g, float _b, float _a){
      vec4 c = vec4(_r, _g, _b, _a);
      vec4 pos = step(0.0, c); // detect whether negative

      // if > 0, return r * c0
      // if < 0 return (1.0-r) * c0
      return vec4(mix((1.0-c0)*abs(c), c*c0, pos));
    }`,
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
        }`,
  },
  _hsvToRgb: {
    type: 'util',
    glsl: `vec3 _hsvToRgb(vec3 c){
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }`,
  },
  saturate: {
    type: 'color',
    inputs: [
      { name: 'amount', type: 'float', default: 2.0 }
    ],
    glsl: `vec4 saturate(vec4 c0, float amount){
      const vec3 W = vec3(0.2125, 0.7154, 0.0721);
      vec3 intensity = vec3(dot(c0.rgb, W));
      return vec4(mix(intensity, c0.rgb, amount), c0.a);
    }`,
    example: `osc(10,0,1).saturate( ({time}) => Math.sin(time) * 10 ).out()`,
  },
  hue: {
    type: 'color',
    inputs: [
      { name: 'hue', type: 'float', default: 0.4 }
    ],
    glsl: `vec4 hue(vec4 c0, float hue){
      vec3 c = _rgbToHsv(c0.rgb);
      c.r += hue;
      //  c.r = fract(c.r);
      return vec4(_hsvToRgb(c), c0.a);
    }`,
  },
  colorama: {
    type: 'color',
    inputs: [
      { name: 'amount', type: 'float', default: 0.005 }
    ],
    description:
      'Shift HSV values.',
    glsl: `vec4 colorama(vec4 c0, float amount){
      vec3 c = _rgbToHsv(c0.rgb);
      c += vec3(amount);
      c = _hsvToRgb(c);
      c = fract(c);
      return vec4(c, c0.a);
    }`,
    example: `
      // 20Hz oscillator source
      // color sequence of Red, Green, Blue, White, Black
      // colorama sequence of 0.005, 0.5, 1.0 at 1/8 speed
      // output to buffer o0
      osc(20)
        .color([1,0,0,1,0],[0,1,0,1,0],[0,0,1,1,0])
        .colorama([0.005,0.33,0.66,1.0].fast(0.125))
        .out(o0)`,
  }
}
