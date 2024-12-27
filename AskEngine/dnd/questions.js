{
  var thisFileIsPublic=true;
  if ((thisFileIsPublic) || (Engine_getVersion()<="v2.2d"))
  {
    Engine_clearQuestions();
    {
      Engine_addQuestion('Wo f�hlst du dich am wohlsten ?');
      Engine_addAnswer('In einer gro�en Stadt voller Leben.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:-2 RACE_ORC:-2 RACE_GNOME:+1 RACE_HALF-ELF:-1 RACE_HALF-ORC:-1 RACE_HALFLING:+2 RACE_DWARVE:-2 CLASS_FIGHTER:+1 CLASS_BARBAR:-1 CLASS_CLERIC:+1 CLASS_ROGUE:+2 CLASS_BARD:+1 CLASS_DRUID:-2 CLASS_SORCERER:+2 CLASS_RANGER:-2 ');
      Engine_addAnswer('Hinter den sch�tzenden Mauern einer Kirche.');
      Engine_setModifiers('CLASS_DRUID:-1 CLASS_CLERIC:+2 CLASS_MONK:+2 CLASS_PALADIN:+1 CLASS_ROGUE:-1');
      Engine_addAnswer('In der N�he von m�chtigen, eindrucksvollen Bergen.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-1 RACE_DWARVE:+2');
      Engine_addAnswer('In einer Bibliothek voller interessanter B�cher.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_ORC:-3 RACE_GNOME:+1 RACE_HALF-ELF:+1 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_WIZARD:+2 CLASS_CLERIC:+1 CLASS_DRUID:-1 CLASS_SORCERER:+1 CLASS_RANGER:-1 ');
      Engine_addAnswer('Auf einer sonnigen Lichtung im Herzen eines lebendigen Waldes.');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_ORC:+1 RACE_HALFLING:-1 RACE_GNOME:-1 RACE_DWARVE:-2 CLASS_DRUID:+2 CLASS_RANGER:+2 CLASS_BARBAR:+1 CLASS_BARD:-1 CLASS_ROGUE:-1');
      Engine_addAnswer('An einem abendlichen Strand mit rauschenden Wellen.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_HALF-ELF:+1 CLASS_MONK:+2 CLASS_SORCERER:+1 CLASS_BARD:+1 CLASS_ROGUE:-1');
    }
    {
      Engine_addQuestion('Wo f�hlst du dich am unwohlsten ?');
      Engine_addAnswer('In einer gro�en Stadt.');
      Engine_setModifiers('RACE_HUMAN:-2 RACE_HALF-ELF:+1 RACE_ELF:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-2 RACE_GNOME:-1 RACE_DWARVE:+2 CLASS_BARBAR:+1 CLASS_BARD:-1 CLASS_DRUID:+2 CLASS_SORCERER:-2 CLASS_FIGHTER:-1 CLASS_CLERIC:-1 CLASS_ROGUE:-2 CLASS_RANGER:+2');
      Engine_addAnswer('Hinter den Mauern einer Kirche.');
      Engine_setModifiers('CLASS_DRUID:+1 CLASS_CLERIC.-2 CLASS_MONK:-2 CLASS_PALADIN:-1 CLASS_ROGUE:+1');
      Engine_addAnswer('In der N�he von Bergen.');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 RACE_HALFLING:+1 RACE_DWARVE:-2');
      Engine_addAnswer('In einer Bibliothek.');
      Engine_setModifiers('RACE_ORC:+3 RACE_HALF-ORC:+2 RACE_DWARVE:+1 RACE_GNOME:-1 RACE_ELF:-2 RACE_HALF-ELF:-1 CLASS_DRUID:+1 CLASS_BARBAR:+2 CLASS_FIGHTER:+1 CLASS_RANGER+1 CLASS_WIZARD:-2 CLASS_SORCERER:-1 CLASS_CLERIC:-1');
      Engine_addAnswer('Auf einer Waldlichtung.');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_ORC:-1 RACE_HALFLING:+1 RACE_GNOME:+1 RACE_DWARVE:+2 CLASS_DRUID:-2 CLASS_RANGER:-2 CLASS_BARBAR:-1 CLASS_BARD:+1 CLASS_ROGUE:+1');
      Engine_addAnswer('An einem abendlichen Strand.');
      Engine_setModifiers('CLASS_MONK:-2 CLASS_SORCERER:-1 CLASS_BARD:-1 CLASS_ROGUE:-1');
    }
    {
      Engine_addQuestion('Welcher dieser Berufe w�rde am ehesten zu dir passen ?');
      Engine_addAnswer('Arzt.');
      Engine_setModifiers('ALIGN_LG:+2 CLASS_CLERIC:+2 CLASS_DRUID:+2 CLASS_RANGER+1 CLASS_PALADIN:+1 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_ROGUE:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1');
      Engine_addAnswer('S�nger.');
      Engine_setModifiers('ALIGN_NG:+1 CLASS_BARD:+3 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1 CLASS_ROGUE:-2');
      Engine_addAnswer('Lehrer.');
      Engine_setModifiers('ALIGN_NG:+1 CLASS_BARD:+1 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:+1 CLASS_WIZARD:+2 CLASS_ROGUE:-2 CLASS_MONK:+1 CLASS_DRUID:+2');
      Engine_addAnswer('Auftragskiller.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+2 ALIGN_CE:+1 ALIGN_NG:-2 CLASS_BARBAR:+2 CLASS_FIGHTER:+2 CLASS_ROGUE:+2 CLASS_MONK:+2 CLASS_SORCERER:+1 CLASS_WIZARD:+1');
      Engine_addAnswer('G�rtner.');
      Engine_setModifiers('ALIGN_NE:+2 CLASS_DRUID:+3 CLASS_RANGER:+3 CLASS_PALADIN:+1 CLASS_SORCERER:+1 CLASS_WIZARD:+1 CLASS_FIGHTER:-2 CLASS_BARBAR:-1');
      Engine_addAnswer('Polizist.');
      Engine_setModifiers('ALIGN_LG:+2 CLASS_PALADIN:+5 CLASS_ROGUE:-5');
      Engine_addAnswer('Psychologe.');
      Engine_setModifiers('ALIGN_NN:+2 CLASS_SORCERER:+3 CLASS_BARBAR:-3');
      Engine_addAnswer('Chemiker.');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_BARBAR:-4');
    }
    {
      Engine_addQuestion('Du hast kein Geld bist aber total ausgehungert. Was w�rdest du tun ?');
      Engine_addAnswer('Ich singe in der n�chsten Taverne oder im n�chsten wohlhabendend aussehenden Haus.');
      Engine_setModifiers('ALIGN_NG:+1 RACE_ORC:-1 CLASS_BARBAR:-1 CLASS_BARD:+2');
      Engine_addAnswer('Ich schneide die Kehle eines B�rgers auf um ihn zu berauben.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+2 ALIGN_CE:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+2 CLASS_ROGUE:+1');
      Engine_addAnswer('Ich bitte im n�chsten Tempel oder der n�chsten Kirche um Hilfe.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+2 ALIGN_LN:+1 RACE_HUMAN:+1 RACE_ORC:-1 CLASS_BARBAR:-2 CLASS_CLERIC:+2 CLASS_MONK:+2 CLASS_PALADIN:+1 CLASS_RANGER:-2');
      Engine_addAnswer('Ich versuche das einfache Volk mit etwas Magie zu beeindrucken.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+2 RACE_HALF-ELF:+1 RACE_HUMAN:+2 RACE_ORC:-1 RACE_DWARVE:-1 CLASS_SORCERER:+2 CLASS_WIZARD:+1 CLASS_FIGHTER:-2 CLASS_ROGUE:-2 CLASS_RANGER:-2');
      Engine_addAnswer('Ich verkaufe einen magischen Gegenstand, den ich f�r solche Zeiten aufgehoben habe.');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_ROGUE:+2 RACE_ORC:-1 RACE_HALFLING:+2');
      Engine_addAnswer('Ich biete mich selbst als Leibw�chter an.');
      Engine_setModifiers('ALIGN_LG:+2 ALIGN_LE:+2 RACE_ORC:-1 RACE_ELF:+1 CLASS_FIGHTER:+2 CLASS_SORCERER:+1 CLASS_MONK:+1');
      Engine_addAnswer('Ich erkundige mich beim Vorstand des Ortes nach Arbeit.');
      Engine_setModifiers('ALIGN_LG:+2 RACE_ELF:+1 RACE_ORC:-2 RACE_HALF-ORC:+1 CLASS_DRUID:-1 CLASS_SORCERER:+1 CLASS_FIGHTER:+1 CLASS_WIZARD:+2');
      Engine_addAnswer('Ich gehe im Wald nach Essen suchen.');
      Engine_setModifiers('CLASS_BARBAR:+1 CLASS_DRUID:+2 CLASS_RANGER:+2 RACE_ELF:+2 RACE_ORC:+2 RACE_DWARVE:+1 ALIGN_NN:+2 ALIGN_NG:+1 ALIGN_NE:+1');
    }
    {
      Engine_addQuestion('Beim Betreten einer H�hle stellst du fest, dass ein gro�er roter Drache dich bereits erwartet hat. Was tust du ?');
      Engine_addAnswer('So schnell wie m�glich weglaufen, �berlegen kann man sp�ter noch.');
      Engine_setModifiers('RACE_HALFLING:+2 RACE_GNOME:+2 CLASS_ROGUE:+1 CLASS_BARD:+2');
      Engine_addAnswer('Ich muss nur schneller laufen als der langsamste aus der Abenteurergruppe. Also nur nicht letzter sein.');
      Engine_setModifiers('ALIGN_LE:+2 ALIGN_NE:+2 ALIGN_CE:+2 CLASS_ROGUE:+2');
      Engine_addAnswer('Ich ziehe mein Schwert und w�rfel Initiative');
      Engine_setModifiers('ALIGN_LG:+2 ALIGN_LN:+1 ALIGN_NG:+1 ALIGN_NN:+1 RACE_HUMAN:+1 RACE_DWARVE:+2 RACE_HALF-ORC:+1 RACE_ORC:+2 CLASS_FIGHTER:+2 CLASS_PALADIN:+2 CLASS_CLERIC:+1 CLASS_MONK:+1');
      Engine_addAnswer('Magisches Geschoss, sofort !');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_SORCERER:+2 CLASS_BARD:+1');
      Engine_addAnswer('Beten, und beten, dass beten funktioniert.');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_CLERIC:+2 CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_ROGUE:+1 CLASS_MONK:+2');
      Engine_addAnswer('Ich hab irgendwo in meinem Rucksack noch eine Schriftrolle die Drachen vernichtet.');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_SORCERER:+2 CLASS_WIZARD:+2');
      Engine_addAnswer('Ich verkrieche mich in der n�chstbesten m�glichst dunkelsten Ecke.');
      Engine_setModifiers('CLASS_PALADIN:+2 CLASS_ROGUE:+2 CLASS_BARD:+2');
      Engine_addAnswer('M�ge mein Gott mich in die Schlacht geleiten !');
      Engine_setModifiers('CLASS_PALADIN:+2 CLASS_DRUID:+2 CLASS_RANGER:+2 ');
      Engine_addAnswer('Ich lade meinen Bogen/meine Armbrust, ziele auf die Augen und kreuze die Finger.');
      Engine_setModifiers('CLASS_RANGER:+2 CLASS_ROGUE:+2 RACE_HALF-ELF:+2 RACE_ELF:+2');
    }
    {
      Engine_addQuestion('Deine Abenteurergruppe findet einen Schatz was tust du ?');
      Engine_addAnswer('Ich ermorde alle hinterh�ltig und behalte den Schatz allein.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_CE:+2 ALIGN_LE:+1 ALIGN_NG:-2 ALIGN_CG:-1 ALIGN_LG:-2 CLASS_ROGUE:+2 CLASS_SORCERER:+1 CLASS_BARBAR:+1 CLASS_DRUID:-2 CLASS_MONK:-1');
      Engine_addAnswer('Ich bin daf�r es zu gleichen teilen aufzuteilen. Jeder bekommt genauso viel wie jeder andere.');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_LG:+1 CLASS_SORCERER:+1 CLASS_PALADIN:+2 CLASS_ROGUE:-1');
      Engine_addAnswer('Der Gro�teil soll der Familie des armen Abenteurers zukommen, der alle Fallen entsch�rft hat und dies mit seinem Leben bezahlen musste.');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_NE:-1 ALIGN_CE:-1 ALIGN_LE:-2 CLASS_PALADIN:+1 CLASS_ROGUE:-2');
      Engine_addAnswer('Ist mir egal, meinen Teil spende ich eh f�r wohlt�tige Zwecke.');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_NE:-1 ALIGN_CE:-1 ALIGN_LE:-3 CLASS_PALADIN:+2 CLASS_ROGUE:-2 CLASS_DRUID:+1');
      Engine_addAnswer('Ich nehme nur ein kleines St�ck mit, den Rest darf die Gruppe unter sich ausmachen. Ist mir egal, ob es wertvoll ist oder nicht.');
      Engine_setModifiers('CLASS_MONK:+1 CLASS_ROGUE:-2 CLASS_RANGER:+1');
      Engine_addAnswer('Wen interessierts ich brauche nur genug um bis zum n�chsten Abenteuer in Tavernen und Gasth�usern �berleben zu k�nnen.');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_MONK:+1 CLASS_SORCERER:+1 CLASS_WIZARD:+1 CLASS_RANGER:+1 CLASS_ROGUE:-2');
      Engine_addAnswer('Ich will nichts davon. Sollte man mir was zugestehen, lasse ich es hier liegen.');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_ROGUE:-2');
    }
    {
      Engine_addQuestion('Du kommst in eine gewaltige Schatzkammer. Worauf f�llt dein Blick zuerst ?');
      Engine_addAnswer('Gold, Juwelen, ich bin reich !');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_HUMAN:+1 RACE_GNOME:+2 RACE_DWARVE:+2 CLASS_ROGUE:+2 CLASS_WIZARD:+2 CLASS_MONK:-2 CLASS_DRUID:-2 CLASS_RANGER:-1 CLASS_BARBAR:-1');
      Engine_addAnswer('das leuchtende Schwert an der Wand');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_SORCERER:-2 CLASS_WIZARD:-2 CLASS_PALADIN:+1 CLASS_RANGER:+1');
      Engine_addAnswer('ein Facettenreiches Juwel, dass mir einen kalten Schauder �ber den R�cken jagd');
      Engine_setModifiers('RACE_DWARVE:+2 RACE_GNOME:+2 CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_ROGUE:+2');
      Engine_addAnswer('der antike Schrein eines uralten Gottes in der Wand');
      Engine_setModifiers('CLASS_CLERIC:+2');
      Engine_addAnswer('eine vergoldete Axt, die an der Wand lehnt.');
      Engine_setModifiers('RACE_DWARVE:+2');
      Engine_addAnswer('die handgeschnitzte h�lzerne Statue');
      Engine_setModifiers('CLASS_RANGER:+2 RACE_ELF:+2');
      Engine_addAnswer('der Sarkophag in der Ecke mit dem bunten Emblem');
      Engine_setModifiers('CLASS_CLERIC:+2 CLASS_SORCERER:+2 CLASS_WIZARD:+1');
      Engine_addAnswer('die goldene Harfe in der Ecke');
      Engine_setModifiers('CLASS_BARD:+2');
    }
    {
      Engine_addQuestion('Welche Rolle in einer Abenteurergruppe nimmst du ein ?');
      Engine_addAnswer('Ich bin der Anf�hrer.<br /> Ich sage jedem was zu tun ist und wann der richtige Zeitpunkt daf�r ist.');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_ROGUE:-1 CLASS_DRUID:-1 CLASS_BARBAR:-2 RACE_HUMAN:+2 RACE_ORC:-2 RACE_HALF-ORC:-1');
      Engine_addAnswer('Ich bin die rechte Hand des Anf�hrers.<br /> Ich habe die F�higkeit ein Anf�hrer zu sein, aber ich hasse es gro�e Entscheidungen zu treffen. Ich sorge daf�r dass getan wird, was immer getan werden muss, solange mir jemand sagt was es ist.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1');
      Engine_addAnswer('Ich bin derjenige mit den guten Ideen.<br /> Mir f�llt immer irgendein Plan ein, und ich �berlasse es den anderen dar�ber nachzudenken, wie diese Ideen in die Tat umgesetzt werden m�ssen.');
      Engine_setModifiers('RACE_ELF:+1 CLASS_ROGUE:+2 CLASS_SORCERER:-1 CLASS_BARD:+2 CLASS_BARBAR:-1 RACE_ORC:-1');
      Engine_addAnswer('Ich bin ein Soldat.<br /> Ich folge dem Anf�hrer und kann oder will selbst kein Kommando haben. Sagt mir in welche Richtung es geht und was zu tun ist. Danke !');
      Engine_setModifiers('RACE_DWARVE:+2 RACE_ORC:+2 CLASS_FIGHTER:+1 CLASS_BARBAR:+1');
      Engine_addAnswer('Ich bin die moralische St�tze.<br /> Ich bin kein Anf�hrer aber ich werde jederzeit sagen was ich dar�ber denke, abh�ngig von meinen eigenen Vorstellungen von Moral und Ethik, auch wenn dass die Gruppe nerven sollte.');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_BARBAR:-2 RACE_GNOME:+4 RACE_HALFLING:+2 CLASS_CLERIC:+2 RACE_ORC:-2 RACE_HALF-ORC:-1');
      Engine_addAnswer('Ich bin der Aussenseiter.<br /> Auch wenn ich Teil der Gruppe bin, werde ich mich von den anderen distanzieren und mich nur auf mich selbst verlassen.');
      Engine_setModifiers('CLASS_MONK:+2 CLASS_SORCERER:+2 CLASS_BARD:-2 RACE_HALFLING:-1');
      Engine_addAnswer('Ich bin der Rebell.<br /> Ich w�re gerne Anf�hrer und werde dies durchsetzen, sobald sich die Chance dazu bietet. Durch Intrigen werde ich die Gruppe spalten und dem alten Anf�hrer das Zepter entreissen. Lang lebe der neue Anf�hrer !');
      Engine_setModifiers('ALIGN_LG:+1 ALIGN_LE:+2 ALIGN_NE:+1 ALIGN_CE:+1 RACE_HUMAN:+2 RACE_HALFLING:+1 RACE_DWARVE:+2 RACE_HALF-ORC:+1 RACE_GNOME:+1 CLASS_PALADIN:+1 CLASS_ROGUE:+2 CLASS_BARD:+1');
      Engine_addAnswer('Ich bin die linke Hand des Anf�hrers.<br /> Ich tue alles was er will, wie sein pers�nlicher Sklave. Zu ihm bin ich stets freundlich und diejenigen die unter mir stehen, werden leiden m�ssen.');
      Engine_setModifiers('CLASS_PALADIN:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+1');
      Engine_addAnswer('Ich bin der Maulwurf.<br /> Ich l�chle immer brav und ziehe bei jedem Plan mit, doch ich werde die Gruppe einen nach dem anderen t�ten und es wie Unf�lle aussehen lassen.');
      Engine_setModifiers('ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 CLASS_ROGUE:+2 CLASS_BARBAR:+1 CLASS_SORCERER:+1 CLASS_DRUID:-1');
    }
    {
      Engine_addQuestion('Womit w�rdest du dich <b>am liebsten</b> bekleiden ?');
      Engine_addAnswer('wohlhabend aussehende, modische Kleidung');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_DRUID:-2');
      Engine_addAnswer('Ist mir egal, hauptsache es erf�llt seinen Zweck wenn man auf Reisen ist.');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_MONK:+2 CLASS_ROGUE:+1 CLASS_RANGER+1');
      Engine_addAnswer('eine gl�nzende Metallr�stung');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_PALADIN:+2 CLASS_RANGER:+2 CLASS_CLERIC:+2 CLASS_SORCERER:-2 CLASS_WIZARD:-2 RACE_DWARVE:+1');
      Engine_addAnswer('abgenutzte Kleidung, wie viele andere B�rger auch');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_DRUID:+1');
      Engine_addAnswer('Roben, Umh�nge, Capes');
      Engine_setModifiers('CLASS_SORCERER:+2 CLASS_WIZARD:+2 CLASS_ROGUE:+1 RACE_DWARVE:-1 CLASS_FIGHTER:-2 CLASS_CLERIC:+1');
    }
    {
      Engine_addQuestion('Womit w�rdest du dich <b>am wenigsten gern</b> bekleiden ?');
      Engine_addAnswer('wohlhabend aussehende, modische Kleidung');
      Engine_setModifiers('CLASS_BARD:-2 CLASS_DRUID:+2');
      Engine_addAnswer('Ist mir egal, hauptsache es erf�llt seinen Zweck wenn man auf Reisen ist.');
      Engine_setModifiers('CLASS_DRUID:-2 CLASS_MONK:-2');
      Engine_addAnswer('eine gl�nzende Metallr�stung');
      Engine_setModifiers('CLASS_FIGHTER:-2 CLASS_PALADIN:-2 CLASS_RANGER:-2 CLASS_CLERIC:-2 CLASS_SORCERER:+2 CLASS_WIZARD:+2 RACE_DWARVE:-1');
      Engine_addAnswer('abgenutzte Kleidung, wie viele andere B�rger auch');
      Engine_setModifiers('CLASS_BARD:-2 CLASS_DRUID:-1');
      Engine_addAnswer('Roben, Umh�nge, Capes');
      Engine_setModifiers('CLASS_SORCERER:-2 CLASS_WIZARD:-2 CLASS_CLERIC:-1 CLASS_FIGHTER:+2 RACE_DWARVE:+1');
    }
    {
      Engine_addQuestion('Was ist deine <b>Lieblingsfarbe</b> ?');
      Engine_addAnswer('Rot');
      Engine_setModifiers('');
      Engine_addAnswer('Gr�n');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_RANGER:+2 CLASS_BARBAR:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_HUMAN:+2');
      Engine_addAnswer('Blau');
      Engine_setModifiers('RACE_HUMAN:+2 CLASS_CLERIC:+1 CLASS_ROGUE:+1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Weiss');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-1 CLASS_CLERIC:+2 ');
      Engine_addAnswer('Schwarz');
      Engine_setModifiers('ALIGN_NG:-1 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_CLERIC:+2 ');
      Engine_addAnswer('Grau');
      Engine_setModifiers('ALIGN_NN:+3 RACE_DWARVE:+3 CLASS_FIGHTER:+1 CLASS_ROGUE:+1 CLASS_BARD:-1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Gelb');
      Engine_setModifiers('CLASS_MONK:+1 ');
      Engine_addAnswer('Braun');
      Engine_setModifiers('CLASS_BARBAR:+2 CLASS_DRUID:+2 CLASS_RANGER:+1 ');
      Engine_addAnswer('Violett');
      Engine_setModifiers('');
      Engine_addAnswer('Rosa');
      Engine_setModifiers('RACE_ELF:+1 RACE_ORC:-3 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_BARBAR:-2 CLASS_PALADIN:-2 CLASS_BARD:+2 ');
      Engine_addAnswer('Orange');
      Engine_setModifiers('RACE_GNOME:+1 CLASS_MONK:+1 ');
      Engine_addAnswer('keine davon');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion('Welche Farbe magst du <b>am wenigstens</b> ?');
      Engine_addAnswer('Rot');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_BARBAR:-2 CLASS_DRUID:-1 ');
      Engine_addAnswer('Gr�n');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_DWARVE:+1 CLASS_FIGHTER:+1 CLASS_ROGUE:+2 CLASS_DRUID:-2 CLASS_RANGER:-2 ');
      Engine_addAnswer('Blau');
      Engine_setModifiers('RACE_HUMAN:-2 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Weiss');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_CLERIC:+2 ');
      Engine_addAnswer('Schwarz');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-2 ALIGN_LE:-1 ALIGN_CE:-1 ');
      Engine_addAnswer('Grau');
      Engine_setModifiers('ALIGN_NN:-1 RACE_GNOME:-1 RACE_DWARVE:-1 ');
      Engine_addAnswer('Gelb');
      Engine_setModifiers('CLASS_MONK:-1 ');
      Engine_addAnswer('Braun');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_BARBAR:-2 CLASS_DRUID:-1 ');
      Engine_addAnswer('Violett');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+3 CLASS_PALADIN:-1 CLASS_BARD:-2 ');
      Engine_addAnswer('Rosa');
      Engine_setModifiers('RACE_ORC:+3 RACE_HALF-ORC:+2 CLASS_BARD:-2 ');
      Engine_addAnswer('Orange');
      Engine_setModifiers('');
      Engine_addAnswer('keine davon');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion('Was w�rdest du an einer Universit�t <b>am liebsten</b> studieren ?');
      Engine_addAnswer('Philosophie, Religion');
      Engine_setModifiers('RACE_HUMAN:+1 CLASS_BARBAR:-2 CLASS_PALADIN:+2 CLASS_ROGUE:-1 CLASS_CLERIC:+2 CLASS_DRUID:-2 CLASS_MONK:+2 ');
      Engine_addAnswer('Thaumaturgie (Magie)');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:-2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 RACE_DWARVE:-2 CLASS_WIZARD:+2 CLASS_FIGHTER:-2 CLASS_BARBAR:-2 CLASS_CLERIC:+1 CLASS_SORCERER:+2 CLASS_BARD:+1 CLASS_SORCERER:+1 CLASS_MONK:-1 ');
      Engine_addAnswer('Biologie');
      Engine_setModifiers('RACE_ORC:-2 RACE_ELF:+2 RACE_GNOME:+1 RACE_HALF-ORC:-1 RACE_HALF-ELF:+1 CLASS_BARBAR:-2 CLASS_ROGUE:+1 CLASS_PALADIN:-2 CLASS_DRUID:+2 CLASS_RANGER:+1 CLASS_MONK:+2 ');
      Engine_addAnswer('Schwertkampf');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1 CLASS_FIGHTER:+2 CLASS_WIZARD:-2 CLASS_BARBAR:+2 CLASS_PALADIN:+1 CLASS_CLERIC:+1 CLASS_SORCERER:-2 CLASS_RANGER:+1 CLASS_MONK:-1 ');
      Engine_addAnswer('Musik');
      Engine_setModifiers('CLASS_FIGHTER:-1 CLASS_BARBAR:-2 CLASS_BARD:+2 ');
      Engine_addAnswer('Gastronomie, Kochen');
      Engine_setModifiers('RACE_ORC:+1 RACE_HALFLING:+2 CLASS_ROGUE:-2 CLASS_BARBAR:+2');
      Engine_addAnswer('Geologie');
      Engine_setModifiers('RACE_ELF:-2 RACE_GNOME:+2 RACE_HALF-ELF:-1 RACE_DWARVE:+2 CLASS_PALADIN:-2 CLASS_ROGUE:-1 ');
      Engine_addAnswer('Ingenieurswesen');
      Engine_setModifiers('RACE_ORC:-2 RACE_GNOME:+2 RACE_HALF-ORC:-1 CLASS_BARBAR:-2 CLASS_DRUID:-1 ');
      Engine_addAnswer('Sch�tze, Profit, Wirtschaft');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:-1 RACE_GNOME:+1 RACE_HALFLING:+2 RACE_DWARVE:+1 CLASS_WIZARD:+1 CLASS_BARBAR:-2 CLASS_ROGUE:+2 CLASS_DRUID:-2 CLASS_SORCERER:+1 CLASS_RANGER:-1 CLASS_MONK:-2 ');
      Engine_addAnswer('Ich w�rde nicht studieren, das ist was f�r Streber.');
      Engine_setModifiers('RACE_ORC:+3 RACE_HALF-ORC:+2 CLASS_BARBAR:+3 RACE_ELF:-2 RACE_HALF-ELF:-1 ');
    }
    {
      Engine_addQuestion('Welches dieser Themen sagt dir <b>am wenigsten</b> zu ?');
      Engine_addAnswer('Philosophie, Religion');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_FIGHTER:+2 CLASS_BARBAR:+2 CLASS_ROGUE:+1 CLASS_CLERIC:-2 CLASS_DRUID:+2 CLASS_MONK:-2 CLASS_BARD:-1 ');
      Engine_addAnswer('Thaumaturgie (Magie)');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:+2 RACE_HALF-ELF:-1 RACE_HALF-ORC:+1 RACE_DWARVE:+2 CLASS_FIGHTER:+2 CLASS_WIZARD:-2 CLASS_BARBAR:+2 CLASS_SORCERER:-2 ');
      Engine_addAnswer('Biologie');
      Engine_setModifiers('RACE_ELF:-1 RACE_ORC:+2 RACE_GNOME:-1 RACE_HALF-ORC:+1 CLASS_BARBAR:+2 CLASS_DRUID:-2 CLASS_RANGER:-1 CLASS_MONK:-2 ');
      Engine_addAnswer('Schwertkampf');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:-2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 RACE_DWARVE:-2 CLASS_CLERIC:-1 CLASS_DRUID:+1 CLASS_FIGHTER:+2 CLASS_WIZARD:+2 CLASS_BARBAR:-2 CLASS_PALADIN:+2 CLASS_SORCERER:+2 CLASS_MONK:+2 ');
      Engine_addAnswer('Musik');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1 CLASS_CLERIC:-1 CLASS_BARBAR:+2 CLASS_BARD:-2 ');
      Engine_addAnswer('Gastronomie, Kochen');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-2 CLASS_ROGUE:+2 ');
      Engine_addAnswer('Geologie');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:+1 RACE_GNOME:-2 RACE_HALF-ELF:+1 RACE_DWARVE:-2 CLASS_BARBAR:+1 ');
      Engine_addAnswer('Ingenieurswesen');
      Engine_setModifiers('RACE_ORC:+2 RACE_GNOME:-2 RACE_HALF-ORC:+1 RACE_HALFLING:-1 CLASS_BARBAR:+2 CLASS_DRUID:+2 CLASS_RANGER:+2 CLASS_MONK:+2 ');
      Engine_addAnswer('Sch�tze, Profit, Wirtschaft');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-2 CLASS_WIZARD:-1 CLASS_CLERIC:-1 CLASS_ROGUE:-2 CLASS_DRUID:+2 CLASS_MONK:+1 ');
    }
    {
      Engine_addQuestion('Welches Tier h�ttest du <b>am liebsten</b> als Haustier oder tierischen Begleiter ?');
      Engine_addAnswer('eine Katze');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NN:+1 CLASS_WIZARD:+2 CLASS_DRUID:+1 CLASS_SORCERER:+2 CLASS_RANGER:+1');
      Engine_addAnswer('einen Hund');
      Engine_setModifiers('ALIGN_NN:+2 ALIGN_LN:+1 ALIGN_CN:+1 RACE_HUMAN:+2 CLASS_FIGHTER:+1 CLASS_BARBAR:+1 CLASS_RANGER:+2 CLASS_DRUID:+1');
      Engine_addAnswer('einen Wolf');
      Engine_setModifiers('ALIGN_NN:+2 ALIGN_LN:+1 ALIGN_CN:+1 CLASS_DRUID:+2 CLASS_RANGER:+1 ');
      Engine_addAnswer('ein Pferd');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_DWARVE:-1 CLASS_FIGHTER:+2 CLASS_PALADIN:+1 CLASS_DRUID:+1 CLASS_RANGER:+1 ');
      Engine_addAnswer('einen Imp (kleiner Teufel)');
      Engine_setModifiers('ALIGN_NE:+2 ALIGN_LE:+2 ALIGN_CE:+2 CLASS_WIZARD:+2 CLASS_SORCERER:+2 CLASS_DRUID:-1');
      Engine_addAnswer('einen kleinen Drachen');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_LG:+1 ALIGN_CG:+1 CLASS_WIZARD:+2 CLASS_SORCERER:+2 ');
      Engine_addAnswer('ein Pixie (eine Fee)');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NN:+2 CLASS_DRUID:+2 CLASS_RANGER:+1');
      Engine_addAnswer('eine Ratte');
      Engine_setModifiers('RACE_GNOME:+2 RACE_DWARVE:+1 CLASS_BARBAR:+1 CLASS_ROGUE:+2 CLASS_DRUID:+1 ');
      Engine_addAnswer('eine Eule');
      Engine_setModifiers('ALIGN_NN:+2 CLASS_WIZARD:+2 CLASS_DRUID:+2 CLASS_SORCERER:+2 CLASS_RANGER:+1 ');
      Engine_addAnswer('einen Raben');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 CLASS_WIZARD:+2 CLASS_DRUID:+1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('etwas anderes');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion('Welches Tier h�ttest du <b>auch gern</b> als Haustier oder tierischen Begleiter ?');
      Engine_addAnswer('eine Katze');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+1 ALIGN_CG:+1 CLASS_WIZARD:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('einen Hund');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_LN:+1 ALIGN_CN:+1 CLASS_FIGHTER:+1 CLASS_RANGER:+1 RACE_HUMAN:+1');
      Engine_addAnswer('einen Wolf');
      Engine_setModifiers('ALIGN_NN:+1 CLASS_DRUID:+1 ');
      Engine_addAnswer('ein Pferd');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_PALADIN:+1 CLASS_RANGER:+1 RACE_HUMAN:+1');
      Engine_addAnswer('einen Imp (kleiner Teufel)');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_WIZARD:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('einen kleinen Drachen');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_WIZARD:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('ein Pixie (eine Fee)');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+1 ALIGN_CG:+1 CLASS_DRUID:+1 ');
      Engine_addAnswer('eine Ratte');
      Engine_setModifiers('RACE_GNOME:+1 RACE_DWARVE:+1 CLASS_ROGUE:+1 ');
      Engine_addAnswer('eine Eule');
      Engine_setModifiers('CLASS_DRUID:+1 CLASS_RANGER:+1 ALIGN_NN:+1');
      Engine_addAnswer('einen Raben');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+1 CLASS_WIZARD:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('etwas anderes');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion('Welches davon h�ttest du <b>am wenigsten gern</b> als Haustier oder tierischen Begleiter ?');
      Engine_addAnswer('eine Katze');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NN:-1 CLASS_WIZARD:-2 CLASS_DRUID:-1 CLASS_SORCERER:-2 ');
      Engine_addAnswer('einen Hund');
      Engine_setModifiers('RACE_HUMAN:-1 CLASS_PALADIN:-1 CLASS_DRUID:-1 CLASS_RANGER:-1 ');
      Engine_addAnswer('einen Wolf');
      Engine_setModifiers('ALIGN_NN:-1 CLASS_DRUID:-2 CLASS_RANGER:-1 ');
      Engine_addAnswer('ein Pferd');
      Engine_setModifiers('RACE_HUMAN:-1 CLASS_FIGHTER:-2 CLASS_PALADIN:-1 CLASS_RANGER:-2 CLASS_DRUID:-1');
      Engine_addAnswer('einen Imp (kleiner Teufel)');
      Engine_setModifiers('ALIGN_NE:-2 ALIGN_LE:-2 ALIGN_CE:-2 CLASS_WIZARD:-2 CLASS_SORCERER:-2 CLASS_DRUID:+1');
      Engine_addAnswer('einen kleinen Drachen');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 CLASS_WIZARD:-2 CLASS_SORCERER:-2 ');
      Engine_addAnswer('ein Pixie (eine Fee)');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 CLASS_DRUID:-2 ');
      Engine_addAnswer('eine Ratte');
      Engine_setModifiers('RACE_GNOME:-1 RACE_DWARVE:-1 CLASS_ROGUE:-2 ');
      Engine_addAnswer('eine Eule');
      Engine_setModifiers('CLASS_WIZARD:-1 CLASS_DRUID:-2 CLASS_SORCERER:-1 CLASS_RANGER:-1 ALIGN_NN:-1');
      Engine_addAnswer('einen Raben');
      Engine_setModifiers('ALIGN_NN:-1 ALIGN_NE:-2 ALIGN_LE:-1 ALIGN_CE:-1 CLASS_WIZARD:-2 CLASS_SORCERER:-2 CLASS_RANGER:-1 CLASS_DRUID:-1');
      Engine_addAnswer('etwas anderes');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion('W�hrend du an einer Schlucht entlangl�ufst, siehst du wie 100m unter dir eine alte Frau �berfallen wird. Was tust du ?');
      Engine_addAnswer('Ich t�te alle, einschliesslich der alten Frau und suche nach wertvollem.');
      Engine_setModifiers('ALIGN_NG:-3 ALIGN_LG:-2 ALIGN_CG:-3 ALIGN_NE:+3 ALIGN_LE:+1 ALIGN_CE:+2 RACE_ORC:+3 RACE_HALF-ORC:+2 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich schau auf die Uhr und messe wie lange die R�uber brauchen.');
      Engine_setModifiers('ALIGN_NN:+3 ALIGN_LN:+1 ALIGN_CN:+2 CLASS_PALADIN:-3 CLASS_ROGUE:+2 ');
      Engine_addAnswer('Ich t�te die Angreifer und rette die Frau.');
      Engine_setModifiers('');
      Engine_addAnswer('Ich ignoriere das alles und mache mich wieder auf den Weg.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-3 ALIGN_CG:-1 ALIGN_NN:+2 ');
      Engine_addAnswer('Ich versuche die Angreifer davon zu �berzeugen, dass mein Gott das nicht gut findet und man das auch friedlich l�sen kann.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+3 ALIGN_CG:+1 CLASS_BARBAR:-3 CLASS_PALADIN:+1 CLASS_CLERIC:+3 CLASS_ROGUE:-1 CLASS_DRUID:-1 ');
      Engine_addAnswer('Ich rufe hinunter, dass Verst�rkung im Anmarsch ist, begebe mich aber nicht selbst in Gefahr.');
      Engine_setModifiers('ALIGN_NN:+3 ALIGN_LN:+1 ALIGN_CN:+1 ALIGN_NE:+1 CLASS_WIZARD:+1 CLASS_ROGUE:+1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Ich bete f�r die Seele der Frau.');
      Engine_setModifiers('ALIGN_NG:+3 ALIGN_LG:+1 ALIGN_NN:+2 CLASS_CLERIC:+3 CLASS_MONK:+2 ');
      Engine_addAnswer('Ich schliesse mich den Angreifern an.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+3 ALIGN_LE:+1 ALIGN_CE:+2 RACE_DWARVE:+3 CLASS_FIGHTER:+3 CLASS_PALADIN:+1 ');
    }
    {
      Engine_addQuestion('Was w�rdest du in einer Taverne <b>am ehesten</b> bestellen ?');
      Engine_addAnswer('Wein und K�se');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_GNOME:+1 ');
      Engine_addAnswer('Brot und Ale');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_DWARVE:-2 ');
      Engine_addAnswer('Fleisch und Bier');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_DWARVE:+2 ');
      Engine_addAnswer('Suppe und Salat');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_RANGER:+1 CLASS_MONK:+1 ');
      Engine_addAnswer('Ein Kind und etwas Blutwein');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:+2 RACE_HALF-ELF:-1 RACE_HALF-ORC:+1 CLASS_BARBAR:+2 CLASS_PALADIN:-2 ');
      Engine_addAnswer('Eine Frau oder einen jungen Burschen, sowie ein Zimmer');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_HALFLING:+1 CLASS_PALADIN:-2 CLASS_CLERIC:-1 CLASS_MONK:-2 ');
      Engine_addAnswer('Ich m�chte nur ein paar Informationen �ber den Ort und den dem er geh�rt.');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 CLASS_ROGUE:+2 CLASS_BARD:+1 ');
    }
    {
      Engine_addQuestion('Was w�rdest du in einer Taverne <b>wohl eher nicht</b> bestellen ?');
      Engine_addAnswer('Wein und K�se');
      Engine_setModifiers('RACE_HUMAN:-1 RACE_GNOME:-1 ');
      Engine_addAnswer('Brot und Ale');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_DWARVE:+2 ');
      Engine_addAnswer('Fleisch und Bier');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_DWARVE:-2 ');
      Engine_addAnswer('Suppe und Salat');
      Engine_setModifiers('CLASS_DRUID:-2 CLASS_RANGER:-1 CLASS_MONK:-1 ');
      Engine_addAnswer('Ein Kind und etwas Blutwein');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:-2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 CLASS_BARBAR:-2 CLASS_PALADIN:+2 ');
      Engine_addAnswer('Eine Frau oder einen jungen Burschen, sowie ein Zimmer');
      Engine_setModifiers('RACE_HUMAN:-2 RACE_HALFLING:-1 CLASS_PALADIN:+2 CLASS_CLERIC:+1 CLASS_MONK:+2 ');
      Engine_addAnswer('Ich m�chte nur ein paar Informationen �ber den Ort und den dem er geh�rt.');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 CLASS_ROGUE:-2 CLASS_BARD:-1 ');
    }
    {
      Engine_addQuestion('Mit welcher der folgenen Personengruppen w�rdest du dich <b>am ehesten</b> abgeben ?');
      Engine_addAnswer('Anw�lte, Politiker, Gesch�ftsm�nner');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_WIZARD:+2 CLASS_DRUID:-3 CLASS_RANGER:-1 ');
      Engine_addAnswer('Priester, Pfarrer');
      Engine_setModifiers('ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-2 RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_PALADIN:+1 CLASS_CLERIC:+2 CLASS_ROGUE:-2 CLASS_MONK:+2 ');
      Engine_addAnswer('Minderheiten, Untergebene');
      Engine_setModifiers('RACE_HALF-ELF:+3 RACE_HALF-ORC:+3 CLASS_WIZARD:+1 CLASS_ROGUE:+2 CLASS_DRUID:+1 CLASS_SORCERER:+3 ');
      Engine_addAnswer('Sklaven');
      Engine_setModifiers('RACE_ELF:-3 RACE_ORC:+2 RACE_HALF-ELF:-1 RACE_HALF-ORC:+1 CLASS_WIZARD:-1 CLASS_BARBAR:+3 CLASS_PALADIN:+1 CLASS_CLERIC:-1 CLASS_MONK:-1 ');
      Engine_addAnswer('K�nstler, Dichter, Autoren');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:-3 RACE_HALF-ELF:+1 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_WIZARD:+1 CLASS_BARBAR:-2 CLASS_BARD:+3 ');
      Engine_addAnswer('Reisende, H�ndler');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_GNOME:+2 RACE_HALFLING:+1 RACE_DWARVE:-1 CLASS_ROGUE:+2 CLASS_BARD:+1 ');
      Engine_addAnswer('Stammkunden in der Taverne');
      Engine_setModifiers('RACE_ELF:-2 RACE_DWARVE:+3 ');
      Engine_addAnswer('Mit mir, mich selbst und nur mir.');
      Engine_setModifiers('CLASS_ROGUE:-1 CLASS_BARD:-2 CLASS_DRUID:+1 CLASS_SORCERER:+1 CLASS_MONK:+3 ');
    }
    {
      Engine_addQuestion('Mit welcher der folgenen Personengruppen w�rdest du dich <b>am wenigsten</b> abgeben ?');
      Engine_addAnswer('Anw�lte, Politiker, Gesch�ftsm�nner');
      Engine_setModifiers('CLASS_FIGHTER:-1 CLASS_WIZARD:-2 CLASS_DRUID:+3 CLASS_RANGER:+1 ');
      Engine_addAnswer('Priester, Pfarrer');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_PALADIN:-1 CLASS_CLERIC:-2 CLASS_ROGUE:+2 CLASS_MONK:-2 ');
      Engine_addAnswer('Minderheiten, Untergebene');
      Engine_setModifiers('RACE_HALF-ELF:-3 RACE_HALF-ORC:-3 CLASS_WIZARD:-1 CLASS_ROGUE:-2 CLASS_DRUID:-1 CLASS_SORCERER:-3 ');
      Engine_addAnswer('Sklaven');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 CLASS_WIZARD:+1 CLASS_BARBAR:-1 CLASS_PALADIN:-1 CLASS_CLERIC:+1 CLASS_MONK:+1 ');
      Engine_addAnswer('K�nstler, Dichter, Autoren');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:+3 RACE_HALF-ELF:-1 RACE_HALF-ORC:+2 RACE_DWARVE:+1 CLASS_WIZARD:-1 CLASS_BARBAR:+2 CLASS_BARD:-3 ');
      Engine_addAnswer('Reisende, H�ndler');
      Engine_setModifiers('RACE_HUMAN:-2 RACE_GNOME:-2 RACE_HALFLING:-1 RACE_DWARVE:+1 CLASS_ROGUE:-2 CLASS_BARD:-1 ');
      Engine_addAnswer('Stammkunden in der Taverne');
      Engine_setModifiers('RACE_ELF:+2 RACE_DWARVE:-3 ');
      Engine_addAnswer('Mit mir, mich selbst und nur mir.');
      Engine_setModifiers('CLASS_ROGUE:+1 CLASS_BARD:+2 CLASS_DRUID:-1 CLASS_SORCERER:+1 CLASS_MONK:-3 ');
    }
    {
      Engine_addQuestion('Was tust du wenn dir jemand einen Streich spielt ?');
      Engine_addAnswer('Ich lache; ein wenig Spass muss sein !');
      Engine_setModifiers('ALIGN_NN:+2 RACE_HUMAN:+2 RACE_GNOME:+5 RACE_HALF-ELF:+1 RACE_DWARVE:+2 CLASS_BARBAR:+2 ');
      Engine_addAnswer('Ich ignoriere ihn, das ist unter meinem Niveau.');
      Engine_setModifiers('CLASS_DRUID:+1 CLASS_MONK:+2 ');
      Engine_addAnswer('Das zahl ich ihm zur�ck, aber auf eine freundliche Art und Weise.<br/> (das k�nnte auch heissen, dass ich ihn bestehle)');
      Engine_setModifiers('RACE_HALFLING:+2 CLASS_FIGHTER:-1 CLASS_WIZARD:-2 CLASS_BARBAR:-2 CLASS_PALADIN:-3 CLASS_CLERIC:-3 CLASS_ROGUE:+3 CLASS_BARD:+2 CLASS_DRUID:-3 CLASS_SORCERER:-1 CLASS_RANGER:-1 ');
      Engine_addAnswer('Ich kenne die selben Leute wie er und werde ihn subtil dem�tigen.');
      Engine_setModifiers('CLASS_BARBAR:-3 CLASS_PALADIN:-2 CLASS_ROGUE:+2 CLASS_SORCERER:+3 ');
      Engine_addAnswer('Ich werde dem Dreckskerl weh tun.');
      Engine_setModifiers('RACE_ELF:-1 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+3 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich T�te den Bastard.');
      Engine_setModifiers('ALIGN_CN:+1 ALIGN_CE:+2 RACE_ELF:-2 RACE_ORC:+3 RACE_HALF-ELF:-1 RACE_HALF-ORC:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 ');
    }
    {
      Engine_addQuestion('Man gibt dir einige Millionen Goldm�nzen was w�rdest du damit tun ?');
      Engine_addAnswer('Einkaufen !');
      Engine_setModifiers('CLASS_ROGUE:+2 ');
      Engine_addAnswer('Ich stifte das Geld einem wohlt�tigen Zweck.');
      Engine_setModifiers('CLASS_PALADIN:+2 ');
      Engine_addAnswer('Ich investiere es in Immobilien oder Gesch�fte.');
      Engine_setModifiers('CLASS_CLERIC:+2 ');
      Engine_addAnswer('Ich lege es in Aktien, Fonds oder Wertpapiere an und lebe von den Zinsen und Gewinnen.');
      Engine_setModifiers('CLASS_WIZARD:+2 ');
      Engine_addAnswer('Ich mach eine eigenes Gesch�ft auf.');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Ich bringe das Geld in eienn Tempel oder zu einer Kirche.');
      Engine_setModifiers('CLASS_PALADIN:+1 CLASS_CLERIC:+2 CLASS_ROGUE:-2 CLASS_DRUID:-2 CLASS_RANGER:-1 ');
    }
    {
      Engine_addQuestion('Du gibst eine Party. Was ist dir dabei <b>am wichtigesten</b> ?');
      Engine_addAnswer('Essen und Trinken');
      Engine_setModifiers('RACE_ORC:+2 RACE_GNOME:+2 RACE_HALF-ORC:+1 RACE_HALFLING:+3 RACE_DWARVE:+2 CLASS_BARBAR:+2 ');
      Engine_addAnswer('Dekoration');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:+3 RACE_ORC:-3 RACE_HALF-ELF:+2 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_BARBAR:-2 CLASS_BARD:+1 ');
      Engine_addAnswer('Unterhaltung');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_GNOME:+3 RACE_HALFLING:+1 CLASS_BARD:+3 ');
      Engine_addAnswer('Geschenke');
      Engine_setModifiers('RACE_GNOME:+2 RACE_HALFLING:+3 CLASS_ROGUE:+3 CLASS_DRUID:-3 CLASS_RANGER:-1 CLASS_MONK:-2 ');
      Engine_addAnswer('Ich will eine Ein-Mann Party mit mir allein.');
      Engine_setModifiers('RACE_HUMAN:-1 RACE_GNOME:+1 CLASS_ROGUE:-2 CLASS_BARD:-3 CLASS_DRUID:+1 CLASS_SORCERER:+1 CLASS_MONK:+3 ');
      Engine_addAnswer('Im Wald macht man keine Parties !');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 CLASS_BARBAR:+1 CLASS_DRUID:+2 CLASS_RANGER:+1 ');
    }
    {
      Engine_addQuestion('Du gibst eine Party. Was ist dir dabei <b>am unwichtigesten</b> ?');
      Engine_addAnswer('Essen und Trinken');
      Engine_setModifiers('RACE_ORC:-1 RACE_HALFLING:-2 RACE_DWARVE:-1 CLASS_FIGHTER:-1 CLASS_BARBAR:-1 ');
      Engine_addAnswer('Dekoration');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 CLASS_WIZARD:-1 CLASS_BARD:-1 ');
      Engine_addAnswer('Unterhaltung');
      Engine_setModifiers('CLASS_BARD:-2 ');
      Engine_addAnswer('Geschenke');
      Engine_setModifiers('RACE_HUMAN:-1 RACE_HALFLING:-2 CLASS_FIGHTER:+2 CLASS_PALADIN:+1 CLASS_ROGUE:-2 CLASS_RANGER:+1 CLASS_MONK:+1 ');
      Engine_addAnswer('Alles, hauptsache ich habe G�ste.');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_BARD:-1 CLASS_RANGER:+2 ');
      Engine_addAnswer('Ich sagte doch, dass mich Parties nicht interessieren !');
      Engine_setModifiers('CLASS_DRUID:+3 CLASS_MONK:+3 ');
    }
    {
      Engine_addQuestion('Ein richtiger Abenteurer muss f�r dich so aussehen:');
      Engine_addAnswer('gl�nzende R�stung, strahlendes Haar, athletischer K�rper');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-1 RACE_HALF-ELF:+1 RACE_DWARVE:-1 CLASS_FIGHTER:+1 CLASS_WIZARD:-2 CLASS_PALADIN:+3 CLASS_SORCERER:-2 CLASS_RANGER:+1 ');
      Engine_addAnswer('dicke Plattenr�stung, �lverschmiertes Gesicht, Bart');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_DWARVE:+3 CLASS_FIGHTER:+3 CLASS_WIZARD:-2 CLASS_DRUID:-3 CLASS_SORCERER:-2 ');
      Engine_addAnswer('jeder ist ein Abenteurer, denn das ganze Leben ist ein Abenteuer');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_PALADIN:+1 CLASS_CLERIC:+2 CLASS_BARD:+1 ');
      Engine_addAnswer('zerrissene Kleidung, Narben, frische Wunden');
      Engine_setModifiers('RACE_ELF:-3 RACE_ORC:+3 RACE_HALF-ELF:-2 RACE_HALF-ORC:+2 CLASS_WIZARD:-3 CLASS_BARBAR:+3 CLASS_PALADIN:-3 CLASS_DRUID:+1 CLASS_SORCERER:-3 CLASS_RANGER:+1 ');
      Engine_addAnswer('modisch gekleidet, mit einem Stab und einer Robe');
      Engine_setModifiers('RACE_HALF-ELF:+3 CLASS_FIGHTER:-2 CLASS_WIZARD:+3 CLASS_BARBAR:-3 CLASS_CLERIC:+1 CLASS_DRUID:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Abenteurer erkennt man nicht am �usseren, doch ihre Augen erz�hlen Geschichten');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_BARD:+3 CLASS_DRUID:+1 ');
      Engine_addAnswer('schlank, sehnig, sch�n und anmutig');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-3 RACE_HALF-ELF:+2 RACE_HALF-ORC:-2 RACE_DWARVE:-2 CLASS_FIGHTER:+1 CLASS_WIZARD:+1 CLASS_BARBAR:-3 CLASS_PALADIN:+1 CLASS_CLERIC:+1 CLASS_BARD:+1 CLASS_DRUID:+1 CLASS_SORCERER:+1 CLASS_RANGER:+1 ');
      Engine_addAnswer('dick, fett, kr�ftig mit einer b�rentiefen Stimme');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:+3 RACE_HALF-ORC:+2 RACE_DWARVE:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 CLASS_DRUID:+1 ');
      Engine_addAnswer('wie jeder andere Reisende auch');
      Engine_setModifiers('CLASS_WIZARD:-1 CLASS_BARBAR:-2 CLASS_PALADIN:-2 CLASS_ROGUE:+3 CLASS_DRUID:+2 CLASS_SORCERER:-2 ');
      Engine_addAnswer('kahlk�pfig mit starken H�nden und irgendwie weise');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_WIZARD:-1 CLASS_BARBAR:-3 CLASS_SORCERER:-1 CLASS_MONK:+3 ');
      Engine_addAnswer('irgendwie anders');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_HALF-ELF:+2 RACE_HALF-ORC:+2 CLASS_ROGUE:+1 CLASS_DRUID:+3 CLASS_SORCERER:+3 ');
    }
    {
      Engine_addQuestion('Freundschaften sind f�r dich ?');
      Engine_addAnswer('sehr profitabel');
      Engine_setModifiers('RACE_ELF:-2 CLASS_ROGUE:+2 ');
      Engine_addAnswer('wichtig, denn man kann sich auf seine Freunde verlassen');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_DWARVE:+1 CLASS_ROGUE:-1 CLASS_BARD:+2 CLASS_DRUID:-1 ');
      Engine_addAnswer('ein notwendiges �bel');
      Engine_setModifiers('RACE_ELF:-1 RACE_HALF-ELF:-1 CLASS_ROGUE:+1 CLASS_BARD:-1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('ich kann davon nie genug bekommen');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ORC:+1 CLASS_ROGUE:-1 CLASS_BARD:+2 CLASS_DRUID:-1 CLASS_SORCERER:-2 CLASS_RANGER:-1 ');
      Engine_addAnswer('ich brauche keine Freunde');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+1 RACE_HUMAN:-1 RACE_HALFLING:-1 CLASS_DRUID:+2 CLASS_SORCERER:+1 CLASS_RANGER:+1 ');
    }
    {
      Engine_addQuestion('Wieviele Freunde hast du ?');
      Engine_addAnswer('keinen einzigen');
      Engine_setModifiers('RACE_HUMAN:-1 RACE_ELF:-1 RACE_GNOME:-1 RACE_HALFLING:-2 CLASS_BARD:-2 CLASS_DRUID:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('ein bis zwei');
      Engine_setModifiers('RACE_HUMAN:+3 RACE_ELF:+2 CLASS_ROGUE:+1 CLASS_BARD:-1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('nur Kumpel - keine echten Freunde');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:+3 RACE_HALF-ELF:-1 RACE_HALF-ORC:+2 CLASS_BARBAR:-1 CLASS_BARD:+2 ');
      Engine_addAnswer('eine Clique');
      Engine_setModifiers('RACE_HUMAN:+2 CLASS_WIZARD:+2 ');
      Engine_addAnswer('jeder ist ein Freund f�r mich');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+1 CLASS_ROGUE:-1 CLASS_BARD:+3 ');
    }
    {
      Engine_addQuestion('Du hast dich zum Turm einer eingesperrten und mit Handschellen gefesselten Prinzessin durchgek�mpft. Was nun ?');
      Engine_addAnswer('Ich wollte nur sehen ob ich es bis hierhin schaffe, jetzt gehe ich wieder.');
      Engine_setModifiers('ALIGN_LN:-1 ALIGN_CN:+1 RACE_HUMAN:+1 RACE_HALFLING:+2 RACE_DWARVE:-1 CLASS_PALADIN:-2 CLASS_ROGUE:+2 CLASS_BARD:-1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Ich befreie die Prinzessin und heirate sie.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-1 CLASS_FIGHTER:+1 CLASS_BARBAR:+1 CLASS_PALADIN:+1 ');
      Engine_addAnswer('Ich befreie sie und bringe sie ihrem Vater zur�ck - Auftrag erledigt.');
      Engine_setModifiers('');
      Engine_addAnswer('Ich vergewaltige, t�te oder esse sie.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 RACE_ELF:-3 RACE_ORC:+3 RACE_HALF-ELF:-2 RACE_HALF-ORC:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 ');
      Engine_addAnswer('Ich finde sie h�sslich und h�tte lieber einen Prinzen gerettet.');
      Engine_setModifiers('RACE_ORC:-1 CLASS_BARBAR:-1 CLASS_PALADIN:-2 CLASS_ROGUE:+1 CLASS_BARD:+2 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Ich unterhalte mich mit ihr �ber Mode, Schmuck, Trends und M�nner.');
      Engine_setModifiers('CLASS_BARBAR:-3 CLASS_BARD:+1 ');
      Engine_addAnswer('Ich lasse die Prinzessin angekettet und suche nach dem Schatz.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 ALIGN_NE:+2 ALIGN_LE:+2 ALIGN_CE:+2 CLASS_ROGUE:+3 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Ich lasse sie gefesselt, schlage sie K.O. und bringe sie dann zu ihrem Vater zur�ck.');
      Engine_setModifiers('RACE_ELF:-1 RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1 CLASS_FIGHTER:+3 CLASS_BARBAR:+2 ');
      Engine_addAnswer('Ich stelle sie vor die Wahl mich zu heiraten oder hier angekettet zu bleiben.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:-1 RACE_ORC:+1 CLASS_BARBAR:+1 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich behalte die Prinzessin als Geisel, bewache den Turm und t�te jeden Eindringling.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+2 CLASS_FIGHTER:+2 CLASS_BARBAR:+1 CLASS_PALADIN:-2 CLASS_ROGUE:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Sie muss mir ihren ersten Sohn versprechen, dann befreie ich sie.');
      Engine_setModifiers('RACE_ORC:+1 CLASS_FIGHTER:+2 CLASS_PALADIN:-1 ');
    }
    {
      Engine_addQuestion('Wie lang muss ein Leben f�r dich mindestens sein ?');
      Engine_addAnswer('50-100 Jahre');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:-3 RACE_ORC:+3 RACE_GNOME:-1 RACE_HALF-ELF:-2 RACE_HALF-ORC:+2 RACE_HALFLING:+2 RACE_DWARVE:-1 ');
      Engine_addAnswer('100-150 Jahre');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:-2 RACE_GNOME:+2 RACE_HALF-ELF:+3 RACE_HALF-ORC:-1 RACE_HALFLING:+1 ');
      Engine_addAnswer('150-350 Jahre');
      Engine_setModifiers('RACE_HUMAN:-2 RACE_ELF:-1 RACE_ORC:-3 RACE_GNOME:-1 RACE_HALF-ELF:-1 RACE_HALF-ORC:-2 RACE_HALFLING:-1 RACE_DWARVE:+2 ');
      Engine_addAnswer('mehr als 350 Jahre');
      Engine_setModifiers('RACE_HUMAN:-3 RACE_ELF:+3 RACE_ORC:-3 RACE_GNOME:-2 RACE_HALF-ELF:-2 RACE_HALF-ORC:-3 RACE_HALFLING:-2 RACE_DWARVE:-1 ');
    }
    {
      Engine_addQuestion('Wie wichtig ist k�rperliche Gr�sse f�r dich ?');
      Engine_addAnswer('Ich hab ein grosses Problem damit klein zu sein.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ORC:+3 RACE_GNOME:-3 RACE_HALF-ORC:+2 RACE_HALFLING:-2 RACE_DWARVE:-2 ');
      Engine_addAnswer('Es ist mir egal ob ich klein bin. die Leute werden mich nach dem was ich sage und tue beurteilen und nicht nach meiner Gr�sse.');
      Engine_setModifiers('RACE_ORC:-2 RACE_GNOME:+2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 RACE_HALFLING:+3 RACE_DWARVE:+2 ');
      Engine_addAnswer('Ich bin gerne klein, dass hat auch seine Vorteile.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:-3 RACE_GNOME:+3 RACE_HALF-ORC:-2 RACE_HALFLING:+3 RACE_DWARVE:+2 CLASS_BARBAR:-1 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich bin so gross wie der Durschnitt. Um ehrlich zu sein: Es gibt wichtigere Dinge, �ber die man nachdenken sollte.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 ');
      Engine_addAnswer('Alles ist mir recht, Solange ich nicht wie der Durchschnitt aussehe.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:+1 RACE_HALF-ELF:+1 ');
      Engine_addAnswer('Gross oder nicht - das spielt doch keine Rolle.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+3 RACE_ORC:-2 RACE_HALF-ELF:+2 RACE_HALF-ORC:-1 RACE_DWARVE:+1 ');
      Engine_addAnswer('Ich hab ein Problem damit besonders gross zu sein.');
      Engine_setModifiers('RACE_ORC:-3 RACE_GNOME:+2 RACE_HALF-ORC:-2 RACE_HALFLING:+2 ');
      Engine_addAnswer('Je gr�sser desto besser.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ORC:+3 RACE_GNOME:-2 RACE_HALF-ORC:+2 RACE_HALFLING:-1 RACE_DWARVE:-1 CLASS_BARBAR:+2 CLASS_ROGUE:-1 ');
    }
    /*
    {
      Engine_addQuestion('Du findest einen Sack voll Gold auf der Strasse. Was tust du ?');
      Engine_addAnswer('');
      Engine_setModifiers('ALIGN_LG:+2 ');
      Engine_addAnswer('');
      Engine_setModifiers('');
    }
    {
      Engine_addQuestion(' ?');
      Engine_addAnswer('');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:-1 ALIGN_NN:+2 ALIGN_LN:-2 ALIGN_NE:+3 ALIGN_LE:-3 RACE_HUMAN:+4 RACE_ELF:-4 ');
      Engine_addAnswer('');
      Engine_setModifiers('');
    }
    */
    if (!thisFileIsPublic) boolLocal=true;
  }
  if (thisFileIsPublic) document.write('<script type="text/JavaScript" language="JavaScript" src="C:\\tmpQuestions.js"></script>');
}