;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

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

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightLine(text, rules) {
    if (!rules || rules.length === 0)
      return escapeHtml(text);

    let result = '';
    let remaining = text;

    while (remaining.length > 0) {
      let bestMatch = null;
      let bestIndex = remaining.length;
      let bestRule = null;

      for (const rule of rules) {
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

  function highlightBlock(text, lang) {
    if (!lang || lang === 'none')
      return escapeHtml(text);

    const rules = buildRules(lang);
    if (rules.length === 0)
      return escapeHtml(text);

    const lines = text.split('\n');
    const html = [];
    for (let i = 0; i < lines.length; ++i)
      html.push(highlightLine(lines[i], rules));

    return html.join('\n');
  }

  function detectLanguage(filename) {
    if (!filename) return 'none';
    const dot = filename.lastIndexOf('.');
    if (dot < 0) return 'none';
    const ext = filename.substring(dot + 1).toLowerCase();
    return EXT_TO_LANG[ext] || 'none';
  }

  SZ.SyntaxHighlighter = {
    LANG_NAMES,
    EXT_TO_LANG,
    buildRules,
    escapeHtml,
    highlightLine,
    highlightBlock,
    detectLanguage,
  };

})();
