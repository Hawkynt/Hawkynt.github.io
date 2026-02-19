;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const F = window.SZ.Formats;
  const { formatSize } = P;

  // =========================================================================
  // D64 / D71 / D81 — Commodore disk images
  // =========================================================================

  function parseD64Adapter(bytes) {
    const desc = F.find('d64');
    if (!desc) return { categories: [], images: [] };
    const d = desc.parse(bytes);
    return buildCommodoreCategories(d, 'D64');
  }

  function parseD71Adapter(bytes) {
    const desc = F.find('d71');
    if (!desc) return { categories: [], images: [] };
    const d = desc.parse(bytes);
    return buildCommodoreCategories(d, 'D71');
  }

  function parseD81Adapter(bytes) {
    const desc = F.find('d81');
    if (!desc) return { categories: [], images: [] };
    const d = desc.parse(bytes);
    return buildCommodoreCategories(d, 'D81');
  }

  function parseT64Adapter(bytes) {
    const desc = F.find('t64');
    if (!desc) return { categories: [], images: [] };
    const d = desc.parse(bytes);
    return buildCommodoreCategories(d, 'T64');
  }

  function buildCommodoreCategories(d, formatLabel) {
    const categories = [];

    // ---- Disk Info category ----
    const info = [];
    info.push({ key: formatLabel.toLowerCase() + '.name', label: 'Disk Name', value: d.diskName || '(none)' });
    info.push({ key: formatLabel.toLowerCase() + '.id', label: 'Disk ID', value: d.diskId || '(none)' });
    info.push({ key: formatLabel.toLowerCase() + '.dos', label: 'DOS Type', value: d.dosType || '(none)' });
    if (d.dosVersion !== undefined)
      info.push({ key: formatLabel.toLowerCase() + '.dosver', label: 'DOS Version', value: '0x' + d.dosVersion.toString(16).toUpperCase().padStart(2, '0') });
    info.push({ key: formatLabel.toLowerCase() + '.tracks', label: 'Tracks', value: String(d.tracks) });
    info.push({ key: formatLabel.toLowerCase() + '.total', label: 'Total Blocks', value: String(d.totalBlocks) });
    if (d.hasErrors)
      info.push({ key: formatLabel.toLowerCase() + '.errors', label: 'Error Bytes', value: 'Present' });
    if (d.errors)
      for (const err of d.errors)
        info.push({ key: formatLabel.toLowerCase() + '.err', label: 'Error', value: err });

    categories.push({ name: formatLabel + ' Disk Info', icon: 'info', fields: info });

    // ---- BAM category ----
    if (d.bam) {
      const bamFields = [];
      bamFields.push({ key: formatLabel.toLowerCase() + '.bam.free', label: 'Free Blocks', value: String(d.bam.freeBlocks) });
      bamFields.push({ key: formatLabel.toLowerCase() + '.bam.used', label: 'Used Blocks', value: String(d.bam.totalBlocks - d.bam.freeBlocks) });
      bamFields.push({ key: formatLabel.toLowerCase() + '.bam.total', label: 'Total Blocks', value: String(d.bam.totalBlocks) });
      bamFields.push({ key: formatLabel.toLowerCase() + '.bam.pct', label: 'Usage', value: ((1 - d.bam.freeBlocks / d.bam.totalBlocks) * 100).toFixed(1) + '%' });

      // Per-track summary as a compact visualization
      if (d.bam.perTrack && d.bam.perTrack.length > 0) {
        const trackSummary = d.bam.perTrack.map(t =>
          'T' + String(t.track).padStart(2, '0') + ': ' + t.free + '/' + t.total + ' free'
        ).join('\n');
        bamFields.push({ key: formatLabel.toLowerCase() + '.bam.map', label: 'Block Map', value: trackSummary });
      }

      categories.push({ name: 'Block Availability Map', icon: 'list', fields: bamFields });
    }

    // ---- Directory listing category ----
    if (d.directory && d.directory.length > 0) {
      const dirFields = [];
      dirFields.push({ key: formatLabel.toLowerCase() + '.dir.count', label: 'File Count', value: String(d.directory.length) });

      for (let i = 0; i < d.directory.length; ++i) {
        const entry = d.directory[i];
        const flags = [];
        if (entry.locked) flags.push('locked');
        if (entry.splat) flags.push('*splat');
        const flagStr = flags.length ? ' [' + flags.join(', ') + ']' : '';
        const sectorInfo = 'T' + entry.startTrack + '/S' + entry.startSector;

        dirFields.push({
          key: formatLabel.toLowerCase() + '.dir.' + i,
          label: entry.name,
          value: entry.type + '  ' + entry.sizeBlocks + ' blocks (~' + formatSize(entry.sizeBytes) + ')  ' + sectorInfo + flagStr,
        });
      }

      const totalBlocks = d.directory.reduce((a, e) => a + e.sizeBlocks, 0);
      dirFields.push({
        key: formatLabel.toLowerCase() + '.dir.total',
        label: 'Total',
        value: totalBlocks + ' blocks in ' + d.directory.length + ' files',
      });

      categories.push({ name: 'Directory (' + d.directory.length + ' files)', icon: 'list', fields: dirFields });
    }

    // Offer 6502 disassembly for first PRG file
    let disassembly = null;
    if (d.directory && d.extractFile) {
      const firstPrg = d.directory.find(e => e.type === 'PRG');
      if (firstPrg) {
        const prgData = d.extractFile(firstPrg);
        if (prgData && prgData.length > 2)
          disassembly = { archId: '6502', bytes: prgData, offset: 2, count: 200 };
      }
    }

    return { categories, images: [], disassembly: disassembly ? [disassembly] : null };
  }

  // =========================================================================
  // ADF — Amiga Disk File
  // =========================================================================

  function parseADFAdapter(bytes) {
    const desc = F.find('adf');
    if (!desc) return { categories: [], images: [] };
    const d = desc.parse(bytes);

    const categories = [];

    // ---- Volume Info ----
    const info = [];
    info.push({ key: 'adf.volume', label: 'Volume Name', value: d.volumeName || '(unnamed)' });
    info.push({ key: 'adf.fs', label: 'Filesystem', value: d.filesystem });
    if (d.rootBlock) {
      if (d.rootBlock.diskCreated)
        info.push({ key: 'adf.created', label: 'Disk Created', value: formatDate(d.rootBlock.diskCreated) });
      if (d.rootBlock.modified)
        info.push({ key: 'adf.modified', label: 'Root Modified', value: formatDate(d.rootBlock.modified) });
    }
    info.push({ key: 'adf.bmvalid', label: 'Bitmap Valid', value: d.bmValid ? 'Yes' : 'No (needs repair)' });
    if (d.errors)
      for (const err of d.errors)
        info.push({ key: 'adf.err', label: 'Error', value: err });

    categories.push({ name: 'ADF Volume Info', icon: 'info', fields: info });

    // ---- Bitmap summary ----
    if (d.bitmap) {
      const bmFields = [];
      bmFields.push({ key: 'adf.bm.free', label: 'Free Blocks', value: String(d.bitmap.freeBlocks) });
      bmFields.push({ key: 'adf.bm.used', label: 'Used Blocks', value: String(d.bitmap.usedBlocks) });
      bmFields.push({ key: 'adf.bm.total', label: 'Total Blocks', value: String(d.bitmap.totalBlocks) });
      const freeKB = (d.bitmap.freeBlocks * 512 / 1024).toFixed(1);
      const totalKB = (d.bitmap.totalBlocks * 512 / 1024).toFixed(1);
      bmFields.push({ key: 'adf.bm.size', label: 'Free Space', value: freeKB + ' KB / ' + totalKB + ' KB' });
      bmFields.push({ key: 'adf.bm.pct', label: 'Usage', value: ((d.bitmap.usedBlocks / d.bitmap.totalBlocks) * 100).toFixed(1) + '%' });
      categories.push({ name: 'Block Allocation', icon: 'list', fields: bmFields });
    }

    // ---- Directory listing ----
    if (d.directory && d.directory.length > 0) {
      const dirFields = [];
      const dirs = d.directory.filter(e => e.type === 'dir');
      const files = d.directory.filter(e => e.type === 'file');
      dirFields.push({ key: 'adf.dir.summary', label: 'Contents', value: files.length + ' files, ' + dirs.length + ' directories' });

      for (let i = 0; i < d.directory.length; ++i) {
        const entry = d.directory[i];
        let value;
        if (entry.type === 'dir')
          value = '[DIR]  ' + entry.protection;
        else
          value = formatSize(entry.size) + '  ' + entry.protection;

        if (entry.date)
          value += '  ' + formatDate(entry.date);
        if (entry.comment)
          value += '  "' + entry.comment + '"';

        dirFields.push({
          key: 'adf.dir.' + i,
          label: (entry.type === 'dir' ? '\u{1F4C1} ' : '') + entry.name,
          value,
        });
      }

      const totalSize = files.reduce((a, e) => a + e.size, 0);
      dirFields.push({
        key: 'adf.dir.total',
        label: 'Total File Size',
        value: formatSize(totalSize),
      });

      categories.push({ name: 'Root Directory (' + d.directory.length + ' entries)', icon: 'list', fields: dirFields });
    }

    return { categories, images: [] };
  }

  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return '(invalid date)';
    return d.toLocaleString();
  }

  // =========================================================================
  // Register all disk image parsers
  // =========================================================================

  P.registerParsers({
    d64: parseD64Adapter,
    d71: parseD71Adapter,
    d81: parseD81Adapter,
    t64: parseT64Adapter,
    adf: parseADFAdapter,
  });

})();
