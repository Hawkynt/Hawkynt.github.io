{
  var thisFileIsPublic=true;
  if ((thisFileIsPublic) || (Engine_getVersion()<="v2.2d"))
  {
    Engine_clearQuestions();
    {
      Engine_addQuestion('Wo fühlst du dich am wohlsten ?');
      Engine_addAnswer('In einer großen Stadt voller Leben.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:-2 RACE_ORC:-2 RACE_GNOME:+1 RACE_HALF-ELF:-1 RACE_HALF-ORC:-1 RACE_HALFLING:+2 RACE_DWARVE:-2 CLASS_FIGHTER:+1 CLASS_BARBAR:-1 CLASS_CLERIC:+1 CLASS_ROGUE:+2 CLASS_BARD:+1 CLASS_DRUID:-2 CLASS_SORCERER:+2 CLASS_RANGER:-2 ');
      Engine_addAnswer('Hinter den schützenden Mauern einer Kirche.');
      Engine_setModifiers('CLASS_DRUID:-1 CLASS_CLERIC:+2 CLASS_MONK:+2 CLASS_PALADIN:+1 CLASS_ROGUE:-1');
      Engine_addAnswer('In der Nähe von mächtigen, eindrucksvollen Bergen.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-1 RACE_DWARVE:+2');
      Engine_addAnswer('In einer Bibliothek voller interessanter Bücher.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_ORC:-3 RACE_GNOME:+1 RACE_HALF-ELF:+1 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_WIZARD:+2 CLASS_CLERIC:+1 CLASS_DRUID:-1 CLASS_SORCERER:+1 CLASS_RANGER:-1 ');
      Engine_addAnswer('Auf einer sonnigen Lichtung im Herzen eines lebendigen Waldes.');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_ORC:+1 RACE_HALFLING:-1 RACE_GNOME:-1 RACE_DWARVE:-2 CLASS_DRUID:+2 CLASS_RANGER:+2 CLASS_BARBAR:+1 CLASS_BARD:-1 CLASS_ROGUE:-1');
      Engine_addAnswer('An einem abendlichen Strand mit rauschenden Wellen.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_HALF-ELF:+1 CLASS_MONK:+2 CLASS_SORCERER:+1 CLASS_BARD:+1 CLASS_ROGUE:-1');
    }
    {
      Engine_addQuestion('Wo fühlst du dich am unwohlsten ?');
      Engine_addAnswer('In einer großen Stadt.');
      Engine_setModifiers('RACE_HUMAN:-2 RACE_HALF-ELF:+1 RACE_ELF:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-2 RACE_GNOME:-1 RACE_DWARVE:+2 CLASS_BARBAR:+1 CLASS_BARD:-1 CLASS_DRUID:+2 CLASS_SORCERER:-2 CLASS_FIGHTER:-1 CLASS_CLERIC:-1 CLASS_ROGUE:-2 CLASS_RANGER:+2');
      Engine_addAnswer('Hinter den Mauern einer Kirche.');
      Engine_setModifiers('CLASS_DRUID:+1 CLASS_CLERIC.-2 CLASS_MONK:-2 CLASS_PALADIN:-1 CLASS_ROGUE:+1');
      Engine_addAnswer('In der Nähe von Bergen.');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 RACE_HALFLING:+1 RACE_DWARVE:-2');
      Engine_addAnswer('In einer Bibliothek.');
      Engine_setModifiers('RACE_ORC:+3 RACE_HALF-ORC:+2 RACE_DWARVE:+1 RACE_GNOME:-1 RACE_ELF:-2 RACE_HALF-ELF:-1 CLASS_DRUID:+1 CLASS_BARBAR:+2 CLASS_FIGHTER:+1 CLASS_RANGER+1 CLASS_WIZARD:-2 CLASS_SORCERER:-1 CLASS_CLERIC:-1');
      Engine_addAnswer('Auf einer Waldlichtung.');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_ORC:-1 RACE_HALFLING:+1 RACE_GNOME:+1 RACE_DWARVE:+2 CLASS_DRUID:-2 CLASS_RANGER:-2 CLASS_BARBAR:-1 CLASS_BARD:+1 CLASS_ROGUE:+1');
      Engine_addAnswer('An einem abendlichen Strand.');
      Engine_setModifiers('CLASS_MONK:-2 CLASS_SORCERER:-1 CLASS_BARD:-1 CLASS_ROGUE:-1');
    }
    {
      Engine_addQuestion('Welcher dieser Berufe würde am ehesten zu dir passen ?');
      Engine_addAnswer('Arzt.');
      Engine_setModifiers('ALIGN_LG:+2 CLASS_CLERIC:+2 CLASS_DRUID:+2 CLASS_RANGER+1 CLASS_PALADIN:+1 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_ROGUE:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1');
      Engine_addAnswer('Sänger.');
      Engine_setModifiers('ALIGN_NG:+1 CLASS_BARD:+3 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:-1 CLASS_WIZARD:-1 CLASS_ROGUE:-2');
      Engine_addAnswer('Lehrer.');
      Engine_setModifiers('ALIGN_NG:+1 CLASS_BARD:+1 CLASS_BARBAR:-2 CLASS_FIGHTER:-2 CLASS_SORCERER:+1 CLASS_WIZARD:+2 CLASS_ROGUE:-2 CLASS_MONK:+1 CLASS_DRUID:+2');
      Engine_addAnswer('Auftragskiller.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+2 ALIGN_CE:+1 ALIGN_NG:-2 CLASS_BARBAR:+2 CLASS_FIGHTER:+2 CLASS_ROGUE:+2 CLASS_MONK:+2 CLASS_SORCERER:+1 CLASS_WIZARD:+1');
      Engine_addAnswer('Gärtner.');
      Engine_setModifiers('ALIGN_NE:+2 CLASS_DRUID:+3 CLASS_RANGER:+3 CLASS_PALADIN:+1 CLASS_SORCERER:+1 CLASS_WIZARD:+1 CLASS_FIGHTER:-2 CLASS_BARBAR:-1');
      Engine_addAnswer('Polizist.');
      Engine_setModifiers('ALIGN_LG:+2 CLASS_PALADIN:+5 CLASS_ROGUE:-5');
      Engine_addAnswer('Psychologe.');
      Engine_setModifiers('ALIGN_NN:+2 CLASS_SORCERER:+3 CLASS_BARBAR:-3');
      Engine_addAnswer('Chemiker.');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_BARBAR:-4');
    }
    {
      Engine_addQuestion('Du hast kein Geld bist aber total ausgehungert. Was würdest du tun ?');
      Engine_addAnswer('Ich singe in der nächsten Taverne oder im nächsten wohlhabendend aussehenden Haus.');
      Engine_setModifiers('ALIGN_NG:+1 RACE_ORC:-1 CLASS_BARBAR:-1 CLASS_BARD:+2');
      Engine_addAnswer('Ich schneide die Kehle eines Bürgers auf um ihn zu berauben.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+2 ALIGN_CE:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+2 CLASS_ROGUE:+1');
      Engine_addAnswer('Ich bitte im nächsten Tempel oder der nächsten Kirche um Hilfe.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+2 ALIGN_LN:+1 RACE_HUMAN:+1 RACE_ORC:-1 CLASS_BARBAR:-2 CLASS_CLERIC:+2 CLASS_MONK:+2 CLASS_PALADIN:+1 CLASS_RANGER:-2');
      Engine_addAnswer('Ich versuche das einfache Volk mit etwas Magie zu beeindrucken.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+2 RACE_HALF-ELF:+1 RACE_HUMAN:+2 RACE_ORC:-1 RACE_DWARVE:-1 CLASS_SORCERER:+2 CLASS_WIZARD:+1 CLASS_FIGHTER:-2 CLASS_ROGUE:-2 CLASS_RANGER:-2');
      Engine_addAnswer('Ich verkaufe einen magischen Gegenstand, den ich für solche Zeiten aufgehoben habe.');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_ROGUE:+2 RACE_ORC:-1 RACE_HALFLING:+2');
      Engine_addAnswer('Ich biete mich selbst als Leibwächter an.');
      Engine_setModifiers('ALIGN_LG:+2 ALIGN_LE:+2 RACE_ORC:-1 RACE_ELF:+1 CLASS_FIGHTER:+2 CLASS_SORCERER:+1 CLASS_MONK:+1');
      Engine_addAnswer('Ich erkundige mich beim Vorstand des Ortes nach Arbeit.');
      Engine_setModifiers('ALIGN_LG:+2 RACE_ELF:+1 RACE_ORC:-2 RACE_HALF-ORC:+1 CLASS_DRUID:-1 CLASS_SORCERER:+1 CLASS_FIGHTER:+1 CLASS_WIZARD:+2');
      Engine_addAnswer('Ich gehe im Wald nach Essen suchen.');
      Engine_setModifiers('CLASS_BARBAR:+1 CLASS_DRUID:+2 CLASS_RANGER:+2 RACE_ELF:+2 RACE_ORC:+2 RACE_DWARVE:+1 ALIGN_NN:+2 ALIGN_NG:+1 ALIGN_NE:+1');
    }
    {
      Engine_addQuestion('Beim Betreten einer Höhle stellst du fest, dass ein großer roter Drache dich bereits erwartet hat. Was tust du ?');
      Engine_addAnswer('So schnell wie möglich weglaufen, überlegen kann man später noch.');
      Engine_setModifiers('RACE_HALFLING:+2 RACE_GNOME:+2 CLASS_ROGUE:+1 CLASS_BARD:+2');
      Engine_addAnswer('Ich muss nur schneller laufen als der langsamste aus der Abenteurergruppe. Also nur nicht letzter sein.');
      Engine_setModifiers('ALIGN_LE:+2 ALIGN_NE:+2 ALIGN_CE:+2 CLASS_ROGUE:+2');
      Engine_addAnswer('Ich ziehe mein Schwert und würfel Initiative');
      Engine_setModifiers('ALIGN_LG:+2 ALIGN_LN:+1 ALIGN_NG:+1 ALIGN_NN:+1 RACE_HUMAN:+1 RACE_DWARVE:+2 RACE_HALF-ORC:+1 RACE_ORC:+2 CLASS_FIGHTER:+2 CLASS_PALADIN:+2 CLASS_CLERIC:+1 CLASS_MONK:+1');
      Engine_addAnswer('Magisches Geschoss, sofort !');
      Engine_setModifiers('CLASS_WIZARD:+2 CLASS_SORCERER:+2 CLASS_BARD:+1');
      Engine_addAnswer('Beten, und beten, dass beten funktioniert.');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_CLERIC:+2 CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_ROGUE:+1 CLASS_MONK:+2');
      Engine_addAnswer('Ich hab irgendwo in meinem Rucksack noch eine Schriftrolle die Drachen vernichtet.');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_SORCERER:+2 CLASS_WIZARD:+2');
      Engine_addAnswer('Ich verkrieche mich in der nächstbesten möglichst dunkelsten Ecke.');
      Engine_setModifiers('CLASS_PALADIN:+2 CLASS_ROGUE:+2 CLASS_BARD:+2');
      Engine_addAnswer('Möge mein Gott mich in die Schlacht geleiten !');
      Engine_setModifiers('CLASS_PALADIN:+2 CLASS_DRUID:+2 CLASS_RANGER:+2 ');
      Engine_addAnswer('Ich lade meinen Bogen/meine Armbrust, ziele auf die Augen und kreuze die Finger.');
      Engine_setModifiers('CLASS_RANGER:+2 CLASS_ROGUE:+2 RACE_HALF-ELF:+2 RACE_ELF:+2');
    }
    {
      Engine_addQuestion('Deine Abenteurergruppe findet einen Schatz was tust du ?');
      Engine_addAnswer('Ich ermorde alle hinterhältig und behalte den Schatz allein.');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_CE:+2 ALIGN_LE:+1 ALIGN_NG:-2 ALIGN_CG:-1 ALIGN_LG:-2 CLASS_ROGUE:+2 CLASS_SORCERER:+1 CLASS_BARBAR:+1 CLASS_DRUID:-2 CLASS_MONK:-1');
      Engine_addAnswer('Ich bin dafür es zu gleichen teilen aufzuteilen. Jeder bekommt genauso viel wie jeder andere.');
      Engine_setModifiers('ALIGN_NN:+1 ALIGN_LG:+1 CLASS_SORCERER:+1 CLASS_PALADIN:+2 CLASS_ROGUE:-1');
      Engine_addAnswer('Der Großteil soll der Familie des armen Abenteurers zukommen, der alle Fallen entschärft hat und dies mit seinem Leben bezahlen musste.');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_NE:-1 ALIGN_CE:-1 ALIGN_LE:-2 CLASS_PALADIN:+1 CLASS_ROGUE:-2');
      Engine_addAnswer('Ist mir egal, meinen Teil spende ich eh für wohltätige Zwecke.');
      Engine_setModifiers('ALIGN_NG:+2 ALIGN_NE:-1 ALIGN_CE:-1 ALIGN_LE:-3 CLASS_PALADIN:+2 CLASS_ROGUE:-2 CLASS_DRUID:+1');
      Engine_addAnswer('Ich nehme nur ein kleines Stück mit, den Rest darf die Gruppe unter sich ausmachen. Ist mir egal, ob es wertvoll ist oder nicht.');
      Engine_setModifiers('CLASS_MONK:+1 CLASS_ROGUE:-2 CLASS_RANGER:+1');
      Engine_addAnswer('Wen interessierts ich brauche nur genug um bis zum nächsten Abenteuer in Tavernen und Gasthäusern überleben zu können.');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_MONK:+1 CLASS_SORCERER:+1 CLASS_WIZARD:+1 CLASS_RANGER:+1 CLASS_ROGUE:-2');
      Engine_addAnswer('Ich will nichts davon. Sollte man mir was zugestehen, lasse ich es hier liegen.');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_ROGUE:-2');
    }
    {
      Engine_addQuestion('Du kommst in eine gewaltige Schatzkammer. Worauf fällt dein Blick zuerst ?');
      Engine_addAnswer('Gold, Juwelen, ich bin reich !');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_HUMAN:+1 RACE_GNOME:+2 RACE_DWARVE:+2 CLASS_ROGUE:+2 CLASS_WIZARD:+2 CLASS_MONK:-2 CLASS_DRUID:-2 CLASS_RANGER:-1 CLASS_BARBAR:-1');
      Engine_addAnswer('das leuchtende Schwert an der Wand');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_SORCERER:-2 CLASS_WIZARD:-2 CLASS_PALADIN:+1 CLASS_RANGER:+1');
      Engine_addAnswer('ein Facettenreiches Juwel, dass mir einen kalten Schauder über den Rücken jagd');
      Engine_setModifiers('RACE_DWARVE:+2 RACE_GNOME:+2 CLASS_WIZARD:+2 CLASS_SORCERER:+1 CLASS_ROGUE:+2');
      Engine_addAnswer('der antike Schrein eines uralten Gottes in der Wand');
      Engine_setModifiers('CLASS_CLERIC:+2');
      Engine_addAnswer('eine vergoldete Axt, die an der Wand lehnt.');
      Engine_setModifiers('RACE_DWARVE:+2');
      Engine_addAnswer('die handgeschnitzte hölzerne Statue');
      Engine_setModifiers('CLASS_RANGER:+2 RACE_ELF:+2');
      Engine_addAnswer('der Sarkophag in der Ecke mit dem bunten Emblem');
      Engine_setModifiers('CLASS_CLERIC:+2 CLASS_SORCERER:+2 CLASS_WIZARD:+1');
      Engine_addAnswer('die goldene Harfe in der Ecke');
      Engine_setModifiers('CLASS_BARD:+2');
    }
    {
      Engine_addQuestion('Welche Rolle in einer Abenteurergruppe nimmst du ein ?');
      Engine_addAnswer('Ich bin der Anführer.<br /> Ich sage jedem was zu tun ist und wann der richtige Zeitpunkt dafür ist.');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_ROGUE:-1 CLASS_DRUID:-1 CLASS_BARBAR:-2 RACE_HUMAN:+2 RACE_ORC:-2 RACE_HALF-ORC:-1');
      Engine_addAnswer('Ich bin die rechte Hand des Anführers.<br /> Ich habe die Fähigkeit ein Anführer zu sein, aber ich hasse es große Entscheidungen zu treffen. Ich sorge dafür dass getan wird, was immer getan werden muss, solange mir jemand sagt was es ist.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1');
      Engine_addAnswer('Ich bin derjenige mit den guten Ideen.<br /> Mir fällt immer irgendein Plan ein, und ich überlasse es den anderen darüber nachzudenken, wie diese Ideen in die Tat umgesetzt werden müssen.');
      Engine_setModifiers('RACE_ELF:+1 CLASS_ROGUE:+2 CLASS_SORCERER:-1 CLASS_BARD:+2 CLASS_BARBAR:-1 RACE_ORC:-1');
      Engine_addAnswer('Ich bin ein Soldat.<br /> Ich folge dem Anführer und kann oder will selbst kein Kommando haben. Sagt mir in welche Richtung es geht und was zu tun ist. Danke !');
      Engine_setModifiers('RACE_DWARVE:+2 RACE_ORC:+2 CLASS_FIGHTER:+1 CLASS_BARBAR:+1');
      Engine_addAnswer('Ich bin die moralische Stütze.<br /> Ich bin kein Anführer aber ich werde jederzeit sagen was ich darüber denke, abhängig von meinen eigenen Vorstellungen von Moral und Ethik, auch wenn dass die Gruppe nerven sollte.');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_BARBAR:-2 RACE_GNOME:+4 RACE_HALFLING:+2 CLASS_CLERIC:+2 RACE_ORC:-2 RACE_HALF-ORC:-1');
      Engine_addAnswer('Ich bin der Aussenseiter.<br /> Auch wenn ich Teil der Gruppe bin, werde ich mich von den anderen distanzieren und mich nur auf mich selbst verlassen.');
      Engine_setModifiers('CLASS_MONK:+2 CLASS_SORCERER:+2 CLASS_BARD:-2 RACE_HALFLING:-1');
      Engine_addAnswer('Ich bin der Rebell.<br /> Ich wäre gerne Anführer und werde dies durchsetzen, sobald sich die Chance dazu bietet. Durch Intrigen werde ich die Gruppe spalten und dem alten Anführer das Zepter entreissen. Lang lebe der neue Anführer !');
      Engine_setModifiers('ALIGN_LG:+1 ALIGN_LE:+2 ALIGN_NE:+1 ALIGN_CE:+1 RACE_HUMAN:+2 RACE_HALFLING:+1 RACE_DWARVE:+2 RACE_HALF-ORC:+1 RACE_GNOME:+1 CLASS_PALADIN:+1 CLASS_ROGUE:+2 CLASS_BARD:+1');
      Engine_addAnswer('Ich bin die linke Hand des Anführers.<br /> Ich tue alles was er will, wie sein persönlicher Sklave. Zu ihm bin ich stets freundlich und diejenigen die unter mir stehen, werden leiden müssen.');
      Engine_setModifiers('CLASS_PALADIN:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+1');
      Engine_addAnswer('Ich bin der Maulwurf.<br /> Ich lächle immer brav und ziehe bei jedem Plan mit, doch ich werde die Gruppe einen nach dem anderen töten und es wie Unfälle aussehen lassen.');
      Engine_setModifiers('ALIGN_NE:+2 ALIGN_LE:+1 ALIGN_CE:+1 ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 CLASS_ROGUE:+2 CLASS_BARBAR:+1 CLASS_SORCERER:+1 CLASS_DRUID:-1');
    }
    {
      Engine_addQuestion('Womit würdest du dich <b>am liebsten</b> bekleiden ?');
      Engine_addAnswer('wohlhabend aussehende, modische Kleidung');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_DRUID:-2');
      Engine_addAnswer('Ist mir egal, hauptsache es erfüllt seinen Zweck wenn man auf Reisen ist.');
      Engine_setModifiers('CLASS_DRUID:+2 CLASS_MONK:+2 CLASS_ROGUE:+1 CLASS_RANGER+1');
      Engine_addAnswer('eine glänzende Metallrüstung');
      Engine_setModifiers('CLASS_FIGHTER:+2 CLASS_PALADIN:+2 CLASS_RANGER:+2 CLASS_CLERIC:+2 CLASS_SORCERER:-2 CLASS_WIZARD:-2 RACE_DWARVE:+1');
      Engine_addAnswer('abgenutzte Kleidung, wie viele andere Bürger auch');
      Engine_setModifiers('CLASS_BARD:+2 CLASS_DRUID:+1');
      Engine_addAnswer('Roben, Umhänge, Capes');
      Engine_setModifiers('CLASS_SORCERER:+2 CLASS_WIZARD:+2 CLASS_ROGUE:+1 RACE_DWARVE:-1 CLASS_FIGHTER:-2 CLASS_CLERIC:+1');
    }
    {
      Engine_addQuestion('Womit würdest du dich <b>am wenigsten gern</b> bekleiden ?');
      Engine_addAnswer('wohlhabend aussehende, modische Kleidung');
      Engine_setModifiers('CLASS_BARD:-2 CLASS_DRUID:+2');
      Engine_addAnswer('Ist mir egal, hauptsache es erfüllt seinen Zweck wenn man auf Reisen ist.');
      Engine_setModifiers('CLASS_DRUID:-2 CLASS_MONK:-2');
      Engine_addAnswer('eine glänzende Metallrüstung');
      Engine_setModifiers('CLASS_FIGHTER:-2 CLASS_PALADIN:-2 CLASS_RANGER:-2 CLASS_CLERIC:-2 CLASS_SORCERER:+2 CLASS_WIZARD:+2 RACE_DWARVE:-1');
      Engine_addAnswer('abgenutzte Kleidung, wie viele andere Bürger auch');
      Engine_setModifiers('CLASS_BARD:-2 CLASS_DRUID:-1');
      Engine_addAnswer('Roben, Umhänge, Capes');
      Engine_setModifiers('CLASS_SORCERER:-2 CLASS_WIZARD:-2 CLASS_CLERIC:-1 CLASS_FIGHTER:+2 RACE_DWARVE:+1');
    }
    {
      Engine_addQuestion('Was ist deine <b>Lieblingsfarbe</b> ?');
      Engine_addAnswer('Rot');
      Engine_setModifiers('');
      Engine_addAnswer('Grün');
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
      Engine_addAnswer('Grün');
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
      Engine_addQuestion('Was würdest du an einer Universität <b>am liebsten</b> studieren ?');
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
      Engine_addAnswer('Schätze, Profit, Wirtschaft');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:-1 RACE_GNOME:+1 RACE_HALFLING:+2 RACE_DWARVE:+1 CLASS_WIZARD:+1 CLASS_BARBAR:-2 CLASS_ROGUE:+2 CLASS_DRUID:-2 CLASS_SORCERER:+1 CLASS_RANGER:-1 CLASS_MONK:-2 ');
      Engine_addAnswer('Ich würde nicht studieren, das ist was für Streber.');
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
      Engine_addAnswer('Schätze, Profit, Wirtschaft');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_HALFLING:-2 CLASS_WIZARD:-1 CLASS_CLERIC:-1 CLASS_ROGUE:-2 CLASS_DRUID:+2 CLASS_MONK:+1 ');
    }
    {
      Engine_addQuestion('Welches Tier hättest du <b>am liebsten</b> als Haustier oder tierischen Begleiter ?');
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
      Engine_addQuestion('Welches Tier hättest du <b>auch gern</b> als Haustier oder tierischen Begleiter ?');
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
      Engine_addQuestion('Welches davon hättest du <b>am wenigsten gern</b> als Haustier oder tierischen Begleiter ?');
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
      Engine_addQuestion('Während du an einer Schlucht entlangläufst, siehst du wie 100m unter dir eine alte Frau überfallen wird. Was tust du ?');
      Engine_addAnswer('Ich töte alle, einschliesslich der alten Frau und suche nach wertvollem.');
      Engine_setModifiers('ALIGN_NG:-3 ALIGN_LG:-2 ALIGN_CG:-3 ALIGN_NE:+3 ALIGN_LE:+1 ALIGN_CE:+2 RACE_ORC:+3 RACE_HALF-ORC:+2 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich schau auf die Uhr und messe wie lange die Räuber brauchen.');
      Engine_setModifiers('ALIGN_NN:+3 ALIGN_LN:+1 ALIGN_CN:+2 CLASS_PALADIN:-3 CLASS_ROGUE:+2 ');
      Engine_addAnswer('Ich töte die Angreifer und rette die Frau.');
      Engine_setModifiers('');
      Engine_addAnswer('Ich ignoriere das alles und mache mich wieder auf den Weg.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-3 ALIGN_CG:-1 ALIGN_NN:+2 ');
      Engine_addAnswer('Ich versuche die Angreifer davon zu überzeugen, dass mein Gott das nicht gut findet und man das auch friedlich lösen kann.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+3 ALIGN_CG:+1 CLASS_BARBAR:-3 CLASS_PALADIN:+1 CLASS_CLERIC:+3 CLASS_ROGUE:-1 CLASS_DRUID:-1 ');
      Engine_addAnswer('Ich rufe hinunter, dass Verstärkung im Anmarsch ist, begebe mich aber nicht selbst in Gefahr.');
      Engine_setModifiers('ALIGN_NN:+3 ALIGN_LN:+1 ALIGN_CN:+1 ALIGN_NE:+1 CLASS_WIZARD:+1 CLASS_ROGUE:+1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Ich bete für die Seele der Frau.');
      Engine_setModifiers('ALIGN_NG:+3 ALIGN_LG:+1 ALIGN_NN:+2 CLASS_CLERIC:+3 CLASS_MONK:+2 ');
      Engine_addAnswer('Ich schliesse mich den Angreifern an.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-1 ALIGN_CG:-1 ALIGN_NE:+3 ALIGN_LE:+1 ALIGN_CE:+2 RACE_DWARVE:+3 CLASS_FIGHTER:+3 CLASS_PALADIN:+1 ');
    }
    {
      Engine_addQuestion('Was würdest du in einer Taverne <b>am ehesten</b> bestellen ?');
      Engine_addAnswer('Wein und Käse');
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
      Engine_addAnswer('Ich möchte nur ein paar Informationen über den Ort und den dem er gehört.');
      Engine_setModifiers('RACE_ELF:+2 RACE_HALF-ELF:+1 CLASS_ROGUE:+2 CLASS_BARD:+1 ');
    }
    {
      Engine_addQuestion('Was würdest du in einer Taverne <b>wohl eher nicht</b> bestellen ?');
      Engine_addAnswer('Wein und Käse');
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
      Engine_addAnswer('Ich möchte nur ein paar Informationen über den Ort und den dem er gehört.');
      Engine_setModifiers('RACE_ELF:-2 RACE_HALF-ELF:-1 CLASS_ROGUE:-2 CLASS_BARD:-1 ');
    }
    {
      Engine_addQuestion('Mit welcher der folgenen Personengruppen würdest du dich <b>am ehesten</b> abgeben ?');
      Engine_addAnswer('Anwälte, Politiker, Geschäftsmänner');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_WIZARD:+2 CLASS_DRUID:-3 CLASS_RANGER:-1 ');
      Engine_addAnswer('Priester, Pfarrer');
      Engine_setModifiers('ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-2 RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_PALADIN:+1 CLASS_CLERIC:+2 CLASS_ROGUE:-2 CLASS_MONK:+2 ');
      Engine_addAnswer('Minderheiten, Untergebene');
      Engine_setModifiers('RACE_HALF-ELF:+3 RACE_HALF-ORC:+3 CLASS_WIZARD:+1 CLASS_ROGUE:+2 CLASS_DRUID:+1 CLASS_SORCERER:+3 ');
      Engine_addAnswer('Sklaven');
      Engine_setModifiers('RACE_ELF:-3 RACE_ORC:+2 RACE_HALF-ELF:-1 RACE_HALF-ORC:+1 CLASS_WIZARD:-1 CLASS_BARBAR:+3 CLASS_PALADIN:+1 CLASS_CLERIC:-1 CLASS_MONK:-1 ');
      Engine_addAnswer('Künstler, Dichter, Autoren');
      Engine_setModifiers('RACE_ELF:+2 RACE_ORC:-3 RACE_HALF-ELF:+1 RACE_HALF-ORC:-2 RACE_DWARVE:-1 CLASS_WIZARD:+1 CLASS_BARBAR:-2 CLASS_BARD:+3 ');
      Engine_addAnswer('Reisende, Händler');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_GNOME:+2 RACE_HALFLING:+1 RACE_DWARVE:-1 CLASS_ROGUE:+2 CLASS_BARD:+1 ');
      Engine_addAnswer('Stammkunden in der Taverne');
      Engine_setModifiers('RACE_ELF:-2 RACE_DWARVE:+3 ');
      Engine_addAnswer('Mit mir, mich selbst und nur mir.');
      Engine_setModifiers('CLASS_ROGUE:-1 CLASS_BARD:-2 CLASS_DRUID:+1 CLASS_SORCERER:+1 CLASS_MONK:+3 ');
    }
    {
      Engine_addQuestion('Mit welcher der folgenen Personengruppen würdest du dich <b>am wenigsten</b> abgeben ?');
      Engine_addAnswer('Anwälte, Politiker, Geschäftsmänner');
      Engine_setModifiers('CLASS_FIGHTER:-1 CLASS_WIZARD:-2 CLASS_DRUID:+3 CLASS_RANGER:+1 ');
      Engine_addAnswer('Priester, Pfarrer');
      Engine_setModifiers('ALIGN_NE:+1 ALIGN_LE:+1 ALIGN_CE:+2 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_PALADIN:-1 CLASS_CLERIC:-2 CLASS_ROGUE:+2 CLASS_MONK:-2 ');
      Engine_addAnswer('Minderheiten, Untergebene');
      Engine_setModifiers('RACE_HALF-ELF:-3 RACE_HALF-ORC:-3 CLASS_WIZARD:-1 CLASS_ROGUE:-2 CLASS_DRUID:-1 CLASS_SORCERER:-3 ');
      Engine_addAnswer('Sklaven');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 CLASS_WIZARD:+1 CLASS_BARBAR:-1 CLASS_PALADIN:-1 CLASS_CLERIC:+1 CLASS_MONK:+1 ');
      Engine_addAnswer('Künstler, Dichter, Autoren');
      Engine_setModifiers('RACE_ELF:-2 RACE_ORC:+3 RACE_HALF-ELF:-1 RACE_HALF-ORC:+2 RACE_DWARVE:+1 CLASS_WIZARD:-1 CLASS_BARBAR:+2 CLASS_BARD:-3 ');
      Engine_addAnswer('Reisende, Händler');
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
      Engine_addAnswer('Das zahl ich ihm zurück, aber auf eine freundliche Art und Weise.<br/> (das könnte auch heissen, dass ich ihn bestehle)');
      Engine_setModifiers('RACE_HALFLING:+2 CLASS_FIGHTER:-1 CLASS_WIZARD:-2 CLASS_BARBAR:-2 CLASS_PALADIN:-3 CLASS_CLERIC:-3 CLASS_ROGUE:+3 CLASS_BARD:+2 CLASS_DRUID:-3 CLASS_SORCERER:-1 CLASS_RANGER:-1 ');
      Engine_addAnswer('Ich kenne die selben Leute wie er und werde ihn subtil demütigen.');
      Engine_setModifiers('CLASS_BARBAR:-3 CLASS_PALADIN:-2 CLASS_ROGUE:+2 CLASS_SORCERER:+3 ');
      Engine_addAnswer('Ich werde dem Dreckskerl weh tun.');
      Engine_setModifiers('RACE_ELF:-1 RACE_ORC:+2 RACE_HALF-ORC:+1 CLASS_BARBAR:+3 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich Töte den Bastard.');
      Engine_setModifiers('ALIGN_CN:+1 ALIGN_CE:+2 RACE_ELF:-2 RACE_ORC:+3 RACE_HALF-ELF:-1 RACE_HALF-ORC:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 ');
    }
    {
      Engine_addQuestion('Man gibt dir einige Millionen Goldmünzen was würdest du damit tun ?');
      Engine_addAnswer('Einkaufen !');
      Engine_setModifiers('CLASS_ROGUE:+2 ');
      Engine_addAnswer('Ich stifte das Geld einem wohltätigen Zweck.');
      Engine_setModifiers('CLASS_PALADIN:+2 ');
      Engine_addAnswer('Ich investiere es in Immobilien oder Geschäfte.');
      Engine_setModifiers('CLASS_CLERIC:+2 ');
      Engine_addAnswer('Ich lege es in Aktien, Fonds oder Wertpapiere an und lebe von den Zinsen und Gewinnen.');
      Engine_setModifiers('CLASS_WIZARD:+2 ');
      Engine_addAnswer('Ich mach eine eigenes Geschäft auf.');
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
      Engine_addAnswer('Alles, hauptsache ich habe Gäste.');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_BARD:-1 CLASS_RANGER:+2 ');
      Engine_addAnswer('Ich sagte doch, dass mich Parties nicht interessieren !');
      Engine_setModifiers('CLASS_DRUID:+3 CLASS_MONK:+3 ');
    }
    {
      Engine_addQuestion('Ein richtiger Abenteurer muss für dich so aussehen:');
      Engine_addAnswer('glänzende Rüstung, strahlendes Haar, athletischer Körper');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-1 RACE_HALF-ELF:+1 RACE_DWARVE:-1 CLASS_FIGHTER:+1 CLASS_WIZARD:-2 CLASS_PALADIN:+3 CLASS_SORCERER:-2 CLASS_RANGER:+1 ');
      Engine_addAnswer('dicke Plattenrüstung, ölverschmiertes Gesicht, Bart');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:-2 RACE_HALF-ELF:-1 RACE_DWARVE:+3 CLASS_FIGHTER:+3 CLASS_WIZARD:-2 CLASS_DRUID:-3 CLASS_SORCERER:-2 ');
      Engine_addAnswer('jeder ist ein Abenteurer, denn das ganze Leben ist ein Abenteuer');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_PALADIN:+1 CLASS_CLERIC:+2 CLASS_BARD:+1 ');
      Engine_addAnswer('zerrissene Kleidung, Narben, frische Wunden');
      Engine_setModifiers('RACE_ELF:-3 RACE_ORC:+3 RACE_HALF-ELF:-2 RACE_HALF-ORC:+2 CLASS_WIZARD:-3 CLASS_BARBAR:+3 CLASS_PALADIN:-3 CLASS_DRUID:+1 CLASS_SORCERER:-3 CLASS_RANGER:+1 ');
      Engine_addAnswer('modisch gekleidet, mit einem Stab und einer Robe');
      Engine_setModifiers('RACE_HALF-ELF:+3 CLASS_FIGHTER:-2 CLASS_WIZARD:+3 CLASS_BARBAR:-3 CLASS_CLERIC:+1 CLASS_DRUID:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Abenteurer erkennt man nicht am Äusseren, doch ihre Augen erzählen Geschichten');
      Engine_setModifiers('CLASS_FIGHTER:+1 CLASS_BARD:+3 CLASS_DRUID:+1 ');
      Engine_addAnswer('schlank, sehnig, schön und anmutig');
      Engine_setModifiers('RACE_ELF:+3 RACE_ORC:-3 RACE_HALF-ELF:+2 RACE_HALF-ORC:-2 RACE_DWARVE:-2 CLASS_FIGHTER:+1 CLASS_WIZARD:+1 CLASS_BARBAR:-3 CLASS_PALADIN:+1 CLASS_CLERIC:+1 CLASS_BARD:+1 CLASS_DRUID:+1 CLASS_SORCERER:+1 CLASS_RANGER:+1 ');
      Engine_addAnswer('dick, fett, kräftig mit einer bärentiefen Stimme');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:+3 RACE_HALF-ORC:+2 RACE_DWARVE:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 CLASS_DRUID:+1 ');
      Engine_addAnswer('wie jeder andere Reisende auch');
      Engine_setModifiers('CLASS_WIZARD:-1 CLASS_BARBAR:-2 CLASS_PALADIN:-2 CLASS_ROGUE:+3 CLASS_DRUID:+2 CLASS_SORCERER:-2 ');
      Engine_addAnswer('kahlköpfig mit starken Händen und irgendwie weise');
      Engine_setModifiers('RACE_ORC:-2 RACE_HALF-ORC:-1 CLASS_WIZARD:-1 CLASS_BARBAR:-3 CLASS_SORCERER:-1 CLASS_MONK:+3 ');
      Engine_addAnswer('irgendwie anders');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_HALF-ELF:+2 RACE_HALF-ORC:+2 CLASS_ROGUE:+1 CLASS_DRUID:+3 CLASS_SORCERER:+3 ');
    }
    {
      Engine_addQuestion('Freundschaften sind für dich ?');
      Engine_addAnswer('sehr profitabel');
      Engine_setModifiers('RACE_ELF:-2 CLASS_ROGUE:+2 ');
      Engine_addAnswer('wichtig, denn man kann sich auf seine Freunde verlassen');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 RACE_DWARVE:+1 CLASS_ROGUE:-1 CLASS_BARD:+2 CLASS_DRUID:-1 ');
      Engine_addAnswer('ein notwendiges Übel');
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
      Engine_addAnswer('jeder ist ein Freund für mich');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+1 CLASS_ROGUE:-1 CLASS_BARD:+3 ');
    }
    {
      Engine_addQuestion('Du hast dich zum Turm einer eingesperrten und mit Handschellen gefesselten Prinzessin durchgekämpft. Was nun ?');
      Engine_addAnswer('Ich wollte nur sehen ob ich es bis hierhin schaffe, jetzt gehe ich wieder.');
      Engine_setModifiers('ALIGN_LN:-1 ALIGN_CN:+1 RACE_HUMAN:+1 RACE_HALFLING:+2 RACE_DWARVE:-1 CLASS_PALADIN:-2 CLASS_ROGUE:+2 CLASS_BARD:-1 CLASS_SORCERER:+2 ');
      Engine_addAnswer('Ich befreie die Prinzessin und heirate sie.');
      Engine_setModifiers('ALIGN_NG:+1 ALIGN_LG:+1 ALIGN_CG:+1 ALIGN_NE:-1 ALIGN_LE:-1 ALIGN_CE:-1 CLASS_FIGHTER:+1 CLASS_BARBAR:+1 CLASS_PALADIN:+1 ');
      Engine_addAnswer('Ich befreie sie und bringe sie ihrem Vater zurück - Auftrag erledigt.');
      Engine_setModifiers('');
      Engine_addAnswer('Ich vergewaltige, töte oder esse sie.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 RACE_ELF:-3 RACE_ORC:+3 RACE_HALF-ELF:-2 RACE_HALF-ORC:+2 CLASS_BARBAR:+3 CLASS_PALADIN:-3 ');
      Engine_addAnswer('Ich finde sie hässlich und hätte lieber einen Prinzen gerettet.');
      Engine_setModifiers('RACE_ORC:-1 CLASS_BARBAR:-1 CLASS_PALADIN:-2 CLASS_ROGUE:+1 CLASS_BARD:+2 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Ich unterhalte mich mit ihr über Mode, Schmuck, Trends und Männer.');
      Engine_setModifiers('CLASS_BARBAR:-3 CLASS_BARD:+1 ');
      Engine_addAnswer('Ich lasse die Prinzessin angekettet und suche nach dem Schatz.');
      Engine_setModifiers('ALIGN_NG:-2 ALIGN_LG:-2 ALIGN_CG:-2 ALIGN_NE:+2 ALIGN_LE:+2 ALIGN_CE:+2 CLASS_ROGUE:+3 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Ich lasse sie gefesselt, schlage sie K.O. und bringe sie dann zu ihrem Vater zurück.');
      Engine_setModifiers('RACE_ELF:-1 RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+1 CLASS_FIGHTER:+3 CLASS_BARBAR:+2 ');
      Engine_addAnswer('Ich stelle sie vor die Wahl mich zu heiraten oder hier angekettet zu bleiben.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:-1 RACE_ORC:+1 CLASS_BARBAR:+1 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich behalte die Prinzessin als Geisel, bewache den Turm und töte jeden Eindringling.');
      Engine_setModifiers('RACE_ORC:+2 RACE_HALF-ORC:+1 RACE_DWARVE:+2 CLASS_FIGHTER:+2 CLASS_BARBAR:+1 CLASS_PALADIN:-2 CLASS_ROGUE:+1 CLASS_SORCERER:+1 ');
      Engine_addAnswer('Sie muss mir ihren ersten Sohn versprechen, dann befreie ich sie.');
      Engine_setModifiers('RACE_ORC:+1 CLASS_FIGHTER:+2 CLASS_PALADIN:-1 ');
    }
    {
      Engine_addQuestion('Wie lang muss ein Leben für dich mindestens sein ?');
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
      Engine_addQuestion('Wie wichtig ist körperliche Grösse für dich ?');
      Engine_addAnswer('Ich hab ein grosses Problem damit klein zu sein.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ORC:+3 RACE_GNOME:-3 RACE_HALF-ORC:+2 RACE_HALFLING:-2 RACE_DWARVE:-2 ');
      Engine_addAnswer('Es ist mir egal ob ich klein bin. die Leute werden mich nach dem was ich sage und tue beurteilen und nicht nach meiner Grösse.');
      Engine_setModifiers('RACE_ORC:-2 RACE_GNOME:+2 RACE_HALF-ELF:+1 RACE_HALF-ORC:-1 RACE_HALFLING:+3 RACE_DWARVE:+2 ');
      Engine_addAnswer('Ich bin gerne klein, dass hat auch seine Vorteile.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ORC:-3 RACE_GNOME:+3 RACE_HALF-ORC:-2 RACE_HALFLING:+3 RACE_DWARVE:+2 CLASS_BARBAR:-1 CLASS_ROGUE:+1 ');
      Engine_addAnswer('Ich bin so gross wie der Durschnitt. Um ehrlich zu sein: Es gibt wichtigere Dinge, über die man nachdenken sollte.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+2 RACE_HALF-ELF:+1 ');
      Engine_addAnswer('Alles ist mir recht, Solange ich nicht wie der Durchschnitt aussehe.');
      Engine_setModifiers('RACE_HUMAN:+2 RACE_ELF:+1 RACE_HALF-ELF:+1 ');
      Engine_addAnswer('Gross oder nicht - das spielt doch keine Rolle.');
      Engine_setModifiers('RACE_HUMAN:+1 RACE_ELF:+3 RACE_ORC:-2 RACE_HALF-ELF:+2 RACE_HALF-ORC:-1 RACE_DWARVE:+1 ');
      Engine_addAnswer('Ich hab ein Problem damit besonders gross zu sein.');
      Engine_setModifiers('RACE_ORC:-3 RACE_GNOME:+2 RACE_HALF-ORC:-2 RACE_HALFLING:+2 ');
      Engine_addAnswer('Je grösser desto besser.');
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