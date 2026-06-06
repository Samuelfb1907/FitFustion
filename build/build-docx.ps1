# Builds FitAvo-Masterfile.docx from content.json using only built-in .NET (no Node/Python).
$ErrorActionPreference = 'Stop'

$root        = 'C:\Users\Samuel\fitness-app'
$contentPath = Join-Path $root 'build\content.json'
$outPath     = Join-Path $root 'FitAvo-Masterfile.docx'
$CW          = 9638   # content width in DXA (A4 minus 2x1134 margins)

# ---------- helpers ----------
function Esc([string]$s){
  if($null -eq $s){ return '' }
  $s = $s -replace '&','&amp;'
  $s = $s -replace '<','&lt;'
  $s = $s -replace '>','&gt;'
  $s = $s -replace '"','&quot;'
  return $s
}

function Heading($text,$lvl){
  return "<w:p><w:pPr><w:pStyle w:val='Heading$lvl'/></w:pPr><w:r><w:t xml:space='preserve'>$(Esc $text)</w:t></w:r></w:p>"
}
function Para($text){
  return "<w:p><w:pPr><w:jc w:val='both'/></w:pPr><w:r><w:t xml:space='preserve'>$(Esc $text)</w:t></w:r></w:p>"
}
function Lead($k,$x){
  return "<w:p><w:pPr><w:jc w:val='both'/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space='preserve'>$(Esc $k): </w:t></w:r><w:r><w:t xml:space='preserve'>$(Esc $x)</w:t></w:r></w:p>"
}
function ListItem($text,$numId){
  return "<w:p><w:pPr><w:numPr><w:ilvl w:val='0'/><w:numId w:val='$numId'/></w:numPr><w:spacing w:after='60'/></w:pPr><w:r><w:t xml:space='preserve'>$(Esc $text)</w:t></w:r></w:p>"
}
function PageBreakPara(){ return "<w:p><w:r><w:br w:type='page'/></w:r></w:p>" }

function Get-ColWidths($props,$n){
  if(-not $props -or $props.Count -ne $n){
    $props = @(); for($i=0;$i -lt $n;$i++){ $props += 1 }
  }
  $sum = 0; foreach($p in $props){ $sum += $p }
  $widths = @()
  foreach($p in $props){ $widths += [int][math]::Round($CW * $p / $sum) }
  $cur = 0; foreach($w in $widths){ $cur += $w }
  $widths[$widths.Count-1] = $widths[$widths.Count-1] + ($CW - $cur)
  return ,$widths
}

function Render-Cell($text,$width,$fill,$isHeader){
  $lines = ([string]$text) -split "`n"
  $paras = ''
  foreach($ln in $lines){
    if($isHeader){ $rpr = "<w:rPr><w:b/><w:color w:val='FFFFFF'/><w:sz w:val='20'/></w:rPr>" }
    else         { $rpr = "<w:rPr><w:sz w:val='20'/></w:rPr>" }
    $paras += "<w:p><w:pPr><w:spacing w:after='0' w:line='240' w:lineRule='auto'/></w:pPr><w:r>$rpr<w:t xml:space='preserve'>$(Esc $ln)</w:t></w:r></w:p>"
  }
  if($paras -eq ''){ $paras = '<w:p/>' }
  return "<w:tc><w:tcPr><w:tcW w:w='$width' w:type='dxa'/><w:shd w:val='clear' w:color='auto' w:fill='$fill'/><w:vAlign w:val='center'/></w:tcPr>$paras</w:tc>"
}

