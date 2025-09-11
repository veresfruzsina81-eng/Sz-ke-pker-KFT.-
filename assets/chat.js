// assets/chat.js
// Egyszerű front: üdvözlés nyitáskor, küldés, busy állapot, quick reply gombok.

(function(){
  const box   = document.getElementById('aiChat');
  const openB = document.getElementById('aiChatOpen');
  const closeB= document.getElementById('aiChatClose');
  const form  = document.getElementById('aiChatForm');
  const input = document.getElementById('aiChatInput');
  const body  = document.getElementById('aiChatBody');

  const history = []; // {role, content}

  function open(){
    box.classList.add('open');
    box.setAttribute('aria-hidden','false');
    input?.focus();

    // ÜDVÖZLŐ ÜZENET (egyszer)
    if(!box._greeted){
      addBubble(
        "Üdvözöljük! A chat csak Szőke Épker KFT. üzleti kérdésekre válaszol (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat).",
        "bot"
      );
      box._greeted = true;
    }
  }
  function close(){
    box.classList.remove('open');
    box.setAttribute('aria-hidden','true');
  }
  openB?.addEventListener('click', open);
  closeB?.addEventListener('click', close);

  function addBubble(text, who='bot'){
    const b = document.createElement('div');
    b.className = 'bubble ' + (who==='me' ? 'me' : 'bot');
    b.textContent = text;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
  }

  function addChips(arr){
    if(!arr || !arr.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'ai-quick';
    arr.slice(0,4).forEach(t=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = t;
      btn.addEventListener('click', ()=>{
        input.value = t;
        form.requestSubmit();
      });
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function setBusy(st){
    const btn = form.querySelector('button');
    form._busy = !!st;
    if(btn){ btn.disabled = !!st; btn.textContent = st ? 'Küldés…' : 'Küldés'; }
  }

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(form._busy) return;

    const msg = (input.value||'').trim();
    if(!msg) return;

    addBubble(msg, 'me');
    history.push({ role:'user', content: msg });
    input.value = '';
    setBusy(true);

    try{
      const res = await fetch('/.netlify/functions/ai', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ prompt: msg, history })
      });
      const data = await res.json();

      // ha a modell nem JSON-t adott, fallback
      const reply = (typeof data.reply === 'string' && data.reply) ? data.reply
                   : (typeof data === 'string' ? data : 'Köszönjük az üzenetet!');

      addBubble(reply, 'bot');

      if (Array.isArray(data.quick_replies)) addChips(data.quick_replies);
      if (Array.isArray(data.needed_fields) && data.needed_fields.length){
        addBubble('Kérem, pontosítsa még: ' + data.needed_fields.join(', ') + '.', 'bot');
      }

      history.push({ role:'assistant', content: reply });

    }catch(err){
      addBubble('Hiba történt a válasz lekérése közben. Kérjük, próbálja újra.', 'bot');
    }finally{
      setBusy(false);
    }
  });

  // kényelmi: ESC zár, Ctrl+Enter küld
  document.addEventListener('keydown', (ev)=>{
    if (box.classList.contains('open')){
      if (ev.key === 'Escape') close();
      if (ev.key === 'Enter' && ev.ctrlKey){ form.requestSubmit(); }
    }
  });
})();
