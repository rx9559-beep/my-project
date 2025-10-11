const http = require('http');
function post(path, body, token){ return new Promise((resolve,reject)=>{
  const data = JSON.stringify(body);
  const opts = { hostname:'localhost', port:4000, path, method:'POST', headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data) } };
  if (token) opts.headers['Authorization']='Bearer '+token;
  const req = http.request(opts, res=>{ let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{ resolve({status:res.statusCode, body: b?JSON.parse(b):null}); }catch(e){ resolve({status:res.statusCode, body:b}); } }); });
  req.on('error', reject); req.write(data); req.end();
}); }
function get(path, token){ return new Promise((resolve,reject)=>{
  const opts = { hostname:'localhost', port:4000, path, method:'GET', headers:{} };
  if (token) opts.headers['Authorization']='Bearer '+token;
  const req = http.request(opts, res=>{ let b=''; res.on('data',c=>b+=c); res.on('end',()=>{ try{ resolve({status:res.statusCode, body: b?JSON.parse(b):null}); }catch(e){ resolve({status:res.statusCode, body:b}); } }); });
  req.on('error', reject); req.end();
}); }
(async ()=>{
  try{
    let r = await get('/api/events'); console.log('events:', r.status, r.body && r.body.events && r.body.events.length);
    // like event 1
    r = await post('/api/events/1/like', {}); console.log('like1:', r.status, r.body);
    // try save without token (should 401)
    r = await post('/api/events/1/save', {}); console.log('save without token:', r.status, r.body);
  } catch(e){ console.error(e); }
})();
