;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // -----------------------------------------------------------------------
  // Social media icon slugs (Simple Icons CDN)
  // -----------------------------------------------------------------------
  const SOCIAL_SLUGS = {
    linkedin: 'linkedin',
    twitter: 'x',
    github: 'github',
    instagram: 'instagram',
    facebook: 'facebook',
    youtube: 'youtube',
    mastodon: 'mastodon',
    discord: 'discord',
    stackoverflow: 'stackoverflow',
    dribbble: 'dribbble',
    behance: 'behance',
    medium: 'medium',
    twitch: 'twitch',
    tiktok: 'tiktok'
  };

  const SOCIAL_LABELS = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter / X',
    github: 'GitHub',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    mastodon: 'Mastodon',
    discord: 'Discord',
    stackoverflow: 'Stack Overflow',
    dribbble: 'Dribbble',
    behance: 'Behance',
    medium: 'Medium',
    twitch: 'Twitch',
    tiktok: 'TikTok'
  };

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function socialIconImg(slug, color, size) {
    const s = size || 16;
    const c = (color || '#333333').replace('#', '');
    return '<img src="https://cdn.simpleicons.org/' + encodeURIComponent(slug) + '/' + c +
      '" alt="' + escapeHtml(slug) + '" width="' + s + '" height="' + s +
      '" style="display:inline-block;vertical-align:middle;width:' + s + 'px;height:' + s + 'px;">';
  }

  function showTooltip(text, x, y) {
    const el = document.getElementById('copy-tooltip');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = (y - 28) + 'px';
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 1200);
  }

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const inpName = document.getElementById('inp-name');
  const inpTitle = document.getElementById('inp-title');
  const inpCompany = document.getElementById('inp-company');
  const inpDepartment = document.getElementById('inp-department');
  const inpEmail = document.getElementById('inp-email');
  const inpPhone = document.getElementById('inp-phone');
  const inpMobile = document.getElementById('inp-mobile');
  const inpWebsite = document.getElementById('inp-website');
  const inpLinkedIn = document.getElementById('inp-linkedin');
  const inpTwitter = document.getElementById('inp-twitter');
  const inpGitHub = document.getElementById('inp-github');
  const inpInstagram = document.getElementById('inp-instagram');
  const inpFacebook = document.getElementById('inp-facebook');
  const inpYouTube = document.getElementById('inp-youtube');
  const inpMastodon = document.getElementById('inp-mastodon');
  const inpDiscord = document.getElementById('inp-discord');
  const inpStackOverflow = document.getElementById('inp-stackoverflow');
  const inpDribbble = document.getElementById('inp-dribbble');
  const inpBehance = document.getElementById('inp-behance');
  const inpMedium = document.getElementById('inp-medium');
  const inpTwitch = document.getElementById('inp-twitch');
  const inpTikTok = document.getElementById('inp-tiktok');
  const inpAccent = document.getElementById('inp-accent');
  const inpAccentHex = document.getElementById('inp-accent-hex');
  const inpTemplate = document.getElementById('inp-template');
  const photoDrop = document.getElementById('photo-drop');
  const photoPreview = document.getElementById('photo-preview');
  const photoImg = document.getElementById('photo-img');
  const photoInput = document.getElementById('photo-input');
  const btnBrowse = document.getElementById('btn-browse');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  const signatureOutput = document.getElementById('signature-output');
  const mockFrom = document.getElementById('mock-from');
  const splitter = document.getElementById('splitter');
  const formPanel = document.getElementById('form-panel');
  const mainSplit = document.getElementById('main-split');

  // All text inputs for live update
  const textInputs = [
    inpName, inpTitle, inpCompany, inpDepartment,
    inpEmail, inpPhone, inpMobile, inpWebsite,
    inpLinkedIn, inpTwitter, inpGitHub, inpInstagram,
    inpFacebook, inpYouTube, inpMastodon, inpDiscord,
    inpStackOverflow, inpDribbble, inpBehance, inpMedium,
    inpTwitch, inpTikTok
  ];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let photoBase64 = '';
  let currentTemplate = 'classic';
  let accentColor = '#3a6ea5';
  let showSocialIcons = true;
  let showPhoto = true;
  let photoFrame = 'circle';

  // -----------------------------------------------------------------------
  // Gather form data
  // -----------------------------------------------------------------------
  function getData() {
    return {
      name: inpName.value.trim(),
      title: inpTitle.value.trim(),
      company: inpCompany.value.trim(),
      department: inpDepartment.value.trim(),
      email: inpEmail.value.trim(),
      phone: inpPhone.value.trim(),
      mobile: inpMobile.value.trim(),
      website: inpWebsite.value.trim(),
      linkedin: inpLinkedIn.value.trim(),
      twitter: inpTwitter.value.trim(),
      github: inpGitHub.value.trim(),
      instagram: inpInstagram.value.trim(),
      facebook: inpFacebook.value.trim(),
      youtube: inpYouTube.value.trim(),
      mastodon: inpMastodon.value.trim(),
      discord: inpDiscord.value.trim(),
      stackoverflow: inpStackOverflow.value.trim(),
      dribbble: inpDribbble.value.trim(),
      behance: inpBehance.value.trim(),
      medium: inpMedium.value.trim(),
      twitch: inpTwitch.value.trim(),
      tiktok: inpTikTok.value.trim(),
      photo: showPhoto ? photoBase64 : '',
      accent: accentColor,
      template: currentTemplate,
      frame: photoFrame
    };
  }

  // -----------------------------------------------------------------------
  // Signature generators (HTML table-based, inline styles only)
  // -----------------------------------------------------------------------

  function buildSocialLinks(d, iconColor) {
    if (!showSocialIcons) return [];
    const links = [];
    const keys = Object.keys(SOCIAL_SLUGS);
    for (const key of keys) {
      if (d[key])
        links.push({ url: d[key], icon: socialIconImg(SOCIAL_SLUGS[key], iconColor), label: SOCIAL_LABELS[key] || key });
    }
    return links;
  }

  function socialLinksHtml(links, spacing) {
    if (!links.length) return '';
    const gap = spacing || 8;
    return links.map((l, i) =>
      '<a href="' + escapeHtml(l.url) + '" target="_blank" title="' + escapeHtml(l.label) + '" style="display:inline-block;text-decoration:none;' + (i > 0 ? 'margin-left:' + gap + 'px;' : '') + '">' + l.icon + '</a>'
    ).join('');
  }

  function contactLine(icon, value, href) {
    if (!value) return '';
    const link = href
      ? '<a href="' + escapeHtml(href) + '" style="color:#555555;text-decoration:none;">' + escapeHtml(value) + '</a>'
      : '<span style="color:#555555;">' + escapeHtml(value) + '</span>';
    return '<tr><td style="padding:1px 0;font-size:12px;font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#555555;line-height:18px;">' + icon + ' ' + link + '</td></tr>';
  }

  function getPhotoStyle(frame, size) {
    const s = size || 80;
    let style = 'display:block;border:0;width:' + s + 'px;height:' + s + 'px;object-fit:cover;';
    switch (frame) {
      case 'square':
        style += 'border-radius:0;';
        break;
      case 'rounded':
        style += 'border-radius:12%;';
        break;
      case 'hexagon':
        style += 'border-radius:0;clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);';
        break;
      case 'hexagon-flat':
        style += 'border-radius:0;clip-path:polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);';
        break;
      case 'diamond':
        style += 'border-radius:0;clip-path:polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);';
        break;
      case 'octagon':
        style += 'border-radius:0;clip-path:polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%);';
        break;
      default:
        style += 'border-radius:50%;';
        break;
    }
    return style;
  }

  function photoTd(d, size, extraStyle) {
    if (!d.photo) return '';
    const s = size || 80;
    return '<td style="vertical-align:top;padding-right:14px;' + (extraStyle || '') + '">' +
      '<img src="' + d.photo + '" alt="' + escapeHtml(d.name || 'Photo') + '" width="' + s + '" height="' + s + '" style="' + getPhotoStyle(d.frame, s) + '">' +
      '</td>';
  }

  // --- Classic Horizontal ---
  function genClassic(d) {
    const accent = d.accent;
    const links = buildSocialLinks(d, accent);
    let html = '<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#333333;line-height:1.4;">';
    html += '<tr>';

    // Photo
    if (d.photo)
      html += photoTd(d, 80);

    // Divider
    html += '<td style="vertical-align:top;padding-right:14px;">';
    html += '<table cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid ' + escapeHtml(accent) + ';padding-left:12px;">';
    html += '<tr><td style="padding-left:12px;">';

    // Name
    html += '<table cellpadding="0" cellspacing="0" border="0">';
    if (d.name)
      html += '<tr><td style="font-size:16px;font-weight:bold;color:' + escapeHtml(accent) + ';font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;padding-bottom:2px;">' + escapeHtml(d.name) + '</td></tr>';
    if (d.title || d.department) {
      let sub = escapeHtml(d.title);
      if (d.department) sub += (sub ? ' | ' : '') + escapeHtml(d.department);
      html += '<tr><td style="font-size:12px;color:#666666;font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;padding-bottom:1px;">' + sub + '</td></tr>';
    }
    if (d.company)
      html += '<tr><td style="font-size:12px;font-weight:bold;color:#333333;font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;padding-bottom:6px;">' + escapeHtml(d.company) + '</td></tr>';

    // Contact
    if (d.email)
      html += contactLine('\u2709', d.email, 'mailto:' + d.email);
    if (d.phone)
      html += contactLine('\u260E', d.phone, 'tel:' + d.phone.replace(/[\s()-]/g, ''));
    if (d.mobile)
      html += contactLine('\u{1F4F1}', d.mobile, 'tel:' + d.mobile.replace(/[\s()-]/g, ''));
    if (d.website)
      html += contactLine('\u{1F310}', d.website, d.website.startsWith('http') ? d.website : 'https://' + d.website);

    // Social
    if (links.length)
      html += '<tr><td style="padding-top:6px;">' + socialLinksHtml(links, 6) + '</td></tr>';

    html += '</table></td></tr></table></td></tr></table>';
    return html;
  }

  // --- Modern Vertical ---
  function genModern(d) {
    const accent = d.accent;
    const links = buildSocialLinks(d, accent);
    let html = '<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#333333;line-height:1.4;max-width:400px;">';

    // Photo centered
    if (d.photo) {
      html += '<tr><td style="text-align:center;padding-bottom:10px;">';
      html += '<img src="' + d.photo + '" alt="' + escapeHtml(d.name || 'Photo') + '" width="70" height="70" style="' + getPhotoStyle(d.frame, 70) + 'display:inline-block;border:2px solid ' + escapeHtml(accent) + ';">';
      html += '</td></tr>';
    }

    // Name centered
    if (d.name)
      html += '<tr><td style="text-align:center;font-size:18px;font-weight:bold;color:' + escapeHtml(accent) + ';padding-bottom:2px;">' + escapeHtml(d.name) + '</td></tr>';
    if (d.title)
      html += '<tr><td style="text-align:center;font-size:12px;color:#666666;padding-bottom:1px;">' + escapeHtml(d.title) + '</td></tr>';
    if (d.company) {
      let comp = escapeHtml(d.company);
      if (d.department) comp += ' &middot; ' + escapeHtml(d.department);
      html += '<tr><td style="text-align:center;font-size:12px;color:#333333;font-weight:bold;padding-bottom:8px;">' + comp + '</td></tr>';
    }

    // Divider
    html += '<tr><td style="padding:4px 0;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:2px solid ' + escapeHtml(accent) + ';font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>';

    // Contact centered
    const contactParts = [];
    if (d.email) contactParts.push('<a href="mailto:' + escapeHtml(d.email) + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.email) + '</a>');
    if (d.phone) contactParts.push('<a href="tel:' + d.phone.replace(/[\s()-]/g, '') + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.phone) + '</a>');
    if (d.mobile) contactParts.push('<a href="tel:' + d.mobile.replace(/[\s()-]/g, '') + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.mobile) + '</a>');
    if (d.website) {
      const wHref = d.website.startsWith('http') ? d.website : 'https://' + d.website;
      contactParts.push('<a href="' + escapeHtml(wHref) + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.website) + '</a>');
    }
    if (contactParts.length)
      html += '<tr><td style="text-align:center;font-size:12px;color:#555555;padding:6px 0;line-height:20px;">' + contactParts.join(' &nbsp;|&nbsp; ') + '</td></tr>';

    // Social centered
    if (links.length)
      html += '<tr><td style="text-align:center;padding-top:6px;">' + socialLinksHtml(links, 8) + '</td></tr>';

    html += '</table>';
    return html;
  }

  // --- Compact Minimal ---
  function genCompact(d) {
    const accent = d.accent;
    const links = buildSocialLinks(d, '#888888');
    let html = '<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#333333;font-size:12px;line-height:1.4;">';
    html += '<tr>';

    if (d.photo) {
      html += '<td style="vertical-align:middle;padding-right:10px;">';
      html += '<img src="' + d.photo + '" alt="" width="40" height="40" style="' + getPhotoStyle(d.frame, 40) + '">';
      html += '</td>';
    }

    html += '<td style="vertical-align:middle;">';
    const nameParts = [];
    if (d.name) nameParts.push('<strong style="color:' + escapeHtml(accent) + ';">' + escapeHtml(d.name) + '</strong>');
    if (d.title) nameParts.push(escapeHtml(d.title));
    if (d.company) nameParts.push(escapeHtml(d.company));
    html += '<span style="font-size:12px;">' + nameParts.join(' &middot; ') + '</span>';

    const contactBits = [];
    if (d.email) contactBits.push('<a href="mailto:' + escapeHtml(d.email) + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.email) + '</a>');
    if (d.phone) contactBits.push(escapeHtml(d.phone));
    if (d.mobile) contactBits.push(escapeHtml(d.mobile));
    if (d.website) {
      const wHref = d.website.startsWith('http') ? d.website : 'https://' + d.website;
      contactBits.push('<a href="' + escapeHtml(wHref) + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.website) + '</a>');
    }
    if (contactBits.length)
      html += '<br><span style="font-size:11px;color:#888888;">' + contactBits.join(' | ') + '</span>';

    if (links.length)
      html += '<br><span style="display:inline-block;margin-top:3px;">' + socialLinksHtml(links, 5) + '</span>';

    html += '</td></tr></table>';
    return html;
  }

  // --- Bold with Banner ---
  function genBoldFixed(d) {
    const accent = d.accent;
    const bannerLinks = buildSocialLinks(d, '#ffffff');
    const bottomLinks = buildSocialLinks(d, accent);
    const hasBannerSocial = bannerLinks.length > 0;
    let html = '<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#333333;line-height:1.4;max-width:500px;width:100%;">';

    // Banner header
    html += '<tr><td style="background-color:' + escapeHtml(accent) + ';padding:12px 16px;border-radius:4px 4px 0 0;">';
    html += '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>';

    if (d.photo) {
      html += '<td style="vertical-align:middle;width:60px;padding-right:12px;">';
      html += '<img src="' + d.photo + '" alt="" width="50" height="50" style="' + getPhotoStyle(d.frame, 50) + 'border:2px solid rgba(255,255,255,0.5);">';
      html += '</td>';
    }

    html += '<td style="vertical-align:middle;">';
    if (d.name)
      html += '<div style="font-size:18px;font-weight:bold;color:#ffffff;">' + escapeHtml(d.name) + '</div>';
    if (d.title) {
      let sub = escapeHtml(d.title);
      if (d.department) sub += ' | ' + escapeHtml(d.department);
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.85);">' + sub + '</div>';
    }
    if (d.company)
      html += '<div style="font-size:12px;color:rgba(255,255,255,0.9);font-weight:bold;">' + escapeHtml(d.company) + '</div>';
    if (hasBannerSocial)
      html += '<div style="margin-top:4px;">' + socialLinksHtml(bannerLinks, 5) + '</div>';
    html += '</td></tr></table></td></tr>';

    // Contact area below banner
    html += '<tr><td style="background-color:#f8f8f8;padding:10px 16px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 4px 4px;">';
    html += '<table cellpadding="0" cellspacing="0" border="0">';

    if (d.email)
      html += '<tr><td style="font-size:12px;padding:1px 0;color:#555555;">\u2709 <a href="mailto:' + escapeHtml(d.email) + '" style="color:' + escapeHtml(accent) + ';text-decoration:none;">' + escapeHtml(d.email) + '</a></td></tr>';
    if (d.phone)
      html += '<tr><td style="font-size:12px;padding:1px 0;color:#555555;">\u260E <a href="tel:' + d.phone.replace(/[\s()-]/g, '') + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.phone) + '</a></td></tr>';
    if (d.mobile)
      html += '<tr><td style="font-size:12px;padding:1px 0;color:#555555;">\u{1F4F1} <a href="tel:' + d.mobile.replace(/[\s()-]/g, '') + '" style="color:#555555;text-decoration:none;">' + escapeHtml(d.mobile) + '</a></td></tr>';
    if (d.website) {
      const wHref = d.website.startsWith('http') ? d.website : 'https://' + d.website;
      html += '<tr><td style="font-size:12px;padding:1px 0;color:#555555;">\u{1F310} <a href="' + escapeHtml(wHref) + '" style="color:' + escapeHtml(accent) + ';text-decoration:none;">' + escapeHtml(d.website) + '</a></td></tr>';
    }

    if (bottomLinks.length)
      html += '<tr><td style="padding-top:6px;">' + socialLinksHtml(bottomLinks, 6) + '</td></tr>';

    html += '</table></td></tr></table>';
    return html;
  }

  const GENERATORS = {
    classic: genClassic,
    modern: genModern,
    compact: genCompact,
    bold: genBoldFixed
  };

  // -----------------------------------------------------------------------
  // Generate & update preview
  // -----------------------------------------------------------------------
  function generateSignatureHtml() {
    const d = getData();
    const gen = GENERATORS[d.template] || genClassic;
    return gen(d);
  }

  function updatePreview() {
    const html = generateSignatureHtml();
    signatureOutput.innerHTML = html;

    // Update mock "From" field
    const d = getData();
    if (d.email)
      mockFrom.textContent = d.email;
    else if (d.name)
      mockFrom.textContent = d.name;
    else
      mockFrom.textContent = 'you@example.com';

  }

  // -----------------------------------------------------------------------
  // Generate plain text version
  // -----------------------------------------------------------------------
  function generatePlainText() {
    const d = getData();
    const lines = [];
    if (d.name) lines.push(d.name);
    const subParts = [];
    if (d.title) subParts.push(d.title);
    if (d.department) subParts.push(d.department);
    if (subParts.length) lines.push(subParts.join(' | '));
    if (d.company) lines.push(d.company);
    lines.push('');
    if (d.email) lines.push('Email: ' + d.email);
    if (d.phone) lines.push('Phone: ' + d.phone);
    if (d.mobile) lines.push('Mobile: ' + d.mobile);
    if (d.website) lines.push('Web: ' + d.website);
    for (const key of Object.keys(SOCIAL_SLUGS)) {
      if (d[key])
        lines.push((SOCIAL_LABELS[key] || key) + ': ' + d[key]);
    }
    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // DLL shortcuts
  // -----------------------------------------------------------------------
  const User32 = SZ.Dlls && SZ.Dlls.User32;
  const Kernel32 = SZ.Dlls && SZ.Dlls.Kernel32;
  const ComDlg32 = SZ.Dlls && SZ.Dlls.ComDlg32;

  // -----------------------------------------------------------------------
  // Photo handling
  // -----------------------------------------------------------------------
  function setPhoto(dataUrl) {
    photoBase64 = dataUrl;
    photoImg.src = dataUrl;
    photoPreview.classList.add('has-photo');
    updatePreview();
  }

  function loadPhotoFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) { setPhoto(e.target.result); };
    reader.readAsDataURL(file);
  }

  async function browsePhoto() {
    if (ComDlg32 && ComDlg32.GetOpenFileName) {
      try {
        const result = await ComDlg32.GetOpenFileName({
          filters: [
            { name: 'Images', ext: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
            { name: 'All Files', ext: ['*'] }
          ],
          initialDir: '/user/pictures',
          title: 'Select Photo'
        });
        if (result.cancelled || !result.path)
          return;
        if (result.content) {
          setPhoto(result.content);
          return;
        }
        const bytes = await Kernel32.ReadAllBytes(result.path);
        if (!bytes || !bytes.length)
          return;
        const ext = result.path.split('.').pop().toLowerCase();
        const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
        const blob = new Blob([bytes], { type: MIME[ext] || 'image/png' });
        const reader = new FileReader();
        reader.onload = function() { setPhoto(reader.result); };
        reader.readAsDataURL(blob);
      } catch (_) {}
    } else {
      photoInput.click();
    }
  }

  btnBrowse.addEventListener('pointerdown', function() {
    browsePhoto();
  });

  photoInput.addEventListener('change', function() {
    if (this.files && this.files[0])
      loadPhotoFile(this.files[0]);
  });

  btnRemovePhoto.addEventListener('pointerdown', function() {
    photoBase64 = '';
    photoImg.src = '';
    photoPreview.classList.remove('has-photo');
    photoInput.value = '';
    updatePreview();
  });

  // Drag and drop on photo area
  photoPreview.addEventListener('pointerdown', function() {
    browsePhoto();
  });

  photoDrop.addEventListener('dragover', function(e) {
    e.preventDefault();
    photoPreview.classList.add('dragover');
  });

  photoDrop.addEventListener('dragleave', function() {
    photoPreview.classList.remove('dragover');
  });

  photoDrop.addEventListener('drop', function(e) {
    e.preventDefault();
    photoPreview.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0])
      loadPhotoFile(e.dataTransfer.files[0]);
  });

  // -----------------------------------------------------------------------
  // Color picker (SZ desktop integration)
  // -----------------------------------------------------------------------
  let colorPickerRequest = null;

  function openSzColorPicker(currentHex, onResult) {
    const returnKey = 'sz:email-sig:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    colorPickerRequest = { returnKey, onResult };
    try {
      User32.PostMessage('sz:launchApp', {
        appId: 'color-picker',
        urlParams: { returnKey, hex: currentHex }
      });
    } catch (_) {
      colorPickerRequest = null;
    }
  }

  window.addEventListener('storage', function(e) {
    if (!colorPickerRequest || !e || e.key !== colorPickerRequest.returnKey || !e.newValue)
      return;
    let payload = null;
    try { payload = JSON.parse(e.newValue); } catch { return; }
    if (!payload || payload.type !== 'color-picker-result')
      return;
    const r = Math.max(0, Math.min(255, payload.r || 0));
    const g = Math.max(0, Math.min(255, payload.g || 0));
    const b = Math.max(0, Math.min(255, payload.b || 0));
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    if (typeof colorPickerRequest.onResult === 'function')
      colorPickerRequest.onResult(hex);
    try { localStorage.removeItem(colorPickerRequest.returnKey); } catch {}
    colorPickerRequest = null;
  });

  function setAccentColor(hex) {
    accentColor = hex;
    inpAccent.value = hex;
    inpAccentHex.value = hex;
    const rbEl = document.getElementById('rb-accent-color');
    if (rbEl) rbEl.value = hex;
    updatePreview();
  }

  // Open SZ color picker on accent color input click
  inpAccent.addEventListener('click', function(e) {
    e.preventDefault();
    openSzColorPicker(accentColor, setAccentColor);
  });

  inpAccentHex.addEventListener('input', function() {
    const v = this.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v))
      setAccentColor(v);
  });

  inpAccentHex.addEventListener('change', function() {
    let v = this.value.trim();
    if (/^[0-9a-fA-F]{6}$/.test(v)) v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v))
      setAccentColor(v);
    else
      this.value = accentColor;
  });

  // -----------------------------------------------------------------------
  // Photo frame selector sync
  // -----------------------------------------------------------------------
  const inpFrame = document.getElementById('inp-frame');
  const rbFrame = document.getElementById('rb-frame');

  function setPhotoFrame(frame) {
    photoFrame = frame;
    if (inpFrame) inpFrame.value = frame;
    if (rbFrame) rbFrame.value = frame;
    // Update preview shape class
    photoPreview.className = photoPreview.className.replace(/\bframe-\S+/g, '').trim();
    photoPreview.classList.add('frame-' + frame);
    updatePreview();
  }

  if (inpFrame)
    inpFrame.addEventListener('change', function() { setPhotoFrame(this.value); });
  if (rbFrame)
    rbFrame.addEventListener('change', function() { setPhotoFrame(this.value); });

  // -----------------------------------------------------------------------
  // Template selector sync
  // -----------------------------------------------------------------------
  inpTemplate.addEventListener('change', function() {
    setTemplate(this.value);
  });

  function setTemplate(tpl) {
    currentTemplate = tpl;
    inpTemplate.value = tpl;

    // Sync ribbon radio buttons
    const rbRadio = document.querySelector('input[name="rb-tpl"][value="' + tpl + '"]');
    if (rbRadio) rbRadio.checked = true;

    updatePreview();
  }

  // -----------------------------------------------------------------------
  // Live update on all text inputs
  // -----------------------------------------------------------------------
  for (const inp of textInputs)
    inp.addEventListener('input', updatePreview);

  // -----------------------------------------------------------------------
  // Copy & Export
  // -----------------------------------------------------------------------
  function copyHtml(e) {
    const html = generateSignatureHtml();
    if (navigator.clipboard && navigator.clipboard.write) {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([html], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]).then(function() {
        showTooltip('HTML copied!', e ? e.clientX : 100, e ? e.clientY : 50);
      }).catch(function() {
        fallbackCopy(html, e);
      });
    } else {
      fallbackCopy(html, e);
    }
  }

  function fallbackCopy(text, e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showTooltip('Copied!', e ? e.clientX : 100, e ? e.clientY : 50);
  }

  function copyText(e) {
    const text = generatePlainText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        showTooltip('Plain text copied!', e ? e.clientX : 100, e ? e.clientY : 50);
      }).catch(function() {
        fallbackCopy(text, e);
      });
    } else {
      fallbackCopy(text, e);
    }
  }

  function exportHtml() {
    const html = generateSignatureHtml();
    const fullHtml = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>Email Signature</title>\n</head>\n<body>\n' + html + '\n</body>\n</html>';
    if (ComDlg32 && ComDlg32.ExportFile)
      ComDlg32.ExportFile(fullHtml, 'email-signature.html', 'text/html');
    else {
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'email-signature.html';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------
  function resetAll() {
    for (const inp of textInputs)
      inp.value = '';
    photoBase64 = '';
    photoImg.src = '';
    photoPreview.classList.remove('has-photo');
    photoInput.value = '';
    accentColor = '#3a6ea5';
    inpAccent.value = accentColor;
    inpAccentHex.value = accentColor;
    setPhotoFrame('circle');
    setTemplate('classic');
    updatePreview();
  }

  // -----------------------------------------------------------------------
  // Ribbon actions
  // -----------------------------------------------------------------------
  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        resetAll();
        break;
      case 'copy-html':
        copyHtml();
        break;
      case 'copy-text':
        copyText();
        break;
      case 'export-html':
        exportHtml();
        break;
      case 'exit':
        if (User32 && User32.DestroyWindow)
          User32.DestroyWindow();
        else
          window.close();
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'tpl-classic':
        setTemplate('classic');
        break;
      case 'tpl-modern':
        setTemplate('modern');
        break;
      case 'tpl-compact':
        setTemplate('compact');
        break;
      case 'tpl-bold':
        setTemplate('bold');
        break;
    }
  }

  const ribbon = new SZ.Ribbon({ onAction: handleMenuAction });
  SZ.Dialog.wireAll();

  // -----------------------------------------------------------------------
  // Ribbon: template radio buttons
  // -----------------------------------------------------------------------
  document.querySelectorAll('input[name="rb-tpl"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      if (this.checked)
        setTemplate(this.value);
    });
  });

  // -----------------------------------------------------------------------
  // Ribbon: accent color picker sync
  // -----------------------------------------------------------------------
  const rbAccentColor = document.getElementById('rb-accent-color');
  if (rbAccentColor) {
    rbAccentColor.addEventListener('click', function(e) {
      e.preventDefault();
      openSzColorPicker(accentColor, setAccentColor);
    });
  }

  // -----------------------------------------------------------------------
  // Ribbon: View tab checkboxes
  // -----------------------------------------------------------------------
  const rbShowSocial = document.getElementById('rb-show-social');
  if (rbShowSocial)
    rbShowSocial.addEventListener('change', function() {
      showSocialIcons = this.checked;
      updatePreview();
    });

  const rbShowPhoto = document.getElementById('rb-show-photo');
  if (rbShowPhoto)
    rbShowPhoto.addEventListener('change', function() {
      showPhoto = this.checked;
      updatePreview();
    });

  // -----------------------------------------------------------------------
  // Splitter drag
  // -----------------------------------------------------------------------
  ;(function() {
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    splitter.addEventListener('pointerdown', function(e) {
      dragging = true;
      startX = e.clientX;
      startWidth = formPanel.offsetWidth;
      splitter.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    splitter.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(260, Math.min(startWidth + dx, mainSplit.offsetWidth - 300));
      formPanel.style.flex = '0 0 ' + newWidth + 'px';
    });

    splitter.addEventListener('pointerup', function(e) {
      if (!dragging) return;
      dragging = false;
      splitter.releasePointerCapture(e.pointerId);
    });

    splitter.addEventListener('lostpointercapture', function() {
      dragging = false;
    });
  })();

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    if (User32) User32.EnableVisualStyles();
    photoPreview.classList.add('frame-' + photoFrame);
    updatePreview();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

})();
