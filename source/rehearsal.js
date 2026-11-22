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
        T.rehearsal_from=now;T.rehearsal_racers=T.race_racers.length;
        try{localStorage.setItem(KEY,JSON.stringify(T))}catch(e){}
        location.reload()})})}

  /* Sample racers: a full made-up field with brackets already drawn, so the whole day can be run and previewed */
  var SAMPLE=[["Stock","single",["Maya R.","Northside Rockets"],["Jalen T.","Eastside Thunder"],["Ava M.","Calvin's Crew"],["Noah P.","Gravity Gang"],["Zoe K.","Flint Flyers"],["Eli W.","Red Line Racing"],["Mia S.","Brick Street Builders"],["Leo D.","Vehicle City Velocity"]],
    ["Super Stock","double",["Aria J.","Hilltop Hustle"],["Caleb B.","Southside Speed"],["Nora F.","Checkered Dreams"],["Owen G.","Downhill Dynamos"],["Lila H.","Pit Row Pals"],["Isaiah C.","Saginaw Street Sprinters"],["Ruby N.","Gear Grinders"],["Miles A.","Bumper to Bumper"]],
    ["Masters","single",["Jada L.","Carriage Town Crew"],["Xavier M.","Thread Lake Thunder"],["Hazel Q.","Chevy Commons Chargers"],["Isaac V.","Mott Park Movers"],["Gianna E.","Kearsley Kruisers"],["Theo Y.","Riverbank Racers"]]];
  var SPONS=["Goyette Mechanical","Ideal Group","United Way","Motor City Signs","Graphics Galore","Behind Your Design"];
  function whenFRB(fn,n){if(window.FRB)return fn();if((n||0)>80){overlay("Couldn’t build the sample race. Reload the page and try again.",[["Reload",function(){location.reload()}]]);return}setTimeout(function(){whenFRB(fn,(n||0)+1)},100)}
  function fillSample(){overlay("Filling the practice race with sample racers…");
    var ads=REAL?REAL.from("race_ads").select("*").order("sort_order"):Promise.resolve({data:[]});
    Promise.resolve(ads).then(function(ra){whenFRB(function(){FAKEDB.rpc("noop").then(function(){
      var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
      if(!T){overlay("Couldn’t start the practice copy in this browser. Turn off private browsing and try again.",[["Try again",fillSample]]);return}
      var F=window.FRB,now=new Date().toISOString(),day=now.slice(0,10),R=[],B=[],H=[],car=2;
      var A=(ra&&ra.data&&ra.data.length)?ra.data:[];
      if(!A.length){var P=[];((window.FR&&window.FR.PARTNERS)||[]).forEach(function(pg){pg.forEach(function(x){if(x.img&&!/your logo/i.test(x.name))P.push(x)})});
        A=P.slice(0,6).map(function(x,i){return{id:"sad"+i,name:x.name,tagline:null,logo_url:x.img,active:true,sort_order:i}})}
      var sp=A.length?A.map(function(a){return a.name}):SPONS;
      SAMPLE.forEach(function(d,bi){var ids=[];d.slice(2).forEach(function(x){var id="sr"+R.length,s=sp[R.length%sp.length],m=A.filter(function(a){return a.name===s})[0];
          R.push({id:id,display_name:x[0],team:x[1],car_number:String(car),sponsor:s,division:d[0],logo_url:m?m.logo_url:null,sample:true});car+=Math.random()<.5?3:5;ids.push(id)});
        var n=ids.length,size=n<=4?4:n<=8?8:16,byes=size-n,pairs=[];for(var i=0;i<size/2;i++)pairs.push([ids[i]||null,null]);
        ids.slice(size/2).forEach(function(id,j){pairs[j][1]=id});
        var b=F.build({name:d[0],kind:d[1],cars:n,byes:byes,wheel_swap:"2/4/2 Progressive",timing:"elapsed",race_date:day,pairs:pairs});b.bracket.sort_order=bi+1;B.push(b.bracket);H=H.concat(b.heats)});
      F.order(H,B,"alt");H.sort(function(x,y){return x.sort_order-y.sort_order});H.forEach(function(h){h.updated_at=now});
      T.race_racers=R;T.race_ads=A;T.race_brackets=B;T.race_heats=H;T.shoutouts=[];
      T.race_heat_ads=A.length?H.filter(function(h){return !F.isBye(h)}).map(function(h,i){return{heat_id:h.id,ad_id:A[i%A.length].id}}):[];
      T.race_state=[{id:1,live:false,current_heat:null,banner:null,updated_at:now}];
      T.race_show=[{id:1,screen:"race",takeover:"none",int_title:null,int_until:null,ad_strip:false,feature_ad:null,feature_at:null,hype_text:null,hype_at:null,fact_text:null,pinned_shout:null,slide_id:null,slide_at:null,lineup_slots:null,lineup_at:null,lineup_step:0,updated_at:now}];
      T.rehearsal_from=now;T.rehearsal_racers=R.length;T.rehearsal_sample=true;
      try{localStorage.setItem(KEY,JSON.stringify(T))}catch(e){}
      history.replaceState(null,"",location.pathname+"#race-control");location.reload()})})})}
  function choose(){overlay("Practice a whole race day in this browser. Viewers never see it. Use your real racer list, or fill it with made-up racers and ready-made brackets to preview the screens and controls.",
    [["Use sample racers",fillSample],["Use my real racers",importReal]])}
  function start(){
    var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
    var wantSample=/[?&]sample=1/.test(location.search);
    if(wantSample&&!(T&&T.rehearsal_sample)){history.replaceState(null,"",location.pathname+location.hash);fillSample();return}
    if(wantSample)history.replaceState(null,"",location.pathname+location.hash);
    if(!T||!T.rehearsal_from){choose();return}
    if(REAL)REAL.auth.getSession().then(function(r){window.FR_REH_SIGNED=!!(r&&r.data&&r.data.session);var c=document.querySelector(".fr-test");if(c&&!window.FR_REH_SIGNED){var w=c.querySelector(".reh-warn");if(w)w.hidden=false}});
  }

  /* The yellow note in the corner becomes the rehearsal toolbar */
  window.FR_REH_CHIP=function(c){var T=null;try{T=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
    c.classList.add("reh-chip");
    c.innerHTML='<b>Rehearsal</b><span>Practice race with '+((T&&T.rehearsal_sample)?'sample racers ('+((T&&T.rehearsal_racers)||0)+', brackets already drawn)':'your real racers ('+((T&&T.rehearsal_racers)||0)+')')+'. Viewers can’t see it. Screens and the run of show you change here are saved for race day.</span>'+
      '<span class="reh-warn" hidden>You’re not signed in on flintracing.org, so screen and run-of-show changes won’t save. Sign in on the main site first.</span>'+
      '<nav class="reh-nav"><a href="#race-control">Race control</a><a href="#track-manager">Track operations</a><a href="#race-watch">Live screen</a></nav>'+
      '<div class="reh-btns"><button type="button" id="rehRun">▶ Auto-run the race</button><button type="button" id="rehSample">Fill with sample racers</button><button type="button" id="rehNew">Start over</button></div>';
    var run=c.querySelector("#rehRun"),nw=c.querySelector("#rehNew"),smp=c.querySelector("#rehSample");
    smp.onclick=function(){if(smp.textContent!=="Confirm: sample racers"){smp.textContent="Confirm: sample racers";return}stopAuto();fillSample()};
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
