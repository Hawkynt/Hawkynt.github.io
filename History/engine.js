(() => {
  const NAMESPACE = 'Applications';
  const MODULE = 'HistoryEngine';
  
  window.SYS_REG = window.SYS_REG || {};
  window.SYS_REG[NAMESPACE] = window.SYS_REG[NAMESPACE] || {};
  window.SYS_REG[NAMESPACE][MODULE] = window.SYS_REG[NAMESPACE][MODULE] || {
    public: { variables: {}, functions: {}, classes: {} },
    private: { variables: {}, functions: {}, classes: {} }
  };
  
  const module = window.SYS_REG[NAMESPACE][MODULE];
  
  Object.assign(module, {
    InternalName: `SynthelicZ::${NAMESPACE}::${MODULE}`,
    CurrentVersion: '3.0',
    Author: 'Hawkynt',
    AuthorEMAIL: 'Hawkynt@gmx.de',
    LastModified: new Date().toISOString(),
    Dependencies: ''
  });
  
  module.GetIDString = `${module.InternalName} > v${module.CurrentVersion}(${module.LastModified}) coded by ${module.Author}`;
  
  let arrItems = [];
  let arrImages = [];
  
  const init = () => {
    removeScripts();
    removeElements_ByNodeName(document.getElementById('MainContent'),'script');
    arrItems = [...document.getElementById('MainContent').querySelectorAll('.History_Item')];
    
    const selectElement = document.forms['frmListBox'].elements['selectItemList'];
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    arrItems.forEach((item, index) => {
      item.style.display = 'none';
      const year = item.querySelector('.Year')?.textContent || 'Unknown';
      const title = item.querySelector('.Title')?.textContent || 'Untitled';
      selectElement.options[index] = new Option(`[${year}] ${title}`, index);
      
      arrImages = [...item.querySelectorAll('.Img')];
      arrImages.forEach(img => {
        const src = img.src || img.href;
        const anchor = document.createElement('a');
        anchor.href = src;
        anchor.className = 'Img';
        item.appendChild(anchor);
      });
      
      arrImages.forEach(img => item.removeChild(img));
    });
    
    // Show the most recent item
    showItem(arrItems.length - 1);
    
    // Animate app appearance
    const appContainer = document.getElementById('ItemWindow');
    const loadWindow = document.getElementById('LoadWindow');
    
    appContainer.style.display = 'flex';
    
    setTimeout(() => {
      loadWindow.style.opacity = '0';
      loadWindow.style.visibility = 'hidden';
      appContainer.classList.add('loaded');
    }, 100);
    
    // Setup navigation button click handlers
    setupNavigationHandlers();
  };
  
  module.private.functions.init = init;
  
  const showItem = (itemIndex) => {
    if (arrItems.length === 0) {
      document.getElementById('lnkItemCnt').textContent = '[0]';
      return;
    }
    
    // Wrap around boundaries
    while (itemIndex < 0) itemIndex += arrItems.length;
    while (itemIndex >= arrItems.length) itemIndex -= arrItems.length;
    
    const currentItem = arrItems[itemIndex];
    const title = currentItem.querySelector('.Title')?.textContent || '';
    const year = currentItem.querySelector('.Year')?.textContent || '';
    const language = currentItem.querySelector('.Language')?.textContent || '';
    const skills = currentItem.querySelector('.Skills')?.textContent || '';
    const text = currentItem.querySelector('.Text')?.innerHTML || '';
    
    const infoHTML = `
      <b>${title} [${year}]</b><br><br>
      Programmiersprache:<br>${language}<br><br>
      Schwierigkeiten:<br>${skills}<br>
    `;
    
    document.getElementById('lblItem').innerHTML = infoHTML;
    document.getElementById('txtItem').innerHTML = text;
    document.getElementById('lnkItemCnt').textContent = `[${itemIndex + 1}/${arrItems.length}]`;
    
    arrImages = [...currentItem.querySelectorAll('.Img')];
    
    // Update navigation (handled by event listeners now)
    document.forms['frmListBox'].elements['selectItemList'].selectedIndex = itemIndex;
    document.getElementById('lnkImgFull').href = 'nopic.gif';
    document.getElementById('imgItem').src = 'nopic.gif';
    
    showPicture(0);
  };
  
  module.private.functions.showItem = showItem;
  
  const showPicture = (imageIndex) => {
    if (arrImages.length === 0) {
      document.getElementById('lnkImgFull').href = 'nopic.gif';
      document.getElementById('imgItem').src = 'nopic.gif';
      document.getElementById('lnkImgCnt').textContent = '[0]';
      return;
    }
    
    // Wrap around boundaries
    while (imageIndex < 0) imageIndex += arrImages.length;
    while (imageIndex >= arrImages.length) imageIndex -= arrImages.length;
    
    // Update image display (navigation handled by event listeners)
    document.getElementById('lnkImgFull').href = arrImages[imageIndex].href;
    
    const imgElement = document.getElementById('imgItem');
    imgElement.style.opacity = '0.5';
    
    setTimeout(() => {
      imgElement.src = arrImages[imageIndex].href;
      imgElement.style.opacity = '1';
    }, 150);
    
    document.getElementById('lnkImgCnt').textContent = `[${imageIndex + 1}/${arrImages.length}]`;
  };
  
  module.private.functions.showPicture = showPicture;
  
  // Modern navigation handlers
  const setupNavigationHandlers = () => {
    // Item navigation
    const itemPrevBtns = document.querySelectorAll('#lnkItemREW');
    const itemNextBtns = document.querySelectorAll('#lnkItemFFD');
    
    itemPrevBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentIndex = document.forms['frmListBox'].elements['selectItemList'].selectedIndex;
        showItem(currentIndex - 1);
      });
    });
    
    itemNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentIndex = document.forms['frmListBox'].elements['selectItemList'].selectedIndex;
        showItem(currentIndex + 1);
      });
    });
    
    // Image navigation
    const imgPrevBtns = document.querySelectorAll('#lnkImgREW');
    const imgNextBtns = document.querySelectorAll('#lnkImgFFD');
    let currentImageIndex = 0;
    
    imgPrevBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        currentImageIndex = Math.max(0, currentImageIndex - 1);
        if (arrImages.length > 0) {
          currentImageIndex = (currentImageIndex - 1 + arrImages.length) % arrImages.length;
          showPicture(currentImageIndex);
        }
      });
    });
    
    imgNextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (arrImages.length > 0) {
          currentImageIndex = (currentImageIndex + 1) % arrImages.length;
          showPicture(currentImageIndex);
        }
      });
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      const currentItemIndex = document.forms['frmListBox'].elements['selectItemList'].selectedIndex;
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + Left = Previous image
            if (arrImages.length > 0) {
              currentImageIndex = (currentImageIndex - 1 + arrImages.length) % arrImages.length;
              showPicture(currentImageIndex);
            }
          } else {
            // Left = Previous item
            showItem(currentItemIndex - 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + Right = Next image
            if (arrImages.length > 0) {
              currentImageIndex = (currentImageIndex + 1) % arrImages.length;
              showPicture(currentImageIndex);
            }
          } else {
            // Right = Next item
            showItem(currentItemIndex + 1);
          }
          break;
      }
    });
  };
  
  // Export functions to global scope
  window.showItem = showItem;
  window.showPicture = showPicture;
  window.init = init;
  window.setupNavigationHandlers = setupNavigationHandlers;
})();
