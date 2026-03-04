;(function() {
  'use strict';

  const User32 = window.SZ && SZ.Dlls && SZ.Dlls.User32;
  const ComDlg32 = window.SZ && SZ.Dlls && SZ.Dlls.ComDlg32;

  // ===================================================================
  // DATA POOLS
  // ===================================================================

  const FIRST_NAMES_M = [
    'James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles',
    'Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua',
    'Kenneth','Kevin','Brian','George','Timothy','Ronald','Edward','Jason','Jeffrey','Ryan',
    'Jacob','Gary','Nicholas','Eric','Jonathan','Stephen','Larry','Justin','Scott','Brandon',
    'Benjamin','Samuel','Raymond','Gregory','Frank','Alexander','Patrick','Jack','Dennis','Jerry',
    'Tyler','Aaron','Jose','Nathan','Henry','Peter','Adam','Douglas','Zachary','Walter'
  ];

  const FIRST_NAMES_F = [
    'Mary','Patricia','Jennifer','Linda','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen',
    'Lisa','Nancy','Betty','Margaret','Sandra','Ashley','Dorothy','Kimberly','Emily','Donna',
    'Michelle','Carol','Amanda','Melissa','Deborah','Stephanie','Rebecca','Sharon','Laura','Cynthia',
    'Kathleen','Amy','Angela','Shirley','Anna','Brenda','Pamela','Emma','Nicole','Helen',
    'Samantha','Katherine','Christine','Debra','Rachel','Carolyn','Janet','Catherine','Maria','Heather',
    'Diane','Ruth','Julie','Olivia','Joyce','Virginia','Victoria','Kelly','Lauren','Christina'
  ];

  const FIRST_NAMES = FIRST_NAMES_M.concat(FIRST_NAMES_F);

  const LAST_NAMES = [
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
    'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
    'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
    'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
    'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
    'Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes',
    'Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper',
    'Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson',
    'Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes',
    'Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez'
  ];

  const CITIES_WITH_COUNTRIES = [
    ['New York','United States'],['London','United Kingdom'],['Paris','France'],['Tokyo','Japan'],
    ['Berlin','Germany'],['Sydney','Australia'],['Toronto','Canada'],['Amsterdam','Netherlands'],
    ['Rome','Italy'],['Madrid','Spain'],['Seoul','South Korea'],['Mumbai','India'],
    ['Mexico City','Mexico'],['Buenos Aires','Argentina'],['Cairo','Egypt'],['Lagos','Nigeria'],
    ['Moscow','Russia'],['Istanbul','Turkey'],['Dubai','United Arab Emirates'],['Singapore','Singapore'],
    ['Bangkok','Thailand'],['Vienna','Austria'],['Prague','Czech Republic'],['Dublin','Ireland'],
    ['Stockholm','Sweden'],['Oslo','Norway'],['Helsinki','Finland'],['Copenhagen','Denmark'],
    ['Zurich','Switzerland'],['Brussels','Belgium'],['Warsaw','Poland'],['Lisbon','Portugal'],
    ['Athens','Greece'],['Budapest','Hungary'],['Bucharest','Romania'],['Beijing','China'],
    ['Shanghai','China'],['Jakarta','Indonesia'],['Kuala Lumpur','Malaysia'],['Manila','Philippines'],
    ['Taipei','Taiwan'],['Lima','Peru'],['Santiago','Chile'],['Bogota','Colombia'],
    ['Nairobi','Kenya'],['Cape Town','South Africa'],['Casablanca','Morocco'],['Hanoi','Vietnam'],
    ['Riyadh','Saudi Arabia'],['Doha','Qatar']
  ];

  const COUNTRIES = [...new Set(CITIES_WITH_COUNTRIES.map(c => c[1]))];

  const COMPANY_NAMES = [
    'Acme Corp','Globex Corporation','Initech','Umbrella Corporation','Stark Industries',
    'Wayne Enterprises','Cyberdyne Systems','Aperture Science','Soylent Corp','Tyrell Corporation',
    'Massive Dynamic','Oscorp Industries','LexCorp','Weyland-Yutani','InGen',
    'Abstergo Industries','Black Mesa','Monarch Solutions','Axiom Verge Labs','Nexus Technologies',
    'Pinnacle Systems','Vertex Solutions','Quantum Dynamics','Blue Horizon Inc','Silverline Group',
    'Helix Biotech','Orion Analytics','Apex Innovations','Catalyst Partners','Zenith Holdings'
  ];

  const JOB_TITLES = [
    'Software Engineer','Product Manager','Data Analyst','UX Designer','DevOps Engineer',
    'Marketing Manager','Sales Representative','Project Manager','Business Analyst','Quality Assurance Engineer',
    'Frontend Developer','Backend Developer','Full Stack Developer','Database Administrator','System Administrator',
    'Graphic Designer','Content Writer','Financial Analyst','Human Resources Manager','Operations Manager',
    'Chief Technology Officer','Chief Executive Officer','VP of Engineering','Lead Architect','Security Analyst',
    'Account Manager','Research Scientist','IT Consultant','Technical Writer','Customer Support Specialist'
  ];

  const DEPARTMENTS = [
    'Engineering','Marketing','Sales','Human Resources','Finance',
    'Operations','Research & Development','Customer Support','Legal','Information Technology',
    'Design','Product','Quality Assurance','Business Development','Administration',
    'Public Relations','Procurement','Logistics','Compliance','Data Science'
  ];

  const STREET_NAMES = [
    'Main','Oak','Maple','Cedar','Elm','Pine','Washington','Park','Lake','Hill',
    'Forest','River','Spring','Valley','Meadow','Sunset','Highland','Church','School','Mill',
    'North','South','Academy','Bridge','Center','Cherry','Franklin','Green','Liberty','Union'
  ];

  const STREET_SUFFIXES = ['St','Ave','Blvd','Dr','Ln','Rd','Way','Ct','Pl','Terrace'];

  const US_STATES = [
    ['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],
    ['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],
    ['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],
    ['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],
    ['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],
    ['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],
    ['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],
    ['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],
    ['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],
    ['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY']
  ];

  const CATCH_PHRASES = [
    'Synergize scalable solutions','Leverage agile frameworks','Iterate strategic initiatives',
    'Aggregate real-time technologies','Transition granular deliverables','Orchestrate integrated platforms',
    'Revolutionize end-to-end methodologies','Streamline cross-platform architectures',
    'Optimize bleeding-edge paradigms','Maximize next-generation synergies',
    'Drive innovative partnerships','Enable seamless convergence','Cultivate robust ecosystems',
    'Transform enterprise workflows','Harness disruptive innovation','Monetize dynamic channels',
    'Deploy mission-critical infrastructure','Scale distributed networks',
    'Empower data-driven decisions','Facilitate cloud-native operations'
  ];

  const TLDS = ['.com','.org','.net','.io','.dev','.co','.us','.info','.biz','.tech'];

  const TITLES = ['Mr.','Mrs.','Ms.','Dr.','Prof.'];

  const LOREM_WORDS = [
    'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
    'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim',
    'ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip',
    'ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit','voluptate',
    'velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint','occaecat','cupidatat',
    'non','proident','sunt','culpa','qui','officia','deserunt','mollit','anim','id','est'
  ];

  const CURRENCY_CODES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR','BRL','KRW','MXN','SEK','NOK','DKK'];

  const FILE_EXTENSIONS = [
    'txt','pdf','doc','docx','xls','xlsx','csv','json','xml','html',
    'js','ts','py','java','cpp','png','jpg','gif','svg','mp3',
    'mp4','zip','tar','gz','sql','md','yml','ini','log','bak'
  ];

  const MIME_TYPES = [
    'text/plain','text/html','text/css','text/csv','application/json',
    'application/xml','application/pdf','application/zip','application/gzip',
    'image/png','image/jpeg','image/gif','image/svg+xml',
    'audio/mpeg','audio/wav','video/mp4','video/webm',
    'application/javascript','application/octet-stream','application/sql'
  ];

  const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  // ===================================================================
  // FIELD TYPE REGISTRY
  // ===================================================================

  const FIELD_TYPES = [
    { group: 'Person', types: [
      { value: 'first_name', label: 'First Name' },
      { value: 'last_name', label: 'Last Name' },
      { value: 'full_name', label: 'Full Name' },
      { value: 'username', label: 'Username' },
      { value: 'title', label: 'Title (Mr/Mrs/Dr)' }
    ]},
    { group: 'Contact', types: [
      { value: 'email', label: 'Email' },
      { value: 'phone', label: 'Phone' },
      { value: 'mobile', label: 'Mobile' }
    ]},
    { group: 'Address', types: [
      { value: 'street', label: 'Street' },
      { value: 'city', label: 'City' },
      { value: 'state', label: 'State' },
      { value: 'zip', label: 'Zip Code' },
      { value: 'country', label: 'Country' },
      { value: 'full_address', label: 'Full Address' }
    ]},
    { group: 'Internet', types: [
      { value: 'url', label: 'URL' },
      { value: 'domain', label: 'Domain' },
      { value: 'ipv4', label: 'IP Address (v4)' },
      { value: 'ipv6', label: 'IP Address (v6)' },
      { value: 'mac', label: 'MAC Address' },
      { value: 'user_agent', label: 'User Agent' }
    ]},
    { group: 'Business', types: [
      { value: 'company', label: 'Company Name' },
      { value: 'job_title', label: 'Job Title' },
      { value: 'department', label: 'Department' },
      { value: 'catch_phrase', label: 'Catch Phrase' }
    ]},
    { group: 'Finance', types: [
      { value: 'credit_card', label: 'Credit Card Number' },
      { value: 'iban', label: 'IBAN' },
      { value: 'bic', label: 'BIC/SWIFT' },
      { value: 'currency', label: 'Currency Code' },
      { value: 'price', label: 'Price' }
    ]},
    { group: 'Data', types: [
      { value: 'uuid', label: 'UUID' },
      { value: 'boolean', label: 'Boolean' },
      { value: 'integer', label: 'Integer', hasRange: true },
      { value: 'float', label: 'Float', hasRange: true },
      { value: 'date', label: 'Date' },
      { value: 'datetime', label: 'DateTime' },
      { value: 'time', label: 'Time' },
      { value: 'timestamp', label: 'Timestamp' }
    ]},
    { group: 'Text', types: [
      { value: 'word', label: 'Word' },
      { value: 'sentence', label: 'Sentence' },
      { value: 'paragraph', label: 'Paragraph' },
      { value: 'lorem', label: 'Lorem Ipsum' }
    ]},
    { group: 'Color', types: [
      { value: 'hex_color', label: 'Hex Color' },
      { value: 'rgb_color', label: 'RGB Color' },
      { value: 'hsl_color', label: 'HSL Color' }
    ]},
    { group: 'File', types: [
      { value: 'file_name', label: 'File Name' },
      { value: 'file_ext', label: 'File Extension' },
      { value: 'mime_type', label: 'MIME Type' },
      { value: 'file_path', label: 'File Path' }
    ]}
  ];

  // Flat lookup: value -> { hasRange }
  const TYPE_META = {};
  for (const g of FIELD_TYPES)
    for (const t of g.types)
      TYPE_META[t.value] = t;

  // ===================================================================
  // RANDOM HELPERS
  // ===================================================================

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randFloat(min, max, decimals) { return +(Math.random() * (max - min) + min).toFixed(decimals || 2); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function hexByte() { return randInt(0, 255).toString(16).padStart(2, '0'); }

  // ===================================================================
  // DATA GENERATORS
  // ===================================================================

  function generateValue(type, opts) {
    const min = opts && opts.min != null ? +opts.min : 0;
    const max = opts && opts.max != null ? +opts.max : 1000;

    switch (type) {
      // Person
      case 'first_name': return pick(FIRST_NAMES);
      case 'last_name': return pick(LAST_NAMES);
      case 'full_name': return pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
      case 'username': {
        const fn = pick(FIRST_NAMES).toLowerCase();
        const ln = pick(LAST_NAMES).toLowerCase();
        return pick([fn + '.' + ln, fn + ln.charAt(0), fn + randInt(1, 999), fn + '_' + ln]);
      }
      case 'title': return pick(TITLES);

      // Contact
      case 'email': {
        const fn = pick(FIRST_NAMES).toLowerCase();
        const ln = pick(LAST_NAMES).toLowerCase();
        const domains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','proton.me','mail.com','icloud.com','aol.com','zoho.com','fastmail.com'];
        return fn + '.' + ln + '@' + pick(domains);
      }
      case 'phone': return '(' + randInt(200, 999) + ') ' + randInt(200, 999) + '-' + String(randInt(1000, 9999));
      case 'mobile': return '+1-' + randInt(200, 999) + '-' + randInt(200, 999) + '-' + String(randInt(1000, 9999));

      // Address
      case 'street': return randInt(1, 9999) + ' ' + pick(STREET_NAMES) + ' ' + pick(STREET_SUFFIXES);
      case 'city': return pick(CITIES_WITH_COUNTRIES)[0];
      case 'state': { const s = pick(US_STATES); return s[0]; }
      case 'zip': return String(randInt(10000, 99999));
      case 'country': return pick(COUNTRIES);
      case 'full_address': {
        const st = pick(US_STATES);
        return randInt(1, 9999) + ' ' + pick(STREET_NAMES) + ' ' + pick(STREET_SUFFIXES) + ', ' + pick(CITIES_WITH_COUNTRIES)[0] + ', ' + st[1] + ' ' + randInt(10000, 99999);
      }

      // Internet
      case 'url': {
        const domain = pick(LAST_NAMES).toLowerCase() + pick(TLDS);
        return 'https://' + domain + '/' + pick(LOREM_WORDS) + '/' + pick(LOREM_WORDS);
      }
      case 'domain': return pick(LAST_NAMES).toLowerCase() + pick(TLDS);
      case 'ipv4': return randInt(1, 254) + '.' + randInt(0, 255) + '.' + randInt(0, 255) + '.' + randInt(1, 254);
      case 'ipv6': return Array.from({ length: 8 }, () => randInt(0, 65535).toString(16).padStart(4, '0')).join(':');
      case 'mac': return Array.from({ length: 6 }, () => hexByte()).join(':').toUpperCase();
      case 'user_agent': return pick(USER_AGENTS);

      // Business
      case 'company': return pick(COMPANY_NAMES);
      case 'job_title': return pick(JOB_TITLES);
      case 'department': return pick(DEPARTMENTS);
      case 'catch_phrase': return pick(CATCH_PHRASES);

      // Finance
      case 'credit_card': {
        const prefixes = ['4','51','52','53','54','55','37'];
        let prefix = pick(prefixes);
        const len = prefix === '37' ? 15 : 16;
        while (prefix.length < len - 1)
          prefix += randInt(0, 9);
        // Luhn checksum
        let sum = 0;
        for (let i = 0; i < prefix.length; ++i) {
          let d = +prefix[prefix.length - 1 - i];
          if (i % 2 === 0) {
            d *= 2;
            if (d > 9) d -= 9;
          }
          sum += d;
        }
        const check = (10 - (sum % 10)) % 10;
        return prefix + check;
      }
      case 'iban': {
        const cc = pick(['DE','FR','GB','NL','IT','ES','AT','BE','CH','SE']);
        return cc + pad2(randInt(10, 99)) + ' ' + Array.from({ length: 4 }, () => String(randInt(1000, 9999))).join(' ');
      }
      case 'bic': {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let bic = '';
        for (let i = 0; i < 4; ++i) bic += letters[randInt(0, 25)];
        bic += pick(['DE','FR','GB','NL','US','CH','AT','IT']);
        for (let i = 0; i < 2; ++i) bic += letters[randInt(0, 25)];
        return bic;
      }
      case 'currency': return pick(CURRENCY_CODES);
      case 'price': return '$' + randFloat(0.99, 9999.99, 2).toFixed(2);

      // Data
      case 'uuid': {
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        return s4() + s4() + '-' + s4() + '-4' + s4().substring(1) + '-' + ['8','9','a','b'][randInt(0,3)] + s4().substring(1) + '-' + s4() + s4() + s4();
      }
      case 'boolean': return Math.random() < 0.5 ? 'true' : 'false';
      case 'integer': return randInt(min, max);
      case 'float': return randFloat(min, max, 2);
      case 'date': return randInt(1990, 2025) + '-' + pad2(randInt(1, 12)) + '-' + pad2(randInt(1, 28));
      case 'datetime': return randInt(1990, 2025) + '-' + pad2(randInt(1, 12)) + '-' + pad2(randInt(1, 28)) + 'T' + pad2(randInt(0, 23)) + ':' + pad2(randInt(0, 59)) + ':' + pad2(randInt(0, 59));
      case 'time': return pad2(randInt(0, 23)) + ':' + pad2(randInt(0, 59)) + ':' + pad2(randInt(0, 59));
      case 'timestamp': return randInt(631152000, 1735689600);

      // Text
      case 'word': return pick(LOREM_WORDS);
      case 'sentence': {
        const len = randInt(5, 15);
        const words = Array.from({ length: len }, () => pick(LOREM_WORDS));
        words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        return words.join(' ') + '.';
      }
      case 'paragraph': {
        const sentences = randInt(3, 7);
        const parts = [];
        for (let i = 0; i < sentences; ++i) {
          const len = randInt(5, 15);
          const words = Array.from({ length: len }, () => pick(LOREM_WORDS));
          words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
          parts.push(words.join(' ') + '.');
        }
        return parts.join(' ');
      }
      case 'lorem': return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

      // Color
      case 'hex_color': return '#' + hexByte() + hexByte() + hexByte();
      case 'rgb_color': return 'rgb(' + randInt(0, 255) + ', ' + randInt(0, 255) + ', ' + randInt(0, 255) + ')';
      case 'hsl_color': return 'hsl(' + randInt(0, 360) + ', ' + randInt(0, 100) + '%, ' + randInt(0, 100) + '%)';

      // File
      case 'file_name': {
        const nameWords = [pick(LOREM_WORDS), pick(LOREM_WORDS)];
        return nameWords.join('_') + '.' + pick(FILE_EXTENSIONS);
      }
      case 'file_ext': return '.' + pick(FILE_EXTENSIONS);
      case 'mime_type': return pick(MIME_TYPES);
      case 'file_path': {
        const dirs = ['documents','downloads','images','data','reports','tmp','backup','projects'];
        return '/' + pick(dirs) + '/' + pick(dirs) + '/' + pick(LOREM_WORDS) + '.' + pick(FILE_EXTENSIONS);
      }

      default: return '';
    }
  }

  // ===================================================================
  // OUTPUT FORMATTERS
  // ===================================================================

  function escCsv(val) {
    const s = String(val);
    if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0)
      return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function escXml(val) {
    return String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escSql(val) {
    return "'" + String(val).replace(/'/g, "''") + "'";
  }

  function formatOutput(rows, fields, format, tableName) {
    switch (format) {
      case 'json':
        return JSON.stringify(rows, null, 2);

      case 'csv': {
        const header = fields.map(f => escCsv(f.name)).join(',');
        const lines = rows.map(row => fields.map(f => escCsv(row[f.name])).join(','));
        return header + '\n' + lines.join('\n');
      }

      case 'tsv': {
        const header = fields.map(f => f.name).join('\t');
        const lines = rows.map(row => fields.map(f => String(row[f.name])).join('\t'));
        return header + '\n' + lines.join('\n');
      }

      case 'sql': {
        const cols = fields.map(f => '`' + f.name + '`').join(', ');
        const lines = rows.map(row => {
          const vals = fields.map(f => {
            const v = row[f.name];
            if (typeof v === 'number') return String(v);
            if (v === 'true' || v === 'false') return v.toUpperCase();
            return escSql(v);
          });
          return 'INSERT INTO `' + tableName + '` (' + cols + ') VALUES (' + vals.join(', ') + ');';
        });
        return lines.join('\n');
      }

      case 'xml': {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
        for (const row of rows) {
          xml += '  <row>\n';
          for (const f of fields) {
            const tag = f.name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^([^a-zA-Z_])/, '_$1') || 'field';
            xml += '    <' + tag + '>' + escXml(row[f.name]) + '</' + tag + '>\n';
          }
          xml += '  </row>\n';
        }
        xml += '</data>';
        return xml;
      }

      default:
        return '';
    }
  }

  // ===================================================================
  // STATE
  // ===================================================================

  let nextFieldId = 1;
  let fields = [];
  let lastOutput = '';

  function makeField(name, type, min, max) {
    return { id: nextFieldId++, name: name || 'field', type: type || 'first_name', min: min, max: max };
  }

  // Default fields
  fields = [
    makeField('id', 'integer', 1, 10000),
    makeField('firstName', 'first_name'),
    makeField('lastName', 'last_name'),
    makeField('email', 'email'),
    makeField('phone', 'phone'),
    makeField('city', 'city'),
    makeField('country', 'country')
  ];

  // ===================================================================
  // DOM REFS
  // ===================================================================

  const $rowCount = document.getElementById('row-count');
  const $outputFormat = document.getElementById('output-format');
  const $tableNameLabel = document.getElementById('table-name-label');
  const $tableName = document.getElementById('table-name');
  const $btnGenerate = document.getElementById('btn-generate');
  const $btnCopy = document.getElementById('btn-copy');
  const $btnExport = document.getElementById('btn-export');
  const $fieldList = document.getElementById('field-list');
  const $btnAddField = document.getElementById('btn-add-field');
  const $outputCode = document.getElementById('output-code');
  const $statusBar = document.getElementById('status-bar');

  // ===================================================================
  // FIELD TYPE SELECT HTML
  // ===================================================================

  function buildTypeSelectHtml(selectedValue) {
    let html = '';
    for (const group of FIELD_TYPES) {
      html += '<optgroup label="' + group.group + '">';
      for (const t of group.types) {
        const sel = t.value === selectedValue ? ' selected' : '';
        html += '<option value="' + t.value + '"' + sel + '>' + t.label + '</option>';
      }
      html += '</optgroup>';
    }
    return html;
  }

  // ===================================================================
  // RENDER FIELDS
  // ===================================================================

  function renderFields() {
    $fieldList.innerHTML = '';
    for (let i = 0; i < fields.length; ++i) {
      const f = fields[i];
      const row = document.createElement('div');
      row.className = 'field-row';
      row.dataset.id = f.id;

      // Move up/down buttons
      const moveDiv = document.createElement('div');
      moveDiv.className = 'field-move-btns';
      const btnUp = document.createElement('button');
      btnUp.textContent = '\u25B2';
      btnUp.title = 'Move up';
      btnUp.disabled = i === 0;
      btnUp.addEventListener('click', () => moveField(f.id, -1));
      const btnDown = document.createElement('button');
      btnDown.textContent = '\u25BC';
      btnDown.title = 'Move down';
      btnDown.disabled = i === fields.length - 1;
      btnDown.addEventListener('click', () => moveField(f.id, 1));
      moveDiv.appendChild(btnUp);
      moveDiv.appendChild(btnDown);
      row.appendChild(moveDiv);

      // Name input
      const nameInput = document.createElement('input');
      nameInput.className = 'field-name';
      nameInput.type = 'text';
      nameInput.value = f.name;
      nameInput.spellcheck = false;
      nameInput.addEventListener('change', () => { f.name = nameInput.value.trim() || 'field'; });
      row.appendChild(nameInput);

      // Type select
      const typeSelect = document.createElement('select');
      typeSelect.className = 'field-type';
      typeSelect.innerHTML = buildTypeSelectHtml(f.type);
      typeSelect.addEventListener('change', () => {
        f.type = typeSelect.value;
        renderFields();
      });
      row.appendChild(typeSelect);

      // Options (min/max for integer/float)
      const meta = TYPE_META[f.type];
      if (meta && meta.hasRange) {
        const optDiv = document.createElement('div');
        optDiv.className = 'field-options';

        const minLabel = document.createElement('label');
        minLabel.textContent = 'min';
        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.value = f.min != null ? f.min : 0;
        minInput.addEventListener('change', () => { f.min = +minInput.value; });
        optDiv.appendChild(minLabel);
        optDiv.appendChild(minInput);

        const maxLabel = document.createElement('label');
        maxLabel.textContent = 'max';
        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.value = f.max != null ? f.max : 1000;
        maxInput.addEventListener('change', () => { f.max = +maxInput.value; });
        optDiv.appendChild(maxLabel);
        optDiv.appendChild(maxInput);

        row.appendChild(optDiv);
      }

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'field-delete';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Remove field';
      delBtn.addEventListener('click', () => removeField(f.id));
      row.appendChild(delBtn);

      $fieldList.appendChild(row);
    }
  }

  function moveField(id, dir) {
    const idx = fields.findIndex(f => f.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const tmp = fields[idx];
    fields[idx] = fields[newIdx];
    fields[newIdx] = tmp;
    renderFields();
  }

  function removeField(id) {
    fields = fields.filter(f => f.id !== id);
    renderFields();
  }

  function addField() {
    fields.push(makeField('newField', 'first_name'));
    renderFields();
    // Scroll to bottom
    $fieldList.scrollTop = $fieldList.scrollHeight;
  }

  // ===================================================================
  // GENERATION
  // ===================================================================

  function generate() {
    const count = Math.max(1, Math.min(10000, +$rowCount.value || 10));
    $rowCount.value = count;

    if (fields.length === 0) {
      $outputCode.textContent = '(No fields configured)';
      $statusBar.textContent = 'No fields configured';
      lastOutput = '';
      return;
    }

    const rows = [];
    for (let i = 0; i < count; ++i) {
      const row = {};
      for (const f of fields) {
        let val = generateValue(f.type, { min: f.min, max: f.max });
        // For integer type used as "id", auto-increment is more useful
        if (f.type === 'integer' && f.name.toLowerCase() === 'id')
          val = (f.min != null ? +f.min : 1) + i;
        row[f.name] = val;
      }
      rows.push(row);
    }

    const format = $outputFormat.value;
    const tableName = $tableName.value.trim() || 'users';
    lastOutput = formatOutput(rows, fields, format, tableName);

    const highlightLang = { json: 'json', csv: 'none', sql: 'sql', xml: 'xml', tsv: 'none' }[format] || 'none';
    if (highlightLang !== 'none' && SZ.SyntaxHighlighter)
      $outputCode.innerHTML = SZ.SyntaxHighlighter.highlightBlock(lastOutput, highlightLang);
    else
      $outputCode.textContent = lastOutput;
    const sizeKb = (new Blob([lastOutput]).size / 1024).toFixed(1);
    $statusBar.textContent = 'Generated ' + count + ' rows | ' + sizeKb + ' KB | ' + format.toUpperCase();
  }

  // ===================================================================
  // COPY / EXPORT
  // ===================================================================

  function copyToClipboard() {
    if (!lastOutput) {
      $statusBar.textContent = 'Nothing to copy. Generate data first.';
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastOutput).then(
        () => { $statusBar.textContent = 'Copied to clipboard!'; },
        () => { fallbackCopy(); }
      );
    } else
      fallbackCopy();
  }

  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = lastOutput;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      $statusBar.textContent = 'Copied to clipboard!';
    } catch (_) {
      $statusBar.textContent = 'Copy failed. Select the output manually.';
    }
    document.body.removeChild(ta);
  }

  function exportFile() {
    if (!lastOutput) {
      $statusBar.textContent = 'Nothing to export. Generate data first.';
      return;
    }
    const format = $outputFormat.value;
    const extMap = { json: 'json', csv: 'csv', tsv: 'tsv', sql: 'sql', xml: 'xml' };
    const mimeMap = { json: 'application/json', csv: 'text/csv', tsv: 'text/tab-separated-values', sql: 'application/sql', xml: 'application/xml' };
    const filename = 'mock-data.' + (extMap[format] || 'txt');
    const mime = mimeMap[format] || 'text/plain';

    if (ComDlg32 && ComDlg32.ExportFile)
      ComDlg32.ExportFile(lastOutput, filename, mime);
    else {
      // Fallback
      const blob = new Blob([lastOutput], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    $statusBar.textContent = 'Exported as ' + filename;
  }

  // ===================================================================
  // TOOLBAR EVENTS
  // ===================================================================

  $btnGenerate.addEventListener('click', generate);
  $btnCopy.addEventListener('click', copyToClipboard);
  $btnExport.addEventListener('click', exportFile);
  $btnAddField.addEventListener('click', addField);

  $outputFormat.addEventListener('change', () => {
    const isSql = $outputFormat.value === 'sql';
    if (isSql)
      $tableNameLabel.classList.remove('hidden');
    else
      $tableNameLabel.classList.add('hidden');
  });

  // ===================================================================
  // MENU SYSTEM
  // ===================================================================

  function handleMenuAction(action) {
    if (action === 'about')
      SZ.Dialog.show('dlg-about');
  }

  new SZ.MenuBar({ onAction: handleMenuAction });
  SZ.Dialog.wireAll();

  // ===================================================================
  // INIT
  // ===================================================================

  function init() {
    if (User32)
      User32.EnableVisualStyles();
    renderFields();
    // Initial generation
    generate();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();

})();
