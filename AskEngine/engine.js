var boolEditable=false;
if (location.search.indexOf('editOverride=true')>=0) boolEditable=true;
var SYS_TOOLTIP_TIMER;
var SYS_TOOLTIP_TIMEOUT=500;
var SYS_TOOLTIP_EXTENSION=new Array();
SYS_TOOLTIP_EXTENSION['Question']=-1;
SYS_TOOLTIP_EXTENSION['Answer']=-1;
var hashQuestions=new Array();
var hashModifiers;
var hashIdentifiers=new Array();
var hashEngineData=new Array();
var boolEdit=true;
hashEngineData['LastQuestionIndex']=-1;
hashEngineData['LastAnswerIndex']=-1;
var boolLocal=false;

function Engine_getVersion()
{
  return ('v2.2d');
}

function Engine_WriteLOG(szText)
{
  if (boolEditable) document.getElementById('EngineOutput').innerHTML='Engine &gt; '+szText+document.getElementById('EngineOutput').innerHTML;
}

function Engine_Write(szText)
{
  if (boolEditable)
  {
    document.getElementById('EngineOutput').innerHTML=szText+document.getElementById('EngineOutput').innerHTML;
  }
  else
  {
    document.getElementById('EngineOutput').innerHTML=szText;
  };
}

function Engine_clearQuestions()
{
  hashQuestions=new Array();
  hashEngineData['LastQuestionIndex']=-1;
  hashEngineData['LastAnswerIndex']=-1;
}

function Engine_addQuestion(szQuestion)
{
  hashEngineData['LastQuestionIndex']++;
  hashEngineData['LastAnswerIndex']=-1;
  hashQuestions[hashEngineData['LastQuestionIndex']]=new Array();
  hashQuestions[hashEngineData['LastQuestionIndex']]['Question']=szQuestion;
  hashQuestions[hashEngineData['LastQuestionIndex']]['Answers']=new Array();
}

function Engine_addAnswer(szAnswer)
{
  hashEngineData['LastAnswerIndex']++;
  hashQuestions[hashEngineData['LastQuestionIndex']]['Answers'][hashEngineData['LastAnswerIndex']]=new Array();
  hashQuestions[hashEngineData['LastQuestionIndex']]['Answers'][hashEngineData['LastAnswerIndex']]['Text']=szAnswer;
  hashQuestions[hashEngineData['LastQuestionIndex']]['Answers'][hashEngineData['LastAnswerIndex']]['Modifiers']='';
}

function Engine_setModifiers(szModifiers)
{
  hashQuestions[hashEngineData['LastQuestionIndex']]['Answers'][hashEngineData['LastAnswerIndex']]['Modifiers']=szModifiers;
}

function Engine_SwitchMode()
{
  if (boolEdit)
  {
    clearTooltip();
    Engine_FirstRun();
  }
  else
  {
    Engine_EditRun();
  };
}

function Engine_FirstRun()
{
  boolEdit=false;
  Engine_HelperInit();
  Engine_Init();
}

function Engine_EditRun()
{
  try
  {
    new ActiveXObject("Scripting.FileSystemObject");
    boolEdit=true;
    Engine_HelperInit();
    Engine_Init();
  }
  catch (ActiveXException)
  {
    Engine_FirstRun();
  };
}

