// New Route A Step Functions

// Content Review Functions
async function loadContentReview() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}`);
        const data = await response.json();

        const extractedContent = data.data.extractedContent;
        if (extractedContent) {
            // Show first 2000 characters
            const preview = extractedContent.substring(0, 2000) + (extractedContent.length > 2000 ? '\n\n... (content continues)' : '');
            document.getElementById('content-preview').textContent = preview;
        }
    } catch (error) {
        console.error('Error loading content:', error);
    }
}

async function approveContent() {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/content/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Content approved! Generating learning approaches...', 'success');
            // Load approaches for selection
            await loadApproaches();
            setTimeout(() => showStep(data.nextStep), 2000);
        } else {
            showMessage(data.error || 'Error approving content', 'error');
        }
    } catch (error) {
        console.error('Error approving content:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function rejectContent() {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        await fetch(`/api/workflow/${currentSessionId}/content/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        showMessage('Please re-upload your files', 'success');
        showStep('route_a_upload');
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Approach Selection Functions
async function loadApproaches() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/approaches/generate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            displayApproaches(data.approaches);
        }
    } catch (error) {
        console.error('Error loading approaches:', error);
    }
}

function displayApproaches(approaches) {
    const container = document.getElementById('approaches-list-a');

    let html = '';
    approaches.forEach(approach => {
        html += `
            <div style="border: 2px solid #e1e5e9; padding: 20px; margin: 15px 0; border-radius: 8px; cursor: pointer; transition: all 0.3s;"
                 onclick="selectApproachA('${approach.id}')"
                 onmouseover="this.style.borderColor='#667eea'"
                 onmouseout="this.style.borderColor='#e1e5e9'">
                <h4 style="color: #667eea; margin-bottom: 10px;">${approach.name}</h4>
                <p style="margin-bottom: 10px;">${approach.description}</p>
                <p><strong>Best for:</strong> ${approach.bestFor.join(', ')}</p>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function selectApproachA(approachId) {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/approach/select`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approach: approachId })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Approach selected! Generating learning arc...', 'success');
            // Automatically generate arc
            await generateArc();
        } else {
            showMessage(data.error || 'Error selecting approach', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Arc Generation Functions
async function generateArc() {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/arc/generate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            displayArc(data.arc);
            showMessage('Learning arc generated!', 'success');
            setTimeout(() => showStep(data.nextStep), 2000);
        } else {
            showMessage(data.error || 'Error generating arc', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayArc(arc) {
    const container = document.getElementById('arc-display');

    let html = `
        <h3 style="color: #667eea; margin-bottom: 15px;">${arc.title}</h3>
        <p style="margin-bottom: 20px;"><strong>Narrative Thread:</strong> ${arc.narrative}</p>

        <h4 style="margin-top: 20px; margin-bottom: 10px;">Learning Progression:</h4>
    `;

    arc.progression.forEach((stage, index) => {
        html += `
            <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                <strong style="color: #667eea;">Stage ${index + 1}: ${stage.phase}</strong>
                <p style="margin-top: 5px;">${stage.focus}</p>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function approveArc() {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        const feedback = document.getElementById('arc-feedback').value;

        const response = await fetch(`/api/workflow/${currentSessionId}/arc/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Arc approved! Ready to generate program matrix.', 'success');
            setTimeout(() => showStep(data.nextStep), 2000);
        } else {
            showMessage(data.error || 'Error', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function reviseArc() {
    if (!currentSessionId) return;

    const feedback = document.getElementById('arc-feedback').value;
    if (!feedback) {
        showMessage('Please provide feedback for changes', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/arc/regenerate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback })
        });

        const data = await response.json();

        if (response.ok) {
            displayArc(data.arc);
            document.getElementById('arc-feedback').value = '';
            showMessage('Arc updated!', 'success');
        } else {
            showMessage(data.error || 'Error', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Helper functions for auto-loading data when navigating to steps
async function loadApproachesIfNeeded() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}`);
        const apiData = await response.json();

        // Check if approaches already exist in session data
        if (apiData.data && apiData.data.generatedApproaches) {
            displayApproaches(apiData.data.generatedApproaches);
        } else {
            // Generate approaches if they don't exist
            showMessage('Generating learning approaches...', 'success');
            await loadApproaches();
        }
    } catch (error) {
        console.error('Error loading approaches:', error);
    }
}

async function loadArcIfNeeded() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}`);
        const apiData = await response.json();

        // Check if arc already exists in session data
        if (apiData.data && apiData.data.learningArc) {
            displayArc(apiData.data.learningArc);
        }
    } catch (error) {
        console.error('Error loading arc:', error);
    }
}

async function loadMatrixIfNeeded() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}`);
        const apiData = await response.json();

        // Check if matrix already exists in session data
        if (apiData.data && apiData.data.programMatrix) {
            displayMatrix(apiData.data.programMatrix);
        }
    } catch (error) {
        console.error('Error loading matrix:', error);
    }
}

async function loadSampleIfNeeded() {
    if (!currentSessionId) return;

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}`);
        const apiData = await response.json();

        // Check if sample already exists in session data
        if (apiData.data && apiData.data.sampleContent) {
            displaySampleContent(apiData.data.sampleContent);
        }
    } catch (error) {
        console.error('Error loading sample:', error);
    }
}

// Sample Generation Functions
async function generateSample() {
    if (!currentSessionId) return;

    document.getElementById('sample-loading').style.display = 'block';
    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/sample/generate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            displaySampleContent(data.sample);
            showMessage('Sample generated!', 'success');
            setTimeout(() => showStep(data.nextStep), 2000);
        } else {
            showMessage(data.error || 'Error generating sample', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
        document.getElementById('sample-loading').style.display = 'none';
    }
}

function displaySampleContent(sample) {
    const container = document.getElementById('sample-content-display');

    let html = `
        <div style="border: 2px solid #667eea; padding: 25px; border-radius: 8px; background: white;">
            <h3 style="color: #667eea; margin-bottom: 20px;">${sample.article.title}</h3>

            <div style="margin-bottom: 30px;">
                <h4>Article Content:</h4>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-top: 10px; max-height: 400px; overflow-y: auto;">
                    ${sample.article.content.replace(/\n/g, '<br>')}
                </div>
            </div>

            <div>
                <h4>Quiz Questions:</h4>
    `;

    sample.quiz.questions.forEach((q, index) => {
        html += `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <p><strong>Q${index + 1}: ${q.question}</strong></p>
                <ul style="margin: 10px 0 0 20px;">
                    ${q.options.map((opt, i) => `
                        <li style="color: ${i === q.correctIndex ? '#28a745' : 'inherit'};">
                            ${opt} ${i === q.correctIndex ? '✓' : ''}
                        </li>
                    `).join('')}
                </ul>
                <p style="margin-top: 10px; font-size: 0.9rem; color: #666;"><em>Explanation: ${q.explanation}</em></p>
            </div>
        `;
    });

    html += '</div></div>';
    container.innerHTML = html;
}

async function approveSample() {
    if (!currentSessionId) return;

    showLoading(true);

    try {
        const feedback = document.getElementById('sample-feedback').value;

        const response = await fetch(`/api/workflow/${currentSessionId}/sample/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Sample approved! Ready for batch generation.', 'success');
            setTimeout(() => showStep(data.nextStep), 2000);
        } else {
            showMessage(data.error || 'Error', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function reviseSample() {
    if (!currentSessionId) return;

    const feedback = document.getElementById('sample-feedback').value;
    if (!feedback) {
        showMessage('Please provide feedback for changes', 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`/api/workflow/${currentSessionId}/sample/regenerate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedback })
        });

        const data = await response.json();

        if (response.ok) {
            displaySampleContent(data.sample);
            document.getElementById('sample-feedback').value = '';
            showMessage('Sample updated!', 'success');
        } else {
            showMessage(data.error || 'Error', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}
