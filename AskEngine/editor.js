// AskEngine Question Editor JavaScript

// Global variables
let questions = [];
let currentQuestionIndex = -1;
let currentLanguage = 'en';
let ruleset = null;
let availableModifiers = [];
let currentModifierAnswerIndex = -1;
let modifierValues = {};

// Debug information function
function debugInfo() {
    console.log('=== DEBUG INFO ===');
    console.log('window.Questions exists:', !!window.Questions);
    console.log('window.Questions is array:', Array.isArray(window.Questions));
    console.log('window.Questions length:', window.Questions ? window.Questions.length : 'N/A');
    console.log('window.Ruleset exists:', !!window.Ruleset);
    console.log('window.Ruleset type:', typeof window.Ruleset);
    console.log('Local questions array length:', questions.length);
    console.log('Current question index:', currentQuestionIndex);
    console.log('Ruleset loaded:', !!ruleset);
    console.log('Available modifiers:', availableModifiers.length);
}

function loadQuestions() {
    try {
        console.log('Loading questions...');
        console.log('window.Questions available:', !!window.Questions);
        console.log('getLocalizedQuestions available:', !!window.getLocalizedQuestions);
        
        if (typeof getLocalizedQuestions !== 'undefined') {
            const localizedQuestions = getLocalizedQuestions('en');
            questions = localizedQuestions.map((q, index) => ({
                text: q.text,
                text_DE: window.Questions[index].text_DE || '',
                answers: q.answers.map((a, aIndex) => ({
                    text: a.text,
                    text_DE: window.Questions[index].answers[aIndex].text_DE || '',
                    modifiers: a.modifiers
                })),
                allowMultipleAnswers: window.Questions[index].allowMultipleAnswers || false
            }));
            console.log('Questions loaded via getLocalizedQuestions:', questions.length);
        } else if (window.Questions && Array.isArray(window.Questions)) {
            questions = window.Questions.map(q => ({
                text: q.text,
                text_DE: q.text_DE || '',
                answers: q.answers.map(a => ({
                    text: a.text,
                    text_DE: a.text_DE || '',
                    modifiers: a.modifiers
                })),
                allowMultipleAnswers: q.allowMultipleAnswers || false
            }));
            console.log('Questions loaded from window.Questions:', questions.length);
        } else {
            console.error('No questions data available');
            showStatus('No questions data found. Make sure questions.js is loaded correctly.', 'error');
            return;
        }
        
        renderQuestionList();
        if (questions.length > 0) {
            selectQuestion(0);
        }
        
        showStatus(`Loaded ${questions.length} questions successfully!`, 'success');
    } catch (error) {
        console.error('Error loading questions:', error);
        showStatus('Error loading questions: ' + error.message, 'error');
    }
}

function loadRuleset() {
    try {
        console.log('Loading ruleset, window.Ruleset exists:', !!window.Ruleset);
        console.log('window.Ruleset type:', typeof window.Ruleset);
        console.log('window.Ruleset content:', window.Ruleset);
        
        if (window.Ruleset && typeof window.Ruleset === 'object') {
            ruleset = window.Ruleset;
            console.log('Ruleset assigned, checking attributes...');
            console.log('Ruleset.attributes exists:', !!ruleset.attributes);
            console.log('Ruleset.attributes content:', ruleset.attributes);
            
            extractAvailableModifiers();
            console.log('After extraction, available modifiers:', availableModifiers.length);
            console.log('Available modifiers list:', availableModifiers);
            
            showStatus(`Ruleset loaded successfully! Found ${availableModifiers.length} modifiers`, 'success');
        } else if (window.Ruleset) {
            console.error('Ruleset exists but is not an object:', typeof window.Ruleset);
            showStatus('Ruleset data is invalid format. Check ruleset.js file.', 'error');
        } else {
            console.error('window.Ruleset is not available');
            showStatus('Ruleset not found. Make sure ruleset.js is loaded correctly.', 'error');
        }
    } catch (error) {
        console.error('Error loading ruleset:', error);
        showStatus('Error loading ruleset: ' + error.message, 'error');
    }
}

function extractAvailableModifiers() {
    if (!ruleset || !ruleset.attributes) {
        console.warn('No ruleset or attributes available for modifier extraction');
        return;
    }
    
    availableModifiers = Object.keys(ruleset.attributes).map(key => ({
        key: key,
        name: ruleset.attributes[key].name,
        category: ruleset.attributes[key].category
    }));
    
    console.log('Extracted modifiers:', availableModifiers);
}

