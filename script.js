/* =========================================================
   TEXT VIDEO GENERATOR STUDIO - CORE ENGINE
   ========================================================= */
(function(){
'use strict';

// ---------- STATE ----------
const State = {
  project: {
    title: 'Untitled Project',
    canvas: { w:1280, h:720 },
    fps: 30,
    duration: 5,
    background: {
      type:'solid', color:'#00ff66', opacity:100,
      grad1:'#00ff66', grad2:'#00b3ff', gradDir:'to right',
      anim:'none', animSpeed:50,
      image:null
    },
    filters: {
      brightness:100, contrast:100, darkness:0, blur:0,
      opacity:100, sepia:0, warmth:0, tint:0, hue:0
    },
    layers: [],
    activeLayerId: null,
    customTemplates: []
  },
  time: 0,
  playing: false,
  looping: false,
  tool: 'select',
  zoom: 60, // px per second
  snap: true,
  history: [],
  historyIdx: -1,
  lastSave: 0
};

let layerIdCounter = 1;
function newId(){ return 'L'+(layerIdCounter++); }

function createDefaultLayer(text='HELLO WORLD'){
  return {
    id: newId(),
    name: 'Text ' + layerIdCounter,
    type: 'text',
    text: text,
    x: State.project.canvas.w/2,
    y: State.project.canvas.h/2,
    rotation: 0,
    opacity: 100,
    font: 'Orbitron',
    fontSize: 72,
    letterSpacing: 0,
    lineHeight: 1.2,
    bold: false,
    italic: false,
    underline: false,
    uppercase: false,
    align: 'center',
    color: '#ffffff',
    useGradient: false,
    gradColor1: '#00ff66',
    gradColor2: '#00b3ff',
    gradDir: 'to right',
    bgColor: '#000000',
    bgEnabled: false,
    strokeW: 0,
    strokeColor: '#000000',
    shadowBlur: 0,
    shadowColor: '#000000',
    shadowX: 0,
    shadowY: 0,
    effect: 'none',
    animation: 'none',
    animDur: 1,
    animInt: 50,
    animDelay: 0,
    animEase: 'ease-out',
    animLoop: false,
    // timeline clip
    start: 0,
    end: 5,
    visible: true
  };
}

// ---------- DOM REFS ----------
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const canvas = $('#preview');
const ctx = canvas.getContext('2d');

// ---------- UTILS ----------
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function hexToRgb(h){const n=parseInt(h.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
function fmtTime(s){
  const m=Math.floor(s/60),sec=s%60;
  return String(m).padStart(2,'0')+':'+sec.toFixed(2).padStart(5,'0');
}

function toast(msg,type='info'){
  const wrap=$('#toastWrap');
  const el=document.createElement('div');
  el.className='toast '+type;
  el.textContent=msg;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(10px)';setTimeout(()=>el.remove(),300);},2500);
}

// ---------- EASING ----------
const Easing = {
  linear:t=>t,
  'ease-in':t=>t*t,
  'ease-out':t=>1-(1-t)*(1-t),
  'ease-in-out':t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
  bounce:t=>{
    const n=7.5625,d=2.75;
    if(t<1/d)return n*t*t;
    if(t<2/d)return n*(t-=1.5/d)*t+.75;
    if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;
    return n*(t-=2.625/d)*t+.984375;
  },
  elastic:t=>{
    if(t===0||t===1)return t;
    return Math.pow(2,-10*t)*Math.sin((t-0.075)*(2*Math.PI)/0.3)+1;
  }
};

// ---------- BACKGROUND RENDER ----------
function renderBackground(t){
  const bg=State.project.background;
  const w=canvas.width,h=canvas.height;
  ctx.save();
  ctx.globalAlpha=bg.opacity/100;

  if(bg.type==='image' && bg.image){
    const img=bg.image;
    const scale=Math.max(w/img.width,h/img.height);
    const iw=img.width*scale,ih=img.height*scale;
    ctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);
  } else if(bg.type==='gradient'){
    let grad;
    const anim=bg.anim;
    const speed=bg.animSpeed/100;
    const offset=(t*speed*0.5)%1;
    if(bg.gradDir==='radial'){
      grad=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)/1.5);
    } else {
      let x1=0,y1=0,x2=w,y2=h;
      if(bg.gradDir==='to right'){y1=y2=h/2;}
      else if(bg.gradDir==='to bottom'){x1=x2=w/2;}
      if(anim==='gradient-move'){
        const ox=Math.cos(offset*Math.PI*2)*w*0.3;
        const oy=Math.sin(offset*Math.PI*2)*h*0.3;
        x1+=ox;y1+=oy;x2+=ox;y2+=oy;
      }
      grad=ctx.createLinearGradient(x1,y1,x2,y2);
    }
    let c1=bg.grad1,c2=bg.grad2;
    if(anim==='shift'){
      const hue=(offset*360)%360;
      c1=shiftHue(c1,hue);c2=shiftHue(c2,hue);
    }
    grad.addColorStop(0,c1);grad.addColorStop(1,c2);
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,w,h);
  } else {
    let color=bg.color;
    if(bg.anim==='shift'){
      const speed=bg.animSpeed/100;
      const hue=((t*speed*60)%360);
      color=shiftHue(color,hue);
    }
    ctx.fillStyle=color;
    ctx.fillRect(0,0,w,h);
  }

  // BG animation overlays
  if(bg.anim==='pulse' && bg.type!=='gradient'){
    const speed=bg.animSpeed/100;
    const a=0.1+Math.abs(Math.sin(t*speed*2))*0.15;
    ctx.fillStyle=`rgba(255,255,255,${a})`;
    ctx.fillRect(0,0,w,h);
  }
  if(bg.anim==='rotate'){
    const speed=bg.animSpeed/100;
    ctx.save();
    ctx.translate(w/2,h/2);
    ctx.rotate(t*speed*0.5);
    ctx.translate(-w/2,-h/2);
    const grad=ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,'rgba(255,255,255,0.1)');
    grad.addColorStop(1,'rgba(0,0,0,0.1)');
    ctx.fillStyle=grad;
    ctx.fillRect(-w,-h,w*3,h*3);
    ctx.restore();
  }
  ctx.restore();
}