function Engine_Init()
{
  document.getElementById('ScoreboardSwitch').style.display='none';
  if (boolEditable)
  {
    document.getElementById('SwitchButton').style.display='';
  }
  else
  {
    document.getElementById('SwitchButton').style.display='none';
  };
  var objHTMLOutput=document.getElementById('UserInput');
  hashModifiers=new Array();
  var szHTML='';
  if (boolLocal)
  {
    Engine_WriteLOG('<span style="font-weight:bold;color:#00C;">ACHTUNG Lokale Datendatei geladen !</span><br />');
  }
  else
  {
    Engine_WriteLOG('<span style="font-weight:bold;color:#0C0;">Daten vom Server geladen !</span><br />');
  };
  if (boolEdit)
  {
    szHTML+='<center><table class="Default TableFix" border="0" cellspacing="0" cellpadding="0" style="color:WindowText;" width="97%">';
    for (var intI=0;intI<hashQuestions.length;intI++)
    {
      szHTML+='<tr valign="middle"><td colspan="2">';
      szHTML+='<hr />';
      szHTML+='</td></tr><tr><td colspan="2" align="left">';
      szHTML+=(intI+1)+' ) '+hashQuestions[intI]['Question']+'<br />';
      szHTML+='</td></tr>';
      for (var intJ=0;intJ<hashQuestions[intI]['Answers'].length;intJ++)
      {
        szHTML+='<tr valign="top">';
        szHTML+='<td align="left" onclick="initTooltip('+intI+','+intJ+');" onmouseover="this.style.background=\'#CCF\';" onmouseout="this.style.background=\'\';">'+hashQuestions[intI]['Answers'][intJ]['Text']+'</td>';
        szHTML+='<td align="left" onclick="clearTooltip();"><div id="Modifiers_'+intI+'_'+intJ+'" style="width:128px;white-space:nowrap;overflow:hidden;">'+hashQuestions[intI]['Answers'][intJ]['Modifiers']+'</div></td>';
        szHTML+='</tr>';
      };
    };
    szHTML+='</table></center>';
    Engine_WriteLOG('switched to Edit-Mode !<br />');
    document.getElementById('SolveButton').innerHTML='Speichern';
    document.getElementById('SwitchButton').innerHTML='Testen';
    document.getElementById('ScoreboardSwitch').style.display='none';
  }
  else
  {
    szHTML+='<center><table class="Default TableFix" border="0" cellspacing="0" cellpadding="0" style="color:WindowText;" width="97%">';
    for (var intI=0;intI<hashQuestions.length;intI++)
    {
      szHTML+='<tr valign="middle"><td colspan="2">';
      szHTML+='<hr />';
      szHTML+='</td></tr><tr><td colspan="2" align="left">';
      szHTML+=(intI+1)+' ) '+hashQuestions[intI]['Question']+'<br />';
      szHTML+='</td></tr>';
      for (var intJ=0;intJ<hashQuestions[intI]['Answers'].length;intJ++)
      {
        szHTML+='<tr valign="top">';
        szHTML+='<td align="left" width="16px"><input type="radio" name="Question_'+intI+'" value="'+intJ+'" /></td>';
        szHTML+='<td align="left">'+hashQuestions[intI]['Answers'][intJ]['Text']+'</td>';
        szHTML+='</tr>';
      };
    };
    szHTML+='</table></center>';
    Engine_WriteLOG('switched to Question-Mode!<br />');
    document.getElementById('SwitchButton').innerHTML='Bearbeiten';
    document.getElementById('SolveButton').innerHTML='Ergebnis';
    if (boolEditable) document.getElementById('ScoreboardSwitch').style.display='';
  };
  objHTMLOutput.innerHTML=szHTML;
};

