/* ===== TEST MODE (Claude preview only) =====
   Stands in for Supabase so the admin portal, editing, events, notes and the questionnaire can be
   tried without a login. Everything is saved only in this browser (localStorage). */
(function(){
  window.FR_TEST=true;
  var KEY="fr-test-db-v1", T=null;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(T))}catch(e){}}
  function load(){try{var s=localStorage.getItem(KEY);if(s)T=JSON.parse(s)}catch(e){}}
  function seed(){
    var ev=(window.FR&&window.FR.EVENTS)||[];
    T={events:ev.map(function(e,i){return{id:"ev"+i,start_date:e.d,end_date:e.e||null,title:e.t,kind:e.k,to_be_confirmed:!!e.tbc,published:true,description:null,created_at:new Date().toISOString()}}),
       bulletin_notes:[],site_content:[],admins:[{user_id:"test-admin"}],
       inquiries:[{id:"inq-sample",created_at:new Date().toISOString(),first_name:"Sample",last_name:"Family",role:"Parent or guardian",organization:null,
         interests:"Building Workshops",youth_count:2,youth_ages:"9 and 12",message:"This is a sample inquiry so you can see how they look.",email:"sample@example.com",
         phone:null,contact_by:"Email",best_time:"Evening",email_updates:true,status:"new"}]};
    race(); members(); council(); hoursSeed(); T.council_reports=[]; T.gallery_photos=[]; T.council_task_hours=[]; T.council_service_reports=[]; save();
  }
  /* Demo race day so the live race page and its controls can be tried.
     Two brackets alternate: Super Stock (double elimination, 6 cars + 2 byes) and Masters (single elimination, 5 cars + 3 byes). */
  function race(){
    var F=window.FRB; if(!F){T.race_racers=[];T.race_heats=[];T.race_brackets=[];T.race_state=[{id:1,live:false}];T.shoutouts=[];return}
    var R=[["Maya R.","Northside Rockets","12","Goyette Mechanical","Super Stock"],["Jalen T.","Eastside Thunder","7","Ideal Group","Super Stock"],
      ["Ava M.","Calvin's Crew","21","United Way","Super Stock"],["Noah P.","Gravity Gang","3","Motor City Signs","Super Stock"],
      ["Zoe K.","Flint Flyers","44","Graphics Galore","Super Stock"],["Eli W.","Red Line Racing","18","Behind Your Design","Super Stock"],
      ["Mia S.","Brick Street Builders","9","Moonwalk Man","Masters"],["Leo D.","Vehicle City Velocity","30","Flint Community Schools","Masters"],
      ["Aria J.","Hilltop Hustle","15","Goyette Mechanical","Masters"],["Caleb B.","Southside Speed","27","Ideal Group","Masters"],["Nora F.","Checkered Dreams","5","United Way","Masters"]];
    T.race_racers=R.map(function(x,i){return{id:"rr"+i,display_name:x[0],team:x[1],car_number:x[2],sponsor:x[3],division:x[4]}});
    var day=new Date().toISOString().slice(0,10),a=F.build({name:"Super Stock",kind:"double",cars:6,byes:2,wheel_swap:"2/4/2 Progressive",timing:"elapsed",race_date:day,pairs:[["rr0","rr1"],["rr2","rr3"],["rr4",null],["rr5",null]]}),
        b=F.build({name:"Masters",kind:"single",cars:5,byes:3,wheel_swap:"2/4/2 Progressive",timing:"elapsed",race_date:day,pairs:[["rr6","rr7"],["rr8",null],["rr9",null],["rr10",null]]});
    a.bracket.sort_order=1;b.bracket.sort_order=2;
    var H=a.heats.concat(b.heats); F.order(H,[a.bracket,b.bracket],"alt"); H.sort(function(x,y){return x.sort_order-y.sort_order});
    /* race the first three heats, then put the fourth on the ramp for run 2 */
    var times=[[28.412,28.977,28.501,28.870],[28.851,28.603,28.790,28.655],[29.104,29.380,29.012,29.250]],n=0,cur=null;
    H.forEach(function(h){if(F.isBye(h)||cur)return;if(!h.lane1||!h.lane2)return;
      if(n<3){var t=times[n++];F.post(H,h.id,{a1:t[0],b1:t[1],a2:t[2],b2:t[3]})} else {cur=h;h.run=2;h.status="staging";h.a_time1=28.66;h.b_time1=28.94;h.diff1=0.28;h.started_at=new Date().toISOString()}});
    var now=Date.now();H.forEach(function(h,i){h.updated_at=new Date(now-(60-i)*6e4).toISOString()});
    T.race_brackets=[a.bracket,b.bracket]; T.race_heats=H;
    var P=[];((window.FR&&window.FR.PARTNERS)||[]).forEach(function(pg){pg.forEach(function(p){if(p.img&&!/your logo/i.test(p.name))P.push(p)})});
    T.race_ads=P.slice(0,6).map(function(p,i){return{id:"ad"+i,name:p.name,tagline:i===0?"Proud to support Flint racers":null,logo_url:p.img,active:true,sort_order:i}});
    T.race_racers.forEach(function(x,i){var m=T.race_ads.filter(function(a){return a.name.toLowerCase().indexOf(x.sponsor.split(" ")[0].toLowerCase())>=0})[0];if(m)x.logo_url=m.logo_url});
    T.race_heat_ads=T.race_ads.length?H.filter(function(h){return !F.isBye(h)}).map(function(h,i){return{heat_id:h.id,ad_id:T.race_ads[i%T.race_ads.length].id}}):[];
    T.race_show=[{id:1,screen:"race",int_title:null,int_until:null,ad_strip:true,feature_ad:null,feature_at:null,hype_text:null,hype_at:null,fact_text:"Soap box cars have no engines. Gravity does all the work.",pinned_shout:null}];
T.race_slides=[{id:"sl1",name:"National Anthem",kind:"anthem",bg:"#0b1f4d",effect:"stars",flag_in:true,sort_order:1,updated_at:new Date().toISOString(),elements:[{id:"t1",type:"text",x:10,y:30,w:80,h:20,text:"Please rise for our National Anthem",size:7,color:"#ffffff",bold:true,align:"center",anim:"fade"},{id:"t2",type:"text",x:15,y:55,w:70,h:12,text:"Hats off · Face the flag",size:3.6,color:"#ffd166",bold:false,align:"center",anim:"rise"}]},
 {id:"sl2",name:"Closing Ceremony",kind:"closing",bg:"#2a1216",effect:"fireworks",flag_in:true,sort_order:2,updated_at:new Date().toISOString(),elements:[{id:"t1",type:"text",x:8,y:28,w:84,h:20,text:"Thank you for racing with us!",size:7,color:"#ffffff",bold:true,align:"center",anim:"zoom"},{id:"t2",type:"text",x:15,y:55,w:70,h:12,text:"Closing ceremony and awards are starting",size:3.6,color:"#ffd166",bold:false,align:"center",anim:"rise"}]},
 {id:"sl3",name:"Emergency",kind:"emergency",bg:"#c8102e",effect:"alert",flag_in:false,sort_order:3,updated_at:new Date().toISOString(),elements:[{id:"t1",type:"text",x:6,y:22,w:88,h:22,text:"RACING IS PAUSED",size:9,color:"#ffffff",bold:true,align:"center",anim:"pulse"},{id:"t2",type:"text",x:10,y:52,w:80,h:22,text:"Please stay where you are and follow instructions from race staff.",size:4,color:"#ffffff",bold:false,align:"center",anim:"none"}]}];
    T.race_roles=[];
    T.staff=[{user_id:"test-admin",role:"workshop",email:"test-admin@flintracing.org"},{user_id:"test-admin",role:"photographer",email:"test-admin@flintracing.org"},{user_id:"test-admin",role:"teacher",email:"test-admin@flintracing.org"}];
    T.race_volunteers=[{id:"rv1",created_at:new Date().toISOString(),first_name:"Dana",last_name:"Brooks",email:"dana@example.com",phone:null,area:"track",shift:"All day",notes:"Ran the starting ramp last year",over18:true,status:"new"},
      {id:"rv2",created_at:new Date().toISOString(),first_name:"Marcus",last_name:"Lee",email:"marcus@example.com",phone:"810-555-0100",area:"event",shift:"Morning",notes:null,over18:true,status:"confirmed",assigned_area:"event",role:"Check-in table",assignment:"Welcome tent at 7:45 AM.",link_token:"demo0crew0link0marcus0000"}];
    T.spirit_items=Array.prototype.slice.call(document.querySelectorAll("#spGrid .sp-item")).map(function(el,i){var art=el.querySelector(".sp-art"),sm=art.querySelector("small"),b=art.querySelector("b");
      return {id:"sp"+i,name:el.querySelector("h3").textContent,category:el.getAttribute("data-cat"),description:(el.querySelector(".sp-body p")||{}).textContent||null,art_text:b?b.innerHTML.replace(/<br>/g,"\n"):null,badge:sm?sm.textContent:null,style:(art.className.match(/a[1-4]/)||["a1"])[0],image_url:null,sort_order:i,visible:true}});
    T.code_sessions=[];T.crew_codes={};
    T.news_posts=[];T.resources=[];T.albums=[];T.album_photos=[];T.teacher_plans=[];T.workshop_signins=[];T.event_details=(T.events||[]).filter(function(e){return /STEAM|Building Workshop/.test(e.title)}).slice(0,3).map(function(e){var b=/Building/.test(e.title);return{event_id:e.id,start_time:b?"9:00 AM":"10:00 AM",end_time:b?"1:00 PM":"12:00 PM",location:"Demo location (test mode)",notes:b?"Wear closed-toe shoes.":"Lunch provided."}});
    T.race_state=[{id:1,live:true,current_heat:cur?cur.id:null,banner:"DEMO RACE (test mode only). These names and times are made up.",updated_at:new Date().toISOString()}];
    var t=Date.now();
    T.shoutouts=[{id:"so1",name:"Grandma Pat",message:"Go Maya! The whole family is cheering at the finish line!",status:"approved",created_at:new Date(t-3e5).toISOString()},
      {id:"so2",name:"Coach Dee",message:"So proud of every builder out there today. You earned this ride.",status:"approved",created_at:new Date(t-2e5).toISOString()},
      {id:"so3",name:"Northside families",message:"Thank you volunteers for keeping the track running!",status:"approved",created_at:new Date(t-1e5).toISOString()},
      {id:"so4",name:"Uncle Ray",message:"Waiting for review: approve me in Track operations.",status:"pending",created_at:new Date(t).toISOString()}];
  }
  /* Demo member profiles (username + passcode). Passcode for every demo profile: racing26 */
  function members(){var now=Date.now(),d=function(days,h){return new Date(now-days*864e5+(h||0)*36e5).toISOString()};
    T.members=[{id:"m1",username:"taylorfamily",display_name:"Jordan Taylor",kind:"family",email:"jordan@example.com",phone:"810-555-0142",kids:[{name:"Maya T.",age:"11"},{name:"Eli T.",age:"8"}],requested:["family"],roles:["family"],status:"approved",about:null,admin_note:null,first_year:2025,created_at:d(400),approved_at:d(399),last_seen_at:d(2)},
      {id:"m2",username:"samrivera",display_name:"Sam Rivera",kind:"crew",email:"sam@example.com",phone:null,kids:[],requested:["volunteer","workshop","photographer"],roles:["volunteer","workshop","photographer"],status:"approved",about:"Former racer, happy to help anywhere.",admin_note:null,first_year:2026,created_at:d(120),approved_at:d(119),last_seen_at:d(5)},
      {id:"m3",username:"morganfam",display_name:"Alex Morgan",kind:"family",email:"alex@example.com",phone:null,kids:[{name:"Zoe M.",age:"10"}],requested:["family"],roles:[],status:"pending",about:"Heard about you at school.",admin_note:null,first_year:2026,created_at:d(1),approved_at:null,last_seen_at:null},
      {id:"m4",username:"coachdee",display_name:"Dee Williams",kind:"crew",email:"dee@example.com",phone:"810-555-0199",kids:[],requested:["teacher","volunteer"],roles:[],status:"pending",about:"Science teacher at Northside.",admin_note:null,first_year:2026,created_at:d(0,-3),approved_at:null,last_seen_at:null}];
    T.mpass={m1:"racing26",m2:"racing26",m3:"racing26",m4:"racing26"};T.msess={};
    T.member_hours=[{id:"h1",member_id:"m1",kind:"workshop",started_at:d(30,-1),ended_at:d(30,2),note:null,added_by:"self"},{id:"h2",member_id:"m1",kind:"workshop",started_at:d(16,-1),ended_at:d(16,2),note:null,added_by:"self"},
      {id:"h3",member_id:"m1",kind:"race_day",started_at:d(160,-4),ended_at:d(160,4),note:null,added_by:"admin"},{id:"h4",member_id:"m2",kind:"workshop",started_at:d(16,-2),ended_at:d(16,2),note:null,added_by:"self"},
      {id:"h5",member_id:"m2",kind:"event",started_at:d(9,-3),ended_at:d(9,1),note:null,added_by:"self"}];
    T.access_log=[{id:"l0",at:new Date().toISOString(),member_id:null,who:"Kevin C.",action:"admin_sign_in",detail:"kevin@example.com"},{id:"l1",at:d(0,-3),member_id:"m4",who:"coachdee",action:"register",detail:"crew"},{id:"l2",at:d(1),member_id:"m3",who:"morganfam",action:"register",detail:"family"},
      {id:"l3",at:d(2,1),member_id:"m1",who:"taylorfamily",action:"view:dates",detail:null},{id:"l4",at:d(2),member_id:"m1",who:"taylorfamily",action:"sign_in",detail:"kept signed in"},
      {id:"l5",at:d(3),member_id:null,who:"taylorfam",action:"signin_failed",detail:"unknown username"},{id:"l6",at:d(5),member_id:"m2",who:"samrivera",action:"sign_in",detail:"this visit"}];
  }
  function hoursSeed(){var dd=function(n){var x=new Date(Date.now()-n*864e5);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
    T.council_meetings=[{id:"mt1",meeting_date:dd(3),title:"Leadership meeting",hours:1,author_name:"Marcus Lee",created_by_member:"m6",created_at:new Date().toISOString()},{id:"mt2",meeting_date:dd(10),title:"Leadership meeting",hours:1,author_name:"Marcus Lee",created_by_member:"m6",created_at:new Date().toISOString()}];
    T.council_attendance=[{id:"at1",member_id:"m5",source:"meeting",ref_id:"mt2",kind:"meeting",session_date:dd(10),title:"Leadership meeting",hours:1,status:"verified",verified_by:"Marcus Lee",created_at:new Date().toISOString()},
      {id:"at2",member_id:"m8",source:"meeting",ref_id:"mt2",kind:"meeting",session_date:dd(10),title:"Leadership meeting",hours:1,status:"pending",verified_by:null,created_at:new Date().toISOString()}];
    T.council_race=[];}
  /* Demo Student Leadership Council: 4 students (passcode racing26), officers, projects, weekly tasks, a bulletin and posts */
  function council(){var now=Date.now(),d=function(days){return new Date(now-days*864e5).toISOString()},day=function(n){var x=new Date(now+n*864e5);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")},
      mon=function(){var x=new Date();x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}();
    T.members=T.members||[];T.mpass=T.mpass||{};
    [["m5","avaj","Ava Johnson"],["m6","marcusl","Marcus Lee"],["m7","priyas","Priya Shah"],["m8","dantet","Dante Torres"]].forEach(function(x,i){if(T.members.some(function(m){return m.id===x[0]}))return;
      T.members.push({id:x[0],username:x[1],display_name:x[2],kind:"crew",email:x[1]+"@example.com",phone:null,kids:[],requested:["council"],roles:["council","volunteer"],status:"approved",about:"Racer since middle school.",admin_note:null,first_year:2023,created_at:d(200),approved_at:d(199),last_seen_at:d(i)});T.mpass[x[0]]="racing26"});
    var st=function(who){var m=T.members.filter(function(x){return x.id===who})[0];return{created_by_member:who,created_by_user:"anon-"+who,author_name:m?m.display_name:"Admin"}};
    T.council_officers=[{position:"president",member_id:"m5",elected_on:day(-60)},{position:"secretary",member_id:"m6",elected_on:day(-60)},{position:"treasurer",member_id:"m7",elected_on:day(-60)},{position:"note_keeper",member_id:"m6",elected_on:day(-60)},{position:"media_manager",member_id:"m8",elected_on:day(-60)}];
    T.council_roles=[Object.assign({id:"cr1",member_id:"m7",title:"Video editor",about:null,status:"approved",decided_by:"Ava Johnson",created_at:d(30)},st("m7")),Object.assign({id:"cr2",member_id:"m8",title:"Event lead",about:"I ran the bake sale last year.",status:"pending",created_at:d(1)},st("m8"))];
    T.council_projects=[Object.assign({id:"cp1",title:"Spring Kickoff Night",kind:"event",description:"An open house for new families: car display, a short video and sign-ups for building workshops.",lead_member:"m5",lead_only:true,status:"active",due_date:null,event_date:day(24),event_time:"6–8 pm",location:"Flint Racing garage",funding_goal:300,created_at:d(20),updated_at:d(1)},st("m5")),
      Object.assign({id:"cp2",title:"How to align your axles (video)",kind:"instructional",description:"A 3-minute how-to video for first-year racers.",lead_member:"m7",lead_only:false,status:"planning",due_date:day(14),event_date:null,funding_goal:0,created_at:d(10),updated_at:d(2)},st("m7"))];
    var t=function(id,pid,title,who,due,done,wk){return Object.assign({id:id,project_id:pid,week_of:wk||null,title:title,assignee_member:who,due_date:due,done:!!done,done_by:done?"Ava Johnson":null,done_at:done?d(1):null,sort_order:0,created_at:d(5)},st("m5"))};
    T.council_tasks=[t("ct1","cp1","Book the garage",  "m5",day(-3),true),t("ct2","cp1","Make the sign-up sheet","m6",day(4)),t("ct3","cp1","Order snacks","m7",day(10)),t("ct4","cp1","Cut a 60-second promo video","m8",day(12)),
      t("ct5","cp2","Write the script","m7",day(3),true),t("ct6","cp2","Film the steps","m8",day(8)),
      t("ct7",null,"Post meeting notes","m6",null,true,mon),t("ct8",null,"Share one workshop photo","m8",null,false,mon),t("ct9",null,"Check in with your project team",null,null,false,mon)];
    T.council_materials=[Object.assign({id:"cm1",project_id:"cp1",item:"Snacks and juice",qty:"for 60",est_cost:120,status:"needed",source:null,created_at:d(4)},st("m5")),Object.assign({id:"cm2",project_id:"cp1",item:"Poster board",qty:"6",est_cost:30,status:"have",source:"Donated",created_at:d(4)},st("m5")),
      Object.assign({id:"cm3",project_id:"cp2",item:"Phone tripod",qty:"1",est_cost:25,status:"requested",source:"Ask Kevin",created_at:d(3)},st("m7"))];
    T.council_funding=[Object.assign({id:"cf1",project_id:"cp1",source:"Bake sale",amount:140,kind:"received",note:null,created_at:d(6)},st("m7")),Object.assign({id:"cf2",project_id:"cp1",source:"Goyette Mechanical",amount:100,kind:"pledged",note:null,created_at:d(3)},st("m7"))];
    T.council_bulletins=[Object.assign({id:"cb1",week_of:mon,title:"Kickoff planning + video crew",body:"Great meeting! We picked a date for Spring Kickoff Night and split into two teams.\n\nReminder: bring your photo release forms next week.",links:[{title:"Meeting agenda",url:"https://example.com/agenda"}],created_at:d(1),updated_at:d(1)},st("m6"))];
    T.council_files=[];T.council_social=[Object.assign({id:"cs1",caption:"Our racers are building! 🏁 Building workshops run every Saturday. #FlintRacing #STEM",platforms:["Instagram","Facebook"],post_on:day(3),project_id:null,media:[],link:null,status:"ready",review_note:null,posted_url:null,created_at:d(1),updated_at:d(1)},st("m8"))];
    T.council_threads=[Object.assign({id:"th1",project_id:null,kind:"discussion",title:"Ideas for our next instructional?",body:"After the axle video, what should we teach next? I was thinking brakes or weight placement.",pinned:false,created_at:d(2),last_reply_at:d(1)},st("m7")),
      Object.assign({id:"th2",project_id:"cp1",kind:"update",title:null,body:"Garage is booked! Next up: sign-up sheet and snacks.",pinned:false,created_at:d(1),last_reply_at:d(1)},st("m5"))];
    T.council_replies=[Object.assign({id:"rp1",thread_id:"th1",body:"Weight placement! Everyone asks about it.",created_at:d(1)},st("m8"))];
  }
  load();
  if(T&&(!T.race_show||!T.staff||!T.crew_codes)){race();save();}
  if(T&&!T.members){members();save();}
  if(T&&!T.council_officers){council();save();}
  if(T&&!T.council_meetings){hoursSeed();save();}
  if(T&&!T.council_reports){T.council_reports=[];save();}
  if(T&&!T.gallery_photos){T.gallery_photos=[];save();}
  if(T&&!T.council_task_hours){T.council_task_hours=[];T.council_service_reports=[];save();}
  addEventListener("storage",function(e){if(e.key===KEY)load()});

  /* ---- Email (preview): nothing is really sent. Messages land in a pretend "Sent mail" list. ---- */
  var SITE="https://flintracing.org";
  function emailSeed(){var sig="\n\nFlint Racing and STEM";
    return {settings:{on:true,from_name:"Flint Racing & STEM",from_addr:"hello@flintracing.org",reply_to:"info@flintsoapbox.org",footer:"Flint Racing & STEM · Flint, Michigan · flintracing.org"},
      provider:{ready:true,at:new Date().toISOString(),note:""},me:{events:["inquiry","profile","kiosk","registration","volunteer"],send_to:""},
      templates:[
        {key:"inquiry_reply",name:"Thanks for reaching out",audience:"inquiry",hint:"A first reply to anyone who fills out the questionnaire.",subject:"Thanks for reaching out to Flint Racing and STEM",auto_event:"inquiry_new",auto_send:false,
          body:"Hi {{first_name}},\n\nThank you for reaching out to Flint Racing and STEM. We received your note about {{interests}} and we're glad you're interested.\n\nSomeone from our team will follow up with you personally with next steps. In the meantime, you can see what's coming up on our calendar:\n{{calendar_link}}\n\nIf you have questions, just reply to this email."+sig},
        {key:"account_invite",name:"Create your account (instructions)",audience:"inquiry",hint:"Invites a family or volunteer to register a profile, with step-by-step instructions.",subject:"Next step: create your Flint Racing account",auto_event:null,auto_send:false,
          body:"Hi {{first_name}},\n\nThanks for your interest in Flint Racing and STEM. The next step is to create your free account, which takes about two minutes:\n\n1. Go to {{register_link}}\n2. Choose Family (for racers and their grown-ups) or Crew (for volunteers and helpers).\n3. Enter your name and email, then pick a 4-digit code you'll remember. That code is how you sign in.\n4. Press Register.\n\nWe review every new profile, usually within a few days, and email you as soon as it's approved. After that you can sign in to see workshop dates, times and places.\n\nIf you get stuck, just reply to this email."+sig},
        {key:"reg_link_race",name:"Race registration form",audience:"inquiry",hint:"Sends the official race registration form link. Send after you confirm their place.",subject:"2027 Flint Soap Box Derby race registration",auto_event:null,auto_send:false,
          body:"Hi {{first_name}},\n\nThanks for reaching out to Flint Racing and STEM. To complete race registration, please fill out and sign the official All-American Soap Box Derby Local Race Registration Form here:\n\n{{race_link}}\n\nA parent or guardian needs to complete and sign their section. Reply to this email with any questions."+sig},
        {key:"reg_link_workshop",name:"Building workshop registration form",audience:"inquiry",hint:"Sends the building workshop registration form link. Send after you confirm their place.",subject:"Flint Racing building workshop registration",auto_event:null,auto_send:false,
          body:"Hi {{first_name}},\n\nThanks for reaching out to Flint Racing and STEM. To complete building workshop registration, please fill out and sign the official All-American Soap Box Derby registration form, along with the T-shirt size and safe check-in details, here:\n\n{{workshop_link}}\n\nA parent or guardian needs to complete and sign their section. Reply to this email with any questions."+sig},
        {key:"account_received",name:"We received your profile",audience:"member",hint:"Lets a new family or crew member know their profile is waiting for review.",subject:"We received your Flint Racing profile",auto_event:"member_new",auto_send:false,
          body:"Hi {{first_name}},\n\nThanks for registering with Flint Racing and STEM. Your profile is in, and our team reviews every new profile, usually within a few days.\n\nYou'll get another email as soon as it's approved. Nothing else is needed from you right now.\n\nIf you have questions, just reply to this email."+sig},
        {key:"account_approved",name:"Account approved (sign-in instructions)",audience:"member",hint:"Tells them they're approved and how to sign in. It never includes their code.",subject:"Your Flint Racing account is ready",auto_event:"member_approved",auto_send:false,
          body:"Hi {{first_name}},\n\nGood news: your Flint Racing and STEM profile is approved. Here's how to sign in:\n\n1. Go to {{sign_in_link}}\n2. Choose the {{pass_name}}.\n3. Enter your email address and the 4-digit code you picked when you registered.\n\nOnce you're in, your dashboard shows workshop dates, times and places, and you can choose which emails you get from us. Families use the same 4-digit code to check in at the workshop kiosk.\n\nForgot your code? Reply to this email and we'll help you reset it."+sig},
        {key:"registration_received",name:"We received your registration form",audience:"registration",hint:"Confirms a signed race or building workshop registration form.",subject:"We received the registration for {{participant}}",auto_event:"registration_new",auto_send:false,
          body:"Hi {{first_name}},\n\nThank you. We received the signed {{program}} registration form for {{participant}}.\n\nOur team will review it and follow up with you about fees and next steps. Submitting the form does not confirm a place yet.\n\nIf anything on the form needs to change, just reply to this email."+sig}],
      outbox:[{id:"em-sample",at:new Date(Date.now()-36e5).toISOString(),kind:"admin_alert",to:"test-admin@flintracing.org",subject:"New inquiry: Sample Family · Building Workshops",status:"sent",sent_at:new Date(Date.now()-36e5).toISOString(),tries:1,error:null,ref_table:null,ref:null,template:"alert:inquiry"}]}}
  function EM(){if(!T)seed();if(!T.email){T.email=emailSeed()}return T.email}
  function eFill(t,v){Object.keys(v).forEach(function(k){t=t.split("{{"+k+"}}").join(v[k]==null?"":v[k])});return t.replace(/\{\{[a-z_]+\}\}/g,"")}
  function eVars(tb,id){var v={site:SITE,sign_in_link:SITE+"/#access",calendar_link:SITE+"/#calendar",race_link:SITE+"/#race-registration",workshop_link:SITE+"/#workshop-registration",register_link:SITE+"/#new-profile"},r=(T[tb]||[]).filter(function(x){return x.id===id})[0];if(!r)return null;
    if(tb==="inquiries")return Object.assign(v,{to_email:String(r.email||"").toLowerCase(),to_name:(r.first_name+" "+(r.last_name||"")).trim(),first_name:r.first_name||"there",name:(r.first_name+" "+(r.last_name||"")).trim(),interests:String(r.interests||"our programs").toLowerCase()});
    if(tb==="members")return Object.assign(v,{to_email:String(r.email||"").toLowerCase(),to_name:r.display_name,first_name:String(r.display_name||"there").trim().split(/\s+/)[0],name:r.display_name,username:r.username,pass_name:r.kind==="family"?"Family Pass (car #8)":"Crew Pass (car #12)",prefs:r.email_prefs||[]});
    return Object.assign(v,{to_email:String(r.parent_email||"").toLowerCase(),to_name:r.parent_name,first_name:String(r.parent_name||"there").trim().split(/\s+/)[0],name:r.parent_name,participant:r.participant_name||"your racer",program:r.program==="building_workshop"?"building workshop":"race",division:r.division||""})}
  function eOut(o){var E=EM();E.outbox.unshift(Object.assign({id:"em"+Math.random().toString(36).slice(2,10),at:new Date().toISOString(),status:"sent",sent_at:new Date().toISOString(),tries:1,error:null,ref_table:null,ref:null,template:null},o));E.outbox=E.outbox.slice(0,200)}
  function eAlert(ev,subject){var E=EM();if(!E.settings.on||E.me.events.indexOf(ev)<0)return;eOut({kind:"admin_alert",to:E.me.send_to||"test-admin@flintracing.org",subject:subject,template:"alert:"+ev})}
  function eAuto(ev,tb,id){var E=EM(),t=E.templates.filter(function(x){return x.auto_event===ev&&x.auto_send})[0],v=t&&E.settings.on&&eVars(tb,id);if(!v||!v.to_email)return;
    if(tb==="members"&&v.prefs.indexOf("account")<0)return;eOut({kind:"auto",to:v.to_email,subject:eFill(t.subject,v),ref_table:tb,ref:id,template:t.key})}
  function eOnInsert(tb,r){
    if(tb==="inquiries"&&r.role!=="Workshop guest"){eAlert("inquiry","New inquiry: "+(r.first_name+" "+(r.last_name||"")).trim()+" · "+String(r.interests||"").slice(0,70));eAuto("inquiry_new",tb,r.id)}
    if(tb==="race_registrations"){eAlert("registration","New "+(r.program==="building_workshop"?"building workshop":"race")+" registration: "+r.participant_name);eAuto("registration_new",tb,r.id)}
    if(tb==="race_volunteers")eAlert("volunteer","New race-day volunteer: "+r.first_name+" "+r.last_name)}
  var user={id:"test-admin",email:"test-admin@flintracing.org",user_metadata:{full_name:"Test Admin"}}, listeners=[];
  function rid(){return Math.random().toString(36).slice(2,10)}
  function Q(t){this.t=t;this.f=[];this.op="select";this.row=null;this.single=false;this.head=false;this.ord=null}
  Q.prototype.select=function(c,o){if(o&&o.head)this.head=true;return this};
  Q.prototype.order=function(col,o){this.ord=[col,!(o&&o.ascending===false)];return this};
  Q.prototype.limit=function(){return this};
  Q.prototype.eq=function(k,v){this.f.push([k,v]);return this};
  Q.prototype.gte=function(k,v){this.f.push([k,v,"gte"]);return this};
  if(!Q.prototype.lt)Q.prototype.lt=function(k,v){this.f.push([k,v,"lt"]);return this};
  Q.prototype.lte=function(k,v){this.f.push([k,v,"lte"]);return this};
  Q.prototype.maybeSingle=function(){this.single=true;return this};
  Q.prototype.insert=function(r){this.op="insert";this.row=r;return this};
  Q.prototype.upsert=function(r){this.op="upsert";this.row=r;return this};
  Q.prototype.update=function(r){this.op="update";this.row=r;return this};
  Q.prototype.delete=function(){this.op="delete";return this};
  Q.prototype.then=function(ok,bad){
    if(!T) seed();
    var s=this, rows=T[s.t]||(T[s.t]=[]), m=function(r){return s.f.every(function(f){return f[2]==="gte"?r[f[0]]>=f[1]:f[2]==="lte"?r[f[0]]<=f[1]:f[2]==="lt"?r[f[0]]<f[1]:r[f[0]]===f[1]})}, res;
    if(s.op==="select"){var d=rows.filter(m).slice();
      if(s.ord){var c=s.ord[0],asc=s.ord[1];d.sort(function(a,b){return (a[c]>b[c]?1:a[c]<b[c]?-1:0)*(asc?1:-1)})}
      res=s.head?{data:null,count:d.length,error:null}:{data:s.single?(d[0]||null):JSON.parse(JSON.stringify(d)),error:null}}
    else if(s.op==="insert"){(Array.isArray(s.row)?s.row:[s.row]).forEach(function(row){var nr=Object.assign({id:rid(),created_at:new Date().toISOString()},s.t==="inquiries"?{status:"new"}:s.t==="shoutouts"?{status:"pending"}:{},JSON.parse(JSON.stringify(row)));rows.push(nr);eOnInsert(s.t,nr)});res={data:null,error:null}}
    else if(s.op==="upsert"){var i=rows.findIndex(function(r){return r.key===s.row.key});if(i>=0)rows[i]=s.row;else rows.push(s.row);res={data:null,error:null}}
    else if(s.op==="update"){rows.filter(m).forEach(function(r){Object.assign(r,s.row)});res={data:null,error:null}}
    else {T[s.t]=rows.filter(function(r){return !m(r)});res={data:null,error:null}}
    if(s.op!=="select") save();
    return Promise.resolve(res).then(ok,bad);
  };
  var files={};
  function famCodes(){var used={};(T.members||[]).forEach(function(m){if(m.family_code)used[m.family_code]=1});
    (T.members||[]).forEach(function(m){if(!m.family_code&&m.status==="approved"&&(m.roles||[]).indexOf("family")>=0){var c=m.username==="taylorfamily"?"4821":m.username==="morganfam"?"3057":null;
      while(!c||used[c]){c=String(Math.floor(Math.random()*10000)).padStart(4,"0")}m.family_code=c;used[c]=1}})}
  var KFAIL=[];
  window.supabase={createClient:function(){return{
    from:function(t){if(T&&t==="members")famCodes();return new Q(t)},
    rpc:function(fn,args){if(!T)seed();T.race_roles=T.race_roles||[];famCodes();
      if(fn==="set_race_role"){T.race_roles=T.race_roles.filter(function(x){return x.role!==args.p_role});T.race_roles.push({role:args.p_role,user_id:"u-"+args.p_email,email:args.p_email});save();return Promise.resolve({data:args.p_email,error:null})}
      if(fn==="clear_race_role"){T.race_roles=T.race_roles.filter(function(x){return x.role!==args.p_role});save();return Promise.resolve({data:null,error:null})}
      var R=function(d,e){return Promise.resolve({data:d===undefined?null:d,error:e?{message:e}:null})};
      ["staff","event_details","race_volunteers","workshop_signins","albums","album_photos","teacher_plans","news_posts","resources"].forEach(function(k){T[k]=T[k]||[]});
      if(fn==="program_dashboard"){if(!args.p_code||args.p_code.toLowerCase()!==(T.family_code||"flintfamily").toLowerCase())return R(null);
        var t=new Date().toISOString().slice(0,10),D={};T.event_details.forEach(function(x){D[x.event_id]=x});
        return R({events:T.events.filter(function(e){return e.published&&(e.end_date||e.start_date)>=t}).sort(function(a,b){return a.start_date>b.start_date?1:-1}).map(function(e){var d=D[e.id]||{};return{id:e.id,start_date:e.start_date,end_date:e.end_date,title:e.title,kind:e.kind,tbc:e.to_be_confirmed,description:e.description,start_time:d.start_time,end_time:d.end_time,location:d.location,notes:d.notes}})})}
      if(fn==="set_family_code"){T.family_code=args.p_code;T.family_code_at=new Date().toISOString();save();return R(null)}
      if(fn==="family_code_info")return R({set:true,updated_at:T.family_code_at||new Date().toISOString()});
      if(fn==="crew_view"){var v=T.race_volunteers.filter(function(x){return x.link_token===args.p_token&&x.status!=="declined"})[0];return R(v?{first_name:v.first_name,role:v.role,area:v.assigned_area,shift:v.shift,assignment:v.assignment,checked_in_at:v.checked_in_at}:null)}
      if(fn==="crew_checkin"){var w=T.race_volunteers.filter(function(x){return x.link_token===args.p_token})[0];if(w&&!w.checked_in_at){w.checked_in_at=new Date().toISOString();save()}return R(w?w.checked_in_at:null)}
      if(fn==="public_stats"){var s=T.workshop_signins.filter(function(x){return !args.p_year||+x.session_date.slice(0,4)===args.p_year}),fam={},teams={},days={},meals=0,vv=0;
        s.forEach(function(x){var k=(x.last_name+"|"+(x.team||"")).toLowerCase();fam[k]=Math.max(fam[k]||0,x.kids);if(x.team)teams[x.team.toLowerCase()]=1;days[x.session_date]=1;meals+=x.kids+x.volunteers;vv+=x.volunteers});
        return R({kids:Object.keys(fam).reduce(function(a,k){return a+fam[k]},0),families:Object.keys(fam).length,teams:Object.keys(teams).length,meals:meals,volunteer_visits:vv,sessions:Object.keys(days).length})}
      if(fn==="list_admins")return R([{email:"test-admin@flintracing.org",user_id:"test-admin"}].concat((T.extra_admins||[]).map(function(e){return{email:e,user_id:"u-"+e}})));
      if(fn==="admin_signout_log"){T.access_log=T.access_log||[];T.access_log.unshift({id:rid(),at:new Date().toISOString(),member_id:null,who:"Test Admin",action:"admin_sign_out",detail:"test-admin@flintracing.org"});save();return R(null)}
      if(fn==="race_gift"){T.race_gifts=T.race_gifts||[];T.shoutouts=T.shoutouts||[];var gso=null;if(args.p_message){gso=rid();T.shoutouts.unshift({id:gso,name:args.p_name,message:args.p_message,status:"pending",donation:true,created_at:new Date().toISOString()})}
        var gid=rid();T.race_gifts.unshift({id:gid,created_at:new Date().toISOString(),name:args.p_name,email:args.p_email,amount:args.p_amount,message:args.p_message,shoutout_id:gso,status:"new"});save();
        var dc=(T.site_content||[]).filter(function(x){return x.key==="data|donate"})[0];return R({id:gid,shoutout:gso,link:dc?JSON.parse(dc.value).link:null})}
      if(fn==="admin_council_meetings"){T.council_meetings=T.council_meetings||[];return R({meetings:T.council_meetings.slice().sort(function(a,b){return a.meeting_date<b.meeting_date?1:-1}),reach:3,members:4})}
      if(fn==="admin_council_meeting_save"){T.council_meetings=T.council_meetings||[];var now5=new Date().toISOString(),mm=args.p_id?T.council_meetings.filter(function(x){return x.id===args.p_id})[0]:null;
        if(!args.p_date)return R(null,"Pick a date.");if(args.p_start&&args.p_end&&args.p_end<=args.p_start)return R(null,"The meeting has to end after it starts.");
        var rec={meeting_date:args.p_date,start_time:args.p_start,end_time:args.p_end,location:args.p_location||null,title:args.p_title||"Leadership Council meeting",notes:args.p_notes||null,remind:args.p_remind!==false,cancelled_at:null,updated_at:now5,hours:2};
        if(mm){Object.assign(mm,rec)}else{mm=Object.assign({id:rid(),created_at:now5},rec);T.council_meetings.push(mm)}save();return R({id:mm.id,sent:args.p_notify===false?0:3,changed:true})}
      if(fn==="admin_council_meeting_remind")return R({sent:3});
      if(fn==="admin_council_meeting_cancel"){var mc=(T.council_meetings||[]).filter(function(x){return x.id===args.p_id})[0];if(!mc)return R(null,"That meeting wasn’t found.");mc.cancelled_at=new Date().toISOString();mc.updated_at=mc.cancelled_at;save();return R({sent:3})}
      if(fn==="admin_invites_open")return R((T.invites||[]).map(function(i){return {email:i.email,name:i.name,created_at:i.created_at,has_account:false}}));
      if(fn==="admin_invite_add"){var ie=String(args.p_email||"").trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ie))return R(null,"That email address doesn’t look right.");
        T.invites=(T.invites||[]).filter(function(i){return i.email!==ie}).concat([{email:ie,name:args.p_name||null,created_at:new Date().toISOString()}]);save();return R({status:"invited",email:ie,sent:args.p_send!==false})}
      if(fn==="admin_invite_cancel"){T.invites=(T.invites||[]).filter(function(i){return i.email!==String(args.p_email||"").toLowerCase()});save();return R(null)}
      if(fn==="grant_admin"){T.extra_admins=(T.extra_admins||[]).filter(function(e){return e!==args.p_email}).concat([args.p_email]);save();return R(args.p_email)}
      if(fn==="revoke_admin"){T.extra_admins=(T.extra_admins||[]).filter(function(e){return "u-"+e!==args.p_user});save();return R(null)}
      if(fn==="set_staff"){T.staff=T.staff.filter(function(x){return !(x.email===args.p_email&&x.role===args.p_role)});if(args.p_on)T.staff.push({user_id:"u-"+args.p_email,role:args.p_role,email:args.p_email});save();return R(args.p_email)}
      T.crew_codes=T.crew_codes||{};T.code_sessions=T.code_sessions||[];
      if(fn==="set_crew_code"){if(!/^[0-9]{6,12}$/.test(args.p_code))return R(null,"Use 6 to 12 digits.");T.crew_codes[args.p_role]={code:args.p_code,at:new Date().toISOString()};T.code_sessions=T.code_sessions.filter(function(x){return x.role!==args.p_role});save();return R(null)}
      if(fn==="clear_crew_code"){delete T.crew_codes[args.p_role];save();return R(null)}
      if(fn==="crew_code_info"){var o={};Object.keys(T.crew_codes).forEach(function(k){o[k]={updated_at:T.crew_codes[k].at,active:T.code_sessions.filter(function(x){return x.role===k}).length}});return R(o)}
      if(fn==="redeem_crew_code"){var role=Object.keys(T.crew_codes).filter(function(k){return T.crew_codes[k].code===args.p_code})[0];if(!role)return R(null);
        T.code_sessions=T.code_sessions.filter(function(x){return !(x.user_id===user.id&&x.role===role)});T.code_sessions.push({user_id:user.id,role:role,expires_at:new Date(Date.now()+16*36e5).toISOString()});save();return R(role)}
      T.members=T.members||[];T.member_hours=T.member_hours||[];T.access_log=T.access_log||[];T.mpass=T.mpass||{};T.msess=T.msess||{};
      var ROLES=["family","volunteer","workshop","teacher","photographer","controller","track","volunteers","council"];
      function mlog(m,w,a,d){T.access_log.unshift({id:rid(),at:new Date().toISOString(),member_id:m,who:w,action:a,detail:d||null});T.access_log=T.access_log.slice(0,600)}
      function curM(){var s=user&&T.msess[user.id];if(!s||s.exp<Date.now())return null;var m=T.members.filter(function(x){return x.id===s.mid})[0];return m&&m.status==="approved"?m:null}
      function weak(p){return !p||p.length<6||/^(.)\1*$/.test(p)||["123456","654321","password","123123","qwerty"].indexOf(p.toLowerCase())>=0}
      if(fn==="member_username_free")return R(!T.members.some(function(m){return m.username===String(args.p_username||"").trim().toLowerCase()}));
      var proof=function(m,p){return (/^\d{4}$/.test(p||"")&&m.family_code===p)||(T.mpass[m.id]&&T.mpass[m.id]===p)};
      var wcode=function(c){return !/^\d{4}$/.test(c||"")||/^(\d)\1{3}$/.test(c)||["1234","4321","0123","3210","9876","6789","2580","1212","6969"].indexOf(c)>=0};
      var newMem=function(a,status,roles){var em=String(a.p_email||"").trim().toLowerCase();
        if(String(a.p_name||"").trim().length<2)return {e:"Add your name."};if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return {e:"Add an email address so we can reach you."};
        if(T.members.some(function(m){return (m.email||"").toLowerCase()===em}))return {e:"That email already has a profile. Sign in with it, or email info@flintsoapbox.org if you forgot your code."};
        if(wcode(a.p_code))return {e:"Pick a 4-digit code that isn’t easy to guess (not 1234 or 1111)."};
        if(T.members.some(function(m){return m.family_code===a.p_code}))return {e:"That code is already in use. Pick a different 4 digits."};
        if(a.p_passcode&&weak(a.p_passcode))return {e:"Pick a password of at least 6 characters that isn’t easy to guess, or leave it blank."};
        var kids=(a.p_kids||[]).filter(function(k){return k&&String(k.name||"").trim()}).slice(0,8);if(a.p_kind==="family"&&!kids.length)return {e:"Add at least one racer."};
        var b=em.split("@")[0].replace(/[^a-z0-9._-]/g,"").replace(/^[._-]+/,"");if(b.length<3)b+="family";b=b.slice(0,20);var u=b,i=1;while(T.members.some(function(m){return m.username===u})){i++;u=b+i}
        var id="m"+rid(),m={id:id,username:u,display_name:String(a.p_name).trim(),kind:a.p_kind,email:em,phone:a.p_phone||null,kids:kids,requested:(a.p_requested||[]).filter(function(r){return ROLES.indexOf(r)>=0}),roles:roles,status:status,about:a.p_about||null,admin_note:null,first_year:new Date().getFullYear(),created_at:new Date().toISOString(),approved_at:status==="approved"?new Date().toISOString():null,last_seen_at:null,family_code:a.p_code,email_prefs:(a.p_prefs||[]).filter(function(x){return x==="account"||["building","workshops","volunteers","council"].indexOf(x)>=0||((T.email||{}).defs||[]).some(function(d){return d.key===x&&d.member_choice})})};
        T.members.unshift(m);if(a.p_passcode)T.mpass[id]=a.p_passcode;mlog(id,u,"register",a.p_kind);save();return {m:m}};
      if(fn==="member_register"){var nm0=newMem(args,"pending",[]);if(nm0.e)return R(null,nm0.e);eAlert("profile","New profile to approve: "+nm0.m.display_name);eAuto("member_new","members",nm0.m.id);save();return R({ok:true,username:nm0.m.username})}
      if(fn==="kiosk_register_family"){var td0=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10),nm1=newMem(Object.assign({},args,{p_kind:"family",p_requested:["family"],p_about:"Registered at the workshop check-in kiosk."}),"approved",["family"]);
        if(nm1.e)return R(null,nm1.e);nm1.m.email_prefs=(nm1.m.email_prefs||[]).concat(["account"]);eAlert("kiosk","New family at the kiosk: "+nm1.m.display_name);eAuto("member_approved","members",nm1.m.id);var mm1=nm1.m,kn=mm1.kids.map(function(k){return k.name}),ln=mm1.display_name.trim().split(/\s+/).pop();
        T.workshop_signins.push({id:"ws"+Date.now(),created_at:new Date().toISOString(),session_date:td0,event_id:args.p_event||null,team:null,last_name:ln,kids:kn.length,volunteers:Math.max(0,Math.min(10,args.p_adults|0)),notes:"New family · registered at the kiosk",member_id:mm1.id,kid_names:kn,source:"kiosk"});save();
        return R({ok:true,family:ln,kids:kn})}
      if(fn==="member_signin"){var un=String(args.p_username||"").trim().toLowerCase(),mm=T.members.filter(function(m){return un.indexOf("@")>0?(m.email||"").toLowerCase()===un:m.username===un})[0];
        if(!mm||!proof(mm,args.p_passcode)){mlog(mm?mm.id:null,un,"signin_failed",mm?"wrong code or password":"unknown account");save();return R({ok:false})}
        if(mm.status!=="approved"){mlog(mm.id,un,"signin_blocked",mm.status);save();return R({ok:false,status:mm.status})}
        T.msess[user.id]={mid:mm.id,exp:Date.now()+(args.p_keep?30*864e5:12*36e5)};mm.last_seen_at=new Date().toISOString();mlog(mm.id,un,"sign_in",args.p_keep?"kept signed in":"this visit");save();
        return R({ok:true,username:mm.username,display_name:mm.display_name,roles:mm.roles})}
      if(fn==="member_set_code"){var c9=curM();if(!c9)return R(null,"Sign in first.");if(!proof(c9,args.p_current))return R(null,"Your current code or password isn’t right.");
        if(wcode(args.p_new))return R(null,"Pick a 4-digit code that isn’t easy to guess (not 1234 or 1111).");if(T.members.some(function(m){return m.family_code===args.p_new&&m.id!==c9.id}))return R(null,"That code is already in use. Pick a different 4 digits.");
        c9.family_code=args.p_new;mlog(c9.id,c9.username,"code_changed");save();return R(null)}
      if(fn==="member_set_prefs"){var c10=curM();if(!c10)return R(null,"Sign in first.");c10.email_prefs=(args.p_prefs||[]).filter(function(x){return x==="account"||["building","workshops","volunteers","council"].indexOf(x)>=0||((T.email||{}).defs||[]).some(function(d){return d.key===x&&d.member_choice})});save();return R(c10.email_prefs)}
      if(fn==="member_signout"){var c0=curM();if(c0)mlog(c0.id,c0.username,"sign_out");if(user)delete T.msess[user.id];save();return R(null)}
      if(fn==="admin_member_session"){if(!user||user.id!=="test-admin")return R(null,"Admins only");var am=T.members.filter(function(m){return (m.email||"")==="test-admin@flintracing.org"})[0];
        if(!am){am={id:"madmin",username:"testadmin",display_name:"Test Admin",kind:"crew",email:"test-admin@flintracing.org",phone:null,kids:[],requested:[],roles:[],status:"approved",about:"Admin’s own participant profile",admin_note:null,first_year:2026,created_at:new Date().toISOString(),approved_at:new Date().toISOString(),last_seen_at:null};T.members.push(am)}
        if(args&&args.p_role&&am.roles.indexOf(args.p_role)<0)am.roles.push(args.p_role);T.msess[user.id]={mid:am.id,exp:Date.now()+30*864e5};save();
        return R({id:am.id,username:am.username,display_name:am.display_name,kind:am.kind,roles:am.roles,first_year:am.first_year,family_code:null})}
      if(fn==="council_confirm"){var hx_cm=curM();if(!hx_cm||(hx_cm.roles||[]).indexOf("council")<0)return R(null,"Council members only");var hx_se=null;
        if(args.p_source==="meeting"){var hx_mm=T.council_meetings.filter(function(x){return x.id===args.p_ref})[0];if(hx_mm)hx_se={d:hx_mm.meeting_date,t:hx_mm.title,h:+hx_mm.hours,k:"meeting"}}
        else if(args.p_source==="site_event"){var hx_ee=T.events.filter(function(x){return x.id===args.p_ref})[0];if(hx_ee)hx_se={d:hx_ee.start_date,t:hx_ee.title,h:3,k:/^building workshop/i.test(hx_ee.title)?"building":"seasonal"}}
        else{var hx_pp=T.council_projects.filter(function(x){return x.id===args.p_ref})[0];if(hx_pp)hx_se={d:hx_pp.event_date,t:hx_pp.title,h:2,k:"event"}}
        if(!hx_se)return R(null,"That event wasn’t found.");T.council_attendance=T.council_attendance.filter(function(a){return !(a.member_id===hx_cm.id&&a.source===args.p_source&&a.ref_id===args.p_ref)});
        T.council_attendance.push({id:"at"+Date.now(),member_id:hx_cm.id,source:args.p_source,ref_id:args.p_ref,kind:hx_se.k,session_date:hx_se.d,title:hx_se.t,hours:args.p_there?hx_se.h:0,status:args.p_there?"pending":"absent",verified_by:null,created_at:new Date().toISOString()});save();return R({status:args.p_there?"pending":"absent"})}
      if(fn==="council_verify"){var hx_ar=T.council_attendance.filter(function(a){return a.id===args.p_id})[0];if(!hx_ar)return R(null,"Not found");hx_ar.status=args.p_ok?"verified":"rejected";if(args.p_ok)hx_ar.hours=args.p_hours;hx_ar.verified_by=(curM()||{display_name:"Test Admin (Admin)"}).display_name;save();return R(null)}
      if(fn==="council_set_racing"||fn==="council_race_admin"){var hx_rid=fn==="council_set_racing"?(curM()||{}).id:args.p_member,hx_nd=new Date(),hx_ss=hx_nd.getMonth()>=7?hx_nd.getFullYear()+1:hx_nd.getFullYear(),hx_rr=T.council_race.filter(function(r){return r.member_id===hx_rid&&r.season===hx_ss})[0];
        if(!hx_rr){hx_rr={member_id:hx_rid,season:hx_ss,racing:null,half_ok:false};T.council_race.push(hx_rr)}hx_rr.racing=args.p_racing;hx_rr.half_ok=fn==="council_race_admin"?!!(args.p_half&&args.p_racing):(args.p_racing?hx_rr.half_ok:false);save();return R(null)}
      if(fn==="poll_vote"){T.polls=T.polls||[];T.polls.push(args.p_answers);save();return R(null)}
      if(fn==="poll_results"){var pv=T.polls||[],pc=function(k){var o={};pv.forEach(function(v){[].concat(v[k]).forEach(function(x){o[x]=(o[x]||0)+1})});return o};return R({total:pv.length,join:pc("join"),season:pc("season"),nights:pc("nights")})}
      if(fn==="council_hours_task"){var hm=curM(),hx_t=T.council_tasks.filter(function(x){return x.id===args.p_task})[0];if(!hm)return R(null,"Council members only");if(!hx_t)return R(null,"Task not found");if(hx_t.assignee_member&&hx_t.assignee_member!==hm.id)return R(null,"That task is assigned to someone else.");
        T.council_task_hours=T.council_task_hours.filter(function(x){return !(x.member_id===hm.id&&x.task_id===args.p_task&&x.week_of===args.p_week)});
        T.council_task_hours.push({id:"ph"+Date.now(),member_id:hm.id,task_id:hx_t.id,project_id:hx_t.project_id,task_title:hx_t.title,week_of:args.p_week,hours:args.p_hours,note:args.p_note,status:"pending",confirmed_by:null,created_at:new Date().toISOString()});save();return R(null)}
      if(fn==="council_hours_confirm"){var hl=(args.p_kind==="att"?T.council_attendance:T.council_task_hours).filter(function(x){return x.id===args.p_id})[0];if(!hl)return R(null,"Not found");if(args.p_kind==="att"&&curM()&&hl.member_id===curM().id&&!T.council_officers.some(function(o){return o.position==="president"&&o.member_id===curM().id}))return R(null,"You can’t confirm your own attendance. Ask another officer.");
        hl.status=args.p_ok?(args.p_kind==="att"?"pending":"confirmed"):"rejected";hl.confirmed_by=(curM()||{display_name:"Test Admin (Admin)"}).display_name;if(args.p_ok&&args.p_hours!=null)hl.hours=args.p_hours;save();return R(null)}
      if(fn==="council_service_submit"){T.council_service_reports=T.council_service_reports.filter(function(r){return r.week_of!==args.p_week});T.council_service_reports.push({week_of:args.p_week,status:"submitted",submitted_by:(curM()||{display_name:"Test Admin (Admin)"}).display_name,submitted_at:new Date().toISOString(),review_note:null});save();return R(null)}
      if(fn==="council_service_review"){var hr=T.council_service_reports.filter(function(r){return r.week_of===args.p_week})[0];if(!hr)return R(null,"That report hasn’t been submitted.");var hmon=function(d){var x=new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10));x.setDate(x.getDate()-((x.getDay()+6)%7));return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
        if(args.p_ok){T.council_attendance.forEach(function(a){if(a.status==="pending"&&a.confirmed_by&&hmon(a.session_date)===args.p_week){a.status="verified";a.verified_by="Test Admin (Admin)"}});T.council_task_hours.forEach(function(x){if(x.status==="confirmed"&&x.week_of===args.p_week)x.status="verified"});hr.status="approved";hr.reviewed_by="Test Admin (Admin)"}
        else{hr.status="returned";hr.review_note=args.p_note}save();return R(null)}
      if(fn==="council_roster"){var me=curM(),isA=user&&user.id==="test-admin";if(!isA&&!(me&&(me.roles||[]).indexOf("council")>=0))return R(null,"Council members only");
        return R({me:me?me.id:null,admin:isA,members:T.members.filter(function(m){return m.status==="approved"&&(m.roles||[]).indexOf("council")>=0}).map(function(m){return{id:m.id,name:m.display_name,
          positions:(T.council_officers||[]).filter(function(o){return o.member_id===m.id}).map(function(o){return o.position}),titles:(T.council_roles||[]).filter(function(r){return r.member_id===m.id&&r.status==="approved"}).map(function(r){return r.title})}}).sort(function(a,b){return a.name>b.name?1:-1})})}
      if(fn==="public_council_counts")return R({council_members:T.members.filter(function(m){return m.status==="approved"&&(m.roles||[]).indexOf("council")>=0}).length,council_projects:(T.council_projects||[]).filter(function(p){return p.status==="planning"||p.status==="active"}).length});
      if(fn==="my_member"){var c1=curM();return R(c1?{id:c1.id,username:c1.username,display_name:c1.display_name,kind:c1.kind,roles:c1.roles,first_year:c1.first_year,family_code:c1.family_code||null}:null)}
      if(fn==="kiosk_guest_signin"||fn==="kiosk_guests_today"||fn==="kiosk_checkout"){var td=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
        if(fn==="kiosk_guest_signin"){var gn=String(args.p_name||"").trim().replace(/\s+/g," "),ge=String(args.p_email||"").trim(),gp=String(args.p_phone||"").trim();
          if(gn.length<2)return R(null,"Add your name");if(ge&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ge))return R(null,"That email doesn’t look right");
          if(!ge&&gp.replace(/\D/g,"").length<7)return R(null,"Add an email or a phone number");
          var gid="wsg"+Date.now();T.workshop_signins.push({id:gid,created_at:new Date().toISOString(),session_date:td,event_id:args.p_event||null,team:null,last_name:gn,kids:Math.max(0,Math.min(20,args.p_kids|0)),volunteers:Math.max(0,Math.min(10,args.p_adults|0)),notes:args.p_note||null,member_id:null,kid_names:null,source:"guest",guest_email:ge||null,guest_phone:gp||null,wants_account:!!args.p_account});
          if((args.p_prefs||[]).length&&ge){var sp=gn.lastIndexOf(" ");(T.inquiries=T.inquiries||[]).push({id:"iq"+Date.now(),created_at:new Date().toISOString(),first_name:sp>0?gn.slice(0,sp):gn,last_name:sp>0?gn.slice(sp+1):"",role:"Workshop guest",interests:"Email updates: "+args.p_prefs.map(function(x){return x==="workshops"?"Seasonal workshops":"Leadership Council"}).join(", "),youth_count:args.p_kids|0,message:"Joined the mailing list from the workshop check-in kiosk.",email:ge,phone:gp||null,contact_by:"Email",best_time:"Any time",email_updates:true,status:"new"})}
          save();return R({ok:true,id:gid})}
        if(fn==="kiosk_guests_today")return R(T.workshop_signins.filter(function(w){return w.session_date===td&&w.source==="guest"&&!w.checked_out_at}).map(function(w){var p=w.last_name.split(" ");return{id:w.id,name:p.length>1?p[0]+" "+p[p.length-1][0]+".":w.last_name,kids:w.kids,adults:w.volunteers}}));
        var row;if(args.p_code){var fm2=T.members.filter(function(m){return m.family_code===args.p_code})[0];if(!fm2)return R(null,"That code didn’t match");row=T.workshop_signins.filter(function(w){return w.member_id===fm2.id&&w.session_date===td})[0]}
        else row=T.workshop_signins.filter(function(w){return w.id===args.p_id&&w.session_date===td&&w.source==="guest"})[0];
        if(!row)return R(null,"We couldn’t find today’s check-in");row.checked_out_at=new Date().toISOString();
        if(args.p_rating>=1&&args.p_rating<=5)row.rating=args.p_rating;if(String(args.p_note||"").trim())row.review=String(args.p_note).trim().slice(0,600);if(row.rating||row.review)row.reviewed_at=new Date().toISOString();save();return R({ok:true})}
      if(fn==="kiosk_lookup"||fn==="kiosk_checkin"){var today=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
        var fm=T.members.filter(function(m){return m.family_code===args.p_code&&m.status==="approved"&&(m.roles||[]).indexOf("family")>=0})[0];
        var last=function(m){return String(m.display_name).trim().split(/\s+/).pop()};
        if(fn==="kiosk_lookup"){KFAIL=KFAIL.filter(function(x){return Date.now()-x<12e4});if(KFAIL.length>=5)return R({ok:false,locked:true});
          if(!fm){KFAIL.push(Date.now());return R({ok:false,locked:KFAIL.length>=5})}
          var s0=T.workshop_signins.filter(function(w){return w.member_id===fm.id&&w.session_date===today})[0];
          return R({ok:true,family:last(fm),kids:(fm.kids||[]).map(function(k){return k.name}).filter(Boolean),already:s0?s0.kid_names||[]:[],adults:s0?s0.volunteers:null,at:s0?s0.created_at:null,out:s0?s0.checked_out_at||null:null})}
        if(!fm)return R(null,"That code didn’t match");
        var names=(fm.kids||[]).map(function(k){return k.name}).filter(function(n){return (args.p_kids||[]).indexOf(n)>=0});
        if(!names.length)return R(null,"Pick at least one racer");
        var ad=Math.max(0,Math.min(10,+args.p_adults||0)),ex=T.workshop_signins.filter(function(w){return w.member_id===fm.id&&w.session_date===today})[0];
        if(ex){ex.kids=names.length;ex.kid_names=names;ex.volunteers=ad;ex.source="kiosk";ex.checked_out_at=null;if(args.p_event)ex.event_id=args.p_event}
        else T.workshop_signins.push({id:"ws"+Date.now(),created_at:new Date().toISOString(),session_date:today,event_id:args.p_event||null,team:null,last_name:last(fm),kids:names.length,volunteers:ad,notes:null,member_id:fm.id,kid_names:names,source:"kiosk"});
        save();return R({ok:true,kids:names})}
      if(fn==="admin_new_family_code"){var tm=T.members.filter(function(m){return m.id===args.p_id})[0];if(!tm)return R(null,"Profile not found");
        var nc;do{nc=String(Math.floor(Math.random()*10000)).padStart(4,"0")}while(T.members.some(function(m){return m.family_code===nc}));tm.family_code=nc;save();return R(nc)}
      if(fn==="my_profile"){var c2=curM();if(!c2)return R(null);var hs=T.member_hours.filter(function(h){return h.member_id===c2.id}).sort(function(a,b){return a.started_at<b.started_at?1:-1});
        var days=function(k){var o={};hs.forEach(function(h){if(k.indexOf(h.kind)>=0)o[h.started_at.slice(0,10)]=1});return Object.keys(o).length},yrs={};yrs[c2.first_year]=1;hs.forEach(function(h){yrs[h.started_at.slice(0,4)]=1});
        var op=hs.filter(function(h){return !h.ended_at&&Date.now()-new Date(h.started_at)<16*36e5})[0];
        return R({member:{username:c2.username,display_name:c2.display_name,kind:c2.kind,roles:c2.roles,first_year:c2.first_year,email:c2.email,phone:c2.phone,kids:c2.kids,since:c2.created_at,family_code:c2.family_code||null,email_prefs:c2.email_prefs||[],has_password:!!T.mpass[c2.id]},
          hours:Math.round(hs.reduce(function(a,h){return a+(h.ended_at?(new Date(h.ended_at)-new Date(h.started_at))/36e5:0)},0)*10)/10,workshops:days(["workshop"]),race_days:days(["race_day"]),events:days(["event","other"]),years:Object.keys(yrs).length,
          open:op?{id:op.id,kind:op.kind,started_at:op.started_at}:null,recent:hs.slice(0,12).map(function(h){return{kind:h.kind,started_at:h.started_at,ended_at:h.ended_at,note:h.note}})})}
      if(fn==="member_clock"){var c3=curM();if(!c3)return R(null,"Sign in first.");var o3=T.member_hours.filter(function(h){return h.member_id===c3.id&&!h.ended_at})[0];
        if(o3){o3.ended_at=new Date().toISOString();mlog(c3.id,c3.username,"clock_out",o3.kind);save();return R({clocked:"out",hours:(new Date(o3.ended_at)-new Date(o3.started_at))/36e5})}
        T.member_hours.push({id:rid(),member_id:c3.id,kind:args.p_kind,started_at:new Date().toISOString(),ended_at:null,note:null,added_by:"self"});mlog(c3.id,c3.username,"clock_in",args.p_kind);save();return R({clocked:"in"})}
      if(fn==="member_set_passcode"){var c4=curM();if(!c4)return R(null,"Sign in first.");if(!proof(c4,args.p_old))return R(null,"Your current code or password isn’t right.");if(weak(args.p_new))return R(null,"Pick a passcode of at least 6 characters that isn’t easy to guess.");T.mpass[c4.id]=args.p_new;mlog(c4.id,c4.username,"passcode_changed");save();return R(null)}
      if(fn==="log_view"){var c5=curM(),w5=c5?c5.username:(user&&!user.is_anonymous?user.email:null);if(w5){mlog(c5?c5.id:null,w5,"view:"+String(args.p_what||"").replace(/[^a-z0-9_-]/g,"").slice(0,40));save()}return R(null)}
      if(fn==="program_dashboard_member"){var c6=curM();if(!c6&&!(user&&user.id==="test-admin"))return R(null);mlog(c6?c6.id:null,c6?c6.username:user.email,"view:dates");save();
        var t6=new Date().toISOString().slice(0,10),D6={};T.event_details.forEach(function(x){D6[x.event_id]=x});
        T.event_rsvps=T.event_rsvps||[];var RV=T.event_rsvps;
        return R({kids:c6?(c6.kids||[]).map(function(k){return k.name}).filter(Boolean):[],events:T.events.filter(function(e){return e.published&&(e.end_date||e.start_date)>=t6}).sort(function(a,b){return a.start_date>b.start_date?1:-1}).map(function(e){var d=D6[e.id]||{},mine=c6&&RV.filter(function(r){return r.event_id===e.id&&r.member_id===c6.id})[0],all=RV.filter(function(r){return r.event_id===e.id});return{id:e.id,start_date:e.start_date,end_date:e.end_date,title:e.title,kind:e.kind,tbc:e.to_be_confirmed,description:e.description,start_time:d.start_time,end_time:d.end_time,location:d.location,notes:d.notes,
          rsvp:mine?{kids:mine.kids,adults:mine.adults}:null,going:c6?null:{families:all.length,kids:all.reduce(function(n,r){return n+r.kids.length},0),adults:all.reduce(function(n,r){return n+r.adults},0)}}})})}
      if(fn==="rsvp_event"){var c8=curM();if(!c8)return R(null,"Please sign in with your family profile");T.event_rsvps=T.event_rsvps||[];var kn=(c8.kids||[]).map(function(k){return k.name}),k8=(args.p_kids||[]).filter(function(n,i,A){return kn.indexOf(n)>=0&&A.indexOf(n)===i}),a8=Math.max(0,Math.min(20,args.p_adults|0));
        T.event_rsvps=T.event_rsvps.filter(function(r){return!(r.event_id===args.p_event&&r.member_id===c8.id)});
        if(!k8.length&&!a8){save();return R({kids:[],adults:0,cancelled:true})}
        T.event_rsvps.push({event_id:args.p_event,member_id:c8.id,kids:k8,adults:a8,updated_at:new Date().toISOString()});save();return R({kids:k8,adults:a8})}
      if(fn==="admin_event_rsvps"){if(!(user&&user.id==="test-admin"))return R(null,"Not allowed");return R((T.event_rsvps||[]).filter(function(r){return r.event_id===args.p_event}).map(function(r){var m=T.members.filter(function(x){return x.id===r.member_id})[0]||{};return{family:m.display_name||m.username,email:m.email,phone:m.phone,kids:r.kids,adults:r.adults}}))}
      if(fn==="admin_member_update"){var m7=T.members.filter(function(x){return x.id===args.p_id})[0];if(!m7)return R(null,"Profile not found");m7.roles=(args.p_roles||[]).filter(function(r){return ROLES.indexOf(r)>=0});m7.status=args.p_status;if(args.p_status==="approved"&&!m7.approved_at){m7.approved_at=new Date().toISOString();eAuto("member_approved","members",m7.id)}
        if(args.p_status!=="approved")Object.keys(T.msess).forEach(function(k){if(T.msess[k].mid===m7.id)delete T.msess[k]});mlog(m7.id,user.email,"admin_update",args.p_status+" · "+m7.roles.join(", "));save();return R(null)}
      if(fn==="admin_reset_passcode"){if(weak(args.p_new))return R(null,"Pick a passcode of at least 6 characters that isn’t easy to guess.");T.mpass[args.p_id]=args.p_new;Object.keys(T.msess).forEach(function(k){if(T.msess[k].mid===args.p_id)delete T.msess[k]});mlog(args.p_id,user.email,"admin_reset_passcode");save();return R(null)}
      if(fn==="public_member_counts"){var yr=String(new Date().getFullYear());return R({volunteers_this_year:T.members.filter(function(m){return m.kind==="crew"&&m.status==="approved"&&((m.approved_at||m.created_at||"").slice(0,4)===yr||T.member_hours.some(function(h){return h.member_id===m.id&&h.started_at.slice(0,4)===yr}))}).length,participants:T.members.filter(function(m){return m.kind==="family"&&m.status==="approved"}).reduce(function(a,m){return a+(m.kids||[]).length},0)})}
      if(fn==="list_accounts")return R([{user_id:"test-admin",email:"test-admin@flintracing.org",full_name:"Test Admin",created_at:new Date().toISOString(),last_sign_in_at:new Date().toISOString(),is_admin:true,staff_roles:T.staff.filter(function(x){return x.user_id==="test-admin"}).map(function(x){return x.role}),race_role:null},
        {user_id:"u-kevin@example.com",email:"kevin@example.com",full_name:"Kevin C.",created_at:new Date().toISOString(),last_sign_in_at:null,is_admin:(T.extra_admins||[]).indexOf("kevin@example.com")>=0,staff_roles:T.staff.filter(function(x){return x.email==="kevin@example.com"}).map(function(x){return x.role}),race_role:null}]);
      /* ---- email (preview) ---- */
      if(fn.indexOf("admin_email_")===0||fn==="email_unsubscribe"||fn.indexOf("admin_list")===0||fn==="public_email_lists"){var E=EM(),ok=function(e){return /^[^@\s<>,;:"'()]+@[^@\s<>,;:"'()]+\.[A-Za-z]{2,24}$/.test(e||"")},AUD={inquiries:"inquiry",members:"member",race_registrations:"registration"};
        E.lists=E.lists||[];var LR=function(e,tp){return E.lists.filter(function(x){return x.email===e&&x.topic===tp})[0]};
        E.defs=E.defs||[{key:"building",name:"Building workshops",about:"Building workshop dates, registration and reminders",member_choice:true,roles:[],include_admins:false,builtin:true},
          {key:"workshops",name:"Seasonal workshops",about:"Workshop, camp and fun run dates as they’re set",member_choice:true,roles:[],include_admins:false,builtin:true},
          {key:"volunteers",name:"Volunteers",about:"Volunteer shifts, race-day help and crew news",member_choice:true,roles:["volunteer"],include_admins:false,builtin:true},
          {key:"council",name:"Leadership Council",about:"Council news, opportunities and special offers",member_choice:true,roles:["council"],include_admins:false,builtin:true},
          {key:"teachers",name:"Teachers",about:"For teachers who plan and lead workshops",member_choice:false,roles:["teacher"],include_admins:false,builtin:true},
          {key:"coaches",name:"Coaches",about:"For coaches and team mentors",member_choice:false,roles:[],include_admins:false,builtin:true},
          {key:"admins",name:"Admins",about:"Everyone with an admin account",member_choice:false,roles:[],include_admins:true,builtin:true}];
        var DEF=function(k){return E.defs.filter(function(d){return d.key===k&&!d.removed})[0]};
        var topics=function(t){t=t||"";var o=[];if(/building/i.test(t))o.push("building");if(/steam|seasonal|camp|weekday/i.test(t)||(/workshop/i.test(t)&&!/building/i.test(t)))o.push("workshops");if(/volunteer/i.test(t))o.push("volunteers");if(/council/i.test(t))o.push("council");return o.length?o:["workshops"]};
        var aud=function(tp){var seen={},src={},n=0,d=DEF(tp)||{roles:[]},add=function(e,nm,s){e=(e||"").toLowerCase();if(!ok(e))return;var r=LR(e,tp);if(r&&r.status==="off")return;(src[e]=src[e]||[]).indexOf(s)<0&&src[e].push(s);if(!(e in seen)){seen[e]=nm||"";n++}};
          if(d.member_choice)T.members.forEach(function(m){if(m.status==="approved"&&(m.email_prefs||[]).indexOf(tp)>=0)add(m.email,m.display_name,"member")});
          T.members.forEach(function(m){if(m.status==="approved"&&(m.roles||[]).some(function(x){return d.roles.indexOf(x)>=0}))add(m.email,m.display_name,"role")});
          if(d.include_admins&&user)add(user.email,(user.user_metadata||{}).full_name,"admin");
          E.lists.forEach(function(x){if(x.topic===tp&&x.status==="on")add(x.email,x.name,"added")});
          if(d.member_choice)(T.inquiries||[]).forEach(function(i){if(i.email_updates&&topics(i.interests).indexOf(tp)>=0)add(i.email,(i.first_name+" "+(i.last_name||"")).trim(),i.role==="Workshop guest"?"kiosk":"questionnaire")});return {n:n,list:seen,src:src}};
        var meta=function(){return E.defs.filter(function(d){return !d.removed}).map(function(d){return Object.assign({},d,{count:aud(d.key).n})})};
        if(fn==="admin_list_remove_list"){var d13=DEF(args.p_key);if(!d13)return R(null,"Unknown list");if(d13.builtin)return R(null,"The starting lists can’t be removed.");d13.removed=new Date().toISOString();save();return R(null)}
        if(fn==="admin_list_restore"){var d14=E.defs.filter(function(d){return d.key===args.p_key&&d.removed})[0];if(!d14)return R(null,"That list isn’t removed.");delete d14.removed;save();return R(null)}
        if(fn==="public_email_lists")return R(E.defs.filter(function(d){return d.member_choice&&!d.removed}).map(function(d){return {key:d.key,name:d.name,about:d.about}}));
        if(fn==="admin_lists_reach"){var u11={};(args.p_topics||[]).forEach(function(k){Object.keys(aud(k).list).forEach(function(e){u11[e]=1})});return R(Object.keys(u11).length)}
        if(fn==="admin_list_save"){var nm12=String(args.p_name||"").trim();if(nm12.length<2||nm12.length>60)return R(null,"Give the list a name (2 to 60 characters).");
          if(E.defs.some(function(d){return !d.removed&&d.name.toLowerCase()===nm12.toLowerCase()&&d.key!==args.p_key}))return R(null,"There’s already a list with that name.");
          if(args.p_key){var d12=DEF(args.p_key);d12.name=nm12;d12.about=String(args.p_about||"").trim()||null;if(args.p_member_choice!=null)d12.member_choice=!!args.p_member_choice;save();return R(args.p_key)}
          var k12=(nm12.toLowerCase().replace(/[^a-z0-9]/g,"")||"list").slice(0,20);if(!/^[a-z]/.test(k12))k12="list"+k12;var b12=k12,i12=1;while(E.defs.some(function(d){return d.key===k12})){i12++;k12=b12+i12}
          E.defs.push({key:k12,name:nm12,about:String(args.p_about||"").trim()||null,member_choice:!!args.p_member_choice,roles:[],include_admins:false,builtin:false});save();return R(k12)}
        if(fn==="admin_lists"){var a8=aud(args.p_topic);if(!DEF(args.p_topic))return R(null,"Unknown list");var m8=meta(),c8={};m8.forEach(function(x){c8[x.key]=x.count});
          return R({lists:m8,counts:c8,removed_lists:E.defs.filter(function(d){return d.removed}).map(function(d){return {key:d.key,name:d.name,at:d.removed,added:E.lists.filter(function(x){return x.topic===d.key&&x.status==="on"}).length}}),people:Object.keys(a8.list).sort(function(x,y){return (a8.list[x]||x).toLowerCase()<(a8.list[y]||y).toLowerCase()?-1:1}).map(function(e){var r=LR(e,args.p_topic);return {email:e,name:a8.list[e],sources:a8.src[e],note:r&&r.status==="on"?r.note:null,since:r&&r.status==="on"?r.at:new Date().toISOString()}}),
            removed:E.lists.filter(function(x){return x.topic===args.p_topic&&x.status==="off"}).map(function(x){return {email:x.email,name:x.name,how:x.source,at:x.at}})})}
        if(fn==="admin_list_add"){var o9={added:0,back:0,already:0,invalid:[],unsubscribed:[]},seen9={};(args.p_people||[]).forEach(function(p){var e=String(p.email||"").trim().toLowerCase();if(!ok(e)){o9.invalid.push(p.email);return}if(seen9[e])return;seen9[e]=1;var r=LR(e,args.p_topic);
            if(r&&r.status==="off"&&r.source==="unsubscribed"&&!args.p_force){o9.unsubscribed.push(e);return}
            if(r&&r.status==="off"){r.status="on";r.source="added";r.name=p.name||r.name;r.note=args.p_note||r.note;r.at=new Date().toISOString();o9.back++;return}
            if(e in aud(args.p_topic).list){o9.already++;return}E.lists.push({email:e,topic:args.p_topic,name:p.name||null,status:"on",source:"added",note:args.p_note||null,at:new Date().toISOString()});o9.added++});save();return R(o9)}
        if(fn==="admin_list_remove"){var e10=String(args.p_email||"").toLowerCase(),r10=LR(e10,args.p_topic),nm10=aud(args.p_topic).list[e10]||null;T.members.forEach(function(m){if((m.email||"").toLowerCase()===e10)m.email_prefs=(m.email_prefs||[]).filter(function(x){return x!==args.p_topic})});
          if(r10){r10.status="off";r10.source="removed";r10.at=new Date().toISOString()}else E.lists.push({email:e10,topic:args.p_topic,name:nm10,status:"off",source:"removed",at:new Date().toISOString()});save();return R(null)}
        if(fn==="admin_email_overview"){var cnt=function(f){return E.outbox.filter(f).length};
          return R({settings:E.settings,provider:E.provider,me:{email:user?user.email:"",events:E.me.events,send_to:E.me.send_to},templates:E.templates,
            counts:{waiting:cnt(function(x){return x.status==="queued"||x.status==="sending"}),sent:cnt(function(x){return x.status==="sent"}),failed:cnt(function(x){return x.status==="failed"}),today:cnt(function(x){return x.status==="sent"&&Date.now()-new Date(x.at)<864e5})},
            lists:meta()})}
        if(fn==="admin_email_settings"){var fa=String(args.p_from_addr||"").trim().toLowerCase(),rt=String(args.p_reply_to||"").trim().toLowerCase(),nm=String(args.p_from_name||"").replace(/[\r\n\t<>"@,;:]+/g," ").trim();
          if(nm.length<2||nm.length>60)return R(null,"Add a sender name (2 to 60 characters).");if(fa&&!ok(fa))return R(null,"The “from” address doesn’t look right.");if(rt&&!ok(rt))return R(null,"The reply address doesn’t look right.");
          E.settings={on:args.p_on!==false,from_name:nm,from_addr:fa,reply_to:rt,footer:String(args.p_footer||"").trim().slice(0,300)};save();return R(null)}
        if(fn==="admin_email_notify"){var st=String(args.p_send_to||"").trim().toLowerCase();if(st&&!ok(st))return R(null,"That email address doesn’t look right.");
          E.me={events:(args.p_events||[]).filter(function(x){return ["inquiry","profile","kiosk","registration","volunteer"].indexOf(x)>=0}),send_to:st};save();return R(null)}
        if(fn==="admin_email_template_save"){var t1=E.templates.filter(function(x){return x.key===args.p_key})[0],sb=String(args.p_subject||"").trim(),bd=String(args.p_body||"").trim();if(!t1)return R(null,"Message not found");
          if(sb.length<3||sb.length>150)return R(null,"The subject needs 3 to 150 characters.");if(bd.length<10||bd.length>8000)return R(null,"The message needs 10 to 8,000 characters.");
          t1.subject=sb;t1.body=bd;t1.auto_send=!!args.p_auto&&!!t1.auto_event;save();return R(null)}
        if(fn==="admin_email_preview"||fn==="admin_email_send"){var t2=E.templates.filter(function(x){return x.key===args.p_template})[0],v2=eVars(args.p_table,args.p_id);if(!t2)return R(null,"Message not found");if(!v2)return R(null,"That record is gone.");
          if(fn==="admin_email_preview")return R({to:v2.to_email,to_name:v2.to_name,subject:eFill(t2.subject,v2),body:eFill(t2.body,v2)});
          if(!E.settings.on)return R(null,"Email is switched off. Turn it on in Admin → Email.");if(!ok(v2.to_email))return R(null,"There’s no usable email address on this record.");
          eOut({kind:"reply",to:v2.to_email,subject:eFill(String(args.p_subject||"").trim()||t2.subject,v2),ref_table:args.p_table,ref:args.p_id,template:t2.key});
          if(args.p_table==="inquiries")T.inquiries.forEach(function(i){if(i.id===args.p_id&&i.status==="new")i.status="in progress"});save();return R({ok:true,to:v2.to_email})}
        if(fn==="admin_email_refs"){var a3=AUD[args.p_table];if(!a3)return R(null,"Unknown record");var nmOf=function(k){return (E.templates.filter(function(x){return x.key===k})[0]||{name:"Email"}).name};
          return R({on:E.settings.on,ready:E.provider.ready,templates:E.templates.filter(function(x){return x.audience===a3}).map(function(x){return{key:x.key,name:x.name,auto:x.auto_send,event:x.auto_event}}),
            refs:E.outbox.filter(function(x){return x.ref_table===args.p_table&&(x.kind==="reply"||x.kind==="auto")}).map(function(x){return{ref:x.ref,name:nmOf(x.template),status:x.status,at:x.at,auto:x.kind==="auto"}})})}
        if(fn==="admin_email_log")return R(E.outbox.map(function(x){return{id:x.id,at:x.at,kind:x.kind,to:x.to,subject:x.subject,status:x.status,error:x.error,sent_at:x.sent_at,tries:x.tries}}));
        if(fn==="admin_email_retry"){E.outbox.forEach(function(x){if(x.id===args.p_id){x.status="sent";x.error=null;x.sent_at=new Date().toISOString()}});save();return R(null)}
        if(fn==="admin_email_test"){if(!E.settings.on)return R(null,"Email is switched off. Turn it on first.");var to4=E.me.send_to||(user?user.email:"");eOut({kind:"test",to:to4,subject:"Test email from flintracing.org",template:"test"});E.provider={ready:true,at:new Date().toISOString(),note:""};save();return R({ok:true,to:to4})}
        if(fn==="admin_email_send_update"){var sb5=String(args.p_subject||"").trim(),bd5=String(args.p_body||"").trim(),to5=E.me.send_to||(user?user.email:""),tp5=(args.p_topics||[]).filter(DEF);if(!E.settings.on)return R(null,"Email is switched off. Turn it on first.");
          if(!tp5.length)return R(null,"Choose at least one list.");if(sb5.length<3)return R(null,"The subject needs 3 to 150 characters.");if(bd5.length<10)return R(null,"The message needs 10 to 8,000 characters.");
          if(args.p_test){eOut({kind:"test",to:to5,subject:"[Test] "+sb5,template:"update:"+tp5.join(".")});save();return R({ok:true,test:true,to:to5})}
          var u5={};tp5.forEach(function(k){Object.keys(aud(k).list).forEach(function(e){u5[e]=1})});var n5=Object.keys(u5).length;if(!n5)return R(null,"No one is on those lists yet.");
          Object.keys(u5).forEach(function(e){eOut({kind:"update",to:e,subject:sb5,template:"update:"+tp5.join(".")})});save();return R({ok:true,count:n5})}
        if(fn==="email_unsubscribe"){var em6="";try{em6=decodeURIComponent(String(args.p_e||"").replace(/(..)/g,"%$1"))}catch(e6){}
          var t6=String(args.p_topic||"").split(".").filter(DEF);
          if(!ok(em6)||!t6.length||!/^[0-9a-f]{40}$/.test(args.p_sig||""))return R(null,"This unsubscribe link isn’t valid.");
          if(args.p_go){t6.forEach(function(k){T.members.forEach(function(m){if((m.email||"").toLowerCase()===em6)m.email_prefs=(m.email_prefs||[]).filter(function(x){return x!==k})});var r6=LR(em6,k);if(r6){r6.status="off";r6.source="unsubscribed"}else E.lists.push({email:em6,topic:k,status:"off",source:"unsubscribed",at:new Date().toISOString()})});
            (T.inquiries||[]).forEach(function(i){if((i.email||"").toLowerCase()===em6)i.email_updates=false});save()}
          return R({email:em6,topic:args.p_topic,names:t6.map(function(k){return DEF(k).name}),done:!!args.p_go})}}
      return Promise.resolve({data:null,error:{message:"Unknown function"}})},
    auth:{getSession:function(){return Promise.resolve({data:{session:user?{user:user}:null}})},
      onAuthStateChange:function(cb){listeners.push(cb);setTimeout(function(){cb("INITIAL_SESSION",user?{user:JSON.parse(JSON.stringify(user))}:null)},0)},
      signInWithPassword:function(){user={id:"test-admin",email:"test-admin@flintracing.org",user_metadata:{full_name:"Test Admin"}};listeners.forEach(function(cb){cb("SIGNED_IN",{user:user})});return Promise.resolve({error:null})},
      signUp:function(c){return Promise.resolve({data:null,error:{message:"PREVIEW: This is the Claude preview, so no real account was created. Create your real account on your website (the GitHub test address)."}})},
      resend:function(){return Promise.resolve({error:null})},
      signInAnonymously:function(){user={id:"anon-"+rid(),is_anonymous:true,user_metadata:{}};listeners.forEach(function(cb){cb("SIGNED_IN",{user:user})});return Promise.resolve({data:{user:user,session:{user:user}},error:null})},
      updateUser:function(){return Promise.resolve({data:{},error:null})},
      resetPasswordForEmail:function(){return Promise.resolve({error:null})},
      signOut:function(){user=null;listeners.forEach(function(cb){cb("SIGNED_OUT",null)});return Promise.resolve({})}},
    storage:{from:function(){return{
      upload:function(path,file){return new Promise(function(res){
        /* shrink the photo so test data fits in browser storage */
        if(!/^image\//.test(file.type||"")){var fr=new FileReader();fr.onload=function(){files[path]=fr.result;res({error:null})};fr.onerror=function(){res({error:{message:"Couldn’t read file"}})};fr.readAsDataURL(file);return}
        var url=URL.createObjectURL(file),img=new Image();
        img.onload=function(){var w=Math.min(1200,img.naturalWidth),h=Math.round(img.naturalHeight*w/img.naturalWidth),c=document.createElement("canvas");c.width=w;c.height=h;
          c.getContext("2d").drawImage(img,0,0,w,h);files[path]=c.toDataURL("image/jpeg",0.82);URL.revokeObjectURL(url);res({error:null})};
        img.onerror=function(){res({error:{message:"Not an image"}})};img.src=url;})},
      getPublicUrl:function(p){return{data:{publicUrl:files[p]||""}}},
      createSignedUrl:function(p){return Promise.resolve({data:{signedUrl:files[p]||""},error:null})},
      download:function(p){return fetch(files[p]).then(function(r){return r.blob()}).then(function(b){return{data:b,error:null}},function(){return{data:null,error:{message:"missing"}}})},
      remove:function(){return Promise.resolve({data:null,error:null})}}}}
  }}};
  window.FR_TEST_RESET=function(){try{localStorage.removeItem(KEY)}catch(e){}location.reload()};
})();
