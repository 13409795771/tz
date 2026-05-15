window.RealtimeClient = class {
  constructor(game, initialBoard){ this.game=game; this.initialBoard=initialBoard; this.ws=null; this.handlers={}; }
  on(type,cb){ this.handlers[type]=cb; }
  emit(type,payload){ if(this.handlers[type]) this.handlers[type](payload); }
  connect(room,name){
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen=()=>{ this.ws.send(JSON.stringify({type:'join',room,name,game:this.game,initialBoard:this.initialBoard})); };
    this.ws.onmessage=(e)=>{ const m=JSON.parse(e.data); this.emit(m.type,m); };
    this.ws.onclose=()=>this.emit('closed',{});
  }
  sync(state){ this.ws?.send(JSON.stringify({type:'sync',state})); }
};