function Engine_Finish()
{
  hashModifiers=new Array();
  var szHTML='';
  if (boolEdit)
  {
    var szConfiguration='';
    var szCrLf="\r\n";
    
    szConfiguration+='{'+szCrLf;
    szConfiguration+='  var thisFileIsPublic=false;'+szCrLf;
    szConfiguration+='  if ((thisFileIsPublic) || (Engine_getVersion()<="'+Engine_getVersion()+'"))'+szCrLf;
    szConfiguration+='  {'+szCrLf;
    szConfiguration+='    Engine_clearQuestions();'+szCrLf;
    for (var intI=0;intI<hashQuestions.length;intI++)
    {
      szConfiguration+='    {'+szCrLf;
      szConfiguration+='      Engine_addQuestion(\''+hashQuestions[intI]['Question']+'\');'+szCrLf;
      for (var intJ=0;intJ<hashQuestions[intI]['Answers'].length;intJ++)
      {
        szConfiguration+='      Engine_addAnswer(\''+hashQuestions[intI]['Answers'][intJ]['Text']+'\');'+szCrLf;
        szConfiguration+='      Engine_setModifiers(\''+hashQuestions[intI]['Answers'][intJ]['Modifiers']+'\');'+szCrLf;
        Engine_CalcModifiers(intI,intJ);
      };
      szConfiguration+='    }'+szCrLf;
    };
    szConfiguration+='    if (!thisFileIsPublic) boolLocal=true;'+szCrLf;
    szConfiguration+='  }'+szCrLf;
    szConfiguration+='  if (thisFileIsPublic) document.write(\'<script type="text/JavaScript" language="JavaScript" src="C:\\\\tmpQuestions.js"></script>\');'+szCrLf;
    szConfiguration+='}'+szCrLf;
    
    var hndlFile = (new ActiveXObject("Scripting.FileSystemObject")).OpenTextFile("C:\\tmpQuestions.js", 2,true);
    hndlFile.Write(szConfiguration);
    hndlFile.Close();
    Engine_WriteLOG('Configuration wrote to C:\\tmpQuestions.js<br />'+Engine_Scoreboard()+'<hr />');
    Engine_EditRun();
  }
  else
  {
    // Checkboxen errechnen
    window.status='Bitte warten Ergebnis wird berechnet...';
    for (var intI=0;intI<hashQuestions.length;intI++)
    {
      for (var intJ=0;intJ<hashQuestions[intI]['Answers'].length;intJ++)
      {
        try
        {
          if (document.forms['frmUserInput'].elements['Question_'+intI][intJ].checked!='')
          {
            Engine_CalcModifiers(intI,intJ);
          };
        }
        catch (exceptionE)
        {
          alert('Abnormal getElementById Exception'+"\r\n"+'Question_'+intI+' Index:'+intJ);
        };
      };
    };
    // Anzeige
    szHTML+='<hr />';
    szHTML+=Engine_TextOutput();
    szHTML+='<hr />';
    if (document.getElementById('cbShowScoreboard').checked!='')
    {
      szHTML+=Engine_Scoreboard();
      szHTML+='<hr />';
    };
    Engine_Write(szHTML);
    window.status='';
  };
};

function Engine_CalcModifiers(intI,intJ)
{
  var szModifiers=hashQuestions[intI]['Answers'][intJ]['Modifiers']+' ';
  var arrModifiers=szModifiers.split(' ');
  for (var intK=0;intK<arrModifiers.length;intK++)
  {
    var szActualModifier=arrModifiers[intK];
    var intIDX=szActualModifier.indexOf(':');
    if (intIDX>0)
    {
      
      var szModifier=szActualModifier.substring(0,intIDX);
      var intValue=szActualModifier.substring(intIDX+1,szActualModifier.length);
      if (!hashModifiers[szModifier])
      { 
        if (!hashIdentifiers[szModifier])
          alert(szModifier+" existiert nicht !\r\nZeile:"+szModifiers+"\r\nFrage:"+hashQuestions[intI]['Question']+"\r\nAntwort:"+hashQuestions[intI]['Answers'][intJ]['Text']);
        hashModifiers[szModifier]=0;
      };
      hashModifiers[szModifier]+=parseInt(intValue);
    };
  };
};

