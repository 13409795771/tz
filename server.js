const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};

const server = http.createServer((req,res)=>{
  let p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end('forbidden');
  fs.readFile(file,(e,d)=>{ if(e){res.writeHead(404).end('not found');return;} res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'text/plain'});res.end(d);});
});

const wss = new WebSocketServer({ server });
const rooms = new Map();
const clients = new Map();

function send(ws,obj){ if(ws.readyState===1) ws.send(JSON.stringify(obj)); }
function roomOf(code){ if(!rooms.has(code)) rooms.set(code,{players:[],state:null,version:0}); return rooms.get(code); }
function broadcast(code,obj){ const r=rooms.get(code); if(!r) return; r.players.forEach(p=>send(p.ws,obj)); }

wss.on('connection',(ws)=>{
  clients.set(ws,{room:null,seat:null,name:'玩家'});

  ws.on('message',(raw)=>{
    let m; try{m=JSON.parse(raw);}catch{return;}
    const c = clients.get(ws);

    if(m.type==='join'){
      const code=(m.room||'').toUpperCase();
      if(!/^[A-Z0-9]{4,8}$/.test(code)) return send(ws,{type:'err',msg:'房间号需4-8位字母数字'});
      const r=roomOf(code);
      if(r.players.length>=2) return send(ws,{type:'err',msg:'房间已满'});
      const seat = r.players.length===0?'A':'B';
      c.room=code;c.seat=seat;c.name=m.name||'玩家';
      r.players.push({ws,seat,name:c.name,lastSeen:Date.now()});
      send(ws,{type:'joined',room:code,seat});
      broadcast(code,{type:'presence',players:r.players.map(p=>({seat:p.seat,name:p.name,online:true}))});
      if(r.players.length===2){
        if(!r.state) r.state={game:m.game,turn:'A',board:m.initialBoard};
        broadcast(code,{type:'start',state:r.state,version:r.version});
      }
      return;
    }

    if(!c.room) return;
    const r=rooms.get(c.room);
    if(!r) return;

    if(m.type==='sync'){
      r.state=m.state; r.version=(r.version||0)+1;
      broadcast(c.room,{type:'sync',state:r.state,version:r.version,from:c.seat});
      return;
    }

    if(m.type==='ping'){
      const p=r.players.find(x=>x.ws===ws); if(p) p.lastSeen=Date.now();
      send(ws,{type:'pong',t:Date.now()});
      return;
    }
  });

  ws.on('close',()=>{
    const c=clients.get(ws); if(!c) return;
    const code=c.room;
    if(code && rooms.has(code)){
      const r=rooms.get(code);
      r.players = r.players.filter(p=>p.ws!==ws);
      broadcast(code,{type:'presence',players:r.players.map(p=>({seat:p.seat,name:p.name,online:true}))});
      if(r.players.length===0) rooms.delete(code);
    }
    clients.delete(ws);
  });
});

server.listen(PORT,()=>console.log('server on '+PORT));
