const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewMedia = document.getElementById('previewMedia');
const clearBtn = document.getElementById('clearBtn');
const analyseBtn = document.getElementById('analyzeBtn');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

const violationCount = document.getElementById('violationCount');
const compliantCount = document.getElementById('compliantCount');
const totalCount = document.getElementById('totalCount');
const outputMedia = document.getElementById('outputMedia');
const summaryContent = document.getElementById('summaryContent');
const timelineBar = document.getElementById('timelineBar');
const alertBadge = document.getElementById('alertBadge');

const API_BASE = window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://127.0.0.1:8000';

let currentFile = null;
let isVideo = false;

uploadZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--color-primary)';
    uploadZone.style.background = 'var(--color-surface-light)';
});

uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--color-border)';
    uploadZone.style.background = 'var(--color-surface)';
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--color-border)';
    uploadZone.style.background = 'var(--color-surface)';
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

function handleFile(file) {
    const fileType = file.type.split('/')[0];
    
    if (fileType !== 'image' && fileType !== 'video') {
        alert('Please upload an image or video file');
        return;
    }
    
    currentFile = file;
    isVideo = fileType === 'video';
    
    const reader = new FileReader();
    reader.onload = (e) => {
        displayPreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

function displayPreview(src) {
    previewMedia.innerHTML = '';
    
    if (isVideo) {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.style.width = '100%';
        previewMedia.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Preview';
        previewMedia.appendChild(img);
    }
    
    previewContainer.style.display = 'block';
    previewContainer.style.animation = 'fadeInUp 0.5s ease-out';
}

clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    currentFile = null;
    isVideo = false;
    fileInput.value = '';
    previewContainer.style.display = 'none';
    previewMedia.innerHTML = '';
});

analyseBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentFile) {
        alert('Please select a file first');
        return;
    }
    
    uploadSection.style.display = 'none';
    processingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    try {
        if (isVideo) {
            await analyseVideo();
        } else {
            await analyseImage();
        }
    } catch (error) {
        console.error('Analysis failed:', error);
        alert(`Error analysing file: ${error.message}\n\nMake sure:\n1. FastAPI server is running\n2. Server is on port 8000`);
        
        uploadSection.style.display = 'block';
        processingSection.style.display = 'none';
    }
});

async function analyseImage() {
    const formData = new FormData();
    formData.append('file', currentFile);
    
    const response = await fetch(`${API_BASE}/image`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error(`Server error: ${data.error}`);
    }
    
    showResults(data);
}

async function analyseVideo() {
    const formData = new FormData();
    formData.append('file', currentFile);

    const response = await fetch(`${API_BASE}/video`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`Server error: ${data.error}`);
    }

    showResults(data);
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds.toFixed(1)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createTimeline(duration, violationPeriods) {
    if (!duration || duration <= 0) return '';
    
    timelineBar.innerHTML = '';
    timelineBar.style.display = 'flex';
    
    const segments = [];
    const resolution = 100; // segments
    
    // Initialize all segments as compliant
    for (let i = 0; i < resolution; i++) {
        segments.push('compliant');
    }
    
    // Mark violation periods
    violationPeriods.forEach(period => {
        const startIdx = Math.floor((period.start / duration) * resolution);
        const endIdx = Math.ceil((period.end / duration) * resolution);
        
        for (let i = startIdx; i < endIdx && i < resolution; i++) {
            segments[i] = 'violation';
        }
    });
    
    // Group consecutive segments of same type
    let currentType = segments[0];
    let currentWidth = 1;
    
    for (let i = 1; i <= segments.length; i++) {
        if (i < segments.length && segments[i] === currentType) {
            currentWidth++;
        } else {
            const segment = document.createElement('div');
            segment.className = `timeline-segment timeline-${currentType}`;
            segment.style.width = `${(currentWidth / resolution) * 100}%`;
            timelineBar.appendChild(segment);
            
            if (i < segments.length) {
                currentType = segments[i];
                currentWidth = 1;
            }
        }
    }
}