function shiftHue(hex,deg){
  const {r,g,b}=hexToRgb(hex);
  let [h,s,l]=rgbToHsl(r,g,b);
  h=(h+deg/360)%1;
  const [nr,ng,nb]=hslToRgb(h,s,l);
  return '#'+[nr,ng,nb].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
}
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}
  else{
    const d=max-min;
    s=l>.5?d/(2-max-min):d/(max+min);
    switch(max){
      case r:h=(g-b)/d+(g<b?6:0);break;
      case g:h=(b-r)/d+2;break;
      case b:h=(r-g)/d+4;break;
    }
    h/=6;
  }
  return [h,s,l];
}
function hslToRgb(h,s,l){
  let r,g,b;
  if(s===0){r=g=b=l;}
  else{
    const hue2rgb=(p,q,t)=>{
      if(t<0)t+=1;if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q=l<.5?l*(1+s):l+s-l*s;
    const p=2*l-q;
    r=hue2rgb(p,q,h+1/3);
    g=hue2rgb(p,q,h);
    b=hue2rgb(p,q,h-1/3);
  }
  return [r*255,g*255,b*255];
}

// ---------- TEXT RENDER ----------
function applyFilters(){
  const f=State.project.filters;
  const filters=[];
  filters.push(`brightness(${f.brightness}%)`);
  filters.push(`contrast(${f.contrast-(f.darkness*0.5)}%)`);
  if(f.blur>0)filters.push(`blur(${f.blur}px)`);
  if(f.sepia>0)filters.push(`sepia(${f.sepia}%)`);
  if(f.hue>0)filters.push(`hue-rotate(${f.hue}deg)`);
  ctx.filter=filters.join(' ')||'none';
  ctx.globalAlpha=f.opacity/100;
}

function renderLayer(layer, t){
  if(!layer.visible) return;
  const localT = t - layer.start;
  if(localT < 0 || t > layer.end) return;
  const clipDur = layer.end - layer.start;

  ctx.save();
  ctx.globalAlpha=(layer.opacity/100);

  // Animation transforms
  let ax=0,ay=0,ascale=1,arot=0,aopacity=1,ablur=0,askewX=0;
  let textOverride=null;
  const anim=layer.animation;
  const dur=layer.animDur||1;
  const delay=layer.animDelay||0;
  const intensity=(layer.animInt||50)/100;
  const ease=Easing[layer.animEase]||Easing['ease-out'];

  let progress=0;
  if(anim!=='none'){
    let at=localT-delay;
    if(layer.animLoop){
      at=at%dur;
      if(at<0)at+=dur;
      progress=clamp(at/dur,0,1);
    } else {
      progress=clamp(at/dur,0,1);
    }
    const ep=ease(progress);
    const I=intensity;

    switch(anim){
      case 'fade-in': aopacity=ep; break;
      case 'fade-out': aopacity=1-ep; break;
      case 'slide-left': ax=lerp(400*I,0,ep); break;
      case 'slide-right': ax=lerp(-400*I,0,ep); break;
      case 'slide-up': ay=lerp(300*I,0,ep); break;
      case 'slide-down': ay=lerp(-300*I,0,ep); break;
      case 'zoom-in': ascale=lerp(0.2,1,ep); aopacity=ep; break;
      case 'zoom-out': ascale=lerp(1.5,1,ep); break;
      case 'blur-in': ablur=lerp(30*I,0,ep); aopacity=ep; break;
      case 'blur-out': ablur=lerp(0,30*I,ep); aopacity=1-ep; break;
      case 'blur-reveal':
        ablur=lerp(20*I,0,ep);
        ax=lerp(-100*I,0,ep);
        aopacity=ep;
        break;
      case 'bounce':
        ascale=1+Math.sin(ep*Math.PI*3)*0.2*I*(1-ep);
        ay=Math.abs(Math.sin(ep*Math.PI*3))*-50*I*(1-ep);
        break;
      case 'typewriter':
        const full=layer.text||'';
        const n=Math.floor(full.length*ep);
        textOverride=full.substring(0,n)+(ep<1&&Math.floor(t*6)%2?'|':'');
        break;
      case 'pop':
        ascale=ep<0.6?lerp(0,1.2,ep/0.6):lerp(1.2,1,(ep-0.6)/0.4);
        aopacity=Math.min(1,ep*2);
        break;
      case 'pulse':
        ascale=1+Math.sin(t*4)*0.08*I;
        break;
      case 'shake':
        ax=Math.sin(t*30)*8*I*(1-ep);
        ay=Math.cos(t*25)*6*I*(1-ep);
        break;
      case 'wave':
        ay=Math.sin(t*3+layer.x*0.01)*20*I;
        arot=Math.sin(t*3+layer.x*0.01)*5*I;
        break;
      case 'rotate':
        arot=lerp(-360*I,0,ep);
        aopacity=ep;
        break;
      case 'flip':
        ascale=Math.cos(ep*Math.PI);
        aopacity=Math.abs(Math.cos(ep*Math.PI));
        break;
      case 'glitch':
        ax=(Math.random()-0.5)*20*I;
        ay=(Math.random()-0.5)*10*I;
        if(Math.random()<0.1)askewX=(Math.random()-0.5)*0.2;
        break;
      case 'scale':
        ascale=lerp(0.5,1.5,ep);
        break;
      case 'elastic':
        ascale=Easing.elastic(ep);
        break;
      case 'cinematic':
        ay=lerp(80*I,0,ep);
        aopacity=ep;
        ascale=lerp(0.95,1,ep);
        break;
      case 'fold':
        askewX=lerp(0.5*I,0,ep);
        aopacity=ep;
        break;
      case 'unfold':
        askewX=lerp(-0.5*I,0,ep);
        ascale=lerp(0.3,1,ep);
        break;
      case 'up-down':
        ay=lerp(-200*I,200*I,ep);
        break;
      case 'down-up':
        ay=lerp(200*I,-200*I,ep);
        break;
      case 'left-right':
        ax=lerp(-300*I,300*I,ep);
        break;
      case 'right-left':
        ax=lerp(300*I,-300*I,ep);
        break;
    }
  }

  ctx.translate(layer.x+ax, layer.y+ay);
  ctx.rotate((layer.rotation+arot)*Math.PI/180);
  ctx.scale(ascale,ascale);
  if(askewX)ctx.transform(1,0,askewX,1,0,0);
  ctx.globalAlpha*=aopacity;
  if(ablur>0)ctx.filter=`blur(${ablur}px)`;

  // Build text
  let displayText=textOverride!==null?textOverride:(layer.text||'');
  if(layer.uppercase)displayText=displayText.toUpperCase();

  const weight=layer.bold?'bold ':'';
  const style=layer.italic?'italic ':'';
  ctx.font=`${style}${weight}${layer.fontSize}px "${layer.font}", sans-serif`;
  ctx.textAlign=layer.align;
  ctx.textBaseline='middle';

  const lines=displayText.split('\n');
  const lineH=layer.fontSize*layer.lineHeight;
  const totalH=lines.length*lineH;
  const startY=-totalH/2+lineH/2;

  // Measure for bg
  let maxW=0;
  lines.forEach(l=>{
    let w=0;
    if(layer.letterSpacing!==0){
      for(const ch of l)w+=ctx.measureText(ch).width+layer.letterSpacing;
      w-=layer.letterSpacing;
    } else w=ctx.measureText(l).width;
    if(w>maxW)maxW=w;
  });

  // Background
  if(layer.bgEnabled){
    ctx.fillStyle=layer.bgColor;
    const pad=layer.fontSize*0.3;
    let bx=-maxW/2-pad;
    if(layer.align==='left')bx=-pad;
    else if(layer.align==='right')bx=-maxW-pad;
    ctx.fillRect(bx,startY-lineH/2,maxW+pad*2,totalH);
  }

  // Effect rendering
  const effect=layer.effect;
  const time=t;

  // Draw each line
  lines.forEach((line,i)=>{
    const y=startY+i*lineH;
    drawTextWithEffect(line,0,y,layer,effect,time,i,lines.length,maxW);
  });

  // Underline
  if(layer.underline){
    ctx.strokeStyle=typeof ctx.fillStyle==='string'?ctx.fillStyle:'#fff';
    ctx.lineWidth=Math.max(1,layer.fontSize/20);
    lines.forEach((line,i)=>{
      const y=startY+i*lineH+layer.fontSize*0.4;
      let w=ctx.measureText(line).width;
      let x=0;
      if(layer.align==='center')x=-w/2;
      else if(layer.align==='right')x=-w;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();
    });
  }

  ctx.restore();
}

function drawTextWithEffect(text,x,y,layer,effect,time,lineIdx,totalLines,maxW){
  ctx.save();

  // Setup shadow
  if(layer.shadowBlur>0){
    ctx.shadowBlur=layer.shadowBlur;
    ctx.shadowColor=layer.shadowColor;
    ctx.shadowOffsetX=layer.shadowX;
    ctx.shadowOffsetY=layer.shadowY;
  }

  // Fill style
  let fillStyle=layer.color;
  if(layer.useGradient){
    let grad;
    if(layer.gradDir==='radial'){
      grad=ctx.createRadialGradient(0,y,0,0,y,layer.fontSize);
    } else {
      let x1=-maxW/2,y1=y-layer.fontSize/2,x2=maxW/2,y2=y+layer.fontSize/2;
      if(layer.gradDir==='to right'){y1=y2=y;}
      else if(layer.gradDir==='to bottom'){x1=x2=0;}
      grad=ctx.createLinearGradient(x1,y1,x2,y2);
    }
    grad.addColorStop(0,layer.gradColor1);
    grad.addColorStop(1,layer.gradColor2);
    fillStyle=grad;
  }

  // Letter spacing helper
  const drawSpaced=(fn)=>{
    if(layer.letterSpacing===0){fn(text,x,y);return;}
    const align=layer.align;
    let totalW=0;
    for(const ch of text)totalW+=ctx.measureText(ch).width+layer.letterSpacing;
    totalW-=layer.letterSpacing;
    let cx=0;
    if(align==='center')cx=-totalW/2;
    else if(align==='right')cx=-totalW;
    for(const ch of text){
      const cw=ctx.measureText(ch).width;
      fn(ch,cx+cw/2,y);
      cx+=cw+layer.letterSpacing;
    }
  };

  switch(effect){
    case 'neon':
      ctx.shadowBlur=20+Math.sin(time*4)*5;
      ctx.shadowColor=layer.useGradient?layer.gradColor1:layer.color;
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      ctx.shadowBlur=40;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'glow':
      ctx.shadowBlur=30;
      ctx.shadowColor=layer.useGradient?layer.gradColor1:layer.color;
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'shadow':
      ctx.fillStyle='rgba(0,0,0,0.5)';
      drawSpaced((t,x,y)=>ctx.fillText(t,x+4,y+4));
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'liquid':
      for(let i=0;i<3;i++){
        ctx.fillStyle=fillStyle;
        ctx.globalAlpha=0.4;
        const off=Math.sin(time*2+i)*3;
        drawSpaced((t,x,y)=>ctx.fillText(t,x+off,y+off));
      }
      ctx.globalAlpha=1;
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'fire':
      for(let i=0;i<5;i++){
        const hue=(time*60+i*20)%360;
        ctx.fillStyle=`hsl(${hue},100%,50%)`;
        ctx.globalAlpha=0.3;
        drawSpaced((t,x,y)=>ctx.fillText(t,x+(Math.random()-0.5)*4,y-i*3));
      }
      ctx.globalAlpha=1;
      ctx.fillStyle='#fff';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'metallic':
      const mg=ctx.createLinearGradient(0,y-layer.fontSize/2,0,y+layer.fontSize/2);
      mg.addColorStop(0,'#e8e8e8');
      mg.addColorStop(0.5,'#888');
      mg.addColorStop(1,'#e8e8e8');
      ctx.fillStyle=mg;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      ctx.strokeStyle='#333';ctx.lineWidth=1;
      drawSpaced((t,x,y)=>ctx.strokeText(t,x,y));
      break;
    case 'glass':
      ctx.fillStyle='rgba(255,255,255,0.3)';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      ctx.strokeStyle='rgba(255,255,255,0.8)';
      ctx.lineWidth=2;
      drawSpaced((t,x,y)=>ctx.strokeText(t,x,y));
      break;
    case 'retro':
      ctx.fillStyle='#ff006e';
      drawSpaced((t,x,y)=>ctx.fillText(t,x+3,y+3));
      ctx.fillStyle='#ffbe0b';
      drawSpaced((t,x,y)=>ctx.fillText(t,x+1.5,y+1.5));
      ctx.fillStyle='#fff';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'glitch':
      const gOff=Math.sin(time*10)*4;
      ctx.fillStyle='#ff0040';
      ctx.globalAlpha=0.8;
      drawSpaced((t,x,y)=>ctx.fillText(t,x+gOff,y));
      ctx.fillStyle='#00ffff';
      drawSpaced((t,x,y)=>ctx.fillText(t,x-gOff,y));
      ctx.globalAlpha=1;
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'golden':
      const gg=ctx.createLinearGradient(0,y-layer.fontSize/2,0,y+layer.fontSize/2);
      gg.addColorStop(0,'#ffd700');
      gg.addColorStop(0.5,'#ffed4e');
      gg.addColorStop(1,'#b8860b');
      ctx.fillStyle=gg;
      ctx.shadowBlur=15;ctx.shadowColor='#ffd700';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'outline':
      ctx.strokeStyle=fillStyle;
      ctx.lineWidth=Math.max(2,layer.fontSize/15);
      drawSpaced((t,x,y)=>ctx.strokeText(t,x,y));
      break;
    case 'cyber':
      ctx.fillStyle='#00ffff';
      ctx.shadowBlur=10;ctx.shadowColor='#00ffff';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      ctx.strokeStyle='#ff00ff';ctx.lineWidth=1;
      drawSpaced((t,x,y)=>ctx.strokeText(t,x+2,y+2));
      break;
    case 'modern':
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'minimal':
      ctx.fillStyle=fillStyle;
      ctx.globalAlpha=0.9;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case '3dpop':
      for(let i=8;i>0;i--){
        ctx.fillStyle=`rgba(0,0,0,${0.15})`;
        drawSpaced((t,x,y)=>ctx.fillText(t,x+i,y+i));
      }
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    case 'comic':
      ctx.fillStyle='#000';
      drawSpaced((t,x,y)=>ctx.fillText(t,x+4,y+4));
      ctx.strokeStyle='#000';ctx.lineWidth=layer.fontSize/10;
      drawSpaced((t,x,y)=>ctx.strokeText(t,x,y));
      ctx.fillStyle='#ffeb3b';
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
      break;
    default:
      ctx.fillStyle=fillStyle;
      drawSpaced((t,x,y)=>ctx.fillText(t,x,y));
  }

  // Stroke
  if(layer.strokeW>0){
    ctx.shadowBlur=0;
    ctx.strokeStyle=layer.strokeColor;
    ctx.lineWidth=layer.strokeW;
    ctx.lineJoin='round';
    drawSpaced((t,x,y)=>ctx.strokeText(t,x,y));
  }

  ctx.restore();
}

// ---------- MAIN RENDER LOOP ----------
let lastFrameTime=0;
function render(timestamp=0){
  const dt=(timestamp-lastFrameTime)/1000;
  lastFrameTime=timestamp;

  if(State.playing){
    State.time+=dt;
    if(State.time>=State.project.duration){
      if(State.looping){State.time=0;}
      else{State.time=State.project.duration;State.playing=false;updatePlayBtn();}
    }
    updateTimeDisplay();
    updatePlayhead();
  }

  ctx.save();
  ctx.filter='none';
  ctx.globalAlpha=1;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  renderBackground(State.time);
  ctx.restore();

  applyFilters();
  // Sort layers by order (index)
  State.project.layers.forEach(l=>renderLayer(l,State.time));
  ctx.filter='none';
  ctx.globalAlpha=1;

  requestAnimationFrame(render);
}

// ---------- UI BINDINGS ----------
function bindRange(id,obj,key,fmt,suffix=''){
  const el=$('#'+id);
  const valEl=$('#'+id+'Val');
  if(!el)return;
  el.addEventListener('input',()=>{
    const v=parseFloat(el.value);
    if(obj)obj[key]=v;
    if(valEl)valEl.textContent=(fmt?fmt(v):v)+suffix;
    scheduleAutosave();
  });
  el.addEventListener('change',()=>{
    pushHistory();
  });
}

function bindColor(inputId,hexId,obj,key){
  const inp=$('#'+inputId);
  const hex=$('#'+hexId);
  if(!inp)return;
  inp.addEventListener('input',()=>{
    if(obj)obj[key]=inp.value;
    if(hex)hex.value=inp.value;
    scheduleAutosave();
  });
  inp.addEventListener('change',()=>{
    pushHistory();
  });
  if(hex){
    hex.addEventListener('change',()=>{
      inp.value=hex.value;
      if(obj)obj[key]=hex.value;
      scheduleAutosave();
      pushHistory();
    });
  }
}

function cloneProject(project) {
  const cloned = JSON.parse(JSON.stringify(project));
  if (project.background && project.background.image) {
    cloned.background.image = project.background.image;
  }
  return cloned;
}

function pushHistory() {
  if (State.historyIdx < State.history.length - 1) {
    State.history = State.history.slice(0, State.historyIdx + 1);
  }
  const cloned = cloneProject(State.project);
  State.history.push(cloned);
  if (State.history.length > 50) {
    State.history.shift();
  }
  State.historyIdx = State.history.length - 1;
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const undoBtn = $('#btnUndo');
  const redoBtn = $('#btnRedo');
  if (undoBtn) {
    const canUndo = State.historyIdx > 0;
    undoBtn.disabled = !canUndo;
    undoBtn.style.opacity = canUndo ? '1' : '0.4';
    undoBtn.style.pointerEvents = canUndo ? 'auto' : 'none';
  }
  if (redoBtn) {
    const canRedo = State.historyIdx < State.history.length - 1;
    redoBtn.disabled = !canRedo;
    redoBtn.style.opacity = canRedo ? '1' : '0.4';
    redoBtn.style.pointerEvents = canRedo ? 'auto' : 'none';
  }
}

function undo() {
  if (State.historyIdx > 0) {
    State.historyIdx--;
    State.project = cloneProject(State.history[State.historyIdx]);
    syncAllUI();
    renderLayersList();
    renderTimeline();
    updateTimeDisplay();
    updateUndoRedoButtons();
    scheduleAutosave();
    toast('Undo', 'info');
  }
}

function redo() {
  if (State.historyIdx < State.history.length - 1) {
    State.historyIdx++;
    State.project = cloneProject(State.history[State.historyIdx]);
    syncAllUI();
    renderLayersList();
    renderTimeline();
    updateTimeDisplay();
    updateUndoRedoButtons();
    scheduleAutosave();
    toast('Redo', 'info');
  }
}

function getActiveLayer(){
  return State.project.layers.find(l=>l.id===State.project.activeLayerId);
}

function setActiveLayer(id){
  State.project.activeLayerId=id;
  syncPanelFromLayer();
  renderLayersList();
  renderTimeline();
}

function syncPanelFromLayer(){
  const L=getActiveLayer();
  if(!L){
    // disable fields
    $$('#panel .input, #panel .select, #panel textarea, #panel input[type=range]').forEach(e=>e.disabled=true);
    $('#textContent').value='';
    $('#fontSize').value=72;$('#fontSizeVal').textContent='-';
    $('#letterSpacing').value=0;$('#letterSpacingVal').textContent='-';
    $('#lineHeight').value=1.2;$('#lineHeightVal').textContent='-';
    $('#textColor').value='#ffffff';$('#textColorHex').value='#ffffff';
    $('#useGradient').checked=false;
    $('#gradientFields').style.display='none';
    $('#textBgOn').checked=false;
    $('#strokeW').value=0;$('#strokeWVal').textContent='-';
    $('#shadowBlur').value=0;$('#shadowBlurVal').textContent='-';
    $('#shadowX').value=0;$('#shadowXVal').textContent='-';
    $('#shadowY').value=0;$('#shadowYVal').textContent='-';
    $('#posX').value=640;$('#posXVal').textContent='-';
    $('#posY').value=360;$('#posYVal').textContent='-';
    $('#rotation').value=0;$('#rotVal').textContent='-';
    $('#opacity').value=100;$('#opacityVal').textContent='-';
    $('#animDur').value=1;$('#animDurVal').textContent='-';
    $('#animInt').value=50;$('#animIntVal').textContent='-';
    $('#animDelay').value=0;$('#animDelayVal').textContent='-';
    $('#boldBtn').classList.remove('active');
    $('#italicBtn').classList.remove('active');
    $('#underlineBtn').classList.remove('active');
    $('#upperBtn').classList.remove('active');
    $$('[data-align]').forEach(b=>b.classList.remove('active'));
    $$('#effectTemplates .tpl-card').forEach(c=>c.classList.remove('active'));
    $$('#animTemplates .tpl-card').forEach(c=>c.classList.remove('active'));
    return;
  }
  $$('#panel .input, #panel .select, #panel textarea, #panel input[type=range]').forEach(e=>e.disabled=false);
  $('#textContent').value=L.text;
  $('#fontFamily').value=L.font;
  $('#fontSize').value=L.fontSize;$('#fontSizeVal').textContent=L.fontSize;
  $('#letterSpacing').value=L.letterSpacing;$('#letterSpacingVal').textContent=L.letterSpacing;
  $('#lineHeight').value=L.lineHeight;$('#lineHeightVal').textContent=L.lineHeight;
  $('#boldBtn').classList.toggle('active',L.bold);
  $('#italicBtn').classList.toggle('active',L.italic);
  $('#underlineBtn').classList.toggle('active',L.underline);
  $('#upperBtn').classList.toggle('active',L.uppercase);
  $$('[data-align]').forEach(b=>b.classList.toggle('active',b.dataset.align===L.align));
  $('#textColor').value=L.color;$('#textColorHex').value=L.color;
  $('#useGradient').checked=L.useGradient;
  $('#gradientFields').style.display=L.useGradient?'block':'none';
  $('#gradColor1').value=L.gradColor1;
  $('#gradColor2').value=L.gradColor2;
  $('#gradDir').value=L.gradDir;
  $('#textBg').value=L.bgColor;
  $('#textBgOn').checked=L.bgEnabled;
  $('#strokeW').value=L.strokeW;$('#strokeWVal').textContent=L.strokeW;
  $('#strokeColor').value=L.strokeColor;
  $('#shadowBlur').value=L.shadowBlur;$('#shadowBlurVal').textContent=L.shadowBlur;
  $('#shadowColor').value=L.shadowColor;
  $('#shadowX').value=L.shadowX;$('#shadowXVal').textContent=L.shadowX;
  $('#shadowY').value=L.shadowY;$('#shadowYVal').textContent=L.shadowY;
  $('#posX').value=L.x;$('#posXVal').textContent=Math.round(L.x);
  $('#posY').value=L.y;$('#posYVal').textContent=Math.round(L.y);
  $('#rotation').value=L.rotation;$('#rotVal').textContent=L.rotation+'°';
  $('#opacity').value=L.opacity;$('#opacityVal').textContent=L.opacity+'%';
  // effects
  $$('#effectTemplates .tpl-card').forEach(c=>c.classList.toggle('active',c.dataset.effect===L.effect));
  // animation
  $$('#animTemplates .tpl-card').forEach(c=>c.classList.toggle('active',c.dataset.anim===L.animation));
  $('#animDur').value=L.animDur;$('#animDurVal').textContent=L.animDur.toFixed(1);
  $('#animInt').value=L.animInt;$('#animIntVal').textContent=L.animInt+'%';
  $('#animDelay').value=L.animDelay;$('#animDelayVal').textContent=L.animDelay.toFixed(1);
  $('#animEase').value=L.animEase;
  $('#animLoop').checked=L.animLoop;
}

function bindLayerField(id,key,parse=parseFloat){
  const el=$('#'+id);
  if(!el)return;
  el.addEventListener('input',()=>{
    const L=getActiveLayer();if(!L)return;
    L[key]=parse(el.value);
    syncPanelFromLayer();
    scheduleAutosave();
  });
  el.addEventListener('change',()=>{
    pushHistory();
  });
}

// ---------- CANVAS INTERACTION ----------
let dragState=null;
function canvasPoint(e){
  const rect=canvas.getBoundingClientRect();
  const cx=(e.clientX??e.touches?.[0]?.clientX)-rect.left;
  const cy=(e.clientY??e.touches?.[0]?.clientY)-rect.top;
  const x=cx*(canvas.width/rect.width);
  const y=cy*(canvas.height/rect.height);
  return {x,y};
}

function hitTest(pt){
  // Reverse order (top layers first)
  for(let i=State.project.layers.length-1;i>=0;i--){
    const L=State.project.layers[i];
    if(!L.visible)continue;
    if(State.time<L.start||State.time>L.end)continue;
    // Bounding box approximation
    ctx.save();
    const weight=L.bold?'bold ':'';
    const style=L.italic?'italic ':'';
    ctx.font=`${style}${weight}${L.fontSize}px "${L.font}", sans-serif`;
    const lines=(L.text||'').split('\n');
    let maxW=0;
    lines.forEach(ln=>{const m=ctx.measureText(ln).width;if(m>maxW)maxW=m;});
    const h=lines.length*L.fontSize*L.lineHeight;
    ctx.restore();
    // Simple AABB (ignoring rotation for simplicity)
    const dx=pt.x-L.x,dy=pt.y-L.y;
    const rad=-L.rotation*Math.PI/180;
    const rx=dx*Math.cos(rad)-dy*Math.sin(rad);
    const ry=dx*Math.sin(rad)+dy*Math.cos(rad);
    if(Math.abs(rx)<=maxW/2+20 && Math.abs(ry)<=h/2+20) return L;
  }
  return null;
}

function onPointerDown(e){
  e.preventDefault();
  const pt=canvasPoint(e);
  if(State.tool==='text'){
    const L=createDefaultLayer('NEW TEXT');
    L.x=pt.x;L.y=pt.y;
    State.project.layers.push(L);
    setActiveLayer(L.id);
    State.tool='select';
    $$('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool==='select'));
    pushHistory();
    renderLayersList();renderTimeline();
    toast('Text layer added','success');
    return;
  }
  const hit=hitTest(pt);
  if(hit){
    setActiveLayer(hit.id);
    dragState={type:'move',layer:hit,startX:pt.x,startY:pt.y,origX:hit.x,origY:hit.y};
  } else {
    setActiveLayer(null);
  }
}
function onPointerMove(e){
  if(!dragState)return;
  e.preventDefault();
  const pt=canvasPoint(e);
  if(dragState.type==='move'){
    dragState.layer.x=dragState.origX+(pt.x-dragState.startX);
    dragState.layer.y=dragState.origY+(pt.y-dragState.startY);
    $('#posX').value=Math.round(dragState.layer.x);$('#posXVal').textContent=Math.round(dragState.layer.x);
    $('#posY').value=Math.round(dragState.layer.y);$('#posYVal').textContent=Math.round(dragState.layer.y);
  }
}
function onPointerUp(){
  if(dragState){
    dragState=null;
    pushHistory();
  }
}

canvas.addEventListener('mousedown',onPointerDown);
canvas.addEventListener('mousemove',onPointerMove);
window.addEventListener('mouseup',onPointerUp);
canvas.addEventListener('touchstart',onPointerDown,{passive:false});
canvas.addEventListener('touchmove',onPointerMove,{passive:false});
canvas.addEventListener('touchend',onPointerUp);

// Double click to edit text
canvas.addEventListener('dblclick',(e)=>{
  const pt=canvasPoint(e);
  const hit=hitTest(pt);
  if(hit){
    setActiveLayer(hit.id);
    $('#textContent').focus();
    $('#textContent').select();
    // switch to text tab
    switchTab('text');
  }
});

// ---------- TABS ----------
function switchTab(name){
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  $$('.panel-section').forEach(s=>s.classList.toggle('active',s.dataset.section===name));
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));

// ---------- TOOLBAR ----------
$$('.tool-btn[data-tool]').forEach(b=>{
  b.addEventListener('click',()=>{
    State.tool=b.dataset.tool;
    $$('.tool-btn[data-tool]').forEach(x=>x.classList.toggle('active',x===b));
  });
});
$('#btnAddLayer').addEventListener('click',()=>{
  const L=createDefaultLayer('NEW TEXT');
  L.end=State.project.duration;
  State.project.layers.push(L);
  setActiveLayer(L.id);
  pushHistory();
  renderLayersList();renderTimeline();
  toast('Layer added','success');
});
$('#btnDuplicate').addEventListener('click',()=>{
  const L=getActiveLayer();if(!L)return;
  const copy=JSON.parse(JSON.stringify(L));
  copy.id=newId();copy.name=L.name+' copy';
  copy.x+=30;copy.y+=30;
  State.project.layers.push(copy);
  setActiveLayer(copy.id);
  pushHistory();
  renderLayersList();renderTimeline();
  toast('Layer duplicated','success');
});
$('#btnDelete').addEventListener('click',()=>{
  const L=getActiveLayer();if(!L)return;
  const index=State.project.layers.indexOf(L);
  State.project.layers=State.project.layers.filter(x=>x.id!==L.id);
  if(State.project.layers.length > 0){
    const nextActiveIndex = Math.min(index, State.project.layers.length - 1);
    setActiveLayer(State.project.layers[nextActiveIndex].id);
  } else {
    setActiveLayer(null);
  }
  pushHistory();
  renderLayersList();renderTimeline();
  toast('Layer deleted','info');
});

// ---------- TEXT FIELDS ----------
$('#textContent').addEventListener('input',e=>{const L=getActiveLayer();if(L){L.text=e.target.value;scheduleAutosave();}});
$('#textContent').addEventListener('change',()=>{pushHistory();});
$('#fontFamily').addEventListener('change',e=>{const L=getActiveLayer();if(L){L.font=e.target.value;scheduleAutosave();pushHistory();}});
bindLayerField('fontSize','fontSize',parseInt);
bindLayerField('letterSpacing','letterSpacing',parseInt);
bindLayerField('lineHeight','lineHeight',parseFloat);
$('#boldBtn').addEventListener('click',()=>{const L=getActiveLayer();if(!L)return;L.bold=!L.bold;$('#boldBtn').classList.toggle('active',L.bold);pushHistory();});
$('#italicBtn').addEventListener('click',()=>{const L=getActiveLayer();if(!L)return;L.italic=!L.italic;$('#italicBtn').classList.toggle('active',L.italic);pushHistory();});
$('#underlineBtn').addEventListener('click',()=>{const L=getActiveLayer();if(!L)return;L.underline=!L.underline;$('#underlineBtn').classList.toggle('active',L.underline);pushHistory();});
$('#upperBtn').addEventListener('click',()=>{const L=getActiveLayer();if(!L)return;L.uppercase=!L.uppercase;$('#upperBtn').classList.toggle('active',L.uppercase);pushHistory();});
$$('[data-align]').forEach(b=>b.addEventListener('click',()=>{
  const L=getActiveLayer();if(!L)return;
  L.align=b.dataset.align;
  $$('[data-align]').forEach(x=>x.classList.toggle('active',x===b));
  pushHistory();
}));
$('#textColor').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.color=e.target.value;$('#textColorHex').value=e.target.value;scheduleAutosave();});
$('#textColor').addEventListener('change',()=>{pushHistory();});
$('#textColorHex').addEventListener('change',e=>{const L=getActiveLayer();if(L)L.color=e.target.value;$('#textColor').value=e.target.value;scheduleAutosave();pushHistory();});
$('#useGradient').addEventListener('change',e=>{
  const L=getActiveLayer();if(!L)return;
  L.useGradient=e.target.checked;
  $('#gradientFields').style.display=e.target.checked?'block':'none';
  pushHistory();
});
$('#gradColor1').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.gradColor1=e.target.value;});
$('#gradColor1').addEventListener('change',()=>{pushHistory();});
$('#gradColor2').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.gradColor2=e.target.value;});
$('#gradColor2').addEventListener('change',()=>{pushHistory();});
$('#gradDir').addEventListener('change',e=>{const L=getActiveLayer();if(L)L.gradDir=e.target.value;pushHistory();});
$('#textBg').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.bgColor=e.target.value;});
$('#textBg').addEventListener('change',()=>{pushHistory();});
$('#textBgOn').addEventListener('change',e=>{const L=getActiveLayer();if(L)L.bgEnabled=e.target.checked;pushHistory();});
bindLayerField('strokeW','strokeW',parseInt);
$('#strokeColor').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.strokeColor=e.target.value;});
$('#strokeColor').addEventListener('change',()=>{pushHistory();});
bindLayerField('shadowBlur','shadowBlur',parseInt);
$('#shadowColor').addEventListener('input',e=>{const L=getActiveLayer();if(L)L.shadowColor=e.target.value;});
$('#shadowColor').addEventListener('change',()=>{pushHistory();});
bindLayerField('shadowX','shadowX',parseInt);
bindLayerField('shadowY','shadowY',parseInt);
bindLayerField('posX','x',parseFloat);
bindLayerField('posY','y',parseFloat);
bindLayerField('rotation','rotation',parseFloat);
bindLayerField('opacity','opacity',parseFloat);

