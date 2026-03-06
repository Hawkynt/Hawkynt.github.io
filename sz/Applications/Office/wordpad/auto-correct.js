;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor;
  let enabled = true;

  const corrections = new Map([
    // ── Contractions ──────────────────────────────────────────────
    ['dont', "don't"],
    ['doesnt', "doesn't"],
    ['didnt', "didn't"],
    ['isnt', "isn't"],
    ['wasnt', "wasn't"],
    ['wouldnt', "wouldn't"],
    ['couldnt', "couldn't"],
    ['shouldnt', "shouldn't"],
    ['cant', "can't"],
    ['wont', "won't"],
    ['havent', "haven't"],
    ['hasnt', "hasn't"],
    ['hadnt', "hadn't"],
    ['ive', "I've"],
    ['im', "I'm"],
    ['youre', "you're"],
    ['theyre', "they're"],
    ['weve', "we've"],
    ['youve', "you've"],
    ['dosen', "doesn't"],

    // ── Common misspellings ───────────────────────────────────────
    ['teh', 'the'],
    ['thier', 'their'],
    ['adn', 'and'],
    ['recieve', 'receive'],
    ['occured', 'occurred'],
    ['seperate', 'separate'],
    ['definately', 'definitely'],
    ['accomodate', 'accommodate'],
    ['occurence', 'occurrence'],
    ['neccessary', 'necessary'],
    ['wierd', 'weird'],
    ['acheive', 'achieve'],
    ['untill', 'until'],
    ['beacuse', 'because'],
    ['becuase', 'because'],
    ['hte', 'the'],
    ['taht', 'that'],
    ['whihc', 'which'],
    ['ahve', 'have'],
    ['tihs', 'this'],
    ['jsut', 'just'],

    // ── Extended misspellings ─────────────────────────────────────
    ['abbout', 'about'],
    ['abotu', 'about'],
    ['abouta', 'about a'],
    ['aboutit', 'about it'],
    ['accross', 'across'],
    ['acn', 'can'],
    ['acommodate', 'accommodate'],
    ['agian', 'again'],
    ['ahppen', 'happen'],
    ['allready', 'already'],
    ['alot', 'a lot'],
    ['amke', 'make'],
    ['anbd', 'and'],
    ['aobut', 'about'],
    ['apperance', 'appearance'],
    ['applyed', 'applied'],
    ['arguement', 'argument'],
    ['aslo', 'also'],
    ['atthe', 'at the'],
    ['awya', 'away'],
    ['bakc', 'back'],
    ['baout', 'about'],
    ['bcak', 'back'],
    ['beleive', 'believe'],
    ['brekfast', 'breakfast'],
    ['buisness', 'business'],
    ['bve', 'be'],
    ['cahnge', 'change'],
    ['calender', 'calendar'],
    ['challange', 'challenge'],
    ['changeing', 'changing'],
    ['cheif', 'chief'],
    ['chnage', 'change'],
    ['claer', 'clear'],
    ['cmae', 'came'],
    ['cna', 'can'],
    ['colum', 'column'],
    ['comeing', 'coming'],
    ['commited', 'committed'],
    ['completly', 'completely'],
    ['concious', 'conscious'],
    ['continueing', 'continuing'],
    ['convience', 'convenience'],
    ['coudl', 'could'],
    ['cxan', 'can'],
    ['decison', 'decision'],
    ['defintion', 'definition'],
    ['develope', 'develop'],
    ['diffrent', 'different'],
    ['disapoint', 'disappoint'],
    ['doign', 'doing'],
    ['donig', 'doing'],
    ['eahc', 'each'],
    ['enviroment', 'environment'],
    ['esle', 'else'],
    ['excercise', 'exercise'],
    ['exmaple', 'example'],
    ['experiance', 'experience'],
    ['familar', 'familiar'],
    ['finaly', 'finally'],
    ['foriegn', 'foreign'],
    ['fourty', 'forty'],
    ['freind', 'friend'],
    ['gerat', 'great'],
    ['geting', 'getting'],
    ['goign', 'going'],
    ['goverment', 'government'],
    ['grammer', 'grammar'],
    ['happend', 'happened'],
    ['haveing', 'having'],
    ['hearign', 'hearing'],
    ['heigth', 'height'],
    ['helpfull', 'helpful'],
    ['hismelf', 'himself'],
    ['hsa', 'has'],
    ['htey', 'they'],
    ['htink', 'think'],
    ['htis', 'this'],
    ['ignorence', 'ignorance'],
    ['immediatly', 'immediately'],
    ['importent', 'important'],
    ['independant', 'independent'],
    ['infomation', 'information'],
    ['intrest', 'interest'],
    ['irregardless', 'regardless'],
    ['judgement', 'judgment'],
    ['knwo', 'know'],
    ['konw', 'know'],
    ['langauge', 'language'],
    ['liek', 'like'],
    ['lieing', 'lying'],
    ['maby', 'maybe'],
    ['maintainance', 'maintenance'],
    ['makeing', 'making'],
    ['managment', 'management'],
    ['manualy', 'manually'],
    ['milennium', 'millennium'],
    ['minumum', 'minimum'],
    ['mispell', 'misspell'],
    ['mroe', 'more'],
    ['nkow', 'know'],
    ['nto', 'not'],
    ['ocasion', 'occasion'],
    ['occassion', 'occasion'],
    ['ofr', 'for'],
    ['ohter', 'other'],
    ['omision', 'omission'],
    ['onyl', 'only'],
    ['oportunity', 'opportunity'],
    ['otu', 'out'],
    ['owrk', 'work'],
    ['paralel', 'parallel'],
    ['particulary', 'particularly'],
    ['peice', 'piece'],
    ['peopel', 'people'],
    ['perfer', 'prefer'],
    ['permanant', 'permanent'],
    ['persue', 'pursue'],
    ['planed', 'planned'],
    ['posession', 'possession'],
    ['potatos', 'potatoes'],
    ['preceed', 'precede'],
    ['preffer', 'prefer'],
    ['privelege', 'privilege'],
    ['probaly', 'probably'],
    ['probelm', 'problem'],
    ['profesional', 'professional'],
    ['progam', 'program'],
    ['prominant', 'prominent'],
    ['publically', 'publicly'],
    ['purposful', 'purposeful'],
    ['questionaire', 'questionnaire'],
    ['realy', 'really'],
    ['reccomend', 'recommend'],
    ['refered', 'referred'],
    ['relevent', 'relevant'],
    ['religous', 'religious'],
    ['repitition', 'repetition'],
    ['responsable', 'responsible'],
    ['rythm', 'rhythm'],
    ['safty', 'safety'],
    ['scedule', 'schedule'],
    ['sentance', 'sentence'],
    ['shoudl', 'should'],
    ['similer', 'similar'],
    ['sinceerly', 'sincerely'],
    ['snese', 'sense'],
    ['speach', 'speech'],
    ['strenght', 'strength'],
    ['succesful', 'successful'],
    ['suprise', 'surprise'],
    ['thansk', 'thanks'],
    ['theri', 'their'],
    ['thet', 'that'],
    ['throught', 'through'],
    ['togather', 'together'],
    ['tommorrow', 'tomorrow'],
    ['tounge', 'tongue'],
    ['truely', 'truly'],
    ['tyhat', 'that'],
    ['unforseen', 'unforeseen'],
    ['unfortunatly', 'unfortunately'],
    ['unnecesary', 'unnecessary'],
    ['usally', 'usually'],
    ['vaccum', 'vacuum'],
    ['vegeterian', 'vegetarian'],
    ['visable', 'visible'],
    ['wendsday', 'Wednesday'],
    ['whcih', 'which'],
    ['wher', 'where'],
    ['wiht', 'with'],
    ['writting', 'writing'],
    ['wroking', 'working'],
    ['yera', 'year'],
  ]);

  // Auto-format symbol replacements (triggered after space)
  const autoFormat = new Map([
    ['(c)', '\u00A9'],       // (C)
    ['(r)', '\u00AE'],       // (R)
    ['(tm)', '\u2122'],      // TM
    ['(p)', '\u00B6'],       // Pilcrow
    ['(s)', '\u00A7'],       // Section
    ['...', '\u2026'],       // Ellipsis
    ['1/2', '\u00BD'],       // 1/2
    ['1/4', '\u00BC'],       // 1/4
    ['3/4', '\u00BE'],       // 3/4
    ['1/3', '\u2153'],       // 1/3
    ['2/3', '\u2154'],       // 2/3
    ['+-', '\u00B1'],        // Plus-minus
    ['!=', '\u2260'],        // Not equal
    ['<=', '\u2264'],        // Less-equal
    ['>=', '\u2265'],        // Greater-equal
    ['->', '\u2192'],        // Right arrow
    ['<-', '\u2190'],        // Left arrow
    ['=>', '\u21D2'],        // Double right arrow
    ['--', '\u2014'],        // Em dash
    ['<<', '\u00AB'],        // Left guillemet
    ['>>', '\u00BB'],        // Right guillemet
    ['deg', '\u00B0'],       // Degree
  ]);

  // Smart quote pairs
  const SINGLE_OPEN = '\u2018';
  const SINGLE_CLOSE = '\u2019';
  const DOUBLE_OPEN = '\u201C';
  const DOUBLE_CLOSE = '\u201D';

  function init(ctx) {
    _editor = ctx.editor;
    _editor.addEventListener('input', onInput);
  }

  function onInput(e) {
    if (!enabled)
      return;
    if (e.inputType !== 'insertText')
      return;

    const data = e.data;
    if (!data)
      return;

    // Trigger on space, period, comma, semicolon, colon, question, exclamation, or closing paren/bracket
    const triggers = ' .,;:?!)]\n';
    if (triggers.indexOf(data) === -1)
      return;

    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed)
      return;

    const node = sel.focusNode;
    if (!node || node.nodeType !== 3)
      return;

    const offset = sel.focusOffset;
    const text = node.textContent;

    // Extract the word before the trigger character
    // The trigger char is at offset-1, so the word ends at offset-2
    const beforeTrigger = text.substring(0, offset - 1);
    const wordMatch = beforeTrigger.match(/(\S+)$/);
    if (!wordMatch)
      return;

    const word = wordMatch[1];
    const wordStart = offset - 1 - word.length;

    // Auto-correct: check the corrections map
    const lower = word.toLowerCase();
    if (corrections.has(lower)) {
      const replacement = corrections.get(lower);
      // Preserve leading case
      let corrected = replacement;
      if (word.charAt(0) === word.charAt(0).toUpperCase() && word.charAt(0) !== word.charAt(0).toLowerCase())
        corrected = replacement.charAt(0).toUpperCase() + replacement.slice(1);

      const range = document.createRange();
      range.setStart(node, wordStart);
      range.setEnd(node, wordStart + word.length);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, corrected);
      return;
    }

    // Auto-format symbol replacements (only on space trigger)
    if (data === ' ' && autoFormat.has(lower)) {
      const sym = autoFormat.get(lower);
      const range = document.createRange();
      range.setStart(node, wordStart);
      range.setEnd(node, wordStart + word.length);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, sym);
      return;
    }

    // URL auto-hyperlinking (on space trigger)
    if (data === ' ' && /^(https?:\/\/|www\.)\S+$/i.test(word)) {
      let href = word;
      if (/^www\./i.test(href))
        href = 'https://' + href;

      const range = document.createRange();
      range.setStart(node, wordStart);
      range.setEnd(node, wordStart + word.length);
      sel.removeAllRanges();
      sel.addRange(range);

      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = word;
      anchor.target = '_blank';
      anchor.rel = 'noopener';

      range.deleteContents();
      range.insertNode(anchor);

      // Place cursor after the link + the space
      const afterRange = document.createRange();
      afterRange.setStartAfter(anchor);
      afterRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(afterRange);
      return;
    }

    // Smart quotes: convert straight quotes typed just before cursor
    applySmartQuotes(node, offset);

    // Auto-capitalize after sentence-ending punctuation + space
    if (data === ' ')
      autoCapitalize(node, offset);
  }

  function applySmartQuotes(node, offset) {
    const text = node.textContent;
    // Check if the character at offset-1 is a straight quote
    const ch = text.charAt(offset - 1);
    if (ch !== "'" && ch !== '"')
      return;

    // Determine if opening or closing
    const before = offset >= 2 ? text.charAt(offset - 2) : '';
    const isOpening = !before || /[\s(\[{]/.test(before);

    let replacement;
    if (ch === "'")
      replacement = isOpening ? SINGLE_OPEN : SINGLE_CLOSE;
    else
      replacement = isOpening ? DOUBLE_OPEN : DOUBLE_CLOSE;

    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(node, offset - 1);
    range.setEnd(node, offset);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, replacement);
  }

  function autoCapitalize(node, offset) {
    const text = node.textContent;
    // We just typed a space at offset-1. Check if preceding pattern is sentence-ending.
    // Look for [.!?] followed by any spaces (the space we just typed)
    const before = text.substring(0, offset - 1);
    if (!/[.!?]\s*$/.test(before))
      return;

    // The next character typed will be auto-capitalized.
    // We can't capitalize a character that hasn't been typed yet,
    // so we set up a one-shot listener.
    const handler = (e2) => {
      if (!enabled) {
        _editor.removeEventListener('input', handler);
        return;
      }
      if (e2.inputType !== 'insertText' || !e2.data) {
        _editor.removeEventListener('input', handler);
        return;
      }
      _editor.removeEventListener('input', handler);

      const typed = e2.data;
      if (typed.length !== 1 || typed === typed.toUpperCase())
        return;

      const sel2 = window.getSelection();
      if (!sel2.rangeCount || !sel2.isCollapsed)
        return;
      const node2 = sel2.focusNode;
      if (!node2 || node2.nodeType !== 3)
        return;
      const off2 = sel2.focusOffset;
      if (off2 < 1)
        return;

      const range = document.createRange();
      range.setStart(node2, off2 - 1);
      range.setEnd(node2, off2);
      sel2.removeAllRanges();
      sel2.addRange(range);
      document.execCommand('insertText', false, typed.toUpperCase());
    };

    _editor.addEventListener('input', handler);
    // Auto-remove after 5 seconds to avoid leaks
    setTimeout(() => _editor.removeEventListener('input', handler), 5000);
  }

  function setEnabled(val) {
    enabled = !!val;
  }

  function isEnabled() {
    return enabled;
  }

  function addCorrection(wrong, right) {
    corrections.set(wrong.toLowerCase(), right);
  }

  function removeCorrection(wrong) {
    corrections.delete(wrong.toLowerCase());
  }

  WP.AutoCorrect = { init, setEnabled, isEnabled, addCorrection, removeCorrection };
})();
