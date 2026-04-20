// State
    let activeImage = null;
    let selectedText = null;
    let isDragging = false, dragOffset = { x: 0, y: 0 };
    let cropState = { startX: 0, startY: 0, isDrawing: false };
    const canvas = document.getElementById('canvas');
    const imgDefaults = { brightness:100, contrast:100, darkness:0, blur:0, opacity:100, sepia:0, warmth:0, tint:0, hue:0 };
    let imageFilters = new Map();

    // Canvas Size
    document.getElementById('size-preset').addEventListener('change', e => {
      if (e.target.value !== 'custom') {
        const [w,h] = e.target.value.split('x');
        document.getElementById('custom-w').value = w;
        document.getElementById('custom-h').value = h;
        applySize();
      }
    });
    function applySize() {
      canvas.style.width = `${document.getElementById('custom-w').value}px`;
      canvas.style.height = `${document.getElementById('custom-h').value}px`;
    }
    applySize();

    // Gradient BG
    function updateBg() {
      const s = document.getElementById('grad-start').value, e = document.getElementById('grad-end').value;
      const a = document.getElementById('grad-angle').value, t = document.getElementById('grad-type').value;
      canvas.style.background = t === 'radial' ? `radial-gradient(circle, ${s}, ${e})` : `linear-gradient(${a}deg, ${s}, ${e})`;
    }
    ['grad-start','grad-end','grad-angle','grad-type'].forEach(id => document.getElementById(id).addEventListener('input', updateBg));

    // BG Image
    document.getElementById('bg-file-input').addEventListener('change', e => {
      if (!e.target.files[0]) return;
      let bgImg = document.querySelector('#canvas img.bg-layer');
      if (!bgImg) { bgImg = document.createElement('img'); bgImg.className = 'bg-layer'; canvas.appendChild(bgImg); }
      bgImg.src = URL.createObjectURL(e.target.files[0]);
      bgImg.style.display = 'block';
    });

    // Import Images
    document.getElementById('file-input').addEventListener('change', e => {
      Array.from(e.target.files).forEach(file => {
        const img = document.createElement('img');
        img.className = 'imported-img';
        img.src = URL.createObjectURL(file);
        img.style.left = '20px'; img.style.top = '20px';
        img.style.width = '200px';
        imageFilters.set(img, {...imgDefaults, scale: 100});
        setupImage(img);
        canvas.appendChild(img);
        selectImage(img);
      });
    });

    function setupImage(img) {
      img.addEventListener('mousedown', e => { e.stopPropagation(); selectImage(img); startDrag(img, e); });
      img.addEventListener('contextmenu', e => { e.preventDefault(); selectImage(img); });
    }

    function selectImage(img) {
      deselectAll(); activeImage = img;
      img.classList.add('selected');
      document.getElementById('img-panel').classList.add('active');
      document.getElementById('bg-panel').classList.remove('active');
      document.getElementById('text-panel').classList.remove('active');
      document.getElementById('delete-btn').style.display = 'block';
      loadImgControls(img);
    }

    function loadImgControls(img) {
      const f = imageFilters.get(img);
      document.querySelectorAll('#img-panel input[type="range"]').forEach(r => {
        r.value = f[r.dataset.prop] || 100;
      });
      document.getElementById('img-scale').value = f.scale;
    }

    // Image Adjustments
    document.querySelectorAll('#img-panel input[type="range"]').forEach(input => {
      input.addEventListener('input', () => {
        if (!activeImage) return;
        const f = imageFilters.get(activeImage);
        f[input.dataset.prop] = parseFloat(input.value);
        applyImgFilters(activeImage, f);
      });
    });

    document.getElementById('img-scale').addEventListener('input', e => {
      if (!activeImage) return;
      const f = imageFilters.get(activeImage);
      f.scale = parseFloat(e.target.value);
      applyImgFilters(activeImage, f);
    });

    function applyImgFilters(img, f) {
      const b = f.brightness - f.darkness;
      img.style.filter = `brightness(${b}%) contrast(${f.contrast}%) blur(${f.blur}px) sepia(${f.sepia}%) saturate(${100+f.warmth}%) hue-rotate(${f.tint + f.hue}deg)`;
      img.style.opacity = f.opacity / 100;
      img.style.width = `${(img.naturalWidth || img.width) * (f.scale/100)}px`;
      img.style.height = 'auto';
    }

    function resetImgAdj() {
      if (!activeImage) return;
      imageFilters.set(activeImage, {...imgDefaults, scale: 100});
      loadImgControls(activeImage);
      applyImgFilters(activeImage, imageFilters.get(activeImage));
    }

    function resizeImg(delta) {
      if (!activeImage) return;
      const f = imageFilters.get(activeImage);
      f.scale = Math.max(10, Math.min(300, f.scale + delta));
      document.getElementById('img-scale').value = f.scale;
      applyImgFilters(activeImage, f);
    }

    // Crop Tool
    function openCrop() {
      if (!activeImage) return;
      const modal = document.getElementById('crop-modal');
      const cImg = document.getElementById('crop-img');
      cImg.src = activeImage.src;
      modal.style.display = 'flex';
      setupCropDrag();
    }
    function closeCrop() { document.getElementById('crop-modal').style.display = 'none'; }

    function setupCropDrag() {
      const box = document.getElementById('crop-selection');
      const cImg = document.getElementById('crop-img');
      const cont = document.getElementById('crop-container');
      
      cont.onmousedown = e => {
        cropState.isDrawing = true;
        const rect = cont.getBoundingClientRect();
        cropState.startX = e.clientX - rect.left;
        cropState.startY = e.clientY - rect.top;
        box.style.left = box.style.top = box.style.width = box.style.height = '0px';
        box.style.display = 'block';
      };
      document.onmousemove = e => {
        if (!cropState.isDrawing) return;
        const rect = cont.getBoundingClientRect();
        const x = Math.max(0, e.clientX - rect.left), y = Math.max(0, e.clientY - rect.top);
        const w = Math.abs(x - cropState.startX), h = Math.abs(y - cropState.startY);
        box.style.left = `${Math.min(x, cropState.startX)}px`;
        box.style.top = `${Math.min(y, cropState.startY)}px`;
        box.style.width = `${w}px`; box.style.height = `${h}px`;
      };
      document.onmouseup = () => cropState.isDrawing = false;
    }

    function applyCrop() {
      const sel = document.getElementById('crop-selection');
      if (parseFloat(sel.style.width) < 10) return alert('Selection too small');
      
      const img = document.getElementById('crop-img');
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      
      const scale = img.naturalWidth / img.width;
      cvs.width = parseFloat(sel.style.width) * scale;
      cvs.height = parseFloat(sel.style.height) * scale;
      
      const dx = parseFloat(sel.style.left) * scale;
      const dy = parseFloat(sel.style.top) * scale;
      
      ctx.drawImage(img, dx, dy, cvs.width, cvs.height, 0, 0, cvs.width, cvs.height);
      activeImage.src = cvs.toDataURL('image/png');
      
      closeCrop();
    }

    // Text
    document.getElementById('add-text-btn').addEventListener('click', () => {
      const txt = document.createElement('div');
      txt.className = 'editable-text';
      txt.contentEditable = true;
      txt.innerText = 'Double-click to edit';
      txt.style.left = '20px'; txt.style.top = '20px';
      txt.style.fontSize = '32px'; txt.style.color = '#fff'; txt.style.fontFamily = 'Inter, sans-serif';
      txt.addEventListener('mousedown', e => { e.stopPropagation(); selectText(txt); });
      canvas.appendChild(txt);
      selectText(txt);
    });

    function selectText(el) {
      deselectAll(); selectedText = el;
      el.classList.add('selected');
      document.getElementById('text-panel').classList.add('active');
      document.getElementById('img-panel').classList.remove('active');
      document.getElementById('bg-panel').classList.remove('active');
      document.getElementById('delete-btn').style.display = 'block';
    }

    function deselectAll(e) {
      if (e && e.target !== canvas) return;
      document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      selectedText = activeImage = null;
      document.getElementById('text-panel').classList.remove('active');
      document.getElementById('img-panel').classList.remove('active');
      document.getElementById('bg-panel').classList.add('active');
      document.getElementById('delete-btn').style.display = 'none';
    }

    // Drag Logic
    function startDrag(el, e) { isDragging = true; dragOffset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop }; }
    document.addEventListener('mousemove', e => {
      if (isDragging && (selectedText || activeImage)) {
        const target = selectedText || activeImage;
        target.style.left = `${e.clientX - dragOffset.x}px`;
        target.style.top = `${e.clientY - dragOffset.y}px`;
      }
    });
    document.addEventListener('mouseup', () => isDragging = false);

    // Text Controls
    function toggleCmd(cmd) { if(selectedText) document.execCommand(cmd, false, null); }
    function alignText(dir) { if(selectedText) selectedText.style.textAlign = dir; }
    
    document.getElementById('txt-font').addEventListener('change', e => selectedText.style.fontFamily = e.target.value);
    document.getElementById('txt-size').addEventListener('input', e => selectedText.style.fontSize = e.target.value + 'px');
    
    document.getElementById('txt-grad').addEventListener('change', e => {
      if(!selectedText) return;
      if(e.target.checked) {
        selectedText.style.background = `linear-gradient(90deg, ${document.getElementById('txt-color1').value}, ${document.getElementById('txt-color2').value})`;
        selectedText.style.webkitBackgroundClip = 'text'; selectedText.style.webkitTextFillColor = 'transparent';
      } else {
        selectedText.style.background = 'none'; selectedText.style.webkitTextFillColor = 'initial'; selectedText.style.color = document.getElementById('txt-color1').value;
      }
    });
    ['txt-color1','txt-color2'].forEach(id => document.getElementById(id).addEventListener('input', () => document.getElementById('txt-grad').checked && selectedText && (selectedText.style.background = `linear-gradient(90deg, ${document.getElementById('txt-color1').value}, ${document.getElementById('txt-color2').value})`)));

    function updateTextShadow() {
      if(!selectedText) return;
      let t = '';
      if(document.getElementById('txt-shadow-on').checked) {
        t += `${document.getElementById('txt-shadow-x').value}px ${document.getElementById('txt-shadow-y').value}px ${document.getElementById('txt-shadow-blur').value}px ${document.getElementById('txt-shadow-color').value}`;
      }
      if(document.getElementById('txt-glow-in-on').checked) {
        t += t ? ', ' : '';
        const b = document.getElementById('txt-glow-in-blur').value;
        const c = document.getElementById('txt-glow-in-color').value;
        t += `0 0 ${b}px ${c}, inset 0 0 ${b/2}px ${c}`;
      }
      selectedText.style.textShadow = t || 'none';
      selectedText.style.filter = document.getElementById('txt-glow-out-on').checked ? `drop-shadow(0 0 ${document.getElementById('txt-glow-out-blur').value}px ${document.getElementById('txt-glow-out-color').value})` : 'none';
    }
    document.querySelectorAll('#text-panel input').forEach(el => el.addEventListener('input', updateTextShadow));

    document.getElementById('delete-btn').addEventListener('click', () => {
      if(activeImage) { imageFilters.delete(activeImage); activeImage.remove(); }
      if(selectedText) selectedText.remove();
      deselectAll();
    });

    // Export
    async function exportCanvas() {
      deselectAll();
      document.querySelectorAll('.editable-text').forEach(el => { el.contentEditable = false; el.style.outline = 'none'; });
      try {
        const c = await html2canvas(canvas, { scale: 2, useCORS: true, backgroundColor: null });
        const a = document.createElement('a'); a.download = 'social-post.png'; a.href = c.toDataURL(); a.click();
        document.querySelectorAll('.editable-text').forEach(el => el.contentEditable = true);
      } catch(e) { alert('Export failed: ' + e.message); }
    }

    updateBg();