// Import font
$('#btnImportFont').addEventListener('click',()=>{
  const name=$('#importFontName').value.trim();
  if(!name)return toast('Enter font name','error');
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`https://fonts.googleapis.com/css2?family=${name.replace(/\s+/g,'+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
  const opt=document.createElement('option');
  opt.value=name;opt.textContent=name;
  $('#fontFamily').appendChild(opt);
  toast('Font imported: '+name,'success');
});

// ---------- EFFECTS ----------
$$('#effectTemplates .tpl-card').forEach(c=>{
  c.addEventListener('click',()=>{
    const L=getActiveLayer();if(!L)return;
    L.effect=c.dataset.effect;
    $$('#effectTemplates .tpl-card').forEach(x=>x.classList.toggle('active',x===c));
    scheduleAutosave();
  });
});

// ---------- ANIMATIONS ----------
$$('#animTemplates .tpl-card').forEach(c=>{
  c.addEventListener('click',()=>{
    const L=getActiveLayer();if(!L)return;
    L.animation=c.dataset.anim;
    $$('#animTemplates .tpl-card').forEach(x=>x.classList.toggle('active',x===c));
    pushHistory();
    scheduleAutosave();
  });
});
$('#animDur').addEventListener('input',e=>{const L=getActiveLayer();if(L){L.animDur=parseFloat(e.target.value);$('#animDurVal').textContent=L.animDur.toFixed(1);}});
$('#animDur').addEventListener('change',()=>{pushHistory();});
$('#animInt').addEventListener('input',e=>{const L=getActiveLayer();if(L){L.animInt=parseInt(e.target.value);$('#animIntVal').textContent=L.animInt+'%';}});
$('#animInt').addEventListener('change',()=>{pushHistory();});
$('#animDelay').addEventListener('input',e=>{const L=getActiveLayer();if(L){L.animDelay=parseFloat(e.target.value);$('#animDelayVal').textContent=L.animDelay.toFixed(1);}});
$('#animDelay').addEventListener('change',()=>{pushHistory();});
$('#animEase').addEventListener('change',e=>{const L=getActiveLayer();if(L)L.animEase=e.target.value;pushHistory();});
$('#animLoop').addEventListener('change',e=>{const L=getActiveLayer();if(L)L.animLoop=e.target.checked;pushHistory();});

// ---------- BACKGROUND ----------
$$('[data-bgtype]').forEach(b=>{
  b.addEventListener('click',()=>{
    State.project.background.type=b.dataset.bgtype;
    $$('[data-bgtype]').forEach(x=>x.classList.toggle('active',x===b));
    pushHistory();
    scheduleAutosave();
  });
});
bindColor('bgColor','bgColorHex',State.project.background,'color');
$('#bgColor').addEventListener('input',e=>{State.project.background.color=e.target.value;});
$('#bgColor').addEventListener('change',()=>{pushHistory();});
$('#bgColorHex').addEventListener('change',e=>{State.project.background.color=e.target.value;$('#bgColor').value=e.target.value;pushHistory();});
$('#bgOpacity').addEventListener('input',e=>{State.project.background.opacity=parseInt(e.target.value);$('#bgOpacityVal').textContent=e.target.value+'%';});
$('#bgOpacity').addEventListener('change',()=>{pushHistory();});
$('#bgGrad1').addEventListener('input',e=>{State.project.background.grad1=e.target.value;});
$('#bgGrad1').addEventListener('change',()=>{pushHistory();});
$('#bgGrad2').addEventListener('input',e=>{State.project.background.grad2=e.target.value;});
$('#bgGrad2').addEventListener('change',()=>{pushHistory();});
$('#bgGradDir').addEventListener('change',e=>{State.project.background.gradDir=e.target.value;pushHistory();});
$('#bgAnim').addEventListener('change',e=>{State.project.background.anim=e.target.value;pushHistory();});
$('#bgAnimSpeed').addEventListener('input',e=>{State.project.background.animSpeed=parseInt(e.target.value);$('#bgAnimSpeedVal').textContent=e.target.value+'%';});
$('#bgAnimSpeed').addEventListener('change',()=>{pushHistory();});
$('#bgImageInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      State.project.background.image=img;
      State.project.background.imageData=ev.target.result;
      pushHistory();
      scheduleAutosave();
      toast('Background image set','success');
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(f);
});
$('#btnResetBg').addEventListener('click',()=>{
  State.project.background={type:'solid',color:'#00ff66',opacity:100,grad1:'#00ff66',grad2:'#00b3ff',gradDir:'to right',anim:'none',animSpeed:50,image:null,imageData:null};
  $('#bgColor').value='#00ff66';$('#bgColorHex').value='#00ff66';
  $('#bgOpacity').value=100;$('#bgOpacityVal').textContent='100%';
  pushHistory();
  toast('Background reset','info');
});

// ---------- FILTERS ----------
const filterMap={
  fBright:'brightness',fContrast:'contrast',fDark:'darkness',
  fBlur:'blur',fOpacity:'opacity',fSepia:'sepia',
  fWarm:'warmth',fTint:'tint',fHue:'hue'
};
Object.keys(filterMap).forEach(id=>{
  const el=$('#'+id);
  const key=filterMap[id];
  const valEl=$('#'+id+'Val');
  el.addEventListener('input',()=>{
    State.project.filters[key]=parseFloat(el.value);
    let suffix='';
    if(['brightness','contrast','opacity','sepia','darkness'].includes(key))suffix='%';
    else if(key==='hue')suffix='°';
    valEl.textContent=el.value+suffix;
    scheduleAutosave();
  });
  el.addEventListener('change',()=>{
    pushHistory();
  });
});
$('#btnResetFilters').addEventListener('click',()=>{
  State.project.filters={brightness:100,contrast:100,darkness:0,blur:0,opacity:100,sepia:0,warmth:0,tint:0,hue:0};
  Object.keys(filterMap).forEach(id=>{
    const el=$('#'+id);
    el.value=State.project.filters[filterMap[id]];
    el.dispatchEvent(new Event('input'));
  });
  pushHistory();
  toast('Filters reset','info');
});

// ---------- LAYERS LIST ----------
function renderLayersList(){
  const list=$('#layersList');
  list.innerHTML='';
  if(State.project.layers.length===0){
    list.innerHTML='<div class="empty">No layers yet.<br>Click + to add a text layer.</div>';
    return;
  }
  [...State.project.layers].reverse().forEach((L,idx)=>{
    const el=document.createElement('div');
    el.className='layer-item'+(L.id===State.project.activeLayerId?' active':'');
    el.innerHTML=`
      <div class="layer-icon">T</div>
      <div class="layer-info">
        <div class="layer-name">${L.name}</div>
        <div class="layer-meta">${L.animation!=='none'?L.animation:'static'} • ${L.effect!=='none'?L.effect:'plain'}</div>
      </div>
      <div class="layer-actions">
        <button title="Visibility" data-act="vis">${L.visible?'👁':'🚫'}</button>
        <button title="Up" data-act="up">↑</button>
        <button title="Down" data-act="down">↓</button>
        <button class="danger" title="Delete" data-act="del">✕</button>
      </div>
    `;
    el.addEventListener('click',(e)=>{
      if(e.target.closest('button'))return;
      setActiveLayer(L.id);
    });
    el.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click',(e)=>{
        e.stopPropagation();
        const act=b.dataset.act;
        const arr=State.project.layers;
        const i=arr.indexOf(L);
        if(act==='vis'){L.visible=!L.visible; pushHistory();}
        else if(act==='up'){if(i<arr.length-1){[arr[i],arr[i+1]]=[arr[i+1],arr[i]]; pushHistory();}}
        else if(act==='down'){if(i>0){[arr[i],arr[i-1]]=[arr[i-1],arr[i]]; pushHistory();}}
        else if(act==='del'){
          State.project.layers=arr.filter(x=>x!==L);
          if(State.project.activeLayerId===L.id){
            if(State.project.layers.length > 0){
              const nextActiveIndex = Math.min(i, State.project.layers.length - 1);
              setActiveLayer(State.project.layers[nextActiveIndex].id);
            } else {
              setActiveLayer(null);
            }
          }
          pushHistory();
        }
        renderLayersList();renderTimeline();
      });
    });
    list.appendChild(el);
  });
}

// ---------- TIMELINE ----------
function renderTimeline(){
  const labels=$('#tlLabels');
  const tracks=$('#tlTracks');
  labels.innerHTML='';tracks.innerHTML='';
  const totalW=State.project.duration*State.zoom;
  tracks.style.width=totalW+'px';

  // BG track
  const bgLabel=document.createElement('div');
  bgLabel.className='tl-label';
  bgLabel.innerHTML='<div class="dot" style="background:#00ff66"></div>Background';
  labels.appendChild(bgLabel);
  const bgTrack=document.createElement('div');
  bgTrack.className='tl-track';
  const bgClip=document.createElement('div');
  bgClip.className='tl-clip';
  bgClip.style.left='0';
  bgClip.style.width=totalW+'px';
  bgClip.style.background='linear-gradient(135deg,#00ff66,#00b347)';
  bgClip.textContent='BG';
  bgTrack.appendChild(bgClip);
  tracks.appendChild(bgTrack);

  State.project.layers.forEach(L=>{
    const lbl=document.createElement('div');
    lbl.className='tl-label';
    lbl.innerHTML=`<div class="dot"></div><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${L.name}</span>`;
    labels.appendChild(lbl);

    const tr=document.createElement('div');
    tr.className='tl-track';
    const clip=document.createElement('div');
    clip.className='tl-clip';
    clip.style.left=(L.start*State.zoom)+'px';
    clip.style.width=((L.end-L.start)*State.zoom)+'px';
    clip.textContent=L.name;
    clip.dataset.id=L.id;

    const hl=document.createElement('div');hl.className='handle l';
    const hr=document.createElement('div');hr.className='handle r';
    clip.appendChild(hl);clip.appendChild(hr);

    // Drag clip
    let drag=null;
    clip.addEventListener('mousedown',e=>{
      if(e.target.classList.contains('handle')){
        drag={type:e.target.classList.contains('l')?'l':'r',start:e.clientX,origStart:L.start,origEnd:L.end};
      } else {
        drag={type:'move',start:e.clientX,origStart:L.start,origEnd:L.end};
        setActiveLayer(L.id);
      }
      e.preventDefault();
    });
    clip.addEventListener('touchstart',e=>{
      const t=e.touches[0];
      if(e.target.classList.contains('handle')){
        drag={type:e.target.classList.contains('l')?'l':'r',start:t.clientX,origStart:L.start,origEnd:L.end};
      } else {
        drag={type:'move',start:t.clientX,origStart:L.start,origEnd:L.end};
        setActiveLayer(L.id);
      }
      e.preventDefault();
    },{passive:false});

    const onMove=(cx)=>{
      if(!drag)return;
      const dx=(cx-drag.start)/State.zoom;
      if(drag.type==='move'){
        let ns=clamp(drag.origStart+dx,0,State.project.duration-(drag.origEnd-drag.origStart));
        if(State.snap)ns=Math.round(ns*10)/10;
        const dur=drag.origEnd-drag.origStart;
        L.start=ns;L.end=ns+dur;
      } else if(drag.type==='l'){
        let ns=clamp(drag.origStart+dx,0,L.end-0.1);
        if(State.snap)ns=Math.round(ns*10)/10;
        L.start=ns;
      } else {
        let ne=clamp(drag.origEnd+dx,L.start+0.1,State.project.duration);
        if(State.snap)ne=Math.round(ne*10)/10;
        L.end=ne;
      }
      clip.style.left=(L.start*State.zoom)+'px';
      clip.style.width=((L.end-L.start)*State.zoom)+'px';
    };
    const onUp=()=>{if(drag){drag=null;pushHistory();renderTimeline();}};
    window.addEventListener('mousemove',e=>onMove(e.clientX));
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchmove',e=>{if(drag)onMove(e.touches[0].clientX);},{passive:false});
    window.addEventListener('touchend',onUp);

    tr.appendChild(clip);
    tracks.appendChild(tr);
  });

  drawRuler();
}

function drawRuler(){
  const r=$('#tlRuler');
  const wrap=$('#tlTracksWrap');
  const totalW=State.project.duration*State.zoom;
  r.width=totalW;r.height=20;
  const rc=r.getContext('2d');
  rc.clearRect(0,0,r.width,r.height);
  rc.fillStyle='#171c25';rc.fillRect(0,0,r.width,r.height);
  rc.strokeStyle='#2a323f';rc.fillStyle='#8b95a7';
  rc.font='10px Inter';
  const step=State.zoom>=60?1:State.zoom>=30?2:5;
  for(let t=0;t<=State.project.duration;t+=step){
    const x=t*State.zoom;
    rc.beginPath();rc.moveTo(x,20);rc.lineTo(x,8);rc.stroke();
    rc.fillText(t+'s',x+3,16);
  }
  for(let t=0;t<=State.project.duration;t+=0.5){
    if(t%step===0)continue;
    const x=t*State.zoom;
    rc.beginPath();rc.moveTo(x,20);rc.lineTo(x,14);rc.stroke();
  }
}

function updatePlayhead(){
  const ph=$('#tlPlayhead');
  ph.style.left=(State.time*State.zoom)+'px';
}
function updateTimeDisplay(){
  $('#timeDisplay').textContent=fmtTime(State.time)+' / '+fmtTime(State.project.duration);
}

// Timeline click to seek
$('#tlTracksWrap').addEventListener('mousedown',e=>{
  if(e.target.closest('.tl-clip'))return;
  const rect=e.currentTarget.getBoundingClientRect();
  const x=e.clientX-rect.left+e.currentTarget.scrollLeft;
  State.time=clamp(x/State.zoom,0,State.project.duration);
  updatePlayhead();updateTimeDisplay();
});

// Play controls
function updatePlayBtn(){
  const icon=$('#playIcon');
  if(State.playing){
    icon.innerHTML='<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    icon.innerHTML='<polygon points="6 4 20 12 6 20 6 4"/>';
  }
}
$('#btnPlay').addEventListener('click',()=>{
  if(State.time>=State.project.duration)State.time=0;
  State.playing=!State.playing;
  updatePlayBtn();
});
$('#btnStop').addEventListener('click',()=>{
  State.playing=false;State.time=0;
  updatePlayBtn();updatePlayhead();updateTimeDisplay();
});
$('#btnLoop').addEventListener('click',()=>{
  State.looping=!State.looping;
  $('#btnLoop').classList.toggle('active',State.looping);
  $('#btnLoop').style.background=State.looping?'var(--accent)':'';
  $('#btnLoop').style.color=State.looping?'#001a0b':'';
});
$('#fpsSel').addEventListener('change',e=>{State.project.fps=parseInt(e.target.value);$('#canvasInfo').textContent=`${canvas.width} × ${canvas.height} • ${State.project.fps} FPS`;});
$('#durSel').addEventListener('change',e=>{
  State.project.duration=parseInt(e.target.value);
  State.project.layers.forEach(L=>{if(L.end>State.project.duration)L.end=State.project.duration;});
  updateTimeDisplay();renderTimeline();
});
$('#tlZoom').addEventListener('input',e=>{State.zoom=parseInt(e.target.value);renderTimeline();updatePlayhead();});
$('#snapMode').addEventListener('change',e=>{State.snap=e.target.checked;});

// ---------- MODALS ----------
function openModal(id){$('#'+id).classList.add('open');}
function closeModal(id){$('#'+id).classList.remove('open');}
$$('.modal-backdrop').forEach(m=>{
  m.addEventListener('click',e=>{
    if(e.target===m||e.target.closest('[data-close]'))m.classList.remove('open');
  });
});

$('#btnExport').addEventListener('click',()=>openModal('exportModal'));

// ---------- SAVE SPLIT BUTTON ----------
const saveDropdown=$('#saveDropdown');
$('#btnSaveArrow').addEventListener('click',(e)=>{
  e.stopPropagation();
  saveDropdown.classList.toggle('open');
});
document.addEventListener('click',(e)=>{
  if(!e.target.closest('.save-split'))saveDropdown.classList.remove('open');
});

async function quickExportVideo(widthPx, heightPx, label) {
  const res=[widthPx, heightPx];
  const quality = widthPx>=1280 ? 8000000 : 4000000;
  const fmt = 'mp4';
  saveDropdown.classList.remove('open');
  toast(`Rendering ${label} video…`, 'info');

  const origW=canvas.width, origH=canvas.height;
  canvas.width=res[0]; canvas.height=res[1];
  const sx=res[0]/origW, sy=res[1]/origH;
  State.project.layers.forEach(L=>{L.x*=sx; L.y*=sy; L.fontSize*=sx;});

  const stream=canvas.captureStream(State.project.fps);
  let mime='video/webm;codecs=vp9';
  if(MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) mime='video/mp4;codecs=avc1';
  else if(MediaRecorder.isTypeSupported('video/mp4')) mime='video/mp4';

  const rec=new MediaRecorder(stream,{mimeType:mime, videoBitsPerSecond:quality});
  const chunks=[];
  rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  rec.onstop=()=>{
    const blob=new Blob(chunks,{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`video_${label}.${mime.includes('mp4')?'mp4':'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
    State.project.layers.forEach(L=>{L.x/=sx; L.y/=sy; L.fontSize/=sx;});
    canvas.width=origW; canvas.height=origH;
    toast(`${label} video exported!`, 'success');
  };

  rec.start();
  State.time=0; State.playing=true; updatePlayBtn();
  const startTime=performance.now();
  const dur=State.project.duration*1000;
  const tick=()=>{
    const elapsed=performance.now()-startTime;
    if(elapsed<dur){requestAnimationFrame(tick);}
    else{
      State.playing=false; State.time=State.project.duration;
      updatePlayBtn();
      setTimeout(()=>rec.stop(), 200);
    }
  };
  requestAnimationFrame(tick);
}

$('#btnSaveHD').addEventListener('click',()=>quickExportVideo(1280,720,'HD'));
$('#btnSaveSD').addEventListener('click',()=>quickExportVideo(640,360,'SD'));
$('#btnSettings').addEventListener('click',()=>openModal('settingsModal'));
$('#btnLoad').addEventListener('click',()=>{openModal('loadModal');renderAutosaveList();});
$('#btnSave').addEventListener('click',()=>saveProject());

// ---------- SAVE / LOAD ----------
function saveProject(){
  const data=JSON.stringify(State.project,null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=(State.project.title||'project')+'.json';
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem('tvgs_autosave',JSON.stringify({ts:Date.now(),data:State.project}));
  toast('Project saved','success');
}

function autosave(){
  if(!$('#setAutosave').checked)return;
  try{
    localStorage.setItem('tvgs_autosave',JSON.stringify({ts:Date.now(),data:State.project}));
  }catch(e){}
}
let saveTimer=null;
function scheduleAutosave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(autosave,800);
}

function loadProject(data){
  try{
    const p=typeof data==='string'?JSON.parse(data):data;
    State.project=Object.assign(State.project,p);
    $('#projectTitle').value=State.project.title;
    $('#durSel').value=State.project.duration;
    $('#fpsSel').value=State.project.fps;
    // restore bg image if data url
    if(State.project.background.imageData){
      const img=new Image();
      img.onload=()=>{State.project.background.image=img;};
      img.src=State.project.background.imageData;
    }
    syncAllUI();
    renderLayersList();renderTimeline();updateTimeDisplay();
    toast('Project loaded','success');
  }catch(e){toast('Failed to load: '+e.message,'error');}
}

function syncAllUI(){
  // BG
  $('#bgColor').value=State.project.background.color;
  $('#bgColorHex').value=State.project.background.color;
  $('#bgOpacity').value=State.project.background.opacity;$('#bgOpacityVal').textContent=State.project.background.opacity+'%';
  $('#bgGrad1').value=State.project.background.grad1;
  $('#bgGrad2').value=State.project.background.grad2;
  $('#bgGradDir').value=State.project.background.gradDir;
  $('#bgAnim').value=State.project.background.anim;
  $('#bgAnimSpeed').value=State.project.background.animSpeed;$('#bgAnimSpeedVal').textContent=State.project.background.animSpeed+'%';
  $$('[data-bgtype]').forEach(b=>b.classList.toggle('active',b.dataset.bgtype===State.project.background.type));
  // Filters
  Object.keys(filterMap).forEach(id=>{
    const el=$('#'+id);
    el.value=State.project.filters[filterMap[id]];
    el.dispatchEvent(new Event('input'));
  });
  syncPanelFromLayer();
  $('#canvasInfo').textContent=`${canvas.width} × ${canvas.height} • ${State.project.fps} FPS`;
}

$('#loadFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>loadProject(ev.target.result);
  r.readAsText(f);
  closeModal('loadModal');
});

