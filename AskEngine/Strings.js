// Unified language strings for Generic Questionnaire
// Contains only UI text, not game-specific data (that's in ruleset)
// Language-specific fields use suffixes: _DE for German, no suffix for English/default

const Strings = {
  // Welcome screen
  welcome: {
    title: "D&D Character Creator",
    title_DE: "D&D Charakter-Ersteller",
    subtitle: "Discover your perfect D&D character",
    subtitle_DE: "Entdecke deinen perfekten D&D-Charakter",
    description: "Answer a series of personality questions and find out which race and class best suit you. Our intelligent engine analyzes your answers to recommend the ideal D&D character for you.",
    description_DE: "Beantworte eine Reihe von Persönlichkeitsfragen und finde heraus, welche Rasse und Klasse am besten zu dir passt. Unsere intelligente Engine analysiert deine Antworten, um dir den idealen D&D-Charakter zu empfehlen.",
    features: [
      { 
        icon: "🎲", 
        text: "Interactive Questions",
        text_DE: "Interaktive Fragen"
      },
      { 
        icon: "⚔️", 
        text: "Multiple Races & Classes",
        text_DE: "Mehrere Rassen & Klassen"
      },
      { 
        icon: "🔮", 
        text: "Personality Analysis",
        text_DE: "Persönlichkeits-Analyse"
      },
      { 
        icon: "📊", 
        text: "Detailed Results",
        text_DE: "Detaillierte Ergebnisse"
      }
    ],
    startButton: "Begin Your Quest",
    startButton_DE: "Beginne dein Abenteuer"
  },

  // Question screen
  question: {
    questionLabel: "Question {current} of {total}",
    questionLabel_DE: "Frage {current} von {total}",
    nextButton: "Next",
    nextButton_DE: "Weiter",
    prevButton: "Previous",
    prevButton_DE: "Zurück",
    skipButton: "Skip",
    skipButton_DE: "Überspringen"
  },

  // Results screen
  results: {
    title: "Your D&D Character",
    title_DE: "Dein D&D Charakter",
    subtitle: "Here is your recommended character based on your answers",
    subtitle_DE: "Hier ist dein empfohlener Charakter basierend auf deinen Antworten",
    characterResult: "You are a {alignment}, {race} {class}",
    characterResult_DE: "Du bist ein {alignment}, {race} {class}",
    detailedResultsTitle: "Detailed Analysis",
    detailedResultsTitle_DE: "Detaillierte Analyse",
    restartButton: "Restart",
    restartButton_DE: "Neustart",
    shareButton: "Share",
    shareButton_DE: "Teilen",
    seeResults: "See Results ✨",
    seeResults_DE: "Ergebnisse anzeigen ✨",
    
    // Category translations
    categories: {
      race: "Races",
      race_DE: "Rassen",
      class: "Classes", 
      class_DE: "Klassen",
      align: "Alignments",
      align_DE: "Gesinnung",
      other: "Other Attributes",
      other_DE: "Weitere Eigenschaften"
    },
    
    // Common attribute translations
    attributes: {
      // Races
      human: "Human",
      human_DE: "Mensch",
      elf: "Elf", 
      elf_DE: "Elf",
      dwarf: "Dwarf",
      dwarf_DE: "Zwerg", 
      halfling: "Halfling",
      halfling_DE: "Halbling",
      orc: "Orc",
      orc_DE: "Ork",
      halforc: "Half-Orc",
      halforc_DE: "Halbork",
      halfelf: "Half-Elf",
      halfelf_DE: "Halbelf",
      gnome: "Gnome",
      gnome_DE: "Gnom",
      
      // Classes
      fighter: "Fighter",
      fighter_DE: "Kämpfer",
      wizard: "Wizard", 
      wizard_DE: "Zauberer",
      cleric: "Cleric",
      cleric_DE: "Kleriker",
      rogue: "Rogue",
      rogue_DE: "Schurke",
      ranger: "Ranger",
      ranger_DE: "Waldläufer",
      paladin: "Paladin",
      paladin_DE: "Paladin",
      barbarian: "Barbarian", 
      barbarian_DE: "Barbar",
      bard: "Bard",
      bard_DE: "Barde",
      druid: "Druid",
      druid_DE: "Druide",
      sorcerer: "Sorcerer",
      sorcerer_DE: "Zauberer",
      monk: "Monk",
      monk_DE: "Mönch"
    }
  },

  // Navigation
  navigation: {
    brand: "»SynthelicZ« D&D",
    brand_DE: "»SynthelicZ« D&D",
    subtitle: "Character Creator",
    subtitle_DE: "Charakter-Ersteller",
    progress: "Question {current} of {total}",
    progress_DE: "Frage {current} von {total}",
    readyToBegin: "Ready to begin",
    readyToBegin_DE: "Bereit zu beginnen"
  },

  // Footer
  footer: {
    brand: "»SynthelicZ« Collection",
    brand_DE: "»SynthelicZ« Collection",
    year: "1995-2025 by Hawkynt",
    year_DE: "1995-2025 by Hawkynt"
  },

  // Loading
  loading: {
    title: "Loading D&D Character Creator...",
    title_DE: "Lade D&D Charakter-Ersteller...",
    subtitle: "Preparing the magic...",
    subtitle_DE: "Bereite die Magie vor..."
  },

  // Error messages
  errors: {
    questionLoadFailed: "Failed to load questions. Please try again.",
    questionLoadFailed_DE: "Fehler beim Laden der Fragen. Bitte versuche es erneut.",
    noQuestionsFound: "No questions found. Please check the configuration.",
    noQuestionsFound_DE: "Keine Fragen gefunden. Bitte überprüfe die Konfiguration.",
    engineNotFound: "Engine could not be loaded.",
    engineNotFound_DE: "Engine konnte nicht geladen werden."
  },

  // Accessibility
  accessibility: {
    questionNumber: "Question number {number}",
    questionNumber_DE: "Frage Nummer {number}",
    answerOption: "Answer option {number}",
    answerOption_DE: "Antwortmöglichkeit {number}",
    progressBar: "Progress: {percent} percent complete",
    progressBar_DE: "Fortschritt: {percent} Prozent abgeschlossen",
    characterAvatar: "Character avatar for {character}",
    characterAvatar_DE: "Charakter-Avatar für {character}"
  },

  // Notifications
  notifications: {
    resultsCopied: "Results copied to clipboard! 📋",
    resultsCopied_DE: "Ergebnisse in die Zwischenablage kopiert! 📋"
  },

  // Helper function to get localized value
  getLocalized: function(path, lang = 'en') {
    // Navigate to the nested property
    const parts = path.split('.');
    let current = this;
    
    for (let i = 0; i < parts.length; i++) {
      if (current[parts[i]] === undefined) {
        return path; // Return path if not found
      }
      current = current[parts[i]];
    }
    
    // If current is an object with language variants
    if (typeof current === 'object' && !Array.isArray(current)) {
      const langField = path.split('.').pop() + '_' + lang.toUpperCase();
      const parentPath = path.substring(0, path.lastIndexOf('.'));
      const parent = parentPath ? this.getLocalized(parentPath) : this;
      
      if (parent && parent[langField.split('_')[0] + '_' + lang.toUpperCase()]) {
        return parent[langField.split('_')[0] + '_' + lang.toUpperCase()];
      }
    }
    
    // For simple fields with language suffix
    if (typeof current === 'string') {
      return current;
    }
    
    // For arrays with language fields in objects
    if (Array.isArray(current)) {
      return current.map(item => {
        if (item.text && lang === 'de' && item.text_DE) {
          return { ...item, text: item.text_DE };
        }
        return item;
      });
    }
    
    return current;
  },

  // Get all strings for a specific language
  getAllForLanguage: function(lang = 'en') {
    const result = {};
    const processObject = (obj, target) => {
      for (const key in obj) {
        if (key === 'getLocalized' || key === 'getAllForLanguage') continue;
        
        const value = obj[key];
        
        if (typeof value === 'string') {
          // Check for language-specific version
          const langKey = key + '_' + lang.toUpperCase();
          if (obj[langKey]) {
            target[key] = obj[langKey];
          } else if (!key.includes('_')) {
            target[key] = value;
          }
        } else if (Array.isArray(value)) {
          // Process arrays with language fields
          target[key] = value.map(item => {
            if (typeof item === 'object') {
              const newItem = { ...item };
              for (const itemKey in item) {
                const langItemKey = itemKey + '_' + lang.toUpperCase();
                if (item[langItemKey]) {
                  newItem[itemKey] = item[langItemKey];
                }
              }
              return newItem;
            }
            return item;
          });
        } else if (typeof value === 'object') {
          target[key] = {};
          processObject(value, target[key]);
        }
      }
    };
    
    processObject(this, result);
    return result;
  }
};

// Template function for string interpolation
function formatString(template, values) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] !== undefined ? values[key] : match;
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Strings, formatString };
}