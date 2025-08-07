/*
 *  Extended DOM and global Functions
 *  Modernized 2025 - using native browser APIs where possible
 *
 */

/* POLYFILLS - Only add if not natively supported */
if (!String.prototype.trim) {
  String.prototype.trim = function() {
    return this.replace(/(^\s+|\s+$)/g, '');
  };
}

/* Modern DOM EXTENSIONS */
const getMetaContent = (nameOrElement, optionalName) => {
  let name, element;
  
  if (optionalName) {
    element = nameOrElement;
    name = optionalName;
  } else {
    element = document;
    name = nameOrElement;
  }
  
  const meta = element.querySelector(`meta[name="${name}" i]`);
  return meta ? meta.content : '';
};

// Keep legacy function name for compatibility
window.getMetaContent = getMetaContent;

const removeScripts = () => {
  document.querySelectorAll('script').forEach(script => script.remove());
};

window.removeScripts = removeScripts;

const removeCSS = () => {
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(element => element.remove());
};

window.removeCSS = removeCSS;

const removeElements_ByClassName = (parentNodeOrClassName, optionalClassName) => {
  let parentNode, className;
  
  if (optionalClassName) {
    parentNode = parentNodeOrClassName;
    className = optionalClassName;
  } else {
    parentNode = document.body;
    className = parentNodeOrClassName;
  }
  
  parentNode.querySelectorAll(`.${className}`).forEach(element => element.remove());
};

window.removeElements_ByClassName = removeElements_ByClassName;

const removeElements_ByNodeName = (parentNodeOrTagName, optionalTagName) => {
  let parentNode, tagName;
  
  if (optionalTagName) {
    parentNode = parentNodeOrTagName;
    tagName = optionalTagName;
  } else {
    parentNode = document.body;
    tagName = parentNodeOrTagName;
  }
  
  parentNode.querySelectorAll(tagName).forEach(element => element.remove());
};

window.removeElements_ByNodeName = removeElements_ByNodeName;

const getElements_ByClassName = (parentNodeOrClassName, optionalClassName) => {
  let parentNode, className;
  
  if (optionalClassName) {
    parentNode = parentNodeOrClassName;
    className = optionalClassName;
  } else {
    parentNode = document.body;
    className = parentNodeOrClassName;
  }
  
  return [...parentNode.querySelectorAll(`.${className}`)];
};

window.getElements_ByClassName = getElements_ByClassName;

const getElements_ByNodeName = (parentNodeOrTagName, optionalTagName) => {
  let parentNode, tagName;
  
  if (optionalTagName) {
    parentNode = parentNodeOrTagName;
    tagName = optionalTagName;
  } else {
    parentNode = document.body;
    tagName = parentNodeOrTagName;
  }
  
  return [...parentNode.querySelectorAll(tagName)];
};

window.getElements_ByNodeName = getElements_ByNodeName;

const getElement_ByClassName = (parentNodeOrClassName, optionalClassName) => {
  let parentNode, className;
  
  if (optionalClassName) {
    parentNode = parentNodeOrClassName;
    className = optionalClassName;
  } else {
    parentNode = document.body;
    className = parentNodeOrClassName;
  }
  
  return parentNode.querySelector(`.${className}`) || null;
};

window.getElement_ByClassName = getElement_ByClassName;

const getElement_ByNodeName = (parentNodeOrTagName, optionalTagName) => {
  let parentNode, tagName;
  
  if (optionalTagName) {
    parentNode = parentNodeOrTagName;
    tagName = optionalTagName;
  } else {
    parentNode = document.body;
    tagName = parentNodeOrTagName;
  }
  
  return parentNode.querySelector(tagName) || null;
};

const getElement_ById = (parentNode, id) => {
  return parentNode.querySelector(`#${id}`) || null;
};

const removeElement_ById = (parentNode, id) => {
  const element = parentNode.querySelector(`#${id}`);
  if (element) element.remove();
};

window.getElement_ByNodeName = getElement_ByNodeName;
window.getElement_ById = getElement_ById;
window.removeElement_ById = removeElement_ById;

const intGetScrollX = () => window.scrollX || window.pageXOffset || document.documentElement.scrollLeft || 0;

const intGetScrollY = () => window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

window.intGetScrollX = intGetScrollX;
window.intGetScrollY = intGetScrollY;

const intScreenWidth = () => window.innerWidth || document.documentElement.clientWidth || 800;

const intScreenHeight = () => window.innerHeight || document.documentElement.clientHeight || 600;

window.intScreenWidth = intScreenWidth;
window.intScreenHeight = intScreenHeight;

/* Modern Utility Functions */
const szGenerateUniqueID = (length = 16) => {
  return crypto.randomUUID?.() || 
    Array.from({ length }, () => 
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
};

const intIsInArray = (array, obj) => array.indexOf(obj);

const throwException = (exception, parameters, module, func) => {
  console.error(`${parameters}\n${exception}\nFAILED in ${module}::${func}!`);
  throw new Error(`${exception} in ${module}::${func}`);
};

window.szGenerateUniqueID = szGenerateUniqueID;
window.intIsInArray = intIsInArray;
window.throwException = throwException;