function Render-Table($headers,$rows,$props){
  $n = $headers.Count
  $widths = Get-ColWidths $props $n
  $t = New-Object System.Text.StringBuilder
  [void]$t.Append("<w:tbl><w:tblPr><w:tblW w:w='$CW' w:type='dxa'/><w:tblLayout w:type='fixed'/><w:tblBorders>")
  foreach($s in 'top','left','bottom','right','insideH','insideV'){
    [void]$t.Append("<w:$s w:val='single' w:sz='4' w:space='0' w:color='BFBFBF'/>")
  }
  [void]$t.Append("</w:tblBorders><w:tblCellMar><w:top w:w='60' w:type='dxa'/><w:left w:w='100' w:type='dxa'/><w:bottom w:w='60' w:type='dxa'/><w:right w:w='100' w:type='dxa'/></w:tblCellMar></w:tblPr>")
  [void]$t.Append('<w:tblGrid>')
  foreach($w in $widths){ [void]$t.Append("<w:gridCol w:w='$w'/>") }
  [void]$t.Append('</w:tblGrid>')
  # header
  [void]$t.Append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
  for($i=0;$i -lt $n;$i++){ [void]$t.Append((Render-Cell $headers[$i] $widths[$i] '1F3864' $true)) }
  [void]$t.Append('</w:tr>')
  # body
  $ri = 0
  foreach($row in $rows){
    if($ri % 2 -eq 1){ $fill = 'EEF3FA' } else { $fill = 'FFFFFF' }
    [void]$t.Append('<w:tr>')
    for($i=0;$i -lt $n;$i++){
      if($i -lt $row.Count){ $val = [string]$row[$i] } else { $val = '' }
      [void]$t.Append((Render-Cell $val $widths[$i] $fill $false))
    }
    [void]$t.Append('</w:tr>')
    $ri++
  }
  [void]$t.Append('</w:tbl>')
  [void]$t.Append("<w:p><w:pPr><w:spacing w:after='80'/></w:pPr></w:p>")
  return $t.ToString()
}

function Render-Callout($label,$text){
  $cell = "<w:tc><w:tcPr><w:tcW w:w='$CW' w:type='dxa'/><w:tcBorders><w:top w:val='single' w:sz='4' w:space='0' w:color='BBD3EE'/><w:left w:val='single' w:sz='24' w:space='0' w:color='2E75B6'/><w:bottom w:val='single' w:sz='4' w:space='0' w:color='BBD3EE'/><w:right w:val='single' w:sz='4' w:space='0' w:color='BBD3EE'/></w:tcBorders><w:shd w:val='clear' w:color='auto' w:fill='EAF1FB'/></w:tcPr><w:p><w:pPr><w:spacing w:after='0'/></w:pPr><w:r><w:rPr><w:b/><w:color w:val='1F3864'/><w:sz w:val='20'/></w:rPr><w:t xml:space='preserve'>$(Esc $label): </w:t></w:r><w:r><w:rPr><w:sz w:val='20'/></w:rPr><w:t xml:space='preserve'>$(Esc $text)</w:t></w:r></w:p></w:tc>"
  return "<w:tbl><w:tblPr><w:tblW w:w='$CW' w:type='dxa'/><w:tblLayout w:type='fixed'/><w:tblBorders><w:top w:val='none' w:sz='0' w:space='0' w:color='auto'/><w:left w:val='none' w:sz='0' w:space='0' w:color='auto'/><w:bottom w:val='none' w:sz='0' w:space='0' w:color='auto'/><w:right w:val='none' w:sz='0' w:space='0' w:color='auto'/><w:insideH w:val='none' w:sz='0' w:space='0' w:color='auto'/><w:insideV w:val='none' w:sz='0' w:space='0' w:color='auto'/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w='$CW'/></w:tblGrid><w:tr>$cell</w:tr></w:tbl><w:p><w:pPr><w:spacing w:after='80'/></w:pPr></w:p>"
}

