/**
 * Modern Generic Questionnaire Application
 * Updated to use string templates, auto-advance, and new question system
 * Can be used for any type of questionnaire with appropriate ruleset and questions
 */

class QuestionnaireApp {
    constructor() {
        this.currentQuestionIndex = 0;
        this.totalQuestions = 0;
        this.selectedAnswers = new Map(); // For single answers: questionIndex -> answerId
        this.multipleSelectedAnswers = new Map(); // For multiple answers: questionIndex -> Set of answerIds
        this.questions = [];
        this.isInitialized = false;
        this.currentLanguage = 'en';
        this.strings = null;
        this.ruleset = null;
        this.autoAdvanceDelay = 1200; // ms delay before auto-advancing
        this.answerTransitionDelay = 400; // ms delay for answer loading (was 800)
        
        // Randomization settings (will be overridden by ruleset)
        this.settings = {
            randomizeQuestions: false,
            randomizeAnswers: false,
            allowSkipQuestions: true,
            autoAdvanceDelay: 1200,
            showProgressBar: true,
            allowMultipleAnswers: false
        };
        
        // Initialize after DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    async init() {
        console.log('🎲 Initializing Questionnaire App...');
        
        // Initialize localization first
        this.initializeLocalization();
        
        // Load string resources and ruleset
        await this.loadStrings();
        await this.loadRuleset();
        
        // Show loading screen
        this.showLoadingScreen();
        
        // Load questions based on language
        await this.loadQuestions();
        
        // Apply localization to UI
        this.updateUIText();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Hide loading screen and show welcome
        setTimeout(() => {
            this.hideLoadingScreen();
            this.showWelcomeScreen();
        }, 2000);
        
        this.isInitialized = true;
        console.log('✅ App initialized successfully!');
    }
    
    initializeLocalization() {
        // Detect user's preferred language
        const userLang = navigator.language || navigator.userLanguage;
        this.currentLanguage = userLang.startsWith('de') ? 'de' : 'en';
        console.log(`🌍 Language detected: ${this.currentLanguage}`);
    }
    
    async loadStrings() {
        // Load unified string file
        if (typeof Strings !== 'undefined') {
            // Use the unified strings with language-aware methods
            this.strings = Strings.getAllForLanguage ? 
                Strings.getAllForLanguage(this.currentLanguage) : 
                Strings;
            console.log(`📝 Loaded unified strings for language: ${this.currentLanguage}`);
        } else {
            console.error('No string resources found. Please include Strings.js file.');
            throw new Error('String resources are required to run the application.');
        }
    }
    
    async loadRuleset() {
        // Load unified ruleset
        if (typeof Ruleset !== 'undefined') {
            this.ruleset = Ruleset;
            console.log(`🎲 Loaded unified ruleset for language: ${this.currentLanguage}`);
            
            // Apply settings from ruleset
            this.applyRulesetSettings();
        } else {
            console.error('No ruleset found. Please include ruleset.js file.');
            throw new Error('Ruleset is required to run the application.');
        }
    }
    
    applyRulesetSettings() {
        if (!this.ruleset || !this.ruleset.settings) return;
        
        const rulesetSettings = this.ruleset.settings;
        
        // Apply randomization settings
        if (rulesetSettings.allowRandomizeQuestions !== undefined) {
            this.settings.randomizeQuestions = rulesetSettings.allowRandomizeQuestions && this.settings.randomizeQuestions;
        }
        if (rulesetSettings.allowRandomizeAnswers !== undefined) {
            this.settings.randomizeAnswers = rulesetSettings.allowRandomizeAnswers && this.settings.randomizeAnswers;
        }
        
        // Apply navigation settings
        if (rulesetSettings.allowSkipQuestions !== undefined) {
            this.settings.allowSkipQuestions = rulesetSettings.allowSkipQuestions;
        }
        if (rulesetSettings.autoAdvanceDelay !== undefined) {
            this.autoAdvanceDelay = rulesetSettings.autoAdvanceDelay;
            this.settings.autoAdvanceDelay = rulesetSettings.autoAdvanceDelay;
        }
        if (rulesetSettings.showProgressBar !== undefined) {
            this.settings.showProgressBar = rulesetSettings.showProgressBar;
        }
        if (rulesetSettings.allowMultipleAnswers !== undefined) {
            this.settings.allowMultipleAnswers = rulesetSettings.allowMultipleAnswers;
        }
        
        console.log('🎛️ Applied ruleset settings:', this.settings);
    }
    
