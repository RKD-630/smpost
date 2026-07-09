// Global variables
        let canvas = document.getElementById('mainCanvas');
        let ctx = canvas.getContext('2d');
        let currentPlatform = 'facebook';
        let bgImage = null;
        let saveFormat = 'png';
        let textSettings = {
            bold: false,
            italic: false,
            underline: false,
            align: 'center',
            bgEnabled: false,
            shadowBlur: 0,
            shadowColor: '#000000',
            shadowOffsetX: 4,
            shadowOffsetY: 4,
            x: null,
            y: null
        };
        
        let selectedItem = null;
        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        // Initialize
        window.onload = function() {
            drawCanvas();
        };

        // Set platform and resize canvas
        function setPlatform(platform, width, height) {
            currentPlatform = platform;
            canvas.width = width;
            canvas.height = height;
            
            showToast(`${platform} canvas: ${width}x${height}`);
            drawCanvas();
        }

        // Set save format
        function setFormat(format) {
            saveFormat = format;
            showToast(`Format set to ${format.toUpperCase()}`);
        }

        // Save image
        function saveImage() {
            try {
                const link = document.createElement('a');
                const timestamp = new Date().getTime();
                
                if (saveFormat === 'png') {
                    link.download = `social-post-${timestamp}.png`;
                    link.href = canvas.toDataURL('image/png', 1.0);
                } else if (saveFormat === 'jpg') {
                    link.download = `social-post-${timestamp}.jpg`;
                    link.href = canvas.toDataURL('image/jpeg', 0.95);
                } else if (saveFormat === 'webp') {
                    link.download = `social-post-${timestamp}.webp`;
                    link.href = canvas.toDataURL('image/webp', 0.95);
                }
                
                link.click();
                showToast('Image saved successfully!');
            } catch (error) {
                showToast('Error saving image: ' + error.message);
            }
        }

        // Draw canvas with all elements
        function drawCanvas() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw background
            if (bgImage) {
                drawBackgroundImage();
            } else {
                drawGradientBackground();
            }
            
            // Draw text
            drawText();
        }

        // Draw gradient background
        function drawGradientBackground() {
            const color1 = document.getElementById('gradientColor1').value;
            const color2 = document.getElementById('gradientColor2').value;
            
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Draw background image
        function drawBackgroundImage() {
            if (!bgImage) return;
            
            const size = document.getElementById('imgSize').value / 100;
            const contrast = document.getElementById('contrast').value;
            const brightness = document.getElementById('brightness').value;
            const darkness = document.getElementById('darkness').value;
            const blur = document.getElementById('blur').value;
            const opacity = document.getElementById('opacity').value / 100;
            const sepia = document.getElementById('sepia').value;
            const warmth = document.getElementById('warmth').value;
            const tint = document.getElementById('tint').value;
            const hue = document.getElementById('hue').value;
            
            // Apply filters
            ctx.filter = `
                contrast(${contrast}%)
                brightness(${brightness - darkness}%)
                blur(${blur}px)
                opacity(${opacity})
                sepia(${sepia}%)
                hue-rotate(${hue}deg)
            `;
            
            // Calculate dimensions
            const imgWidth = bgImage.width * size;
            const imgHeight = bgImage.height * size;
            const x = (canvas.width - imgWidth) / 2;
            const y = (canvas.height - imgHeight) / 2;
            
            // Draw image
            ctx.globalAlpha = opacity;
            ctx.drawImage(bgImage, x, y, imgWidth, imgHeight);
            ctx.globalAlpha = 1;
            ctx.filter = 'none';
            
            // Apply warmth and tint overlays
            if (warmth !== 0 || tint !== 0) {
                ctx.globalCompositeOperation = 'overlay';
                if (warmth > 0) {
                    ctx.fillStyle = `rgba(255, 160, 60, ${Math.abs(warmth) / 200})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else if (warmth < 0) {
                    ctx.fillStyle = `rgba(60, 160, 255, ${Math.abs(warmth) / 200})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                if (tint !== 0) {
                    ctx.fillStyle = `rgba(180, 60, 255, ${Math.abs(tint) / 200})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.globalCompositeOperation = 'source-over';
            }
            
            // Draw selection box and delete button
            if (selectedItem === 'image') {
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(x - 5, y - 5, imgWidth + 10, imgHeight + 10);
                ctx.setLineDash([]);
                
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(x + imgWidth + 5, y - 5, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('X', x + imgWidth + 5, y - 5);
            }
        }

        // Draw text
        function drawText() {
            const text = document.getElementById('textContent').value;
            if (!text) return;
            
            const fontFamily = document.getElementById('fontFamily').value;
            const fontSize = document.getElementById('textSize').value;
            const color = document.getElementById('textColor').value;
            
            ctx.font = `${textSettings.italic ? 'italic' : ''} ${textSettings.bold ? 'bold' : ''} ${fontSize}px ${fontFamily}`;
            ctx.textAlign = textSettings.align;
            ctx.textBaseline = 'middle';
            
            const defaultX = textSettings.align === 'left' ? 50 : 
                      textSettings.align === 'right' ? canvas.width - 50 : 
                      canvas.width / 2;
            const defaultY = canvas.height / 2;
            const x = textSettings.x !== null ? textSettings.x : defaultX;
            const y = textSettings.y !== null ? textSettings.y : defaultY;
            
            // Apply shadow if exists
            if (textSettings.shadowBlur > 0) {
                ctx.shadowColor = textSettings.shadowColor;
                ctx.shadowBlur = textSettings.shadowBlur;
                ctx.shadowOffsetX = textSettings.shadowOffsetX;
                ctx.shadowOffsetY = textSettings.shadowOffsetY;
            }
            
            // Draw text background if enabled
            if (textSettings.bgEnabled) {
                const metrics = ctx.measureText(text);
                const bgPadding = 20;
                const bgHeight = parseInt(fontSize) + bgPadding;
                const bgWidth = metrics.width + bgPadding * 2;
                const bgX = textSettings.align === 'left' ? x - bgPadding :
                           textSettings.align === 'right' ? x - bgWidth + bgPadding :
                           x - bgWidth / 2;
                
                ctx.fillStyle = document.getElementById('textBgColor').value;
                ctx.fillRect(bgX, y - bgHeight / 2, bgWidth, bgHeight);
            }
            
            // Draw text
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw underline if enabled
            let metrics = ctx.measureText(text);
            if (textSettings.underline) {
                const underlineY = y + parseInt(fontSize) / 2 + 5;
                const underlineX = textSettings.align === 'left' ? x :
                                  textSettings.align === 'right' ? x - metrics.width :
                                  x - metrics.width / 2;
                
                ctx.beginPath();
                ctx.moveTo(underlineX, underlineY);
                ctx.lineTo(underlineX + metrics.width, underlineY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // Draw selection box and delete button
            if (selectedItem === 'text') {
                const width = metrics.width;
                const height = parseInt(fontSize);
                let left = x;
                if (textSettings.align === 'center') left = x - width / 2;
                if (textSettings.align === 'right') left = x - width;
                const top = y - height / 2;
                
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(left - 10, top - 10, width + 20, height + 20);
                ctx.setLineDash([]);
                
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(left + width + 10, top - 10, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('X', left + width + 10, top - 10);
            }
        }

        // Apply text effect template
        function applyTextTemplate(template) {
            const textInput = document.getElementById('textContent');
            if (!textInput.value || textInput.value === 'Your Text Here') {
                textInput.value = 'Sample Text';
            }
            
            switch(template) {
                case 'neon':
                    document.getElementById('textColor').value = '#ffffff';
                    document.getElementById('shadowColor').value = '#00ffff';
                    document.getElementById('shadowBlur').value = 20;
                    textSettings.shadowBlur = 20;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Impact';
                    break;
                    
                case 'gold':
                    document.getElementById('textColor').value = '#ffd700';
                    document.getElementById('shadowColor').value = '#b8860b';
                    document.getElementById('shadowBlur').value = 5;
                    textSettings.shadowBlur = 5;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Georgia';
                    break;
                    
                case 'outline':
                    document.getElementById('textColor').value = '#ffffff';
                    document.getElementById('shadowColor').value = '#000000';
                    document.getElementById('shadowBlur').value = 0;
                    textSettings.shadowBlur = 0;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Arial';
                    break;
                    
                case 'shadow':
                    document.getElementById('textColor').value = '#ffffff';
                    document.getElementById('shadowColor').value = '#000000';
                    document.getElementById('shadowBlur').value = 10;
                    textSettings.shadowBlur = 10;
                    textSettings.shadowOffsetX = 8;
                    textSettings.shadowOffsetY = 8;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Impact';
                    break;
                    
                case 'gradient':
                    document.getElementById('textColor').value = '#667eea';
                    document.getElementById('shadowColor').value = '#764ba2';
                    document.getElementById('shadowBlur').value = 15;
                    textSettings.shadowBlur = 15;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Helvetica';
                    break;
                    
                case 'retro':
                    document.getElementById('textColor').value = '#ff6b6b';
                    document.getElementById('shadowColor').value = '#4ecdc4';
                    document.getElementById('shadowBlur').value = 8;
                    textSettings.shadowBlur = 8;
                    textSettings.shadowOffsetX = 4;
                    textSettings.shadowOffsetY = 4;
                    textSettings.bold = true;
                    document.getElementById('boldBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Courier New';
                    break;
                    
                case 'cyber':
                    document.getElementById('textColor').value = '#00d9ff';
                    document.getElementById('shadowColor').value = '#ff00ff';
                    document.getElementById('shadowBlur').value = 15;
                    textSettings.shadowBlur = 15;
                    textSettings.bold = false;
                    document.getElementById('boldBtn').classList.remove('active');
                    document.getElementById('fontFamily').value = 'Courier New';
                    break;
                    
                case 'elegant':
                    document.getElementById('textColor').value = '#ffffff';
                    document.getElementById('shadowColor').value = '#000000';
                    document.getElementById('shadowBlur').value = 3;
                    textSettings.shadowBlur = 3;
                    textSettings.italic = true;
                    document.getElementById('italicBtn').classList.add('active');
                    document.getElementById('fontFamily').value = 'Georgia';
                    break;
            }
            
            document.getElementById('shadowBlurValue').textContent = document.getElementById('shadowBlur').value + 'px';
            updateText();
            showToast(`${template.charAt(0).toUpperCase() + template.slice(1)} template applied!`);
        }

        // Update background
        function updateBackground() {
            if (!bgImage) {
                drawCanvas();
            } else {
                drawBackgroundImage();
                drawText();
            }
        }

        // Handle background image upload
        function handleBgImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    bgImage = new Image();
                    bgImage.onload = function() {
                        drawCanvas();
                        showToast('Background image loaded');
                    };
                    bgImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        // Update image adjustments
        function updateImageAdjustments() {
            // Update value displays
            document.getElementById('sizeValue').textContent = document.getElementById('imgSize').value + '%';
            
            drawCanvas();
        }

        // Update text
        function updateText() {
            document.getElementById('textSizeValue').textContent = document.getElementById('textSize').value + 'px';
            textSettings.shadowBlur = parseInt(document.getElementById('shadowBlur').value);
            document.getElementById('shadowBlurValue').textContent = textSettings.shadowBlur + 'px';
            drawCanvas();
        }

        // Toggle text style
        function toggleTextStyle(style) {
            textSettings[style] = !textSettings[style];
            document.getElementById(style + 'Btn').classList.toggle('active');
            updateText();
        }

        // Set text alignment
        function setTextAlign(align) {
            textSettings.align = align;
            document.querySelectorAll('.align-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('align' + align.charAt(0).toUpperCase() + align.slice(1)).classList.add('active');
            updateText();
        }

        // Toggle text background
        function toggleTextBackground() {
            textSettings.bgEnabled = !textSettings.bgEnabled;
            document.getElementById('textBgToggle').classList.toggle('active');
            document.getElementById('textBgColorGroup').style.display = textSettings.bgEnabled ? 'block' : 'none';
            updateText();
        }

        // Handle import all images
        function handleImportAll(event) {
            const files = event.target.files;
            if (files.length > 0) {
                showToast(`Imported ${files.length} image(s)`);
                // You can add logic to handle multiple images here
            }
        }

        // Show toast notification
        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Handle window resize
        window.addEventListener('resize', function() {
            // Maintain aspect ratio on resize
            drawCanvas();
        });

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            canvas.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Handle drop on canvas
        canvas.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    bgImage = new Image();
                    bgImage.onload = function() {
                        drawCanvas();
                        showToast('Image dropped successfully');
                    };
                    bgImage.src = e.target.result;
                };
                reader.readAsDataURL(files[0]);
            }
        }
        // Mobile bottom navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.querySelector('.sidebar-right').classList.add('active');
                document.querySelectorAll('.sidebar-right .control-section').forEach(sec => sec.classList.remove('active'));
                const targetId = tab.getAttribute('data-tab');
                document.getElementById(targetId).classList.add('active');
            });
        });

        // Drag down to hide sidebar
        let sidebarDragStartY = 0;
        let sidebarCurrentY = 0;
        let isSidebarDragging = false;
        const sidebarEl = document.querySelector('.sidebar-right');
        const dragHandleEl = document.getElementById('dragHandle');

        if (sidebarEl && dragHandleEl) {
            const dragStart = (e, coords) => {
                isSidebarDragging = true;
                const isRight = sidebarEl.classList.contains('position-right');
                sidebarDragStartY = isRight ? coords.clientX : coords.clientY;
                sidebarEl.style.transition = 'none';
            };

            const dragMove = (e, coords) => {
                if (!isSidebarDragging) return;
                const isRight = sidebarEl.classList.contains('position-right');
                const currentPos = isRight ? coords.clientX : coords.clientY;
                const delta = currentPos - sidebarDragStartY;
                if (delta > 0) {
                    sidebarCurrentY = delta;
                    if (isRight) {
                        sidebarEl.style.transform = `translateX(${delta}px)`;
                    } else {
                        sidebarEl.style.transform = `translateY(${delta}px)`;
                    }
                }
            };

            const dragEnd = () => {
                if (!isSidebarDragging) return;
                isSidebarDragging = false;
                sidebarEl.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                if (sidebarCurrentY > 50) {
                    sidebarEl.classList.remove('active');
                    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                }
                sidebarEl.style.transform = '';
                sidebarCurrentY = 0;
            };

            // Touch events
            dragHandleEl.addEventListener('touchstart', (e) => dragStart(e, e.touches[0]), { passive: true });
            dragHandleEl.addEventListener('touchmove', (e) => dragMove(e, e.touches[0]), { passive: true });
            dragHandleEl.addEventListener('touchend', dragEnd);

            // Mouse events
            dragHandleEl.addEventListener('mousedown', (e) => dragStart(e, e));
            document.addEventListener('mousemove', (e) => { if (isSidebarDragging) dragMove(e, e); });
            document.addEventListener('mouseup', dragEnd);
        }

        function toggleSidebarPosition(position) {
            const sidebar = document.querySelector('.sidebar-right');
            if (position === 'right') {
                sidebar.classList.add('position-right');
            } else {
                sidebar.classList.remove('position-right');
            }
        }

        // Dynamic Select Width Adjustment
        function adjustSelectWidth(select) {
            let temp = document.createElement('select');
            temp.className = select.className;
            temp.style.visibility = 'hidden';
            temp.style.position = 'absolute';
            let option = document.createElement('option');
            option.textContent = select.options[select.selectedIndex].text;
            temp.appendChild(option);
            document.body.appendChild(temp);
            select.style.width = temp.offsetWidth + 'px';
            temp.remove();
        }

        // Initialize widths on load
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.header-select').forEach(select => {
                adjustSelectWidth(select);
            });
        });

        // Hide bottom nav on double click

        const bottomNav = document.querySelector('.bottom-nav');
        const sidebarRight = document.querySelector('.sidebar-right');
        const canvasContainer = document.querySelector('.canvas-container');

        if (bottomNav) {
            bottomNav.addEventListener('dblclick', () => {
                bottomNav.style.display = 'none';
                sidebarRight.style.display = 'none';
            });
        }

        if (canvasContainer) {
            canvasContainer.addEventListener('dblclick', () => {
                if (window.innerWidth <= 1023) {
                    bottomNav.style.display = 'flex';
                    sidebarRight.style.display = 'block';
                }
            });
        }
        
        // Master Slider Logic for Image Adjustments
        const adjustConfig = {
            contrast: { label: 'Contrast', min: 0, max: 200, slider: document.getElementById('contrast'), suffix: '%' },
            brightness: { label: 'Brightness', min: 0, max: 200, slider: document.getElementById('brightness'), suffix: '%' },
            darkness: { label: 'Darkness', min: 0, max: 100, slider: document.getElementById('darkness'), suffix: '%' },
            blur: { label: 'Blur', min: 0, max: 20, slider: document.getElementById('blur'), suffix: 'px', step: 0.5 },
            opacity: { label: 'Opacity', min: 0, max: 100, slider: document.getElementById('opacity'), suffix: '%' },
            sepia: { label: 'Sepia', min: 0, max: 100, slider: document.getElementById('sepia'), suffix: '%' },
            warmth: { label: 'Warmth', min: -100, max: 100, slider: document.getElementById('warmth'), suffix: '' },
            tint: { label: 'Tint', min: -100, max: 100, slider: document.getElementById('tint'), suffix: '' },
            hue: { label: 'Hue Rotate', min: 0, max: 360, slider: document.getElementById('hue'), suffix: '°' }
        };

        let activeAdjustment = 'contrast';
        const masterAdjustSlider = document.getElementById('masterAdjustSlider');
        const masterAdjustLabel = document.getElementById('masterAdjustLabel');
        const masterAdjustValue = document.getElementById('masterAdjustValue');

        document.querySelectorAll('#adjustOptionButtons .template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#adjustOptionButtons .template-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                activeAdjustment = btn.getAttribute('data-adjust');
                const config = adjustConfig[activeAdjustment];
                
                masterAdjustLabel.textContent = config.label;
                masterAdjustSlider.min = config.min;
                masterAdjustSlider.max = config.max;
                if(config.step) masterAdjustSlider.step = config.step; else masterAdjustSlider.removeAttribute('step');
                masterAdjustSlider.value = config.slider.value;
                masterAdjustValue.textContent = config.slider.value + config.suffix;
            });
        });

        if(masterAdjustSlider) {
            masterAdjustSlider.addEventListener('input', () => {
                const config = adjustConfig[activeAdjustment];
                config.slider.value = masterAdjustSlider.value;
                masterAdjustValue.textContent = masterAdjustSlider.value + config.suffix;
                updateImageAdjustments();
            });
        }
        // Canvas Interaction
        function getCanvasPos(evt) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            let clientX = evt.clientX;
            let clientY = evt.clientY;
            if (evt.touches && evt.touches.length > 0) {
                clientX = evt.touches[0].clientX;
                clientY = evt.touches[0].clientY;
            } else if (evt.changedTouches && evt.changedTouches.length > 0) {
                clientX = evt.changedTouches[0].clientX;
                clientY = evt.changedTouches[0].clientY;
            }
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }

        function checkTextBounds(x, y) {
            const text = document.getElementById('textContent').value;
            if (!text) return { inText: false, inDelete: false };
            
            const fontSize = parseInt(document.getElementById('textSize').value);
            ctx.font = `${textSettings.italic ? 'italic' : ''} ${textSettings.bold ? 'bold' : ''} ${fontSize}px ${document.getElementById('fontFamily').value}`;
            const metrics = ctx.measureText(text);
            
            const currentX = textSettings.x !== null ? textSettings.x : (textSettings.align === 'left' ? 50 : textSettings.align === 'right' ? canvas.width - 50 : canvas.width / 2);
            const currentY = textSettings.y !== null ? textSettings.y : canvas.height / 2;
            
            const width = metrics.width;
            const height = fontSize;
            let left = currentX;
            if (textSettings.align === 'center') left = currentX - width / 2;
            if (textSettings.align === 'right') left = currentX - width;
            const top = currentY - height / 2;
            
            const dx = x - (left + width + 10);
            const dy = y - (top - 10);
            const inDelete = (dx * dx + dy * dy) <= 225;
            
            const inText = x >= left - 10 && x <= left + width + 10 && y >= top - 10 && y <= top + height + 10;
            return { inText, inDelete };
        }

        function checkImageBounds(x, y) {
            if (!bgImage) return { inImage: false, inDelete: false };
            const size = document.getElementById('imgSize').value / 100;
            const imgWidth = bgImage.width * size;
            const imgHeight = bgImage.height * size;
            const imgX = (canvas.width - imgWidth) / 2;
            const imgY = (canvas.height - imgHeight) / 2;
            
            const dx = x - (imgX + imgWidth + 5);
            const dy = y - (imgY - 5);
            const inDelete = (dx * dx + dy * dy) <= 225;
            
            const inImage = x >= imgX && x <= imgX + imgWidth && y >= imgY && y <= imgY + imgHeight;
            return { inImage, inDelete };
        }

        function handlePointerDown(e) {
            const pos = getCanvasPos(e);
            
            if (selectedItem === 'text') {
                const textCheck = checkTextBounds(pos.x, pos.y);
                if (textCheck.inDelete) {
                    document.getElementById('textContent').value = '';
                    selectedItem = null;
                    textSettings.x = null;
                    textSettings.y = null;
                    updateText();
                    return;
                }
            }
            
            if (selectedItem === 'image') {
                const imgCheck = checkImageBounds(pos.x, pos.y);
                if (imgCheck.inDelete) {
                    bgImage = null;
                    selectedItem = null;
                    drawCanvas();
                    return;
                }
            }
            
            const textCheck = checkTextBounds(pos.x, pos.y);
            if (textCheck.inText) {
                selectedItem = 'text';
                isDragging = true;
                const currentX = textSettings.x !== null ? textSettings.x : (textSettings.align === 'left' ? 50 : textSettings.align === 'right' ? canvas.width - 50 : canvas.width / 2);
                const currentY = textSettings.y !== null ? textSettings.y : canvas.height / 2;
                dragOffsetX = pos.x - currentX;
                dragOffsetY = pos.y - currentY;
                drawCanvas();
                return;
            }
            
            const imgCheck = checkImageBounds(pos.x, pos.y);
            if (imgCheck.inImage) {
                selectedItem = 'image';
                drawCanvas();
                return;
            }
            
            selectedItem = null;
            drawCanvas();
        }

        function handlePointerMove(e) {
            if (!isDragging || selectedItem !== 'text') return;
            const pos = getCanvasPos(e);
            textSettings.x = pos.x - dragOffsetX;
            textSettings.y = pos.y - dragOffsetY;
            drawCanvas();
        }

        function handlePointerUp() {
            isDragging = false;
        }

        canvas.addEventListener('mousedown', handlePointerDown);
        canvas.addEventListener('mousemove', handlePointerMove);
        window.addEventListener('mouseup', handlePointerUp);
        
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointerDown(e); }, { passive: false });
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handlePointerMove(e); }, { passive: false });
        window.addEventListener('touchend', handlePointerUp);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                if (selectedItem === 'text') {
                    document.getElementById('textContent').value = '';
                    textSettings.x = null;
                    textSettings.y = null;
                    selectedItem = null;
                    updateText();
                } else if (selectedItem === 'image') {
                    bgImage = null;
                    selectedItem = null;
                    drawCanvas();
                }
            }
        });

        function toggleTheme() {
            const body = document.body;
            const themeIcon = document.getElementById('themeIcon');
            const themeToggleBtn = document.getElementById('themeToggleBtn');
            const btnText = themeToggleBtn.querySelector('span:last-child');
            
            if (body.getAttribute('data-theme') === 'light') {
                body.removeAttribute('data-theme');
                themeIcon.textContent = '🌙';
                if (btnText) btnText.textContent = 'Night';
            } else {
                body.setAttribute('data-theme', 'light');
                themeIcon.textContent = '☀️';
                if (btnText) btnText.textContent = 'Day';
            }
        }