var hashIdentifierAdjectives=new Array();
var hashDescriptions=new Array();

function Engine_HelperInit()
{
  document.getElementById('WindowTitle').innerHTML='D&amp;D Charakterhelfer';

  hashIdentifiers         ['ALIGN_NONE']      = 'gesinnungslos';
  hashIdentifierAdjectives['ALIGN_NONE']      = 'gesinnungslose';
  hashDescriptions        ['ALIGN_NONE']      = 'Du hast zuwenig Fragen beantwortet, die eine Aussage über deine Gesinnung zulassen.';
  hashIdentifiers         ['RACE_NONE']       = 'ohne Rasse';
  hashIdentifierAdjectives['RACE_NONE']       = 'rassenlose';
  hashDescriptions        ['RACE_NONE']       = 'Du hast zuwenig Fragen beantwortet, die eine Aussage über deine Rasse zulassen.';
  hashIdentifiers         ['CLASS_NONE']      = 'Bürger';
  hashIdentifierAdjectives['CLASS_NONE']      = 'bürgerliche';
  hashDescriptions        ['CLASS_NONE']      = 'Du hast zuwenig Fragen beantwortet, die eine Aussage über deine Klasse zulassen.';
  
  hashIdentifiers         ['ALIGN_NG']        = 'neutral gut';
  hashIdentifierAdjectives['ALIGN_NG']        = 'neutral gute';
  hashDescriptions        ['ALIGN_NG']        = '';
  hashIdentifiers         ['ALIGN_LG']        = 'rechtschaffen gut';
  hashIdentifierAdjectives['ALIGN_LG']        = 'rechtschaffen gute';
  hashDescriptions        ['ALIGN_LG']        = '';
  hashIdentifiers         ['ALIGN_CG']        = 'chaotisch gut';
  hashIdentifierAdjectives['ALIGN_CG']        = 'chaotisch gute';
  hashDescriptions        ['ALIGN_CG']        = '';
  
  hashIdentifiers         ['ALIGN_NN']        = 'neutral';
  hashIdentifierAdjectives['ALIGN_NN']        = 'neutrale';
  hashDescriptions        ['ALIGN_NN']        = '';
  hashIdentifiers         ['ALIGN_LN']        = 'rechtschaffen neutral';
  hashIdentifierAdjectives['ALIGN_LN']        = 'rechtschaffen neutrale';
  hashDescriptions        ['ALIGN_LN']        = '';
  hashIdentifiers         ['ALIGN_CN']        = 'chaotisch neutral';
  hashIdentifierAdjectives['ALIGN_CN']        = 'chaotisch neutrale';
  hashDescriptions        ['ALIGN_CN']        = '';
  
  hashIdentifiers         ['ALIGN_NE']        = 'neutral böse';
  hashIdentifierAdjectives['ALIGN_NE']        = 'neutral böse';
  hashDescriptions        ['ALIGN_NE']        = '';
  hashIdentifiers         ['ALIGN_LE']        = 'rechtschaffen böse';
  hashIdentifierAdjectives['ALIGN_LE']        = 'rechtschaffen böse';
  hashDescriptions        ['ALIGN_LE']        = '';
  hashIdentifiers         ['ALIGN_CE']        = 'chaotisch böse';
  hashIdentifierAdjectives['ALIGN_CE']        = 'chaotisch böse';
  hashDescriptions        ['ALIGN_CE']        = '';
  
  hashIdentifiers         ['RACE_HUMAN']      = 'Mensch';
  hashIdentifierAdjectives['RACE_HUMAN']      = 'menschliche';
  hashDescriptions        ['RACE_HUMAN']      = '';
  hashIdentifiers         ['RACE_ELF']        = 'Elf';
  hashIdentifierAdjectives['RACE_ELF']        = 'elfische';
  hashDescriptions        ['RACE_ELF']        = '';
  hashIdentifiers         ['RACE_ORC']        = 'Ork';
  hashIdentifierAdjectives['RACE_ORC']        = 'orkische';
  hashDescriptions        ['RACE_ORC']        = '';
  
  hashIdentifiers         ['RACE_GNOME']      = 'Gnom';
  hashIdentifierAdjectives['RACE_GNOME']      = 'gnomische';
  hashDescriptions        ['RACE_GNOME']      = '';
  hashIdentifiers         ['RACE_HALF-ELF']   = 'Halb-Elf';
  hashIdentifierAdjectives['RACE_HALF-ELF']   = 'halb-elfische';
  hashDescriptions        ['RACE_HALF-ELF']   = '';
  hashIdentifiers         ['RACE_HALF-ORC']   = 'Halb-Ork';
  hashIdentifierAdjectives['RACE_HALF-ORC']   = 'halb-orkische';
  hashDescriptions        ['RACE_HALF-ORC']   = '';
  
  hashIdentifiers         ['RACE_HALFLING']   = 'Halbling';
  hashIdentifierAdjectives['RACE_HALFLING']   = 'halblingische';
  hashDescriptions        ['RACE_HALFLING']   = '';
  hashIdentifiers         ['RACE_EXTERNAR']   = 'Externar';
  hashIdentifierAdjectives['RACE_EXTERNAR']   = 'externare';
  hashDescriptions        ['RACE_EXTERNAR']   = '';
  hashIdentifiers         ['RACE_DWARVE']     = 'Zwerg';
  hashIdentifierAdjectives['RACE_DWARVE']     = 'zwergische';
  hashDescriptions        ['RACE_DWARVE']     = '';
  
  hashIdentifiers         ['CLASS_FIGHTER']   = 'Kämpfer';
  hashIdentifierAdjectives['CLASS_FIGHTER']   = 'kämpferische';
  hashDescriptions        ['CLASS_FIGHTER']   = '';
  hashIdentifiers         ['CLASS_WIZARD']    = 'Magier';
  hashIdentifierAdjectives['CLASS_WIZARD']    = 'magische';
  hashDescriptions        ['CLASS_WIZARD']    = '';
  hashIdentifiers         ['CLASS_BARBAR']    = 'Barbar';
  hashIdentifierAdjectives['CLASS_BARBAR']    = 'barbarische';
  hashDescriptions        ['CLASS_BARBAR']    = '';
  
  hashIdentifiers         ['CLASS_PALADIN']   = 'Paladin';
  hashIdentifierAdjectives['CLASS_PALADIN']   = 'paladinische';
  hashDescriptions        ['CLASS_PALADIN']   = '';
  hashIdentifiers         ['CLASS_CLERIC']    = 'Kleriker';
  hashIdentifierAdjectives['CLASS_CLERIC']    = 'klerikale';
  hashDescriptions        ['CLASS_CLERIC']    = '';
  hashIdentifiers         ['CLASS_ROGUE']     = 'Schurke';
  hashIdentifierAdjectives['CLASS_ROGUE']     = 'schurkische';
  hashDescriptions        ['CLASS_ROGUE']     = '';
  
  hashIdentifiers         ['CLASS_BARD']      = 'Barde';
  hashIdentifierAdjectives['CLASS_BARD']      = 'bardische';
  hashDescriptions        ['CLASS_BARD']      = '';
  hashIdentifiers         ['CLASS_DRUID']     = 'Druide';
  hashIdentifierAdjectives['CLASS_DRUID']     = 'druidische';
  hashDescriptions        ['CLASS_DRUID']     = '';
  hashIdentifiers         ['CLASS_SORCERER']  = 'Hexenmeister';
  hashIdentifierAdjectives['CLASS_SORCERER']  = 'hexenmeisterische';
  hashDescriptions        ['CLASS_SORCERER']  = '';
  
  hashIdentifiers         ['CLASS_RANGER']    = 'Waldläufer';
  hashIdentifierAdjectives['CLASS_RANGER']    = 'waldläuferische';
  hashDescriptions        ['CLASS_RANGER']    = '';
  hashIdentifiers         ['CLASS_MONK']      = 'Mönch';
  hashIdentifierAdjectives['CLASS_MONK']      = 'mönchhafte';
  hashDescriptions        ['CLASS_MONK']      = '';
};

