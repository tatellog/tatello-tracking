import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
const ART = new URL('../assets/zodiac-art/', import.meta.url)
const lion = readFileSync(new URL('escorpio-reveal/f10.png', ART)).toString('base64')
const W=290, PAD=18, SC=2.6, SCALE=0.9
const T={tx:46,ty:46,sx:0.76,sy:0.76}
const LION_WFRAC=0.63, LION_CX=0.5, LION_CY=0.46
const lionW=LION_WFRAC*W, lionH=lionW, lionX=LION_CX*W-lionW/2, lionY=LION_CY*W-lionH/2
const stars=[
[0,0.44,0.60],[1,0.20,0.60],[2,0.32,0.50],[3,0.45,0.49],[4,0.49,0.43],
[5,0.51,0.35],[6,0.54,0.27],[7,0.57,0.20],[8,0.51,0.15],[9,0.43,0.18]]
const lines=[[2,1],[2,0],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]]
const base=stars.map(([i,x,y])=>({i,bx:PAD+x*(W-2*PAD),by:PAD+y*(W-2*PAD)}))
const bcx=base.reduce((a,s)=>a+s.bx,0)/base.length, bcy=base.reduce((a,s)=>a+s.by,0)/base.length
const sx0=T.sx*SCALE, sy0=T.sy*SCALE
const tx0=T.tx+T.sx*bcx*(1-SCALE), ty0=T.ty+T.sy*bcy*(1-SCALE)
const P=base.map(s=>({x:(tx0+sx0*s.bx)*SC, y:(ty0+sy0*s.by)*SC, i:s.i}))
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W*SC}" height="${W*SC}">
<rect width="${W*SC}" height="${W*SC}" fill="#1a0d14"/>
<image x="${lionX*SC}" y="${lionY*SC}" width="${lionW*SC}" height="${lionH*SC}" href="data:image/png;base64,${lion}"/>
${lines.map(([a,b])=>{const A=P.find(p=>p.i===a),B=P.find(p=>p.i===b);return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#fff" stroke-width="1.3" opacity="0.55"/>`}).join('')}
${P.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#FF4886"/><text x="${p.x+8}" y="${p.y+4}" font-family="Helvetica" font-size="14" fill="#fff">${p.i}</text>`).join('')}
</svg>`
writeFileSync('/tmp/scorpio.png', new Resvg(svg).render().asPng())
console.log('ok')