function Title-Page(){
  $sec1 = "<w:sectPr><w:pgSz w:w='11906' w:h='16838'/><w:pgMar w:top='1418' w:right='1134' w:bottom='1418' w:left='1134' w:header='708' w:footer='708' w:gutter='0'/></w:sectPr>"
  $x = ''
  for($i=0;$i -lt 6;$i++){ $x += '<w:p/>' }
  $x += "<w:p><w:pPr><w:spacing w:after='80'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:b/><w:color w:val='595959'/><w:spacing w:val='80'/><w:sz w:val='26'/></w:rPr><w:t>M A S T E R F I L E</w:t></w:r></w:p>"
  $x += "<w:p><w:pPr><w:spacing w:after='60'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:b/><w:color w:val='1F3864'/><w:sz w:val='80'/></w:rPr><w:t>FitAvo</w:t></w:r></w:p>"
  $x += "<w:p><w:pPr><w:spacing w:after='200'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:i/><w:color w:val='2E5496'/><w:sz w:val='28'/></w:rPr><w:t>Training und Ern&#228;hrung &#8211; intelligent vereint.</w:t></w:r></w:p>"
  $x += "<w:p><w:pPr><w:pBdr><w:bottom w:val='single' w:sz='8' w:space='1' w:color='1F3864'/></w:pBdr><w:spacing w:after='240'/></w:pPr></w:p>"
  $x += "<w:p><w:pPr><w:spacing w:after='400'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:color w:val='404040'/><w:sz w:val='26'/></w:rPr><w:t>Projekt-Roadmap und Konzeptdokument f&#252;r eine KI-gest&#252;tzte Fitness- und Ern&#228;hrungs-App</w:t></w:r></w:p>"
  $x += "<w:p><w:pPr><w:spacing w:after='40'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val='22'/></w:rPr><w:t>Version 1.0   |   30. Mai 2026   |   Status: Vertraulich (Entwurf)</w:t></w:r></w:p>"
  $x += "<w:p><w:pPr><w:spacing w:after='40'/><w:jc w:val='center'/></w:pPr><w:r><w:rPr><w:color w:val='404040'/><w:sz w:val='22'/></w:rPr><w:t>Erstellt f&#252;r: Produktmanagement, Entwicklung, Design, Recht und Investoren</w:t></w:r></w:p>"
  for($i=0;$i -lt 7;$i++){ $x += '<w:p/>' }
  $x += "<w:p><w:pPr><w:spacing w:after='0'/><w:jc w:val='center'/>$sec1</w:pPr><w:r><w:rPr><w:color w:val='808080'/><w:sz w:val='16'/></w:rPr><w:t>Dieses Dokument ist vertraulich und ausschlie&#223;lich f&#252;r den internen Gebrauch sowie autorisierte Empf&#228;nger bestimmt.</w:t></w:r></w:p>"
  return $x
}

# ---------- build body from JSON ----------
$json = Get-Content $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sb = New-Object System.Text.StringBuilder
$olId = 10
foreach($b in $json){
  switch ($b.t){
    'h1'      { [void]$sb.Append((Heading $b.x 1)) }
    'h2'      { [void]$sb.Append((Heading $b.x 2)) }
    'h3'      { [void]$sb.Append((Heading $b.x 3)) }
    'h4'      { [void]$sb.Append((Heading $b.x 4)) }
    'p'       { [void]$sb.Append((Para $b.x)) }
    'lead'    { [void]$sb.Append((Lead $b.k $b.x)) }
    'ul'      { foreach($it in $b.items){ [void]$sb.Append((ListItem $it 1)) } }
    'check'   { foreach($it in $b.items){ [void]$sb.Append((ListItem $it 2)) } }
    'ol'      { $cur = $olId; $olId++; foreach($it in $b.items){ [void]$sb.Append((ListItem $it $cur)) } }
    'table'   { [void]$sb.Append((Render-Table $b.headers $b.rows $b.w)) }
    'callout' { [void]$sb.Append((Render-Callout $b.k $b.x)) }
    'pb'      { [void]$sb.Append((PageBreakPara)) }
    'space'   { [void]$sb.Append('<w:p/>') }
    default   { }
  }
}

# ---------- static parts ----------
$xmlDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

