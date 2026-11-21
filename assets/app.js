(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function displayStem(q,fallback=''){return q?.displayStem||fallback||q?.statement||q?.stem||''}
function promptMarkup(q,answered=false){
 const extra=q?.displayStemHtml||'';
 const heading=questionTextMarkup(promptHeading(q),q,answered);
 const support=answered
  ?richTermsMarkup(extra,{question:q,linked:false,basic:true})
  :extra.split(htmlTags).map((piece,i)=>i%2&&/^<\/?a(?=[\s/>])/i.test(piece)?'':piece).join('');
 return `<h2>${heading}</h2>${support?`<div class="v2-prompt-extra v2-longtext">${support}</div>`:''}`;
}
function promptHeading(q,fallback=''){return q?.displayHeading||displayStem(q,fallback).split(/\r?\n/,1)[0]||''}
function optionText(o){return o?.displayText||o?.text||''}
const memoryAdapter={load:async()=>null,save:async()=>{},clear:async()=>{}};
const adapter=window.TextbookProgressAdapter||memoryAdapter;
const ALIASES={c09:['ELS','ELD','ELF','ELW'],c26:['ISA','개인종합자산관리계좌','연금저축'],c30:['bp','bps','퍼센트포인트'],c37:['PER','PBR','EV/EBITDA'],c43:['MACD','RSI','CCI','스토캐스틱','MAO'],c53:['PER','PBR','가치주','성장주'],c62:['ATM','ITM','OTM','등가격','내가격','외가격'],c64:['델타','감마','세타','베가'],c66:['샤프지수','트레이너지수','젠센알파','정보비율']};
let writeQueue=Promise.resolve(),record={answers:{},read:{}},data={course:{chapters:[]},concepts:[],registry:[]},units=[],lastChoiceId='',shownChoiceId='',freshAnswerId='',choiceNav=null;
function queueSave(){const snapshot=JSON.parse(JSON.stringify(record));writeQueue=writeQueue.then(()=>adapter.save(snapshot)).catch(()=>{});return writeQueue}
function allEpisodes(){return data.course.episodes||[]}
function choices(){return data.course.choiceQuestions||[]}
const OPTION_LABELS={A:'①',B:'②',C:'③',D:'④'},RELATION_LABELS={prerequisite:'먼저 배울 개념',similar:'비슷한 개념',contrast:'구별할 개념',applied:'적용 연결',numeric:'수치 연결',number:'수치 연결'};function optionLabel(id){return OPTION_LABELS[id]||id}function relationText(r){return r.label||RELATION_LABELS[r.type]||r.type||'관련 개념'}function choiceReason(markup,fallback=''){let html=markup||esc(fallback);return html.replace(/(정답(?:은|이|으로는)\s*)([A-D])(?=다|입니다|이야|\s|[,.\u00b7]|<)/g,(_,prefix,id)=>prefix+optionLabel(id))}
function retry(id,renderFn){delete record.answers[id];queueSave();renderFn()}
function answerChoice(q,id,renderFn){
 const before=measureChoice();
 record.answers[q.id]={selected:id,correct:id===q.correctOptionId,at:new Date().toISOString()};freshAnswerId=q.id;queueSave();renderFn();
 holdChoiceHeights(before);
}
const heldHeights=[];
const heightOf=el=>el?.getBoundingClientRect?.()?.height??0;
const choiceTexts=()=>[$('.v2-question > h2'),$('.v2-question > .v2-prompt-extra'),...$$('.v2-option')];
function measureChoice(){return choiceTexts().map(heightOf)}
function holdChoiceHeights(before){
 choiceTexts().forEach((el,i)=>{
  const was=before[i];
  if(el&&was&&heightOf(el)<was-.5){el.style.minHeight=was+'px';heldHeights.push(el)}
 });
}
window.addEventListener('resize',()=>{for(const el of heldHeights.splice(0))if(el.style)el.style.minHeight=''});
function explanationMarkup(html,text){
 return html?richTermsMarkup(html,{normalize:true}):`<p>${readerTermsMarkup(text||'',true)}</p>`;
}
function quizEasyReasons(q){
 return window.QuizEasyReasons?.[q.id];
}
function optionExplanation(q,option){
 const easy=quizEasyReasons(q)?.options?.[option?.id];
 if(easy)return explanationMarkup('',easy);
 const original=choiceReason(option?.explanationHtml,option?.explanation);
 return explanationMarkup(option?.explanationHtml?original:`<p>${original}</p>`);
}
function solutionMarkup(q){
 const easy=quizEasyReasons(q)?.reason;
 if(easy)return explanationMarkup('',easy);
 return q.options?optionExplanation(q,q.options.find(o=>o.id===q.correctOptionId)):explanationMarkup(q.explanationHtml,q.explanation);
}
function markMarkup(ok,fresh){return `<span class="v2-mark ${ok?'is-ok':'is-no'}${fresh?' is-fresh':''}" aria-hidden="true"></span>`}
function choiceFeedbackMarkup(q,answer,actions,fresh){
 if(answer===undefined)return '';
 const reason=quizEasyReasons(q)?.reason;
 const repeatsOption=reason&&q.options.some(option=>{
  const text=quizEasyReasons(q)?.options?.[option.id]||option.explanation;
  return reason.trim()===text?.trim();
 });
 return `<div class="v2-explain ${answer===q.correctOptionId?'correct':'incorrect'}">
  <h3>${markMarkup(answer===q.correctOptionId,fresh)}<span>${answer===q.correctOptionId?'맞았어요':'정답은 '+optionLabel(q.correctOptionId)+'번이에요'}</span></h3>
  ${reason&&!repeatsOption?`<div class="v2-explanation-copy">${explanationMarkup('',reason)}</div>`:''}
  ${actions}
 </div>`;
}
function epChoices(ep){const byId=new Map(choices().map(q=>[q.id,q]));return (ep.choiceQuestionIds||[]).map(id=>byId.get(id)).filter(Boolean)}
function setHash(hash){location.hash=hash}
const NAV_STORE='v2-nav';
let navMemo={y:{},h:{},p:{}},entryKey='';
try{
 const saved=JSON.parse(globalThis.sessionStorage?.getItem(NAV_STORE)||'null');
 if(saved&&typeof saved==='object')navMemo={y:saved.y||{},h:saved.h||{},p:saved.p||{}};
}catch(_){}
const tracksEntries=()=>Boolean(globalThis.history)&&'state' in history;
try{if(tracksEntries()&&'scrollRestoration' in history)history.scrollRestoration='manual'}catch(_){}
function saveNavMemo(){
 try{
  const keys=Object.keys(navMemo.h);
  for(const key of keys.slice(0,Math.max(0,keys.length-80)))for(const part of Object.values(navMemo))delete part[key];
  globalThis.sessionStorage?.setItem(NAV_STORE,JSON.stringify(navMemo));
 }catch(_){}
}
function jumpTo(y){
 try{window.scrollTo?.({top:y,left:0,behavior:'instant'})}catch(_){window.scrollTo?.(0,y)}
}
function replaceHash(hash){
 if(!globalThis.history?.replaceState)return false;
 history.replaceState(history.state??null,'',hash);
 if(entryKey)navMemo.h[entryKey]=hash;
 return true;
}
function leaveEntry(){if(entryKey)navMemo.y[entryKey]=Math.round(window.scrollY||0)}
function enterEntry(initialY=0){
 if(!tracksEntries())return 0;
 const previous=entryKey;
 let key=history.state?.v2key||'';
 const known=Boolean(key)&&key in navMemo.h;
 if(!known){
  key=key||Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  try{history.replaceState({...(typeof history.state==='object'?history.state:null),v2key:key},'')}catch(_){}
  navMemo.p[key]=previous;
  navMemo.y[key]=initialY;
 }
 entryKey=key;
 navMemo.h[key]=location.hash||'#choices';
 return navMemo.y[key]||0;
}
const previousHash=()=>(entryKey&&navMemo.h[navMemo.p[entryKey]])||'';
window.addEventListener('click',event=>{
 const link=event.target?.closest?.('a.dict-return,a.graph-overview-return,a.graph-dictionary-return');
 if(!link||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const href=link.getAttribute('href');
 if(href&&href===previousHash()&&history.length>1){event.preventDefault();history.back()}
});
function orderedEpisodes(){let path=data.course.learningPath?.stages||[],ids=path.flatMap(s=>s.unitIds||[]),ordered=allEpisodes().slice().sort((a,b)=>ids.indexOf(a.unitId)-ids.indexOf(b.unitId));let preferred=ordered.find(e=>e.oxQuestionId==='legacy:q-u11-01-05');if(preferred){preferred={...preferred,hook:'좋은 회사라면 비싸게 사도 괜찮을까?'};ordered=[preferred,...ordered.filter(e=>e.id!==preferred.id)]}return ordered}
function firstEpisode(){return orderedEpisodes()[0]}
function unitFor(id){return units.find(u=>u.id===id)}
function header(title,sub=''){return `<section class="v2-hero">${sub?`<span class="eyebrow">${esc(sub)}</span>`:''}<h1>${esc(title)}</h1></section>`}
function authoredTerms(){return [...data.concepts,...(data.course.glossary||[])]}
function allTerms(){return [...new Set(getPeekIndex().terms.values())]}
function getTerm(id){return getPeekIndex().terms.get(id)}
const stableTermIds={PER:'glossary-23611a9009c4e0a34430'};
const koreanPeekTitles=new Set([
 '경상수익률','듀레이션','만기수익률','맥컬레이 듀레이션','볼록성','수정듀레이션','콜옵션','표면이율','풋옵션',
 '주가수익비율','주가순자산비율','주당순이익','자기자본이익률',
]);
const regexLiteral=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let peekIndex;
function getPeekIndex(){
 if(peekIndex)return peekIndex;
 const catalog=authoredTerms();
 const terms=new Map(catalog.map(term=>[term.id,term]));
 const byId=new Map(),byAcronym=new Map(),names=new Map();
 const authoredNames=new Map();
 for(const term of catalog){
  for(const name of [term.title,term.displayTitle]){
   if(name&&!authoredNames.has(name))authoredNames.set(name,term);
  }
 }
 for(const [abbreviation,note] of Object.entries(window.QuizTermGuide||{})){
  const key=abbreviation.toUpperCase();
  const acronymTerm=terms.get(stableTermIds[key])||catalog.find(entry=>entry.title?.toUpperCase()===key||
   entry.aliases?.some(alias=>alias.toUpperCase()===key));
  const koreanTerm=authoredNames.get(note.name);
  const matchingKoreanTerm=(note.formula||koreanTerm?.formula)?koreanTerm:null;
  const term=acronymTerm||matchingKoreanTerm||{
   id:'quiz-term-'+key,title:abbreviation,summary:note.definition,aliases:[note.name,...(note.aliases||[])],
  };
  terms.set('quiz-term-'+key,term);
  const english=typeof note.english==='string'?[note.english]:note.english||[];
  const aliases=[note.name,...(note.aliases||[])];
  const entry={abbreviation,note,term,english,aliases};
  terms.set(term.id,term);
  byId.set(term.id,entry);
  if(matchingKoreanTerm&&!byId.has(matchingKoreanTerm.id))byId.set(matchingKoreanTerm.id,entry);
  byAcronym.set(key,entry);
  names.set(key,{term,entry,acronym:true,peek:true});
  for(const name of aliases){
   if(!name)continue;
   const authored=authoredNames.get(name);
   const matched=authored&&(authored===term||authored===matchingKoreanTerm);
   if(authored&&!matched&&name!==note.name)continue;
   names.set(name,{term:matched?authored:term,entry,acronym:false,
    peek:koreanPeekTitles.has(name)||Boolean(note.formula||term.formula)});
  }
 }
 for(const term of catalog){
  for(const name of [term.title,...(term.formula?term.aliases||[]:[])]){
   if((koreanPeekTitles.has(name)||(term.formula&&/[가-힣]/.test(name)))&&!names.has(name))names.set(name,{term,peek:true});
  }
 }
 for(const {term,note} of byId.values()){
  if(term.id.startsWith('quiz-term-')){
   term.links=(note.related||[]).map(name=>byAcronym.get(name.toUpperCase())?.term.id).filter(Boolean).map(target=>({target}));
  }
 }
 const alternatives=[...names.keys()].sort((a,b)=>b.length-a.length);
 const acronym=alternatives.filter(name=>names.get(name).acronym).map(regexLiteral).join('|');
 const korean=alternatives.filter(name=>!names.get(name).acronym).map(regexLiteral).join('|');
 const particles='으로는|이라고|입니다|에서는|으로|에서|부터|보다|까지|이다|과|와|은|는|이|가|을|를|의|에|로|도|만';
 const expressions=[
  acronym&&`(?<![a-zA-Z0-9_.-])(?:${acronym})(?![a-zA-Z0-9_-])`,
  korean&&`(?<![a-zA-Z0-9_가-힣])(?:${korean})(?=(?:${particles})?(?![a-zA-Z0-9_가-힣]))`,
 ].filter(Boolean);
 peekIndex={terms,byAcronym,byId,names,pattern:expressions.length?new RegExp(expressions.join('|'),'gi'):null};
 return peekIndex;
}

function termLabel(entry){return `${entry.abbreviation}(${entry.note.name})`}
function equivalentTermPart(value){
 return value.toLowerCase().replace(/\bto\b/g,'').replace(/[\s‐‑–—-]/g,'');
}
function isEquivalentPart(part,choices){
 const normalized=equivalentTermPart(part);
 return choices.some(value=>equivalentTermPart(value)===normalized);
}
function normalizeTerm(value,word,end,{entry,acronym}){
 if(!entry)return {word,end};
 const group=value.slice(end).match(/^[ \t]*[(（]([^()（）]+)[)）]/);
 if(group){
  const parts=group[1].split(/[，,·:：]/).map(part=>part.trim());
  const translations=[...entry.aliases,...entry.english,entry.abbreviation];
  const allEquivalent=parts.every(part=>isEquivalentPart(part,translations));
  const hasAbbreviation=parts.some(part=>isEquivalentPart(part,[entry.abbreviation]));
  if(allEquivalent&&(acronym||hasAbbreviation))return {word:termLabel(entry),end:end+group[0].length};
  if(acronym)return {word,end,conflict:true};
 }
 if(!acronym)return {word,end};
 const suffix=value.slice(end);
 const paired=[...entry.aliases,...entry.english].map(regexLiteral).join('|');
 const pair=paired&&suffix.match(new RegExp(`^[ \\t]*[·ㆍ・][ \\t]*(?:${paired})(?![a-zA-Z0-9_가-힣])`,'i'));
 return {word:termLabel(entry),end:end+(pair?.[0].length||0)};
}
const proseDot=/[ \t]*[·ㆍ・∙⋅‧･][ \t]*/g;
function normalizeProse(value){
 const pairs=/(매수)[ \t]*[·ㆍ・][ \t]*(매도)|(자산)[ \t]*[·ㆍ・][ \t]*(부채)|(수익)[ \t]*[·ㆍ・][ \t]*(위험)/g;
 return value.replace(pairs,(_,a,b,c,d,e,f)=>a?`${a} 및 ${b}`:c?`${c} 및 ${d}`:`${e}과 ${f}`)
  .replace(proseDot,(symbol,index,text)=>{
   const left=text.slice(0,index),right=text.slice(index+symbol.length);
   return /(?:\d|[)%]|(?:^|[^A-Za-z])[A-Za-z])$/.test(left)&&/^(?:\d|[(]|[A-Za-z](?![A-Za-z]))/.test(right)?symbol:', ';
  });
}
let basicTermPattern;
function basicTermsMarkup(value,escape=esc,omit){
 if(basicTermPattern===undefined){
  const names=Object.entries(window.QuizBasicTerms||{})
   .filter(([name,meaning])=>name&&typeof meaning==='string'&&meaning.trim())
   .map(([name])=>name).sort((a,b)=>b.length-a.length);
  const particles='으로부터|에게서는|이라고는|에서는|이라면|이라고|입니다|으로는|으로도|에게서|까지는|부터는|만으로|에도|에는|에만|만큼|이며|이고|이나|이다|이라|이란|인|으로|에서|에게|부터|보다|까지|과|와|은|는|이|가|을|를|의|에|로|도|만';
  const wordChar='[\\p{L}\\p{N}_]';
  basicTermPattern=names.length
   ?new RegExp(`(?<!${wordChar})(?:${names.map(regexLiteral).join('|')})(?=(?:${particles})?(?!${wordChar}))`,'gu')
   :null;
 }
 if(!basicTermPattern)return escape(value);
 let markup='',cursor=0;
 for(const match of value.matchAll(basicTermPattern)){
  const word=match[0];
  if(omit?.has(word))continue;
  markup+=escape(value.slice(cursor,match.index));
  markup+=`<button type="button" class="v2-basic-term" data-basic-term="${esc(word)}">${escape(word)}</button>`;
  cursor=match.index+word.length;
 }
 return markup+escape(value.slice(cursor));
}
function renderTermText(value,{linked=false,basic=linked,normalize=false,escape=esc,omit}={}){
 const {names,pattern}=getPeekIndex();
 const write=text=>{
  const prose=normalize?normalizeProse(text):text;
  return basic?basicTermsMarkup(prose,escape,omit):escape(prose);
 };
 if(!pattern)return write(value);
 let markup='',cursor=0;
 for(const match of value.matchAll(pattern)){
  if(match.index<cursor)continue;
  const literal=match[0],item=names.get(literal.toUpperCase());
  if(!item)continue;
  const end=match.index+literal.length;
  const expansion=normalizeTerm(value,literal,end,item);
  const formatted=normalize?expansion:{word:literal,end};
  if(item.acronym&&!/[A-Z]/.test(literal)&&
     (!normalize||(formatted.end===end&&(literal.length<3||literal==='per'||literal==='bps'))))continue;
  const alternateLP=item.entry?.abbreviation==='LP'&&/ETF|상장지수펀드|유동성\s*공급자|liquidity\s+provider/i.test(value);
  if(alternateLP)continue;
  markup+=write(value.slice(cursor,match.index));
  const label=escape(formatted.word);
  markup+=linked&&item.peek&&!expansion.conflict
   ?`<button type="button" class="v2-peek-term" data-peek-term="${esc(item.term.id)}" aria-haspopup="dialog">${label}</button>`
   :basic&&!item.acronym&&formatted.word===literal?basicTermsMarkup(literal,escape,omit):label;
  cursor=formatted.end;
 }
 return markup+write(value.slice(cursor));
}
let referenceFinder;
function findReferences(value,question){
 referenceFinder??=window.QuizReferences?.create(allTerms());
 return referenceFinder?.(value,question)||[];
}
function quizReferenceMarkup(value,question,escape){
 const matches=findReferences(value,question);
 if(!matches.length)return basicTermsMarkup(value,escape);
 const origin=location.hash||'#choices';
 let markup='',cursor=0;
 for(const {start,end,id} of matches){
  markup+=basicTermsMarkup(value.slice(cursor,start),escape);
  const href=dictionaryHref(id,origin);
  markup+=`<a class="v2-quiz-reference" href="${esc(href)}">${escape(value.slice(start,end))}</a>`;
  cursor=end;
 }
 return markup+basicTermsMarkup(value.slice(cursor),escape);
}
function questionTextMarkup(value,question,answered){
 return answered?quizReferenceMarkup(value,question,esc):esc(value);
}
function readerTermText(value){
 return renderTermText(value,{normalize:true,escape:text=>text});
}
function readerTermsMarkup(value,linked=false,omit){
 return renderTermText(value,{normalize:true,linked,basic:true,omit});
}
const htmlTags=/(<!--[\s\S]*?-->|<\/?[a-z](?:[^<>"']|"[^"]*"|'[^']*')*>)/gi;
const protectedMarkupTags=new Set(['a','button','code','label','math','pre','script','select','style','summary','svg','textarea']);
function richTermsMarkup(html,{question,linked=true,basic=linked,normalize=false,omit}={}){
 let protectedDepth=0;
 return html.split(htmlTags).map((piece,i)=>{
  if(i%2){
   const tag=piece.match(/^<(\/?)([a-z][\w-]*)\b/i);
   if(tag&&protectedMarkupTags.has(tag[2].toLowerCase())&&!piece.endsWith('/>'))protectedDepth+=tag[1]?-1:1;
   return piece;
  }
  if(protectedDepth||!piece||(!linked&&!basic&&!normalize))return piece;
  const text=normalize?piece.replace(/&nbsp;|&#160;/g,' '):piece;
  if(question)return quizReferenceMarkup(text,question,value=>value);
  return renderTermText(text,{linked,basic,normalize,omit,escape:value=>value});
 }).join('');
}
function peekTermTitle(term){
 const entry=getPeekIndex().byId.get(term.id);
 return entry?termLabel(entry):readerTermText(term.displayTitle||term.title);
}
function choiceOptionsMarkup(q,answer,fresh){
 const graded=answer!==undefined;
 return `<div class="v2-options${graded?' graded':''}">${q.options.map(o=>{
  const correct=o.id===q.correctOptionId;
  const mine=answer===o.id,selection=graded?(correct?'correct':mine?'incorrect':''):'';
  const labelId='choice-label-'+o.id,stateId='choice-state-'+o.id,whyId='choice-why-'+o.id;
  const state=selection?(mine?'내가 고른 답, ':'')+(correct?'정답':'오답'):'';
  const stateNote=state?`<span class="v2-sr-only" id="${esc(stateId)}">${state}</span>`:'';
  return `<div class="v2-option ${selection}">
   <div class="v2-option-head">
    <button type="button" class="v2-select-option" data-option="${esc(o.id)}" aria-labelledby="${esc(labelId)}" ${graded?'disabled':''}></button>
    ${graded?`<button type="button" class="v2-option-toggle" data-toggle-option="${esc(o.id)}" aria-labelledby="${esc(labelId)}${stateNote?' '+esc(stateId):''}" aria-controls="${esc(whyId)}" aria-expanded="false"></button>`:''}
    <span class="v2-option-label" id="${esc(labelId)}"><b>${optionLabel(o.id)}</b><span>${questionTextMarkup(optionText(o),q,graded)}</span></span>
    ${selection?markMarkup(correct,fresh):''}${stateNote}
    ${graded?'<span class="v2-option-chevron" aria-hidden="true"></span>':''}
   </div>
   ${graded?`<div class="v2-option-explanation" id="${esc(whyId)}" hidden><strong>${correct?'정답':'오답'}</strong>${optionExplanation(q,o)}</div>`:''}
  </div>`;
 }).join('')}</div>`;
}

function termNoteMarkup(term,note,{definitionMarkup,includeWorkedExample=true}={}){
 const summary=term.summary||term.description||'';
 const definition=term.definition||note?.definition||summary.replace(/^\s*-\s+/,'').split(/\s+-\s+/)[0];
 const formula=note?.formula||term.formula;
 const calculation=note?.calculation||term.calculation;
 const example=formula?(note?.interpretation||term.interpretation):note?.example;
 const omit=new Set([term.title,term.displayTitle,note?.name]);
 const definitionText=definitionMarkup??readerTermsMarkup(definition,false,omit);
 return `${definitionText?`<p>${definitionText}</p>`:''}
  ${formula?`<div class="v2-term-formula">
   <b>공식</b><p>${basicTermsMarkup(formula,esc,omit)}</p>
   ${includeWorkedExample&&calculation?`<b>숫자 대입</b><p>${basicTermsMarkup(calculation,esc,omit)}</p>`:''}
  </div>`:''}
  ${includeWorkedExample&&example?`<div class="v2-peek-example">
   <b>${formula?'예시 해석':'예시'}</b><p>${readerTermsMarkup(example,false,omit)}</p>
  </div>`:''}`;
}

function bindConceptPeek(){
 const dialog=$('#conceptPeek');
 if(!dialog?.showModal)return;
 const stack=[];
 let origin=null;
 const title=dialog.querySelector('#peekTitle');
 const contents=dialog.querySelector('#peekContents');
 const back=dialog.querySelector('#peekBack');
 const close=dialog.querySelector('#peekClose');
 function showTerm(term){
  const {terms,byId,byAcronym}=getPeekIndex();
  const note=byId.get(term.id)?.note;
  const relatedIds=new Set([
   ...(note?.related||[]).map(key=>byAcronym.get(key.toUpperCase())?.term.id||key),
   ...(term.links||[]).map(link=>link.target||link.id),
  ]);
  const related=[...relatedIds].filter(id=>!stack.some(item=>item.id===id)).map(id=>terms.get(id))
   .filter(item=>item&&(item.summary||item.definition||item.description||byId.get(item.id)?.note.definition)).slice(0,3);
  title.textContent=peekTermTitle(term);
  contents.innerHTML=`${termNoteMarkup(term,note)}
   ${related.length?`<div class="v2-peek-related"><div>${related.map(item=>`<button class="text-btn" type="button" data-peek-related="${esc(item.id)}">${esc(peekTermTitle(item))}</button>`).join('')}</div></div>`:''}`;
  contents.scrollTop=0;
  back.hidden=stack.length<2;
  if(!dialog.open)dialog.showModal();
  title.focus({preventScroll:true});
 }
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-peek-term]');
  if(!trigger)return;
  const term=getPeekIndex().terms.get(trigger.dataset.peekTerm);
  if(!term)return;
  origin=trigger;
  stack.splice(0,stack.length,term);
  showTerm(term);
 });
 contents.onclick=event=>{
  const trigger=event.target.closest('[data-peek-related]');
  if(!trigger)return;
  const term=getPeekIndex().terms.get(trigger.dataset.peekRelated);
  if(!term||stack.some(item=>item.id===term.id))return;
  stack.push(term);
  showTerm(term);
 };
 back.onclick=()=>{
  if(stack.length<2)return;
  stack.pop();
  showTerm(stack.at(-1));
 };
 close.onclick=()=>dialog.close();
 dialog.onclick=event=>{
  if(event.target===dialog)dialog.close();
 };
 dialog.onclose=()=>{
  if(dialog.open)return;
  stack.length=0;
  if(origin?.isConnected)origin.focus({preventScroll:true});
  origin=null;
 };
}
const dictChipKeys=['numbers','compare'];
let dictOpenChip='';
function toggleDictChip(key){
 dictOpenChip=dictOpenChip===key?'':key;
 for(const k of dictChipKeys){
  const chip=document.getElementById('dictChip-'+k),panel=document.getElementById('dictPanel-'+k);
  if(panel)panel.hidden=k!==dictOpenChip;
  if(chip){const on=String(k===dictOpenChip);if(chip.setAttribute)chip.setAttribute('aria-pressed',on);else chip.ariaPressed=on}
 }
}
function browseTerms(){
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
 const sorted=allTerms().slice().sort((a,b)=>collator.compare(a.displayTitle||a.title,b.displayTitle||b.title));
 const topics=new Set(data.concepts.map(c=>c.id));
 const isComparison=c=>topics.has(c.id)||c.comparison;
 const list=items=>`<ul class="dict-list">${items.map(c=>`<li><a href="${esc(dictionaryHref(c.id))}">${esc(peekTermTitle(c))}</a></li>`).join('')}</ul>`;
 const singles=sorted.filter(c=>!isComparison(c)), groups=sorted.filter(isComparison);
 const numericGroups=[['deadline','기한'],['rate','세율과 비율'],['limit','한도와 기준'],['formula','계산식']];
 const origin=quizOrigin(location.hash);
 const numbers=numericGroups.map(([family,label])=>{
  const items=data.registry.filter(item=>item.family===family).sort((a,b)=>collator.compare(a.title,b.title));
  return `<details class="dict-fold"><summary>${label}</summary><ul class="dict-list">${items.map(item=>
   `<li><a href="${esc(dictionaryHref(item.id,origin,'registry'))}">${esc(item.title)}</a></li>`
  ).join('')}</ul></details>`;
 }).join('');
 const chip=(key,label)=>`<button type="button" class="dict-chip" id="dictChip-${key}" data-dict-chip="${key}" aria-pressed="${dictOpenChip===key}" aria-controls="dictPanel-${key}">${label}</button>`;
 const panel=(key,body)=>`<div class="dict-panel" id="dictPanel-${key}"${dictOpenChip===key?'':' hidden'}>${body}</div>`;
 const dictionary=dictionaryReturnTarget(location.hash);
 const map=graphHref(undefined,dictionary==='#dictionary'?'':dictionary);
 return `<section class="dict-index"><div class="dict-chips" role="group" aria-label="사전 둘러보기">${chip('numbers','숫자와 기간')}${chip('compare','함께 비교하기')}<a class="dict-chip" href="${esc(map)}">개념 지도</a><a class="dict-chip" href="#questions">문제 목록</a></div>${panel('numbers',`<div class="dict-folds">${numbers}</div>`)}${panel('compare',list(groups))}${list(singles)}</section>`;
}
function termSearchNames(term){
 const entry=getPeekIndex().byId.get(term.id);
 return [term.title,term.displayTitle,peekTermTitle(term),...(term.aliases||[]),...(ALIASES[term.id]||[]),...(entry?.aliases||[])];
}

function matchesDictionaryTerm(term,query){
 return [...termSearchNames(term),term.summary,term.description,term.bodyMarkdown].join(' ').toLowerCase().includes(query);
}

const quizRoute=/^#(?:choices|(?:choice|ox)\/[\w.-]+)$/;
function dictionaryHref(id,origin=quizOrigin(location.hash),section='dictionary'){
 const params=new URLSearchParams();
 if(quizRoute.test(origin))params.set('from',origin);
 return '#'+section+'/'+encodeURIComponent(id)+(params.size?'?'+params:'');
}

function broaderConceptsMarkup(term,href){
 const parents=(term.broaderIds||[]).map(getTerm).filter(Boolean);
 if(!parents.length)return '';
 const links=parents.map(parent=>`<a class="v2-dict-term" href="${esc(href(parent.id))}">${esc(peekTermTitle(parent))}</a>`);
 return `<p class="v2-broader-concepts"><b>상위 개념</b> ${links.join(', ')}</p>`;
}

function dictionaryDefinitionMarkup(value,term,linkedIds){
 const omit=new Set([term.title,term.displayTitle,getPeekIndex().byId.get(term.id)?.note.name]);
 const matches=findReferences(value,{conceptIds:[term.id]});
 let markup='',cursor=0;
 for(const {start,end,id} of matches){
  if(id===term.id||linkedIds.has(id))continue;
  markup+=readerTermsMarkup(value.slice(cursor,start),false,omit);
  markup+=`<a class="v2-dict-term" href="${esc(dictionaryHref(id))}">${esc(value.slice(start,end))}</a>`;
  linkedIds.add(id);
  cursor=end;
 }
 return markup+readerTermsMarkup(value.slice(cursor),false,omit);
}

function studyNote(label,content){
 return content?`<section class="dict-study-note"><h3>${label}</h3>${content}</section>`:'';
}
function studyNoteText(text,item,linkedIds){
 return text?.trim()?`<p>${dictionaryDefinitionMarkup(text,item,linkedIds)}</p>`:'';
}

function dictionaryReadingMarkup(notes,{body='',resources=''}={}){
 if(!notes&&!body&&!resources)return '';
 const label=body?(resources?'추가 설명 및 관련 자료':'추가 설명'):'관련 자료';
 const details=body||resources?`<details class="dict-reading-details"><summary>${label}</summary>
  ${body}${resources}</details>`:'';
 return `<article class="dict-reading"><h2>개념 해설</h2>${notes}${details}</article>`;
}

const dictionaryTextKey=html=>html.replace(/<[^>]+>/g,'').trim()
 .replace(/^(?:예시?|예를 들어)\s*[:：]?\s+/,'').replace(/\s+/g,'').replace(/[.!?]+$/,'');

function dictionaryComparison(term,title,body){
 const table=term.studyTable;
 if(!table?.length)return {comparison:'',body};
 const keys=table.flat().map(cell=>dictionaryTextKey(esc(cell)));
 let sourceCells=[];
 const sourceTable=[...body.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/g)].find(([html])=>{
  const cells=[...html.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/g)].map(match=>match[1]);
  if(cells.length!==keys.length||!cells.every((cell,i)=>dictionaryTextKey(cell)===keys[i]))return false;
  sourceCells=cells;
  return true;
 });
 let index=0;
 const cellText=cell=>sourceCells[index++]??readerTermsMarkup(cell);
 const comparison=`<div class="dict-comparison" tabindex="0" role="region" aria-label="${esc(title)} 비교표"><table${table[0].length>2?' class="is-wide"':''} aria-label="${esc(title)} 비교"><thead><tr>
  ${table[0].map(cell=>`<th scope="col">${cellText(cell)}</th>`).join('')}</tr></thead><tbody>
  ${table.slice(1).map(row=>`<tr>${row.map((cell,i)=>i===0?`<th scope="row">${cellText(cell)}</th>`:`<td>${cellText(cell)}</td>`).join('')}</tr>`).join('')}
 </tbody></table></div>`;
 return {comparison,body:sourceTable?body.replace(sourceTable[0],''):body};
}

let findStudyChecks;
const dictionarySessions=new Map();
function dictionaryCheckMarkup(item){
 let session=dictionarySessions.get(item.id);
 if(!session){
  findStudyChecks??=window.DictionaryOx.create(allTerms(),data.registry,allOxQuestions(),choices());
  const checks=[...(item.studyChecks||[]),...findStudyChecks(item)];
  const unique=new Map();
  for(const check of checks){
   if(!unique.has(check.statement))unique.set(check.statement,check);
  }
  session={checks:[...unique.values()],index:0,selected:null};
  dictionarySessions.set(item.id,session);
 }
 if(!session.checks.length)return '';
 return `<section class="dict-check" data-entry-id="${esc(item.id)}" aria-label="이해 확인, OX">${studyQuestionMarkup(session)}</section>`;
}

function studyQuestionMarkup({checks,index,selected},fresh=false){
 const question=checks[index],answered=selected!==null,right=answered&&selected===question.answer;
 const feedback=answered?`<div class="dict-check-feedback ${right?'correct':'incorrect'}" tabindex="-1">
  <strong>${markMarkup(right,fresh)}<span>${right?'맞았어요':'다시 짚어봐요'}. 정답은 ${question.answer?'O':'X'}예요.</span></strong>
  <p>${readerTermsMarkup(question.explanation)}</p></div>`:'';
 const answerButton=value=>{
  const mark=value?'O':'X',meaning=value?'맞다':'틀리다',mine=answered&&selected===value,key=answered&&question.answer===value;
  const state=key?'정답':mine?'오답':'';
  return `<button type="button" ${state?`class="${key?'is-correct':'is-wrong'}" `:''}data-study-action="${value}" aria-label="${mark}, ${meaning}${mine?', 내가 고른 답':''}${state?', '+state:''}"${answered?' disabled':''}><b>${mark}</b></button>`;
 };
 const next=answered
  ?`<button type="button" class="text-btn" data-study-action="${index+1<checks.length?'next':'restart'}">${index+1<checks.length?'다음으로 →':checks.length>1?'처음부터 다시 풀기':'다시 풀기'}</button>`:'';
 return `<div class="dict-check-heading"><h3>이해 확인</h3>${checks.length>1?`<small>${index+1} / ${checks.length}</small>`:''}</div>
  <p class="dict-check-question" tabindex="-1">${esc(question.statement)}</p>
  <div class="dict-check-options">${answerButton(true)}${answerButton(false)}</div>${feedback}${next}`;
}

function bindDictionaryCheck(){
 const block=document.querySelector('.dict-check');
 const session=dictionarySessions.get(block?.dataset.entryId);
 if(!session)return;
 block.onclick=event=>{
  const button=event.target.closest('[data-study-action]');
  if(!button||!block.contains(button))return;
  const action=button.dataset.studyAction;
  if(action==='restart'){session.index=0;session.selected=null}
  else if(action==='next'){session.index+=1;session.selected=null}
  else session.selected=action==='true';
  block.innerHTML=studyQuestionMarkup(session,session.selected!==null);
  const target=block.querySelector(session.selected===null?'.dict-check-question':'.dict-check-feedback');
  target.focus({preventScroll:true});
  block.scrollIntoView?.({block:'nearest'});
 };
}

const termFigureMarkup=id=>globalThis.TermFigures?.forTerm?.(id)?.markup||'';

const dictionaryTermTitle=term=>term.id==='c50'?'전략적 자산배분과 전술적 자산배분':peekTermTitle(term);

function dictionaryNeighborhoodMarkup(term,page=1){
 const members=getAtlasCatalog().members(term.id);
 if(members?.length>1){
  return graphDiagramMarkup(dictionaryTermTitle(term),members,{
   page,neighborHref:dictionaryHref,relationFor:()=>'구성 개념',collectionLabel:'구성 개념',
  });
 }
 const node=members?.length===1?members[0]:term;
 return graphNeighborhoodMarkup(node,{page,neighborHref:dictionaryHref});
}

function dictionaryTermMarkup(term,selected){
 const note=getPeekIndex().byId.get(term.id)?.note;
 const title=dictionaryTermTitle(term);
 const rawDefinition=term.id==='c50'
  ?'전략적 자산배분은 장기 목표에 맞춰 자산별 기준 비중을 정한다. 전술적 자산배분은 시장 전망에 따라 그 비중을 잠시 조정한다.'
  :term.definition||note?.definition||term.summary||term.description||'';
 const definition=term.studyTable?rawDefinition.split('|')[0].trim():rawDefinition;
 if(!selected){
  const preview=definition.slice(0,180)+(definition.length>180?'…':'');
  return `<article><h3><a href="${esc(dictionaryHref(term.id))}">${esc(title)}</a></h3>${preview?`<p>${esc(readerTermText(preview))}</p>`:''}</article>`;
 }
 const linkedIds=new Set();
 const definitionMarkup=dictionaryDefinitionMarkup(definition,term,linkedIds);
 const explanation=termNoteMarkup(term,note,{definitionMarkup,includeWorkedExample:false});
 const formula=note?.formula||term.formula;
 const calculation=formula?(note?.calculation||term.calculation):'';
 const interpretation=formula?(note?.interpretation||term.interpretation):'';
 const example=term.studyExample&&(!calculation||term.studyChecks?.length)?term.studyExample
  :!formula||(!calculation&&!interpretation)?note?.example:'';
 const visible=new Set([definition,formula].filter(Boolean).map(value=>dictionaryTextKey(esc(value))));
 const unique=text=>{
  const key=dictionaryTextKey(esc(text));
  if(!key||visible.has(key))return false;
  visible.add(key);
  return true;
 };
 const omit=new Set([term.title,term.displayTitle,note?.name]);
 const exampleMarkup=[
  unique(calculation)?`<div class="v2-term-formula dict-calculation"><b>숫자 대입</b><p>${basicTermsMarkup(calculation,esc,omit)}</p></div>`:'',
  unique(interpretation)?studyNoteText(interpretation,term,linkedIds):'',
  unique(example)?studyNoteText(example,term,linkedIds):'',
 ].join('');
 const point=unique(term.studyPoint)?studyNoteText(term.studyPoint,term,linkedIds):'';
 const source=term.bodyMarkdown?.trim()!==definition.trim()?term.bodyHtml||'':'';
 const {comparison,body}=dictionaryComparison(term,title,source);
 const formatBody=html=>richTermsMarkup(
  html.replace(/href="#(?:glossary|dictionary)\/([\w.-]+)"/g,(_,id)=>`href="${esc(dictionaryHref(id))}"`),
  {linked:false,basic:true,normalize:true,omit},
 );
 const extraBody=body.replace(/<(p|li|pre)\b[^>]*>([\s\S]*?)<\/\1>/g,(block,_,content)=>
  !/<a\b/.test(content)&&visible.has(dictionaryTextKey(content))?'':block)
  .replace(/<(?:ul|ol)>\s*<\/(?:ul|ol)>/g,'').trim();
 const related=[...new Set((term.links||[]).map(link=>link.target||link.id))]
  .filter(id=>id!==term.id&&!linkedIds.has(id)).map(getTerm).filter(Boolean).slice(0,3);
 const unitLinks=(term.unitIds||[]).map(unitFor).filter(Boolean)
  .map(u=>`<a href="#unit/${esc(encodeURIComponent(u.id))}">${esc(u.title)}</a>`);
 const extraLinks=[
  ...related.map(item=>`<a href="${esc(dictionaryHref(item.id))}">${esc(peekTermTitle(item))}</a>`),
  ...unitLinks,
 ];
 const neighborhood=dictionaryNeighborhoodMarkup(term);
 const mapLink=`<a class="v2-dict-map" href="${esc(graphAtlasHref(term.id,dictionaryReturnTarget(location.hash)))}">개념 지도에서 보기 →</a>`;
 if(data.concepts.some(item=>item.id===term.id)){
  extraLinks.push(`<a href="${esc(practiceConceptHref(term.id))}">관련 문제 풀기</a>`);
 }
 const reading=dictionaryReadingMarkup(
  studyNote('예시',exampleMarkup)+studyNote('비교',formatBody(comparison))+studyNote('주의할 점',point),{
   body:extraBody?`<div class="v2-longtext">${formatBody(extraBody)}</div>`:'',
   resources:extraLinks.length?`<div class="v2-dict-links">${extraLinks.join('')}</div>`:'',
  },
 );
 return `<article class="v2-dict-card${title.length>16?' is-long':''}"><h2>${esc(title)}</h2>
  ${explanation}${termFigureMarkup(term.id)}${broaderConceptsMarkup(term,dictionaryHref)}${window.OptionLab.conceptMarkup(term.id)}
  ${neighborhood?'':mapLink}</article>${reading}${dictionaryCheckMarkup(term)}
  ${neighborhood?`<section class="v2-dict-neighborhood" aria-label="연결 개념"><div id="dictionaryNeighborhood">${neighborhood}</div>${mapLink}</section>`:''}`;
}

function registryFields(item){
 return [['대상',item.subject],['적용 시점',item.trigger],['단위',item.unit],['기준',item.rule],['비교',item.contrast]]
  .filter(([,value])=>value);
}

function dictionaryMarkup(query,selectedId){
 const search=query.trim().toLowerCase();
 if(!search&&!selectedId)return browseTerms();
 if(selectedId){
  const chosen=getTerm(selectedId);
  return `<div class="v2-dictionary">${chosen?dictionaryTermMarkup(chosen,true):'<p>개념을 찾을 수 없어요.</p>'}</div>`;
 }
 const concepts=allTerms().filter(term=>matchesDictionaryTerm(term,search));
 const numbers=data.registry.filter(item=>Object.values(item).some(value=>typeof value==='string'&&value.toLowerCase().includes(search)));
 const exact=term=>Number(termSearchNames(term).some(name=>name?.toLowerCase()===search));
 concepts.sort((a,b)=>exact(b)-exact(a));
 const renderResults=(title,items,markup)=>items.length
  ?`<section><h2>${title}</h2><div class="dict-rows">${items.slice(0,60).map(markup).join('')}</div>${items.length>60?'<p class="dict-note">검색어를 좁히면 더 많은 항목을 찾을 수 있어요.</p>':''}</section>`:'';
 const conceptsHtml=renderResults('개념',concepts,term=>dictionaryTermMarkup(term,false));
 const numbersHtml=renderResults('숫자와 기간',numbers,item=>`<article>
  <h3><a href="${esc(dictionaryHref(item.id,quizOrigin(location.hash),'registry'))}">${esc(item.title)} <strong class="v2-number">${esc(item.value)}</strong></a></h3>
  ${item.meaning?`<p>${esc(item.meaning)}</p>`:''}
 </article>`);
 const results=/\d/.test(search)?numbersHtml+conceptsHtml:conceptsHtml+numbersHtml;
 return `<div class="v2-dictionary v2-dict-results">${results||'<p>검색 결과가 없어요.</p>'}</div>`;
}
function practiceConceptHref(id){const q=orderedChoiceQuestions().find(x=>(x.conceptIds||[]).includes(id));return q?'#choice/'+encodeURIComponent(q.id):'#questions'}
function quizOrigin(hash){
 if(!/^#(?:dictionary|registry)(?:[/?]|$)/.test(hash))return '';
 const origin=new URLSearchParams(hash.split('?')[1]||'').get('from')||'';
 return quizRoute.test(origin)?origin:'';
}
function renderDictionary(){let selectedId=decodeURIComponent(location.hash.startsWith('#dictionary/')?location.hash.slice(12).split('?')[0]:''),params=new URLSearchParams(location.hash.split('?')[1]||''),query=params.get('q')||'',selected=selectedId&&getTerm(selectedId),origin=quizOrigin(location.hash);
 const back=origin?`<a class="dict-return" href="${esc(origin)}">← 문제로 돌아가기</a>`:selected?'<a class="dict-return" href="#dictionary">← 전체 개념 보기</a>':'';
 $('#app').innerHTML=`<div class="v2-dict-page${selected?' is-entry':''}">${back}${header('개념 사전')}<label class="v2-dict-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="dictSearch" type="search" aria-label="개념, 숫자와 기간 검색" placeholder="개념, 숫자와 기간 검색" value="${esc((selected?peekTermTitle(selected):query))}"></label><div id="dictionaryResults"></div></div>`;
 let input=$('#dictSearch'),results=$('#dictionaryResults');
 results.onclick=event=>{
  const chip=event.target?.closest?.('[data-dict-chip]');
  if(chip)toggleDictChip(chip.dataset.dictChip);
  const button=event.target?.closest?.('[data-dict-graph-prev],[data-dict-graph-next]');
  if(!button)return;
  const neighborhood=button.closest('#dictionaryNeighborhood');
  const direction=button.hasAttribute('data-dict-graph-prev')?'data-dict-graph-prev':'data-dict-graph-next';
  const offset=window.scrollY;
  neighborhood.innerHTML=dictionaryNeighborhoodMarkup(selected,Number(button.getAttribute(direction)));
  jumpTo(offset);
  (neighborhood.querySelector(`[${direction}]`)||neighborhood.querySelector('.v2-graph-pages'))?.focus({preventScroll:true});
 };
 const refresh=()=>{
  const value=input.value,raw=selectedId&&value===(selected?peekTermTitle(selected):'')?'':value;
  const isEntry=Boolean(selected&&selectedId&&!raw);
  results.innerHTML=dictionaryMarkup(raw,raw?'':selectedId);
  $('.v2-dict-page')?.classList?.toggle('is-entry',isEntry);
  if(isEntry)window.OptionLab.bindConcept(results);
  bindDictionaryCheck();
  $$('[data-concept-link]').forEach(b=>b.onclick=()=>setHash('#dictionary/'+encodeURIComponent(b.dataset.conceptLink)));
  $$('[data-unit]').forEach(b=>b.onclick=()=>setHash('#unit/'+encodeURIComponent(b.dataset.unit)));
 };input.oninput=()=>{selectedId='';const search=new URLSearchParams();
 if(input.value)search.set('q',input.value);
 if(origin)search.set('from',origin);
 replaceHash('#dictionary'+(search.size?'?'+search:''));
 refresh()};refresh();
 if(!selectedId&&params.get('search')==='1')return input;
}
function renderRegistry(id){
 const item=data.registry.find(number=>number.id===id);
 if(!item){renderDictionary();return}
 const origin=quizOrigin(location.hash);
 const frontPoint=item.studyPoint||item.contrast;
 const fields=registryFields(item).filter(([label,value])=>label!=='기준'&&value!==frontPoint);
 const units=(item.unitIds||[]).map(unitFor).filter(Boolean);
 const linkedIds=new Set();
 const notes=studyNote('예시',studyNoteText(item.studyExample,item,linkedIds))
  +studyNote('주의할 점',studyNoteText(frontPoint,item,linkedIds));
 const reading=dictionaryReadingMarkup(notes,{
  body:fields.length?`<div class="v2-number-fields">${fields.map(([label,value])=>`<div><b>${label}</b><span>${esc(value)}</span></div>`).join('')}</div>`:'',
  resources:(item.related?.length?`<p>${item.related.map(esc).join(', ')}</p>`:'')
   +(units.length?`<div class="v2-dict-links">${units.map(u=>`<a href="#unit/${esc(encodeURIComponent(u.id))}">${esc(u.title)}</a>`).join('')}</div>`:''),
 });
 $('#app').innerHTML=`<div class="v2-dict-page is-number">${origin?`<a class="dict-return" href="${esc(origin)}">← 문제로 돌아가기</a>`:'<a class="dict-return" href="#dictionary">← 사전</a>'}${header(item.title)}<div class="v2-dictionary"><article class="v2-dict-card">
  <strong class="v2-number${String(item.value).length>12?' is-long':''}">${esc(item.value)}</strong>
  ${item.meaning?`<p>${esc(item.meaning)}</p>`:''}
  ${item.rule?`<p>${esc(item.rule)}</p>`:''}
 </article>${reading}${dictionaryCheckMarkup(item)}
 </div></div>`;
 bindDictionaryCheck();
}
function dictionaryReturnTarget(route){
 const [path,...query]=(route||'').split('?');
 const params=new URLSearchParams(query.join('?'));
 const origin=params.get('from')||'';
 if(path==='#dictionary'){
  const indexParams=new URLSearchParams();
  const search=params.get('q');
  if(search)indexParams.set('q',search);
  if(quizRoute.test(origin))indexParams.set('from',origin);
  return path+(indexParams.size?'?'+indexParams:'');
 }
 const match=path.match(/^#dictionary\/([\w.%-]+)$/);
 if(!match)return '';
 let id;
 try{id=decodeURIComponent(match[1])}catch(_){return ''}
 if(!getTerm(id))return '';
 return dictionaryHref(id,origin);
}
function graphDictionaryOrigin(){
 const [path,...query]=location.hash.split('?');
 if(!/^#(?:graph|map)(?:\/|$)/.test(path))return '';
 return dictionaryReturnTarget(new URLSearchParams(query.join('?')).get('dictionary'));
}
function graphHref(id,dictionary=graphDictionaryOrigin(),page=1){
 const path=id?'#graph/'+encodeURIComponent(id):'#graph';
 const params=new URLSearchParams();
 if(dictionary)params.set('dictionary',dictionary);
 if(page>1)params.set('page',page);
 return path+(params.size?'?'+params:'');
}
function graphAtlasHref(focus,dictionary=graphDictionaryOrigin()){
 const params=new URLSearchParams();
 if(focus)params.set('focus',focus);
 if(dictionary)params.set('dictionary',dictionary);
 return '#graph'+(params.size?'?'+params:'');
}
function graphDictionaryReturnMarkup(term){
 const target=graphDictionaryOrigin()||(term?dictionaryHref(term.id,''):'#dictionary');
 return `<a class="graph-dictionary-return" href="${esc(target)}">← 개념 사전으로 돌아가기</a>`;
}
const graphSourceNames={
 'law.go.kr':'국가법령정보센터',
 'kofia.or.kr':'금융투자협회',
 'samsungfund.com':'삼성자산운용',
};
function graphSourceLink(href,label=''){
 const internal=href.match(/^#(glossary|concept|dictionary|graph|unit|registry)\/([\w.~%-]+)$/);
 if(internal){
  const [,section,id]=internal;
  const term=getTerm(id);
  const target=term?graphHref(term.id):section==='graph'?graphHref(id):internal[0];
  const name=label||(term?esc(peekTermTitle(term)):section==='unit'?'단원 보기':'관련 항목 보기');
  return `<a href="${esc(target)}">${name}</a>`;
 }
 let url;
 try{url=new URL(href.replace(/^www\./i,'https://www.').replace(/&amp;/g,'&'))}catch(_){return label}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return label;
 const host=url.hostname.replace(/^www\./,'');
 const title=label&&!/^(?:https?:\/\/|www\.)\S+$/i.test(label)
  ?label:esc(graphSourceNames[host]||'출처 보기 ('+host+')');
 return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}
function graphLinksMarkup(html){
 const anchor=/<a href="([^"]+)">([\s\S]*?)<\/a>/g;
 const leftoverLink=/\[((?:[^\[\]]|\[[^\[\]]*\])+)\]\(((?:https?:\/\/|#)[^\s<>()]+)\)/gi;
 const bareLink=/\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
 return html.replace(/<blockquote>((?:<p>- [\s\S]*?<\/p>)+)<\/blockquote>/g,(_,items)=>
  `<ul>${items.replace(/<p>- /g,'<li>').replace(/<\/p>/g,'</li>')}</ul>`)
  .replace(anchor,(_,href,label)=>graphSourceLink(href,label))
  .split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/g).map((text,index)=>{
   if(index%2)return text;
   return text.split(leftoverLink).reduce((markup,piece,i,parts)=>{
    if(i%3===1)return markup+graphSourceLink(parts[i+1],piece);
    if(i%3===2)return markup;
    const named=piece.replace(/(^|\n)-?\s*([^<>:\n]+):\s+(https?:\/\/[^\s<>]+)/gi,
     (_,line,label,href)=>line+graphSourceLink(href,label.trim()));
    return markup+named.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/g).map((part,j)=>j%2?part:
     part.replace(bareLink,full=>{
      const href=full.replace(/[.,;!?]+$/,'');
      return graphSourceLink(href)+full.slice(href.length);
     })).join('');
   },'');
  }).join('');
}
function graphPassages(html){
 const sentences=[];
 let current='';
 const inline=/(<(a|strong|em|code)\b[^>]*>[\s\S]*?<\/\2>)/g;
 for(const [i,piece] of html.split(inline).entries()){
  if(i%3===1){current+=piece;continue}
  if(i%3===2)continue;
  let cursor=0;
  for(const match of piece.matchAll(/[가-힣][.!?][”’"')\]]*(?=\s|$)/g)){
   const end=match.index+match[0].length;
   sentences.push((current+piece.slice(cursor,end)).trim());
   current='';
   cursor=end;
  }
  current+=piece.slice(cursor);
 }
 if(current.trim())sentences.push(current.trim());
 const passages=[];
 const length=text=>text.replace(/<[^>]*>/g,'').length;
 for(const sentence of sentences){
  const last=passages.at(-1);
  if(last&&length(last)+length(sentence)+1<=118)passages[passages.length-1]+=' '+sentence;
  else passages.push(sentence);
 }
 return passages;
}
function graphCalculationSteps(term){
 return (data.course.calculationPaths?.[term.id]?.steps||[]).map(({parts,value})=>({
  parts:parts.map(part=>{
   if(typeof part==='string')return part.trim();
   const target=getTerm(part.id);
   const label=part.label||(target?peekTermTitle(target):part.id);
   return {label,href:target&&target.id!==term.id?graphHref(target.id):''};
  }),
  value,
 }));
}
function graphCalculationMarkup(steps){
 if(!steps.length)return '';
 const rows=steps.map(({parts,value})=>{
  const expression=parts.map(part=>{
   if(typeof part==='string')return esc(part);
   const label=esc(part.label);
   return part.href?`<a href="${esc(part.href)}">${label}</a>`:`<strong>${label}</strong>`;
  }).join(' ');
  return `<li><p class="v2-graph-equation">${expression}</p>${value?`<p class="v2-graph-calculation-value">${esc(value)}</p>`:''}</li>`;
 }).join('');
 return `<section class="v2-graph-calculation" aria-labelledby="graphCalculationTitle">
  <h3 id="graphCalculationTitle">계산 순서</h3>
  <ol>${rows}</ol>
 </section>`;
}
function graphCopyMarkup(term,steps){
 const note=getPeekIndex().byId.get(term.id)?.note||{};
 const definition=term.definition||note.definition||(!term.bodyHtml?(term.summary||term.description||''):'');
 const seen=new Set();
 const key=html=>html.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 const unique=html=>{
  const text=key(html);
  if(!text||seen.has(text))return false;
  seen.add(text);
  return true;
 };
 const plain=text=>(text||'').split(/\r?\n/).flatMap(line=>graphPassages(esc(line))).filter(unique);
 const intro=plain(definition);
 let lead=intro.shift()||'';
 const paragraphs=parts=>parts.map(part=>`<p>${part}</p>`).join('');
 const details=[paragraphs(intro)];
 const equationKey=html=>key(html).replace(/\s/g,'');
 const shownEquations=new Set(steps.flatMap(({parts,value})=>[
  parts.map(part=>typeof part==='string'?part:part.label).join(''),value,
 ]).filter(Boolean).map(text=>equationKey(esc(text))));
 const repeatsCalculation=html=>shownEquations.has(equationKey(html));
 const formula=note.formula||term.formula;
 const calculation=note.calculation||term.calculation;
 const interpretation=note.interpretation||term.interpretation;
 const example=term.studyExample||(!formula?note.example:null);
 for(const [label,text] of [['공식',formula],['계산 예시',calculation],['예시 해석',formula&&interpretation],
  ['예시',example],['주의할 점',term.studyPoint]]){
  const isEquation=label==='공식'||label==='계산 예시';
  const parts=plain(text).filter(part=>!isEquation||!repeatsCalculation(part));
  if(parts.length)details.push(`<h3>${label}</h3>${paragraphs(parts)}`);
 }
 const extra=graphLinksMarkup(term.bodyHtml||'')
 .replace(/<(pre|div) class="formula-(?:block|display)"(?: role="math")?>([\s\S]*?)<\/\1>/g,(block,_,content)=>
  !/<a\b/.test(content)&&repeatsCalculation(content)?'':block)
 .replace(/<(p|li)>([\s\S]*?)<\/\1>/g,(_,tag,content)=>{
  const parts=graphPassages(content).filter(part=>(unique(part)&&!repeatsCalculation(part))||/<a\b/.test(part));
  if(!lead&&parts.length)lead=parts.shift();
  if(!parts.length)return '';
  if(tag==='p')return paragraphs(parts);
  return `<li>${parts.length===1?parts[0]:paragraphs(parts)}</li>`;
 }).replace(/<(ul|ol|blockquote)>\s*<\/\1>/g,'').trim();
 if(extra)details.push(extra);
 const body=details.join('');
 return {
  lead:lead?`<p class="v2-graph-lead">${lead}</p>`:'',
  reading:body?`<details class="v2-graph-reading"><summary>더 읽기</summary><div class="v2-graph-copy">${body}</div></details>`:'',
 };
}
const atlasCamera={};
let atlasModel,atlasViewer,atlasCatalog;
function getAtlasCatalog(){
 if(!atlasCatalog){
  const resolveId=id=>getTerm(id)?.id||(id?.startsWith('quiz-term-')?getPeekIndex().byAcronym.get(id.slice(10).toUpperCase())?.term.id:undefined);
  atlasCatalog=globalThis.AtomicAtlas.create(allTerms(),data.course.atlasGroups||{},{
   resolveId,namesOf:termSearchNames,titleOf:peekTermTitle,connections:data.course.atlasConnections
  });
 }
 return atlasCatalog;
}
function getAtlasModel(){
 atlasModel??=window.AtlasLayout.build(getAtlasCatalog().graphTerms,{titleOf:peekTermTitle,chapters:data.course.chapters});
 return atlasModel;
}
function renderAtlas(focusId){
 const catalog=getAtlasCatalog();
 getAtlasModel();
 const focusTerm=getTerm(focusId);
 const members=focusId?catalog.members(focusId):undefined;
 const initialTerm=members?.[0]||focusTerm;
 const groupTitle=members?.length>1&&focusTerm?peekTermTitle(focusTerm):'';
 const camera=focusId?{}:atlasCamera;
 const root=$('#app');
 root.innerHTML=`<section class="atlas-screen" aria-labelledby="atlasTitle">
  <canvas data-atlas-canvas tabindex="0" aria-label="전체 개념 지도. 화살표 키로 이동하고 더하기와 빼기 키로 확대 또는 축소합니다.">검색창에서 개념을 골라 읽을 수 있어요.</canvas>
  <div class="atlas-top">
   <div class="atlas-heading" data-atlas-overlay="top">${graphDictionaryReturnMarkup(focusTerm)}<h1 id="atlasTitle">개념 지도</h1><p>${atlasModel.nodes.length.toLocaleString('ko-KR')}개 개념 <span aria-hidden="true">/</span> ${atlasModel.edges.length.toLocaleString('ko-KR')}개 연결</p></div>
   <div class="atlas-finder">
    <div class="atlas-search" data-atlas-overlay="top"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input type="search" id="atlasSearch" aria-label="지도에서 개념 찾기" placeholder="개념 찾기" autocomplete="off" aria-controls="atlasMatches"></div>
    <div id="atlasMatches" class="atlas-matches" hidden></div>
   </div>
  </div>
  <div class="atlas-footer"><div class="atlas-context"><span class="atlas-help"><span class="atlas-touch">두 손가락으로 확대</span><span class="atlas-mouse">휠로 확대</span>하면 개념 이름이 보여요.</span><a class="atlas-read" hidden></a></div>
   <div class="atlas-controls" data-atlas-overlay="bottom" role="group" aria-label="지도 배율">
    <button type="button" data-atlas-zoom="out" aria-label="축소">−</button><button type="button" data-atlas-zoom="fit" aria-label="전체 지도 맞춤" title="전체 지도 맞춤"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg></button><button type="button" data-atlas-zoom="in" aria-label="확대">+</button>
   </div>
  </div></section>`;
 const screen=root.querySelector('.atlas-screen');
 const open=id=>setHash(graphHref(id));
 atlasViewer=window.ConceptAtlas.mount(screen,atlasModel,{state:camera,onOpen:open});
 const input=$('#atlasSearch'),results=$('#atlasMatches');
 const read=screen.querySelector('.atlas-read'),help=screen.querySelector('.atlas-help');
 function showSelection(term){
  help.hidden=Boolean(term);
  read.hidden=!term;
  if(term){read.href=graphHref(term.id);read.innerHTML='<span class="atlas-read-name">'+esc(peekTermTitle(term))+'</span><span class="atlas-read-go">읽기 →</span>'}
 }
 if(initialTerm)atlasViewer.focus(initialTerm.id);
 if(camera.selectedId)showSelection(getTerm(camera.selectedId));
 if(groupTitle)input.value=groupTitle;
 function hideMatches(){results.hidden=true;results.replaceChildren()}
 function search(){
  const query=input.value.trim();
  if(!query){hideMatches();return}
  const matches=groupTitle&&query===groupTitle?members:catalog.search(query);
  results.innerHTML=matches.length?matches.map(term=>`<button type="button" data-atlas-term="${esc(term.id)}">${esc(peekTermTitle(term))}</button>`).join(''):'<p role="status">찾은 개념이 없어요.</p>';
  results.hidden=false;
 }
 function choose(button){
  const term=getTerm(button.dataset.atlasTerm);
  if(!term)return;
  atlasViewer.focus(term.id);
  showSelection(term);input.value=peekTermTitle(term);hideMatches();input.blur();
  screen.querySelector('canvas').focus({preventScroll:true});
 }
 input.oninput=search;
 if(groupTitle)input.onfocus=()=>{if(input.value===groupTitle)search()};
 input.onkeydown=event=>{
  if(event.key==='Escape'){hideMatches();input.blur();return}
  if(event.key!=='ArrowDown'&&event.key!=='Enter')return;
  const first=results.querySelector('button');
  if(first){event.preventDefault();event.key==='Enter'?choose(first):first.focus()}
 };
 results.onclick=event=>{const button=event.target.closest('button[data-atlas-term]');if(button)choose(button)};
 results.onkeydown=event=>{
  const button=event.target.closest('button');
  if(event.key==='Escape'){input.focus();hideMatches();return}
  if(!button||!['ArrowDown','ArrowUp'].includes(event.key))return;
  event.preventDefault();(event.key==='ArrowDown'?(button.nextElementSibling||button):(button.previousElementSibling||input)).focus();
 };
 screen.addEventListener('pointerdown',event=>{if(!event.target.closest('.atlas-finder'))hideMatches()});
 screen.querySelector('[data-atlas-zoom="fit"]').addEventListener('click',()=>{input.value='';hideMatches();showSelection(null)});
}
function graphNeighborhoodMarkup(term,options){
 const catalog=getAtlasCatalog();
 if(!catalog.graphTerms.some(node=>node.id===term.id))return '';
 const neighbors=catalog.adjacent(term.id);
 if(!neighbors.length)return '';
 const broader=new Set(term.broaderIds||[]);
 const parents=neighbors.filter(item=>broader.has(item.id));
 const children=neighbors.filter(item=>!broader.has(item.id)&&item.broaderIds?.includes(term.id));
 const narrower=new Set(children.map(item=>item.id));
 const authoredIds=(term.links||[]).map(link=>{
  const id=typeof link==='string'?link:link.target||link.id;
  const members=catalog.members(id);
  return members?.length===1?members[0].id:getTerm(id)?.id;
 });
 const authoredRanks=new Map([...new Set(authoredIds)].map((id,index)=>[id,index]));
 const rank=item=>authoredRanks.get(item.id)??authoredRanks.size;
 const other=neighbors.filter(item=>!broader.has(item.id)&&!narrower.has(item.id)).sort((a,b)=>rank(a)-rank(b));
 const relationFor=node=>broader.has(node.id)?'상위 개념':narrower.has(node.id)?'하위 개념':'관련 개념';
 return graphDiagramMarkup(peekTermTitle(term),[...parents,...children,...other],{...options,relationFor});
}
function graphDiagramMarkup(title,ordered,{page:requested=1,neighborHref,pageHref,relationFor,collectionLabel='연결 개념'}){
 const positions=[[1,1],[3,1],[1,3],[3,3],[2,1],[2,3]];
 const pageSize=positions.length;
 const pageCount=Math.ceil(ordered.length/pageSize);
 const page=Number.isInteger(requested)?Math.max(1,Math.min(requested,pageCount)):1;
 const neighborLink=(node,attributes)=>{
  const relation=relationFor(node);
  const label=esc(peekTermTitle(node));
  return `<a${attributes} href="${esc(neighborHref(node.id))}" aria-label="${label}, ${relation}">${label}</a>`;
 };
 const connections=ordered.slice((page-1)*pageSize,page*pageSize).map((node,index)=>{
  const [column,row]=positions[index];
  return {node,column,row};
 });
 const diagramLabel=collectionLabel==='구성 개념'?collectionLabel:'개념 지도';
 const diagram=`<div class="v2-graph-diagram" role="group" aria-label="${esc(title)} ${diagramLabel}">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${connections.map(({column,row})=>
   `<line x1="50" y1="50" x2="${(column-.5)*100/3}" y2="${(row-.5)*100/3}"/>`).join('')}</svg>
  <span class="v2-graph-node v2-graph-center">${esc(title)}</span>
  ${connections.map(({node,column,row})=>neighborLink(node,` class="v2-graph-node" style="grid-area:${row}/${column}"`)).join('')}
 </div>`;
 if(pageCount===1)return diagram;
 const countId=pageHref?'graphPageCount':'dictionaryGraphPageCount';
 const pageControl=(number,direction,label,text)=>pageHref
  ?`<a href="${esc(pageHref(number))}" rel="${direction}" aria-label="${label}">${text}</a>`
  :`<button type="button" data-dict-graph-${direction}="${number}" aria-label="${label}">${text}</button>`;
 const pageLabel=collectionLabel+' 페이지';
 return diagram+`<nav class="v2-graph-pages" aria-label="${pageLabel}" aria-describedby="${countId}" tabindex="-1">
  ${page>1?pageControl(page-1,'prev','이전 '+pageLabel,'← 이전'):''}
  <span id="${countId}">${page} / ${pageCount}</span>
  ${page<pageCount?pageControl(page+1,'next','다음 '+pageLabel,'다음 →'):''}
 </nav>`;
}
function graphPageChanged(previous,current){
 const [oldPath,oldQuery]=previous.split('?'),[path,query]=current.split('?');
 if(oldPath!==path||!path.startsWith('#graph/'))return false;
 const before=new URLSearchParams(oldQuery),after=new URLSearchParams(query);
 return before.get('dictionary')===after.get('dictionary')&&before.get('page')!==after.get('page');
}
function renderGraph(paging=false){
 const [path,query]=location.hash.split('?');
 const params=new URLSearchParams(query);
 if(path==='#graph'){renderAtlas(params.get('focus'));return}
 let id='';
 try{id=decodeURIComponent(path.split('/')[1]||'')}catch(_){}
 const catalog=getAtlasCatalog();
 const members=catalog.members(id);
 const term=members?.length===1?members[0]:getTerm(id);
 const focusId=term?.id||(members?.length?id:undefined);
 const back=`<nav class="v2-graph-returns" aria-label="개념 지도 이동">${graphDictionaryReturnMarkup(term)}
  <a class="graph-overview-return" href="${esc(graphAtlasHref(focusId))}">전체 지도 보기 →</a></nav>`;
 if(members?.length>1){
  $('#app').innerHTML=back+header('개념 선택')+`<nav class="v2-graph-members" aria-label="개념 선택">${members.map(item=>
   `<a href="${esc(graphHref(item.id))}">${esc(peekTermTitle(item))}</a>`).join('')}</nav>`;
  return;
 }
 if(!term){$('#app').innerHTML=back+header('개념을 찾을 수 없습니다');return}
 const title=peekTermTitle(term);
 const dictionary=graphDictionaryOrigin();
 const neighborhood=graphNeighborhoodMarkup(term,{
  page:Number(params.get('page')),
  neighborHref:id=>graphHref(id,dictionary),
  pageHref:number=>graphHref(term.id,dictionary,number),
 });
 if(paging){$('#graphNeighborhood').innerHTML=neighborhood;return}
 const steps=graphCalculationSteps(term);
 const copy=graphCopyMarkup(term,steps);
 const root=$('#app');
 const search=new URLSearchParams({search:'1'});
 const origin=quizOrigin(dictionary);
 if(origin)search.set('from',origin);
 root.innerHTML=back+`<header class="v2-hero v2-graph-heading">
  <h1>개념 지도</h1>
  <a class="graph-dictionary-search" href="#dictionary?${esc(search.toString())}">사전 검색</a>
 </header><div class="v2-graph-wrap">
  <article class="v2-graph-definition">
   <h2><a href="${esc(dictionaryHref(term.id))}">${esc(title)}</a></h2>
   ${copy.lead}
   ${graphCalculationMarkup(steps)}
   ${termFigureMarkup(term.id)}
   ${broaderConceptsMarkup(term,graphHref)}
   ${window.OptionLab.conceptMarkup(term.id)}
   ${copy.reading}
  </article>
  ${neighborhood?`<section class="v2-graph-navigation" aria-label="개념 지도 탐색">
   <div id="graphNeighborhood">${neighborhood}</div>
  </section>`:''}
 </div>`;
 window.OptionLab.bindConcept(root);
}
function allOxQuestions(){let legacy=units.flatMap(u=>(u.quiz||[]).map(q=>({...q,unitId:u.id,conceptIds:q.conceptIds||u.conceptIds||[]})));return [...legacy,...(data.course.extraOxQuestions||[])]}
function friendlyTime(value){
 const date=typeof value==='string'?new Date(value):null;
 if(!date||Number.isNaN(date.getTime()))return '';
 const hour=date.getHours(),year=date.getFullYear()===new Date().getFullYear()?'':date.getFullYear()+'년 ';
 return `${year}${date.getMonth()+1}월 ${date.getDate()}일 ${hour<12?'오전':'오후'} ${hour%12||12}:${String(date.getMinutes()).padStart(2,'0')}`;
}
function historyRowMarkup({id,a,q}){
 const selected=typeof a.selected==='boolean'?(a.selected?'O':'X'):optionLabel(a.selected),when=friendlyTime(a.at);
 return `<article><div class="v2-history-meta"><span>${esc(unitFor(q.unitId)?.title||'')}</span>${when?`<time datetime="${esc(a.at)}">${esc(when)}</time>`:''}</div><h2>${esc(displayStem(q))}</h2><div class="v2-history-foot"><p class="v2-history-result"><span class="${a.correct?'is-right':'is-wrong'}">${a.correct?'정답':'오답'}</span> 내 답 ${esc(selected)}</p><button type="button" class="v2-history-reopen" data-reopen="${esc(id)}">문제 풀기</button></div></article>`;
}
function renderHistory(){let oxById=new Map(allOxQuestions().map(q=>[q.id,q])),choiceById=new Map(choices().map(q=>[q.id,q])),rows=Object.entries(record.answers).map(([id,a])=>{let q=oxById.get(id)||choiceById.get(id);return q?{id,a,q}:null}).filter(Boolean).sort((a,b)=>(b.a.at||'').localeCompare(a.a.at||''));const solvedRight=rows.filter(({a})=>a.correct).length;$('#app').innerHTML=header('풀이 기록',(window.TextbookProgressAdapter&&window.TextbookProgressAdapter.available!==false?'이 기기의 이 브라우저에 저장돼요':'이 기록은 현재 실행에만 남아요'))+`<div class="v2-history-stats"><div class="v2-stat"><b>${rows.length}</b><span>푼 문제</span></div>${rows.length?`<div class="v2-stat"><b>${Math.round(solvedRight/rows.length*100)}%</b><span>정답률</span></div>`:''}</div><div class="v2-history">${rows.map(historyRowMarkup).join('')||'<p>아직 푼 문제가 없어요.<span>문제 탭에서 첫 문제를 풀어 보세요.</span></p>'}</div>${window.TextbookProgressBackup?window.TextbookProgressBackup.buttonsHtml():''}<button class="text-btn" id="clearHistory">풀이 기록 지우기</button><a class="v2-history-questions" href="#questions">문제 목록</a>`;$$('[data-reopen]').forEach(b=>b.onclick=()=>{let id=b.dataset.reopen;setHash((choiceById.has(id)?'#choice/':'#ox/')+encodeURIComponent(id))});$('#clearHistory').onclick=async()=>{if(window.TextbookProgressAdapter&&window.TextbookProgressAdapter.persistent&&window.TextbookProgressAdapter.available!==false&&!window.confirm(`저장된 풀이 기록 ${Object.keys((record&&record.answers)||{}).length}문항을 모두 지울까요?\n지운 기록은 되돌릴 수 없어요. 먼저 '기록 내보내기'로 백업해 두세요.`))return;record={answers:{},read:{}};writeQueue=writeQueue.then(()=>adapter.clear()).catch(()=>{});await writeQueue;renderHistory()}}
const lessonGroups = [
 {title:'주식, 수익률, 채권', stageStart:0, stageEnd:3},
 {title:'파생상품, 경제, 대체투자', stageStart:3, stageEnd:5},
 {title:'금융상품, 법규, 세제', stageStart:5, stageEnd:8},
];
function lessonUnitIds(lesson){
 const stages = data.course.learningPath?.stages || [];
 return stages.slice(lesson.stageStart, lesson.stageEnd).flatMap(stage=>stage.unitIds);
}
function choiceOrderIds(){
 const ids = data.course.choiceOrder;
 return Array.isArray(ids) && ids.length ? ids : null;
}
function orderedChoiceQuestions(){
 const unitOrder = lessonGroups.flatMap(lessonUnitIds);
 const rank = new Map(unitOrder.map((id,index)=>[id,index]));
 const byPath = list=>list.slice().sort((a,b)=>(rank.get(a.unitId)??Infinity)-(rank.get(b.unitId)??Infinity));
 const listed = choiceOrderIds();
 if(listed){
  const byId = new Map(choices().map(q=>[q.id,q])), shown = new Set(), head = [];
  for(const id of listed){
   const q = byId.get(id);
   if(q && !shown.has(id)){shown.add(id);head.push(q)}
  }
  return head.concat(byPath(choices().filter(q=>!shown.has(q.id))));
 }
 const ordered = byPath(choices());
 const preferred = epChoices(firstEpisode() || {})[0];
 return preferred ? [preferred,...ordered.filter(q=>q.id!==preferred.id)] : ordered;
}
function unitsInQuestionOrder(lessonUnits, questions){
 const unitIds = new Set(lessonUnits), seen = [];
 for(const q of questions)if(unitIds.has(q.unitId) && !seen.includes(q.unitId))seen.push(q.unitId);
 return seen.concat(lessonUnits.filter(id=>!seen.includes(id)));
}
const bankState = {lesson:0, mode:'mcq', unit:'', limit:12, filtersOpen:false};
function renderQuestionBank(){
 const state = bankState;
 const lesson = lessonGroups[state.lesson];
 const lessonUnits = lessonUnitIds(lesson);
 const unitIds = new Set(lessonUnits);
 const questions = state.mode==='mcq' ? orderedChoiceQuestions() : allOxQuestions();
 const unitOptions = state.mode==='mcq' && choiceOrderIds() ? unitsInQuestionOrder(lessonUnits, questions) : lessonUnits;
 const rows = questions.filter(q=>unitIds.has(q.unitId) && (!state.unit || q.unitId===state.unit));
 $('#app').innerHTML = `<section class="lesson-bank">
  <h1>문제 풀기</h1>
  <nav class="lesson-nav" aria-label="강의 선택">${lessonGroups.map((group,index)=>`<button type="button" data-lesson="${index}" aria-pressed="${state.lesson===index}">${index+1}강</button>`).join('')}</nav>
  <div class="lesson-heading"><div><h2>${esc(lesson.title)}</h2><p>${rows.length}문항</p></div></div>
  <details id="bankFilters" class="lesson-filters" ${state.filtersOpen?'open':''}>
   <summary>필터${state.mode!=='mcq'||state.unit?' 적용 중':''}</summary>
   <div class="v2-filterbar">
    <label>유형 <select id="qMode"><option value="mcq" ${state.mode==='mcq'?'selected':''}>4지선다</option><option value="ox" ${state.mode==='ox'?'selected':''}>OX</option></select></label>
    <label>단원 <select id="qUnit"><option value="">전체</option>${unitOptions.map(id=>`<option value="${esc(id)}" ${state.unit===id?'selected':''}>${esc(unitFor(id)?.title||id)}</option>`).join('')}</select></label>
   </div>
  </details>
  <ul class="lesson-list">${rows.slice(0,state.limit).map((q,index)=>`<li><button type="button" data-qid="${esc(q.id)}"><span class="lesson-number">${index+1}</span><span>${esc(promptHeading(q))}</span><span class="lesson-chevron" aria-hidden="true">›</span></button></li>`).join('')}</ul>
  ${!rows.length?'<p class="lesson-empty">조건에 맞는 문제가 없어요.</p>':''}
  ${rows.length>state.limit?'<button type="button" id="moreQuestions" class="lesson-more">문제 더 보기</button>':''}
 </section>`;
 function applyFilter(){state.limit=12;renderQuestionBank()}
 $('#bankFilters').ontoggle=event=>{state.filtersOpen=event.currentTarget.open};
 $('#qMode').onchange=event=>{state.mode=event.currentTarget.value;applyFilter()};
 $('#qUnit').onchange=event=>{state.unit=event.currentTarget.value;applyFilter()};
 $$('[data-lesson]').forEach(button=>button.onclick=()=>{
  state.lesson=Number(button.dataset.lesson);
  state.unit='';
  applyFilter();
  $(`[data-lesson="${state.lesson}"]`).focus();
 });
 $$('[data-qid]').forEach(button=>button.onclick=()=>{
  const q = rows.find(item=>item.id===button.dataset.qid);
  setHash((state.mode==='mcq' ? '#choice/' : '#ox/')+encodeURIComponent(q.id));
 });
 const more = $('#moreQuestions');
 if(more)more.onclick=()=>{
  const firstNew = rows[state.limit];
  state.limit+=12;
  renderQuestionBank();
  $(`[data-qid="${CSS.escape(firstNew.id)}"]`)?.focus();
 };
}
function renderStandaloneOx(id){let q=allOxQuestions().find(x=>x.id===id);if(!q){$('#app').innerHTML=header('문제를 찾을 수 없어요','OX');return}let ans=record.answers[q.id]?.selected,u=unitFor(q.unitId),fresh=ans!==undefined&&freshAnswerId===q.id;freshAnswerId='';$('#app').innerHTML=`<article class="v2-question"><div class="v2-qmeta">${esc(u?.title||'OX')}</div>${promptMarkup(q,ans!==undefined)}${ans===undefined?`<div class="v2-ox"><button data-answer="true" aria-label="O, 맞다">O</button><button data-answer="false" aria-label="X, 틀리다">X</button></div>`:`<div class="v2-result ${ans===q.answer?'right':'wrong'}"><b>${markMarkup(ans===q.answer,fresh)}<span>${ans===q.answer?'정답이에요':'다시 확인해 보세요'}. 정답은 ${q.answer?'O':'X'}예요.</span></b><div class="v2-explanation-copy">${solutionMarkup(q)}</div>${q.trap?`<p><b>헷갈리기 쉬운 점</b> ${readerTermsMarkup(q.trap,true)}</p>`:''}<button class="text-btn" id="retryOx">다시 풀기</button></div>`}</article>`;$$('[data-answer]').forEach(b=>b.onclick=()=>{record.answers[q.id]={selected:b.dataset.answer==='true',correct:(b.dataset.answer==='true')===q.answer,at:new Date().toISOString()};freshAnswerId=q.id;queueSave();renderStandaloneOx(id)});if($('#retryOx'))$('#retryOx').onclick=()=>retry(q.id,()=>renderStandaloneOx(id))}
const choiceTopicFallbacks = {
 '01':'세금', '02':'금융상품', '03':'펀드와 신탁', '04':'부동산', '05':'금융투자업',
 '06':'운용과 투자자 보호', '07':'대체투자와 해외투자', '08':'기업분석', '09':'투자분석',
 '10':'위험관리', '11':'주식운용', '12':'채권', '13':'선물과 환율', '14':'옵션',
 '15':'성과평가', '16':'경제와 분산투자',
};
function choiceTopic(q){
 const prompt = displayStem(q);
 const compact = text=>text.replace(/\s+/g,'');
 if(/성장주\s*스타일/.test(prompt))return '성장주 투자';
 const term = authoredTerms().map(item=>item.displayTitle||item.title||'')
  .filter(name=>name.length>=3 && name.length<=18 && !/[,/]/.test(name) && compact(prompt).includes(compact(name)))
  .sort((a,b)=>b.length-a.length)[0];
 return term || choiceTopicFallbacks[q.unitId?.slice(1,3)] || '투자운용';
}
function choiceStartId(ordered){
 return (ordered.find(q=>q.id===lastChoiceId)||ordered.find(q=>record.answers[q.id]===undefined)||ordered[0])?.id;
}
function toggleOptionWhy(button){
 const panel=document.getElementById('choice-why-'+button.dataset.toggleOption);
 if(!panel)return;
 const open=Boolean(panel.hidden);
 panel.hidden=!open;
 if(button.setAttribute)button.setAttribute('aria-expanded',String(open));else button.ariaExpanded=String(open);
}
function pinChoiceHash(id){
 if(!id||location.hash.startsWith('#choice/'))return;
 replaceHash('#choice/'+encodeURIComponent(id));
}
function renderStandaloneChoice(){
 const ordered=orderedChoiceQuestions();
 const id=location.hash.startsWith('#choice/')?decodeURIComponent(location.hash.slice(8)):choiceStartId(ordered);
 const index=ordered.findIndex(q=>q.id===id);
 const q=ordered[index],next=ordered[index+1],prev=ordered[index-1];
 choiceNav=null;
 if(!q){$('#app').innerHTML=header('문제를 찾을 수 없어요','4지선다');return}
 lastChoiceId=q.id;
 choiceNav={id:q.id,prev:prev?.id||'',next:next?.id||''};
 const ans=record.answers[q.id]?.selected,graded=ans!==undefined,total=ordered.length;
 const fresh=graded&&freshAnswerId===q.id;freshAnswerId='';
 $('#app').innerHTML=`<div class="v2-choice-top"><div class="v2-qmeta">${esc(choiceTopic(q))}</div><span class="v2-choice-count"><b>${index+1}</b> / ${total}</span></div>
<div class="v2-choice-progress" aria-hidden="true"><span style="width:${((index+1)/total*100).toFixed(2)}%"></span></div>
<article class="v2-question">${promptMarkup(q,graded)}${choiceOptionsMarkup(q,ans,fresh)}${choiceFeedbackMarkup(q,ans,`<button class="text-btn" id="retryStandalone">다시 풀기</button>`,fresh)}</article>${graded&&next?`<div class="v2-choice-next"><a class="primary" href="#choice/${encodeURIComponent(next.id)}">다음 문제</a></div>`:''}`;
 $$('[data-option]').forEach(b=>b.onclick=()=>answerChoice(q,b.dataset.option,renderStandaloneChoice));
 $$('[data-toggle-option]').forEach(b=>b.onclick=()=>toggleOptionWhy(b));
 if($('#retryStandalone'))$('#retryStandalone').onclick=()=>retry(q.id,renderStandaloneChoice);
 const nextLink=$('.v2-choice-next a');
 if(nextLink)nextLink.onclick=()=>pinChoiceHash(q.id);
 if(shownChoiceId!==q.id){shownChoiceId=q.id;$('.v2-question')?.classList?.add('is-entering')}
}
function renderUnits(){let stages=data.course.learningPath?.stages||[];$('#app').innerHTML=header('전체 단원')+stages.map(s=>`<section class="v2-unitstage"><h2>${esc(s.title)}</h2><p>${esc(s.description||'')}</p><div>${(s.unitIds||[]).map(id=>{let u=unitFor(id);return u?`<button data-unit="${esc(id)}">${esc(u.title)} →</button>`:''}).join('')}</div></section>`).join('');$$('[data-unit]').forEach(b=>b.onclick=()=>setHash('#unit/'+encodeURIComponent(b.dataset.unit)))}
function renderUnit(){
 const id=decodeURIComponent(location.hash.slice(6)),u=unitFor(id);
 if(!u){$('#app').innerHTML=header('단원을 찾을 수 없어요','본문');return}
 let body=u.bodyHtml||'';
 if(id==='u14-01'){
  const positions=[
   ['콜 매수','term-70a08a62a316201f'],['콜 매도','term-3615d9ed99851bb0'],
   ['풋 매수','term-404ec34ea67b20e8'],['풋 매도','term-9cd75d41a3173bf4'],
  ];
  for(const [label,termId] of positions){
   body=body.replace(`<td>${label}</td>`,`<td><a href="${graphHref(termId)}">${label}</a></td>`);
  }
 }
 $('#app').innerHTML=header(u.title,u.chapterTitle)+`<article class="v2-longtext">${richTermsMarkup(body,{linked:false,basic:true})}</article><p class="v2-actions"><button class="primary" data-route="#units">학습 경로로 돌아가기</button></p>`;
 $$('[data-route]').forEach(b=>b.onclick=()=>setHash(b.dataset.route));
}
function renderLab(){const curves={callLong:{name:'콜 매수',tone:'up',dashed:false,points:[[0,-5],[100,-5],[200,95]]},callShort:{name:'콜 매도',tone:'down',dashed:true,points:[[0,5],[100,5],[200,-95]]},putLong:{name:'풋 매수',tone:'down',dashed:false,points:[[0,95],[100,-5],[200,-5]]},putShort:{name:'풋 매도',tone:'up',dashed:true,points:[[0,-95],[100,5],[200,5]]}};$('#app').innerHTML=header('만기 주가로 옵션 손익 살펴보기','옵션 실습')+`<article class="v2-question"><p>행사가격 100, 콜과 풋 프리미엄은 각각 5로 둔 예시입니다. 수수료와 조달비용은 빼고 계산합니다.</p><label>만기 주가 <b id="labValue">100</b><input id="labRange" type="range" min="0" max="200" value="100"></label><div class="v2-labgrid" id="labCards"></div><p id="labInsight" aria-live="polite"></p></article>`;let range=$('#labRange'),update=()=>{let price=Number(range.value),p=window.OptionLab.payoffs(price),X=x=>30+x*1.55,Y=y=>81.5-y*.675,status=n=>n>0?`이익 +${n}`:n<0?`손실 ${n}`:'손익 0';$('#labValue').textContent=price;$('#labCards').innerHTML=Object.entries(curves).map(([key,c])=>{let d=c.points.map((point,i)=>`${i?'L':'M'}${X(point[0])},${Y(point[1])}`).join(' '),cx=X(price),cy=Y(p[key]);return `<section><h3>${c.name}</h3><strong class="v2-number">${status(p[key])}</strong><svg class="v2-labchart is-${c.tone}" viewBox="0 0 360 190" role="img" aria-label="${c.name} 만기 손익선"><title>${c.name} 손익</title><desc>가로축 만기 주가 0부터 200. 세로축 손익 -100부터 100. 현재 주가 ${price}에서 ${status(p[key])}.</desc><line class="lab-grid" x1="30" y1="${Y(0)}" x2="340" y2="${Y(0)}"/><line class="lab-current" x1="${cx}" y1="14" x2="${cx}" y2="149"/><path class="v2-labcurve${c.dashed?' is-dashed':''}" d="${d}"/><circle class="v2-labdot" cx="${cx}" cy="${cy}" r="5"/><text x="30" y="169">0</text><text x="178" y="169">100</text><text x="319" y="169">200</text><text x="2" y="17">+100</text><text x="13" y="${Y(0)+4}">0</text><text x="2" y="147">-100</text><text x="320" y="185">주가</text><text x="34" y="10">손익</text></svg></section>`}).join('');$('#labInsight').textContent=price>100?`주가 ${price}: 콜 내재가치 ${p.callIntrinsic}에서 프리미엄 5를 빼 콜 매수 손익은 ${status(p.callLong)}입니다.`:price<100?`주가 ${price}: 풋 내재가치 ${p.putIntrinsic}에서 프리미엄 5를 빼 풋 매수 손익은 ${status(p.putLong)}입니다.`:'주가 100에서는 콜과 풋 내재가치가 0입니다. 매수자는 프리미엄 5를 잃고 매도자는 5를 얻습니다.'};range.oninput=update;update()}
function updatePrimaryNav(hash){
 let section;
 if(/^#(?:choices|choice)(?:[/?]|$)/.test(hash))section='#choices';
 else if(/^#(?:dictionary|concept|glossary|registry|graph|map)(?:[/?]|$)/.test(hash))section='#dictionary';
 else if(hash==='#history')section='#history';

 for(const link of $$('.v2-primary-nav a')){
  if(link.hash===section)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 }
}
function redirect(hash){if(!replaceHash(hash))location.hash=hash}
function retiredTarget(h){
 if(h==='#learn'||h==='#home')return '#choices';
 let id='';
 try{id=decodeURIComponent(h.slice(9).split(/[/?]/)[0])}catch(_){}
 const first=epChoices(allEpisodes().find(e=>e.id===id)||{})[0];
 return first?'#choice/'+encodeURIComponent(first.id):'#choices';
}
function render(){
 let h=location.hash||'#choices',focus;
 choiceNav=null;
 if(atlasViewer){atlasViewer.destroy();atlasViewer=null}
 if(h==='#learn'||h==='#home'||h.startsWith('#episode/')){h=retiredTarget(h);redirect(h)}
 updatePrimaryNav(h);
 if(h==='#choices')renderStandaloneChoice();else if(h.startsWith('#dictionary'))focus=renderDictionary();else if(h.startsWith('#concept/')){setHash('#dictionary/'+encodeURIComponent(decodeURIComponent(h.slice(9))));renderDictionary()}else if(h.startsWith('#glossary/')){setHash('#dictionary/'+encodeURIComponent(decodeURIComponent(h.slice(10))));renderDictionary()}else if(/^#map(?:[/?]|$)/.test(h)){setHash('#graph'+h.slice(4));renderGraph()}else if(h.startsWith('#registry/'))renderRegistry(decodeURIComponent(h.slice(10).split('?')[0]));else if(h.startsWith('#graph'))renderGraph();else if(h.startsWith('#choice/'))renderStandaloneChoice();else if(h.startsWith('#ox/'))renderStandaloneOx(decodeURIComponent(h.slice(4)));else if(h==='#questions')renderQuestionBank();else if(h==='#history')renderHistory();else if(h==='#units')renderUnits();else if(h==='#lab')renderLab();else if(h.startsWith('#unit/'))renderUnit();else{redirect('#choices');updatePrimaryNav('#choices');renderStandaloneChoice()}(focus||$('#app')).focus({preventScroll:true})}
const swipeSkip='table,pre,input,select,textarea,.v2-prompt-extra';
const swipeSlop=8,swipeLean=1.2,swipeDistance=48;
function bindChoiceSwipe(){
 let start=null,card=null;
 const sheetOpen=()=>Boolean($('#conceptPeek')?.open);
 const still=()=>Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
 const horizontal=(dx,dy)=>Math.abs(dx)>Math.abs(dy)*swipeLean;
 function rest(){
  const el=card;
  card=null;
  if(!el?.style)return;
  el.classList?.remove('is-dragging');
  el.style.willChange='';
  if(still()||typeof setTimeout!=='function'||!el.style.transform){el.style.transform='';el.style.transition='';return}
  el.style.transition='transform var(--motion-base) var(--ease-out)';
  el.style.transform='';
  setTimeout(()=>{el.style.transition=''},260);
 }
 document.addEventListener('pointerdown',event=>{
  rest();
  start=null;
  if(!choiceNav||sheetOpen()||event.isPrimary===false||event.button>0)return;
  const target=event.target;
  if(!target?.closest?.('#app')||target.closest(swipeSkip))return;
  start={x:event.clientX,y:event.clientY,id:event.pointerId,touch:event.pointerType==='touch'||event.pointerType==='pen'};
 });
 document.addEventListener('pointermove',event=>{
  if(!start?.touch||!choiceNav||event.pointerId!==start.id)return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(!card){
   if(Math.abs(dx)<swipeSlop||!horizontal(dx,dy))return;
   card=$('.v2-question');
   if(!card?.style)return;
   card.classList?.add('is-dragging');
   card.style.transition='none';
   card.style.willChange='transform';
  }
  const offset=(dx<0?choiceNav.next:choiceNav.prev)?dx:Math.sign(dx)*Math.min(Math.abs(dx)*.3,32);
  card.style.transform=`translateX(${offset}px)`;
 });
 document.addEventListener('pointerup',event=>{
  const from=start;
  start=null;
  if(!from||!choiceNav||sheetOpen()||event.pointerId!==from.id){rest();return}
  const dx=event.clientX-from.x,dy=event.clientY-from.y;
  const target=dx<0?choiceNav.next:choiceNav.prev;
  if(Math.abs(dx)<=swipeDistance||!horizontal(dx,dy)||window.getSelection?.()?.toString()||!target){rest();return}
  const fromId=choiceNav.id,open=()=>{if(choiceNav?.id===fromId){pinChoiceHash(fromId);setHash('#choice/'+encodeURIComponent(target))}};
  const el=card;
  card=null;
  if(!el?.style||still()||typeof setTimeout!=='function'){open();return}
  el.style.transition='transform var(--motion-fast) ease-in';
  el.style.transform=`translateX(${Math.sign(dx)*Math.round((el.offsetWidth||320)*.45)}px)`;
  setTimeout(open,120);
 });
 document.addEventListener('pointercancel',()=>{start=null;rest()});
}
const warmSteps=[
 ()=>getPeekIndex(),
 ()=>readerTermsMarkup('주가수익비율 PER 순자산 자산 부채',false),
 ()=>{referenceFinder??=window.QuizReferences?.create(allTerms())},
 ()=>findReferences('PER 주가수익비율 요구수익률 자산',{conceptIds:[]}),
 ()=>browseTerms(),
 ()=>getAtlasCatalog(),
 ()=>getAtlasModel(),
];
function warmUp(){
 const idle=(task,timeout)=>{
  if(typeof requestIdleCallback==='function')requestIdleCallback(task,{timeout});
  else if(typeof setTimeout==='function')setTimeout(task,50);
 };
 let step=0,waited=0,lastInput=Date.now();
 for(const type of ['pointerdown','keydown','wheel'])document.addEventListener(type,()=>{lastInput=Date.now()},{passive:true,capture:true});
 const next=()=>{
  if(step>=warmSteps.length)return;
  if(step===warmSteps.length-1&&waited<10&&(Date.now()-lastInput<2500||globalThis.navigator?.scheduling?.isInputPending?.())){waited+=1;setTimeout(()=>idle(next,4000),800);return}
  const began=performance.now();
  try{warmSteps[step]()}catch(_){}
  try{performance.measure('v2-warm-'+step,{start:began,end:performance.now()})}catch(_){}
  step+=1;
  idle(next,4000);
 };
 if(typeof setTimeout==='function')setTimeout(()=>idle(next,4000),600);
}
async function start(){
 const embedded=document.getElementById('embeddedData');
 const files=embedded?null:Promise.all(['course','concepts','registry'].map(name=>fetch('./data/'+name+'.json').then(r=>r.json())));
 const stored=Promise.resolve().then(()=>adapter.load()).then(value=>({value}),()=>({value:null}));
 if(embedded)data=JSON.parse(embedded.textContent);else[data.course,data.concepts,data.registry]=await files;
 units=data.course.chapters.flatMap(c=>(c.units||[]).map(u=>({...u,chapterTitle:c.title})));
 const {value:prior}=await stored;
 if(prior&&typeof prior==='object')record={answers:prior.answers||{},read:prior.read||{}};
 render();
 jumpTo(enterEntry());
 warmUp();
}
window.addEventListener('hashchange',event=>{
 const dialog=$('#conceptPeek');if(dialog?.open)dialog.close();
 const paging=Boolean(event?.oldURL&&$('#graphNeighborhood')&&graphPageChanged(new URL(event.oldURL).hash,location.hash));
 const focusPager=paging&&document.activeElement?.closest('.v2-graph-pages');
 leaveEntry();
 const offset=paging?navMemo.y[entryKey]||0:0;
 if(paging)renderGraph(true);else render();
 jumpTo(enterEntry(offset));
 if(focusPager)$('.v2-graph-pages')?.focus({preventScroll:true});
 saveNavMemo();
});if(globalThis.__TEXTBOOK_TEST__)globalThis.__textbookTest={getState:()=>JSON.parse(JSON.stringify(record)),getData:()=>data,getAtlasCatalog,queueSave,getAllOx:()=>allOxQuestions(),getOrderedChoices:()=>orderedChoiceQuestions(),getFirstEpisode:()=>firstEpisode(),getEpisodeChoices:id=>epChoices(allEpisodes().find(e=>e.id===id)||{}),practiceConceptHref,getTerm,dictionaryMarkup:(q,id)=>dictionaryMarkup(q,id),searchTerms:q=>allTerms().filter(x=>matchesDictionaryTerm(x,q.toLowerCase()))};bindConceptPeek();bindChoiceSwipe();start();
})();
