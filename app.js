/* app.js - 疼痛专科护士培训刷题逻辑 */
(function(){
  "use strict";

  // ===== 题库组织 =====
  var MODULES = [
    { id:1, name:"通科护理基础", qs: (window.Q1||[]).slice(0,50) },
    { id:2, name:"疼痛学绪论",   qs: (window.Q1||[]).slice(50,70) },
    { id:3, name:"疼痛生理病理", qs: (window.Q1||[]).slice(70,100) },
    { id:4, name:"疼痛评估",     qs: (window.Q2||[]) },
    { id:5, name:"疼痛治疗",     qs: (window.Q3||[]) },
    { id:6, name:"疼痛护理实践", qs: (window.Q4||[]) },
    { id:7, name:"管理与专科发展",qs: (window.Q5||[]) }
  ];

  // 过滤空模块
  MODULES = MODULES.filter(function(m){ return m.qs.length>0; });

  var ALL = [];
  MODULES.forEach(function(m){
    m.qs.forEach(function(q){ q._module = m.id; });
    ALL = ALL.concat(m.qs);
  });

  var STORE_KEY = "pain_quiz_wrong_v1";
  var PROGRESS_KEY = "pain_quiz_progress_v1";

  // ===== 状态 =====
  var state = {
    mode: "sequence",
    selectedModules: [],       // 空=全部
    questions: [],             // 本次序列
    current: 0,
    answered: [],              // [{correct:bool, selected:int}]
    examTime: 0,
    examTimer: null
  };

  // ===== DOM =====
  var $ = function(id){ return document.getElementById(id); };
  var quizArea=$("quizArea"), resultArea=$("resultArea"), startCard=$("startCard");
  var optionsEl=$("options"), sheetGrid=$("sheetGrid");

  // ===== 本地存储 =====
  function loadWrong(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY))||[]; }catch(e){ return []; } }
  function saveWrong(arr){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(arr)); }catch(e){} }
  function loadProgress(){ try{ return JSON.parse(localStorage.getItem(PROGRESS_KEY))||{}; }catch(e){ return {}; } }
  function saveProgress(obj){ try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj)); }catch(e){} }

  // ===== 全局统计 =====
  function renderGlobalStats(){
    var prog = loadProgress();
    var wrongCount = loadWrong().length;
    var totalDone = prog.totalDone||0, totalRight = prog.totalRight||0;
    var acc = totalDone>0 ? Math.round(totalRight/totalDone*100) : 0;
    $("globalStats").textContent = "已练 "+totalDone+" 题 · 正确率 "+acc+"% · 错题 "+wrongCount;
  }

  // ===== 模块chips =====
  function renderChips(){
    var wrap = $("moduleChips"); wrap.innerHTML="";
    var allBtn = document.createElement("button");
    allBtn.className="chip active"; allBtn.textContent="全部 ("+ALL.length+")";
    allBtn.onclick=function(){ toggleChip(-1,allBtn); };
    wrap.appendChild(allBtn);
    MODULES.forEach(function(m){
      var b=document.createElement("button");
      b.className="chip"; b.setAttribute("data-mid",m.id);
      b.textContent=m.name+" ("+m.qs.length+")";
      b.onclick=function(){ toggleChip(m.id,b); };
      wrap.appendChild(b);
    });
  }
  function toggleChip(mid, btn){
    if(mid===-1){
      if(state.selectedModules.length>0){ state.selectedModules=[]; }
      else{ state.selectedModules = MODULES.map(function(m){return m.id;}); }
    }else{
      var i=state.selectedModules.indexOf(mid);
      if(i>=0){ state.selectedModules.splice(i,1); }
      else{ state.selectedModules.push(mid); }
    }
    var chips=document.querySelectorAll("#moduleChips .chip");
    var allBtn=chips[0];
    allBtn.classList.toggle("active", state.selectedModules.length===0);
    chips.forEach(function(c){
      var m=parseInt(c.getAttribute("data-mid"));
      if(!isNaN(m)) c.classList.toggle("active", state.selectedModules.indexOf(m)>=0);
    });
  }

  // ===== 模式选择 =====
  document.querySelectorAll(".mode-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll(".mode-btn").forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      state.mode = btn.getAttribute("data-mode");
      updateStartDesc();
    });
  });
  function updateStartDesc(){
    var descs={
      sequence:"按所选模块顺序逐题练习，适合系统掌握知识点。",
      random:"从所选模块中随机抽取题目，打乱顺序练习。",
      wrong:"仅重做历史答错的题目，针对性巩固薄弱点。",
      exam:"从全部题库随机抽取 20 题，限时 20 分钟模拟考试。"
    };
    $("startDesc").textContent = descs[state.mode]||"";
  }

  // ===== 构建题目序列 =====
  function buildQuestions(){
    var pool;
    if(state.mode==="wrong"){
      pool = loadWrong();
      if(pool.length===0){ return []; }
    }else if(state.mode==="exam"){
      pool = ALL.slice();
      shuffle(pool);
      pool = pool.slice(0,20);
    }else{
      var selected = state.selectedModules.length===0 ? MODULES : MODULES.filter(function(m){ return state.selectedModules.indexOf(m.id)>=0; });
      pool = [];
      selected.forEach(function(m){ pool = pool.concat(m.qs); });
      if(state.mode==="random") shuffle(pool);
    }
    return pool;
  }
  function shuffle(arr){
    for(var i=arr.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=arr[i];arr[i]=arr[j];arr[j]=t;
    }
  }

  // ===== 开始刷题 =====
  $("startBtn").addEventListener("click", function(){
    var qs = buildQuestions();
    if(qs.length===0){
      alert("当前没有可练习的题目。若为错题重做模式，请先做对/做错一些题目。");
      return;
    }
    state.questions=qs;
    state.current=0;
    state.answered=qs.map(function(){ return null; });

    startCard.style.display="none";
    quizArea.classList.add("show");
    resultArea.classList.remove("show");

    if(state.mode==="exam"){
      startExamTimer();
    }else{
      clearExamTimer();
    }
    renderQuestion();
    renderSheet();
  });

  // ===== 计时 =====
  function startExamTimer(){
    clearExamTimer();
    state.examTime = 20*60;
    state.examTimer = setInterval(function(){
      state.examTime--;
      if(state.examTime<=0){ clearExamTimer(); finishQuiz(true); }
      var mm=Math.floor(state.examTime/60), ss=state.examTime%60;
      var posEl=$("qPos");
      posEl.textContent = "模拟考试 · 剩余 "+ (mm<10?"0":"")+mm+":"+(ss<10?"0":"")+ss;
    },1000);
  }
  function clearExamTimer(){ if(state.examTimer){ clearInterval(state.examTimer); state.examTimer=null; } }

  // ===== 渲染题目 =====
  function renderQuestion(){
    var q = state.questions[state.current];
    var idx = state.current;
    var total = state.questions.length;

    $("qText").textContent = (idx+1)+". "+q.q;
    $("qMeta").textContent = moduleName(q._module);
    $("qPos").textContent = "第 "+(idx+1)+" / "+total+" 题";
    $("progressFill").style.width = ((idx+1)/total*100)+"%";
    $("qScore").textContent = "本组已答对 "+countRight()+" 题";

    // 选项
    optionsEl.innerHTML="";
    var LETTERS=["A","B","C","D"];
    q.o.forEach(function(opt,i){
      var div=document.createElement("div");
      div.className="option";
      div.innerHTML='<span class="key">'+LETTERS[i]+'</span><span class="txt">'+escapeHtml(opt)+'</span>';
      div.addEventListener("click", function(){
        if(state.answered[idx]) return; // 已判分锁定
        confirmAnswer(i);
      });
      optionsEl.appendChild(div);
    });

    // 若已答过（错题重做等）恢复状态
    var ans = state.answered[idx];
    $("nextBtn").disabled = true;
    $("analysis").classList.remove("show");
    if(ans){
      $("nextBtn").disabled = false;
      applyAnswerFeedback(ans.correct, ans.selected);
    }
  }
  function moduleName(mid){
    var m = MODULES.find(function(x){ return x.id===mid; });
    return "模块 "+mid+" · "+(m?m.name:"");
  }
  function escapeHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ===== 点击选项直接判分 =====
  var currentSelection = null;
  function confirmAnswer(i){
    var idx=state.current;
    if(state.answered[idx]) return;
    currentSelection=i;
    var q=state.questions[idx];
    var correct = currentSelection===q.a;
    state.answered[idx]={ correct:correct, selected:currentSelection };
    applyAnswerFeedback(correct, currentSelection);
    $("nextBtn").disabled=false;
    // 更新进度
    updateProgress(correct);
    // 错题管理
    manageWrong(q, correct);
    renderSheet();
  }

  function applyAnswerFeedback(correct, selected){
    var q=state.questions[state.current];
    var opts=optionsEl.children;
    // 先清除所有状态
    for(var i=0;i<opts.length;i++){
      opts[i].classList.remove("selected","correct","wrong","disabled");
      opts[i].classList.add("disabled");
    }
    // 正确项标绿
    opts[q.a].classList.add("correct");
    // 若选错，所选标红
    if(!correct){ opts[selected].classList.add("wrong"); }

    // 解析
    var badge=$("resultBadge");
    badge.textContent = correct ? "回答正确" : "回答错误";
    badge.className = "result-badge "+(correct?"right":"wrong");
    $("analysisBody").textContent = q.m || "暂无解析";
    $("analysis").classList.add("show");
  }

  // ===== 下一题 =====
  $("nextBtn").addEventListener("click", function(){
    if(state.current < state.questions.length-1){
      state.current++;
      currentSelection=null;
      renderQuestion();
      renderSheet();
    }else{
      finishQuiz(false);
    }
  });

  // ===== 答题卡 =====
  function renderSheet(){
    sheetGrid.innerHTML="";
    var total=state.questions.length;
    var done=0;
    state.answered.forEach(function(ans,i){
      var d=document.createElement("div");
      d.className="sheet-item";
      d.textContent=i+1;
      if(ans){
        done++;
        if(ans.correct) d.classList.add("correct");
        else d.classList.add("wrong");
      }
      d.addEventListener("click", function(){
        if(i!==state.current){
          state.current=i; currentSelection=null; renderQuestion();
        }
      });
      sheetGrid.appendChild(d);
    });
    $("sheetInfo").textContent = "· 已答 "+done+"/"+total;
  }
  function countRight(){
    return state.answered.filter(function(a){ return a && a.correct; }).length;
  }

  // ===== 进度与错题 =====
  function updateProgress(correct){
    var p=loadProgress();
    p.totalDone=(p.totalDone||0)+1;
    if(correct) p.totalRight=(p.totalRight||0)+1;
    saveProgress(p);
    renderGlobalStats();
  }
  function manageWrong(q, correct){
    var wrong=loadWrong();
    var key=q.q;
    var existing = wrong.findIndex(function(x){ return x.q===key; });
    if(correct){
      // 答对则从错题中移除（若存在）
      if(existing>=0){ wrong.splice(existing,1); saveWrong(wrong); }
    }else{
      // 答错加入错题
      if(existing<0){
        wrong.push({q:q.q, o:q.o, a:q.a, m:q.m, _module:q._module});
        saveWrong(wrong);
      }
    }
    renderGlobalStats();
  }

  // ===== 结束 =====
  function finishQuiz(timedOut){
    clearExamTimer();
    var total=state.answered.length;
    var correct=countRight();
    var wrong=total-correct;
    var acc = total>0 ? Math.round(correct/total*100) : 0;

    $("scoreNum").textContent=acc;
    $("rTotal").textContent=total;
    $("rCorrect").textContent=correct;
    $("rWrong").textContent=wrong;
    $("rAccuracy").textContent=acc+"%";
    $("scoreGrade").textContent = gradeText(acc, timedOut);

    quizArea.classList.remove("show");
    resultArea.classList.add("show");
  }
  function gradeText(acc, timedOut){
    if(timedOut) return "时间到 · 已自动交卷";
    if(acc>=90) return "优秀！知识点掌握扎实";
    if(acc>=75) return "良好，继续巩固";
    if(acc>=60) return "及格，需加强练习";
    return "未及格，建议复习后再练";
  }

  // ===== 按钮：返回首页 / 结束 / 重试 =====
  $("backBtn").addEventListener("click", goHome);
  $("resultHomeBtn").addEventListener("click", goHome);
  $("finishBtn").addEventListener("click", function(){ finishQuiz(false); });
  $("resultRetryBtn").addEventListener("click", function(){
    resultArea.classList.remove("show");
    quizArea.classList.add("show");
    var qs=buildQuestions();
    if(qs.length===0){ goHome(); return; }
    state.questions=qs; state.current=0;
    state.answered=qs.map(function(){ return null; });
    if(state.mode==="exam") startExamTimer();
    renderQuestion(); renderSheet();
  });

  function goHome(){
    clearExamTimer();
    quizArea.classList.remove("show");
    resultArea.classList.remove("show");
    startCard.style.display="block";
  }

  // ===== 初始化 =====
  renderGlobalStats();
  renderChips();
  updateStartDesc();
})();