    async loadQuestions() {
        // Load unified questions file
        try {
            if (typeof getLocalizedQuestions !== 'undefined') {
                // Use the helper function to get localized questions
                const localizedQuestions = getLocalizedQuestions(this.currentLanguage);
                this.questions = localizedQuestions.map((q, index) => ({
                    id: index,
                    text: q.text,
                    answers: q.answers.map((a, answerIndex) => ({
                        id: answerIndex,
                        text: a.text,
                        modifiers: a.modifiers
                    }))
                }));
            } else if (typeof Questions !== 'undefined') {
                // Fallback to direct Questions array
                this.questions = Questions.map((q, index) => ({
                    id: index,
                    text: this.currentLanguage === 'de' && q.text_DE ? q.text_DE : q.text,
                    answers: q.answers.map((a, answerIndex) => ({
                        id: answerIndex,
                        text: this.currentLanguage === 'de' && a.text_DE ? a.text_DE : a.text,
                        modifiers: a.modifiers
                    }))
                }));
            } else {
                throw new Error('No questions found. Please include questions.js file.');
            }
            
            this.totalQuestions = this.questions.length;
            console.log(`📋 Loaded ${this.totalQuestions} unified questions for language: ${this.currentLanguage}`);
            
            // Apply randomization if enabled
            this.applyRandomization();
            
        } catch (error) {
            console.error('Could not load questions:', error);
            throw new Error('Questions are required to run the application.');
        }
    }
    
    // Randomization methods
    applyRandomization() {
        if (this.settings.randomizeQuestions) {
            this.shuffleArray(this.questions);
            // Re-map question IDs to maintain proper indexing
            this.questions.forEach((q, index) => {
                q.id = index;
            });
            console.log('🎲 Questions randomized');
        }
        
        if (this.settings.randomizeAnswers) {
            this.questions.forEach(question => {
                this.shuffleArray(question.answers);
                // Re-map answer IDs to maintain proper indexing
                question.answers.forEach((a, index) => {
                    a.id = index;
                });
            });
            console.log('🎲 Answers randomized');
        }
    }
    
