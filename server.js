// CARAWI — serveur de jeu (Node.js + WebSocket). Le serveur détient toutes les mains : personne ne peut voir les cartes des autres.
const http=require("http"),fs=require("fs"),path=require("path"),{WebSocketServer}=require("ws");
const PORT=process.env.PORT||3000;
const page=fs.readFileSync(path.join(__dirname,"public","index.html"));
const icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="90" fill="#081b25"/><text x="256" y="330" font-size="260" text-anchor="middle" fill="#f2c66d">♣♦</text></svg>';
const manifest=JSON.stringify({name:"CARAWI",short_name:"CARAWI",start_url:"/",display:"standalone",background_color:"#081b25",theme_color:"#081b25",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]});
const srv=http.createServer((q,r)=>{
  if(q.url==="/healthz")return r.end("ok");
  if(q.url==="/manifest.webmanifest"){r.writeHead(200,{"content-type":"application/manifest+json"});return r.end(manifest)}
  if(q.url==="/icon.svg"){r.writeHead(200,{"content-type":"image/svg+xml"});return r.end(icon)}
  r.writeHead(200,{"content-type":"text/html; charset=utf-8"});r.end(page)});
const wss=new WebSocketServer({server:srv,maxPayload:2048});
const rooms=new Map(),SU=["♥","♦","♣","♠"],RK=["3","4","5","6","7","8","9","10","A"];
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const top=R=>R.discard[R.discard.length-1];
function deal(R){const d=[];for(const r of RK)for(const s of SU)if(!(r==="A"&&s==="♠"))d.push({r,s});shuf(d);
  R.players.forEach(p=>{p.hand=[];for(let i=0;i<5;i++)p.hand.push(d.pop())});
  let f=d.pop();while(f.r==="A"){d.unshift(f);f=d.pop()}
  Object.assign(R,{deck:d,discard:[f],cur:0,acePen:false,chosen:"",pend8:false,bonus:false,drew:false,status:"play",msg:"C’est parti !",win:"",gain:0})}
function ok(R,c){const t=top(R);if(R.acePen)return c.r==="A";if(R.pend8)return false;
  if(R.bonus&&R.chosen)return c.r===t.r||c.s===R.chosen;return c.r===t.r||c.s===t.s}
function nxt(R){R.cur=(R.cur+1)%R.players.length;R.drew=false;R.chosen="";R.bonus=false;R.pend8=false}
function take(R,p){if(!R.deck.length&&R.discard.length>1){const t=R.discard.pop();R.deck=shuf(R.discard);R.discard=[t]}
  if(R.deck.length){const c=R.deck.pop();p.hand.push(c);return c}return null}
function play(R,P,i){const c=P.hand[i];if(!c||!ok(R,c)){R.msg="Carte non jouable.";return}
  P.hand.splice(i,1);R.discard.push(c);R.drew=false;
  if(!P.hand.length){const g=c.r==="3"?2:1;P.wins++;P.pts+=g;R.status=P.pts>=10?"over":"roundEnd";R.win=P.name;R.gain=g;return}
  if(c.r==="8"){R.pend8=true;R.msg=P.name+" joue un 8 : il choisit une couleur."}
  else if(c.r==="A"){R.msg=P.name+" joue un As : le suivant contre avec un As ou pioche 2.";nxt(R);R.acePen=true}
  else{R.msg=P.name+" joue "+c.r+c.s;nxt(R)}}
function draw(R,P){if(R.drew||R.pend8)return;
  if(R.acePen){take(R,P);take(R,P);R.acePen=false;R.msg=P.name+" pioche 2 cartes (As).";nxt(R);return}
  const c=take(R,P);R.drew=true;
  if(!c||!ok(R,c)){R.msg=P.name+" pioche et passe.";nxt(R)}else R.msg=P.name+" a pioché une carte jouable."}
