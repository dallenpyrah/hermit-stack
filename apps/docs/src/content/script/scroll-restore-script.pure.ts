const scrollRestoreScript = [
  "(function(){var w=window;try{",
  "var path=w.location.pathname,key='hermit-stack:scroll:'+path;",
  "var nav=w.performance.getEntriesByType('navigation')[0];",
  "var saved=w.sessionStorage.getItem(key),y=Number(saved);",
  "w.addEventListener('pagehide',function(){",
  "try{w.sessionStorage.setItem('hermit-stack:scroll:'+w.location.pathname,String(w.scrollY))}catch(e){}});",
  "if(!nav||nav.type!=='reload'||saved===null||saved===''||!Number.isFinite(y)||y<0)return;",
  "w.scrollTo(0,y);",
  "var keep=function(){if(w.location.pathname!==path){release();return}if(w.scrollY!==y)w.scrollTo(0,y)};",
  "var stops=['wheel','touchstart','keydown','mousedown','popstate','hashchange','pagehide'];",
  "var release=function(){",
  "w.removeEventListener('scroll',keep);",
  "for(var i=0;i<stops.length;i++)w.removeEventListener(stops[i],release)};",
  "w.addEventListener('scroll',keep);",
  "for(var i=0;i<stops.length;i++)w.addEventListener(stops[i],release,{passive:true});",
  "w.addEventListener('load',function(){w.setTimeout(release,400)})",
  "}catch(e){}})()",
].join("");

export { scrollRestoreScript };