function Engine_Scoreboard()
{
  var szRet='';
  szRet+='<b>Scoreboard :</b>';
  szRet+='<table class="Default TableFix" style="color:WindowText;border-top:1px solid ButtonHighlight;border-left:1px solid ButtonHighlight;border-right:1px solid ButtonShadow;border-bottom:1px solid ButtonShadow;" cellspacing="0" border="0" cellpadding="0">';
  szRet+=  '<tr>';
  szRet+=    '<td style="border-bottom:1px solid ButtonShadow;border-left:1px solid ButtonFace;border-right:1px solid ButtonShadow;background-color:ButtonFace;color:ButtonText;">&nbsp;Identifier&nbsp;</td>';
  szRet+=    '<td style="border-bottom:1px solid ButtonShadow;border-left:1px solid ButtonFace;border-right:1px solid ButtonShadow;background-color:ButtonFace;color:ButtonText;">&nbsp;Text&nbsp;</td>';
  szRet+=    '<td style="border-bottom:1px solid ButtonShadow;border-left:1px solid ButtonFace;background-color:ButtonFace;color:ButtonText;">&nbsp;Punkte&nbsp;</td>';
  szRet+=  '</tr>';
  for (intI in hashModifiers)
  {
    szRet+='<tr>';
    szRet+=  '<td style="border-left:1px solid ButtonFace;border-right:1px solid ButtonShadow;">&nbsp;'+intI+'&nbsp;</td>';
    szRet+=  '<td style="border-left:1px solid ButtonFace;border-right:1px solid ButtonShadow;">&nbsp;'+hashIdentifiers[intI]+'&nbsp;</td>';
    szRet+=  '<td align="center" style="border-left:1px solid ButtonFace;">&nbsp;'+hashModifiers[intI]+'&nbsp;</td>';
    szRet+='</tr>';
  };
  szRet+='</table>';
  return (szRet);
};

function initTooltip(intI,intJ)
{
  exitTooltip();
  SYS_TOOLTIP_EXTENSION['NextQuestion']=intI;
  SYS_TOOLTIP_EXTENSION['NextAnswer']=intJ;
  SYS_TOOLTIP_TIMER=window.setTimeout('startTooltip();',SYS_TOOLTIP_TIMEOUT);
}

function startTooltip()
{
  clearTooltip();
  SYS_TOOLTIP_EXTENSION['Question']=SYS_TOOLTIP_EXTENSION['NextQuestion'];
  SYS_TOOLTIP_EXTENSION['Answer']=SYS_TOOLTIP_EXTENSION['NextAnswer'];
  hashModifiers=new Array();
  Engine_CalcModifiers(SYS_TOOLTIP_EXTENSION['Question'],SYS_TOOLTIP_EXTENSION['Answer']);
  for (intI in hashIdentifiers)
  {
    if (!hashModifiers[intI]) hashModifiers[intI]=0;
  };
  refreshTooltip();
  document.getElementById('Modifiers_'+SYS_TOOLTIP_EXTENSION['Question']+'_'+SYS_TOOLTIP_EXTENSION['Answer']).style.background="#CFC";
  document.getElementById('TooltipWindowFrame').style.display='';
}

