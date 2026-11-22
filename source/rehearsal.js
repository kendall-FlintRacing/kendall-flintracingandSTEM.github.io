/* ===== RACE DAY REHEARSAL (flintracing.org/rehearsal.html) =====
   A private practice copy of the race. Racing data (brackets, heats, lights, times, live state, shout-outs)
   lives only in this browser, so viewers never see it. Racers and sponsors are copied from the real site.
   Special screens (race_slides), the run of show (race_lineup) and screen pictures are the REAL ones:
   changes made here are saved for race day. */
(function(){
  if(!window.FR_REHEARSAL||!window.FR_REAL_SB||!window.supabase)return;
  var KEY="fr-rehearsal-v1",PASS={race_slides:1,race_lineup:1},FAKE=window.supabase.createClient,REAL=null,FAKEDB=null;
  window.supabase.createClient=function(url,key){
    var f=FAKE.apply(this,arguments);FAKEDB=f;
    try{REAL=window.FR_REAL_SB.createClient(url,key);window.FR_REAL_DB=REAL}catch(e){REAL=null}
    if(REAL){var ff=f.from.bind(f);f.from=function(t){return PASS[t]?REAL.from(t):ff(t)};
      if(f.storage&&f.storage.from){var fs=f.storage.from.bind(f.storage);f.storage.from=function(b){return b==="site-images"?REAL.storage.from(b):fs(b)}}}
    setTimeout(start,0);return f};

  function el(h){var d=document.createElement("div");d.innerHTML=h;return d.firstChild}
  function overlay(msg,btn){var o=document.getElementById("rehOv");if(!o){o=el('<div id="rehOv" class="reh-ov" role="dialog" aria-modal="true" aria-label="Rehearsal"><div class="reh-ovin"><b>Race day rehearsal</b><p></p><div class="row"></div></div></div>');document.body.appendChild(o)}
    o.querySelector("p").textContent=msg;var r=o.querySelector(".row");r.innerHTML="";(btn||[]).forEach(function(b){var x=el('<button class="btn deep" type="button"></button>');x.textContent=b[0];x.onclick=b[1];r.appendChild(x)});return o}

  /* Copy the real racers and sponsors into a fresh practice race */
  function importReal(){overlay("Copying your racers and sponsors from flintracing.org…");
    Promise.all([REAL.from("race_racers").select("*"),REAL.from("race_ads").select("*").order("sort_order")]).then(function(r){
      if(r[0].error||r[1].error){overlay("Couldn’t copy the race list: "+((r[0].error||r[1].error).message||"no connection")+". Check your internet and try again.",[["Try again",importReal]]);return}
      FAKEDB.rpc("noop").then(function(){var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
        if(!T){overlay("Couldn’t start the practice copy in this browser. Turn off private browsing and try again.",[["Try again",importReal]]);return}
        var now=new Date().toISOString();
        T.race_racers=r[0].data||[];T.race_ads=r[1].data||[];T.race_heat_ads=[];T.race_heats=[];T.race_brackets=[];T.shoutouts=[];
        T.race_state=[{id:1,live:false,current_heat:null,banner:null,updated_at:now}];
        T.race_show=[{id:1,screen:"race",takeover:"none",int_title:null,int_until:null,ad_strip:false,feature_ad:null,feature_at:null,hype_text:null,hype_at:null,fact_text:null,pinned_shout:null,slide_id:null,slide_at:null,lineup_slots:null,lineup_at:null,lineup_step:0,updated_at:now}];
        T.rehearsal_from=now;T.rehearsal_racers=T.race_racers.length;T.rehearsal_sample=false;T.rehearsal_drawn=false;
        try{localStorage.setItem(KEY,JSON.stringify(T))}catch(e){}
        location.reload()})})}

  /* Sample race: Kendall picks how many cars per division and how many sponsors; one click fills the
     driver spots with fake racers from made-up schools (with sample mascot logos) */
  var FIRST=["Maya","Jalen","Ava","Noah","Zoe","Eli","Mia","Leo","Aria","Caleb","Nora","Owen","Lila","Isaiah","Ruby","Miles","Jada","Xavier","Hazel","Isaac","Gianna","Theo","Amir","Brooke","Carter","Dani","Ezra","Faith","Gavin","Harper","Ivy","Jonah","Kira","Logan","Malik","Naomi","Omar","Paige","Quinn","Reese","Sam","Tessa","Uriah","Vera","Wes","Ximena","Yara","Zane"];
  var SCHOOLS=[["Riverbend","Hawks","#1d4ed8","#facc15"],["Maple Grove","Tigers","#ea580c","#111827"],["Lakeview","Lions","#7c3aed","#fbbf24"],["Cedar Hill","Wolves","#374151","#e5e7eb"],["Northgate","Knights","#0f766e","#f3f4f6"],["Brookside","Bears","#7f1d1d","#fde68a"],["Pine Ridge","Panthers","#111827","#22d3ee"],["Westwood","Wildcats","#15803d","#fef08a"],["Sunnyside","Stallions","#b45309","#fff7ed"],["Oak Park","Owls","#4338ca","#e0e7ff"],["Eastfield","Eagles","#0369a1","#fde047"],["Harbor","Huskies","#334155","#93c5fd"],["Stonebridge","Rams","#9a3412","#fed7aa"],["Willow Creek","Falcons","#166534","#bbf7d0"],["Silverlake","Sharks","#0e7490","#e0f2fe"],["Fairview","Foxes","#c2410c","#ffedd5"]];
  var SPONS=[["Brick City Bakery","#b45309"],["Northside Auto Glass","#1d4ed8"],["Vehicle City Hardware","#b91c1c"],["Riverside Dental","#0f766e"],["Main Street Print Shop","#7c3aed"],["Saginaw Street Pizza","#c2410c"],["Gearhead Garage","#374151"],["Lakeside Credit Union","#0369a1"],["Hometown Insurance","#15803d"],["Downtown Coffee Co.","#6b4423"]];
  function svgUrl(x){return "data:image/svg+xml,"+encodeURIComponent(x)}
  function mascotLogo(sc){var ini=sc[0].split(/\s+/).map(function(w){return w.charAt(0)}).join("").slice(0,2).toUpperCase();
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220"><path d="M100 6 L188 34 V110 C188 160 150 196 100 214 C50 196 12 160 12 110 V34 Z" fill="'+sc[2]+'" stroke="'+sc[3]+'" stroke-width="10"/>'+
      '<text x="100" y="118" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="78" fill="'+sc[3]+'">'+ini+'</text>'+
      '<rect x="22" y="138" width="156" height="34" fill="'+sc[3]+'"/><text x="100" y="164" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="24" letter-spacing="2" fill="'+sc[2]+'">'+sc[1].toUpperCase()+'</text></svg>')}
  function sponsorLogo(sp){var w=sp[0].split(" "),top=w.slice(0,Math.ceil(w.length/2)).join(" "),bot=w.slice(Math.ceil(w.length/2)).join(" ");
    return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140"><rect x="4" y="4" width="312" height="132" rx="18" fill="#fff" stroke="'+sp[1]+'" stroke-width="8"/>'+
      '<text x="160" y="66" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="34" fill="'+sp[1]+'">'+top.replace(/&/g,"&amp;")+'</text>'+
      '<text x="160" y="106" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="24" fill="#333">'+bot.replace(/&/g,"&amp;")+'</text></svg>')}
  function whenFRB(fn,n){if(window.FRB)return fn();if((n||0)>80){overlay("Couldn’t build the sample race. Reload the page and try again.",[["Reload",function(){location.reload()}]]);return}setTimeout(function(){whenFRB(fn,(n||0)+1)},100)}
  function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
  function fillSample(o){overlay("Filling the driver spots with sample racers…");
    var ads=(o.sponsors==="mine"&&REAL)?REAL.from("race_ads").select("*").order("sort_order"):Promise.resolve({data:[]});
    Promise.resolve(ads).then(function(ra){whenFRB(function(){FAKEDB.rpc("noop").then(function(){
      var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
      if(!T){overlay("Couldn’t start the practice copy in this browser. Turn off private browsing and try again.",[["Try again",showForm]]);return}
      var F=window.FRB,now=new Date().toISOString(),day=now.slice(0,10),R=[],B=[],H=[];
      var A=(o.sponsors==="mine"&&ra&&ra.data)?ra.data.filter(function(a){return a.active!==false}):[];
      if(o.sponsors!=="mine")A=SPONS.slice(0,o.nSpons).map(function(x,i){return{id:"sad"+i,name:x[0],tagline:null,logo_url:sponsorLogo(x),active:true,sort_order:i}});
      var names=shuffle(FIRST),L="ABCDEFGHJKLMNPRSTVW",sch=shuffle(SCHOOLS),cars=shuffle(Array.from({length:120},function(_,i){return i+1})),k=0;
      o.divs.forEach(function(d){if(d.n<2)return;var ids=[];
        for(var i=0;i<d.n;i++){var id="sr"+R.length,sc=sch[R.length%sch.length],sp=A.length?A[R.length%A.length]:null;
          R.push({id:id,display_name:names[k%names.length]+" "+L.charAt(Math.floor(Math.random()*L.length))+".",team:sc[0]+" "+sc[1],car_number:String(cars[k]),sponsor:sp?sp.name:null,division:d.name,logo_url:mascotLogo(sc),sample:true});k++;ids.push(id)}
        if(!o.draw)return;
        var n=ids.length,size=n<=4?4:n<=8?8:n<=16?16:n<=32?32:64,pairs=[];for(var j=0;j<size/2;j++)pairs.push([ids[j]||null,null]);
        ids.slice(size/2).forEach(function(id,j){pairs[j][1]=id});
        var b=F.build({name:d.name,kind:d.kind,cars:n,byes:size-n,wheel_swap:"2/4/2 Progressive",timing:"elapsed",race_date:day,pairs:pairs});b.bracket.sort_order=B.length+1;B.push(b.bracket);H=H.concat(b.heats)});
      if(H.length){F.order(H,B,"alt");H.sort(function(x,y){return x.sort_order-y.sort_order});H.forEach(function(h){h.updated_at=now})}
      T.race_racers=R;T.race_ads=A;T.race_brackets=B;T.race_heats=H;T.shoutouts=[];
      T.race_heat_ads=A.length?H.filter(function(h){return !F.isBye(h)}).map(function(h,i){return{heat_id:h.id,ad_id:A[i%A.length].id}}):[];
      T.race_state=[{id:1,live:false,current_heat:null,banner:null,updated_at:now}];
      T.race_show=[{id:1,screen:"race",takeover:"none",int_title:null,int_until:null,ad_strip:false,feature_ad:null,feature_at:null,hype_text:null,hype_at:null,fact_text:null,pinned_shout:null,slide_id:null,slide_at:null,lineup_slots:null,lineup_at:null,lineup_step:0,updated_at:now}];
      T.rehearsal_from=now;T.rehearsal_racers=R.length;T.rehearsal_sample=true;T.rehearsal_drawn=!!o.draw;
      try{localStorage.setItem(KEY,JSON.stringify(T))}catch(e){}
      history.replaceState(null,"",location.pathname+"#race-control");location.reload()})})})}
  /* The setup form: how many cars per division, elimination, sponsors, and whether to draw the brackets */
  function showForm(){var o=overlay("");o.querySelector("p").innerHTML='Fill the driver spots with fake racers from made-up schools, then run the race with your real run of show. Viewers never see it.';
    var row=o.querySelector(".row");row.innerHTML="";
    var f=el('<form class="reh-form" novalidate>'+
      [["Stock",8,"single"],["Super Stock",8,"double"],["Masters",6,"single"]].map(function(d,i){return '<fieldset class="reh-div"><legend>'+d[0]+'</legend><label>Cars <input type="number" min="0" max="32" value="'+d[1]+'" data-n="'+i+'"></label>'+
        '<label><select data-k="'+i+'"><option value="single"'+(d[2]==="single"?" selected":"")+'>Single elimination</option><option value="double"'+(d[2]==="double"?" selected":"")+'>Double elimination</option></select></label></fieldset>'}).join("")+
      '<fieldset class="reh-div"><legend>Sponsors &amp; ads</legend><label class="reh-r"><input type="radio" name="rsp" value="sample" checked> Sample sponsors <input type="number" min="0" max="10" value="6" id="rehNS"></label>'+
      '<label class="reh-r"><input type="radio" name="rsp" value="mine"> Use my Sponsors &amp; ads library</label></fieldset>'+
      '<label class="reh-r"><input type="checkbox" id="rehDraw" checked> Draw the brackets for me (untick to practice the bingo draw in Race control)</label>'+
      '<p class="reh-msg" role="status"></p><div class="row"><button class="btn deep" type="submit">Fill with fake racers</button><button class="btn" type="button" id="rehReal">Use my real racers instead</button></div></form>');
    row.appendChild(f);
    f.querySelector("#rehReal").onclick=importReal;
    f.onsubmit=function(e){e.preventDefault();var divs=["Stock","Super Stock","Masters"].map(function(nm,i){var n=Math.max(0,Math.min(32,parseInt(f.querySelector('[data-n="'+i+'"]').value,10)||0));return{name:nm,n:n,kind:f.querySelector('[data-k="'+i+'"]').value}});
      var tot=divs.reduce(function(t,d){return t+(d.n>=2?d.n:0)},0);
      if(!tot){f.querySelector(".reh-msg").textContent="Give at least one division 2 or more cars.";return}
      fillSample({divs:divs,sponsors:f.querySelector('input[name=rsp]:checked').value,nSpons:Math.max(0,Math.min(10,parseInt(f.querySelector("#rehNS").value,10)||0)),draw:f.querySelector("#rehDraw").checked})}}
  function choose(){showForm()}
  function start(){
    var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
    var wantSample=/[?&]sample=1/.test(location.search);
    if(wantSample&&!(T&&T.rehearsal_sample)){history.replaceState(null,"",location.pathname+location.hash);showForm();return}
    if(wantSample)history.replaceState(null,"",location.pathname+location.hash);
    if(!T||!T.rehearsal_from){choose();return}
    if(REAL)REAL.auth.getSession().then(function(r){window.FR_REH_SIGNED=!!(r&&r.data&&r.data.session);var c=document.querySelector(".fr-test");if(c&&!window.FR_REH_SIGNED){var w=c.querySelector(".reh-warn");if(w)w.hidden=false}});
  }

  /* The yellow note in the corner becomes the rehearsal toolbar */
  window.FR_REH_CHIP=function(c){var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
    c.classList.add("reh-chip");
    c.innerHTML='<b>Rehearsal</b><span>Practice race with '+((T&&T.rehearsal_sample)?'sample racers ('+((T&&T.rehearsal_racers)||0)+((T&&T.rehearsal_drawn)?', brackets already drawn':', draw the brackets in Race control')+')':'your real racers ('+((T&&T.rehearsal_racers)||0)+')')+'. Viewers can’t see it. Screens and the run of show you change here are saved for race day.</span>'+
      '<span class="reh-warn" hidden>You’re not signed in on flintracing.org, so screen and run-of-show changes won’t save. Sign in on the main site first.</span>'+
      '<nav class="reh-nav"><a href="#race-control">Race control</a><a href="#track-manager">Track operations</a><a href="#race-watch">Live screen</a></nav>'+
      '<div class="reh-btns"><button type="button" id="rehRun">▶ Auto-run the race</button><button type="button" id="rehSample">Sample racers…</button><button type="button" id="rehReal2">Use my real racers</button><button type="button" id="rehNew">Start over</button></div>';
    var run=c.querySelector("#rehRun"),nw=c.querySelector("#rehNew"),smp=c.querySelector("#rehSample");
    smp.onclick=function(){stopAuto();showForm()};
    var rl=c.querySelector("#rehReal2");rl.onclick=function(){if(rl.textContent!=="Confirm: copy my real racers"){rl.textContent="Confirm: copy my real racers";return}stopAuto();importReal()};
    run.onclick=function(){if(AUTO)stopAuto("Paused");else startAuto()};
    nw.onclick=function(){if(nw.textContent!=="Confirm: start over"){nw.textContent="Confirm: start over";return}stopAuto();try{localStorage.removeItem(KEY)}catch(e){}location.reload()};
    if(window.FR_REH_SIGNED===false)c.querySelector(".reh-warn").hidden=false};

  /* Auto-run: plays the race by itself with sample times, so you can watch the screens and the run of show */
  var AUTO=null,LASTSTEP=0;
  function say(t){if(window.FR_TOAST)window.FR_TOAST(t);else{var b=document.getElementById("rehRun");if(b)b.title=t}}
  function startAuto(){AUTO=setInterval(tick,2500);var b=document.getElementById("rehRun");if(b)b.textContent="⏸ Pause auto-run";say("Auto-run started. Open the Live screen to watch.");tick()}
  function stopAuto(msg){clearInterval(AUTO);AUTO=null;var b=document.getElementById("rehRun");if(b)b.textContent="▶ Auto-run the race";if(msg)say(msg)}
  function rnd(){return Math.round((27+Math.random()*3)*1000)/1000}
  function tick(){var db=window.FR_DB,FRB=window.FRB,FRSL=window.FRSL;if(!db||!FRB||!FRSL)return;
    Promise.all([db.from("race_state").select("*").eq("id",1).maybeSingle(),db.from("race_heats").select("*").order("sort_order"),db.from("race_show").select("*").eq("id",1).maybeSingle(),db.from("race_lineup").select("*").order("position")]).then(function(r){
      var st=r[0].data||{},H=r[1].data||[],sh=r[2].data||{},L=r[3].data||[],now=new Date().toISOString();
      var real=H.filter(function(h){return !FRB.isBye(h)});
      if(!real.length){stopAuto("Build the brackets first: Race control → Brackets, then do the bingo draw.");return}
      var noop=function(){},up=function(id,rec){rec.updated_at=now;return db.from("race_heats").update(rec).eq("id",id).then(function(x){return x})};
      if(!st.live){db.from("race_state").update({live:true,updated_at:now}).eq("id",1).then(function(){return db.rpc("race_lineup_fire",{p_slots:"start"})});return}
      var cur=H.filter(function(h){return h.id===st.current_heat})[0];
      if(sh.takeover==="slide")return; /* a special screen is up by hand: wait until someone goes back to racing */
      if(sh.takeover==="lineup"){var n=FRSL.lineupNow(sh,L);var started=cur&&["staging","set","racing"].indexOf(cur.status)>=0&&cur.updated_at&&new Date(cur.updated_at)>new Date(sh.lineup_at);
        if(n&&!started){var since=Date.now()-Math.max(+new Date(sh.lineup_at),LASTSTEP);if(since>6000){LASTSTEP=Date.now();db.from("race_show").update({lineup_step:n.i+1,lineup_at:now,updated_at:now}).eq("id",1).then(noop)}return}}
      if(!cur||cur.status==="finished"){var ready=real.filter(function(h){return h.status!=="finished"&&h.lane1&&h.lane2});
        if(!ready.length){if(!real.some(function(h){return h.status!=="finished"}))stopAuto("That’s the whole race. Press Start over to run it again.");return}
        var nx=ready[0];up(nx.id,{status:"staging",run:1}).then(function(){return db.from("race_state").update({current_heat:nx.id,updated_at:now}).eq("id",1).then(noop)});return}
      var s=cur.status||"upcoming";
      if(s==="upcoming"){up(cur.id,{status:"staging"});return}
      if(s==="staging"){up(cur.id,{status:"set"});return}
      if(s==="set"){up(cur.id,{status:"racing"});return}
      if((cur.run||1)===1){var a=rnd(),b=rnd();up(cur.id,{a_time1:a,b_time1:b,diff1:Math.round((b-a)*1000)/1000,run:2,status:"staging",started_at:cur.started_at||now});return}
      var trial=JSON.parse(JSON.stringify(H)),res=FRB.post(trial,cur.id,{a1:cur.a_time1,b1:cur.b_time1,a2:rnd(),b2:rnd()});
      if(res.error){stopAuto("Auto-run stopped: "+res.error);return}
      Promise.all(res.changed.map(function(h){var row=FRB.row(h);row.updated_at=now;return db.from("race_heats").update(row).eq("id",h.id)})).then(function(){
        var N=FRB.numbers(trial),hn=N[cur.id],left=trial.some(function(x){return !FRB.isBye(x)&&x.status!=="finished"});
        return db.rpc("race_lineup_fire",{p_slots:(hn?String(hn):"")+(left?"":(hn?",":"")+"end")})})});
  }
})();
