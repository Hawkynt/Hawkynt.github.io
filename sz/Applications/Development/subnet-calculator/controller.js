;(function() {
  'use strict';

  // ---- Constants ----

  const QUICK_CIDRS = [8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32];

  // ---- DOM References ----

  const ipInput = document.getElementById('ip-input');
  const cidrInput = document.getElementById('cidr-input');
  const maskInput = document.getElementById('mask-input');
  const quickCidrEl = document.getElementById('quick-cidr');
  const bitViewEl = document.getElementById('bit-view');
  const divisionSelect = document.getElementById('division-select');
  const divisionTbody = document.getElementById('division-tbody');

  const resNetwork = document.getElementById('res-network');
  const resBroadcast = document.getElementById('res-broadcast');
  const resFirstHost = document.getElementById('res-first-host');
  const resLastHost = document.getElementById('res-last-host');
  const resTotal = document.getElementById('res-total');
  const resUsable = document.getElementById('res-usable');
  const resMask = document.getElementById('res-mask');
  const resWildcard = document.getElementById('res-wildcard');
  const resClass = document.getElementById('res-class');
  const resType = document.getElementById('res-type');
  const resHex = document.getElementById('res-hex');
  const resInteger = document.getElementById('res-integer');

  const statusClass = document.getElementById('status-class');
  const statusType = document.getElementById('status-type');
  const statusValid = document.getElementById('status-valid');

  // ---- Conversion Helpers ----

  function ipToLong(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255))
      return null;
    return (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  }

  function longToIp(long) {
    return `${(long >>> 24)}.${(long >>> 16) & 255}.${(long >>> 8) & 255}.${long & 255}`;
  }

  function cidrToMask(cidr) {
    if (cidr <= 0) return 0;
    if (cidr >= 32) return 0xFFFFFFFF >>> 0;
    return (~0 << (32 - cidr)) >>> 0;
  }

  function maskToCidr(mask) {
    let cidr = 0;
    let m = mask;
    while (m & 0x80000000) {
      ++cidr;
      m = (m << 1) >>> 0;
    }
    return cidr;
  }

  function isValidMask(long) {
    const inverted = (~long) >>> 0;
    return (inverted & (inverted + 1)) === 0;
  }

  function longToBinary(long) {
    return long.toString(2).padStart(32, '0');
  }

  function longToHex(long) {
    return '0x' + long.toString(16).toUpperCase().padStart(8, '0');
  }

  function getIpClass(ipLong) {
    const first = ipLong >>> 24;
    if (first < 128) return 'A';
    if (first < 192) return 'B';
    if (first < 224) return 'C';
    if (first < 240) return 'D';
    return 'E';
  }

  function getIpType(ipLong) {
    const first = ipLong >>> 24;
    const second = (ipLong >>> 16) & 255;

    if (first === 127)
      return 'Loopback';
    if (first === 10)
      return 'Private (10.0.0.0/8)';
    if (first === 172 && second >= 16 && second <= 31)
      return 'Private (172.16.0.0/12)';
    if (first === 192 && second === 168)
      return 'Private (192.168.0.0/16)';
    if (first === 169 && second === 254)
      return 'Link-Local';
    if (first >= 224 && first <= 239)
      return 'Multicast';
    if (first >= 240)
      return 'Reserved';
    if (first === 0)
      return 'Current Network';
    return 'Public';
  }

  // ---- Core Calculation ----

  function calculate() {
    const ipLong = ipToLong(ipInput.value.trim());
    const cidr = parseInt(cidrInput.value, 10);

    if (ipLong === null || isNaN(cidr) || cidr < 0 || cidr > 32)
      return null;

    const maskLong = cidrToMask(cidr);
    const wildcardLong = (~maskLong) >>> 0;
    const networkLong = (ipLong & maskLong) >>> 0;
    const broadcastLong = (networkLong | wildcardLong) >>> 0;
    const totalHosts = Math.pow(2, 32 - cidr);
    let usableHosts, firstHost, lastHost;

    if (cidr >= 32) {
      usableHosts = 1;
      firstHost = ipLong;
      lastHost = ipLong;
    } else if (cidr === 31) {
      usableHosts = 2;
      firstHost = networkLong;
      lastHost = broadcastLong;
    } else {
      usableHosts = totalHosts - 2;
      firstHost = (networkLong + 1) >>> 0;
      lastHost = (broadcastLong - 1) >>> 0;
    }

    return {
      ipLong, cidr, maskLong, wildcardLong, networkLong, broadcastLong,
      totalHosts, usableHosts, firstHost, lastHost,
      ipClass: getIpClass(ipLong),
      ipType: getIpType(ipLong)
    };
  }

  // ---- Rendering ----

  function renderResults(r) {
    resNetwork.textContent = longToIp(r.networkLong);
    resBroadcast.textContent = longToIp(r.broadcastLong);
    resFirstHost.textContent = longToIp(r.firstHost);
    resLastHost.textContent = longToIp(r.lastHost);
    resTotal.textContent = r.totalHosts.toLocaleString();
    resUsable.textContent = r.usableHosts.toLocaleString();
    resMask.textContent = longToIp(r.maskLong);
    resWildcard.textContent = longToIp(r.wildcardLong);
    resClass.textContent = 'Class ' + r.ipClass;
    resType.textContent = r.ipType;
    resHex.textContent = longToHex(r.ipLong);
    resInteger.textContent = r.ipLong.toString();
  }

  function renderBitView(r) {
    bitViewEl.innerHTML = '';
    const rows = [
      ['IP', r.ipLong],
      ['Mask', r.maskLong],
      ['Network', r.networkLong],
      ['Broadcast', r.broadcastLong]
    ];

    for (const [label, value] of rows) {
      const binary = longToBinary(value);

      const labelEl = document.createElement('div');
      labelEl.className = 'bit-label';
      labelEl.textContent = label;
      bitViewEl.appendChild(labelEl);

      for (let octet = 0; octet < 4; ++octet) {
        const group = document.createElement('div');
        group.className = 'bit-group';
        for (let bit = 0; bit < 8; ++bit) {
          const idx = octet * 8 + bit;
          const el = document.createElement('div');
          el.className = 'bit';
          el.textContent = binary[idx];

          if (label === 'Mask') {
            el.classList.add('bit-mask', 'clickable');
            el.dataset.index = idx;
          } else if (idx < r.cidr)
            el.classList.add('network-bit');

          group.appendChild(el);
        }
        bitViewEl.appendChild(group);
      }
    }
  }

  function renderSubnets(r) {
    divisionTbody.innerHTML = '';
    const count = parseInt(divisionSelect.value, 10);
    const bitsNeeded = Math.log2(count);
    const newCidr = r.cidr + bitsNeeded;

    if (newCidr > 32) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'division-error';
      td.textContent = `Cannot divide /${r.cidr} into ${count} subnets (would need /${newCidr})`;
      tr.appendChild(td);
      divisionTbody.appendChild(tr);
      return;
    }

    const subnetMask = cidrToMask(newCidr);
    const subnetSize = Math.pow(2, 32 - newCidr);

    for (let i = 0; i < count; ++i) {
      const subNet = (r.networkLong + i * subnetSize) >>> 0;
      const subBcast = (subNet + subnetSize - 1) >>> 0;
      let rangeText, hosts;

      if (newCidr >= 32) {
        rangeText = longToIp(subNet);
        hosts = 1;
      } else if (newCidr === 31) {
        rangeText = `${longToIp(subNet)} - ${longToIp(subBcast)}`;
        hosts = 2;
      } else {
        rangeText = `${longToIp((subNet + 1) >>> 0)} - ${longToIp((subBcast - 1) >>> 0)}`;
        hosts = subnetSize - 2;
      }

      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${i + 1}</td>` +
        `<td>${longToIp(subNet)}/${newCidr}</td>` +
        `<td>${longToIp(subBcast)}</td>` +
        `<td>${rangeText}</td>` +
        `<td>${hosts.toLocaleString()}</td>`;
      divisionTbody.appendChild(tr);
    }
  }

  function renderQuickCidr() {
    quickCidrEl.innerHTML = '';
    for (const c of QUICK_CIDRS) {
      const btn = document.createElement('button');
      btn.textContent = '/' + c;
      btn.dataset.cidr = c;
      quickCidrEl.appendChild(btn);
    }
  }

  function updateQuickCidrActive(cidr) {
    for (const btn of quickCidrEl.children)
      btn.classList.toggle('active', parseInt(btn.dataset.cidr, 10) === cidr);
  }

  function updateStatusBar(r) {
    if (!r) {
      statusClass.textContent = '\u2014';
      statusType.textContent = '\u2014';
      statusValid.textContent = 'Invalid';
      statusValid.classList.add('status-invalid');
      return;
    }
    statusClass.textContent = 'Class ' + r.ipClass;
    statusType.textContent = r.ipType;
    statusValid.textContent = 'Valid';
    statusValid.classList.remove('status-invalid');
  }

  function clearAll() {
    for (const el of [resNetwork, resBroadcast, resFirstHost, resLastHost, resTotal,
      resUsable, resMask, resWildcard, resClass, resType, resHex, resInteger])
      el.textContent = '';
    bitViewEl.innerHTML = '';
    divisionTbody.innerHTML = '';
  }

  function updateAll() {
    const valid = ipToLong(ipInput.value.trim()) !== null;
    ipInput.classList.toggle('input-invalid', !valid);

    const r = calculate();
    updateStatusBar(r);

    if (!r) {
      clearAll();
      return;
    }

    renderResults(r);
    renderBitView(r);
    renderSubnets(r);
    updateQuickCidrActive(r.cidr);
  }

  // ---- Sync Helpers ----

  function updateFromCIDR() {
    const cidr = parseInt(cidrInput.value, 10);
    if (!isNaN(cidr) && cidr >= 0 && cidr <= 32)
      maskInput.value = longToIp(cidrToMask(cidr));
    updateAll();
  }

  function updateFromMask() {
    const maskLong = ipToLong(maskInput.value.trim());
    if (maskLong !== null && isValidMask(maskLong))
      cidrInput.value = maskToCidr(maskLong);
    updateAll();
  }

  // ---- Copy Results ----

  function copyAllResults() {
    const r = calculate();
    if (!r)
      return;

    const lines = [
      `IP Address:      ${ipInput.value.trim()}`,
      `CIDR:            /${r.cidr}`,
      `Subnet Mask:     ${longToIp(r.maskLong)}`,
      `Wildcard Mask:   ${longToIp(r.wildcardLong)}`,
      `Network:         ${longToIp(r.networkLong)}`,
      `Broadcast:       ${longToIp(r.broadcastLong)}`,
      `First Host:      ${longToIp(r.firstHost)}`,
      `Last Host:       ${longToIp(r.lastHost)}`,
      `Total Hosts:     ${r.totalHosts.toLocaleString()}`,
      `Usable Hosts:    ${r.usableHosts.toLocaleString()}`,
      `IP Class:        Class ${r.ipClass}`,
      `IP Type:         ${r.ipType}`,
      `Hex:             ${longToHex(r.ipLong)}`,
      `Integer:         ${r.ipLong}`
    ];

    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }

  // ---- Menu System ----

  function handleAction(action) {
    switch (action) {
      case 'copy-all': copyAllResults(); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;
    }
  }

  // ---- Event Binding ----

  ipInput.addEventListener('input', updateAll);
  cidrInput.addEventListener('input', updateFromCIDR);
  maskInput.addEventListener('input', updateFromMask);
  divisionSelect.addEventListener('change', updateAll);

  // Bit view — single delegated listener
  bitViewEl.addEventListener('click', (e) => {
    if (!e.target.classList.contains('clickable'))
      return;

    const bitIndex = parseInt(e.target.dataset.index, 10);
    const clickedBit = e.target.textContent;
    let newCidr;

    if (clickedBit === '1')
      newCidr = bitIndex;
    else
      newCidr = bitIndex + 1;

    cidrInput.value = newCidr;
    maskInput.value = longToIp(cidrToMask(newCidr));
    updateAll();
  });

  // Quick CIDR — single delegated listener
  quickCidrEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cidr]');
    if (!btn)
      return;
    const cidr = parseInt(btn.dataset.cidr, 10);
    cidrInput.value = cidr;
    maskInput.value = longToIp(cidrToMask(cidr));
    updateAll();
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      copyAllResults();
    }
  });

  // ---- Initialization ----

  renderQuickCidr();
  new SZ.MenuBar({ onAction: handleAction });
  updateFromCIDR();

})();