function renderAutosaveList(){
  const list=$('#autosaveList');
  list.innerHTML='';
  const keys=Object.keys(localStorage).filter(k=>k.startsWith('tvgs_save_'));
  const auto=localStorage.getItem('tvgs_autosave');
  if(auto){
    try{
      const d=JSON.parse(auto);
      const el=document.createElement('div');
      el.className='layer-item';
      el.innerHTML=`<div class="layer-icon">💾</div><div class="layer-info"><div class="layer-name">Autosave</div><div class="layer-meta">${new Date(d.ts).toLocaleString()}</div></div>`;
      el.addEventListener('click',()=>{loadProject(d.data);closeModal('loadModal');});
      list.appendChild(el);
    }catch(e){}
  }
  if(list.children.length===0){
    list.innerHTML='<div class="empty">No autosaves found</div>';
  }
}

// ---------- EXPORT ----------
$('#btnStartExport').addEventListener('click',async()=>{
  const fmt=$('#expFormat').value;
  const res=$('#expRes').value.split('x').map(parseInt);
  const quality=parseInt($('#expQuality').value);

  if(fmt==='json'){
    saveProject();
    closeModal('exportModal');
    return;
  }

  if(fmt==='png'){
    // Render current frame at export resolution
    const origW=canvas.width,origH=canvas.height;
    canvas.width=res[0];canvas.height=res[1];
    // scale layer positions
    const sx=res[0]/origW,sy=res[1]/origH;
    State.project.layers.forEach(L=>{L.x*=sx;L.y*=sy;L.fontSize*=sx;});
    render(performance.now());
    canvas.toBlob(blob=>{
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='frame.png';a.click();
      URL.revokeObjectURL(url);
      // restore
      State.project.layers.forEach(L=>{L.x/=sx;L.y/=sy;L.fontSize/=sx;});
      canvas.width=origW;canvas.height=origH;
      toast('PNG exported','success');
    });
    closeModal('exportModal');
    return;
  }

  // Video export
  const progWrap=$('#exportProgress');
  const progBar=$('#expProgBar');
  const progVal=$('#expProgVal');
  progWrap.style.display='block';
  $('#btnStartExport').disabled=true;

  const origW=canvas.width,origH=canvas.height;
  canvas.width=res[0];canvas.height=res[1];
  const sx=res[0]/origW,sy=res[1]/origH;
  State.project.layers.forEach(L=>{L.x*=sx;L.y*=sy;L.fontSize*=sx;});

  const stream=canvas.captureStream(State.project.fps);
  let mime='video/webm;codecs=vp9';
  if(fmt==='mp4'){
    if(MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'))mime='video/mp4;codecs=avc1';
    else if(MediaRecorder.isTypeSupported('video/mp4'))mime='video/mp4';
  }
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:quality});
  const chunks=[];
  rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  rec.onstop=()=>{
    const blob=new Blob(chunks,{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`video.${mime.includes('mp4')?'mp4':'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
    // restore
    State.project.layers.forEach(L=>{L.x/=sx;L.y/=sy;L.fontSize/=sx;});
    canvas.width=origW;canvas.height=origH;
    progWrap.style.display='none';
    $('#btnStartExport').disabled=false;
    closeModal('exportModal');
    toast('Video exported!','success');
  };

  rec.start();
  State.time=0;State.playing=true;updatePlayBtn();
  const startTime=performance.now();
  const dur=State.project.duration*1000;
  const tick=()=>{
    const elapsed=performance.now()-startTime;
    const p=Math.min(100,elapsed/dur*100);
    progBar.style.width=p+'%';
    progVal.textContent=Math.round(p)+'%';
    if(elapsed<dur){requestAnimationFrame(tick);}
    else{
      State.playing=false;State.time=State.project.duration;
      updatePlayBtn();
      setTimeout(()=>rec.stop(),200);
    }
  };
  tick();
});

// ---------- SETTINGS ----------
$('#setCanvasSize').addEventListener('change',e=>{
  const [w,h]=e.target.value.split('x').map(parseInt);
  const sx=w/canvas.width,sy=h/canvas.height;
  canvas.width=w;canvas.height=h;
  State.project.canvas={w,h};
  State.project.layers.forEach(L=>{L.x*=sx;L.y*=sy;});
  $('#canvasInfo').textContent=`${w} × ${h} • ${State.project.fps} FPS`;
  renderTimeline();
});
$('#btnClearStorage').addEventListener('click',()=>{
  if(confirm('Clear all saved data?')){
    localStorage.clear();
    toast('Storage cleared','info');
  }
});

// ---------- CUSTOM TEMPLATES ----------
$('#btnSaveTpl').addEventListener('click',()=>{
  const L=getActiveLayer();if(!L)return toast('Select a layer first','error');
  const name=prompt('Template name:','My Template');
  if(!name)return;
  const tpl={
    id:'T'+Date.now(),name,
    effect:L.effect,animation:L.animation,
    animDur:L.animDur,animInt:L.animInt,animDelay:L.animDelay,
    animEase:L.animEase,animLoop:L.animLoop,
    font:L.font,fontSize:L.fontSize,color:L.color,
    useGradient:L.useGradient,gradColor1:L.gradColor1,gradColor2:L.gradColor2,
    strokeW:L.strokeW,strokeColor:L.strokeColor,
    shadowBlur:L.shadowBlur,shadowColor:L.shadowColor
  };
  State.project.customTemplates.push(tpl);
  renderCustomTemplates();
  scheduleAutosave();
  toast('Template saved','success');
});
$('#btnNewTpl').addEventListener('click',()=>{
  const name=prompt('Template name:','New Template');
  if(!name)return;
  State.project.customTemplates.push({id:'T'+Date.now(),name,effect:'none',animation:'none',animDur:1,animInt:50,animDelay:0,animEase:'ease-out',animLoop:false});
  renderCustomTemplates();scheduleAutosave();
});
function renderCustomTemplates(){
  const list=$('#customTplList');
  list.innerHTML='';
  if(State.project.customTemplates.length===0){
    list.innerHTML='<div class="empty">No custom templates</div>';
    return;
  }
  State.project.customTemplates.forEach(t=>{
    const el=document.createElement('div');
    el.className='layer-item';
    el.innerHTML=`<div class="layer-icon">★</div><div class="layer-info"><div class="layer-name">${t.name}</div><div class="layer-meta">${t.animation||'no anim'} • ${t.effect||'no effect'}</div></div>
      <div class="layer-actions">
        <button data-act="apply">✓</button>
        <button class="danger" data-act="del">✕</button>
      </div>`;
    el.querySelector('[data-act=apply]').addEventListener('click',()=>{
      const L=getActiveLayer();if(!L)return toast('Select a layer','error');
      Object.assign(L,{effect:t.effect,animation:t.animation,animDur:t.animDur,animInt:t.animInt,animDelay:t.animDelay,animEase:t.animEase,animLoop:t.animLoop,font:t.font,fontSize:t.fontSize,color:t.color,useGradient:t.useGradient,gradColor1:t.gradColor1,gradColor2:t.gradColor2,strokeW:t.strokeW,strokeColor:t.strokeColor,shadowBlur:t.shadowBlur,shadowColor:t.shadowColor});
      syncPanelFromLayer();
      toast('Template applied','success');
    });
    el.querySelector('[data-act=del]').addEventListener('click',()=>{
      State.project.customTemplates=State.project.customTemplates.filter(x=>x.id!==t.id);
      renderCustomTemplates();scheduleAutosave();
    });
    list.appendChild(el);
  });
}

// ---------- QUICK STYLES ----------
$$('[data-quickstyle]').forEach(c=>{
  c.addEventListener('click',()=>{
    const L=getActiveLayer();if(!L)return;
    const s=c.dataset.quickstyle;
    // Reset gradient & stroke for clean slate
    L.useGradient=false;L.strokeW=0;L.shadowBlur=0;
    L.bold=false;L.italic=false;
    // Apply styles
    if(s==='bold-white'){L.font='Inter';L.bold=true;L.color='#ffffff';L.effect='none';}
    else if(s==='clean-black'){L.font='Inter';L.bold=true;L.color='#111111';L.effect='none';}
    else if(s==='neon-green'){L.font='Orbitron';L.color='#00ff66';L.effect='neon';L.shadowBlur=20;L.shadowColor='#00ff66';}
    else if(s==='neon-blue'){L.font='Orbitron';L.color='#00b3ff';L.effect='neon';L.shadowBlur=20;L.shadowColor='#00b3ff';}
    else if(s==='neon-pink'){L.font='Audiowide';L.color='#ff2d78';L.effect='neon';L.shadowBlur=24;L.shadowColor='#ff2d78';}
    else if(s==='gold'){L.font='Bebas Neue';L.color='#ffd700';L.effect='golden';L.shadowBlur=12;L.shadowColor='rgba(255,200,0,0.5)';}
    else if(s==='fire'){L.font='Permanent Marker';L.color='#ff6a00';L.effect='fire';}
    else if(s==='ice'){L.font='Audiowide';L.color='#a0e8ff';L.effect='glow';L.shadowBlur=14;L.shadowColor='#a0e8ff';}
    else if(s==='sunset'){L.font='Bebas Neue';L.useGradient=true;L.gradColor1='#ff6a00';L.gradColor2='#ee0979';L.gradDir='to right';L.effect='none';}
    else if(s==='ocean'){L.font='Russo One';L.useGradient=true;L.gradColor1='#00b3ff';L.gradColor2='#00ff88';L.gradDir='to right';L.effect='glow';L.shadowBlur=10;L.shadowColor='#00b3ff';}
    else if(s==='galaxy'){L.font='Orbitron';L.useGradient=true;L.gradColor1='#bf00ff';L.gradColor2='#00b3ff';L.gradDir='to right';L.effect='glow';L.shadowBlur=16;L.shadowColor='#8000ff';}
    else if(s==='cyber'){L.font='Audiowide';L.color='#00ffff';L.effect='neon';L.shadowBlur=8;L.shadowColor='#00ffff';L.strokeW=0;}
    else if(s==='retro'){L.font='Courier New';L.color='#ff9900';L.effect='retro';L.letterSpacing=4;}
    else if(s==='minimal-white'){L.font='Inter';L.bold=false;L.color='#222222';L.effect='none';L.letterSpacing=8;}
    else if(s==='deep-shadow'){L.font='Inter';L.bold=true;L.color='#ffffff';L.effect='shadow';L.shadowBlur=0;L.shadowColor='#000000';L.shadowX=4;L.shadowY=4;}
    else if(s==='outline-white'){L.font='Russo One';L.color='transparent';L.strokeW=3;L.strokeColor='#ffffff';L.effect='outline';}
    syncPanelFromLayer();
    toast('Style applied','success');
  });
});


// ---------- MOBILE PANEL ----------
$('#mobileToggle').addEventListener('click',()=>{
  $('#panel').classList.toggle('open');
});

// ---------- PROJECT TITLE ----------
$('#projectTitle').addEventListener('input',e=>{
  State.project.title=e.target.value;
  document.title=e.target.value+' • Text Studio';
  scheduleAutosave();
});

// ---------- INIT ----------
function init(){
  // Load autosave
  const auto=localStorage.getItem('tvgs_autosave');
  if(auto){
    try{
      const d=JSON.parse(auto);
      if(d.data){
        State.project=Object.assign(State.project,d.data);
        $('#projectTitle').value=State.project.title;
        $('#durSel').value=State.project.duration;
        $('#fpsSel').value=State.project.fps;
        if(State.project.background.imageData){
          const img=new Image();
          img.onload=()=>{State.project.background.image=img;};
          img.src=State.project.background.imageData;
        }
      }
    }catch(e){}
  }

  // Default layer if none
  if(State.project.layers.length===0){
    const L=createDefaultLayer('HELLO WORLD');
    L.effect='neon';
    L.animation='fade-in';
    L.font='Orbitron';
    L.fontSize=100;
    L.color='#ffffff';
    L.useGradient=true;
    L.gradColor1='#00ff66';
    L.gradColor2='#00b3ff';
    L.end=State.project.duration;
    State.project.layers.push(L);
    setActiveLayer(L.id);
  } else {
    setActiveLayer(State.project.activeLayerId||State.project.layers[0].id);
  }

  renderLayersList();
  renderTimeline();
  renderCustomTemplates();
  syncAllUI();
  updateTimeDisplay();
  updatePlayhead();
  requestAnimationFrame(render);

  // Keyboard shortcuts
  window.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if(e.code==='Space'){e.preventDefault();$('#btnPlay').click();}
    if(e.key==='Delete'||e.key==='Backspace'){$('#btnDelete').click();}
    if(e.ctrlKey&&e.key==='s'){e.preventDefault();saveProject();}
    if(e.ctrlKey&&e.key==='d'){e.preventDefault();$('#btnDuplicate').click();}
  });

  toast('Welcome to Text Video Generator Studio!','success');
}

init();

})();