$tocTitle = "<w:p><w:pPr><w:spacing w:before='0' w:after='200'/></w:pPr><w:r><w:rPr><w:b/><w:color w:val='1F3864'/><w:sz w:val='36'/></w:rPr><w:t>Inhaltsverzeichnis</w:t></w:r></w:p>"
$tocField = "<w:p><w:pPr><w:tabs><w:tab w:val='right' w:leader='dot' w:pos='$CW'/></w:tabs></w:pPr><w:r><w:fldChar w:fldCharType='begin'/></w:r><w:r><w:instrText xml:space='preserve'> TOC \o &quot;1-3&quot; \h \z \u </w:instrText></w:r><w:r><w:fldChar w:fldCharType='separate'/></w:r><w:r><w:rPr><w:i/><w:color w:val='808080'/></w:rPr><w:t>Bitte das Inhaltsverzeichnis aktualisieren (Rechtsklick &gt; Felder aktualisieren, oder Strg+A und F9).</w:t></w:r><w:r><w:fldChar w:fldCharType='end'/></w:r></w:p>"
$finalSect = "<w:sectPr><w:footerReference w:type='default' r:id='rId4'/><w:pgSz w:w='11906' w:h='16838'/><w:pgMar w:top='1418' w:right='1134' w:bottom='1418' w:left='1134' w:header='708' w:footer='708' w:gutter='0'/><w:pgNumType w:start='1'/></w:sectPr>"

$docBody  = "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><w:body>"
$docBody += (Title-Page)
$docBody += $tocTitle + $tocField + (PageBreakPara)
$docBody += $sb.ToString()
$docBody += $finalSect
$docBody += '</w:body></w:document>'
$documentXml = $xmlDecl + $docBody

$stylesBody = @'
<w:styles xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii='Arial' w:hAnsi='Arial' w:cs='Arial'/><w:sz w:val='22'/><w:szCs w:val='22'/><w:lang w:val='de-DE'/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after='120' w:line='276' w:lineRule='auto'/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type='paragraph' w:default='1' w:styleId='Normal'><w:name w:val='Normal'/><w:qFormat/></w:style>
<w:style w:type='paragraph' w:styleId='Heading1'><w:name w:val='heading 1'/><w:basedOn w:val='Normal'/><w:next w:val='Normal'/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before='320' w:after='140'/><w:outlineLvl w:val='0'/><w:pBdr><w:bottom w:val='single' w:sz='12' w:space='4' w:color='1F3864'/></w:pBdr></w:pPr><w:rPr><w:b/><w:color w:val='1F3864'/><w:sz w:val='34'/></w:rPr></w:style>
<w:style w:type='paragraph' w:styleId='Heading2'><w:name w:val='heading 2'/><w:basedOn w:val='Normal'/><w:next w:val='Normal'/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before='240' w:after='100'/><w:outlineLvl w:val='1'/></w:pPr><w:rPr><w:b/><w:color w:val='2E5496'/><w:sz w:val='27'/></w:rPr></w:style>
<w:style w:type='paragraph' w:styleId='Heading3'><w:name w:val='heading 3'/><w:basedOn w:val='Normal'/><w:next w:val='Normal'/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before='180' w:after='80'/><w:outlineLvl w:val='2'/></w:pPr><w:rPr><w:b/><w:color w:val='2E5496'/><w:sz w:val='23'/></w:rPr></w:style>
<w:style w:type='paragraph' w:styleId='Heading4'><w:name w:val='heading 4'/><w:basedOn w:val='Normal'/><w:next w:val='Normal'/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before='140' w:after='60'/><w:outlineLvl w:val='3'/></w:pPr><w:rPr><w:b/><w:color w:val='404040'/><w:sz w:val='22'/></w:rPr></w:style>
<w:style w:type='character' w:styleId='Hyperlink'><w:name w:val='Hyperlink'/><w:rPr><w:color w:val='0563C1'/><w:u w:val='single'/></w:rPr></w:style>
</w:styles>
'@

