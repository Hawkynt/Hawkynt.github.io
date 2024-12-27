{
  i='Applications';j='HistoryEngine';k='GetIDString';P='public';p='private';
  if (!SYS_REG)                       var SYS_REG                   =new Array();
  if (!SYS_REG[i])                    SYS_REG[i]                    =new Array();
  if (!SYS_REG[i][j])                 SYS_REG[i][j]                 =new Array();
  if (!SYS_REG[i][j][P])              SYS_REG[i][j][P]              =new Array();
  if (!SYS_REG[i][j][p])              SYS_REG[i][j][p]              =new Array();
  if (!SYS_REG[i][j][P]['variables']) SYS_REG[i][j][P]['variables'] =new Array();
  if (!SYS_REG[i][j][P]['functions']) SYS_REG[i][j][P]['functions'] =new Array();
  if (!SYS_REG[i][j][P]['classes'])   SYS_REG[i][j][P]['classes']   =new Array();
  if (!SYS_REG[i][j][p]['variables']) SYS_REG[i][j][p]['variables'] =new Array();
  if (!SYS_REG[i][j][p]['functions']) SYS_REG[i][j][p]['functions'] =new Array();
  if (!SYS_REG[i][j][p]['classes'])   SYS_REG[i][j][p]['classes']   =new Array();
  
  SYS_REG[i][j]['InternalName']   = 'SynthelicZ::'+i+'::'+j;
  SYS_REG[i][j]['CurrentVersion'] = '2.1a';
  SYS_REG[i][j]['Author']         = 'Hawkynt';
  SYS_REG[i][j]['AuthorEMAIL']    = 'Hawkynt'+''+'@'+''+'gmx'+''+'.'+''+'de';
  SYS_REG[i][j]['LastModified']   = '29.09.2006-09:39';
  SYS_REG[i][j]['Dependancies']   = '';
  
  SYS_REG[i][j][k]=SYS_REG[i][j]['InternalName']+' &gt; v'+SYS_REG[i][j]['CurrentVersion']+'(';
  SYS_REG[i][j][k]+=SYS_REG[i][j]['LastModified']+') coded by '+SYS_REG[i][j]['Author'];
  // SYS_REG[i][j][k]+=' for Questions mailto:'+SYS_REG[i][j]['AuthorEMAIL'];
  // BEGIN JAVASCRIPT LIBRARY
  var arrItems;
  var arrImages;
  
  SYS_REG[i][j][p]['functions']['init']=function () {
    removeScripts();
    removeElements_ByNodeName(document.getElementById('MainContent'),'script');
    arrItems=getElements_ByClassName(document.getElementById('MainContent'),'History_Item');
    for (var intI=0;intI<arrItems.length;intI++) {
      arrItems[intI].style.display='none';
      document.forms['frmListBox'].elements['selectItemList'].options[intI]=new Option('['+getElement_ByClassName(arrItems[intI],'Year').innerHTML+'] '+getElement_ByClassName(arrItems[intI],'Title').innerHTML,intI);
      arrImages=getElements_ByClassName(arrItems[intI],'Img');
      for (var intJ=0;intJ<arrImages.length;intJ++) {
        var szSRC=arrImages[intJ].src;
        if (!szSRC) szSRC=arrImages[intJ].href;
        var objA=document                                     .createElement('A');
        objA                                                  .href=szSRC;
        objA                                                  .className='Img';
        arrItems[intI]                                        .appendChild(objA);
      };
      for (var intJ=arrImages.length-1;intJ>=0;intJ--) {
        arrItems[intI]                                        .removeChild(arrImages[intJ]);
      };
    };
    showItem(arrItems.length-1);
    //showItem(0);
    document.getElementById('ItemWindow').style.display='';
    document.getElementById('LoadWindow').style.display='none';
  };
  
  SYS_REG[i][j][p]['functions']['showItem']=function (intI) {
    if (arrItems.length>0) {
      while (intI<0) intI+=arrItems.length;
      // if (intI<0) intI=0;
      while (intI>=arrItems.length) intI-=arrItems.length;
      // if (intI>=arrItems.length) intI=arrItems.length-1;
      
      var szTitle=getElement_ByClassName(arrItems[intI],'Title')      .innerHTML;
      var szYear=getElement_ByClassName(arrItems[intI],'Year')        .innerHTML;
      var szLanguage=getElement_ByClassName(arrItems[intI],'Language').innerHTML;
      var szSkills=getElement_ByClassName(arrItems[intI],'Skills')    .innerHTML;
      var szText=getElement_ByClassName(arrItems[intI],'Text')        .innerHTML;
      var szHTML='';
      szHTML+='<b>'+szTitle+' ['+szYear+']</b><br /><br />';
      szHTML+='Programmiersprache:<br />'+szLanguage+'<br /><br />';
      szHTML+='Schwierigkeiten:<br />'+szSkills+'<br />';
      document.getElementById('lblItem')                      .innerHTML=szHTML;
      document.getElementById('txtItem')                      .innerHTML=szText;
      document.getElementById('lnkItemCnt')                   .innerHTML='['+(intI+1)+'/'+arrItems.length+']';
      arrImages=getElements_ByClassName(arrItems[intI],'Img');
      document.getElementById('lnkItemFFD')                   .href='javascript:showItem('+(intI+1)+');';
      document.getElementById('lnkItemREW')                   .href='javascript:showItem('+(intI-1)+');';
      document.forms['frmListBox'].elements['selectItemList'].options.selectedIndex=intI;
      document.getElementById('lnkImgFull')                   .href='nopic.gif';
      document.getElementById('imgItem')                      .src='nopic.gif';
      SYS_REG['Applications']['HistoryEngine']['private']['functions']['showPicture'](0);
    } else {
      document.getElementById('lnkItemCnt').innerHTML='[0]';
    };
  };
  
  SYS_REG[i][j][p]['functions']['showPicture']=function (intI) {
    if (arrImages.length>0) {
      while (intI<0) intI+=arrImages.length;
      while (intI>=arrImages.length) intI-=arrImages.length;
      document.getElementById('lnkImgFFD')                    .href='javascript:showPicture('+(intI+1)+');';
      document.getElementById('lnkImgREW')                    .href='javascript:showPicture('+(intI-1)+');';
      document.getElementById('lnkImgFull')                   .href=arrImages[intI].href;
      document.getElementById('imgItem')                      .src=arrImages[intI].href;
      document.getElementById('lnkImgCnt')                    .innerHTML='['+(intI+1)+'/'+arrImages.length+']';
    } else {
      document.getElementById('lnkImgFull')                   .href='nopic.gif';
      document.getElementById('imgItem')                      .src='nopic.gif';
      document.getElementById('lnkImgCnt')                    .innerHTML='[0]';
    };
  };
  
  showItem=SYS_REG[i][j][p]['functions']['showItem'];
  showPicture=SYS_REG[i][j][p]['functions']['showPicture'];
  init=SYS_REG[i][j][p]['functions']['init'];
  // END JAVASCRIPT LIBRARY
}
