(function(){
  const box   = document.getElementById('aiChat');      // chat ablak
  const openB = document.getElementById('aiChatOpen');  // 💬 gomb
  const closeB= document.getElementById('aiChatClose'); // ✕ gomb
  const form  = document.getElementById('aiChatForm');  // űrlap
  const input = document.getElementById('aiChatInput'); // szövegmező
  const body  = document.getElementById('aiChatBody');  // üzenetek helye

  // Chat nyit/zár
  function open(){ box.classList.add('open'); box.setAttribute('aria-hidden','false'); input.focus(); }
  function close(){ box.classList.remove('open'); box.setAttribute('aria-hidden','true'); }
  openB?.addEventListener('click', open);
  closeB?.addEventListener('click', close);

  // Buborék hozzáadása
  function addBubble(text, who='bot'){
    const b = document.createElement('div');
    b.className = 'bubble ' + (who==='me'?'me':'bot');
    b.textContent = text;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight; // mindig leteker
  }

  // Üzleti szűrő (csak erre válaszol)
  const BUSINESS_ALLOW = [
    'ajánlat','ára','árak','költség','kalkul','határid','szerződés','garancia',
    'generálkivitelez','szigetel','homlokzat','térkövez','burkol','fest',
    'felújít','referencia','kapcsolat','helyszíni','felmérés','projekt','anyag','munkadíj'
  ];
  function isBusinessQuery(msg){
    const m = msg.toLowerCase();
    return BUSINESS_ALLOW.some(k=> m.includes(k));
  }

  // Küldés
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = (input.value||'').trim();
    if(!msg) return;

    addBubble(msg, 'me');
    input.value = '';

    // Ha nem üzleti jellegű → nem válaszol
    if(!isBusinessQuery(msg)){
      addBubble('A chat jelenleg csak üzleti témákra válaszol (ajánlat, ár, határidő, szolgáltatás, referencia, kapcsolat).', 'bot');
      return;
    }

    try{
      // API hívás a Netlify functionhoz
      const res = await fetch("/.netlify/functions/ai", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ prompt: msg })
      });

      const data = await res.json();
      addBubble(data.answer || "Nincs válasz.", 'bot');
    }catch(err){
      addBubble("Hiba történt a válasz lekérése közben. Kérjük, próbálja újra.", 'bot');
    }
  });
})();
