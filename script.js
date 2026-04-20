const canvas = document.getElementById('editorCanvas');
        const ctx = canvas.getContext('2d');
        
        let currentImage = null;
        let backgroundImage = null;
        let useGradient = true;
        let textSettings = {
            bold: false,
            italic: false,
            underline: false,
            align: 'left'
        };

        // Initialize canvas with default gradient
        function initCanvas() {
            updateBackground();
        }

        function toggleGradient() {
            useGradient = !useGradient;
            document.getElementById('gradientToggle').classList.toggle('active');
            updateBackground();
        }

        function updateBackground() {
            const color1 = document.getElementById('bgColor1').value;
            const color2 = document.getElementById('bgColor2').value;
            
            if (useGradient) {
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, color1);
                gradient.addColorStop(1, color2);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = color1;
            }
            
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (currentImage) {
                applyFiltersAndDraw();
            }
        }

        function uploadBackground(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        backgroundImage = img;
                        drawCanvas();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        function importImages(event) {
            const files = event.target.files;
            if (files.length > 0) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        currentImage = img;
                        // Scale image to fit canvas
                        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                        img.width = img.width * scale;
                        img.height = img.height * scale;
                        drawCanvas();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(files[0]);
            }
        }

        function updateFilters() {
            document.getElementById('contrastValue').textContent = document.getElementById('contrast').value + '%';
            document.getElementById('brightnessValue').textContent = document.getElementById('brightness').value + '%';
            document.getElementById('blurValue').textContent = document.getElementById('blur').value + 'px';
            document.getElementById('opacityValue').textContent = document.getElementById('opacity').value + '%';
            document.getElementById('sepiaValue').textContent = document.getElementById('sepia').value + '%';
            document.getElementById('warmthValue').textContent = document.getElementById('warmth').value + '%';
            document.getElementById('tintValue').textContent = document.getElementById('tint').value + '%';
            document.getElementById('hueValue').textContent = document.getElementById('hue').value + '°';
            
            if (currentImage) {
                applyFiltersAndDraw();
            }
        }

        function applyFiltersAndDraw() {
            const contrast = document.getElementById('contrast').value;
            const brightness = document.getElementById('brightness').value;
            const blur = document.getElementById('blur').value;
            const opacity = document.getElementById('opacity').value / 100;
            const sepia = document.getElementById('sepia').value;
            const warmth = document.getElementById('warmth').value;
            const tint = document.getElementById('tint').value;
            const hue = document.getElementById('hue').value;

            ctx.filter = `contrast(${contrast}%) brightness(${brightness}%) blur(${blur}px) opacity(${opacity}) sepia(${sepia}%) saturate(${100 + parseInt(warmth)}%) hue-rotate(${hue}deg)`;
            
            if (tint > 0) {
                ctx.globalAlpha = opacity;
            }
            
            const x = (canvas.width - currentImage.width) / 2;
            const y = (canvas.height - currentImage.height) / 2;
            
            ctx.drawImage(currentImage, x, y);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            
            // Apply tint if needed
            if (tint > 0) {
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = `rgba(102, 126, 234, ${tint / 100})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
            }
            
            // Redraw text
            updateText();
        }

        function drawCanvas() {
            updateBackground();
        }

        function updateText() {
            if (!currentImage) return;
            
            // Redraw image with filters
            applyFiltersAndDraw();
            
            const text = document.getElementById('textInput').value;
            if (!text) return;
            
            const fontFamily = document.getElementById('fontFamily').value;
            const textColor = document.getElementById('textColor').value;
            const fontSize = 32;
            
            let fontStyle = '';
            if (textSettings.bold) fontStyle += 'bold ';
            if (textSettings.italic) fontStyle += 'italic ';
            
            ctx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
            ctx.fillStyle = textColor;
            ctx.textAlign = textSettings.align;
            ctx.textBaseline = 'middle';
            
            const x = textSettings.align === 'left' ? 20 : 
                      textSettings.align === 'right' ? canvas.width - 20 : 
                      canvas.width / 2;
            const y = canvas.height - 80;
            
            // Draw text shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            ctx.fillText(text, x, y);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Underline
            if (textSettings.underline) {
                const metrics = ctx.measureText(text);
                const textWidth = metrics.width;
                const underlineY = y + fontSize / 2 + 4;
                
                ctx.beginPath();
                if (textSettings.align === 'left') {
                    ctx.moveTo(x, underlineY);
                    ctx.lineTo(x + textWidth, underlineY);
                } else if (textSettings.align === 'right') {
                    ctx.moveTo(x - textWidth, underlineY);
                    ctx.lineTo(x, underlineY);
                } else {
                    ctx.moveTo(x - textWidth / 2, underlineY);
                    ctx.lineTo(x + textWidth / 2, underlineY);
                }
                ctx.strokeStyle = textColor;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        function toggleTextStyle(style) {
            textSettings[style] = !textSettings[style];
            document.getElementById('btn' + style.charAt(0).toUpperCase() + style.slice(1)).classList.toggle('active');
            updateText();
        }

        function alignText(alignment) {
            textSettings.align = alignment;
            ['left', 'center', 'right'].forEach(align => {
                document.getElementById('align' + align.charAt(0).toUpperCase() + align.slice(1)).classList.remove('active');
            });
            document.getElementById('align' + alignment.charAt(0).toUpperCase() + alignment.slice(1)).classList.add('active');
            updateText();
        }

        function exportImage() {
            const link = document.createElement('a');
            link.download = 'social-media-post.png';
            link.href = canvas.toDataURL();
            link.click();
        }

        // Initialize
        window.onload = initCanvas;