function reloadScripts() {
    showStatus('Reloading scripts...', 'success');
    
    // Clear existing data
    window.Questions = undefined;
    window.Ruleset = undefined;
    questions = [];
    
    // Since scripts are loaded via HTML script tags, just re-initialize
    setTimeout(() => {
        console.log('Scripts reloaded, Questions available:', !!window.Questions);
        console.log('Ruleset available:', !!window.Ruleset);
        loadRuleset();
        loadQuestions();
    }, 100);
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 3000);
}

function renderQuestionList() {
    console.log('renderQuestionList called, questions.length:', questions.length);
    const sidebar = document.getElementById('questionSidebar');
    sidebar.innerHTML = '';
    
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.onclick = () => selectQuestion(index);
        
        const text = q.text || 'Untitled Question';
        item.innerHTML = `
            <div>Q${index + 1}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</div>
            <small>${q.answers?.length || 0} answers</small>
            <button class="remove-btn" onclick="event.stopPropagation(); removeQuestion(${index})">×</button>
        `;
        
        sidebar.appendChild(item);
    });
}

function selectQuestion(index) {
    console.log('selectQuestion called with index:', index);
    
    // Update active question styling
    document.querySelectorAll('.question-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
    
    currentQuestionIndex = index;
    
    if (index >= 0 && index < questions.length) {
        renderQuestionEditor(questions[index]);
    }
}

function renderQuestionEditor(question) {
    console.log('renderQuestionEditor called with question:', question);
    
    // Load question text
    document.getElementById('questionText').value = question.text || '';
    document.getElementById('questionTextDE').value = question.text_DE || '';
    
    // Load multiple answers checkbox
    document.getElementById('multipleAnswersCheckbox').checked = question.allowMultipleAnswers || false;
    
    // Load answers
    renderAnswerList(question.answers || []);
}

function renderAnswerList(answers) {
    console.log('renderAnswerList called with', answers.length, 'answers');
    const answerList = document.getElementById('answerList');
    answerList.innerHTML = '';
    
    answers.forEach((answer, index) => {
        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-item';
        answerDiv.innerHTML = `
            <div class="answer-header">
                <strong>Answer ${index + 1}</strong>
                <button class="remove-btn" onclick="removeAnswer(${index})">Remove</button>
            </div>
            
            <!-- Invariant answer text -->
            <div class="form-group">
                <label>Answer Text (Invariant/English):</label>
                <input type="text" value="${answer.text || ''}" 
                       onchange="updateAnswerText(${index}, this.value)">
            </div>
            
            <!-- German answer text -->
            <div class="language-sections">
                <div class="language-section">
                    <div class="language-header" onclick="toggleAnswerLanguageSection(this)">
                        <span>🇩🇪 German Answer</span>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div class="language-content">
                        <div class="form-group">
                            <label>German Answer Text:</label>
                            <input type="text" value="${answer.text_DE || ''}" 
                                   onchange="updateAnswerTextDE(${index}, this.value)">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Modifier string -->
            <div class="form-group">
                <label>Modifier String:</label>
                <div class="modifier-input-group">
                    <input type="text" value="${answer.modifiers || ''}" 
                           onchange="updateAnswerModifiers(${index}, this.value)">
                    <button class="modifier-builder-btn" onclick="openModifierBuilder(${index})">
                        🎯 Builder
                    </button>
                </div>
                <div class="modifier-hints">
                    <small>Format: RACE_HUMAN:+2 CLASS_WIZARD:+1 CLASS_FIGHTER:-1</small>
                </div>
            </div>
        `;
        
        answerList.appendChild(answerDiv);
    });
}

function addAnswer() {
    if (currentQuestionIndex >= 0) {
        const question = questions[currentQuestionIndex];
        if (!question.answers) question.answers = [];
        
        question.answers.push({
            text: '',
            text_DE: '',
            modifiers: ''
        });
        
        renderAnswerList(question.answers);
        renderQuestionList(); // Update sidebar to show new answer count
    }
}

function removeAnswer(answerIndex) {
    if (currentQuestionIndex >= 0 && questions[currentQuestionIndex].answers) {
        questions[currentQuestionIndex].answers.splice(answerIndex, 1);
        renderAnswerList(questions[currentQuestionIndex].answers);
        renderQuestionList(); // Update sidebar
    }
}

function updateAnswerText(answerIndex, text) {
    if (currentQuestionIndex >= 0 && questions[currentQuestionIndex].answers) {
        questions[currentQuestionIndex].answers[answerIndex].text = text;
    }
}

function updateAnswerTextDE(answerIndex, text) {
    if (currentQuestionIndex >= 0 && questions[currentQuestionIndex].answers) {
        questions[currentQuestionIndex].answers[answerIndex].text_DE = text;
    }
}

function updateAnswerModifiers(answerIndex, modifiers) {
    if (currentQuestionIndex >= 0 && questions[currentQuestionIndex].answers) {
        questions[currentQuestionIndex].answers[answerIndex].modifiers = modifiers;
    }
}

function addNewQuestion() {
    const newQuestion = {
        text: 'New Question',
        text_DE: '',
        answers: [{
            text: 'Answer option 1',
            text_DE: '',
            modifiers: ''
        }],
        allowMultipleAnswers: false
    };
    
    questions.push(newQuestion);
    renderQuestionList();
    selectQuestion(questions.length - 1);
    showStatus('New question added!', 'success');
}

function removeQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        questions.splice(index, 1);
        renderQuestionList();
        
        // Adjust current selection
        if (currentQuestionIndex >= questions.length) {
            currentQuestionIndex = questions.length - 1;
        }
        if (currentQuestionIndex >= 0) {
            selectQuestion(currentQuestionIndex);
        } else {
            document.getElementById('questionEditor').innerHTML = '<p>No questions available. Add a new question to get started.</p>';
        }
        
        showStatus('Question deleted!', 'success');
    }
}

