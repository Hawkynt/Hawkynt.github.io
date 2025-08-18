/*
 *  Extended DOM and global Functions
 *  (c)2006 Hawkynt
 *
 *
 */

/* NATIVE CLASS EXTENSIONS */
String.prototype.trim = function() {
 return (this.replace(/(^\s+|\s+$)/g, ''));
}

/* DOM EXTENSIONS */
getMetaContent=function (varParam1,optional_varParam2) {
  var name;
  var objObject;
  if (optional_varParam2) {
    name =optional_varParam2;
    objObject=varParam1;
  } else {
    name =varParam1;
    objObject=window.document;
  };
  var arrMetas=getElements_ByNodeName(objObject.getElementsByTagName('head')[0],'meta');
  for (var intI=0;intI<arrMetas.length;intI++) {
    if (arrMetas[intI].name.toLowerCase()==szName.toLowerCase()) {
      return arrMetas[intI].content;
    };
  };
  return ('');
}

removeScripts=function () {
  removeElements_ByNodeName(document.getElementsByTagName('head')[0],'script');
  removeElements_ByNodeName(document.getElementsByTagName('body')[0],'script');
  if (document.scripts) {
    for (var intI=document.scripts.length-1;intI>=0;intI--) {
      document.scripts[intI].parentNode.removeChild(document.scripts[intI]);
    };
  };
}

removeCSS=function () {
  var objParent=document.getElementsByTagName('head')[0];
  removeElements_ByNodeName(objParent,'style');
  var arrTags=getElements_ByNodeName(objParent,'link');
  for (var intI=0;intI<arrTags.length;intI++) {
    if (arrTags[intI].rel=='stylesheet') {
      objParent.removeChild(arrTags[intI]);
    };
  };
}

removeElements_ByClassName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szClassName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szClassName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szClassName=varParam1;
  };
  var objDOM=getElement_ByClassName(objParentNode,szClassName);
  while (objDOM) {
    objParentNode.removeChild(objDOM);
    objDOM=getElement_ByClassName(objParentNode,szClassName);
  };
}

removeElements_ByNodeName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szNodeName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szNodeName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szNodeName=varParam1;
  };
  var objDOM=getElement_ByNodeName(objParentNode,szNodeName);
  while (objDOM) {
    objParentNode.removeChild(objDOM);
    objDOM=getElement_ByNodeName(objParentNode,szNodeName);
  };
}

getElements_ByClassName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szClassName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szClassName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szClassName=varParam1;
  };
  var arrItems=[];
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].className==szClassName) {
      arrItems[arrItems.length]=objParentNode.childNodes[intI];
    };
  };
  return (arrItems);
}

getElements_ByNodeName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szNodeName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szNodeName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szNodeName=varParam1;
  };
  var arrItems=[];
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].nodeName.toLowerCase()==szNodeName.toLowerCase()) {
      arrItems[arrItems.length]=objParentNode.childNodes[intI];
    };
  };
  return (arrItems);
}

getElement_ByClassName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szClassName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szClassName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szClassName=varParam1;
  };
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].className==szClassName) {
      return(objParentNode.childNodes[intI]);
    };
  };
  return (false);
}

getElement_ByNodeName=function (varParam1,optional_varParam2) {
  var objParentNode;
  var szNodeName;
  if (optional_varParam2) {
    objParentNode=varParam1;
    szNodeName=optional_varParam2;
  } else {
    objParentNode=document.getElementsByTagName('BODY')[0];
    szNodeName=varParam1;
  };
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].nodeName.toLowerCase()==szNodeName.toLowerCase()) {
      return (objParentNode.childNodes[intI]);
    };
  };
  return (false);
}

getElement_ById=function (objParentNode,szId) {
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].id==szId) {
      return (objParentNode.childNodes[intI]);
    };
  };
  return (false);
}

removeElement_ById=function (objParentNode,szId) {
  for (var intI=0;intI<objParentNode.childNodes.length;intI++) {
    if (objParentNode.childNodes[intI].id==szId) {
      objParenNode.removeChild(objParentNode.childNodes[intI]);
    };
  };
}

intGetScrollX=function () {
  var intScrollX;
  if (document.documentElement.scrollLeft!=undefined) {
    intScrollX=document.documentElement.scrollLeft;
  } else if (window.pageXOffset!=undefined) {
    intScrollX=window.pageXOffset;
  } else if (document.body.scrollLeft!=undefined) {
    intScrollX=document.body.scrollLeft;
  } else {
    intScrollX=0;
  };
  return (intScrollX);
}

intGetScrollY=function () {
  var intScrollY;
  if (document.documentElement.scrollTop!=undefined) {
    intScrollY=document.documentElement.scrollTop;
  } else if (window.pageYOffset!=undefined) {
    intScrollY=window.pageYOffset;
  } else if (document.body.scrollTop!=undefined) {
    intScrollY=document.body.scrollTop;
  } else {
    intScrollY=0;
  };
  return (intScrollY);
}

intScreenWidth=function () {
  var intWindowWidth;
  if (document.documentElement.offsetWidth!=undefined) {
    intWindowWidth=document.documentElement.offsetWidth;
    if (document.body.style.overflowX!='hidden') {
      intWindowWidth-=20;
    };
  } else if (window.innerWidth!=undefined) {
    intWindowWidth=window.innerWidth-20;
  } else if (document.body.offsetWidth!=undefined) {
    intWindowWidth=document.body.offsetWidth;
    if (document.body.style.overflowX!='hidden') {
      intWindowWidth-=20;
    };
  } else {
    intWindowWidth=800-20;
  };
  return (intWindowWidth);
}

intScreenHeight=function () {
  var intWindowHeight;
  if (document.documentElement.offsetHeight!=undefined) {
    intWindowHeight=document.documentElement.offsetHeight;
    if (document.body.style.overflowY!='hidden') {
      intWindowHeight-=20;
    };
  } else if (window.innerHeight!=undefined) {
    intWindowHeight=window.innerHeight-20;
  } else if (document.body.offsetHeight!=undefined) {
    intWindowHeight=document.body.offsetHeight;
    if (document.body.style.overflowY!='hidden') {
      intWindowHeight-=20;
    };
  } else {
    intWindowHeight=600-20;
  };
  return (intWindowHeight);
}

/* EXTENSIONS */
/* global Functions */
generateUniqueID =function (intLen) {
  var szRet='';
  if (!intLen) intLen=16;
  var szChars='abcdefghijklmnopqrstuvwxz0123456789';
  for (intI=0;intI<intLen;intI++) {
    var intPosition=Math.floor(Math.random()*szChars.length);
    var chChar=szChars.substr(intPosition,1);
    szRet+=chChar;
  };
  return (szRet);
}

intIsInArray=function (arrArray,varObj) {
  for (var intI=0;intI<arrArray.length;intI++) {
    if (arrArray[intI]==varObj) return (intI);
  };
  return (-1);
}

throwException =function (szException,szParameters,szModule,szFunction) {
  alert(szParameters+"\r\n"+szException+"\r\nFAILED in "+szModule+'::'+szFunction+' !');
}

