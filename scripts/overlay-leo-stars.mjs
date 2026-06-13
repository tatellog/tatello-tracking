import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
const ART = new URL('../assets/zodiac-art/', import.meta.url)
const lion = readFileSync(new URL('leo-reveal/f10.png', ART)).toString('base64')
const W=290, PAD=18, SC=2.6
const T={tx:38,ty:42,sx:0.82,sy:0.82}
const LION_WFRAC=0.64, AR=1.2
const lionW=LION_WFRAC*W, lionH=lionW/AR
const lionX=0.5*W-lionW/2, lionY=0.5*W-lionH/2
// índice: 0 Regulus,1 Eta,2 Algieba,3 Adhafera,4 Rasalas,5 Epsilon,6 Chort,7 Zosma,8 Denebola
const stars=[
['Regulus(pecho)',0.22,0.50],['Eta(cuello)',0.26,0.31],['Algieba(lomo)',0.50,0.24],
['Adhafera(melena)',0.37,0.20],['Rasalas(corona)',0.25,0.15],['Epsilon(ojo)',0.15,0.35],
['Chort(cuartos)',0.70,0.32],['Zosma(pata)',0.66,0.58],['Denebola(cola)',0.84,0.20]]
// líneas que siguen la silueta
const lines=[[5,4],[4,3],[3,2],[2,6],[6,8],[5,1],[1,0],[0,7],[7,6]]
const pos=(sx,sy)=>({x:(T.tx+T.sx*(PAD+sx*(W-2*PAD)))*SC, y:(T.ty+T.sy*(PAD+sy*(W-2*PAD)))*SC})
const P=stars.map(s=>pos(s[1],s[2]))
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W*SC}" height="${W*SC}">
<rect width="${W*SC}" height="${W*SC}" fill="#1a0d14"/>
<image x="${lionX*SC}" y="${lionY*SC}" width="${lionW*SC}" height="${lionH*SC}" href="data:image/png;base64,${lion}"/>
<rect x="${lionX*SC}" y="${lionY*SC}" width="${lionW*SC}" height="${lionH*SC}" fill="none" stroke="#5BA8FF" stroke-width="0.7" stroke-dasharray="3 3"/>
${lines.map(([a,b])=>`<line x1="${P[a].x}" y1="${P[a].y}" x2="${P[b].x}" y2="${P[b].y}" stroke="#fff" stroke-width="1.4" opacity="0.55"/>`).join('')}
${P.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#FF4886"/><text x="${p.x+7}" y="${p.y+4}" font-family="Helvetica" font-size="11" fill="#fff">${stars[i][0]}</text>`).join('')}
</svg>`
writeFileSync('/tmp/leo-overlay.png', new Resvg(svg).render().asPng())
console.log('ok')
