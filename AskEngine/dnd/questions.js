// Unified D&D Character Creator Questions
// Language-specific fields use suffixes: _DE for German, no suffix for English/default

const Questions = [
  {
    text: 'Where do you feel most comfortable?',
    text_DE: 'Wo fühlst du dich am wohlsten?',
    answers: [
      { 
        text: 'In a big city full of life.',
        text_DE: 'In einer großen Stadt voller Leben.',
        modifiers: 'RACE_HUMAN:+2 RACE_ELF:-2 RACE_DWARF:-1 CLASS_BARD:+1 CLASS_ROGUE:+1 CLASS_DRUID:-2'
      },
      { 
        text: 'In a quiet village.',
        text_DE: 'In einem ruhigen Dorf.',
        modifiers: 'RACE_HALFLING:+2 RACE_HUMAN:+1 RACE_ORC:-2 CLASS_CLERIC:+1 CLASS_DRUID:+1 CLASS_BARD:-1'
      },
      { 
        text: 'In the depths of a mine.',
        text_DE: 'In den Tiefen einer Mine.',
        modifiers: 'RACE_DWARF:+3 RACE_GNOME:+1 RACE_ELF:-2 CLASS_FIGHTER:+1 CLASS_CLERIC:+1 CLASS_WIZARD:-1'
      },
      { 
        text: 'In the wilderness.',
        text_DE: 'In der Wildnis.',
        modifiers: 'RACE_ELF:+2 RACE_HALFORC:+1 RACE_HUMAN:-1 CLASS_DRUID:+3 CLASS_RANGER:+2 CLASS_BARBARIAN:+1'
      },
      { 
        text: 'In ancient ruins.',
        text_DE: 'In alten Ruinen.',
        modifiers: 'RACE_ELF:+1 RACE_HUMAN:+1 CLASS_WIZARD:+2 CLASS_CLERIC:+1 CLASS_ROGUE:+1'
      },
      { 
        text: 'In a noisy tavern.',
        text_DE: 'In einer lauten Taverne.',
        modifiers: 'RACE_HUMAN:+1 RACE_HALFLING:+1 RACE_DWARF:+1 CLASS_BARD:+2 CLASS_FIGHTER:+1 CLASS_ROGUE:+1'
      }
    ]
  },
  {
    text: 'What do you value most?',
    text_DE: 'Was schätzt du am meisten?',
    answers: [
      { 
        text: 'Knowledge and wisdom.',
        text_DE: 'Wissen und Weisheit.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+1 RACE_ORC:-2 CLASS_WIZARD:+3 CLASS_CLERIC:+1 CLASS_DRUID:+1'
      },
      { 
        text: 'Honor and duty.',
        text_DE: 'Ehre und Pflicht.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+2 RACE_HALFORC:+1 CLASS_PALADIN:+3 CLASS_FIGHTER:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'Freedom and adventure.',
        text_DE: 'Freiheit und Abenteuer.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+1 RACE_HALFORC:+1 CLASS_RANGER:+2 CLASS_BARD:+2 CLASS_ROGUE:+2'
      },
      { 
        text: 'Wealth and power.',
        text_DE: 'Reichtum und Macht.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+1 CLASS_WIZARD:+1 CLASS_ROGUE:+2 CLASS_SORCERER:+1'
      },
      { 
        text: 'Family and tradition.',
        text_DE: 'Familie und Tradition.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFLING:+2 RACE_ELF:+1 CLASS_CLERIC:+2 CLASS_FIGHTER:+1'
      },
      { 
        text: 'Strength and victory.',
        text_DE: 'Stärke und Sieg.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 RACE_DWARF:+1 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+2 CLASS_PALADIN:+1'
      }
    ]
  },
  {
    text: 'How do you solve problems?',
    text_DE: 'Wie löst du Probleme?',
    answers: [
      { 
        text: 'With careful planning and study.',
        text_DE: 'Mit sorgfältiger Planung und Studium.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+2 RACE_ORC:-2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'By charging in headfirst.',
        text_DE: 'Indem ich kopfüber hineinstürze.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 RACE_ELF:-2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+2'
      },
      { 
        text: 'By finding a clever workaround.',
        text_DE: 'Indem ich eine clevere Umgehung finde.',
        modifiers: 'RACE_GNOME:+2 RACE_HALFLING:+1 RACE_HUMAN:+1 CLASS_ROGUE:+3 CLASS_BARD:+2 CLASS_WIZARD:+1'
      },
      { 
        text: 'By seeking divine guidance.',
        text_DE: 'Indem ich göttliche Führung suche.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+1 CLASS_CLERIC:+3 CLASS_PALADIN:+2 CLASS_DRUID:+1'
      },
      { 
        text: 'By trusting my instincts.',
        text_DE: 'Indem ich meinen Instinkten vertraue.',
        modifiers: 'RACE_ELF:+1 RACE_HALFORC:+1 CLASS_RANGER:+2 CLASS_DRUID:+2 CLASS_BARBARIAN:+2 CLASS_SORCERER:+2'
      },
      { 
        text: 'By working with others.',
        text_DE: 'Indem ich mit anderen zusammenarbeite.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 CLASS_BARD:+2 CLASS_CLERIC:+2 CLASS_PALADIN:+1'
      }
    ]
  },
  {
    text: 'What is your greatest strength?',
    text_DE: 'Was ist deine größte Stärke?',
    answers: [
      { 
        text: 'My intelligence.',
        text_DE: 'Meine Intelligenz.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 RACE_ORC:-2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'My physical strength.',
        text_DE: 'Meine körperliche Stärke.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 RACE_DWARF:+1 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+2'
      },
      { 
        text: 'My agility.',
        text_DE: 'Meine Beweglichkeit.',
        modifiers: 'RACE_ELF:+2 RACE_HALFLING:+2 RACE_DWARF:-1 CLASS_ROGUE:+3 CLASS_RANGER:+2 CLASS_MONK:+2'
      },
      { 
        text: 'My charisma.',
        text_DE: 'Meine Ausstrahlung.',
        modifiers: 'RACE_HALFELF:+2 RACE_HUMAN:+1 RACE_DWARF:-1 CLASS_BARD:+3 CLASS_PALADIN:+1 CLASS_SORCERER:+2'
      },
      { 
        text: 'My wisdom.',
        text_DE: 'Meine Weisheit.',
        modifiers: 'RACE_ELF:+1 RACE_DWARF:+1 CLASS_CLERIC:+3 CLASS_DRUID:+3 CLASS_MONK:+2'
      },
      { 
        text: 'My endurance.',
        text_DE: 'Meine Ausdauer.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFLING:+1 RACE_HUMAN:+1 CLASS_FIGHTER:+2 CLASS_RANGER:+2'
      }
    ]
  },
  {
    text: 'What motivates you to adventure?',
    text_DE: 'Was motiviert dich zum Abenteuer?',
    answers: [
      { 
        text: 'The pursuit of knowledge.',
        text_DE: 'Das Streben nach Wissen.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'To protect the innocent.',
        text_DE: 'Um die Unschuldigen zu beschützen.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+1 CLASS_PALADIN:+3 CLASS_CLERIC:+2 CLASS_FIGHTER:+1'
      },
      { 
        text: 'For fame and glory.',
        text_DE: 'Für Ruhm und Ehre.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFORC:+1 CLASS_FIGHTER:+2 CLASS_BARD:+2 CLASS_BARBARIAN:+1'
      },
      { 
        text: 'To find treasure.',
        text_DE: 'Um Schätze zu finden.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+2 RACE_HALFLING:+1 CLASS_ROGUE:+3 CLASS_RANGER:+1'
      },
      { 
        text: 'To explore new places.',
        text_DE: 'Um neue Orte zu erkunden.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+2 RACE_HUMAN:+1 CLASS_RANGER:+3 CLASS_DRUID:+2 CLASS_BARD:+2'
      },
      { 
        text: 'To prove myself.',
        text_DE: 'Um mich zu beweisen.',
        modifiers: 'RACE_HALFORC:+2 RACE_GNOME:+1 RACE_HUMAN:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+2 CLASS_MONK:+1'
      }
    ]
  },
  {
    text: 'How do you prefer to fight?',
    text_DE: 'Wie kämpfst du am liebsten?',
    answers: [
      { 
        text: 'With sword and shield.',
        text_DE: 'Mit Schwert und Schild.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+2 CLASS_FIGHTER:+3 CLASS_PALADIN:+2'
      },
      { 
        text: 'With magic spells.',
        text_DE: 'Mit Zaubern.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 RACE_ORC:-2 CLASS_WIZARD:+3 CLASS_SORCERER:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'From the shadows.',
        text_DE: 'Aus dem Schatten heraus.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+2 CLASS_ROGUE:+3 CLASS_RANGER:+1'
      },
      { 
        text: 'With raw fury.',
        text_DE: 'Mit roher Wut.',
        modifiers: 'RACE_ORC:+3 RACE_HALFORC:+2 RACE_DWARF:+1 CLASS_BARBARIAN:+3'
      },
      { 
        text: 'With bow and arrows.',
        text_DE: 'Mit Bogen und Pfeilen.',
        modifiers: 'RACE_ELF:+3 RACE_HUMAN:+1 CLASS_RANGER:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'I avoid fighting.',
        text_DE: 'Ich vermeide Kämpfe.',
        modifiers: 'RACE_GNOME:+1 RACE_HALFLING:+1 CLASS_BARD:+2 CLASS_CLERIC:+1 CLASS_DRUID:+1'
      }
    ]
  },
  {
    text: 'What is your ideal home?',
    text_DE: 'Was ist dein ideales Zuhause?',
    answers: [
      { 
        text: 'A tower filled with books.',
        text_DE: 'Ein Turm voller Bücher.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'A fortress protecting others.',
        text_DE: 'Eine Festung, die andere beschützt.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+2 CLASS_FIGHTER:+2 CLASS_PALADIN:+3'
      },
      { 
        text: 'A cozy cottage.',
        text_DE: 'Ein gemütliches Häuschen.',
        modifiers: 'RACE_HALFLING:+3 RACE_GNOME:+1 CLASS_CLERIC:+1 CLASS_DRUID:+1'
      },
      { 
        text: 'A cave in the mountains.',
        text_DE: 'Eine Höhle in den Bergen.',
        modifiers: 'RACE_DWARF:+3 RACE_ORC:+1 RACE_HALFORC:+1 CLASS_BARBARIAN:+2 CLASS_MONK:+1'
      },
      { 
        text: 'A tree house in the forest.',
        text_DE: 'Ein Baumhaus im Wald.',
        modifiers: 'RACE_ELF:+3 RACE_HALFLING:+1 CLASS_DRUID:+3 CLASS_RANGER:+2'
      },
      { 
        text: 'I don\'t need a home, I\'m always traveling.',
        text_DE: 'Ich brauche kein Zuhause, ich bin immer unterwegs.',
        modifiers: 'RACE_HALFELF:+2 RACE_HUMAN:+1 CLASS_BARD:+3 CLASS_RANGER:+2 CLASS_ROGUE:+2'
      }
    ]
  },
  {
    text: 'What do you do in your free time?',
    text_DE: 'Was machst du in deiner Freizeit?',
    answers: [
      { 
        text: 'Read and study.',
        text_DE: 'Lesen und studieren.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 RACE_ORC:-2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Practice combat skills.',
        text_DE: 'Kampffertigkeiten üben.',
        modifiers: 'RACE_DWARF:+1 RACE_HALFORC:+1 CLASS_FIGHTER:+3 CLASS_PALADIN:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Explore nature.',
        text_DE: 'Die Natur erkunden.',
        modifiers: 'RACE_ELF:+2 RACE_HALFLING:+1 CLASS_DRUID:+3 CLASS_RANGER:+3'
      },
      { 
        text: 'Socialize and tell stories.',
        text_DE: 'Gesellig sein und Geschichten erzählen.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 RACE_HALFELF:+1 CLASS_BARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Craft and tinker.',
        text_DE: 'Basteln und tüfteln.',
        modifiers: 'RACE_DWARF:+2 RACE_GNOME:+3 CLASS_WIZARD:+1 CLASS_CLERIC:+1'
      },
      { 
        text: 'Meditate and reflect.',
        text_DE: 'Meditieren und nachdenken.',
        modifiers: 'RACE_ELF:+1 CLASS_MONK:+3 CLASS_DRUID:+2 CLASS_CLERIC:+2'
      }
    ]
  },
  {
    text: 'What is your biggest fear?',
    text_DE: 'Was ist deine größte Angst?',
    answers: [
      { 
        text: 'Being forgotten.',
        text_DE: 'Vergessen zu werden.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+1 CLASS_BARD:+2 CLASS_FIGHTER:+1'
      },
      { 
        text: 'Losing control.',
        text_DE: 'Die Kontrolle zu verlieren.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+1 CLASS_WIZARD:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Being trapped or confined.',
        text_DE: 'Gefangen oder eingesperrt zu sein.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+1 CLASS_RANGER:+2 CLASS_DRUID:+2 CLASS_BARBARIAN:+2'
      },
      { 
        text: 'Failing those I protect.',
        text_DE: 'Diejenigen im Stich zu lassen, die ich beschütze.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+2 CLASS_PALADIN:+3 CLASS_CLERIC:+2 CLASS_FIGHTER:+1'
      },
      { 
        text: 'Being powerless.',
        text_DE: 'Machtlos zu sein.',
        modifiers: 'RACE_HALFORC:+2 RACE_GNOME:+1 CLASS_BARBARIAN:+2 CLASS_SORCERER:+2 CLASS_WIZARD:+2'
      },
      { 
        text: 'Darkness and the unknown.',
        text_DE: 'Dunkelheit und das Unbekannte.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_CLERIC:+2 CLASS_PALADIN:+1'
      }
    ]
  },
  {
    text: 'How do you make decisions?',
    text_DE: 'Wie triffst du Entscheidungen?',
    answers: [
      { 
        text: 'Through careful analysis.',
        text_DE: 'Durch sorgfältige Analyse.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'By following my moral code.',
        text_DE: 'Indem ich meinem moralischen Kodex folge.',
        modifiers: 'RACE_DWARF:+2 RACE_HUMAN:+1 CLASS_PALADIN:+3 CLASS_CLERIC:+2 CLASS_MONK:+1'
      },
      { 
        text: 'Based on gut feeling.',
        text_DE: 'Basierend auf Bauchgefühl.',
        modifiers: 'RACE_HALFORC:+2 RACE_HALFLING:+1 CLASS_BARBARIAN:+2 CLASS_SORCERER:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'By considering what\'s best for everyone.',
        text_DE: 'Indem ich bedenke, was für alle am besten ist.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+2 CLASS_CLERIC:+2 CLASS_BARD:+2 CLASS_DRUID:+1'
      },
      { 
        text: 'Quickly and decisively.',
        text_DE: 'Schnell und entschlossen.',
        modifiers: 'RACE_ORC:+2 RACE_HUMAN:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+2 CLASS_ROGUE:+1'
      },
      { 
        text: 'After seeking advice.',
        text_DE: 'Nachdem ich Rat gesucht habe.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_CLERIC:+2'
      }
    ]
  },
  {
    text: 'What role do you take in a group?',
    text_DE: 'Welche Rolle übernimmst du in einer Gruppe?',
    answers: [
      { 
        text: 'The leader.',
        text_DE: 'Der Anführer.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+1 CLASS_PALADIN:+2 CLASS_FIGHTER:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'The protector.',
        text_DE: 'Der Beschützer.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFORC:+1 CLASS_FIGHTER:+3 CLASS_PALADIN:+2'
      },
      { 
        text: 'The strategist.',
        text_DE: 'Der Stratege.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'The scout.',
        text_DE: 'Der Späher.',
        modifiers: 'RACE_ELF:+2 RACE_HALFLING:+2 CLASS_RANGER:+3 CLASS_ROGUE:+2'
      },
      { 
        text: 'The diplomat.',
        text_DE: 'Der Diplomat.',
        modifiers: 'RACE_HALFELF:+3 RACE_HUMAN:+1 CLASS_BARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'The supporter.',
        text_DE: 'Der Unterstützer.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_CLERIC:+3 CLASS_BARD:+2 CLASS_DRUID:+1'
      }
    ]
  },
  {
    text: 'What would you do if you found a lost treasure?',
    text_DE: 'Was würdest du tun, wenn du einen verlorenen Schatz findest?',
    answers: [
      { 
        text: 'Return it to its rightful owner.',
        text_DE: 'Ihn seinem rechtmäßigen Besitzer zurückgeben.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFLING:+2 CLASS_PALADIN:+3 CLASS_CLERIC:+2'
      },
      { 
        text: 'Keep it for myself.',
        text_DE: 'Ihn für mich behalten.',
        modifiers: 'RACE_HUMAN:+1 CLASS_ROGUE:+2 CLASS_SORCERER:+1'
      },
      { 
        text: 'Share it with my companions.',
        text_DE: 'Ihn mit meinen Gefährten teilen.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 CLASS_FIGHTER:+2 CLASS_BARD:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'Donate it to those in need.',
        text_DE: 'Ihn den Bedürftigen spenden.',
        modifiers: 'RACE_HALFELF:+1 RACE_HUMAN:+1 CLASS_CLERIC:+3 CLASS_PALADIN:+2 CLASS_DRUID:+1'
      },
      { 
        text: 'Study it to learn its history.',
        text_DE: 'Ihn studieren, um seine Geschichte zu erfahren.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Use it to gain power.',
        text_DE: 'Ihn nutzen, um Macht zu erlangen.',
        modifiers: 'RACE_HALFORC:+1 RACE_HUMAN:+1 CLASS_SORCERER:+2 CLASS_WIZARD:+1'
      }
    ]
  },
  {
    text: 'How do you view authority?',
    text_DE: 'Wie siehst du Autorität?',
    answers: [
      { 
        text: 'It must be respected and obeyed.',
        text_DE: 'Sie muss respektiert und befolgt werden.',
        modifiers: 'RACE_DWARF:+2 RACE_HUMAN:+1 CLASS_PALADIN:+3 CLASS_FIGHTER:+2 CLASS_CLERIC:+2'
      },
      { 
        text: 'It should be questioned and challenged.',
        text_DE: 'Sie sollte hinterfragt und herausgefordert werden.',
        modifiers: 'RACE_ELF:+1 RACE_HALFELF:+1 CLASS_BARBARIAN:+2 CLASS_ROGUE:+2 CLASS_BARD:+1'
      },
      { 
        text: 'It\'s necessary but not absolute.',
        text_DE: 'Sie ist notwendig, aber nicht absolut.',
        modifiers: 'RACE_HUMAN:+2 RACE_GNOME:+1 CLASS_CLERIC:+1 CLASS_WIZARD:+1'
      },
      { 
        text: 'I prefer to be my own authority.',
        text_DE: 'Ich ziehe es vor, meine eigene Autorität zu sein.',
        modifiers: 'RACE_ELF:+1 RACE_HALFORC:+2 CLASS_RANGER:+2 CLASS_DRUID:+2 CLASS_SORCERER:+2'
      },
      { 
        text: 'True authority comes from wisdom.',
        text_DE: 'Wahre Autorität kommt von Weisheit.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+1 CLASS_DRUID:+2 CLASS_CLERIC:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Might makes right.',
        text_DE: 'Macht schafft Recht.',
        modifiers: 'RACE_ORC:+3 RACE_HALFORC:+2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+1'
      }
    ]
  },
  {
    text: 'What is your approach to magic?',
    text_DE: 'Wie ist deine Einstellung zur Magie?',
    answers: [
      { 
        text: 'Magic should be studied and understood.',
        text_DE: 'Magie sollte studiert und verstanden werden.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3'
      },
      { 
        text: 'Magic is a divine gift.',
        text_DE: 'Magie ist ein göttliches Geschenk.',
        modifiers: 'RACE_HUMAN:+1 CLASS_CLERIC:+3 CLASS_PALADIN:+2'
      },
      { 
        text: 'Magic is natural and should flow freely.',
        text_DE: 'Magie ist natürlich und sollte frei fließen.',
        modifiers: 'RACE_ELF:+1 CLASS_DRUID:+3 CLASS_SORCERER:+2'
      },
      { 
        text: 'Magic is dangerous and unpredictable.',
        text_DE: 'Magie ist gefährlich und unberechenbar.',
        modifiers: 'RACE_DWARF:+1 RACE_HALFLING:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+2'
      },
      { 
        text: 'Magic is a tool like any other.',
        text_DE: 'Magie ist ein Werkzeug wie jedes andere.',
        modifiers: 'RACE_HUMAN:+1 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'I don\'t trust magic.',
        text_DE: 'Ich vertraue der Magie nicht.',
        modifiers: 'RACE_DWARF:+2 RACE_ORC:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+3 CLASS_MONK:+1'
      }
    ]
  },
  {
    text: 'How do you handle betrayal?',
    text_DE: 'Wie gehst du mit Verrat um?',
    answers: [
      { 
        text: 'Seek justice through proper channels.',
        text_DE: 'Gerechtigkeit durch die richtigen Kanäle suchen.',
        modifiers: 'RACE_DWARF:+2 RACE_HUMAN:+1 CLASS_PALADIN:+3 CLASS_CLERIC:+2'
      },
      { 
        text: 'Take immediate revenge.',
        text_DE: 'Sofortige Rache nehmen.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'Try to understand why they did it.',
        text_DE: 'Versuchen zu verstehen, warum sie es getan haben.',
        modifiers: 'RACE_HALFELF:+2 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_CLERIC:+2 CLASS_DRUID:+1'
      },
      { 
        text: 'Forgive but never forget.',
        text_DE: 'Vergeben, aber niemals vergessen.',
        modifiers: 'RACE_ELF:+1 RACE_HUMAN:+1 CLASS_CLERIC:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Cut them out of my life completely.',
        text_DE: 'Sie komplett aus meinem Leben streichen.',
        modifiers: 'RACE_DWARF:+1 RACE_ELF:+1 CLASS_RANGER:+2 CLASS_ROGUE:+2'
      },
      { 
        text: 'Plan a careful, calculated response.',
        text_DE: 'Eine sorgfältige, kalkulierte Antwort planen.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+1 CLASS_WIZARD:+2 CLASS_ROGUE:+3'
      }
    ]
  },
  {
    text: 'What is your ideal adventure?',
    text_DE: 'Was ist dein ideales Abenteuer?',
    answers: [
      { 
        text: 'Exploring ancient ruins and uncovering lost knowledge.',
        text_DE: 'Alte Ruinen erforschen und verlorenes Wissen aufdecken.',
        modifiers: 'RACE_ELF:+2 RACE_HUMAN:+1 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Protecting a village from monsters.',
        text_DE: 'Ein Dorf vor Monstern beschützen.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+1 CLASS_PALADIN:+3 CLASS_FIGHTER:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'Infiltrating an enemy stronghold.',
        text_DE: 'Eine feindliche Festung infiltrieren.',
        modifiers: 'RACE_HALFLING:+2 RACE_ELF:+1 CLASS_ROGUE:+3 CLASS_RANGER:+1'
      },
      { 
        text: 'Surviving in the wilderness.',
        text_DE: 'In der Wildnis überleben.',
        modifiers: 'RACE_ELF:+1 RACE_HALFORC:+2 CLASS_DRUID:+3 CLASS_RANGER:+3 CLASS_BARBARIAN:+2'
      },
      { 
        text: 'Negotiating peace between warring factions.',
        text_DE: 'Frieden zwischen verfeindeten Fraktionen aushandeln.',
        modifiers: 'RACE_HALFELF:+3 RACE_HUMAN:+2 CLASS_BARD:+3 CLASS_CLERIC:+2'
      },
      { 
        text: 'Conquering a great challenge through strength.',
        text_DE: 'Eine große Herausforderung durch Stärke bewältigen.',
        modifiers: 'RACE_ORC:+2 RACE_DWARF:+2 RACE_HALFORC:+1 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+2'
      }
    ]
  },
  {
    text: 'How do you view death?',
    text_DE: 'Wie siehst du den Tod?',
    answers: [
      { 
        text: 'As a natural part of life\'s cycle.',
        text_DE: 'Als natürlichen Teil des Lebenszyklus.',
        modifiers: 'RACE_ELF:+2 RACE_DWARF:+1 CLASS_DRUID:+3 CLASS_CLERIC:+2 CLASS_MONK:+2'
      },
      { 
        text: 'As something to be fought against.',
        text_DE: 'Als etwas, wogegen gekämpft werden muss.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFORC:+1 CLASS_PALADIN:+2 CLASS_CLERIC:+2 CLASS_FIGHTER:+1'
      },
      { 
        text: 'As the ultimate mystery to solve.',
        text_DE: 'Als ultimatives Geheimnis, das es zu lösen gilt.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'As something that gives life meaning.',
        text_DE: 'Als etwas, das dem Leben Bedeutung gibt.',
        modifiers: 'RACE_HUMAN:+1 RACE_ELF:+1 CLASS_MONK:+3 CLASS_CLERIC:+2'
      },
      { 
        text: 'As an enemy to be defeated.',
        text_DE: 'Als Feind, der besiegt werden muss.',
        modifiers: 'RACE_DWARF:+1 RACE_HALFORC:+1 CLASS_BARBARIAN:+2 CLASS_PALADIN:+2 CLASS_FIGHTER:+2'
      },
      { 
        text: 'I try not to think about it.',
        text_DE: 'Ich versuche, nicht daran zu denken.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_ROGUE:+1'
      }
    ]
  },
  {
    text: 'What drives your personal growth?',
    text_DE: 'Was treibt dein persönliches Wachstum an?',
    answers: [
      { 
        text: 'The pursuit of knowledge and wisdom.',
        text_DE: 'Das Streben nach Wissen und Weisheit.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1 CLASS_DRUID:+1'
      },
      { 
        text: 'Overcoming greater challenges.',
        text_DE: 'Größere Herausforderungen überwinden.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFORC:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Helping others and making a difference.',
        text_DE: 'Anderen helfen und etwas bewirken.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 RACE_HALFELF:+1 CLASS_CLERIC:+3 CLASS_PALADIN:+2 CLASS_BARD:+1'
      },
      { 
        text: 'Mastering new skills and abilities.',
        text_DE: 'Neue Fähigkeiten und Fertigkeiten meistern.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+2 RACE_HUMAN:+1 CLASS_MONK:+2 CLASS_RANGER:+2 CLASS_ROGUE:+2'
      },
      { 
        text: 'Understanding my place in the world.',
        text_DE: 'Meinen Platz in der Welt verstehen.',
        modifiers: 'RACE_HALFELF:+2 RACE_HALFORC:+2 CLASS_DRUID:+2 CLASS_CLERIC:+2 CLASS_MONK:+1'
      },
      { 
        text: 'Gaining recognition and respect.',
        text_DE: 'Anerkennung und Respekt erlangen.',
        modifiers: 'RACE_HUMAN:+1 RACE_DWARF:+1 CLASS_BARD:+2 CLASS_FIGHTER:+1 CLASS_PALADIN:+1'
      }
    ]
  },
  {
    text: 'How do you handle failure?',
    text_DE: 'Wie gehst du mit Scheitern um?',
    answers: [
      { 
        text: 'Learn from it and try again.',
        text_DE: 'Daraus lernen und es erneut versuchen.',
        modifiers: 'RACE_HUMAN:+2 RACE_GNOME:+2 CLASS_WIZARD:+2 CLASS_MONK:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'Get angry and push harder.',
        text_DE: 'Wütend werden und härter kämpfen.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 RACE_DWARF:+1 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'Accept it as part of a larger plan.',
        text_DE: 'Es als Teil eines größeren Plans akzeptieren.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+1 CLASS_CLERIC:+3 CLASS_DRUID:+2 CLASS_MONK:+2'
      },
      { 
        text: 'Analyze what went wrong.',
        text_DE: 'Analysieren, was schiefgelaufen ist.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Seek comfort from friends.',
        text_DE: 'Trost bei Freunden suchen.',
        modifiers: 'RACE_HALFLING:+2 RACE_HALFELF:+2 CLASS_BARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Retreat and regroup.',
        text_DE: 'Sich zurückziehen und neu formieren.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+1 CLASS_RANGER:+2 CLASS_ROGUE:+2 CLASS_DRUID:+1'
      }
    ]
  },
  {
    text: 'What is your relationship with nature?',
    text_DE: 'Wie ist dein Verhältnis zur Natur?',
    answers: [
      { 
        text: 'I am one with nature.',
        text_DE: 'Ich bin eins mit der Natur.',
        modifiers: 'RACE_ELF:+3 CLASS_DRUID:+3 CLASS_RANGER:+2'
      },
      { 
        text: 'Nature is to be respected and protected.',
        text_DE: 'Die Natur ist zu respektieren und zu schützen.',
        modifiers: 'RACE_ELF:+2 RACE_HALFLING:+1 CLASS_DRUID:+2 CLASS_RANGER:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Nature is a resource to be used wisely.',
        text_DE: 'Die Natur ist eine Ressource, die weise genutzt werden sollte.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+1 RACE_GNOME:+1 CLASS_CLERIC:+1 CLASS_WIZARD:+1'
      },
      { 
        text: 'Nature is beautiful but dangerous.',
        text_DE: 'Die Natur ist schön, aber gefährlich.',
        modifiers: 'RACE_HUMAN:+1 RACE_HALFLING:+1 CLASS_FIGHTER:+1 CLASS_ROGUE:+1'
      },
      { 
        text: 'I prefer civilization to wilderness.',
        text_DE: 'Ich bevorzuge die Zivilisation gegenüber der Wildnis.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+1 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_ROGUE:+1'
      },
      { 
        text: 'Nature is something to be conquered.',
        text_DE: 'Die Natur ist etwas, das erobert werden muss.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+1 CLASS_BARBARIAN:+1 CLASS_FIGHTER:+1'
      }
    ]
  },
  {
    text: 'How do you approach new situations?',
    text_DE: 'Wie gehst du an neue Situationen heran?',
    answers: [
      { 
        text: 'With careful planning and preparation.',
        text_DE: 'Mit sorgfältiger Planung und Vorbereitung.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 RACE_DWARF:+1 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'With enthusiasm and optimism.',
        text_DE: 'Mit Begeisterung und Optimismus.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 CLASS_BARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'With caution and skepticism.',
        text_DE: 'Mit Vorsicht und Skepsis.',
        modifiers: 'RACE_DWARF:+2 RACE_GNOME:+1 RACE_HALFLING:+1 CLASS_ROGUE:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'By charging in headfirst.',
        text_DE: 'Indem ich kopfüber hineinstürze.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'By observing first, then acting.',
        text_DE: 'Indem ich erst beobachte, dann handle.',
        modifiers: 'RACE_ELF:+2 RACE_HALFELF:+1 CLASS_RANGER:+2 CLASS_ROGUE:+2 CLASS_MONK:+2'
      },
      { 
        text: 'By seeking guidance from others.',
        text_DE: 'Indem ich Führung von anderen suche.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_CLERIC:+3'
      }
    ]
  },
  {
    text: 'What legacy do you want to leave behind?',
    text_DE: 'Welches Erbe möchtest du hinterlassen?',
    answers: [
      { 
        text: 'A body of knowledge that helps others.',
        text_DE: 'Ein Wissensschatz, der anderen hilft.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+3 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'A safer world for future generations.',
        text_DE: 'Eine sicherere Welt für zukünftige Generationen.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+2 CLASS_PALADIN:+3 CLASS_FIGHTER:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'Great tales and inspiring stories.',
        text_DE: 'Große Geschichten und inspirierende Erzählungen.',
        modifiers: 'RACE_HUMAN:+1 RACE_HALFELF:+2 CLASS_BARD:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'A preserved natural world.',
        text_DE: 'Eine erhaltene natürliche Welt.',
        modifiers: 'RACE_ELF:+3 RACE_HALFLING:+1 CLASS_DRUID:+3 CLASS_RANGER:+2'
      },
      { 
        text: 'Wealth and prosperity for my family.',
        text_DE: 'Wohlstand und Prosperität für meine Familie.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFLING:+2 RACE_HUMAN:+1 CLASS_ROGUE:+1 CLASS_FIGHTER:+1'
      },
      { 
        text: 'The memory of great victories.',
        text_DE: 'Die Erinnerung an große Siege.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+1 RACE_HUMAN:+1 CLASS_BARBARIAN:+2 CLASS_FIGHTER:+2'
      }
    ]
  },
  {
    text: 'How do you deal with boredom?',
    text_DE: 'Wie gehst du mit Langeweile um?',
    answers: [
      { 
        text: 'Study something new.',
        text_DE: 'Etwas Neues studieren.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Practice my skills.',
        text_DE: 'Meine Fertigkeiten üben.',
        modifiers: 'RACE_DWARF:+1 RACE_ELF:+1 CLASS_FIGHTER:+2 CLASS_MONK:+3 CLASS_RANGER:+2'
      },
      { 
        text: 'Seek out adventure.',
        text_DE: 'Abenteuer suchen.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+1 CLASS_RANGER:+2 CLASS_ROGUE:+2 CLASS_BARD:+2'
      },
      { 
        text: 'Socialize with friends.',
        text_DE: 'Mit Freunden gesellig sein.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFLING:+2 RACE_HALFELF:+1 CLASS_BARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Work on a craft or hobby.',
        text_DE: 'An einem Handwerk oder Hobby arbeiten.',
        modifiers: 'RACE_DWARF:+3 RACE_GNOME:+3 RACE_HALFLING:+1 CLASS_CLERIC:+1'
      },
      { 
        text: 'Find a fight or challenge.',
        text_DE: 'Einen Kampf oder eine Herausforderung suchen.',
        modifiers: 'RACE_ORC:+3 RACE_HALFORC:+2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+2'
      }
    ]
  },
  {
    text: 'What is your greatest weakness?',
    text_DE: 'Was ist deine größte Schwäche?',
    answers: [
      { 
        text: 'I overthink everything.',
        text_DE: 'Ich denke über alles zu viel nach.',
        modifiers: 'RACE_ELF:+1 RACE_GNOME:+2 CLASS_WIZARD:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'I act without thinking.',
        text_DE: 'Ich handle ohne zu denken.',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+2 CLASS_BARBARIAN:+3 CLASS_FIGHTER:+1'
      },
      { 
        text: 'I trust too easily.',
        text_DE: 'Ich vertraue zu leicht.',
        modifiers: 'RACE_HALFLING:+2 RACE_HUMAN:+1 CLASS_CLERIC:+2 CLASS_BARD:+1'
      },
      { 
        text: 'I\'m too suspicious of others.',
        text_DE: 'Ich bin anderen gegenüber zu misstrauisch.',
        modifiers: 'RACE_DWARF:+2 RACE_ELF:+1 CLASS_ROGUE:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'I\'m too proud.',
        text_DE: 'Ich bin zu stolz.',
        modifiers: 'RACE_ELF:+1 RACE_DWARF:+1 RACE_HALFORC:+1 CLASS_PALADIN:+2 CLASS_WIZARD:+1'
      },
      { 
        text: 'I avoid conflict.',
        text_DE: 'Ich vermeide Konflikte.',
        modifiers: 'RACE_HALFLING:+2 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_DRUID:+1 CLASS_CLERIC:+1'
      }
    ]
  },
  {
    text: 'How do you show affection?',
    text_DE: 'Wie zeigst du Zuneigung?',
    answers: [
      { 
        text: 'Through acts of service.',
        text_DE: 'Durch Hilfsbereitschaft.',
        modifiers: 'RACE_DWARF:+2 RACE_HALFLING:+2 CLASS_CLERIC:+2 CLASS_PALADIN:+1 CLASS_FIGHTER:+1'
      },
      { 
        text: 'With words of encouragement.',
        text_DE: 'Mit ermutigenden Worten.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+2 CLASS_BARD:+3 CLASS_CLERIC:+2'
      },
      { 
        text: 'By sharing knowledge.',
        text_DE: 'Indem ich Wissen teile.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 CLASS_WIZARD:+3 CLASS_CLERIC:+1'
      },
      { 
        text: 'Through physical touch.',
        text_DE: 'Durch körperliche Berührung.',
        modifiers: 'RACE_HALFLING:+2 RACE_HUMAN:+1 CLASS_MONK:+2 CLASS_BARBARIAN:+1'
      },
      { 
        text: 'By giving gifts.',
        text_DE: 'Indem ich Geschenke mache.',
        modifiers: 'RACE_DWARF:+2 RACE_GNOME:+1 RACE_HALFLING:+1 CLASS_ROGUE:+1'
      },
      { 
        text: 'I have trouble showing affection.',
        text_DE: 'Ich tue mich schwer damit, Zuneigung zu zeigen.',
        modifiers: 'RACE_ORC:+1 RACE_ELF:+1 CLASS_RANGER:+1 CLASS_ROGUE:+1'
      }
    ]
  },
  {
    text: 'What motivates you most?',
    text_DE: 'Was motiviert dich am meisten?',
    answers: [
      { 
        text: 'The thrill of discovery.',
        text_DE: 'Der Nervenkitzel der Entdeckung.',
        modifiers: 'RACE_ELF:+2 RACE_GNOME:+2 RACE_HUMAN:+1 CLASS_WIZARD:+2 CLASS_RANGER:+2 CLASS_BARD:+1'
      },
      { 
        text: 'Protecting those I care about.',
        text_DE: 'Die zu beschützen, die mir wichtig sind.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+2 RACE_HALFLING:+1 CLASS_PALADIN:+3 CLASS_FIGHTER:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'Proving my worth.',
        text_DE: 'Meinen Wert zu beweisen.',
        modifiers: 'RACE_HALFORC:+3 RACE_GNOME:+1 RACE_HUMAN:+1 CLASS_FIGHTER:+2 CLASS_BARBARIAN:+2'
      },
      { 
        text: 'Making the world better.',
        text_DE: 'Die Welt besser zu machen.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+2 CLASS_CLERIC:+3 CLASS_PALADIN:+2 CLASS_DRUID:+2'
      },
      { 
        text: 'Personal freedom.',
        text_DE: 'Persönliche Freiheit.',
        modifiers: 'RACE_ELF:+2 RACE_HALFELF:+1 CLASS_RANGER:+3 CLASS_DRUID:+2 CLASS_BARD:+2 CLASS_ROGUE:+2'
      },
      { 
        text: 'The challenge itself.',
        text_DE: 'Die Herausforderung selbst.',
        modifiers: 'RACE_DWARF:+1 RACE_ORC:+2 RACE_HALFORC:+1 CLASS_BARBARIAN:+2 CLASS_FIGHTER:+2 CLASS_MONK:+2'
      }
    ]
  },
  {
    text: 'How do you prefer to travel?',
    text_DE: 'Wie reist du am liebsten?',
    answers: [
      { 
        text: 'On foot through nature.',
        text_DE: 'Zu Fuß durch die Natur.',
        modifiers: 'RACE_ELF:+2 RACE_HALFLING:+1 CLASS_DRUID:+3 CLASS_RANGER:+3 CLASS_MONK:+1'
      },
      { 
        text: 'With a group of trusted companions.',
        text_DE: 'Mit einer Gruppe vertrauter Gefährten.',
        modifiers: 'RACE_HUMAN:+2 RACE_DWARF:+2 RACE_HALFLING:+1 CLASS_FIGHTER:+2 CLASS_CLERIC:+2 CLASS_BARD:+2'
      },
      { 
        text: 'Quickly and efficiently by any means.',
        text_DE: 'Schnell und effizient mit allen verfügbaren Mitteln.',
        modifiers: 'RACE_HUMAN:+1 RACE_GNOME:+1 CLASS_ROGUE:+2 CLASS_WIZARD:+1'
      },
      { 
        text: 'In comfort and style.',
        text_DE: 'In Komfort und Stil.',
        modifiers: 'RACE_HALFELF:+1 RACE_GNOME:+1 CLASS_BARD:+2 CLASS_ROGUE:+1'
      },
      { 
        text: 'Alone and unnoticed.',
        text_DE: 'Allein und unbemerkt.',
        modifiers: 'RACE_ELF:+1 RACE_HALFLING:+1 CLASS_RANGER:+2 CLASS_ROGUE:+3 CLASS_DRUID:+1'
      },
      { 
        text: 'I don\'t like to travel.',
        text_DE: 'Ich reise nicht gerne.',
        modifiers: 'RACE_DWARF:+2 RACE_GNOME:+2 RACE_HALFLING:+1 CLASS_WIZARD:+1 CLASS_CLERIC:+1'
      }
    ]
  },
  {
    text: 'What do you think about rules?',
    text_DE: 'Was denkst du über Regeln?',
    answers: [
      { 
        text: 'Rules exist for good reasons and should be followed.',
        text_DE: 'Regeln existieren aus gutem Grund und sollten befolgt werden.',
        modifiers: 'RACE_DWARF:+3 RACE_HUMAN:+1 CLASS_PALADIN:+3 CLASS_CLERIC:+2 CLASS_FIGHTER:+2'
      },
      { 
        text: 'Rules are guidelines, not absolutes.',
        text_DE: 'Regeln sind Richtlinien, keine Absolute.',
        modifiers: 'RACE_HUMAN:+2 RACE_HALFELF:+2 CLASS_BARD:+2 CLASS_CLERIC:+1'
      },
      { 
        text: 'Rules are meant to be broken when necessary.',
        text_DE: 'Regeln sind da, um bei Bedarf gebrochen zu werden.',
        modifiers: 'RACE_ELF:+1 RACE_HALFELF:+1 CLASS_ROGUE:+3 CLASS_BARD:+2'
      },
      { 
        text: 'I make my own rules.',
        text_DE: 'Ich mache meine eigenen Regeln.',
        modifiers: 'RACE_HALFORC:+2 RACE_ORC:+2 CLASS_BARBARIAN:+3 CLASS_SORCERER:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'Natural law is more important than human rules.',
        text_DE: 'Naturgesetze sind wichtiger als menschliche Regeln.',
        modifiers: 'RACE_ELF:+2 CLASS_DRUID:+3 CLASS_RANGER:+2 CLASS_BARBARIAN:+1'
      },
      { 
        text: 'Rules should adapt to circumstances.',
        text_DE: 'Regeln sollten sich den Umständen anpassen.',
        modifiers: 'RACE_GNOME:+2 RACE_HALFLING:+1 CLASS_WIZARD:+2 CLASS_BARD:+2'
      }
    ]
  },
  {
    text: 'Where do you feel LEAST comfortable?',
    text_DE: 'Wo fühlst du dich am unwohlsten?',
    answers: [
      { 
        text: 'In a big city.',
        text_DE: 'In einer großen Stadt.',
        modifiers: 'RACE_HUMAN:-2 RACE_HALFELF:+1 RACE_ELF:+2 RACE_ORC:+2 RACE_HALFORC:+1 RACE_HALFLING:-2 RACE_GNOME:-1 RACE_DWARF:+2 CLASS_BARBARIAN:+1 CLASS_BARD:-1 CLASS_DRUID:+2 CLASS_SORCERER:-2 CLASS_FIGHTER:-1 CLASS_CLERIC:-1 CLASS_ROGUE:-2 CLASS_RANGER:+2'
      },
      { 
        text: 'Behind the walls of a church.',
        text_DE: 'Hinter den Mauern einer Kirche.',
        modifiers: 'CLASS_DRUID:+1 CLASS_CLERIC:-2 CLASS_MONK:-2 CLASS_PALADIN:-1 CLASS_ROGUE:+1'
      },
      { 
        text: 'Near mountains.',
        text_DE: 'In der Nähe von Bergen.',
        modifiers: 'RACE_ORC:-2 RACE_HALFORC:-1 RACE_HALFLING:+1 RACE_DWARF:-2'
      },
      { 
        text: 'In a library.',
        text_DE: 'In einer Bibliothek.',
        modifiers: 'RACE_ORC:+3 RACE_HALFORC:+2 RACE_DWARF:+1 RACE_GNOME:-1 RACE_ELF:-2 RACE_HALFELF:-1 CLASS_DRUID:+1 CLASS_BARBARIAN:+2 CLASS_FIGHTER:+1 CLASS_RANGER:+1 CLASS_WIZARD:-2 CLASS_SORCERER:-1 CLASS_CLERIC:-1'
      },
      { 
        text: 'In a forest clearing.',
        text_DE: 'Auf einer Waldlichtung.',
        modifiers: 'RACE_ELF:-2 RACE_HALFELF:-1 RACE_ORC:-1 RACE_HALFLING:+1 RACE_GNOME:+1 RACE_DWARF:+2 CLASS_DRUID:-2 CLASS_RANGER:-2 CLASS_BARBARIAN:-1 CLASS_BARD:+1 CLASS_ROGUE:+1'
      },
      { 
        text: 'By an evening beach.',
        text_DE: 'An einem abendlichen Strand.',
        modifiers: 'CLASS_MONK:-2 CLASS_SORCERER:-1 CLASS_BARD:-1 CLASS_ROGUE:-1'
      }
    ]
  },
  {
    text: 'Which of these professions would suit you best?',
    text_DE: 'Welcher dieser Berufe würde am ehesten zu dir passen?',
    answers: [
      { 
        text: 'Doctor.',
        text_DE: 'Arzt.',
        modifiers: 'ALIGN_LG:+2 CLASS_CLERIC:+2 CLASS_DRUID:+2 CLASS_RANGER:+1 CLASS_PALADIN:+1 CLASS_BARBARIAN:-2 CLASS_FIGHTER:-2 CLASS_ROGUE:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1'
      },
      { 
        text: 'Singer.',
        text_DE: 'Sänger.',
        modifiers: 'ALIGN_NG:+1 CLASS_BARD:+3 CLASS_BARBARIAN:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1 CLASS_ROGUE:-2'
      },
      { 
        text: 'Teacher.',
        text_DE: 'Lehrer.',
        modifiers: 'ALIGN_NG:+1 CLASS_BARD:+1 CLASS_BARBARIAN:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:+1 CLASS_WIZARD:+2 CLASS_ROGUE:-2 CLASS_MONK:+1 CLASS_DRUID:+2'
      },
      { 
        text: 'Assassin.',
        text_DE: 'Auftragskiller.',
        modifiers: 'ALIGN_NE:+1 ALIGN_LE:+2 ALIGN_CE:+1 ALIGN_NG:-2 CLASS_BARBARIAN:+2 CLASS_FIGHTER:+2 CLASS_ROGUE:+2 CLASS_MONK:+2 CLASS_SORCERER:+1 CLASS_WIZARD:+1'
      },
      { 
        text: 'Gardener.',
        text_DE: 'Gärtner.',
        modifiers: 'ALIGN_NG:+2 CLASS_DRUID:+3 CLASS_RANGER:+3 CLASS_PALADIN:+1 CLASS_SORCERER:+1 CLASS_WIZARD:+1 CLASS_FIGHTER:-2 CLASS_BARBARIAN:-1'
      },
      { 
        text: 'Police officer.',
        text_DE: 'Polizist.',
        modifiers: 'ALIGN_LG:+2 CLASS_PALADIN:+5 CLASS_ROGUE:-5'
      },
      { 
        text: 'Psychologist.',
        text_DE: 'Psychologe.',
        modifiers: 'ALIGN_NN:+2 CLASS_SORCERER:+3 CLASS_BARBARIAN:-3'
      },
      { 
        text: 'Chemist.',
        text_DE: 'Chemiker.',
        modifiers: 'CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_BARBARIAN:-4'
      }
    ]
  },
  {
    text: 'What is your favorite color?',
    text_DE: 'Was ist deine Lieblingsfarbe?',
    answers: [
      { 
        text: 'Red',
        text_DE: 'Rot',
        modifiers: ''
      },
      { 
        text: 'Green',
        text_DE: 'Grün',
        modifiers: 'CLASS_DRUID:+2 CLASS_RANGER:+2 CLASS_BARBARIAN:+1 RACE_ELF:+2 RACE_HALFELF:+1 RACE_HUMAN:+2'
      },
      { 
        text: 'Blue',
        text_DE: 'Blau',
        modifiers: 'RACE_HUMAN:+2 CLASS_CLERIC:+1 CLASS_ROGUE:+1 CLASS_SORCERER:+2'
      },
      { 
        text: 'White',
        text_DE: 'Weiß',
        modifiers: 'ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-1 CLASS_CLERIC:+2'
      },
      { 
        text: 'Black',
        text_DE: 'Schwarz',
        modifiers: 'ALIGN_NG:-1 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_CLERIC:+2'
      },
      { 
        text: 'Gray',
        text_DE: 'Grau',
        modifiers: 'ALIGN_NN:+3 RACE_DWARF:+3 CLASS_FIGHTER:+1 CLASS_ROGUE:+1 CLASS_BARD:-1 CLASS_SORCERER:+1'
      },
      { 
        text: 'Yellow',
        text_DE: 'Gelb',
        modifiers: 'CLASS_MONK:+1'
      },
      { 
        text: 'Brown',
        text_DE: 'Braun',
        modifiers: 'CLASS_BARBARIAN:+2 CLASS_DRUID:+2 CLASS_RANGER:+1'
      },
      { 
        text: 'Purple',
        text_DE: 'Violett',
        modifiers: ''
      },
      { 
        text: 'Pink',
        text_DE: 'Rosa',
        modifiers: 'RACE_ELF:+1 RACE_ORC:-3 RACE_HALFORC:-2 RACE_DWARF:-1 CLASS_BARBARIAN:-2 CLASS_PALADIN:-2 CLASS_BARD:+2'
      },
      { 
        text: 'Orange',
        text_DE: 'Orange',
        modifiers: 'RACE_GNOME:+1 CLASS_MONK:+1'
      },
      { 
        text: 'None of these',
        text_DE: 'Keine davon',
        modifiers: ''
      }
    ]
  },
  {
    text: 'Which color do you like LEAST?',
    text_DE: 'Welche Farbe magst du am wenigsten?',
    answers: [
      { 
        text: 'Red',
        text_DE: 'Rot',
        modifiers: 'RACE_ORC:-2 RACE_HALFORC:-1 CLASS_BARBARIAN:-2 CLASS_DRUID:-1'
      },
      { 
        text: 'Green',
        text_DE: 'Grün',
        modifiers: 'RACE_ELF:-2 RACE_HALFELF:-1 RACE_DWARF:+1 CLASS_FIGHTER:+1 CLASS_ROGUE:+2 CLASS_DRUID:-2 CLASS_RANGER:-2'
      },
      { 
        text: 'Blue',
        text_DE: 'Blau',
        modifiers: 'RACE_HUMAN:-2 CLASS_SORCERER:+2'
      },
      { 
        text: 'White',
        text_DE: 'Weiß',
        modifiers: 'ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_CLERIC:+2'
      },
      { 
        text: 'Black',
        text_DE: 'Schwarz',
        modifiers: 'ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-2 ALIGN_LE:-1 ALIGN_CE:-1'
      },
      { 
        text: 'Gray',
        text_DE: 'Grau',
        modifiers: 'ALIGN_NN:-1 RACE_GNOME:-1 RACE_DWARF:-1'
      },
      { 
        text: 'Yellow',
        text_DE: 'Gelb',
        modifiers: 'CLASS_MONK:-1'
      },
      { 
        text: 'Brown',
        text_DE: 'Braun',
        modifiers: 'RACE_ORC:-2 RACE_HALFORC:-1 CLASS_BARBARIAN:-2 CLASS_DRUID:-1'
      },
      { 
        text: 'Purple',
        text_DE: 'Violett',
        modifiers: 'RACE_ORC:+2 RACE_HALFORC:+1 CLASS_BARBARIAN:+3 CLASS_PALADIN:-1 CLASS_BARD:-2'
      },
      { 
        text: 'Pink',
        text_DE: 'Rosa',
        modifiers: 'RACE_ORC:+3 RACE_HALFORC:+2 CLASS_BARD:-2'
      },
      { 
        text: 'Orange',
        text_DE: 'Orange',
        modifiers: ''
      },
      { 
        text: 'None of these',
        text_DE: 'Keine davon',
        modifiers: ''
      }
    ]
  }
];

// Helper function to get localized questions
function getLocalizedQuestions(lang = 'en') {
  return Questions.map(question => {
    const localizedQuestion = {
      text: lang === 'de' && question.text_DE ? question.text_DE : question.text,
      answers: question.answers.map(answer => ({
        text: lang === 'de' && answer.text_DE ? answer.text_DE : answer.text,
        modifiers: answer.modifiers
      }))
    };
    return localizedQuestion;
  });
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
  window.Questions = Questions;
  window.getLocalizedQuestions = getLocalizedQuestions;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Questions, getLocalizedQuestions };
}