$numHead = @'
<w:numbering xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'>
<w:abstractNum w:abstractNumId='0'><w:lvl w:ilvl='0'><w:start w:val='1'/><w:numFmt w:val='bullet'/><w:lvlText w:val='&#8226;'/><w:lvlJc w:val='left'/><w:pPr><w:ind w:left='540' w:hanging='360'/></w:pPr><w:rPr><w:rFonts w:ascii='Arial' w:hAnsi='Arial' w:hint='default'/></w:rPr></w:lvl><w:lvl w:ilvl='1'><w:start w:val='1'/><w:numFmt w:val='bullet'/><w:lvlText w:val='&#9702;'/><w:lvlJc w:val='left'/><w:pPr><w:ind w:left='1080' w:hanging='360'/></w:pPr><w:rPr><w:rFonts w:ascii='Arial' w:hAnsi='Arial' w:hint='default'/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId='1'><w:lvl w:ilvl='0'><w:start w:val='1'/><w:numFmt w:val='decimal'/><w:lvlText w:val='%1.'/><w:lvlJc w:val='left'/><w:pPr><w:ind w:left='600' w:hanging='360'/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId='2'><w:lvl w:ilvl='0'><w:start w:val='1'/><w:numFmt w:val='bullet'/><w:lvlText w:val='&#9744;'/><w:lvlJc w:val='left'/><w:pPr><w:ind w:left='540' w:hanging='360'/></w:pPr><w:rPr><w:rFonts w:ascii='Segoe UI Symbol' w:hAnsi='Segoe UI Symbol' w:hint='default'/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId='1'><w:abstractNumId w:val='0'/></w:num>
<w:num w:numId='2'><w:abstractNumId w:val='2'/></w:num>
'@
$numberingXml = $numHead
for($i=10;$i -le 49;$i++){ $numberingXml += "<w:num w:numId='$i'><w:abstractNumId w:val='1'/></w:num>" }
$numberingXml += '</w:numbering>'

$settingsBody = @'
<w:settings xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:zoom w:percent='100'/><w:defaultTabStop w:val='708'/><w:updateFields w:val='true'/><w:compat><w:compatSetting w:name='compatibilityMode' w:uri='http://schemas.microsoft.com/office/word' w:val='15'/></w:compat></w:settings>
'@

$footerBody = @'
<w:ftr xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'>
<w:p><w:pPr><w:pBdr><w:top w:val='single' w:sz='4' w:space='4' w:color='BFBFBF'/></w:pBdr><w:tabs><w:tab w:val='right' w:pos='9638'/></w:tabs><w:spacing w:after='0'/></w:pPr><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:t>FitAvo &#8211; Masterfile (vertraulich)</w:t></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:tab/><w:t xml:space='preserve'>Seite </w:t></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:fldChar w:fldCharType='begin'/></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:instrText xml:space='preserve'> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:fldChar w:fldCharType='end'/></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:t xml:space='preserve'> von </w:t></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:fldChar w:fldCharType='begin'/></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:instrText xml:space='preserve'> NUMPAGES </w:instrText></w:r><w:r><w:rPr><w:color w:val='595959'/><w:sz w:val='16'/></w:rPr><w:fldChar w:fldCharType='end'/></w:r></w:p>
</w:ftr>
'@

$contentTypes = @'
<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'>
<Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/>
<Default Extension='xml' ContentType='application/xml'/>
<Override PartName='/word/document.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'/>
<Override PartName='/word/styles.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'/>
<Override PartName='/word/numbering.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'/>
<Override PartName='/word/settings.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml'/>
<Override PartName='/word/footer1.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'/>
<Override PartName='/docProps/core.xml' ContentType='application/vnd.openxmlformats-package.core-properties+xml'/>
<Override PartName='/docProps/app.xml' ContentType='application/vnd.openxmlformats-officedocument.extended-properties+xml'/>
</Types>
'@

$relsRoot = @'
<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>
<Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='word/document.xml'/>
<Relationship Id='rId2' Type='http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties' Target='docProps/core.xml'/>
<Relationship Id='rId3' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties' Target='docProps/app.xml'/>
</Relationships>
'@

$relsDoc = @'
<Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>
<Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles' Target='styles.xml'/>
<Relationship Id='rId2' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering' Target='numbering.xml'/>
<Relationship Id='rId3' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings' Target='settings.xml'/>
<Relationship Id='rId4' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer' Target='footer1.xml'/>
</Relationships>
'@