function act(R,P,m){const host=R.players[0]===P;
  if(m.t==="start"){if(host&&R.status==="lobby"&&R.players.length>1)deal(R);return}
  if(m.t==="next"){if(host&&(R.status==="roundEnd"||R.status==="over")){if(R.status==="over")R.players.forEach(p=>{p.pts=0;p.wins=0});R.round++;deal(R)}return}
  if(R.status!=="play")return;const cur=R.players[R.cur];
  if(m.t==="pass"){
    if(cur===P&&R.drew){R.msg=P.name+" passe.";nxt(R)}
    else if(cur!==P&&!cur.ws){R.msg=cur.name+" est déconnecté : son tour est passé.";nxt(R)}return}
  if(cur!==P)return;
  if(m.t==="play")play(R,P,Number(m.i));
  else if(m.t==="suit"&&R.pend8&&SU.includes(m.s)){R.chosen=m.s;R.pend8=false;R.bonus=true;R.msg=P.name+" choisit "+m.s+" et rejoue."}
  else if(m.t==="draw")draw(R,P)}
function view(R,P){const mine=R.status==="play"&&R.players[R.cur]===P;
  return{state:{code:R.code,status:R.status,me:R.players.indexOf(P),cur:R.cur||0,host:R.players[0]===P,
    players:R.players.map(p=>({name:p.name,n:p.hand.length,pts:p.pts,wins:p.wins,on:!!p.ws})),
    hand:P.hand,ok:P.hand.map(c=>mine&&ok(R,c)),top:R.discard?top(R):null,deck:R.deck?R.deck.length:0,
    pend8:!!R.pend8,drew:!!R.drew,msg:R.msg||"",win:R.win||"",gain:R.gain||0}}}
function broadcast(R){R.seen=Date.now();for(const p of R.players)if(p.ws&&p.ws.readyState===1)p.ws.send(JSON.stringify(view(R,p)))}
const L="ABCDEFGHJKLMNPQRSTUVWXYZ";
function newCode(){let c;do{c=Array.from({length:4},()=>L[Math.floor(Math.random()*L.length)]).join("")}while(rooms.has(c));return c}
wss.on("connection",ws=>{
  let R=null,P=null;ws.isAlive=true;ws.on("pong",()=>ws.isAlive=true);
  const fail=t=>ws.send(JSON.stringify({err:t}));
  ws.on("message",raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m!=="object")return;
    if(m.t==="create"||m.t==="join"){
      const tok=String(m.tok||"").slice(0,64),name=(String(m.name||"").trim().slice(0,16))||"Joueur";if(!tok)return;
      let room;
      if(m.t==="create"){room={code:newCode(),status:"lobby",players:[],round:1,seen:Date.now()};rooms.set(room.code,room)}
      else room=rooms.get(String(m.code||"").toUpperCase());
      if(!room)return fail("Aucune partie avec ce code.");
      let pl=room.players.find(p=>p.tok===tok);
      if(!pl){if(room.status!=="lobby")return fail("Cette partie a déjà commencé.");if(room.players.length>=6)return fail("La partie est pleine (6 joueurs).");
        pl={tok,name,hand:[],pts:0,wins:0};room.players.push(pl)}
      if(pl.ws&&pl.ws!==ws)try{pl.ws.close()}catch{}
      pl.ws=ws;R=room;P=pl;broadcast(R);return}
    if(!R||!P)return;act(R,P,m);broadcast(R)});
  ws.on("close",()=>{if(P&&P.ws===ws){P.ws=null;if(R)broadcast(R)}})});
setInterval(()=>{wss.clients.forEach(w=>{if(!w.isAlive)return w.terminate();w.isAlive=false;w.ping()});
  for(const[c,R]of rooms)if(Date.now()-R.seen>2*3600e3&&!R.players.some(p=>p.ws))rooms.delete(c)},30000);
srv.listen(PORT,()=>console.log("CARAWI sur le port "+PORT));
