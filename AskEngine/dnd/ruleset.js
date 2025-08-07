// Unified D&D Character Creator Ruleset  
// Contains all game-specific attributes, combinations, and result mappings
// Language-specific fields use suffixes: _DE for German, no suffix for English/default

const Ruleset = {
  // Game metadata
  gameInfo: {
    title: "D&D Character Creator",
    title_DE: "D&D Charakter-Ersteller",
    description: "Discover your perfect D&D character",
    description_DE: "Entdecke deinen perfekten D&D-Charakter",
    version: "2.0"
  },

  // Game settings
  settings: {
    // Randomization controls
    allowRandomizeQuestions: true,
    allowRandomizeAnswers: true,
    
    // Navigation controls  
    allowSkipQuestions: false,  // If false, next button is hidden, user must click answers
    showProgressBar: true,
    
    // Question behavior
    allowMultipleAnswers: false,  // Can be overridden per question
    autoAdvanceDelay: 1200,  // ms delay after selecting answer
    
    // UI settings
    showQuestionNumbers: true,
    animateTransitions: true
  },

  // Attribute categories that can be influenced by questions
  attributeCategories: {
    RACE: {
      name: "Race",
      name_DE: "Rasse",
      description: "The different peoples of the D&D world",
      description_DE: "Die verschiedenen Völker der D&D-Welt"
    },
    CLASS: {
      name: "Class",
      name_DE: "Klasse",
      description: "Character classes with their special abilities",
      description_DE: "Charakterklassen mit ihren besonderen Fähigkeiten"
    },
    ALIGNMENT: {
      name: "Alignment",
      name_DE: "Gesinnung",
      description: "The moral and ethical orientation of the character",
      description_DE: "Die moralische und ethische Ausrichtung des Charakters"
    }
  },

  // All possible attribute values and their data
  attributes: {
    // Races
    RACE_HUMAN: {
      name: "Human",
      name_DE: "Mensch",
      adjective: "human",
      adjective_DE: "menschliche",
      description: "Humans are versatile and adaptable. They can excel in any class and are known for their ambition and determination.",
      description_DE: "Menschen sind vielseitig und anpassungsfähig. Sie können in jeder Klasse glänzen und sind für ihren Ehrgeiz und ihre Entschlossenheit bekannt.",
      avatar: "👤",
      category: "RACE"
    },
    RACE_ELF: {
      name: "Elf",
      name_DE: "Elf",
      adjective: "elven",
      adjective_DE: "elfische",
      description: "Elves are long-lived and elegant, with a natural affinity for magic and nature. They are skilled with bows and possess keen senses.",
      description_DE: "Elfen sind langlebig und elegant, mit einer natürlichen Affinität zu Magie und Natur. Sie sind geschickt mit Bögen und besitzen scharfe Sinne.",
      avatar: "🧝",
      category: "RACE"
    },
    RACE_ORC: {
      name: "Orc",
      name_DE: "Ork",
      adjective: "orcish",
      adjective_DE: "orkische",
      description: "Orcs are strong and warlike, often misunderstood but with a pronounced code of honor. They are born warriors with great endurance.",
      description_DE: "Orks sind stark und kriegerisch, oft missverstanden, aber mit einem ausgeprägten Ehrenkodex. Sie sind geborene Krieger mit großer Ausdauer.",
      avatar: "👹",
      category: "RACE"
    },
    RACE_GNOME: {
      name: "Gnome",
      name_DE: "Gnom",
      adjective: "gnomish",
      adjective_DE: "gnomische",
      description: "Gnomes are small but intelligent, with a love for magic and inventions. They are curious and often have a mischievous sense of humor.",
      description_DE: "Gnome sind klein, aber intelligent, mit einer Liebe zu Magie und Erfindungen. Sie sind neugierig und haben oft einen schelmischen Humor.",
      avatar: "🧙‍♂️",
      category: "RACE"
    },
    RACE_HALFELF: {
      name: "Half-Elf",
      name_DE: "Halbelf",
      adjective: "half-elven",
      adjective_DE: "halbelfische",
      description: "Half-elves combine the best of both worlds - the versatility of humans with the elegance of elves. They are often charismatic and diplomatic.",
      description_DE: "Halbelfen vereinen das Beste aus beiden Welten - die Vielseitigkeit der Menschen mit der Eleganz der Elfen. Sie sind oft charismatisch und diplomatisch.",
      avatar: "🧝‍♀️",
      category: "RACE"
    },
    RACE_HALFORC: {
      name: "Half-Orc",
      name_DE: "Halbork",
      adjective: "half-orcish",
      adjective_DE: "halborkische",
      description: "Half-orcs often struggle with their dual nature, but are strong and determined. They must fight for their place in the world.",
      description_DE: "Halborks kämpfen oft mit ihrer Doppelnatur, sind aber stark und entschlossen. Sie müssen für ihren Platz in der Welt kämpfen.",
      avatar: "👺",
      category: "RACE"
    },
    RACE_HALFLING: {
      name: "Halfling",
      name_DE: "Halbling",
      adjective: "halfling",
      adjective_DE: "halblinge",
      description: "Halflings are small, but brave and have big hearts. They value comfort and community, but are surprisingly resilient.",
      description_DE: "Halblinge sind klein, aber mutig und haben große Herzen. Sie schätzen Komfort und Gemeinschaft, sind aber überraschend widerstandsfähig.",
      avatar: "🍖",
      category: "RACE"
    },
    RACE_DWARF: {
      name: "Dwarf",
      name_DE: "Zwerg",
      adjective: "dwarven",
      adjective_DE: "zwergische",
      description: "Dwarves are sturdy and traditional-minded, masterful craftsmen and fearless fighters. They value honor, clan, and finely crafted items.",
      description_DE: "Zwerge sind robust und traditionsbewusst, meisterhafte Handwerker und furchtlose Kämpfer. Sie schätzen Ehre, Clan und fein gearbeitete Gegenstände.",
      avatar: "⚒️",
      category: "RACE"
    },

    // Classes
    CLASS_FIGHTER: {
      name: "Fighter",
      name_DE: "Kämpfer",
      adjective: "martial",
      adjective_DE: "kämpferische",
      description: "Fighters are masters of combat, skilled in the use of all weapons and armor. They are the protectors and defenders of their companions.",
      description_DE: "Kämpfer sind Meister des Kampfes, geschickt im Umgang mit allen Waffen und Rüstungen. Sie sind die Beschützer und Verteidiger ihrer Gefährten.",
      avatar: "⚔️",
      category: "CLASS"
    },
    CLASS_WIZARD: {
      name: "Wizard",
      name_DE: "Zauberer",
      adjective: "wizardly",
      adjective_DE: "zauberische",
      description: "Wizards have dedicated their lives to studying the arcane arts. Through knowledge and preparation they can shape reality itself.",
      description_DE: "Zauberer haben ihr Leben dem Studium der arkanen Künste gewidmet. Durch Wissen und Vorbereitung können sie die Realität selbst formen.",
      avatar: "🧙‍♂️",
      category: "CLASS"
    },
    CLASS_BARBARIAN: {
      name: "Barbarian",
      name_DE: "Barbar",
      adjective: "barbaric",
      adjective_DE: "barbarische",
      description: "Barbarians fight with primitive savagery and untamed rage. Their strength comes from their instincts and connection to nature.",
      description_DE: "Barbaren kämpfen mit primitiver Wildheit und ungezähmter Wut. Ihre Stärke kommt aus ihren Instinkten und ihrer Verbindung zur Natur.",
      avatar: "💪",
      category: "CLASS"
    },
    CLASS_PALADIN: {
      name: "Paladin",
      name_DE: "Paladin",
      adjective: "holy",
      adjective_DE: "heilige",
      description: "Paladins are holy warriors who have sworn an oath to protect good. They combine martial prowess with divine magic.",
      description_DE: "Paladine sind heilige Krieger, die einen Eid geschworen haben, das Gute zu beschützen. Sie vereinen kriegerisches Können mit göttlicher Magie.",
      avatar: "🛡️",
      category: "CLASS"
    },
    CLASS_CLERIC: {
      name: "Cleric",
      name_DE: "Kleriker",
      adjective: "clerical",
      adjective_DE: "klerikale",
      description: "Clerics are intermediaries between the mortal world and the gods. They heal wounds and drive away evil with divine power.",
      description_DE: "Kleriker sind Vermittler zwischen der sterblichen Welt und den Göttern. Sie heilen Wunden und vertreiben das Böse mit göttlicher Macht.",
      avatar: "✨",
      category: "CLASS"
    },
    CLASS_ROGUE: {
      name: "Rogue",
      name_DE: "Schurke",
      adjective: "roguish",
      adjective_DE: "schurkische",
      description: "Rogues are masters of stealth and dexterity. They solve problems with finesse rather than brute force.",
      description_DE: "Schurken sind Meister der Heimlichkeit und Geschicklichkeit. Sie lösen Probleme mit Finesse statt mit roher Gewalt.",
      avatar: "🗡️",
      category: "CLASS"
    },
    CLASS_BARD: {
      name: "Bard",
      name_DE: "Barde",
      adjective: "bardic",
      adjective_DE: "bardische",
      description: "Bards are versatile storytellers and artists who can weave magical powers through music and words.",
      description_DE: "Barden sind vielseitige Geschichtenerzähler und Künstler, die durch Musik und Worte magische Kräfte weben können.",
      avatar: "🎵",
      category: "CLASS"
    },
    CLASS_DRUID: {
      name: "Druid",
      name_DE: "Druide",
      adjective: "druidic",
      adjective_DE: "druidische",
      description: "Druids are guardians of nature who can speak with animals and channel the forces of the wilderness.",
      description_DE: "Druiden sind Hüter der Natur, die mit Tieren sprechen und die Kräfte der Wildnis kanalisieren können.",
      avatar: "🌿",
      category: "CLASS"
    },
    CLASS_SORCERER: {
      name: "Sorcerer",
      name_DE: "Hexenmeister",
      adjective: "sorcerous",
      adjective_DE: "hexenmeisterliche",
      description: "Sorcerers possess innate magical powers that they can use instinctively and spontaneously.",
      description_DE: "Hexenmeister besitzen angeborene magische Kräfte, die sie instinktiv und spontan einsetzen können.",
      avatar: "✨",
      category: "CLASS"
    },
    CLASS_RANGER: {
      name: "Ranger",
      name_DE: "Waldläufer",
      adjective: "ranging",
      adjective_DE: "waldläuferische",
      description: "Rangers are experts of the wilderness, skilled hunters and trackers who protect their homeland from threats.",
      description_DE: "Waldläufer sind Experten der Wildnis, geschickte Jäger und Fährtenleser, die ihre Heimat vor Bedrohungen schützen.",
      avatar: "🏹",
      category: "CLASS"
    },
    CLASS_MONK: {
      name: "Monk",
      name_DE: "Mönch",
      adjective: "monastic",
      adjective_DE: "mönchische",
      description: "Monks have perfected their body and mind through years of training and fight with inner strength.",
      description_DE: "Mönche haben ihren Körper und Geist durch jahrelangs Training perfektioniert und kämpfen mit innerer Stärke.",
      avatar: "🥋",
      category: "CLASS"
    },

    // Alignments
    ALIGN_NG: {
      name: "Neutral Good",
      name_DE: "Neutral Gut",
      adjective: "neutral good",
      adjective_DE: "neutral gute",
      description: "Neutral good characters do the best they can to help others according to their needs and abilities. They are kind, benevolent, and helpful.",
      description_DE: "Neutral gute Charaktere tun ihr Bestes, um anderen nach ihren Bedürfnissen und Fähigkeiten zu helfen. Sie sind freundlich, wohlwollend und hilfsbereit.",
      avatar: "😇",
      category: "ALIGNMENT"
    },
    ALIGN_LG: {
      name: "Lawful Good",
      name_DE: "Rechtschaffen Gut",
      adjective: "lawful good",
      adjective_DE: "rechtschaffen gute",
      description: "Lawful good characters act as a good person is expected or required to act. They combine a commitment to oppose evil with the discipline to fight relentlessly.",
      description_DE: "Rechtschaffen gute Charaktere handeln, wie von einer guten Person erwartet wird. Sie verbinden das Engagement gegen das Böse mit der Disziplin, unermüdlich zu kämpfen.",
      avatar: "⚖️",
      category: "ALIGNMENT"
    },
    ALIGN_CG: {
      name: "Chaotic Good",
      name_DE: "Chaotisch Gut",
      adjective: "chaotic good",
      adjective_DE: "chaotisch gute",
      description: "Chaotic good characters act as their conscience directs, with little regard for what others expect. They make their own way, but they're kind and benevolent.",
      description_DE: "Chaotisch gute Charaktere handeln nach ihrem Gewissen, ohne viel Rücksicht darauf, was andere erwarten. Sie gehen ihren eigenen Weg, sind aber freundlich und wohlwollend.",
      avatar: "🌟",
      category: "ALIGNMENT"
    },
    ALIGN_NN: {
      name: "True Neutral",
      name_DE: "Neutral",
      adjective: "neutral",
      adjective_DE: "neutrale",
      description: "Neutral characters do what seems to be a good idea. They don't feel strongly one way or the other when it comes to good vs. evil or law vs. chaos.",
      description_DE: "Neutrale Charaktere tun, was ihnen wie eine gute Idee erscheint. Sie haben keine starken Gefühle in eine Richtung, wenn es um Gut gegen Böse oder Ordnung gegen Chaos geht.",
      avatar: "⚪",
      category: "ALIGNMENT"
    },
    ALIGN_LN: {
      name: "Lawful Neutral",
      name_DE: "Rechtschaffen Neutral",
      adjective: "lawful neutral",
      adjective_DE: "rechtschaffen neutrale",
      description: "Lawful neutral characters act in accordance with law, tradition, or personal codes. Order and organization are paramount to them.",
      description_DE: "Rechtschaffen neutrale Charaktere handeln in Übereinstimmung mit Gesetzen, Traditionen oder persönlichen Codes. Ordnung und Organisation sind für sie von größter Bedeutung.",
      avatar: "📜",
      category: "ALIGNMENT"
    },
    ALIGN_CN: {
      name: "Chaotic Neutral",
      name_DE: "Chaotisch Neutral",
      adjective: "chaotic neutral",
      adjective_DE: "chaotisch neutrale",
      description: "Chaotic neutral characters follow their whims. They are individualists first and last. They value their own liberty but don't strive to protect others' freedom.",
      description_DE: "Chaotisch neutrale Charaktere folgen ihren Launen. Sie sind Individualisten durch und durch. Sie schätzen ihre eigene Freiheit, bemühen sich aber nicht, die Freiheit anderer zu schützen.",
      avatar: "🎭",
      category: "ALIGNMENT"
    },
    ALIGN_NE: {
      name: "Neutral Evil",
      name_DE: "Neutral Böse",
      adjective: "neutral evil",
      adjective_DE: "neutral böse",
      description: "Neutral evil characters do whatever they can get away with. They are out for themselves, pure and simple. They shed no tears for those they kill.",
      description_DE: "Neutral böse Charaktere tun, womit sie durchkommen können. Sie sind nur auf sich selbst aus, rein und einfach. Sie vergießen keine Tränen für die, die sie töten.",
      avatar: "💀",
      category: "ALIGNMENT"
    },
    ALIGN_LE: {
      name: "Lawful Evil",
      name_DE: "Rechtschaffen Böse",
      adjective: "lawful evil",
      adjective_DE: "rechtschaffen böse",
      description: "Lawful evil characters methodically take what they want within the limits of a code of conduct but without regard for whom it hurts.",
      description_DE: "Rechtschaffen böse Charaktere nehmen sich methodisch, was sie wollen, innerhalb der Grenzen eines Verhaltenskodex, aber ohne Rücksicht darauf, wen es verletzt.",
      avatar: "👑",
      category: "ALIGNMENT"
    },
    ALIGN_CE: {
      name: "Chaotic Evil",
      name_DE: "Chaotisch Böse",
      adjective: "chaotic evil",
      adjective_DE: "chaotisch böse",
      description: "Chaotic evil characters act with arbitrary violence, spurred by their greed, hatred, or bloodlust. They are hot-tempered, vicious, and unpredictable.",
      description_DE: "Chaotisch böse Charaktere handeln mit willkürlicher Gewalt, angetrieben von ihrer Gier, ihrem Hass oder ihrer Blutgier. Sie sind jähzornig, bösartig und unberechenbar.",
      avatar: "🔥",
      category: "ALIGNMENT"
    }
  },

  // Default values for when no strong preference is found
  defaults: {
    RACE: "RACE_HUMAN",
    CLASS: "CLASS_FIGHTER",
    ALIGNMENT: "ALIGN_NN"
  },

  // Special character combinations with unique descriptions
  combinations: {
    "human_fighter": {
      avatar: "⚔️",
      description: "A classic human fighter - versatile, reliable, and ready for any challenge!",
      description_DE: "Ein klassischer menschlicher Kämpfer - vielseitig, verlässlich und bereit für jede Herausforderung!"
    },
    "elf_wizard": {
      avatar: "🧙‍♂️",
      description: "An elegant elven wizard with centuries of wisdom and powerful arcane abilities.",
      description_DE: "Ein eleganter elfischer Zauberer mit jahrhundertealter Weisheit und mächtigen arkanen Fähigkeiten."
    },
    "dwarf_fighter": {
      avatar: "🛡️",
      description: "A steadfast dwarven fighter with unwavering loyalty and masterful combat skills.",
      description_DE: "Ein standhafter zwergischer Kämpfer mit unerschütterlicher Loyalität und meisterhaften Kampffertigkeiten."
    },
    "halfling_rogue": {
      avatar: "🗡️",
      description: "A skillful halfling rogue - small, nimble, and surprisingly brave.",
      description_DE: "Ein geschickter Halbling-Schurke - klein, wendig und überraschend mutig."
    },
    "orc_barbarian": {
      avatar: "💪",
      description: "A wild orcish barbarian with untamed strength and primitive savagery.",
      description_DE: "Ein wilder orkischer Barbar mit ungezähmter Stärke und primitiver Wildheit."
    },
    "gnome_wizard": {
      avatar: "🔬",
      description: "A curious gnomish wizard with a fondness for experiments and magical inventions.",
      description_DE: "Ein neugieriger gnomischer Zauberer mit einer Vorliebe für Experimente und magische Erfindungen."
    },
    "halfelf_bard": {
      avatar: "🎵",
      description: "A charismatic half-elven bard who conquers hearts with music and words.",
      description_DE: "Ein charismatischer halbelfischer Barde, der Herzen mit Musik und Worten erobert."
    },
    "halforc_fighter": {
      avatar: "⚔️",
      description: "A determined half-orcish fighter who transforms their dual nature into strength.",
      description_DE: "Ein entschlossener halborkischer Kämpfer, der seine Doppelnatur in Stärke verwandelt."
    },
    "elf_ranger": {
      avatar: "🏹",
      description: "A skilled elven ranger, a master of bow and wilderness.",
      description_DE: "Ein geschickter elfischer Waldläufer, ein Meister von Bogen und Wildnis."
    },
    "human_paladin": {
      avatar: "🛡️",
      description: "A righteous human paladin, a beacon of hope in dark times.",
      description_DE: "Ein rechtschaffener menschlicher Paladin, ein Leuchtfeuer der Hoffnung in dunklen Zeiten."
    }
  },

  // Result template strings
  resultTemplates: {
    title: "Your Character",
    title_DE: "Dein Charakter",
    subtitle: "You are a {adjective_alignment} {adjective_race} {class}",
    subtitle_DE: "Du bist ein {adjective_alignment}r {adjective_race}r {class}",
    descriptionHeader: "Character Description:",
    descriptionHeader_DE: "Charakterbeschreibung:",
    conclusionMessage: "Have fun playing!",
    conclusionMessage_DE: "Viel Spaß beim Spielen!"
  },

  // Helper function to get localized value
  getLocalized: function(obj, field, lang) {
    const langField = field + '_' + lang.toUpperCase();
    return obj[langField] || obj[field] || '';
  },

  // Function to calculate the best attribute in a category
  calculateBestAttribute: function(scores, category) {
    let bestAttribute = null;
    let bestScore = -Infinity;
    
    for (const [key, score] of Object.entries(scores)) {
      if (key.startsWith(category + '_') && score > bestScore) {
        bestScore = score;
        bestAttribute = key;
      }
    }
    
    return bestAttribute || this.defaults[category];
  },

  // Function to generate character result
  generateResult: function(scores, lang = 'en') {
    const bestRace = this.calculateBestAttribute(scores, 'RACE');
    const bestClass = this.calculateBestAttribute(scores, 'CLASS');
    const bestAlignment = this.calculateBestAttribute(scores, 'ALIGNMENT');
    
    const raceData = this.attributes[bestRace];
    const classData = this.attributes[bestClass];
    const alignmentData = this.attributes[bestAlignment];
    
    // Get localized data
    const localizedRaceData = {
      name: this.getLocalized(raceData, 'name', lang),
      adjective: this.getLocalized(raceData, 'adjective', lang),
      description: this.getLocalized(raceData, 'description', lang)
    };
    
    const localizedClassData = {
      name: this.getLocalized(classData, 'name', lang),
      adjective: this.getLocalized(classData, 'adjective', lang),
      description: this.getLocalized(classData, 'description', lang)
    };

    const localizedAlignmentData = {
      name: this.getLocalized(alignmentData, 'name', lang),
      adjective: this.getLocalized(alignmentData, 'adjective', lang),
      description: this.getLocalized(alignmentData, 'description', lang)
    };
    
    // Check for special combinations
    const combinationKey = `${bestRace.replace('RACE_', '').toLowerCase()}_${bestClass.replace('CLASS_', '').toLowerCase()}`;
    const combination = this.combinations[combinationKey];
    
    let description;
    if (combination) {
      description = this.getLocalized(combination, 'description', lang);
    } else {
      description = lang === 'de' 
        ? `Ein einzigartiger ${localizedRaceData.adjective}r ${localizedClassData.name}, bereit für Abenteuer!`
        : `A unique ${localizedRaceData.adjective} ${localizedClassData.name}, ready for adventure!`;
    }
    
    return {
      race: bestRace,
      class: bestClass,
      alignment: bestAlignment,
      raceData: localizedRaceData,
      classData: localizedClassData,
      alignmentData: localizedAlignmentData,
      combination: combination,
      avatar: combination ? combination.avatar : (classData.avatar || raceData.avatar),
      description: description
    };
  }
};

// Make available globally for browser usage
if (typeof window !== 'undefined') {
  window.Ruleset = Ruleset;
}

// Export for use in modern app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Ruleset;
}