$coreBody = @'
<cp:coreProperties xmlns:cp='http://schemas.openxmlformats.org/package/2006/metadata/core-properties' xmlns:dc='http://purl.org/dc/elements/1.1/' xmlns:dcterms='http://purl.org/dc/terms/' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance'>
<dc:title>FitAvo &#8211; Masterfile</dc:title><dc:subject>Fitness- und Ern&#228;hrungs-App</dc:subject><dc:creator>Gr&#252;ndungsteam</dc:creator><cp:keywords>Fitness, Ern&#228;hrung, App, Masterfile, Roadmap</cp:keywords><cp:lastModifiedBy>Gr&#252;ndungsteam</cp:lastModifiedBy><cp:revision>1</cp:revision>
</cp:coreProperties>
'@

$appBody = @'
<Properties xmlns='http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'>
<Application>FitAvo Masterfile Generator</Application><Company>FitAvo</Company>
</Properties>
'@

# ---------- assemble parts ----------
$parts = [ordered]@{}
$parts['[Content_Types].xml']        = $xmlDecl + $contentTypes
$parts['_rels/.rels']                = $xmlDecl + $relsRoot
$parts['word/document.xml']          = $documentXml
$parts['word/_rels/document.xml.rels'] = $xmlDecl + $relsDoc
$parts['word/styles.xml']            = $xmlDecl + $stylesBody
$parts['word/numbering.xml']         = $xmlDecl + $numberingXml
$parts['word/settings.xml']          = $xmlDecl + $settingsBody
$parts['word/footer1.xml']           = $xmlDecl + $footerBody
$parts['docProps/core.xml']          = $xmlDecl + $coreBody
$parts['docProps/app.xml']           = $xmlDecl + $appBody

# ---------- validate XML well-formedness ----------
$bad = 0
foreach($name in $parts.Keys){
  try { [xml]$parts[$name] | Out-Null }
  catch { Write-Host "MALFORMED: $name -> $($_.Exception.Message)"; $bad++ }
}
if($bad -gt 0){ throw "$bad part(s) malformed - aborting." }
Write-Host "XML well-formedness: OK ($($parts.Count) parts)"

# ---------- write .docx (zip) ----------
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if(Test-Path $outPath){ Remove-Item $outPath -Force }
$enc = New-Object System.Text.UTF8Encoding($false)
$fs = [System.IO.File]::Open($outPath,[System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs,[System.IO.Compression.ZipArchiveMode]::Create)
foreach($name in $parts.Keys){
  $entry = $zip.CreateEntry($name,[System.IO.Compression.CompressionLevel]::Optimal)
  $es = $entry.Open()
  $sw = New-Object System.IO.StreamWriter($es,$enc)
  $sw.Write($parts[$name]); $sw.Flush(); $sw.Dispose(); $es.Dispose()
}
$zip.Dispose(); $fs.Close()

# ---------- re-open and verify ----------
$fs2 = [System.IO.File]::OpenRead($outPath)
$zip2 = New-Object System.IO.Compression.ZipArchive($fs2,[System.IO.Compression.ZipArchiveMode]::Read)
$verErr = 0
foreach($e in $zip2.Entries){
  if($e.FullName -match '\.(xml|rels)$'){
    $sr = New-Object System.IO.StreamReader($e.Open())
    $txt = $sr.ReadToEnd(); $sr.Dispose()
    try { [xml]$txt | Out-Null } catch { Write-Host "REOPEN-MALFORMED: $($e.FullName)"; $verErr++ }
  }
}
$entryCount = $zip2.Entries.Count
$zip2.Dispose(); $fs2.Close()

$size = [math]::Round((Get-Item $outPath).Length/1KB,1)
Write-Host "Zip entries: $entryCount, reopen errors: $verErr"
Write-Host "Blocks rendered from JSON: $($json.Count)"
Write-Host "Created: $outPath ($size KB)"
