(function(){
  var activeTab = 'url';
  var fgColor = '#151519';
  var bgColor = '#ffffff';
  var size = 300;
  var quietZone = 8;
  var qr = null;
  var debounceTimer = null;
  var lastContent = '';
  var logoImage = null;

  var logoInput = document.getElementById('logo-input');
  var logoFileName = document.getElementById('logo-file-name');
  var logoRemoveBtn = document.getElementById('logo-remove');

  logoInput.addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      var img = new Image();
      img.onload = function(){
        logoImage = img;
        logoFileName.textContent = file.name;
        logoRemoveBtn.style.display = 'inline-block';
        scheduleGenerate(true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  logoRemoveBtn.addEventListener('click', function(){
    logoImage = null;
    logoInput.value = '';
    logoFileName.textContent = 'Nenhuma imagem selecionada';
    logoRemoveBtn.style.display = 'none';
    scheduleGenerate(true);
  });

  var container = document.getElementById('qrcode-container');
  var stage = document.getElementById('preview-stage');
  var placeholder = document.getElementById('placeholder-text');
  var statusBadge = document.getElementById('status-badge');
  var downloadBtn = document.getElementById('download-btn');
  var copyBtn = document.getElementById('copy-btn');
  var toast = document.getElementById('toast');

  // ---- Tabs ----
  document.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(function(c){
        c.style.display = (c.getAttribute('data-content') === activeTab) ? 'block' : 'none';
      });
      clearErrors();
      scheduleGenerate();
    });
  });

  // ---- Size selector ----
  document.querySelectorAll('.size-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.size-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      size = parseInt(btn.getAttribute('data-size'), 10);
      scheduleGenerate(true);
    });
  });

  // ---- Colors ----
  document.getElementById('color-fg').addEventListener('input', function(e){
    fgColor = e.target.value;
    scheduleGenerate(true);
  });
  document.getElementById('color-bg').addEventListener('input', function(e){
    bgColor = e.target.value;
    scheduleGenerate(true);
  });

  // ---- Live typing across all fields ----
  var watchedIds = ['url-input','text-input','email-to','email-subject','email-body',
                     'wa-number','wa-message','wifi-ssid','wifi-security','wifi-password','wifi-hidden'];
  watchedIds.forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    var evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, function(){ scheduleGenerate(); });
  });

  document.getElementById('generate-btn').addEventListener('click', function(){
    scheduleGenerate(true, true);
  });

  function scheduleGenerate(immediate, forceValidate){
    clearTimeout(debounceTimer);
    if(immediate){
      buildContent(forceValidate);
    } else {
      debounceTimer = setTimeout(function(){ buildContent(false); }, 350);
    }
  }

  function clearErrors(){
    document.querySelectorAll('.error-msg').forEach(function(m){ m.classList.remove('show'); });
    document.querySelectorAll('input, textarea').forEach(function(i){ i.classList.remove('invalid'); });
  }

  function showError(fieldId){
    var field = document.getElementById(fieldId);
    if(field){
      field.classList.add('invalid');
      var wrap = field.closest('.field');
      if(wrap){
        var msg = wrap.querySelector('.error-msg');
        if(msg) msg.classList.add('show');
      }
    }
  }

  // ---- Build content string per tab, with validation ----
  function buildContent(showValidation){
    clearErrors();
    var content = '';
    var valid = true;

    if(activeTab === 'url'){
      var val = document.getElementById('url-input').value.trim();
      if(!val){
        valid = false;
        if(showValidation) showError('url-input');
      } else {
        content = /^https?:\/\//i.test(val) ? val : 'https://' + val;
      }
    }
    else if(activeTab === 'text'){
      var val = document.getElementById('text-input').value.trim();
      if(!val){
        valid = false;
        if(showValidation) showError('text-input');
      } else {
        content = val;
      }
    }
    else if(activeTab === 'email'){
      var to = document.getElementById('email-to').value.trim();
      var subject = document.getElementById('email-subject').value.trim();
      var body = document.getElementById('email-body').value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
      if(!emailOk){
        valid = false;
        if(showValidation) showError('email-to');
      } else {
        content = 'mailto:' + to;
        var params = [];
        if(subject) params.push('subject=' + encodeURIComponent(subject));
        if(body) params.push('body=' + encodeURIComponent(body));
        if(params.length) content += '?' + params.join('&');
      }
    }
    else if(activeTab === 'whatsapp'){
      var number = document.getElementById('wa-number').value.replace(/\D/g,'');
      var message = document.getElementById('wa-message').value.trim();
      if(!number || number.length < 8){
        valid = false;
        if(showValidation) showError('wa-number');
      } else {
        content = 'https://wa.me/' + number;
        if(message) content += '?text=' + encodeURIComponent(message);
      }
    }
    else if(activeTab === 'wifi'){
      var ssid = document.getElementById('wifi-ssid').value.trim();
      var security = document.getElementById('wifi-security').value;
      var password = document.getElementById('wifi-password').value;
      var hidden = document.getElementById('wifi-hidden').checked;
      if(!ssid){
        valid = false;
        if(showValidation) showError('wifi-ssid');
      } else {
        var esc = function(s){ return s.replace(/([\\;,:"])/g, '\\$1'); };
        content = 'WIFI:T:' + security + ';S:' + esc(ssid) + ';' +
                  (security !== 'nopass' ? 'P:' + esc(password) + ';' : '') +
                  'H:' + (hidden ? 'true' : 'false') + ';;';
      }
    }

    if(valid && content){
      renderQR(content);
    } else {
      clearPreview();
    }
  }

  // ---- QR rendering ----
  function renderQR(content){
    lastContent = content;
    container.innerHTML = '';
    qr = new QRCode(container, {
      text: content,
      width: size,
      height: size,
      colorDark: fgColor,
      colorLight: bgColor,
      // Nível alto de correção de erro: essencial para o código continuar
      // legível mesmo com uma logo cobrindo o centro.
      correctLevel: logoImage ? QRCode.CorrectLevel.H : QRCode.CorrectLevel.M
    });

    // A lib qrcode.js desenha em um <canvas> mas, em seguida, cria um <img>
    // com o "print" desse canvas e esconde o canvas original. Como a logo é
    // desenhada diretamente no canvas, forçamos o canvas a ficar visível
    // (e escondemos o <img>) para que a logo realmente apareça.
    forceCanvasVisible();

    stage.classList.add('filled');
    placeholder.style.display = 'none';
    statusBadge.style.display = 'inline-flex';
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

    if(logoImage){
      // Aguarda o próximo frame para garantir que o canvas já foi
      // totalmente desenhado antes de sobrepor a logo.
      setTimeout(function(){
        drawLogoOnCanvas();
        forceCanvasVisible();
      }, 60);
    }
  }

  function forceCanvasVisible(){
    var canvas = getCanvas();
    var img = container.querySelector('img');
    if(canvas) canvas.style.display = 'block';
    if(img) img.style.display = 'none';
  }

  function drawLogoOnCanvas(){
    var canvas = getCanvas();
    if(!canvas || !logoImage) return;
    var ctx = canvas.getContext('2d');

    // A logo ocupa ~22% do QR Code, um tamanho seguro para não comprometer a leitura.
    var logoSize = Math.round(canvas.width * 0.22);
    var pad = Math.round(logoSize * 0.16);
    var boxSize = logoSize + pad * 2;
    var x = (canvas.width - boxSize) / 2;
    var y = (canvas.height - boxSize) / 2;

    // Fundo branco/arredondado atrás da logo para garantir contraste e legibilidade.
    var radius = 10;
    ctx.save();
    ctx.fillStyle = bgColor;
    roundRect(ctx, x, y, boxSize, boxSize, radius);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(logoImage, x + pad, y + pad, logoSize, logoSize);
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function clearPreview(){
    container.innerHTML = '';
    stage.classList.remove('filled');
    placeholder.style.display = 'block';
    statusBadge.style.display = 'none';
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    lastContent = '';
  }

  function getCanvas(){
    return container.querySelector('canvas');
  }

  // ---- Download ----
  downloadBtn.addEventListener('click', function(){
    var canvas = getCanvas();
    if(!canvas) return;
    var exportCanvas = createExportCanvas(canvas);
    var link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('Download iniciado');
  });

  // ---- Copy image (falls back to copying the content text) ----
  copyBtn.addEventListener('click', function(){
    var canvas = getCanvas();
    if(!canvas) return;
    var exportCanvas = createExportCanvas(canvas);

    if(navigator.clipboard && window.ClipboardItem){
      exportCanvas.toBlob(function(blob){
        if(!blob){ fallbackCopyText(); return; }
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(function(){
          showToast('Imagem copiada!');
        }).catch(function(){
          fallbackCopyText();
        });
      });
    } else {
      fallbackCopyText();
    }
  });

  function createExportCanvas(sourceCanvas){
    var exportCanvas = document.createElement('canvas');
    var exportSize = sourceCanvas.width + quietZone * 2;
    var ctx = exportCanvas.getContext('2d');

    exportCanvas.width = exportSize;
    exportCanvas.height = sourceCanvas.height + quietZone * 2;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(sourceCanvas, quietZone, quietZone);

    return exportCanvas;
  }

  function fallbackCopyText(){
    if(!lastContent) return;
    navigator.clipboard.writeText(lastContent).then(function(){
      showToast('Conteúdo copiado!');
    }).catch(function(){
      showToast('Não foi possível copiar.');
    });
  }

  function showToast(text){
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(function(){ toast.classList.remove('show'); }, 2200);
  }

})();