function showResults(data) {
    processingSection.style.display = 'none';
    
    const violations = data.violations || 0;
    const compliant = data.compliant || 0;
    const total = data.total_detections || 0;
    
    violationCount.textContent = violations;
    compliantCount.textContent = compliant;
    totalCount.textContent = total;
    
    // Handle alert badge and border for videos
    const outputPanel = document.querySelector('.output-panel');
    if (isVideo && violations > 0) {
        alertBadge.style.display = 'flex';
        alertBadge.classList.add('pulse');
        outputPanel.classList.add('violation-border');
    } else {
        alertBadge.style.display = 'none';
        alertBadge.classList.remove('pulse');
        outputPanel.classList.remove('violation-border');
    }
    
    // Flash violation card if violations detected
    const violationCard = document.querySelector('.stat-card.violation');
    if (violationCard) {
        if (violations > 0) {
            violationCard.classList.add('violation-alert');
        } else {
            violationCard.classList.remove('violation-alert');
        }
    }
    
    outputMedia.innerHTML = '';
    
    if (data.annotated_image) {
        const img = document.createElement('img');
        const imageUrl = `${API_BASE}/annotated/images/${data.annotated_image}?t=${Date.now()}`;

        img.onerror = () => {
            console.warn('Image load failed, using original');
            img.src = URL.createObjectURL(currentFile);
        };

        img.src = imageUrl;
        img.alt = 'Annotated Detection Results';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';

        outputMedia.appendChild(img);
    } else if (data.annotated_video) {
        const video = document.createElement('video');
        const videoUrl = `${API_BASE}/annotated/videos/${data.annotated_video}?t=${Date.now()}`;

        video.controls = true;
        video.style.width = '100%';
        video.style.height = 'auto';
        video.style.display = 'block';
        video.preload = 'auto';

        video.onerror = () => {
            console.error('Video load failed');
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 20px; background: var(--color-surface); border-radius: 8px; border: 2px solid var(--color-warning); margin: 20px 0;';
            errorDiv.innerHTML = `
                <h3 style="color: var(--color-warning); margin: 0 0 10px 0;">⚠️ Video Encoding Issue</h3>
                <p style="margin: 0 0 10px 0;">The video was processed successfully but couldn't be played in your browser.</p>
                <p style="margin: 0 0 10px 0;"><strong>Likely cause:</strong> FFmpeg is not installed or failed to encode the video.</p>
                <p style="margin: 0;"><strong>Solution:</strong> Install ffmpeg: <code>sudo apt install ffmpeg</code></p>
            `;
            outputMedia.appendChild(errorDiv);
        };
        
        video.src = videoUrl;
        outputMedia.appendChild(video);
    } else {
        const media = isVideo ? document.createElement('video') : document.createElement('img');
        if (isVideo) {
            media.controls = true;
        }
        media.src = URL.createObjectURL(currentFile);
        media.alt = 'Original Upload';
        media.style.width = '100%';
        outputMedia.appendChild(media);
    }
    
    // Create timeline for videos
    if (isVideo && data.video_duration && data.violation_periods) {
        createTimeline(data.video_duration, data.violation_periods);
    } else {
        timelineBar.style.display = 'none';
    }
    
    generateSummary(violations, compliant, total, data);
    
    resultsSection.style.cssText = 'display: block !important;';
    
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

function generateSummary(violations, compliant, total, data) {
    const summaryItems = [];
    
    // Section 1: Immediate Action Required (if violations)
    if (violations > 0 && isVideo) {
        const personnel = data.personnel_details || [];
        const violators = personnel.filter(p => p.classification === 'violation');
        
        let actionText = '';
        if (violators.length > 0) {
            const primaryViolator = violators[0];
            const duration = formatDuration(primaryViolator.duration);
            const percentage = primaryViolator.video_percentage.toFixed(0);
            const confidence = (primaryViolator.confidence * 100).toFixed(0);
            
            actionText = `Worker without helmet observed for ${duration} (${percentage}% of monitoring period). `;
            actionText += `Detection confidence: ${confidence}%. `;
            
            if (violators.length > 1) {
                actionText += `${violators.length} total violations detected. `;
            }
            
            actionText += `Immediate intervention required.`;
        } else {
            actionText = `${violations} safety violation${violations > 1 ? 's' : ''} detected. Immediate intervention required.`;
        }
        
        summaryItems.push({
            icon: '⚠️',
            title: 'SAFETY VIOLATION DETECTED',
            text: actionText,
            severity: 'critical'
        });
    }
    
    // Section 2: Temporal Breakdown (for videos with violations)
    if (isVideo && data.violation_periods && data.violation_periods.length > 0) {
        const periods = data.violation_periods;
        let timelineText = '';
        
        if (periods.length === 1) {
            const p = periods[0];
            timelineText = `Violation observed from ${formatTime(p.start)} to ${formatTime(p.end)}. `;
            timelineText += `Duration: ${formatDuration(p.end - p.start)}.`;
        } else {
            timelineText = `Multiple violation windows detected:\n`;
            periods.forEach((p, idx) => {
                timelineText += `• ${formatTime(p.start)} - ${formatTime(p.end)} (${formatDuration(p.end - p.start)})\n`;
            });
        }
        
        summaryItems.push({
            icon: '📊',
            title: 'Violation Timeline',
            text: timelineText,
            severity: 'warning'
        });
    }
    
    // Section 3: Personnel Details (for videos)
    if (isVideo && data.personnel_details && data.personnel_details.length > 0) {
        const personnel = data.personnel_details;
        let personnelText = '';
        
        personnel.forEach(person => {
            const status = person.classification === 'violation' ? '🔴 Violation' : '🟢 Compliant';
            const duration = formatDuration(person.duration);
            const confidence = (person.confidence * 100).toFixed(0);
            const percentage = person.video_percentage.toFixed(0);
            
            personnelText += `Track ${person.track_id} (${status}) - ${duration} visible\n`;
            personnelText += `  └─ ${person.observations} observations, ${confidence}% confidence, ${percentage}% of video\n`;
        });
        
        summaryItems.push({
            icon: '👷',
            title: 'Detected Personnel',
            text: personnelText.trim(),
            severity: 'info'
        });
    }
    
    // Section 4: Detection Summary (always)
    if (total > 0) {
        const complianceRate = ((compliant / total) * 100).toFixed(1);
        let summaryText = `${total} ${total === 1 ? 'person' : 'personnel'} detected. `;
        summaryText += `${violations} violation${violations !== 1 ? 's' : ''}, ${compliant} compliant. `;
        summaryText += `Compliance rate: ${complianceRate}%.`;
        
        summaryItems.push({
            icon: violations > 0 ? '⚠️' : '✅',
            title: 'Detection Summary',
            text: summaryText,
            severity: violations > 0 ? 'warning' : 'success'
        });
    } else {
        summaryItems.push({
            icon: 'ℹ️',
            title: 'Detection Summary',
            text: 'No personnel detected in monitored area.',
            severity: 'info'
        });
    }
    
    // Section 5: System Reliability (for videos)
    if (isVideo && data.overall_confidence !== undefined) {
        const overallConf = (data.overall_confidence * 100).toFixed(0);
        const frameCoverage = data.frame_coverage ? data.frame_coverage.toFixed(1) : '0';
        const totalTracks = data.unique_people_tracked || 0;
        const filtered = data.filtered_tracks || 0;
        const stable = totalTracks - filtered;
        
        let reliabilityText = `Overall confidence: ${overallConf}%. `;
        reliabilityText += `Tracking: ${stable} stable track${stable !== 1 ? 's' : ''}`;
        if (filtered > 0) {
            reliabilityText += `, ${filtered} fragment${filtered !== 1 ? 's' : ''} filtered`;
        }
        reliabilityText += `. `;
        reliabilityText += `Frame coverage: ${frameCoverage}%.`;
        
        summaryItems.push({
            icon: 'ℹ️',
            title: 'Detection Quality',
            text: reliabilityText,
            severity: 'info'
        });
    }
    
    // Section 6: Coverage Type
    summaryItems.push({
        icon: isVideo ? '🎥' : '📸',
        title: 'Coverage Type',
        text: isVideo 
            ? 'Continuous video monitoring with temporal tracking across frames.'
            : 'Single frame capture. Snapshot analysis of site at moment of capture.',
        severity: 'info'
    });
    
    // Section 7: System Limitations
    if (total > 0) {
        const limitations = [];
        
        limitations.push('Detection confidence threshold set at 50%');
        
        if (isVideo) {
            limitations.push('Track IDs may change if personnel exit and re-enter frame');
            if (total > 5) {
                limitations.push('Personnel count may include duplicates due to tracking fragmentation');
            }
            limitations.push('Minimum 4-second visibility required for counting');
        }
        
        limitations.push('Model accuracy affected by viewing angle, occlusion, and movement');
        
        summaryItems.push({
            icon: 'ℹ️',
            title: 'System Notes',
            text: limitations.join('. ') + '.',
            severity: 'info'
        });
    }
    
    summaryContent.innerHTML = summaryItems.map(item => {
        const severityClass = item.severity ? `severity-${item.severity}` : '';
        return `
            <div class="summary-item ${severityClass}">
                <div class="summary-item-header">
                    <div class="summary-item-icon">${item.icon}</div>
                    <div class="summary-item-title">${item.title}</div>
                </div>
                <div class="summary-item-text">${item.text}</div>
            </div>
        `;
    }).join('');
}

newAnalysisBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    currentFile = null;
    isVideo = false;
    fileInput.value = '';
    previewContainer.style.display = 'none';
    previewMedia.innerHTML = '';
    resultsSection.style.display = 'none';
    uploadSection.style.display = 'block';
    
    // Clear alert states
    const outputPanel = document.querySelector('.output-panel');
    outputPanel.classList.remove('violation-border');
    alertBadge.style.display = 'none';
    alertBadge.classList.remove('pulse');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('load', () => {
    document.querySelectorAll('.hero, .upload-section').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        setTimeout(() => {
            el.style.transition = 'all 0.8s ease-out';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 200);
    });
});