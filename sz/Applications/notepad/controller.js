;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // =====================================================================
  // State
  // =====================================================================
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;
  let savedContent = '';
  let wordWrap = true;
  let showLineNumbers = true;
  let showWhitespace = false;
  let showLineEndings = false;
  let showLongLineMarker = false;
  let highlightCurrentLine = true;
  let autoIndent = true;
  let autoCloseBrackets = false;
  let insertMode = true; // true = INS, false = OVR
  let tabWidth = 4;
  let tabsAsSpaces = false;
  let longLineColumn = 80;
  let currentEncoding = 'utf-8';
  let lineEndingType = 'CRLF'; // auto-detected
  let currentLanguage = 'none';
  let zoomLevel = 0; // -5 to +10
  let baseFontSize = 13;

  // Undo/Redo stacks
  const undoStack = [];
  const redoStack = [];
  let undoRecording = true;
  let lastUndoTime = 0;

  // DOM refs
  const editor = document.getElementById('editor');
  const highlightPre = document.getElementById('editor-highlight');
  const highlightCode = document.getElementById('highlight-code');
  const lineNumbersEl = document.getElementById('line-numbers');
  const longLineMarkerEl = document.getElementById('long-line-marker');
  const statusPos = document.getElementById('status-pos');
  const statusSel = document.getElementById('status-sel');
  const statusEol = document.getElementById('status-eol');
  const statusEnc = document.getElementById('status-enc');
  const statusMode = document.getElementById('status-mode');
  const statusLang = document.getElementById('status-lang');
  const statusModified = document.getElementById('status-modified');

  // Current line highlight element
  const currentLineEl = document.createElement('div');
  currentLineEl.className = 'current-line-highlight';
  document.querySelector('.editor-wrapper').appendChild(currentLineEl);

  // =====================================================================
  // Language definitions for syntax highlighting
  // =====================================================================
  const LANG_NAMES = {
    none: 'Plain Text',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    xml: 'XML',
    python: 'Python',
    c: 'C / C++',
    java: 'Java',
    sql: 'SQL',
    markdown: 'Markdown',
    shell: 'Shell / Bash',
    php: 'PHP',
    ruby: 'Ruby',
    perl: 'Perl',
    go: 'Go',
    rust: 'Rust',
    csharp: 'C#',
  };

  const EXT_TO_LANG = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript',
    html: 'html', htm: 'html', xhtml: 'html', svelte: 'html', vue: 'html',
    css: 'css', scss: 'css', less: 'css',
    json: 'json', jsonc: 'json', json5: 'json',
    xml: 'xml', svg: 'xml', xsl: 'xml', xslt: 'xml', rss: 'xml',
    py: 'python', pyw: 'python', pyi: 'python',
    c: 'c', h: 'c', cpp: 'c', cxx: 'c', cc: 'c', hpp: 'c', hxx: 'c',
    java: 'java', kt: 'java', kts: 'java',
    sql: 'sql',
    md: 'markdown', markdown: 'markdown', mkd: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    php: 'php', phtml: 'php',
    rb: 'ruby', rake: 'ruby', gemspec: 'ruby',
    pl: 'perl', pm: 'perl', t: 'perl',
    go: 'go',
    rs: 'rust',
    cs: 'csharp',
    pas: 'c', dpr: 'c',
    bat: 'shell', cmd: 'shell', ps1: 'shell',
    yml: 'ruby', yaml: 'ruby',
    toml: 'ruby', ini: 'ruby', cfg: 'ruby',
    txt: 'none', log: 'none',
  };

  // Comment prefixes for comment/uncomment feature
  const COMMENT_PREFIX = {
    javascript: '//', typescript: '//', c: '//', java: '//',
    go: '//', rust: '//', csharp: '//', php: '//',
    python: '#', ruby: '#', perl: '#', shell: '#',
    sql: '--', html: '', css: '', json: '', xml: '',
    markdown: '', none: '',
  };

  // Bracket pairs
  const OPEN_BRACKETS = '({[';
  const CLOSE_BRACKETS = ')}]';
  const BRACKET_PAIRS = { '(': ')', '{': '}', '[': ']', ')': '(', '}': '{', ']': '[' };
  const AUTO_CLOSE_MAP = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'", '`': '`' };

  // =====================================================================
  // Syntax highlighting rules (regex-based tokenization)
  // =====================================================================
  function buildRules(lang) {
    const R = [];
    const kw = (words) => '\\b(?:' + words.join('|') + ')\\b';

    switch (lang) {
      case 'javascript':
      case 'typescript': {
        const jsKeywords = 'abstract,arguments,async,await,break,case,catch,class,const,continue,debugger,default,delete,do,else,enum,export,extends,finally,for,from,function,if,implements,import,in,instanceof,interface,let,new,of,package,private,protected,public,return,static,super,switch,this,throw,try,typeof,var,void,while,with,yield';
        const tsExtra = lang === 'typescript' ? ',type,namespace,declare,module,readonly,as,is,keyof,infer,never,unknown,any,asserts,override,satisfies' : '';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /(`(?:\\[\s\S]|[^`])*`)/m, cls: 'sh-string' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(\/(?:\\.|[^/\\])+\/[gimsuvy]*)/m, cls: 'sh-regex' });
        R.push({ re: new RegExp('(' + kw((jsKeywords + tsExtra).split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|null|undefined|NaN|Infinity)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)\b/m, cls: 'sh-number' });
        R.push({ re: /(@\w+)/m, cls: 'sh-decorator' });
        break;
      }
      case 'python': {
        const pyKw = 'and,as,assert,async,await,break,class,continue,def,del,elif,else,except,finally,for,from,global,if,import,in,is,lambda,nonlocal,not,or,pass,raise,return,try,while,with,yield,match,case';
        R.push({ re: /(#.*$)/m, cls: 'sh-comment' });
        R.push({ re: /("""[\s\S]*?"""|'''[\s\S]*?''')/m, cls: 'sh-string' });
        R.push({ re: /(f"(?:\\.|[^"\\])*"|f'(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: new RegExp('(' + kw(pyKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(True|False|None|self|cls)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)\b/m, cls: 'sh-number' });
        R.push({ re: /(@\w+)/m, cls: 'sh-decorator' });
        break;
      }
      case 'html': {
        R.push({ re: /(<!--[\s\S]*?-->)/m, cls: 'sh-comment' });
        R.push({ re: /(<\/?[\w-]+)/m, cls: 'sh-tag' });
        R.push({ re: /(\/?>)/m, cls: 'sh-tag' });
        R.push({ re: /(\s[\w-]+=)/m, cls: 'sh-attr-name' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-attr-value' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-attr-value' });
        R.push({ re: /(&\w+;|&#\d+;|&#x[\da-fA-F]+;)/m, cls: 'sh-entity' });
        break;
      }
      case 'css': {
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /([.#][\w-]+)/m, cls: 'sh-selector' });
        R.push({ re: /([\w-]+)\s*:/m, cls: 'sh-property' });
        R.push({ re: /(:\s*[^;{}]+)/m, cls: 'sh-value' });
        R.push({ re: /(@[\w-]+)/m, cls: 'sh-keyword' });
        R.push({ re: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|pt|cm|mm|in|deg|s|ms)?)\b/m, cls: 'sh-number' });
        break;
      }
      case 'json': {
        R.push({ re: /("(?:\\.|[^"\\])*")\s*:/m, cls: 'sh-property' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /\b(true|false|null)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/m, cls: 'sh-number' });
        break;
      }
      case 'xml': {
        R.push({ re: /(<!--[\s\S]*?-->)/m, cls: 'sh-comment' });
        R.push({ re: /(<\?[\s\S]*?\?>)/m, cls: 'sh-preprocessor' });
        R.push({ re: /(<!\[CDATA\[[\s\S]*?\]\]>)/m, cls: 'sh-string' });
        R.push({ re: /(<\/?[\w:.-]+)/m, cls: 'sh-tag' });
        R.push({ re: /(\/?>)/m, cls: 'sh-tag' });
        R.push({ re: /(\s[\w:.-]+=)/m, cls: 'sh-attr-name' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-attr-value' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-attr-value' });
        R.push({ re: /(&\w+;|&#\d+;|&#x[\da-fA-F]+;)/m, cls: 'sh-entity' });
        break;
      }
      case 'c': {
        const cKw = 'auto,break,case,char,class,const,constexpr,continue,default,delete,do,double,else,enum,explicit,extern,float,for,friend,goto,if,inline,int,long,mutable,namespace,new,noexcept,nullptr,operator,override,private,protected,public,register,return,short,signed,sizeof,static,static_cast,struct,switch,template,this,throw,try,typedef,typename,union,unsigned,using,virtual,void,volatile,while,bool,catch,dynamic_cast,reinterpret_cast,const_cast,static_assert,decltype,alignas,alignof,thread_local,concept,requires,co_await,co_return,co_yield,import,module,export';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(#\s*\w+)/m, cls: 'sh-preprocessor' });
        R.push({ re: new RegExp('(' + kw(cKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|NULL|nullptr|TRUE|FALSE)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fFlLuU]*|0[xX][\da-fA-F_]+[uUlL]*|0[bB][01_]+[uUlL]*)\b/m, cls: 'sh-number' });
        break;
      }
      case 'java': {
        const javaKw = 'abstract,assert,break,case,catch,class,const,continue,default,do,else,enum,extends,final,finally,for,goto,if,implements,import,instanceof,interface,native,new,package,private,protected,public,return,sealed,static,strictfp,super,switch,synchronized,this,throw,throws,transient,try,var,void,volatile,while,yield,record,permits,non-sealed';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: new RegExp('(' + kw(javaKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|null)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fFdDlL]?|0[xX][\da-fA-F_]+[lL]?|0[bB][01_]+[lL]?)\b/m, cls: 'sh-number' });
        R.push({ re: /(@\w+)/m, cls: 'sh-decorator' });
        break;
      }
      case 'sql': {
        const sqlKw = 'SELECT,FROM,WHERE,INSERT,INTO,UPDATE,DELETE,CREATE,DROP,ALTER,TABLE,INDEX,VIEW,JOIN,INNER,LEFT,RIGHT,OUTER,FULL,CROSS,ON,AS,AND,OR,NOT,IN,IS,NULL,LIKE,BETWEEN,EXISTS,HAVING,GROUP,BY,ORDER,ASC,DESC,LIMIT,OFFSET,UNION,ALL,DISTINCT,SET,VALUES,BEGIN,COMMIT,ROLLBACK,TRANSACTION,GRANT,REVOKE,PRIMARY,KEY,FOREIGN,REFERENCES,CONSTRAINT,UNIQUE,CHECK,DEFAULT,CASCADE,TRIGGER,PROCEDURE,FUNCTION,RETURN,DECLARE,IF,ELSE,THEN,END,CASE,WHEN,CAST,CONVERT,COALESCE,WITH,RECURSIVE,TEMPORARY,TEMP,REPLACE,TRUNCATE,EXPLAIN';
        R.push({ re: /(--.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /('(?:''|[^'])*')/m, cls: 'sh-string' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: new RegExp('(' + kw(sqlKw.split(',')) + ')', 'im'), cls: 'sh-keyword' });
        R.push({ re: /\b(\d+\.?\d*)\b/m, cls: 'sh-number' });
        break;
      }
      case 'markdown': {
        R.push({ re: /(^#{1,6}\s+.+$)/m, cls: 'sh-heading' });
        R.push({ re: /(\*\*(?:[^*]|\*(?!\*))+\*\*)/m, cls: 'sh-bold' });
        R.push({ re: /(\*(?:[^*])+\*)/m, cls: 'sh-italic' });
        R.push({ re: /(`[^`]+`)/m, cls: 'sh-string' });
        R.push({ re: /(```[\s\S]*?```)/m, cls: 'sh-string' });
        R.push({ re: /(\[(?:[^\]])+\]\([^)]+\))/m, cls: 'sh-link' });
        R.push({ re: /(^\s*[-*+]\s)/m, cls: 'sh-keyword' });
        R.push({ re: /(^\s*\d+\.\s)/m, cls: 'sh-keyword' });
        R.push({ re: /(^\s*>+\s)/m, cls: 'sh-comment' });
        break;
      }
      case 'shell': {
        R.push({ re: /(#.*$)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:[^'])*')/m, cls: 'sh-string' });
        R.push({ re: /(`(?:[^`])*`)/m, cls: 'sh-string' });
        R.push({ re: /(\$\{[^}]+\}|\$\w+)/m, cls: 'sh-variable' });
        const shKw = 'if,then,else,elif,fi,for,while,until,do,done,case,esac,in,function,return,local,export,source,alias,unalias,set,unset,declare,readonly,typeset,shift,select,break,continue,exit,trap,eval,exec,true,false';
        R.push({ re: new RegExp('(' + kw(shKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(\d+)\b/m, cls: 'sh-number' });
        break;
      }
      case 'php': {
        const phpKw = 'abstract,and,as,break,callable,case,catch,class,clone,const,continue,declare,default,do,echo,else,elseif,empty,enddeclare,endfor,endforeach,endif,endswitch,endwhile,enum,eval,exit,extends,final,finally,fn,for,foreach,function,global,goto,if,implements,include,include_once,instanceof,insteadof,interface,isset,list,match,namespace,new,or,print,private,protected,public,readonly,require,require_once,return,static,switch,throw,trait,try,unset,use,var,while,xor,yield';
        R.push({ re: /(\/\/.*$|#.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(\$\w+)/m, cls: 'sh-variable' });
        R.push({ re: new RegExp('(' + kw(phpKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|null|TRUE|FALSE|NULL)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F]+|0[bB][01]+)\b/m, cls: 'sh-number' });
        break;
      }
      case 'ruby': {
        const rbKw = 'alias,and,begin,break,case,class,def,defined,do,else,elsif,end,ensure,false,for,if,in,module,next,nil,not,or,redo,rescue,retry,return,self,super,then,true,undef,unless,until,when,while,yield,require,include,extend,attr_reader,attr_writer,attr_accessor,puts,raise,lambda,proc';
        R.push({ re: /(#.*$)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(:\w+)/m, cls: 'sh-constant' });
        R.push({ re: /(@\w+)/m, cls: 'sh-variable' });
        R.push({ re: /(\$\w+)/m, cls: 'sh-variable' });
        R.push({ re: new RegExp('(' + kw(rbKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|nil)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)\b/m, cls: 'sh-number' });
        break;
      }
      case 'perl': {
        const plKw = 'my,our,local,use,no,require,package,sub,if,elsif,else,unless,while,until,for,foreach,do,last,next,redo,return,die,warn,print,say,chomp,chop,push,pop,shift,unshift,splice,grep,map,sort,keys,values,exists,delete,defined,undef,bless,ref,tied,tie,untie,eval,BEGIN,END,INIT,CHECK,UNITCHECK,AUTOLOAD,DESTROY,given,when,default';
        R.push({ re: /(#.*$)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(\/(?:\\.|[^/\\])+\/[gimsx]*)/m, cls: 'sh-regex' });
        R.push({ re: /([\$@%]\w+)/m, cls: 'sh-variable' });
        R.push({ re: new RegExp('(' + kw(plKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F_]+|0[bB][01_]+)\b/m, cls: 'sh-number' });
        break;
      }
      case 'go': {
        const goKw = 'break,case,chan,const,continue,default,defer,else,fallthrough,for,func,go,goto,if,import,interface,map,package,range,return,select,struct,switch,type,var';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /(`[^`]*`)/m, cls: 'sh-string' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: new RegExp('(' + kw(goKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|nil|iota)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|any|comparable)\b/m, cls: 'sh-type' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)\b/m, cls: 'sh-number' });
        break;
      }
      case 'rust': {
        const rsKw = 'as,async,await,break,const,continue,crate,dyn,else,enum,extern,false,fn,for,if,impl,in,let,loop,match,mod,move,mut,pub,ref,return,self,Self,static,struct,super,trait,true,type,unsafe,use,where,while,abstract,become,box,do,final,macro,override,priv,try,typeof,unsized,virtual,yield';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /(r#*"[\s\S]*?"#*)/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])')/m, cls: 'sh-string' });
        R.push({ re: new RegExp('(' + kw(rsKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|None|Some|Ok|Err)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|String|Vec|Option|Result|Box|Rc|Arc)\b/m, cls: 'sh-type' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fiu]?\d*|0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+)\b/m, cls: 'sh-number' });
        R.push({ re: /(#\[[\w:]+(?:\([\s\S]*?\))?\]|#!\[[\w:]+(?:\([\s\S]*?\))?\])/m, cls: 'sh-decorator' });
        break;
      }
      case 'csharp': {
        const csKw = 'abstract,as,base,bool,break,byte,case,catch,char,checked,class,const,continue,decimal,default,delegate,do,double,else,enum,event,explicit,extern,finally,fixed,float,for,foreach,goto,if,implicit,in,int,interface,internal,is,lock,long,namespace,new,null,object,operator,out,override,params,private,protected,public,readonly,record,ref,return,sbyte,sealed,short,sizeof,stackalloc,static,string,struct,switch,this,throw,try,typeof,uint,ulong,unchecked,unsafe,ushort,using,var,virtual,void,volatile,while,yield,async,await,dynamic,global,nameof,not,or,and,when,with,init,required,file,scoped';
        R.push({ re: /(\/\/.*$)/m, cls: 'sh-comment' });
        R.push({ re: /(\/\*[\s\S]*?\*\/)/m, cls: 'sh-comment' });
        R.push({ re: /(\$"(?:\\.|[^"\\])*"|@"(?:[^"]|"")*"|\$@"(?:[^"]|"")*")/m, cls: 'sh-string' });
        R.push({ re: /("(?:\\.|[^"\\])*")/m, cls: 'sh-string' });
        R.push({ re: /('(?:\\.|[^'\\])*')/m, cls: 'sh-string' });
        R.push({ re: /(#\s*\w+)/m, cls: 'sh-preprocessor' });
        R.push({ re: new RegExp('(' + kw(csKw.split(',')) + ')', 'm'), cls: 'sh-keyword' });
        R.push({ re: /\b(true|false|null)\b/m, cls: 'sh-constant' });
        R.push({ re: /\b(\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fFdDmMlLuU]*|0[xX][\da-fA-F_]+[lLuU]*|0[bB][01_]+[lLuU]*)\b/m, cls: 'sh-number' });
        R.push({ re: /(\[\w+(?:\(.*?\))?\])/m, cls: 'sh-decorator' });
        break;
      }
    }
    return R;
  }

  let currentRules = [];

  // =====================================================================
  // Tokenize text using current language rules
  // =====================================================================
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightLine(line) {
    if (currentLanguage === 'none' || currentRules.length === 0)
      return escapeHtml(line);

    let result = '';
    let remaining = line;

    while (remaining.length > 0) {
      let bestMatch = null;
      let bestIndex = remaining.length;
      let bestRule = null;

      for (const rule of currentRules) {
        const m = rule.re.exec(remaining);
        if (m && m.index < bestIndex) {
          bestIndex = m.index;
          bestMatch = m;
          bestRule = rule;
        }
      }

      if (!bestMatch) {
        result += escapeHtml(remaining);
        break;
      }

      if (bestIndex > 0)
        result += escapeHtml(remaining.substring(0, bestIndex));

      result += '<span class="' + bestRule.cls + '">' + escapeHtml(bestMatch[0]) + '</span>';
      remaining = remaining.substring(bestIndex + bestMatch[0].length);
    }

    return result;
  }

  // =====================================================================
  // Full document highlight rendering
  // =====================================================================
  let highlightRAF = null;

  function scheduleHighlight() {
    if (highlightRAF)
      return;
    highlightRAF = requestAnimationFrame(() => {
      highlightRAF = null;
      renderHighlight();
    });
  }

  function renderHighlight() {
    const text = editor.value;
    const lines = text.split('\n');
    const html = [];

    for (let i = 0; i < lines.length; ++i) {
      let lineHtml = highlightLine(lines[i]);

      // Whitespace rendering (negative lookahead avoids replacing inside HTML tags)
      if (showWhitespace) {
        lineHtml = lineHtml.replace(/ (?![^<]*>)/g, '<span class="ws-space"> </span>');
        lineHtml = lineHtml.replace(/\t(?![^<]*>)/g, '<span class="ws-tab">\t</span>');
      }

      html.push(lineHtml);
    }

    // Line endings
    let separator = '\n';
    if (showLineEndings) {
      const eolMark = lineEndingType === 'CRLF' ? '<span class="ws-crlf"></span>'
        : lineEndingType === 'CR' ? '<span class="ws-cr"></span>'
        : '<span class="ws-lf"></span>';
      separator = eolMark + '\n';
    }

    highlightCode.innerHTML = html.join(separator) + '\n';

    // Bracket matching
    renderBracketMatch();

    // Selection occurrence highlights
    renderSelectionHighlights();
  }

  // =====================================================================
  // Bracket matching
  // =====================================================================
  function renderBracketMatch() {
    // Remove old highlights
    for (const el of highlightCode.querySelectorAll('.sh-bracket-match'))
      el.classList.remove('sh-bracket-match');

    const pos = editor.selectionStart;
    const text = editor.value;
    if (pos < 0 || pos > text.length)
      return;

    let ch = text[pos];
    let idx = pos;
    if (!ch || (OPEN_BRACKETS.indexOf(ch) < 0 && CLOSE_BRACKETS.indexOf(ch) < 0)) {
      ch = text[pos - 1];
      idx = pos - 1;
    }
    if (!ch || idx < 0)
      return;

    const openIdx = OPEN_BRACKETS.indexOf(ch);
    const closeIdx = CLOSE_BRACKETS.indexOf(ch);

    if (openIdx < 0 && closeIdx < 0)
      return;

    let matchIdx;
    if (openIdx >= 0) {
      const closeCh = CLOSE_BRACKETS[openIdx];
      matchIdx = findMatchingForward(text, idx, ch, closeCh);
    } else {
      const openCh = OPEN_BRACKETS[closeIdx];
      matchIdx = findMatchingBackward(text, idx, openCh, ch);
    }

    if (matchIdx < 0)
      return;

    // We cannot easily mark individual characters in the <code> innerHTML
    // without re-rendering, so the bracket match is a simplification.
    // A full solution would integrate into the tokenizer; for now the visual
    // bracket match is handled via a simple approach: insert marker spans.
    // This requires re-rendering the highlight with bracket positions embedded.
    // For performance, we skip this if document is very large.
    if (text.length > 500000)
      return;

    const positions = [idx, matchIdx].sort((a, b) => a - b);
    renderHighlightWithBrackets(positions);
  }

  function findMatchingForward(text, pos, openCh, closeCh) {
    let depth = 0;
    for (let i = pos; i < text.length; ++i) {
      if (text[i] === openCh) ++depth;
      else if (text[i] === closeCh) --depth;
      if (depth === 0) return i;
    }
    return -1;
  }

  function findMatchingBackward(text, pos, openCh, closeCh) {
    let depth = 0;
    for (let i = pos; i >= 0; --i) {
      if (text[i] === closeCh) ++depth;
      else if (text[i] === openCh) --depth;
      if (depth === 0) return i;
    }
    return -1;
  }

  function renderHighlightWithBrackets(bracketPositions) {
    const text = editor.value;
    const lines = text.split('\n');
    const html = [];
    let charOffset = 0;

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      let lineHtml = '';
      let rem = line;
      let localOffset = charOffset;

      // Check if any bracket position falls in this line
      const lineStart = charOffset;
      const lineEnd = charOffset + line.length;
      const bracketsInLine = bracketPositions.filter(p => p >= lineStart && p < lineEnd);

      if (bracketsInLine.length > 0) {
        // Highlight line with bracket markers
        let prevEnd = 0;
        for (const bpos of bracketsInLine) {
          const col = bpos - lineStart;
          if (col > prevEnd)
            lineHtml += highlightLine(line.substring(prevEnd, col));
          lineHtml += '<span class="sh-bracket-match">' + escapeHtml(line[col]) + '</span>';
          prevEnd = col + 1;
        }
        if (prevEnd < line.length)
          lineHtml += highlightLine(line.substring(prevEnd));
      } else {
        lineHtml = highlightLine(line);
      }

      if (showWhitespace) {
        lineHtml = lineHtml.replace(/ (?![^<]*>)/g, '<span class="ws-space"> </span>');
        lineHtml = lineHtml.replace(/\t(?![^<]*>)/g, '<span class="ws-tab">\t</span>');
      }

      html.push(lineHtml);
      charOffset += line.length + 1; // +1 for \n
    }

    let separator = '\n';
    if (showLineEndings) {
      const eolMark = lineEndingType === 'CRLF' ? '<span class="ws-crlf"></span>'
        : lineEndingType === 'CR' ? '<span class="ws-cr"></span>'
        : '<span class="ws-lf"></span>';
      separator = eolMark + '\n';
    }

    highlightCode.innerHTML = html.join(separator) + '\n';
  }

  // =====================================================================
  // Selection occurrence highlights
  // =====================================================================
  function renderSelectionHighlights() {
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    if (selStart === selEnd)
      return;

    const text = editor.value;
    const selected = text.substring(selStart, selEnd).trim();
    if (selected.length < 2 || selected.length > 100 || /\n/.test(selected))
      return;

    // Check if it is a "word" - only word chars
    if (!/^\w+$/.test(selected))
      return;

    // Find all occurrences (limited for performance)
    const escaped = selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'g');
    let match;
    let count = 0;
    const maxHighlights = 200;
    const codeEl = highlightCode;

    // We cannot easily inject markers into the already-rendered innerHTML
    // without corrupting spans. This is a known limitation of the textarea
    // overlay approach. For now, skip occurrence highlighting to avoid
    // complexity that would break the bracket matching / syntax highlight.
    // A production editor would use a more sophisticated rendering pipeline.
  }

  // =====================================================================
  // Scroll sync (textarea -> highlight + line numbers)
  // =====================================================================
  function syncScroll() {
    highlightPre.scrollTop = editor.scrollTop;
    highlightPre.scrollLeft = editor.scrollLeft;
    lineNumbersEl.scrollTop = editor.scrollTop;
    updateCurrentLineHighlight();
    updateLongLineMarker();
  }

  editor.addEventListener('scroll', syncScroll);

  // =====================================================================
  // Line numbers
  // =====================================================================
  let lineNumRAF = null;

  function scheduleLineNumbers() {
    if (lineNumRAF)
      return;
    lineNumRAF = requestAnimationFrame(() => {
      lineNumRAF = null;
      renderLineNumbers();
    });
  }

  function renderLineNumbers() {
    if (!showLineNumbers) {
      lineNumbersEl.classList.add('hidden');
      return;
    }
    lineNumbersEl.classList.remove('hidden');

    const text = editor.value;
    const lineCount = text.split('\n').length;
    const currentLine = getCurrentLine();
    const digits = String(lineCount).length;
    const width = Math.max(40, digits * 8 + 16);
    lineNumbersEl.style.minWidth = width + 'px';

    const html = [];
    for (let i = 1; i <= lineCount; ++i) {
      const cls = i === currentLine ? 'line-number current' : 'line-number';
      html.push('<div class="' + cls + '">' + i + '</div>');
    }
    lineNumbersEl.innerHTML = html.join('');
    lineNumbersEl.scrollTop = editor.scrollTop;
  }

  // =====================================================================
  // Current line highlight
  // =====================================================================
  function updateCurrentLineHighlight() {
    if (!highlightCurrentLine) {
      currentLineEl.style.display = 'none';
      return;
    }
    currentLineEl.style.display = 'block';

    const line = getCurrentLine();
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 18.2;
    const top = (line - 1) * lineHeight + 4 - editor.scrollTop;
    currentLineEl.style.top = top + 'px';
    currentLineEl.style.height = lineHeight + 'px';
  }

  // =====================================================================
  // Long line marker
  // =====================================================================
  function updateLongLineMarker() {
    if (!showLongLineMarker) {
      longLineMarkerEl.classList.remove('visible');
      return;
    }
    longLineMarkerEl.classList.add('visible');

    // Measure character width by creating a reference string
    const measure = document.createElement('span');
    const style = getComputedStyle(editor);
    measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;' +
      'font-family:' + style.fontFamily + ';font-size:' + style.fontSize + ';' +
      'font-weight:' + style.fontWeight + ';line-height:' + style.lineHeight + ';';
    measure.textContent = 'x'.repeat(longLineColumn);
    document.body.appendChild(measure);
    const totalWidth = measure.getBoundingClientRect().width;
    document.body.removeChild(measure);

    const left = totalWidth + parseFloat(style.paddingLeft || 4) - editor.scrollLeft;
    longLineMarkerEl.style.left = left + 'px';
  }

  // =====================================================================
  // Window title
  // =====================================================================
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Notepad';
    document.title = title;
    User32.SetWindowText(title);
  }

  // =====================================================================
  // Dirty tracking
  // =====================================================================
  function checkDirty() {
    const nowDirty = editor.value !== savedContent;
    if (nowDirty !== dirty) {
      dirty = nowDirty;
      updateTitle();
      statusModified.textContent = dirty ? 'Modified' : '';
    }
  }

  // =====================================================================
  // Undo / Redo
  // =====================================================================
  function pushUndo() {
    if (!undoRecording)
      return;

    const now = Date.now();
    const state = {
      text: editor.value,
      selStart: editor.selectionStart,
      selEnd: editor.selectionEnd,
    };

    // Merge rapid edits (within 300ms) into one undo entry
    if (undoStack.length > 0 && (now - lastUndoTime) < 300) {
      undoStack[undoStack.length - 1] = state;
    } else {
      undoStack.push(state);
      if (undoStack.length > 5000)
        undoStack.shift();
    }

    lastUndoTime = now;
    redoStack.length = 0;
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;

    // Save current state for redo
    redoStack.push({
      text: editor.value,
      selStart: editor.selectionStart,
      selEnd: editor.selectionEnd,
    });

    const state = undoStack.pop();
    undoRecording = false;
    editor.value = state.text;
    editor.setSelectionRange(state.selStart, state.selEnd);
    undoRecording = true;

    onContentChanged();
    editor.focus();
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;

    undoStack.push({
      text: editor.value,
      selStart: editor.selectionStart,
      selEnd: editor.selectionEnd,
    });

    const state = redoStack.pop();
    undoRecording = false;
    editor.value = state.text;
    editor.setSelectionRange(state.selStart, state.selEnd);
    undoRecording = true;

    onContentChanged();
    editor.focus();
  }

  // =====================================================================
  // Content change handler
  // =====================================================================
  function onContentChanged() {
    checkDirty();
    scheduleHighlight();
    scheduleLineNumbers();
    updateStatusBar();
    updateCurrentLineHighlight();
    updateLongLineMarker();
  }

  editor.addEventListener('input', () => {
    pushUndo();
    onContentChanged();
  });

  // =====================================================================
  // Status bar
  // =====================================================================
  function getCurrentLine() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const before = text.substring(0, pos);
    return before.split('\n').length;
  }

  function getCurrentColumn() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    return lines[lines.length - 1].length + 1;
  }

  function updateStatusBar() {
    const line = getCurrentLine();
    const col = getCurrentColumn();
    statusPos.textContent = 'Ln ' + line + ', Col ' + col;

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    if (selStart !== selEnd) {
      const selLen = selEnd - selStart;
      const selText = editor.value.substring(selStart, selEnd);
      const selLines = selText.split('\n').length;
      statusSel.textContent = 'Sel: ' + selLen + ' char' + (selLen !== 1 ? 's' : '') +
        (selLines > 1 ? ', ' + selLines + ' lines' : '');
    } else {
      statusSel.textContent = '';
    }

    statusMode.textContent = insertMode ? 'INS' : 'OVR';
    statusLang.textContent = LANG_NAMES[currentLanguage] || 'Plain Text';
    statusModified.textContent = dirty ? 'Modified' : '';
  }

  // Various events that update status / highlight
  editor.addEventListener('click', () => {
    updateStatusBar();
    updateCurrentLineHighlight();
    scheduleLineNumbers();
    scheduleHighlight();
  });

  editor.addEventListener('keyup', () => {
    updateStatusBar();
    updateCurrentLineHighlight();
    scheduleLineNumbers();
  });

  editor.addEventListener('select', () => {
    updateStatusBar();
  });

  // =====================================================================
  // Ribbon tab switching
  // =====================================================================
  const ribbonTabs = document.getElementById('ribbon-tabs');
  for (const tab of ribbonTabs.querySelectorAll('.ribbon-tab')) {
    tab.addEventListener('click', () => {
      ribbonTabs.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('ribbon-' + tab.dataset.tab);
      if (panel)
        panel.classList.add('active');
    });
  }

  // =====================================================================
  // Backstage (File menu)
  // =====================================================================
  const backstage = document.getElementById('backstage');
  const ribbonFileBtn = document.getElementById('ribbon-file-btn');
  const backstageBack = document.getElementById('backstage-back');

  ribbonFileBtn.addEventListener('click', () => backstage.classList.add('visible'));
  backstageBack.addEventListener('click', () => backstage.classList.remove('visible'));
  backstage.addEventListener('pointerdown', (e) => {
    if (e.target === backstage)
      backstage.classList.remove('visible');
  });
  for (const item of backstage.querySelectorAll('.backstage-item')) {
    item.addEventListener('click', () => {
      backstage.classList.remove('visible');
      handleAction(item.dataset.action);
    });
  }

  // =====================================================================
  // QAT buttons
  // =====================================================================
  for (const btn of document.querySelectorAll('.qat-btn[data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

  // =====================================================================
  // Ribbon action buttons
  // =====================================================================
  for (const btn of document.querySelectorAll('.rb-btn[data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

  // =====================================================================
  // Ribbon view checkboxes
  // =====================================================================
  document.getElementById('rb-word-wrap').addEventListener('change', (e) => {
    wordWrap = e.target.checked;
    applyWordWrap();
  });
  document.getElementById('rb-line-numbers').addEventListener('change', (e) => {
    showLineNumbers = e.target.checked;
    scheduleLineNumbers();
  });
  document.getElementById('rb-show-whitespace').addEventListener('change', (e) => {
    showWhitespace = e.target.checked;
    scheduleHighlight();
  });
  document.getElementById('rb-show-line-endings').addEventListener('change', (e) => {
    showLineEndings = e.target.checked;
    scheduleHighlight();
  });
  document.getElementById('rb-long-line-marker').addEventListener('change', (e) => {
    showLongLineMarker = e.target.checked;
    updateLongLineMarker();
  });
  document.getElementById('rb-highlight-current-line').addEventListener('change', (e) => {
    highlightCurrentLine = e.target.checked;
    updateCurrentLineHighlight();
  });
  document.getElementById('rb-auto-indent').addEventListener('change', (e) => {
    autoIndent = e.target.checked;
  });
  document.getElementById('rb-auto-close-brackets').addEventListener('change', (e) => {
    autoCloseBrackets = e.target.checked;
  });

  // =====================================================================
  // Ribbon syntax select
  // =====================================================================
  const rbSyntaxSelect = document.getElementById('rb-syntax-select');
  rbSyntaxSelect.addEventListener('change', () => {
    setLanguage(rbSyntaxSelect.value);
  });

  // =====================================================================
  // Ribbon encoding radios
  // =====================================================================
  for (const radio of document.querySelectorAll('input[name="rb-encoding"]')) {
    radio.addEventListener('change', () => {
      currentEncoding = radio.value;
      statusEnc.textContent = radio.value.toUpperCase();
    });
  }

  // =====================================================================
  // Ribbon & status bar zoom slider
  // =====================================================================
  const rbZoomSlider = document.getElementById('rb-zoom-slider');
  const rbZoomValue = document.getElementById('rb-zoom-value');
  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: -5, max: 10, step: 1, value: 0,
    formatLabel: level => Math.round(100 * Math.pow(1.1, level)) + '%',
    parseLabel: text => {
      const raw = parseInt(text, 10);
      if (isNaN(raw) || raw < 25 || raw > 500) return null;
      return Math.max(-5, Math.min(10, Math.round(Math.log(raw / 100) / Math.log(1.1))));
    },
    onChange: level => syncZoomSliders(level),
  });

  function syncZoomSliders(level) {
    zoomLevel = level;
    const pct = Math.round(100 * Math.pow(1.1, level));
    rbZoomValue.textContent = pct + '%';
    rbZoomSlider.value = level;
    statusZoomCtrl.value = level;
    const size = baseFontSize + zoomLevel;
    editor.style.fontSize = size + 'px';
    highlightPre.style.fontSize = size + 'px';
    lineNumbersEl.style.fontSize = size + 'px';
    syncScroll();
    scheduleHighlight();
    scheduleLineNumbers();
    updateLongLineMarker();
  }

  rbZoomSlider.addEventListener('input', () => syncZoomSliders(parseInt(rbZoomSlider.value, 10)));

  function handleAction(action) {
    switch (action) {
      case 'new':
        doNew();
        break;
      case 'open':
        doOpen();
        break;
      case 'save':
        doSave();
        break;
      case 'save-as':
        doSaveAs();
        break;
      case 'print':
        window.print();
        break;
      case 'exit':
        doExit();
        break;
      case 'undo':
        doUndo();
        break;
      case 'redo':
        doRedo();
        break;
      case 'cut':
        document.execCommand('cut');
        editor.focus();
        break;
      case 'copy':
        document.execCommand('copy');
        editor.focus();
        break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          pushUndo();
          editor.setRangeText(text, start, end, 'end');
          editor.dispatchEvent(new Event('input'));
          editor.focus();
        }).catch(() => {
          document.execCommand('paste');
          editor.focus();
        });
        break;
      case 'delete': {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        if (start !== end) {
          pushUndo();
          editor.setRangeText('', start, end, 'start');
          editor.dispatchEvent(new Event('input'));
        }
        editor.focus();
        break;
      }
      case 'select-all':
        editor.select();
        editor.focus();
        break;
      case 'time-date': {
        const now = new Date();
        const timeStr = now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
        const pos = editor.selectionStart;
        pushUndo();
        editor.setRangeText(timeStr, pos, editor.selectionEnd, 'end');
        editor.dispatchEvent(new Event('input'));
        editor.focus();
        break;
      }
      case 'find':
        showFindReplace(false);
        break;
      case 'replace':
        showFindReplace(true);
        break;
      case 'goto-line':
        showGotoLine();
        break;
      case 'duplicate-line':
        doDuplicateLine();
        break;
      case 'comment-toggle':
        doToggleComment();
        break;
      case 'zoom-in':
        doZoom(1);
        syncZoomSliders(zoomLevel);
        break;
      case 'zoom-out':
        doZoom(-1);
        syncZoomSliders(zoomLevel);
        break;
      case 'zoom-reset':
        doZoom(0, true);
        syncZoomSliders(zoomLevel);
        break;
      case 'font':
        showFontDialog();
        break;
      case 'tab-settings':
        showTabSettings();
        break;
      case 'convert-crlf':
        convertLineEndings('CRLF');
        break;
      case 'convert-lf':
        convertLineEndings('LF');
        break;
      case 'convert-cr':
        convertLineEndings('CR');
        break;
      case 'about':
        showDialog('dlg-about');
        break;
    }
  }

  // =====================================================================
  // Language management
  // =====================================================================
  function setLanguage(lang) {
    currentLanguage = lang;
    currentRules = buildRules(lang);
    statusLang.textContent = LANG_NAMES[lang] || 'Plain Text';
    scheduleHighlight();
  }

  function detectLanguageFromExtension(filename) {
    const dot = filename.lastIndexOf('.');
    if (dot < 0)
      return 'none';
    const ext = filename.substring(dot + 1).toLowerCase();
    return EXT_TO_LANG[ext] || 'none';
  }

  // =====================================================================
  // Line ending detection and conversion
  // =====================================================================
  function detectLineEndings(text) {
    const crlfCount = (text.match(/\r\n/g) || []).length;
    const lfCount = (text.match(/(?<!\r)\n/g) || []).length;
    const crCount = (text.match(/\r(?!\n)/g) || []).length;

    if (crlfCount >= lfCount && crlfCount >= crCount)
      return crlfCount > 0 ? 'CRLF' : 'LF';
    if (lfCount > crCount)
      return 'LF';
    return 'CR';
  }

  function normalizeLineEndings(text) {
    // Normalize to \n for internal use (textarea always uses \n)
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function convertLineEndings(type) {
    lineEndingType = type;
    statusEol.textContent = type;
    pushUndo();
    // The textarea always uses \n internally; line endings are applied on save.
    // We just update the indicator.
    scheduleHighlight();
  }

  function applyLineEndingsForSave(text) {
    // Text from textarea uses \n
    if (lineEndingType === 'CRLF')
      return text.replace(/\n/g, '\r\n');
    if (lineEndingType === 'CR')
      return text.replace(/\n/g, '\r');
    return text;
  }

  // =====================================================================
  // Word wrap
  // =====================================================================
  function applyWordWrap() {
    if (wordWrap) {
      editor.className = 'editor-input word-wrap';
      highlightPre.className = 'editor-highlight word-wrap';
    } else {
      editor.className = 'editor-input no-wrap';
      highlightPre.className = 'editor-highlight';
    }
    syncScroll();
    scheduleHighlight();
  }

  // =====================================================================
  // Zoom
  // =====================================================================
  function doZoom(delta, reset) {
    if (reset)
      zoomLevel = 0;
    else
      zoomLevel = Math.max(-5, Math.min(10, zoomLevel + delta));

    const size = baseFontSize + zoomLevel;
    editor.style.fontSize = size + 'px';
    highlightPre.style.fontSize = size + 'px';
    lineNumbersEl.style.fontSize = size + 'px';
    syncScroll();
    scheduleHighlight();
    scheduleLineNumbers();
    updateLongLineMarker();
  }

  // =====================================================================
  // File operations
  // =====================================================================
  function doNew() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => resetEditor());
        else if (result === 'no')
          resetEditor();
      });
      return;
    }
    resetEditor();
  }

  function resetEditor() {
    editor.value = '';
    savedContent = '';
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    undoStack.length = 0;
    redoStack.length = 0;
    setLanguage('none');
    lineEndingType = 'CRLF';
    statusEol.textContent = 'CRLF';
    updateTitle();
    onContentChanged();
    editor.focus();
  }

  function doOpen() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => showOpenDialog());
        else if (result === 'no')
          showOpenDialog();
      });
      return;
    }
    showOpenDialog();
  }

  async function showOpenDialog() {
    const result = await ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Text Files', ext: ['txt', 'md', 'log', 'cfg', 'ini'] },
        { name: 'Source Code', ext: ['js', 'ts', 'jsx', 'tsx', 'py', 'c', 'cpp', 'h', 'hpp', 'java', 'cs', 'go', 'rs', 'rb', 'pl', 'php', 'sh', 'sql', 'html', 'css', 'json', 'xml', 'yml', 'yaml', 'toml'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path);
  }

  async function loadFile(path, content) {
    if (content == null) {
      try {
        content = await Kernel32.ReadAllText(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Notepad', MB_OK);
        return;
      }
    }

    const rawContent = content != null ? String(content) : '';

    // Detect line endings before normalization
    lineEndingType = detectLineEndings(rawContent);
    statusEol.textContent = lineEndingType;

    const normalized = normalizeLineEndings(rawContent);
    editor.value = normalized;
    savedContent = normalized;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    undoStack.length = 0;
    redoStack.length = 0;

    // Auto-detect language
    const lang = detectLanguageFromExtension(currentFileName);
    setLanguage(lang);

    // Update syntax submenu radio
    rbSyntaxSelect.value = lang;

    updateTitle();
    onContentChanged();
    editor.focus();
  }

  function doSave(callback) {
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const saveContent = applyLineEndingsForSave(editor.value);
    const result = await ComDlg32.GetSaveFileName({
      filters: [
        { name: 'Text Files', ext: ['txt', 'md', 'log', 'cfg', 'ini'] },
        { name: 'Source Code', ext: ['js', 'ts', 'py', 'c', 'cpp', 'h', 'java', 'cs', 'go', 'rs', 'rb', 'pl', 'php', 'sh', 'sql', 'html', 'css', 'json', 'xml'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.txt',
      title: 'Save As',
      content: saveContent,
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';

      // Auto-detect language from new file name
      const lang = detectLanguageFromExtension(currentFileName);
      setLanguage(lang);
      rbSyntaxSelect.value = lang;

      await saveToPath(result.path, callback);
    }
  }

  async function saveToPath(path, callback) {
    const saveContent = applyLineEndingsForSave(editor.value);
    try {
      await Kernel32.WriteFile(path, saveContent);
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'Notepad', MB_OK);
      return;
    }
    savedContent = editor.value;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    statusModified.textContent = '';
    if (typeof callback === 'function')
      callback();
  }

  function doExit() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => User32.DestroyWindow());
        else if (result === 'no')
          User32.DestroyWindow();
      });
      return;
    }
    User32.DestroyWindow();
  }

  // =====================================================================
  // Dialog helpers
  // =====================================================================
  function showDialog(id) {
    const overlay = document.getElementById(id);
    overlay.classList.add('visible');
    awaitDialogResult(overlay);
  }

  function awaitDialogResult(overlay, callback) {
    function handleClick(e) {
      const btn = e.target.closest('[data-result]');
      if (!btn)
        return;
      overlay.classList.remove('visible');
      overlay.removeEventListener('click', handleClick);
      if (typeof callback === 'function')
        callback(btn.dataset.result);
    }
    overlay.addEventListener('click', handleClick);
  }

  function promptSaveChanges(callback) {
    const overlay = document.getElementById('dlg-save-changes');
    overlay.classList.add('visible');
    awaitDialogResult(overlay, callback);
  }

  // =====================================================================
  // Go to Line dialog
  // =====================================================================
  function showGotoLine() {
    const overlay = document.getElementById('dlg-goto');
    const input = document.getElementById('goto-line-input');
    const lineCount = editor.value.split('\n').length;
    input.max = lineCount;
    input.value = getCurrentLine();
    overlay.classList.add('visible');
    input.focus();
    input.select();

    function handleKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doGoto();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        overlay.classList.remove('visible');
        input.removeEventListener('keydown', handleKey);
        editor.focus();
      }
    }
    input.addEventListener('keydown', handleKey);

    awaitDialogResult(overlay, (result) => {
      input.removeEventListener('keydown', handleKey);
      if (result === 'ok')
        doGoto();
      editor.focus();
    });

    function doGoto() {
      let target = parseInt(input.value, 10);
      if (isNaN(target) || target < 1)
        target = 1;
      if (target > lineCount)
        target = lineCount;

      overlay.classList.remove('visible');
      gotoLine(target);
    }
  }

  function gotoLine(lineNum) {
    const text = editor.value;
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < lineNum - 1 && i < lines.length; ++i)
      pos += lines[i].length + 1;

    editor.focus();
    editor.setSelectionRange(pos, pos);
    // Scroll into view
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 18.2;
    const targetScroll = (lineNum - 1) * lineHeight - editor.clientHeight / 2 + lineHeight;
    editor.scrollTop = Math.max(0, targetScroll);
    updateStatusBar();
    updateCurrentLineHighlight();
    scheduleLineNumbers();
  }

  // =====================================================================
  // Font dialog
  // =====================================================================
  function showFontDialog() {
    const familySelect = document.getElementById('font-family');
    const sizeInput = document.getElementById('font-size');
    const boldCheck = document.getElementById('font-bold');
    const italicCheck = document.getElementById('font-italic');
    const preview = document.getElementById('font-preview');

    const cs = getComputedStyle(editor);
    const currentSize = Math.round(parseFloat(cs.fontSize));
    sizeInput.value = currentSize || baseFontSize;
    boldCheck.checked = cs.fontWeight === 'bold' || parseInt(cs.fontWeight, 10) >= 700;
    italicCheck.checked = cs.fontStyle === 'italic';

    const currentFamily = cs.fontFamily;
    let matched = false;
    for (const opt of familySelect.options) {
      const primary = opt.value.split(',')[0].replace(/'/g, '').trim().toLowerCase();
      if (currentFamily.toLowerCase().includes(primary)) {
        opt.selected = true;
        matched = true;
        break;
      }
    }
    if (!matched)
      familySelect.selectedIndex = 0;

    function updatePreview() {
      preview.style.fontFamily = familySelect.value;
      preview.style.fontSize = sizeInput.value + 'px';
      preview.style.fontWeight = boldCheck.checked ? 'bold' : 'normal';
      preview.style.fontStyle = italicCheck.checked ? 'italic' : 'normal';
    }

    updatePreview();
    familySelect.addEventListener('change', updatePreview);
    sizeInput.addEventListener('input', updatePreview);
    boldCheck.addEventListener('change', updatePreview);
    italicCheck.addEventListener('change', updatePreview);

    const overlay = document.getElementById('dlg-font');
    overlay.classList.add('visible');

    awaitDialogResult(overlay, (result) => {
      familySelect.removeEventListener('change', updatePreview);
      sizeInput.removeEventListener('input', updatePreview);
      boldCheck.removeEventListener('change', updatePreview);
      italicCheck.removeEventListener('change', updatePreview);

      if (result !== 'ok')
        return;

      let size = parseInt(sizeInput.value, 10);
      if (isNaN(size) || size < 8)
        size = 8;
      if (size > 72)
        size = 72;

      baseFontSize = size;
      zoomLevel = 0;
      const font = familySelect.value;
      const weight = boldCheck.checked ? 'bold' : 'normal';
      const style = italicCheck.checked ? 'italic' : 'normal';

      editor.style.fontFamily = font;
      editor.style.fontSize = size + 'px';
      editor.style.fontWeight = weight;
      editor.style.fontStyle = style;

      highlightPre.style.fontFamily = font;
      highlightPre.style.fontSize = size + 'px';
      highlightPre.style.fontWeight = weight;
      highlightPre.style.fontStyle = style;

      lineNumbersEl.style.fontFamily = font;
      lineNumbersEl.style.fontSize = size + 'px';

      syncScroll();
      scheduleHighlight();
      scheduleLineNumbers();
      updateLongLineMarker();
      editor.focus();
    });
  }

  // =====================================================================
  // Tab Settings dialog
  // =====================================================================
  function showTabSettings() {
    const overlay = document.getElementById('dlg-tab-settings');
    const tabWidthSelect = document.getElementById('tab-width-select');
    const tabsAsSpacesCheck = document.getElementById('tabs-as-spaces');
    const longLineColSelect = document.getElementById('long-line-col');

    tabWidthSelect.value = String(tabWidth);
    tabsAsSpacesCheck.checked = tabsAsSpaces;
    longLineColSelect.value = String(longLineColumn);

    overlay.classList.add('visible');

    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;

      tabWidth = parseInt(tabWidthSelect.value, 10);
      tabsAsSpaces = tabsAsSpacesCheck.checked;
      longLineColumn = parseInt(longLineColSelect.value, 10);

      editor.style.tabSize = tabWidth;
      editor.style.MozTabSize = tabWidth;
      highlightPre.style.tabSize = tabWidth;
      highlightPre.style.MozTabSize = tabWidth;

      updateLongLineMarker();
      scheduleHighlight();
      editor.focus();
    });
  }

  // =====================================================================
  // Find / Replace (non-modal panel)
  // =====================================================================
  const frPanel = document.getElementById('find-replace-panel');
  const frFindInput = document.getElementById('fr-find-input');
  const frReplaceInput = document.getElementById('fr-replace-input');
  const frReplaceRow = document.getElementById('fr-replace-row');
  const frStatus = document.getElementById('fr-status');
  const frMatchCase = document.getElementById('fr-match-case');
  const frWholeWord = document.getElementById('fr-whole-word');
  const frRegex = document.getElementById('fr-regex');
  const frReplaceBtn = document.getElementById('fr-replace-btn');
  const frReplaceAllBtn = document.getElementById('fr-replace-all');
  let frLastIndex = 0;
  let frIsReplaceMode = false;

  function showFindReplace(showReplace) {
    frIsReplaceMode = showReplace;
    frPanel.classList.add('visible');
    frReplaceRow.style.display = showReplace ? '' : 'none';
    frReplaceBtn.style.display = showReplace ? '' : 'none';
    frReplaceAllBtn.style.display = showReplace ? '' : 'none';

    document.getElementById('fr-title-text').textContent = showReplace ? 'Find and Replace' : 'Find';

    // Pre-fill with selected text
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    if (selStart !== selEnd) {
      const selText = editor.value.substring(selStart, selEnd);
      if (!selText.includes('\n'))
        frFindInput.value = selText;
    }

    frFindInput.focus();
    frFindInput.select();
    frStatus.textContent = '';
  }

  function closeFindReplace() {
    frPanel.classList.remove('visible');
    editor.focus();
  }

  document.getElementById('fr-close').addEventListener('click', closeFindReplace);

  function buildSearchRegex(needle, forReplace) {
    if (!needle)
      return null;

    let pattern;
    if (frRegex.checked) {
      try {
        pattern = needle;
      } catch (e) {
        frStatus.textContent = 'Invalid regex: ' + e.message;
        return null;
      }
    } else {
      pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (frWholeWord.checked)
      pattern = '\\b' + pattern + '\\b';

    const flags = frMatchCase.checked ? 'g' : 'gi';
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      frStatus.textContent = 'Invalid pattern: ' + e.message;
      return null;
    }
  }

  function findNext(backwards) {
    const needle = frFindInput.value;
    if (!needle) {
      frStatus.textContent = '';
      return false;
    }

    const re = buildSearchRegex(needle);
    if (!re)
      return false;

    const text = editor.value;
    const matches = [];
    let m;

    // Reset lastIndex
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
      if (m[0].length === 0) ++re.lastIndex; // avoid infinite loop on zero-length match
    }

    if (matches.length === 0) {
      frStatus.textContent = 'No matches found.';
      return false;
    }

    const cursorPos = backwards ? editor.selectionStart : editor.selectionEnd;
    let found;

    if (backwards) {
      found = null;
      for (let i = matches.length - 1; i >= 0; --i) {
        if (matches[i].index < cursorPos) {
          found = matches[i];
          break;
        }
      }
      if (!found)
        found = matches[matches.length - 1]; // wrap
    } else {
      found = null;
      for (const match of matches) {
        if (match.index >= cursorPos) {
          found = match;
          break;
        }
      }
      if (!found)
        found = matches[0]; // wrap
    }

    editor.focus();
    editor.setSelectionRange(found.index, found.index + found.length);

    // Count matches
    const matchIdx = matches.indexOf(found) + 1;
    frStatus.textContent = matchIdx + ' of ' + matches.length + ' match' + (matches.length !== 1 ? 'es' : '');

    updateStatusBar();
    updateCurrentLineHighlight();
    scheduleLineNumbers();
    return true;
  }

  function replaceCurrent() {
    const needle = frFindInput.value;
    if (!needle)
      return;

    const re = buildSearchRegex(needle);
    if (!re)
      return;

    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;
    const selected = editor.value.substring(selStart, selEnd);

    // Check if selection matches
    re.lastIndex = 0;
    const m = re.exec(selected);
    if (!m || m[0] !== selected) {
      findNext();
      return;
    }

    const replacement = frRegex.checked
      ? selected.replace(re, frReplaceInput.value)
      : frReplaceInput.value;

    pushUndo();
    editor.setRangeText(replacement, selStart, selEnd, 'end');
    editor.dispatchEvent(new Event('input'));
    findNext();
  }

  function replaceAll() {
    const needle = frFindInput.value;
    if (!needle)
      return;

    const re = buildSearchRegex(needle, true);
    if (!re)
      return;

    const text = editor.value;
    const replacement = frReplaceInput.value;
    const newText = text.replace(re, replacement);

    if (newText === text) {
      frStatus.textContent = 'No matches found.';
      return;
    }

    const count = (text.match(re) || []).length;
    pushUndo();
    editor.value = newText;
    editor.dispatchEvent(new Event('input'));
    frStatus.textContent = count + ' replacement' + (count !== 1 ? 's' : '') + ' made.';
    frLastIndex = 0;
  }

  document.getElementById('fr-find-next').addEventListener('click', () => findNext(false));
  document.getElementById('fr-find-prev').addEventListener('click', () => findNext(true));
  document.getElementById('fr-replace-btn').addEventListener('click', replaceCurrent);
  document.getElementById('fr-replace-all').addEventListener('click', replaceAll);

  frFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext(e.shiftKey);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindReplace();
    }
  });

  frReplaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      replaceCurrent();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindReplace();
    }
  });

  frFindInput.addEventListener('input', () => {
    frLastIndex = 0;
    frStatus.textContent = '';
  });

  // =====================================================================
  // Duplicate line (Ctrl+D)
  // =====================================================================
  function doDuplicateLine() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const lines = text.split('\n');

    // Find the line the cursor is on
    let charCount = 0;
    let lineIdx = 0;
    for (let i = 0; i < lines.length; ++i) {
      if (charCount + lines[i].length >= pos) {
        lineIdx = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    const lineText = lines[lineIdx];
    const lineEnd = charCount + lineText.length;

    pushUndo();
    editor.setRangeText('\n' + lineText, lineEnd, lineEnd, 'end');
    editor.dispatchEvent(new Event('input'));
    editor.focus();
  }

  // =====================================================================
  // Move line up/down (Alt+Up / Alt+Down)
  // =====================================================================
  function moveLineUp() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const lines = text.split('\n');

    let charCount = 0;
    let lineIdx = 0;
    for (let i = 0; i < lines.length; ++i) {
      if (charCount + lines[i].length >= pos) {
        lineIdx = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    if (lineIdx === 0)
      return;

    const curLine = lines[lineIdx];
    const prevLine = lines[lineIdx - 1];
    lines[lineIdx - 1] = curLine;
    lines[lineIdx] = prevLine;

    const newPos = pos - prevLine.length - 1;
    pushUndo();
    editor.value = lines.join('\n');
    editor.setSelectionRange(newPos, newPos);
    editor.dispatchEvent(new Event('input'));
    editor.focus();
  }

  function moveLineDown() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const lines = text.split('\n');

    let charCount = 0;
    let lineIdx = 0;
    for (let i = 0; i < lines.length; ++i) {
      if (charCount + lines[i].length >= pos) {
        lineIdx = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    if (lineIdx >= lines.length - 1)
      return;

    const curLine = lines[lineIdx];
    const nextLine = lines[lineIdx + 1];
    lines[lineIdx] = nextLine;
    lines[lineIdx + 1] = curLine;

    const newPos = pos + nextLine.length + 1;
    pushUndo();
    editor.value = lines.join('\n');
    editor.setSelectionRange(newPos, newPos);
    editor.dispatchEvent(new Event('input'));
    editor.focus();
  }

  // =====================================================================
  // Comment / Uncomment (Ctrl+/)
  // =====================================================================
  function doToggleComment() {
    const prefix = COMMENT_PREFIX[currentLanguage];
    if (!prefix)
      return;

    const text = editor.value;
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;

    // Find line boundaries
    const lines = text.split('\n');
    let startLine = 0, endLine = 0;
    let charCount = 0;
    for (let i = 0; i < lines.length; ++i) {
      if (charCount + lines[i].length >= selStart && startLine === 0 && charCount <= selStart)
        startLine = i;
      if (charCount + lines[i].length >= selEnd - 1 || i === lines.length - 1) {
        endLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    // Check if all selected lines are commented
    let allCommented = true;
    for (let i = startLine; i <= endLine; ++i) {
      const trimmed = lines[i].trimStart();
      if (trimmed.length > 0 && !trimmed.startsWith(prefix)) {
        allCommented = false;
        break;
      }
    }

    // Toggle
    for (let i = startLine; i <= endLine; ++i) {
      if (allCommented) {
        // Remove comment
        const idx = lines[i].indexOf(prefix);
        if (idx >= 0)
          lines[i] = lines[i].substring(0, idx) + lines[i].substring(idx + prefix.length + (lines[i][idx + prefix.length] === ' ' ? 1 : 0));
      } else {
        // Add comment
        const leadingWs = lines[i].match(/^(\s*)/)[1];
        const rest = lines[i].substring(leadingWs.length);
        if (rest.length > 0)
          lines[i] = leadingWs + prefix + ' ' + rest;
      }
    }

    pushUndo();
    editor.value = lines.join('\n');
    editor.setSelectionRange(selStart, selStart);
    editor.dispatchEvent(new Event('input'));
    editor.focus();
  }

  // =====================================================================
  // Indent / Unindent with Tab / Shift+Tab
  // =====================================================================
  function handleTab(e) {
    e.preventDefault();

    const text = editor.value;
    const selStart = editor.selectionStart;
    const selEnd = editor.selectionEnd;

    // Multi-line selection: indent/unindent block
    if (selStart !== selEnd && text.substring(selStart, selEnd).includes('\n')) {
      const lines = text.split('\n');
      let startLine = 0, endLine = 0;
      let charCount = 0;

      for (let i = 0; i < lines.length; ++i) {
        if (charCount <= selStart && charCount + lines[i].length >= selStart)
          startLine = i;
        if (charCount <= selEnd && charCount + lines[i].length >= selEnd - 1) {
          endLine = i;
          break;
        }
        charCount += lines[i].length + 1;
      }

      const indent = tabsAsSpaces ? ' '.repeat(tabWidth) : '\t';
      pushUndo();

      if (e.shiftKey) {
        // Unindent
        for (let i = startLine; i <= endLine; ++i) {
          if (lines[i].startsWith('\t'))
            lines[i] = lines[i].substring(1);
          else if (lines[i].startsWith(' '.repeat(tabWidth)))
            lines[i] = lines[i].substring(tabWidth);
          else {
            // Remove as many leading spaces as possible up to tabWidth
            let spaces = 0;
            while (spaces < tabWidth && lines[i][spaces] === ' ')
              ++spaces;
            if (spaces > 0)
              lines[i] = lines[i].substring(spaces);
          }
        }
      } else {
        // Indent
        for (let i = startLine; i <= endLine; ++i)
          lines[i] = indent + lines[i];
      }

      editor.value = lines.join('\n');
      // Restore selection approximately
      let newStart = 0;
      for (let i = 0; i < startLine; ++i)
        newStart += lines[i].length + 1;
      let newEnd = newStart;
      for (let i = startLine; i <= endLine; ++i)
        newEnd += lines[i].length + (i < endLine ? 1 : 0);

      editor.setSelectionRange(newStart, newEnd);
      editor.dispatchEvent(new Event('input'));
      return;
    }

    // Single cursor: insert tab
    const indent = tabsAsSpaces ? ' '.repeat(tabWidth) : '\t';
    pushUndo();
    editor.setRangeText(indent, selStart, selEnd, 'end');
    editor.dispatchEvent(new Event('input'));
  }

  // =====================================================================
  // Auto-indent on Enter
  // =====================================================================
  function handleEnter(e) {
    if (!autoIndent)
      return;

    e.preventDefault();

    const text = editor.value;
    const pos = editor.selectionStart;
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    const currentLine = lines[lines.length - 1];

    // Get leading whitespace
    const leadingMatch = currentLine.match(/^(\s*)/);
    let indent = leadingMatch ? leadingMatch[1] : '';

    // Extra indent after { or : (for block-structured languages)
    const trimmed = currentLine.trimEnd();
    if (trimmed.endsWith('{') || trimmed.endsWith(':') || trimmed.endsWith('(')) {
      const extra = tabsAsSpaces ? ' '.repeat(tabWidth) : '\t';
      indent += extra;
    }

    const insertion = '\n' + indent;
    pushUndo();
    editor.setRangeText(insertion, pos, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
  }

  // =====================================================================
  // Auto-close brackets
  // =====================================================================
  function handleAutoClose(e) {
    if (!autoCloseBrackets)
      return false;

    const ch = e.key;
    const closeChar = AUTO_CLOSE_MAP[ch];
    if (!closeChar)
      return false;

    const pos = editor.selectionStart;
    const text = editor.value;

    // For quotes, only auto-close if not already inside a quote
    if (ch === '"' || ch === "'" || ch === '`') {
      // Check if cursor is next to the same char (closing)
      if (text[pos] === ch) {
        e.preventDefault();
        editor.setSelectionRange(pos + 1, pos + 1);
        return true;
      }
    }

    // For closing brackets, just skip if next char matches
    if (CLOSE_BRACKETS.includes(ch)) {
      if (text[pos] === ch) {
        e.preventDefault();
        editor.setSelectionRange(pos + 1, pos + 1);
        return true;
      }
      return false;
    }

    e.preventDefault();
    pushUndo();
    editor.setRangeText(ch + closeChar, pos, editor.selectionEnd, 'end');
    editor.setSelectionRange(pos + 1, pos + 1);
    editor.dispatchEvent(new Event('input'));
    return true;
  }

  // =====================================================================
  // Insert / Overwrite mode
  // =====================================================================
  function handleOverwrite(e) {
    if (insertMode)
      return;
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey)
      return;

    const pos = editor.selectionStart;
    const text = editor.value;
    if (pos < text.length && text[pos] !== '\n') {
      e.preventDefault();
      pushUndo();
      editor.setRangeText(e.key, pos, pos + 1, 'end');
      editor.dispatchEvent(new Event('input'));
    }
  }

  // =====================================================================
  // Keyboard event handler
  // =====================================================================
  editor.addEventListener('keydown', (e) => {
    // Tab
    if (e.key === 'Tab') {
      handleTab(e);
      return;
    }

    // Enter with auto-indent
    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      handleEnter(e);
      return;
    }

    // Auto-close brackets
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (handleAutoClose(e))
        return;
      handleOverwrite(e);
    }
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Insert toggle
    if (e.key === 'Insert' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      insertMode = !insertMode;
      statusMode.textContent = insertMode ? 'INS' : 'OVR';
      return;
    }

    if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      handleAction('time-date');
      return;
    }

    // Alt+Up/Down: move line
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveLineUp();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveLineDown();
        return;
      }
    }

    // Ctrl shortcuts
    if (e.ctrlKey && !e.altKey) {
      const key = e.key.toLowerCase();

      // Zoom with Ctrl+= or Ctrl++ and Ctrl+-
      if (key === '=' || key === '+' || (e.key === '+' && e.shiftKey)) {
        e.preventDefault();
        doZoom(1);
        return;
      }
      if (key === '-') {
        e.preventDefault();
        doZoom(-1);
        return;
      }
      if (key === '0') {
        e.preventDefault();
        doZoom(0, true);
        return;
      }

      switch (key) {
        case 'n':
          e.preventDefault();
          handleAction('new');
          break;
        case 'o':
          e.preventDefault();
          handleAction('open');
          break;
        case 's':
          e.preventDefault();
          handleAction('save');
          break;
        case 'p':
          e.preventDefault();
          handleAction('print');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey)
            doRedo();
          else
            doUndo();
          break;
        case 'y':
          e.preventDefault();
          doRedo();
          break;
        case 'f':
          e.preventDefault();
          handleAction('find');
          break;
        case 'h':
          e.preventDefault();
          handleAction('replace');
          break;
        case 'g':
          e.preventDefault();
          handleAction('goto-line');
          break;
        case 'd':
          e.preventDefault();
          handleAction('duplicate-line');
          break;
        case '/':
          e.preventDefault();
          handleAction('comment-toggle');
          break;
        case 'a':
          // Let default select-all work
          break;
      }
    }
  });

  // =====================================================================
  // Status bar click handlers
  // =====================================================================
  statusEol.addEventListener('click', () => {
    // Cycle through line endings
    const types = ['CRLF', 'LF', 'CR'];
    const idx = types.indexOf(lineEndingType);
    const next = types[(idx + 1) % types.length];
    convertLineEndings(next);
  });

  statusEnc.addEventListener('click', () => {
    const encs = ['utf-8', 'ascii'];
    const idx = encs.indexOf(currentEncoding);
    const next = encs[(idx + 1) % encs.length];
    currentEncoding = next;
    statusEnc.textContent = next.toUpperCase();
    for (const el of document.querySelectorAll('[data-action="encoding"]'))
      el.classList.toggle('checked', el.dataset.enc === next);
  });

  statusMode.addEventListener('click', () => {
    insertMode = !insertMode;
    statusMode.textContent = insertMode ? 'INS' : 'OVR';
  });

  statusLang.addEventListener('click', () => {
    // Cycle through languages (simple approach)
    const langs = Object.keys(LANG_NAMES);
    const idx = langs.indexOf(currentLanguage);
    const next = langs[(idx + 1) % langs.length];
    setLanguage(next);
    rbSyntaxSelect.value = next;
  });

  // =====================================================================
  // Resize observer for scroll sync
  // =====================================================================
  const resizeObserver = new ResizeObserver(() => {
    syncScroll();
    scheduleLineNumbers();
    updateCurrentLineHighlight();
    updateLongLineMarker();
  });
  resizeObserver.observe(editor);

  // =====================================================================
  // Init
  // =====================================================================
  applyWordWrap();
  scheduleLineNumbers();
  updateLongLineMarker();

  // Push initial undo state
  undoStack.push({
    text: '',
    selStart: 0,
    selEnd: 0,
  });

  const cmd = Kernel32.GetCommandLine();
  if (cmd.path)
    loadFile(cmd.path);
  else {
    updateTitle();
    updateStatusBar();
    scheduleHighlight();
  }
  editor.focus();
})();