function Engine_TextOutput()
{
  var szRet='';
  //Calculation
  szRet+='<span style="font-weight:bold;">Charakter :</span><br />';
  //Alignment
  var szAlignment='ALIGN_NONE';
  {
    var intAlignment=0;
    for (var szI in hashModifiers)
    {
      if (szI.indexOf('ALIGN_')==0)
      {
        if (hashModifiers[szI]>intAlignment)
        {
          intAlignment=hashModifiers[szI];
          szAlignment=szI;
        };
      };
    };
  };
  
  //Race
  var szRace='RACE_NONE';
  {
    var intRace=0;
    for (var szI in hashModifiers)
    {
      if (szI.indexOf('RACE_')==0)
      {
        if (hashModifiers[szI]>intRace)
        {
          intRace=hashModifiers[szI];
          szRace=szI;
        };
      };
    };
  };
  
  //Class
  var szClass='CLASS_NONE';
  {
    var intClass=0;
    for (var szI in hashModifiers)
    {
      if (szI.indexOf('CLASS_')==0)
      {
        if (hashModifiers[szI]>intClass)
        {
          intClass=hashModifiers[szI];
          szClass=szI;
        };
      };
    };
  };
  
  szRet+='<br /><center style="font-weight:bold;font-size:150%;">Du bist ein '+hashIdentifierAdjectives[szAlignment]+'r, '+hashIdentifierAdjectives[szRace]+'r '+hashIdentifiers[szClass]+'</center><br /><br />';
  szRet+='<hr />';
  szRet+='<span style="font-weight:bold;">Beschreibung des Ergebnisses:</span><br /><br />';
  szRet+='<span style="font-weight:bold;">'+hashIdentifiers[szAlignment]+':</span><br />';
  szRet+=hashDescriptions[szAlignment]+'<br /><br />';
  szRet+='<span style="font-weight:bold;">'+hashIdentifiers[szRace]+':</span><br />';
  szRet+=hashDescriptions[szRace]+'<br /><br />';
  szRet+='<span style="font-weight:bold;">'+hashIdentifiers[szClass]+':</span><br />';
  szRet+=hashDescriptions[szClass]+'<br /><br />';
  szRet+='<hr />';
  szRet+='Viel Spa&szlig; beim Spielen !';
  return (szRet);
};