function toggleLanguageSection(lang) {
    const content = document.getElementById(lang + 'Content');
    const icon = content.previousElementSibling.querySelector('.toggle-icon');
    
    content.classList.toggle('expanded');
    icon.classList.toggle('expanded');
}

function toggleAnswerLanguageSection(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    content.classList.toggle('expanded');
    icon.classList.toggle('expanded');
}

function updateQuestionMultipleAnswers(allowed) {
    if (currentQuestionIndex >= 0) {
        questions[currentQuestionIndex].allowMultipleAnswers = allowed;
    }
}

function switchLanguage(lang) {
    currentLanguage = lang;
    
    // Update tab styling
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.toLowerCase().includes(lang));
    });
    
    exportQuestions();
}

function exportQuestions() {
    if (questions.length === 0) {
        document.getElementById('codeOutput').textContent = '// No questions to export';
        return;
    }
    
    let code = 'const Questions = [\n';
    
    questions.forEach((q, index) => {
        code += '  {\n';
        
        if (currentLanguage === 'en') {
            if (q.text) {
                code += `    text: '${q.text.replace(/'/g, "\\'")}',\n`;
            } else {
                code += `    text: 'Invariant question text',\n`;
                code += `    text_${currentLanguage}: '${q.text.replace(/'/g, "\\'")}',\n`;
            }
            if (q.allowMultipleAnswers) {
                code += `    allowMultipleAnswers: true,\n`;
            }
            code += '    answers: [\n';
            
            q.answers?.forEach((a, aIndex) => {
                code += '      {\n';
                code += `        text: '${(a.text || '').replace(/'/g, "\\'")}',\n`;
                if (a.text_DE) {
                    code += `        text_DE: '${a.text_DE.replace(/'/g, "\\'")}',\n`;
                }
                if (a.modifiers) {
                    code += `        modifiers: '${a.modifiers}'\n`;
                }
                code += '      }' + (aIndex < q.answers.length - 1 ? ',' : '') + '\n';
            });
        } else {
            // German export
            code += `    text: '${(q.text || '').replace(/'/g, "\\'")}',\n`;
            code += `    text_DE: '${(q.text_DE || '').replace(/'/g, "\\'")}',\n`;
            if (q.allowMultipleAnswers) {
                code += `    allowMultipleAnswers: true,\n`;
            }
            code += '    answers: [\n';
            
            q.answers?.forEach((a, aIndex) => {
                code += '      {\n';
                code += `        text: '${(a.text || '').replace(/'/g, "\\'")}',\n`;
                code += `        text_DE: '${(a.text_DE || '').replace(/'/g, "\\'")}',\n`;
                if (a.modifiers) {
                    code += `        modifiers: '${a.modifiers}'\n`;
                }
                code += '      }' + (aIndex < q.answers.length - 1 ? ',' : '') + '\n';
            });
        }
        
        code += '    ]\n';
        code += '  }' + (index < questions.length - 1 ? ',' : '') + '\n';
    });
    
    code += '];';
    
    document.getElementById('codeOutput').textContent = code;
}

