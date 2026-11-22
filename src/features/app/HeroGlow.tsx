import { useEffect, useRef } from 'react'

// Generative hero from the v5 prototype: domain-warped glow in the theme colours (--h1, --h2, --h3),
// three layers of drifting particles, film grain. Capped at 30fps; a still frame under reduced
// motion; if WebGL isn't available the CSS gradient behind it shows instead.
const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FRAGMENT = `precision highp float;uniform vec2 R;uniform float T;uniform vec3 C1,C2,C3;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return s;}
float pts(vec2 uv,float sc,float sp,float t,vec2 dir){vec2 q=uv*sc+dir*t*sp;vec2 id=floor(q),f=fract(q)-.5;float r=h(id);vec2 o=(vec2(h(id+3.1),h(id+7.7))-.5)*.6;float d=length(f-o);float tw=.55+.45*sin(t*(.8+2.*r)+r*40.);return step(.55,r)*smoothstep(.06+.05*r,0.,d)*tw;}
void main(){vec2 uv=gl_FragCoord.xy/R;float a=R.x/R.y;vec2 p=vec2(uv.x*a,uv.y);float t=T;
vec3 base=mix(C1*.17,C2*.22,uv.y);vec3 gc=mix(C3,C2,.3),cc=mix(C3,vec3(1.),.5);
vec2 w=vec2(fbm(p*1.6+vec2(t*.05,-t*.03)),fbm(p*1.6+vec2(5.2-t*.04,1.3+t*.05)));
vec2 c=vec2(a*(.98+.02*sin(t*.11)),.34+.06*sin(t*.13));
vec2 q=p+(w-.5)*.55;float d=length((q-c)*vec2(.78,1.12));
float glow=exp(-d*2.3);float core=exp(-d*6.);
float wisp=fbm(p*2.2+vec2(-t*.06,t*.04)+w)*exp(-length((p-c-vec2(-.35,.2))*vec2(.6,1.))*2.2);
vec3 col=base+gc*(glow*.85+wisp*.4)+cc*core*.5;
float fall=smoothstep(.2,1.,length(uv-vec2(1.,.3)));col*=1.-.18*fall;
float pa=pts(uv*vec2(a,1.),9.,.12,t,vec2(-.4,.55))+.8*pts(uv*vec2(a,1.)+.37,16.,.08,t,vec2(-.25,.4))+.6*pts(uv*vec2(a,1.)+.81,26.,.06,t,vec2(-.15,.3));
col+=cc*pa*(.12+.9*glow)*.85;
float gr=(h(gl_FragCoord.xy+fract(t*7.)*61.)-.5)*.07;col+=gr;
gl_FragColor=vec4(col,1.);}`

/** Turn any CSS colour into [r, g, b] in 0..1 by painting one pixel. */
function cssColorToRgb(value: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return [0, 0, 0]
  ctx.canvas.width = ctx.canvas.height = 1
  ctx.fillStyle = '#000'
  ctx.fillStyle = value || '#000'
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

export function HeroGlow() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' })
    if (!canvas || !gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      canvas.style.display = 'none'
      return
    }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uR = gl.getUniformLocation(program, 'R')
    const uT = gl.getUniformLocation(program, 'T')
    const uC = [gl.getUniformLocation(program, 'C1'), gl.getUniformLocation(program, 'C2'), gl.getUniformLocation(program, 'C3')]

    let themeKey = ''
    const syncColours = () => {
      const cs = getComputedStyle(document.documentElement)
      const values = ['--h1', '--h2', '--h3'].map((k) => cs.getPropertyValue(k).trim())
      const key = values.join()
      if (key === themeKey) return
      themeKey = key
      values.forEach((v, i) => gl.uniform3fv(uC[i], cssColorToRgb(v)))
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let last = 0
    let frame = 0
    let raf = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (now - last < 33) return // 30fps cap
      last = now
      if (frame++ % 20 === 0) syncColours()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uR, w, h)
      gl.uniform1f(uT, reduced ? 12 : (now - start) / 1000 + 12)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (reduced) cancelAnimationFrame(raf)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <canvas ref={ref} className="glc" aria-hidden="true" />
}
