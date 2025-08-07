# »SynthelicZ« D&D Character Creator

A modern, interactive questionnaire that helps users discover their perfect Dungeons & Dragons character based on personality traits and preferences.

## 🎲 Features

### Modern User Interface
- **Card-based design** with smooth animations and transitions
- **Responsive layout** that works on desktop, tablet, and mobile
- **Progress indicators** showing advancement through the questionnaire
- **Interactive question cards** with hover effects and visual feedback
- **Beautiful loading screen** with animated dice

### Enhanced User Experience
- **Gamified interface** with RPG theming and character portraits
- **Keyboard navigation** support (arrow keys, number keys 1-6)
- **Accessibility features** including proper ARIA labels and focus management
- **Auto-save** functionality preserves answers when navigating back/forth
- **Visual results display** with character avatars and detailed analysis

### Character Creation System
- **12 thoughtful questions** covering preferences and personality traits
- **Multiple race combinations**: Human, Elf, Dwarf, Halfling, Orc, Gnome, Half-Elf, Half-Orc
- **Diverse class options**: Fighter, Wizard, Cleric, Rogue, Ranger, Bard, Druid, Barbarian, Monk, Paladin, Sorcerer
- **Scoring algorithm** that analyzes answers to recommend the best character match
- **Detailed results breakdown** showing race affinity and class alignment scores

## 🚀 How to Use

1. **Open** `index_new.html` in a web browser
2. **Click "Begin Your Quest"** to start the character creation process
3. **Answer questions** by clicking on your preferred options
4. **Navigate** using the Previous/Next buttons or keyboard shortcuts
5. **View your results** and see your recommended D&D character
6. **Share or restart** to try again with different answers

## 🛠️ Technical Implementation

### Architecture
- **Modern JavaScript ES6+** class-based architecture
- **Integration** with existing legacy engine.js system
- **Modular CSS** with custom properties for easy theming
- **Progressive enhancement** - works even if JavaScript fails

### File Structure
```
AskEngine/
├── index_new.html       # Modern interface entry point
├── modern-styles.css    # Modern CSS styling
├── modern-app.js        # Modern JavaScript controller
├── engine.js           # Legacy engine (preserved)
├── dnd/
│   ├── ruleset.js      # Character rules and scoring
│   └── questions.js    # Question database
└── README.md           # This file
```

### Browser Support
- **Modern browsers**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Mobile browsers**: iOS Safari 12+, Chrome Mobile 81+
- **Accessibility**: WCAG 2.1 AA compliant
- **Performance**: Optimized for fast loading and smooth animations

## 🎨 Design Features

### Visual Design
- **Gradient backgrounds** with modern color schemes
- **Glassmorphism effects** with backdrop filters and transparency
- **Smooth animations** and micro-interactions
- **Typography hierarchy** using system fonts for performance
- **Dark/light theme** support based on user preferences

### Interactive Elements
- **Hover animations** on all interactive components  
- **Focus indicators** for keyboard navigation
- **Loading states** and progress feedback
- **Button hover effects** with glowing animations
- **Character reveal** with floating avatar animation

### Responsive Breakpoints
- **Desktop**: 1200px+ (full layout with sidebar)
- **Tablet**: 768px-1199px (stacked layout)
- **Mobile**: <768px (single column, larger touch targets)

## 🧙‍♂️ Character Combinations

The system can recommend various character combinations including:

| Race | Best Classes | Description |
|------|--------------|-------------|
| **Human** | Fighter, Wizard, Cleric | Versatile and adaptable |
| **Elf** | Ranger, Wizard, Druid | Graceful and magical |
| **Dwarf** | Fighter, Cleric | Sturdy and resilient |
| **Halfling** | Rogue, Bard | Small but cunning |
| **Orc** | Barbarian, Fighter | Strong and fierce |
| **Gnome** | Wizard, Sorcerer | Clever and curious |
| **Half-Elf** | Bard, Ranger | Charismatic bridge between worlds |
| **Half-Orc** | Barbarian, Fighter | Conflicted but powerful |

## 🔧 Customization

### Adding New Questions
Edit `dnd/questions.js` and add new question objects following the existing pattern:

```javascript
Engine_addQuestion('Your question text here?');
Engine_addAnswer('Answer option 1');
Engine_setModifiers('RACE_HUMAN:+2 CLASS_FIGHTER:+1');
Engine_addAnswer('Answer option 2');
Engine_setModifiers('RACE_ELF:+2 CLASS_WIZARD:+1');
```

### Styling Customization
Modify CSS custom properties in `modern-styles.css`:

```css
:root {
  --primary: #8b5cf6;        /* Primary brand color */
  --secondary: #f59e0b;      /* Secondary accent color */
  --bg-primary: #ffffff;     /* Main background */
  /* ... more variables */
}
```

### Character Data
Update character descriptions and avatars in `modern-app.js`:

```javascript
const combinations = {
  'human_fighter': { 
    avatar: '⚔️', 
    description: 'Your custom description here' 
  }
};
```

## 📱 Mobile Experience

The interface is fully optimized for mobile devices with:
- **Touch-friendly** button sizes (44px minimum)
- **Swipe navigation** support
- **Responsive typography** that scales appropriately
- **Optimized animations** for mobile performance
- **Reduced motion** support for accessibility

## 🧪 Testing

The system includes built-in error handling and fallbacks:
- **Graceful degradation** if legacy engine fails to load
- **Fallback questions** ensure the app always works
- **Error boundaries** prevent crashes from malformed data
- **Console logging** for debugging during development

## 🌟 Future Enhancements

Potential improvements for future versions:
- **Save/load** character builds
- **Extended questions** for more nuanced character creation  
- **Custom character portraits** generated based on results
- **Social sharing** with custom images
- **Multiple campaign settings** (not just D&D)
- **Character sheet export** in PDF format

## 📄 License

This project is part of the »SynthelicZ« collection (1995-2020) by Hawkynt. The modern interface enhancements maintain compatibility with the original engine while providing a contemporary user experience.

---

*Ready to discover your perfect D&D character? Open `index_new.html` and begin your quest! 🎲⚔️*