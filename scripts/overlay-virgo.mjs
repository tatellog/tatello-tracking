import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
const ART = new URL('../assets/zodiac-art/', import.meta.url)
const lion = readFileSync(new URL('virgo-reveal/f10.png', ART)).toString('base64')
const W=290, PAD=18, SC=2.8, SCALE=0.9
const T={tx:44,ty:42,sx:0.76,sy:0.76}
const LION_WFRAC=0.63, LION_CX=0.5, LION_CY=0.46
const lionW=LION_WFRAC*W, lionH=lionW, lionX=LION_CX*W-lionW/2, lionY=LION_CY*W-lionH/2
const stars=[
[0,0.55,0.16],[1,0.72,0.31],[2,0.55,0.31],[3,0.52,0.43],[4,0.66,0.23],
[5,0.48,0.55],[6,0.58,0.67],[7,0.38,0.60],[8,0.36,0.76],[9,0.32,0.9],
[10,0.56,0.8],[11,0.62,0.9],[12,0.46,0.92]]
const lines=[[0,2],[2,4],[4,1],[2,3],[3,5],[5,7],[5,6],[7,8],[8,9],[6,10],[10,11],[10,12]]
const base=stars.map(([i,x,y])=>({i,bx:PAD+x*(W-2*PAD),by:PAD+y*(W-2*PAD)}))
const bcx=base.reduce((a,s)=>a+s.bx,0)/base.length, bcy=base.reduce((a,s)=>a+s.by,0)/base.length
const sx0=T.sx*SCALE, sy0=T.sy*SCALE
const tx0=T.tx+T.sx*bcx*(1-SCALE), ty0=T.ty+T.sy*bcy*(1-SCALE)
const P=base.map(s=>({x:(tx0+sx0*s.bx)*SC, y:(ty0+sy0*s.by)*SC, i:s.i}))
const find=i=>P.find(p=>p.i===i)
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W*SC}" height="${W*SC}">
<rect width="${W*SC}" height="${W*SC}" fill="#1a0d14"/>
<image x="${lionX*SC}" y="${lionY*SC}" width="${lionW*SC}" height="${lionH*SC}" href="data:image/png;base64,${lion}"/>
${lines.map(([a,b])=>{const A=find(a),B=find(b);return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#fff" stroke-width="1.3" opacity="0.6"/>`}).join('')}
${P.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#FF4886"/><text x="${p.x+8}" y="${p.y+4}" font-family="Helvetica" font-size="14" fill="#fff">${p.i}</text>`).join('')}
</svg>`
writeFileSync('/tmp/virgo.png', new Resvg(svg).render().asPng())
console.log('ok')