function saveToFile() {
    const code = document.getElementById('codeOutput').textContent;
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_${currentLanguage}.js`;
    a.click();
    URL.revokeObjectURL(url);
    
    showStatus(`Questions exported to questions_${currentLanguage}.js`, 'success');
}

function copyToClipboard() {
    const code = document.getElementById('codeOutput').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showStatus('Code copied to clipboard!', 'success');
    }).catch(err => {
        showStatus('Failed to copy to clipboard', 'error');
    });
}

// Modifier Builder Functions
function openModifierBuilder(answerIndex) {
    console.log('Opening modifier builder for answer index:', answerIndex);
    
    if (availableModifiers.length === 0) {
        showStatus('No ruleset loaded. Cannot open modifier builder.', 'error');
        return;
    }
    
    currentModifierAnswerIndex = answerIndex;
    
    // Parse existing modifiers
    const currentModifiers = questions[currentQuestionIndex].answers[answerIndex].modifiers || '';
    modifierValues = {};
    
    // Initialize all values to 0
    availableModifiers.forEach(mod => {
        modifierValues[mod.key] = 0;
    });
    
    // Parse existing modifier string
    if (currentModifiers) {
        const parts = currentModifiers.split(' ');
        parts.forEach(part => {
            const [key, value] = part.split(':');
            if (key && value) {
                modifierValues[key] = parseInt(value) || 0;
            }
        });
    }
    
    renderModifierGrid();
    
    const modal = document.getElementById('modifierModal');
    if (modal) {
        modal.style.display = 'block';
        console.log('Modal should now be visible');
    } else {
        console.error('Modal element not found');
    }
}

function renderModifierGrid() {
    const grid = document.getElementById('modifierGrid');
    grid.innerHTML = '';
    
    // Add header row
    const header = document.createElement('div');
    header.className = 'modifier-item';
    header.innerHTML = `
        <div class="modifier-name" style="font-weight: bold;">Attribute</div>
        <div style="text-align: center; font-weight: bold;">-</div>
        <div style="text-align: center; font-weight: bold;">Value</div>
        <div style="text-align: center; font-weight: bold;">+</div>
    `;
    header.style.display = 'contents';
    grid.appendChild(header);
    
    // Group modifiers by category
    const groupedModifiers = {};
    availableModifiers.forEach(mod => {
        if (!groupedModifiers[mod.category]) {
            groupedModifiers[mod.category] = [];
        }
        groupedModifiers[mod.category].push(mod);
    });
    
    // Render each category
    Object.keys(groupedModifiers).forEach(category => {
        groupedModifiers[category].forEach(mod => {
            const item = document.createElement('div');
            item.className = 'modifier-item';
            item.innerHTML = `
                <div class="modifier-name">${mod.name}</div>
                <button class="modifier-btn" onclick="adjustModifier('${mod.key}', -1)">-</button>
                <div class="modifier-value" id="value-${mod.key}">${modifierValues[mod.key]}</div>
                <button class="modifier-btn" onclick="adjustModifier('${mod.key}', 1)">+</button>
            `;
            item.style.display = 'contents';
            grid.appendChild(item);
        });
    });
}

function adjustModifier(key, delta) {
    modifierValues[key] += delta;
    document.getElementById(`value-${key}`).textContent = modifierValues[key];
}

function closeModifierBuilder() {
    document.getElementById('modifierModal').style.display = 'none';
    currentModifierAnswerIndex = -1;
}

function cancelModifierBuilder() {
    closeModifierBuilder();
}

function applyModifierBuilder() {
    // Build modifier string from current values
    const modifierParts = [];
    Object.keys(modifierValues).forEach(key => {
        const value = modifierValues[key];
        if (value !== 0) {
            modifierParts.push(`${key}:${value > 0 ? '+' : ''}${value}`);
        }
    });
    
    const modifierString = modifierParts.join(' ');
    
    // Update the answer
    if (currentQuestionIndex >= 0 && currentModifierAnswerIndex >= 0) {
        questions[currentQuestionIndex].answers[currentModifierAnswerIndex].modifiers = modifierString;
        
        // Update the UI
        renderAnswerList(questions[currentQuestionIndex].answers);
        
        showStatus('Modifier string updated!', 'success');
    }
    
    closeModifierBuilder();
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing editor...');
    
    // Scripts are already loaded via HTML <script> tags, just initialize
    console.log('Scripts available - Questions:', !!window.Questions, 'Ruleset:', !!window.Ruleset);
    loadRuleset();
    loadQuestions();
    
    // Set up event listeners for question text changes
    document.getElementById('questionText').addEventListener('change', function() {
        if (currentQuestionIndex >= 0) {
            questions[currentQuestionIndex].text = this.value;
            renderQuestionList(); // Update sidebar
        }
    });

    document.getElementById('questionTextDE').addEventListener('change', function() {
        if (currentQuestionIndex >= 0) {
            questions[currentQuestionIndex].text_DE = this.value;
        }
    });
});