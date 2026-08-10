var tk="opencalculate.theme"
var hk="opencalculate.history"
var mh=100
var T={N:"NUMBER",I:"IDENT",O:"OP",L:"LPAREN",R:"RPAREN",C:"COMMA",E:"EOF"}
function PE(m){this.name="ParseError";this.message=m}
PE.prototype=Object.create(Error.prototype)
function d(c){return c>="0"&&c<="9"}
function a(c){return(c>="a"&&c<="z")||(c>="A"&&c<="Z")||c=="_"}
function gt(){try{var s=localStorage.getItem(tk);if(s=="light"||s=="dark")return s}catch(e){}
if(window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark"
return"light"}
function st(t){t=t=="dark"?"dark":"light"
document.documentElement.setAttribute("data-theme",t)
var m=document.querySelector('meta[name="theme-color"]')
if(m)m.setAttribute("content",t=="dark"?"#000000":"#ffffff")
return t}
function bt(){return st(gt())}
function ft(){var c=document.documentElement.getAttribute("data-theme")||gt()
var n=c=="dark"?"light":"dark"
try{localStorage.setItem(tk,n)}catch(e){}
return st(n)}
function lh(){try{var r=localStorage.getItem(hk);if(!r)return[]
var x=JSON.parse(r);return Array.isArray(x)?x:[]}catch(e){return[]}}
function sh(a){try{localStorage.setItem(hk,JSON.stringify(a.slice(0,mh)))}catch(e){}}
function gh(){return lh()}
function ph(e,r){var a=lh()
if(a[0]&&a[0].expression==e&&a[0].result==r)return a[0]
var it={id:Date.now()+"-"+Math.random().toString(36).slice(2,8),expression:e,result:r,ts:Date.now()}
a.unshift(it);sh(a);return it}
function kh(id){sh(lh().filter(function(x){return x.id!=id}))}
function wh(){sh([])}
function cu(s){return String(s).replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/–/g,"-").replace(/√\s*\(/g,"sqrt(").replace(/√\s*([0-9.]+(?:e[+-]?[0-9]+)?)/gi,"sqrt($1)").trim()}
function tok(inp){
var src=cu(inp),ts=[],i=0
while(i<src.length){
var c=src[i]
if(c==" "||c=="\t"||c=="\n"||c=="\r"){i++;continue}
if(d(c)||(c=="."&&d(src[i+1]))){
var s=i;while(d(src[i]))i++
if(src[i]=="."){i++;while(d(src[i]))i++}
if(src[i]=="e"||src[i]=="E"){i++;if(src[i]=="+"||src[i]=="-")i++;if(!d(src[i]))throw new PE("Invalid scientific notation");while(d(src[i]))i++}
var raw=src.slice(s,i),v=Number(raw)
if(!Number.isFinite(v))throw new PE("Invalid number")
ts.push({type:T.N,value:v,raw:raw});continue}
if(a(c)||c=="π"){
if(c=="π"){ts.push({type:T.I,value:"pi"});i++;continue}
var s=i;while(a(src[i])||d(src[i]))i++
ts.push({type:T.I,value:src.slice(s,i).toLowerCase()});continue}
if("+-*/^%!(),".indexOf(c)!=-1){
if(c=="(")ts.push({type:T.L,value:c})
else if(c==")")ts.push({type:T.R,value:c})
else if(c==",")ts.push({type:T.C,value:c})
else ts.push({type:T.O,value:c})
i++;continue}
throw new PE('Unexpected character: "'+c+'"')}
ts.push({type:T.E,value:null});return ts}
function ev(inp,opts){
opts=opts||{}
var ang=opts.angleMode=="rad"?"rad":"deg",ts=tok(inp),p=0
if(ts.length==1)throw new PE("Empty expression")
function pk(){return ts[p]}
function et(tp){var t=ts[p];if(t.type!=tp)throw new PE("Unexpected token");p++;return t}
function ht(tp,v){var t=ts[p];if(t.type==tp&&(v===undefined||t.value==v)){p++;return true}return false}
function tr(x){return ang=="deg"?(x*Math.PI)/180:x}
function fr(x){return ang=="deg"?(x*180)/Math.PI:x}
function fc(n){if(!Number.isFinite(n)||n<0)throw new PE("Factorial requires n ≥ 0")
if(!Number.isInteger(n))throw new PE("Factorial requires an integer")
if(n>170)throw new PE("Factorial overflow")
var r=1;for(var i=2;i<=n;i++)r*=i;return r}
function cm(t){if(t.type==T.I&&t.value=="of")return false;return t.type==T.N||t.type==T.I||t.type==T.L}
function ex(){var L=tm();while(true){if(pk().type==T.I&&pk().value=="of"){p++;L=L*tm();continue}
if(ht(T.O,"+"))L=L+tm();else if(ht(T.O,"-"))L=L-tm();else break}return L}
function tm(){var L=pw();while(true){if(ht(T.O,"*"))L=L*pw()
else if(ht(T.O,"/")){var R=pw();if(R==0)throw new PE("Division by zero");L=L/R}
else if(cm(pk()))L=L*pw();else break}return L}
function pw(){var b=un();if(ht(T.O,"^")){var e=pw(),r=Math.pow(b,e)
if(!Number.isFinite(r))throw new PE("Power overflow");return r}return b}
function un(){if(ht(T.O,"+"))return un();if(ht(T.O,"-"))return -un();return po()}
function po(){var v=pr();while(true){if(ht(T.O,"!"))v=fc(v);else if(ht(T.O,"%"))v=v/100;else break}return v}
function pr(){
var t=pk()
if(t.type==T.N){p++;return t.value}
if(t.type==T.I){
p++;var nm=t.value
if(nm=="pi"||nm=="π")return Math.PI
if(nm=="e"&&pk().type!=T.L)return Math.E
if(nm=="of")throw new PE('Unexpected "of"')
if(pk().type==T.L){
et(T.L);var args=[]
if(pk().type!=T.R){args.push(ex());while(ht(T.C))args.push(ex())}
et(T.R);return df(nm,args)}
if(nm=="e")return Math.E
throw new PE("Unknown identifier: "+nm)}
if(t.type==T.L){et(T.L);var v=ex();et(T.R);return v}
throw new PE("Expected number or expression")}
function df(nm,args){
function one(){if(args.length!=1)throw new PE(nm+"() expects 1 argument");return args[0]}
function two(){if(args.length!=2)throw new PE(nm+"() expects 2 arguments");return args}
switch(nm){
case"sin":return Math.sin(tr(one()))
case"cos":return Math.cos(tr(one()))
case"tan":var trr=Math.tan(tr(one()));if(!Number.isFinite(trr))throw new PE("Undefined tan");return trr
case"asin":var ax=one();if(ax<-1||ax>1)throw new PE("asin domain is [-1, 1]");return fr(Math.asin(ax))
case"acos":var cx=one();if(cx<-1||cx>1)throw new PE("acos domain is [-1, 1]");return fr(Math.acos(cx))
case"atan":return fr(Math.atan(one()))
case"log":case"log10":var lx=one();if(lx<=0)throw new PE("log requires positive argument");return Math.log10(lx)
case"ln":case"loge":var nx=one();if(nx<=0)throw new PE("ln requires positive argument");return Math.log(nx)
case"sqrt":var sx=one();if(sx<0)throw new PE("Square root of negative number");return Math.sqrt(sx)
case"abs":return Math.abs(one())
case"floor":return Math.floor(one())
case"ceil":return Math.ceil(one())
case"round":return Math.round(one())
case"fact":case"factorial":return fc(one())
case"pow":var pp=two(),prr=Math.pow(pp[0],pp[1]);if(!Number.isFinite(prr))throw new PE("Power overflow");return prr
case"exp":return Math.exp(one())
default:throw new PE("Unknown function: "+nm)}}
var out=ex()
if(pk().type!=T.E)throw new PE("Unexpected input after expression")
if(!Number.isFinite(out))throw new PE("Result is not a finite number")
return out}
function nn(n){
if(!Number.isFinite(n))return String(n)
if(Object.is(n,-0))return"0"
var a=Math.abs(n)
if(a!=0&&(a>=1e12||a<1e-9))return n.toExponential(10).replace(/\.?0+e/,"e").replace(/e\+/,"e")
var r=Math.round(n*1e12)/1e12,s=String(r)
if(s.indexOf("e")!=-1||s.indexOf("E")!=-1)return r.toPrecision(12).replace(/\.?0+e/,"e")
if(s.indexOf(".")!=-1)s=s.replace(/\.?0+$/,"")
return s=="-0"?"0":s}
function Calc(o){
this.oc=o.onChange
this.oh=o.onHistory||function(){}
this.e="";this.r=null;this.le="";this.err=null;this.je=false;this.m="basic";this.ang="deg"}
Calc.prototype.st=function(){return{expression:this.e,result:this.r,lastExpression:this.le,error:this.err,justEvaluated:this.je,mode:this.m,angleMode:this.ang}}
Calc.prototype.pg=function(){this.oc(this.st())}
Calc.prototype.sm=function(m){this.m=m=="scientific"?"scientific":"basic";this.pg()}
Calc.prototype.fa=function(){this.ang=this.ang=="deg"?"rad":"deg";this.pg()}
Calc.prototype.cl=function(){this.e="";this.r=null;this.le="";this.err=null;this.je=false;this.pg()}
Calc.prototype.bs=function(){if(this.err){this.err=null;this.pg();return}
if(this.je){this.e=this.r||"";this.r=null;this.je=false}
this.e=this.e.slice(0,-1);this.err=null;this.pg()}
Calc.prototype.put=function(t){
if(this.err){this.err=null;this.e=""}
if(this.je){var ops="+-*/^%"
if((t.length==1&&ops.indexOf(t)!=-1)||t=="!"||t=="%")this.e=(this.r||"0")+t
else this.e=t
this.r=null;this.je=false;this.pg();return}
this.e+=t;this.pg()}
Calc.prototype.sq=function(){
if(this.je&&this.r!=null){this.e="("+this.r+")^2";this.r=null;this.je=false;this.err=null;this.pg();return}
if(this.e=="")return
this.e="("+this.e+")^2";this.pg()}
Calc.prototype.fb=function(){
if(this.je&&this.r!=null){this.e="("+this.r+")!";this.r=null;this.je=false;this.err=null;this.pg();return}
this.put("!")}
Calc.prototype.eq=function(){
var e=this.e.trim()
if(e==""&&this.r!=null){this.pg();return true}
if(e=="")return false
try{var v=ev(e,{angleMode:this.ang}),f=nn(v)
ph(e,f);this.r=f;this.le=e;this.e="";this.err=null;this.je=true;this.oh();this.pg();return true
}catch(ex){this.err=ex.message||"Error";this.je=false;this.pg();return false}}
Calc.prototype.le2=function(e){this.e=e;this.r=null;this.err=null;this.je=false;this.pg()}
Calc.prototype.ur=function(r){this.e=r;this.r=null;this.err=null;this.je=false;this.pg()}
bt()
function $(s,r){return(r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
var box=$("#disp"),ee=$("#expr"),ve=$("#val"),er=$("#err"),se=$("#sci"),ab=$("#ang")
var hb=$("#hist"),hbtn=$("#histBtn"),hu=$("#histList"),he=$("#histEmpty"),hc=$("#histClr")
var calc=new Calc({onChange:pt,onHistory:phh})
function pt(s){
if(s.error){box.classList.add("oops");ee.textContent=s.expression||"";ve.textContent="Error";er.hidden=false;er.textContent=s.error}
else{box.classList.remove("oops");er.hidden=true;er.textContent=""
if(s.justEvaluated&&s.result!=null){ee.textContent=s.lastExpression?s.lastExpression+" =":"";ve.textContent=s.result}
else if(s.expression){ee.textContent="";ve.textContent=s.expression}
else{ee.textContent="";ve.textContent=s.result!=null?s.result:"0"}}
$$(".tab").forEach(function(t){t.classList.toggle("on",t.getAttribute("data-mode")==s.mode)})
se.hidden=s.mode!="scientific";ab.textContent=s.angleMode=="deg"?"DEG":"RAD"}
function phh(){
var stuff=gh();hu.innerHTML="";he.hidden=stuff.length>0;hc.disabled=stuff.length==0
stuff.forEach(function(it){
var li=document.createElement("li");li.className="hi"
var b1=document.createElement("button");b1.type="button";b1.className="he";b1.textContent=it.expression
b1.addEventListener("click",function(){calc.le2(it.expression)})
var b2=document.createElement("button");b2.type="button";b2.className="hr";b2.textContent="= "+it.result
b2.addEventListener("click",function(){calc.ur(it.result)})
var b3=document.createElement("button");b3.type="button";b3.className="hd";b3.setAttribute("aria-label","Delete");b3.textContent="×"
b3.addEventListener("click",function(){kh(it.id);phh()})
li.appendChild(b1);li.appendChild(b2);li.appendChild(b3);hu.appendChild(li)})}
$$(".tab").forEach(function(t){t.addEventListener("click",function(){calc.sm(t.getAttribute("data-mode"))})})
ab.addEventListener("click",function(){calc.fa()})
$("#pad").addEventListener("click",function(e){
var btn=e.target.closest(".btn");if(!btn)return
var act=btn.getAttribute("data-action"),ins=btn.getAttribute("data-insert")
if(act=="clear")calc.cl()
else if(act=="backspace")calc.bs()
else if(act=="equals")calc.eq()
else if(act=="square")calc.sq()
else if(act=="factorial")calc.fb()
else if(ins!=null)calc.put(ins)})
hbtn.addEventListener("click",function(){hb.hidden=!hb.hidden;if(!hb.hidden)phh()})
hc.addEventListener("click",function(){if(confirm("Clear all history?")){wh();phh()}})
$("#themeBtn").addEventListener("click",function(){ft()})
function ty(el){if(!el)return false;var t=el.tagName;return t=="INPUT"||t=="TEXTAREA"||t=="SELECT"||el.isContentEditable}
document.addEventListener("keydown",function(e){
if(ty(e.target))return
var k=e.key
if(k>="0"&&k<="9"){e.preventDefault();calc.put(k);return}
if("+-*/^%().".indexOf(k)!=-1){e.preventDefault();calc.put(k);return}
if(k=="Enter"||k=="="){e.preventDefault();calc.eq();return}
if(k=="Escape"){e.preventDefault();calc.cl();return}
if(k=="Backspace"){e.preventDefault();calc.bs();return}
if(k=="!"){e.preventDefault();calc.put("!")}})
pt(calc.st())
phh()