    shuffleArray(array) {
        // Fisher-Yates shuffle algorithm
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    // Method to toggle randomization settings
    toggleRandomization(type, enabled) {
        if (type === 'questions') {
            this.settings.randomizeQuestions = enabled;
        } else if (type === 'answers') {
            this.settings.randomizeAnswers = enabled;
        }
        console.log(`🎲 Randomization ${type}: ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // This method should not be used - ruleset must be provided
    getDefaultRuleset() {
        throw new Error('No default ruleset available. Please provide a proper Ruleset_*.js file.');
    }
    
    // This method should not be used - questions must be provided
    getDefaultQuestions() {
        throw new Error('No default questions available. Please provide a proper Questions_*.js file.');
    }
    
    // Template string formatting function
    formatString(template, values) {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            return values[key] !== undefined ? values[key] : match;
        });
    }
    
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
        
        // Update loading text
        const loadingTitle = document.querySelector('.loading-content h2');
        const loadingSubtitle = document.querySelector('.loading-content p');
        
        if (loadingTitle && this.strings?.loading?.title) {
            loadingTitle.textContent = this.strings.loading.title;
        }
        if (loadingSubtitle && this.strings?.loading?.subtitle) {
            loadingSubtitle.textContent = this.strings.loading.subtitle;
        }
        
        // Animate dice rotation
        const dice = document.querySelector('.dice');
        if (dice) {
            const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            let currentFace = 0;
            
            const rollAnimation = setInterval(() => {
                dice.textContent = faces[currentFace];
                currentFace = (currentFace + 1) % faces.length;
            }, 200);
            
            setTimeout(() => {
                clearInterval(rollAnimation);
                dice.textContent = '⚅'; // Lucky 6!
            }, 1800);
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        if (mainApp) {
            mainApp.style.display = 'flex';
        }
    }
    
    updateUIText() {
        console.log(`🔤 Updating UI text for language: ${this.currentLanguage}`);
        
        if (!this.strings) return;
        
        // Update header brand
        const brand = document.querySelector('.brand');
        if (brand && this.strings?.navigation?.brand) {
            brand.textContent = this.strings.navigation.brand;
        }
        
        const subtitle = document.querySelector('.subtitle');
        if (subtitle && this.strings?.navigation?.subtitle) {
            subtitle.textContent = this.strings.navigation.subtitle;
        }
        
        // Update welcome screen
        const welcomeTitle = document.querySelector('#welcomeScreen h2');
        if (welcomeTitle && this.strings?.welcome?.title) {
            welcomeTitle.textContent = this.strings.welcome.title;
        }
        
        const welcomeDesc = document.querySelector('#welcomeScreen .welcome-card p');
        if (welcomeDesc && this.strings?.welcome?.description) {
            welcomeDesc.textContent = this.strings.welcome.description;
        }
        
        const startButton = document.getElementById('startButton');
        if (startButton && this.strings?.welcome?.startButton) {
            const span = startButton.querySelector('span');
            if (span) span.textContent = this.strings.welcome.startButton;
        }
        
        // Update feature list
        const features = this.strings.welcome?.features;
        if (features) {
            const featureElements = document.querySelectorAll('.feature-item');
            features.forEach((feature, index) => {
                if (featureElements[index]) {
                    const iconEl = featureElements[index].querySelector('.feature-icon');
                    const textEl = featureElements[index].querySelector('span:last-child');
                    if (iconEl) iconEl.textContent = feature.icon;
                    if (textEl) textEl.textContent = feature.text;
                }
            });
        }
        
        // Update results screen
        const resultsTitle = document.querySelector('#resultsScreen .results-header h2');
        if (resultsTitle && this.strings?.results?.title) {
            resultsTitle.textContent = this.strings.results.title;
        }
        
        const resultsDesc = document.querySelector('#resultsScreen .results-header p');
        if (resultsDesc && this.strings?.results?.subtitle) {
            resultsDesc.textContent = this.strings.results.subtitle;
        }
    }
    
    setupEventListeners() {
        // Start button
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', () => this.startQuestionnaire());
        }
        
        // Navigation buttons
        const prevButton = document.getElementById('prevButton');
        const nextButton = document.getElementById('nextButton');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => this.previousQuestion());
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => this.nextQuestion());
        }
        
        // Results actions
        const restartButton = document.getElementById('restartButton');
        const shareButton = document.getElementById('shareButton');
        
        if (restartButton) {
            restartButton.addEventListener('click', () => this.restartApp());
        }
        
        if (shareButton) {
            shareButton.addEventListener('click', () => this.shareResults());
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    }
    
    showWelcomeScreen() {
        this.hideAllScreens();
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'block';
        }
        this.updateProgressBar(0, 0);
    }
    
    startQuestionnaire() {
        this.currentQuestionIndex = 0;
        this.selectedAnswers.clear();
        
        this.hideAllScreens();
        this.showQuestionScreen();
        this.displayCurrentQuestion();
        
        this.animateTransition();
    }
    
    showQuestionScreen() {
        const questionScreen = document.getElementById('questionScreen');
        if (questionScreen) {
            questionScreen.style.display = 'block';
        }
    }
    
    hideAllScreens() {
        const screens = ['welcomeScreen', 'questionScreen', 'resultsScreen'];
        screens.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) {
                screen.style.display = 'none';
            }
        });
    }
    
    displayCurrentQuestion() {
        // Only show results after ALL questions are answered
        const totalAnswered = this.selectedAnswers.size + this.multipleSelectedAnswers.size;
        if (totalAnswered >= this.questions.length) {
            this.showResults();
            return;
        }
        
        if (this.currentQuestionIndex >= this.questions.length) {
            // If we've gone past the last question but not all are answered, go back
            this.currentQuestionIndex = this.questions.length - 1;
        }
        
        const question = this.questions[this.currentQuestionIndex];
        
        // Update question number and text
        const questionNum = document.getElementById('currentQuestionNum');
        const questionText = document.getElementById('questionText');
        
        if (questionNum) {
            questionNum.textContent = this.currentQuestionIndex + 1;
        }
        
        if (questionText) {
            // Handle HTML tags in questions properly
            questionText.innerHTML = question.text;
        }
        
        // Update progress
        this.updateProgressBar(this.currentQuestionIndex + 1, this.totalQuestions);
        
        // Display answers
        this.displayAnswers(question.answers);
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Animate question entrance
        this.animateQuestionEntrance();
    }
    
    displayAnswers(answers) {
        const container = document.getElementById('answersContainer');
        if (!container) return;
        
        // Remove transitioning class and clear content
        container.classList.remove('transitioning');
        container.innerHTML = '';
        
        // Force a reflow to ensure the class removal takes effect
        container.offsetHeight;
        
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const isMultipleAnswers = currentQuestion.allowMultipleAnswers || false;
        
        answers.forEach((answer, index) => {
            const answerElement = document.createElement('div');
            answerElement.className = 'answer-option';
            answerElement.setAttribute('data-answer-id', answer.id);
            answerElement.setAttribute('tabindex', '0');
            answerElement.setAttribute('role', isMultipleAnswers ? 'checkbox' : 'radio');
            answerElement.setAttribute('aria-checked', 'false');
            
            // Handle HTML tags in answers properly and add checkbox for multiple answers
            if (isMultipleAnswers) {
                answerElement.innerHTML = `
                    <div class="answer-checkbox">☐</div>
                    <div class="answer-text">${answer.text}</div>
                `;
            } else {
                answerElement.innerHTML = `
                    <div class="answer-text">${answer.text}</div>
                `;
            }
            
            // Check if this answer is already selected
            if (isMultipleAnswers) {
                const selectedSet = this.multipleSelectedAnswers.get(this.currentQuestionIndex);
                if (selectedSet && selectedSet.has(answer.id)) {
                    answerElement.classList.add('selected');
                    answerElement.setAttribute('aria-checked', 'true');
                    const checkbox = answerElement.querySelector('.answer-checkbox');
                    if (checkbox) checkbox.innerHTML = '☑';
                }
            } else {
                const selectedAnswerId = this.selectedAnswers.get(this.currentQuestionIndex);
                if (selectedAnswerId === answer.id) {
                    answerElement.classList.add('selected');
                    answerElement.setAttribute('aria-checked', 'true');
                }
            }
            
            // Add click handler
            answerElement.addEventListener('click', () => {
                if (isMultipleAnswers) {
                    this.toggleMultipleAnswer(answer.id, answerElement);
                } else {
                    this.selectAnswer(answer.id, answerElement);
                }
            });
            
            // Add keyboard handler
            answerElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isMultipleAnswers) {
                        this.toggleMultipleAnswer(answer.id, answerElement);
                    } else {
                        this.selectAnswer(answer.id, answerElement);
                    }
                }
            });
            
            container.appendChild(answerElement);
            
            // Stagger animation
            setTimeout(() => {
                answerElement.style.animation = `slideIn 0.5s ease-out ${index * 0.1}s both`;
            }, 50);
        });
    }
    
    selectAnswer(answerId, answerElement) {
        // Remove selection from all answers
        const allAnswers = document.querySelectorAll('.answer-option');
        allAnswers.forEach(el => {
            el.classList.remove('selected');
            el.setAttribute('aria-checked', 'false');
        });
        
        // Select this answer
        answerElement.classList.add('selected');
        answerElement.setAttribute('aria-checked', 'true');
        
        // Store selection
        this.selectedAnswers.set(this.currentQuestionIndex, answerId);
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        console.log(`Answer selected for question ${this.currentQuestionIndex + 1}: ${answerId}`);
        
        // Auto-advance to next question after delay
        // Add transitioning class immediately to prevent flickering
        const answersContainer = document.getElementById('answersContainer');
        if (answersContainer) {
            setTimeout(() => {
                answersContainer.classList.add('transitioning');
                
                // After fade-out, advance to next question
                setTimeout(() => {
                    if (this.currentQuestionIndex < this.questions.length - 1) {
                        this.nextQuestion();
                    } else {
                        // On last question, auto-show results
                        this.showResults();
                    }
                }, 150); // Wait for fade-out animation (halved)
            }, this.answerTransitionDelay); // Use configurable delay
        } else {
            // Fallback if no answers container
            setTimeout(() => {
                if (this.currentQuestionIndex < this.questions.length - 1) {
                    this.nextQuestion();
                } else {
                    this.showResults();
                }
            }, this.autoAdvanceDelay);
        }
    }
    
    toggleMultipleAnswer(answerId, answerElement) {
        // Get or create the set of selected answers for this question
        let selectedSet = this.multipleSelectedAnswers.get(this.currentQuestionIndex);
        if (!selectedSet) {
            selectedSet = new Set();
            this.multipleSelectedAnswers.set(this.currentQuestionIndex, selectedSet);
        }
        
        // Toggle selection
        if (selectedSet.has(answerId)) {
            // Unselect
            selectedSet.delete(answerId);
            answerElement.classList.remove('selected');
            answerElement.setAttribute('aria-checked', 'false');
            const checkbox = answerElement.querySelector('.answer-checkbox');
            if (checkbox) checkbox.innerHTML = '☐';
        } else {
            // Select
            selectedSet.add(answerId);
            answerElement.classList.add('selected');
            answerElement.setAttribute('aria-checked', 'true');
            const checkbox = answerElement.querySelector('.answer-checkbox');
            if (checkbox) checkbox.innerHTML = '☑';
        }
        
        // Remove from single answers if accidentally there
        this.selectedAnswers.delete(this.currentQuestionIndex);
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        console.log(`Multiple answers for question ${this.currentQuestionIndex + 1}:`, Array.from(selectedSet));
    }
    
    updateNavigationButtons() {
        const prevButton = document.getElementById('prevButton');
        const nextButton = document.getElementById('nextButton');
        
        if (prevButton) {
            prevButton.disabled = this.currentQuestionIndex === 0;
            if (this.strings?.question?.prevButton) {
                prevButton.textContent = this.strings.question.prevButton;
            }
        }
        
        if (nextButton) {
            const currentQuestion = this.questions[this.currentQuestionIndex];
            const isMultipleAnswers = currentQuestion?.allowMultipleAnswers || false;
            
            // For multiple answers questions, always show the next button (even if skipping disabled)
            // For single answers, follow the skipping rules
            if (!this.settings.allowSkipQuestions && !isMultipleAnswers) {
                nextButton.style.display = 'none';
            } else {
                nextButton.style.display = 'inline-flex';
                
                // Check if we have selections
                let hasSelection = false;
                if (isMultipleAnswers) {
                    const selectedSet = this.multipleSelectedAnswers.get(this.currentQuestionIndex);
                    hasSelection = selectedSet && selectedSet.size > 0;
                } else {
                    hasSelection = this.selectedAnswers.has(this.currentQuestionIndex);
                }
                
                nextButton.disabled = !hasSelection;
                
                if (this.currentQuestionIndex === this.questions.length - 1) {
                    if (this.strings?.results?.seeResults) {
                        nextButton.textContent = this.strings.results.seeResults;
                    }
                } else {
                    if (this.strings?.question?.nextButton) {
                        nextButton.textContent = this.strings.question.nextButton;
                    }
                }
            }
        }
    }
    
    nextQuestion() {
        if (!this.selectedAnswers.has(this.currentQuestionIndex)) {
            return;
        }
        
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
        } else {
            this.showResults();
        }
    }
    
    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
        }
    }
    
    showResults() {
        this.hideAllScreens();
        
        const resultsScreen = document.getElementById('resultsScreen');
        if (resultsScreen) {
            resultsScreen.style.display = 'block';
        }
        
        this.calculateAndDisplayResults();
        this.updateProgressBar(this.totalQuestions, this.totalQuestions);
    }
    
    calculateAndDisplayResults() {
        const scores = {};
        
        // Process all selected answers
        this.selectedAnswers.forEach((answerId, questionIndex) => {
            const question = this.questions[questionIndex];
            const answer = question.answers.find(a => a.id === answerId);
            
            if (answer && answer.modifiers) {
                this.processModifiers(answer.modifiers, scores);
            }
        });
        
        // Use ruleset to generate result with current language
        let result;
        if (this.ruleset && this.ruleset.generateResult) {
            result = this.ruleset.generateResult(scores, this.currentLanguage);
        } else {
            // No fallback available - ruleset must provide generateResult function
            throw new Error('Ruleset must provide a generateResult function.');
        }
        
        // Display results
        this.displayResult(result);
        this.displayScoreBreakdown(scores);
    }
    
    processModifiers(modifierString, scores) {
        const modifiers = modifierString.split(' ');
        
        modifiers.forEach(modifier => {
            const match = modifier.match(/^(\w+):([+-]\d+)$/);
            if (match) {
                const [, key, value] = match;
                const currentScore = scores[key] || 0;
                scores[key] = currentScore + parseInt(value);
            }
        });
    }
    
    getBestOption(scores, prefix) {
        let bestOption = null;
        let bestScore = -Infinity;
        
        Object.entries(scores).forEach(([key, score]) => {
            if (key.startsWith(prefix) && score > bestScore) {
                bestScore = score;
                bestOption = key;
            }
        });
        
        return bestOption;
    }
    
    displayResult(result) {
        // Generic result display - structure depends on ruleset
        const avatarElement = document.getElementById('characterAvatar');
        const descriptionElement = document.getElementById('characterDescription');
        
        // Display avatar and description from result
        if (avatarElement && result.avatar) {
            avatarElement.textContent = result.avatar;
        }
        if (descriptionElement && result.description) {
            descriptionElement.textContent = result.description;
        }
        
        // Display any additional result properties dynamically
        const resultContainer = document.querySelector('.character-info');
        if (resultContainer && result.raceData && result.classData) {
            // For D&D-style results with race/class
            const raceElement = document.getElementById('characterRace');
            const classElement = document.getElementById('characterClass');
            
            if (raceElement) raceElement.textContent = result.raceData.name;
            if (classElement) classElement.textContent = result.classData.name;
        }
    }
    
    formatName(name) {
        if (!name) return 'Unknown';
        // Generic name formatting
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase().replace(/_/g, ' ');
    }
    
    getResultData(attributes) {
        // Use ruleset to generate result data
        if (this.ruleset && this.ruleset.generateResult) {
            // Create scores from attributes
            const scores = {};
            attributes.forEach(attr => {
                scores[attr] = 10;
            });
            
            const result = this.ruleset.generateResult(scores);
            return {
                avatar: result.avatar,
                description: result.description
            };
        }
        
        // Generic fallback
        return {
            avatar: '✨',
            description: 'Your personalized result!'
        };
    }
    
    displayScoreBreakdown(scores) {
        const container = document.getElementById('scoreBreakdown');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Group scores by category if ruleset provides categories
        const categories = this.ruleset?.attributeCategories || {};
        const scoreGroups = new Map();
        
        Object.entries(scores).forEach(([key, score]) => {
            // Find category for this attribute
            let category = 'Other';
            for (const [catKey, catData] of Object.entries(categories)) {
                if (key.startsWith(catKey + '_')) {
                    category = catData.name || catKey;
                    break;
                }
            }
            
            if (!scoreGroups.has(category)) {
                scoreGroups.set(category, new Map());
            }
            
            // Clean up the key name for display
            const cleanKey = key.replace(/^[A-Z]+_/, '');
            scoreGroups.get(category).set(cleanKey, score);
        });
        
        // Create score sections for each category
        scoreGroups.forEach((scores, categoryName) => {
            const section = this.createScoreSection(categoryName, scores);
            container.appendChild(section);
        });
    }
    
    createScoreSection(title, scoreMap) {
        const section = document.createElement('div');
        section.className = 'score-section';
        
        // Get localized category title
        const localizedTitle = this.getLocalizedCategoryName(title);
        const titleElement = document.createElement('h4');
        titleElement.textContent = localizedTitle;
        titleElement.style.marginBottom = 'var(--spacing-md)';
        titleElement.style.color = 'var(--text-primary, #ffffff)';
        section.appendChild(titleElement);
        
        // Sort by score descending and normalize values
        const sortedScores = Array.from(scoreMap.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8); // Show top 8 attributes
        
        // Find max score for normalization
        const maxScore = Math.max(...sortedScores.map(([,score]) => Math.abs(score)));
        const scoreRange = maxScore > 0 ? maxScore : 1;
        
        sortedScores.forEach(([key, score]) => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item-bar';
            
            // Calculate percentage for progress bar
            const percentage = Math.min(100, (Math.abs(score) / scoreRange) * 100);
            const displayName = this.getLocalizedAttributeName(key) || this.formatName(key.toLowerCase());
            
            scoreItem.innerHTML = `
                <div class="score-bar-label">
                    <span class="attribute-name">${displayName}</span>
                    <span class="attribute-score">${score >= 0 ? '+' : ''}${score}</span>
                </div>
                <div class="score-bar-track">
                    <div class="score-bar-fill ${score >= 0 ? 'positive' : 'negative'}" style="width: ${percentage}%"></div>
                </div>
            `;
            
            section.appendChild(scoreItem);
        });
        
        return section;
    }
    
    getLocalizedCategoryName(categoryName) {
        // Try to get localized category name from strings
        const lowerKey = categoryName.toLowerCase();
        if (this.strings?.results?.categories) {
            const langSuffix = this.currentLanguage === 'de' ? '_DE' : '';
            const localizedKey = lowerKey + langSuffix;
            return this.strings.results.categories[localizedKey] || this.strings.results.categories[lowerKey] || categoryName;
        }
        return categoryName;
    }
    
    getLocalizedAttributeName(attributeName) {
        // Try to get localized attribute name from strings
        const lowerKey = attributeName.toLowerCase();
        if (this.strings?.results?.attributes) {
            const langSuffix = this.currentLanguage === 'de' ? '_DE' : '';
            const localizedKey = lowerKey + langSuffix;
            return this.strings.results.attributes[localizedKey] || this.strings.results.attributes[lowerKey];
        }
        return null;
    }
    
    updateProgressBar(current, total) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText && this.strings?.navigation?.progress) {
            if (total > 0) {
                progressText.textContent = this.formatString(
                    this.strings.navigation.progress,
                    { current, total }
                );
            }
        }
    }
    
    animateTransition() {
        const questionCard = document.querySelector('.question-card');
        if (questionCard) {
            questionCard.style.animation = 'slideIn 0.6s ease-out';
        }
    }
    
    animateQuestionEntrance() {
        const questionCard = document.querySelector('.question-card');
        if (questionCard) {
            questionCard.style.transform = 'translateY(20px)';
            questionCard.style.opacity = '0';
            
            setTimeout(() => {
                questionCard.style.transition = 'all 0.4s ease-out';
                questionCard.style.transform = 'translateY(0)';
                questionCard.style.opacity = '1';
            }, 50);
        }
    }
    
    handleKeyboardNavigation(e) {
        if (!this.isInitialized) return;
        
        const questionScreen = document.getElementById('questionScreen');
        if (!questionScreen || questionScreen.style.display === 'none') return;
        
        switch (e.key) {
            case 'ArrowLeft':
                if (!document.getElementById('prevButton').disabled) {
                    this.previousQuestion();
                }
                break;
            case 'ArrowRight':
                if (!document.getElementById('nextButton').disabled) {
                    this.nextQuestion();
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                const answerIndex = parseInt(e.key) - 1;
                const answers = document.querySelectorAll('.answer-option');
                if (answers[answerIndex]) {
                    answers[answerIndex].click();
                }
                break;
        }
    }
    
    restartApp() {
        this.currentQuestionIndex = 0;
        this.selectedAnswers.clear();
        this.showWelcomeScreen();
    }
    
    shareResults() {
        const lang = this.currentLanguage;
        const gameTitle = this.ruleset?.getLocalized ? 
            this.ruleset.getLocalized(this.ruleset.gameInfo, 'title', lang) : 
            this.ruleset?.gameInfo?.title;
        if (!gameTitle) {
            console.error('Cannot share without game title from ruleset');
            return;
        }
        
        const shareText = `I just completed the ${gameTitle}! 🎲 Try it yourself: ${window.location.href}`;
        
        if (navigator.share) {
            navigator.share({
                title: `${gameTitle} Results`,
                text: shareText,
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                const message = this.strings?.notifications?.resultsCopied || 'Copied!';
                this.showNotification(message);
            }).catch(() => {
                const subject = encodeURIComponent(`My ${gameTitle} Results`);
                const body = encodeURIComponent(shareText);
                window.open(`mailto:?subject=${subject}&body=${body}`);
            });
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideInNotification 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutNotification 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInNotification {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutNotification {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

// Initialize the app
new QuestionnaireApp();