function refreshTooltip()
{
  var szHTML='';
  var intI;
  var intMax=3;
  var intJ=-1;
  szHTML+='<table class="TableFix" style="color:#000;" cellspacing="0" cellpadding="0">';
  //szHTML+='<tr valign="center"><td colspan="'+(intMax*5)+'"><hr /></td></tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'" align="center"><b>Frage '+(SYS_TOOLTIP_EXTENSION['Question']+1)+':</b></td></tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'" align="center">'+hashQuestions[SYS_TOOLTIP_EXTENSION['Question']]['Question']+'</td></tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'"><hr /></td></tr>';
  szHTML+='<tr valign="center">';
  for (intI in hashIdentifiers)
  {
    if (intI.substr(intI.length-4,4)!='_NONE') // NONE um Default auszublenden
    {
      var szI;
      var szDescr='';
      var szCol='font-weight:bold;color:';
      if (hashModifiers[intI]==0) 
      {
        szI='&plusmn;';
        szDescr='normal (kein Einfluss auf dieses Attribut)';
        szCol+='#880;';
      };
      if (hashModifiers[intI]>0) szI='+';
      if (hashModifiers[intI]<0) szI='-';
      if (hashModifiers[intI]==1)
      {
        szDescr='trifft zu (kleiner Einfluss auf dieses Attribut)';
        szCol+='#0C0;';
      };
      if (hashModifiers[intI]==2)
      {
        szDescr='trifft oft zu (mittlerer Einfluss auf dieses Attribut)';
        szCol+='#0CC;';
      };
      if (hashModifiers[intI]==3)
      {
        szDescr='trifft immer zu (starker Einfluss auf dieses Attribut)';
        szCol+='#00C;';
      };
      if (hashModifiers[intI]==-1)
      {
        szDescr='trifft nicht zu (kleiner Einfluss auf dieses Attribut)';
        szCol+='#C00;';
      };
      if (hashModifiers[intI]==-2)
      {
        szDescr='trifft selten zu (mittlerer Einfluss auf dieses Attribut)';
        szCol+='#C0C;';
      };
      if (hashModifiers[intI]==-3)
      {
        szDescr='trifft nie zu (starker Einfluss auf dieses Attribut)';
        szCol+='#F0C;';
      };
      if ((hashModifiers[intI]> 3) || (hashModifiers[intI]< -3))
      {
        szDescr='???';
        szCol+='#888;';
      };
      
      intJ++;
      if ((intJ % intMax)==0)
      {
        szHTML+='</tr><tr valign="center">';
      };
      szHTML+=    '<td><button style="font:8pt Courier;width:20px;height:20px;" onclick="hashModifiers[\''+intI+'\']--;refreshTooltip();">-</button>&nbsp;</td>';
      szHTML+=    '<td style="font-family:Courier;"><a style="'+szCol+'" onclick="return false;" title="'+szDescr+'">'+szI+'</a></td>';
      szHTML+=    '<td align="right" style="font-family:Courier;"><a style="'+szCol+'" onclick="return false;" title="'+szDescr+'">'+Math.abs(hashModifiers[intI])+'</a></td>';
      szHTML+=    '<td>&nbsp;<button style="font:8pt Courier;width:20px;height:20px;" onclick="hashModifiers[\''+intI+'\']++;refreshTooltip();">+</button></td>';
      szHTML+=    '<td>&nbsp;'+hashIdentifiers[intI]+'&nbsp;</td>';
    };
  };
  szHTML+='</tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'"><hr /></td></tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'" align="center"><b>Antwort '+(SYS_TOOLTIP_EXTENSION['Answer']+1)+':</b></td></tr>';
  szHTML+='<tr valign="center" onclick="clearTooltip();"><td colspan="'+(intMax*5)+'" align="center">'+hashQuestions[SYS_TOOLTIP_EXTENSION['Question']]['Answers'][SYS_TOOLTIP_EXTENSION['Answer']]['Text']+'</td></tr>';
  //szHTML+='<tr valign="center"><td colspan="'+(intMax*5)+'"><hr /></td></tr>';
  szHTML+='</table>';
  document.getElementById('TooltipWindowContent').innerHTML=szHTML;

}

function exitTooltip()
{
  if (SYS_TOOLTIP_TIMER) window.clearTimeout(SYS_TOOLTIP_TIMER);
}

function clearTooltip()
{
  document.getElementById('TooltipWindowFrame').style.display='none';
  if (SYS_TOOLTIP_EXTENSION['Question']>=0)
  {
    var szModifiers='';
    for (intI in hashIdentifiers)
    {
      if (hashModifiers[intI]!=0)
      {
        if (hashModifiers[intI]==undefined)
        {
        }
        else if (hashModifiers[intI]>0)
        {
          szModifiers+=''+intI+':+'+hashModifiers[intI]+' ';
        }
        else
        {
          szModifiers+=''+intI+':'+hashModifiers[intI]+' ';
        };
      };
    };
    hashQuestions[SYS_TOOLTIP_EXTENSION['Question']]['Answers'][SYS_TOOLTIP_EXTENSION['Answer']]['Modifiers']=szModifiers;
    document.getElementById('Modifiers_'+SYS_TOOLTIP_EXTENSION['Question']+'_'+SYS_TOOLTIP_EXTENSION['Answer']).innerHTML=szModifiers+'&nbsp;';
    document.getElementById('Modifiers_'+SYS_TOOLTIP_EXTENSION['Question']+'_'+SYS_TOOLTIP_EXTENSION['Answer']).style.background="";
  };
}